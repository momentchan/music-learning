import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const audio = vi.hoisted(() => ({
  load: vi.fn(), strike: vi.fn(), click: vi.fn(),
  events: [] as { callback: (time: number) => void; at: number }[],
}))

vi.mock('./samples', () => ({ loadSampleBuffers: audio.load }))
vi.mock('tone', () => {
  class Node {
    gain = { rampTo: vi.fn() }
    connect() { return this }
    toDestination() { return this }
    dispose() {}
  }
  class Sampler extends Node {
    triggerAttackRelease = audio.strike
    releaseAll() {}
  }
  class Synth extends Node {
    triggerAttackRelease = audio.click
    triggerRelease() {}
  }
  const transport = {
    bpm: { value: 100 }, timeSignature: 4, loop: false, loopStart: 0, loopEnd: 0,
    stop() {}, start() {}, cancel() { audio.events.length = 0 },
    schedule(callback: (time: number) => void, at: number) { audio.events.push({ callback, at }) },
    scheduleOnce() {},
  }
  return {
    Sampler, Synth, Gain: Node, Limiter: Node, start: async () => {}, now: () => 0,
    getContext: () => ({ state: 'running', decodeAudioData: vi.fn(), rawContext: { outputLatency: 0, baseLatency: 0 } }),
    getTransport: () => transport, getDraw: () => ({ schedule: (callback: () => void) => callback() }),
  }
})

import { AudioEngine, DEFAULT_AUDIO } from './AudioEngine'
import { midiToFrequency } from '../music/theory'

let engine: AudioEngine
beforeEach(() => {
  vi.clearAllMocks()
  audio.events.length = 0
  audio.load.mockResolvedValue({})
  engine = new AudioEngine()
})
afterEach(() => engine.dispose())

function deferredLoad() {
  let resolve!: (buffers: Record<number, AudioBuffer>) => void
  const promise = new Promise<Record<number, AudioBuffer>>(done => { resolve = done })
  audio.load.mockReturnValueOnce(promise)
  return resolve
}

describe('sample playback ownership', () => {
  it.each(['stop', 'mute', 'dispose'] as const)('does not start a pending first note after %s', async action => {
    const resolve = deferredLoad()
    const playback = engine.playNote(60)
    await vi.waitFor(() => expect(audio.load).toHaveBeenCalledOnce())
    if (action === 'mute') engine.setOptions({ ...DEFAULT_AUDIO, silent: true })
    else engine[action]()
    resolve({})
    await playback
    expect(audio.strike).not.toHaveBeenCalled()
  })

  it('shares one bank load while only the newest requested note plays', async () => {
    const resolve = deferredLoad()
    const first = engine.playNote(60)
    await vi.waitFor(() => expect(audio.load).toHaveBeenCalledOnce())
    const second = engine.playNote(64)
    resolve({})
    await Promise.all([first, second])
    expect(audio.load).toHaveBeenCalledOnce()
    expect(audio.strike).toHaveBeenCalledOnce()
    expect(audio.strike.mock.calls[0][0]).toEqual([midiToFrequency(64)])
  })

  it('can retry after a failed load instead of retaining a rejected promise', async () => {
    audio.load.mockRejectedValueOnce(new Error('offline'))
    await expect(engine.playNote(60)).rejects.toThrow('音色載入失敗')
    await engine.playNote(60)
    expect(audio.load).toHaveBeenCalledTimes(2)
    expect(audio.strike).toHaveBeenCalledOnce()
  })

  it('plays the metronome without downloading instrument recordings', async () => {
    expect(await engine.playClicks(4, 120)).toBeTypeOf('number')
    expect(audio.load).not.toHaveBeenCalled()
    for (const event of [...audio.events]) event.callback(event.at)
    expect(audio.click).toHaveBeenCalledTimes(4)
  })

  it('lets arpeggio strings overlap, while harmonic intervals start together', async () => {
    await engine.playChord('C', 'up')
    for (const event of [...audio.events]) event.callback(event.at)
    expect(audio.strike.mock.calls).toHaveLength(3)
    const notes = audio.strike.mock.calls
    expect(notes[0][0][0]).toBeLessThan(notes[1][0][0])
    expect(notes[0][2] + notes[0][1]).toBeGreaterThan(notes[2][2])
    audio.strike.mockClear()
    await engine.playInterval(60, 7, 'harmonic')
    audio.events[0].callback(0)
    expect(audio.strike).toHaveBeenCalledOnce()
    expect(audio.strike.mock.calls[0][0]).toEqual([midiToFrequency(60), midiToFrequency(67)])
  })
})
