import { useEffect, useRef, useState } from 'react'
import { audioEngine } from '../../audio/AudioEngine'
import { db, saveAttempt, type AudioAttempt } from '../../data/db'
import { COMPARISONS, comparisonEvents } from '../../music/comparisons'
import { makeEarQuestion, type EarQuestion, type EarType } from '../../music/ear'
import { chooseReviewPosition, fretRegion, positionsForNote, reviewSummary, type ReviewPosition } from '../../music/fretboardQuiz'
import { CHORD_INTERVALS, INTERVALS, SHARPS, STANDARD_TUNING, chordPitchClasses, chordVoicing, midiToFrequency, noteName, parseChord, planProgression, scaleNotes, type ChordStyle, type IntervalMode, type ProgressionChord, type ScaleName } from '../../music/theory'
import { useAudioSettings } from '../../state/useAudioSettings'

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
  { id: 'interval', label: 'Intervals' }, { id: 'triad', label: 'Major / minor' },
  { id: 'seventh', label: 'Seventh chords' }, { id: 'degree', label: 'Scale degree' },
  { id: 'cadence', label: 'Cadences' }, { id: 'bass', label: 'Bass motion' },
  { id: 'progression', label: 'Progressions' },
]

const FRET_WIRES = [40]
for (let fret = 1; fret <= 12; fret++) {
  FRET_WIRES.push(FRET_WIRES[fret - 1] + 82 * Math.pow(2, -(fret - 1) / 12))
}
const FRET_CENTERS = Array.from({ length: 13 }, (_, fret) => fret === 0 ? 0 : (FRET_WIRES[fret - 1] + FRET_WIRES[fret]) / 2)
const FRETBOARD_WIDTH = Math.ceil(FRET_WIRES[12]) + 32
const MOBILE_FRET_WIRES = [32]
for (let fret = 1; fret <= 12; fret++) {
  MOBILE_FRET_WIRES.push(MOBILE_FRET_WIRES[fret - 1] + Math.max(40, 54 * Math.pow(2, -(fret - 1) / 12)))
}
const MOBILE_FRET_CENTERS = Array.from({ length: 13 }, (_, fret) => fret === 0 ? 0 : (MOBILE_FRET_WIRES[fret - 1] + MOBILE_FRET_WIRES[fret]) / 2)
const MOBILE_FRETBOARD_HEIGHT = Math.ceil(MOBILE_FRET_WIRES[12]) + 32

