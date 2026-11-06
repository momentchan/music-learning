/** Derived, recomputable mastery and weakness (spec §6.3). Pure functions over attempts and review states. */
import { nodeItems, templatesForNode } from '../exercise-engine/registry'
import { NODES, PATHWAYS, nodeById } from '../curriculum/nodes'
import type { ExerciseAttempt, SelfReport } from './records'
import { DAY, isDue, rankDueItems, type ReviewState } from './scheduler'

export const MASTERY_CALC_VERSION = 1
export type NodeState = 'new' | 'learning' | 'familiar' | 'fluent'
export const NODE_STATE_LABEL: Record<NodeState, string> = { new: '未開始', learning: '學習中', familiar: '熟悉', fluent: '流暢' }

export interface NodeMastery {
  nodeId: string
  state: NodeState
  samples: number
  recentCorrect: number
  recentTotal: number
  days: number
  itemsSeen: number
  itemsTotal: number
  itemsBox2: number
  itemsBox3: number
  applyCorrect: number
  applyTotal: number
  played?: 'self' | 'verified'
  dueItems: number
}

const firstTries = (attempts: ExerciseAttempt[]) => attempts.filter(a => !a.retryOf)
const dayKey = (t: number) => new Date(t).toDateString()

export function computeNodeMastery(nodeId: string, attempts: ExerciseAttempt[], reviews: Map<string, ReviewState>, selfReports: SelfReport[], now: number): NodeMastery {
  const nodeAttempts = firstTries(attempts.filter(a => a.nodeId === nodeId)).sort((a, b) => a.timestamp - b.timestamp)
  const recallish = nodeAttempts.filter(a => a.evidenceLevel !== 'apply').slice(-20)
  // Recognition counts half (spec §5.2): weight each attempt.
  let weighted = 0, weightedCorrect = 0
  for (const a of recallish) {
    const w = a.evidenceLevel === 'recognize' ? 0.5 : 1
    weighted += w
    if (a.result === 'correct') weightedCorrect += w
  }
  const apply = nodeAttempts.filter(a => a.evidenceLevel === 'apply').slice(-10)
  const items = nodeItems(nodeId)
  const states = items.map(id => reviews.get(id)).filter((s): s is ReviewState => !!s)
  const itemsBox2 = states.filter(s => s.box >= 2).length
  const itemsBox3 = states.filter(s => s.box >= 3).length
  const days = new Set(nodeAttempts.map(a => dayKey(a.timestamp))).size
  const accuracy = weighted ? weightedCorrect / weighted : 0
  const hasApply = templatesForNode(nodeId).some(t => t.evidenceLevel === 'apply')
  const applyAccuracy = apply.length ? apply.filter(a => a.result === 'correct').length / apply.length : 0

  let state: NodeState = nodeAttempts.length ? 'learning' : 'new'
  const familiar = recallish.length >= 8 && accuracy >= 0.8 && days >= 2 && items.length > 0 && itemsBox2 / items.length >= 0.5
  if (familiar) state = 'familiar'
  if (familiar && (!hasApply || (apply.length >= 3 && applyAccuracy >= 0.75)) && itemsBox3 / items.length >= 0.8) state = 'fluent'

  const reports = selfReports.filter(r => r.nodeId === nodeId && r.rating >= 1)
  const played = reports.some(r => r.verified) ? 'verified' : reports.length ? 'self' : undefined
  return {
    nodeId, state, samples: nodeAttempts.length, recentCorrect: Math.round(weightedCorrect * 10) / 10, recentTotal: Math.round(weighted * 10) / 10,
    days, itemsSeen: states.length, itemsTotal: items.length, itemsBox2, itemsBox3,
    applyCorrect: apply.filter(a => a.result === 'correct').length, applyTotal: apply.length, played,
    dueItems: states.filter(s => isDue(s, now)).length,
  }
}

export function computeAllMastery(attempts: ExerciseAttempt[], reviews: Map<string, ReviewState>, selfReports: SelfReport[], now: number): Map<string, NodeMastery> {
  return new Map(NODES.filter(n => n.availability === 'available').map(n => [n.id, computeNodeMastery(n.id, attempts, reviews, selfReports, now)]))
}

