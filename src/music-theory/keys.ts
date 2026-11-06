import { chordNotes, chordPcs, parseChordSymbol, qualityFromStack, type Chord, type ChordQuality } from './chords'
import { invertInterval, transposeUp } from './intervals'
import { noteLabel, parseNote, pitchClass, type SpelledNote } from './notes'

export type ScaleType =
  | 'major' | 'naturalMinor' | 'harmonicMinor' | 'melodicMinor' | 'majorPentatonic' | 'minorPentatonic' | 'blues'
  | 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian'

export const SCALE_FORMULAS: Record<ScaleType, string[]> = {
  major: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'],
  naturalMinor: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  harmonicMinor: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'M7'],
  melodicMinor: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'M7'],
  majorPentatonic: ['P1', 'M2', 'M3', 'P5', 'M6'],
  minorPentatonic: ['P1', 'm3', 'P4', 'P5', 'm7'],
  blues: ['P1', 'm3', 'P4', 'd5', 'P5', 'm7'],
  ionian: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'M7'],
  dorian: ['P1', 'M2', 'm3', 'P4', 'P5', 'M6', 'm7'],
  phrygian: ['P1', 'm2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  lydian: ['P1', 'M2', 'M3', 'A4', 'P5', 'M6', 'M7'],
  mixolydian: ['P1', 'M2', 'M3', 'P4', 'P5', 'M6', 'm7'],
  aeolian: ['P1', 'M2', 'm3', 'P4', 'P5', 'm6', 'm7'],
  locrian: ['P1', 'm2', 'm3', 'P4', 'd5', 'm6', 'm7'],
}

/** The tone that distinguishes each mode from the closest major or minor scale. */
export const CHARACTERISTIC_TONE: Partial<Record<ScaleType, string>> = {
  dorian: 'M6', phrygian: 'm2', lydian: 'A4', mixolydian: 'm7', aeolian: 'm6', locrian: 'd5', harmonicMinor: 'M7',
}

export function scaleNotes(tonic: SpelledNote, type: ScaleType): SpelledNote[] {
  return SCALE_FORMULAS[type].map(name => transposeUp(tonic, name))
}

/** Major keys usable as practice contexts (spelling stays within single accidentals). */
export const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'] as const
export const MINOR_KEYS = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Bb', 'F', 'C', 'G', 'D'] as const

export interface KeySignature { sharps: number; flats: number; accidentals: SpelledNote[] }
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

export function keySignature(tonic: SpelledNote, mode: 'major' | 'minor' = 'major'): KeySignature {
  const notes = scaleNotes(tonic, mode === 'major' ? 'major' : 'naturalMinor')
  const sharps = notes.filter(n => n.acc > 0).sort((a, b) => SHARP_ORDER.indexOf(a.letter) - SHARP_ORDER.indexOf(b.letter))
  const flats = notes.filter(n => n.acc < 0).sort((a, b) => FLAT_ORDER.indexOf(a.letter) - FLAT_ORDER.indexOf(b.letter))
  return { sharps: sharps.length, flats: flats.length, accidentals: sharps.length ? sharps : flats }
}

export function relativeMinor(majorTonic: SpelledNote): SpelledNote { return transposeUp(majorTonic, 'M6') }
export function relativeMajor(minorTonic: SpelledNote): SpelledNote { return transposeUp(minorTonic, 'm3') }

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export interface DiatonicChord { degree: number; chord: Chord; numeral: string; notes: SpelledNote[] }
export type KeyMode = 'major' | 'naturalMinor' | 'harmonicMinor'

export function romanNumeral(degree: number, quality: ChordQuality, prefix = ''): string {
  const base = NUMERALS[degree - 1]
  const upper = ['major', 'aug', 'maj7', '7'].includes(quality)
  const numeral = upper ? base : base.toLowerCase()
  const suffix: Partial<Record<ChordQuality, string>> = { dim: '°', aug: '+', maj7: 'maj7', '7': '7', m7: '7', m7b5: 'ø7', dim7: '°7', mMaj7: '(maj7)' }
  return prefix + numeral + (suffix[quality] ?? '')
}

