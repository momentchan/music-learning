import manifest from './sample-manifest.json'
import type { Instrument } from '../music/theory'

export const INSTRUMENT_SAMPLES = manifest.instruments

/** Same-origin assets work with the production PWA cache; no external audio CDN. */
export async function loadSampleBuffers(instrument: Instrument, decode: (data: ArrayBuffer) => Promise<AudioBuffer>, signal: AbortSignal): Promise<Record<number, AudioBuffer>> {
  const entries = await Promise.all(INSTRUMENT_SAMPLES[instrument].map(async sample => {
    const response = await fetch(`${import.meta.env.BASE_URL}audio/${sample.file}`, { signal })
    if (!response.ok) throw new Error(`Sample ${sample.file}: HTTP ${response.status}`)
    const buffer = await decode(await response.arrayBuffer())
    if (!buffer.length || !buffer.duration) throw new Error(`Empty sample: ${sample.file}`)
    return [sample.midi, buffer] as const
  }))
  return Object.fromEntries(entries)
}
