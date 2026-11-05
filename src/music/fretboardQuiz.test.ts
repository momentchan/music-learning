import { describe, expect, it } from 'vitest'
import { chooseReviewNote, positionsForNote, reviewWeight } from './fretboardQuiz'

describe('fretboard note practice', () => {
  it('finds the six playable C positions on frets 1 through 12', () => {
    expect(positionsForNote('C').map(({ string, fret }) => [string, fret])).toEqual([
      [6, 8], [5, 3], [4, 10], [3, 5], [2, 1], [1, 8],
    ])
  })

  it('gives missed notes more review weight without using response time', () => {
    const answers = [
      { topicId: 'fretboard.note.F#', correct: false },
      { topicId: 'fretboard.note.F#', correct: false },
      { topicId: 'fretboard.note.C', correct: true },
    ]
    expect(reviewWeight('F#', answers)).toBeGreaterThan(reviewWeight('D', answers))
    expect(reviewWeight('D', answers)).toBeGreaterThan(reviewWeight('C', answers))
    expect(chooseReviewNote(answers, 123456)).toBe(chooseReviewNote(answers, 123456))
  })
})
