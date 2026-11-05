import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_AUDIO, type AudioOptions } from '../audio/AudioEngine'

export interface AudioAttempt {
  id: string; sessionId: string; exerciseType: string; topicId: string;
  question: unknown; response: string; expected: string; correct: boolean;
  responseMs: number; replays: number; difficulty: number; timestamp: number;
  masteryAfter: number; string?: number; fret?: number; note?: string; mode?: string; targetString?: number; targetFret?: number; assisted?: boolean
}
export interface SettingRecord { id: 'audio'; value: AudioOptions }
class GuitarLabDB extends Dexie {
  attempts!: EntityTable<AudioAttempt, 'id'>
  settings!: EntityTable<SettingRecord, 'id'>
  constructor() {
    super('guitar-lab')
    this.version(1).stores({ attempts: 'id, sessionId, exerciseType, topicId, timestamp', settings: 'id' })
    this.version(2).stores({ attempts: 'id, sessionId, exerciseType, topicId, timestamp, string, fret, note', settings: 'id' })
    this.version(3).stores({ attempts: 'id, sessionId, exerciseType, topicId, timestamp, string, fret, note, targetString, targetFret', settings: 'id' })
  }
}
export const db = new GuitarLabDB()
export async function loadAudioSettings(): Promise<AudioOptions> {
  const row = await db.settings.get('audio')
  return { ...DEFAULT_AUDIO, ...row?.value }
}
export async function saveAudioSettings(settings: AudioOptions): Promise<void> { await db.settings.put({ id: 'audio', value: settings }) }
export async function saveAttempt(attempt: Omit<AudioAttempt, 'masteryAfter'>): Promise<AudioAttempt> {
  const recent = await db.attempts.where('topicId').equals(attempt.topicId).reverse().sortBy('timestamp')
  const results = [attempt.correct, ...recent.slice(-9).map(a => a.correct)]
  const masteryAfter = Math.round(results.filter(Boolean).length / results.length * 100)
  const record = { ...attempt, masteryAfter }
  await db.attempts.put(record)
  return record
}
