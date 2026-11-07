import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { PC_SHARP, displayNote } from '../../music-theory/notes'
import { nextPosition, stringOrder, type BoardOrientation } from './projection'

export type MarkTone = 'root' | 'target' | 'selected' | 'correct' | 'wrong' | 'reference' | 'neutral'
export interface FretMark { string: number; fret: number; label?: string; tone: MarkTone }
export interface FretboardProps {
  tuning: readonly number[]; minFret?: number; maxFret?: number; orientation: BoardOrientation
  marks?: FretMark[]; showNoteNames?: boolean; onSelect?: (string: number, fret: number, inputMethod?: 'tap' | 'keyboard') => void
  fitHeight?: number; cellLabel?: (string: number, fret: number) => string; selectableRange?: readonly [number, number]; disabled?: boolean; label: string; leftHanded?: boolean
}
export const positionLabel = (string: number, fret: number) => `第 ${string} 弦 ${fret === 0 ? '空弦' : `第 ${fret} 格`}`
const COLORS: Record<MarkTone, string> = { root: '#e9ae6a', reference: '#e9ae6a', target: '#397191', selected: '#d16f55', correct: '#287a58', wrong: '#9c443d', neutral: '#334351' }
const LABELS: Record<MarkTone, string> = { root: '根音', reference: '參考', target: '目標', selected: '選取', correct: '正確', wrong: '錯誤', neutral: '標示' }

