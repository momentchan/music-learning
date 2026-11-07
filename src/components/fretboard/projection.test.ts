import { describe, expect, it } from 'vitest'
import { nextPosition, stringOrder, FRET_WINDOWS } from './projection'

describe('fretboard projection', () => {
  it('player and TAB views name their different string order', () => {
    expect(stringOrder('playing')).toEqual([6,5,4,3,2,1])
    expect(stringOrder('horizontal')).toEqual([1,2,3,4,5,6])
  })
  it('keyboard moves in visible directions, including left-handed player view', () => {
    expect(nextPosition(6, 5, 'ArrowDown', 'playing', false, 0, 12)).toEqual({ string: 5, fret: 5 })
    expect(nextPosition(3, 5, 'ArrowLeft', 'playing', true, 0, 12)).toEqual({ string: 3, fret: 6 })
    expect(nextPosition(6, 5, 'ArrowRight', 'vertical', false, 0, 12)).toEqual({ string: 5, fret: 5 })
    expect(nextPosition(6, 5, 'ArrowRight', 'vertical', true, 0, 12)).toEqual({ string: 6, fret: 5 })
  })
  it('windows cover every fret and do not move answers outside the question', () => {
    for (let f = 0; f <= 12; f++) expect(FRET_WINDOWS.some(([a,b]) => a <= f && f <= b)).toBe(true)
    expect(nextPosition(6, 3, 'ArrowLeft', 'playing', false, 3, 6)).toEqual({ string: 6, fret: 3 })
  })
})
