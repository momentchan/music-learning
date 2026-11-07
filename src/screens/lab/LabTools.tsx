import { Fretboard as SharedFretboard, type FretMark } from '../../components/fretboard/Fretboard'
import { useLearning } from '../../stores/learning'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { audioEngine } from '../../audio/AudioEngine'
import { db, saveAttempt, type AudioAttempt } from '../../data/db'
import { COMPARISONS, comparisonEvents } from '../../music/comparisons'
import { makeEarQuestion, type EarQuestion, type EarType } from '../../music/ear'
import { positionsForNote } from '../../music/fretboardQuiz'
import { CHORD_INTERVALS, INTERVALS, SHARPS, STANDARD_TUNING, chordPitchClasses, chordVoicing, midiToFrequency, noteName, parseChord, planProgression, scaleNotes, type ChordStyle, type IntervalMode, type ProgressionChord, type ScaleName } from '../../music/theory'
import { useAudioSettings } from '../../state/useAudioSettings'
import { useAudioUi } from '../../stores/audioUi'

/* Lab tools carried over from the original audio studio. They write practice through the LearningRepository (via data/db). */
const EXAMPLES: { title: string; chords: string[] }[] = [
  { title: 'ii–V–I', chords: ['Dm7', 'G7', 'Cmaj7'] },
  { title: 'Dominants in C', chords: ['D7', 'G7', 'C'] },
  { title: 'Borrowed iv', chords: ['F', 'Fm', 'C'] },
  { title: 'V of vi', chords: ['E7', 'Am'] },
  { title: 'Pop motion', chords: ['G', 'D', 'Cmaj7'] },
  { title: 'Open resolution', chords: ['Cmaj7', 'Em7', 'D'] },
]
const EAR_TYPES: { id: EarType; label: string }[] = [
  { id: 'interval', label: '音程' }, { id: 'triad', label: '大小和弦' },
  { id: 'seventh', label: '七和弦' }, { id: 'degree', label: '級數' },
  { id: 'cadence', label: '終止式' }, { id: 'bass', label: '低音走向' },
  { id: 'progression', label: '和弦進行' },
]

const MOBILE_FRET_WIRES = [32]
for (let fret = 1; fret <= 12; fret++) {
  MOBILE_FRET_WIRES.push(MOBILE_FRET_WIRES[fret - 1] + Math.max(40, 54 * Math.pow(2, -(fret - 1) / 12)))
}
const MOBILE_FRETBOARD_HEIGHT = Math.ceil(MOBILE_FRET_WIRES[12]) + 32

