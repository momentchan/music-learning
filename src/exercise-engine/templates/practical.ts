import { createRng, int, pick, shuffle } from '../../lib/rng'
import { chordNotes, parseChordSymbol } from '../../music-theory/chords'
import { CORE_OPEN_SHAPES, STANDARD, mutedStrings, shapeById, shapeMidi, type ChordShape } from '../../music-theory/guitar'
import { mod12, noteLabel, pitchClass } from '../../music-theory/notes'
import type { ChoiceQuestion, Difficulty, ExerciseTemplate, RhythmQuestion } from '../types'
import { itemParts, pcLabel, positionText, questionBase } from './common'

// ---- Chord shapes ----------------------------------------------------------------------
const SHAPES_BY_LEVEL: Record<Difficulty, string[]> = {
  1: [...CORE_OPEN_SHAPES],
  2: [...CORE_OPEN_SHAPES, 'E7', 'A7', 'D7', 'G7'],
  3: [...CORE_OPEN_SHAPES, 'E7', 'A7', 'D7', 'G7', 'B7', 'C7', 'Cmaj7', 'Am7', 'Em7', 'Dm7', 'Fmaj7'],
}
const OPEN_SHAPE_IDS = SHAPES_BY_LEVEL[3]
const pickShape = (rng: () => number, difficulty: Difficulty, itemId?: string, prefix = 'chord.shape.') => {
  const fromItem = itemParts(itemId, prefix)?.[0]
  return shapeById(fromItem && OPEN_SHAPE_IDS.includes(fromItem) ? fromItem : pick(rng, SHAPES_BY_LEVEL[difficulty]))
}
const strumAudio = (shape: ChordShape) => [{ notes: shapeMidi(shape, STANDARD).map(n => n.midi), duration: 1.6 }]
const lowestNote = (shape: ChordShape) => shapeMidi(shape)[0]

export const chordOpen: ExerciseTemplate[] = [
  {
    id: 'chord.open.name', nodeId: 'chord.open', kind: 'choice', version: 1, evidenceLevel: 'recognize', stage: 'recall', title: '認出指型',
    items: () => OPEN_SHAPE_IDS.map(id => `chord.shape.${id}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const shape = pickShape(rng, difficulty, itemId)
      const pool = SHAPES_BY_LEVEL[Math.max(difficulty, shape.family === 'open' ? 1 : 2) as Difficulty].filter(id => id !== shape.id)
      const choices = shuffle(rng, [shape.symbol, ...shuffle(rng, pool).slice(0, 3).map(id => shapeById(id).symbol)])
      const bass = lowestNote(shape)
      const feedback = Object.fromEntries(choices.filter(c => c !== shape.symbol).map(c => [c,
        `先看最低的發聲弦：這個指型最低音是${positionText(bass.string, bass.fret)}的 ${pcLabel(bass.midi)}，也就是根音。${c} 的根音或和弦性質不同。`]))
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer: shape.symbol, distractorFeedback: feedback,
        prompt: '這個指型是什麼和弦？', reviewItemIds: [`chord.shape.${shape.id}`], display: { shapeId: shape.id },
        explanation: `${shape.name}：${chordNotes(parseChordSymbol(shape.symbol)).map(noteLabel).join(' ')}。最低的發聲音是根音 ${pcLabel(bass.midi)}（${positionText(bass.string, bass.fret)}）。`,
        answerAudio: strumAudio(shape),
      } satisfies ChoiceQuestion
    },
  },
  {
    id: 'chord.open.tones', nodeId: 'chord.open', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'apply', title: '指型裡的和弦音',
    items: () => OPEN_SHAPE_IDS.map(id => `chord.shape.${id}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const shape = pickShape(rng, difficulty, itemId)
      const chord = parseChordSymbol(shape.symbol)
      const notes = chordNotes(chord)
      const labels = ['根音 R', '三音 3', '五音 5', '七音 7']
      const sounding = shapeMidi(shape)
      const target = pick(rng, sounding)
      const index = notes.findIndex(n => pitchClass(n) === mod12(target.midi))
      const choices = labels.slice(0, Math.max(3, notes.length))
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer: labels[index],
        prompt: `${shape.symbol} 指型中，${positionText(target.string, target.fret)}是和弦的哪個音？`, reviewItemIds: [`chord.shape.${shape.id}`],
        display: { shapeId: shape.id },
        explanation: `${shape.symbol} = ${notes.map((n, i) => `${labels[i].split(' ')[1]}:${noteLabel(n)}`).join('、')}。${positionText(target.string, target.fret)}是 ${noteLabel(notes[index])}，所以是${labels[index]}。知道每根手指按的是哪個和弦音，是之後即興與換把的基礎。`,
        answerAudio: strumAudio(shape),
      } satisfies ChoiceQuestion
    },
  },
]

