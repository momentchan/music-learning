import { chordVoicing } from './theory'
import type { SoundEvent } from './ear'

export interface Comparison { id: string; category: string; title: string; a: string[]; b: string[]; explanation: string; difference: string; aEvents?: SoundEvent[]; bEvents?: SoundEvent[] }
export const COMPARISONS: Comparison[] = [
  { id: 'c-cm', category: 'Chord quality', title: 'C / Cm', a: ['C'], b: ['Cm'], explanation: 'E becomes E♭. That lowered third changes major to minor.', difference: 'E → E♭ (third)' },
  { id: 'c-cmaj7', category: 'Chord quality', title: 'C / Cmaj7', a: ['C'], b: ['Cmaj7'], explanation: 'B adds a major seventh, one semitone below the tonic C.', difference: '+ B (major seventh)' },
  { id: 'g-g7', category: 'Chord quality', title: 'G / G7', a: ['G'], b: ['G7'], explanation: 'F adds the minor seventh that gives G7 its dominant color.', difference: '+ F (minor seventh)' },
  { id: 'dm-d', category: 'Chord quality', title: 'Dm / D', a: ['Dm'], b: ['D'], explanation: 'F becomes F♯, raising the chord third.', difference: 'F → F♯ (third)' },
  { id: 'f-fm', category: 'Chord quality', title: 'F / Fm', a: ['F'], b: ['Fm'], explanation: 'A becomes A♭, lowering the third.', difference: 'A → A♭ (third)' },
  { id: 'g-c', category: 'Harmonic resolution', title: 'G → C / G7 → C', a: ['G', 'C'], b: ['G7', 'C'], explanation: 'The F in G7 tends toward E in C, making the resolution more directed.', difference: '+ F in G7; F → E' },
  { id: 'em-am', category: 'Harmonic resolution', title: 'Em → Am / E7 → Am', a: ['Em', 'Am'], b: ['E7', 'Am'], explanation: 'G♯ in E7 leads by semitone to A; D adds the seventh.', difference: 'G → G♯; G♯ → A' },
  { id: 'f-c', category: 'Harmonic resolution', title: 'F → C / F → Fm → C', a: ['F', 'C'], b: ['F', 'Fm', 'C'], explanation: 'The borrowed Fm adds A♭, which can descend to G in C.', difference: 'A → A♭ → G' },
  { id: 'dm-g-c', category: 'Harmonic resolution', title: 'Dm → G → C / Dm → G7 → C', a: ['Dm', 'G', 'C'], b: ['Dm', 'G7', 'C'], explanation: 'The added F in G7 resolves to E in C.', difference: '+ F; F → E' },
  { id: 'root-smooth', category: 'Voice leading', title: 'Root positions / smooth inversions', a: ['C', 'F', 'G', 'C'], b: ['C', 'F', 'G', 'C'], explanation: 'The same chords can connect through nearby chord tones instead of resetting to root-position shapes.', difference: 'Upper voices move shorter distances',
    aEvents: [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]].map(notes => ({ notes, duration: 0.95 })),
    bEvents: [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]].map(notes => ({ notes, duration: 0.95 })) },
  { id: 'close-leaps', category: 'Voice leading', title: 'Close motion / larger leaps', a: ['C', 'Am', 'F', 'G'], b: ['C', 'Am', 'F', 'G'], explanation: 'Listen to the continuity of individual voices when adjacent chords share nearby notes.', difference: 'Close movement versus octave displacement',
    aEvents: [[60, 64, 67], [60, 64, 69], [60, 65, 69], [59, 62, 67]].map(notes => ({ notes, duration: 0.95 })),
    bEvents: [[48, 52, 55], [57, 60, 64], [41, 45, 48], [55, 59, 62]].map(notes => ({ notes, duration: 0.95 })) },
]
export function comparisonEvents(item: Comparison, side: 'a' | 'b'): SoundEvent[] {
  const explicit = side === 'a' ? item.aEvents : item.bEvents
  if (explicit) return explicit
  const chords = side === 'a' ? item.a : item.b
  const duration = Math.max(0.75, 3.2 / chords.length)
  return chords.map(symbol => ({ notes: chordVoicing(symbol), duration }))
}
