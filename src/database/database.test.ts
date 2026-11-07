import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseAttempt, PracticeSession } from '../learning/records'
import { parseBackupText, validateBackup, MAX_BACKUP_BYTES } from './backup'
import { DexieLearningRepository } from './repository'
import { GuitarLabDB } from './schema'

const T0 = Date.UTC(2026, 9, 20, 8)
let counter = 0
const names: string[] = []
const freshName = () => { const name = `test-db-${++counter}-${Math.random()}`; names.push(name); return name }
afterEach(async () => { for (const name of names.splice(0)) await Dexie.delete(name) })

const legacyFretboard = (i: number, correct: boolean, extra: Record<string, unknown> = {}) => ({
  id: `legacy-${i}`, sessionId: 'old-session', exerciseType: 'fretboard.find-note', topicId: 'fretboard.note.C', question: { mode: 'random' },
  response: 'String 5, fret 3, C3', expected: 'String 5, fret 3, C', correct, responseMs: 1200, replays: 0, difficulty: 1, timestamp: T0 + i * 1000,
  masteryAfter: 50, string: 5, fret: 3, note: 'C', mode: 'random', targetString: 5, targetFret: 3, ...extra,
})
const legacyEar = (i: number, topic: string, expected: string, correct: boolean) => ({
  id: `ear-${i}`, sessionId: `q-${i}`, exerciseType: topic.replace('ear.', ''), topicId: topic, question: { id: `q-${i}` }, response: expected,
  expected, correct, responseMs: 900, replays: 1, difficulty: 1, timestamp: T0 + 86_400_000 + i * 1000, masteryAfter: 100,
})

async function seedOldVersion(name: string, version: 1 | 2 | 3, rows: Record<string, unknown>[]) {
  const stores = {
    1: { attempts: 'id, sessionId, exerciseType, topicId, timestamp', settings: 'id' },
    2: { attempts: 'id, sessionId, exerciseType, topicId, timestamp, string, fret, note', settings: 'id' },
    3: { attempts: 'id, sessionId, exerciseType, topicId, timestamp, string, fret, note, targetString, targetFret', settings: 'id' },
  }[version]
  const old = new Dexie(name)
  old.version(version).stores(stores)
  await old.table('attempts').bulkAdd(rows)
  await old.table('settings').put({ id: 'audio', value: { volume: 0.4, silent: true } })
  old.close()
}

function newAttempt(id: string, sessionId: string, correct: boolean, timestamp = T0): ExerciseAttempt {
  return {
    id, sessionId, exerciseType: 'fret-identify', templateId: 'fret.naturals.low.identify', topicId: 'fret.naturals.low', nodeId: 'fret.naturals.low',
    reviewItemIds: ['fret.note.C.s5'], itemResults: { 'fret.note.C.s5': correct }, generatorVersion: 1, question: { kind: 'fret-identify' }, response: { kind: 'fret-identify', value: 'C' },
    expected: 'C', correct, result: correct ? 'correct' : 'incorrect', evidenceLevel: 'recall', assisted: false, responseMs: 2000, replays: 0, difficulty: 1, timestamp,
  }
}
const session = (id: string): PracticeSession => ({ id, mode: 'guided', settings: { minutes: 5 }, plannedItems: [], cursor: 0, outcomes: [], status: 'active', startedAt: T0, updatedAt: T0 })

describe('Dexie migrations', () => {
  for (const version of [1, 2, 3] as const) {
    it(`upgrades a v${version} database without losing attempts or settings`, async () => {
      const name = freshName()
      const rows = version === 3
        ? [legacyFretboard(1, false), legacyFretboard(2, true, { assisted: true }), legacyEar(3, 'ear.triad', 'Minor', true), legacyEar(4, 'ear.cadence', 'Plagal (IV–I)', false)]
        : [legacyFretboard(1, true, { targetString: undefined }), legacyEar(2, 'ear.interval', 'M3', true)]
      await seedOldVersion(name, version, rows)
      const db = new GuitarLabDB(name)
      const repo = new DexieLearningRepository(db)
      const attempts = await repo.getAttempts()
      expect(attempts).toHaveLength(rows.length)
      expect(attempts.map(a => a.id).sort()).toEqual(rows.map(r => r.id as string).sort())
      for (const a of attempts) {
        expect(a.nodeId).toBeTruthy()
        expect(Array.isArray(a.reviewItemIds)).toBe(true)
        expect(await repo.getSession(a.sessionId)).toBeDefined()
      }
      expect(await repo.getSetting('audio')).toEqual({ volume: 0.4, silent: true })
      const reviews = await repo.getReviews()
      if (version === 3) {
        expect(attempts.find(a => a.id === 'legacy-1')).toMatchObject({ nodeId: 'fret.naturals.low', reviewItemIds: ['fret.note.C.s5'], legacySessionId: 'old-session', response: 'String 5, fret 3, C3' })
        expect(reviews.get('fret.note.C.s5')).toMatchObject({ box: 0, lapses: 1, reviews: 2 })
        expect(reviews.get('ear.triad.major-minor')?.box).toBe(1)
        expect(attempts.find(a => a.id === 'ear-4')?.reviewItemIds).toEqual([])
      } else {
        // v1/v2 rows had no targetString: fall back to the selected string.
        expect(attempts.find(a => a.id === 'legacy-1')?.reviewItemIds).toEqual(['fret.note.C.s5'])
        expect(reviews.get('ear.interval.M3')?.box).toBe(1)
      }
      db.close()
    })
  }
})