// ---- Reading chord diagrams ---------------------------------------------------------------
const FINGER_LABEL = ['', '1 食指', '2 中指', '3 無名指', '4 小指']
export const chordDiagram: ExerciseTemplate[] = [
  {
    id: 'chord.diagram.frets', nodeId: 'chord.diagram', kind: 'choice', version: 1, evidenceLevel: 'recognize', stage: 'recall', title: '讀格數與不彈的弦',
    items: () => ['chord.diagram.muted', 'chord.diagram.frets'],
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const shape = pickShape(rng, difficulty, undefined)
      const askMuted = itemId ? itemId === 'chord.diagram.muted' : rng() < 0.4
      if (askMuted) {
        const muted = mutedStrings(shape)
        const describe = (strings: number[]) => strings.length ? `第 ${strings.sort((a, b) => b - a).join('、')} 弦` : '每條弦都彈'
        const answer = describe(muted)
        const others = [[], [6], [6, 5], [1], [5]].map(describe).filter(option => option !== answer)
        return {
          ...questionBase(this, seed, difficulty), kind: 'choice', choices: shuffle(rng, [answer, ...shuffle(rng, others).slice(0, 3)]),
          answer, prompt: '這個圖上哪些弦不彈（×）？', reviewItemIds: ['chord.diagram.muted'], display: { shapeId: shape.id },
          explanation: `和弦圖上方的 × 表示不彈、○ 表示彈空弦。${shape.symbol}：不彈 ${answer === '每條弦都彈' ? '無' : answer}。`,
        } satisfies ChoiceQuestion
      }
      const fretted = shapeMidi(shape).filter(n => n.fret > 0)
      const target = pick(rng, fretted)
      const answer = `第 ${target.fret} 格`
      const choices = shuffle(rng, [answer, ...shuffle(rng, [1, 2, 3, 4].filter(f => f !== target.fret)).slice(0, 2).map(f => `第 ${f} 格`), '空弦'])
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer,
        prompt: `在這個圖上，第 ${target.string} 弦按在哪裡？`, reviewItemIds: ['chord.diagram.frets'], display: { shapeId: shape.id },
        explanation: `和弦圖是把吉他立起來、琴頭朝上看：最左邊是第 6 弦（最粗），最右邊是第 1 弦；最上方粗線是琴枕。${shape.symbol} 的第 ${target.string} 弦按在第 ${target.fret} 格。`,
      } satisfies ChoiceQuestion
    },
  },
  {
    id: 'chord.diagram.fingers', nodeId: 'chord.diagram', kind: 'choice', version: 1, evidenceLevel: 'recognize', stage: 'locate', title: '讀指法',
    items: () => ['chord.diagram.fingers'],
    generate(seed, { difficulty }) {
      const rng = createRng(seed)
      const shape = pickShape(rng, difficulty, undefined)
      const fretted = shape.fingers.flatMap((finger, i) => finger > 0 ? [{ string: 6 - i, finger, fret: shape.frets[i] }] : [])
      const target = pick(rng, fretted)
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices: FINGER_LABEL.slice(1), answer: FINGER_LABEL[target.finger],
        prompt: `${shape.symbol}：第 ${target.string} 弦第 ${target.fret} 格用哪根手指按？`, reviewItemIds: ['chord.diagram.fingers'], display: { shapeId: shape.id },
        explanation: `圓點裡的數字是左手指法：1 食指、2 中指、3 無名指、4 小指（大拇指在琴頸後面）。這裡是 ${FINGER_LABEL[target.finger]}。`,
      } satisfies ChoiceQuestion
    },
  },
]

// ---- Rhythm ---------------------------------------------------------------------------------
export const STRUM_PATTERNS: Record<string, { pattern: string; name: string; level: Difficulty }> = {
  quarters: { pattern: 'D.D.D.D.', name: '四分音符下撥', level: 1 },
  eighths: { pattern: 'DUDUDUDU', name: '八分音符上下撥', level: 1 },
  'down-up-end': { pattern: 'D.D.DUDU', name: 'D D DU DU', level: 2 },
  'folk': { pattern: 'D.DU.UDU', name: 'D DU UDU（民謠刷法）', level: 2 },
  'pop': { pattern: 'D.DUDUDU', name: 'D DUDUDU', level: 3 },
}
export const COUNTS = ['1', '&', '2', '&', '3', '&', '4', '&']

