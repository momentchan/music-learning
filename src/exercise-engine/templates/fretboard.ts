import { createRng, int, pick, shuffle } from '../../lib/rng'
import { STANDARD, midiAt, positionsOfPc, type StringNumber } from '../../music-theory/guitar'
import { intervalLabel } from '../../music-theory/intervals'
import { mod12, octaveOf, PC_SHARP } from '../../music-theory/notes'
import type { ChoiceQuestion, ExerciseTemplate, FretIdentifyQuestion, FretLocateQuestion } from '../types'
import { itemParts, pcLabel, positionText, questionBase } from './common'

const TUNING = [...STANDARD.midi]
const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11]
const ACCIDENTAL_PCS = [1, 3, 6, 8, 10]
export const fretItem = (pc: number, string: number) => `fret.note.${PC_SHARP[mod12(pc)]}.s${string}`

function parseFretItem(itemId?: string): { pc: number; string: StringNumber } | null {
  const parts = itemParts(itemId, 'fret.note.')
  if (!parts) return null
  return { pc: PC_SHARP.indexOf(parts[0] as (typeof PC_SHARP)[number]), string: Number(parts[1].slice(1)) as StringNumber }
}

/** Note identification and location on a set of strings (spec §7.1 recall). */
function noteTemplates(nodeId: string, strings: StringNumber[], pcs: number[]): ExerciseTemplate[] {
  const items = () => strings.flatMap(s => pcs.map(pc => fretItem(pc, s)))
  const choose = (seed: number, itemId?: string) => {
    const rng = createRng(seed)
    const parsed = parseFretItem(itemId)
    const string = parsed && strings.includes(parsed.string) ? parsed.string : pick(rng, strings)
    const pc = parsed && pcs.includes(parsed.pc) ? parsed.pc : pick(rng, pcs)
    return { rng, string, pc }
  }
  const identify: ExerciseTemplate = {
    id: `${nodeId}.identify`, nodeId, kind: 'fret-identify', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '說出音名', items,
    generate(seed, { difficulty, itemId }) {
      const { rng, string, pc } = choose(seed, itemId)
      const frets = positionsOfPc(STANDARD, pc, 0, 12, [string]).map(p => p.fret)
      const fret = difficulty === 1 && frets.some(f => f <= 7) ? frets.find(f => f <= 7)! : pick(rng, frets)
      const q: FretIdentifyQuestion = {
        ...questionBase(this, seed, difficulty), kind: 'fret-identify', tuning: TUNING, string, fret, answerPc: pc,
        prompt: `${positionText(string, fret)}是什麼音？`, reviewItemIds: [fretItem(pc, string)],
        explanation: `${positionText(string, fret)} = ${pcLabel(pc)}。從空弦 ${pcLabel(TUNING[6 - string])} 往上數 ${fret} 個半音（每格一個半音；E–F、B–C 之間只差一格）。`,
        display: { positions: [[string, fret, '?']] },
        answerAudio: [{ notes: [midiAt(STANDARD, string, fret)], duration: 0.8 }],
      }
      return q
    },
  }
  const locate: ExerciseTemplate = {
    id: `${nodeId}.locate`, nodeId, kind: 'fret-locate', version: 1, evidenceLevel: 'locate', stage: 'locate', title: '在指板上找音', items,
    generate(seed, { difficulty, itemId }) {
      const { string, pc } = choose(seed, itemId)
      const frets = positionsOfPc(STANDARD, pc, 0, 12, [string]).map(p => p.fret)
      const q: FretLocateQuestion = {
        ...questionBase(this, seed, difficulty), kind: 'fret-locate', tuning: TUNING, targetPc: pc, targetLabel: pcLabel(pc), string, minFret: 0, maxFret: 12,
        prompt: `在第 ${string} 弦上找出 ${pcLabel(pc)}`, reviewItemIds: [fretItem(pc, string)],
        explanation: `第 ${string} 弦的 ${pcLabel(pc)} 在第 ${frets.join('、')} 格${frets.length > 1 ? '（第 12 格是空弦高八度）' : ''}。`,
      }
      return q
    },
  }
  return [identify, locate]
}

export const fretNaturalsLow = noteTemplates('fret.naturals.low', [6, 5], NATURAL_PCS)
export const fretNaturalsAll = noteTemplates('fret.naturals.all', [6, 5, 4, 3, 2, 1], NATURAL_PCS)
export const fretAccidentals = noteTemplates('fret.accidentals', [6, 5, 4, 3, 2, 1], ACCIDENTAL_PCS)

