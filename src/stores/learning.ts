/** Transient UI state over the LearningRepository. The repository (IndexedDB) stays the source of truth. */
import { create } from 'zustand'
import { repository } from '../database/repository'
import { randomSeed } from '../lib/rng'
import { computeAllMastery, type NodeMastery } from '../learning/mastery'
import { DEFAULT_PREFERENCES, type BridgeQueueItem, type ExerciseAttempt, type PlannedItem, type PracticeSession, type Preferences, type SelfReport } from '../learning/records'
import type { ReviewState } from '../learning/scheduler'
import { buildFreePractice, buildGuidedSession, buildLesson, adaptiveDifficulty } from '../learning/sessions'

interface LearningState {
  loaded: boolean
  error: string | null
  attempts: ExerciseAttempt[]
  reviews: Map<string, ReviewState>
  selfReports: SelfReport[]
  bridgeQueue: BridgeQueueItem[]
  preferences: Preferences
  activeSession?: PracticeSession
  mastery: Map<string, NodeMastery>
  /** Graded attempts that could not be written; kept in memory for retry/export (spec §10.3). */
  unsaved: { attempt: ExerciseAttempt; sessionId?: string }[]
  load: () => Promise<void>
  refresh: () => Promise<void>
  savePreferences: (patch: Partial<Preferences>) => Promise<void>
  startGuided: (minutes: number, audio: boolean) => Promise<string>
  startLesson: (nodeId: string, audio: boolean) => Promise<string>
  startFree: (nodeIds: string[], count: number, audio: boolean) => Promise<string>
  addUnsaved: (attempt: ExerciseAttempt, sessionId?: string) => void
  retryUnsaved: () => Promise<number>
}

function newSession(mode: PracticeSession['mode'], plannedItems: PlannedItem[], settings: PracticeSession['settings']): PracticeSession {
  const now = Date.now()
  return { id: crypto.randomUUID(), mode, settings, plannedItems, cursor: 0, outcomes: [], status: 'active', startedAt: now, updatedAt: now }
}

export const useLearning = create<LearningState>((set, get) => ({
  loaded: false, error: null, attempts: [], reviews: new Map(), selfReports: [], bridgeQueue: [], preferences: DEFAULT_PREFERENCES, mastery: new Map(), unsaved: [],

  load: async () => { if (!get().loaded) await get().refresh() },

  refresh: async () => {
    try {
      const [attempts, reviews, selfReports, bridgeQueue, preferences, activeSession] = await Promise.all([
        repository.getAttempts(), repository.getReviews(), repository.getSelfReports(), repository.listBridgeQueue(), repository.getPreferences(), repository.getActiveSession(),
      ])
      set({ loaded: true, error: null, attempts, reviews, selfReports, bridgeQueue, preferences, activeSession, mastery: computeAllMastery(attempts, reviews, selfReports, Date.now()) })
    } catch (e) {
      set({ loaded: true, error: `無法讀取本機學習紀錄（${e instanceof Error ? e.name || e.message : 'IndexedDB'}）。可以繼續練習，但答案可能無法儲存；請確認瀏覽器沒有封鎖網站資料。` })
    }
  },

  savePreferences: async patch => {
    const preferences = { ...get().preferences, ...patch }
    set({ preferences })
    try { await repository.savePreferences(preferences) } catch { set({ error: '設定無法儲存在這台裝置上。' }) }
  },

  startGuided: async (minutes, audio) => {
    const { reviews, mastery, preferences } = get()
    const plan = buildGuidedSession({ minutes, seed: randomSeed(), now: Date.now(), audio, reviews, mastery, preference: preferences.difficulty })
    const session = newSession('guided', plan, { minutes, audio })
    await repository.saveSession(session)
    set({ activeSession: session })
    return session.id
  },

  startLesson: async (nodeId, audio) => {
    const { mastery, preferences } = get()
    const plan = buildLesson({ nodeId, seed: randomSeed(), difficulty: adaptiveDifficulty(mastery.get(nodeId), preferences.difficulty), audio })
    const session = newSession('lesson', plan, { nodeId, audio })
    await repository.saveSession(session)
    set({ activeSession: session })
    return session.id
  },

  startFree: async (nodeIds, count, audio) => {
    const { mastery, preferences } = get()
    const plan = buildFreePractice({ nodeIds, count, seed: randomSeed(), difficulty: preferences.difficulty, audio, mastery })
    const session = newSession('free', plan, { nodeId: nodeIds.length === 1 ? nodeIds[0] : undefined, audio })
    await repository.saveSession(session)
    set({ activeSession: session })
    return session.id
  },

  addUnsaved: (attempt, sessionId) => set({ unsaved: [...get().unsaved, { attempt, sessionId }] }),

  retryUnsaved: async () => {
    const remaining: LearningState['unsaved'] = []
    for (const entry of get().unsaved) {
      try { await repository.recordAttempt(entry.attempt) } catch { remaining.push(entry) }
    }
    set({ unsaved: remaining })
    await get().refresh()
    return remaining.length
  },
}))

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
