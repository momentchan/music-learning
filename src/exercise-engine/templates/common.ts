import { displayNote, mod12, PC_SHARP } from '../../music-theory/notes'
import type { Difficulty, EvidenceLevel, ExerciseTemplate } from '../types'

export function questionBase(template: Pick<ExerciseTemplate, 'id' | 'nodeId' | 'version' | 'evidenceLevel'>, seed: number, difficulty: Difficulty) {
  return {
    id: `${template.id}:${seed}`,
    templateId: template.id,
    generatorVersion: template.version,
    seed,
    nodeId: template.nodeId,
    difficulty,
    evidenceLevel: template.evidenceLevel as EvidenceLevel,
  }
}

/** "C", or "C♯ / D♭" for black keys. */
export function pcLabel(pc: number): string {
  const sharp = PC_SHARP[mod12(pc)]
  if (!sharp.includes('#')) return sharp
  const flat = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'][['C#', 'D#', 'F#', 'G#', 'A#'].indexOf(sharp)]
  return `${displayNote(sharp)} / ${displayNote(flat)}`
}

export const positionText = (string: number, fret: number) => fret === 0 ? `第 ${string} 弦空弦` : `第 ${string} 弦第 ${fret} 格`

/** Parse the suffix of an item ID after a prefix, e.g. itemPart('fret.note.C.s5', 'fret.note.') = ['C', 's5']. */
export function itemParts(itemId: string | undefined, prefix: string): string[] | null {
  return itemId?.startsWith(prefix) ? itemId.slice(prefix.length).split('.') : null
}