export function Fretboard({ run, purpose = 'reference' }: { run: (fn: () => Promise<unknown>) => Promise<void>; purpose?: 'reference' | 'all-positions' }) {
  const practice = purpose === 'all-positions'
  const [selected, setSelected] = useState<{ string: number; fret: number; midi: number } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 700px)').matches)
  const boardRef = useRef<HTMLDivElement>(null)
  const [mobileHeight, setMobileHeight] = useState(MOBILE_FRETBOARD_HEIGHT)
  const { preferences, savePreferences } = useLearning()
  const vertical = narrow || (practice && preferences.practiceLayout === 'vertical')
  const [note, setNote] = useState('C')
  const [found, setFound] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [quizAttempts, setQuizAttempts] = useState<AudioAttempt[]>([])
  const pending = useRef(false)
  const startedAt = useRef(Date.now())
  const sessionId = useRef(crypto.randomUUID())
  const [formString, setFormString] = useState(1)
  const [formFret, setFormFret] = useState(1)
  const targets = positionsForNote(note)
  const done = found.length === targets.length
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)')
    const changed = () => setNarrow(query.matches)
    query.addEventListener('change', changed)
    return () => query.removeEventListener('change', changed)
  }, [])
  useLayoutEffect(() => {
    if (!narrow || !boardRef.current) return
    const board = boardRef.current
    const measure = () => {
      const bounds = board.getBoundingClientRect()
      const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect().height ?? 0
      const available = (window.visualViewport?.height ?? window.innerHeight) - nav - 8 - bounds.top - window.scrollY
      if (bounds.width) setMobileHeight(Math.min(MOBILE_FRETBOARD_HEIGHT, Math.max(160, available * 300 / bounds.width)))
    }
    const observer = new ResizeObserver(measure); observer.observe(board)
    if (board.previousElementSibling) observer.observe(board.previousElementSibling)
    window.addEventListener('resize', measure); window.visualViewport?.addEventListener('resize', measure); measure()
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure) }
  }, [narrow])
  useEffect(() => {
    if (!practice) return
    void db.attempts.where('exerciseType').equals('fretboard.find-note').toArray().then(setQuizAttempts).catch(() => setError('無法讀取紀錄。'))
  }, [practice])
  function changeNote(next: string) { setNote(next); setFound([]); setSelected(null); setFeedback(''); setShowAll(false); startedAt.current = Date.now() }
  async function choose(string: number, fret: number) {
    const midi = STANDARD_TUNING[6 - string] + fret
    if (!practice) { setSelected({ string, fret, midi }); void run(() => audioEngine.playNote(midi)); return }
    if (pending.current || done) return
    const key = `${string}-${fret}`
    if (found.includes(key)) { setFeedback('這個位置已找過。'); return }
    pending.current = true
    const correct = SHARPS[midi % 12] === note
    setSelected({ string, fret, midi }); setFeedback(correct ? '正確' : `這裡是 ${noteName(midi)}，請找 ${note}。`)
    if (correct) setFound(previous => [...previous, key])
    void run(() => audioEngine.playNote(midi))
    try {
      const now = Date.now()
      const record = await saveAttempt({ id: crypto.randomUUID(), sessionId: sessionId.current, exerciseType: 'fretboard.find-note', topicId: `fretboard.note.${note}`,
        question: { mode: 'one-note', targetNote: note, frets: [1, 12] }, response: `String ${string}, fret ${fret}, ${noteName(midi)}`, expected: note,
        correct, responseMs: Math.max(0, now - startedAt.current), replays: 0, difficulty: 1, timestamp: now, string, fret, note, mode: 'one-note', targetString: string,
        targetFret: targets.find(p => p.string === string)!.fret, assisted: false })
      setQuizAttempts(previous => [...previous, record]); startedAt.current = now
    } catch { setError('答案已判斷，但尚未保存。') } finally { pending.current = false }
  }
  const marks: FretMark[] = found.map(key => { const [string, fret] = key.split('-').map(Number); return { string, fret, label: note, tone: 'correct' } })
  if (selected) marks.push({ ...selected, label: noteName(selected.midi).replace(/\d/, ''), tone: practice && SHARPS[selected.midi % 12] !== note ? 'wrong' : 'selected' })
  const history = quizAttempts.filter(a => a.topicId === `fretboard.note.${note}`)
  return <section className={`card fretboard-card${practice ? ' practice' : ''}`}>
    <div className="fretboard-controls">
      <div className="section-head"><h3>{practice ? '找出同音的所有位置' : '指板查詢'}</h3><button className="subtle-button" disabled={practice && !done} onClick={() => setShowAll(!showAll)}>{showAll ? '隱藏音名' : '顯示音名'}</button></div>
      {practice && <div className="fretboard-quiz"><div><strong>{note}<em>{found.length} / {targets.length}</em></strong><small role="status">{feedback || '在每條弦找出這個音'}</small></div><label>練習音名<select value={note} onChange={e => changeNote(e.target.value)}>{SHARPS.map(n => <option key={n}>{n}</option>)}</select></label>{done && <button className="secondary-button" onClick={() => changeNote(SHARPS[(SHARPS.indexOf(note as typeof SHARPS[number]) + 1) % 12])}>下一個音 →</button>}</div>}
      {practice && !narrow && <div className="fretboard-modes" role="group" aria-label="指板視角"><button aria-pressed={preferences.practiceLayout === 'vertical'} onClick={() => void savePreferences({ practiceLayout: 'vertical' })}>教材直式</button><button aria-pressed={preferences.practiceLayout === 'horizontal'} onClick={() => void savePreferences({ practiceLayout: 'horizontal' })}>TAB 橫式</button></div>}
      {error && <p role="alert">{error}</p>}
    </div>
    <div ref={boardRef} className="fretboard-scroll" role="region" aria-label="完整指板">
      <SharedFretboard tuning={STANDARD_TUNING} minFret={1} maxFret={12} orientation={vertical ? 'vertical' : practice ? 'horizontal' : 'playing'} leftHanded={preferences.leftHanded} fitHeight={vertical ? (narrow ? mobileHeight : MOBILE_FRETBOARD_HEIGHT) * 340 / 300 : undefined}
        marks={marks} showNoteNames={showAll} onSelect={(string, fret) => void choose(string, fret)} label="六弦吉他指板，第 1–12 格"
        cellLabel={(string, fret) => `String ${string}, fret ${fret}${!practice || done ? `, ${noteName(STANDARD_TUNING[6 - string] + fret)}` : ''}`}/>
    </div>
    <div className="selected-note"><div><strong>{selected ? noteName(selected.midi) : '點選位置'}</strong><small>{selected ? `第 ${selected.string} 弦 · 第 ${selected.fret} 格` : ''}</small></div>{selected && <button className="secondary-button" onClick={() => void run(() => audioEngine.playNote(selected.midi))}>重播</button>}</div>
    <details className="position-controls"><summary>用選單選取位置</summary><div className="field-row"><label>弦<select value={formString} onChange={e => setFormString(Number(e.target.value))}>{[1,2,3,4,5,6].map(n => <option key={n}>{n}</option>)}</select></label><label>格<select value={formFret} onChange={e => setFormFret(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i}>{i + 1}</option>)}</select></label></div><button className="secondary-button" onClick={() => void choose(formString, formFret)}>{practice ? '送出位置' : '查看與試聽'}</button></details>
    {practice && <p className="helper">{history.filter(a => a.correct).length} 次正確 · {history.filter(a => !a.correct).length} 次待加強</p>}
  </section>
}

