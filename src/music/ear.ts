import { CHORD_INTERVALS, INTERVALS, chordVoicing, type ChordQuality } from './theory'

export interface SoundEvent { notes: number[]; duration: number }
export type EarType = 'interval' | 'triad' | 'seventh' | 'degree' | 'cadence' | 'bass' | 'progression'
export interface EarQuestion {
  id: string; type: EarType; prompt: string; events: SoundEvent[];
  reference?: SoundEvent[]; choices: string[]; answer: string;
  explanation: string; reveal: string; focusNotes: string;
}
const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]
const randomRoot = () => 55 + Math.floor(Math.random() * 9)
const chordAt = (root: number, quality: ChordQuality) => CHORD_INTERVALS[quality].map(n => root + n)
const event = (notes: number[], duration = 0.8): SoundEvent => ({ notes, duration })

export function makeEarQuestion(type: EarType): EarQuestion {
  const root = randomRoot()
  const base = { id: crypto.randomUUID(), type }
  if (type === 'interval') {
    const target = pick(INTERVALS.slice(0, 12)); const mode = pick(['ascending', 'descending', 'harmonic'] as const)
    const notes = mode === 'descending' ? [root + target.semitones, root] : [root, root + target.semitones]
    const choices = [target.name, ...INTERVALS.filter(i => i.name !== target.name).sort(() => Math.random() - 0.5).slice(0, 3).map(i => i.name)].sort(() => Math.random() - 0.5)
    return { ...base, prompt: `Which interval do you hear? (${mode})`, events: mode === 'harmonic' ? [event(notes, 1.2)] : notes.map(n => event([n], 0.7)),
      choices, answer: target.name, explanation: `${target.name} spans ${target.semitones} semitone${target.semitones === 1 ? '' : 's'}.`, reveal: `The notes are ${notes.join(' → ')} in MIDI pitches.`, focusNotes: `${target.name}: ${target.semitones} semitones` }
  }
  if (type === 'triad' || type === 'seventh') {
    const quality = pick(type === 'triad' ? ['major', 'minor'] as const : ['maj7', 'm7', '7', 'm7b5'] as const)
    const labels: Record<string, string> = { major: 'Major', minor: 'Minor', maj7: 'Major seventh', m7: 'Minor seventh', '7': 'Dominant seventh', m7b5: 'Half-diminished seventh' }
    const keys = type === 'triad' ? ['major', 'minor'] : ['maj7', 'm7', '7', 'm7b5']
    return { ...base, prompt: type === 'triad' ? 'Major or minor?' : 'Which seventh-chord quality?', events: [event(chordAt(root, quality), 1.5)],
      choices: keys.map(k => labels[k]), answer: labels[quality], explanation: `The defining intervals are ${CHORD_INTERVALS[quality].join(', ')} semitones above the root.`, reveal: `${labels[quality]} chord`, focusNotes: `${labels[quality]}: ${CHORD_INTERVALS[quality].join(' · ')}` }
  }
  if (type === 'degree') {
    const degree = 1 + Math.floor(Math.random() * 7)
    const offsets = [0, 2, 4, 5, 7, 9, 11]
    const tonic = 60 + root % 12
    return { ...base, prompt: 'Which major-scale degree follows the tonic?', reference: [event([tonic], 0.8)], events: [event([tonic], 0.6), event([tonic + offsets[degree - 1]], 0.9)],
      choices: Array.from({ length: 7 }, (_, i) => `Degree ${i + 1}`), answer: `Degree ${degree}`,
      explanation: `Degree ${degree} is ${offsets[degree - 1]} semitones above the tonic in a major scale.`, reveal: `Tonic to degree ${degree}`, focusNotes: `+${offsets[degree - 1]} semitones` }
  }
  if (type === 'cadence') {
    const cadence = pick(['Authentic (V–I)', 'Plagal (IV–I)', 'Half (I–V)'] as const)
    const tonic = root - root % 12 + 48
    const tonicChord = chordAt(tonic, 'major')
    const dominant = chordAt(tonic + 7, '7')
    const subdominant = chordAt(tonic + 5, 'major')
    const chords = cadence.startsWith('Authentic') ? [dominant, tonicChord] : cadence.startsWith('Plagal') ? [subdominant, tonicChord] : [tonicChord, dominant]
    return { ...base, prompt: 'What kind of cadence do you hear?', events: chords.map(n => event(n, 1.15)),
      choices: ['Authentic (V–I)', 'Plagal (IV–I)', 'Half (I–V)'], answer: cadence,
      explanation: `${cadence} describes the final harmonic motion.`, reveal: cadence, focusNotes: cadence }
  }
  if (type === 'bass') {
    const movement = pick([{ name: 'Up a fourth', semitones: 5 }, { name: 'Up a fifth', semitones: 7 }, { name: 'Down a fifth', semitones: -7 }, { name: 'Down a step', semitones: -2 }])
    const low = 52
    return { ...base, prompt: 'How does the bass move?', events: [event([low], 0.8), event([low + movement.semitones], 0.8)],
      choices: ['Up a fourth', 'Up a fifth', 'Down a fifth', 'Down a step'], answer: movement.name,
      explanation: `${movement.name} spans ${Math.abs(movement.semitones)} semitones.`, reveal: movement.name, focusNotes: movement.name }
  }
  const patterns = [
    { name: 'ii–V–I', chords: ['Dm7', 'G7', 'Cmaj7'] },
    { name: 'I–vi–IV', chords: ['C', 'Am', 'F'] },
    { name: 'I–IV–V', chords: ['C', 'F', 'G'] },
  ]
  const pattern = pick(patterns)
  const transpose = Math.floor(Math.random() * 7) - 3
  return { ...base, prompt: 'Which progression do you hear?', events: pattern.chords.map(c => event(chordVoicing(c).map(n => n + transpose), 0.9)),
    choices: patterns.map(p => p.name), answer: pattern.name, explanation: `Listen for the bass and resolution in ${pattern.chords.join(' → ')}.`,
    reveal: pattern.chords.join(' → '), focusNotes: pattern.name }
}
