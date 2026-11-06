import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8')) as { instruments: Record<'pluck' | 'keys', { file: string }[]> }

test('installed PWA decodes both recorded instruments after an offline reload', async ({ page, context }) => {
  await page.addInitScript(() => {
    const state = window as Window & { sampledStarts: number }
    state.sampledStarts = 0
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      if (this.buffer && this.buffer.duration > 1) state.sampledStarts++
      if (duration === undefined) start.call(this, when, offset)
      else start.call(this, when, offset, duration)
    }
  })
  await page.goto('/settings')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(async () => {
    const keys = await caches.keys()
    const entries = await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))
    return entries.flat().filter(url => new URL(url).pathname.endsWith('.mp3')).length
  }), { timeout: 15_000 }).toBe(22)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: '試聽音色', exact: true })).toBeVisible()
  const decoded = await page.evaluate(async files => {
    const context = new AudioContext()
    try {
      const results = []
      for (const file of files) {
        const response = await fetch(`/audio/${file}`)
        if (!response.ok) throw new Error(`Offline audio failed: ${file}`)
        const buffer = await context.decodeAudioData(await response.arrayBuffer())
        results.push({ channels: buffer.numberOfChannels, seconds: buffer.duration, frames: buffer.length })
      }
      return results
    } finally { await context.close() }
  }, [manifest.instruments.pluck[0].file, manifest.instruments.keys[0].file])
  expect(decoded.every(sample => sample.channels === 1 && sample.seconds > 1 && sample.frames > 44_100)).toBe(true)
  await page.getByRole('button', { name: '試聽音色', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { sampledStarts: number }).sampledStarts)).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: '試聽音色', exact: true })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('樂器音色').selectOption('keys')
  const before = await page.evaluate(() => (window as Window & { sampledStarts: number }).sampledStarts)
  await page.getByRole('button', { name: '試聽音色', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { sampledStarts: number }).sampledStarts)).toBeGreaterThan(before)
  await expect(page.getByRole('button', { name: '試聽音色', exact: true })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
