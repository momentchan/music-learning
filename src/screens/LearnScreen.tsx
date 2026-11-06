import { useState } from 'react'
import { navigate } from '../app/router'
import { NODES, PATHWAYS, UNLISTED_NODE_IDS, nodeById, type SkillNode } from '../curriculum/nodes'
import { templatesForNode } from '../exercise-engine/registry'
import { t } from '../i18n/zh-TW'
import { NODE_STATE_LABEL, pathwayCompletion, type NodeMastery } from '../learning/mastery'
import { audioIsOn } from '../stores/audioUi'
import { useLearning } from '../stores/learning'
import { LessonContentView } from './session/LessonCard'

function StateBadge({ node, mastery }: { node: SkillNode; mastery?: NodeMastery }) {
  if (node.availability !== 'available') return <span className="badge planned">{t.availability[node.availability]}{node.plannedPhase ? ` · Phase ${node.plannedPhase}` : ''}</span>
  const state = mastery?.state ?? 'new'
  return <span className={`badge state-${state}`}>{NODE_STATE_LABEL[state]}{mastery?.played ? ' · 🎸' : ''}</span>
}

function NodeRow({ node, index }: { node: SkillNode; index?: number }) {
  const mastery = useLearning(s => s.mastery.get(node.id))
  return <li>
    <button className={`node-row ${node.availability}`} onClick={() => navigate(`/learn/${node.id}`)}>
      {index !== undefined && <span className="step">{index + 1}</span>}
      <span className="node-text"><strong>{node.title}</strong><small>{node.summary}</small></span>
      <StateBadge node={node} mastery={mastery}/>
    </button>
  </li>
}

export function LearnScreen() {
  const [pathwayId, setPathwayId] = useState('start')
  const mastery = useLearning(s => s.mastery)
  const pathway = PATHWAYS.find(p => p.id === pathwayId)!
  const completion = pathwayCompletion(pathwayId, mastery)
  return <div className="learn">
    <section className="card">
      <p className="eyebrow">學習路徑 PATHWAYS</p>
      <div className="pathway-chips" role="tablist" aria-label="學習路徑">
        {PATHWAYS.map(p => <button key={p.id} role="tab" aria-selected={p.id === pathwayId} className={p.id === pathwayId ? 'active' : ''} onClick={() => setPathwayId(p.id)}>{p.short}</button>)}
      </div>
      <h2>{pathway.title}</h2>
      <p className="helper">{pathway.description} 已熟悉 {completion.done}/{completion.total} 步（目前開放 {completion.available} 步）。路徑只是建議順序，任何主題都能直接點進去。</p>
      <ol className="node-list">{pathway.steps.map((id, i) => { const node = nodeById(id); return node ? <NodeRow key={id} node={node} index={i}/> : null })}</ol>
    </section>
    {([1, 2, 3] as const).map(tier => <section className="card" key={tier}>
      <h3>{tier === 1 ? '第 1 層 · 基礎 Foundations' : tier === 2 ? '第 2 層 · 連結 Connecting' : '第 3 層 · 創作 Creating'}</h3>
      <ul className="node-list">{NODES.filter(n => n.tier === tier && !UNLISTED_NODE_IDS.has(n.id)).map(n => <NodeRow key={n.id} node={n}/>)}</ul>
    </section>)}
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
    try {
      const id = kind === 'lesson' ? await learning.startLesson(node!.id, audio) : await learning.startFree([node!.id], 10, audio)
      navigate(`/session/${id}`)
    } catch { setError('無法建立練習（本機儲存空間可能被封鎖）。') }
  }

  return <div className="node-detail">
    <button className="text-button" onClick={() => navigate('/learn')}>← 學習地圖</button>
    <section className="card">
      <div className="section-head"><div><p className="eyebrow">第 {node.tier} 層 · 約 {node.estimatedMinutes} 分鐘</p><h2>{node.title}</h2><p>{node.summary}</p></div><StateBadge node={node} mastery={mastery}/></div>
      {node.availability !== 'available'
        ? <p className="notice">這個主題還在規劃中（Phase {node.plannedPhase}），目前沒有練習題。我們不會用假的按鈕假裝它能用。</p>
        : <>
          {mastery && mastery.samples > 0 && <p className="evidence">共 {mastery.samples} 次作答，近期 {mastery.recentCorrect}/{mastery.recentTotal} 正確（辨認題算半題），練習過 {mastery.days} 天；{mastery.itemsSeen}/{mastery.itemsTotal} 個項目練過，{mastery.itemsBox2} 個已進入 3 天以上的複習間隔。{mastery.dueItems ? `${mastery.dueItems} 個到期。` : ''}</p>}
          {node.canDo.length > 0 && <div className="can-do"><h3>學完你能夠</h3><ul>{node.canDo.map(c => <li key={c}>{c}</li>)}</ul></div>}
          {prereqs.length > 0 && <p className="helper">建議先學：{prereqs.map((p, i) => <span key={p.id}>{i > 0 && '、'}<button className="inline-link" onClick={() => navigate(`/learn/${p.id}`)}>{p.title}</button></span>)}（不強制）</p>}
          <div className="button-row">
            <button className="primary-button" disabled={silentOnly} onClick={() => void begin('lesson')}>▶ 開始課程</button>
            <button className="secondary-button" disabled={silentOnly} onClick={() => void begin('free')}>自由練習 10 題</button>
          </div>
          {silentOnly && <p className="helper">這個主題需要聲音，請先開啟聲音。</p>}
          {error && <p className="notice" role="alert">{error}</p>}
        </>}
    </section>
    {node.content && <section className="card"><LessonContentView node={node} layout={learning.preferences.practiceLayout}/></section>}
    {node.bridge && <section className="card"><h3>拿起吉他</h3><p>{node.bridge.text}</p></section>}
  </div>
}
