import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../../app/router'
import { nodeById } from '../../curriculum/nodes'
import { repository } from '../../database/repository'
import type { Grade, Question, Response } from '../../exercise-engine/types'
import { validate } from '../../exercise-engine/validate'
import { t } from '../../i18n/zh-TW'
import { ERROR_LABEL } from '../../learning/labels'
import { recommendations } from '../../learning/mastery'
import type { ExerciseAttempt, PlannedItem, PracticeSession, SessionSummary } from '../../learning/records'
import { insertRecheck, recheckFor } from '../../learning/sessions'
import { randomSeed } from '../../lib/rng'
import { audioIsOn, useAudioUi } from '../../stores/audioUi'
import { downloadJson, useLearning } from '../../stores/learning'
import { LessonContentView } from './LessonCard'
import { QuestionView } from './QuestionView'

interface AnswerState { grade: Grade; response: Response; attemptId: string; firstAttemptId: string }
interface RetryState { firstAttemptId: string; count: number }

export function SessionScreen({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<PracticeSession | null | undefined>(undefined)
  const [view, setView] = useState(0)
  const [answer, setAnswer] = useState<AnswerState | null>(null)
  const [retry, setRetry] = useState<RetryState | null>(null)
  const [showWhy, setShowWhy] = useState(false)
  const [holdAdvance, setHoldAdvance] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [boxChanges, setBoxChanges] = useState({ promoted: 0, demoted: 0 })
  const shownAt = useRef(performance.now())
  const busy = useRef(false)
  const advanceRef = useRef<() => void>(() => {})
  const learning = useLearning()
  const { play, stop } = useAudioUi()

  useEffect(() => {
    let cancelled = false
    repository.getSession(sessionId).then(s => {
      if (cancelled) return
      setSession(s ?? null)
      if (s) setView(s.cursor)
    }).catch(() => setSession(null))
    return () => { cancelled = true; stop() }
  }, [sessionId, stop])

  useEffect(() => { shownAt.current = performance.now(); setShowWhy(false); setHoldAdvance(false); setRetry(null) }, [view])

  // Show the marked fret briefly, then move on. A wrong answer stays longer so the correct position can be seen.
  useEffect(() => {
    if (!answer || holdAdvance || !session || session.status === 'completed' || session.cursor <= view) return
    const delay = answer.grade.result === 'correct' ? 600 : 1800
    const timer = window.setTimeout(() => advanceRef.current(), delay)
    return () => window.clearTimeout(timer)
  }, [answer, holdAdvance, session, view])

  const item: PlannedItem | undefined = session?.plannedItems[view]
  const questionCount = session?.plannedItems.filter(i => i.kind === 'question').length ?? 0
  const answeredCount = session?.outcomes.filter(o => o.result && o.result !== 'done').length ?? 0

  if (session === undefined) return <p className="helper">載入中…</p>
  if (session === null) return <div className="card"><h2>找不到這個練習</h2><p>它可能已被刪除或來自其他裝置。</p><button className="primary-button" onClick={() => navigate('/')}>回到今日</button></div>
  if (session.status === 'completed' || !item) return <SessionSummaryView session={session} boxChanges={boxChanges}/>

  async function submit(question: Question, response: Response) {
    if (busy.current || !session) return
    busy.current = true
    const grade = validate(question, response)
    const isRetry = !!retry
    const now = Date.now()
    const attempt: ExerciseAttempt = {
      id: crypto.randomUUID(), sessionId: session.id, exerciseType: question.kind, templateId: question.templateId, topicId: question.nodeId, nodeId: question.nodeId,
      reviewItemIds: question.reviewItemIds, itemResults: grade.itemResults, generatorVersion: question.generatorVersion, question, response,
      expected: grade.expectedText, correct: grade.result === 'correct', result: grade.result, errorClass: grade.errorClass, evidenceLevel: question.evidenceLevel,
      assisted: isRetry, retryOf: retry?.firstAttemptId, responseMs: question.kind === 'rhythm' ? 0 : Math.round(performance.now() - shownAt.current), replays: 0,
      difficulty: question.difficulty, timestamp: now,
      ...(question.kind === 'fret-locate' && response.kind === 'fret-locate' ? { string: response.string, fret: response.fret, targetString: question.string } : {}),
      ...(question.kind === 'fret-identify' ? { targetString: question.string, targetFret: question.fret } : {}),
    }
    let plannedItems = session.plannedItems
    const current = session.plannedItems[view]
    if (!isRetry && grade.result !== 'correct' && current.kind === 'question' && !current.recheckOf) {
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
      learning.addUnsaved(attempt, session.id)
      setSaveError(t.storage.unsaved)
    }
    setSession(next)
    busy.current = false
  }

  async function advance(patch?: { outcome?: PracticeSession['outcomes'][number] }) {
    if (!session) return
    const cursor = Math.max(session.cursor, view + 1)
    const next = { ...session, cursor, updatedAt: Date.now(), outcomes: patch?.outcome ? [...session.outcomes.filter(o => o.index !== view), patch.outcome] : session.outcomes }
    setAnswer(null)
    stop()
    if (cursor >= session.plannedItems.length) await finish(next)
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
    try { await repository.saveSession(completed) } catch { setSaveError('練習結果無法儲存。') }
    setSession(completed)
    await learning.refresh()
    // Ask for persistent storage after a meaningful gesture (finishing a session); never blocks practice.
    void navigator.storage?.persist?.().catch(() => undefined)
  }

  advanceRef.current = () => { void advance() }

  const progress = questionCount ? Math.min(1, answeredCount / questionCount) : 0
  const node = item.kind === 'question' ? nodeById(item.question.nodeId) : nodeById(item.nodeId)
  const needsAudio = item.kind === 'question' && !!item.question.audio && !audioIsOn()

  return <div className="session">
    <div className="session-bar">
      <button type="button" className="icon-button" onClick={() => navigate('/')} aria-label="離開練習（之後可以繼續）">✕</button>
      <div className="session-progress" role="progressbar" aria-valuemin={0} aria-valuemax={questionCount} aria-valuenow={answeredCount} aria-label="練習進度"><span style={{ width: `${progress * 100}%` }}/></div>
      <small>{answeredCount}/{questionCount}</small>
    </div>
    <p className="session-context">{node?.title}{item.kind === 'question' && <> · <span>{item.reason}</span></>}</p>
    {saveError && <div className="notice" role="alert">{saveError}{learning.unsaved.length > 0 && <div className="button-row">
      <button className="secondary-button" onClick={() => void learning.retryUnsaved().then(left => setSaveError(left ? t.storage.unsaved : ''))}>{t.storage.retry}</button>
      <button className="secondary-button" onClick={() => downloadJson(`guitar-lab-unsaved-${Date.now()}.json`, learning.unsaved)}>{t.storage.export}</button>
    </div>}</div>}

    {item.kind === 'learn' && node && <article className="card lesson-card">
      <p className="eyebrow">學習 LEARN</p>
      <h2>{node.title}</h2>
      <LessonContentView node={node} layout={learning.preferences.practiceLayout}/>
      <button type="button" className="primary-button wide" onClick={() => void learnDone()}>懂了，開始練習 →</button>
    </article>}

    {item.kind === 'bridge' && node?.bridge && <article className="card bridge-card">
      <p className="eyebrow">拿起吉他 PLAY IT · 約 {node.bridge.minutes} 分鐘</p>
      <h2>{node.title}</h2>
      <p className="bridge-text">{node.bridge.text}</p>
      <p className="helper">這段練習在手機上已經做完。沒有吉他就先排到稍後，回家再彈。自我評估只會標記「彈過」，不會提高記憶熟練度。</p>
      <button type="button" className="primary-button wide" onClick={() => void bridge('later')}>先排到稍後，回家再彈</button>
      <div className="choice-grid three">
        <button type="button" onClick={() => void bridge(0)}>還不太行</button>
        <button type="button" onClick={() => void bridge(1)}>勉強可以</button>
        <button type="button" onClick={() => void bridge(2)}>很順</button>
      </div>
    </article>}

    {item.kind === 'question' && <article className="card question-card">
      <QuestionView key={`${item.question.id}-${retry?.count ?? 0}`} question={item.question} grade={answer?.grade ?? null} response={answer?.response ?? null} layout={learning.preferences.practiceLayout}
        onSubmit={response => void submit(item.question, response)}/>
      {!answer && (retry
        ? <button type="button" className="text-button" onClick={() => void advance()}>不重試了，下一題 →</button>
        : <button type="button" className="text-button" onClick={() => void skip()}>{needsAudio ? '跳過這題（需要聲音，不扣分）' : '跳過（不扣分）'}</button>)}
      {answer && <div className={`feedback result-${answer.grade.result}`} role="status">
        <strong>{answer.grade.result === 'correct' ? '✓ 正確' : answer.grade.result === 'partial' ? '◐ 部分正確' : '✕ 還不對'}</strong>
        <p>{answer.grade.feedback}</p>
        {answer.grade.result !== 'correct' && <p className="expected">正確答案：{answer.grade.expectedText}</p>}
        {offersWhy(item.question) && showWhy && <p className="explanation-text">{item.question.explanation}</p>}
        <div className="feedback-actions">
          {answer.grade.result !== 'correct' && <button type="button" className="secondary-button" onClick={() => { setRetry({ firstAttemptId: answer.firstAttemptId, count: (retry?.count ?? 0) + 1 }); setAnswer(null); shownAt.current = performance.now() }}>{t.common.retry}</button>}
          {offersWhy(item.question) && <button type="button" className="secondary-button" onClick={() => { setHoldAdvance(true); setShowWhy(!showWhy) }} aria-expanded={showWhy}>{showWhy ? t.common.hideWhy : t.common.why}</button>}
          {item.question.answerAudio && <button type="button" className="secondary-button" onClick={() => { setHoldAdvance(true); void play(item.question.answerAudio!) }}>▶ 聽答案</button>}
          {holdAdvance && <button type="button" className="primary-button" onClick={() => void advance()}>{t.common.next} →</button>}
        </div>
      </div>}
    </article>}
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
