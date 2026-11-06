/**
 * Rule-based Leitner scheduler (spec §6.2). Pure and deterministic.
 *
 * Box 0  new or missed: in-session recheck (~10 min)
 * Box 1  1 day · Box 2  3 days · Box 3  7 days · Box 4  14 days · Box 5  30 days (cap)
 *
 * - Correct, unassisted: one box up (a late review still moves only one box). Answering a learned item
 *   again before it is due keeps its box, so cramming cannot skip intervals.
 * - Correct, assisted (hint or retry after a miss): box 0, short recheck. Recovery is recorded, the miss is not erased.
 * - Incorrect: box 0, lapse +1, short recheck.
 * - Skips, exploration and aborted sessions never call this function.
 */
export const SCHEDULER_VERSION = 1
export const DAY = 24 * 60 * 60 * 1000
export const RECHECK_MS = 10 * 60 * 1000
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const
export const MAX_BOX = 5

export interface ReviewState {
  itemId: string
  box: number
  dueAt: number
  lastReviewedAt: number
  reviews: number
  lapses: number
  /** Results of the most recent graded reviews, newest last (max 10), for evidence display. */
  recent: boolean[]
  schedulerVersion: number
}

export interface GradedEvent { itemId: string; correct: boolean; assisted: boolean; timestamp: number }

export function applyReview(previous: ReviewState | undefined, event: GradedEvent): ReviewState {
  const base: ReviewState = previous ?? { itemId: event.itemId, box: 0, dueAt: event.timestamp, lastReviewedAt: 0, reviews: 0, lapses: 0, recent: [], schedulerVersion: SCHEDULER_VERSION }
  const recent = [...base.recent, event.correct && !event.assisted].slice(-10)
  let box: number
  let dueAt: number
  if (!event.correct) {
    box = 0
    dueAt = event.timestamp + RECHECK_MS
  } else if (event.assisted) {
    box = 0
    dueAt = event.timestamp + RECHECK_MS
  } else if (previous && base.box > 0 && event.timestamp < base.dueAt) {
    // Answering again before the item is due (cramming) keeps the current box and due date.
    box = base.box
    dueAt = base.dueAt
  } else {
    box = Math.min(MAX_BOX, base.box + 1)
    dueAt = event.timestamp + BOX_INTERVAL_DAYS[box] * DAY
  }
  return {
    itemId: event.itemId, box, dueAt, lastReviewedAt: event.timestamp, reviews: base.reviews + 1,
    lapses: base.lapses + (event.correct ? 0 : 1), recent, schedulerVersion: SCHEDULER_VERSION,
  }
}

/** Rebuild every item's state from graded history (used by migrations and scheduler upgrades). */
export function replayHistory(events: GradedEvent[]): Map<string, ReviewState> {
  const states = new Map<string, ReviewState>()
  for (const event of [...events].sort((a, b) => a.timestamp - b.timestamp)) states.set(event.itemId, applyReview(states.get(event.itemId), event))
  return states
}

export const isDue = (state: ReviewState, now: number) => state.dueAt <= now
export const isMissed = (state: ReviewState) => state.box === 0 && state.recent.length > 0 && !state.recent[state.recent.length - 1]

export interface RankedItem { itemId: string; score: number; reason: string; state?: ReviewState }

/**
 * Deterministic due-item ranking: missed first, then most overdue, then lower box. Ties break by item ID.
 */
export function rankDueItems(states: Iterable<ReviewState>, now: number): RankedItem[] {
  const ranked: RankedItem[] = []
  for (const state of states) {
    if (!isDue(state, now)) continue
    const overdueDays = Math.max(0, (now - state.dueAt) / DAY)
    const missed = isMissed(state)
    const score = (missed ? 100 : 0) + Math.min(overdueDays, 30) * 2 + (MAX_BOX - state.box)
    const reason = missed ? '上次答錯，再確認一次' : overdueDays >= 1 ? `已到期 ${Math.floor(overdueDays)} 天` : '今日到期'
    ranked.push({ itemId: state.itemId, score, reason, state })
  }
  return ranked.sort((a, b) => b.score - a.score || a.itemId.localeCompare(b.itemId))
}

export function boxLabel(box: number): string {
  return ['學習中', '1 天', '3 天', '7 天', '14 天', '30 天'][box] ?? `${box}`
}
