import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../../app/router'
import { nodeById } from '../../curriculum/nodes'
import { repository } from '../../database/repository'
import { naturalNoteConfirmation } from '../../exercise-engine/answerNote'
import type { Grade, Question, Response } from '../../exercise-engine/types'
import { playedQuestion } from '../../exercise-engine/playedAnswer'
import { validate } from '../../exercise-engine/validate'
import { t } from '../../i18n/zh-TW'
import { ERROR_LABEL } from '../../learning/labels'
import { recommendations } from '../../learning/mastery'
import type { ExerciseAttempt, PlannedItem, PracticeSession, SessionSummary } from '../../learning/records'
import { insertRecheck, recheckFor, withoutDegreePositionQuestions } from '../../learning/sessions'
import { randomSeed } from '../../lib/rng'
import { audioIsOn, useAudioUi } from '../../stores/audioUi'
import { downloadJson, useLearning } from '../../stores/learning'
import { LessonContentView } from './LessonCard'
import { PlayListener } from '../../components/listen/PlayListener'
import { DeviceTransfer } from '../../components/DeviceTransfer'
import { QuestionView } from './QuestionView'

interface AnswerState { grade: Grade; response: Response; attemptId: string; firstAttemptId: string }
interface RetryState { firstAttemptId: string; count: number }

