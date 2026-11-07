import { describe, expect, it } from 'vitest'
import { NODES, PATHWAYS, nodeById } from '../curriculum/nodes'
import { TEMPLATES, generate, nodeItems, templatesForItem, templatesForNode } from '../exercise-engine/registry'
import type { Difficulty } from '../exercise-engine/types'
import { computeNodeMastery, nextPathwayNode, recommendations, weakItems } from './mastery'
import type { ExerciseAttempt } from './records'
import { DAY, RECHECK_MS, SCHEDULER_VERSION, applyReview, rankDueItems, replayHistory, type ReviewState } from './scheduler'
import { buildGuidedSession, buildLesson, insertRecheck, interleave, intervalPracticeDifficulty, withoutDegreePositionQuestions } from './sessions'

const T0 = Date.UTC(2026, 10, 2, 9) // a Monday
const ev = (correct: boolean, timestamp: number, assisted = false, itemId = 'x') => ({ itemId, correct, assisted, timestamp })

describe('scheduler rules (spec §6.2)', () => {
  it('climbs 1 → 3 → 7 → 14 → 30 days on on-time successes and caps at box 5', () => {
    let s: ReviewState | undefined
    const gaps: number[] = []
    let t = T0
    for (let i = 0; i < 7; i++) {
      s = applyReview(s, ev(true, t))
      gaps.push(Math.round((s.dueAt - t) / DAY))
      t = s.dueAt
    }
    expect(gaps).toEqual([1, 3, 7, 14, 30, 30, 30])
    expect(s!.box).toBe(5)
    expect(s!.schedulerVersion).toBe(SCHEDULER_VERSION)
  })
  it('a miss drops to box 0 with a short recheck and keeps the lapse in history', () => {
    let s = applyReview(undefined, ev(true, T0))
    s = applyReview(s, ev(true, s.dueAt))
    s = applyReview(s, ev(false, s.dueAt + 5))
    expect(s.box).toBe(0)
    expect(s.dueAt - s.lastReviewedAt).toBe(RECHECK_MS)
    expect(s.lapses).toBe(1)
    const recovered = applyReview(s, ev(true, s.dueAt))
    expect(recovered.box).toBe(1)
    expect(recovered.lapses).toBe(1)
    expect(recovered.recent).toEqual([true, true, false, true])
  })
  it('assisted success (hint or retry) stays in box 0 for a recheck', () => {
    const missed = applyReview(undefined, ev(false, T0))
    const assisted = applyReview(missed, ev(true, T0 + 1000, true))
    expect(assisted.box).toBe(0)
    expect(assisted.dueAt).toBe(T0 + 1000 + RECHECK_MS)
  })
  it('a late review advances only one box', () => {
    const s = applyReview(applyReview(undefined, ev(true, T0)), ev(true, T0 + 40 * DAY))
    expect(s.box).toBe(2)
  })
  it('cramming before the due date keeps the box', () => {
    const s1 = applyReview(undefined, ev(true, T0))
    const s2 = applyReview(s1, ev(true, T0 + 60_000))
    expect(s2.box).toBe(1)
    expect(s2.dueAt).toBe(s1.dueAt)
  })
  it('replay is order-independent and deterministic', () => {
    const events = [ev(true, T0, false, 'a'), ev(false, T0 + DAY, false, 'a'), ev(true, T0, false, 'b')]
    const a = replayHistory(events)
    const b = replayHistory([...events].reverse())
    const sorted = (m: Map<string, ReviewState>) => [...m.entries()].sort(([x], [y]) => x.localeCompare(y))
    expect(sorted(a)).toEqual(sorted(b))
  })
  it('ranks missed first, then most overdue, ties by item ID, with a reason', () => {
    const states = [
      applyReview(undefined, ev(true, T0 - 5 * DAY, false, 'b.overdue')),
      applyReview(undefined, ev(true, T0 - 5 * DAY, false, 'a.overdue')),
      applyReview(undefined, ev(false, T0 - DAY, false, 'z.missed')),
      applyReview(undefined, ev(true, T0, false, 'not.due')),
    ]
    const ranked = rankDueItems(states, T0)
    expect(ranked.map(r => r.itemId)).toEqual(['z.missed', 'a.overdue', 'b.overdue'])
    expect(ranked[0].reason).toContain('答錯')
    expect(ranked[1].reason).toContain('已到期 4 天')
  })
})

