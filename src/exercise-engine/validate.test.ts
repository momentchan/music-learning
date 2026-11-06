import { describe, expect, it } from 'vitest'
import { generate } from './registry'
import type { ConstructQuestion, FretIdentifyQuestion, FretLocateQuestion, RhythmQuestion } from './types'
import { validate } from './validate'

describe('validation against the stored question', () => {
  it('fret identify: accepts either enharmonic spelling and classifies off-by-one', () => {
    const q = generate('fret.accidentals.identify', 5, 1, 'fret.note.C#.s5') as FretIdentifyQuestion
    expect(q.answerPc).toBe(1)
    expect(validate(q, { kind: 'fret-identify', value: 'Db' }).result).toBe('correct')
    expect(validate(q, { kind: 'fret-identify', value: 'C#' }).result).toBe('correct')
    const wrong = validate(q, { kind: 'fret-identify', value: 'D' })
    expect(wrong).toMatchObject({ result: 'incorrect', errorClass: 'off-by-one' })
    expect(wrong.itemResults).toEqual({ 'fret.note.C#.s5': false })
  })
  it('fret locate: requires the prompted string and accepts fret 0 or 12 for open-string notes', () => {
    const q = generate('fret.naturals.low.locate', 1, 1, 'fret.note.E.s6') as FretLocateQuestion
    expect(validate(q, { kind: 'fret-locate', string: 6, fret: 0 }).result).toBe('correct')
    expect(validate(q, { kind: 'fret-locate', string: 6, fret: 12 }).result).toBe('correct')
    expect(validate(q, { kind: 'fret-locate', string: 5, fret: 7 })).toMatchObject({ result: 'incorrect', errorClass: 'wrong-string' })
    expect(validate(q, { kind: 'fret-locate', string: 6, fret: 1 })).toMatchObject({ errorClass: 'off-by-one' })
  })
  it('octave locate: wrong octave and G–B offset are named', () => {
    const q = generate('fret.octaves.locate', 3, 2, 'fret.octave.s4-s2') as FretLocateQuestion
    const ref = q.reference!
    expect(validate(q, { kind: 'fret-locate', string: 2, fret: ref.fret + 3 }).result).toBe('correct')
    expect(validate(q, { kind: 'fret-locate', string: 2, fret: ref.fret + 2 })).toMatchObject({ errorClass: 'gb-offset' })
  })
  it('construct: pitch-correct but misspelled is partial — correct for the interval, wrong for spelling', () => {
    const q: ConstructQuestion = { ...(generate('interval.basics.construct', 1, 1) as ConstructQuestion), expected: ['F#'], given: ['D'], reviewItemIds: ['interval.M3', 'spell.interval'] }
    const partial = validate(q, { kind: 'construct', notes: ['Gb'] })
    expect(partial).toMatchObject({ result: 'partial', errorClass: 'spelling' })
    expect(partial.itemResults).toEqual({ 'interval.M3': true, 'spell.interval': false })
    expect(validate(q, { kind: 'construct', notes: ['F'] })).toMatchObject({ result: 'incorrect', errorClass: 'quality' })
    expect(validate(q, { kind: 'construct', notes: ['G'] })).toMatchObject({ result: 'incorrect', errorClass: 'generic-size' })
    expect(validate(q, { kind: 'construct', notes: ['F#'] }).result).toBe('correct')
  })
  it('construct: chord tones are order-independent (multi-select equivalence)', () => {
    const q = { ...(generate('triad.basic.construct', 1, 1) as ConstructQuestion), expected: ['A', 'C#', 'E'], reviewItemIds: ['triad.major', 'spell.triad'] }
    expect(validate(q, { kind: 'construct', notes: ['E', 'A', 'C#'] }).result).toBe('correct')
    expect(validate(q, { kind: 'construct', notes: ['A', 'Db', 'E'] }).result).toBe('partial')
    expect(validate(q, { kind: 'construct', notes: ['A', 'C', 'E'] }).feedback).toContain('少了 C♯')
  })
  it('rhythm: grades with the calibration offset and flags stroke direction', () => {
    const q = generate('rhythm.strum.tap', 1, 1, 'rhythm.pattern.eighths') as RhythmQuestion
    const slot = 60000 / q.bpm / 2
    const perfect = [...q.pattern].map((s, i) => ({ t: i * slot + 80, stroke: s as 'D' | 'U' }))
    expect(validate(q, { kind: 'rhythm', taps: perfect, offsetMs: 80 }).result).toBe('correct')
    expect(validate(q, { kind: 'rhythm', taps: perfect, offsetMs: 0 }).feedback).toContain('偏晚')
    const allDown = perfect.map(t => ({ ...t, stroke: 'D' as const }))
    expect(validate(q, { kind: 'rhythm', taps: allDown, offsetMs: 80 })).toMatchObject({ result: 'incorrect', errorClass: 'stroke-direction' })
  })
  it('choice: accepts listed alternative readings', () => {
    const q = generate('harmony.basic.function', 4, 2, 'harmony.function.6')
    expect(q.kind).toBe('choice')
    if (q.kind === 'choice') {
      expect(validate(q, { kind: 'choice', value: q.answer }).result).toBe('correct')
      for (const alt of q.alsoAccepted ?? []) expect(validate(q, { kind: 'choice', value: alt }).result).toBe('correct')
      expect(q.alsoAccepted?.length).toBeGreaterThan(0)
    }
  })
})
