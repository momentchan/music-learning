import { useMemo, useRef, type KeyboardEvent } from 'react'
import { PC_SHARP, displayNote } from '../../music-theory/notes'

/** Shared SVG fretboard (spec §7.1). Renders and reports taps; it never computes music theory. */
export type MarkTone = 'root' | 'target' | 'selected' | 'correct' | 'wrong' | 'reference' | 'neutral'
export interface FretMark { string: number; fret: number; label?: string; tone: MarkTone }

export interface FretboardProps {
  tuning: readonly number[]
  minFret?: number
  maxFret?: number
  orientation: 'vertical' | 'horizontal'
  marks?: FretMark[]
  showNoteNames?: boolean
  onSelect?: (string: number, fret: number) => void
  disabled?: boolean
  label: string
  leftHanded?: boolean
}

const STRINGS = [6, 5, 4, 3, 2, 1]
const noteAt = (tuning: readonly number[], string: number, fret: number) => tuning[6 - string] + fret
const pcName = (midi: number) => displayNote(PC_SHARP[midi % 12])
export const positionLabel = (string: number, fret: number) => `第 ${string} 弦 ${fret === 0 ? '空弦' : `第 ${fret} 格`}`

const TONE_STYLE: Record<MarkTone, { fill: string; stroke: string; text: string; shape: 'circle' | 'square' | 'diamond' }> = {
  root: { fill: '#e9ae6a', stroke: '#ffe0b5', text: '#1b1611', shape: 'square' },
  target: { fill: '#3d6f8f', stroke: '#a8d8f5', text: '#f2f8fb', shape: 'circle' },
  selected: { fill: '#ee765e', stroke: '#ffd5a5', text: '#1d1210', shape: 'circle' },
  correct: { fill: '#3b9a70', stroke: '#b6efcf', text: '#f2fff8', shape: 'circle' },
  wrong: { fill: '#bb594e', stroke: '#ffd4c9', text: '#fff4f1', shape: 'diamond' },
  reference: { fill: '#e9ae6a', stroke: '#ffe0b5', text: '#1b1611', shape: 'square' },
  neutral: { fill: '#2b333d', stroke: '#b6a994', text: '#e8e2d6', shape: 'circle' },
}

