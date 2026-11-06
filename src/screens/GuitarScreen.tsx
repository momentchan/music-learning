import { useState } from 'react'
import { nodeById } from '../curriculum/nodes'
import { repository } from '../database/repository'
import { useLearning } from '../stores/learning'

/** At-the-guitar tab. Phase A: bridge-task queue with honest self-assessment. Microphone features arrive in Phase B. */
export function GuitarScreen() {
  const learning = useLearning()
  const [error, setError] = useState('')
  async function complete(id: string, nodeId: string, taskId: string, rating: 0 | 1 | 2) {
    try {
      await repository.completeBridge(id, { id: crypto.randomUUID(), bridgeTaskId: taskId, nodeId, rating, verified: false, timestamp: Date.now() })
      await learning.refresh()
    } catch { setError('無法儲存，請稍後再試。') }
  }
  return <div className="guitar">
    <section className="card">
      <p className="eyebrow">拿起吉他 AT THE GUITAR</p>
      <h2>待彈的任務 {learning.bridgeQueue.length ? `（${learning.bridgeQueue.length}）` : ''}</h2>
      <p className="helper">通勤時學的東西，回家拿起吉他彈一次才會真正變成你的。每個任務 1–3 分鐘。自我評估只會標記「彈過」，不會提高記憶熟練度。</p>
      {error && <p className="notice" role="alert">{error}</p>}
      {learning.bridgeQueue.length === 0 ? <p className="helper">目前沒有待彈的任務。完成課程時選「稍後在吉他頁做」，任務就會出現在這裡。</p>
        : <ul className="bridge-list">{learning.bridgeQueue.map(b => {
          const node = nodeById(b.nodeId)
          return <li key={b.id} className="bridge-item">
            <strong>{node?.title}</strong>
            <p>{node?.bridge?.text}</p>
            <div className="choice-grid three">
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 0)}>還不太行</button>
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 1)}>勉強可以</button>
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 2)}>很順</button>
            </div>
          </li>
        })}</ul>}
    </section>
    <section className="card planned-card">
      <h3>即將推出（Phase B，尚未提供）</h3>
      <ul>
        <li><strong>調音器</strong>：用麥克風顯示音名與音分偏差。</li>
        <li><strong>彈音檢查</strong>：彈出指定的音，App 聽音高判斷（只能確認音高，無法判斷你用哪條弦）。</li>
        <li><strong>換和弦計時</strong>：一分鐘內兩個和弦來回換幾次。</li>
        <li><strong>跟節拍器刷弦</strong>：搭配刷法節奏練習。</li>
      </ul>
      <p className="helper">麥克風只在你按下按鈕後才會要求權限，聲音不會被錄下或上傳。</p>
    </section>
  </div>
}