export function SessionScreen({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<PracticeSession | null | undefined>(undefined)
  const [view, setView] = useState(0)
  const [answer, setAnswer] = useState<AnswerState | null>(null)
  const [retry, setRetry] = useState<RetryState | null>(null)
  const [showWhy, setShowWhy] = useState(false)
  const [hinted, setHinted] = useState(false)
  const [holdAdvance, setHoldAdvance] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const answerAudioTimer = useRef<number | undefined>(undefined)
  const answerAudioGeneration = useRef(0)
  const [paused, setPaused] = useState(false)
  const [inputOverride, setInputOverride] = useState<'tap' | undefined>()
  const actions = useRef({ next: () => {}, retry: () => {} })
  const [boxChanges, setBoxChanges] = useState({ promoted: 0, demoted: 0 })
  const shownAt = useRef(performance.now())
  const busy = useRef(false)
  // The confirmation pluck may still be loading when the next question appears. Do not cancel it.
  const confirming = useRef(false)
  const advanceRef = useRef<() => void>(() => {})
  const learning = useLearning()
  const { play, stop } = useAudioUi()

  useEffect(() => {
    let cancelled = false
    repository.getSession(sessionId).then(s => {
      if (cancelled) return
      if (!s) { setSession(null); return }
      const cleaned = withoutDegreePositionQuestions(s)
      setSession(cleaned)
      setView(cleaned.cursor)
      if (cleaned !== s) void repository.saveSession({ ...s, ...cleaned, updatedAt: Date.now() })
    }).catch(() => setSession(null))
    return () => { cancelled = true; stop() }
  }, [sessionId, stop])

  useEffect(() => { answerAudioGeneration.current++; window.clearTimeout(answerAudioTimer.current); shownAt.current = performance.now(); setShowWhy(false); setHoldAdvance(false); setRetry(null); setHinted(false) }, [view])

  // A reload can land past the last planned question. Fetch another batch instead of ending the session.
  useEffect(() => {
    if (!session || session.mode !== 'guided' || session.status !== 'active' || view < session.plannedItems.length) return
    let cancelled = false
    useLearning.getState().extendGuided(session).then(extended => {
      if (cancelled) return
      if (extended) { setSession(extended); setView(session.cursor) }
      else setSession({ ...session, status: 'completed', endedAt: Date.now() })
    }).catch(() => { if (!cancelled) setSession({ ...session, status: 'completed', endedAt: Date.now() }) })
    return () => { cancelled = true }
  }, [session, view])

  useEffect(() => () => { answerAudioGeneration.current++; window.clearTimeout(answerAudioTimer.current) }, [])

  // Both input methods advance after success and retry the same question after a miss.
  useEffect(() => {
    if (paused || saving || saveError || !answer || answer.grade.result !== 'correct' || showWhy || holdAdvance || !session || session.status === 'completed' || session.cursor <= view) return
    const delay = 1500
    const timer = window.setTimeout(() => advanceRef.current(), delay)
    return () => window.clearTimeout(timer)
  }, [answer, holdAdvance, showWhy, session, view, paused, saving, saveError])

  useEffect(() => {
    const hide = () => { if (document.hidden) { setPaused(true); stop() } }
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || target.closest('input,select,textarea,button,[contenteditable="true"],[data-cell]')) return
      if (event.code === 'Space') { event.preventDefault(); setPaused(p => !p); stop() }
      if (event.key === 'Enter') { event.preventDefault(); actions.current.next() }
      if (event.key.toLowerCase() === 'r') { event.preventDefault(); actions.current.retry() }
    }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('keydown', keys)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('keydown', keys) }
  }, [stop])

  useEffect(() => {
    if (paused || saving || saveError || holdAdvance || showWhy || !answer || !session || session.status === 'completed' || answer.grade.result === 'correct') return
    const timer = window.setTimeout(() => actions.current.retry(), 1400)
    return () => window.clearTimeout(timer)
  }, [answer, paused, saving, saveError, holdAdvance, showWhy, session])

  useEffect(() => { if (!paused) shownAt.current = performance.now() }, [paused])

  const item: PlannedItem | undefined = session?.plannedItems[view]
  const instrument = session?.settings.practiceContext === 'instrument'
  const inputMode = inputOverride ?? session?.settings.answerInput ?? (instrument ? learning.preferences.answerInput : 'tap')
  const questionCount = session?.plannedItems.filter(i => i.kind === 'question').length ?? 0
  const answeredCount = session?.outcomes.filter(o => o.result && o.result !== 'done').length ?? 0

  if (session === undefined) return <p className="helper">載入中…</p>
  if (session === null) return <div className="card"><h2>找不到這個練習</h2><p>它可能已被刪除或來自其他裝置。</p><button className="primary-button" onClick={() => navigate('/')}>回到今日</button></div>
  if (session.mode === 'guided' && session.status === 'active' && !item) return <p className="helper">下一題…</p>
  if (session.status === 'completed' || !item) return <SessionSummaryView session={session} boxChanges={boxChanges}/>

  async function submit(question: Question, response: Response) {
    if (busy.current || paused || saveError || !session) return
    busy.current = true
    setSaving(true)
    if (response.kind === 'played-note' && question.kind === 'fret-locate') question = playedQuestion(question)
    const grade = validate(question, response)
    const microphone = response.kind === 'played-note'
    // A played answer is already the guitar. Do not play it back into the open microphone.
    const confirmation = inputMode === 'play' ? null : naturalNoteConfirmation(question, response, grade)
    confirming.current = !!confirmation && audioIsOn()
    if (confirming.current && confirmation) void play(confirmation)
    const isRetry = !!retry
    const now = Date.now()
    const attempt: ExerciseAttempt = {
      id: crypto.randomUUID(), sessionId: session.id, exerciseType: question.kind, templateId: question.templateId, topicId: question.nodeId, nodeId: question.nodeId,
      inputMethod: microphone ? 'microphone' : response.kind === 'fret-locate' ? response.inputMethod ?? 'tap' : 'tap',
      practiceContext: session.settings.practiceContext ?? 'pocket',
      verificationScope: grade.verificationScope ?? (question.kind === 'fret-locate' ? 'screenPosition' : question.kind === 'fret-identify' ? 'noteNaming' : 'unknown'),
      reviewItemIds: microphone ? [] : question.reviewItemIds, itemResults: grade.itemResults, generatorVersion: question.generatorVersion, question, response,
      expected: grade.expectedText, correct: grade.result === 'correct', result: grade.result, errorClass: grade.errorClass, evidenceLevel: question.evidenceLevel,
      assisted: isRetry || hinted, retryOf: retry?.firstAttemptId, responseMs: microphone || question.kind === 'rhythm' ? 0 : Math.round(performance.now() - shownAt.current), replays: 0,
      difficulty: question.difficulty, timestamp: now,
      ...(question.kind === 'fret-locate' && response.kind === 'fret-locate' ? { string: response.string, fret: response.fret, targetString: question.string } : {}),
      ...(question.kind === 'fret-identify' ? { targetString: question.string, targetFret: question.fret } : {}),
    }
    let plannedItems = session.plannedItems
    const current = session.plannedItems[view]
    if (!microphone && !isRetry && grade.result !== 'correct' && current.kind === 'question' && !current.recheckOf) {
      const recheck = recheckFor(question, randomSeed())
      if (recheck) plannedItems = insertRecheck(plannedItems, view, recheck)
    }
    const outcome = { index: view, attemptId: attempt.id, result: grade.result, errorClass: grade.errorClass, nodeId: question.nodeId }
    const next: PracticeSession = {
      ...session, plannedItems, cursor: isRetry ? session.cursor : view + 1, updatedAt: now,
      outcomes: isRetry ? session.outcomes : [...session.outcomes.filter(o => o.index !== view), outcome],
    }
    setAnswer({ grade, response, attemptId: attempt.id, firstAttemptId: retry?.firstAttemptId ?? attempt.id })
    setShowWhy(false)
    setHoldAdvance(false)
    const before = attempt.reviewItemIds.map(id => learning.reviews.get(id)?.box ?? 0)
    try {
      const { reviews } = await repository.recordAttempt(attempt, isRetry ? undefined : { id: session.id, cursor: next.cursor, plannedItems, outcome })
      setSaveError('')
      setBoxChanges(c => ({
        promoted: c.promoted + reviews.filter((r, i) => r.box > (before[i] ?? 0)).length,
        demoted: c.demoted + reviews.filter((r, i) => r.box < (before[i] ?? 0)).length,
      }))
    } catch {
      learning.addUnsaved(attempt, session.id, isRetry ? undefined : { id: session.id, cursor: next.cursor, plannedItems, outcome })
      setSaveError(t.storage.unsaved)
    }
    setSession(next)
    busy.current = false
    setSaving(false)
  }

  async function advance(patch?: { outcome?: PracticeSession['outcomes'][number] }) {
    if (!session || busy.current || paused || saveError) return
    const cursor = Math.max(session.cursor, view + 1)
    const next = { ...session, cursor, updatedAt: Date.now(), outcomes: patch?.outcome ? [...session.outcomes.filter(o => o.index !== view), patch.outcome] : session.outcomes }
    setAnswer(null)
    if (confirming.current) confirming.current = false
    else stop()
    if (cursor >= session.plannedItems.length && session.mode === 'guided') {
      try {
        const extended = await learning.extendGuided(next)
        if (extended && extended.plannedItems.length > cursor) { setSession(extended); setView(cursor); return }
      } catch { /* show the summary if another batch cannot be stored */ }
    }
    if (cursor >= next.plannedItems.length) await finish(next)
    else { setSession(next); setView(cursor) }
  }

  async function skip() {
    if (!session || item?.kind !== 'question') return
    const outcome = { index: view, result: 'skipped' as const, nodeId: item.question.nodeId }
    try { await repository.recordEvent({ id: crypto.randomUUID(), sessionId: session.id, nodeId: item.question.nodeId, kind: 'skip', payload: { questionId: item.question.id }, timestamp: Date.now() }, { id: session.id, cursor: view + 1, outcome }) }
    catch { /* a skip carries no learning evidence; nothing to lose */ }
    await advance({ outcome })
  }

  async function learnDone() {
    if (!session || item?.kind !== 'learn') return
    const outcome = { index: view, result: 'done' as const, nodeId: item.nodeId }
    try { await repository.recordEvent({ id: crypto.randomUUID(), sessionId: session.id, nodeId: item.nodeId, kind: 'explore', payload: { lesson: item.nodeId }, timestamp: Date.now() }, { id: session.id, cursor: view + 1, outcome }) }
    catch { /* exploration is not graded */ }
    await advance({ outcome })
  }

  async function bridge(action: 'later' | 0 | 1 | 2) {
    if (!session || item?.kind !== 'bridge') return
    const now = Date.now()
    try {
      if (action === 'later') await repository.queueBridge({ id: crypto.randomUUID(), nodeId: item.nodeId, taskId: item.taskId, createdAt: now })
      else {
        const queueId = crypto.randomUUID()
        await repository.queueBridge({ id: queueId, nodeId: item.nodeId, taskId: item.taskId, createdAt: now })
        await repository.completeBridge(queueId, { id: crypto.randomUUID(), bridgeTaskId: item.taskId, nodeId: item.nodeId, rating: action, verified: false, timestamp: now })
      }
    } catch { setSaveError('吉他任務無法儲存，但不影響其他練習。') }
    await advance({ outcome: { index: view, result: 'done', nodeId: item.nodeId } })
  }

  async function finish(final: PracticeSession) {
    const graded = final.outcomes.filter(o => o.result === 'correct' || o.result === 'incorrect' || o.result === 'partial')
    const errorClasses: Record<string, number> = {}
    for (const o of graded) if (o.errorClass) errorClasses[o.errorClass] = (errorClasses[o.errorClass] ?? 0) + 1
    const summary: SessionSummary = {
      graded: graded.length, correct: graded.filter(o => o.result === 'correct').length, partial: graded.filter(o => o.result === 'partial').length,
      skipped: final.outcomes.filter(o => o.result === 'skipped').length, nodes: [...new Set(graded.map(o => o.nodeId!).filter(Boolean))], errorClasses,
      promoted: boxChanges.promoted, demoted: boxChanges.demoted,
    }
    const completed: PracticeSession = { ...final, status: 'completed', endedAt: Date.now(), summary }
    try { await repository.saveSession(completed) } catch { setSaveError('練習結果無法儲存，請再試一次。'); return }
    setSession(completed)
    await learning.refresh()
    // Ask for persistent storage after a meaningful gesture (finishing a session); never blocks practice.
    void navigator.storage?.persist?.().catch(() => undefined)
  }

  advanceRef.current = () => { void advance() }

  const openEnded = session.mode === 'guided'
  const progress = !openEnded && questionCount ? Math.min(1, answeredCount / questionCount) : 0
  const node = item.kind === 'question' ? nodeById(item.question.nodeId) : nodeById(item.nodeId)
  const needsAudio = item.kind === 'question' && !!item.question.audio && !audioIsOn()

  const retryAnswer = () => {
    if (!answer || busy.current || paused || saveError) return
    setRetry({ firstAttemptId: answer.firstAttemptId, count: (retry?.count ?? 0) + 1 })
    answerAudioGeneration.current++; window.clearTimeout(answerAudioTimer.current)
    setAnswer(null); setHinted(false); setHoldAdvance(false); setShowWhy(false); shownAt.current = performance.now()
  }
  actions.current = { next: () => { if (answer) void advance() }, retry: retryAnswer }
  return <div className={`session ${instrument ? 'instrument-session' : 'pocket-session'}`}>
    <div className="practice-mode-label">{instrument ? '彈吉他' : '通勤練習'} · {inputMode === 'play' && item.kind === 'question' && item.question.kind === 'fret-locate' ? '音高驗證' : '指板與音名回想'}</div>
    <div className="session-bar">
      <button type="button" className="icon-button" onClick={() => navigate('/')} aria-label="離開練習（之後可以繼續）">✕</button>
      {!openEnded && <div className="session-progress" role="progressbar" aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={answeredCount} aria-label="練習進度"><span style={{ width: `${progress * 100}%` }}/></div>}
      <button type="button" className="secondary-button" title="空白鍵：暫停或繼續" aria-keyshortcuts="Space" onClick={() => { setPaused(!paused); stop(); shownAt.current = performance.now() }}>{paused ? '繼續練習' : '暫停'}</button>
      <button type="button" className="text-button" disabled={busy.current || !!saveError} onClick={() => { if (!busy.current) void finish(session) }}>結束這次</button>
      <small>{openEnded ? `已答 ${answeredCount}` : `${answeredCount}/${questionCount}`}</small>
    </div>
    {paused && <p className="notice" role="status">已暫停。</p>}

    <p className="session-context">{node?.title.replace(/\s+[A-Za-z].*$/, '')}{item.kind === 'question' && <> · <span>{item.reason}</span></>}</p>
    {saveError && <div className="notice" role="alert">{saveError}{learning.unsaved.length === 0 && <button className="secondary-button" onClick={() => setSaveError('')}>重新嘗試</button>}{learning.unsaved.length > 0 && <div className="button-row">
      <button className="secondary-button" onClick={() => void learning.retryUnsaved().then(left => setSaveError(left ? t.storage.unsaved : ''))}>{t.storage.retry}</button>
      <button className="secondary-button" onClick={() => downloadJson(`guitar-lab-unsaved-${Date.now()}.json`, learning.unsaved)}>{t.storage.export}</button>
    </div>}</div>}

    {item.kind === 'learn' && node && <article className="card lesson-card">
      <p className="eyebrow">學習 LEARN</p>
      <h2>{node.title}</h2>
      <LessonContentView node={node}/>
      <button type="button" className="primary-button wide" onClick={() => void learnDone()}>懂了，開始練習 →</button>
    </article>}

    {item.kind === 'bridge' && node?.bridge && <article className="card bridge-card">
      <p className="eyebrow">拿起吉他 PLAY IT · 約 {node.bridge.minutes} 分鐘</p>
      <h2>{node.title}</h2>
      <p className="bridge-text">{node.bridge.text}</p>
            <button type="button" className="primary-button wide" onClick={() => void bridge('later')}>稍後再彈</button>
      <div className="choice-grid three">
        <button type="button" onClick={() => void bridge(0)}>還不太行</button>
        <button type="button" onClick={() => void bridge(1)}>勉強可以</button>
        <button type="button" onClick={() => void bridge(2)}>很順</button>
      </div>
    </article>}

    {item.kind === 'question' && <article className="card question-card" inert={paused || !!saveError}>
      <QuestionView key={`${item.question.id}-${['construct', 'rhythm'].includes(item.question.kind) ? retry?.count ?? 0 : 0}`} question={item.question} grade={answer?.grade ?? null} response={answer?.response ?? null} inputMode={inputMode} hinted={hinted} onHint={() => setHinted(true)}
        onSubmit={response => void submit(item.question, response)}/>
      {!answer && <button type="button" className="text-button" onClick={() => { if (retry) void advance(); else void skip() }}>{needsAudio ? '跳過這題（需要聲音，不扣分）' : '跳過（不扣分）'}</button>}
      {answer && <div className={`feedback result-${answer.grade.result}`} role="status">
        <strong>{answer.grade.result === 'correct' ? (answer.response.kind === 'played-note' ? '✓ 音高正確' : '✓ 正確') : answer.grade.result === 'partial' ? '◐ 部分正確' : '✕ 還不對'}{hinted ? '（有提示）' : ''}</strong>
        {(answer.response.kind !== 'played-note' || answer.grade.result !== 'correct') && <p>{answer.grade.feedback}</p>}
        {answer.grade.result !== 'correct' && answer.response.kind !== 'played-note' && <p className="expected">正確答案：{answer.grade.expectedText}</p>}
        {offersWhy(item.question) && showWhy && <p className="explanation-text">{item.question.explanation}</p>}
        {answer.response.kind !== 'played-note' && (offersWhy(item.question) || item.question.answerAudio) && <div className="feedback-actions">
          {offersWhy(item.question) && <button type="button" className="secondary-button" onClick={() => { setShowWhy(!showWhy) }} aria-expanded={showWhy}>{showWhy ? t.common.hideWhy : t.common.why}</button>}
          {item.question.answerAudio && <button type="button" className="secondary-button" onClick={() => {
            window.clearTimeout(answerAudioTimer.current)
            const generation = ++answerAudioGeneration.current
            setHoldAdvance(true)
            const audio = item.question.answerAudio!
            void play(audio).then(() => { if (generation !== answerAudioGeneration.current) return; answerAudioTimer.current = window.setTimeout(() => setHoldAdvance(false), audio.reduce((sum, event) => sum + event.duration, 0) * 1000 + 500) })
          }}>▶ 聽答案</button>}
        </div>}
      </div>}
    </article>}
    {inputMode === 'play' && item.kind === 'question' && item.question.kind === 'fret-locate' && <PlayListener autoStart disabled={!!answer || item.kind !== 'question' || item.question.kind !== 'fret-locate' || !!saveError} targetId={`${item.question.id}-${retry?.count ?? 0}`} paused={paused}
      onNote={response => { if (item.kind === 'question') void submit(item.question, response) }} onFallback={() => setInputOverride('tap')}/>}
  </div>
}

