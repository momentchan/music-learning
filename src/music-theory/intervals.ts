import { LETTERS, letterIndex, mod12, naturalPc, pitchClass, type SpelledNote } from './notes'

export type IntervalQuality = 'P' | 'M' | 'm' | 'A' | 'd' | 'AA' | 'dd'
export interface Interval { quality: IntervalQuality; number: number; semitones: number }

// Semitones of the major / perfect interval for generic sizes 1–7.
const BASE = [0, 2, 4, 5, 7, 9, 11]
const isPerfectSize = (number: number) => [1, 4, 5].includes(((number - 1) % 7) + 1)

const PERFECT_OFFSETS: Partial<Record<IntervalQuality, number>> = { P: 0, A: 1, d: -1, AA: 2, dd: -2 }
const MAJOR_OFFSETS: Partial<Record<IntervalQuality, number>> = { M: 0, m: -1, A: 1, d: -2, AA: 2, dd: -3 }

export function parseInterval(name: string): Interval {
  const match = /^(AA|dd|P|M|m|A|d)(\d+)$/.exec(name)
  if (!match) throw new Error(`Invalid interval: ${name}`)
  const quality = match[1] as IntervalQuality
  const number = Number(match[2])
  const simple = ((number - 1) % 7) + 1
  const offset = isPerfectSize(number) ? PERFECT_OFFSETS[quality] : MAJOR_OFFSETS[quality]
  if (offset === undefined || number < 1) throw new Error(`Invalid interval quality: ${name}`)
  return { quality, number, semitones: BASE[simple - 1] + offset + 12 * Math.floor((number - 1) / 7) }
}

export function intervalName(i: Pick<Interval, 'quality' | 'number'>): string { return `${i.quality}${i.number}` }

/** Ascending simple interval from a to b (b assumed above a, within an octave), from spelling. */
export function intervalBetween(a: SpelledNote, b: SpelledNote): Interval {
  const number = mod7(letterIndex(b.letter) - letterIndex(a.letter)) + 1
  const semitones = mod12(pitchClass(b) - pitchClass(a))
  let diff = semitones - BASE[number - 1]
  diff = mod12(diff + 6) - 6 // normalise to -6..5
  const table = isPerfectSize(number) ? PERFECT_OFFSETS : MAJOR_OFFSETS
  const quality = (Object.entries(table).find(([, offset]) => offset === diff)?.[0] ?? (diff > 0 ? 'AA' : 'dd')) as IntervalQuality
  return { quality, number, semitones: BASE[number - 1] + diff }
}

/** Spell the note a given interval above `root` (e.g. transposeUp(E♭, 'M3') = G). */
export function transposeUp(root: SpelledNote, name: string): SpelledNote {
  const interval = parseInterval(name)
  const letter = LETTERS[(letterIndex(root.letter) + interval.number - 1) % 7]
  const targetPc = mod12(pitchClass(root) + interval.semitones)
  let acc = mod12(targetPc - naturalPc(letter))
  if (acc > 6) acc -= 12
  if (Math.abs(acc) > 2) throw new Error(`Cannot spell ${name} above ${root.letter}`)
  return { letter, acc }
}

export function invertInterval(name: string): string {
  const i = parseInterval(name)
  const simple = ((i.number - 1) % 7) + 1
  const inverted: Record<IntervalQuality, IntervalQuality> = { P: 'P', M: 'm', m: 'M', A: 'd', d: 'A', AA: 'dd', dd: 'AA' }
  return `${inverted[i.quality]}${9 - simple}`
}

const mod7 = (n: number) => ((n % 7) + 7) % 7

/** Learner-facing names (zh-TW + English abbreviation). */
export const INTERVAL_LABELS: Record<string, string> = {
  P1: '同度 P1', m2: '小二度 m2', M2: '大二度 M2', m3: '小三度 m3', M3: '大三度 M3', P4: '完全四度 P4',
  A4: '增四度 A4', d5: '減五度 d5', P5: '完全五度 P5', A5: '增五度 A5', m6: '小六度 m6', M6: '大六度 M6',
  d7: '減七度 d7', m7: '小七度 m7', M7: '大七度 M7', P8: '八度 P8', M9: '大九度 M9',
}
export const intervalLabel = (name: string) => INTERVAL_LABELS[name] ?? name