export interface Weakness { itemId: string; nodeId?: string; misses: number; samples: number; reason: string }

/** Items with repeated recent misses. Requires ≥ 3 samples so a single miss is never shown as a weakness. */
export function weakItems(reviews: Iterable<ReviewState>, limit = 8): Weakness[] {
  const result: Weakness[] = []
  for (const state of reviews) {
    const recent = state.recent.slice(-5)
    const misses = recent.filter(ok => !ok).length
    if (recent.length >= 3 && misses >= 2) result.push({ itemId: state.itemId, misses, samples: recent.length, reason: `最近 ${recent.length} 次錯 ${misses} 次` })
  }
  return result.sort((a, b) => b.misses / b.samples - a.misses / a.samples || a.itemId.localeCompare(b.itemId)).slice(0, limit)
}

/** Next step on a pathway: first available step that is not yet familiar. */
export function nextPathwayNode(pathwayId: string, mastery: Map<string, NodeMastery>): string | undefined {
  const pathway = PATHWAYS.find(p => p.id === pathwayId)
  return pathway?.steps.find(id => nodeById(id)?.availability === 'available' && !['familiar', 'fluent'].includes(mastery.get(id)?.state ?? 'new'))
}

export function pathwayCompletion(pathwayId: string, mastery: Map<string, NodeMastery>): { done: number; total: number; available: number } {
  const steps = PATHWAYS.find(p => p.id === pathwayId)?.steps ?? []
  return {
    done: steps.filter(id => ['familiar', 'fluent'].includes(mastery.get(id)?.state ?? 'new')).length,
    total: steps.length,
    available: steps.filter(id => nodeById(id)?.availability === 'available').length,
  }
}

export interface Recommendation { kind: 'due' | 'pathway' | 'weak-node'; nodeId?: string; title: string; reason: string }

/** Deterministic, explained recommendations (spec §6.2). Never locks other choices. */
export function recommendations(attempts: ExerciseAttempt[], reviews: Map<string, ReviewState>, mastery: Map<string, NodeMastery>, now: number, pathwayId = 'start'): Recommendation[] {
  const result: Recommendation[] = []
  const due = rankDueItems(reviews.values(), now)
  if (due.length) result.push({ kind: 'due', title: '到期複習', reason: `${due.length} 個項目到期${due.some(d => d.reason.startsWith('上次答錯')) ? '，包含上次答錯的' : ''}` })
  const next = nextPathwayNode(pathwayId, mastery)
  if (next) result.push({ kind: 'pathway', nodeId: next, title: nodeById(next)!.title, reason: mastery.get(next)?.state === 'new' ? '學習路徑的下一步' : '學習路徑上還在學習中' })
  const weakNodes = [...mastery.values()]
    .map(m => {
      const recent = firstTries(attempts.filter(a => a.nodeId === m.nodeId)).slice(-5)
      return { m, recent, misses: recent.filter(a => a.result !== 'correct').length }
    })
    .filter(x => x.recent.length >= 5 && x.misses >= 3 && x.m.nodeId !== next)
    .sort((a, b) => b.misses - a.misses || a.m.nodeId.localeCompare(b.m.nodeId))
  for (const { m, misses } of weakNodes.slice(0, 2)) result.push({ kind: 'weak-node', nodeId: m.nodeId, title: nodeById(m.nodeId)!.title, reason: `最近 5 題錯 ${misses} 題` })
  return result
}

/** Days practised in the current week (Mon–Sun) for the weekly goal. */
export function practiceDaysThisWeek(attempts: ExerciseAttempt[], now: number): boolean[] {
  const today = new Date(now)
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7)).getTime()
  const days = Array.from({ length: 7 }, () => false)
  for (const a of attempts) {
    const offset = Math.floor((a.timestamp - monday) / DAY)
    if (offset >= 0 && offset < 7) days[offset] = true
  }
  return days
}
