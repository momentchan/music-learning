/** Mapping of pre-v4 attempt rows (fretboard quiz and audio ear training) onto v4 records. Pure. */
import type { ExerciseAttempt } from '../learning/records'

export interface LegacyAttempt {
  id: string; sessionId: string; exerciseType: string; topicId: string; question: unknown; response: unknown; expected: string
  correct: boolean; responseMs: number; replays: number; difficulty: number; timestamp: number; masteryAfter?: number
  string?: number; fret?: number; note?: string; mode?: string; targetString?: number; targetFret?: number; assisted?: boolean
}

const EAR_INTERVAL_ITEMS = new Set(['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'M6', 'P8'])
export const legacySessionId = (timestamp: number) => `legacy-${new Date(timestamp).toISOString().slice(0, 10)}`

/** True when the row already has v4 fields. */
export const isV4Attempt = (row: Partial<ExerciseAttempt>): row is ExerciseAttempt => Array.isArray(row.reviewItemIds) && typeof row.nodeId === 'string'

export function mapLegacyAttempt(row: LegacyAttempt, options: { keepSession?: boolean } = {}): ExerciseAttempt {
  let nodeId = `legacy.${row.topicId}`
  let reviewItemIds: string[] = []
  let evidenceLevel: ExerciseAttempt['evidenceLevel'] = 'recognize'
  if (row.topicId.startsWith('fretboard.note.')) {
    const note = row.note ?? row.topicId.slice('fretboard.note.'.length)
    const string = row.targetString ?? row.string
    nodeId = note.includes('#') ? 'fret.accidentals' : string === 6 || string === 5 ? 'fret.naturals.low' : 'fret.naturals.all'
    if (string) reviewItemIds = [`fret.note.${note}.s${string}`]
    evidenceLevel = 'locate'
  } else if (row.topicId === 'ear.triad') {
    nodeId = 'ear.basic'
    reviewItemIds = ['ear.triad.major-minor']
  } else if (row.topicId === 'ear.interval') {
    nodeId = 'ear.basic'
    if (EAR_INTERVAL_ITEMS.has(row.expected)) reviewItemIds = [`ear.interval.${row.expected}`]
  }
  return {
    ...row,
    sessionId: options.keepSession ? row.sessionId : legacySessionId(row.timestamp),
    legacySessionId: options.keepSession ? undefined : row.sessionId,
    nodeId,
    reviewItemIds,
    itemResults: Object.fromEntries(reviewItemIds.map(id => [id, row.correct])),
    generatorVersion: 0,
    result: row.correct ? 'correct' : 'incorrect',
    evidenceLevel,
    assisted: !!row.assisted,
  }
}
