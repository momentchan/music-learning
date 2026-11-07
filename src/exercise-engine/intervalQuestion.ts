import { intervalLabel, parseInterval, transposeUp } from '../music-theory/intervals'
import { defaultSpelling, displayNote, noteId } from '../music-theory/notes'
import { STANDARD } from '../music-theory/guitar'
import type { Question } from './types'

export const intervalTitle = (name: string) => intervalLabel(name).split(' ')[0]

/** Choose readable spellings while preserving the interval's letter distance. */
export function intervalNotes(rootMidi: number, name: string) {
  const candidates = [false, true].map(flat => {
    const root = defaultSpelling(rootMidi, flat)
    return { root, target: transposeUp(root, name) }
  }).sort((a, b) => Math.abs(a.target.acc) - Math.abs(b.target.acc))
  const { root, target } = candidates[0]
  return { name, root: noteId(root), target: noteId(target), rootMidi, targetMidi: rootMidi + parseInterval(name).semitones }
}

/** Present saved questions without regenerating their positions or review evidence. */
export function presentIntervalQuestion(q: Question): Question {
  if (q.nodeId !== 'interval.shapes') return q
  const name = q.interval?.name ?? q.reviewItemIds.find(id => id.startsWith('interval.shape.'))?.split('.')[2]
  const position = q.kind === 'fret-locate' && q.reference ? [q.reference.string, q.reference.fret] : q.display?.positions?.[0]
  if (!name || (!q.interval && !position)) return q
  const rootMidi = q.interval?.rootMidi ?? (q.kind === 'fret-locate' ? q.tuning : STANDARD.midi)[6 - position![0]] + position![1]
  const interval = q.interval ?? intervalNotes(rootMidi, name)
  const root = displayNote(interval.root)
  if (q.kind === 'fret-locate') return {
    ...q, interval, prompt: `找出 ${root} 上方的${intervalTitle(name)}`,
    targetLabel: displayNote(interval.target), reference: q.reference && { ...q.reference, label: root },
    display: q.display && { ...q.display, positions: q.display.positions?.map(([s, f], i) => [s, f, i === 0 ? root : '?']) },
  }
  if (q.kind === 'choice') return {
    ...q, interval, prompt: '這兩個音相差什麼音程？',
    display: q.display && { ...q.display, positions: q.display.positions?.map(([s, f], i) => [s, f, i === 0 ? root : '?']) },
  }
  return { ...q, interval }
}

export const intervalRelation = (q: Question) => q.interval
  ? `${displayNote(q.interval.root)} → ${displayNote(q.interval.target)} · ${intervalTitle(q.interval.name)}` : ''
