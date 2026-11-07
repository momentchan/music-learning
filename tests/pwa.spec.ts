import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const manifest = JSON.parse(readFileSync(new URL('../public/audio/manifest.json', import.meta.url), 'utf8')) as { instruments: Record<'pluck' | 'keys', { file: string }[]> }

/** A reload is the expected outcome; retry reads whose execution context disappears. */
async function throughReload<T>(read: () => Promise<T>): Promise<T | null> {
  try { return await read() }
  catch (error) {
    if (error instanceof Error && error.message.includes('Execution context was destroyed')) return null
    throw error
  }
}

/** A real browser SW upgrade, with versioned scripts served over an isolated local origin. */
async function updateSite() {
  let version = 1
  const root = fileURLToPath(new URL('../dist/', import.meta.url))
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url!, 'http://localhost').pathname
    if (pathname === '/sw.js') {
      response.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' })
      response.end(`const version=${version};
        self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
        self.addEventListener('message', e => { if(e.data?.type==='SKIP_WAITING') self.skipWaiting(); });
        self.addEventListener('fetch', e => { if(new URL(e.request.url).pathname==='/__version') e.respondWith(new Response(String(version))); });`)
      return
    }
    const file = resolve(root, pathname === '/' ? 'index.html' : '.' + decodeURIComponent(pathname))
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403); response.end(); return }
    try {
      const extension = extname(file)
      const data = await readFile(extension ? file : resolve(root, 'index.html'))
      const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
      response.writeHead(200, { 'Content-Type': mime[extension || '.html'] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
      response.end(data)
    } catch { response.writeHead(404); response.end() }
  })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  const address = server.address() as { port: number }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    deploy: () => { version++ },
    close: async () => { server.closeAllConnections(); await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done())) },
  }
}

test('a deployed update applies automatically on home and keeps saved preferences', async ({ page }) => {
  const site = await updateSite()
  try {
    await page.addInitScript(() => sessionStorage.setItem('boots', String(Number(sessionStorage.getItem('boots') ?? 0) + 1)))
    await page.goto(site.origin)
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await page.goto(site.origin + '/settings')
    await page.getByLabel('每週目標天數').selectOption('5')
    await page.getByRole('button', { name: 'Guitar Lab 首頁' }).click()
    const boots = await page.evaluate(() => Number(sessionStorage.getItem('boots')))
    site.deploy()
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update() })
    await expect.poll(() => throughReload(() => page.evaluate(() => Number(sessionStorage.getItem('boots'))))).toBe(boots + 1)
    await expect.poll(() => throughReload(() => page.evaluate(async () => (await fetch('/__version')).text()))).toBe('2')
    await expect(page.getByRole('button', { name: '更新到新版本' })).toHaveCount(0)
    await page.getByRole('button', { name: '設定' }).click()
    await expect(page.getByLabel('每週目標天數')).toHaveValue('5')
  } finally { await page.close(); await site.close() }
})

test('an update activated by another tab waits for practice to finish or leave before reloading', async ({ page, context }) => {
  const site = await updateSite()
  try {
    await page.addInitScript(() => sessionStorage.setItem('boots', String(Number(sessionStorage.getItem('boots') ?? 0) + 1)))
    await page.goto(site.origin)
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    await page.getByRole('button', { name: /通勤練習.*點指板/ }).click()
    await page.getByLabel('這次練什麼').selectOption('notes')
    await page.getByRole('button', { name: '▶ 開始練習' }).click()
    await page.locator('.fret-cell.interactive').first().click()
    await expect(page.locator('.feedback strong')).toContainText('還不對')
    await page.getByRole('button', { name: '暫停', exact: true }).click()
    const boots = await page.evaluate(() => Number(sessionStorage.getItem('boots')))
    const question = await page.locator('.question-prompt').textContent()
    site.deploy()
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update() })
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.ready).waiting)
    expect(await page.evaluate(() => Number(sessionStorage.getItem('boots')))).toBe(boots)
    await expect(page.locator('.question-prompt')).toHaveText(question!)
    await expect(page.getByRole('button', { name: '更新到新版本' })).toHaveCount(0)
    const other = await context.newPage()
    await other.goto(site.origin)
    await expect.poll(() => throughReload(() => other.evaluate(async () => (await fetch('/__version')).text()))).toBe('2')
    await page.bringToFront()
    expect(await page.evaluate(() => Number(sessionStorage.getItem('boots')))).toBe(boots)
    await expect(page.locator('.feedback strong')).toContainText('還不對')
    await page.getByRole('button', { name: '離開練習（之後可以繼續）' }).click()
    await expect.poll(() => throughReload(() => page.evaluate(() => Number(sessionStorage.getItem('boots'))))).toBe(boots + 1)
    await page.getByRole('button', { name: '繼續 →', exact: true }).click()
    await expect(page.locator('.question-card [data-target-string="true"]')).toHaveAttribute('data-string', '5')
    const count = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('guitar-lab'); r.onsuccess = () => resolve(r.result) })
      const count = await new Promise<number>(resolve => { const r = db.transaction('attempts').objectStore('attempts').count(); r.onsuccess = () => resolve(r.result) })
      db.close(); return count
    })
    expect(count).toBe(1)
    await other.close()
  } finally { await page.close(); await site.close() }
})

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
