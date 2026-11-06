/** Small deterministic PRNG (mulberry32) so questions can be regenerated from a seed. */
export type Rng = () => number

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]
export const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function randomSeed(): number {
  return typeof crypto !== 'undefined' ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 2 ** 32)
}

/** Derive a stable child seed (e.g. per item in a session). */
export function deriveSeed(seed: number, index: number): number {
  return createRng((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0)() * 2 ** 32 >>> 0
}
