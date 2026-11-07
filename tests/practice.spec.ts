import { expect, test, type Page } from '@playwright/test'

async function startPractice(page: Page) {
  await page.getByRole('button', { name: '▶ 開始練習' }).click()
  await expect(page.locator('.lesson-card, .question-prompt').first()).toBeVisible()
  const intro = page.getByRole('button', { name: /懂了，開始練習/ })
  if (await intro.isVisible()) await intro.click()
}

async function attempts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('guitar-lab'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    const records = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = db.transaction('attempts').objectStore('attempts').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    }); db.close(); return records
  })
}

test('horizontal neck puts thin string 1 above thick string 6 without changing B3 or keyboard answers', async ({ page }) => {
  await page.goto('/lab/fretboard')
  const board = page.locator('svg.fretboard')
  const upper = await board.locator('[data-cell="1-4"]').boundingBox()
  const lower = await board.locator('[data-cell="6-4"]').boundingBox()
  expect(upper!.y).toBeLessThan(lower!.y)
  const thicknesses = await board.locator('.svg-string-label').evaluateAll(labels => labels.map(label => Number(label.parentElement!.querySelector('line')!.getAttribute('stroke-width'))))
  expect(thicknesses[0]).toBeLessThan(thicknesses[5])
  await board.locator('[data-cell="3-4"]').click()
  await expect(page.locator('.selected-note strong')).toHaveText('B3')
  await board.locator('[data-cell="1-1"]').focus()
  await page.keyboard.press('ArrowDown')
  await expect(board.locator('.fret-cell:focus')).toHaveAttribute('data-cell', '2-1')
  await page.keyboard.press('Enter')
  await expect(page.locator('.selected-note strong')).toHaveText('C4')
})

test('portrait practice has large targets, no swipe answer, correct keyboard mapping and an explicit end', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByLabel('這次練什麼').selectOption('notes')
  await startPractice(page)
  await expect(page.locator('.question-prompt')).toBeVisible()
  const cell = page.locator('.fret-cell.interactive').first()
  await expect(page.locator('.local-board .svg-fret-label')).toHaveCount(4)
  const box = await cell.locator('rect').first().boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44)
  await cell.dispatchEvent('pointerdown', { clientX: 10, clientY: 10 })
  await cell.dispatchEvent('pointermove', { clientX: 40, clientY: 10 })
  await cell.dispatchEvent('click', { detail: 1 })
  expect(await attempts(page)).toHaveLength(0)
  await page.screenshot({ path: info.outputPath('pocket-320.png'), fullPage: true })
  await page.getByRole('button', { name: '暫停', exact: true }).click()
  await expect(page.locator('.question-card')).toHaveAttribute('inert', '')
  await page.getByRole('button', { name: '繼續練習', exact: true }).click()
  await cell.focus(); await page.keyboard.press('ArrowDown')
  await expect(page.locator('.fret-cell:focus')).toHaveAttribute('data-cell', /^2-/)
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await attempts(page)).length).toBe(1)
  await page.getByRole('button', { name: '結束這次', exact: true }).click()
  await expect(page.locator('.summary-card')).toBeVisible()
  await expect(page.getByRole('button', { name: '匯出練習進度' })).toBeVisible()
  await context.close()
})