describe('repository writes', () => {
  it('records attempt, review schedule and session cursor together', async () => {
    const repo = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await repo.saveSession(session('s1'))
    const { reviews } = await repo.recordAttempt(newAttempt('a1', 's1', true), { id: 's1', cursor: 1, outcome: { index: 0, attemptId: 'a1', result: 'correct' } })
    expect(reviews[0]).toMatchObject({ itemId: 'fret.note.C.s5', box: 1 })
    expect((await repo.getSession('s1'))).toMatchObject({ cursor: 1, outcomes: [{ index: 0, attemptId: 'a1' }] })
    expect(await repo.getActiveSession(T0 + 1000)).toMatchObject({ id: 's1' })
  })
  it('a failed write leaves no partial records (transactional)', async () => {
    const db = new GuitarLabDB(freshName())
    const repo = new DexieLearningRepository(db)
    await repo.saveSession(session('s1'))
    const spy = vi.spyOn(db.reviews, 'bulkPut').mockRejectedValueOnce(new Error('QuotaExceededError'))
    await expect(repo.recordAttempt(newAttempt('a1', 's1', true), { id: 's1', cursor: 1 })).rejects.toThrow('QuotaExceededError')
    spy.mockRestore()
    expect(await db.attempts.count()).toBe(0)
    expect((await repo.getSession('s1'))?.cursor).toBe(0)
  })
  it('skips are stored as events and never change schedules', async () => {
    const repo = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await repo.saveSession(session('s1'))
    await repo.recordEvent({ id: 'e1', sessionId: 's1', nodeId: 'fret.open', kind: 'skip', payload: {}, timestamp: T0 }, { id: 's1', cursor: 1, outcome: { index: 0, result: 'skipped' } })
    expect((await repo.getReviews()).size).toBe(0)
    expect((await repo.getSession('s1'))?.cursor).toBe(1)
  })
  it('marks sessions idle for more than 12 hours as abandoned', async () => {
    const repo = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await repo.saveSession(session('old'))
    expect(await repo.getActiveSession(T0 + 13 * 3_600_000)).toBeUndefined()
    expect((await repo.getSession('old'))?.status).toBe('abandoned')
  })
})