export function diatonicChords(tonic: SpelledNote, mode: KeyMode = 'major', sevenths = false): DiatonicChord[] {
  const scale = scaleNotes(tonic, mode)
  // Stacks without a supported quality (e.g. the augmented-major-7th III in harmonic minor) are omitted.
  return scale.flatMap((root, i) => {
    const stack = [0, 2, 4, ...(sevenths ? [6] : [])].map(step => scale[(i + step) % 7])
    const quality = qualityFromStack(stack)
    return quality ? [{ degree: i + 1, chord: { root, quality }, numeral: romanNumeral(i + 1, quality), notes: stack }] : []
  })
}

export type Function = 'tonic' | 'predominant' | 'dominant'
/** Common functional grouping in major keys. iii is genuinely ambiguous (tonic or dominant-like), so it returns both. */
export function majorDegreeFunctions(degree: number): Function[] {
  return ({ 1: ['tonic'], 2: ['predominant'], 3: ['tonic', 'dominant'], 4: ['predominant'], 5: ['dominant'], 6: ['tonic', 'predominant'], 7: ['dominant'] } as Record<number, Function[]>)[degree]
}

// ---- Ambiguity-aware analysis -------------------------------------------------

export interface Reading {
  label: string
  kind: 'diatonic' | 'secondary-dominant' | 'secondary-leading-tone' | 'borrowed' | 'tritone-sub' | 'tonicization'
  confidence: 'common' | 'possible'
  note: string
}

const sameChordPitch = (a: Chord, b: Chord) => pitchClass(a.root) === pitchClass(b.root) && a.quality === b.quality

function inversionFigure(chord: Chord): string {
  if (!chord.bass) return ''
  const notes = chordNotes(chord)
  const position = notes.findIndex(n => pitchClass(n) === pitchClass(chord.bass!))
  if (position <= 0) return ''
  const seventh = notes.length >= 4
  return seventh ? ['', '⁶₅', '⁴₃', '⁴₂'][position] ?? '' : ['', '⁶', '⁶₄'][position] ?? ''
}

/**
 * All reasonable Roman-numeral readings of `symbol` in a major key. Deterministic, but returns several
 * readings where analysis is context-dependent (e.g. D7 in C → V7/V; E7 → V7/vi or V7 of A minor).
 */