// ---- Open strings -----------------------------------------------------------------
const OPEN_NAMES = ['', 'E', 'B', 'G', 'D', 'A', 'E']
export const fretOpen: ExerciseTemplate[] = [
  {
    id: 'fret.open.identify', nodeId: 'fret.open', kind: 'fret-identify', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '空弦音名',
    items: () => [1, 2, 3, 4, 5, 6].map(s => `fret.open.s${s}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const fromItem = itemParts(itemId, 'fret.open.')
      const string = (fromItem ? Number(fromItem[0].slice(1)) : int(rng, 1, 6)) as StringNumber
      const pc = mod12(TUNING[6 - string])
      return {
        ...questionBase(this, seed, difficulty), kind: 'fret-identify', tuning: TUNING, string, fret: 0, answerPc: pc,
        prompt: `第 ${string} 弦空弦是什麼音？`, reviewItemIds: [`fret.open.s${string}`],
        explanation: `標準調音由粗到細（第 6 → 1 弦）是 E A D G B E。可以記成「E-A-D-G-B-E」或「Eddie Ate Dynamite, Good Bye Eddie」。第 ${string} 弦是 ${OPEN_NAMES[string]}。`,
        display: { positions: [[string, 0, '?']] },
        answerAudio: [{ notes: [TUNING[6 - string]], duration: 1 }],
      } satisfies FretIdentifyQuestion
    },
  },
  {
    id: 'fret.open.locate', nodeId: 'fret.open', kind: 'fret-locate', version: 1, evidenceLevel: 'locate', stage: 'locate', title: '找出空弦',
    items: () => [1, 2, 3, 4, 5, 6].map(s => `fret.open.s${s}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const fromItem = itemParts(itemId, 'fret.open.')
      const string = (fromItem ? Number(fromItem[0].slice(1)) : int(rng, 1, 6)) as StringNumber
      const pc = mod12(TUNING[6 - string])
      const strings = [1, 2, 3, 4, 5, 6].filter(s => mod12(TUNING[6 - s]) === pc)
      return {
        ...questionBase(this, seed, difficulty), kind: 'fret-locate', tuning: TUNING, targetPc: pc, targetLabel: OPEN_NAMES[string], minFret: 0, maxFret: 0,
        prompt: `點出空弦是 ${OPEN_NAMES[string]} 的弦${strings.length > 1 ? '（任一條）' : ''}`, reviewItemIds: strings.map(s => `fret.open.s${s}`),
        explanation: `${OPEN_NAMES[string]} 是第 ${strings.join('、')} 弦的空弦音。標準調音：第 6 弦 E、5 A、4 D、3 G、2 B、1 E。`,
      } satisfies FretLocateQuestion
    },
  },
]

// ---- Octave shapes -----------------------------------------------------------------
const OCTAVE_PAIRS: { from: StringNumber; to: StringNumber; shift: number }[] = [
  { from: 6, to: 4, shift: 2 }, { from: 5, to: 3, shift: 2 }, { from: 4, to: 2, shift: 3 }, { from: 3, to: 1, shift: 3 },
]
const octaveItem = (p: { from: number; to: number }) => `fret.octave.s${p.from}-s${p.to}`
const pickPair = (rng: () => number, itemId?: string) => OCTAVE_PAIRS.find(p => octaveItem(p) === itemId) ?? pick(rng, OCTAVE_PAIRS)

export const fretOctaves: ExerciseTemplate[] = [
  {
    id: 'fret.octaves.locate', nodeId: 'fret.octaves', kind: 'fret-locate', version: 1, evidenceLevel: 'locate', stage: 'locate', title: '找八度',
    items: () => OCTAVE_PAIRS.map(octaveItem),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const pair = pickPair(rng, itemId)
      const fret = int(rng, difficulty === 1 ? 1 : 0, 12 - pair.shift)
      const midi = midiAt(STANDARD, pair.from, fret)
      return {
        ...questionBase(this, seed, difficulty), kind: 'fret-locate', tuning: TUNING, targetPc: mod12(midi), targetLabel: pcLabel(midi), string: pair.to,
        targetMidi: midi + 12, minFret: 0, maxFret: 12, reference: { string: pair.from, fret, label: 'R' },
        prompt: `${positionText(pair.from, fret)}是 ${pcLabel(midi)}${octaveOf(midi)}。在第 ${pair.to} 弦找出高一個八度的 ${pcLabel(midi)}。`,
        reviewItemIds: [octaveItem(pair)],
        explanation: `第 ${pair.from} 弦 → 第 ${pair.to} 弦的八度：往高把位移 ${pair.shift} 格（第 ${fret + pair.shift} 格）。${pair.shift === 3 ? '因為跨過了 G–B 弦（只差大三度），要比一般的 2 格多移 1 格。' : ''}`,
        display: { positions: [[pair.from, fret, 'R']] },
      } satisfies FretLocateQuestion
    },
  },
  {
    id: 'fret.octaves.shape', nodeId: 'fret.octaves', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '八度形狀',
    items: () => OCTAVE_PAIRS.map(octaveItem),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const pair = pickPair(rng, itemId)
      const choices = shuffle(rng, ['往高把位 2 格', '往高把位 3 格', '同一格', '往低把位 2 格'])
      const answer = `往高把位 ${pair.shift} 格`
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer,
        prompt: `從第 ${pair.from} 弦往上跳兩條弦到第 ${pair.to} 弦找同一個音的高八度，要怎麼移？`,
        reviewItemIds: [octaveItem(pair)],
        distractorFeedback: (pair.shift === 3 ? { '往高把位 2 格': '一般是 2 格，但這組弦跨過了 G–B 弦（相差大三度而非完全四度），所以要多移 1 格。' } : { '往高把位 3 格': '這組弦沒有跨過 G–B 弦，所以只要 2 格。' }) as Record<string, string>,
        explanation: `第 ${pair.from} → ${pair.to} 弦：+${pair.shift} 格。規則：隔一條弦的八度通常 +2 格；只要跨過第 3 弦到第 2 弦，就 +3 格。`,
      } satisfies ChoiceQuestion
    },
  },
]

