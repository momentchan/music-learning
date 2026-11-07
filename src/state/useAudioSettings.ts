import { create } from 'zustand'
import { audioEngine, DEFAULT_AUDIO, type AudioOptions } from '../audio/AudioEngine'
import { loadAudioSettings, saveAudioSettings } from '../data/db'

interface State {
  options: AudioOptions; loaded: boolean; error: string | null;
  load: () => Promise<void>; update: (patch: Partial<AudioOptions>) => Promise<void>;
}
let revision = 0
let loading: Promise<void> | undefined
let pendingSaves = 0
let saveQueue: Promise<void> = Promise.resolve()
let channel: BroadcastChannel | undefined

/** One authoritative setting for every playback entry point. */
export const useAudioSettings = create<State>((set, get) => ({
  options: DEFAULT_AUDIO, loaded: false, error: null,
  load: () => {
    if (pendingSaves) return Promise.resolve()
    if (loading) return loading
    const startedAt = revision
    loading = (async () => {
      try {
        const options = await loadAudioSettings()
        if (startedAt !== revision) return
        audioEngine.setOptions(options)
        set({ options, loaded: true, error: null })
      } catch {
        if (startedAt === revision) set({ loaded: true, error: '無法讀取聲音設定。' })
      } finally { loading = undefined }
    })()
    return loading
  },
  update: async patch => {
    const current = ++revision
    const options = { ...get().options, ...patch }
    audioEngine.setOptions(options)
    set({ options, loaded: true })
    pendingSaves++
    // Rapid volume/instrument changes must reach storage in the same order.
    const save = saveQueue.catch(() => undefined).then(() => saveAudioSettings(options))
    saveQueue = save
    try {
      await save
      if (current === revision) {
        set({ error: null })
        channel?.postMessage({ type: 'audio-settings', options })
      }
    } catch {
      if (current === revision) set({ error: '聲音設定尚未儲存，請再試一次。' })
    } finally { pendingSaves-- }
  },
}))

/** Keep existing tabs in sync; foreground reload also covers browsers without BroadcastChannel. */
export function syncAudioSettings(): () => void {
  const connection = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel('guitar-lab-audio')
  channel = connection
  if (connection) connection.onmessage = event => {
    const options = event.data?.options as AudioOptions | undefined
    if (event.data?.type !== 'audio-settings' || !options || !['pluck', 'keys'].includes(options.instrument) || pendingSaves) return
    revision++ // An older in-flight load must not undo this newly saved selection.
    audioEngine.setOptions(options)
    useAudioSettings.setState({ options, loaded: true, error: null })
  }
  const refresh = () => { if (!document.hidden) void useAudioSettings.getState().load() }
  window.addEventListener('focus', refresh)
  window.addEventListener('pageshow', refresh)
  document.addEventListener('visibilitychange', refresh)
  return () => {
    window.removeEventListener('focus', refresh)
    window.removeEventListener('pageshow', refresh)
    document.removeEventListener('visibilitychange', refresh)
    if (channel === connection) channel = undefined
    connection?.close()
  }
}
