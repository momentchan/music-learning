import { generate } from '../exercise-engine/registry'
import type { Difficulty, FretLocateQuestion } from '../exercise-engine/types'
import { createRng, deriveSeed, shuffle } from '../lib/rng'
import { PC_SHARP } from '../music-theory/notes'
import type { ExerciseAttempt, PlannedItem } from './records'
import type { ReviewState } from './scheduler'

/** Product sequence, not a claim of an experimentally optimal learning order. */
const NOTES = [0, 7, 2, 9, 4, 11, 5, 6, 1, 8, 3, 10]
const STRINGS = [6, 5, 4, 3, 2, 1]
const TEMPLATES = new Set(['fret.naturals.all.locate', 'fret.naturals.low.locate', 'fret.accidentals.locate'])
type Stage = NonNullable<FretLocateQuestion['practiceStage']>
interface Evidence { question: FretLocateQuestion; attempt: ExerciseAttempt }

interface Options {
  seed: number
  now: number
  attempts: ExerciseAttempt[]
  practiceContext: 'pocket' | 'instrument'
  reviews: Map<string, ReviewState>
  preference: 'auto' | Difficulty
}

function noteEvidence(attempt: ExerciseAttempt): Evidence | null {
  const q = attempt.question as Partial<FretLocateQuestion> | null
  if (!q || q.kind !== 'fret-locate' || !TEMPLATES.has(q.templateId ?? '') || !STRINGS.includes(q.string!) || !NOTES.includes(q.targetPc!)) return null
  return { question: q as FretLocateQuestion, attempt }
}

/** One entry point: establish one note across strings, shuffle strings, then mix learned notes.
 * Pitch successes may steer instrument practice, but never become position-mastery evidence.
 * Stage and questions are serialized in the existing plan/attempt, so reload and merge retain them.
 */
export function buildNotePractice({ seed, now, attempts, practiceContext, reviews, preference }: Options): PlannedItem[] {
  const evidence = attempts
    .filter(a => (a.practiceContext ?? (a.inputMethod === 'microphone' ? 'instrument' : 'pocket')) === practiceContext && !a.retryOf)
    .flatMap(a => { const e = noteEvidence(a); return e ? [e] : [] })
    .sort((a, b) => a.attempt.timestamp - b.attempt.timestamp || a.attempt.id.localeCompare(b.attempt.id))
  const passed = (pc: number, stage: Stage) => {
    const latest = new Map<number, ExerciseAttempt>()
    for (const e of evidence) {
      if (e.question.targetPc === pc && (e.question.practiceStage ?? 'map') === stage) latest.set(e.question.string!, e.attempt)
    }
    return new Set([...latest].filter(([, a]) => a.correct && !a.assisted).map(([string]) => string))
  }
  const completed = NOTES.filter(pc => passed(pc, 'map').size === 6 && passed(pc, 'shuffle').size === 6)
  const current = NOTES.find(pc => !completed.includes(pc))
  const plan: PlannedItem[] = []
  const rng = createRng(seed)
  const add = (pc: number, string: number, stage: Stage) => {
    const nodeId = [0, 2, 4, 5, 7, 9, 11].includes(pc) ? 'fret.naturals.all' : 'fret.accidentals'
    const question = generate(`${nodeId}.locate`, deriveSeed(seed, plan.length), preference === 'auto' ? 1 : preference, `fret.note.${PC_SHARP[pc]}.s${string}`) as FretLocateQuestion
    const open = question.tuning[6 - string]
    const baseFret = (pc - open % 12 + 12) % 12
    const fret = baseFret === 0 && (stage === 'shuffle' || stage === 'mixed' && rng() < .5) ? 12 : baseFret
    question.targetMidi = open + fret
    question.prompt = `找出 ${PC_SHARP[pc].replace('#', '♯')}${Math.floor(question.targetMidi / 12) - 1}`
    question.practiceStage = stage
    plan.push({ kind: 'question', question, reason: stage === 'mixed' ? '複習' : `找出 ${question.targetLabel}` })
  }
  if (current !== undefined) {
    const stage = passed(current, 'map').size === 6 ? 'shuffle' : 'map'
    const remaining = STRINGS.filter(string => !passed(current, stage).has(string))
    let order = stage === 'map' ? remaining : shuffle(rng, remaining)
    // Shuffling must visibly break the original route, even for an unlucky seed.
    if (stage === 'shuffle' && order.length > 1 && order.every((s, i) => s === remaining[i])) order = [...order.slice(1), order[0]]
    for (const string of order) add(current, string, stage)
  }

  const candidates = shuffle(rng, completed.flatMap(pc => STRINGS.map(string => {
    const history = evidence.filter(e => e.question.targetPc === pc && e.question.string === string)
    const last = history.at(-1)?.attempt
    const review = reviews.get(`fret.note.${PC_SHARP[pc]}.s${string}`)
    // A recent miss/hint is strongest; due items follow. Instrument practice also has
    // its own timestamp fallback because pitch answers deliberately have no review items.
    const due = review?.dueAt ?? (last ? last.timestamp + 24 * 60 * 60 * 1000 : 0)
    return { pc, string, priority: last && (!last.correct || last.assisted) ? 2 : due <= now ? 1 : 0, at: last?.timestamp ?? 0 }
  }))).sort((a, b) => b.priority - a.priority || a.at - b.at)
  const reviewCount = current === undefined ? 8 : Math.min(2, candidates.length)
  for (const c of shuffle(rng, candidates.slice(0, reviewCount))) add(c.pc, c.string, 'mixed')
  return plan
}
