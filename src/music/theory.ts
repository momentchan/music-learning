export const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const PITCH: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64] as const // low E to high E
export const INTERVALS = [
  { name: 'm2', semitones: 1 }, { name: 'M2', semitones: 2 },
  { name: 'm3', semitones: 3 }, { name: 'M3', semitones: 4 },
  { name: 'P4', semitones: 5 }, { name: 'TT', semitones: 6 },
  { name: 'P5', semitones: 7 }, { name: 'm6', semitones: 8 },
  { name: 'M6', semitones: 9 }, { name: 'm7', semitones: 10 },
  { name: 'M7', semitones: 11 }, { name: 'P8', semitones: 12 },
  { name: 'M9', semitones: 14 },
] as const
export type IntervalMode = 'ascending' | 'descending' | 'harmonic'
export type ChordStyle = 'block' | 'up' | 'down'
export type Instrument = 'pluck' | 'keys'
export type ChordQuality = 'major' | 'minor' | 'dim' | 'aug' | 'maj7' | 'm7' | '7' | 'm7b5' | 'dim7' | 'sus2' | 'sus4' | 'add9' | '6' | 'm6' | '9' | 'maj9' | 'm9' | '11' | '13'

export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], '7': [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9], sus2: [0, 2, 7],
  sus4: [0, 5, 7], add9: [0, 4, 7, 14], '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9], '9': [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14], '11': [0, 4, 7, 10, 14, 17], '13': [0, 4, 7, 10, 14, 17, 21],
}

const SUFFIXES: [string, ChordQuality][] = [
  ['m7b5', 'm7b5'], ['ø7', 'm7b5'], ['dim7', 'dim7'], ['maj9', 'maj9'],
  ['maj7', 'maj7'], ['m9', 'm9'], ['add9', 'add9'], ['sus4', 'sus4'],
  ['sus2', 'sus2'], ['dim', 'dim'], ['aug', 'aug'], ['m7', 'm7'],
  ['m6', 'm6'], ['13', '13'], ['11', '11'], ['9', '9'], ['7', '7'],
  ['6', '6'], ['m', 'minor'], ['', 'major'],
]

export interface ParsedChord { symbol: string; root: number; rootName: string; quality: ChordQuality; bass?: number; bassName?: string }
export function parseChord(symbol: string): ParsedChord {
  const match = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(symbol.trim())
  if (!match || PITCH[match[1]] === undefined) throw new Error(`Invalid chord: ${symbol}`)
  const suffix = match[2].replace('♭', 'b').replace('Δ', 'maj')
  const quality = SUFFIXES.find(([key]) => key === suffix)?.[1]
  if (!quality || (match[3] && PITCH[match[3]] === undefined)) throw new Error(`Unsupported chord: ${symbol}`)
  return { symbol, root: PITCH[match[1]], rootName: match[1], quality,
    ...(match[3] ? { bass: PITCH[match[3]], bassName: match[3] } : {}) }
}
export function midiToFrequency(midi: number): number { return 440 * 2 ** ((midi - 69) / 12) }
export function noteName(midi: number, preferFlats = false): string {
  const names = preferFlats ? FLATS : SHARPS
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}
export function chordPitchClasses(chord: ParsedChord): number[] {
  return CHORD_INTERVALS[chord.quality].map(i => (chord.root + i) % 12)
}
export function chordVoicing(symbol: string, inversion = 0, previous?: number[]): number[] {
  const chord = parseChord(symbol)
  const classes = chordPitchClasses(chord)
  const rotated = [...classes.slice(inversion % classes.length), ...classes.slice(0, inversion % classes.length)]
  const bassClass = chord.bass ?? rotated[0]
  const bass = Array.from({ length: 3 }, (_, i) => 36 + i * 12 + bassClass)
    .filter(m => m >= 40 && m <= 59)
  const bassNote = bass.reduce((best, m) => Math.abs(m - (previous?.[0] ?? 48)) < Math.abs(best - (previous?.[0] ?? 48)) ? m : best, bass[0] ?? 48 + bassClass)
  const upperClasses = chord.bass === undefined ? rotated.slice(1) : classes.filter((pc, i) => pc !== bassClass || i !== 0)
  const upper: number[] = []
  let floor = bassNote
  for (const pc of upperClasses) {
    const candidates = Array.from({ length: 4 }, (_, i) => 48 + i * 12 + pc).filter(m => m > floor && m <= 84)
    const target = previous?.[upper.length + 1] ?? floor + 5
    const chosen = candidates.reduce((best, m) => Math.abs(m - target) < Math.abs(best - target) ? m : best, candidates[0] ?? floor + 12)
    upper.push(chosen); floor = chosen
  }
  return [bassNote, ...upper]
}
export function intervalNotes(root: number, semitones: number, mode: IntervalMode): number[] {
  return mode === 'descending' ? [root + semitones, root] : [root, root + semitones]
}
export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pentatonic: [0, 2, 4, 7, 9], minorPentatonic: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10] } as const
export type ScaleName = keyof typeof SCALES
export function scaleNotes(root: number, scale: ScaleName): number[] { return [...SCALES[scale].map(i => root + i), root + 12] }

export interface ProgressionChord { symbol: string; beats: number; inversion?: number }
export interface ScheduledChord { index: number; chord: ProgressionChord; at: number; duration: number; notes: number[] }
export function planProgression(chords: ProgressionChord[], bpm: number): ScheduledChord[] {
  if (bpm < 35 || bpm > 240 || chords.some(c => c.beats <= 0)) throw new Error('Invalid tempo or chord duration')
  let at = 0; let previous: number[] | undefined
  return chords.map((chord, index) => {
    const notes = chordVoicing(chord.symbol, chord.inversion ?? 0, previous)
    const duration = chord.beats * 60 / bpm
    const event = { index, chord, at, duration, notes }
    at += duration; previous = notes
    return event
  })
}
