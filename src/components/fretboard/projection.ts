export type BoardOrientation = 'vertical' | 'horizontal' | 'playing'

export function stringOrder(orientation: BoardOrientation, leftHanded = false): number[] {
  if (orientation === 'vertical') return leftHanded ? [1, 2, 3, 4, 5, 6] : [6, 5, 4, 3, 2, 1]
  return [1, 2, 3, 4, 5, 6]
}

export function nextPosition(string: number, fret: number, key: string, orientation: BoardOrientation, leftHanded: boolean, min: number, max: number) {
  const order = stringOrder(orientation, leftHanded)
  const vertical = orientation === 'vertical'
  let index = order.indexOf(string)
  let next = fret
  if (vertical) {
    if (key === 'ArrowLeft') index--
    if (key === 'ArrowRight') index++
    if (key === 'ArrowUp') next--
    if (key === 'ArrowDown') next++
  } else {
    if (key === 'ArrowUp') index--
    if (key === 'ArrowDown') index++
    const direction = orientation === 'playing' && leftHanded ? -1 : 1
    if (key === 'ArrowLeft') next -= direction
    if (key === 'ArrowRight') next += direction
  }
  return { string: order[Math.max(0, Math.min(5, index))], fret: Math.max(min, Math.min(max, next)) }
}

export const FRET_WINDOWS = [[0, 3], [3, 6], [6, 9], [9, 12]] as const
