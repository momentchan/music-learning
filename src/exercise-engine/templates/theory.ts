import { createRng, pick, shuffle } from '../../lib/rng'
import { chordNotes, chordSymbol, QUALITY_LABEL, type ChordQuality } from '../../music-theory/chords'
import { intervalBetween, intervalLabel, parseInterval, transposeUp } from '../../music-theory/intervals'
import { diatonicChords, keySignature, majorDegreeFunctions, scaleNotes } from '../../music-theory/keys'
import { LETTERS, letterIndex, noteId, noteLabel, parseNote, pitchClass, type SpelledNote } from '../../music-theory/notes'
import type { ChoiceQuestion, ConstructQuestion, Difficulty, ExerciseTemplate } from '../types'
import { itemParts, questionBase } from './common'

const toMidi = (n: SpelledNote, octave = 4) => 12 * (octave + 1) + pitchClass(n)
const ascending = (notes: SpelledNote[], start = 4) => {
  let previous = -1
  return notes.map(n => { let m = toMidi(n, start); while (m <= previous) m += 12; previous = m; return m })
}

// ---- Intervals ---------------------------------------------------------------------
const INTERVALS_BY_LEVEL: Record<Difficulty, string[]> = {
  1: ['M2', 'm3', 'M3', 'P4', 'P5'],
  2: ['m2', 'M2', 'm3', 'M3', 'P4', 'P5', 'm6', 'M6', 'm7', 'M7'],
  3: ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'd5', 'P5', 'm6', 'M6', 'm7', 'M7'],
}
const ROOTS_BY_LEVEL: Record<Difficulty, string[]> = {
  1: ['C', 'D', 'E', 'F', 'G', 'A'],
  2: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  3: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb', 'F#', 'Ab', 'Db'],
}
const ALL_INTERVALS = INTERVALS_BY_LEVEL[3]

function intervalPair(rng: () => number, difficulty: Difficulty, itemId?: string) {
  const fromItem = itemParts(itemId, 'interval.')?.[0]
  const name = fromItem && ALL_INTERVALS.includes(fromItem) ? fromItem : pick(rng, INTERVALS_BY_LEVEL[difficulty])
  for (let tries = 0; tries < 40; tries++) {
    const root = parseNote(pick(rng, ROOTS_BY_LEVEL[difficulty]))
    const target = transposeUp(root, name)
    if (Math.abs(target.acc) <= 1) return { name, root, target }
  }
  return { name, root: parseNote('C'), target: transposeUp(parseNote('C'), name) }
}

const letterSpan = (root: SpelledNote, number: number) =>
  Array.from({ length: number }, (_, i) => LETTERS[(letterIndex(root.letter) + i) % 7]).join('-')

