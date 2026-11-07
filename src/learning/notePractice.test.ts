import { describe, expect, it } from 'vitest'
import { buildNotePractice } from './notePractice'
import type { ExerciseAttempt, PlannedItem } from './records'
import type { FretLocateQuestion } from '../exercise-engine/types'
import { playedQuestion } from '../exercise-engine/playedAnswer'
import { locateTargets } from '../exercise-engine/validate'
import { applyReview, DAY } from './scheduler'
import { recheckFor } from './sessions'

const now = Date.UTC(2026, 10, 7)
const options = { seed: 42, now, attempts: [] as ExerciseAttempt[], practiceContext: 'pocket' as const, reviews: new Map(), preference: 'auto' as const }
const questions = (plan: PlannedItem[]) => plan.flatMap(p => p.kind === 'question' ? [p.question as FretLocateQuestion] : [])
function record(q: FretLocateQuestion, index: number, patch: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return { id: `attempt-${index}`, sessionId: 'test-session', exerciseType: q.kind, templateId: q.templateId, topicId: q.nodeId, nodeId: q.nodeId,
    inputMethod: 'tap', practiceContext: 'pocket', reviewItemIds: q.reviewItemIds, itemResults: {}, generatorVersion: q.generatorVersion,
    question: q, response: {}, expected: '', correct: true, result: 'correct', evidenceLevel: q.evidenceLevel, assisted: false,
    responseMs: 0, replays: 0, difficulty: q.difficulty, timestamp: now + index * 1000, ...patch }
}
const complete = (plan: PlannedItem[], start = 0) => questions(plan).map((q, i) => record(q, start + i))

describe('progressive note finding', () => {
  it('starts with C across all six strings, with exact octaves and no exposed answer', () => {
    const plan = buildNotePractice(options)
    const qs = questions(plan)
    expect(qs.map(q => q.string)).toEqual([6, 5, 4, 3, 2, 1])
    expect(qs.every(q => q.targetPc === 0 && q.practiceStage === 'map')).toBe(true)
    for (const q of qs) {
      expect(locateTargets(q)).toHaveLength(1)
      expect(playedQuestion(q).prompt).toMatch(/^找出 C[3-5]，並彈出來$/)
      expect(q.display?.positions).toBeUndefined()
    }
    expect(buildNotePractice(options)).toEqual(plan)
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan)
  })
  it('shuffles the same note only after all strings succeed, then introduces G and reviews C', () => {
    const map = buildNotePractice(options)
    const first = complete(map)
    const shuffled = buildNotePractice({ ...options, seed: 43, attempts: first })
    expect(questions(shuffled).map(q => q.string)).not.toEqual([6, 5, 4, 3, 2, 1])
    expect(questions(shuffled).every(q => q.targetPc === 0 && q.practiceStage === 'shuffle')).toBe(true)
    expect(new Set(questions(shuffled).map(q => q.string)).size).toBe(6)
    const attempts = [...first, ...complete(shuffled, 6)]
    const next = questions(buildNotePractice({ ...options, seed: 44, attempts }))
    expect(next.slice(0, 6).map(q => q.string)).toEqual([6, 5, 4, 3, 2, 1])
    expect(next.slice(0, 6).every(q => q.targetPc === 7 && q.practiceStage === 'map')).toBe(true)
    expect(next.slice(6)).toHaveLength(2)
    expect(next.slice(6).every(q => q.targetPc === 0 && q.practiceStage === 'mixed')).toBe(true)
  })
  it('a hint, miss or immediate retry cannot finish a round; only unresolved strings return', () => {
    const first = complete(buildNotePractice(options))
    first[1].assisted = true
    first[3].correct = false; first[3].result = 'incorrect'
    const retry = { ...first[3], id: 'retry', correct: true, result: 'correct' as const, assisted: true, retryOf: first[3].id, timestamp: now + 9000 }
    const next = questions(buildNotePractice({ ...options, attempts: [...first, retry] }))
    expect(next.map(q => q.string)).toEqual([5, 3])
    expect(next.every(q => q.targetPc === 0 && q.practiceStage === 'map')).toBe(true)
    const recheck = recheckFor(next[0], 123)
    expect(recheck?.kind === 'question' && recheck.question).toMatchObject({ practiceStage: 'map', targetMidi: next[0].targetMidi })
  })
  it('preserves the route after reload, separates contexts, and does not require pitch to grant position mastery', () => {
    const first = complete(buildNotePractice(options)).map(a => ({ ...a, inputMethod: 'microphone' as const, practiceContext: 'instrument' as const, reviewItemIds: [], itemResults: {} }))
    expect(questions(buildNotePractice({ ...options, attempts: first })).every(q => q.practiceStage === 'map')).toBe(true)
    const input = { ...options, practiceContext: 'instrument' as const, attempts: first }
    expect(questions(buildNotePractice(input)).every(q => q.practiceStage === 'shuffle')).toBe(true)
    expect(buildNotePractice({ ...input, attempts: JSON.parse(JSON.stringify(first)) })).toEqual(buildNotePractice(input))
    expect(first.every(a => a.reviewItemIds.length === 0)).toBe(true)
  })
  it('prioritizes missed and overdue learned positions without introducing unknown notes into review', () => {
    const map = complete(buildNotePractice(options))
    const shuffled = complete(buildNotePractice({ ...options, attempts: map }), 6)
    const q = questions(buildNotePractice(options))[4]
    const miss = record({ ...q, practiceStage: 'mixed' }, 20, { correct: false, result: 'incorrect' })
    const reviews = new Map([['fret.note.C.s6', applyReview(undefined, { itemId: 'fret.note.C.s6', correct: true, assisted: false, timestamp: now - 2 * DAY })]])
    const review = questions(buildNotePractice({ ...options, reviews, attempts: [...map, ...shuffled, miss] })).slice(6)
    expect(new Set(review.map(q => q.string))).toEqual(new Set([2, 6]))
    expect(review.every(q => q.targetPc === 0 && q.practiceStage === 'mixed')).toBe(true)
  })
  it('covers open strings and their fret-12 octaves, then stays in mixed review after all twelve notes', () => {
    let attempts: ExerciseAttempt[] = []
    const seen = new Set<string>()
    for (let round = 0; round < 24; round++) {
      const plan = buildNotePractice({ ...options, attempts, seed: round + 1 })
      for (const q of questions(plan)) for (const p of locateTargets(q)) seen.add(`${p.string}-${p.fret}`)
      attempts = [...attempts, ...complete(plan, attempts.length)]
    }
    expect(seen.size).toBe(78)
    const mixed = questions(buildNotePractice({ ...options, attempts }))
    expect(mixed).toHaveLength(8)
    expect(mixed.every(q => q.practiceStage === 'mixed')).toBe(true)
    expect(new Set(mixed.map(q => `${q.targetPc}-${q.string}`)).size).toBe(8)
  })
})
