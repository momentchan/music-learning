/** Exercise contract (spec §5). Questions are plain serializable data; validation never reads UI state. */

export type EvidenceLevel = 'recognize' | 'recall' | 'locate' | 'apply'
export type ResultKind = 'correct' | 'incorrect' | 'partial'
export type Difficulty = 1 | 2 | 3
export type Stroke = 'D' | 'U'

export interface SoundEvent { notes: number[]; duration: number }

interface QuestionBase {
  id: string
  templateId: string
  generatorVersion: number
  seed: number
  nodeId: string
  difficulty: Difficulty
  evidenceLevel: EvidenceLevel
  prompt: string
  /** Review items this question gives evidence for. */
  reviewItemIds: string[]
  /** Explanation shown after answering (what is true and why). */
  explanation: string
  /** Optional visual context. */
  display?: {
    shapeId?: string
    /** Positions to show on a fretboard: [string, fret, label] */
    positions?: [number, number, string][]
    /** Chord / note text shown prominently. */
    text?: string
    /** Strum or rhythm pattern string, e.g. "D.DU.UDU" */
    pattern?: string
  }
  /** Audio needed to answer (ear training). Questions with audio are skipped when sound is off. */
  audio?: SoundEvent[]
  /** Optional sound to illustrate the answer afterwards. */
  answerAudio?: SoundEvent[]
}

export interface ChoiceQuestion extends QuestionBase {
  kind: 'choice'
  choices: string[]
  answer: string
  /** Specific contrast feedback for plausible wrong choices. */
  distractorFeedback?: Record<string, string>
  /** Additional accepted answers (ambiguous analysis). */
  alsoAccepted?: string[]
}

export interface FretIdentifyQuestion extends QuestionBase {
  kind: 'fret-identify'
  tuning: number[]
  string: number
  fret: number
  answerPc: number
}

export interface FretLocateQuestion extends QuestionBase {
  allowedPositions?: { string: number; fret: number }[]
  kind: 'fret-locate'
  tuning: number[]
  targetPc: number
  targetLabel: string
  /** Required string (1–6); undefined = any string. */
  string?: number
  /** Required exact pitch (for octave / interval-shape questions). */
  targetMidi?: number
  minFret: number
  maxFret: number
  /** Reference position shown to the learner (e.g. the root of an interval shape). */
  reference?: { string: number; fret: number; label: string }
}

export interface ConstructQuestion extends QuestionBase {
  kind: 'construct'
  /** Expected spelled notes (ASCII ids such as "F#", "Bb"), in order. */
  expected: string[]
  /** Notes already given to the learner (shown, not entered). */
  given: string[]
  /** Order matters (scales) or not (chord tones). */
  ordered: boolean
  /** Review item that tracks spelling separately from pitch. */
  spellingItemId: string
}

export interface RhythmQuestion extends QuestionBase {
  kind: 'rhythm'
  bpm: number
  /** 8 eighth-note slots in one 4/4 bar: "D", "U" or "." (rest). */
  pattern: string
  /** Whether the learner taps D/U buttons (strum) or a single pad (pulse). */
  strokes: boolean
}

export type Question = ChoiceQuestion | FretIdentifyQuestion | FretLocateQuestion | ConstructQuestion | RhythmQuestion

export type Response =
  | { kind: 'played-note'; midi: number; hz?: number; cents?: number; confidence?: number }
  | { kind: 'choice'; value: string }
  | { kind: 'fret-identify'; value: string }
  | { kind: 'fret-locate'; string: number; fret: number; inputMethod?: 'tap' | 'keyboard' }
  | { kind: 'construct'; notes: string[] }
  | { kind: 'rhythm'; taps: { t: number; stroke: Stroke }[]; offsetMs: number }

export interface Grade {
  verificationScope?: 'pitchClass' | 'exactPitch' | 'screenPosition' | 'noteNaming'
  result: ResultKind
  /** Per review item: was it demonstrated correctly? */
  itemResults: Record<string, boolean>
  errorClass?: string
  /** Short zh-TW feedback that explains what the learner's answer actually was. */
  feedback: string
  expectedText: string
  responseText: string
  /** Positions to highlight in feedback (correct answer). */
  correctPositions?: { string: number; fret: number }[]
}

export interface GenerateOptions { difficulty: Difficulty; itemId?: string }

export interface ExerciseTemplate {
  supportedInputs?: readonly ('tap' | 'keyboard' | 'microphone')[]
  id: string
  nodeId: string
  kind: Question['kind']
  version: number
  evidenceLevel: EvidenceLevel
  /** Lesson stage this template serves. */
  stage: 'recall' | 'locate' | 'hear' | 'apply'
  title: string
  requiresAudio?: boolean
  /** Every review item this template can generate. */
  items: () => string[]
  generate: (seed: number, options: GenerateOptions) => Question
}
