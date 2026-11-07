import { displayNote, mod12, noteLabel, octaveOf, parseNote, pitchClass, PC_SHARP, sameSpelling, type SpelledNote } from '../music-theory/notes'
import type { ChoiceQuestion, ConstructQuestion, FretIdentifyQuestion, FretLocateQuestion, Grade, Question, Response, RhythmQuestion } from './types'
import { validatePlayedNote } from './playedAnswer'

const all = (q: Question, ok: boolean) => Object.fromEntries(q.reviewItemIds.map(id => [id, ok]))
const pcName = (pc: number) => {
  const sharp = PC_SHARP[mod12(pc)]
  return sharp.includes('#') ? `${displayNote(sharp)} / ${displayNote(['Db', 'Eb', 'Gb', 'Ab', 'Bb'][['C#', 'D#', 'F#', 'G#', 'A#'].indexOf(sharp)])}` : sharp
}
const midiName = (midi: number) => `${pcName(midi)}${octaveOf(midi)}`
const midiOn = (tuning: number[], string: number, fret: number) => tuning[6 - string] + fret
const positionText = (string: number, fret: number) => fret === 0 ? `第 ${string} 弦空弦` : `第 ${string} 弦第 ${fret} 格`

export function validate(question: Question, response: Response): Grade {
  if (response.kind === 'played-note') {
    if (question.kind !== 'fret-locate') throw new Error('這題需要音名或文字作答，不能用音高代替。')
    if (!Number.isInteger(response.midi) || response.midi < 40 || response.midi > 88) throw new Error('音高不在可用的吉他音域。')
    return validatePlayedNote(question, response)
  }
  if (question.kind !== response.kind) throw new Error(`Response kind ${response.kind} does not match ${question.kind}`)
  switch (question.kind) {
    case 'choice': return validateChoice(question, response as Extract<Response, { kind: 'choice' }>)
    case 'fret-identify': return validateIdentify(question, response as Extract<Response, { kind: 'fret-identify' }>)
    case 'fret-locate': return validateLocate(question, response as Extract<Response, { kind: 'fret-locate' }>)
    case 'construct': return validateConstruct(question, response as Extract<Response, { kind: 'construct' }>)
    case 'rhythm': return validateRhythm(question, response as Extract<Response, { kind: 'rhythm' }>)
  }
}

function validateChoice(q: ChoiceQuestion, r: { value: string }): Grade {
  const correct = r.value === q.answer || !!q.alsoAccepted?.includes(r.value)
  return {
    result: correct ? 'correct' : 'incorrect', itemResults: all(q, correct),
    errorClass: correct ? undefined : 'distractor',
    feedback: correct ? '答對了。' : q.distractorFeedback?.[r.value] ?? `你選了「${r.value}」，正確答案是「${q.answer}」。`,
    expectedText: q.answer, responseText: r.value,
  }
}

function validateIdentify(q: FretIdentifyQuestion, r: { value: string }): Grade {
  const chosen = pitchClass(parseNote(r.value))
  const correct = chosen === q.answerPc
  const diff = mod12(chosen - q.answerPc)
  let feedback = '答對了。'
  let errorClass: string | undefined
  if (!correct) {
    if (diff === 1 || diff === 11) {
      errorClass = 'off-by-one'
      feedback = `差一格：${displayNote(r.value)} 比答案${diff === 1 ? '高' : '低'}半音。${positionText(q.string, q.fret)}是 ${pcName(q.answerPc)}。`
    } else {
      errorClass = 'wrong-note'
      feedback = `${positionText(q.string, q.fret)}是 ${pcName(q.answerPc)}，不是 ${displayNote(r.value)}。`
    }
  }
  return { result: correct ? 'correct' : 'incorrect', itemResults: all(q, correct), errorClass, feedback,
    expectedText: pcName(q.answerPc), responseText: displayNote(r.value), correctPositions: [{ string: q.string, fret: q.fret }] }
}

export function locateTargets(q: FretLocateQuestion): { string: number; fret: number }[] {
  const result: { string: number; fret: number }[] = []
  for (let string = 1; string <= 6; string++) {
    if (q.string !== undefined && q.string !== string) continue
    for (let fret = q.minFret; fret <= q.maxFret; fret++) {
      if (q.allowedPositions && !q.allowedPositions.some(p => p.string === string && p.fret === fret)) continue
      const midi = midiOn(q.tuning, string, fret)
      if (q.targetMidi !== undefined ? midi === q.targetMidi : mod12(midi) === q.targetPc) result.push({ string, fret })
    }
  }
  return result
}

