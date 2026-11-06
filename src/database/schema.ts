import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { BridgeQueueItem, ExerciseAttempt, PathwayProgress, PracticeSession, SavedProgression, SelfReport, SkipEvent } from '../learning/records'
import { replayHistory, type ReviewState } from '../learning/scheduler'
import { isV4Attempt, legacySessionId, mapLegacyAttempt, type LegacyAttempt } from './legacy'

export const DB_NAME = 'guitar-lab'
export const DB_VERSION = 4

export interface SettingRecord { id: string; value: unknown }
export interface BackupRecord { id: string; createdAt: number; reason: string; envelope: unknown }

const V3_STORES = { attempts: 'id, sessionId, exerciseType, topicId, timestamp, string, fret, note, targetString, targetFret', settings: 'id' }

export class GuitarLabDB extends Dexie {
  attempts!: EntityTable<ExerciseAttempt, 'id'>
  settings!: EntityTable<SettingRecord, 'id'>
  sessions!: EntityTable<PracticeSession, 'id'>
  reviews!: EntityTable<ReviewState, 'itemId'>
  events!: EntityTable<SkipEvent, 'id'>
  selfReports!: EntityTable<SelfReport, 'id'>
  bridgeQueue!: EntityTable<BridgeQueueItem, 'id'>
  progressions!: EntityTable<SavedProgression, 'id'>
  pathways!: EntityTable<PathwayProgress, 'pathwayId'>
  backups!: EntityTable<BackupRecord, 'id'>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores({ attempts: 'id, sessionId, exerciseType, topicId, timestamp', settings: 'id' })
    this.version(2).stores({ attempts: 'id, sessionId, exerciseType, topicId, timestamp, string, fret, note', settings: 'id' })
    this.version(3).stores(V3_STORES)
    this.version(4).stores({
      attempts: 'id, sessionId, exerciseType, topicId, nodeId, timestamp, string, fret, note, targetString, targetFret, *reviewItemIds',
      settings: 'id',
      sessions: 'id, status, mode, startedAt, updatedAt',
      reviews: 'itemId, dueAt, box',
      events: 'id, nodeId, kind, timestamp',
      selfReports: 'id, nodeId, bridgeTaskId, timestamp',
      bridgeQueue: 'id, nodeId, createdAt, completedAt',
      progressions: 'id, updatedAt',
      pathways: 'pathwayId',
      backups: 'id, createdAt',
    }).upgrade(migrateToV4)
  }
}

/**
 * v3 → v4: keep every attempt, add node/review-item fields, group legacy attempts into per-day sessions,
 * and rebuild review schedules by replaying history. Never deletes attempts.
 */
export async function migrateToV4(tx: Transaction): Promise<void> {
  const attempts = tx.table('attempts')
  const legacyRows = (await attempts.toArray()) as (LegacyAttempt & Partial<ExerciseAttempt>)[]
  const mapped = legacyRows.map(row => isV4Attempt(row) ? row : mapLegacyAttempt(row))
  await attempts.bulkPut(mapped)

  const byDay = new Map<string, ExerciseAttempt[]>()
  for (const a of mapped) if (a.sessionId.startsWith('legacy-')) byDay.set(a.sessionId, [...(byDay.get(a.sessionId) ?? []), a])
  const sessions: PracticeSession[] = [...byDay.entries()].map(([id, rows]) => {
    const sorted = rows.sort((a, b) => a.timestamp - b.timestamp)
    return {
      id, mode: 'legacy', settings: {}, plannedItems: [], cursor: 0, outcomes: [], status: 'completed',
      startedAt: sorted[0].timestamp, updatedAt: sorted.at(-1)!.timestamp, endedAt: sorted.at(-1)!.timestamp,
      summary: { graded: rows.length, correct: rows.filter(r => r.correct).length, partial: 0, skipped: 0, nodes: [...new Set(rows.map(r => r.nodeId))], errorClasses: {}, promoted: 0, demoted: 0 },
    }
  })
  await tx.table('sessions').bulkPut(sessions)
  await tx.table('reviews').bulkPut([...reviewsFromAttempts(mapped).values()])
}

export function reviewsFromAttempts(attempts: ExerciseAttempt[]): Map<string, ReviewState> {
  return replayHistory(attempts.flatMap(a => Object.entries(a.itemResults ?? {}).map(([itemId, correct]) => ({ itemId, correct, assisted: a.assisted, timestamp: a.timestamp }))))
}

export { legacySessionId }