export const intervalBasics: ExerciseTemplate[] = [
  {
    id: 'interval.basics.construct', nodeId: 'interval.basics', kind: 'construct', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '建構音程',
    items: () => [...ALL_INTERVALS.map(n => `interval.${n}`), 'spell.interval'],
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const { name, root, target } = intervalPair(rng, difficulty, itemId)
      const i = parseInterval(name)
      return {
        ...questionBase(this, seed, difficulty), kind: 'construct', expected: [noteId(target)], given: [noteId(root)], ordered: true, spellingItemId: 'spell.interval',
        prompt: `${noteLabel(root)} 往上一個${intervalLabel(name)}是哪個音？`, reviewItemIds: [`interval.${name}`, 'spell.interval'],
        explanation: `${noteLabel(root)} → ${noteLabel(target)}。${i.number} 度要跨 ${i.number} 個字母（${letterSpan(root, i.number)}），${intervalLabel(name)}是 ${i.semitones} 個半音。`,
        answerAudio: [{ notes: [toMidi(root)], duration: 0.6 }, { notes: [toMidi(root) + i.semitones], duration: 0.9 }],
      } satisfies ConstructQuestion
    },
  },
  {
    id: 'interval.basics.identify', nodeId: 'interval.basics', kind: 'choice', version: 1, evidenceLevel: 'recognize', stage: 'recall', title: '辨認音程',
    items: () => ALL_INTERVALS.map(n => `interval.${n}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const { name, root, target } = intervalPair(rng, difficulty, itemId)
      const i = parseInterval(name)
      // Plausible distractors: same size other quality, and same semitones other size.
      const pool = ALL_INTERVALS.filter(n => n !== name)
      const close = pool.filter(n => parseInterval(n).number === i.number || Math.abs(parseInterval(n).semitones - i.semitones) <= 1)
      const distractors = shuffle(rng, close).concat(shuffle(rng, pool)).filter((n, idx, arr) => arr.indexOf(n) === idx).slice(0, 3)
      const feedback: Record<string, string> = {}
      for (const d of distractors) {
        const di = parseInterval(d)
        feedback[intervalLabel(d)] = di.number === i.number
          ? `度數對了（${i.number} 度），但性質不對：${noteLabel(root)} 到 ${noteLabel(target)} 是 ${i.semitones} 個半音，所以是${intervalLabel(name)}。`
          : `數字母：${letterSpan(root, i.number)} 共 ${i.number} 個字母，所以是 ${i.number} 度，不是 ${di.number} 度。`
      }
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices: shuffle(rng, [name, ...distractors]).map(intervalLabel), answer: intervalLabel(name), distractorFeedback: feedback,
        prompt: `${noteLabel(root)} 到 ${noteLabel(target)}（往上）是什麼音程？`, reviewItemIds: [`interval.${name}`],
        explanation: `先數字母決定度數（${letterSpan(root, i.number)} → ${i.number} 度），再數半音決定性質（${i.semitones} 個半音 → ${intervalLabel(name)}）。`,
        answerAudio: [{ notes: [toMidi(root)], duration: 0.6 }, { notes: [toMidi(root) + i.semitones], duration: 0.9 }],
      } satisfies ChoiceQuestion
    },
  },
]

// ---- Triads ------------------------------------------------------------------------
const TRIAD_QUALITIES: ChordQuality[] = ['major', 'minor', 'dim', 'aug']
const TRIAD_ROOTS: Record<Difficulty, string[]> = { 1: ['C', 'D', 'E', 'F', 'G', 'A'], 2: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb'], 3: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb', 'Ab', 'F#', 'Db', 'C#'] }
const TRIAD_RECIPES: Record<string, string> = {
  major: '大三度 + 小三度（R–M3–P5）', minor: '小三度 + 大三度（R–m3–P5）', dim: '小三度 + 小三度（R–m3–d5）', aug: '大三度 + 大三度（R–M3–A5）',
}

function triadChoice(rng: () => number, difficulty: Difficulty, itemId?: string) {
  const fromItem = itemParts(itemId, 'triad.')?.[0] as ChordQuality | undefined
  const quality = fromItem && TRIAD_QUALITIES.includes(fromItem) ? fromItem : pick(rng, difficulty === 1 ? TRIAD_QUALITIES.slice(0, 2) : TRIAD_QUALITIES)
  for (let tries = 0; tries < 40; tries++) {
    const root = parseNote(pick(rng, TRIAD_ROOTS[difficulty]))
    const notes = chordNotes({ root, quality })
    if (notes.every(n => Math.abs(n.acc) <= 1)) return { root, quality, notes }
  }
  const root = parseNote('C')
  return { root, quality, notes: chordNotes({ root, quality }) }
}

export const triadBasic: ExerciseTemplate[] = [
  {
    id: 'triad.basic.construct', nodeId: 'triad.basic', kind: 'construct', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '組成三和弦',
    items: () => [...TRIAD_QUALITIES.map(q => `triad.${q}`), 'spell.triad'],
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const { root, quality, notes } = triadChoice(rng, difficulty, itemId)
      return {
        ...questionBase(this, seed, difficulty), kind: 'construct', expected: notes.map(noteId), given: [], ordered: false, spellingItemId: 'spell.triad',
        prompt: `寫出 ${chordSymbol({ root, quality })}（${QUALITY_LABEL[quality]}）的三個音`, reviewItemIds: [`triad.${quality}`, 'spell.triad'],
        explanation: `${chordSymbol({ root, quality })} = ${notes.map(noteLabel).join(' ')}：${TRIAD_RECIPES[quality]}。三和弦隔一個字母疊一個音（${notes.map(n => n.letter).join('-')}）。`,
        answerAudio: [{ notes: ascending(notes, 3), duration: 1.4 }],
      } satisfies ConstructQuestion
    },
  },
  {
    id: 'triad.basic.identify', nodeId: 'triad.basic', kind: 'choice', version: 1, evidenceLevel: 'recognize', stage: 'recall', title: '辨認三和弦',
    items: () => TRIAD_QUALITIES.map(q => `triad.${q}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const { root, quality, notes } = triadChoice(rng, difficulty, itemId)
      const name = (q: ChordQuality) => chordSymbol({ root, quality: q }).replace('dim', '°').replace('aug', '+')
      const third = intervalBetween(root, notes[1])
      const fifth = intervalBetween(root, notes[2])
      const feedback = Object.fromEntries(TRIAD_QUALITIES.filter(q => q !== quality).map(q => [name(q), `${noteLabel(root)}–${noteLabel(notes[1])} 是${intervalLabel(`${third.quality}${third.number}`)}，${noteLabel(root)}–${noteLabel(notes[2])} 是${intervalLabel(`${fifth.quality}${fifth.number}`)}，所以是${QUALITY_LABEL[quality]}。`]))
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices: TRIAD_QUALITIES.map(name), answer: name(quality), distractorFeedback: feedback,
        prompt: `${notes.map(noteLabel).join(' – ')} 是什麼和弦？`, reviewItemIds: [`triad.${quality}`],
        explanation: `看根音到三音、根音到五音：${TRIAD_RECIPES[quality]} → ${QUALITY_LABEL[quality]}。`,
        answerAudio: [{ notes: ascending(notes, 3), duration: 1.4 }],
      } satisfies ChoiceQuestion
    },
  },
]