export function Fretboard({ run }: { run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [selected, setSelected] = useState<{ string: number; fret: number; midi: number } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches)
  const [practiceLayout, setPracticeLayout] = useState<'vertical' | 'horizontal'>(() => (typeof localStorage !== 'undefined' && localStorage.getItem('guitar-lab.practiceLayout') === 'horizontal') ? 'horizontal' : 'vertical')
  const [mode, setMode] = useState<'explore' | 'one-note' | 'random'>('explore')
  const [singleNote, setSingleNote] = useState<string>('C')
  const [randomTarget, setRandomTarget] = useState<ReviewPosition>({ note: 'C', string: 6, fret: 8, midi: 48, reason: 'new' })
  const [seed, setSeed] = useState(0)
  const [found, setFound] = useState<string[]>([])
  const [roundDone, setRoundDone] = useState(false)
  const [lastResult, setLastResult] = useState<{ correct: boolean; label: string; repeated?: boolean } | null>(null)
  const [quizAttempts, setQuizAttempts] = useState<AudioAttempt[]>([])
  const [quizError, setQuizError] = useState('')
  const attemptStartedAt = useRef(Date.now())
  const [sessionId] = useState(() => crypto.randomUUID())
  const answerPending = useRef(false)
  const roundMissed = useRef(false)
  const [accessibleString, setAccessibleString] = useState(1)
  const [accessibleFret, setAccessibleFret] = useState(1)
  const frets = Array.from({ length: 12 }, (_, index) => index + 1)
  const strings = [5, 4, 3, 2, 1, 0] // horizontal: high e on top, like tab
  const verticalStrings = [0, 1, 2, 3, 4, 5] // vertical: low E on the left, like a chord diagram
  const targetNote = mode === 'one-note' ? singleNote : randomTarget.note
  const targetCount = positionsForNote(targetNote).length
  const currentAttempts = quizAttempts.filter(attempt => attempt.topicId === `fretboard.note.${targetNote}` && (mode === 'one-note' || (attempt.targetString ?? attempt.string) === randomTarget.string))
  const progress = reviewSummary(quizAttempts, Date.now())
  // Practice reads top-to-bottom like a chord chart: vertical by default on every screen size.
  const vertical = narrow || (mode !== 'explore' && practiceLayout === 'vertical')
  function changePracticeLayout(next: 'vertical' | 'horizontal') {
    setPracticeLayout(next)
    try { localStorage.setItem('guitar-lab.practiceLayout', next) } catch { /* preference is optional */ }
  }
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)')
    const updateLayout = () => setNarrow(query.matches)
    query.addEventListener('change', updateLayout)
    return () => query.removeEventListener('change', updateLayout)
  }, [])
  useEffect(() => {
    void db.attempts.where('exerciseType').equals('fretboard.find-note').toArray()
      .then(rows => setQuizAttempts(rows.sort((a, b) => a.timestamp - b.timestamp))).catch(() => setQuizError('Practice records are unavailable on this device.'))
  }, [])
  function resetRound() { setFound([]); setRoundDone(false); setLastResult(null); setSelected(null); setShowAll(false); attemptStartedAt.current = Date.now(); roundMissed.current = false }
  function changeMode(next: 'explore' | 'one-note' | 'random') {
    setMode(next); setShowAll(false); resetRound()
    if (next === 'random') {
      const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
      setSeed(nextSeed); setRandomTarget(chooseReviewPosition(quizAttempts, nextSeed, Date.now()))
    }
  }
  function nextRandomNote() {
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
    setSeed(nextSeed); setRandomTarget(chooseReviewPosition(quizAttempts, nextSeed, Date.now(), randomTarget)); resetRound()
  }
  function nextSingleNote() { setSingleNote(SHARPS[(SHARPS.indexOf(singleNote as typeof SHARPS[number]) + 1) % SHARPS.length]); resetRound() }
  async function choose(string: number, fret: number) {
    const midi = STANDARD_TUNING[string] + fret
    if (mode === 'explore') { setSelected({ string, fret, midi }); await run(() => audioEngine.playNote(midi)); return }
    if (roundDone || answerPending.current) return
    const positionKey = `${string}-${fret}`
    if (mode === 'one-note' && found.includes(positionKey)) { setLastResult({ correct: true, label: 'You already found this position.', repeated: true }); return }
    answerPending.current = true
    const actualNote = SHARPS[midi % 12]
    const targetString = mode === 'random' ? randomTarget.string : 6 - string
    const targetFret = mode === 'random' ? randomTarget.fret : positionsForNote(targetNote).find(position => position.string === targetString)!.fret
    const correct = actualNote === targetNote && (mode === 'one-note' || targetString === 6 - string)
    if (!correct) roundMissed.current = true
    const assisted = mode === 'random' && correct && roundMissed.current
    const nextFound = correct && mode === 'one-note' ? [...found, positionKey] : found
    setSelected({ string, fret, midi })
    const wrongLabel = mode === 'random'
      ? `Try string ${targetString}, ${fretRegion(targetFret)}. ${actualNote === targetNote ? `Right note on string ${6 - string}.` : `${noteName(midi)} is ${actualNote}.`}`
      : `${noteName(midi)} is ${actualNote}. Find ${targetNote}.`
    setLastResult({ correct, label: correct ? `${noteName(midi)} · string ${6 - string}, fret ${fret}` : wrongLabel })
    if (correct) { setFound(nextFound); if (mode === 'random' || nextFound.length === targetCount) setRoundDone(true) }
    void run(() => audioEngine.playNote(midi))
    try {
      const timestamp = Date.now()
      const responseMs = Math.max(0, timestamp - attemptStartedAt.current)
      attemptStartedAt.current = timestamp
      const record = await saveAttempt({ id: crypto.randomUUID(), sessionId, exerciseType: 'fretboard.find-note', topicId: `fretboard.note.${targetNote}`,
        question: { mode, targetNote, targetString, targetFret, seed, frets: [1, 12] }, response: `String ${6 - string}, fret ${fret}, ${noteName(midi)}`, expected: `String ${targetString}, fret ${targetFret}, ${targetNote}`,
        correct, responseMs, replays: 0, difficulty: 1, timestamp,
        string: 6 - string, fret, note: targetNote, mode, targetString, targetFret, assisted })
      setQuizAttempts(previous => [...previous, record])
    } catch { setQuizError('Answer checked, but it could not be saved. Check browser storage and try again.') }
    finally { answerPending.current = false }
  }
  function noteTarget(string: number, fret: number, x: number, y: number, hit: { x: number; y: number; width: number; height: number }) {
    const midi = STANDARD_TUNING[string] + fret
    const active = selected?.string === string && selected.fret === fret
    const foundPosition = mode === 'one-note' && found.includes(`${string}-${fret}`)
    const wrongPosition = mode !== 'explore' && active && lastResult?.correct === false
    const marked = active || foundPosition
    return <g key={`${string}-${fret}`} className={`fret-position${marked ? ' selected' : ''}`} onClick={() => void choose(string, fret)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void choose(string, fret) } }} role="button" tabIndex={0} aria-label={`String ${6 - string}, fret ${fret}${mode === 'explore' || roundDone ? `, ${noteName(midi)}` : ''}`}>
      <rect {...hit} fill="transparent"/><circle className="note-target" cx={x} cy={y} r={marked ? 16 : 12} fill={foundPosition ? '#3b9a70' : wrongPosition ? '#bb594e' : active ? '#ee765e' : showAll ? '#29313b' : 'transparent'} stroke={foundPosition ? '#b6efcf' : wrongPosition ? '#ffd4c9' : active ? '#ffd5a5' : showAll ? '#b6a994' : 'transparent'} strokeWidth="1.5"/>{(showAll || marked) && <text x={x} y={y + 4} textAnchor="middle" className="svg-note">{noteName(midi).replace(/\d/, '')}</text>}
    </g>
  }
  return <><section className="intro-card"><div><p className="eyebrow">01 / INTERACTIVE INSTRUMENT</p><h2>Hear every position.</h2><p>Explore the neck or practice finding notes on frets 1–12.</p></div><div className="pulse-icon">♪</div></section>
    <section className={`card fretboard-card${mode === 'explore' ? '' : ' practice'}`}><div className="fretboard-controls"><div className="section-head"><div><h3>SVG fretboard</h3><p>Standard tuning · frets 1–12</p></div><button className="subtle-button" disabled={mode !== 'explore' && !roundDone} onClick={() => setShowAll(!showAll)}>{showAll ? 'Hide labels' : 'Show labels'}</button></div>
      <div className="fretboard-modes" role="group" aria-label="Fretboard mode"><button className={mode === 'explore' ? 'active' : ''} onClick={() => changeMode('explore')}>Explore</button><button className={mode === 'one-note' ? 'active' : ''} onClick={() => changeMode('one-note')}>One note</button><button className={mode === 'random' ? 'active' : ''} onClick={() => changeMode('random')}>Random review</button></div>
      {mode !== 'explore' && <div className="fretboard-quiz"><div><span className="eyebrow">FIND THE NOTE</span><strong>{targetNote}<em>{mode === 'one-note' ? `${found.length} / ${targetCount} found` : `string ${randomTarget.string}`}</em></strong><small role="status" title={lastResult?.label}>{lastResult ? `${lastResult.label}${roundDone && !lastResult.repeated ? mode === 'one-note' ? ' All positions found!' : ' Nice work!' : ''}` : mode === 'one-note' ? 'Find it on every string' : `${{ new: 'New position', missed: 'Missed position', due: 'Due for review', practice: 'Extra practice' }[randomTarget.reason]} · ${progress.seen}/72 seen`}</small></div>{mode === 'one-note' ? <><label>Practice note<select aria-label="Practice note" value={singleNote} onChange={e => { setSingleNote(e.target.value); resetRound() }}>{SHARPS.map(note => <option key={note}>{note}</option>)}</select></label>{roundDone && <button className="secondary-button" onClick={nextSingleNote}>Next note →</button>}</> : <button className="secondary-button" onClick={nextRandomNote}>{roundDone ? 'Next →' : 'Skip →'}</button>}</div>}
      {mode !== 'explore' && <p className="quiz-guidance">{mode === 'one-note' ? 'Find this note on every string. Green positions are already found.' : `Review by note and string: ${progress.missed} missed, ${progress.due} due. Misses and overdue positions return more often; skipping has no penalty.`} Local record for {targetNote}{mode === 'random' ? ` on string ${randomTarget.string}` : ''}: {currentAttempts.filter(attempt => attempt.correct).length} correct, {currentAttempts.filter(attempt => !attempt.correct).length} missed.</p>}
      {mode !== 'explore' && !narrow && <div className="fretboard-modes layout-toggle" role="group" aria-label="Practice layout"><button className={practiceLayout === 'vertical' ? 'active' : ''} aria-pressed={practiceLayout === 'vertical'} onClick={() => changePracticeLayout('vertical')}>直式 Vertical</button><button className={practiceLayout === 'horizontal' ? 'active' : ''} aria-pressed={practiceLayout === 'horizontal'} onClick={() => changePracticeLayout('horizontal')}>橫式 Horizontal</button></div>}
      {quizError && <div className="notice" role="alert">{quizError}</div>}
      </div>
      <div className="fretboard-scroll" role="region" aria-label={vertical ? 'Fretboard frets 1 to 12' : 'Scroll horizontally through frets 1 to 12'} tabIndex={0}>
        {vertical ? <svg className="fretboard vertical" width="300" height={MOBILE_FRETBOARD_HEIGHT} viewBox={`0 0 300 ${MOBILE_FRETBOARD_HEIGHT}`} preserveAspectRatio="xMidYMin meet" role="group" aria-label="Vertical six-string guitar fretboard, frets 1 to 12">
          <defs><linearGradient id="fretboard-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5a4030"/><stop offset="0.5" stopColor="#3c2b25"/><stop offset="1" stopColor="#59402f"/></linearGradient></defs>
          <rect x="45" y="30" width="220" height={MOBILE_FRET_WIRES[12] - 8} fill="url(#fretboard-wood)"/>
          {[3, 5, 7, 9].map(fret => <circle key={fret} cx="155" cy={MOBILE_FRET_CENTERS[fret]} r="8" fill="#d8c7a9" opacity="0.7"/>)}
          {[111, 199].map(x => <circle key={x} cx={x} cy={MOBILE_FRET_CENTERS[12]} r="8" fill="#d8c7a9" opacity="0.7"/>)}
          <rect x="45" y={MOBILE_FRET_WIRES[0] - 4} width="220" height="8" rx="2" fill="#ead9be"/>
          {MOBILE_FRET_WIRES.slice(1).map((y, fret) => <g key={fret}><line x1="45" y1={y + 1} x2="265" y2={y + 1} stroke="#1b1b1b" strokeWidth="4" opacity="0.4"/><line x1="45" y1={y} x2="265" y2={y} stroke="#c8c8c0" strokeWidth="3"/></g>)}
          {verticalStrings.map((string, col) => <g key={string}><line x1={45 + col * 44} y1="32" x2={45 + col * 44} y2={MOBILE_FRET_WIRES[12] + 20} stroke="#c5bdb1" strokeWidth={1.2 + (5 - string) * 0.45}/><text x={45 + col * 44} y="21" textAnchor="middle" className="svg-string-label" aria-label={`String ${6 - string}`}>{6 - string}</text>
            {frets.map(fret => noteTarget(string, fret, 45 + col * 44, MOBILE_FRET_CENTERS[fret], { x: 24 + col * 44, y: MOBILE_FRET_WIRES[fret - 1], width: 42, height: MOBILE_FRET_WIRES[fret] - MOBILE_FRET_WIRES[fret - 1] }))}</g>)}
          {frets.map(fret => <text key={fret} x="14" y={MOBILE_FRET_CENTERS[fret] + 4} textAnchor="middle" className="svg-fret-label">{fret}</text>)}
        </svg> : <svg className="fretboard" width={FRETBOARD_WIDTH} height="330" viewBox={`0 0 ${FRETBOARD_WIDTH} 330`} role="group" aria-label="Six-string guitar fretboard, frets 1 to 12">
          <defs><linearGradient id="fretboard-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a4030"/><stop offset="0.5" stopColor="#3c2b25"/><stop offset="1" stopColor="#59402f"/></linearGradient></defs>
          <rect x="38" y="54" width={FRET_WIRES[12] - 18} height="215" fill="url(#fretboard-wood)"/>
          {[3, 5, 7, 9].map(fret => <circle key={fret} cx={FRET_CENTERS[fret]} cy="161.5" r="8" fill="#d8c7a9" opacity="0.62"/>)}
          {[118.5, 204.5].map(y => <circle key={y} cx={FRET_CENTERS[12]} cy={y} r="8" fill="#d8c7a9" opacity="0.62"/>)}
          <rect x={FRET_WIRES[0] - 4} y="54" width="8" height="215" rx="2" fill="#ead9be"/>
          {FRET_WIRES.slice(1).map((x, fret) => <g key={fret}><line x1={x + 1} y1="54" x2={x + 1} y2="269" stroke="#1b1b1b" strokeWidth="4" opacity="0.4"/><line x1={x} y1="54" x2={x} y2="269" stroke="#c8c8c0" strokeWidth="3"/></g>)}
          {strings.map((string, row) => <g key={string}><line x1="40" y1={54 + row * 43} x2={FRET_WIRES[12] + 18} y2={54 + row * 43} stroke="#c5bdb1" strokeWidth={1.2 + row * 0.45}/><text x="14" y={59 + row * 43} className="svg-string-label" aria-label={`String ${6 - string}`}>{6 - string}</text>
            {frets.map(fret => noteTarget(string, fret, FRET_CENTERS[fret], 54 + row * 43, { x: FRET_WIRES[fret - 1], y: 33 + row * 43, width: FRET_WIRES[fret] - FRET_WIRES[fret - 1], height: 42 }))}</g>)}
          {frets.map(fret => <text key={fret} x={FRET_CENTERS[fret]} y="316" textAnchor="middle" className="svg-fret-label">{fret}</text>)}
        </svg>}
      </div>
      <p className="fretboard-hint">All frets from 1 to 12 are on this board.</p>
      <details className="position-controls"><summary>Choose a position with form controls</summary><div className="field-row"><label>String<select value={accessibleString} onChange={e => setAccessibleString(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>String {n}</option>)}</select></label><label>Fret<select value={accessibleFret} onChange={e => setAccessibleFret(Number(e.target.value))}>{frets.map(n => <option key={n} value={n}>Fret {n}</option>)}</select></label></div><button className="secondary-button" onClick={() => void choose(6 - accessibleString, accessibleFret)}>{mode === 'explore' ? `Select and play ${noteName(STANDARD_TUNING[6 - accessibleString] + accessibleFret)}` : 'Submit position'}</button></details>
      <div className="selected-note"><div><span className="eyebrow">SELECTED POSITION</span><strong>{selected ? noteName(selected.midi) : 'Tap a note'}</strong><small>{selected ? `String ${6 - selected.string} · fret ${selected.fret} · ${Math.round(midiToFrequency(selected.midi))} Hz` : 'The note and octave appear here'}</small></div>{selected && <button className="primary-button compact" onClick={() => void run(() => audioEngine.playNote(selected.midi))}>▶ Replay</button>}</div>
    </section></>
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
  return <><section className="intro-card"><div><p className="eyebrow">02 / SOUND EXPLORER</p><h2>Build it. Then hear it.</h2><p>Compare intervals, chord qualities, inversions and scales in one place.</p></div><div className="pulse-icon">♫</div></section>
    <section className="card"><div className="section-head"><div><h3>Chord player</h3><p>Block or arpeggiated · inversion aware</p></div></div><div className="field-row"><label>Root<select value={root} onChange={e => setRoot(e.target.value)}>{SHARPS.map(n => <option key={n}>{n}</option>)}</select></label><label>Quality<select value={quality} onChange={e => { setQuality(e.target.value); setInversion(0) }}>{Object.keys(CHORD_INTERVALS).map(q => <option key={q} value={q}>{q === 'major' ? 'Major' : q === 'minor' ? 'Minor' : q}</option>)}</select></label></div>
      <div className="field-row"><label>Style<select value={style} onChange={e => setStyle(e.target.value as ChordStyle)}><option value="block">Block chord</option><option value="up">Ascending arpeggio</option><option value="down">Descending arpeggio</option></select></label><label>Inversion<select value={inversion} onChange={e => setInversion(Number(e.target.value))}>{chordPitchClasses(chord).map((_, i) => <option key={i} value={i}>{i === 0 ? 'Root position' : `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : 'rd'} inversion`}</option>)}</select></label></div>
      <div className="note-chips">{voicing.map((midi, i) => <span key={i}>{noteName(midi)}</span>)}</div><div className="button-row"><button className="primary-button" onClick={() => void run(() => audioEngine.playChord(symbol, style, inversion))}>▶ Play {symbol}</button><button className="secondary-button" onClick={stop}>■ Stop</button></div>
    </section>
    <section className="card"><div className="section-head"><div><h3>Interval player</h3><p>Melodic or harmonic · tap to replay</p></div></div><div className="field-row"><label>Interval<select value={interval} onChange={e => setInterval(Number(e.target.value))}>{INTERVALS.map(i => <option key={i.name} value={i.semitones}>{i.name} · {i.semitones} semitones</option>)}</select></label><label>Playback<select value={mode} onChange={e => setMode(e.target.value as IntervalMode)}><option value="ascending">Ascending</option><option value="descending">Descending</option><option value="harmonic">Together</option></select></label></div><div className="button-row"><button className="primary-button" onClick={() => void run(() => audioEngine.playInterval(60, interval, mode))}>▶ Play interval</button><button className="secondary-button" onClick={() => void run(() => audioEngine.playNote(60))}>Reference C4</button></div></section>
    <section className="card"><div className="section-head"><div><h3>Scale player</h3><p>Hear each degree in order</p></div></div><label>Scale<select value={scale} onChange={e => setScale(e.target.value as ScaleName)}><option value="major">Major</option><option value="minor">Natural minor</option><option value="pentatonic">Major pentatonic</option><option value="minorPentatonic">Minor pentatonic</option><option value="blues">Blues</option></select></label><div className="note-chips">{scaleNotes(60 + SHARPS.findIndex(n => n === root), scale).map((midi, i) => <span key={i}>{noteName(midi)}</span>)}</div><button className="primary-button" onClick={() => void run(() => audioEngine.playScale(60 + SHARPS.findIndex(n => n === root), scale))}>▶ Play scale</button></section>
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
  return <><section className="intro-card"><div><p className="eyebrow">03 / HARMONY IN MOTION</p><h2>Follow the changes.</h2><p>Tone.Transport schedules each chord and keeps the visual highlight in sync.</p></div><div className="pulse-icon">▥</div></section>
    <section className="card"><div className="section-head"><div><h3>Progression sequencer</h3><p>Choose a study pattern or edit your own</p></div></div><div className="example-grid">{EXAMPLES.map((ex, i) => <button key={ex.title} className={selected === i ? 'active' : ''} onClick={() => choose(i)}><strong>{ex.title}</strong><small>{ex.chords.join(' → ')}</small></button>)}</div>
      <div className="chord-track">{chords.map((chord, i) => <div key={`${i}-${chord.symbol}`} className={`track-chord ${active === i ? 'playing' : ''}`}><span>{i + 1 < 10 ? `0${i + 1}` : i + 1}</span><strong>{chord.symbol}</strong><select aria-label={`${chord.symbol} duration in beats`} value={chord.beats} onChange={e => setChords(chords.map((c, j) => j === i ? { ...c, beats: Number(e.target.value) } : c))}>{[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n} beats</option>)}</select><div><button aria-label={`Play ${chord.symbol}`} onClick={() => void run(() => audioEngine.playChord(chord.symbol))}>▶</button><button aria-label={`Remove ${chord.symbol}`} onClick={() => setChords(chords.filter((_, j) => j !== i))}>×</button></div></div>)}</div>
      <div className="field-row"><label>Tempo · {options.tempo} BPM<input type="range" min="50" max="180" value={options.tempo} onChange={e => void update({ tempo: Number(e.target.value) })}/></label><label>Time signature<select value={timeSignature} onChange={e => setTimeSignature(Number(e.target.value))}><option value={3}>3/4</option><option value={4}>4/4</option><option value={6}>6/4</option></select></label></div><div className="toggle-row"><label><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)}/> Loop</label><label><input type="checkbox" checked={options.metronome} onChange={e => void update({ metronome: e.target.checked })}/> Metronome</label></div>
      <div className="button-row"><button className="primary-button" disabled={!chords.length} onClick={play}>{playing ? '↻ Restart' : '▶ Play progression'}</button><button className="secondary-button" onClick={() => { stop(); setActive(-1) }}>■ Stop</button></div>
      <div className="add-row"><input aria-label="Chord symbol" placeholder="Add chord, e.g. Am7 or G/B" value={edit} onChange={e => setEdit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addChord() }}/><button onClick={addChord}>+ Add</button></div><p className="helper">Chord durations are in beats. Common symbols include C, Cm, Cmaj7, C7, Dm7, G/B and Fm.</p>
      <div className="voice-note"><span>VOICE LEADING</span><p>{plan.map(p => `${p.chord.symbol}: ${p.notes.map(n => noteName(n)).join(' ')}`).join('   ·   ')}</p></div>
    </section></>
}

