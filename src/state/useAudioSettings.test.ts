import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), apply: vi.fn() }))
vi.mock('../data/db', () => ({ loadAudioSettings: mocks.read, saveAudioSettings: mocks.write }))
vi.mock('../audio/AudioEngine', () => ({
  DEFAULT_AUDIO: { enabled: true, silent: false, volume: .65, instrument: 'pluck', tempo: 100, noteDuration: .8, metronome: false },
  audioEngine: { setOptions: mocks.apply },
}))
import { DEFAULT_AUDIO, type AudioOptions } from '../audio/AudioEngine'

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks()
  mocks.read.mockResolvedValue({ ...DEFAULT_AUDIO, instrument: 'keys' })
  mocks.write.mockResolvedValue(undefined)
})

describe('one global audio setting', () => {
  it('a delayed saved piano read cannot undo a newly selected guitar', async () => {
    let finish!: (value: AudioOptions) => void
    mocks.read.mockReturnValueOnce(new Promise<AudioOptions>(resolve => { finish = resolve }))
    const { useAudioSettings } = await import('./useAudioSettings')
    const loading = useAudioSettings.getState().load()
    await useAudioSettings.getState().update({ instrument: 'pluck' })
    finish({ ...DEFAULT_AUDIO, instrument: 'keys' })
    await loading
    expect(useAudioSettings.getState().options.instrument).toBe('pluck')
    expect(mocks.apply).toHaveBeenLastCalledWith(expect.objectContaining({ instrument: 'pluck' }))
    expect(useAudioSettings.getState().loaded).toBe(true)
  })

  it('deduplicates simultaneous hydration and later refreshes the saved selection', async () => {
    const { useAudioSettings } = await import('./useAudioSettings')
    await Promise.all([useAudioSettings.getState().load(), useAudioSettings.getState().load()])
    expect(mocks.read).toHaveBeenCalledOnce()
    expect(useAudioSettings.getState().options.instrument).toBe('keys')
    mocks.read.mockResolvedValueOnce({ ...DEFAULT_AUDIO, instrument: 'pluck' })
    await useAudioSettings.getState().load()
    expect(mocks.apply).toHaveBeenLastCalledWith(expect.objectContaining({ instrument: 'pluck' }))
  })

  it('serializes rapid changes and saves the full latest setting without reverting the engine', async () => {
    let finish!: () => void
    mocks.write.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve }))
    const { useAudioSettings } = await import('./useAudioSettings')
    const first = useAudioSettings.getState().update({ instrument: 'keys' })
    const second = useAudioSettings.getState().update({ volume: .4 })
    await vi.waitFor(() => expect(mocks.write).toHaveBeenCalledOnce())
    await useAudioSettings.getState().load()
    expect(mocks.read).not.toHaveBeenCalled()
    finish()
    await Promise.all([first, second])
    expect(mocks.write).toHaveBeenLastCalledWith(expect.objectContaining({ instrument: 'keys', volume: .4 }))
    expect(mocks.apply).toHaveBeenLastCalledWith(expect.objectContaining({ instrument: 'keys', volume: .4 }))
  })

  it('keeps the chosen sound after a save failure and can persist the next change', async () => {
    mocks.write.mockRejectedValueOnce(new Error('Storage unavailable'))
    const { useAudioSettings } = await import('./useAudioSettings')
    await useAudioSettings.getState().update({ instrument: 'keys' })
    expect(useAudioSettings.getState().options.instrument).toBe('keys')
    expect(useAudioSettings.getState().error).toBeTruthy()
    await useAudioSettings.getState().update({ instrument: 'pluck' })
    expect(useAudioSettings.getState().error).toBeNull()
    expect(mocks.write).toHaveBeenLastCalledWith(expect.objectContaining({ instrument: 'pluck' }))
  })
})
