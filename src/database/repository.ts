/**
 * LearningRepository (spec §10.1): the only storage boundary used by screens and stores.
 * Generators and validators never import this module.
 */
import { DEFAULT_PREFERENCES, type BridgeQueueItem, type ExerciseAttempt, type ItemOutcome, type PlannedItem, type PracticeSession, type Preferences, type SelfReport, type SkipEvent } from '../learning/records'
import { applyReview, type ReviewState } from '../learning/scheduler'
import { BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, type BackupData, type BackupEnvelope } from './backup'
import { GuitarLabDB, reviewsFromAttempts } from './schema'

export interface SessionPatch { id: string; cursor?: number; plannedItems?: PlannedItem[]; outcome?: ItemOutcome }

export interface LearningRepository {
  recordAttempt(attempt: ExerciseAttempt, session?: SessionPatch): Promise<{ attempt: ExerciseAttempt; reviews: ReviewState[] }>
  recordEvent(event: SkipEvent, session?: SessionPatch): Promise<void>
  getAttempts(): Promise<ExerciseAttempt[]>
  getReviews(): Promise<Map<string, ReviewState>>
  saveSession(session: PracticeSession): Promise<void>
  getSession(id: string): Promise<PracticeSession | undefined>
  getActiveSession(): Promise<PracticeSession | undefined>
  listSessions(limit?: number): Promise<PracticeSession[]>
  queueBridge(item: BridgeQueueItem): Promise<void>
  listBridgeQueue(): Promise<BridgeQueueItem[]>
  completeBridge(id: string, report: SelfReport): Promise<void>
  getSelfReports(): Promise<SelfReport[]>
  getPreferences(): Promise<Preferences>
  savePreferences(preferences: Preferences): Promise<void>
  getSetting<T>(id: string): Promise<T | undefined>
  saveSetting(id: string, value: unknown): Promise<void>
  exportAll(): Promise<BackupEnvelope>
  importBackup(envelope: BackupEnvelope, mode: 'replace' | 'merge'): Promise<{ preImportBackupId?: string; attempts: number }>
  latestPreImportBackup(): Promise<BackupEnvelope | undefined>
}

const ABANDON_AFTER_MS = 12 * 60 * 60 * 1000

export class DexieLearningRepository implements LearningRepository {
  constructor(readonly db: GuitarLabDB) {}

  private async patchSession(patch: SessionPatch | undefined, now: number) {
    if (!patch) return
    const session = await this.db.sessions.get(patch.id)
    if (!session) throw new Error(`Session ${patch.id} not found`)
    const outcomes = patch.outcome ? [...session.outcomes.filter(o => o.index !== patch.outcome!.index), patch.outcome] : session.outcomes
    await this.db.sessions.put({ ...session, cursor: patch.cursor ?? session.cursor, plannedItems: patch.plannedItems ?? session.plannedItems, outcomes, updatedAt: now })
  }

  /** Attempt + review schedule + session cursor in one transaction: all or nothing. */
  async recordAttempt(attempt: ExerciseAttempt, session?: SessionPatch) {
    const { db } = this
    return db.transaction('rw', [db.attempts, db.reviews, db.sessions], async () => {
      if (attempt.inputMethod === 'microphone') {
        attempt = { ...attempt, itemResults: {}, reviewItemIds: [], string: undefined, fret: undefined }
      }
      const existing = await db.attempts.get(attempt.id)
      if (existing) return { attempt: existing, reviews: [] }
      await db.attempts.add(attempt)
      const ids = Object.keys(attempt.itemResults)
      const previous = await db.reviews.bulkGet(ids)
      const reviews = ids.map((itemId, i) => applyReview(previous[i], { itemId, correct: attempt.itemResults[itemId], assisted: attempt.assisted, timestamp: attempt.timestamp }))
      await db.reviews.bulkPut(reviews)
      await this.patchSession(session, attempt.timestamp)
      return { attempt, reviews }
    })
  }

