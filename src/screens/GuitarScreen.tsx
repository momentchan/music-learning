import { navigate } from '../app/router'
import { audioIsOn } from '../stores/audioUi'
import { useState } from 'react'
import { nodeById } from '../curriculum/nodes'
import { repository } from '../database/repository'
import { useLearning } from '../stores/learning'

/** Instrument practice entry, honest bridge reports, pitch reference and timing tools. */
export function GuitarScreen() {
  const learning = useLearning()
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  async function practiceNode(nodeId: string) {
    if (starting) return
    setStarting(true)
    try {
      await learning.savePreferences({ practiceContext: 'instrument', answerInput: 'play' })
      navigate(`/session/${await useLearning.getState().startFree([nodeId], 10, audioIsOn())}`)
    } catch { setError('無法開始這個主題，請再試一次。') } finally { setStarting(false) }
  }
  async function complete(id: string, nodeId: string, taskId: string, rating: 0 | 1 | 2) {
    try {
      await repository.completeBridge(id, { id: crypto.randomUUID(), bridgeTaskId: taskId, nodeId, rating, verified: false, timestamp: Date.now() })
      await learning.refresh()
    } catch { setError('無法儲存，請稍後再試。') }
  }
  if (!learning.bridgeQueue.length) return null
  return <div className="guitar">
    <section className="card">
      <h2>待彈的任務 {learning.bridgeQueue.length ? `（${learning.bridgeQueue.length}）` : ''}</h2>
      {error && <p className="notice" role="alert">{error}</p>}
      {learning.bridgeQueue.length === 0 ? <p className="helper">還沒有待彈任務。</p>
        : <ul className="bridge-list">{learning.bridgeQueue.map(b => {
          const node = nodeById(b.nodeId)
          return <li key={b.id} className="bridge-item">
            <strong>{node?.title}</strong>
            <p>{node?.bridge?.text}</p>
            <button className="secondary-button" disabled={starting || node?.availability !== 'available'} onClick={() => void practiceNode(b.nodeId)}>練這個主題</button>
            <div className="choice-grid three">
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 0)}>還不太行</button>
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 1)}>勉強可以</button>
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 2)}>很順</button>
            </div>
          </li>
        })}</ul>}
    </section>
  </div>
}
