import { PracticeBoard } from '../components/fretboard/PracticeBoard'
import type { FretMark } from '../components/fretboard/Fretboard'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../app/router'
import { NODES, PATHWAYS, UNLISTED_NODE_IDS, nodeById } from '../curriculum/nodes'
import { repository } from '../database/repository'
import { itemLabel } from '../learning/labels'
import { NODE_STATE_LABEL, pathwayCompletion, weakItems, practiceDaysThisWeek } from '../learning/mastery'
import type { PracticeSession } from '../learning/records'
import { boxLabel, isMissed } from '../learning/scheduler'
import { PC_SHARP, displayNote } from '../music-theory/notes'
import { audioIsOn } from '../stores/audioUi'
import { useLearning } from '../stores/learning'

export function ProgressScreen() {
  const learning = useLearning()
  const [error, setError] = useState('')
  async function strengthen(itemId: string) {
    try {
      await learning.savePreferences({ practiceFocus: itemId.startsWith('chord.tone.') ? 'chord-tones' : itemId.startsWith('interval.') ? 'intervals' : itemId.startsWith('scale.degree.') ? 'scales' : 'notes' })
      navigate(`/session/${await useLearning.getState().startGuided(audioIsOn())}`)
    } catch { setError('無法開始加強練習，請再試一次。') }
  }
  const [sessions, setSessions] = useState<PracticeSession[]>([])
  useEffect(() => { repository.listSessions(12).then(setSessions).catch(() => setSessions([])) }, [learning.attempts.length])
  const weak = useMemo(() => weakItems(learning.reviews.values(), 12), [learning.reviews])
  const nodes = NODES.filter(n => n.availability === 'available' && !UNLISTED_NODE_IDS.has(n.id))

  const positions = new Map<string, FretMark>()
  const ordered = [...learning.attempts].sort((a, b) => a.timestamp - b.timestamp)
  for (const a of ordered) {
    if (a.inputMethod === 'microphone' || a.string == null || a.fret == null) continue
    positions.set(`${a.string}-${a.fret}`, { string: a.string, fret: a.fret, label: a.correct ? '✓' : '×', tone: a.correct ? 'correct' : 'wrong' })
  }
  const week = practiceDaysThisWeek(learning.attempts, Date.now())
  const pitchAttempts = learning.attempts.filter(a => a.inputMethod === 'microphone')
  return <div className="progress">
    {error && <p role="alert">{error}</p>}
    <section className="card week-card"><h3>本週</h3><p>{week.filter(Boolean).length} / {learning.preferences.weeklyGoalDays} 天</p><div className="week-dots" aria-label="本週練習紀錄">{week.map((done, i) => <span key={i} className={done ? 'done' : ''}><i aria-hidden="true">{done ? '●' : '○'}</i>{['一','二','三','四','五','六','日'][i]}</span>)}</div></section>
    <section className="card"><h3>實際練過的指板位置</h3><div className="progress-evidence"><span>位置紀錄 {positions.size} 格</span><span>音高驗證 {pitchAttempts.filter(a => a.correct).length}/{pitchAttempts.length} 次正確</span><span>持琴自評 {learning.selfReports.length} 次</span></div><p className="helper">✓ 最近答對的位置 · × 最近答錯的位置。空白代表沒有位置紀錄；音高驗證與自評不會填滿這張圖。</p><PracticeBoard tuning={[40,45,50,55,59,64]} marks={[...positions.values()]} leftHanded={learning.preferences.leftHanded} label="實際作答位置與最近結果"/></section>
    <section className="card">
      <h3>主題熟練度</h3>
      <details className="mastery-method"><summary>如何計算熟練度</summary><p className="helper">熟悉 = 至少 8 次作答、兩天以上、正確率 ≥ 80%，且一半以上的項目進入 3 天以上複習間隔。流暢 = 再加上應用題 ≥ 75% 與 80% 項目進入 7 天以上間隔。</p></details>
      <ul className="mastery-list">{nodes.map(n => {
        const m = learning.mastery.get(n.id)
        return <li key={n.id}><button className="node-row" onClick={() => navigate(`/learn/${n.id}`)}>
          <span className="node-text"><strong>{n.title}</strong><small>{m && m.samples ? `${m.samples} 次作答 · 近期 ${m.recentCorrect}/${m.recentTotal} · ${m.itemsSeen}/${m.itemsTotal} 項目` : '尚未練習'}</small></span>
          <span className={`badge state-${m?.state ?? 'new'}`}>{NODE_STATE_LABEL[m?.state ?? 'new']}{m?.played ? ` · 🎸${m.played === 'verified' ? '已驗證' : '自評'}` : ''}</span>
        </button></li>
      })}</ul>
    </section>

    <section className="card">
      <h3>指板地圖：每條弦上的每個音</h3>
      <p className="helper">數字是目前的複習間隔（天）；✕ = 上次答錯；空白 = 還沒練過。共 72 個「音 × 弦」組合。</p>
      <div className="heatmap-wrap">
        <table className="heatmap">
          <caption className="sr-only">各弦各音的複習狀態</caption>
          <thead><tr><th scope="col">弦</th>{PC_SHARP.map(n => <th key={n} scope="col">{displayNote(n)}</th>)}</tr></thead>
          <tbody>{[1, 2, 3, 4, 5, 6].map(s => <tr key={s}><th scope="row">{s}</th>{PC_SHARP.map(n => {
            const r = learning.reviews.get(`fret.note.${n}.s${s}`)
            const text = !r ? '' : isMissed(r) ? '✕' : r.box === 0 ? '·' : ['', '1', '3', '7', '14', '30'][r.box]
            return <td key={n} className={!r ? 'unseen' : isMissed(r) ? 'missed' : `box-${r.box}`} aria-label={`第 ${s} 弦 ${displayNote(n)}：${!r ? '未練習' : isMissed(r) ? '上次答錯' : boxLabel(r.box)}`}>{text}</td>
          })}</tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="card">
      <h3>需要加強的項目</h3>
      {weak.length ? <ul className="weak-list">{weak.map(w => <li key={w.itemId}><strong>{itemLabel(w.itemId)}</strong><span>{w.reason}</span><button className="text-button" onClick={() => void strengthen(w.itemId)}>開始加強</button></li>)}</ul>
        : <p className="helper">目前沒有需要加強的項目。</p>}
    </section>

    <section className="card">
      <h3>學習路徑</h3>
      <ul className="pathway-progress">{PATHWAYS.map(p => {
        const c = pathwayCompletion(p.id, learning.mastery)
        return <li key={p.id}><span>{p.title}</span><div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.total} aria-valuenow={c.done} aria-label={p.title}><span style={{ width: `${c.done / c.total * 100}%` }}/></div><small>{c.done}/{c.total}</small></li>
      })}</ul>
    </section>

    <section className="card">
      <h3>最近的練習</h3>
      {sessions.length ? <ul className="history">{sessions.map(s => <li key={s.id}>
        <span>{new Date(s.startedAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>
        <strong>{s.mode === 'lesson' ? `課程：${nodeById(s.settings.nodeId ?? '')?.title ?? ''}` : s.mode === 'guided' ? (s.settings.minutes ? `${s.settings.minutes} 分鐘練習` : '練習') : s.mode === 'free' ? '自由練習' : s.mode === 'lab' ? '工具頁練習' : '舊版紀錄'}</strong>
        <small>{s.summary ? `${s.summary.correct}/${s.summary.graded} 正確` : s.status === 'active' ? '進行中' : s.status === 'abandoned' ? '未完成' : ''}</small>
      </li>)}</ul> : <p className="helper">完成的練習會出現在這裡。</p>}
    </section>
  </div>
}
