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
})