export function Explore({ run, stop }: { run: (fn: () => Promise<unknown>) => Promise<void>; stop: () => void }) {
  const [root, setRoot] = useState('C')
  const [quality, setQuality] = useState('maj7')
  const [style, setStyle] = useState<ChordStyle>('block')
  const [inversion, setInversion] = useState(0)
  const [interval, setInterval] = useState(7)
  const [mode, setMode] = useState<IntervalMode>('ascending')
  const [scale, setScale] = useState<ScaleName>('major')
  const symbol = root + quality
  const chord = parseChord(symbol)
  const voicing = chordVoicing(symbol, inversion)
  return <>
    <section className="card"><div className="section-head"><div><h3>和弦試聽</h3></div></div><div className="field-row"><label>根音<select value={root} onChange={e => setRoot(e.target.value)}>{SHARPS.map(n => <option key={n}>{n}</option>)}</select></label><label>和弦種類<select value={quality} onChange={e => { setQuality(e.target.value); setInversion(0) }}>{Object.keys(CHORD_INTERVALS).map(q => <option key={q} value={q}>{q === 'major' ? 'Major' : q === 'minor' ? 'Minor' : q}</option>)}</select></label></div>
      <div className="field-row"><label>彈奏方式<select value={style} onChange={e => setStyle(e.target.value as ChordStyle)}><option value="block">同時彈奏</option><option value="up">由低到高分解</option><option value="down">由高到低分解</option></select></label><label>轉位<select value={inversion} onChange={e => setInversion(Number(e.target.value))}>{chordPitchClasses(chord).map((_, i) => <option key={i} value={i}>{i === 0 ? '原位' : `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : 'rd'} inversion`}</option>)}</select></label></div>
      <div className="note-chips">{voicing.map((midi, i) => <span key={i}>{noteName(midi)}</span>)}</div><div className="button-row"><button className="primary-button" onClick={() => void run(() => audioEngine.playChord(symbol, style, inversion))}>▶ 播放 {symbol}</button><button className="secondary-button" onClick={stop}>■ 停止</button></div>
    </section>
    <section className="card"><div className="section-head"><div><h3>音程試聽</h3></div></div><div className="field-row"><label>音程<select value={interval} onChange={e => setInterval(Number(e.target.value))}>{INTERVALS.map(i => <option key={i.name} value={i.semitones}>{i.name} · {i.semitones} 半音</option>)}</select></label><label>播放方式<select value={mode} onChange={e => setMode(e.target.value as IntervalMode)}><option value="ascending">上行</option><option value="descending">下行</option><option value="harmonic">同時</option></select></label></div><div className="button-row"><button className="primary-button" onClick={() => void run(() => audioEngine.playInterval(60, interval, mode))}>▶ 播放音程</button><button className="secondary-button" onClick={() => void run(() => audioEngine.playNote(60))}>基準音 C4</button></div></section>
    <section className="card"><div className="section-head"><div><h3>音階試聽</h3></div></div><label>音階<select value={scale} onChange={e => setScale(e.target.value as ScaleName)}><option value="major">大調</option><option value="minor">自然小調</option><option value="pentatonic">大調五聲</option><option value="minorPentatonic">小調五聲</option><option value="blues">藍調</option></select></label><div className="note-chips">{scaleNotes(60 + SHARPS.findIndex(n => n === root), scale).map((midi, i) => <span key={i}>{noteName(midi)}</span>)}</div><button className="primary-button" onClick={() => void run(() => audioEngine.playScale(60 + SHARPS.findIndex(n => n === root), scale))}>▶ 播放音階</button></section>
  </>
}

