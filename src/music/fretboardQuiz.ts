import { SHARPS, STANDARD_TUNING } from './theory'

export interface FretboardAnswer {
  topicId: string
  correct: boolean
  timestamp: number
  targetString?: number
  string?: number
  assisted?: boolean
}
export interface FretPosition { string: number; fret: number; midi: number }
export interface ReviewPosition extends FretPosition { note: string; reason: 'new' | 'missed' | 'due' | 'practice' }

const DAY = 24 * 60 * 60 * 1000
const REVIEW_DAYS = [1, 3, 7, 14, 30]

export function positionsForNote(note: string): FretPosition[] {
  const pitchClass = SHARPS.indexOf(note as typeof SHARPS[number])
  if (pitchClass < 0) return []
  return STANDARD_TUNING.flatMap((openMidi, index) =>
    Array.from({ length: 12 }, (_, offset) => ({ string: 6 - index, fret: offset + 1, midi: openMidi + offset + 1 }))
      .filter(position => position.midi % 12 === pitchClass))
}

export function reviewState(note: string, string: number, answers: FretboardAnswer[], now: number): { weight: number; dueAt: number | null; reason: ReviewPosition['reason'] } {
  const history = answers.filter(answer => answer.topicId === `fretboard.note.${note}` && (answer.targetString ?? answer.string) === string)
    .sort((a, b) => a.timestamp - b.timestamp)
  if (!history.length) return { weight: 1.5, dueAt: null, reason: 'new' }
  const latest = history[history.length - 1]
  if (!latest.correct) {
    const recentMisses = history.slice(-5).filter(answer => !answer.correct).length
    return { weight: 5 + Math.min(recentMisses, 3), dueAt: now, reason: 'missed' }
  }
  if (latest.assisted) {
    const dueAt = latest.timestamp + 60_000
    return dueAt <= now ? { weight: 4, dueAt, reason: 'due' } : { weight: 0.15, dueAt, reason: 'practice' }
  }
  let streak = 0
  for (let index = history.length - 1; index >= 0 && history[index].correct && !history[index].assisted; index--) streak++
  const dueAt = latest.timestamp + REVIEW_DAYS[Math.min(streak - 1, REVIEW_DAYS.length - 1)] * DAY
  if (dueAt <= now) return { weight: Math.min(4, 2 + (now - dueAt) / DAY * 0.15), dueAt, reason: 'due' }
  return { weight: 0.15, dueAt, reason: 'practice' }
}

export function reviewSummary(answers: FretboardAnswer[], now: number): { seen: number; due: number; missed: number } {
  const states = SHARPS.flatMap(note => positionsForNote(note).map(position => reviewState(note, position.string, answers, now)))
  return { seen: states.filter(state => state.reason !== 'new').length, due: states.filter(state => state.reason === 'due').length, missed: states.filter(state => state.reason === 'missed').length }
}

export function chooseReviewPosition(answers: FretboardAnswer[], seed: number, now: number, previous?: Pick<ReviewPosition, 'note' | 'string'>): ReviewPosition {
  const candidates = SHARPS.flatMap(note => positionsForNote(note).map(position => {
    const state = reviewState(note, position.string, answers, now)
    return { ...position, note, reason: state.reason, weight: state.weight * (previous?.note === note && previous.string === position.string ? 0.02 : 1) }
  }))
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0)
  let choice = (seed >>> 0) / 0x100000000 * total
  for (const candidate of candidates) {
    choice -= candidate.weight
    if (choice < 0) return { string: candidate.string, fret: candidate.fret, midi: candidate.midi, note: candidate.note, reason: candidate.reason }
  }
  const last = candidates[candidates.length - 1]
  return { string: last.string, fret: last.fret, midi: last.midi, note: last.note, reason: last.reason }
}

export function fretRegion(fret: number): string {
  if (fret <= 4) return 'frets 1–4'
  if (fret <= 8) return 'frets 5–8'
  return 'frets 9–12'
}
