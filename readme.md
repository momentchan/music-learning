# Guitar Lab

A mobile-first, local-first guitar learning app (React + TypeScript + Vite + SVG + Tone.js + Dexie). Practice theory on your phone during the commute, then take each lesson to the guitar. The product specification is [GUITAR_LAB_SPEC.md](GUITAR_LAB_SPEC.md) (v2). This README lists only what actually works.

## Run locally

```bash
npm ci
npm run dev
```

Checks:

```bash
npm run typecheck
npm test                      # Vitest: theory, exercises, scheduler, storage/migrations/backups
npx playwright install chromium
npm run test:e2e              # Playwright: lab tools, lessons, resume, backups, viewports
npm run build
```

## Status (Phase A of the spec roadmap)

### Functional
- **Today screen:** one Start practice button. The phone session keeps offering fretboard taps until the learner leaves, with due reviews first and a few scale-degree questions mixed in. The guitar task is queued for later. Recommendations include reasons, the weekly goal has no streak penalty, and weak items are listed.
- **Learn screen:** a three-tier skill graph and six pathways. The default ★ Start Here is for someone who already accompanies with barre chords: notes on every string, accidentals, interval shapes, the major scale, diatonic chords, then function. Open strings, open-chord shapes, and basic strumming sit on an optional review path. Octave-shape drills are not scheduled. Daily questions are answered on the fretboard. Availability labels stay honest, and any node can still be opened freely.
- **Lessons:** each lesson follows Learn → Recall → Locate → Hear → Apply → Play (bridge task). All 16 Tier 1 nodes that have exercises are available:
  - open strings
  - chord diagrams
  - open chords
  - pulse
  - strumming
  - notes on strings 6 & 5
  - notes on all strings
  - accidentals
  - octave shapes
  - interval shapes
  - intervals
  - triads
  - the major scale
  - keys & diatonic chords
  - progressions & function
  - ear basics
- **Exercises:** questions are seeded and serializable, and pure validators grade them against the stored question. Feedback names the specific mistake:
  - off by one fret
  - wrong string or wrong octave
  - the G–B string offset
  - spelling-only partial credit
  - interval quality vs. interval size
  - strum direction

  Every exercise has retry, why and next. A wrong answer also schedules an in-session recheck.
- **Answer types:** fretboard tap, with keyboard arrows and Enter; spelled-note picker; pitch picker; multiple choice; strum/rhythm pad with latency calibration; audio questions (skipped without penalty when sound is off).
- **Review:** one Leitner scheduler for every review item, with intervals of 1/3/7/14/30 days, a short recheck after misses or hints, and cramming protection. Mastery states run New → Learning → Familiar → Fluent, and Played status is tracked separately.
- **Fretboard:** a shared SVG fretboard covering frets 0–12, vertical by default (thick string 6 on the left), with an optional horizontal layout and a left-handed mirror. String labels show numbers without open-string note hints. Mobile layouts retain their proportions and scroll with the whole page; swipes do not answer questions. A chord-diagram component is backed by a shape library that the tests check.
- **Progress screen:** node states with evidence counts, a 72-cell string × note map, weak items (≥ 3 samples), pathway progress, and session history.
- **Guitar screen:** a queue of bridge tasks completed by self-assessment. Self-reports mark a node as "played" but never raise recall mastery.
- **Storage:**
  - Dexie v4 with transactional attempt + schedule + session writes.
  - The migration from the previous v3 database keeps all history.
  - Sessions resume after interruption and are marked abandoned after 12 h.
  - Unsaved answers are kept in memory, with retry and export.
  - Versioned JSON export/import is validated, with merge or replace and an automatic pre-import backup.
  - Persistent storage is requested and its status is shown.
- **Lab (existing tools, kept):**
  - fretboard explorer and quiz
  - chord library
  - chord, interval and scale playback
  - progression sequencer
  - A/B comparisons
  - audio ear training

### Planned (labelled in the app, not functional)
- **Phase B:** microphone tuner, play-the-note pitch checks, chord-change timer, strumming with metronome at the guitar.
- **Phases C–D:** Tier 2 and Tier 3 nodes (barre/CAGED, modes, cadences, secondary dominants, improvisation, composition), circle of fifths, pentatonic positions.

### Known limitations
- The Lab fretboard quiz covers frets 1–12. On phones, the entire neck fits above the navigation in Explore, One note and Random review without scrolling. Fret spacing adapts to the available height; text and circular markers keep their proportions. Guided sessions use 0–12.
- Rhythm timing on phones is approximate even after calibration.
- Only standard tuning is used in exercises.
- The UI is zh-TW. The shared strings sit in a catalog (`src/i18n`), but some screen copy and the Lab tools are not yet translated.
- Guitar and piano use 22 locally hosted recordings (about 1.44 MB total), loaded on demand and precached for offline use. Credits and CC BY 3.0 license: [public/audio/ATTRIBUTION.md](public/audio/ATTRIBUTION.md). Rebuild the pinned assets with `python scripts/prepare-samples.py` (requires ffmpeg). These compact banks use one dynamic layer and pitch interpolation, rather than separate recordings for every string and playing technique.
- Audio and mobile behaviour still need manual checks on iOS Safari and Android Chrome. `npm run test:pwa` verifies the production service worker caches the recording banks and both instruments play after an offline reload.
- The offline service worker only runs in production builds.

## Deployment

Cloudflare Pages builds the GitHub repository with `npm run build`, output directory `dist`, production branch `main`. The site is [music-learning-52z.pages.dev](https://music-learning-52z.pages.dev/). Deep links work through Pages' SPA fallback (there is no `404.html`). Pushes to `main` deploy automatically.
