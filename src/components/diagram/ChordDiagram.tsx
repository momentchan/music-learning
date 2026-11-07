import type { ChordShape } from '../../music-theory/guitar'

const FINGER = ['', '食指', '中指', '無名指', '小指']

/** SVG chord diagram (spec §7.2): low E on the left, nut on top, finger numbers in dots. */
export function ChordDiagram({ shape, size = 150, showName = true, leftHanded = false }: { shape: ChordShape; size?: number; showName?: boolean; leftHanded?: boolean }) {
  const fretted = shape.frets.filter(f => f > 0)
  const base = fretted.length && Math.max(...fretted) > 4 ? Math.min(...fretted) : 1
  const rows = 4
  const left = 22, top = 34, gap = 20, rowH = 24
  const x = (index: number) => left + (leftHanded ? 5 - index : index) * gap // index 0 = string 6
  const y = (fret: number) => top + (fret - base + 0.5) * rowH
  const description = shape.frets.map((fret, i) => {
    const string = 6 - i
    if (fret < 0) return `第 ${string} 弦不彈`
    if (fret === 0) return `第 ${string} 弦空弦`
    return `第 ${string} 弦第 ${fret} 格（${FINGER[shape.fingers[i]]}）`
  }).join('，')
  return <figure className="chord-diagram">
    <svg viewBox="0 0 144 150" width={size} height={size * 150 / 144} role="img" aria-label={`${shape.symbol} ${leftHanded ? '左手鏡射' : '教材視角'}和弦圖：${description}`}>
      {showName && <text x="72" y="12" textAnchor="middle" className="diagram-name">{shape.symbol}</text>}
      {base === 1 ? <rect x={left - 1} y={top - 4} width={gap * 5 + 2} height="5" fill="#ead9be"/> : <text x={left + gap * 5 + 6} y={top + rowH / 2 + 4} className="diagram-fret">{base}fr</text>}
      {Array.from({ length: rows + 1 }, (_, i) => <line key={i} x1={left} x2={left + gap * 5} y1={top + i * rowH} y2={top + i * rowH} stroke="#8d8a83" strokeWidth="1.2"/>)}
      {Array.from({ length: 6 }, (_, i) => <line key={i} x1={x(i)} x2={x(i)} y1={top} y2={top + rows * rowH} stroke="#c5bdb1" strokeWidth={2.2 - i * 0.25}/>)}
      {shape.frets.map((fret, i) => fret <= 0 && <text key={i} x={x(i)} y={top - 9} textAnchor="middle" className="diagram-marker">{fret < 0 ? '×' : '○'}</text>)}
      {shape.barre && <rect x={Math.min(x(6 - shape.barre.fromString), x(6 - shape.barre.toString)) - 8} y={y(shape.barre.fret) - 8} width={Math.abs(x(6 - shape.barre.toString) - x(6 - shape.barre.fromString)) + 16} height="16" rx="8" fill="#e9ae6a"/>}
      {shape.frets.map((fret, i) => fret > 0 && <g key={i}>
        <circle cx={x(i)} cy={y(fret)} r="8" fill="#e9ae6a" stroke="#ffe0b5" strokeWidth="1"/>
        <text x={x(i)} y={y(fret) + 3.5} textAnchor="middle" className="diagram-finger">{shape.fingers[i]}</text>
      </g>)}
      {['E', 'A', 'D', 'G', 'B', 'e'].map((n, i) => <text key={n + i} x={x(i)} y={top + rows * rowH + 13} textAnchor="middle" className="diagram-string">{n}</text>)}
    </svg>
    <figcaption className="sr-only">{description}</figcaption>
  </figure>
}