export function analyzeInMajorKey(symbol: string, tonicName: string): Reading[] {
  const tonic = parseNote(tonicName)
  const chord = parseChordSymbol(symbol)
  const figure = inversionFigure(chord)
  const readings: Reading[] = []
  const triads = diatonicChords(tonic, 'major')
  const sevenths = diatonicChords(tonic, 'major', true)
  const keyName = noteLabel(tonic)

  for (const list of [triads, sevenths]) {
    const match = list.find(d => sameChordPitch(d.chord, { root: chord.root, quality: chord.quality }))
    if (match) readings.push({ label: match.numeral + figure, kind: 'diatonic', confidence: 'common', note: `${keyName} 大調的第 ${match.degree} 級順階和弦。` })
  }

  const rootPc = pitchClass(chord.root)
  // Secondary dominants: major triad or dominant 7th a P5 above a diatonic target (ii, iii, IV, V, vi).
  if ((chord.quality === 'major' || chord.quality === '7') && !readings.length) {
    for (const target of triads.slice(1, 6)) {
      if ((pitchClass(target.chord.root) + 7) % 12 === rootPc) {
        const targetNumeral = target.numeral.replace('°', '')
        readings.push({ label: `V${chord.quality === '7' ? '7' : ''}${figure}/${targetNumeral}`, kind: 'secondary-dominant', confidence: 'common', note: `通往 ${chordNameOf(target.chord)}（${targetNumeral}）的次屬和弦。` })
        readings.push({ label: `V${chord.quality === '7' ? '7' : ''}${figure}`, kind: 'tonicization', confidence: 'possible', note: `也可以視為短暫轉向 ${noteLabel(target.chord.root)} ${target.chord.quality === 'minor' ? '小調' : '大調'} 的 V。` })
      }
    }
  }
  // Secondary leading-tone chords: diminished-family chord a semitone below a diatonic target.
  if (['dim', 'dim7', 'm7b5'].includes(chord.quality) && !readings.some(r => r.kind === 'diatonic')) {
    for (const target of triads.slice(1, 6)) {
      if ((pitchClass(target.chord.root) + 11) % 12 === rootPc) {
        const suffix = chord.quality === 'dim7' ? '°7' : chord.quality === 'm7b5' ? 'ø7' : '°'
        readings.push({ label: `vii${suffix}${figure}/${target.numeral.replace('°', '')}`, kind: 'secondary-leading-tone', confidence: 'common', note: `通往 ${chordNameOf(target.chord)} 的次導和弦。` })
      }
    }
  }
  // Borrowed from the parallel minor (modal mixture).
  if (!readings.length) {
    const majorScale = scaleNotes(tonic, 'major')
    for (const mode of ['naturalMinor', 'harmonicMinor'] as const) {
      for (const list of [diatonicChords(tonic, mode), diatonicChords(tonic, mode, true)]) {
        const match = list.find(d => sameChordPitch(d.chord, { root: chord.root, quality: chord.quality }))
        if (match && !readings.some(r => r.kind === 'borrowed')) {
          const lowered = pitchClass(match.chord.root) !== pitchClass(majorScale[match.degree - 1])
          readings.push({ label: romanNumeral(match.degree, match.chord.quality, lowered ? '♭' : '') + figure, kind: 'borrowed', confidence: 'common', note: `從同主音小調（${keyName} 小調）借來的和弦；這是一種分析詮釋。` })
        }
      }
    }
  }
  // Tritone substitution: dominant 7th a semitone above a diatonic target.
  if (chord.quality === '7') {
    for (const target of triads) {
      if ((pitchClass(target.chord.root) + 1) % 12 === rootPc) {
        const targetNumeral = target.numeral.replace('°', '')
        readings.push({ label: target.degree === 1 ? 'subV7' : `subV7/${targetNumeral}`, kind: 'tritone-sub', confidence: 'possible', note: `可視為 ${chordNameOf(target.chord)} 的三全音代理（取代 V7${target.degree === 1 ? '' : '/' + targetNumeral}）。` })
      }
    }
  }
  return readings
}

export function chordNameOf(chord: Chord): string {
  const suffix = ({ major: '', minor: 'm', dim: '°', aug: '+', maj7: 'maj7', m7: 'm7', '7': '7', m7b5: 'm7♭5', dim7: '°7' } as Partial<Record<ChordQuality, string>>)[chord.quality] ?? chord.quality
  return noteLabel(chord.root) + suffix
}

/** Transpose a chord symbol by a spelled interval, preserving quality and slash bass. */
export function transposeChord(symbol: string, interval: string, down = false): string {
  const chord = parseChordSymbol(symbol)
  const move = (n: SpelledNote) => down ? transposeDown(n, interval) : transposeUp(n, interval)
  return chordSymbolAscii({ root: move(chord.root), quality: chord.quality, ...(chord.bass ? { bass: move(chord.bass) } : {}) })
}

function transposeDown(n: SpelledNote, interval: string): SpelledNote {
  // Going down by a simple interval lands on the same pitch class as going up by its inversion.
  return transposeUp(n, invertInterval(interval))
}

export function chordSymbolAscii(chord: Chord): string {
  const id = (n: SpelledNote) => n.letter + (n.acc > 0 ? '#'.repeat(n.acc) : 'b'.repeat(-n.acc))
  const suffix: Record<ChordQuality, string> = { major: '', minor: 'm', dim: 'dim', aug: 'aug', maj7: 'maj7', m7: 'm7', '7': '7', m7b5: 'm7b5', dim7: 'dim7', mMaj7: 'mMaj7', sus2: 'sus2', sus4: 'sus4', add9: 'add9', '6': '6', m6: 'm6', '9': '9', maj9: 'maj9', m9: 'm9', '11': '11', '13': '13' }
  return id(chord.root) + suffix[chord.quality] + (chord.bass ? `/${id(chord.bass)}` : '')
}

export { chordPcs }
