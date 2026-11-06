/** Versioned JSON backup envelope and strict validation (spec §10.3). Pure: no Dexie, no DOM. */
import type { BridgeQueueItem, ExerciseAttempt, PathwayProgress, PracticeSession, SavedProgression, SelfReport, SkipEvent } from '../learning/records'
import type { ReviewState } from '../learning/scheduler'
import type { SettingRecord } from './schema'

export const BACKUP_FORMAT = 'guitar-lab-backup'
export const BACKUP_SCHEMA_VERSION = 4
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
const MAX_RECORDS = 250_000
const MAX_PAYLOAD_CHARS = 50_000
const MIN_TIME = Date.UTC(2020, 0, 1)

export interface BackupData {
  attempts: ExerciseAttempt[]
  sessions: PracticeSession[]
  reviews: ReviewState[]
  events: SkipEvent[]
  selfReports: SelfReport[]
  bridgeQueue: BridgeQueueItem[]
  progressions: SavedProgression[]
  pathways: PathwayProgress[]
  settings: SettingRecord[]
}

export interface BackupEnvelope { format: typeof BACKUP_FORMAT; schemaVersion: number; exportedAt: number; data: BackupData }

export type ValidationResult =
  | { ok: true; envelope: BackupEnvelope; counts: Record<keyof BackupData, number> }
  | { ok: false; errors: string[] }

const TABLES: (keyof BackupData)[] = ['attempts', 'sessions', 'reviews', 'events', 'selfReports', 'bridgeQueue', 'progressions', 'pathways', 'settings']
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 200
const isTime = (v: unknown, now: number) => typeof v === 'number' && Number.isFinite(v) && v >= MIN_TIME && v <= now + 2 * 86_400_000
const RESULTS = new Set(['correct', 'incorrect', 'partial'])
const LEVELS = new Set(['recognize', 'recall', 'locate', 'apply'])

/** Parse text with a size limit; never evaluates content. */
export function parseBackupText(text: string): ValidationResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, errors: [`檔案太大（上限 ${MAX_BACKUP_BYTES / 1024 / 1024} MB）。`] }
  let json: unknown
  try { json = JSON.parse(text) } catch { return { ok: false, errors: ['這不是有效的 JSON 檔案。'] } }
  return validateBackup(json)
}