// ---- Interval shapes on adjacent strings ----------------------------------------------
const SHAPE_INTERVALS = [{ name: 'M3', semis: 4 }, { name: 'm3', semis: 3 }, { name: 'P4', semis: 5 }, { name: 'P5', semis: 7 }, { name: 'M2', semis: 2 }]
const shapeItem = (name: string, gb: boolean) => `interval.shape.${name}.${gb ? 'gb' : 'std'}`

function intervalShape(rng: () => number, difficulty: number, itemId?: string) {
  const parts = itemParts(itemId, 'interval.shape.')
  const interval = SHAPE_INTERVALS.find(i => i.name === parts?.[0]) ?? pick(rng, difficulty === 1 ? SHAPE_INTERVALS.slice(0, 4) : SHAPE_INTERVALS)
  const wantGb = parts ? parts[1] === 'gb' : difficulty >= 2 && rng() < 0.4
  const from = (wantGb ? 3 : pick(rng, [6, 5, 4])) as StringNumber
  const to = (from - 1) as StringNumber
  const gap = TUNING[6 - to] - TUNING[6 - from]
  const offset = interval.semis - gap
  const fret = int(rng, Math.max(1, -offset), Math.min(10, 12 - offset))
  return { interval, from, to, fret, targetFret: fret + offset, gb: from === 3 }
}

export const intervalShapes: ExerciseTemplate[] = [
  {
    id: 'interval.shapes.locate', nodeId: 'interval.shapes', kind: 'fret-locate', version: 1, evidenceLevel: 'locate', stage: 'locate', title: '在相鄰弦找音程',
    items: () => SHAPE_INTERVALS.flatMap(i => [shapeItem(i.name, false), shapeItem(i.name, true)]),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const s = intervalShape(rng, difficulty, itemId)
      const rootMidi = midiAt(STANDARD, s.from, s.fret)
      return {
        ...questionBase(this, seed, difficulty), kind: 'fret-locate', tuning: TUNING, targetPc: mod12(rootMidi + s.interval.semis), targetLabel: pcLabel(rootMidi + s.interval.semis),
        string: s.to, targetMidi: rootMidi + s.interval.semis, minFret: 0, maxFret: 12, reference: { string: s.from, fret: s.fret, label: 'R' },
        prompt: `根音在${positionText(s.from, s.fret)}（${pcLabel(rootMidi)}）。在第 ${s.to} 弦找出往上的${intervalLabel(s.interval.name)}。`,
        reviewItemIds: [shapeItem(s.interval.name, s.gb)],
        explanation: `${intervalLabel(s.interval.name)} = ${s.interval.semis} 個半音。第 ${s.to} 弦比第 ${s.from} 弦高 ${s.gb ? 4 : 5} 個半音，所以要在第 ${s.to} 弦第 ${s.targetFret} 格${s.gb ? '（G–B 弦之間的形狀比其他弦組往高把位多一格）' : ''}。`,
        display: { positions: [[s.from, s.fret, 'R']] },
      } satisfies FretLocateQuestion
    },
  },
  {
    id: 'interval.shapes.identify', nodeId: 'interval.shapes', kind: 'choice', version: 1, evidenceLevel: 'recognize', stage: 'recall', title: '認出音程形狀',
    items: () => SHAPE_INTERVALS.flatMap(i => [shapeItem(i.name, false), shapeItem(i.name, true)]),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const s = intervalShape(rng, difficulty, itemId)
      const names = SHAPE_INTERVALS.map(i => i.name)
      const choices = shuffle(rng, [s.interval.name, ...shuffle(rng, names.filter(n => n !== s.interval.name)).slice(0, 3)]).map(intervalLabel)
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer: intervalLabel(s.interval.name),
        prompt: `從${positionText(s.from, s.fret)}（R）到${positionText(s.to, s.targetFret)}，往上是什麼音程？`,
        reviewItemIds: [shapeItem(s.interval.name, s.gb)],
        display: { positions: [[s.from, s.fret, 'R'], [s.to, s.targetFret, '?']] },
        explanation: `相鄰弦${s.gb ? '（G–B 弦，相差 4 個半音）' : '（相差 5 個半音）'}：第 ${s.to} 弦第 ${s.targetFret} 格 = R + ${s.interval.semis} 個半音 = ${intervalLabel(s.interval.name)}。`,
      } satisfies ChoiceQuestion
    },
  },
]
