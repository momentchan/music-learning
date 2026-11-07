import { useState } from 'react'
import { navigate } from '../app/router'
import { NODES, PATHWAYS, UNLISTED_NODE_IDS, nodeById, type SkillNode } from '../curriculum/nodes'
import { templatesForNode } from '../exercise-engine/registry'
import { t } from '../i18n/zh-TW'
import { NODE_STATE_LABEL, type NodeMastery } from '../learning/mastery'
import { resumeListening } from '../audio/mic'
import { audioIsOn } from '../stores/audioUi'
import { useLearning } from '../stores/learning'
import { LessonContentView } from './session/LessonCard'

function StateBadge({ node, mastery }: { node: SkillNode; mastery?: NodeMastery }) {
  if (node.availability !== 'available') return <span className="badge planned">{t.availability[node.availability]}</span>
  const state = mastery?.state ?? 'new'
  return <span className={`badge state-${state}`}>{NODE_STATE_LABEL[state]}{mastery?.played ? ' · 彈過' : ''}</span>
}

function NodeRow({ node, index }: { node: SkillNode; index?: number }) {
  const mastery = useLearning(s => s.mastery.get(node.id))
  return <li>
    <button className={`node-row ${node.availability}`} onClick={() => navigate(`/learn/${node.id}`)}>
      {index !== undefined && <span className="step">{index + 1}</span>}
      <span className="node-text"><strong>{node.title.replace(/\s+[A-Za-z].*$/, '')}</strong><small>{node.summary}</small></span>
      <StateBadge node={node} mastery={mastery}/>
    </button>
  </li>
}

export function LearnScreen() {
  const [pathwayId, setPathwayId] = useState('start')
  const mastery = useLearning(s => s.mastery)
  const pathway = PATHWAYS.find(p => p.id === pathwayId)!
  return <div className="learn">
    <section className="card">
      <div className="pathway-chips" role="tablist" aria-label="學習路徑">
        {PATHWAYS.map(p => <button key={p.id} role="tab" aria-selected={p.id === pathwayId} className={p.id === pathwayId ? 'active' : ''} onClick={() => setPathwayId(p.id)}>{p.short}</button>)}
      </div>
      <h2>{pathway.title}</h2>
      <p className="helper">{pathway.description}</p>
      <ol className="node-list">{pathway.steps.map(nodeById).filter((node): node is SkillNode => node?.availability === 'available').map((node, i) => <NodeRow key={node.id} node={node} index={i}/>)}</ol>
    </section>
    <details className="course-catalog"><summary>全部課程</summary>
    {([1, 2, 3] as const).map(tier => <section className="card" key={tier}>
      <h3>{tier === 1 ? '基礎' : tier === 2 ? '連結' : '創作'}</h3>
      <ul className="node-list">{NODES.filter(n => n.tier === tier && !UNLISTED_NODE_IDS.has(n.id)).map(n => <NodeRow key={n.id} node={n}/>)}</ul>
    </section>)}
    </details>
  </div>
}

export function NodeScreen({ nodeId }: { nodeId: string }) {
  const learning = useLearning()
  const node = nodeById(nodeId)
  const [error, setError] = useState('')
  if (!node) return <div className="card"><h2>找不到這個主題</h2><button className="primary-button" onClick={() => navigate('/learn')}>回到學習</button></div>
  const mastery = learning.mastery.get(node.id)
  const templates = templatesForNode(node.id)
  const prereqs = node.prerequisites.map(nodeById).filter((n): n is SkillNode => !!n)
  const audio = audioIsOn()
  const silentOnly = templates.every(tpl => tpl.requiresAudio) && !audio

  async function begin(kind: 'lesson' | 'free') {
    if (learning.preferences.answerInput === 'play') resumeListening()
    try {
      const id = kind === 'lesson' ? await learning.startLesson(node!.id, audio) : await learning.startFree([node!.id], 10, audio)
      navigate(`/session/${id}`)
    } catch { setError('無法建立練習（本機儲存空間可能被封鎖）。') }
  }

  return <div className="node-detail">
    <button className="text-button" onClick={() => navigate('/learn')}>← 課程</button>
    <section className="card">
      <div className="section-head"><div><p className="eyebrow">約 {node.estimatedMinutes} 分鐘</p><h2>{node.title.replace(/\s+[A-Za-z].*$/, '')}</h2><p>{node.summary}</p></div><StateBadge node={node} mastery={mastery}/></div>
      {node.availability !== 'available'
        ? <p className="notice">這個主題尚未開放。</p>
        : <>

          {node.canDo.length > 0 && <div className="can-do"><h3>學完你能夠</h3><ul>{node.canDo.map(c => <li key={c}>{c}</li>)}</ul></div>}
          {prereqs.length > 0 && <p className="helper">建議先學：{prereqs.map((p, i) => <span key={p.id}>{i > 0 && '、'}<button className="inline-link" onClick={() => navigate(`/learn/${p.id}`)}>{p.title}</button></span>)}</p>}
          <div className="button-row">
            <button className="primary-button" disabled={silentOnly} onClick={() => void begin('lesson')}>▶ 開始課程</button>
            <button className="secondary-button" disabled={silentOnly} onClick={() => void begin('free')}>只做練習</button>
          </div>
          {silentOnly && <p className="helper">這個主題需要聲音，請先開啟聲音。</p>}
          {error && <p className="notice" role="alert">{error}</p>}
        </>}
    </section>
    {node.content && <details className="course-preview"><summary>課程預覽</summary><LessonContentView node={node}/></details>}
    {node.bridge && <section className="card"><h3>拿起吉他</h3><p>{node.bridge.text}</p></section>}
  </div>
}