export function Fretboard({ tuning, minFret = 0, maxFret = 12, orientation, marks = [], showNoteNames = false, onSelect, disabled, label, leftHanded }: FretboardProps) {
  const frets = useMemo(() => Array.from({ length: maxFret - minFret + 1 }, (_, i) => minFret + i), [minFret, maxFret])
  const hasOpen = minFret === 0
  const playable = frets.filter(f => f > 0)
  const svgRef = useRef<SVGSVGElement>(null)

  // ---- Geometry (viewBox units) ----
  const vertical = orientation === 'vertical'
  const VW = 290
  const CELL = 46
  const geometry = useMemo(() => {
    if (vertical) {
      const top = 26
      const openH = hasOpen ? 38 : 0
      const nutY = top + openH
      // Fixed geometry scales uniformly with width; short screens scroll the page.
      const weights = playable.map((_, i) => Math.max(40, 54 * Math.pow(2, -i / 12)))
      const wires = [nutY]
      weights.forEach(w => wires.push(wires[wires.length - 1] + w))
      const height = wires[wires.length - 1] + 12
      const x = (string: number) => {
        const col = leftHanded ? string - 1 : 6 - string
        return 36 + col * CELL
      }
      const cell = (string: number, fret: number) => {
        const cx = x(string)
        if (fret === 0) return { cx, cy: top + openH / 2, rect: { x: cx - CELL / 2, y: top, width: CELL, height: openH - 2 } }
        const i = fret - Math.max(1, minFret)
        return { cx, cy: (wires[i] + wires[i + 1]) / 2, rect: { x: cx - CELL / 2, y: wires[i], width: CELL, height: wires[i + 1] - wires[i] } }
      }
      return { kind: 'v' as const, w: VW, h: height, wires, x, cell, nutY, top }
    }
    const left = hasOpen ? 46 : 14
    const wires = [left]
    playable.forEach((_, i) => wires.push(wires[wires.length - 1] + 78 * Math.pow(2, -i / 12)))
    const w = wires[wires.length - 1] + 18
    const y = (string: number) => 30 + (leftHanded ? 6 - string : string - 1) * 40
    const cell = (string: number, fret: number) => {
      const cy = y(string)
      if (fret === 0) return { cx: left / 2 + 4, cy, rect: { x: 4, y: cy - 20, width: left - 8, height: 40 } }
      const i = fret - Math.max(1, minFret)
      return { cx: (wires[i] + wires[i + 1]) / 2, cy, rect: { x: wires[i], y: cy - 20, width: wires[i + 1] - wires[i], height: 40 } }
    }
    return { kind: 'h' as const, w, h: 272, wires, y, cell, nutX: left }
  }, [vertical, hasOpen, playable, minFret, leftHanded])

  function focusCell(string: number, fret: number) {
    svgRef.current?.querySelector<SVGGElement>(`[data-cell="${string}-${fret}"]`)?.focus()
  }
  function onKey(e: KeyboardEvent, string: number, fret: number) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) onSelect?.(string, fret); return }
    const stringStep = vertical ? (e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0) : (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0)
    const fretStep = vertical ? (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0) : (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0)
    if (!stringStep && !fretStep) return
    e.preventDefault()
    const s = Math.min(6, Math.max(1, string + (leftHanded && vertical ? -stringStep : stringStep)))
    const f = Math.min(maxFret, Math.max(minFret, fret + fretStep))
    focusCell(s, f)
  }

  const markAt = new Map(marks.map(m => [`${m.string}-${m.fret}`, m]))
  const inlays = [3, 5, 7, 9].filter(f => f >= Math.max(1, minFret) && f <= maxFret)
  const g = geometry

  return <div className={`shared-fretboard ${vertical ? 'is-vertical' : 'is-horizontal'}`}>
    <svg ref={svgRef} className={`fretboard ${vertical ? 'vertical' : ''}`} viewBox={`0 0 ${g.w} ${g.h}`} role="group" aria-label={label}
      preserveAspectRatio="xMidYMin meet" style={{ width: '100%', height: 'auto' }}>
      <defs><linearGradient id="fb-wood" x1="0" y1="0" x2={vertical ? 1 : 0} y2={vertical ? 0 : 1}><stop offset="0" stopColor="#5a4030"/><stop offset="0.5" stopColor="#3c2b25"/><stop offset="1" stopColor="#59402f"/></linearGradient></defs>
      {g.kind === 'v' ? <>
        <rect x={g.x(leftHanded ? 1 : 6)} y={g.nutY} width={CELL * 5} height={g.wires[g.wires.length - 1] - g.nutY} fill="url(#fb-wood)"/>
        {inlays.map(f => <circle key={f} cx={(g.x(4) + g.x(3)) / 2} cy={g.cell(3, f).cy} r="7" fill="#d8c7a9" opacity="0.65"/>)}
        {maxFret >= 12 && minFret <= 12 && [[5, 4], [3, 2]].map(([a, b]) => <circle key={a} cx={(g.x(a) + g.x(b)) / 2} cy={g.cell(3, 12).cy} r="7" fill="#d8c7a9" opacity="0.65"/>)}
        {minFret <= 1 && <rect x={g.x(leftHanded ? 1 : 6) - 2} y={g.nutY - 4} width={CELL * 5 + 4} height="7" rx="2" fill="#ead9be"/>}
        {g.wires.slice(1).map((y, i) => <line key={i} x1={g.x(leftHanded ? 1 : 6)} x2={g.x(leftHanded ? 6 : 1)} y1={y} y2={y} stroke="#c8c8c0" strokeWidth="2.5"/>)}
        {STRINGS.map(s => <g key={s}><line x1={g.x(s)} x2={g.x(s)} y1={g.top} y2={g.wires[g.wires.length - 1]} stroke="#c5bdb1" strokeWidth={1 + (s - 1) * 0.4}/><text x={g.x(s)} y="16" textAnchor="middle" className="svg-string-label" aria-label={`第 ${s} 弦`}>{s}</text></g>)}
        {frets.map(f => <text key={f} x="13" y={g.cell(6, f).cy + 4} textAnchor="middle" className="svg-fret-label">{f}</text>)}
      </> : <>
        <rect x={g.nutX} y={g.y(leftHanded ? 6 : 1)} width={g.wires[g.wires.length - 1] - g.nutX} height={40 * 5} fill="url(#fb-wood)"/>
        {inlays.map(f => <circle key={f} cx={g.cell(3, f).cx} cy={(g.y(3) + g.y(4)) / 2} r="7" fill="#d8c7a9" opacity="0.62"/>)}
        {maxFret >= 12 && minFret <= 12 && [[2, 3], [4, 5]].map(([a, b]) => <circle key={a} cx={g.cell(3, 12).cx} cy={(g.y(a) + g.y(b)) / 2} r="7" fill="#d8c7a9" opacity="0.62"/>)}
        {minFret <= 1 && <rect x={g.nutX - 4} y={g.y(leftHanded ? 6 : 1) - 2} width="7" height={40 * 5 + 4} rx="2" fill="#ead9be"/>}
        {g.wires.slice(1).map((x, i) => <line key={i} x1={x} x2={x} y1={g.y(leftHanded ? 6 : 1)} y2={g.y(leftHanded ? 1 : 6)} stroke="#c8c8c0" strokeWidth="2.5"/>)}
        {STRINGS.map(s => <g key={s}><line x1={hasOpen ? 8 : g.nutX} x2={g.wires[g.wires.length - 1] + 10} y1={g.y(s)} y2={g.y(s)} stroke="#c5bdb1" strokeWidth={1 + (s - 1) * 0.4}/></g>)}
        {frets.map(f => <text key={f} x={g.cell(1, f).cx} y="266" textAnchor="middle" className="svg-fret-label">{f}</text>)}
      </>}
      {STRINGS.flatMap(s => frets.map(f => {
        const { cx, cy, rect } = g.cell(s, f)
        const mark = markAt.get(`${s}-${f}`)
        const midi = noteAt(tuning, s, f)
        const style = mark ? TONE_STYLE[mark.tone] : undefined
        const text = mark?.label ?? (showNoteNames ? pcName(midi) : '')
        const interactive = !!onSelect && !disabled
        const r = 13
        return <g key={`${s}-${f}`} data-cell={`${s}-${f}`} className={`fret-cell${interactive ? ' interactive' : ''}`} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
          aria-disabled={onSelect && disabled ? true : undefined}
          aria-label={`${positionLabel(s, f)}${mark?.label ? `，${mark.label}` : showNoteNames ? `，${pcName(midi)}` : ''}${mark ? `（${MARK_TEXT[mark.tone]}）` : ''}`}
          onClick={() => { if (interactive) onSelect!(s, f) }} onKeyDown={e => onKey(e, s, f)}>
          <rect {...rect} fill="transparent"/>
          {style && (style.shape === 'square'
            ? <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx="4" fill={style.fill} stroke={style.stroke} strokeWidth="1.5"/>
            : style.shape === 'diamond'
              ? <polygon points={`${cx},${cy - r - 2} ${cx + r + 2},${cy} ${cx},${cy + r + 2} ${cx - r - 2},${cy}`} fill={style.fill} stroke={style.stroke} strokeWidth="1.5"/>
              : <circle cx={cx} cy={cy} r={r} fill={style.fill} stroke={style.stroke} strokeWidth="1.5"/>)}
          {!style && showNoteNames && <circle cx={cx} cy={cy} r={11} fill="#29313b" stroke="#6f6658" strokeWidth="1"/>}
          {text && <text x={cx} y={cy + 4} textAnchor="middle" className="svg-note" fill={style?.text ?? '#e8e2d6'}>{text}</text>}
        </g>
      }))}
    </svg>
  </div>
}

const MARK_TEXT: Record<MarkTone, string> = { root: '根音', target: '目標', selected: '已選', correct: '正確', wrong: '你選的', reference: '參考', neutral: '標示' }
