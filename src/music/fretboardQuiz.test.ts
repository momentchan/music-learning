import { describe, expect, it } from 'vitest'
import { chooseReviewPosition, fretRegion, positionsForNote, reviewState, reviewSummary } from './fretboardQuiz'

const NOW = Date.UTC(2026, 10, 6)
const DAY = 24 * 60 * 60 * 1000

describe('fretboard note practice', () => {
  it('finds one playable C on each string across frets 1 through 12', () => {
    expect(positionsForNote('C').map(({ string, fret }) => [string, fret])).toEqual([
      [6, 8], [5, 3], [4, 10], [3, 5], [2, 1], [1, 8],
    ])
  })

  it('reviews a missed string before new and recently correct positions', () => {
    const answers = [
      { topicId: 'fretboard.note.C', targetString: 6, correct: false, timestamp: NOW - 1000 },
      { topicId: 'fretboard.note.C', targetString: 5, correct: true, timestamp: NOW - 1000 },
    ]
    expect(reviewState('C', 6, answers, NOW).reason).toBe('missed')
    expect(reviewState('C', 6, answers, NOW).weight).toBeGreaterThan(reviewState('C', 4, answers, NOW).weight)
    expect(reviewState('C', 4, answers, NOW).weight).toBeGreaterThan(reviewState('C', 5, answers, NOW).weight)
    expect(reviewSummary(answers, NOW)).toEqual({ seen: 2, due: 0, missed: 1 })
  })

  it('uses increasing review intervals without response-speed penalties', () => {
    const answers = [
      { topicId: 'fretboard.note.F#', targetString: 3, correct: true, timestamp: NOW - 4 * DAY },
      { topicId: 'fretboard.note.F#', targetString: 3, correct: true, timestamp: NOW - 2 * DAY },
    ]
    expect(reviewState('F#', 3, answers, NOW).dueAt).toBe(NOW + DAY)
    expect(reviewState('F#', 3, answers, NOW + DAY).reason).toBe('due')
    const picked = chooseReviewPosition(answers, 123456, NOW)
    expect(picked).toEqual(chooseReviewPosition(answers, 123456, NOW))
    expect(positionsForNote(picked.note)).toContainEqual({ string: picked.string, fret: picked.fret, midi: picked.midi })
  })

  it('rechecks an answer found after a miss before giving it a day-long interval', () => {
    const answers = [{ topicId: 'fretboard.note.C', targetString: 6, correct: true, assisted: true, timestamp: NOW }]
    expect(reviewState('C', 6, answers, NOW).reason).toBe('practice')
    expect(reviewState('C', 6, answers, NOW + 60_000).reason).toBe('due')
    expect(reviewState('C', 6, [...answers, { topicId: 'fretboard.note.C', targetString: 6, correct: true, assisted: false, timestamp: NOW + 60_000 }], NOW + 60_000).dueAt).toBe(NOW + 60_000 + DAY)
  })

  it('gives broad fret hints rather than revealing the answer', () => {
    expect([1, 4, 5, 8, 9, 12].map(fretRegion)).toEqual(['frets 1–4', 'frets 1–4', 'frets 5–8', 'frets 5–8', 'frets 9–12', 'frets 9–12'])
  })
})
