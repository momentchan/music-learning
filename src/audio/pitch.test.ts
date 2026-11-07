import { describe, expect, it } from 'vitest'
import { fundamentalHz, hzToMidi, pluckedWave } from './pitch'

describe('pitch from a plucked note', () => {
  it('hears the fundamental, not the octave above', () => {
    for (const midi of [40, 48, 64, 69]) {
      const samples = pluckedWave(midi, 44100, 4096)
      const hz = fundamentalHz(samples, 44100)
      expect(hz).not.toBeNull()
      expect(hzToMidi(hz!)).toBe(midi)
    }
  })

  it('ignores silence', () => {
    expect(fundamentalHz(new Float32Array(4096), 44100)).toBeNull()
  })

  it('recognizes quiet, decaying microphone-level guitar signals at both common sample rates', () => {
    for (const rate of [44100, 48000]) for (const midi of [40, 45, 50, 55, 59, 64, 76]) {
      const wave = pluckedWave(midi, rate, 4096)
      for (let i = 0; i < wave.length; i++) wave[i] *= .005 * Math.exp(-i / rate / .3)
      const hz = fundamentalHz(wave, rate)
      expect(hz, `${midi} @ ${rate}`).not.toBeNull()
      expect(hzToMidi(hz!)).toBe(midi)
    }
  })

  it('does not turn broadband room noise into a note', () => {
    let seed = 12345
    const noise = new Float32Array(4096)
    for (let i = 0; i < noise.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; noise[i] = (seed / 4294967296 - .5) * .03 }
    expect(fundamentalHz(noise, 48000)).toBeNull()
  })
})
