import { expect, test, type Page } from '@playwright/test'

async function probeSamplePlayback(page: Page) {
  await page.addInitScript(() => {
    const state = window as Window & { sampledVoices: { duration: number; peak: number; rate: number }[] }
    state.sampledVoices = []
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      if (this.buffer && this.buffer.duration > 1) {
        const pcm = this.buffer.getChannelData(0)
        let peak = 0
        for (let index = 0; index < pcm.length; index += 64) peak = Math.max(peak, Math.abs(pcm[index]))
        state.sampledVoices.push({ duration: this.buffer.duration, peak, rate: this.playbackRate.value })
      }
      if (duration === undefined) start.call(this, when, offset)
      else start.call(this, when, offset, duration)
    }
  })
}

test('selected recorded instruments load locally and produce non-silent audio buffers', async ({ page }) => {
  await probeSamplePlayback(page)
  const files: string[] = []
  page.on('request', request => { if (request.url().endsWith('.mp3')) files.push(new URL(request.url()).pathname) })
  await page.goto('/settings')
  expect(files).toHaveLength(0)
  await page.getByRole('button', { name: '試聽音色', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { sampledVoices: unknown[] }).sampledVoices.length)).toBeGreaterThan(0)
  expect(files.filter(file => file.includes('guitar-acoustic'))).toHaveLength(13)
  expect(files.filter(file => file.includes('/piano/'))).toHaveLength(0)
  const voice = await page.evaluate(() => (window as Window & { sampledVoices: { peak: number; duration: number }[] }).sampledVoices[0])
  expect(voice.peak).toBeGreaterThan(0.05)
  expect(voice.duration).toBeGreaterThan(1)
  await page.getByLabel('樂器音色').selectOption('keys')
  await page.getByRole('button', { name: '試聽音色', exact: true }).click()
  await expect.poll(() => files.filter(file => file.includes('/piano/')).length).toBe(9)
  await expect(page.getByRole('button', { name: '試聽音色', exact: true })).toBeEnabled()
  await expect(page.getByRole('link', { name: '取樣來源與授權' })).toHaveAttribute('href', '/audio/ATTRIBUTION.md')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a failed sample reports an error and a later tap retries successfully', async ({ page }) => {
  await probeSamplePlayback(page)
  await page.route('**/audio/guitar-acoustic/E2.mp3', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/settings')
  await page.getByRole('button', { name: '試聽音色', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('音色載入失敗')
  expect(await page.evaluate(() => (window as Window & { sampledVoices: unknown[] }).sampledVoices.length)).toBe(0)
  await page.unroute('**/audio/guitar-acoustic/E2.mp3')
  await page.getByRole('button', { name: '試聽音色', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as Window & { sampledVoices: unknown[] }).sampledVoices.length)).toBeGreaterThan(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
