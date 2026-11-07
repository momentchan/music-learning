import { intervalNotes, intervalRelation, presentIntervalQuestion } from './intervalQuestion'
import { parseNote, pitchClass } from '../music-theory/notes'
import type { ConstructQuestion } from './types'
import { describe, expect, it } from 'vitest'
import { generate, templatesForNode } from './registry'
import type { ChoiceQuestion, FretLocateQuestion } from './types'
import { locateTargets, validate } from './validate'
import { recheckFor } from '../learning/sessions'
import { parseInterval } from '../music-theory/intervals'

describe('complete playable interval practice', () => {
  const names = ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8']
  it('covers every interval from one to twelve semitones in both string-group types', () => {
    const template = templatesForNode('interval.shapes').find(t => t.id === 'interval.shapes.locate')!
    expect(template.items()).toHaveLength(24)
    for (const name of names) for (const group of ['std', 'gb']) for (let seed = 0; seed < 30; seed++) {
      const q = generate(template.id, seed, 3, `interval.shape.${name}.${group}`) as FretLocateQuestion
      const root = q.tuning[6 - q.reference!.string] + q.reference!.fret
      expect(q.targetMidi! - root).toBe(parseInterval(name).semitones)
      const targets = locateTargets(q)
      expect(targets).toHaveLength(1)
      expect(targets[0].fret).toBeGreaterThanOrEqual(0)
      expect(targets[0].fret).toBeLessThanOrEqual(12)
      expect(validate(q, { kind: 'fret-locate', ...targets[0] }).result).toBe('correct')
      expect(validate(q, { kind: 'played-note', midi: q.targetMidi! }).result).toBe('correct')
      expect(validate(q, { kind: 'played-note', midi: q.targetMidi! + 12 }).result).toBe('incorrect')
      const crosses = q.reference!.string >= 3 && q.string! <= 2
      expect(crosses).toBe(group === 'gb')
      if (parseInterval(name).semitones >= 8) {
        expect(q.reference!.string - q.string!).toBe(2)
        expect(Math.abs(targets[0].fret - q.reference!.fret)).toBeLessThanOrEqual(3)
      }
    }
  })
  it('regenerates a missed interval against its new root instead of reusing an unrelated exact target', () => {
    const original = generate('interval.shapes.locate', 21, 3, 'interval.shape.M7.gb') as FretLocateQuestion
    for (let seed = 0; seed < 20; seed++) {
      const item = recheckFor(original, seed)
      expect(item?.kind).toBe('question')
      if (item?.kind !== 'question') continue
      const q = item.question as FretLocateQuestion
      const root = q.tuning[6 - q.reference!.string] + q.reference!.fret
      expect(q.targetMidi! - root).toBe(11)
      expect(locateTargets(q)).toHaveLength(1)
    }
  })
  it('introduces new families by difficulty rather than flooding beginners', () => {
    const pools = [new Set<string>(), new Set<string>(), new Set<string>()]
    for (const difficulty of [1, 2, 3] as const) for (let seed = 0; seed < 500; seed++) {
      const q = generate('interval.shapes.locate', seed, difficulty) as FretLocateQuestion
      pools[difficulty - 1].add(q.reviewItemIds[0].split('.')[2])
      const identify = generate('interval.shapes.identify', seed, difficulty) as ChoiceQuestion
      expect(new Set(identify.choices).size).toBe(4)
      expect(identify.choices).toContain(identify.answer)
    }
    expect(pools[0]).toEqual(new Set(['M3', 'm3', 'P4', 'P5']))
    expect(pools[1]).toEqual(new Set(['M3', 'm3', 'P4', 'P5', 'm2', 'M2', 'm6', 'M6', 'P8']))
    expect(pools[2]).toEqual(new Set(names))
  })
})

it('uses interval spelling rather than interchangeable pitch-class aliases', () => {
  expect(intervalNotes(47, 'M6').target).toBe('G#')
  expect(intervalNotes(48, 'm6').target).toBe('Ab')
  for (const name of ['m2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8']) {
    for (let root = 40; root < 76; root++) {
      const n = intervalNotes(root, name)
      expect(Math.abs(parseNote(n.target).acc)).toBeLessThanOrEqual(1)
      expect(pitchClass(parseNote(n.target))).toBe(n.targetMidi % 12)
    }
  }
})

it('upgrades saved interval presentation without moving answers or changing evidence', () => {
  const q = generate('interval.shapes.locate', 21, 3, 'interval.shape.M6.std') as FretLocateQuestion
  const legacy = { ...q, interval: undefined, prompt: '根音在第 6 弦第 7 格，在第 4 弦找音程', reference: { ...q.reference!, label: 'R' } }
  const shown = presentIntervalQuestion(legacy) as FretLocateQuestion
  expect(shown.prompt).not.toMatch(/弦|格|R|M6/)
  expect(shown.reference!.label).not.toBe('R')
  expect(shown.targetMidi).toBe(q.targetMidi)
  expect(locateTargets(shown)).toEqual(locateTargets(q))
  expect(shown.reviewItemIds).toEqual(q.reviewItemIds)
  expect(intervalRelation(shown)).toContain('大六度')
})

it('keeps naming evidence separate and rejects enharmonic substitutes as complete answers', () => {
  for (let seed = 0; seed < 60; seed++) {
    const q = generate('interval.shapes.name', seed, 2, 'interval.name.M6') as ConstructQuestion
    expect(q.interval!.name).toBe('M6')
    expect(q.reviewItemIds).toEqual(['interval.name.M6', 'spell.interval'])
    expect(validate(q, { kind: 'construct', notes: q.expected }).result).toBe('correct')
    expect(q.prompt).not.toMatch(/弦|格/)
  }
  const interval = intervalNotes(47, 'M6')
  const q = { ...generate('interval.shapes.name', 1, 2), kind: 'construct', interval, expected: ['G#'], given: ['B'] } as ConstructQuestion
  const grade = validate(q, { kind: 'construct', notes: ['Ab'] })
  expect(grade.result).toBe('partial')
  expect(Object.values(grade.itemResults)).not.toContain(true)
})
