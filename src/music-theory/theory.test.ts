import { describe, expect, it } from 'vitest'
import {
  CHORD_SHAPES, STANDARD, TUNINGS, analyzeInMajorKey, chordNotes, chordPcs, diatonicChords, identifyChord, intervalBetween,
  invertInterval, keySignature, midiAt, noteId, noteLabel, parseChordSymbol, parseInterval, parseNote, pitchClass,
  positionsOfMidi, positionsOfPc, relativeMinor, scaleNotes, shapeMidi, transposeChord, transposeUp,
} from '.'

const spell = (notes: { letter: string; acc: number }[]) => notes.map(n => noteId(n as never)).join(' ')
const chord = (symbol: string) => spell(chordNotes(parseChordSymbol(symbol)))

describe('notes and spelling', () => {
  it('separates pitch from spelling', () => {
    expect(pitchClass(parseNote('E#'))).toBe(5)
    expect(pitchClass(parseNote('Cb'))).toBe(11)
    expect(pitchClass(parseNote('F##'))).toBe(7)
    expect(noteLabel(parseNote('Bb'))).toBe('B♭')
    expect(noteLabel(parseNote('Fx'))).toBe('F𝄪')
  })
})

describe('intervals', () => {
  it('names intervals from spelling, not just semitones', () => {
    expect(intervalBetween(parseNote('C'), parseNote('E#'))).toMatchObject({ quality: 'A', number: 3, semitones: 5 })
    expect(intervalBetween(parseNote('C'), parseNote('F'))).toMatchObject({ quality: 'P', number: 4 })
    expect(intervalBetween(parseNote('B'), parseNote('F'))).toMatchObject({ quality: 'd', number: 5 })
    expect(intervalBetween(parseNote('F'), parseNote('B'))).toMatchObject({ quality: 'A', number: 4 })
    expect(intervalBetween(parseNote('E'), parseNote('C'))).toMatchObject({ quality: 'm', number: 6 })
  })
  it('constructs spelled intervals above any root', () => {
    expect(noteId(transposeUp(parseNote('Eb'), 'M3'))).toBe('G')
    expect(noteId(transposeUp(parseNote('F#'), 'M3'))).toBe('A#')
    expect(noteId(transposeUp(parseNote('Ab'), 'm3'))).toBe('Cb')
    expect(noteId(transposeUp(parseNote('C'), 'A4'))).toBe('F#')
    expect(noteId(transposeUp(parseNote('C'), 'd5'))).toBe('Gb')
    expect(noteId(transposeUp(parseNote('D'), 'M9'))).toBe('E')
    expect(parseInterval('M10').semitones).toBe(16)
  })
  it('inverts intervals', () => {
    expect(invertInterval('M3')).toBe('m6')
    expect(invertInterval('P4')).toBe('P5')
    expect(invertInterval('A4')).toBe('d5')
  })
})

describe('chords', () => {
  it('spells the anchor chords from the spec', () => {
    expect(chord('F#m7b5')).toBe('F# A C E')
    expect(chord('Cmaj7')).toBe('C E G B')
    expect(chord('G7')).toBe('G B D F')
    expect(chord('Gsus4')).toBe('G C D')
    expect(chord('Dm7')).toBe('D F A C')
    expect(chord('Bbdim7')).toBe('Bb Db Fb Abb')
    expect(chord('Ebaug')).toBe('Eb G B')
  })
  it('parses slash chords', () => {
    const c = parseChordSymbol('G/B')
    expect(noteId(c.bass!)).toBe('B')
    expect(c.quality).toBe('major')
  })
  it('identifies note sets and keeps ambiguity (C6 = Am7/C)', () => {
    const results = identifyChord([0, 4, 7, 9], 0)
    expect(results[0]).toMatchObject({ rootPc: 0, quality: '6', inversion: false })
    expect(results.some(r => r.rootPc === 9 && r.quality === 'm7' && r.inversion)).toBe(true)
  })
})

