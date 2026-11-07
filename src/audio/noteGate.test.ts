import { describe, expect, it } from 'vitest'
import { NoteGate } from './noteGate'

describe('new pluck gate', () => {
  it('accepts a first note after explicit start without requiring hidden initial silence', () => {
    const gate = new NoteGate()
    gate.reset(false)
    expect(gate.sample(130.81, 0)).toBeNull()
    expect(gate.sample(130.81, 50)).toBeNull()
    expect(gate.sample(130.81, 110)?.midi).toBe(48)
    expect(gate.sample(130.81, 200)).toBeNull()
    gate.reset()
    for (let t = 250; t < 750; t += 50) expect(gate.sample(130.81, t)).toBeNull()
  })
  it('requires silence before an attack and does not accept lingering sound', () => {
    const gate = new NoteGate()
    for (let t = 0; t < 800; t += 50) expect(gate.sample(130.81, t)).toBeNull()
    gate.sample(null, 800); gate.sample(null, 1000)
    let note = null
    for (let t = 1050; t <= 1250; t += 50) note = gate.sample(130.81, t) ?? note
    expect(note?.midi).toBe(48)
    for (let t = 1300; t < 2000; t += 50) expect(gate.sample(130.81, t)).toBeNull()
    gate.reset()
    for (let t = 2000; t < 2500; t += 50) expect(gate.sample(130.81, t)).toBeNull()
  })
  it('does not call alternating semitones a stable note', () => {
    const gate = new NoteGate()
    gate.sample(null, 0); gate.sample(null, 200)
    for (let t = 250; t < 1500; t += 50) expect(gate.sample(t % 100 ? 130.81 : 138.59, t)).toBeNull()
  })
})