function validateLocate(q: FretLocateQuestion, r: { string: number; fret: number }): Grade {
  const midi = midiOn(q.tuning, r.string, r.fret)
  const targets = locateTargets(q)
  const correct = targets.some(t => t.string === r.string && t.fret === r.fret)
  const responseText = `${positionText(r.string, r.fret)}（${midiName(midi)}）`
  const expectedText = targets.map(t => positionText(t.string, t.fret)).join('、')
  if (correct) return { result: 'correct', itemResults: all(q, true), feedback: `答對了：${responseText}。`, expectedText, responseText, correctPositions: targets }
  const pcOk = mod12(midi) === q.targetPc
  let errorClass = 'wrong-note'
  let feedback = `你點的是 ${responseText}。`
  const sameStringTarget = targets.find(t => t.string === r.string)
  const crossesGB = q.reference && Math.min(q.reference.string, r.string) <= 2 && Math.max(q.reference.string, r.string) >= 3
  if (pcOk && q.string !== undefined && r.string !== q.string) {
    errorClass = 'wrong-string'
    feedback = `音名對了，但這是第 ${r.string} 弦；題目要在第 ${q.string} 弦上找。`
  } else if (pcOk && q.targetMidi !== undefined) {
    errorClass = 'wrong-octave'
    feedback = `音名對了，但八度不同：你點的是 ${midiName(midi)}，要找 ${midiName(q.targetMidi)}。`
  } else if (sameStringTarget && Math.abs(sameStringTarget.fret - r.fret) === 1) {
    errorClass = crossesGB ? 'gb-offset' : 'off-by-one'
    feedback = crossesGB
      ? `差一格。跨過第 3 弦（G）到第 2 弦（B）時，因為這兩條弦相差大三度（其他相鄰弦是完全四度），形狀要往${sameStringTarget.fret > r.fret ? '高' : '低'}把位移一格。`
      : `差一格：你點的是 ${responseText}，正確位置在${positionText(sameStringTarget.string, sameStringTarget.fret)}。`
  }
  if (q.interval) feedback = errorClass === 'wrong-string' ? '音名對了，請在標示的目標弦作答。' : errorClass === 'wrong-octave' ? `八度不同：你選的是 ${midiName(midi)}。` : `你選的是 ${midiName(midi)}${errorClass === 'off-by-one' || errorClass === 'gb-offset' ? '，差一格' : ''}。`
  return { result: 'incorrect', itemResults: all(q, false), errorClass, feedback, expectedText, responseText, correctPositions: targets }
}

function validateConstruct(q: ConstructQuestion, r: { notes: string[] }): Grade {
  const expected = q.expected.map(parseNote)
  let given: SpelledNote[]
  try { given = r.notes.map(parseNote) } catch { given = [] }
  const pcsOf = (notes: SpelledNote[]) => notes.map(pitchClass)
  const pitchOk = given.length === expected.length && (q.ordered
    ? pcsOf(given).every((pc, i) => pc === pitchClass(expected[i]))
    : [...pcsOf(given)].sort().join() === [...pcsOf(expected)].sort().join())
  const spellingOk = pitchOk && (q.ordered
    ? given.every((n, i) => sameSpelling(n, expected[i]))
    : expected.every(e => given.some(n => sameSpelling(n, e))))
  const itemResults: Record<string, boolean> = {}
  for (const id of q.reviewItemIds) if (id !== q.spellingItemId) itemResults[id] = q.interval ? spellingOk : pitchOk
  if (pitchOk) itemResults[q.spellingItemId] = spellingOk
  const expectedText = expected.map(noteLabel).join(' ')
  const responseText = given.map(noteLabel).join(' ') || '（未作答）'
  if (pitchOk && spellingOk) return { result: 'correct', itemResults, feedback: '答對了，拼法也正確。', expectedText, responseText }
  if (pitchOk) {
    const wrong = given.filter(n => !expected.some(e => sameSpelling(n, e)))
    const fixes = wrong.map(n => `${noteLabel(n)} → ${noteLabel(expected.find(e => pitchClass(e) === pitchClass(n))!)}`).join('、')
    return { result: 'partial', itemResults, errorClass: 'spelling',
      feedback: `音高正確，但拼法不對：${fixes}。${q.interval ? '音程的度數決定字母，不能只用同音異名替代。' : '和弦與音階裡每個字母依序各用一次，所以要用這個字母來寫。'}`, expectedText, responseText }
  }
  let errorClass = 'wrong-notes'
  let feedback = `正確答案是 ${expectedText}。`
  if (expected.length === 1 && given.length === 1) {
    const [e] = expected
    const [g] = given
    if (e.letter === g.letter) {
      errorClass = 'quality'
      feedback = `字母對了（${e.letter}），但差了半音：注意音程性質（大、小、完全、增、減）。正確答案是 ${noteLabel(e)}。`
    } else {
      errorClass = 'generic-size'
      feedback = `字母不對：音程的度數要從根音開始數字母（根音算第 1 個）。正確答案是 ${noteLabel(e)}。`
    }
  } else {
    const missing = expected.filter(e => !given.some(n => pitchClass(n) === pitchClass(e)))
    const extra = given.filter(n => !expected.some(e => pitchClass(n) === pitchClass(e)))
    feedback = [missing.length ? `少了 ${missing.map(noteLabel).join('、')}` : '', extra.length ? `多了 ${extra.map(noteLabel).join('、')}` : '', `正確答案是 ${expectedText}。`].filter(Boolean).join('；')
  }
  return { result: 'incorrect', itemResults, errorClass, feedback, expectedText, responseText }
}

