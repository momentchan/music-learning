import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function OfflineStatus({ canUpdate }: { canUpdate: boolean }) {
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const changed = () => { setOffline(!navigator.onLine); setVisible(!document.hidden) }
    window.addEventListener('online', changed); window.addEventListener('offline', changed)
    document.addEventListener('visibilitychange', changed)
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed); document.removeEventListener('visibilitychange', changed) }
  }, [])
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null)
  const [reloadPending, setReloadPending] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let alive = true
    let controlled = !!navigator.serviceWorker.controller
    const controllerChanged = () => {
      if (alive && controlled) setReloadPending(true)
      controlled = !!navigator.serviceWorker.controller
    }
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
    let lastCheck = 0
    const check = () => {
      if (!alive || document.hidden || !navigator.onLine || Date.now() - lastCheck < 5000) return
      lastCheck = Date.now()
      void navigator.serviceWorker.getRegistration().then(registration => {
        if (!alive || !registration) return
        if (registration.waiting) setUpdate(() => () => apply(true))
        return registration.update()
      }).catch(() => undefined)
    }
    const apply = registerSW({
      onOfflineReady() { if (alive) setReady(true) },
      onNeedRefresh() { if (alive) setUpdate(() => () => apply(true)) },
      // Another tab may activate the new worker; defer this tab's reload as well.
      onNeedReload() { if (alive) setReloadPending(true) },
      onRegisteredSW() { check() },
    })
    const timer = window.setInterval(check, 60_000)
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    // A previous installation can already be ready before this visit.
    void navigator.serviceWorker.ready.then(async registration => {
      if (!registration.active || !alive) return
      const banks = await caches.keys()
      const requests = (await Promise.all(banks.map(async key => (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname)))).flat()
      if (alive) setReady(requests.filter(p => p.endsWith('.mp3')).length >= 22)
    }).catch(() => undefined)
    return () => {
      alive = false
      window.clearInterval(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged)
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  useEffect(() => {
    if (!canUpdate || offline || !visible) return
    if (reloadPending) { window.location.reload(); return }
    if (update) {
      setUpdate(null)
      void update().catch(() => undefined)
    }
  }, [canUpdate, offline, visible, update, reloadPending])
  if (!import.meta.env.PROD || !offline) return null
  return <div className="offline-status" role="status">
    <span>{ready ? '離線' : '離線：部分內容尚未下載'}</span>
  </div>
}
