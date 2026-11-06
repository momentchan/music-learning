import { useEffect, useRef, useState } from 'react'
import { audioEngine } from '../../audio/AudioEngine'
import type { Stroke } from '../../exercise-engine/types'
import { audioIsOn } from '../../stores/audioUi'

const COUNTS = ['1', '&', '2', '&', '3', '&', '4', '&']

/** Static display of an 8-slot pattern with counts and stroke arrows. */
export function PatternGrid({ pattern, active = -1 }: { pattern: string; active?: number }) {
  return <div className="pattern-grid" role="img" aria-label={`節奏：${[...pattern].map((s, i) => `${COUNTS[i]} ${s === 'D' ? '下撥' : s === 'U' ? '上撥' : '不彈'}`).join('、')}`}>
    {[...pattern].map((s, i) => <div key={i} className={`slot ${s === '.' ? 'rest' : ''} ${i % 2 ? 'off' : 'on'} ${active === i ? 'now' : ''}`}>
      <span className="stroke">{s === 'D' ? '↓' : s === 'U' ? '↑' : '·'}</span><small>{COUNTS[i]}</small>
    </div>)}
  </div>
}

type Phase = 'idle' | 'countin' | 'recording' | 'done'

/**
 * Count-in bar, then one recorded bar. Taps are timed with performance.now() relative to the bar start.
 * Timing is approximate on phones; grading applies the learner's calibration offset.
 */
export function RhythmPad({ pattern, bpm, strokes, disabled, onComplete }: { pattern: string; bpm: number; strokes: boolean; disabled?: boolean; onComplete: (taps: { t: number; stroke: Stroke }[]) => void }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [beat, setBeat] = useState(-1)
  const [slot, setSlot] = useState(-1)
  const [tapCount, setTapCount] = useState(0)
  const taps = useRef<{ t: number; stroke: Stroke }[]>([])
  const barStart = useRef(0)
  const frame = useRef(0)
  const beatMs = 60000 / bpm

  useEffect(() => () => { cancelAnimationFrame(frame.current); audioEngine.stop() }, [])

  async function start() {
    taps.current = []
    setTapCount(0)
    const firstClick = audioIsOn() ? await audioEngine.playClicks(8, bpm).catch(() => null) : null
    const t0 = firstClick ?? performance.now() + 300
    barStart.current = t0 + 4 * beatMs
    setPhase('countin')
    const tick = () => {
      const now = performance.now()
      if (now < barStart.current) { setBeat(Math.floor((now - t0) / beatMs)); setSlot(-1) }
      else if (now < barStart.current + 4 * beatMs + 250) { setPhase('recording'); setBeat(-1); setSlot(Math.min(7, Math.floor((now - barStart.current) / (beatMs / 2)))) }
      else { setPhase('done'); setSlot(-1); onComplete(taps.current); return }
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }

  function tap(stroke: Stroke) {
    if (phase !== 'recording' && phase !== 'countin') return
    const t = performance.now() - barStart.current
    if (t < -300) return // ignore early count-in taps
    taps.current.push({ t, stroke })
    setTapCount(n => n + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'recording' && phase !== 'countin') return
      if (strokes && (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown')) { e.preventDefault(); tap('D') }
      else if (strokes && (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp')) { e.preventDefault(); tap('U') }
      else if (!strokes && (e.key === ' ' || e.key === 'j')) { e.preventDefault(); tap('D') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return <div className="rhythm-pad">
    <PatternGrid pattern={pattern} active={slot}/>
    <p className="rhythm-status" aria-live="polite">
      {phase === 'idle' && `${bpm} BPM · 先聽 4 拍預備，然後彈一小節。`}
      {phase === 'countin' && <strong>預備… {beat >= 0 ? beat + 1 : ''}</strong>}
      {phase === 'recording' && <strong>彈！（{tapCount} 下）</strong>}
      {phase === 'done' && '完成，批改中…'}
    </p>
    {phase === 'idle' && <button type="button" className="primary-button wide" disabled={disabled} onClick={() => void start()}>▶ 開始（{audioIsOn() ? '有節拍器聲' : '靜音：看閃爍的格子'}）</button>}
    {(phase === 'countin' || phase === 'recording') && (strokes
      ? <div className="strum-buttons">
          <button type="button" onPointerDown={e => { e.preventDefault(); tap('D') }} aria-label="下撥（J 或 ↓）">↓ D</button>
          <button type="button" onPointerDown={e => { e.preventDefault(); tap('U') }} aria-label="上撥（K 或 ↑）">↑ U</button>
        </div>
      : <div className="strum-buttons single"><button type="button" onPointerDown={e => { e.preventDefault(); tap('D') }} aria-label="點擊（空白鍵）">點</button></div>)}
    <small className="helper">鍵盤：{strokes ? 'J／↓ = 下撥，K／↑ = 上撥' : '空白鍵 = 點'}。手機觸控與藍牙耳機會有延遲；請先在設定中校準。</small>
  </div>
}

/** Latency calibration: tap along with 8 clicks; the median offset is stored per device. */
export function Calibration({ onDone }: { onDone: (offsetMs: number) => void }) {
  useEffect(() => () => audioEngine.stop(), [])
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [result, setResult] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const frame = useRef(0)
  const clicks = useRef<number[]>([])
  const taps = useRef<number[]>([])
  const bpm = 80
  const beatMs = 60000 / bpm
  async function start() {
    taps.current = []
    const first = audioIsOn() ? await audioEngine.playClicks(12, bpm).catch(() => null) : null
    const t0 = first ?? performance.now() + 300
    clicks.current = Array.from({ length: 12 }, (_, i) => t0 + i * beatMs)
    setPhase('running')
    const pulse = () => {
      const now = performance.now()
      setFlash(clicks.current.some(c => now >= c && now - c < 120))
      if (now < clicks.current[clicks.current.length - 1] + beatMs) frame.current = requestAnimationFrame(pulse)
    }
    frame.current = requestAnimationFrame(pulse)
    setTimeout(() => {
      cancelAnimationFrame(frame.current)
      setFlash(false)
      const offsets = taps.current.map(t => {
        const nearest = clicks.current.reduce((best, c) => Math.abs(c - t) < Math.abs(best - t) ? c : best, clicks.current[0])
        return t - nearest
      }).filter(o => Math.abs(o) < beatMs / 2).sort((a, b) => a - b)
      const median = offsets.length >= 4 ? Math.round(offsets[Math.floor(offsets.length / 2)]) : null
      setResult(median)
      setPhase('done')
      if (median !== null) onDone(median)
    }, t0 - performance.now() + 12 * beatMs + 300)
  }
  return <div className="calibration">
    <p>跟著 12 下節拍點擊下方按鈕（{audioIsOn() ? '聽聲音' : '靜音中：看按鈕閃爍'}）。App 會記住你的裝置延遲，之後的節奏題都會扣掉這個時間差。</p>
    {phase === 'idle' && <button type="button" className="secondary-button" onClick={() => void start()}>開始校準</button>}
    {phase === 'running' && <button type="button" autoFocus className={`calibration-tap${flash ? ' flash' : ''}`} onPointerDown={e => { e.preventDefault(); taps.current.push(performance.now()) }}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) taps.current.push(performance.now()) } }}>點（或按空白鍵）</button>}
    {phase === 'done' && <p role="status">{result === null ? '點擊次數不夠，請再試一次。' : `已校準：你的點擊平均${result >= 0 ? '晚' : '早'} ${Math.abs(result)} ms。`}</p>}
    {phase === 'done' && <button type="button" className="secondary-button" onClick={() => setPhase('idle')}>重新校準</button>}
  </div>
}
