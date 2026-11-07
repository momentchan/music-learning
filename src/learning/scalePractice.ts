import { generate } from '../exercise-engine/registry'
import { SCALE_KEY_ORDER, scaleItem } from '../exercise-engine/templates/scalePractice'
import { deriveSeed, createRng, shuffle } from '../lib/rng'
import type { ExerciseAttempt, PlannedItem } from './records'
import type { GuidedOptions } from './sessions'
import { rankDueItems } from './scheduler'

/** Progress is contextual: pitch evidence can steer guitar practice without claiming position mastery. */
export function buildScalePractice(options: GuidedOptions): PlannedItem[] {
  const context = options.practiceContext ?? 'pocket'
  const history = (options.attempts ?? []).filter(a => {
    const q = a.question as { templateId?: string; scale?: { tonic: string } } | undefined
    return q?.scale && q.templateId?.startsWith('scale.practice.') && !a.retryOf &&
      (a.practiceContext ?? (a.inputMethod === 'microphone' ? 'instrument' : 'pocket')) === context
  }).sort((a, b) => a.timestamp - b.timestamp)
  const forKey = (tonic: string) => history.filter(a => (a.question as { scale: { tonic: string } }).scale.tonic === tonic)
  const passed = (tonic: string) => {
    const recent = forKey(tonic).slice(-12)
    const independent = (a: ExerciseAttempt) => a.correct && !a.assisted
    return recent.length === 12 && recent.filter(independent).length >= 10 &&
      new Set(recent.filter(independent).map(a => (a.question as { scale: { degree: number } }).scale.degree)).size === 6 &&
      recent.some(a => independent(a) && a.exerciseType === 'construct') && recent.some(a => independent(a) && a.exerciseType === 'fret-locate')
  }
  const currentIndex = SCALE_KEY_ORDER.findIndex(k => !passed(k))
  const learned = currentIndex < 0 ? SCALE_KEY_ORDER : SCALE_KEY_ORDER.slice(0, currentIndex)
  const tonic = SCALE_KEY_ORDER[currentIndex < 0 ? 0 : currentIndex]
  const due = rankDueItems(options.reviews.values(), options.now).filter(r => r.itemId.startsWith('scale.degree.') && [tonic, ...learned].includes(r.itemId.split('.')[2]))
  const degrees = forKey(tonic).length ? shuffle(createRng(options.seed), [2, 3, 4, 5, 6, 7]) : [2, 3, 4, 5, 6, 7]
  let position = 0
  let reviewsUsed = 0
  return Array.from({ length: 8 }, (_, i) => {
    const skill = [3, 7].includes(i) ? 'name' : 'locate'
    const dueIndex = reviewsUsed < 2 ? due.findIndex(r => r.itemId.endsWith(`.${skill}`)) : -1
    const review = dueIndex < 0 ? undefined : due.splice(dueIndex, 1)[0]
    if (review) reviewsUsed++
    const key = review?.itemId.split('.')[2] ?? (currentIndex < 0 ? SCALE_KEY_ORDER[(i + (options.seed >>> 0)) % SCALE_KEY_ORDER.length] : tonic)
    const degree = skill === 'locate' ? degrees[position++] : degrees[i === 3 ? 0 : 4]
    const difficulty = options.preference === 'auto' ? (SCALE_KEY_ORDER.indexOf(key) === 0 ? 1 : SCALE_KEY_ORDER.indexOf(key) < 5 ? 2 : 3) : options.preference
    const question = generate(`scale.practice.${skill}`, deriveSeed(options.seed, i), difficulty, review?.itemId ?? scaleItem(key, degree, skill))
    if (question.scale && i === 0 && history.length === 0) question.scale.intro = true
    return { kind: 'question', question, reason: review ? '到期複習' : `${question.scale!.tonic} 大調` }
  })
}
