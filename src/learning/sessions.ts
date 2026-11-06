/** Pure session planning (spec §3.1, §9.2). Questions are generated up front and stored, so resume replays them exactly. */
import { nodeById } from '../curriculum/nodes'
import { templatesForItem, templatesForNode } from '../exercise-engine/registry'
import type { Difficulty, ExerciseTemplate } from '../exercise-engine/types'
import { createRng, deriveSeed, pick, shuffle } from '../lib/rng'
import type { NodeMastery } from './mastery'
import { nextPathwayNode } from './mastery'
import type { PlannedItem } from './records'
import { rankDueItems, type ReviewState } from './scheduler'

export const QUESTIONS_PER_MINUTES: Record<number, number> = { 3: 6, 5: 10, 10: 20 }
export const questionsFor = (minutes: number) => QUESTIONS_PER_MINUTES[minutes] ?? Math.max(4, Math.round(minutes * 2))

/** Adaptive difficulty: step down below 60 % recent accuracy, step up above 90 % with enough evidence. */
export function adaptiveDifficulty(mastery: NodeMastery | undefined, preference: 'auto' | Difficulty = 'auto'): Difficulty {
  if (preference !== 'auto') return preference
  if (!mastery || mastery.recentTotal < 6) return 1
  const accuracy = mastery.recentCorrect / mastery.recentTotal
  if (accuracy < 0.6) return 1
  if (accuracy >= 0.9) return mastery.state === 'fluent' || mastery.samples >= 30 ? 3 : 2
  return mastery.samples >= 20 ? 2 : 1
}

const usable = (t: ExerciseTemplate, audio: boolean) => audio || !t.requiresAudio

function questionItem(template: ExerciseTemplate, seed: number, difficulty: Difficulty, reason: string, itemId?: string): PlannedItem {
  return { kind: 'question', question: template.generate(seed, { difficulty, itemId }), reason }
}

/** Interleave so consecutive questions come from different nodes where possible. */
export function interleave(items: PlannedItem[]): PlannedItem[] {
  const remaining = [...items]
  const result: PlannedItem[] = []
  while (remaining.length) {
    const lastNode = result.length ? nodeOf(result[result.length - 1]) : undefined
    const index = remaining.findIndex(item => nodeOf(item) !== lastNode)
    result.push(remaining.splice(index >= 0 ? index : 0, 1)[0])
  }
  return result
}
const nodeOf = (item: PlannedItem) => item.kind === 'question' ? item.question.nodeId : item.nodeId

export interface LessonOptions { nodeId: string; seed: number; difficulty: Difficulty; audio: boolean }

/** Lesson loop: Learn → Recall → Locate → Hear → Apply → Play (bridge). */
export function buildLesson({ nodeId, seed, difficulty, audio }: LessonOptions): PlannedItem[] {
  const node = nodeById(nodeId)
  if (!node || node.availability !== 'available') throw new Error(`Node ${nodeId} is not available`)
  const templates = templatesForNode(nodeId).filter(t => usable(t, audio))
  const items: PlannedItem[] = [{ kind: 'learn', nodeId }]
  const counts = { recall: 3, locate: 2, hear: 2, apply: 2 } as const
  let n = 0
  for (const stage of ['recall', 'locate', 'hear', 'apply'] as const) {
    const stageTemplates = templates.filter(t => t.stage === stage)
    for (let i = 0; i < counts[stage] && stageTemplates.length; i++) {
      items.push(questionItem(stageTemplates[i % stageTemplates.length], deriveSeed(seed, n++), difficulty, stageLabel[stage]))
    }
  }
  if (node.bridge) items.push({ kind: 'bridge', nodeId, taskId: node.bridge.id })
  return items
}
const stageLabel = { recall: '回想', locate: '在指板上找', hear: '聽', apply: '應用' } as const

export interface FreePracticeOptions { nodeIds: string[]; count: number; seed: number; difficulty: Difficulty | 'auto'; audio: boolean; mastery: Map<string, NodeMastery> }

export function buildFreePractice({ nodeIds, count, seed, difficulty, audio, mastery }: FreePracticeOptions): PlannedItem[] {
  const templates = nodeIds.flatMap(id => templatesForNode(id)).filter(t => usable(t, audio))
  if (!templates.length) return []
  const rng = createRng(seed)
  const order = shuffle(rng, templates)
  return Array.from({ length: count }, (_, i) => {
    const template = order[i % order.length]
    const d = difficulty === 'auto' ? adaptiveDifficulty(mastery.get(template.nodeId)) : difficulty
    return questionItem(template, deriveSeed(seed, i), d, '自由練習')
  })
}

