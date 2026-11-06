import { test, expect, type Page } from '@playwright/test'
import { positionsForNote } from '../src/music/fretboardQuiz'

async function swipePageUp(page: Page) {
  const board = (await page.locator('svg.fretboard').boundingBox())!
  const navigation = (await page.locator('.bottom-nav').boundingBox())!
  const controls = (await page.locator('.fretboard-controls').boundingBox())!
  const touch = await page.context().newCDPSession(page)
  const startY = Math.min(navigation.y - 30, board.y + board.height - 30)
  const endY = controls.y + controls.height + 30
  const x = board.x + board.width / 2
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY, id: 1 }] })
  for (let step = 1; step <= 8; step++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * step / 8, id: 1 }] })
  // Pause with the finger down to avoid a fling consuming the next tap.
  await page.waitForTimeout(150)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: endY, id: 1 }] })
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.evaluate(async () => {
    let previous = window.scrollY
    let stable = 0
    while (stable < 8) {
      await new Promise(requestAnimationFrame)
      const current = window.scrollY
      stable = Math.abs(current - previous) < 0.5 ? stable + 1 : 0
      previous = current
    }
  })
  await touch.detach()
}

test('fretboard note selection and silent mode', async ({ page }) => {
  await page.goto('/lab/fretboard')
  await expect(page.getByRole('heading', { name: 'Hear every position.' })).toBeVisible()
  await page.locator('svg.fretboard g[aria-label="String 1, fret 1, F4"]').click()
  await expect(page.getByText('String 1 · fret 1', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Turn silent mode on' }).click()
  await expect(page.getByRole('button', { name: 'Turn sound on' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Turn sound on' })).toBeVisible()
  await page.getByRole('tab', { name: '聽力' }).click()
  await expect(page.locator('.choice-grid button').first()).toBeDisabled()
})

test('progression and A/B controls can start and stop', async ({ page }) => {
  await page.goto('/lab/progressions')
  await page.getByRole('button', { name: 'Play progression' }).click()
  await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible()
  await page.getByRole('button', { name: /Stop/ }).click()
  await page.getByRole('tab', { name: 'A/B 比較' }).click()
  await page.getByRole('button', { name: 'Play A', exact: true }).click()
  await page.getByRole('button', { name: 'Play B', exact: true }).click()
  await expect(page.getByText('WHAT CHANGED')).toBeVisible()
})

test('ear question validates and persists after reload', async ({ page }) => {
  await page.goto('/lab/ear')
  await page.getByRole('button', { name: 'Play question' }).click()
  const choices = page.locator('.choice-grid button')
  await choices.first().click()
  await expect(page.getByRole('button', { name: 'Next question' })).toBeVisible()
  await page.reload()
  await expect(page.locator('.history > div')).toHaveCount(1)
})

test('phone preserves fretboard proportions and scrolls the whole page without selecting notes', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto('/lab/fretboard')
  await expect(page.locator('svg.fretboard > .svg-fret-label')).toHaveCount(12)
  await expect(page.getByRole('group', { name: 'Vertical six-string guitar fretboard, frets 1 to 12' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Fret range' })).toHaveCount(0)
  const board = page.locator('svg.fretboard')
  const viewport = page.locator('.fretboard-scroll')
  expect(await page.locator('.svg-string-label').allTextContents()).toEqual(['6', '5', '4', '3', '2', '1'])
  const widths = await page.locator('.svg-string-label').evaluateAll(labels => labels.map(label => Number(label.parentElement!.querySelector('line')!.getAttribute('stroke-width'))))
  expect(widths[0]).toBeGreaterThan(widths[5])
  const proportions = await board.evaluate(element => {
    const svg = element as SVGSVGElement
    const bounds = svg.getBoundingClientRect()
    return { displayed: bounds.width / bounds.height, original: svg.viewBox.baseVal.width / svg.viewBox.baseVal.height }
  })
  expect(proportions.displayed).toBeCloseTo(proportions.original, 3)
  expect(await viewport.evaluate(element => getComputedStyle(element).overflowY)).toBe('visible')
  await page.locator('svg.fretboard g[aria-label="String 6, fret 1, F2"]').tap()
  await expect(page.locator('.selected-note strong')).toHaveText('F2')
  await page.screenshot({ path: testInfo.outputPath('mobile-fretboard.png') })
  await swipePageUp(page)
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(80)
  expect(await viewport.evaluate(element => element.scrollTop)).toBe(0)
  await expect(page.locator('.selected-note strong')).toHaveText('F2')
  await page.locator('svg.fretboard g[aria-label="String 1, fret 11, D#5"]').tap()
  await expect(page.getByText('String 1 · fret 11', { exact: false })).toBeVisible()
  await page.locator('svg.fretboard g[aria-label="String 1, fret 12, E5"]').tap()
  await expect(page.getByText('String 1 · fret 12', { exact: false })).toBeVisible()
  expect(await page.locator('.fretboard-scroll').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('group', { name: 'Fretboard mode' }).getByRole('button', { name: 'One note' }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  expect(await page.evaluate(() => document.querySelector('.fretboard-controls')!.getBoundingClientRect().top >= 0)).toBe(true)
  await page.getByRole('group', { name: 'Fretboard mode' }).getByRole('button', { name: 'Random review' }).click()
  await expect(page.locator('.fretboard-quiz')).toBeInViewport()
  const mobileNote = await page.locator('.fretboard-quiz strong').evaluate(element => element.firstChild?.textContent || '')
  const mobileString = Number((await page.locator('.fretboard-quiz strong em').textContent())!.replace('string ', ''))
  const otherPosition = positionsForNote(mobileNote).find(position => position.string !== mobileString)!
  await page.locator(`svg.fretboard g[aria-label="String ${otherPosition.string}, fret ${otherPosition.fret}"]`).tap()
  await expect(page.getByRole('status')).toContainText(`Try string ${mobileString}`)
  await expect(page.locator('.fretboard-quiz')).toBeInViewport()
  await context.close()
})

test('swiping a quiz keeps its prompt visible and does not create an attempt', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 650 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto('/lab/fretboard')
  await page.getByRole('button', { name: 'One note', exact: true }).click()
  await swipePageUp(page)
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(80)
  await expect(page.locator('.fretboard-quiz')).toBeInViewport()
  await expect(page.getByRole('status')).toHaveText('Find it on every string')
  await expect(page.locator('.quiz-guidance')).toContainText('0 correct, 0 missed')
  await page.locator('svg.fretboard g[aria-label="String 6, fret 8"]').tap()
  await expect(page.getByText('1 / 6 found')).toBeVisible()
  await context.close()
})

test('one-note practice checks positions and keeps a local record', async ({ page }) => {
  await page.goto('/lab/fretboard')
  await page.getByRole('group', { name: 'Fretboard mode' }).getByRole('button', { name: 'One note' }).click()
  await expect(page.getByText('0 / 6 found')).toBeVisible()
  await page.locator('svg.fretboard g[aria-label="String 1, fret 1"]').click()
  await expect(page.getByRole('status')).toContainText('Find C')
  await page.locator('svg.fretboard g[aria-label="String 2, fret 1"]').click()
  await expect(page.getByText('1 / 6 found')).toBeVisible()
  await expect(page.getByText('Local record for C: 1 correct, 1 missed.')).toBeVisible()
  for (const [index, position] of positionsForNote('C').filter(position => !(position.string === 2 && position.fret === 1)).entries()) {
    await page.locator(`svg.fretboard g[aria-label="String ${position.string}, fret ${position.fret}"]`).click()
    await expect(page.getByText(`${index + 2} / 6 found`)).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Next note →' })).toBeVisible()
  await page.reload()
  await page.getByRole('group', { name: 'Fretboard mode' }).getByRole('button', { name: 'One note' }).click()
  await expect(page.getByText('Local record for C: 6 correct, 1 missed.')).toBeVisible()
})

test('random review requires the prompted string and records position-specific recall', async ({ page }) => {
  await page.goto('/lab/fretboard')
  await page.getByRole('group', { name: 'Fretboard mode' }).getByRole('button', { name: 'Random review' }).click()
  const target = await page.locator('.fretboard-quiz strong').evaluate(element => element.firstChild?.textContent || '')
  const targetString = Number((await page.locator('.fretboard-quiz strong em').textContent())!.replace('string ', ''))
  const positions = positionsForNote(target)
  const otherString = positions.find(position => position.string !== targetString)!
  const position = positions.find(position => position.string === targetString)!
  await page.locator(`svg.fretboard g[aria-label="String ${otherString.string}, fret ${otherString.fret}"]`).click()
  await expect(page.getByRole('status')).toContainText(`Try string ${targetString}`)
  await expect(page.getByRole('button', { name: 'Next →' })).toHaveCount(0)
  await page.locator(`svg.fretboard g[aria-label="String ${position.string}, fret ${position.fret}"]`).click()
  await expect(page.getByRole('button', { name: 'Next →' })).toBeVisible()
  await expect(page.getByText(`Local record for ${target} on string ${targetString}: 1 correct, 1 missed.`)).toBeVisible()
  const records = await page.evaluate(async targetString => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('guitar-lab'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const attempts = await new Promise<{ targetString: number; targetFret: number; assisted: boolean }[]>((resolve, reject) => { const request = database.transaction('attempts').objectStore('attempts').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    database.close()
    return attempts.filter(attempt => attempt.targetString === targetString)
  }, targetString)
  expect(records).toHaveLength(2)
  expect(records.map(record => [record.targetString, record.targetFret, record.assisted])).toEqual(expect.arrayContaining([[targetString, position.fret, false], [targetString, position.fret, true]]))
})

test('practice modes use a vertical fretboard on desktop with a layout toggle', async ({ page }) => {
  await page.goto('/lab/fretboard')
  await expect(page.getByRole('group', { name: 'Six-string guitar fretboard, frets 1 to 12' })).toBeVisible()
  await page.getByRole('group', { name: 'Fretboard mode' }).getByRole('button', { name: 'Random review' }).click()
  await expect(page.getByRole('group', { name: 'Vertical six-string guitar fretboard, frets 1 to 12' })).toBeVisible()
  await page.getByRole('group', { name: 'Practice layout' }).getByRole('button', { name: /Horizontal/ }).click()
  await expect(page.getByRole('group', { name: 'Six-string guitar fretboard, frets 1 to 12' })).toBeVisible()
  await page.reload()
  await page.getByRole('group', { name: 'Fretboard mode' }).getByRole('button', { name: 'One note' }).click()
  await expect(page.getByRole('group', { name: 'Six-string guitar fretboard, frets 1 to 12' })).toBeVisible()
  await page.getByRole('group', { name: 'Practice layout' }).getByRole('button', { name: /Vertical/ }).click()
  await expect(page.getByRole('group', { name: 'Vertical six-string guitar fretboard, frets 1 to 12' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
