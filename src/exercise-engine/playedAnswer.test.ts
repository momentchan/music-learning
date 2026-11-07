import { describe, expect, it } from 'vitest'
import { generate } from './registry'
import { playedQuestion, responseFromPlayedNote } from './playedAnswer'
import type { FretLocateQuestion } from './types'
import { validate } from './validate'

describe('microphone evidence', () => {
  const q = generate('fret.naturals.all.locate', 1, 1, 'fret.note.C.s5') as FretLocateQuestion
  it('stores heard pitch without inventing a string or fret or granting recall reviews', () => {
    const response = responseFromPlayedNote(q, 48)
    expect(response).toEqual({ kind: 'played-note', midi: 48 })
    expect(validate(q, response)).toMatchObject({ result: 'correct', verificationScope: 'pitchClass', itemResults: {} })
    expect(validate(q, response).correctPositions).toBeUndefined()
  })
  it('explicit position variants check the octave, while unrestricted note names accept any octave', () => {
    const exact = playedQuestion(q)
    expect(exact).toMatchObject({ targetMidi: 48, prompt: expect.stringContaining('C3') })
    expect(validate(exact, { kind: 'played-note', midi: 48 }).result).toBe('correct')
    expect(validate(exact, { kind: 'played-note', midi: 60 })).toMatchObject({ result: 'incorrect', errorClass: 'wrong-octave' })
    expect(validate(q, { kind: 'played-note', midi: 60 }).result).toBe('correct')
    expect(validate(exact, { kind: 'played-note', midi: 47 }).result).toBe('incorrect')
  })
  it('cannot answer note-naming questions or map impossible pitches to a convenient position', () => {
    const identify = generate('fret.naturals.all.identify', 4, 1)
    expect(() => validate(identify, { kind: 'played-note', midi: 48 })).toThrow('音名')
    expect(() => validate(q, { kind: 'played-note', midi: 100 })).toThrow('音域')
  })
})