describe('scales and keys', () => {
  it('spells scales per key', () => {
    expect(spell(scaleNotes(parseNote('Eb'), 'major'))).toBe('Eb F G Ab Bb C D')
    expect(spell(scaleNotes(parseNote('F#'), 'major'))).toBe('F# G# A# B C# D# E#')
    expect(spell(scaleNotes(parseNote('G'), 'mixolydian'))).toBe('G A B C D E F')
    expect(spell(scaleNotes(parseNote('A'), 'harmonicMinor'))).toBe('A B C D E F G#')
    expect(spell(scaleNotes(parseNote('D'), 'dorian'))).toBe('D E F G A B C')
  })
  it('knows key signatures and relative keys', () => {
    expect(spell(keySignature(parseNote('D')).accidentals)).toBe('F# C#')
    expect(keySignature(parseNote('Eb')).flats).toBe(3)
    expect(spell(keySignature(parseNote('Ab')).accidentals)).toBe('Bb Eb Ab Db')
    expect(noteId(relativeMinor(parseNote('G')))).toBe('E')
    expect(keySignature(parseNote('E'), 'minor').sharps).toBe(1)
  })
  it('builds diatonic triads and sevenths with Roman numerals', () => {
    expect(diatonicChords(parseNote('C')).map(d => d.numeral)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
    expect(diatonicChords(parseNote('C'), 'major', true).map(d => d.numeral)).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7'])
    expect(diatonicChords(parseNote('A'), 'harmonicMinor').map(d => d.numeral)).toEqual(['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'])
    expect(spell(diatonicChords(parseNote('D'))[4].notes)).toBe('A C# E')
  })
})

describe('context-dependent analysis', () => {
  const labels = (symbol: string, key = 'C') => analyzeInMajorKey(symbol, key).map(r => r.label)
  it('labels diatonic chords and inversions', () => {
    expect(labels('Dm7')).toEqual(['ii7'])
    expect(labels('G7')).toEqual(['V7'])
    expect(labels('C/E')).toEqual(['I⁶'])
    expect(labels('Bdim')).toEqual(['vii°'])
  })
  it('offers several readings where analysis is interpretive', () => {
    expect(labels('D7')).toContain('V7/V')
    expect(labels('E7')).toEqual(expect.arrayContaining(['V7/vi', 'V7']))
    expect(labels('Fm')).toEqual(['iv'])
    expect(labels('Bb')).toEqual(['♭VII'])
    expect(labels('Ab')).toEqual(['♭VI'])
    expect(labels('C7')).toContain('V7/IV')
    expect(labels('Db7')).toContain('subV7')
    expect(labels('F#dim7')).toContain('vii°7/V')
    expect(analyzeInMajorKey('Fm', 'C')[0].kind).toBe('borrowed')
  })
  it('transposes progressions keeping sensible spelling', () => {
    expect(['C', 'G/B', 'Am', 'Fmaj7'].map(c => transposeChord(c, 'M2'))).toEqual(['D', 'A/C#', 'Bm', 'Gmaj7'])
    expect(['G', 'D', 'Em', 'C'].map(c => transposeChord(c, 'm3'))).toEqual(['Bb', 'F', 'Gm', 'Eb'])
    expect(transposeChord('E7', 'M3', true)).toBe('C7')
  })
})

describe('guitar mapping', () => {
  it('maps strings and frets, including open strings', () => {
    expect(midiAt(STANDARD, 6, 0)).toBe(40)
    expect(midiAt(STANDARD, 1, 0)).toBe(64)
    expect(midiAt(STANDARD, 5, 7)).toBe(52)
    expect(midiAt(TUNINGS.dropD, 6, 0)).toBe(38)
  })
  it('finds positions of a pitch class and exact pitch', () => {
    expect(positionsOfPc(STANDARD, 4, 0, 12, [6])).toEqual([{ string: 6, fret: 0 }, { string: 6, fret: 12 }])
    expect(positionsOfPc(STANDARD, 0, 0, 12)).toHaveLength(6) // C appears once per string in frets 0–12
    expect(positionsOfMidi(STANDARD, 64, 0, 12).map(p => `${p.string}:${p.fret}`)).toEqual(['1:0', '2:5', '3:9'])
  })
  it('every shape in the library sounds only its chord tones (fifth may be omitted), with the root in the bass', () => {
    for (const shape of CHORD_SHAPES) {
      const parsed = parseChordSymbol(shape.symbol)
      const pcs = new Set(chordPcs(parsed))
      const fifth = (pitchClass(parsed.root) + 7) % 12
      const sounding = shapeMidi(shape)
      const sounded = new Set(sounding.map(n => n.midi % 12))
      expect(sounding.every(n => pcs.has(n.midi % 12)), shape.id).toBe(true)
      expect([...pcs].filter(pc => pc !== fifth).every(pc => sounded.has(pc)), shape.id).toBe(true)
      expect(sounding[0].midi % 12, shape.id).toBe(pitchClass(parseChordSymbol(shape.symbol).root))
      expect(shape.frets.length).toBe(6)
      shape.frets.forEach((fret, i) => expect(fret <= 0 ? shape.fingers[i] === 0 : shape.fingers[i] > 0, `${shape.id} finger ${i}`).toBe(true))
    }
  })
})