  async recordEvent(event: SkipEvent, session?: SessionPatch) {
    const { db } = this
    await db.transaction('rw', [db.events, db.sessions], async () => {
      await db.events.add(event)
      await this.patchSession(session, event.timestamp)
    })
  }

  getAttempts() { return this.db.attempts.orderBy('timestamp').toArray() }
  async getReviews() { return new Map((await this.db.reviews.toArray()).map(r => [r.itemId, r])) }
  async saveSession(session: PracticeSession) { await this.db.sessions.put(session) }
  getSession(id: string) { return this.db.sessions.get(id) }

  async getActiveSession(now = Date.now()) {
    const active = await this.db.sessions.where('status').equals('active').toArray()
    let latest: PracticeSession | undefined
    for (const session of active) {
      if (now - session.updatedAt > ABANDON_AFTER_MS) await this.db.sessions.put({ ...session, status: 'abandoned', endedAt: session.updatedAt })
      else if (!latest || session.updatedAt > latest.updatedAt) latest = session
    }
    return latest
  }

  async listSessions(limit = 30) { return (await this.db.sessions.orderBy('startedAt').reverse().limit(limit).toArray()) }
  async queueBridge(item: BridgeQueueItem) {
    await this.db.transaction('rw', this.db.bridgeQueue, async () => {
      const existing = await this.db.bridgeQueue.where('nodeId').equals(item.nodeId).filter(b => !b.completedAt && b.taskId === item.taskId).count()
      if (!existing) await this.db.bridgeQueue.put(item)
    })
  }
  async listBridgeQueue() { return (await this.db.bridgeQueue.toArray()).filter(b => !b.completedAt).sort((a, b) => a.createdAt - b.createdAt) }
  async completeBridge(id: string, report: SelfReport) {
    const { db } = this
    await db.transaction('rw', [db.bridgeQueue, db.selfReports], async () => {
      await db.selfReports.add(report)
      const tasks = await db.bridgeQueue.where('nodeId').equals(report.nodeId).filter(b => b.taskId === report.bridgeTaskId && b.createdAt <= report.timestamp).toArray()
      for (const item of tasks) await db.bridgeQueue.put({ ...item, completedAt: Math.max(item.completedAt ?? 0, report.timestamp) })
    })
  }
  getSelfReports() { return this.db.selfReports.toArray() }
  async getPreferences() {
    const saved = (await this.db.settings.get('preferences'))?.value as Partial<Preferences> | undefined
    const suggested = typeof window !== 'undefined' && window.matchMedia('(min-width: 1000px)').matches ? 'instrument' : 'pocket'
    return { ...DEFAULT_PREFERENCES, practiceContext: suggested, ...saved } as Preferences
  }
  async savePreferences(preferences: Preferences) { await this.db.settings.put({ id: 'preferences', value: preferences }) }
  async getSetting<T>(id: string) { return (await this.db.settings.get(id))?.value as T | undefined }
  async saveSetting(id: string, value: unknown) { await this.db.settings.put({ id, value }) }

  async exportAll(now = Date.now()): Promise<BackupEnvelope> {
    const { db } = this
    const data: BackupData = await db.transaction('r', [db.attempts, db.sessions, db.reviews, db.events, db.selfReports, db.bridgeQueue, db.progressions, db.pathways, db.settings], async () => ({
      attempts: await db.attempts.toArray(), sessions: await db.sessions.toArray(), reviews: await db.reviews.toArray(), events: await db.events.toArray(),
      selfReports: await db.selfReports.toArray(), bridgeQueue: await db.bridgeQueue.toArray(), progressions: await db.progressions.toArray(),
      pathways: await db.pathways.toArray(), settings: await db.settings.toArray(),
    }))
    return { format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now, data }
  }