export function Progressions({ run, stop, playing, setPlaying }: { run: (fn: () => Promise<unknown>) => Promise<void>; stop: () => void; playing: boolean; setPlaying: (value: boolean) => void }) {
  const { options, update } = useAudioSettings()
  const [selected, setSelected] = useState(0)
  const [chords, setChords] = useState<ProgressionChord[]>(EXAMPLES[0].chords.map(symbol => ({ symbol, beats: 4 })))
  const [timeSignature, setTimeSignature] = useState(4)
  const [loop, setLoop] = useState(false)
  const [active, setActive] = useState(-1)
  const [edit, setEdit] = useState('')
  const plan = (() => { try { return planProgression(chords, options.tempo) } catch { return [] } })()
  function choose(i: number) { stop(); setActive(-1); setSelected(i); setChords(EXAMPLES[i].chords.map(symbol => ({ symbol, beats: 4 }))) }
  function play() { void run(() => audioEngine.playProgression(chords, { bpm: options.tempo, timeSignature, loop, metronome: options.metronome, onChord: setActive, onStop: () => { setActive(-1); setPlaying(false) } })) }
  function addChord() { try { parseChord(edit); setChords([...chords, { symbol: edit.trim(), beats: timeSignature }]); setEdit('') } catch { /* invalid chord remains editable */ } }
  return <>
    <section className="card"><div className="section-head"><div><h3>和弦進行</h3></div></div><div className="example-grid">{EXAMPLES.map((ex, i) => <button key={ex.title} className={selected === i ? 'active' : ''} onClick={() => choose(i)}><strong>{ex.title}</strong><small>{ex.chords.join(' → ')}</small></button>)}</div>
      <div className="chord-track">{chords.map((chord, i) => <div key={`${i}-${chord.symbol}`} className={`track-chord ${active === i ? 'playing' : ''}`}><span>{i + 1 < 10 ? `0${i + 1}` : i + 1}</span><strong>{chord.symbol}</strong><select aria-label={`${chord.symbol} duration in beats`} value={chord.beats} onChange={e => setChords(chords.map((c, j) => j === i ? { ...c, beats: Number(e.target.value) } : c))}>{[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n} beats</option>)}</select><div><button aria-label={`Play ${chord.symbol}`} onClick={() => void run(() => audioEngine.playChord(chord.symbol))}>▶</button><button aria-label={`Remove ${chord.symbol}`} onClick={() => setChords(chords.filter((_, j) => j !== i))}>×</button></div></div>)}</div>
      <div className="field-row"><label>速度 · {options.tempo} BPM<input type="range" min="50" max="180" value={options.tempo} onChange={e => void update({ tempo: Number(e.target.value) })}/></label><label>拍號<select value={timeSignature} onChange={e => setTimeSignature(Number(e.target.value))}><option value={3}>3/4</option><option value={4}>4/4</option><option value={6}>6/4</option></select></label></div><div className="toggle-row"><label><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)}/> 循環</label><label><input type="checkbox" checked={options.metronome} onChange={e => void update({ metronome: e.target.checked })}/> 節拍器</label></div>
      <div className="button-row"><button className="primary-button" disabled={!chords.length} onClick={play}>{playing ? '↻ 重新播放' : '▶ 播放進行'}</button><button className="secondary-button" onClick={() => { stop(); setActive(-1) }}>■ 停止</button></div>
      <div className="add-row"><input aria-label="Chord symbol" placeholder="加入和弦，例如 Am7" value={edit} onChange={e => setEdit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addChord() }}/><button onClick={addChord}>+ 加入</button></div>
      <div className="voice-note"><span>聲部配置</span><p>{plan.map(p => `${p.chord.symbol}: ${p.notes.map(n => noteName(n)).join(' ')}`).join('   ·   ')}</p></div>
    </section></>
}

