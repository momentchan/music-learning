import { describe, expect, it } from 'vitest'
import { generate } from '../exercise-engine/registry'
import { locateTargets, validate } from '../exercise-engine/validate'
import type { ConstructQuestion, FretLocateQuestion } from '../exercise-engine/types'
import { MAJOR_KEYS, scaleNotes } from '../music-theory/keys'
import { noteId, parseNote } from '../music-theory/notes'
import { buildGuidedSession, recheckFor, withoutDegreePositionQuestions, type GuidedOptions } from './sessions'
import type { ExerciseAttempt, PlannedItem } from './records'
import { applyReview } from './scheduler'
import { itemLabel } from './labels'

const base: GuidedOptions = { seed: 71, now: 1000000, audio: false, reviews: new Map(), mastery: new Map(), preference: 'auto', focus: 'scales', practiceContext: 'pocket', attempts: [] }
function evidence(plan: PlannedItem[], offset: number): ExerciseAttempt[] {
  return plan.flatMap((p, i) => p.kind !== 'question' ? [] : [{
    id: `a${offset + i}`, question: p.question, correct: true, assisted: false, timestamp: offset + i,
    exerciseType: p.question.kind, practiceContext: 'pocket',
  } as ExerciseAttempt])
}

describe('independent major-scale practice', () => {
  it('begins directly in C major with all six non-tonic degrees, then two naming recalls', () => {
    const plan = buildGuidedSession(base)
    expect(buildGuidedSession(base)).toEqual(plan)
    expect(plan).toHaveLength(8)
    const questions = plan.flatMap(p => p.kind === 'question' ? [p.question] : [])
    expect(questions.every(q => q.nodeId === 'scale.major' && q.scale?.tonic === 'C' && !q.audio)).toBe(true)
    expect(questions.filter(q => q.kind === 'fret-locate').map(q => q.scale!.degree)).toEqual([2, 3, 4, 5, 6, 7])
    expect(questions.filter(q => q.kind === 'construct')).toHaveLength(2)
    expect(questions[0].scale!.intro).toBe(true)
    expect(questions.every(q => !/第 . 弦|第 . 格/.test(q.prompt))).toBe(true)
    expect(withoutDegreePositionQuestions({ plannedItems: plan, cursor: 3, outcomes: [] }).plannedItems).toEqual(plan)
  })

  it('generates correctly spelled, playable degrees for every major key', () => {
    for (const tonic of MAJOR_KEYS) for (let degree = 2; degree <= 7; degree++) for (let seed = 0; seed < 20; seed++) {
      const q = generate('scale.practice.locate', seed, 3, `scale.degree.${tonic}.${degree}.locate`) as FretLocateQuestion
      expect(q.scale!.target).toBe(noteId(scaleNotes(parseNote(tonic), 'major')[degree - 1]))
      expect(q.reference!.label).toBe(q.scale!.tonic.replace('#', '♯').replace('b', '♭'))
      const targets = locateTargets(q)
      expect(targets).toHaveLength(1)
      expect(validate(q, { kind: 'fret-locate', ...targets[0] }).result).toBe('correct')
      expect(validate(q, { kind: 'played-note', midi: q.targetMidi! }).result).toBe('correct')
      expect(validate(q, { kind: 'played-note', midi: q.targetMidi! + 12 }).result).toBe('incorrect')
      const min = q.reference!.fret <= 3 ? 0 : q.reference!.fret <= 6 ? 3 : q.reference!.fret <= 9 ? 6 : 9
      expect(targets[0].fret).toBeGreaterThanOrEqual(min)
      expect(targets[0].fret).toBeLessThanOrEqual(min + 3)
      expect(q.display!.positions).toHaveLength(1)
      expect(recheckFor(q, seed + 1)?.kind).toBe('question')
      const recheck = recheckFor(q, seed + 1)!
      if (recheck.kind === 'question') expect(recheck.question.scale).toMatchObject({ tonic, degree, target: q.scale!.target })
    }
  })

  it('requires key-appropriate spelling without claiming naming evidence from enharmonic answers', () => {
    const q = generate('scale.practice.name', 1, 2, 'scale.degree.G.7.name') as ConstructQuestion
    expect(q.expected).toEqual(['F#'])
    expect(validate(q, { kind: 'construct', notes: ['F#'] }).result).toBe('correct')
    const wrong = validate(q, { kind: 'construct', notes: ['Gb'] })
    expect(wrong.result).toBe('partial')
    expect(wrong.itemResults['scale.degree.G.7.name']).toBe(false)
    expect(itemLabel(q.reviewItemIds[0])).toBe('G 大調第 7 級音名')
    expect(itemLabel('scale.degree.Bb.6.locate')).toBe('B♭ 大調第 6 級位置')
  })

  it('advances keys from independent practice, keeps contexts separate, and does not advance from hints', () => {
    let attempts: ExerciseAttempt[] = []
    for (let i = 0; i < 3; i++) {
      const plan = buildGuidedSession({ ...base, seed: i + 1, attempts })
      attempts = [...attempts, ...evidence(plan, i * 100)]
    }
    const next = buildGuidedSession({ ...base, attempts })
    expect(next.some(p => p.kind === 'question' && p.question.scale!.tonic !== 'C')).toBe(true)
    for (const options of [
      { ...base, attempts: attempts.map(a => ({ ...a, assisted: true })) },
      { ...base, attempts, practiceContext: 'instrument' as const },
      { ...base, attempts: attempts.map(a => ({ ...a, retryOf: 'first' })) },
    ]) expect(buildGuidedSession(options).every(p => p.kind === 'question' && p.question.scale!.tonic === 'C')).toBe(true)
  })

  it('reviews only introduced keys and routes each item to its matching skill', () => {
    const ids = ['scale.degree.C.7.name', 'scale.degree.C.3.locate', 'scale.degree.Ab.2.locate']
    const reviews = new Map(ids.map(itemId => [itemId, applyReview(undefined, { itemId, correct: false, timestamp: 0, assisted: false })]))
    const plan = buildGuidedSession({ ...base, reviews })
    expect(plan.some(p => p.kind === 'question' && p.question.reviewItemIds.includes(ids[0]))).toBe(true)
    expect(plan.some(p => p.kind === 'question' && p.question.reviewItemIds.includes(ids[1]))).toBe(true)
    for (const p of plan) if (p.kind === 'question') {
      expect(p.question.scale!.tonic).toBe('C')
      expect(p.question.reviewItemIds[0].endsWith(p.question.kind === 'construct' ? '.name' : '.locate')).toBe(true)
    }
  })
})