/** Shared projection for course, explorer, feedback and progress. Music coordinates never mirror. */
export function Fretboard({ tuning, minFret = 0, maxFret = 12, orientation, marks = [], showNoteNames = false, onSelect, disabled, label, leftHanded = false, selectableRange, fitHeight, cellLabel }: FretboardProps) {
  const ref = useRef<SVGSVGElement>(null)
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const order = stringOrder(orientation, leftHanded)
  const [focus, setFocus] = useState({ string: order[0], fret: minFret })
  const vertical = orientation === 'vertical'
  const frets = Array.from({ length: maxFret - minFret + 1 }, (_, i) => i + minFret)
  const margin = 40, step = vertical && fitHeight ? Math.max(12, (fitHeight - margin - 8) / frets.length) : 64, stringStep = 52
  const wires = [margin]
  for (const fret of frets) {
    const distance = orientation === 'playing' && frets.length > 5 && fret > 0 ? Math.max(44, 90 * 2 ** (-(fret - 1) / 12)) : step
    wires.push(wires[wires.length - 1] + distance)
  }
  const width = vertical ? 340 : wires[wires.length - 1] + 8
  const height = vertical ? wires[wires.length - 1] + 8 : 342
  const mirror = !vertical && orientation === 'playing' && leftHanded
  const project = (string: number, fret: number) => {
    const i = fret - minFret
    const along = (wires[i] + wires[i + 1]) / 2
    const across = margin + order.indexOf(string) * stringStep
    return vertical ? { x: across, y: along } : { x: mirror ? width - along : along, y: across }
  }
  const edge = (index: number) => { const at = wires[index]; return mirror ? width - at : at }
  const move = (event: PointerEvent) => { if (gesture.current && Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 8) gesture.current.moved = true }
  const key = (event: KeyboardEvent, string: number, fret: number) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!disabled) onSelect?.(string, fret, 'keyboard'); return }
    if (!event.key.startsWith('Arrow')) return
    event.preventDefault()
    const next = nextPosition(string, fret, event.key, orientation, leftHanded, selectableRange?.[0] ?? minFret, selectableRange?.[1] ?? maxFret)
    setFocus(next)
    ref.current?.querySelector<SVGGElement>(`[data-cell="${next.string}-${next.fret}"]`)?.focus()
  }
  const marksByCell = new Map(marks.map(m => [`${m.string}-${m.fret}`, m]))
  const initialFret = Math.max(selectableRange?.[0] ?? minFret, Math.min(selectableRange?.[1] ?? maxFret, focus.fret))
  return <div className={`shared-fretboard ${vertical ? 'is-vertical' : orientation === 'playing' ? 'is-playing' : 'is-horizontal'}`}>
    <svg ref={ref} className={`fretboard ${vertical ? 'vertical' : ''}`} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={label}>
      <rect x={vertical ? margin : 8} y={vertical ? 8 : margin} width={vertical ? stringStep * 5 : width - 16} height={vertical ? height - 16 : stringStep * 5} fill="#362c26"/>
      {frets.map((f, i) => {
        const at = edge(i + 1)
        return vertical ? <line key={f} x1={margin} x2={margin + stringStep * 5} y1={at} y2={at} stroke="#b1aaa0" strokeWidth="2"/> : <line key={f} x1={at} x2={at} y1={margin} y2={margin + stringStep * 5} stroke="#b1aaa0" strokeWidth="2"/>
      })}
      {minFret === 0 && (vertical ? <rect x={margin - 3} y={margin + step - 3} width={stringStep * 5 + 6} height="6" fill="#ead9be"/> : <rect x={edge(1) - 3} y={margin - 3} width="6" height={stringStep * 5 + 6} fill="#ead9be"/>)}
      {frets.filter(f => [3, 5, 7, 9, 12].includes(f)).flatMap(f => {
        const a = project(3, f), b = project(4, f)
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2
        return (f === 12 ? [-stringStep, stringStep] : [0]).map(offset => <circle key={`${f}-${offset}`} cx={x + (vertical ? offset : 0)} cy={y + (vertical ? 0 : offset)} r="6" fill="#d5c6aa" opacity=".6"/>)
      })}
      {order.map(string => {
        const a = project(string, minFret), b = project(string, maxFret)
        return <g key={string}>
          <line x1={vertical ? a.x : Math.min(edge(0), edge(frets.length))} x2={vertical ? a.x : Math.max(edge(0), edge(frets.length))} y1={vertical ? edge(0) : a.y} y2={vertical ? edge(frets.length) : a.y} stroke="#c5bdb1" strokeWidth={1 + (string - 1) * .35}/>
          <text x={vertical ? a.x : mirror ? width - 16 : 16} y={vertical ? 20 : a.y + 4} textAnchor="middle" className="svg-string-label">{string}</text>
        </g>
      })}
      {frets.map(f => { const p = project(1, f); return <text key={f} x={vertical ? 16 : p.x} y={vertical ? p.y + 4 : height - 15} textAnchor="middle" className="svg-fret-label">{f}</text> })}
      {order.flatMap(string => frets.map(fret => {
        const cellStep = wires[fret - minFret + 1] - wires[fret - minFret]
        const p = project(string, fret), mark = marksByCell.get(`${string}-${fret}`)
        const name = displayNote(PC_SHARP[(tuning[6 - string] + fret) % 12])
        const text = mark?.label ?? (showNoteNames ? name : '')
        const inRange = !selectableRange || (fret >= selectableRange[0] && fret <= selectableRange[1])
        const interactive = !!onSelect && !disabled && inRange
        return <g key={`${string}-${fret}`} data-cell={`${string}-${fret}`} className={`fret-cell${interactive ? ' interactive' : ''}`} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? (focus.string === string && initialFret === fret ? 0 : -1) : undefined}
          aria-disabled={onSelect && (disabled || !inRange) ? true : undefined} aria-label={cellLabel?.(string, fret) ?? `${positionLabel(string, fret)}${text ? `，${text}` : ''}${mark ? `（${LABELS[mark.tone]}）` : ''}`}
          onFocus={() => setFocus({ string, fret })} onKeyDown={e => { if (!inRange && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return }; key(e, string, fret) }}
          onPointerDown={e => { gesture.current = { x: e.clientX, y: e.clientY, moved: false } }} onPointerMove={move} onPointerCancel={() => { if (gesture.current) gesture.current.moved = true }}
          onClick={e => { if (interactive && (e.detail === 0 || !gesture.current?.moved)) onSelect!(string, fret); gesture.current = null }}>
          <rect x={p.x - (vertical ? stringStep : cellStep) / 2} y={p.y - (vertical ? cellStep : stringStep) / 2} width={vertical ? stringStep : cellStep} height={vertical ? cellStep : stringStep} fill="transparent"/>
          {mark && (mark.tone === 'root' || mark.tone === 'reference' ? <rect x={p.x - 14} y={p.y - 14} width="28" height="28" rx="3" fill={COLORS[mark.tone]}/> : <circle cx={p.x} cy={p.y} r="15" fill={COLORS[mark.tone]} stroke="#ecede8"/>)}
          {text && <text x={p.x} y={p.y + 4} textAnchor="middle" className="svg-note" style={{ fill: mark?.tone === 'root' || mark?.tone === 'reference' ? '#1b1611' : '#f7f5ef' }}>{text}</text>}
        </g>
      }))}
    </svg>
  </div>
}
