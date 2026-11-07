import { describe, expect, it } from 'vitest'
import { noteConfirmation } from './answerNote'
import { generate } from './registry'
import type { FretLocateQuestion } from './types'
import { validate } from './validate'

describe('fretboard note confirmation', () => {
  const question = generate('fret.naturals.all.locate', 1, 1, 'fret.note.E.s6') as FretLocateQuestion

  it('plays the fret that was found', () => {
    const response = { kind: 'fret-locate' as const, string: 6, fret: 12 }
    const grade = validate(question, response)
    expect(noteConfirmation(question, response, grade)).toEqual([{ notes: [52], duration: 0.9 }])
  })

  it('plays the nearest correct fret after a miss', () => {
    const response = { kind: 'fret-locate' as const, string: 6, fret: 1 }
    const grade = validate(question, response)
    expect(grade.result).toBe('incorrect')
    expect(noteConfirmation(question, response, grade)).toEqual([{ notes: [40], duration: 0.9 }])
  })

  it('also plays notes from the low-string course', () => {
    const other = generate('fret.naturals.low.locate', 1, 1, 'fret.note.E.s6') as FretLocateQuestion
    const response = { kind: 'fret-locate' as const, string: 6, fret: 0 }
    expect(noteConfirmation(other, response, validate(other, response))).toEqual([{ notes: [40], duration: 0.9 }])
  })
})


it.each([['C#', 'Db', 1], ['D#', 'Eb', 3], ['F#', 'Gb', 6], ['G#', 'Ab', 8], ['A#', 'Bb', 10]] as const)('plays %s / %s for locating, naming and correction on every string', (sharp, flat, pc) => {
  for (const string of [1, 2, 3, 4, 5, 6]) {
    const locate = generate('fret.accidentals.locate', string, 1, `fret.note.${sharp}.s${string}`) as FretLocateQuestion
    const open = locate.tuning[6 - string]
    const fret = (pc - open % 12 + 12) % 12
    const right = { kind: 'fret-locate' as const, string, fret }
    const wrong = { ...right, fret: (fret + 1) % 12 }
    const sound = [{ notes: [open + fret], duration: .9 }]
    expect(noteConfirmation(locate, right, validate(locate, right))).toEqual(sound)
    expect(noteConfirmation(locate, wrong, validate(locate, wrong))).toEqual(sound)
    const identify = generate('fret.accidentals.identify', string, 1, `fret.note.${sharp}.s${string}`)
    for (const value of [sharp, flat]) {
      const response = { kind: 'fret-identify' as const, value }
      expect(validate(identify, response).result).toBe('correct')
      expect(noteConfirmation(identify, response, validate(identify, response))).toEqual(sound)
    }
    const microphone = { kind: 'played-note' as const, midi: open + fret }
    expect(noteConfirmation(locate, microphone, validate(locate, microphone))).toBeNull()
  }
})
