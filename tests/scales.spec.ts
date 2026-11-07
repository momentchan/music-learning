import { test, expect, type Page } from '@playwright/test'
import type { Question } from '../src/exercise-engine/types'

async function currentQuestion(page: Page): Promise<Question> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('guitar-lab'); r.onsuccess = () => resolve(r.result) })
    const rows = await new Promise<{cursor: number; plannedItems: {question: Question}[]}[]>(resolve => { const r = db.transaction('sessions').objectStore('sessions').getAll(); r.onsuccess = () => resolve(r.result) })
    db.close(); const session = rows.at(-1)!; return session.plannedItems[session.cursor].question
  })
}
async function attempts(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('guitar-lab'); r.onsuccess = () => resolve(r.result) })
    const rows = await new Promise<{inputMethod: string; verificationScope: string; reviewItemIds: string[]; assisted: boolean; correct: boolean}[]>(resolve => { const r = db.transaction('attempts').objectStore('attempts').getAll(); r.onsuccess = () => resolve(r.result) })
    db.close(); return rows
  })
}
async function begin(page: Page, guitar = false) {
  await page.goto('/')
  await page.getByRole('button', { name: guitar ? /彈吉他.*麥克風作答/ : /通勤練習.*點指板/ }).click()
  await page.getByLabel('這次練什麼').selectOption('scales')
  await page.getByRole('button', { name: /^(▶ 開始練習|開始新一輪)$/ }).click()
  await expect(page.locator('.question-prompt')).toContainText('C 大調')
  await expect(page.locator('.lesson-card')).toHaveCount(0)
}

for (const width of [390, 1280]) test(`scale practice starts directly, retries and continues at ${width}px`, async ({ page }, info) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width, height: 900 })
  await begin(page)
  await expect(page.locator('.question-prompt')).toHaveText('C 大調：找出第 2 級')
  await expect(page.locator('.question-card .svg-note')).toHaveText('C')
  await expect(page.locator('.question-card')).toContainText('主音是第 1 級')
  await page.screenshot({ path: info.outputPath('scale-question.png'), fullPage: true })
  const initial = await currentQuestion(page)
  await page.reload()
  await expect(page.locator('.question-prompt')).toHaveText(initial.prompt)
  expect(await currentQuestion(page)).toEqual(initial)
  let count = 0
  for (let i = 0; i < 9; i++) {
    const q = await currentQuestion(page)
    expect(q.scale?.tonic).toBe('C')
    const element = await page.locator('.question-prompt').elementHandle()
    if (q.kind === 'fret-locate') {
      const fret = q.targetMidi! - q.tuning[6 - q.string!]
      const target = page.locator(`.question-card [data-cell="${q.string}-${fret}"]`)
      await expect(target).toBeVisible()
      if (i === 0) {
        const wrong = fret === 0 ? 1 : fret - 1
        await page.locator(`.question-card [data-cell="${q.string}-${wrong}"]`).click()
        await expect(page.locator('.feedback')).toContainText('還不對')
        await expect(page.locator('.feedback')).toContainText('第 2 級 = D')
        await expect(page.locator('.feedback')).toHaveCount(0)
        await expect(page.locator('.question-card .svg-note')).toHaveText('C')
        count++
      }
      await target.click()
    } else {
      expect(q.kind).toBe('construct')
      if (q.kind !== 'construct') throw new Error('Unexpected scale question')
      await expect(page.getByRole('button', { name: '送出', exact: true })).toHaveCount(0)
      const note = q.expected[0]
      if (note.endsWith('#')) await page.getByRole('radio', { name: '升記號', exact: true }).click()
      if (note.endsWith('b')) await page.getByRole('radio', { name: '降記號', exact: true }).click()
      await page.getByRole('button', { name: `輸入 ${note.replace('#', '♯').replace('b', '♭')}`, exact: true }).click()
    }
    count++
    await expect(page.locator('.feedback')).toContainText('✓ 正確')
    await expect(page.locator('.feedback')).toContainText(`第 ${q.scale!.degree} 級 = ${q.scale!.target}`)
    await expect(page.getByRole('button', { name: /^(再試一次|下一題 →)$/ })).toHaveCount(0)
    await expect.poll(async () => (await attempts(page)).length).toBe(count)
    await page.waitForFunction(el => !el?.isConnected, element)
  }
  const records = await attempts(page)
  expect(records.filter(a => a.verificationScope === 'noteNaming')).toHaveLength(2)
  expect(records.every(a => a.reviewItemIds.some(id => id.startsWith('scale.degree.C.')))).toBe(true)
  await expect(page.locator('.question-prompt')).toContainText('C 大調')
  await page.getByRole('button', { name: '結束這次', exact: true }).click()
  await page.goto('/')
  await expect(page.getByLabel('這次練什麼')).toHaveValue('scales')
})

test('scale guitar practice uses an exact pitch and never awards position evidence', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const context = new AudioContext(); await context.resume()
      const gain = context.createGain(); gain.gain.value = 0
      const oscillator = context.createOscillator(); oscillator.connect(gain); oscillator.start()
      const output = context.createMediaStreamDestination(); gain.connect(output)
      const track = output.stream.getAudioTracks()[0], stop = track.stop.bind(track)
      track.stop = () => { stop(); void context.close() }
      ;(window as unknown as { pluck: (midi: number) => void }).pluck = midi => {
        oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
        gain.gain.setValueAtTime(.3, context.currentTime)
        gain.gain.setValueAtTime(0, context.currentTime + .5)
      }
      return output.stream
    } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await begin(page, true)
  const q = await currentQuestion(page)
  if (q.kind !== 'fret-locate') throw new Error('Expected scale location')
  await expect(page.locator('.question-prompt')).toContainText('並彈出來')
  await expect(page.locator('.complete-board .svg-fret-label')).toHaveCount(13)
  await expect(page.locator('.complete-board .svg-note')).toHaveText('C')
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { pluck: unknown }).pluck)).toBe('function')
  await page.evaluate(midi => (window as unknown as { pluck: (midi: number) => void }).pluck(midi), q.targetMidi! + 12)
  await expect(page.locator('.feedback')).toContainText('還不對')
  await expect(page.locator('.feedback')).toHaveCount(0)
  await page.waitForTimeout(250)
  await page.evaluate(midi => (window as unknown as { pluck: (midi: number) => void }).pluck(midi), q.targetMidi!)
  await expect.poll(async () => (await attempts(page)).filter(a => a.correct).length).toBe(1)
  for (const a of await attempts(page)) expect(a).toMatchObject({ inputMethod: 'microphone', verificationScope: 'exactPitch', reviewItemIds: [] })
})

test('a scale naming hint is recorded as assisted recall', async ({ page }) => {
  await begin(page)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '跳過（不扣分）', exact: true }).click()
  const q = await currentQuestion(page)
  if (q.kind !== 'construct') throw new Error('Expected naming question')
  await page.getByRole('button', { name: '提示音階', exact: true }).click()
  await expect(page.locator('.question-card')).toContainText('1=C、2=D、3=E、4=F、5=G、6=A、7=B')
  await page.getByRole('button', { name: `輸入 ${q.expected[0]}`, exact: true }).click()
  await expect.poll(async () => (await attempts(page)).length).toBe(1)
  expect((await attempts(page))[0]).toMatchObject({ assisted: true, verificationScope: 'noteNaming' })
})
