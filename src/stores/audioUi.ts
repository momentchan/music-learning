import { create } from 'zustand'
import { audioEngine } from '../audio/AudioEngine'
import type { SoundEvent } from '../exercise-engine/types'
import { useAudioSettings } from '../state/useAudioSettings'

interface AudioUi {
  error: string
  playing: boolean
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

export const useAudioUi = create<AudioUi>((set, get) => ({
  error: '',
  playing: false,
  setPlaying: playing => set({ playing }),
  run: async fn => {
    if (!audioIsOn()) { set({ error: '聲音已關閉。可在右上角或設定中開啟。' }); return }
    try { set({ error: '' }); await fn(); set({ playing: true }) }
    catch (e) { set({ error: e instanceof Error ? `無法播放聲音：${e.message}` : '無法播放聲音，請再點一次。', playing: false }) }
  },
  play: events => get().run(() => audioEngine.playSequence(events, () => set({ playing: false }))),
  stop: () => { audioEngine.stop(); set({ playing: false }) },
  clearError: () => set({ error: '' }),
}))
