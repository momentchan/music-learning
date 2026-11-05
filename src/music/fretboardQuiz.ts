import { SHARPS, STANDARD_TUNING } from './theory'

export interface FretboardAnswer { topicId: string; correct: boolean }
export interface FretPosition { string: number; fret: number; midi: number }

export function positionsForNote(note: string): FretPosition[] {
  const pitchClass = SHARPS.indexOf(note as typeof SHARPS[number])
  if (pitchClass < 0) return []
  return STANDARD_TUNING.flatMap((openMidi, index) =>
    Array.from({ length: 12 }, (_, offset) => ({ string: 6 - index, fret: offset + 1, midi: openMidi + offset + 1 }))
      .filter(position => position.midi % 12 === pitchClass))
}

export function reviewWeight(note: string, answers: FretboardAnswer[]): number {
  const recent = answers.filter(answer => answer.topicId === `fretboard.note.${note}`).slice(-10)
  const missed = recent.filter(answer => !answer.correct).length
  const correct = recent.length - missed
  return Math.max(0.75, 1 + missed * 2 - correct * 0.12)
}

export function chooseReviewNote(answers: FretboardAnswer[], seed: number, previous?: string): string {
  const weights = SHARPS.map(note => reviewWeight(note, answers) * (note === previous ? 0.15 : 1))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let choice = (seed >>> 0) / 0x100000000 * total
  for (let index = 0; index < SHARPS.length; index++) {
    choice -= weights[index]
    if (choice < 0) return SHARPS[index]
  }
  return SHARPS[SHARPS.length - 1]
}