describe('backup export / import', () => {
  async function populated() {
    const repo = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await repo.saveSession(session('s1'))
    await repo.recordAttempt(newAttempt('a1', 's1', false, T0))
    await repo.recordAttempt({ ...newAttempt('a2', 's1', true, T0 + 1000), retryOf: 'a1', assisted: true })
    await repo.saveSetting('audio', { volume: 0.3 })
    return repo
  }
  it('round-trips through JSON and passes validation', async () => {
    const repo = await populated()
    const envelope = await repo.exportAll(T0 + 5000)
    const parsed = parseBackupText(JSON.stringify(envelope))
    expect(parsed.ok).toBe(true)
    const target = new DexieLearningRepository(new GuitarLabDB(freshName()))
    if (!parsed.ok) throw new Error('invalid')
    await target.importBackup(parsed.envelope, 'replace', T0 + 6000)
    expect((await target.getAttempts()).map(a => a.id)).toEqual(['a1', 'a2'])
    expect((await target.getReviews()).get('fret.note.C.s5')).toMatchObject({ box: 0, lapses: 1 })
    expect(await target.getSetting('audio')).toEqual({ volume: 0.3 })
  })
  it('replace keeps a pre-import backup; merge never overwrites local records', async () => {
    const repo = await populated()
    const other = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await other.saveSession(session('s9'))
    await other.recordAttempt(newAttempt('a9', 's9', true, T0 + 9000))
    const incoming = await other.exportAll(T0 + 10_000)
    await repo.importBackup({ ...incoming, data: { ...incoming.data, attempts: [...incoming.data.attempts, { ...newAttempt('a1', 's9', true), expected: 'OVERWRITE?' }] } }, 'merge', T0 + 11_000)
    const merged = await repo.getAttempts()
    expect(merged.map(a => a.id).sort()).toEqual(['a1', 'a2', 'a9'])
    expect(merged.find(a => a.id === 'a1')?.expected).toBe('C')
    const result = await repo.importBackup(incoming, 'replace', T0 + 12_000)
    expect(result.preImportBackupId).toBeDefined()
    expect((await repo.getAttempts()).map(a => a.id)).toEqual(['a9'])
    const saved = await repo.latestPreImportBackup()
    expect(saved?.data.attempts.map(a => a.id).sort()).toEqual(['a1', 'a2', 'a9'])
  })
  it('rejects malformed, unsupported, inconsistent and oversized backups with actionable errors', async () => {
    const repo = await populated()
    const good = await repo.exportAll(T0 + 5000)
    expect(parseBackupText('{not json')).toMatchObject({ ok: false })
    expect(parseBackupText(' '.repeat(MAX_BACKUP_BYTES + 1))).toMatchObject({ ok: false, errors: [expect.stringContaining('太大')] })
    expect(validateBackup({ ...good, format: 'something-else' }, T0 + 6000)).toMatchObject({ ok: false })
    expect(validateBackup({ ...good, schemaVersion: 99 }, T0 + 6000)).toMatchObject({ ok: false, errors: [expect.stringContaining('版本')] })
    const orphan = { ...good, data: { ...good.data, attempts: [{ ...good.data.attempts[0], sessionId: 'missing' }] } }
    expect(validateBackup(orphan, T0 + 6000)).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.stringContaining('不存在的練習時段')]) })
    const dup = { ...good, data: { ...good.data, attempts: [good.data.attempts[0], good.data.attempts[0]] } }
    expect(validateBackup(dup, T0 + 6000)).toMatchObject({ ok: false })
    const badResult = { ...good, data: { ...good.data, attempts: [{ ...good.data.attempts[0], itemResults: { x: 'yes' } }] } }
    expect(validateBackup(badResult, T0 + 6000).ok).toBe(false)
    const future = { ...good, data: { ...good.data, attempts: [{ ...good.data.attempts[0], timestamp: T0 + 400 * 86_400_000 }] } }
    expect(validateBackup(future, T0 + 6000).ok).toBe(false)
    const huge = { ...good, data: { ...good.data, attempts: [{ ...good.data.attempts[0], question: 'x'.repeat(60_000) }] } }
    expect(validateBackup(huge, T0 + 6000).ok).toBe(false)
    expect(validateBackup(good, T0 + 6000).ok).toBe(true)
  })
})


describe('practice evidence and cross-device handoff', () => {
  it('never schedules position recall from microphone evidence, even if a caller supplies position fields', async () => {
    const repo = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await repo.saveSession(session('s1'))
    const played = { ...newAttempt('mic', 's1', true), inputMethod: 'microphone' as const, string: 5, fret: 3, verificationScope: 'exactPitch' as const }
    await repo.recordAttempt(played)
    expect((await repo.getReviews()).size).toBe(0)
    expect((await repo.getAttempts())[0]).toMatchObject({ itemResults: {}, reviewItemIds: [] })
    expect((await repo.getAttempts())[0].string).toBeUndefined()
    await repo.recordAttempt(played)
    expect(await repo.getAttempts()).toHaveLength(1)
  })
  it('loads v4 backups conservatively and rejects unsupported evidence metadata', async () => {
    const repo = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await repo.saveSession(session('s1')); await repo.recordAttempt(newAttempt('old', 's1', true))
    const old = { ...await repo.exportAll(T0 + 1000), schemaVersion: 4 }
    const parsed = validateBackup(old, T0 + 2000)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('invalid')
    expect(parsed.envelope.schemaVersion).toBe(5)
    expect(parsed.envelope.data.attempts[0]).toMatchObject({ inputMethod: 'legacy', verificationScope: 'unknown' })
    const invalid = structuredClone(old)
    invalid.data.attempts[0].inputMethod = 'telepathy' as never
    expect(validateBackup(invalid, T0 + 2000).ok).toBe(false)
    const badPreferences = structuredClone(old)
    badPreferences.data.settings.push({ id: 'preferences', value: { practiceFocus: 'invalid-topic' } })
    expect(validateBackup(badPreferences, T0 + 2000).ok).toBe(false)
  })
  it('imports session completion and task completion without resurrecting them or duplicating attempts', async () => {
    const phone = new DexieLearningRepository(new GuitarLabDB(freshName()))
    const desktop = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await phone.saveSession(session('s1'))
    await phone.recordAttempt(newAttempt('a1', 's1', true))
    await phone.queueBridge({ id: 'task', nodeId: 'chord.open', taskId: 'play-c', createdAt: T0 })
    const before = await phone.exportAll(T0 + 1000)
    await desktop.importBackup(before, 'merge', T0 + 2000)
    await desktop.saveSession({ ...session('s1'), status: 'completed', updatedAt: T0 + 3000, endedAt: T0 + 3000 })
    await desktop.completeBridge('task', { id: 'report', nodeId: 'chord.open', bridgeTaskId: 'play-c', rating: 2, verified: false, timestamp: T0 + 3000 })
    await phone.importBackup(await desktop.exportAll(T0 + 4000), 'merge', T0 + 5000)
    await phone.importBackup(before, 'merge', T0 + 6000)
    expect(await phone.getAttempts()).toHaveLength(1)
    expect(await phone.listBridgeQueue()).toHaveLength(0)
    expect((await phone.getSession('s1'))?.status).toBe('completed')
    expect(await phone.latestPreImportBackup()).toBeDefined()
  })
  it('preserves device latency and never enables microphone input when importing preferences', async () => {
    const source = new DexieLearningRepository(new GuitarLabDB(freshName()))
    const target = new DexieLearningRepository(new GuitarLabDB(freshName()))
    await source.savePreferences({ ...await source.getPreferences(), latencyOffsetMs: 300, answerInput: 'play', practiceFocus: 'positions' })
    await target.savePreferences({ ...await target.getPreferences(), latencyOffsetMs: 40 })
    const envelope = await source.exportAll(T0 + 1000)
    for (const mode of ['merge', 'replace'] as const) {
      await target.importBackup(envelope, mode, T0 + 2000)
      expect(await target.getPreferences()).toMatchObject({ latencyOffsetMs: 40, answerInput: 'tap', practiceFocus: 'positions' })
    }
  })
})


