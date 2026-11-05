import * as Tone from 'tone'
import { chordVoicing, intervalNotes, midiToFrequency, planProgression, scaleNotes, type ChordStyle, type Instrument, type IntervalMode, type ProgressionChord, type ScaleName } from '../music/theory'

export interface AudioOptions { enabled: boolean; silent: boolean; volume: number; instrument: Instrument; tempo: number; noteDuration: number; metronome: boolean }
export const DEFAULT_AUDIO: AudioOptions = { enabled: true, silent: false, volume: 0.65, instrument: 'pluck', tempo: 100, noteDuration: 0.45, metronome: false }

export class AudioEngine {
  private pluck: Tone.PluckSynth[] = []
  private pluckIndex = 0
  private keys?: Tone.PolySynth<Tone.Synth>
  private click?: Tone.Synth
  private gain?: Tone.Gain
  private limiter?: Tone.Limiter
  private active = false
  private options: AudioOptions = DEFAULT_AUDIO
  private playbackToken = 0

  setOptions(options: AudioOptions) {
    this.options = options
    if (this.gain) this.gain.gain.rampTo(options.enabled && !options.silent ? options.volume * 0.55 : 0, 0.03)
    if (!options.enabled || options.silent) this.stop()
  }
  get isReady() { return this.active }
  async activate(): Promise<boolean> {
    if (!this.options.enabled || this.options.silent) return false
    await Tone.start() // caller must invoke from a user gesture
    if (!this.gain) {
      this.limiter = new Tone.Limiter(-2).toDestination()
      this.gain = new Tone.Gain(this.options.volume * 0.55).connect(this.limiter)
      this.pluck = Array.from({ length: 16 }, () => new Tone.PluckSynth({ attackNoise: 0.7, dampening: 3500, resonance: 0.8, release: 0.2 }).connect(this.gain!))
      this.keys = new Tone.PolySynth({ voice: Tone.Synth, maxPolyphony: 12, options: {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.008, decay: 0.18, sustain: 0.35, release: 0.25 },
      } }).connect(this.gain)
      this.click = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.02 } }).connect(this.gain)
    }
    this.active = Tone.getContext().state === 'running'
    return this.active
  }
  private audible() { return this.options.enabled && !this.options.silent && this.active }
  private strike(notes: number[], duration: number, time: number) {
    if (!this.audible()) return
    const freqs = notes.map(midiToFrequency)
    if (this.options.instrument === 'pluck') {
      freqs.forEach(freq => {
        const voice = this.pluck[this.pluckIndex++ % this.pluck.length]
        voice.volume.value = -4 - 10 * Math.log10(notes.length)
        voice.triggerAttack(freq, time)
        voice.triggerRelease(time + Math.max(0.06, duration))
      })
    } else this.keys!.triggerAttackRelease(freqs, Math.max(0.06, duration), time, Math.min(0.8, 0.55 / Math.sqrt(notes.length)))
  }
  async playNote(midi: number) {
    if (!await this.activate()) return
    this.stop(); this.strike([midi], this.options.noteDuration, Tone.now())
  }
  async playInterval(root: number, semitones: number, mode: IntervalMode) {
    const notes = intervalNotes(root, semitones, mode)
    await this.playSequence(mode === 'harmonic' ? [{ notes, duration: this.options.noteDuration * 1.6 }] : notes.map(midi => ({ notes: [midi], duration: this.options.noteDuration + 0.12 })))
  }
  async playScale(root: number, scale: ScaleName) {
    await this.playSequence(scaleNotes(root, scale).map(midi => ({ notes: [midi], duration: this.options.noteDuration * 0.8 })))
  }
  async playChord(symbol: string, style: ChordStyle = 'block', inversion = 0) {
    if (!await this.activate()) return
    const notes = chordVoicing(symbol, inversion)
    if (style === 'block') { this.stop(); this.strike(notes, this.options.noteDuration * 2, Tone.now()) }
    else await this.playSequence((style === 'down' ? [...notes].reverse() : notes).map(midi => ({ notes: [midi], duration: 0.18 })))
  }
  async playProgression(chords: ProgressionChord[], config: { bpm?: number; timeSignature?: number; loop?: boolean; metronome?: boolean; onChord?: (index: number) => void; onStop?: () => void } = {}) {
    if (!chords.length || !await this.activate()) return
    this.stop()
    const bpm = config.bpm ?? this.options.tempo
    const plan = planProgression(chords, bpm)
    const total = plan.at(-1)!.at + plan.at(-1)!.duration
    const transport = Tone.getTransport()
    transport.bpm.value = bpm
    transport.timeSignature = config.timeSignature ?? 4
    transport.loop = !!config.loop
    transport.loopStart = 0
    transport.loopEnd = total
    const token = ++this.playbackToken
    for (const event of plan) {
      transport.schedule(time => {
        this.strike(event.notes, event.duration * 0.86, time)
        Tone.getDraw().schedule(() => { if (token === this.playbackToken) config.onChord?.(event.index) }, time)
      }, event.at)
    }
    if (config.metronome ?? this.options.metronome) {
      for (let beat = 0; beat * 60 / bpm < total - 0.001; beat++) {
        const at = beat * 60 / bpm
        transport.schedule(time => { if (this.audible()) this.click!.triggerAttackRelease(beat % (config.timeSignature ?? 4) === 0 ? 880 : 660, 0.04, time, 0.2) }, at)
      }
    }
    if (!config.loop) transport.scheduleOnce(time => Tone.getDraw().schedule(() => {
      if (token === this.playbackToken) { this.stop(); config.onStop?.() }
    }, time), total + 0.04)
    transport.start('+0.06')
  }
  async playSequence(events: { notes: number[]; duration: number }[], onStop?: () => void) {
    if (!events.length || !await this.activate()) return
    this.stop(); const transport = Tone.getTransport(); const token = ++this.playbackToken
    let at = 0
    for (const event of events) {
      const start = at
      transport.schedule(time => this.strike(event.notes, event.duration * 0.82, time), start)
      at += event.duration
    }
    transport.scheduleOnce(time => Tone.getDraw().schedule(() => { if (token === this.playbackToken) { this.stop(); onStop?.() } }, time), at + 0.04)
    transport.start('+0.06')
  }
  stop() {
    this.playbackToken++
    const transport = Tone.getTransport()
    transport.stop(); transport.cancel(0); transport.loop = false
    this.pluck.forEach(voice => voice.triggerRelease()); this.keys?.releaseAll(); this.click?.triggerRelease()
  }
  dispose() {
    this.stop(); this.pluck.forEach(voice => voice.dispose()); this.keys?.dispose(); this.click?.dispose(); this.gain?.dispose(); this.limiter?.dispose()
    this.pluck = []; this.keys = undefined; this.click = undefined; this.gain = undefined; this.limiter = undefined; this.active = false
  }
}

export const audioEngine = new AudioEngine()