export function Compare({ run, stop }: { run: (fn: () => Promise<unknown>) => Promise<void>; stop: () => void }) {
  const [index, setIndex] = useState(0)
  const [heard, setHeard] = useState({ a: false, b: false })
  const [last, setLast] = useState<'a' | 'b'>('a')
  const item = COMPARISONS[index]
  function select(i: number) { stop(); setIndex(i); setHeard({ a: false, b: false }) }
  function play(side: 'a' | 'b') { setLast(side); setHeard(v => ({ ...v, [side]: true })); void run(() => audioEngine.playSequence(comparisonEvents(item, side))) }
  return <><section className="intro-card"><div><p className="eyebrow">04 / CRITICAL LISTENING</p><h2>Hear the difference.</h2><p>Matched register, duration and level help you focus on what changes musically.</p></div><div className="pulse-icon">⇄</div></section>
    <section className="card"><label>Comparison<select value={index} onChange={e => select(Number(e.target.value))}>{COMPARISONS.map((c, i) => <option key={c.id} value={i}>{c.category} · {c.title}</option>)}</select></label><div className="ab-grid"><div><span className="eyebrow">VERSION A</span><h3>{item.a.join(' → ')}</h3><button className="primary-button" aria-label="Play A" onClick={() => play('a')}>▶ Play A</button></div><div><span className="eyebrow">VERSION B</span><h3>{item.b.join(' → ')}</h3><button className="primary-button" aria-label="Play B" onClick={() => play('b')}>▶ Play B</button></div></div><div className="button-row"><button className="secondary-button" aria-label={`Replay ${last.toUpperCase()}`} onClick={() => play(last)}>↻ Replay {last.toUpperCase()}</button><button className="secondary-button" onClick={stop}>■ Stop</button></div>
      {heard.a && heard.b ? <div className="explanation"><span>WHAT CHANGED</span><strong>{item.difference}</strong><p>{item.explanation}</p></div> : <p className="helper">Play both versions to reveal the listening guide.</p>}
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
  return <><section className="intro-card"><div><p className="eyebrow">05 / EAR TRAINING</p><h2>Listen before you look.</h2><p>Audio questions hide the answer until you submit. Replaying never counts against you.</p></div><div className="pulse-icon">◉</div></section>
    <section className="card"><div className="type-pills">{EAR_TYPES.map(t => <button key={t.id} className={type === t.id ? 'active' : ''} onClick={() => next(t.id)}>{t.label}</button>)}</div><div className="question-box"><span className="eyebrow">LISTENING QUESTION</span><h3>{question.prompt}</h3><p>Listen as often as you need, then choose an answer.</p><div className="button-row"><button className="primary-button" onClick={play}>{started ? '↻ Replay audio' : '▶ Play question'}</button>{question.reference && <button className="secondary-button" onClick={() => void run(() => audioEngine.playSequence(question.reference!))}>Reference tonic</button>}</div><small>Replays: {replays}</small></div>
      {(options.silent || !options.enabled) && <p className="helper">Turn sound on to answer listening questions. Fretboard and theory exploration remain available in silent mode.</p>}
      <div className="choice-grid">{question.choices.map(choice => <button key={choice} disabled={answer !== null || options.silent || !options.enabled || !started} className={answer !== null ? choice === question.answer ? 'correct' : choice === answer ? 'wrong' : '' : ''} onClick={() => void submit(choice)}>{choice}</button>)}</div>
      {answer !== null && <div className={`feedback ${answer === question.answer ? 'success' : ''}`} role="status"><strong>{answer === question.answer ? 'Correct — well heard.' : `Not quite. The answer is ${question.answer}.`}</strong><p>{question.explanation}</p><p>{question.reveal}</p><span>Listen for: {question.focusNotes}</span>{mastery !== null && <small>Recent topic accuracy: {mastery}%</small>}<button className="primary-button" onClick={() => next()}>Next question →</button></div>}
      {saveError && <div className="notice" role="alert">{saveError}</div>}
    </section>
    <section className="card"><div className="section-head"><div><h3>Recent practice</h3><p>Stored locally in this browser</p></div></div>{history.length ? <div className="history">{history.map(a => <div key={a.id}><span>{a.correct ? '✓' : '·'}</span><strong>{a.topicId.replace('ear.', '')}</strong><small>{a.correct ? 'Correct' : `Review ${a.expected}`} · {a.replays} replays</small></div>)}</div> : <p className="helper">Your answered questions will appear here.</p>}</section>
  </>
}