export interface GuidedOptions {
  minutes: number
  seed: number
  now: number
  audio: boolean
  reviews: Map<string, ReviewState>
  mastery: Map<string, NodeMastery>
  preference: 'auto' | Difficulty
  pathwayId?: string
}

/**
 * Guided session recipe: warm-up (2 due) → due reviews (interleaved) → new or weak material → one apply item → bridge.
 * With nothing due, more time goes to new material.
 */
export function buildGuidedSession(options: GuidedOptions): PlannedItem[] {
  const { minutes, seed, now, audio, reviews, mastery, preference } = options
  const total = questionsFor(minutes)
  const rng = createRng(seed)
  let n = 0
  const nextSeed = () => deriveSeed(seed, n++)
  const difficultyFor = (nodeId: string) => adaptiveDifficulty(mastery.get(nodeId), preference)

  const due = rankDueItems(reviews.values(), now)
    .map(r => ({ ...r, templates: templatesForItem(r.itemId).filter(t => usable(t, audio) && nodeById(t.nodeId)?.availability === 'available') }))
    .filter(r => r.templates.length)
  const reviewBudget = Math.min(due.length, Math.ceil(total * 0.5))
  const reviewItems: PlannedItem[] = due.slice(0, reviewBudget).map(r => {
    const template = pick(rng, r.templates)
    return questionItem(template, nextSeed(), difficultyFor(template.nodeId), r.reason, r.itemId)
  })
  const warmup = reviewItems.slice(0, 2)
  const reviewRest = interleave(reviewItems.slice(2))

  const plan: PlannedItem[] = [...warmup, ...reviewRest]
  const nextNode = nextPathwayNode(options.pathwayId ?? 'start', mastery)
  const remaining = () => total - plan.filter(i => i.kind === 'question').length
  if (nextNode && remaining() > 1) {
    const isNew = (mastery.get(nextNode)?.state ?? 'new') === 'new'
    if (isNew) plan.push({ kind: 'learn', nodeId: nextNode })
    const templates = templatesForNode(nextNode).filter(t => usable(t, audio) && t.stage !== 'apply')
    const budget = remaining() - 1
    for (let i = 0; i < budget && templates.length; i++) {
      const template = templates[i % templates.length]
      plan.push(questionItem(template, nextSeed(), isNew ? 1 : difficultyFor(nextNode), isNew ? '新內容' : '繼續學習'))
    }
  }
  // Apply: one context item from a node the learner has started (or the new node).
  const started = [...mastery.values()].filter(m => m.state !== 'new').map(m => m.nodeId)
  const applyTemplates = [...new Set([...started, ...(nextNode ? [nextNode] : [])])]
    .flatMap(id => templatesForNode(id)).filter(t => t.stage === 'apply' && usable(t, audio))
  while (remaining() > 0) {
    const pool = applyTemplates.length ? applyTemplates : due.flatMap(d => d.templates)
    if (!pool.length) break
    const template = pick(rng, pool)
    plan.push(questionItem(template, nextSeed(), difficultyFor(template.nodeId), '應用'))
  }
  const bridgeNode = nodeById(nextNode ?? '') ?? (started.length ? nodeById(started[0]) : undefined)
  if (bridgeNode?.bridge) plan.push({ kind: 'bridge', nodeId: bridgeNode.id, taskId: bridgeNode.bridge.id })
  return plan
}

/** Insert a recheck of a missed item ≥ 3 positions later (spec §6.2 box 0). */
export function insertRecheck(plan: PlannedItem[], afterIndex: number, item: PlannedItem): PlannedItem[] {
  const at = Math.min(plan.length, afterIndex + 4)
  return [...plan.slice(0, at), item, ...plan.slice(at)]
}

export function recheckFor(question: Extract<PlannedItem, { kind: 'question' }>['question'], seed: number): PlannedItem | null {
  const itemId = question.reviewItemIds.find(id => !id.startsWith('spell.'))
  const template = templatesForNode(question.nodeId).find(t => t.id === question.templateId)
  if (!template) return null
  return { kind: 'question', question: template.generate(seed, { difficulty: question.difficulty, itemId }), reason: '再確認一次', recheckOf: question.id }
}
