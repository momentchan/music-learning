import { midiToFrequency } from '../music-theory/notes'

/** Fundamental frequency in Hz, or null when the buffer is quiet or unpitched. */
export function fundamentalHz(samples: Float32Array, sampleRate: number): number | null {
  let energy = 0
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i]
  if (energy / samples.length < 0.0004) return null

  const half = Math.floor(samples.length / 2)
  const minTau = Math.max(2, Math.floor(sampleRate / 980))
  const maxTau = Math.min(half - 2, Math.floor(sampleRate / 70))
  if (maxTau <= minTau) return null

  const diff = new Float32Array(maxTau + 1)
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0
    for (let i = 0; i < half; i += 2) {
      const delta = samples[i] - samples[i + tau]
      sum += delta * delta
    }
    diff[tau] = sum
  }

  const normalized = new Float32Array(maxTau + 1)
  normalized[0] = 1
  let running = 0
  for (let tau = 1; tau <= maxTau; tau++) {
    running += diff[tau]
    normalized[tau] = running === 0 ? 1 : (diff[tau] * tau) / running
  }

  const threshold = 0.3
  let tau = minTau
  let bestTau = -1
  let bestValue = 1
  for (; tau <= maxTau; tau++) {
    if (normalized[tau] < bestValue) { bestValue = normalized[tau]; bestTau = tau }
    if (normalized[tau] < threshold) {
      while (tau + 1 <= maxTau && normalized[tau + 1] < normalized[tau]) tau++
      bestTau = tau
      bestValue = normalized[tau]
      break
    }
  }
  if (bestTau < 0 || bestValue > 0.45) return null
  tau = bestTau

  const earlier = normalized[tau - 1]
  const later = normalized[tau + 1]
  const denominator = 2 * earlier - 4 * normalized[tau] + 2 * later
  const shift = denominator === 0 ? 0 : (earlier - later) / denominator
  return sampleRate / (tau + shift)
}

export function hzToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440))
}

/** A pure tone plus a weaker octave, the shape a plucked string actually has. */
export function pluckedWave(midi: number, sampleRate: number, length: number): Float32Array {
  const samples = new Float32Array(length)
  const fundamental = midiToFrequency(midi)
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    samples[i] = 0.6 * Math.sin(2 * Math.PI * fundamental * t) + 0.25 * Math.sin(2 * Math.PI * fundamental * 2 * t)
  }
  return samples
}