describe('curriculum and templates', () => {
  it('every available node has ≥ 2 templates, content, can-do outcomes and a bridge task', () => {
    for (const node of NODES.filter(n => n.availability === 'available')) {
      expect(templatesForNode(node.id).length, node.id).toBeGreaterThanOrEqual(2)
      expect(node.content, node.id).toBeDefined()
      expect(node.canDo.length, node.id).toBeGreaterThan(0)
      expect(node.bridge, node.id).toBeDefined()
    }
  })
  it('no template points at a planned node, and prerequisites and pathway steps exist', () => {
    for (const t of TEMPLATES) expect(nodeById(t.nodeId)?.availability, t.id).toBe('available')
    for (const n of NODES) for (const p of n.prerequisites) expect(nodeById(p), `${n.id} → ${p}`).toBeDefined()
    for (const p of PATHWAYS) for (const s of p.steps) expect(nodeById(s), `${p.id} → ${s}`).toBeDefined()
  })
  it('generators are deterministic, serializable and cover each declared item', () => {
    for (const t of TEMPLATES) {
      for (const d of [1, 2, 3] as Difficulty[]) {
        for (const seed of [1, 42, 99999]) {
          const a = t.generate(seed, { difficulty: d })
          expect(t.generate(seed, { difficulty: d }), t.id).toEqual(a)
          expect(JSON.parse(JSON.stringify(a)), t.id).toEqual(a)
          expect(a.reviewItemIds.every(id => t.items().includes(id)), `${t.id} items`).toBe(true)
          if (a.kind === 'choice') expect(a.choices, t.id).toContain(a.answer)
          if (a.kind === 'choice') expect(new Set(a.choices).size, `${t.id} unique choices`).toBe(a.choices.length)
        }
      }
      for (const itemId of t.items().filter(id => !id.startsWith('spell.')).slice(0, 30)) {
        const q = t.generate(7, { difficulty: 1, itemId })
        expect(q.reviewItemIds, `${t.id} → ${itemId}`).toContain(itemId)
      }
    }
  })
  it('maps every node item back to a template', () => {
    for (const node of NODES.filter(n => n.availability === 'available')) for (const item of nodeItems(node.id)) expect(templatesForItem(item).length, item).toBeGreaterThan(0)
  })
})

const attempt = (nodeId: string, correct: boolean, timestamp: number, evidenceLevel: ExerciseAttempt['evidenceLevel'] = 'recall', itemId = 'x'): ExerciseAttempt => ({
  id: `${nodeId}-${timestamp}-${Math.random()}`, sessionId: 's', exerciseType: 'choice', topicId: nodeId, nodeId, reviewItemIds: [itemId], itemResults: { [itemId]: correct },
  generatorVersion: 1, question: {}, response: {}, expected: '', correct, result: correct ? 'correct' : 'incorrect', evidenceLevel, assisted: false, responseMs: 0, replays: 0, difficulty: 1, timestamp,
})

describe('mastery and recommendations', () => {
  it('needs evidence across days and items before Familiar', () => {
    const items = nodeItems('fret.open')
    const attempts = Array.from({ length: 10 }, (_, i) => attempt('fret.open', true, T0 + i * 60_000, 'recall', items[i % 6]))
    const reviews = replayHistory(attempts.map(a => ({ itemId: a.reviewItemIds[0], correct: true, assisted: false, timestamp: a.timestamp })))
    expect(computeNodeMastery('fret.open', attempts, reviews, [], T0).state).toBe('learning')
    const day2 = items.map((id, i) => attempt('fret.open', true, T0 + DAY + 3_600_000 + 1000 * i, 'recall', id))
    const all = [...attempts, ...day2]
    const reviews2 = replayHistory(all.map(a => ({ itemId: a.reviewItemIds[0], correct: true, assisted: false, timestamp: a.timestamp })))
    expect(computeNodeMastery('fret.open', all, reviews2, [], T0 + DAY + 3_700_000).state).toBe('familiar')
  })
  it('exploration and skips leave mastery untouched (only graded attempts count)', () => {
    expect(computeNodeMastery('fret.open', [], new Map(), [], T0).state).toBe('new')
  })
  it('does not show a single miss as a weakness', () => {
    const one = applyReview(undefined, ev(false, T0, false, 'fret.note.C.s5'))
    expect(weakItems([one])).toEqual([])
    let s = one
    s = applyReview(s, ev(false, T0 + 1, false, 'fret.note.C.s5'))
    s = applyReview(s, ev(true, T0 + 2, false, 'fret.note.C.s5'))
    expect(weakItems([s])[0]).toMatchObject({ itemId: 'fret.note.C.s5', misses: 2, reason: '最近 3 次錯 2 次' })
  })
  it('recommends due reviews and the next Start Here step with reasons', () => {
    const reviews = new Map([['fret.open.s1', applyReview(undefined, ev(false, T0 - DAY, false, 'fret.open.s1'))]])
    const recs = recommendations([], reviews, new Map(), T0)
    expect(recs[0]).toMatchObject({ kind: 'due' })
    expect(recs[1]).toMatchObject({ kind: 'pathway', nodeId: 'fret.naturals.all' })
    expect(nextPathwayNode('start', new Map())).toBe('fret.naturals.all')
  })
})

