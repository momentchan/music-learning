import { useState, useSyncExternalStore } from 'react'
import { Fretboard, type FretboardProps } from './Fretboard'
import { FRET_WINDOWS } from './projection'

/** A small overview preserves orientation; only the full-size local neck accepts answers. */
export function PracticeBoard(props: Omit<FretboardProps, 'orientation'>) {
  const narrow = useSyncExternalStore(listener => {
    const query = window.matchMedia('(max-width: 700px)')
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, () => window.matchMedia('(max-width: 700px)').matches, () => false)
  const lo = props.minFret ?? 0, hi = props.maxFret ?? 12
  const windows: readonly (readonly [number, number])[] = hi - lo <= 3 ? [[lo, hi]] : FRET_WINDOWS.filter(([a,b]) => b >= lo && a <= hi).map(([a,b]) => [Math.max(a, lo), Math.min(b, hi)] as const)
  const [range, setRange] = useState(0)
  const [whole, setWhole] = useState(false)
  const [min, max] = windows[Math.min(range, windows.length - 1)]
  const limit = props.maxFret ?? 12
  const localMin = Math.max(props.minFret ?? 0, min)
  const localMax = Math.min(limit, max)
  const validRange = localMin <= localMax
  return <div className={`practice-board ${whole ? 'show-whole' : ''}`}>
    <div className="board-caption"><span>{props.leftHanded ? '左手演奏視角 · 琴枕在右' : '演奏者視角 · 琴枕在左'} · 上方是第 6 弦</span><button type="button" className="text-button board-view-toggle" onClick={() => setWhole(!whole)}>{whole ? '局部把位' : '整個指板'}</button></div>
    <div className="board-overview" role="img" aria-label={`全指板定位：目前第 ${localMin}–${localMax} 格`}>
      <svg viewBox="0 0 312 46" aria-hidden="true">
        {Array.from({ length: 13 }, (_, f) => {
          const x = props.leftHanded ? (12 - f) * 24 : f * 24
          return <g key={f}><rect x={x + 1} y="1" width="22" height="26" fill={f >= min && f <= max ? 'var(--accent)' : 'var(--surface-2)'}/><text x={x + 12} y="41" textAnchor="middle" fill="currentColor" fontSize="11">{f}</text></g>
        })}
      </svg>
    </div>
    <div className={`fret-window-options ${windows.length === 1 ? 'single-window' : ''}`} role="group" aria-label="顯示把位">
      {windows.map(([a, b], i) => a <= limit && b >= (props.minFret ?? 0) && <button type="button" key={i} className={range === i ? 'active' : ''} aria-pressed={range === i} onClick={() => { setRange(i); setWhole(false) }}>{Math.max(a, props.minFret ?? 0)}–{Math.min(b, limit)} 格</button>)}
    </div>
    <div className="local-board">{narrow && !whole && validRange && <Fretboard {...props} minFret={localMin} maxFret={localMax} orientation="playing"/>}</div>
    <div className="whole-board">{(!narrow || whole) && <Fretboard {...props} minFret={0} maxFret={12} selectableRange={[lo, hi]} orientation="playing"/>}</div>
    <p className="helper board-range-help">{whole ? '全指板可左右捲動；切換局部把位可放大作答。' : '可切換把位找答案；小地圖只用來定位。'} · 圓點標示音，弦號不代表手指。</p>
  </div>
}
