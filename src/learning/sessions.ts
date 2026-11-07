/** Pure session planning (spec §3.1, §9.2). Questions are generated up front and stored, so resume replays them exactly. */
import { PATHWAYS, nodeById } from '../curriculum/nodes'
import { templatesForItem, templatesForNode } from '../exercise-engine/registry'
import type { Difficulty, ExerciseTemplate } from '../exercise-engine/types'
import { createRng, deriveSeed, pick, shuffle } from '../lib/rng'
import type { NodeMastery } from './mastery'
import { nextPathwayNode } from './mastery'
import type { PlannedItem } from './records'
import { rankDueItems, type ReviewState } from './scheduler'

/** One commute batch. Another batch is appended when this one runs out, until the learner leaves. */
export const GUIDED_BATCH = 8

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

/** Phone practice along Start Here. Answers are taps on the fretboard. */
const COMMUTE_NECK = ['fret.naturals.all', 'fret.accidentals', 'interval.shapes']
const COMMUTE_THEORY = ['scale.major', 'key.diatonic', 'harmony.basic']

/** Octave-shape drills are retired. Text-only questions are not used in the commute session. */
function onFretboard(template: ExerciseTemplate): boolean {
  return template.kind === 'fret-locate' && template.nodeId !== 'fret.octaves'
}

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
  const board = templates.filter(t => t.kind === 'fret-locate')
  let n = 0
  if (board.length && nodeId !== 'fret.octaves') {
    for (let i = 0; i < 6; i++) items.push(questionItem(board[i % board.length], deriveSeed(seed, n++), difficulty, '在指板上找'))
  } else {
    const counts = { recall: 3, locate: 2, hear: 2, apply: 2 } as const
    for (const stage of ['recall', 'locate', 'hear', 'apply'] as const) {
      const stageTemplates = templates.filter(t => t.stage === stage)
      for (let i = 0; i < counts[stage] && stageTemplates.length; i++) {
        items.push(questionItem(stageTemplates[i % stageTemplates.length], deriveSeed(seed, n++), difficulty, stageLabel[stage]))
      }
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
  seed: number
  now: number
  audio: boolean
  reviews: Map<string, ReviewState>
  mastery: Map<string, NodeMastery>
  preference: 'auto' | Difficulty
  pathwayId?: string
  /** First batch shows the learn card. Later batches are questions only. */
  intro?: boolean
}

/**
 * Commute session: due reviews, then phone work that does not need a guitar.
 * Every question is answered by tapping the fretboard. Octave-shape items and text-only questions are left out.
 * The batch keeps going until the learner leaves. The guitar task is queued, not played here.
 */
export function buildGuidedSession(options: GuidedOptions): PlannedItem[] {
  const { seed, now, audio, reviews, mastery, preference } = options
  const intro = options.intro !== false
  const pathwayId = options.pathwayId ?? 'start'
  const total = GUIDED_BATCH
  const rng = createRng(seed)
  let n = 0
  const nextSeed = () => deriveSeed(seed, n++)
  const difficultyFor = (nodeId: string) => adaptiveDifficulty(mastery.get(nodeId), preference)

  const due = rankDueItems(reviews.values(), now)
    .filter(r => !r.itemId.startsWith('fret.octave.'))
    .map(r => ({ ...r, templates: templatesForItem(r.itemId).filter(t => onFretboard(t) && usable(t, audio) && nodeById(t.nodeId)?.availability === 'available') }))
    .filter(r => r.templates.length)
  const reviewBudget = Math.min(due.length, Math.ceil(total * 0.5))
  const reviewItems: PlannedItem[] = due.slice(0, reviewBudget).map(r => {
    const template = pick(rng, r.templates)
    return questionItem(template, nextSeed(), difficultyFor(template.nodeId), r.reason, r.itemId)
  })

  const plan: PlannedItem[] = [...reviewItems.slice(0, 2), ...interleave(reviewItems.slice(2))]
  const remaining = () => total - plan.filter(i => i.kind === 'question').length
  const steps = PATHWAYS.find(p => p.id === pathwayId)?.steps ?? []
  const stillOpen = (ids: readonly string[]) => ids.find(id => steps.includes(id) && nodeById(id)?.availability === 'available' && !['familiar', 'fluent'].includes(mastery.get(id)?.state ?? 'new'))
  const focus = nextPathwayNode(pathwayId, mastery)
  const neckNode = stillOpen(COMMUTE_NECK)
  const theoryNode = stillOpen(COMMUTE_THEORY)

  if (intro && focus && (mastery.get(focus)?.state ?? 'new') === 'new') plan.push({ kind: 'learn', nodeId: focus })

  const pushFrom = (nodeId: string | undefined, count: number, reason: string) => {
    if (!nodeId || count <= 0) return 0
    const templates = templatesForNode(nodeId).filter(t => onFretboard(t) && usable(t, audio))
    if (!templates.length) return 0
    const isNew = (mastery.get(nodeId)?.state ?? 'new') === 'new'
    const nAdded = Math.min(count, remaining())
    for (let i = 0; i < nAdded; i++) plan.push(questionItem(templates[i % templates.length], nextSeed(), isNew ? 1 : difficultyFor(nodeId), reason))
    return nAdded
  }

  if (pathwayId === 'start' && (neckNode || theoryNode)) {
    const focusIsTheory = focus ? COMMUTE_THEORY.includes(focus) : !neckNode
    const mainNode = focusIsTheory ? theoryNode ?? focus : neckNode ?? focus
    const sideNode = focusIsTheory ? neckNode : theoryNode
    const room = remaining()
    const sideN = sideNode && sideNode !== mainNode ? Math.min(2, room) : 0
    const mainReason = (mastery.get(mainNode ?? '')?.state ?? 'new') === 'new' ? '新內容' : '繼續學習'
    pushFrom(mainNode, Math.max(0, room - sideN), mainReason)
    pushFrom(sideNode, sideN, focusIsTheory ? '在指板上找' : '在指板上找級數')
    const filler = mainNode === neckNode ? theoryNode : neckNode
    pushFrom(filler, remaining(), '在指板上找')
  } else if (focus) {
    const isNew = (mastery.get(focus)?.state ?? 'new') === 'new'
    pushFrom(focus, remaining(), isNew ? '新內容' : '繼續學習')
  }

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