it('upgrades a v4 database with unknown evidence, keeping its questions and history', async () => {
  const name = freshName()
  const old = new Dexie(name)
  old.version(4).stores({ attempts: 'id, sessionId, exerciseType, topicId, nodeId, timestamp, string, fret, note, targetString, targetFret, *reviewItemIds', settings: 'id', sessions: 'id, status, mode, startedAt, updatedAt', reviews: 'itemId, dueAt, box', events: 'id, nodeId, kind, timestamp', selfReports: 'id, nodeId, bridgeTaskId, timestamp', bridgeQueue: 'id, nodeId, createdAt, completedAt', progressions: 'id, updatedAt', pathways: 'pathwayId', backups: 'id, createdAt' })
  const attempt = newAttempt('before-v5', 's1', true)
  await old.table('attempts').put(attempt); await old.table('sessions').put(session('s1')); old.close()
  const upgraded = new GuitarLabDB(name)
  const repo = new DexieLearningRepository(upgraded)
  expect((await repo.getAttempts())[0]).toMatchObject({ id: 'before-v5', inputMethod: 'legacy', verificationScope: 'unknown', question: attempt.question })
  expect((await repo.getSession('s1'))?.status).toBe('active')
  upgraded.close()
})


it('deduplicates concurrent logical bridge tasks and completes the existing task by its report', async () => {
  const repo = new DexieLearningRepository(new GuitarLabDB(freshName()))
  await Promise.all(['first', 'second'].map(id => repo.queueBridge({ id, nodeId: 'chord.open', taskId: 'play-c', createdAt: T0 })))
  expect(await repo.listBridgeQueue()).toHaveLength(1)
  await repo.completeBridge('unused-new-id', { id: 'report', nodeId: 'chord.open', bridgeTaskId: 'play-c', rating: 1, verified: false, timestamp: T0 + 1000 })
  expect(await repo.listBridgeQueue()).toHaveLength(0)
})

it('round-trips the independent scale focus and stored scale questions', async () => {
  const { buildGuidedSession } = await import('../learning/sessions')
  const source = new DexieLearningRepository(new GuitarLabDB(freshName()))
  await source.savePreferences({ ...await source.getPreferences(), practiceFocus: 'scales' })
  const plan = buildGuidedSession({ seed: 8, now: T0, audio: false, reviews: new Map(), mastery: new Map(), preference: 'auto', focus: 'scales' })
  await source.saveSession({ ...session('scales'), plannedItems: plan, settings: { practiceFocus: 'scales' } })
  const backup = await source.exportAll()
  expect(validateBackup(backup).ok).toBe(true)
  const target = new DexieLearningRepository(new GuitarLabDB(freshName()))
  await target.importBackup(backup, 'replace')
  expect((await target.getPreferences()).practiceFocus).toBe('scales')
  expect((await target.getSession('scales'))!.plannedItems).toEqual(plan)
})
