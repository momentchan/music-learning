import { mod12 } from './notes'

/** String numbers follow guitar convention: 1 = high e … 6 = low E. Tunings are listed low → high. */
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6
export const STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6]

export interface Tuning { id: string; name: string; midi: readonly number[] }
export const TUNINGS: Record<string, Tuning> = {
  standard: { id: 'standard', name: '標準 Standard (E A D G B E)', midi: [40, 45, 50, 55, 59, 64] },
  dropD: { id: 'dropD', name: 'Drop D (D A D G B E)', midi: [38, 45, 50, 55, 59, 64] },
  halfDown: { id: 'halfDown', name: '降半音 (E♭ A♭ D♭ G♭ B♭ E♭)', midi: [39, 44, 49, 54, 58, 63] },
  dadgad: { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
  openG: { id: 'openG', name: 'Open G (D G D G B D)', midi: [38, 43, 50, 55, 59, 62] },
}
export const STANDARD = TUNINGS.standard

export interface Position { string: StringNumber; fret: number }

export function openMidi(tuning: Tuning, string: StringNumber): number { return tuning.midi[6 - string] }
export function midiAt(tuning: Tuning, string: StringNumber, fret: number): number { return openMidi(tuning, string) + fret }
export function pcAt(tuning: Tuning, string: StringNumber, fret: number): number { return mod12(midiAt(tuning, string, fret)) }

/** Every position of a pitch class within a fret range, optionally limited to some strings. */
export function positionsOfPc(tuning: Tuning, pc: number, minFret = 0, maxFret = 12, strings: readonly StringNumber[] = STRINGS): Position[] {
  const result: Position[] = []
  for (const string of strings) for (let fret = minFret; fret <= maxFret; fret++) if (pcAt(tuning, string, fret) === mod12(pc)) result.push({ string, fret })
  return result
}

/** Positions of an exact pitch (MIDI), e.g. to require a specific octave. */
export function positionsOfMidi(tuning: Tuning, midi: number, minFret = 0, maxFret = 12): Position[] {
  return STRINGS.flatMap(string => {
    const fret = midi - openMidi(tuning, string)
    return fret >= minFret && fret <= maxFret ? [{ string, fret }] : []
  })
}

export function fretRegion(fret: number): string {
  if (fret <= 4) return '0–4 格'
  if (fret <= 8) return '5–8 格'
  return '9–12 格'
}

// ---- Chord shapes ---------------------------------------------------------------

/** frets: strings 6 → 1, -1 = muted. fingers: 0 = open/none, 1–4 = index … pinky. */
export interface ChordShape {
  id: string
  symbol: string
  name: string
  family: 'open' | 'open7' | 'barre-E' | 'barre-A' | 'open-other'
  frets: readonly number[]
  fingers: readonly number[]
  barre?: { fret: number; fromString: StringNumber; toString: StringNumber }
}

export const CHORD_SHAPES: readonly ChordShape[] = [
  { id: 'C', symbol: 'C', name: 'C 大三和弦', family: 'open', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  { id: 'A', symbol: 'A', name: 'A 大三和弦', family: 'open', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  { id: 'G', symbol: 'G', name: 'G 大三和弦', family: 'open', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  { id: 'E', symbol: 'E', name: 'E 大三和弦', family: 'open', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  { id: 'D', symbol: 'D', name: 'D 大三和弦', family: 'open', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  { id: 'Am', symbol: 'Am', name: 'A 小三和弦', family: 'open', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  { id: 'Em', symbol: 'Em', name: 'E 小三和弦', family: 'open', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 1, 2, 0, 0, 0] },
  { id: 'Dm', symbol: 'Dm', name: 'D 小三和弦', family: 'open', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  { id: 'E7', symbol: 'E7', name: 'E 屬七和弦', family: 'open7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  { id: 'A7', symbol: 'A7', name: 'A 屬七和弦', family: 'open7', frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
  { id: 'D7', symbol: 'D7', name: 'D 屬七和弦', family: 'open7', frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  { id: 'G7', symbol: 'G7', name: 'G 屬七和弦', family: 'open7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  { id: 'B7', symbol: 'B7', name: 'B 屬七和弦', family: 'open7', frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  { id: 'C7', symbol: 'C7', name: 'C 屬七和弦', family: 'open7', frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  { id: 'Cmaj7', symbol: 'Cmaj7', name: 'C 大七和弦', family: 'open-other', frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  { id: 'Fmaj7', symbol: 'Fmaj7', name: 'F 大七和弦', family: 'open-other', frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  { id: 'Am7', symbol: 'Am7', name: 'A 小七和弦', family: 'open-other', frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  { id: 'Em7', symbol: 'Em7', name: 'E 小七和弦', family: 'open-other', frets: [0, 2, 2, 0, 3, 0], fingers: [0, 1, 2, 0, 3, 0] },
  { id: 'Dm7', symbol: 'Dm7', name: 'D 小七和弦', family: 'open-other', frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1] },
  { id: 'F', symbol: 'F', name: 'F 大三和弦（E 型封閉）', family: 'barre-E', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, fromString: 6, toString: 1 } },
  { id: 'Bm', symbol: 'Bm', name: 'B 小三和弦（A 型封閉）', family: 'barre-A', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, fromString: 5, toString: 1 } },
]

/** The eight Tier 1 open chords taught first. */
export const CORE_OPEN_SHAPES = ['C', 'A', 'G', 'E', 'D', 'Am', 'Em', 'Dm'] as const

export function shapeById(id: string): ChordShape {
  const shape = CHORD_SHAPES.find(s => s.id === id)
  if (!shape) throw new Error(`Unknown shape ${id}`)
  return shape
}

/** Sounding MIDI notes of a shape, low string first. */
export function shapeMidi(shape: ChordShape, tuning: Tuning = STANDARD): { string: StringNumber; fret: number; midi: number }[] {
  return shape.frets.flatMap((fret, index) => {
    const string = (6 - index) as StringNumber
    return fret < 0 ? [] : [{ string, fret, midi: midiAt(tuning, string, fret) }]
  })
}

export function mutedStrings(shape: ChordShape): StringNumber[] {
  return shape.frets.flatMap((fret, index) => fret < 0 ? [(6 - index) as StringNumber] : [])
}
