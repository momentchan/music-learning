import { useState } from 'react'
import { displayNote } from '../music-theory/notes'

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const ACCIDENTALS = [{ id: 'b', label: '♭' }, { id: '', label: '♮' }, { id: '#', label: '♯' }]

/**
 * Spelled-note input: choose a letter and an accidental. Spelling matters (C♯ vs D♭),
 * so the picker never converts between enharmonic names.
 */
export function NotePicker({ slots, disabled, onSubmit, submitLabel = '送出', autoSubmitSingle = false }: { slots: number; autoSubmitSingle?: boolean; disabled?: boolean; onSubmit: (notes: string[]) => void; submitLabel?: string }) {
  const [notes, setNotes] = useState<string[]>([])
  const [accidental, setAccidental] = useState('')
  const add = (letter: string) => {
    if (disabled) return
    if (autoSubmitSingle && slots === 1) { onSubmit([letter + accidental]); return }
    setNotes(previous => previous.length >= slots ? [...previous.slice(0, slots - 1), letter + accidental] : [...previous, letter + accidental])
    setAccidental('')
  }
  return <div className="note-picker">
    {!autoSubmitSingle && <div className="picker-slots" aria-live="polite" aria-label="已輸入的音">
      {Array.from({ length: slots }, (_, i) => <span key={i} className={notes[i] ? 'filled' : ''}>{notes[i] ? displayNote(notes[i]) : '＿'}</span>)}
      {notes.length > 0 && <button type="button" className="picker-clear" disabled={disabled} onClick={() => setNotes(notes.slice(0, -1))} aria-label="刪除最後一個音">⌫</button>}
    </div>}
    <div className="picker-accidentals" role="radiogroup" aria-label="升降記號">
      {ACCIDENTALS.map(a => <button type="button" key={a.label} role="radio" aria-checked={accidental === a.id} className={accidental === a.id ? 'active' : ''} disabled={disabled} onClick={() => setAccidental(a.id)} aria-label={a.id === 'b' ? '降記號' : a.id === '#' ? '升記號' : '還原（無升降）'}>{a.label}</button>)}
    </div>
    <div className="picker-letters">
      {LETTERS.map(l => <button type="button" key={l} disabled={disabled} onClick={() => add(l)} aria-label={`輸入 ${displayNote(l + accidental)}`}>{displayNote(l + accidental)}</button>)}
    </div>
    {!autoSubmitSingle && <button type="button" className="primary-button wide" disabled={disabled || notes.length !== slots} onClick={() => onSubmit(notes)}>{submitLabel}</button>}
  </div>
}

/** Single note choice that accepts either spelling of a black-key note (used for fretboard naming). */
export function PitchPicker({ disabled, onPick }: { disabled?: boolean; onPick: (note: string) => void }) {
  const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
  const alt: Record<string, string> = { 'C#': 'D♭', Eb: 'D♯', 'F#': 'G♭', Ab: 'G♯', Bb: 'A♯' }
  return <div className="pitch-picker">
    {notes.map(n => <button type="button" key={n} disabled={disabled} onClick={() => onPick(n)} className={alt[n] ? 'black' : ''}>
      {displayNote(n)}{alt[n] && <small>{alt[n]}</small>}
    </button>)}
  </div>
}
