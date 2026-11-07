/** Requires a new attack after silence and a stable pitch over time, rather than frame counts. */
export class NoteGate {
  private quietAt: number | null = null
  private armed = false
  private readings: { pitch: number; hz: number; at: number }[] = []
  reset(requireRelease = true) { this.quietAt = null; this.armed = !requireRelease; this.readings = [] }
  get waitingForRelease() { return !this.armed }
  sample(hz: number | null, at: number) {
    if (hz === null) {
      this.readings = []
      this.quietAt ??= at
      if (at - this.quietAt >= 150) this.armed = true
      return null
    }
    this.quietAt = null
    if (!this.armed) return null
    const pitch = 69 + 12 * Math.log2(hz / 440)
    if (pitch < 39.5 || pitch > 88.5) { this.readings = []; return null }
    const last = this.readings.at(-1)
    if (last && Math.abs(last.pitch - pitch) > 0.45) this.readings = []
    this.readings.push({ pitch, hz, at })
    this.readings = this.readings.filter(r => at - r.at <= 350)
    if (this.readings.length < 3 || at - this.readings[0].at < 100) return null
    const pitches = this.readings.map(r => r.pitch).sort((a, b) => a - b)
    if (pitches.at(-1)! - pitches[0] > 0.45) { this.readings = []; return null }
    const median = pitches[Math.floor(pitches.length / 2)]
    const midi = Math.round(median)
    if (Math.abs(median - midi) > 0.45) return null
    this.armed = false
    this.readings = []
    return { midi, hz: 440 * 2 ** ((median - 69) / 12), cents: (median - midi) * 100 }
  }
}
