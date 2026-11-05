import { describe, expect, it } from 'vitest'
import { CHORD_INTERVALS, chordPitchClasses, chordVoicing, intervalNotes, midiToFrequency, parseChord, planProgression, scaleNotes, STANDARD_TUNING } from './theory'
import { COMPARISONS, comparisonEvents } from './comparisons'
import { makeEarQuestion, type EarType } from './ear'

describe('music theory used by audio', () => {
  it('maps guitar positions and MIDI frequencies', () => {
    expect(STANDARD_TUNING[0] + 12).toBe(52)
    expect(midiToFrequency(69)).toBe(440)
    expect(midiToFrequency(60)).toBeCloseTo(261.626, 2)
  })
  it('builds intervals in all three modes', () => {
    expect(intervalNotes(60, 7, 'ascending')).toEqual([60, 67])
    expect(intervalNotes(60, 7, 'descending')).toEqual([67, 60])
    expect(intervalNotes(60, 14, 'harmonic')).toEqual([60, 74])
  })
  it('spells the intended pitch classes and preserves inversion bass', () => {
    expect(chordPitchClasses(parseChord('F#m7b5'))).toEqual([6, 9, 0, 4])
    expect(chordPitchClasses(parseChord('Cmaj7'))).toEqual([0, 4, 7, 11])
    expect(chordVoicing('C', 1)[0] % 12).toBe(4)
    expect(chordVoicing('G/B')[0] % 12).toBe(11)
    expect(CHORD_INTERVALS.dim7).toEqual([0, 3, 6, 9])
  })
  it('generates scales and stable progression timings', () => {
    expect(scaleNotes(60, 'major')).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
    const plan = planProgression([{ symbol: 'Dm7', beats: 4 }, { symbol: 'G7', beats: 2 }, { symbol: 'Cmaj7', beats: 4 }], 120)
    expect(plan.map(p => p.at)).toEqual([0, 2, 3])
    expect(plan.map(p => p.duration)).toEqual([2, 1, 2])
    expect(plan[0].notes[0] % 12).toBe(2)
  })
})

describe('listening content', () => {
  it('provides a playable, answerable question for every exercise type', () => {
    const types: EarType[] = ['interval', 'triad', 'seventh', 'degree', 'cadence', 'bass', 'progression']
    for (const type of types) {
      for (let i = 0; i < 10; i++) {
        const q = makeEarQuestion(type)
        expect(q.events.length).toBeGreaterThan(0)
        expect(q.events.every(e => e.notes.length > 0 && e.duration > 0)).toBe(true)
        expect(q.choices).toContain(q.answer)
      }
    }
  })
  it('keeps A/B examples at comparable total durations', () => {
    for (const c of COMPARISONS) {
      const a = comparisonEvents(c, 'a').reduce((n, e) => n + e.duration, 0)
      const b = comparisonEvents(c, 'b').reduce((n, e) => n + e.duration, 0)
      expect(Math.abs(a - b)).toBeLessThan(0.1)
    }
  })
})
