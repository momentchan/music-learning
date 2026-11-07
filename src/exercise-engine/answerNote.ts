import type { Grade, Question, Response, SoundEvent } from './types'

const midiOn = (tuning: readonly number[], string: number, fret: number) => tuning[6 - string] + fret

/**
 * Note to play after an answer on "natural notes, all strings".
 * A correct tap plays that fret. A miss plays the nearest correct fret on the asked string.
 */
export function naturalNoteConfirmation(question: Question, response: Response, grade: Grade): SoundEvent[] | null {
  if (question.nodeId !== 'fret.naturals.all') return null
  if (question.kind === 'fret-locate' && response.kind === 'fret-locate') {
    const spot = grade.result === 'correct'
      ? { string: response.string, fret: response.fret }
      : nearest(grade.correctPositions ?? [], response.fret)
    return spot ? [{ notes: [midiOn(question.tuning, spot.string, spot.fret)], duration: 0.9 }] : null
  }
  if (question.kind === 'fret-identify') return [{ notes: [midiOn(question.tuning, question.string, question.fret)], duration: 0.9 }]
  return null
}

function nearest(spots: { string: number; fret: number }[], fret: number) {
  return spots.reduce<{ string: number; fret: number } | null>((best, spot) => {
    if (!best) return spot
    const distance = Math.abs(spot.fret - fret)
    const bestDistance = Math.abs(best.fret - fret)
    return distance < bestDistance || (distance === bestDistance && spot.fret < best.fret) ? spot : best
  }, null)
}
