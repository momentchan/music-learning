let shared: AudioContext | null = null

/** One context for the whole visit, resumed from the click that turns listening on. */
export function listeningContext(): AudioContext {
  if (!shared || shared.state === 'closed') shared = new AudioContext()
  return shared
}

export function resumeListening(): void {
  const context = listeningContext()
  if (context.state !== 'running') void context.resume()
}
