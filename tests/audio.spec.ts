import { test, expect } from '@playwright/test'
import { positionsForNote } from '../src/music/fretboardQuiz'

test('reference fretboard selects a note without recording a graded attempt', async ({ page }) => {
  await page.goto('/lab/fretboard')
  await expect(page.getByRole('heading', { name: '指板查詢' })).toBeVisible()
  await expect(page.locator('.svg-string-label')).toHaveText(['1','2','3','4','5','6'])
  await expect(page.getByRole('button', { name: /One note|Random review/ })).toHaveCount(0)
  await page.locator('svg.fretboard g[aria-label="String 1, fret 1, F4"]').click()
  await expect(page.locator('.selected-note strong')).toHaveText('F4')
  const count = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('guitar-lab'); r.onsuccess = () => resolve(r.result) })
    const n = await new Promise<number>(resolve => { const r = db.transaction('attempts').objectStore('attempts').count(); r.onsuccess = () => resolve(r.result) }); db.close(); return n
  })
  expect(count).toBe(0)
  await page.getByRole('button', { name: 'Turn silent mode on' }).click()
  await page.goto('/practice/ear')
  await expect(page.locator('.choice-grid button').first()).toBeDisabled()
})

test('progression and comparison tools can start and stop', async ({ page }) => {
  await page.goto('/lab/progressions')
  await page.getByRole('button', { name: '播放進行' }).click()
  await expect(page.getByRole('button', { name: '重新播放' })).toBeVisible()
  await page.getByRole('button', { name: /停止/ }).click()
  await page.getByRole('tab', { name: '比較試聽' }).click()
  await page.getByRole('button', { name: '播放 A', exact: true }).click()
  await page.getByRole('button', { name: '播放 B', exact: true }).click()
  await expect(page.getByText('差異')).toBeVisible()
})

test('ear exercise is a practice route, validates and persists after reload', async ({ page }) => {
  await page.goto('/lab/ear') // old deep link remains valid
  await expect(page.locator('.bottom-nav button[aria-current="page"]')).toHaveText('練習')
  await page.getByRole('button', { name: '播放題目' }).click()
  await page.locator('.choice-grid button').first().click()
  await expect(page.getByRole('button', { name: '下一題' })).toBeVisible()
  await page.reload()
  const count = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('guitar-lab'); r.onsuccess = () => resolve(r.result) })
    const n = await new Promise<number>(resolve => { const r = db.transaction('attempts').objectStore('attempts').count(); r.onsuccess = () => resolve(r.result) }); db.close(); return n
  })
  expect(count).toBe(1)
})

for (const size of [{ width: 320, height: 568 }, { width: 390, height: 650 }, { width: 430, height: 932 }]) {
  test(`phone ${size.width}x${size.height} keeps reference and all-position practice usable`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await page.goto('/lab/fretboard')
    const board = page.locator('svg.fretboard')
    expect(await page.locator('.svg-string-label').allTextContents()).toEqual(['6','5','4','3','2','1'])
    await expect(board.locator(':scope > .svg-fret-label')).toHaveCount(12)
    await board.locator('g[aria-label="String 6, fret 1, F2"]').tap()
    await expect(page.locator('.selected-note strong')).toHaveText('F2')
    await page.getByRole('button', { name: '顯示音名', exact: true }).click()
    await expect(board.locator('.svg-note')).toHaveCount(72)
    await page.goto('/practice/positions')
    await page.getByLabel('練習音名').selectOption('E')
    for (const [index, p] of positionsForNote('E').entries()) {
      await page.locator(`svg.fretboard g[aria-label="String ${p.string}, fret ${p.fret}"]`).tap()
      await expect(page.locator('.fretboard-quiz em')).toHaveText(`${index + 1} / 6`)
    }
    await expect(page.getByRole('button', { name: '下一個音 →' })).toBeVisible()
    const scale = await page.locator('svg.fretboard').evaluate(el => { const m = (el as SVGSVGElement).getScreenCTM()!; return [m.a, m.d] })
    expect(scale[0]).toBeCloseTo(scale[1], 3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath('all-positions-phone.png'), fullPage: true })
    await context.close()
  })
}

test('all-position practice has one task, checks answers and keeps its own history', async ({ page }) => {
  await page.goto('/practice/positions')
  await page.locator('svg.fretboard g[aria-label="String 1, fret 1"]').click()
  await expect(page.getByRole('status')).toContainText('請找 C')
  for (const p of positionsForNote('C')) await page.locator(`svg.fretboard g[aria-label="String ${p.string}, fret ${p.fret}"]`).click()
  await expect(page.getByRole('button', { name: '下一個音 →' })).toBeVisible()
  await expect(page.getByText('6 次正確 · 1 次待加強')).toBeVisible()
  await page.reload()
  await expect(page.getByText('6 次正確 · 1 次待加強')).toBeVisible()
})
