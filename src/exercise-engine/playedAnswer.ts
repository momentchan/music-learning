import type { FretLocateQuestion, Grade, Response } from './types'
import { mod12, PC_SHARP } from '../music-theory/notes'

/** Make an explicit played-position variant; its exact target is also stored in the attempt. */
export function playedQuestion(question: FretLocateQuestion): FretLocateQuestion {
  if (question.targetMidi !== undefined || question.string === undefined) return question
  const open = question.tuning[6 - question.string]
  for (let fret = question.minFret; fret <= question.maxFret; fret++) {
    const midi = open + fret
    if (mod12(midi) !== question.targetPc) continue
    return { ...question, targetMidi: midi, prompt: `照圖彈奏：第 ${question.string} 弦${fret === 0 ? '空弦' : `第 ${fret} 格`}（${question.targetLabel}${Math.floor(midi / 12) - 1}）`, display: { ...question.display, positions: [[question.string, fret, question.targetLabel]] } }
  }
  return question
}

/** Microphones observe pitch, never a string/fret position. */
export function responseFromPlayedNote(_question: unknown, midi: number): Response {
  return { kind: 'played-note', midi }
}

export function validatePlayedNote(question: FretLocateQuestion, response: Extract<Response, { kind: 'played-note' }>): Grade {
  const correct = question.targetMidi === undefined ? mod12(response.midi) === question.targetPc : response.midi === question.targetMidi
  const name = (midi: number) => `${PC_SHARP[mod12(midi)]}${Math.floor(midi / 12) - 1}`
  return {
    result: correct ? 'correct' : 'incorrect', itemResults: {},
    verificationScope: question.targetMidi === undefined ? 'pitchClass' : 'exactPitch',
    errorClass: correct ? undefined : mod12(response.midi) === question.targetPc ? 'wrong-octave' : 'wrong-note',
    feedback: correct ? '音高正確。請自行確認使用了圖上的弦與品格。' : `聽到 ${name(response.midi)}，目標是 ${question.targetMidi === undefined ? question.targetLabel : name(question.targetMidi)}，請再試一次。`,
    expectedText: question.targetMidi === undefined ? question.targetLabel : name(question.targetMidi),
    responseText: name(response.midi),
  }
}
