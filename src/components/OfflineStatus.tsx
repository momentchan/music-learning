import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function OfflineStatus({ inSession }: { inSession: boolean }) {
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const changed = () => setOffline(!navigator.onLine)
    window.addEventListener('online', changed); window.addEventListener('offline', changed)
    return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed) }
  }, [])
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null)
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let alive = true
    const apply = registerSW({
      onOfflineReady() { if (alive) setReady(true) },
      onNeedRefresh() { if (alive) setUpdate(() => () => apply(true)) },
    })
    // A previous installation can already be ready before this visit.
    void navigator.serviceWorker.ready.then(async registration => {
      if (!registration.active || !alive) return
      const banks = await caches.keys()
      const requests = (await Promise.all(banks.map(async key => (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname)))).flat()
      if (alive) setReady(requests.filter(p => p.endsWith('.mp3')).length >= 22)
    }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  if (!import.meta.env.PROD || (!offline && (!update || inSession))) return null
  return <div className="offline-status" role="status">
    {offline && <span>{ready ? '離線' : '離線：部分內容尚未下載'}</span>}
    {update && (inSession ? <span>有新版本，結束練習後可更新。</span> : <button className="text-button" onClick={() => void update()}>更新到新版本</button>)}
  </div>
}
