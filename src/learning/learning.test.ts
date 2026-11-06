import { describe, expect, it } from 'vitest'
import { NODES, PATHWAYS, nodeById } from '../curriculum/nodes'
import { TEMPLATES, nodeItems, templatesForItem, templatesForNode } from '../exercise-engine/registry'
import type { Difficulty } from '../exercise-engine/types'
import { computeNodeMastery, nextPathwayNode, recommendations, weakItems } from './mastery'
import type { ExerciseAttempt } from './records'
import { DAY, RECHECK_MS, SCHEDULER_VERSION, applyReview, rankDueItems, replayHistory, type ReviewState } from './scheduler'
import { buildGuidedSession, buildLesson, insertRecheck, interleave } from './sessions'

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
    const plan = buildGuidedSession({ minutes: 5, seed: 9, now: T0, audio: true, reviews: new Map(), mastery: new Map(), preference: 'auto' })
    const questions = plan.filter(p => p.kind === 'question')
    expect(plan[0]).toEqual({ kind: 'learn', nodeId: 'fret.naturals.all' })
    expect(questions).toHaveLength(10)
    expect(questions.filter(p => p.kind === 'question' && p.question.nodeId === 'fret.naturals.all' && p.question.kind === 'fret-locate')).toHaveLength(6)
    expect(questions.some(p => p.kind === 'question' && p.question.nodeId === 'fret.octaves')).toBe(false)
    expect(questions.filter(p => p.kind === 'question' && p.question.nodeId === 'scale.major' && p.question.kind === 'construct')).toHaveLength(2)
    expect(questions.filter(p => p.kind === 'question' && p.question.nodeId === 'ear.basic')).toHaveLength(2)
    expect(questions.some(p => p.kind === 'question' && p.question.kind === 'rhythm')).toBe(false)
    expect(plan.at(-1)).toMatchObject({ kind: 'bridge', nodeId: 'fret.naturals.all' })
  })
  it('leaves ear questions out when sound is off', () => {
    const plan = buildGuidedSession({ minutes: 5, seed: 9, now: T0, audio: false, reviews: new Map(), mastery: new Map(), preference: 'auto' })
    const questions = plan.filter(p => p.kind === 'question')
    expect(questions.some(p => p.kind === 'question' && (p.question.nodeId === 'ear.basic' || p.question.audio))).toBe(false)
    expect(questions.filter(p => p.kind === 'question' && p.question.nodeId === 'scale.major')).toHaveLength(2)
  })
  it('guided session puts due reviews first, targeted at the due items', () => {
    const reviews = new Map(['fret.note.C.s5', 'interval.M3', 'triad.minor'].map(id => [id, applyReview(undefined, ev(false, T0 - DAY, false, id))]))
    const plan = buildGuidedSession({ minutes: 5, seed: 2, now: T0, audio: false, reviews, mastery: new Map(), preference: 'auto' })
    const first = plan.slice(0, 3).flatMap(p => p.kind === 'question' ? p.question.reviewItemIds : [])
    expect(first).toEqual(expect.arrayContaining(['fret.note.C.s5', 'interval.M3', 'triad.minor']))
  })
  it('interleaves nodes and inserts rechecks ≥ 3 items later', () => {
    const q = (nodeId: string) => ({ kind: 'learn', nodeId }) as const
    expect(interleave([q('a'), q('a'), q('b'), q('b')]).map(i => i.kind === 'learn' && i.nodeId)).toEqual(['a', 'b', 'a', 'b'])
    const plan = [q('a'), q('b'), q('c'), q('d'), q('e'), q('f')]
    expect(insertRecheck(plan, 0, q('r')).map(i => i.kind === 'learn' && i.nodeId)).toEqual(['a', 'b', 'c', 'd', 'r', 'e', 'f'])
  })
})
