import { useEffect } from 'react'
import { OfflineStatus } from '../components/OfflineStatus'
import { t } from '../i18n/zh-TW'
import { EarTraining, Fretboard as AllPositions } from '../screens/lab/LabTools'
import { LabScreen } from '../screens/lab/LabScreen'
import { LearnScreen, NodeScreen } from '../screens/LearnScreen'
import { ProgressScreen } from '../screens/ProgressScreen'
import { SessionScreen } from '../screens/session/SessionScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { TodayScreen } from '../screens/TodayScreen'
import { useAudioSettings } from '../state/useAudioSettings'
import { useAudioUi } from '../stores/audioUi'
import { useLearning } from '../stores/learning'
import { navigate, useRoute, type Route } from './router'

const NAV = [
  { id: 'today', path: '/', label: t.nav.today },
  { id: 'learn', path: '/learn', label: t.nav.learn },
  { id: 'lab', path: '/lab', label: t.nav.lab },
  { id: 'progress', path: '/progress', label: t.nav.progress },
] as const

const navFor = (route: Route) => route.name === 'node' ? 'learn' : ['today', 'session', 'guitar', 'ear-practice', 'positions-practice'].includes(route.name) ? 'today' : route.name

const TITLES: Partial<Record<Route['name'], string>> = { today: '練習', learn: '課程', lab: '工具', guitar: '練習', progress: '進度', 'ear-practice': '聽力練習', 'positions-practice': '找出同音的所有位置', settings: '設定' }

export default function App() {
  const route = useRoute()
  const { options, load: loadAudio, update, error: settingsError } = useAudioSettings()
  const audioUi = useAudioUi()
  const learning = useLearning()

  useEffect(() => { void loadAudio(); void useLearning.getState().load() }, [loadAudio])
  useEffect(() => {
    const stop = () => useAudioUi.getState().stop()
    const visibility = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', stop)
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', stop); stop() }
  }, [])
  // Stop sound and refresh derived data whenever the screen changes.
  useEffect(() => {
    useAudioUi.getState().stop()
    useAudioUi.getState().clearError()
    const state = useLearning.getState()
    if (state.loaded && route.name !== 'session') void state.refresh()
  }, [route.name])

  const soundMuted = options.silent || !options.enabled
  const inSession = route.name === 'session'
  const fretboardLab = (route.name === 'lab' && route.tool === 'fretboard') || route.name === 'positions-practice'
  const active = navFor(route)
  const title = TITLES[route.name]

  return <div className={`app-shell${inSession ? ' session-page' : ''}${fretboardLab ? ' fretboard-page' : ''}`}>
    <header className="topbar">
      <button className="brand" onClick={() => navigate('/')} aria-label="Guitar Lab 首頁"><span className="brand-mark">GL</span><div><strong>{t.appName}</strong></div></button>
      <div className="topbar-actions">
        <button title="題目與示範音，不影響麥克風收音" className={`sound-pill ${soundMuted ? 'muted' : ''}`} onClick={() => void update({ enabled: true, silent: !soundMuted })} aria-label={soundMuted ? 'Turn sound on' : 'Turn silent mode on'}>{soundMuted ? t.common.silent : t.common.soundOn}</button>
        {!inSession && <button className="icon-button" onClick={() => navigate('/settings')} aria-label={t.common.settings}>⚙</button>}
      </div>
    </header>
    <main className="content">
      <OfflineStatus inSession={inSession}/>
      {title && <div className="page-heading"><h1>{title}</h1></div>}
      {(audioUi.error || settingsError) && <div className="notice" role="alert">{audioUi.error || settingsError}</div>}
      {learning.error && <div className="notice" role="alert">{learning.error}</div>}
      {route.name === 'today' && <TodayScreen/>}
      {route.name === 'learn' && <LearnScreen/>}
      {route.name === 'node' && <NodeScreen nodeId={route.nodeId}/>}
      {route.name === 'session' && <SessionScreen sessionId={route.sessionId}/>}
      {route.name === 'lab' && <LabScreen tool={route.tool}/>}
      {route.name === 'guitar' && <TodayScreen forceInstrument/>}
      {route.name === 'ear-practice' && <><button className="text-button" onClick={() => navigate('/')}>← 回到練習</button><EarTraining run={audioUi.run} stop={audioUi.stop}/></>}
      {route.name === 'positions-practice' && <><button className="text-button" onClick={() => navigate('/')}>← 回到練習</button><AllPositions run={audioUi.run} purpose="all-positions"/></>}
      {route.name === 'progress' && <ProgressScreen/>}
      {route.name === 'settings' && <SettingsScreen/>}
      {route.name === 'not-found' && <div className="card"><h2>找不到這個頁面</h2><button className="primary-button" onClick={() => navigate('/')}>回到今日</button></div>}
    </main>
    {!inSession && <nav className="bottom-nav" aria-label="主要導覽">{NAV.map(item => <button key={item.id} className={active === item.id ? 'selected' : ''} onClick={() => navigate(item.path)} aria-current={active === item.id ? 'page' : undefined}><small>{item.label}</small></button>)}</nav>}
  </div>
}
