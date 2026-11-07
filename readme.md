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

## Navigation and microphone update

There are four primary destinations:

- **練習**: the single place for graded work. Choose **通勤練習** for tapping or **彈吉他** for microphone answers, then select finding notes, naming notes, intervals or chord tones. Ear exercises and finding every position of one note live here too. Rhythm/chord-change practice is under this page.
- **課程**: explanations and a suggested learning sequence. General practice starts directly; it no longer repeats lesson introductions. The complete catalog and lesson preview are collapsed until requested.
- **工具**: ungraded fretboard/chord lookup, sound comparisons, progression editing and tuning. Clicking the reference neck does not produce a graded attempt. There is no second quiz menu here.
- **進度**: learning history, mastery, actual position coverage and weak items.

The old `/guitar` link opens the same practice hub in guitar mode; `/lab/ear` remains an alias for ear practice. Saved attempts and sessions remain available.

Microphone input now shows an independent volume meter and detected note. Starting guitar practice automatically uses microphone input for supported questions; there is no second input-method menu. The first explicitly enabled note can be graded without first waiting for silence. Between answers, release the previous note before replaying. Quiet-input detection was lowered from RMS 0.02 to 0.0015, while periodicity confidence and pitch stability still guard grading. Permission errors and low input levels are visible, with restart and device selection when multiple actual microphones exist. These changes are tested with quiet synthetic streams; real built-in microphone performance still requires the user to play and check the meter.

## Current release: pocket practice and at-the-guitar practice

Choose **通勤練習** or **拿起吉他**, then pick note locations, note naming, adjacent-string intervals, or chord tones. On the phone, answer on a large local fret window; on the computer, use the full player-view neck. Context is suggested by screen size only on first use and stays under your control.

Choose **彈吉他**, start practice, then explicitly press **開始收音**. A question that specifies a played position checks its exact pitch, including the octave. The app cannot infer the string/fret from that sound: confirm the physical position yourself. Naming questions still require a note name. Microphone results are stored separately and never promote position or naming recall.

Controls: Space pauses/resumes, Enter advances after feedback, and R retries. Controls with keyboard focus retain their normal keys. Correct answers may advance automatically; incorrect answers wait for review. Settings offer fully manual advance. **結束這次** saves a summary; leaving keeps the session available to resume.

For phone → computer handoff, export from the session summary or Settings, transfer the JSON file, and use **設定 → 合併匯入** on the other device. This is a manual transfer, not automatic sync. Merge deduplicates attempts, carries forward completed sessions/tasks and keeps a pre-import backup; microphone input is not enabled by importing and device latency calibration stays local.

Implementation notes and remaining manual checks: [PRACTICE_IMPLEMENTATION.md](PRACTICE_IMPLEMENTATION.md). The design brief and execution prompt remain [GUITAR_LAB_IMPROVEMENT_PROMPT.md](GUITAR_LAB_IMPROVEMENT_PROMPT.md).

## Functional status

### Functional
- **Today screen:** one Start practice button. Continuous sessions keep offering the selected practice topic until the learner leaves, with compatible due reviews first. Scale degrees are a separate lesson, not mixed into those taps. The guitar task is queued for later. Recommendations include reasons, the weekly goal has no streak penalty, and weak items are listed.
- **Learn screen:** a three-tier skill graph and six pathways. The default ★ Start Here is for someone who already accompanies with barre chords: notes on every string, accidentals, interval shapes, the major scale, diatonic chords, then function. Open strings, open-chord shapes, and basic strumming sit on an optional review path. Octave-shape drills are not scheduled. Daily questions are answered on the fretboard. Availability labels stay honest, and any node can still be opened freely.
- **Lessons:** lessons combine explanation, location, recall, supported audio/application exercises, and a bridge task; note lessons include both finding and naming. All 16 Tier 1 nodes that have exercises are available:
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
- **Fretboard:** a shared SVG fretboard used by lessons, practice, progress and Lab, with player, textbook and TAB projections and coordinate-based left-handed layouts. Main practice uses the player view: string 1 (thin/high E) at the top and string 6 (thick/low E) at the bottom; the nut points left for right-handed players and right for left-handed players. String labels show numbers without open-string note hints. Portrait practice uses large local fret windows plus an optional overview; full-neck exploration remains available. Layouts preserve proportions; swipes do not answer questions. A chord-diagram component is backed by a shape library that the tests check.
- **Progress screen:** node states with evidence counts, a 72-cell string × note map, weak items (≥ 3 samples), pathway progress, and session history.
- **Guitar screen:** direct topic practice, optional single-note microphone checks, a live pitch reference, a count-in plus one-minute chord-change/metronome tool, and queued bridge tasks completed by self-assessment. Self-reports mark a node as "played" but never raise recall mastery.
- **Storage:**
  - Dexie v5 with transactional attempt + schedule + session writes.
  - Migrations from v1–v4 keep history; v4 records receive conservative legacy/unknown input metadata. Version 4 JSON backups are accepted and upgraded to v5.
  - Sessions resume after interruption and are marked abandoned after 12 h.
  - Unsaved answers are kept in memory, with retry and export.
  - Versioned JSON export/import is validated, with merge or replace and an automatic pre-import backup.
  - Persistent storage is requested and its status is shown.
- **Lab (existing tools, kept):**
  - ungraded fretboard lookup (all-position quizzes are under Practice)
  - chord library
  - chord, interval and scale playback
  - progression sequencer
  - A/B comparisons
  - audio ear training

### Planned (labelled in the app, not functional)
- **Further instrument work:** validation against real guitars and phone microphones; melody/onset sequencing and richer strumming guidance. The current single-note pitch reference and microphone checks are functional browser features, not a claim of measured real-guitar accuracy. Chord recognition is not provided.
- **Phases C–D:** Tier 2 and Tier 3 nodes (barre/CAGED, modes, cadences, secondary dominants, improvisation, composition), circle of fifths, pentatonic positions.

### Known limitations
- The Lab fretboard quiz covers frets 1–12. On phones, the entire neck fits above the navigation in Explore, One note and Random review without scrolling. Fret spacing adapts to the available height; text and circular markers keep their proportions. Guided sessions use 0–12.
- Rhythm timing on phones is approximate even after calibration.
- Only standard tuning is used in exercises.
- Microphone tests use synthetic audio and mocked input streams. Real-guitar, iOS Safari and Android microphone behaviour still require manual validation.
- The UI is zh-TW. The shared strings sit in a catalog (`src/i18n`), but some screen copy and the Lab tools are not yet translated.
- Guitar and piano use 22 locally hosted recordings (about 1.44 MB total), loaded on demand and precached for offline use. Credits and CC BY 3.0 license: [public/audio/ATTRIBUTION.md](public/audio/ATTRIBUTION.md). Rebuild the pinned assets with `python scripts/prepare-samples.py` (requires ffmpeg). These compact banks use one dynamic layer and pitch interpolation, rather than separate recordings for every string and playing technique.
- Audio and mobile behaviour still need manual checks on iOS Safari and Android Chrome. `npm run test:pwa` verifies the production service worker caches the recording banks and both instruments play after an offline reload.
- The offline service worker only runs in production builds. Offline readiness is displayed; updates wait for user action outside practice instead of reloading an active session.

## Deployment

Cloudflare Pages builds the GitHub repository with `npm run build`, output directory `dist`, production branch `main`. The site is [music-learning-52z.pages.dev](https://music-learning-52z.pages.dev/). Deep links work through Pages' SPA fallback (there is no `404.html`). Pushes to `main` deploy automatically.
