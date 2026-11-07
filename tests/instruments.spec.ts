import { expect, test, type Page } from '@playwright/test'

test.use({ actionTimeout: 10000 })

type Instrument = 'pluck' | 'keys'

/** Tag fetched MP3 buffers, then identify the bank actually sent to the audio output. */
async function traceInstruments(page: Page) {
  await page.addInitScript(() => {
    const state = window as Window & { playedBanks: string[] }
    state.playedBanks = []
    const bytes = new WeakMap<ArrayBuffer, string>()
    const decoded = new WeakMap<AudioBuffer, string>()
    const fetchFile = window.fetch
    window.fetch = async (...args) => {
      const response = await fetchFile(...args)
      const url = String(args[0] instanceof Request ? args[0].url : args[0])
      const bank = url.includes('/guitar-acoustic/') ? 'pluck' : url.includes('/piano/') ? 'keys' : null
      if (bank) {
        const arrayBuffer = response.arrayBuffer.bind(response)
        response.arrayBuffer = async () => { const data = await arrayBuffer(); bytes.set(data, bank); return data }
      }
      return response
    }
    const decode = BaseAudioContext.prototype.decodeAudioData
    BaseAudioContext.prototype.decodeAudioData = function (data, success, failure) {
      const bank = bytes.get(data)
      return decode.call(this, data, success, failure).then(buffer => {
        if (bank) decoded.set(buffer, bank)
        return buffer
      })
    }
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      const bank = this.buffer && decoded.get(this.buffer)
      if (bank) state.playedBanks.push(bank)
      if (duration === undefined) start.call(this, when, offset)
      else start.call(this, when, offset, duration)
    }
  })
}

async function expectBank(page: Page, bank: Instrument, play: () => Promise<unknown>) {
  const before = await page.evaluate(() => (window as Window & { playedBanks: string[] }).playedBanks.length)
  await play()
  await expect.poll(() => page.evaluate(() => (window as Window & { playedBanks: string[] }).playedBanks.length)).toBeGreaterThan(before)
  const played = await page.evaluate(index => (window as Window & { playedBanks: string[] }).playedBanks.slice(index), before)
  expect(played.every(actual => actual === bank), `Expected ${bank}, heard ${played.join(', ')}`).toBe(true)
}

const home = (page: Page) => page.getByRole('button', { name: 'Guitar Lab 首頁' }).click()
const tools = (page: Page) => page.getByRole('navigation', { name: '主要導覽' }).getByRole('button', { name: '工具', exact: true }).click()

test('one instrument applies to every playback path, including cached bank switches', async ({ page }) => {
  test.setTimeout(90000)
  await traceInstruments(page)
  await page.goto('/settings')
  for (const instrument of ['pluck', 'keys', 'pluck'] as const) {
    await page.getByLabel('樂器音色').selectOption(instrument)
    await expectBank(page, instrument, () => page.getByRole('button', { name: '試聽音色', exact: true }).click())
    await expectBank(page, instrument, () => page.getByRole('button', { name: '開始校準', exact: true }).click())
    await tools(page)
    await expectBank(page, instrument, () => page.locator('[data-cell="1-3"]').click())
    await expectBank(page, instrument, () => page.getByRole('button', { name: '重播', exact: true }).click())
    await page.getByRole('tab', { name: '聲音', exact: true }).click()
    await expectBank(page, instrument, () => page.getByRole('button', { name: /^▶ 播放 C/ }).click())
    await expectBank(page, instrument, () => page.getByRole('button', { name: '▶ 播放音程', exact: true }).click())
    await expectBank(page, instrument, () => page.getByRole('button', { name: '▶ 播放音階', exact: true }).click())
    await page.getByRole('tab', { name: '和弦進行', exact: true }).click()
    await expectBank(page, instrument, () => page.getByRole('button', { name: '▶ 播放進行', exact: true }).click())
    await page.getByRole('tab', { name: '比較試聽', exact: true }).click()
    await expectBank(page, instrument, () => page.getByRole('button', { name: /播放 A$/ }).click())
    await expectBank(page, instrument, () => page.getByRole('button', { name: /播放 B$/ }).click())
    await home(page)
    await page.getByRole('button', { name: '聽力練習', exact: true }).click()
    await expectBank(page, instrument, () => page.getByRole('button', { name: '▶ 播放題目', exact: true }).click())
    await home(page)
    await page.getByRole('button', { name: /通勤練習.*點指板/ }).click()
    await page.getByLabel('這次練什麼').selectOption('notes')
    await page.getByRole('button', { name: /^(▶ 開始練習|開始新一輪)$/ }).click()
    const string = Number(await page.locator('[data-target-string="true"]').getAttribute('data-string'))
    const prompt = await page.locator('.question-prompt').textContent()
    const match = /([A-G])([♯]?)([2-5])/.exec(prompt!)!
    const pc: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
    const midi = (Number(match[3]) + 1) * 12 + pc[match[1]] + (match[2] ? 1 : 0)
    const open = [0,64,59,55,50,45,40][string]
    await expectBank(page, instrument, () => page.locator(`[data-cell="${string}-${midi - open}"]`).click())
    await page.getByRole('button', { name: '結束這次', exact: true }).click()
    await expect(page.locator('.summary-card')).toBeVisible()
    await home(page)
    await page.getByRole('button', { name: '設定', exact: true }).click()
    await expect(page.getByLabel('樂器音色')).toHaveValue(instrument)
  }
})

test('changing the global instrument updates an already-open playback tab in both directions', async ({ page, context }) => {
  await page.goto('/settings')
  await page.getByLabel('樂器音色').selectOption('pluck')
  const playback = await context.newPage()
  await traceInstruments(playback)
  await playback.goto('/settings')
  await expect(playback.getByLabel('樂器音色')).toHaveValue('pluck')
  await expectBank(playback, 'pluck', () => playback.getByRole('button', { name: '試聽音色', exact: true }).click())
  for (const instrument of ['keys', 'pluck'] as const) {
    await page.getByLabel('樂器音色').selectOption(instrument)
    await expect(playback.getByLabel('樂器音色')).toHaveValue(instrument)
    await tools(playback)
    await expectBank(playback, instrument, () => playback.locator('[data-cell="1-3"]').click())
    await home(playback)
    await playback.getByRole('button', { name: '設定', exact: true }).click()
  }
  await playback.reload()
  await expect(playback.getByLabel('樂器音色')).toHaveValue('pluck')
  await tools(playback)
  await expectBank(playback, 'pluck', () => playback.locator('[data-cell="1-3"]').click())
  await playback.close()
})
