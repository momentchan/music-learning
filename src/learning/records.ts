/** Persistent record shapes (spec §10.1). Storage-agnostic: the Dexie adapter stores these as-is. */
import type { EvidenceLevel, Question, ResultKind } from '../exercise-engine/types'
import type { ReviewState } from './scheduler'

export const RECORD_SCHEMA_VERSION = 4

export interface ExerciseAttempt {
  id: string
  sessionId: string
  /** Template kind for new attempts; legacy attempts keep their original type (e.g. "fretboard.find-note"). */
  exerciseType: string
  templateId?: string
  /** Legacy topic ID; equals nodeId for new attempts. */
  topicId: string
  nodeId: string
  reviewItemIds: string[]
  itemResults: Record<string, boolean>
  generatorVersion: number
  question: Question | unknown
  response: unknown
  expected: string
  correct: boolean
  result: ResultKind
  errorClass?: string
  evidenceLevel: EvidenceLevel
  assisted: boolean
  retryOf?: string
  /** Milliseconds; 0 when not meaningful. */
  responseMs: number
  replays: number
  difficulty: number
  timestamp: number
  /** Legacy fields kept for fretboard history. */
  masteryAfter?: number
  string?: number
  fret?: number
  note?: string
  mode?: string
  targetString?: number
  targetFret?: number
  legacySessionId?: string
}

export type PlannedItem =
  | { kind: 'learn'; nodeId: string }
  | { kind: 'question'; question: Question; reason: string; recheckOf?: string }
  | { kind: 'bridge'; nodeId: string; taskId: string }

export interface ItemOutcome { index: number; attemptId?: string; result?: ResultKind | 'skipped' | 'done'; errorClass?: string; nodeId?: string }

export interface PracticeSession {
  id: string
  mode: 'guided' | 'lesson' | 'free' | 'legacy' | 'lab'
  settings: { minutes?: number; nodeId?: string; templateIds?: string[]; difficulty?: number; audio?: boolean }
  plannedItems: PlannedItem[]
  /** Index of the next unanswered item. */
  cursor: number
  outcomes: ItemOutcome[]
  status: 'active' | 'completed' | 'paused' | 'abandoned'
  startedAt: number
  updatedAt: number
  endedAt?: number
  summary?: SessionSummary
}

export interface SessionSummary {
  graded: number
  correct: number
  partial: number
  skipped: number
  nodes: string[]
  errorClasses: Record<string, number>
  promoted: number
  demoted: number
}

export interface SkipEvent { id: string; sessionId?: string; nodeId: string; kind: 'skip' | 'explore'; payload: unknown; timestamp: number }

export interface SelfReport { id: string; bridgeTaskId: string; nodeId: string; rating: 0 | 1 | 2; verified: boolean; metric?: number; timestamp: number }

export interface BridgeQueueItem { id: string; nodeId: string; taskId: string; createdAt: number; completedAt?: number }

export interface SavedProgression { id: string; name: string; key: string; chords: { symbol: string; beats: number; inversion?: number }[]; schemaVersion: number; createdAt: number; updatedAt: number }

export interface PathwayProgress { pathwayId: string; completedNodeIds: string[]; updatedAt: number }

export interface Preferences {
  weeklyGoalDays: number
  sessionMinutes: 3 | 5 | 10
  difficulty: 'auto' | 1 | 2 | 3
  practiceLayout: 'vertical' | 'horizontal'
  latencyOffsetMs: number | null
  tuning: 'standard'
  noteNaming: 'sharps-and-flats'
  leftHanded: boolean
  theme: 'dark'
  language: 'zh-TW'
}

export const DEFAULT_PREFERENCES: Preferences = {
  weeklyGoalDays: 4, sessionMinutes: 5, difficulty: 'auto', practiceLayout: 'vertical', latencyOffsetMs: null,
  tuning: 'standard', noteNaming: 'sharps-and-flats', leftHanded: false, theme: 'dark', language: 'zh-TW',
}

export type { ReviewState }