export interface RhythmAnalysis { hits: number; expected: number; extras: number; strokeErrors: number; meanErrorMs: number; onTime: number }

export const RHYTHM_WINDOW_MS = 120
export const RHYTHM_ON_TIME_MS = 60

export function analyzeRhythm(q: RhythmQuestion, taps: { t: number; stroke: 'D' | 'U' }[], offsetMs: number): RhythmAnalysis {
  const slotMs = 60000 / q.bpm / 2
  const expected = [...q.pattern].flatMap((symbol, slot) => symbol === '.' ? [] : [{ at: slot * slotMs, stroke: symbol as 'D' | 'U' }])
  const adjusted = taps.map(tap => ({ t: tap.t - offsetMs, stroke: tap.stroke, used: false }))
  let hits = 0, strokeErrors = 0, onTime = 0
  const errors: number[] = []
  for (const e of expected) {
    let best: (typeof adjusted)[number] | undefined
    for (const tap of adjusted) if (!tap.used && Math.abs(tap.t - e.at) <= RHYTHM_WINDOW_MS && (!best || Math.abs(tap.t - e.at) < Math.abs(best.t - e.at))) best = tap
    if (!best) continue
    best.used = true
    errors.push(best.t - e.at)
    if (q.strokes && best.stroke !== e.stroke) { strokeErrors++; continue }
    hits++
    if (Math.abs(best.t - e.at) <= RHYTHM_ON_TIME_MS) onTime++
  }
  const meanErrorMs = errors.length ? Math.round(errors.reduce((a, b) => a + b, 0) / errors.length) : 0
  return { hits, expected: expected.length, extras: adjusted.filter(t => !t.used).length, strokeErrors, meanErrorMs, onTime }
}

function validateRhythm(q: RhythmQuestion, r: { taps: { t: number; stroke: 'D' | 'U' }[]; offsetMs: number }): Grade {
  const a = analyzeRhythm(q, r.taps, r.offsetMs)
  const correct = a.expected > 0 && a.hits / a.expected >= 0.8 && a.extras <= 1
  const parts = [`${a.hits}/${a.expected} 下落在節拍窗口內（±${RHYTHM_WINDOW_MS} ms）`]
  let errorClass: string | undefined
  if (a.strokeErrors) { errorClass = 'stroke-direction'; parts.push(`${a.strokeErrors} 下方向不對：正拍用下撥（D），反拍「&」用上撥（U），手像鐘擺一樣持續擺動`) }
  else if (a.hits < a.expected) { errorClass = 'missing'; parts.push(`漏掉 ${a.expected - a.hits} 下`) }
  if (a.extras > 1) { errorClass = errorClass ?? 'extra'; parts.push(`多按了 ${a.extras} 下`) }
  if (Math.abs(a.meanErrorMs) > RHYTHM_ON_TIME_MS) { errorClass = errorClass ?? (a.meanErrorMs < 0 ? 'early' : 'late'); parts.push(`整體偏${a.meanErrorMs < 0 ? '早' : '晚'}約 ${Math.abs(a.meanErrorMs)} ms`) }
  parts.push('手機的觸控計時只是近似值。')
  return { result: correct ? 'correct' : 'incorrect', itemResults: all(q, correct), errorClass: correct ? undefined : errorClass,
    feedback: `${correct ? '穩定！' : '再試一次。'}${parts.join('；')}。`, expectedText: q.pattern, responseText: `${r.taps.length} 下` }
}