export function validateBackup(json: unknown, now = Date.now()): ValidationResult {
  const errors: string[] = []
  const fail = (message: string) => { if (errors.length < 20) errors.push(message) }
  if (!isObj(json)) return { ok: false, errors: ['備份檔格式錯誤：最外層必須是物件。'] }
  if (json.format !== BACKUP_FORMAT) return { ok: false, errors: ['這不是 Guitar Lab 的備份檔（format 不符）。'] }
  if (json.schemaVersion !== BACKUP_SCHEMA_VERSION) return { ok: false, errors: [`不支援的備份版本 ${String(json.schemaVersion)}（目前支援版本 ${BACKUP_SCHEMA_VERSION}）。`] }
  if (!isTime(json.exportedAt, now)) fail('exportedAt 時間不正確。')
  if (!isObj(json.data)) return { ok: false, errors: ['缺少 data 區塊。'] }
  const data = json.data
  let total = 0
  for (const table of TABLES) {
    if (!Array.isArray(data[table])) { fail(`缺少 ${table} 資料表。`); continue }
    total += (data[table] as unknown[]).length
  }
  if (total > MAX_RECORDS) fail(`紀錄數量過多（${total}，上限 ${MAX_RECORDS}）。`)
  if (errors.length) return { ok: false, errors }

  const sessions = data.sessions as Record<string, unknown>[]
  const attempts = data.attempts as Record<string, unknown>[]
  const sessionIds = new Set<string>()
  const attemptIds = new Set<string>()
  const checkUnique = (table: string, ids: Set<string>, id: unknown, index: number) => {
    if (!isId(id)) fail(`${table}[${index}] 的 ID 不正確。`)
    else if (ids.has(id as string)) fail(`${table}[${index}] 的 ID 重複：${String(id).slice(0, 40)}`)
    else ids.add(id as string)
  }
  sessions.forEach((s, i) => {
    if (!isObj(s)) return fail(`sessions[${i}] 不是物件。`)
    checkUnique('sessions', sessionIds, s.id, i)
    if (!isTime(s.startedAt, now)) fail(`sessions[${i}] 開始時間不正確。`)
    if (!['active', 'completed', 'paused', 'abandoned'].includes(s.status as string)) fail(`sessions[${i}] 狀態不正確。`)
    if (!Array.isArray(s.plannedItems) || JSON.stringify(s.plannedItems).length > MAX_PAYLOAD_CHARS * 20) fail(`sessions[${i}] 題目清單不正確。`)
  })
  attempts.forEach((a, i) => {
    if (!isObj(a)) return fail(`attempts[${i}] 不是物件。`)
    checkUnique('attempts', attemptIds, a.id, i)
    if (!isId(a.sessionId) || !sessionIds.has(a.sessionId as string)) fail(`attempts[${i}] 參照了不存在的練習時段。`)
    if (!isId(a.nodeId)) fail(`attempts[${i}] 缺少 nodeId。`)
    if (!isTime(a.timestamp, now)) fail(`attempts[${i}] 時間不正確。`)
    if (typeof a.correct !== 'boolean' || !RESULTS.has(a.result as string)) fail(`attempts[${i}] 結果欄位不正確。`)
    if (!LEVELS.has(a.evidenceLevel as string)) fail(`attempts[${i}] evidenceLevel 不正確。`)
    if (!Array.isArray(a.reviewItemIds) || !(a.reviewItemIds as unknown[]).every(isId)) fail(`attempts[${i}] reviewItemIds 不正確。`)
    if (!isObj(a.itemResults) || !Object.values(a.itemResults).every(v => typeof v === 'boolean')) fail(`attempts[${i}] itemResults 不正確。`)
    if (JSON.stringify(a.question ?? null).length > MAX_PAYLOAD_CHARS || JSON.stringify(a.response ?? null).length > MAX_PAYLOAD_CHARS) fail(`attempts[${i}] 題目或作答內容過大。`)
  })
  attempts.forEach((a, i) => { if (isObj(a) && a.retryOf !== undefined && !attemptIds.has(a.retryOf as string)) fail(`attempts[${i}] 的 retryOf 參照不存在。`) })
  const simple: [keyof BackupData, string, string][] = [['reviews', 'itemId', 'lastReviewedAt'], ['events', 'id', 'timestamp'], ['selfReports', 'id', 'timestamp'], ['bridgeQueue', 'id', 'createdAt'], ['progressions', 'id', 'updatedAt'], ['pathways', 'pathwayId', 'updatedAt']]
  for (const [table, key, timeKey] of simple) {
    const ids = new Set<string>()
    ;(data[table] as unknown[]).forEach((r, i) => {
      if (!isObj(r)) return fail(`${table}[${i}] 不是物件。`)
      checkUnique(table, ids, r[key], i)
      if (r[timeKey] !== 0 && !isTime(r[timeKey], now)) fail(`${table}[${i}] 時間不正確。`)
      if (JSON.stringify(r).length > MAX_PAYLOAD_CHARS) fail(`${table}[${i}] 內容過大。`)
    })
  }
  ;(data.settings as unknown[]).forEach((r, i) => {
    if (!isObj(r) || !isId(r.id) || JSON.stringify(r).length > MAX_PAYLOAD_CHARS) fail(`settings[${i}] 不正確。`)
  })
  if (errors.length) return { ok: false, errors }
  const envelope = json as unknown as BackupEnvelope
  const counts = Object.fromEntries(TABLES.map(t => [t, envelope.data[t].length])) as Record<keyof BackupData, number>
  return { ok: true, envelope, counts }
}