export const rhythmPulse: ExerciseTemplate[] = [
  {
    id: 'rhythm.pulse.tap', nodeId: 'rhythm.pulse', kind: 'rhythm', version: 1, evidenceLevel: 'apply', stage: 'apply', title: '跟著拍子點',
    items: () => ['rhythm.pattern.quarters', 'rhythm.pattern.eighths'],
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const id = itemId === 'rhythm.pattern.eighths' || (!itemId && difficulty > 1 && rng() < 0.6) ? 'eighths' : 'quarters'
      const bpm = [0, 60, 70, 80][difficulty]
      return {
        ...questionBase(this, seed, difficulty), kind: 'rhythm', bpm, pattern: STRUM_PATTERNS[id].pattern, strokes: false,
        prompt: `跟著節拍器，點出${id === 'quarters' ? '每一拍（1 2 3 4）' : '每個八分音符（1 & 2 & 3 & 4 &）'}`, reviewItemIds: [`rhythm.pattern.${id}`],
        display: { pattern: STRUM_PATTERNS[id].pattern },
        explanation: id === 'quarters' ? '四分音符：每拍一下，數「1 2 3 4」。' : '八分音符：每拍兩下，數「1 & 2 & 3 & 4 &」，「&」剛好在兩拍正中間。',
      } satisfies RhythmQuestion
    },
  },
  {
    id: 'rhythm.pulse.count', nodeId: 'rhythm.pulse', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '數拍子',
    items: () => ['rhythm.count'],
    generate(seed, { difficulty }) {
      const rng = createRng(seed)
      const slot = int(rng, 0, 7)
      const labels = ['1', '1 的 &', '2', '2 的 &', '3', '3 的 &', '4', '4 的 &']
      const choices = shuffle(rng, [labels[slot], ...shuffle(rng, labels.filter((_, i) => i !== slot)).slice(0, 3)])
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer: labels[slot],
        prompt: `把 4/4 拍一小節分成 8 個八分音符。第 ${slot + 1} 個八分音符要怎麼數？`, reviewItemIds: ['rhythm.count'],
        display: { pattern: COUNTS.map((_, i) => i === slot ? 'D' : '.').join('') },
        explanation: `數法是「1 & 2 & 3 & 4 &」。第 ${slot + 1} 個是「${labels[slot]}」：${slot % 2 === 0 ? '正拍（拍子開頭）' : '反拍（兩拍正中間）'}。`,
      } satisfies ChoiceQuestion
    },
  },
]

