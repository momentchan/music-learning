# Guitar Lab — Audio Studio

A local-first React/Vite learning app for hearing guitar notes and music theory. The original repository was a Three.js starter; this implementation replaces its UI with an SVG fretboard and Tone.js audio studio.

## Run locally

```bash
npm ci
npm run dev
```

Checks:

```bash
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## What works

- SVG fretboard note selection for frets 1–12, with a horizontal desktop neck and a vertical mobile neck that fits on screen. Fret markers follow the 3, 5, 7, 9, and 12 pattern.
- One-note practice finds every position of a selected note. Random review asks for a note on a specific string, so every string and fret position can be recalled. It prioritizes missed, due, and unseen positions using local 1/3/7/14/30-day review intervals. A corrected miss returns after one minute. Answers, target and selected positions, response time, and correctness are stored locally; speed and skips never lower mastery.
- Chord, inversion, interval, arpeggio, and scale playback.
- Tempo-based progression sequencer with loop and metronome controls, voice-leading voicings, and synchronized chord highlight.
- A/B comparison library covering chord quality, resolution, and voice leading.
- Seven ear-training question types with replay, answer feedback, and IndexedDB attempt records.
- Persisted silent mode, instrument, volume, tempo, duration, and metronome settings.
- Offline PWA app shell. Both instruments are synthesized locally, with no runtime audio asset requests.

The guitar-style option uses Tone.js modeled-string synthesis; it is **not** a sampled electric guitar. Audio requires a user gesture and may pause when the browser backgrounds the page. Bluetooth latency and locked-screen playback are platform-dependent. Automated tests check controls and pitch data but cannot establish how the instruments sound to a listener; manual listening on iOS Safari and Android Chrome remains necessary.

The broader twelve-domain curriculum in [GUITAR_LAB_SPEC.md](GUITAR_LAB_SPEC.md) is a product specification, not a claim that all domains are implemented here. The current application focuses on the requested audio learning flows.

## Deployment

Cloudflare Pages builds the GitHub repository with `npm run build`, output directory `dist`, production branch `main`. The Git-connected site is [music-learning-52z.pages.dev](https://music-learning-52z.pages.dev/); future pushes deploy automatically.
