/**
 * Compatibility API for the Lab tools (fretboard explorer quiz, audio ear training).
 * All writes go through the LearningRepository so they update review schedules transactionally.
 */
import { DEFAULT_AUDIO, type AudioOptions } from '../audio/AudioEngine'
import { mapLegacyAttempt, type LegacyAttempt } from '../database/legacy'
import { db, repository } from '../database/repository'
import type { ExerciseAttempt, PracticeSession } from '../learning/records'

export { db }
export type AudioAttempt = ExerciseAttempt

export async function loadAudioSettings(): Promise<AudioOptions> {
  return { ...DEFAULT_AUDIO, ...(await repository.getSetting<Partial<AudioOptions>>('audio')) }
}
export async function saveAudioSettings(settings: AudioOptions): Promise<void> { await repository.saveSetting('audio', settings) }

const labSessionId = (timestamp: number) => `lab-${new Date(timestamp).toISOString().slice(0, 10)}`

/** Records a Lab attempt in a per-day Lab session and returns it with the legacy rolling accuracy. */
export async function saveAttempt(input: Omit<LegacyAttempt, 'masteryAfter'>): Promise<AudioAttempt> {
  const sessionId = labSessionId(input.timestamp)
  const mapped = mapLegacyAttempt({ ...input, sessionId }, { keepSession: true })
  const recent = await db.attempts.where('topicId').equals(input.topicId).sortBy('timestamp')
  const results = [input.correct, ...recent.slice(-9).map(a => a.correct)]
  const attempt: ExerciseAttempt = { ...mapped, legacySessionId: input.sessionId, masteryAfter: Math.round(results.filter(Boolean).length / results.length * 100) }
  if (!(await repository.getSession(sessionId))) {
    const session: PracticeSession = { id: sessionId, mode: 'lab', settings: {}, plannedItems: [], cursor: 0, outcomes: [], status: 'completed', startedAt: input.timestamp, updatedAt: input.timestamp, endedAt: input.timestamp }
    await repository.saveSession(session)
  }
  await repository.recordAttempt(attempt)
  return attempt
}