// ---- Major scale -----------------------------------------------------------------------
const SCALE_KEYS: Record<Difficulty, string[]> = { 1: ['C', 'G', 'D', 'F'], 2: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'], 3: ['A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db'] }
const ALL_SCALE_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db']
const pickKey = (rng: () => number, difficulty: Difficulty, itemId: string | undefined, prefix: string) => {
  const fromItem = itemParts(itemId, prefix)?.[0]
  return parseNote(fromItem && ALL_SCALE_KEYS.includes(fromItem) ? fromItem : pick(rng, SCALE_KEYS[difficulty]))
}
const DEGREE_NAMES = ['主音 1', '2', '3', '4', '5（屬音）', '6', '7（導音）']

export const scaleMajor: ExerciseTemplate[] = [
  {
    id: 'scale.major.missing', nodeId: 'scale.major', kind: 'construct', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '補上缺的音',
    items: () => [...ALL_SCALE_KEYS.map(k => `scale.major.${k}`), 'spell.scale'],
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const tonic = pickKey(rng, difficulty, itemId, 'scale.major.')
      const scale = scaleNotes(tonic, 'major')
      const missing = 1 + Math.floor(rng() * 6)
      return {
        ...questionBase(this, seed, difficulty), kind: 'construct', expected: [noteId(scale[missing])], given: scale.map((n, i) => i === missing ? '_' : noteId(n)), ordered: true, spellingItemId: 'spell.scale',
        prompt: `${noteLabel(tonic)} 大調：${scale.map((n, i) => i === missing ? '＿' : noteLabel(n)).join(' ')}，缺的是哪個音？`,
        reviewItemIds: [`scale.major.${noteId(tonic)}`, 'spell.scale'],
        explanation: `大調音階的全半音排列是 全-全-半-全-全-全-半。${noteLabel(tonic)} 大調 = ${scale.map(noteLabel).join(' ')}（每個字母用一次）。`,
        answerAudio: ascending(scale, 4).map(m => ({ notes: [m], duration: 0.35 })),
      } satisfies ConstructQuestion
    },
  },
  {
    id: 'scale.major.degree', nodeId: 'scale.major', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'apply', title: '音階級數',
    items: () => ALL_SCALE_KEYS.map(k => `scale.major.${k}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const tonic = pickKey(rng, difficulty, itemId, 'scale.major.')
      const scale = scaleNotes(tonic, 'major')
      const degree = 2 + Math.floor(rng() * 6) // 2–7
      const answer = scale[degree - 1]
      const next = scale[degree % 7]
      const previous = scale[degree - 2]
      const flatOrSharp = { letter: answer.letter, acc: answer.acc === 0 ? (rng() < 0.5 ? 1 : -1) : 0 }
      const choices = shuffle(rng, [...new Set([answer, next, previous, flatOrSharp].map(noteLabel))])
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer: noteLabel(answer),
        distractorFeedback: { [noteLabel(flatOrSharp)]: `字母對了，但 ${noteLabel(tonic)} 大調裡的 ${answer.letter} 是 ${noteLabel(answer)}（看調號：${keySignature(tonic).accidentals.map(noteLabel).join(' ') || '沒有升降記號'}）。` },
        prompt: `${noteLabel(tonic)} 大調的第 ${degree} 級（${DEGREE_NAMES[degree - 1]}）是哪個音？`,
        reviewItemIds: [`scale.major.${noteId(tonic)}`],
        explanation: `${noteLabel(tonic)} 大調：${scale.map((n, i) => `${i + 1}=${noteLabel(n)}`).join('、')}。`,
      } satisfies ChoiceQuestion
    },
  },
]

// ---- Keys & diatonic chords -------------------------------------------------------------
const KEY_LEVEL: Record<Difficulty, string[]> = { 1: ['C', 'G', 'D', 'F'], 2: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'], 3: ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'] }
const ALL_KEYS = KEY_LEVEL[3]
const shortName = (root: SpelledNote, quality: ChordQuality) => noteLabel(root) + ({ major: '', minor: 'm', dim: '°' } as Record<string, string>)[quality]

function keyAndDegree(rng: () => number, difficulty: Difficulty, itemId?: string) {
  const parts = itemParts(itemId, 'key.')
  const tonic = parseNote(parts && ALL_KEYS.includes(parts[0]) ? parts[0] : pick(rng, KEY_LEVEL[difficulty]))
  const degree = parts?.[1] ? Number(parts[1]) : 1 + Math.floor(rng() * (difficulty === 1 ? 6 : 7))
  return { tonic, degree, chords: diatonicChords(tonic) }
}
const keyItems = () => ALL_KEYS.flatMap(k => [1, 2, 3, 4, 5, 6, 7].map(d => `key.${k}.${d}`))

export const keyDiatonic: ExerciseTemplate[] = [
  {
    id: 'key.diatonic.chord', nodeId: 'key.diatonic', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '級數 → 和弦',
    items: keyItems,
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const { tonic, degree, chords } = keyAndDegree(rng, difficulty, itemId)
      const target = chords[degree - 1]
      const answer = shortName(target.chord.root, target.chord.quality)
      const otherQuality = shortName(target.chord.root, target.chord.quality === 'major' ? 'minor' : 'major')
      const neighbour = chords[degree % 7]
      const fifthAway = chords[(degree + 3) % 7]
      const choices = shuffle(rng, [...new Set([answer, otherQuality, shortName(neighbour.chord.root, neighbour.chord.quality), shortName(fifthAway.chord.root, fifthAway.chord.quality)])])
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer,
        distractorFeedback: { [otherQuality]: `根音對了，但在 ${noteLabel(tonic)} 大調裡，第 ${degree} 級只用調內音：${target.notes.map(noteLabel).join(' ')}，所以是 ${answer}。` },
        prompt: `在 ${noteLabel(tonic)} 大調，${target.numeral} 級和弦是？`, reviewItemIds: [`key.${noteId(tonic)}.${degree}`],
        explanation: `${noteLabel(tonic)} 大調的順階三和弦：${chords.map(c => `${c.numeral}=${shortName(c.chord.root, c.chord.quality)}`).join('、')}。大調的規律是 大-小-小-大-大-小-減。`,
      } satisfies ChoiceQuestion
    },
  },
  {
    id: 'key.diatonic.numeral', nodeId: 'key.diatonic', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'apply', title: '和弦 → 級數',
    items: keyItems,
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const { tonic, degree, chords } = keyAndDegree(rng, difficulty, itemId)
      const target = chords[degree - 1]
      const choices = shuffle(rng, [target.numeral, ...shuffle(rng, chords.filter(c => c.degree !== degree).map(c => c.numeral)).slice(0, 3)])
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer: target.numeral,
        prompt: `在 ${noteLabel(tonic)} 大調，${shortName(target.chord.root, target.chord.quality)} 是幾級和弦？`, reviewItemIds: [`key.${noteId(tonic)}.${degree}`],
        explanation: `${noteLabel(target.chord.root)} 是 ${noteLabel(tonic)} 大調的第 ${degree} 個音，所以是 ${target.numeral}。大寫 = 大三和弦，小寫 = 小三和弦，° = 減三和弦。`,
      } satisfies ChoiceQuestion
    },
  },
  {
    id: 'key.diatonic.signature', nodeId: 'key.diatonic', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '調號',
    items: () => ALL_KEYS.map(k => `key.sig.${k}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const fromItem = itemParts(itemId, 'key.sig.')?.[0]
      const tonic = parseNote(fromItem && ALL_KEYS.includes(fromItem) ? fromItem : pick(rng, KEY_LEVEL[difficulty]))
      const sig = keySignature(tonic)
      const label = (sharps: number, flats: number) => sharps ? `${sharps} 個 ♯` : flats ? `${flats} 個 ♭` : '沒有升降記號'
      const answer = label(sig.sharps, sig.flats)
      const pool = ['沒有升降記號', ...[1, 2, 3, 4].map(n => `${n} 個 ♯`), ...[1, 2, 3, 4].map(n => `${n} 個 ♭`)].filter(l => l !== answer)
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices: shuffle(rng, [answer, ...shuffle(rng, pool).slice(0, 3)]), answer,
        prompt: `${noteLabel(tonic)} 大調的調號是？`, reviewItemIds: [`key.sig.${noteId(tonic)}`],
        explanation: `${noteLabel(tonic)} 大調：${answer}${sig.accidentals.length ? `（${sig.accidentals.map(noteLabel).join(' ')}）` : ''}。升記號順序 F C G D A E B；降記號順序 B E A D G C F。`,
      } satisfies ChoiceQuestion
    },
  },
]

