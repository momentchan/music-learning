import { transposeUp, intervalBetween } from './intervals'
import { noteLabel, parseNote, pitchClass, type SpelledNote } from './notes'

export type ChordQuality =
  | 'major' | 'minor' | 'dim' | 'aug' | 'maj7' | 'm7' | '7' | 'm7b5' | 'dim7' | 'mMaj7'
  | 'sus2' | 'sus4' | 'add9' | '6' | 'm6' | '9' | 'maj9' | 'm9' | '11' | '13'

export const CHORD_FORMULAS: Record<ChordQuality, string[]> = {
  major: ['P1', 'M3', 'P5'], minor: ['P1', 'm3', 'P5'], dim: ['P1', 'm3', 'd5'], aug: ['P1', 'M3', 'A5'],
  maj7: ['P1', 'M3', 'P5', 'M7'], m7: ['P1', 'm3', 'P5', 'm7'], '7': ['P1', 'M3', 'P5', 'm7'],
  m7b5: ['P1', 'm3', 'd5', 'm7'], dim7: ['P1', 'm3', 'd5', 'd7'], mMaj7: ['P1', 'm3', 'P5', 'M7'],
  sus2: ['P1', 'M2', 'P5'], sus4: ['P1', 'P4', 'P5'], add9: ['P1', 'M3', 'P5', 'M9'],
  '6': ['P1', 'M3', 'P5', 'M6'], m6: ['P1', 'm3', 'P5', 'M6'], '9': ['P1', 'M3', 'P5', 'm7', 'M9'],
  maj9: ['P1', 'M3', 'P5', 'M7', 'M9'], m9: ['P1', 'm3', 'P5', 'm7', 'M9'],
  '11': ['P1', 'M3', 'P5', 'm7', 'M9', 'P11'], '13': ['P1', 'M3', 'P5', 'm7', 'M9', 'P11', 'M13'],
}

/** Symbol suffix used when writing a chord name. */
export const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  major: '', minor: 'm', dim: 'dim', aug: 'aug', maj7: 'maj7', m7: 'm7', '7': '7', m7b5: 'm7♭5', dim7: 'dim7', mMaj7: 'm(maj7)',
  sus2: 'sus2', sus4: 'sus4', add9: 'add9', '6': '6', m6: 'm6', '9': '9', maj9: 'maj9', m9: 'm9', '11': '11', '13': '13',
}

export const QUALITY_LABEL: Record<ChordQuality, string> = {
  major: '大三和弦 Major', minor: '小三和弦 Minor', dim: '減三和弦 Diminished', aug: '增三和弦 Augmented',
  maj7: '大七和弦 Major 7th', m7: '小七和弦 Minor 7th', '7': '屬七和弦 Dominant 7th', m7b5: '半減七和弦 Half-diminished',
  dim7: '減七和弦 Diminished 7th', mMaj7: '小大七和弦 Minor-major 7th', sus2: '掛二和弦 sus2', sus4: '掛四和弦 sus4',
  add9: '加九和弦 add9', '6': '大六和弦 6', m6: '小六和弦 m6', '9': '屬九和弦 9', maj9: '大九和弦 maj9', m9: '小九和弦 m9',
  '11': '屬十一和弦 11', '13': '屬十三和弦 13',
}

const SUFFIX_PARSE: [string, ChordQuality][] = [
  ['m7b5', 'm7b5'], ['m7♭5', 'm7b5'], ['ø7', 'm7b5'], ['ø', 'm7b5'], ['dim7', 'dim7'], ['°7', 'dim7'], ['m(maj7)', 'mMaj7'], ['mMaj7', 'mMaj7'],
  ['maj9', 'maj9'], ['maj7', 'maj7'], ['Δ7', 'maj7'], ['M7', 'maj7'], ['m9', 'm9'], ['add9', 'add9'], ['sus4', 'sus4'], ['sus2', 'sus2'],
  ['dim', 'dim'], ['°', 'dim'], ['aug', 'aug'], ['+', 'aug'], ['m7', 'm7'], ['m6', 'm6'], ['13', '13'], ['11', '11'], ['9', '9'],
  ['7', '7'], ['6', '6'], ['m', 'minor'], ['', 'major'],
]

