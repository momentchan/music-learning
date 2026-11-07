import { InstrumentTools } from '../../components/InstrumentTools'
import { useLearning } from '../../stores/learning'
import { useState } from 'react'
import { navigate } from '../../app/router'
import { ChordDiagram } from '../../components/diagram/ChordDiagram'
import { CHORD_SHAPES } from '../../music-theory/guitar'
import { useAudioUi } from '../../stores/audioUi'
import { Compare, Explore, Fretboard, Progressions } from './LabTools'

const TOOLS = [
  { id: 'fretboard', label: '指板' }, { id: 'chords', label: '和弦圖' }, { id: 'explore', label: '聲音' },
  { id: 'progressions', label: '和弦進行' }, { id: 'compare', label: '比較試聽' },
] as const

export function LabScreen({ tool }: { tool: string }) {
  const { run, stop, playing, setPlaying } = useAudioUi()
  const [tuningOpen, setTuningOpen] = useState(false)
  const active = TOOLS.find(t => t.id === tool)?.id ?? 'fretboard'
  return <div className="lab">
    <details className="practice-tools-drawer" onToggle={e => setTuningOpen(e.currentTarget.open)}><summary>調音</summary>{tuningOpen && <InstrumentTools purpose="reference"/>}</details>
    <div className="lab-tabs" role="tablist" aria-label="工具">
      {TOOLS.map(t => <button key={t.id} role="tab" aria-selected={active === t.id} className={active === t.id ? 'active' : ''} onClick={() => { stop(); navigate(`/lab/${t.id}`) }}>{t.label}</button>)}
    </div>
    {active === 'fretboard' && <Fretboard run={run}/>}
    {active === 'chords' && <ChordLibrary/>}
    {active === 'explore' && <Explore run={run} stop={stop}/>}
    {active === 'progressions' && <Progressions run={run} stop={stop} playing={playing} setPlaying={setPlaying}/>}
    {active === 'compare' && <Compare run={run} stop={stop}/>}
  </div>
}

function ChordLibrary() {
  const leftHanded = useLearning(s => s.preferences.leftHanded)
  const [family, setFamily] = useState<'open' | 'open7' | 'other'>('open')
  const shapes = CHORD_SHAPES.filter(s => family === 'open' ? s.family === 'open' : family === 'open7' ? s.family === 'open7' : !['open', 'open7'].includes(s.family))
  return <section className="card">
    <h3>和弦指型庫</h3>
    <p className="helper">數字 1–4 代表食指到小指；× 不彈，○ 空弦。</p>
    <div className="pathway-chips" role="group" aria-label="和弦類別">
      {([['open', '開放三和弦'], ['open7', '屬七和弦'], ['other', '七和弦與封閉']] as const).map(([id, label]) => <button key={id} aria-pressed={family === id} className={family === id ? 'active' : ''} onClick={() => setFamily(id)}>{label}</button>)}
    </div>
    <div className="shape-grid">{shapes.map(s => <ChordDiagram leftHanded={leftHanded} key={s.id} shape={s} size={130}/>)}</div>
  </section>
}
