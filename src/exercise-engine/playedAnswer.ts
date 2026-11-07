import type { FretLocateQuestion, Grade, Response } from './types'
import { mod12, PC_SHARP } from '../music-theory/notes'

/** Ask for retrieval, keeping the exact pitch internal and target positions hidden. */
export function playedQuestion(question: FretLocateQuestion): FretLocateQuestion {
  const display = question.display ? { ...question.display, positions: question.allowedPositions ? question.display.positions : undefined } : undefined
  if (question.targetMidi !== undefined || question.string === undefined) {
    const prompt = question.prompt.replace('點出', '找出').replace(/[。？?]$/, '')
    return { ...question, display, prompt: prompt.endsWith('彈出來') ? prompt : `${prompt}，並彈出來` }
  }
  const open = question.tuning[6 - question.string]
  for (let fret = question.minFret; fret <= question.maxFret; fret++) {
    const midi = open + fret
    if (mod12(midi) !== question.targetPc) continue
    const name = `${PC_SHARP[mod12(midi)].replace('#', '♯')}${Math.floor(midi / 12) - 1}`
    return { ...question, display, targetMidi: midi, prompt: `找出 ${name}，並彈出來` }
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
    feedback: correct ? '音高正確。請確認使用了指定的弦與把位。' : `聽到 ${name(response.midi)}，目標是 ${question.targetMidi === undefined ? question.targetLabel : name(question.targetMidi)}，請再試一次。`,
    expectedText: question.targetMidi === undefined ? question.targetLabel : name(question.targetMidi),
    responseText: name(response.midi),
  }
}