export interface Chord { root: SpelledNote; quality: ChordQuality; bass?: SpelledNote }

export function parseChordSymbol(symbol: string): Chord {
  const match = /^([A-G](?:##|bb|#|b|♯|♭)?)([^/]*)(?:\/([A-G](?:##|bb|#|b|♯|♭)?))?$/.exec(symbol.trim())
  if (!match) throw new Error(`Invalid chord: ${symbol}`)
  const quality = SUFFIX_PARSE.find(([key]) => key === match[2])?.[1]
  if (!quality) throw new Error(`Unsupported chord: ${symbol}`)
  return { root: parseNote(match[1]), quality, ...(match[3] ? { bass: parseNote(match[3]) } : {}) }
}

export function chordNotes(chord: Pick<Chord, 'root' | 'quality'>): SpelledNote[] {
  return CHORD_FORMULAS[chord.quality].map(name => transposeUp(chord.root, name))
}

export function chordSymbol(chord: Chord): string {
  return noteLabel(chord.root) + QUALITY_SUFFIX[chord.quality] + (chord.bass ? `/${noteLabel(chord.bass)}` : '')
}

export function chordPcs(chord: Pick<Chord, 'root' | 'quality'>): number[] { return chordNotes(chord).map(pitchClass) }

/** Triad / seventh quality from stacked spelled thirds (root, third, fifth[, seventh]). */
export function qualityFromStack(notes: SpelledNote[]): ChordQuality | null {
  const third = intervalBetween(notes[0], notes[1])
  const fifth = intervalBetween(notes[0], notes[2])
  const triad = `${third.quality}${third.number}-${fifth.quality}${fifth.number}`
  const triadQuality = ({ 'M3-P5': 'major', 'm3-P5': 'minor', 'm3-d5': 'dim', 'M3-A5': 'aug' } as Record<string, ChordQuality>)[triad]
  if (!triadQuality) return null
  if (notes.length < 4) return triadQuality
  const seventh = intervalBetween(notes[0], notes[3])
  const key = `${triadQuality}-${seventh.quality}${seventh.number}`
  return ({ 'major-M7': 'maj7', 'major-m7': '7', 'minor-m7': 'm7', 'minor-M7': 'mMaj7', 'dim-m7': 'm7b5', 'dim-d7': 'dim7' } as Record<string, ChordQuality>)[key] ?? null
}

/** Identify chords from a set of pitch classes; returns every root/quality match (for ambiguity, e.g. C6 = Am7/C). */
export function identifyChord(pcs: number[], bassPc?: number): { rootPc: number; quality: ChordQuality; inversion: boolean }[] {
  const set = [...new Set(pcs.map(pc => ((pc % 12) + 12) % 12))].sort((a, b) => a - b)
  const results: { rootPc: number; quality: ChordQuality; inversion: boolean }[] = []
  const semis: Record<string, number> = { P1: 0, m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, A4: 6, d5: 6, P5: 7, A5: 8, m6: 8, M6: 9, d7: 9, m7: 10, M7: 11, M9: 2, P11: 5, M13: 9 }
  for (const rootPc of set) {
    for (const [quality, formula] of Object.entries(CHORD_FORMULAS) as [ChordQuality, string[]][]) {
      const formulaPcs = [...new Set(formula.map(name => (rootPc + semis[name]) % 12))].sort((a, b) => a - b)
      if (formulaPcs.length === set.length && formulaPcs.every((pc, i) => pc === set[i])) {
        results.push({ rootPc, quality, inversion: bassPc !== undefined && bassPc % 12 !== rootPc })
      }
    }
  }
  // Root-position readings first, then simpler qualities.
  const order = Object.keys(CHORD_FORMULAS)
  return results.sort((a, b) => Number(a.inversion) - Number(b.inversion) || order.indexOf(a.quality) - order.indexOf(b.quality))
}