// ---- Harmony basics -----------------------------------------------------------------------
const FUNCTION_LABEL = { tonic: '主功能 Tonic', predominant: '下屬功能 Predominant', dominant: '屬功能 Dominant' } as const
const PROGRESSIONS = [
  { id: 'I-IV-V-I', degrees: [1, 4, 5, 1] }, { id: 'I-V-vi-IV', degrees: [1, 5, 6, 4] }, { id: 'vi-IV-I-V', degrees: [6, 4, 1, 5] },
  { id: 'I-vi-IV-V', degrees: [1, 6, 4, 5] }, { id: 'ii-V-I', degrees: [2, 5, 1] }, { id: 'I-IV-I-V', degrees: [1, 4, 1, 5] },
]

export const harmonyBasic: ExerciseTemplate[] = [
  {
    id: 'harmony.basic.function', nodeId: 'harmony.basic', kind: 'choice', version: 1, evidenceLevel: 'recall', stage: 'recall', title: '和聲功能',
    items: () => [1, 2, 4, 5, 6, 7].map(d => `harmony.function.${d}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const fromItem = itemParts(itemId, 'harmony.function.')?.[0]
      const degree = fromItem ? Number(fromItem) : pick(rng, difficulty === 1 ? [1, 4, 5] : [1, 2, 4, 5, 6, 7])
      const tonic = parseNote(pick(rng, KEY_LEVEL[difficulty]))
      const chord = diatonicChords(tonic)[degree - 1]
      const functions = majorDegreeFunctions(degree)
      const choices = [FUNCTION_LABEL.tonic, FUNCTION_LABEL.predominant, FUNCTION_LABEL.dominant]
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer: FUNCTION_LABEL[functions[0]], alsoAccepted: functions.slice(1).map(f => FUNCTION_LABEL[f]),
        prompt: `在 ${noteLabel(tonic)} 大調，${shortName(chord.chord.root, chord.chord.quality)}（${chord.numeral}）通常屬於哪種功能？`, reviewItemIds: [`harmony.function.${degree}`],
        explanation: `${chord.numeral}：${functions.map(f => FUNCTION_LABEL[f]).join(' 或 ')}。I 是穩定的「家」；ii、IV 帶出「離開」；V、vii° 含導音，產生回到 I 的張力。${functions.length > 1 ? '這個級數在不同情境可有不同解讀，兩種都算對。' : ''}`,
      } satisfies ChoiceQuestion
    },
  },
  {
    id: 'harmony.basic.progression', nodeId: 'harmony.basic', kind: 'choice', version: 1, evidenceLevel: 'apply', stage: 'apply', title: '分析和弦進行',
    items: () => PROGRESSIONS.map(p => `harmony.prog.${p.id}`),
    generate(seed, { difficulty, itemId }) {
      const rng = createRng(seed)
      const progression = PROGRESSIONS.find(p => `harmony.prog.${p.id}` === itemId) ?? pick(rng, PROGRESSIONS)
      const tonic = parseNote(pick(rng, KEY_LEVEL[difficulty]))
      const chords = diatonicChords(tonic)
      const label = (degrees: number[]) => degrees.map(d => chords[d - 1].numeral).join(' – ')
      const answer = label(progression.degrees)
      const choices = shuffle(rng, [answer, ...shuffle(rng, PROGRESSIONS.filter(p => p.id !== progression.id && p.degrees.length === progression.degrees.length).map(p => label(p.degrees))).slice(0, 3)])
      const names = progression.degrees.map(d => shortName(chords[d - 1].chord.root, chords[d - 1].chord.quality))
      return {
        ...questionBase(this, seed, difficulty), kind: 'choice', choices, answer,
        prompt: `${names.join(' → ')} 在 ${noteLabel(tonic)} 大調是什麼級數進行？`, reviewItemIds: [`harmony.prog.${progression.id}`],
        explanation: `在 ${noteLabel(tonic)} 大調：${names.map((n, i) => `${n}=${chords[progression.degrees[i] - 1].numeral}`).join('、')}。記住級數，就能把同一個進行移到任何調。`,
        answerAudio: progression.degrees.map(d => ({ notes: ascending(chords[d - 1].notes, 3), duration: 0.9 })),
      } satisfies ChoiceQuestion
    },
  },
]

export { toMidi, ascending }
