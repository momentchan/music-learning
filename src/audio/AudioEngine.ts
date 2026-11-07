import * as Tone from 'tone'
import { chordVoicing, intervalNotes, midiToFrequency, planProgression, scaleNotes, type ChordStyle, type Instrument, type IntervalMode, type ProgressionChord, type ScaleName } from '../music/theory'
import { loadSampleBuffers } from './samples'

export interface AudioOptions { enabled: boolean; silent: boolean; volume: number; instrument: Instrument; tempo: number; noteDuration: number; metronome: boolean }
export const DEFAULT_AUDIO: AudioOptions = { enabled: true, silent: false, volume: 0.65, instrument: 'pluck', tempo: 100, noteDuration: 0.8, metronome: false }

export class AudioEngine {
  private samplers = new Map<Instrument, Tone.Sampler>()
  private sampleLoads = new Map<Instrument, { promise: Promise<Tone.Sampler>; controller: AbortController }>()
  private loadGeneration = 0
  private gain?: Tone.Gain
  private limiter?: Tone.Limiter
  private active = false
  private options: AudioOptions = DEFAULT_AUDIO
  private playbackToken = 0

  setOptions(options: AudioOptions) {
    const instrumentChanged = this.options.instrument !== options.instrument
    this.options = options
    if (this.gain) this.gain.gain.rampTo(options.enabled && !options.silent ? options.volume * 0.55 : 0, 0.03)
    if (!options.enabled || options.silent || instrumentChanged) this.stop()
  }
  get isReady() { return this.active && this.samplers.has(this.options.instrument) }
  async activate(): Promise<boolean> {
    if (!this.options.enabled || this.options.silent) return false
    const instrument = this.options.instrument
    await Tone.start() // caller must invoke from a user gesture
    if (!this.gain) {
      this.limiter = new Tone.Limiter(-2).toDestination()
      this.gain = new Tone.Gain(this.options.volume * 0.55).connect(this.limiter)
    }
    this.active = Tone.getContext().state === 'running'
    if (this.active) await this.loadSampler(instrument)
    return this.audible() && (instrument === this.options.instrument)
  }
  private loadSampler(instrument: Instrument): Promise<Tone.Sampler> {
    const sampler = this.samplers.get(instrument)
    if (sampler) return Promise.resolve(sampler)
    const pending = this.sampleLoads.get(instrument)
    if (pending) return pending.promise
    const controller = new AbortController()
    const generation = this.loadGeneration
    const promise = (async () => {
      const timeout = setTimeout(() => controller.abort(), 15_000)
      try {
        const buffers = await loadSampleBuffers(instrument, data => Tone.getContext().decodeAudioData(data), controller.signal)
        if (controller.signal.aborted || generation !== this.loadGeneration || !this.gain) throw new Error('Audio loading cancelled')
        const voice = new Tone.Sampler({ urls: buffers, attack: 0.002, release: 0.35, curve: 'exponential' }).connect(this.gain)
        this.samplers.set(instrument, voice)
        return voice
      } catch {
        throw new Error('音色載入失敗。請檢查連線後再點一次；離線使用前請先連線完成音色快取。')
      } finally {
        clearTimeout(timeout)
        controller.abort()
        if (this.sampleLoads.get(instrument)?.controller === controller) this.sampleLoads.delete(instrument)
      }
    })()
    this.sampleLoads.set(instrument, { promise, controller })
    return promise
  }
  /** Claim ownership before loading, so Stop, mute, navigation or a newer tap wins. */
  private async beginPlayback(): Promise<number | null> {
    this.stop()
    const token = this.playbackToken
    try {
      if (!await this.activate() || token !== this.playbackToken) return null
    } catch (error) {
      if (token !== this.playbackToken) return null
      throw error
    }
    return token
  }
  private audible() { return this.options.enabled && !this.options.silent && this.active }
  private strike(notes: number[], duration: number, time: number, velocity = 0.8) {
    if (!this.audible()) return
    const freqs = notes.map(midiToFrequency)
    this.samplers.get(this.options.instrument)?.triggerAttackRelease(freqs, Math.max(0.06, duration), time, velocity / Math.sqrt(Math.max(1, notes.length)))
  }
  async playNote(midi: number) {
    if (await this.beginPlayback() === null) return
    this.strike([midi], this.options.noteDuration, Tone.now())
  }
  async playInterval(root: number, semitones: number, mode: IntervalMode) {
    const notes = intervalNotes(root, semitones, mode)
    await this.playSequence(mode === 'harmonic' ? [{ notes, duration: this.options.noteDuration * 1.6 }] : notes.map(midi => ({ notes: [midi], duration: this.options.noteDuration + 0.12 })))
  }
  async playScale(root: number, scale: ScaleName) {
    await this.playSequence(scaleNotes(root, scale).map(midi => ({ notes: [midi], duration: this.options.noteDuration * 0.8 })))
  }
  async playChord(symbol: string, style: ChordStyle = 'block', inversion = 0) {
    const notes = chordVoicing(symbol, inversion)
    if (style !== 'block') {
      await this.playSequence((style === 'down' ? [...notes].reverse() : notes).map(midi => ({ notes: [midi], duration: 0.18 })), undefined, true)
      return
    }
    if (await this.beginPlayback() === null) return
    this.strike(notes, this.options.noteDuration * 2, Tone.now())
  }
  async playProgression(chords: ProgressionChord[], config: { bpm?: number; timeSignature?: number; loop?: boolean; metronome?: boolean; onChord?: (index: number) => void; onStop?: () => void } = {}) {
    if (!chords.length) return
    const bpm = config.bpm ?? this.options.tempo
    const plan = planProgression(chords, bpm)
    const token = await this.beginPlayback()
    if (token === null) return
    const total = plan.at(-1)!.at + plan.at(-1)!.duration
    const transport = Tone.getTransport()
    transport.bpm.value = bpm
    transport.timeSignature = config.timeSignature ?? 4
    transport.loop = !!config.loop
    transport.loopStart = 0
    transport.loopEnd = total
    for (const event of plan) {
      transport.schedule(time => {
        this.strike(event.notes, event.duration * 0.86, time)
        Tone.getDraw().schedule(() => { if (token === this.playbackToken) config.onChord?.(event.index) }, time)
      }, event.at)
    }
    if (config.metronome ?? this.options.metronome) {
      for (let beat = 0; beat * 60 / bpm < total - 0.001; beat++) {
        const at = beat * 60 / bpm
        transport.schedule(time => { if (this.audible()) this.strike([beat % (config.timeSignature ?? 4) === 0 ? 76 : 72], 0.06, time, 0.25) }, at)
      }
    }
    if (!config.loop) transport.scheduleOnce(time => Tone.getDraw().schedule(() => {
      if (token === this.playbackToken) { this.stop(); config.onStop?.() }
    }, time), total + 0.4)
    transport.start('+0.06')
  }
  async playSequence(events: { notes: number[]; duration: number }[], onStop?: () => void, letRing = false) {
    if (!events.length) return
    const token = await this.beginPlayback()
    if (token === null) return
    const transport = Tone.getTransport()
    const total = events.reduce((sum, event) => sum + event.duration, 0)
    let at = 0
    for (const event of events) {
      const start = at
      const hold = letRing ? total - start + this.options.noteDuration : event.duration * 0.82
      transport.schedule(time => this.strike(event.notes, hold, time), start)
      at += event.duration
    }
    transport.scheduleOnce(time => Tone.getDraw().schedule(() => { if (token === this.playbackToken) { this.stop(); onStop?.() } }, time), at + (letRing ? this.options.noteDuration : 0) + 0.4)
    transport.start('+0.06')
  }
  /**
   * Schedules `count` metronome clicks. Returns the estimated performance.now() time of the first click,
   * or null when audio is unavailable (callers then fall back to a visual-only pulse).
   * Device output latency varies, so rhythm grading must also apply the learner's calibration offset.
   */
  async playClicks(count: number, bpm: number, accentEvery = 4): Promise<number | null> {
    const token = await this.beginPlayback()
    if (token === null) return null
    const transport = Tone.getTransport()
    const beat = 60 / bpm
    for (let i = 0; i < count; i++) {
      transport.schedule(time => { if (this.audible()) this.strike([i % accentEvery === 0 ? 76 : 72], 0.06, time, 0.35) }, i * beat)
    }
    transport.scheduleOnce(time => Tone.getDraw().schedule(() => { if (token === this.playbackToken) this.stop() }, time), count * beat + 0.1)
    const lead = 0.12
    transport.start(`+${lead}`)
    const raw = Tone.getContext().rawContext as AudioContext
    const outputLatency = (raw.outputLatency || 0) + (raw.baseLatency || 0)
    return performance.now() + (lead + outputLatency) * 1000
  }
  stop() {
    this.playbackToken++
    const transport = Tone.getTransport()
    transport.stop(); transport.cancel(0); transport.loop = false
    this.samplers.forEach(voice => voice.releaseAll())
  }
  dispose() {
    this.stop(); this.loadGeneration++
    this.sampleLoads.forEach(load => load.controller.abort()); this.sampleLoads.clear()
    this.samplers.forEach(voice => voice.dispose()); this.samplers.clear()
    this.gain?.dispose(); this.limiter?.dispose()
    this.gain = undefined; this.limiter = undefined; this.active = false
  }
}

export const audioEngine = new AudioEngine()
