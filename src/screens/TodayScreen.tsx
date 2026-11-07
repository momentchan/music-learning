import { useMemo, useState } from 'react'
import { navigate } from '../app/router'
import { NODES, nodeById } from '../curriculum/nodes'
import { itemLabel } from '../learning/labels'
import { practiceDaysThisWeek, recommendations, weakItems } from '../learning/mastery'
import { rankDueItems } from '../learning/scheduler'
import { PracticeContextSetting } from '../components/PracticeContextSetting'
import { AnswerInputSetting } from '../components/AnswerInputSetting'
import { resumeListening } from '../audio/mic'
import { audioIsOn } from '../stores/audioUi'
import { useLearning } from '../stores/learning'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function TodayScreen() {
  const learning = useLearning()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const now = Date.now()
  const due = useMemo(() => rankDueItems(learning.reviews.values(), now), [learning.reviews, now])
  const recs = useMemo(() => recommendations(learning.attempts, learning.reviews, learning.mastery, now), [learning.attempts, learning.reviews, learning.mastery, now])
  const weak = useMemo(() => weakItems(learning.reviews.values(), 3), [learning.reviews])
  const week = practiceDaysThisWeek(learning.attempts, now)
  const practisedDays = week.filter(Boolean).length
  const familiar = [...learning.mastery.values()].filter(m => m.state === 'familiar' || m.state === 'fluent').length
  const available = NODES.filter(n => n.availability === 'available').length
  const active = learning.activeSession
  const activeRemaining = active ? active.plannedItems.slice(active.cursor).filter(i => i.kind === 'question').length : 0

  async function start() {
    if (learning.preferences.answerInput === 'play') resumeListening()
    setStarting(true)
    try { navigate(`/session/${await learning.startGuided(audioIsOn())}`) }
    catch { setError('無法建立練習（本機儲存空間可能被封鎖）。') }
    finally { setStarting(false) }
  }

  return <div className="today">
    <PracticeContextSetting/>
    {active && (activeRemaining > 0 || active.mode === 'guided') && <section className="card continue-card">
      <div><p className="eyebrow">繼續 CONTINUE</p><h2>{active.mode === 'guided' ? '接著上次的練習' : `上次的練習還剩 ${activeRemaining} 題`}</h2><p className="helper">{active.mode === 'lesson' ? nodeById(active.settings.nodeId ?? '')?.title : '離開不會丟掉進度。'}</p></div>
      <button className="primary-button" onClick={() => { if (learning.preferences.answerInput === 'play') resumeListening(); navigate(`/session/${active.id}`) }}>繼續 →</button>
    </section>}

    <section className="card start-card">
      <p className="eyebrow">今日練習 TODAY</p>
      <h2>{due.length ? `${due.length} 個項目到期複習` : learning.attempts.length ? '今天沒有到期的項目，學點新的吧' : '從六條弦的音名開始：第 6、5 弦以外也能說出來'}</h2>
      <AnswerInputSetting/>
      <button className={`${active ? 'secondary-button' : 'primary-button'} wide big`} disabled={starting || !learning.loaded} onClick={() => void start()}>{active ? '改練目前選的主題' : '▶ 開始練習'}</button>
      <p className="helper">{learning.preferences.answerInput === 'play' ? '用吉他彈出題目要的音，麥克風會聽。做到不想練再離開，進度會留著。' : '在指板上點一下就送出。做到不想練再離開，進度會留著。持琴任務在「持琴練習」頁，回家再彈。'}</p>
      {error && <p className="notice" role="alert">{error}</p>}
    </section>

    {recs.length > 0 && <section className="card">
      <h3>建議 <small className="muted">（只是建議，任何主題都能自由選）</small></h3>
      <ul className="rec-list">{recs.map((r, i) => <li key={i}>
        <button className="rec" onClick={() => r.nodeId ? navigate(`/learn/${r.nodeId}`) : void start()}>
          <strong>{r.title}</strong><span>{r.reason}</span>
        </button>
      </li>)}</ul>
    </section>}

    <section className="card week-card">
      <div className="section-head"><div><h3>本週</h3><p>目標：每週 {learning.preferences.weeklyGoalDays} 天 · 已練 {practisedDays} 天</p></div></div>
      <div className="week-dots" aria-label={`本週練習了 ${practisedDays} 天`}>
        {week.map((done, i) => <span key={i} className={done ? 'done' : ''}><i aria-hidden="true">{done ? '●' : '○'}</i>{WEEKDAYS[i]}</span>)}
      </div>
      <p className="helper">漏掉幾天沒關係，進度不會歸零。回來時會先複習最需要的項目。</p>
    </section>

    <section className="card overview-card">
      <div className="stat"><strong>{familiar}/{available}</strong><span>主題已熟悉</span></div>
      <div className="stat"><strong>{learning.reviews.size}</strong><span>練過的項目</span></div>
      <button className="stat link" onClick={() => navigate('/guitar')}><strong>{learning.bridgeQueue.length}</strong><span>待彈的吉他任務</span></button>
    </section>

    {weak.length > 0 && <section className="card">
      <h3>需要加強</h3>
      <ul className="weak-list">{weak.map(w => <li key={w.itemId}><strong>{itemLabel(w.itemId)}</strong><span>{w.reason}</span></li>)}</ul>
      <button className="text-button" onClick={() => navigate('/progress')}>看完整進度 →</button>
    </section>}
  </div>
}
