import { useSyncExternalStore } from 'react'

/** Minimal History-API router. Real URLs support deep links and reloads (Cloudflare Pages serves index.html as SPA fallback). */
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => { listeners.delete(listener); window.removeEventListener('popstate', listener) }
}
const getPath = () => window.location.pathname

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (path === getPath()) return
  if (options.replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.scrollTo(0, 0)
  listeners.forEach(l => l())
}

export type Route =
  | { name: 'today' }
  | { name: 'learn' }
  | { name: 'node'; nodeId: string }
  | { name: 'session'; sessionId: string }
  | { name: 'lab'; tool: string }
  | { name: 'guitar' }
  | { name: 'progress' }
  | { name: 'settings' }
  | { name: 'not-found'; path: string }

export function parseRoute(path: string): Route {
  const parts = path.replace(/\/+$/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (!parts.length) return { name: 'today' }
  switch (parts[0]) {
    case 'learn': return parts[1] ? { name: 'node', nodeId: parts[1] } : { name: 'learn' }
    case 'session': return parts[1] ? { name: 'session', sessionId: parts[1] } : { name: 'today' }
    case 'lab': return { name: 'lab', tool: parts[1] ?? 'fretboard' }
    case 'guitar': return { name: 'guitar' }
    case 'progress': return { name: 'progress' }
    case 'settings': return { name: 'settings' }
    default: return { name: 'not-found', path }
  }
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, getPath, () => '/')
  return parseRoute(path)
}
