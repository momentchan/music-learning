import { useEffect } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { t } from '../i18n/zh-TW'
import { GuitarScreen } from '../screens/GuitarScreen'
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
  { id: 'today', path: '/', icon: '◎', label: t.nav.today },
  { id: 'learn', path: '/learn', icon: '◇', label: t.nav.learn },
  { id: 'lab', path: '/lab', icon: '♫', label: t.nav.lab },
  { id: 'guitar', path: '/guitar', icon: '♪', label: t.nav.guitar },
  { id: 'progress', path: '/progress', icon: '▤', label: t.nav.progress },
] as const

const navFor = (route: Route) => route.name === 'node' ? 'learn' : route.name === 'today' || route.name === 'session' ? 'today' : route.name

const TITLES: Partial<Record<Route['name'], string>> = { learn: '學習地圖', lab: '工具', guitar: '吉他', progress: '進度', settings: '設定' }

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
    audioEngine.stop()
    useAudioUi.getState().clearError()
    const state = useLearning.getState()
    if (state.loaded && route.name !== 'session') void state.refresh()
  }, [route.name])

  const inSession = route.name === 'session'
  const fretboardLab = route.name === 'lab' && route.tool === 'fretboard'
  const active = navFor(route)
  const title = TITLES[route.name]

  return <div className={`app-shell${inSession ? ' session-page' : ''}${fretboardLab ? ' fretboard-page' : ''}`}>
    <header className="topbar">
      <button className="brand" onClick={() => navigate('/')} aria-label="Guitar Lab 首頁"><span className="brand-mark">GL</span><div><strong>{t.appName}</strong><small>{t.tagline}</small></div></button>
      <div className="topbar-actions">
        <button className={`sound-pill ${options.silent ? 'muted' : ''}`} onClick={() => void update({ silent: !options.silent })} aria-label={options.silent ? 'Turn sound on' : 'Turn silent mode on'}>{options.silent ? t.common.silent : t.common.soundOn}</button>
        {!inSession && <button className="icon-button" onClick={() => navigate('/settings')} aria-label={t.common.settings}>⚙</button>}
      </div>
    </header>
    <main className="content">
      {title && <div className="page-heading"><h1>{title}</h1></div>}
      {(audioUi.error || settingsError) && <div className="notice" role="alert">{audioUi.error || settingsError}</div>}
      {learning.error && <div className="notice" role="alert">{learning.error}</div>}
      {route.name === 'today' && <TodayScreen/>}
      {route.name === 'learn' && <LearnScreen/>}
      {route.name === 'node' && <NodeScreen nodeId={route.nodeId}/>}
      {route.name === 'session' && <SessionScreen sessionId={route.sessionId}/>}
      {route.name === 'lab' && <LabScreen tool={route.tool}/>}
      {route.name === 'guitar' && <GuitarScreen/>}
      {route.name === 'progress' && <ProgressScreen/>}
      {route.name === 'settings' && <SettingsScreen/>}
      {route.name === 'not-found' && <div className="card"><h2>找不到這個頁面</h2><button className="primary-button" onClick={() => navigate('/')}>回到今日</button></div>}
    </main>
    {!inSession && <nav className="bottom-nav" aria-label="主要導覽">{NAV.map(item => <button key={item.id} className={active === item.id ? 'selected' : ''} onClick={() => navigate(item.path)} aria-current={active === item.id ? 'page' : undefined}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></button>)}</nav>}
  </div>
}
