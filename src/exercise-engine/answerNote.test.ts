import { describe, expect, it } from 'vitest'
import { naturalNoteConfirmation } from './answerNote'
import { generate } from './registry'
import type { FretLocateQuestion } from './types'
import { validate } from './validate'

describe('natural note confirmation', () => {
  const question = generate('fret.naturals.all.locate', 1, 1, 'fret.note.E.s6') as FretLocateQuestion

  it('plays the fret that was found', () => {
    const response = { kind: 'fret-locate' as const, string: 6, fret: 12 }
    const grade = validate(question, response)
    expect(naturalNoteConfirmation(question, response, grade)).toEqual([{ notes: [52], duration: 0.9 }])
  })

  it('plays the nearest correct fret after a miss', () => {
    const response = { kind: 'fret-locate' as const, string: 6, fret: 1 }
    const grade = validate(question, response)
    expect(grade.result).toBe('incorrect')
    expect(naturalNoteConfirmation(question, response, grade)).toEqual([{ notes: [40], duration: 0.9 }])
  })

  it('stays silent for other topics', () => {
    const other = generate('fret.naturals.low.locate', 1, 1, 'fret.note.E.s6') as FretLocateQuestion
    const response = { kind: 'fret-locate' as const, string: 6, fret: 0 }
    expect(naturalNoteConfirmation(other, response, validate(other, response))).toBeNull()
  })
})
