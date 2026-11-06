import { create } from 'zustand'
import { audioEngine } from '../audio/AudioEngine'
import type { SoundEvent } from '../exercise-engine/types'
import { useAudioSettings } from '../state/useAudioSettings'

interface AudioUi {
  error: string
  playing: boolean
  loading: boolean
  setPlaying: (playing: boolean) => void
  /** Runs an audio action from a user gesture, reporting failures instead of throwing. */
  run: (fn: () => Promise<unknown>) => Promise<void>
  play: (events: SoundEvent[]) => Promise<void>
  stop: () => void
  clearError: () => void
}

export const audioIsOn = () => {
  const { options } = useAudioSettings.getState()
  return options.enabled && !options.silent
}

let actionGeneration = 0

export const useAudioUi = create<AudioUi>((set, get) => ({
  error: '',
  playing: false,
  loading: false,
  setPlaying: playing => set({ playing }),
  run: async fn => {
    if (!audioIsOn()) { set({ error: '聲音已關閉。可在右上角或設定中開啟。' }); return }
    const generation = ++actionGeneration
    try {
      set({ error: '', playing: false, loading: !audioEngine.isReady })
      await fn()
      if (generation === actionGeneration) set({ playing: audioIsOn(), loading: false })
    } catch (e) {
      if (generation === actionGeneration) set({ error: e instanceof Error ? `無法播放聲音：${e.message}` : '無法播放聲音，請再點一次。', playing: false, loading: false })
    }
  },
  play: events => get().run(() => audioEngine.playSequence(events, () => set({ playing: false }))),
  stop: () => { actionGeneration++; audioEngine.stop(); set({ playing: false, loading: false }) },
  clearError: () => set({ error: '' }),
}))
