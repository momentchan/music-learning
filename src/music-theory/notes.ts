// Spelled notes: pitch identity (pitch class / MIDI) is kept separate from written spelling.

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** A written note: letter plus accidental (-2 = double flat … +2 = double sharp). */
export interface SpelledNote { letter: Letter; acc: number }

export const mod12 = (n: number) => ((n % 12) + 12) % 12

/** Sharp-based pitch-class names, used for stable IDs (e.g. fretboard review items). */
export const PC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function parseNote(name: string): SpelledNote {
  const match = /^([A-Ga-g])(##|bb|#|b|x|♯♯|♭♭|♯|♭|𝄪|𝄫)?$/.exec(name.trim())
  if (!match) throw new Error(`Invalid note: ${name}`)
  const letter = match[1].toUpperCase() as Letter
  const accText = match[2] ?? ''
  const acc = ({ '': 0, '#': 1, '♯': 1, b: -1, '♭': -1, '##': 2, x: 2, '♯♯': 2, '𝄪': 2, bb: -2, '♭♭': -2, '𝄫': -2 } as Record<string, number>)[accText]
  return { letter, acc }
}

export const note = parseNote

export function pitchClass(n: SpelledNote): number { return mod12(LETTER_PC[n.letter] + n.acc) }
export function letterIndex(letter: Letter): number { return LETTERS.indexOf(letter) }
export function naturalPc(letter: Letter): number { return LETTER_PC[letter] }

/** ASCII spelling ("F#", "Bb", "C##") for IDs and storage. */
export function noteId(n: SpelledNote): string {
  return n.letter + (n.acc > 0 ? '#'.repeat(n.acc) : 'b'.repeat(-n.acc))
}

/** Display spelling with music symbols ("F♯", "B♭", "C𝄪"). */
export function noteLabel(n: SpelledNote): string {
  if (n.acc === 2) return `${n.letter}𝄪`
  if (n.acc === -2) return `${n.letter}𝄫`
  return n.letter + (n.acc > 0 ? '♯' : n.acc < 0 ? '♭' : '')
}

/** Converts any accepted spelling to its display label. */
export const displayNote = (name: string) => noteLabel(parseNote(name))

export function sameSpelling(a: SpelledNote, b: SpelledNote): boolean { return a.letter === b.letter && a.acc === b.acc }
export function enharmonic(a: SpelledNote, b: SpelledNote): boolean { return pitchClass(a) === pitchClass(b) }

/** Spell a pitch class on a given letter (returns null if it would need more than a double accidental). */
export function spellOnLetter(pc: number, letter: Letter): SpelledNote | null {
  let acc = mod12(pc - LETTER_PC[letter])
  if (acc > 6) acc -= 12
  return Math.abs(acc) <= 2 ? { letter, acc } : null
}

/** Default spelling of a pitch class without key context. */
export function defaultSpelling(pc: number, preferFlats = false): SpelledNote {
  return parseNote((preferFlats ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] : PC_SHARP)[mod12(pc)])
}

export function midiToFrequency(midi: number): number { return 440 * 2 ** ((midi - 69) / 12) }
export function octaveOf(midi: number): number { return Math.floor(midi / 12) - 1 }
