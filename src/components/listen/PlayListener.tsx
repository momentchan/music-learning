import { useEffect, useRef, useState } from 'react'
import { listeningContext, resumeListening } from '../../audio/mic'
import { fundamentalHz } from '../../audio/pitch'
import { NoteGate } from '../../audio/noteGate'
import type { Response } from '../../exercise-engine/types'

interface Props {
  disabled: boolean
  targetId: string
  paused: boolean
  onNote: (response: Extract<Response, { kind: 'played-note' }>) => void
  onPitch?: (note: { midi: number; hz: number; cents: number }) => void
  onFallback: () => void
}

/** One stream per explicit listening session. Question changes only re-arm the pitch gate. */
export function PlayListener({ disabled, targetId, paused, onNote, onFallback, onPitch }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState('按下開始收音，再彈一個清楚的單音。')
  const [heard, setHeard] = useState('')
  const gate = useRef(new NoteGate())
  const latest = useRef({ disabled, onNote, onPitch })
  latest.current = { disabled, onNote, onPitch }
  useEffect(() => { gate.current.reset(); setHeard('') }, [targetId, disabled])
  useEffect(() => { if (paused) setEnabled(false) }, [paused])
  useEffect(() => {
    const hide = () => { if (document.hidden) setEnabled(false) }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', hide)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', hide) }
  }, [])
  useEffect(() => {
    if (!enabled || paused) return
    let stopped = false, frame = 0, stream: MediaStream | null = null
    let source: MediaStreamAudioSourceNode | undefined
    let analyser: AnalyserNode | undefined
    let lastFrame = 0, lastStatus = ''
    const update = (s: string) => { if (lastStatus !== s) { lastStatus = s; setStatus(s) } }
    setStatus('等待麥克風權限。可隨時停止或改用點選。')
    gate.current.reset()
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('這個環境無法使用麥克風')
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        const context = listeningContext()
        await context.resume()
        if (stopped) return
        source = context.createMediaStreamSource(stream)
        analyser = context.createAnalyser(); analyser.fftSize = 4096
        source.connect(analyser)
        const samples = new Float32Array(analyser.fftSize)
        const readyAt = performance.now() + 1500
        const tick = (now: number) => {
          if (stopped) return
          frame = requestAnimationFrame(tick)
          if (now - lastFrame < 45) return
          lastFrame = now
          if (latest.current.disabled) { gate.current.reset(); return }
          if (now < readyAt) { update('準備好，先讓琴弦安靜，再撥弦。'); return }
          analyser!.getFloatTimeDomainData(samples)
          const hz = fundamentalHz(samples, context.sampleRate)
          if (hz != null && latest.current.onPitch) {
            const pitch = 69 + 12 * Math.log2(hz / 440), midi = Math.round(pitch)
            latest.current.onPitch({ midi, hz, cents: (pitch - midi) * 100 })
          }
          const note = gate.current.sample(hz, now)
          update(hz == null ? '收音中：先讓琴弦安靜，再彈一個音。' : '收到聲音，等待穩定音高…')
          if (note) {
            setHeard(`${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][note.midi % 12]}${Math.floor(note.midi / 12) - 1} · ${Math.round(note.cents)} 音分`)
            update('已收到單音。下一題前請先悶住弦。')
            latest.current.onNote({ kind: 'played-note', ...note })
          }
        }
        frame = requestAnimationFrame(tick)
      } catch (e) {
        if (!stopped) { setStatus(`麥克風無法使用：${e instanceof Error ? e.message : '請檢查權限或輸入裝置'}。可停止後重試，或改用點選。`); stream?.getTracks().forEach(t => t.stop()) }
      }
    })()
    return () => { stopped = true; cancelAnimationFrame(frame); source?.disconnect(); analyser?.disconnect(); stream?.getTracks().forEach(t => t.stop()) }
  }, [enabled, paused])
  return <section className="play-listen" aria-label="吉他收音">
    <div role="status"><strong>{heard || (enabled ? '麥克風收聽中' : '收音已停止')}</strong><p>{enabled ? status : '開始收音後才會要求權限；聲音只在本機分析，不會錄下或上傳。'}</p></div>
    <div className="button-row">
      <button className="secondary-button" disabled={paused} onClick={() => { if (!enabled) resumeListening(); setEnabled(!enabled) }}>{enabled ? '停止收音' : '開始收音'}</button>
      <button className="text-button" onClick={() => { setEnabled(false); onFallback() }}>改用點指板</button>
    </div>
  </section>
}
