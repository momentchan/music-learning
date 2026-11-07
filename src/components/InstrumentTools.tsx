import { useEffect, useRef, useState } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { audioIsOn } from '../stores/audioUi'
import { PlayListener } from './listen/PlayListener'
import { repository } from '../database/repository'
import { useLearning } from '../stores/learning'

export function InstrumentTools({ purpose = 'reference' }: { purpose?: 'reference' | 'rhythm' }) {
  const [bpm, setBpm] = useState(70)
  const [seconds, setSeconds] = useState(0)
  const [count, setCount] = useState(0)
  const [readout, setReadout] = useState('先彈一條空弦')
  const [message, setMessage] = useState('')
  const [finished, setFinished] = useState(false)
  const frame = useRef(0)
  const generation = useRef(0)
  const running = useRef(false)
  const stop = () => { running.current = false; generation.current++; cancelAnimationFrame(frame.current); audioEngine.stop(); setSeconds(0) }
  useEffect(() => {
    const hide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hide)
    return () => { generation.current++; cancelAnimationFrame(frame.current); audioEngine.stop(); document.removeEventListener('visibilitychange', hide) }
  }, [])
  async function start() {
    if (running.current) return
    stop(); const token = generation.current
    setMessage(''); setFinished(false); setCount(0)
    if (!audioIsOn()) { setMessage('請先開啟聲音，再跟著節拍練習。'); return }
    running.current = true; setSeconds(64); setReadout('準備節拍器…')
    try {
      const startAt = await audioEngine.playClicks(bpm + 4, bpm)
      if (token !== generation.current) return
      if (startAt == null) throw new Error('Audio not ready')
      const playingAt = startAt + 4 * 60000 / bpm
      const endAt = playingAt + 60000
      const tick = () => {
        const now = performance.now()
        if (now < playingAt) setReadout(`準備 ${Math.max(1, Math.ceil((playingAt - now) / (60000 / bpm)))}`)
        else setReadout('C ↔ G，每次換好再刷出清楚的聲音')
        setSeconds(Math.max(0, Math.ceil((endAt - now) / 1000)))
        if (now >= endAt) { stop(); setFinished(true); return }
        frame.current = requestAnimationFrame(tick)
      }
      tick()
    } catch { stop(); setMessage('節拍器無法播放，請檢查聲音設定後再試。') }
  }
  async function save(rating: 0 | 1 | 2) {
    try {
      await repository.completeBridge('practice.chord-changes', { id: crypto.randomUUID(), nodeId: 'chord.open', bridgeTaskId: 'practice.chord-changes', rating, verified: false, metric: count, timestamp: Date.now() })
      setMessage('已保存自評。'); setFinished(false)
      await useLearning.getState().refresh()
    } catch { setMessage('自評尚未保存，請再試一次。') }
  }
  return <section className="practice-tools">
    <h3>{purpose === 'rhythm' ? '節拍與換和弦' : '調音'}</h3>

    {purpose === 'reference' && <><p className="tool-readout" role="status">{readout}</p><PlayListener targetId="tuner" disabled={false} paused={false} onNote={() => {}} onPitch={n => setReadout(`${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n.midi % 12]}${Math.floor(n.midi / 12) - 1} · ${Math.round(n.cents ?? 0)} 音分`)}/></>}
    {purpose === 'rhythm' && <><label>BPM：{bpm}<input type="range" min="40" max="160" value={bpm} disabled={seconds > 0} onChange={e => setBpm(Number(e.target.value))}/></label><p className="helper">C ↔ G，一分鐘。換好一次算一次。</p><p className="tool-readout" role="status">{seconds > 0 ? `${readout} · ${seconds} 秒` : '準備好再開始'}</p><div className="button-row"><button className="primary-button" disabled={seconds > 0} onClick={() => void start()}>開始一分鐘練習</button><button className="secondary-button" onClick={stop}>停止</button></div></>}
    {finished && <><label>完成的換和弦次數<input aria-label="換和弦次數" type="number" min="0" max="999" value={count} onChange={e => setCount(Math.max(0, Math.min(999, Number(e.target.value) || 0)))}/></label><div className="choice-grid three">{(['還不太行','勉強可以','很順'] as const).map((s, i) => <button key={s} onClick={() => void save(i as 0 | 1 | 2)}>{s}</button>)}</div></>}
    {message && <p role="status" className="helper">{message}</p>}
  </section>
}
