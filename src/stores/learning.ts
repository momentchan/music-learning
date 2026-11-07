/** Transient UI state over the LearningRepository. The repository (IndexedDB) stays the source of truth. */
import { create } from 'zustand'
import { nodeById } from '../curriculum/nodes'
import { repository, type SessionPatch } from '../database/repository'
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
  unsaved: { attempt: ExerciseAttempt; sessionId?: string; sessionPatch?: SessionPatch }[]
  load: () => Promise<void>
  refresh: () => Promise<void>
  savePreferences: (patch: Partial<Preferences>) => Promise<void>
  startGuided: (audio: boolean) => Promise<string>
  extendGuided: (session: PracticeSession) => Promise<PracticeSession | null>
  startLesson: (nodeId: string, audio: boolean) => Promise<string>
  startFree: (nodeIds: string[], count: number, audio: boolean) => Promise<string>
  addUnsaved: (attempt: ExerciseAttempt, sessionId?: string, sessionPatch?: SessionPatch) => void
  retryUnsaved: () => Promise<number>
}

function newSession(mode: PracticeSession['mode'], plannedItems: PlannedItem[], settings: PracticeSession['settings']): PracticeSession {
  const now = Date.now()
  return { id: crypto.randomUUID(), mode, settings, plannedItems, cursor: 0, outcomes: [], status: 'active', startedAt: now, updatedAt: now }
}

let preferenceRevision = 0

export const useLearning = create<LearningState>((set, get) => ({
  loaded: false, error: null, attempts: [], reviews: new Map(), selfReports: [], bridgeQueue: [], preferences: DEFAULT_PREFERENCES, mastery: new Map(), unsaved: [],

  load: async () => { if (!get().loaded) await get().refresh() },

  refresh: async () => {
    const revision = preferenceRevision
    try {
      const [attempts, reviews, selfReports, bridgeQueue, preferences, activeSession] = await Promise.all([
        repository.getAttempts(), repository.getReviews(), repository.getSelfReports(), repository.listBridgeQueue(), repository.getPreferences(), repository.getActiveSession(),
      ])
      set({ loaded: true, error: null, attempts, reviews, selfReports, bridgeQueue, preferences: revision === preferenceRevision ? preferences : get().preferences, activeSession, mastery: computeAllMastery(attempts, reviews, selfReports, Date.now()) })
    } catch (e) {
      set({ loaded: true, error: `無法讀取本機學習紀錄（${e instanceof Error ? e.name || e.message : 'IndexedDB'}）。可以繼續練習，但答案可能無法儲存；請確認瀏覽器沒有封鎖網站資料。` })
    }
  },

  savePreferences: async patch => {
    preferenceRevision++
    const preferences = { ...get().preferences, ...patch }
    set({ preferences })
    try { await repository.savePreferences(preferences) } catch { set({ error: '設定無法儲存在這台裝置上。' }) }
  },

  startGuided: async audio => {
    const { reviews, mastery, preferences } = get()
    const plan = buildGuidedSession({ seed: randomSeed(), now: Date.now(), audio, reviews, mastery, preference: preferences.difficulty, focus: preferences.practiceFocus })
    const session = newSession('guided', plan, { audio, practiceContext: preferences.practiceContext, practiceFocus: preferences.practiceFocus, answerInput: preferences.practiceContext === 'pocket' ? 'tap' : preferences.answerInput })
    await repository.saveSession(session)
    const focusId = plan.find(item => item.kind === 'learn')?.nodeId ?? plan.find(item => item.kind === 'question')?.question.nodeId
    const bridge = focusId ? nodeById(focusId)?.bridge : undefined
    if (focusId && bridge) await repository.queueBridge({ id: crypto.randomUUID(), nodeId: focusId, taskId: bridge.id, createdAt: Date.now() })
    const bridgeQueue = await repository.listBridgeQueue()
    set({ activeSession: session, bridgeQueue })
    return session.id
  },

  extendGuided: async session => {
    const [reviews, attempts, selfReports] = await Promise.all([repository.getReviews(), repository.getAttempts(), repository.getSelfReports()])
    const mastery = computeAllMastery(attempts, reviews, selfReports, Date.now())
    const more = buildGuidedSession({
      seed: randomSeed(), now: Date.now(), audio: session.settings.audio !== false, reviews, mastery, preference: get().preferences.difficulty, intro: false, focus: session.settings.practiceFocus,
    }).filter(item => item.kind === 'question')
    if (!more.length) return null
    const extended = { ...session, plannedItems: [...session.plannedItems, ...more], updatedAt: Date.now() }
    await repository.saveSession(extended)
    set({ reviews, attempts, selfReports, mastery, activeSession: extended })
    return extended
  },

  startLesson: async (nodeId, audio) => {
    const { mastery, preferences } = get()
    const plan = buildLesson({ nodeId, seed: randomSeed(), difficulty: adaptiveDifficulty(mastery.get(nodeId), preferences.difficulty), audio })
    const session = newSession('lesson', plan, { nodeId, audio, practiceContext: preferences.practiceContext, practiceFocus: preferences.practiceFocus, answerInput: preferences.practiceContext === 'pocket' ? 'tap' : preferences.answerInput })
    await repository.saveSession(session)
    set({ activeSession: session })
    return session.id
  },

  startFree: async (nodeIds, count, audio) => {
    const { mastery, preferences } = get()
    const plan = buildFreePractice({ nodeIds, count, seed: randomSeed(), difficulty: preferences.difficulty, audio, mastery })
    const session = newSession('free', plan, { nodeId: nodeIds.length === 1 ? nodeIds[0] : undefined, audio, practiceContext: preferences.practiceContext, practiceFocus: preferences.practiceFocus, answerInput: preferences.practiceContext === 'pocket' ? 'tap' : preferences.answerInput })
    await repository.saveSession(session)
    set({ activeSession: session })
    return session.id
  },

  addUnsaved: (attempt, sessionId, sessionPatch) => set({ unsaved: [...get().unsaved, { attempt, sessionId, sessionPatch }] }),

  retryUnsaved: async () => {
    const remaining: LearningState['unsaved'] = []
    for (const entry of get().unsaved) {
      try { await repository.recordAttempt(entry.attempt, entry.sessionPatch) } catch { remaining.push(entry) }
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