export function Compare({ run, stop }: { run: (fn: () => Promise<unknown>) => Promise<void>; stop: () => void }) {
  const [index, setIndex] = useState(0)
  const [heard, setHeard] = useState({ a: false, b: false })
  const [last, setLast] = useState<'a' | 'b'>('a')
  const item = COMPARISONS[index]
  function select(i: number) { stop(); setIndex(i); setHeard({ a: false, b: false }) }
  function play(side: 'a' | 'b') { setLast(side); setHeard(v => ({ ...v, [side]: true })); void run(() => audioEngine.playSequence(comparisonEvents(item, side))) }
  return <>
    <section className="card"><label>比較項目<select value={index} onChange={e => select(Number(e.target.value))}>{COMPARISONS.map((c, i) => <option key={c.id} value={i}>{c.category} · {c.title}</option>)}</select></label><div className="ab-grid"><div><span className="eyebrow">A</span><h3>{item.a.join(' → ')}</h3><button className="primary-button" aria-label="播放 A" onClick={() => play('a')}>▶ 播放 A</button></div><div><span className="eyebrow">B</span><h3>{item.b.join(' → ')}</h3><button className="primary-button" aria-label="播放 B" onClick={() => play('b')}>▶ 播放 B</button></div></div><div className="button-row"><button className="secondary-button" aria-label={`重播 ${last.toUpperCase()}`} onClick={() => play(last)}>↻ 重播 {last.toUpperCase()}</button><button className="secondary-button" onClick={stop}>■ 停止</button></div>
      {heard.a && heard.b ? <div className="explanation"><span>差異</span><strong>{item.difference}</strong><p>{item.explanation}</p></div> : <p className="helper">先聽 A 與 B。</p>}
    </section></>
}

