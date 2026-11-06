import { useMemo, useState } from 'react'
import { navigate } from '../app/router'
import { NODES, nodeById } from '../curriculum/nodes'
import { itemLabel } from '../learning/labels'
import { practiceDaysThisWeek, recommendations, weakItems } from '../learning/mastery'
import { rankDueItems } from '../learning/scheduler'
import { audioIsOn } from '../stores/audioUi'
import { useLearning } from '../stores/learning'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function TodayScreen() {
  const learning = useLearning()
  const [minutes, setMinutes] = useState<number>(learning.preferences.sessionMinutes)
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
    setStarting(true)
    try { navigate(`/session/${await learning.startGuided(minutes, audioIsOn())}`) }
    catch { setError('無法建立練習（本機儲存空間可能被封鎖）。') }
    finally { setStarting(false) }
  }

  return <div className="today">
    {active && activeRemaining > 0 && <section className="card continue-card">
      <div><p className="eyebrow">繼續 CONTINUE</p><h2>上次的練習還剩 {activeRemaining} 題</h2><p className="helper">{active.mode === 'lesson' ? nodeById(active.settings.nodeId ?? '')?.title : `${active.settings.minutes ?? ''} 分鐘練習`}</p></div>
      <button className="primary-button" onClick={() => navigate(`/session/${active.id}`)}>繼續 →</button>
    </section>}

    <section className="card start-card">
      <p className="eyebrow">今日練習 TODAY</p>
      <h2>{due.length ? `${due.length} 個項目到期複習` : learning.attempts.length ? '今天沒有到期的項目，學點新的吧' : '從八度開始：把第 6、5 弦的音搬到其他弦'}</h2>
      <div className="minute-chips" role="radiogroup" aria-label="練習長度">
        {[3, 5, 10].map(m => <button key={m} role="radio" aria-checked={minutes === m} className={minutes === m ? 'active' : ''} onClick={() => setMinutes(m)}>{m} 分鐘</button>)}
      </div>
      <button className="primary-button wide big" disabled={starting} onClick={() => void start()}>▶ 開始 {minutes} 分鐘練習</button>
      <p className="helper">手機上就能做完：先在指板上點音，再拼幾題級數。開著聲音會加聽力。吉他的部分先排到稍後，回家再彈。隨時可以離開。</p>
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
