import { playedQuestion } from '../../exercise-engine/playedAnswer'
import { PracticeBoard } from '../../components/fretboard/PracticeBoard'
import { ChordDiagram } from '../../components/diagram/ChordDiagram'
import type { FretMark } from '../../components/fretboard/Fretboard'
import { NotePicker, PitchPicker } from '../../components/NotePicker'
import { Calibration, PatternGrid, RhythmPad } from '../../components/rhythm/RhythmPad'
import { locateTargets } from '../../exercise-engine/validate'
import type { Grade, Question, Response } from '../../exercise-engine/types'
import { shapeById } from '../../music-theory/guitar'
import { displayNote } from '../../music-theory/notes'
import { audioIsOn, useAudioUi } from '../../stores/audioUi'
import { useLearning } from '../../stores/learning'

interface Props {
  question: Question
  grade: Grade | null
  response: Response | null
  onSubmit: (response: Response) => void
  hinted: boolean
  onHint: () => void
  inputMode: 'tap' | 'play'
}

/** Renders one question and captures a real response. Validation happens in the runner against the stored question. */
export function QuestionView({ question, grade, response, onSubmit, inputMode, hinted, onHint }: Props) {
  const answered = grade !== null
  const play = useAudioUi(s => s.play)
  const leftHanded = useLearning(s => s.preferences.leftHanded)
  const answerInput = inputMode
  const byEar = answerInput === 'play' && question.kind === 'fret-locate'

  const audioButton = question.audio && <div className="question-audio">
    <button type="button" className="primary-button" onClick={() => void play(question.audio!)}>{answered ? '↻ 再聽一次' : '▶ 播放題目'}</button>
    {!audioIsOn() && <small className="helper">這題需要聲音。請開啟聲音，或按「跳過」（不會扣分）。</small>}
  </div>

  if (byEar && question.kind === 'fret-locate') question = playedQuestion(question)
  const display = question.display
  const shape = display?.shapeId ? shapeById(display.shapeId) : undefined

  if (question.kind === 'choice') {
    const chosen = response?.kind === 'choice' ? response.value : null
    const accepted = (c: string) => c === question.answer || question.alsoAccepted?.includes(c)
    return <div className="question">
      <h2 className="question-prompt">{question.prompt}</h2>
      {audioButton}
      {shape && <div className="question-visual"><ChordDiagram leftHanded={leftHanded} shape={shape} size={170} showName={false}/></div>}
      {display?.positions && <div className="question-visual board"><PracticeBoard focusFret={display.positions[0]?.[1]} leftHanded={leftHanded} tuning={[40, 45, 50, 55, 59, 64]} label="題目位置"
        marks={display.positions.map(([string, fret, label], i) => ({ string, fret, label: answered && question.interval && i === 1 ? displayNote(question.interval.target) : label, tone: label === 'R' || (!!question.interval && i === 0) ? 'root' : 'target' }))}/></div>}
      {display?.pattern && <PatternGrid pattern={display.pattern}/>}
      <div className="choice-grid" role="group" aria-label="選項">
        {question.choices.map(choice => <button type="button" key={choice} disabled={answered || (!!question.audio && !audioIsOn())}
          className={answered ? accepted(choice) ? 'correct' : choice === chosen ? 'wrong' : '' : ''}
          aria-pressed={choice === chosen} onClick={() => onSubmit({ kind: 'choice', value: choice })}>
          {answered && accepted(choice) && <span aria-hidden="true">✓ </span>}{answered && choice === chosen && !accepted(choice) && <span aria-hidden="true">✕ </span>}{choice}
        </button>)}
      </div>
    </div>
  }

  if (question.kind === 'fret-identify') {
    const marks: FretMark[] = [{ string: question.string, fret: question.fret, label: answered ? displayNote(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][question.answerPc]) : '?', tone: answered ? (grade!.result === 'correct' ? 'correct' : 'target') : 'target' }]
    return <div className="question">
      <h2 className="question-prompt">這是什麼音？</h2>
      <div className="question-visual board"><PracticeBoard focusFret={question.fret} highlightedString={question.string} leftHanded={leftHanded} tuning={question.tuning} marks={marks} label={`指板，題目位置：第 ${question.string} 弦 ${question.fret === 0 ? '空弦' : `第 ${question.fret} 格`}`}/></div>
      <PitchPicker disabled={answered} onPick={value => onSubmit({ kind: 'fret-identify', value })}/>
      {answered && response?.kind === 'fret-identify' && <p className="helper">你的答案：{displayNote(response.value)}</p>}
    </div>
  }

  if (question.kind === 'fret-locate') {
    const marks: FretMark[] = []
    if (question.reference) marks.push({ string: question.reference.string, fret: question.reference.fret, label: question.reference.label, tone: 'reference' })
    if (!answered && question.allowedPositions && question.display?.positions) marks.push(...question.display.positions.map(([string, fret, label]) => ({ string, fret, label, tone: 'neutral' as const })))
    if (!answered && hinted) for (const p of locateTargets(question)) marks.push({ ...p, label: question.targetLabel.split(' ')[0], tone: 'target' })
    if (answered) {
      for (const p of grade!.correctPositions ?? locateTargets(question)) marks.push({ string: p.string, fret: p.fret, label: question.targetLabel.split(' ')[0], tone: 'correct' })
      if (response?.kind === 'fret-locate' && grade!.result !== 'correct') marks.push({ string: response.string, fret: response.fret, label: '✕', tone: 'wrong' })
    }
    return <div className="question playing">
      <h2 className="question-prompt">{question.prompt}</h2>
      <PracticeBoard fullNeck={byEar} focusFret={hinted || answered ? (grade?.correctPositions ?? locateTargets(question))[0]?.fret : question.reference?.fret} highlightedString={question.string} leftHanded={leftHanded} tuning={question.tuning} minFret={question.minFret} maxFret={question.maxFret}
        marks={marks} onSelect={byEar ? undefined : (string, fret, inputMethod) => { if (!answered) onSubmit({ kind: 'fret-locate', string, fret, inputMethod }) }} disabled={answered || byEar}
        label={byEar ? `目標第 ${question.string ?? '任意'} 弦，找出指定音並彈奏，作答前不顯示答案位置` : '可點選的指板，上方第 1 弦、下方第 6 弦，點一下送出'}/>
      {!answered && <button type="button" className="text-button" disabled={hinted} onClick={onHint}>{hinted ? '已顯示提示' : '提示位置'}</button>}

    </div>
  }

  if (question.kind === 'construct') {
    return <div className="question">
      <h2 className="question-prompt">{question.prompt}</h2>
      {question.given.length > 1 && <p className="given-notes">{question.given.map(n => n === '_' ? '＿' : displayNote(n)).join('  ')}</p>}
      {answered && response?.kind === 'construct'
        ? <p className="helper">你的答案：{response.notes.map(displayNote).join(' ')}</p>
        : <NotePicker autoSubmitSingle={question.templateId === 'interval.shapes.name'} key={question.id} slots={question.expected.length} onSubmit={notes => onSubmit({ kind: 'construct', notes })}/>}
    </div>
  }

  return <RhythmQuestionView question={question} answered={answered} onSubmit={onSubmit}/>
}

function RhythmQuestionView({ question, answered, onSubmit }: { question: Extract<Question, { kind: 'rhythm' }>; answered: boolean; onSubmit: (r: Response) => void }) {
  const { preferences, savePreferences } = useLearning()
  if (preferences.latencyOffsetMs === null) {
    return <div className="question">
      <h2 className="question-prompt">先校準節奏延遲</h2>
      <p className="helper">每支手機、喇叭或藍牙耳機的延遲都不同。校準一次（約 10 秒），之後節奏題會扣掉這個時間差。</p>
      <Calibration onDone={offset => void savePreferences({ latencyOffsetMs: offset })}/>
    </div>
  }
  return <div className="question">
    <h2 className="question-prompt">{question.prompt}</h2>
    {answered ? <PatternGrid pattern={question.pattern}/> : <RhythmPad key={question.id} pattern={question.pattern} bpm={question.bpm} strokes={question.strokes}
      onComplete={taps => onSubmit({ kind: 'rhythm', taps, offsetMs: preferences.latencyOffsetMs ?? 0 })}/>}
  </div>
}
