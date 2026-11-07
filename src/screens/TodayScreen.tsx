import { InstrumentTools } from '../components/InstrumentTools'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../app/router'
import { nodeById } from '../curriculum/nodes'
import { rankDueItems } from '../learning/scheduler'
import { PracticeContextSetting } from '../components/PracticeContextSetting'
import { resumeListening } from '../audio/mic'
import { audioIsOn } from '../stores/audioUi'
import { useLearning } from '../stores/learning'
import { GuitarScreen } from './GuitarScreen'

/** The only practice entry: choose an answer method and a skill, then start or resume. */
export function TodayScreen({ forceInstrument = false }: { forceInstrument?: boolean }) {
  const learning = useLearning()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [rhythmOpen, setRhythmOpen] = useState(false)
  const now = Date.now()
  const due = useMemo(() => rankDueItems(learning.reviews.values(), now), [learning.reviews, now])
  const instrument = learning.preferences.practiceContext === 'instrument'
  const active = learning.activeSession
  useEffect(() => { if (forceInstrument && learning.loaded) void useLearning.getState().savePreferences({ practiceContext: 'instrument', answerInput: 'play' }) }, [forceInstrument, learning.loaded])
  async function start() {
    setStarting(true); setError('')
    try {
      await learning.savePreferences({ answerInput: instrument ? 'play' : 'tap', practiceFocus: learning.preferences.practiceFocus === 'positions' ? 'notes' : learning.preferences.practiceFocus })
      if (instrument) resumeListening()
      navigate(`/session/${await useLearning.getState().startGuided(audioIsOn())}`)
    } catch { setError('無法開始練習，請檢查本機儲存後再試。') }
    finally { setStarting(false) }
  }
  return <div className="today practice-hub">
    <section className="card start-card">
      <PracticeContextSetting/>
      <button className="primary-button wide big" disabled={starting || !learning.loaded} onClick={() => void start()}>{active ? '開始新一輪' : '▶ 開始練習'}</button>
      {due.length > 0 && <p className="helper">{due.length} 個項目待複習</p>}
      {instrument && learning.preferences.practiceFocus === 'naming' && <p className="helper">音名題使用按鈕回答。</p>}
      {error && <p className="notice" role="alert">{error}</p>}
    </section>
    {active && <section className="card continue-card">
      <div><h2>接著上次練習</h2><p className="helper">{active.settings.practiceContext === 'instrument' ? '彈吉他' : '通勤練習'}{active.settings.nodeId ? ` · ${nodeById(active.settings.nodeId)?.title.replace(/\s+[A-Za-z].*$/, '') ?? ''}` : ''}</p></div>
      <button className="secondary-button" onClick={() => navigate(`/session/${active.id}`)}>繼續 →</button>
    </section>}
    <div className="practice-other" aria-label="其他練習"><button className="secondary-button" onClick={() => navigate('/practice/ear')}>聽力練習</button><button className="secondary-button" onClick={() => navigate('/practice/positions')}>找出同音的所有位置</button></div>
    {instrument && <><GuitarScreen/><details className="practice-tools-drawer" onToggle={e => setRhythmOpen(e.currentTarget.open)}><summary>節拍與換和弦</summary>{rhythmOpen && <InstrumentTools purpose="rhythm"/>}</details></>}
  </div>
}