  /** Validated envelopes only. Replace keeps a pre-import backup; both modes rebuild schedules from attempts. */
  async importBackup(envelope: BackupEnvelope, mode: 'replace' | 'merge', now = Date.now()) {
    const { db } = this
    const preImport = await this.exportAll(now)
    const tables = [db.attempts, db.sessions, db.reviews, db.events, db.selfReports, db.bridgeQueue, db.progressions, db.pathways, db.settings, db.backups]
    const preImportBackupId = preImport ? `pre-import-${now}` : undefined
    await db.transaction('rw', tables, async () => {
      const d = envelope.data
      const localPreferences = await this.getPreferences()
      const safeSettings = d.settings.map(setting => setting.id === 'preferences' ? {
        ...setting, value: { ...DEFAULT_PREFERENCES, ...(setting.value as Partial<Preferences>), latencyOffsetMs: localPreferences.latencyOffsetMs, answerInput: 'tap' },
      } : setting)
      await db.backups.put({ id: preImportBackupId!, createdAt: now, reason: 'pre-import', envelope: preImport })
      if (mode === 'replace') {
        for (const table of [db.attempts, db.sessions, db.reviews, db.events, db.selfReports, db.bridgeQueue, db.progressions, db.pathways]) await table.clear()
        await db.attempts.bulkAdd(d.attempts)
        await db.sessions.bulkAdd(d.sessions)
        await db.events.bulkAdd(d.events)
        await db.selfReports.bulkAdd(d.selfReports)
        await db.bridgeQueue.bulkAdd(d.bridgeQueue)
        await db.progressions.bulkAdd(d.progressions)
        await db.pathways.bulkAdd(d.pathways)
        await db.settings.bulkPut(safeSettings)
      } else {
        // Merge: keep existing records when IDs collide; never overwrite local history.
        const addMissing = async <T,>(table: { bulkGet(keys: string[]): Promise<(T | undefined)[]>; bulkAdd(items: T[]): Promise<unknown> }, items: T[], key: (item: T) => string | undefined) => {
          const existing = await table.bulkGet(items.map(item => key(item) ?? ''))
          const fresh = items.filter((_, i) => !existing[i])
          if (fresh.length) await table.bulkAdd(fresh)
        }
        await addMissing(db.attempts, d.attempts, a => a.id)
        for (const incoming of d.sessions) {
          const local = await db.sessions.get(incoming.id)
          const chosen = !local ? incoming : local.status === 'completed' ? local : incoming.status === 'completed' || incoming.updatedAt > local.updatedAt ? incoming : local
          await db.sessions.put(chosen)
        }
        await addMissing(db.events, d.events, e => e.id)
        await addMissing(db.selfReports, d.selfReports, r => r.id)
        for (const incoming of d.bridgeQueue) {
          const local = await db.bridgeQueue.get(incoming.id)
          await db.bridgeQueue.put(local ? { ...local, completedAt: Math.max(local.completedAt ?? 0, incoming.completedAt ?? 0) || undefined } : incoming)
        }
        const incomingPreferences = safeSettings.find(s => s.id === 'preferences')
        if (incomingPreferences) await db.settings.put(incomingPreferences)
        await addMissing(db.progressions, d.progressions, p => p.id)
        await addMissing(db.pathways, d.pathways, p => p.pathwayId)
      }
      // A completion imported under a different queue ID still closes the older logical task.
      const reports = await db.selfReports.toArray()
      const pending = await db.bridgeQueue.toArray()
      for (const task of pending) {
        const report = reports.filter(r => r.nodeId === task.nodeId && r.bridgeTaskId === task.taskId && r.timestamp >= task.createdAt).sort((a, b) => b.timestamp - a.timestamp)[0]
        if (report) await db.bridgeQueue.put({ ...task, completedAt: Math.max(task.completedAt ?? 0, report.timestamp) })
      }
      await db.reviews.clear()
      await db.reviews.bulkPut([...reviewsFromAttempts(await db.attempts.toArray()).values()])
    })
    return { preImportBackupId, attempts: await db.attempts.count() }
  }

  async latestPreImportBackup() {
    const latest = await this.db.backups.orderBy('createdAt').last()
    return latest?.envelope as BackupEnvelope | undefined
  }
}

export const db = new GuitarLabDB()
export const repository: LearningRepository = new DexieLearningRepository(db)
