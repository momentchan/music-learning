import { navigate } from '../app/router'
import { PracticeContextSetting } from '../components/PracticeContextSetting'
import { AnswerInputSetting } from '../components/AnswerInputSetting'
import { DeviceTransfer } from '../components/DeviceTransfer'
import { InstrumentTools } from '../components/InstrumentTools'
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
  async function start() {
    setStarting(true)
    try { await learning.savePreferences({ practiceContext: 'instrument' }); navigate(`/session/${await useLearning.getState().startGuided(audioIsOn())}`) }
    catch { setError('無法開始練習，請檢查本機儲存後再試。') } finally { setStarting(false) }
  }
  async function practiceNode(nodeId: string) {
    if (starting) return
    setStarting(true)
    try {
      await learning.savePreferences({ practiceContext: 'instrument' })
      navigate(`/session/${await useLearning.getState().startFree([nodeId], 10, audioIsOn())}`)
    } catch { setError('無法開始這個主題，請再試一次。') } finally { setStarting(false) }
  }
  async function complete(id: string, nodeId: string, taskId: string, rating: 0 | 1 | 2) {
    try {
      await repository.completeBridge(id, { id: crypto.randomUUID(), bridgeTaskId: taskId, nodeId, rating, verified: false, timestamp: Date.now() })
      await learning.refresh()
    } catch { setError('無法儲存，請稍後再試。') }
  }
  return <div className="guitar">
    <section className="card guitar-start"><p className="eyebrow">拿起吉他</p><h2>把指板上的音，變成手上的聲音</h2><p>選主題，照圖彈奏。App 可檢查單音音高；使用的弦與品格請照圖確認。</p><PracticeContextSetting instrumentOnly/><AnswerInputSetting forInstrument/><button className="primary-button wide big" disabled={starting} onClick={() => void start()}>開始持琴練習</button></section>
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
            <button className="secondary-button" disabled={starting || node?.availability !== 'available'} onClick={() => void practiceNode(b.nodeId)}>練這個主題</button>
            <div className="choice-grid three">
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 0)}>還不太行</button>
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 1)}>勉強可以</button>
              <button onClick={() => void complete(b.id, b.nodeId, b.taskId, 2)}>很順</button>
            </div>
          </li>
        })}</ul>}
    </section>
    <InstrumentTools/>
    <DeviceTransfer/>
  </div>
}
