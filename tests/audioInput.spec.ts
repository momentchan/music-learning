import { expect, test, type Page } from '@playwright/test'

async function mockInputs(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as {
      inputCalls: string[]; inputStops: number; usbPresent: boolean; denyInput: boolean;
      defaultInput: string; unplug: (ended?: boolean) => void; changeDefault: () => void
    }
    state.inputCalls = []; state.inputStops = 0; state.usbPresent = true; state.denyInput = false; state.defaultInput = 'built-in'
    const names: Record<string, string> = { 'built-in': 'Microphone Array', focusrite: 'Analogue 1 + 2 (Focusrite USB Audio)' }
    const tracks: MediaStreamTrack[] = []
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () =>
      ['default', 'communications', 'built-in', ...(state.usbPresent ? ['focusrite'] : [])].map(id => ({
        kind: 'audioinput', deviceId: id, groupId: id, label: names[id] || names[state.defaultInput],
      }))
    })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async (constraints: MediaStreamConstraints) => {
      const requested = typeof constraints.audio === 'object' ? (constraints.audio.deviceId as {exact?: string})?.exact || '' : ''
      state.inputCalls.push(requested)
      if (state.denyInput) throw new DOMException('Denied', 'NotAllowedError')
      if (requested && (requested !== 'focusrite' && requested !== 'built-in' || requested === 'focusrite' && !state.usbPresent)) throw new DOMException('Missing', 'OverconstrainedError')
      const id = requested || state.defaultInput
      const context = new AudioContext(); await context.resume()
      const output = context.createMediaStreamDestination()
      const gain = context.createGain(); gain.gain.value = 0
      const oscillator = context.createOscillator(); oscillator.connect(gain); gain.connect(output); oscillator.start()
      const track = output.stream.getAudioTracks()[0], stop = track.stop.bind(track)
      Object.defineProperty(track, 'label', { value: names[id] })
      track.stop = () => { state.inputStops++; stop(); void context.close() }
      tracks.push(track)
      return output.stream
    } })
    state.unplug = (ended = true) => {
      state.usbPresent = false
      if (ended) tracks.at(-1)?.dispatchEvent(new Event('ended'))
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'))
    }
    state.changeDefault = () => { state.defaultInput = 'focusrite'; navigator.mediaDevices.dispatchEvent(new Event('devicechange')) }
  })
}

async function begin(page: Page) {
  await page.getByRole('button', { name: /彈吉他.*麥克風作答/ }).click()
  await page.getByLabel('這次練什麼').selectOption('notes')
  await page.getByRole('button', { name: /^(▶ 開始練習|開始新一輪)$/ }).click()
  const intro = page.getByRole('button', { name: /懂了，開始練習/ })
  await expect(page.locator('.lesson-card, .question-prompt').first()).toBeVisible()
  if (await intro.isVisible()) await intro.click()
}

for (const width of [390, 1280]) test(`input selection remembers Focusrite and follows system defaults at ${width}px`, async ({ page }) => {
  await mockInputs(page)
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  await begin(page)
  const input = page.getByRole('combobox', { name: '輸入來源', exact: true })
  await expect(input).toHaveValue('')
  await expect(page.locator('.mic-device')).toContainText('Microphone Array')
  await input.selectOption('focusrite')
  await expect(page.locator('.mic-device')).toContainText('Focusrite USB Audio')
  expect(await page.evaluate(() => localStorage.getItem('guitar-lab-audio-input'))).toBe('focusrite')
  await page.reload()
  await expect(input).toHaveValue('focusrite')
  await expect(page.locator('.mic-device')).toContainText('Focusrite USB Audio')
  expect(await page.evaluate(() => (window as unknown as { inputCalls: string[] }).inputCalls)).toEqual(['focusrite'])
  await input.selectOption('')
  await expect(page.locator('.mic-device')).toContainText('Microphone Array')
  expect(await page.evaluate(() => localStorage.getItem('guitar-lab-audio-input'))).toBeNull()
  await page.evaluate(() => (window as unknown as { changeDefault: () => void }).changeDefault())
  await expect(page.locator('.mic-device')).toContainText('Focusrite USB Audio')
  await expect(input).toHaveValue('')
  expect(await page.evaluate(() => (window as unknown as { inputStops: number }).inputStops)).toBeGreaterThan(0)
})

for (const ended of [true, false]) test(`unplugging a selected USB input switches once with ended=${ended}`, async ({ page }) => {
  await mockInputs(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('guitar-lab-audio-input', 'focusrite'))
  await begin(page)
  await expect(page.locator('.mic-device')).toContainText('Focusrite USB Audio')
  await page.evaluate(ended => (window as unknown as { unplug: (ended: boolean) => void }).unplug(ended), ended)
  await expect(page.locator('.mic-device')).toContainText('Microphone Array')
  await expect(page.getByText('原輸入裝置已無法使用，已切回跟隨系統。', { exact: true })).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: '輸入來源' })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('guitar-lab-audio-input'))).toBeNull()
  expect(await page.evaluate(() => (window as unknown as { inputCalls: string[] }).inputCalls)).toEqual(['focusrite', ''])
})

test('a stale saved device falls back but a permission denial retains the selected device', async ({ page }) => {
  await mockInputs(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('guitar-lab-audio-input', 'old-usb-id'))
  await begin(page)
  await expect(page.locator('.mic-device')).toContainText('Microphone Array')
  expect(await page.evaluate(() => (window as unknown as { inputCalls: string[] }).inputCalls)).toEqual(['old-usb-id', ''])
  await page.evaluate(() => {
    localStorage.setItem('guitar-lab-audio-input', 'focusrite')
  })
  await page.reload()
  await expect(page.locator('.mic-device')).toContainText('Focusrite USB Audio')
  await page.evaluate(() => { (window as unknown as { denyInput: boolean }).denyInput = true })
  await page.getByRole('button', { name: '重新收音', exact: true }).click()
  await expect(page.getByText(/網站尚未取得麥克風權限/)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('guitar-lab-audio-input'))).toBe('focusrite')
  await expect(page.locator('.mic-device')).toHaveCount(0)
})