describe('session planning', () => {
  it('builds a lesson following the loop and ending with a bridge task', () => {
    const plan = buildLesson({ nodeId: 'interval.basics', seed: 3, difficulty: 1, audio: false })
    expect(plan[0]).toEqual({ kind: 'learn', nodeId: 'interval.basics' })
    expect(plan.at(-1)).toMatchObject({ kind: 'bridge' })
    expect(plan.filter(p => p.kind === 'question').length).toBeGreaterThanOrEqual(3)
    expect(buildLesson({ nodeId: 'interval.basics', seed: 3, difficulty: 1, audio: false })).toEqual(plan)
  })
  it('skips audio-only questions when sound is off', () => {
    const silent = buildLesson({ nodeId: 'ear.basic', seed: 1, difficulty: 1, audio: false })
    expect(silent.some(p => p.kind === 'question' && p.question.audio)).toBe(false)
  })
  it('guided session for a new learner starts Start Here with a learn card', () => {
    const plan = buildGuidedSession({ seed: 9, now: T0, audio: true, reviews: new Map(), mastery: new Map(), preference: 'auto' })
    const questions = plan.filter(p => p.kind === 'question')
    expect(plan[0]).toEqual({ kind: 'learn', nodeId: 'fret.naturals.all' })
    expect(questions).toHaveLength(6)
    expect(questions.every(p => p.kind === 'question' && p.question.kind === 'fret-locate')).toBe(true)
    expect(questions.filter(p => p.kind === 'question' && p.question.nodeId === 'fret.naturals.all')).toHaveLength(6)
    expect(questions.some(p => p.kind === 'question' && (p.question.nodeId === 'scale.major' || p.question.nodeId === 'key.diatonic' || p.question.prompt.includes('級')))).toBe(false)
    expect(questions.some(p => p.kind === 'question' && (p.question.nodeId === 'fret.octaves' || p.question.prompt.includes('高一個八度') || p.question.kind === 'choice' || p.question.kind === 'construct'))).toBe(false)
    expect(plan.some(p => p.kind === 'bridge')).toBe(false)
    const continued = buildGuidedSession({ seed: 9, now: T0, audio: true, reviews: new Map(), mastery: new Map(), preference: 'auto', intro: false })
    expect(continued.some(p => p.kind === 'learn' || p.kind === 'bridge')).toBe(false)
    expect(continued.filter(p => p.kind === 'question')).toHaveLength(6)
  })
  it('leaves ear questions out when sound is off', () => {
    const plan = buildGuidedSession({ seed: 9, now: T0, audio: false, reviews: new Map(), mastery: new Map(), preference: 'auto' })
    const questions = plan.filter(p => p.kind === 'question')
    expect(questions.some(p => p.kind === 'question' && (p.question.nodeId === 'ear.basic' || p.question.audio))).toBe(false)
    expect(questions.every(p => p.kind === 'question' && p.question.kind === 'fret-locate')).toBe(true)
    expect(questions.some(p => p.kind === 'question' && (p.question.nodeId === 'scale.major' || p.question.prompt.includes('級')))).toBe(false)
  })
  it('unintroduced due items do not interrupt the first same-note round', () => {
    const reviews = new Map(['fret.note.C.s5', 'fret.note.G.s6', 'fret.octave.s6-s4', 'interval.M3'].map(id => [id, applyReview(undefined, ev(false, T0 - DAY, false, id))]))
    const plan = buildGuidedSession({ seed: 2, now: T0, audio: false, reviews, mastery: new Map(), preference: 'auto', intro: false })
    expect(plan).toHaveLength(6)
    expect(plan.every(p => p.kind === 'question' && p.question.kind === 'fret-locate' && p.question.targetPc === 0)).toBe(true)
    expect(plan.flatMap(p => p.kind === 'question' ? p.question.reviewItemIds : [])).toEqual([6, 5, 4, 3, 2, 1].map(s => `fret.note.C.s${s}`))
  })
  it('keeps scale degrees out of the fretboard taps', () => {
    const lesson = buildLesson({ nodeId: 'scale.major', seed: 1, difficulty: 1, audio: false })
    const questions = lesson.filter(p => p.kind === 'question')
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.every(p => p.kind === 'question' && p.question.kind !== 'fret-locate')).toBe(true)
    expect(questions.some(p => p.kind === 'question' && p.question.prompt.includes('級'))).toBe(true)
    const note = generate('fret.naturals.all.locate', 1, 1)
    const degree = generate('scale.major.locate', 2, 1)
    const mixed = withoutDegreePositionQuestions({
      plannedItems: [
        { kind: 'question', question: note, reason: '找音' },
        { kind: 'question', question: degree, reason: '級數' },
        { kind: 'question', question: { ...note, id: 'again' }, reason: '找音' },
      ],
      cursor: 1,
      outcomes: [{ index: 0, result: 'correct' }, { index: 2, result: 'incorrect' }],
    })
    expect(mixed.plannedItems.map(item => item.kind === 'question' && item.question.id)).toEqual([note.id, 'again'])
    expect(mixed.cursor).toBe(1)
    expect(mixed.outcomes.map(outcome => outcome.index)).toEqual([0, 1])
  })
  it('interleaves nodes and inserts rechecks ≥ 3 items later', () => {
    const q = (nodeId: string) => ({ kind: 'learn', nodeId }) as const
    expect(interleave([q('a'), q('a'), q('b'), q('b')]).map(i => i.kind === 'learn' && i.nodeId)).toEqual(['a', 'b', 'a', 'b'])
    const plan = [q('a'), q('b'), q('c'), q('d'), q('e'), q('f')]
    expect(insertRecheck(plan, 0, q('r')).map(i => i.kind === 'learn' && i.nodeId)).toEqual(['a', 'b', 'c', 'd', 'r', 'e', 'f'])
  })
})