export function EarTraining({ run, stop }: { run: (fn: () => Promise<unknown>) => Promise<void>; stop: () => void }) {
  const { options } = useAudioSettings()
  const [type, setType] = useState<EarType>('interval')
  const [question, setQuestion] = useState<EarQuestion>(() => makeEarQuestion('interval'))
  const [answer, setAnswer] = useState<string | null>(null)
  const [replays, setReplays] = useState(0)
  const [started, setStarted] = useState(0)
  const [saveError, setSaveError] = useState('')
  const [mastery, setMastery] = useState<number | null>(null)
  const [history, setHistory] = useState<AudioAttempt[]>([])
  useEffect(() => { void db.attempts.orderBy('timestamp').reverse().filter(attempt => attempt.topicId.startsWith('ear.')).limit(10).toArray().then(setHistory).catch(() => setSaveError('Practice history is unavailable on this device.')) }, [answer])
  function next(nextType = type) { stop(); setType(nextType); setQuestion(makeEarQuestion(nextType)); setAnswer(null); setReplays(0); setStarted(0); setMastery(null); setSaveError('') }
  function play() {
    if (options.silent || !options.enabled) { void run(() => audioEngine.playSequence(question.events)); return }
    void run(() => audioEngine.playSequence(question.events)).then(() => {
      if (audioEngine.isReady) { if (started) setReplays(v => v + 1); else setStarted(performance.now()) }
    })
  }
  async function submit(choice: string) {
    if (answer !== null) return
    setAnswer(choice); stop()
    try {
      const record = await saveAttempt({ id: crypto.randomUUID(), sessionId: question.id, exerciseType: question.type, topicId: `ear.${question.type}`,
        question, response: choice, expected: question.answer, correct: choice === question.answer,
        responseMs: started ? Math.max(0, Math.round(performance.now() - started)) : 0, replays, difficulty: 1, timestamp: Date.now() })
      setMastery(record.masteryAfter ?? null)
    } catch { setSaveError('Answer checked, but could not be saved. Check browser storage and try again.') }
  }
  return <>
    <section className="card"><div className="type-pills">{EAR_TYPES.map(t => <button key={t.id} className={type === t.id ? 'active' : ''} onClick={() => next(t.id)}>{t.label}</button>)}</div><div className="question-box"><h3>{question.prompt}</h3><div className="button-row"><button className="primary-button" onClick={play}>{started ? '↻ 重聽' : '▶ 播放題目'}</button>{question.reference && <button className="secondary-button" onClick={() => void run(() => audioEngine.playSequence(question.reference!))}>主音參考</button>}</div></div>
      {(options.silent || !options.enabled) && <p className="helper">請先開啟聲音。</p>}
      <div className="choice-grid">{question.choices.map(choice => <button key={choice} disabled={answer !== null || options.silent || !options.enabled || !started} className={answer !== null ? choice === question.answer ? 'correct' : choice === answer ? 'wrong' : '' : ''} onClick={() => void submit(choice)}>{choice}</button>)}</div>
      {answer !== null && <div className={`feedback ${answer === question.answer ? 'success' : ''}`} role="status"><strong>{answer === question.answer ? '正確' : `答案是 ${question.answer}。`}</strong><p>{question.explanation}</p><p>{question.reveal}</p><span>留意：{question.focusNotes}</span>{mastery !== null && <small>Recent topic accuracy: {mastery}%</small>}<button className="primary-button" onClick={() => next()}>下一題 →</button></div>}
      {saveError && <div className="notice" role="alert">{saveError}</div>}
    </section>

  </>
}

export function AudioSettingsPanel() {
  const { options, update } = useAudioSettings()
  const { run, loading } = useAudioUi()
  return <><section className="card settings-card"><h3>聲音</h3><div className="setting"><strong>播放聲音</strong><input type="checkbox" checked={options.enabled && !options.silent} onChange={e => void update({ enabled: e.target.checked, silent: !e.target.checked })} aria-label="播放聲音"/></div>
      <label>樂器音色<select value={options.instrument} onChange={e => void update({ instrument: e.target.value as 'pluck' | 'keys' })}><option value="pluck">木吉他 · 真實錄音</option><option value="keys">鋼琴 · 真實錄音</option></select></label><p className="helper"><a href="/audio/ATTRIBUTION.md" target="_blank" rel="noreferrer">取樣來源與授權</a></p>
      <label>Master volume · {Math.round(options.volume * 100)}%<input type="range" min="0" max="1" step="0.01" value={options.volume} onChange={e => void update({ volume: Number(e.target.value) })}/></label><label>Playback tempo · {options.tempo} BPM<input type="range" min="50" max="180" value={options.tempo} onChange={e => void update({ tempo: Number(e.target.value) })}/></label><label>Note duration · {options.noteDuration.toFixed(2)} s<input type="range" min="0.15" max="1.2" step="0.05" value={options.noteDuration} onChange={e => void update({ noteDuration: Number(e.target.value) })}/></label><div className="setting"><div><strong>Metronome</strong><p>Click during progression playback</p></div><input type="checkbox" checked={options.metronome} onChange={e => void update({ metronome: e.target.checked })} aria-label="Metronome"/></div>
      <button className="secondary-button" disabled={loading || options.silent || !options.enabled} onClick={() => void run(() => audioEngine.playChord('C', 'up'))}>{loading ? '正在載入音色…' : '試聽音色'}</button>
    </section></>
}
