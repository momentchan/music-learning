import { expect, test, type Page } from '@playwright/test'

/** Answers whatever item the session shows; uses the keyboard for fretboard taps. Returns false at the summary. */
async function answerCurrent(page: Page): Promise<boolean> {
  await expect(page.locator('.question-card, .lesson-card, .bridge-card, .summary-card').first()).toBeVisible()
  if (await page.locator('.summary-card').isVisible().catch(() => false)) return false
  const learn = page.getByRole('button', { name: /懂了，開始練習/ })
  if (await learn.isVisible().catch(() => false)) {
    const button = await learn.elementHandle()
    await learn.click()
    await page.waitForFunction(element => !element?.isConnected, button)
    return true
  }
  const bridge = page.getByRole('button', { name: '很順' })
  if (await bridge.isVisible().catch(() => false)) {
    const button = await bridge.elementHandle()
    await bridge.click()
    await page.waitForFunction(element => !element?.isConnected, button)
    return true
  }
  const pitch = page.locator('.pitch-picker button').first()
  const cell = page.locator('.fret-cell.interactive').first()
  const choice = page.locator('.question-card .choice-grid button').first()
  if (await pitch.isVisible().catch(() => false)) await pitch.click()
  else if (await cell.isVisible().catch(() => false)) {
    await cell.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
  } else if (await choice.isVisible().catch(() => false)) await choice.click()
  else {
    const letter = page.locator('.picker-letters button').first()
    const slots = await page.locator('.picker-slots span').count()
    for (let i = 0; i < slots; i++) await letter.click()
    await page.getByRole('button', { name: '送出' }).click()
  }
  await expect(page.getByRole('status').filter({ hasText: /正確|還不對|部分正確/ })).toBeVisible()
  const currentQuestion = await page.locator('.question-prompt').elementHandle()
  await page.waitForFunction(element => !element?.isConnected, currentQuestion, { timeout: 4000 })
  return true
}

test('cold start reaches the first practice question in two taps', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /開始 5 分鐘練習/ }).click()
  await page.getByRole('button', { name: /懂了，開始練習/ }).click()
  await expect(page.locator('.question-prompt')).toBeVisible()
})

test('a lesson persists every answer, resumes after reload, and completes with a summary', async ({ page }) => {
  await page.goto('/learn/fret.open')
  await page.getByRole('button', { name: '▶ 開始課程' }).click()
  await answerCurrent(page) // learn card
  await answerCurrent(page) // first question
  const progressBefore = await page.locator('.session-bar small').textContent()
  expect(progressBefore).toMatch(/^1\//)
  await page.reload()
  await expect(page.locator('.session-bar small')).toHaveText(progressBefore!)
  await expect(page.getByRole('button', { name: /懂了，開始練習/ })).toHaveCount(0)
  for (let i = 0; i < 20 && await answerCurrent(page); i++) { /* answer until summary */ }
  await expect(page.getByText('練習完成 SESSION COMPLETE')).toBeVisible()
  await page.goto('/progress')
  await expect(page.locator('.mastery-list li').first()).toContainText('次作答')
  await page.goto('/')
  await expect(page.getByRole('button', { name: /繼續 →/ })).toHaveCount(0)
})

test('wrong answers get specific feedback, a retry, and a later recheck', async ({ page }) => {
  await page.goto('/learn/fret.naturals.low')
  await page.getByRole('button', { name: '▶ 開始課程' }).click()
  await page.getByRole('button', { name: /懂了，開始練習/ }).click()
  const prompt = await page.locator('.question-prompt').textContent()
  const string = Number(/第 (\d) 弦/.exec(prompt!)![1])
  const other = string === 6 ? 5 : 6
  await page.locator(`.fret-cell.interactive[data-cell="${other}-1"]`).click()
  await expect(page.getByRole('status').filter({ hasText: '還不對' })).toBeVisible()
  const total = Number((await page.locator('.session-bar small').textContent())!.split('/')[1])
  await page.getByRole('button', { name: '再試一次' }).click()
  await expect(page.locator('.fret-cell.interactive').first()).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: '還不對' })).toHaveCount(0)
  await expect(page.locator('.session-bar small')).toHaveText(`1/${total}`)
  expect(total).toBeGreaterThanOrEqual(7) // recheck inserted into the plan
})

test('deep links reload directly into a screen', async ({ page }) => {
  await page.goto('/learn/key.diatonic')
  await expect(page.getByRole('heading', { name: /調性與順階和弦/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /調性與順階和弦/ })).toBeVisible()
  await page.goto('/learn/chord.changes')
  await expect(page.getByText('這個主題還在規劃中')).toBeVisible()
  await expect(page.getByRole('button', { name: '▶ 開始課程' })).toHaveCount(0)
})

test('backup export and validated import round-trip', async ({ page }) => {
  await page.goto('/learn/fret.open')
  await page.getByRole('button', { name: '▶ 開始課程' }).click()
  await answerCurrent(page)
  await answerCurrent(page)
  await page.goto('/settings')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '匯出備份（JSON）' }).click()])
  const file = await download.path()
  await page.locator('input[type=file]').setInputFiles(file!)
  await expect(page.getByText('備份內容預覽')).toBeVisible()
  await expect(page.locator('.import-preview')).toContainText('作答紀錄：1')
  await page.getByRole('button', { name: '匯入', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '匯入完成' })).toContainText('1 筆作答紀錄')
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"nope"}') })
  await expect(page.getByRole('alert').filter({ hasText: '無法匯入' })).toBeVisible()
})

const VIEWPORTS = [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 820, height: 1180 }, { width: 1280, height: 900 }]
const ROUTES = ['/', '/learn', '/learn/chord.open', '/lab/fretboard', '/lab/chords', '/lab/progressions', '/guitar', '/progress', '/settings']

test('no horizontal overflow on any route at representative viewports', async ({ browser }) => {
  test.setTimeout(240_000)
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport, isMobile: viewport.width < 700, hasTouch: viewport.width < 700 })
    const page = await context.newPage()
    for (const route of ROUTES) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForTimeout(150)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${route} @ ${viewport.width}`).toBe(true)
    }
    await context.close()
  }
})

test('session fretboard preserves proportions and hides open-string hints on a 320px phone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto('/learn/fret.naturals.low')
  await page.getByRole('button', { name: '自由練習 10 題' }).click()
  for (let i = 0; i < 10; i++) {
    if (await page.locator('.fret-cell.interactive').first().isVisible().catch(() => false)) break
    await answerCurrent(page)
  }
  const cell = page.locator('.fret-cell.interactive').first()
  await expect(cell).toBeVisible()
  const box = await cell.locator('rect').first().boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(40)
  expect(await page.locator('.shared-fretboard .svg-string-label').allTextContents()).toEqual(['6', '5', '4', '3', '2', '1'])
  const board = page.locator('.shared-fretboard svg')
  const ratio = await board.evaluate(element => { const box = element.getBoundingClientRect(); return box.width / box.height })
  await page.setViewportSize({ width: 320, height: 844 })
  const tallerRatio = await board.evaluate(element => { const box = element.getBoundingClientRect(); return box.width / box.height })
  expect(tallerRatio).toBeCloseTo(ratio, 3)
  await page.locator('.fret-cell.interactive[data-cell="6-5"]').tap()
  await expect(page.getByRole('status').filter({ hasText: /正確|還不對|部分正確/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '確定' })).toHaveCount(0)
  await context.close()
})