export function AudioSettingsPanel() {
  const { options, update } = useAudioSettings()
  return <><section className="card settings-card"><h3>聲音 Audio</h3><div className="setting"><div><strong>Audio enabled</strong><p>Allow sound during practice</p></div><input type="checkbox" checked={options.enabled} onChange={e => void update({ enabled: e.target.checked })} aria-label="Audio enabled"/></div><div className="setting"><div><strong>Silent mode</strong><p>Practice without sound while commuting</p></div><input type="checkbox" checked={options.silent} onChange={e => void update({ silent: e.target.checked })} aria-label="Silent mode"/></div>
      <label>Instrument<select value={options.instrument} onChange={e => void update({ instrument: e.target.value as 'pluck' | 'keys' })}><option value="pluck">Clean guitar-style · modeled string</option><option value="keys">Clean keys · synthesized</option></select></label><p className="helper">Both sounds are generated locally. The guitar-style sound is a modeled string, not a recorded guitar sample. No network connection is required.</p>
      <label>Master volume · {Math.round(options.volume * 100)}%<input type="range" min="0" max="1" step="0.01" value={options.volume} onChange={e => void update({ volume: Number(e.target.value) })}/></label><label>Playback tempo · {options.tempo} BPM<input type="range" min="50" max="180" value={options.tempo} onChange={e => void update({ tempo: Number(e.target.value) })}/></label><label>Note duration · {options.noteDuration.toFixed(2)} s<input type="range" min="0.15" max="1.2" step="0.05" value={options.noteDuration} onChange={e => void update({ noteDuration: Number(e.target.value) })}/></label><div className="setting"><div><strong>Metronome</strong><p>Click during progression playback</p></div><input type="checkbox" checked={options.metronome} onChange={e => void update({ metronome: e.target.checked })} aria-label="Metronome"/></div>
      <button className="secondary-button" onClick={() => void audioEngine.activate()}>Activate audio</button><p className="helper">Mobile browsers require a tap before sound starts. Playback pauses when the app is backgrounded; tap again after an interruption.</p>
    </section></>
}
