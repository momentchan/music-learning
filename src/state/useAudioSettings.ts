import { create } from 'zustand'
import { audioEngine, DEFAULT_AUDIO, type AudioOptions } from '../audio/AudioEngine'
import { loadAudioSettings, saveAudioSettings } from '../data/db'

interface State {
  options: AudioOptions; loaded: boolean; error: string | null;
  load: () => Promise<void>; update: (patch: Partial<AudioOptions>) => Promise<void>;
}
export const useAudioSettings = create<State>((set, get) => ({
  options: DEFAULT_AUDIO, loaded: false, error: null,
  load: async () => {
    try { const options = await loadAudioSettings(); audioEngine.setOptions(options); set({ options, loaded: true, error: null }) }
    catch { set({ loaded: true, error: 'Could not load saved audio settings. Changes may not persist.' }) }
  },
  update: async patch => {
    const options = { ...get().options, ...patch }
    audioEngine.setOptions(options); set({ options })
    try { await saveAudioSettings(options); set({ error: null }) }
    catch { set({ error: 'Audio settings could not be saved on this device.' }) }
  },
}))