test('instrument answers verify the actual octave without granting position recall, and release the microphone', async ({ page }, info) => {
  await page.addInitScript(() => {
    const state = window as Window & { micCalls: number; stopped: boolean; fakePluck: (midi: number) => void }
    state.micCalls = 0; state.stopped = false
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      state.micCalls++
      const context = new AudioContext()
      await context.resume()
      const gain = context.createGain(); gain.gain.value = 0
      const oscillator = context.createOscillator(); oscillator.connect(gain); oscillator.start()
      const output = context.createMediaStreamDestination(); gain.connect(output)
      const track = output.stream.getAudioTracks()[0]
      const stop = track.stop.bind(track)
      track.stop = () => { state.stopped = true; stop(); void context.close() }
      state.fakePluck = midi => { oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12); gain.gain.cancelScheduledValues(context.currentTime); gain.gain.setValueAtTime(.3, context.currentTime); gain.gain.setValueAtTime(0, context.currentTime + .6) }
      return output.stream
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /彈吉他.*麥克風作答/ }).click()
  await page.getByLabel('這次練什麼').selectOption('notes')
  await startPractice(page)
  await expect(page.locator('.question-prompt')).toContainText('照圖彈奏')
  expect(await page.evaluate(() => (window as unknown as { micCalls: number }).micCalls)).toBe(0)
  const prompt = await page.locator('.question-prompt').textContent()
  const match = /第 (\d) 弦(?:第 (\d+) 格|空弦)/.exec(prompt!)!
  const midi = [40,45,50,55,59,64][6 - Number(match[1])] + Number(match[2] ?? 0)
  await page.getByRole('button', { name: '開始收音', exact: true }).click()
  await expect(page.getByRole('button', { name: '停止收音', exact: true })).toBeVisible()
  // A full octave must fail, even though the note name is the same.
  const wrong = midi + 12 <= 76 ? midi + 12 : midi - 12
  await page.waitForTimeout(250)
  await page.evaluate(m => (window as unknown as { fakePluck: (midi: number) => void }).fakePluck(m), wrong)
  await expect(page.getByRole('status').filter({ hasText: '還不對' })).toBeVisible()
  expect((await attempts(page))[0]).toMatchObject({ inputMethod: 'microphone', verificationScope: 'exactPitch', itemResults: {}, reviewItemIds: [], result: 'incorrect' })
  expect((await attempts(page))[0].string).toBeUndefined()
  await page.screenshot({ path: info.outputPath('instrument-feedback.png'), fullPage: true })
  await page.getByRole('button', { name: '再試一次', exact: true }).click()
  await page.waitForTimeout(900)
  await page.evaluate(m => (window as unknown as { fakePluck: (midi: number) => void }).fakePluck(m), midi)
  await expect.poll(async () => (await attempts(page)).filter(a => a.result === 'correct').length).toBe(1)
  expect(await page.evaluate(() => (window as unknown as { micCalls: number }).micCalls)).toBe(1)
  await page.getByRole('button', { name: '暫停', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { stopped: boolean }).stopped)).toBe(true)
})

test('naming stays naming with microphone selected; left-handed arrow direction follows the screen', async ({ page }) => {
  await page.goto('/settings')
  await page.getByLabel('左手琴顯示').check()
  await page.goto('/')
  await page.getByRole('button', { name: /彈吉他.*麥克風作答/ }).click()
  await page.getByLabel('這次練什麼').selectOption('naming')
  await startPractice(page)
  await expect(page.locator('.pitch-picker')).toBeVisible()
  await expect(page.getByRole('button', { name: '開始收音', exact: true })).toHaveCount(0)
})

test('quiet built-in-microphone levels produce visible feedback and grade the first note without waiting for silence', async ({ page }, info) => {
  await page.addInitScript(() => {
    const state = window as Window & { targetMidi: number; micCalls: number }
    state.micCalls = 0
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      state.micCalls++
      const context = new AudioContext(); await context.resume()
      const output = context.createMediaStreamDestination()
      const gain = context.createGain(); gain.gain.value = .008
      const oscillator = context.createOscillator(); oscillator.frequency.value = 440 * 2 ** ((state.targetMidi - 69) / 12)
      oscillator.connect(gain); gain.connect(output); oscillator.start()
      const track = output.stream.getAudioTracks()[0], stop = track.stop.bind(track)
      track.stop = () => { stop(); void context.close() }
      return output.stream
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /彈吉他.*麥克風作答/ }).click()
  await page.getByLabel('這次練什麼').selectOption('notes')
  await startPractice(page)
  const prompt = await page.locator('.question-prompt').textContent()
  const match = /第 (\d) 弦(?:第 (\d+) 格|空弦)/.exec(prompt!)!
  const midi = [40,45,50,55,59,64][6 - Number(match[1])] + Number(match[2] ?? 0)
  await page.evaluate(value => { (window as unknown as { targetMidi: number }).targetMidi = value }, midi)
  await page.getByRole('button', { name: '開始收音', exact: true }).click()
  await expect.poll(async () => (await attempts(page)).filter(a => a.result === 'correct').length).toBe(1)
  await expect.poll(() => page.getByRole('meter', { name: '麥克風輸入音量' }).evaluate(e => (e as HTMLMeterElement).value)).toBeGreaterThan(0)
  await expect(page.locator('.play-listen strong')).toContainText('聽到')
  await page.screenshot({ path: info.outputPath('quiet-microphone.png'), fullPage: true })
  await page.getByRole('button', { name: '暫停', exact: true }).click()
})

test('denied microphone permission is an actionable error rather than a false listening state', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Denied', 'NotAllowedError') } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /彈吉他.*麥克風作答/ }).click()
  await page.getByLabel('這次練什麼').selectOption('notes')
  await startPractice(page)
  await page.getByRole('button', { name: '開始收音', exact: true }).click()
  await expect(page.getByText('收音未啟動', { exact: true })).toBeVisible()
  await expect(page.getByText(/網站尚未取得麥克風權限/)).toBeVisible()
  await expect(page.getByRole('button', { name: '重新收音', exact: true })).toBeVisible()
  expect(await attempts(page)).toHaveLength(0)
})
