import { useEffect, useRef, useState } from 'react'
import { listeningContext, resumeListening } from '../../audio/mic'
import { detectPitch, signalRms, MIN_PITCH_RMS } from '../../audio/pitch'
import { NoteGate } from '../../audio/noteGate'
import type { Response } from '../../exercise-engine/types'

interface Props {
  disabled: boolean
  targetId: string
  paused: boolean
  onNote: (response: Extract<Response, { kind: 'played-note' }>) => void
  onPitch?: (note: { midi: number; hz: number; cents: number }) => void
  onFallback?: () => void
}
type MicState = 'off' | 'requesting' | 'listening' | 'error'
const noteName = (midi: number) => `${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][midi % 12]}${Math.floor(midi / 12) - 1}`
const describeError = (error: unknown) => {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return '網站尚未取得麥克風權限。請在網址列的網站權限允許麥克風，再按重新收音。'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '找不到選定的麥克風，請改選電腦內建麥克風。'
  if (name === 'NotReadableError') return '麥克風目前無法讀取，可能被其他程式占用。請關閉其他收音程式再試。'
  return '收音無法啟動，請確認瀏覽器與系統的麥克風權限，再按重新收音。'
}

/** The meter and candidate pitch are independent of grading, so a rejected note is still visible. */
export function PlayListener({ disabled, targetId, paused, onNote, onFallback, onPitch }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [phase, setPhase] = useState<MicState>('off')
  const [status, setStatus] = useState('按開始收音，允許麥克風後就能彈奏。')
  const [heard, setHeard] = useState('')
  const [level, setLevel] = useState(0)
  const [deviceName, setDeviceName] = useState('瀏覽器預設麥克風')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [restart, setRestart] = useState(0)
  const gate = useRef(new NoteGate())
  const latest = useRef({ disabled, onNote, onPitch })
  latest.current = { disabled, onNote, onPitch }
  useEffect(() => { gate.current.reset(); if (!disabled) setHeard('') }, [targetId, disabled])
  useEffect(() => { if (paused) { setEnabled(false); setPhase('off'); setLevel(0) } }, [paused])
  useEffect(() => {
    const hide = () => { if (document.hidden) { setEnabled(false); setPhase('off'); setLevel(0) } }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', hide)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', hide) }
  }, [])
  useEffect(() => {
    if (!enabled || paused) return
    let stopped = false, frame = 0, stream: MediaStream | null = null
    let source: MediaStreamAudioSourceNode | undefined, analyser: AnalyserNode | undefined
    let lastFrame = 0, lastUi = 0, lastStatus = '', quietSince = performance.now()
    const update = (s: string) => { if (lastStatus !== s) { lastStatus = s; setStatus(s) } }
    setPhase('requesting'); setLevel(0); setHeard('')
    setStatus('等待麥克風權限，請按瀏覽器的「允許」。也可隨時停止。')
    // An explicit start may accept the first played note without an invisible silence prerequisite.
    // Between questions/reset, the gate still requires release to reject the previous note's tail.
    gate.current.reset(false)
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable')
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        const context = listeningContext()
        await context.resume()
        if (stopped) return
        const track = stream.getAudioTracks()[0]
        setDeviceName(track?.label || '瀏覽器預設麥克風')
        void navigator.mediaDevices.enumerateDevices().then(all => { if (!stopped) setDevices(all.filter(d => d.kind === 'audioinput')) }).catch(() => undefined)
        source = context.createMediaStreamSource(stream)
        analyser = context.createAnalyser(); analyser.fftSize = 4096
        source.connect(analyser)
        const samples = new Float32Array(analyser.fftSize)
        setPhase('listening'); update('已開始收音，請彈一個單音。')
        const tick = (now: number) => {
          if (stopped) return
          frame = requestAnimationFrame(tick)
          if (now - lastFrame < 45) return
          lastFrame = now
          analyser!.getFloatTimeDomainData(samples)
          const rms = signalRms(samples)
          const pitch = detectPitch(samples, context.sampleRate)
          const hz = pitch?.hz ?? null
          const rawMidi = hz == null ? null : 69 + 12 * Math.log2(hz / 440)
          if (now - lastUi >= 100) {
            lastUi = now
            setLevel(rms <= .00001 ? 0 : Math.min(100, Math.max(0, (20 * Math.log10(rms) + 75) / 60 * 100)))
            if (!latest.current.disabled) setHeard(rawMidi == null ? '' : `聽到 ${noteName(Math.round(rawMidi))} · ${Math.round((rawMidi - Math.round(rawMidi)) * 100)} 音分`)
          }
          if (latest.current.disabled) return
          if (context.state !== 'running') { update('音訊處於暫停狀態，請按重新收音。'); return }
          if (rms < MIN_PITCH_RMS) {
            if (now - quietSince > 3000) update('輸入音量不足。請靠近電腦麥克風彈單音；若音量條完全不動，請檢查輸入裝置與系統權限。')
            else update('請彈一個單音。')
          } else {
            quietSince = now
            if (rawMidi == null) update('有收到聲音，但還無法辨認單音。請只彈一條弦。')
            else if (Math.abs(rawMidi - Math.round(rawMidi)) > .45) update('有辨認到音高，但介於兩個半音之間。請先調音。')
            else update(gate.current.waitingForRelease ? '請先悶弦，再撥弦。' : '辨認音高中…')
          }
          if (rawMidi != null && latest.current.onPitch) latest.current.onPitch({ midi: Math.round(rawMidi), hz: hz!, cents: (rawMidi - Math.round(rawMidi)) * 100 })
          const note = gate.current.sample(pitch && pitch.confidence >= .7 ? hz : null, now)
          if (note && pitch && pitch.confidence >= .7) {
            setHeard(`聽到 ${noteName(note.midi)} · ${Math.round(note.cents)} 音分`)
            update('已辨認。下一次撥弦前請先悶弦。')
            latest.current.onNote({ kind: 'played-note', ...note, confidence: pitch.confidence })
          }
        }
        frame = requestAnimationFrame(tick)
      } catch (error) {
        if (!stopped) { setPhase('error'); setLevel(0); setStatus(describeError(error)); stream?.getTracks().forEach(t => t.stop()) }
      }
    })()
    return () => { stopped = true; cancelAnimationFrame(frame); source?.disconnect(); analyser?.disconnect(); stream?.getTracks().forEach(t => t.stop()) }
  }, [enabled, paused, deviceId, restart])
  const start = () => { resumeListening(); setEnabled(true); setRestart(n => n + 1) }
  return <section className="play-listen" aria-label="吉他收音">
    <div role="status"><strong>{phase === 'error' ? '收音未啟動' : heard || (phase === 'listening' ? '麥克風已連線' : phase === 'requesting' ? '等待麥克風權限' : '收音已停止')}</strong>{enabled && <p>{status}</p>}</div>
    <label className="mic-level-label">輸入音量<meter aria-label="麥克風輸入音量" min="0" max="100" value={level}/></label>
    {enabled && <p className="helper mic-device">輸入：{deviceName}</p>}
    {devices.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications').length > 1 && <label>輸入麥克風<select aria-label="輸入麥克風" value={deviceId} onChange={e => { resumeListening(); setDeviceId(e.target.value) }}><option value="">瀏覽器預設</option>{devices.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications').map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || '其他麥克風'}</option>)}</select></label>}
    <div className="button-row">
      {!enabled || phase === 'error' ? <button className="primary-button" disabled={paused} onClick={start}>{phase === 'error' ? '重新收音' : '開始收音'}</button> : <><button className="secondary-button" onClick={() => { setEnabled(false); setPhase('off'); setLevel(0) }}>停止收音</button><button className="text-button" onClick={start}>重新收音</button></>}
      {onFallback && <button className="text-button" onClick={() => { setEnabled(false); setPhase('off'); onFallback() }}>改用點指板</button>}
    </div>
  </section>
}