export const rhythmStrum: ExerciseTemplate[] = [
  {
    id: 'rhythm.strum.tap', nodeId: 'rhythm.strum', kind: 'rhythm', version: 1, evidenceLevel: 'apply', stage: 'apply', title: '刷法節奏',
    items: () => Object.keys(STRUM_PATTERNS).map(id => `rhythm.pattern.${id}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const fromItem = itemParts(itemId, 'rhythm.pattern.')?.[0]
      const id = fromItem && STRUM_PATTERNS[fromItem] ? fromItem : pick(rng, Object.keys(STRUM_PATTERNS).filter(k => STRUM_PATTERNS[k].level <= difficulty))
      const { pattern, name } = STRUM_PATTERNS[id]
      return {
        ...questionBase(this, seed, difficulty), kind: 'rhythm', bpm: [0, 60, 70, 80][difficulty], pattern, strokes: true,
        prompt: `用 D（下撥）與 U（上撥）按鈕彈出：${name}`, reviewItemIds: [`rhythm.pattern.${id}`], display: { pattern },
        explanation: '右手像鐘擺一樣持續上下擺動：正拍往下、反拍「&」往上。沒有聲音的格子手照樣擺，只是不碰到弦——這樣節奏才會穩。',
      } satisfies RhythmQuestion
    },
  },
  {
    id: 'rhythm.strum.direction', nodeId: 'rhythm.strum', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '撥弦方向',
    items: () => ['rhythm.strum.direction'],
    generate(seed, { difficulty }) {
      const rng = createRng(seed)
      const slot = int(rng, 0, 7)
      const labels = ['1', '1 的 &', '2', '2 的 &', '3', '3 的 &', '4', '4 的 &']
      const answer = slot % 2 === 0 ? '下撥 D' : '上撥 U'
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices: ['下撥 D', '上撥 U'], answer,
        prompt: `用「鐘擺」刷法時，「${labels[slot]}」應該是下撥還是上撥？`, reviewItemIds: ['rhythm.strum.direction'],
        explanation: '八分音符刷法：手每拍往下再往上擺一次。正拍（1、2、3、4）都是下撥，反拍（&）都是上撥。這樣即使跳過某些音，手的位置也不會亂。',
      } satisfies ChoiceQuestion
    },
  },
]

// ---- Ear training ------------------------------------------------------------------------------
const EAR_INTERVALS: Record<Difficulty, { name: string; semis: number; label: string }[]> = {
  1: [{ name: 'M3', semis: 4, label: '大三度 M3' }, { name: 'm3', semis: 3, label: '小三度 m3' }, { name: 'P5', semis: 7, label: '完全五度 P5' }, { name: 'P8', semis: 12, label: '八度 P8' }],
  2: [{ name: 'M2', semis: 2, label: '大二度 M2' }, { name: 'M3', semis: 4, label: '大三度 M3' }, { name: 'm3', semis: 3, label: '小三度 m3' }, { name: 'P4', semis: 5, label: '完全四度 P4' }, { name: 'P5', semis: 7, label: '完全五度 P5' }, { name: 'P8', semis: 12, label: '八度 P8' }],
  3: [{ name: 'm2', semis: 1, label: '小二度 m2' }, { name: 'M2', semis: 2, label: '大二度 M2' }, { name: 'm3', semis: 3, label: '小三度 m3' }, { name: 'M3', semis: 4, label: '大三度 M3' }, { name: 'P4', semis: 5, label: '完全四度 P4' }, { name: 'P5', semis: 7, label: '完全五度 P5' }, { name: 'M6', semis: 9, label: '大六度 M6' }, { name: 'P8', semis: 12, label: '八度 P8' }],
}

export const earBasic: ExerciseTemplate[] = [
  {
    id: 'ear.basic.triad', nodeId: 'ear.basic', kind: 'choice', version: 1, evidenceLevel: 'recognize', stage: 'hear', title: '聽大小三和弦', requiresAudio: true,
    items: () => ['ear.triad.major-minor'],
    generate(seed, { difficulty }) {
      const rng = createRng(seed)
      const root = int(rng, 52, 62)
      const minor = rng() < 0.5
      const notes = [root, root + (minor ? 3 : 4), root + 7]
      const answer = minor ? '小三和弦（較暗）' : '大三和弦（較亮）'
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices: ['大三和弦（較亮）', '小三和弦（較暗）'], answer,
        prompt: '聽聽看：大三和弦還是小三和弦？', reviewItemIds: ['ear.triad.major-minor'],
        audio: difficulty === 1 ? [...notes.map(n => ({ notes: [n], duration: 0.45 })), { notes, duration: 1.4 }] : [{ notes, duration: 1.6 }],
        explanation: `差別只在三音：大三和弦的三音比小三和弦高半音。這次是${minor ? '小三和弦（根音上方 3 個半音）' : '大三和弦（根音上方 4 個半音）'}。`,
      } satisfies ChoiceQuestion
    },
  },
  {
    id: 'ear.basic.interval', nodeId: 'ear.basic', kind: 'choice', version: 1, evidenceLevel: 'recognize', stage: 'hear', title: '聽音程', requiresAudio: true,
    items: () => EAR_INTERVALS[3].map(i => `ear.interval.${i.name}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const requested = EAR_INTERVALS[3].find(i => `ear.interval.${i.name}` === itemId)
      const options = requested && !EAR_INTERVALS[difficulty].includes(requested) ? [...EAR_INTERVALS[difficulty], requested] : EAR_INTERVALS[difficulty]
      const target = requested ?? pick(rng, options)
      const root = int(rng, 52, 60)
      const choices = shuffle(rng, [target.label, ...shuffle(rng, options.filter(o => o.name !== target.name)).slice(0, 3).map(o => o.label)])
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer: target.label,
        prompt: '聽兩個音（先低後高），是什麼音程？', reviewItemIds: [`ear.interval.${target.name}`],
        audio: [{ notes: [root], duration: 0.7 }, { notes: [root + target.semis], duration: 1 }],
        explanation: `${target.label} = ${target.semis} 個半音。在吉他上：同一條弦往上 ${target.semis} 格。`,
      } satisfies ChoiceQuestion
    },
  },
]