function SessionSummaryView({ session, boxChanges }: { session: PracticeSession; boxChanges: { promoted: number; demoted: number } }) {
  const learning = useLearning()
  const s = session.summary
  const recs = useMemo(() => recommendations(learning.attempts, learning.reviews, learning.mastery, Date.now()), [learning.attempts, learning.reviews, learning.mastery])
  const next = recs.find(r => r.kind !== 'due' && r.nodeId) ?? recs[0]
  const errors = Object.entries(s?.errorClasses ?? {}).sort((a, b) => b[1] - a[1])
  const accuracy = s && s.graded ? Math.round(s.correct / s.graded * 100) : 0
  return <div className="card summary-card">
    <p className="eyebrow">練習完成 SESSION COMPLETE</p>
    <h2>{s?.graded ? `答對 ${s.correct}/${s.graded}（${accuracy}%）` : '完成！'}</h2>
    {s && <ul className="summary-stats">
      {s.partial > 0 && <li>部分正確 {s.partial} 題（通常是拼法）</li>}
      {s.skipped > 0 && <li>跳過 {s.skipped} 題（不影響熟練度）</li>}
      <li>練習主題：{s.nodes.map(id => nodeById(id)?.title ?? id).join('、') || '—'}</li>
      <li>複習排程：{s.promoted || boxChanges.promoted} 個項目延長了複習間隔{s.graded - s.correct > 0 ? `；答錯的 ${s.graded - s.correct} 題會在短時間內再出現` : ''}</li>
    </ul>}
    {errors.length > 0 && <div className="summary-errors"><h3>這次常見的錯誤</h3><ul>{errors.map(([cls, n]) => <li key={cls}>{ERROR_LABEL[cls] ?? cls}：{n} 次</li>)}</ul></div>}
    {next && <div className="summary-next"><h3>建議下一步</h3><p><strong>{next.title}</strong> — {next.reason}</p></div>}
    <DeviceTransfer/>
    <div className="button-row">
      {next?.nodeId && <button className="primary-button" onClick={() => navigate(`/learn/${next.nodeId}`)}>前往：{nodeById(next.nodeId)?.title}</button>}
      <button className="secondary-button" onClick={() => navigate('/')}>回到今日</button>
    </div>
  </div>
}

/** "Find this note on string N" already shows the fret in the result. No extra why. */
const NOTE_FIND_TEMPLATES = new Set([
  'fret.naturals.all.locate',
  'fret.naturals.low.locate',
  'fret.accidentals.locate',
  'fret.open.locate',
])

function offersWhy(question: Question): boolean {
  return question.explanation.trim().length > 0 && !NOTE_FIND_TEMPLATES.has(question.templateId)
}