it('a note lesson includes both location and active naming without changing continuous commute practice', () => {
  const lesson = buildLesson({ nodeId: 'fret.naturals.low', seed: 1, difficulty: 1, audio: false })
  const kinds = lesson.flatMap(i => i.kind === 'question' ? [i.question.kind] : [])
  expect(kinds).toContain('fret-locate'); expect(kinds).toContain('fret-identify')
  for (const focus of ['naming', 'positions', 'intervals', 'chord-tones'] as const) {
    const plan = buildGuidedSession({ seed: 7, now: T0, audio: false, reviews: new Map(), mastery: new Map(), preference: 'auto', focus })
    expect(plan).toHaveLength(8)
    expect(plan.every(i => i.kind === 'question' && !i.question.audio)).toBe(true)
    expect(plan.some(i => i.kind === 'question' && ['scale.major', 'key.diatonic', 'fret.octaves'].includes(i.question.nodeId))).toBe(false)
  }
})


it('using a hint does not count as independent recall evidence', () => {
  const hinted = Array.from({ length: 12 }, (_, i) => ({ ...attempt('fret.open', true, T0 + i * DAY), assisted: true }))
  const state = computeNodeMastery('fret.open', hinted, new Map(), [], T0 + 13 * DAY)
  expect(state.samples).toBe(0)
  expect(state.state).toBe('new')
})


it('interval pitch practice advances its own difficulty without granting location mastery', () => {
  const base = { seed: 1, now: T0, audio: false, reviews: new Map(), mastery: new Map(), preference: 'auto' as const, practiceContext: 'instrument' as const }
  const first = Array.from({ length: 6 }, (_, i) => ({ ...attempt('interval.shapes', true, T0 + i), inputMethod: 'microphone' as const, practiceContext: 'instrument' as const, reviewItemIds: [], itemResults: {} }))
  expect(intervalPracticeDifficulty(base)).toBe(1)
  expect(intervalPracticeDifficulty({ ...base, attempts: first })).toBe(2)
  expect(intervalPracticeDifficulty({ ...base, attempts: first, practiceContext: 'pocket' })).toBe(1)
  expect(intervalPracticeDifficulty({ ...base, attempts: first.map(a => ({ ...a, assisted: true })) })).toBe(1)
  const second = first.map((a, i) => ({ ...a, id: `second-${i}`, difficulty: 2, timestamp: T0 + 10 + i }))
  expect(intervalPracticeDifficulty({ ...base, attempts: [...first, ...second] })).toBe(3)
  expect(intervalPracticeDifficulty({ ...base, attempts: [...first, ...second], preference: 1 })).toBe(1)
  expect(computeNodeMastery('interval.shapes', [...first, ...second], new Map(), [], T0).samples).toBe(0)
  const plan = buildGuidedSession({ ...base, attempts: first, focus: 'intervals' })
  expect(plan.every(p => p.kind === 'question' && p.question.difficulty === 2)).toBe(true)
})
