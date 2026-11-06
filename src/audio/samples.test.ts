import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import manifest from './sample-manifest.json'

describe('bundled recorded instruments', () => {
  it('ships the exact credited recordings within the 2 MB mobile budget', () => {
    expect(readFileSync(new URL('../../public/audio/manifest.json', import.meta.url), 'utf8')).toBe(readFileSync(new URL('./sample-manifest.json', import.meta.url), 'utf8'))
    let bytes = 0
    for (const samples of Object.values(manifest.instruments)) {
      for (const sample of samples) {
        const data = readFileSync(new URL(`../../public/audio/${sample.file}`, import.meta.url))
        expect(data.length).toBe(sample.bytes)
        expect(createHash('sha256').update(data).digest('hex')).toBe(sample.sha256)
        bytes += data.length
      }
    }
    expect(bytes).toBeLessThan(2_000_000)
  })

  it('covers every guitar fret 0–12 within two semitones of a recording', () => {
    const anchors = manifest.instruments.pluck.map(sample => sample.midi)
    for (let midi = 40; midi <= 76; midi++) expect(Math.min(...anchors.map(anchor => Math.abs(anchor - midi)))).toBeLessThanOrEqual(2)
  })
})
