# Guitar Lab — Product & Engineering Specification (v2)

> v2 replaces the original v1 brief (see git history, commit `4c3061f`). The main changes are listed in Appendix B.
> Keywords: **MUST** = required for the phase that introduces it. **SHOULD** = expected unless there is a documented reason not to. **MAY** = optional.

---

## 0. Mission

Guitar Lab is a mobile-first, local-first web app that makes guitarists **better at playing**, not just better at answering theory quizzes.

Most practice happens in short phone sessions without an instrument (commuting). Knowledge only counts when it reaches the hands, so the app also offers an optional **At the guitar** mode. That mode connects every concept to something the learner plays.

The guiding principle:

> **Understand it → Recall it → Find it on the neck → Hear it → Use it → Play it → Keep it.**

Order of priority when trade-offs arise:
1. Music-theory correctness
2. Learning effectiveness: the learner retains the material and transfers it to the guitar
3. Mobile practice experience
4. Reliable learning records
5. Adaptive review
6. Visual polish

### 0.1 Learning outcomes (what "it works" means)

Each skill node (§4) MUST declare measurable **can-do outcomes**. These outcomes drive mastery, recommendations and the Definition of Done. Representative examples:

| Area | Can-do outcome (Tier 1 examples) |
|---|---|
| Fretboard | Name any natural note on strings 6 and 5, frets 0–12, correctly ≥ 90 % over the last 20 prompts across ≥ 3 days. |
| Chords | Identify and finger the open chords C A G E D Am Em Dm from a diagram. At the guitar, change between two of them ≥ 30 times per minute. |
| Rhythm | Tap a one-bar eighth-note strum pattern (e.g. D – D U – U D U) at 70–90 bpm, with ≥ 80 % of strokes inside the calibrated timing window. |
| Intervals | Construct M3/m3/P4/P5/octave above any root, with correct spelling, and locate each one on two adjacent strings, including across the G–B string offset. |
| Keys | Name the diatonic triads and Roman numerals of C, G, D, A, E, F major. Identify I, IV, V and vi in a heard or written four-chord progression. |
| Ear | Distinguish major from minor triads, and M3 from m3, at ≥ 85 %. |

Speed MAY appear as a fluency indicator in outcomes (e.g. "under 3 s"). It MUST NOT be the sole basis of a mastery decline (§6).

---

## 1. Learners and practice contexts

**Learners:**
- Beginner to intermediate guitarists who know a few chord shapes but cannot connect them to theory.
- Learners who know the theory intellectually but cannot find it on the neck.
- Self-taught players who want to improvise and write.

**Session length:** 3–10 minutes, interruptible at any moment.

### 1.1 Two contexts, one learning record

| | **Pocket** (default) | **At the guitar** (optional) |
|---|---|---|
| Situation | Phone only, often silent, one hand, transit | Guitar in hand, phone on a stand or desk |
| Input | Tap, keyboard | Tap, and **optionally** the microphone |
| Activities | Lessons, recall, fretboard locate, ear training (headphones), analysis, rhythm tapping | Tuner, play-the-note checks, chord-change timer, strumming with the metronome, bridge tasks |
| Audio | Optional; every non-ear exercise works silently | Metronome and reference tones; microphone input requires explicit permission |

### 1.2 Bridge tasks (connecting pocket to playing)

Every pocket lesson MUST end with a **bridge task**: a 30–120 second instruction to perform on the guitar. Examples:
- "Play every C on strings 6 and 5, say the note name aloud."
- "Strum C → Am → F → G, 4 beats each, at 70 bpm."

Rules:
- When the learner has no guitar, the bridge task goes into a **Bridge Queue**. The Guitar tab shows it later. Queued tasks MUST NOT nag.
- A bridge task is completed in one of two ways:
  - **Mic-verified**, where verification is technically meaningful (§8).
  - **Self-reported**, on the scale "couldn't yet / with effort / comfortably".
- Self-reports are stored as their own evidence type. They count toward "Played" status (§6.3) but MUST NOT raise recall mastery.

---

## 2. Technical stack and constraints

- **Core:** React + TypeScript (strict), Vite, Tailwind CSS.
- **State:** Zustand holds only transient UI and session state. Dexie over IndexedDB is the persistent source of truth.
- **Audio:** Tone.js for audio output. Web Audio `AnalyserNode` plus an on-device pitch detector for microphone input. There are no network or AI services.
- **App shell:** PWA via `vite-plugin-pwa`, offline-first.
- **Testing:** Vitest for logic and storage. Playwright for browser flows, including mobile viewports.
- **Hosting:** GitHub with Cloudflare Pages: Git-connected, static site, SPA fallback.
- **Rendering:** every music visualization (fretboard, chord diagrams, circle of fifths, rhythm grid) MUST be React + SVG. No Three.js, R3F, Canvas or WebGL is used for these.
- **Static and local-first:** there is no backend, no authentication and no Cloudflare D1 in v2.

**Layering.** These layers are independent:
- `music-theory` (pure)
- `exercise-engine` (pure)
- `learning` (pure scheduler and mastery)
- `audio-out`
- `audio-in`
- `database` (a `LearningRepository` interface with a Dexie adapter)
- React UI

Pure layers MUST NOT import React, Dexie, Tone or the DOM. SVG components render data and report interactions; they MUST NOT compute theory.

---

## 3. The core learning loop

### 3.1 Lesson template

Every available lesson MUST follow this template. A stage MAY be skipped only when it does not apply; for example, a rhythm lesson has no fretboard "locate" stage.

| # | Stage | Purpose | Typical exercise types (§5) | Graded? |
|---|---|---|---|---|
| 1 | **Learn** | Worked example: a definition, why it matters, and one fretboard/diagram visualization with sound | Explanation card + interactive explorer | No (exploration) |
| 2 | **Recall** | Retrieve the fact without the visual | construct, multiple-choice, multi-select | Yes |
| 3 | **Locate** | Map the fact onto the neck | fret-identify, fret-locate, chord-diagram | Yes |
| 4 | **Hear** | Connect the fact to sound (skipped when audio is off; never mandatory) | ear-recognition | Yes |
| 5 | **Apply** | Use the fact in a musical context | progression-complete, melody-select, roman-numeral, rhythm-tap | Yes |
| 6 | **Play** | Bridge task on the guitar (now or queued) | mic-note, chord-change-timer, self-check | Separate evidence |
| 7 | **Keep** | Item enters the review schedule | — | — |

A lesson takes about 3–6 minutes. Each stage has 2–6 items. The learner can leave after any item and resume later (§9.3).

### 3.2 Learning-design rules

- **Retrieval before re-reading.** After the first exposure, the app asks before it shows. Hints are available on request. A correct answer given after a hint is recorded as `assisted`, and it schedules a short recheck instead of a full interval. The existing fretboard quiz already does this.
- **Interleaving.**
  - Review sessions MUST mix item types and topics once ≥ 2 topics are known.
  - New-material blocks MAY be blocked: one concept at a time until the first correct recall.
- **Spacing:** §6.
- **Desirable difficulty, without frustration.**
  - Target about 75–85 % session accuracy.
  - When rolling accuracy over the last 8 items falls below 60 %, the generator MUST step difficulty down. Examples: a smaller fret range, fewer strings, natural notes only.
  - Above 90 %, it SHOULD step difficulty up.
- **Error-specific feedback.** The validator MUST classify common errors and say what the learner's answer actually was. Examples:
  - **Off by one fret:** "You chose F♯; F is one fret lower."
  - **G–B string offset:** "Between strings 3 and 2 the shape shifts by one fret."
  - **Pitch correct, spelling wrong:** "D♭ sounds right, but in A major this note is spelled C♯."
  - **Quality confusion:** "That's a major 3rd (4 semitones); a minor 3rd is 3."
  - **Function vs. quality:** "G7 is a dominant-7th *quality*; it has dominant *function* in C."
- **Show it on the neck.** Every theory answer's feedback SHOULD include a fretboard or diagram rendering of the correct answer. When the learner was wrong, it shows their answer alongside, using shape and label differences, not only color.
- **No dead ends.** Every feedback screen offers exactly three next steps: Retry, Next, and Why (the explanation).

### 3.3 Content standard for each topic

Each topic covers:
- Definition
- Why it matters on the guitar
- A worked example
- An interactive visualization
- Practice
- One **common mistake**
- Related topics

Content MUST be concise Traditional Chinese, with English terminology on first use, e.g. 導音 / Leading Tone.

Content MUST stay accurate and precise:
- The leading tone is the scale degree a semitone below the tonic, in a tonal context.
- "Dominant" can mean scale degree V, a function, or a chord quality. These meanings are distinct.
- A borrowed chord is an interpretation, not proof of the composer's intent.
- The circle of fifths describes relationships; it does not prescribe chord sequences.
- Dissonance treatment is style-dependent.

When analysis is ambiguous, present the most useful reading and label it as one reading among several.

---

## 4. Curriculum as a skill graph

The curriculum is a **directed graph of skill nodes**, grouped into three tiers. Each node has:
- `id` (stable, never reused)
- `tier`
- `title` (i18n key)
- `prerequisites[]`
- `canDo[]` (§0.1)
- `lessons[]`
- `exerciseTemplates[]` (≥ 2 per node)
- `reviewItemFactory` (§6.1)
- `relatedNodes[]`
- `estimatedMinutes`
- `availability`: `available | preview | planned`

The Learn screen MUST show the graph as an ordered map with honest availability labels. Free selection of any `available` node is always allowed, whether or not its prerequisites are complete.

### 4.1 Tier 1 — Foundations (MVP scope)

| ID | Node | Key content | Notes |
|---|---|---|---|
| `fret.open` | Open strings & tuning | E A D G B E, string numbers, tuner | The tuner lives in the Guitar tab |
| `chord.diagram` | Reading chord diagrams | Strings, frets, fingers 1–4, ×/○, barre | Prerequisite for all chord shapes |
| `fret.naturals.low` | Natural notes, strings 6 & 5 | Frets 0–12; the root strings for chord shapes | First fretboard recall target |
| `fret.naturals.all` | Natural notes, all strings | Octave shapes as the anchor | |
| `fret.accidentals` | Sharps, flats, enharmonics | Key-aware spelling | |
| `fret.octaves` | Octave shapes | 2-string and 3-string octave shapes, the G–B exception | |
| `chord.open` | Open chords | C A G E D, Am Em Dm, then E7 A7 D7 G7 B7 | Diagram + sound + bridge |
| `rhythm.pulse` | Pulse & counting | Quarter and eighth notes, counting "1 & 2 &" | |
| `rhythm.strum` | Strumming patterns | Down/up strokes, rests, ties, accent | Pattern tap + bridge |
| `chord.changes` | Chord changes | Pivot fingers, anchor fingers, common shapes | At-the-guitar heavy |
| `interval.basics` | Intervals to the octave | Semitones and qualities, inversion pairs | |
| `interval.shapes` | Interval shapes on the neck | Same-string and adjacent-string shapes, the G–B shift | |
| `triad.basic` | Triad construction | Major, minor, diminished, augmented; R-3-5 | |
| `scale.major` | Major scale & degrees | W-W-H-W-W-W-H, degrees 1–7 | |
| `scale.penta1` | Pentatonic box 1 | Minor/major pentatonic, relative relationship | |
| `key.diatonic` | Keys & diatonic triads | Key signatures for 0–4 accidentals, I ii iii IV V vi vii° | |
| `key.circle` | Circle of fifths | Relationships, relative minors | |
| `harmony.basic` | Common progressions & function | I–IV–V, I–V–vi–IV, tonic/predominant/dominant | |
| `ear.basic` | Basic ear training | Major/minor triads, M3/m3/P5/octave, major vs. minor progressions | |

### 4.2 Tier 2 — Connecting

| Group | Nodes |
|---|---|
| Barre chords & positions | `chord.barre` (E-shape, A-shape, movable roots via `fret.naturals.low`), `fret.caged`, `scale.positions` (5 pentatonic positions, major scale in 3 notes per string) |
| Chord families | `chord.seventh` (maj7, m7, 7, m7♭5, dim7 + shapes), `chord.sus-add6`, `triad.stringsets` (triads and inversions on string sets 1–3, 2–4, 3–5) |
| Harmony | `harmony.cadences`, `harmony.ii-V-I`, `harmony.minor-keys` (natural/harmonic/melodic minor in context) |
| Melody & voice leading | `voice.common-tones`, `voice.guide-tones` (3rds and 7ths), `improv.targets` (chord tones on strong beats) |
| Modes | `scale.modes`. Taught in two ways: (a) a parent major scale with a different tonic; (b) a parallel formula plus its characteristic tone. Both are presented together. |
| Rhythm | `rhythm.sixteenths`, `rhythm.syncopation`, `rhythm.triplets-swing` |
| Ear | `ear.sevenths`, `ear.cadences`, `ear.degrees`, `ear.bass-motion` |

### 4.3 Tier 3 — Creating

| Group | Nodes |
|---|---|
| Advanced harmony | `harmony.secondary-dom` (V/x, vii°/x), `harmony.borrowed`, `harmony.tritone-sub`, `harmony.modulation` |
| Advanced chords | `chord.extensions` (9, 11, 13 and alterations), `chord.drop2`, `chord.slash` |
| Improvisation | `improv.approach` (chromatic, scale-step, enclosures), `improv.motif`, `improv.phrase` (call and response, phrase length) |
| Analysis & composition | `analysis.progression` (built-in and user-entered), `compose.progression` (4- and 8-bar), `compose.melody-harmonize`, `compose.reharm` |
| Other | `rhythm.dictation`, `rhythm.polyrhythm`, `ear.progression-dictation`, `ear.melody-dictation`, `fret.alt-tunings` (Drop D, DADGAD, open G) |

All topics from the twelve v1 domains are kept and mapped to nodes (Appendix A).

### 4.4 Pathways

Pathways are **ordered views** over the graph. They do not hold separate content. Pathway progress is tracked separately from mastery: a step counts as completed once its node reaches *Familiar* (§6.3).

| Pathway | Steps |
|---|---|
| ★ **Start Here** (recommended default) | fret.open → chord.diagram → chord.open → rhythm.pulse → rhythm.strum → fret.naturals.low → chord.changes → interval.basics → triad.basic → key.diatonic → harmony.basic |
| A — Fretboard Mastery | naturals → octaves → interval shapes → triads on string sets → CAGED → scale positions |
| B — Harmony Understanding | keys → diatonic → function → cadences → secondary dominants → borrowed → voice leading |
| C — Improvisation | intervals → pentatonic → scale positions → chord tones / targets → guide tones → approach → phrase |
| D — Composition & Analysis | Roman numerals → progressions → cadences → voice leading → substitution → reharmonization |

---

## 5. Exercise engine

### 5.1 Contract

Each exercise type is defined by:
- `generate(seed, params) → Question`: deterministic and serializable, with a `generatorVersion`
- an `answerSchema`
- `validate(question, response) → Result`: pure; validates against the stored question, never against UI state
- an `errorClassifier`
- `feedback(question, response, result) → Explanation`
- `difficulty`
- `skillTags[]`
- `reviewItemIds[]` (§6.1)
- `evidenceLevel`

`Result` is one of:
- `correct`
- `incorrect`
- `partial`: pitch correct but spelling wrong, or some multi-select items correct

`partial` MUST be graded as *incorrect for the spelling skill* and *correct for the pitch skill*. The two are separate review items.

### 5.2 Evidence levels

| Level | Meaning | Counts toward |
|---|---|---|
| `recognize` | Choose among options; hear-and-identify | Recall mastery (weighted 0.5) |
| `recall` | Produce from memory: construct, name a note | Recall mastery (weight 1) |
| `locate` | Produce on the fretboard or diagram | Fretboard mastery |
| `apply` | Use in musical context | Application mastery |
| `played-verified` | The microphone or timing confirmed it at the guitar | Played status |
| `played-self` | Self-reported at the guitar | Played status (labeled self-reported) |
| `explore` | Ungraded interaction | Nothing; logged separately |

### 5.3 Exercise types

Types marked † are new in v2.

| # | Type | Input | Notes |
|---|---|---|---|
| 1 | multiple-choice | Tap / keyboard | Distractors come from the error classifier (plausible errors only) |
| 2 | multi-select | Tap | Order-independent. Enharmonic equivalence is governed by the question's `spellingStrict` flag |
| 3 | fret-identify | Note picker | "What note is string 5, fret 7?" |
| 4 | fret-locate | Fretboard taps | Single position or "all positions in range"; range and strings are configurable |
| 5 | construct | Note picker (spelled) | Intervals, chords and scales from a formula; replaces v1's three separate construction types |
| 6 | roman-numeral | Picker with quality and inversion | Accepts every valid analysis listed in the question (§7.4) |
| 7 | progression-complete | Chord picker | Accepts the set of musically valid answers, with a ranked "most common" explanation |
| 8 | order | Drag **or** tap-to-place / keyboard | Scale degrees, voice-leading steps, form |
| 9 | circle-interaction | SVG circle | Select a key, its dominant, its relative minor, etc. |
| 10 | ear-recognition | Choice after playback | Replay; slower tempo; arpeggiated vs. block |
| 11 | rhythm-tap | Tap pad (D/U buttons for strums) | Calibrated latency (§7.6) |
| 12 | melody-select | Fretboard / note picker over chords | Target notes, guide tones; evaluated for chord-tone placement on strong beats |
| 13 | progression-editor | Lab | Creative and ungraded. Deterministic checks (key fit, Roman numerals, voice-leading cost) are shown as information |
| 14† | chord-diagram | SVG diagram: place dots, mark ×/○ **or** name a shown shape | Accepts any valid voicing in the requested shape family; reports missing chord tones |
| 15† | mic-note | Play a note on the guitar | Graded on pitch class + octave within ±40 cents (§8) |
| 16† | chord-change-timer | 60-second count by tap or microphone onset | Score is changes per minute; cleanliness is self-assessed |
| 17† | self-check | 3-point self-rating | For bridge tasks that cannot be verified |

**Attempt records.** Every graded submission writes one `ExerciseAttempt` (§10).
- Retries are new attempts with `retryOf`.
- Skips and interruptions are recorded as `skipped` events, never as incorrect.
- Exploration is logged as `ExploreEvent` and never touches mastery.

---

## 6. Memory and mastery model

### 6.1 Review items

Scheduling is done **per review item**, not per topic.

A review item is the smallest unit a learner can know or not know. Examples:
- `fret.note.C.s5`: C on string 5. There are 72 note × string items. With frets 0–12, the open-string pitch class appears at frets 0 and 12, and either position is accepted.
- `interval.construct.m3`
- `chord.spell.F#m7b5`
- `chord.shape.open.G`
- `key.diatonic.D.V`
- `rhythm.pattern.D-DU-UDU`
- `ear.triad.major-vs-minor`

Item IDs are stable and are derived by the node's `reviewItemFactory`.

### 6.2 Scheduler (rule-based, versioned)

This generalizes the existing logic in `src/music/fretboardQuiz.ts` to all items. It is Leitner-style:

| Box | Next review |
|---|---|
| 0 (new or missed) | In-session recheck after ≥ 3 other items, or about 2–10 minutes |
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 14 days |
| 5 | 30 days (cap) |

Rules:
- **Correct, unassisted:** box +1, capped at 5. A late review that is answered correctly advances only one box.
- **Correct, assisted (hint shown or retry after a miss):** stays in box 0. Recheck within the session; recovery is recorded.
- **Incorrect:** the item drops to box 0, gets a recheck within the session, and is then due tomorrow if it is not recovered. Priority goes up. The miss stays in history; later success never erases it.
- **Due items stay due** until a graded response. Skip, explore and abort never change a schedule.
- **Recommendation ranking** is a deterministic score, with ties broken by item ID:
  - overdue days
  - recent error rate, with a minimum of 3 samples
  - prerequisite weakness
  - "unseen in an active node"
- Each recommendation shows a reason, e.g. 「今日到期」 or 「最近 5 題錯 3 題：小三度」.
- `schedulerVersion` is stored on every schedule row. Schedules can be recomputed from attempts.
- The intervals are pragmatic defaults, not claims of optimality. An FSRS adapter MAY be added later behind the same interface.

### 6.3 Mastery states per node

Node states are derived and recomputable:
- **New**
- **Learning:** any graded evidence.
- **Familiar:** recall/locate accuracy ≥ 80 % over ≥ 8 items, spread across ≥ 2 days, with ≥ 50 % of the node's items at box ≥ 2.
- **Fluent:** Familiar, plus apply-level evidence ≥ 75 %, plus ≥ 80 % of items at box ≥ 3.
- **Played ✓:** a separate badge, granted once the node's bridge tasks are completed. It shows "self-reported" or "verified".

The UI MUST show:
- sample counts and recent evidence, e.g. 「12 次作答，近 3 天 10/12」
- specific weak items, e.g. 「第 3 弦 7–10 格」 or 「F♯ 拼寫」

A single miss is never presented as a lasting weakness.

**Response time** is recorded where meaningful. It MAY show as a fluency trend. It MUST NOT drop an item's box on its own, and it MUST NOT reward fast guessing. For example, sub-400 ms answers on choice items are flagged and excluded from fluency stats.

---

## 7. Interactive components

### 7.1 SVG fretboard (shared)

- **Strings and tuning:** 6 strings; standard tuning plus the configured tunings (Drop D, DADGAD, Open G, half-step down).
- **Frets 0–12 by default (open strings included).**
  - The nut is drawn.
  - Fret 0 has its own hit row above or beside the nut.
  - Inlays: single dots at 3, 5, 7 and 9; a double dot at 12.
  - The wood and fret wires are bounded by strings 1 and 6.
- **Layouts:**
  - Vertical on phones: frets 0–12 all visible above the bottom nav with no horizontal scrolling.
  - **Practice and recall modes MUST use the vertical layout on every screen size by default**, so the neck reads top-to-bottom like a chord chart. On wide screens a 直式/橫式 (vertical/horizontal) switch MAY change this, and the choice is remembered.
  - Explore mode MAY use the horizontal layout on tablet and desktop.
  - A left-handed mirror option.
- **Hit regions:** each (string, fret) cell is the hit target, about 44 × 44 CSS px where feasible. The mobile cell height MUST stay ≥ 40 px.
- **Focus mode:** on narrow screens, the learner MAY pick a **focus string set** (e.g. strings 6–4) or a **position window** (e.g. frets 5–8). This enlarges cells.
- **Overlays:**
  - note names
  - intervals relative to a root
  - scale degrees
  - chord tones (R, 3, 5, 7 shown as text or shape, not only color)
  - **fingering numbers**
  - **CAGED shape outlines**
  - **position windows**
  - **chord-diagram mini-view**
- **Input:** pointer and touch. `touch-action` prevents scrolling while tapping the neck. Arrow keys move between cells; Enter or Space selects. There is visible focus.
- **Screen readers:** an equivalent semantic grid or list labels every cell, e.g. 「第 5 弦 第 7 格 E」.
- **Audio:** tapping plays the note when audio is enabled.
- **Performance:** no permanent animation loop. Resize and orientation changes are handled. Labels stay legible under text scaling.

**Fretboard recall** keeps the current behavior and expands it to frets 0–12:
- one-note "find all"
- random string-specific review via §6
- broad region hints after a miss (frets 0–4 / 5–8 / 9–12)
- skips without penalty
- every answer logs the target and the selected string and fret

### 7.2 SVG chord diagram (new, shared)

The component draws vertical strings, the nut or a starting-fret label, dots with finger numbers, barres, and ×/○ markers. Its data comes from a typed shape library in `music-theory/guitar`, which covers:
- open chords
- E- and A-shape barres
- CAGED shapes
- common 7th shapes
- triads on string sets

Every shape is validated in tests against its chord's pitch classes.

The component has two modes: **display** and **input** (for exercise type 14).

### 7.3 SVG circle of fifths

- **Content:**
  - 12 major keys on the outer ring and relative minors on the inner ring
  - key signatures
  - enharmonic pairs at 6 o'clock, shown as F♯ / G♭ and D♯m / E♭m
  - neighbor highlighting
  - diatonic chords of the selected key
  - secondary-dominant arrows
- **Example flow:**
  1. Select C. G is highlighted as V.
  2. Select G. D is highlighted as its V.
  3. The app shows D7 → G7 → C as V7/V → V7 → I.
- **Accessibility:** touch targets ≥ 44 px, plus an accessible key list.
- **Computation:** all calculations come from the theory engine.

### 7.4 Harmonic ambiguity

Analysis functions return **sets of readings**, each with:
- a confidence label (`common`, `possible`)
- the context assumption it makes, e.g. "in C major"

Deterministic facts (pitch content, intervals, chord quality) are displayed apart from interpretive labels (function, borrowed, secondary).

Examples:
- In C major, D7 reads as V7/V.
- Fm reads as borrowed iv.
- E7 → Am reads as V7/vi → vi, or as V7 → i if A minor is tonicized.

Exercises MUST accept every reading listed in the question.

### 7.5 Chord & Scale Explorer

The learner selects:
- a root
- a chord or scale type (including modes)
- an inversion
- a string set
- a fret range or CAGED position

The fretboard and diagram update immediately. The explorer shows:
- the spelled notes
- the interval formula
- degree labels
- relationship to the current key
- the characteristic tone (for modes)
- a short explanation
- an audio preview

Using the explorer is `explore` evidence only.

### 7.6 Rhythm and strum pad

- **Grid:** shows the pattern on a beat grid (8ths, then 16ths), with D/U arrows and rests.
- **Input:** a tap pad with **Down** and **Up** buttons for strum patterns, or a single button for rhythm-only patterns.
- **Latency calibration** (required before graded rhythm):
  - The learner taps along to 8 clicks.
  - The median offset is stored per device and per output route (speaker vs. Bluetooth).
  - Grading windows are about ±60 ms for "on time" and ±120 ms for "close", after offset correction.
  - The UI MUST state that timing is approximate on phones.
- **Practice aids:** count-in, adjustable bpm, and a gradual tempo ladder (+5 bpm after two clean passes).

### 7.7 Progression Lab

The learner can:
- select a key
- add, reorder (drag or tap) and remove chords
- set beats per chord
- play with tempo and loop settings
- view Roman numerals (a reading set, §7.4)
- see chord tones and the **next chord's common tones** on the fretboard
- see voice-leading movement
- transpose
- save locally

The lab ships with original example progressions:
- Cmaj7 → Am7 → Dm7 → G7 (Imaj7 → vi7 → ii7 → V7)
- C → G/B → Am → Fmaj7
- Dm7 → G7 → Cmaj7
- F → Fm → C
- E7 → Am
- D7 → G7 → C
- G → D → Cmaj7
- Cmaj7 → Em7 → D

No copyrighted lyrics, recordings or sheet music are included.

---

## 8. At-the-guitar audio input (new)

- **Permission:** the microphone is requested only after the learner taps a feature that needs it. The app first explains, in plain zh-TW, why it needs the microphone and that audio is never recorded or uploaded. When permission is denied, every feature falls back to self-check or tap input.
- **Pitch detection:**
  - On-device and monophonic: a YIN or McLeod-style detector on `AnalyserNode` frames.
  - Range about 75–1,400 Hz.
  - A note is reported only after it is stable for ≥ 120 ms, with a clarity threshold.
  - Detection is configured in a pure `audio-in/pitch.ts` module, which is unit-tested with fixtures.
- **Tuner:** shows note name, cents deviation and per-string targets for the selected tuning.
- **mic-note check:**
  - Grades pitch class + octave within ±40 cents.
  - It MUST state honestly that pitch alone cannot tell which string was used. E4 can be played on string 1 open, string 2 fret 5, and so on.
  - When the string matters, the prompt asks for a pitch that is only playable at the target in the allowed range, or the result is labeled "pitch verified" rather than "position verified".
- **Chords:** polyphonic chord recognition is **out of scope for v2**. Chord bridge tasks use timing (the chord-change timer, with onset detection when the microphone is available) plus a self-check.
- **Noise:** an ambient-noise check before mic exercises. If the signal is unreliable, switch to self-check mode and say so.
- **Microphone/output conflicts:** while a mic exercise is running, the app pauses all other audio output except the metronome. Use headphones when possible.

---

## 9. Navigation, sessions, and daily habit

### 9.1 Navigation

The bottom navigation has five tabs. Routes are real URLs so they can be deep-linked and reloaded.

| Tab | Content |
|---|---|
| **今日 Today** | One primary button: "Start 5-minute session". Below it: due count, continue lesson, weak items with reasons, Bridge Queue count, and a weekly practice calendar |
| **學習 Learn** | Skill map (tiers and pathways), node detail with lessons, Free Practice entry |
| **工具 Lab** | Fretboard explorer, Chord & Scale Explorer, Circle of Fifths, Progression Lab, A/B comparisons, ear-training free play |
| **吉他 Guitar** | Tuner, Bridge Queue, chord-change timer, strum with metronome, mic note checks |
| **進度 Progress** | Node states, item-level weaknesses (heatmap by string × fret with a text alternative), history, pathway progress |

Settings is reached from a header icon. It covers:
- language
- theme (dark by default)
- audio output and volume
- microphone
- tuning
- note naming (♯/♭ preference, solfège MAY come later)
- difficulty
- default session length
- left-handed display
- latency calibration
- data export/import
- storage status

From cold start, the first practice item MUST be reachable in ≤ 2 taps.

### 9.2 Sessions

**Guided session.** Lengths are 3, 5 or 10 minutes, or a custom length. Each session follows a fixed recipe:
1. **Warm-up:** 2–3 quick due items.
2. **Due reviews:** interleaved.
3. **New or weak material:** the next step on the active pathway, or the weakest node.
4. **Apply:** one context item.
5. **Bridge:** one bridge task, done now or queued.

When nothing is due, more time goes to new material. When the learner hasn't started any node, the session begins **Start Here** step 1.

**Free practice.** Any available node, exercise type, key, fret and string range, difficulty, question count, and audio on or off. Recommendations never lock choices, and dismissing a recommendation has no penalty.

**Session summary:**
- accuracy
- items promoted or demoted
- specific recurring errors (from the error classifier)
- time only where meaningful
- one suggested next step

### 9.3 Interruption and resume

- A `PracticeSession` row is written at start and updated after every item.
- If the app is closed mid-session, the next open offers "Continue (2 min left)".
- Resume uses the stored questions. Already-answered items are never re-recorded.
- Abandoned sessions are closed as `abandoned` after 12 hours, with no mastery effect.

### 9.4 Habit without punishment

- The learner chooses a weekly goal of days per week, not a daily streak.
- Missed days MUST NOT reset visible progress or show guilt messaging.
- A short "welcome back" plan prioritizes the most overdue items, capped so the review backlog never exceeds one session.

---

## 10. Data, storage, and safety

### 10.1 Records (Dexie, explicit versions)

| Record | Key fields |
|---|---|
| `ExerciseAttempt` | `id`, `sessionId`, `exerciseType`, `nodeId`, `reviewItemIds[]`, `generatorVersion`, `question` (serialized) or `seed`, `response`, `expected`, `result`, `errorClass?`, `evidenceLevel`, `assisted`, `retryOf?`, `responseMs?`, `difficulty`, `timestamp`, fretboard dims (`string`, `fret`, `note`, `targetString`, `targetFret`, `tuning`) |
| `SkipEvent` / `ExploreEvent` | `id`, `sessionId?`, `nodeId`, `kind`, `payload`, `timestamp`. Never used for mastery |
| `SelfReport` | `id`, `bridgeTaskId`, `nodeId`, `rating` (0–2), `verified` (bool), `metric?` (e.g. changes/min), `timestamp` |
| `PracticeSession` | `id`, `mode` (guided/free/guitar), `settings`, `plannedItems[]`, `cursor`, `status` (active/completed/paused/abandoned), `startedAt`, `endedAt`, `summary` |
| `ReviewSchedule` | `itemId`, `box`, `dueAt`, `lastReviewedAt`, `lapses`, `schedulerVersion` |
| `NodeMastery` (derived, cacheable) | `nodeId`, `state`, evidence counts by level, `recentAccuracy`, `calcVersion`, `updatedAt` |
| `ItemWeakness` (derived) | `itemId`, `dimensions`, `samples`, `recentMisses`, `lastSeen` |
| `PathwayProgress` | `pathwayId`, `completedNodeIds[]`, `updatedAt` |
| `BridgeQueue` | `id`, `nodeId`, `taskId`, `createdAt`, `completedAt?` |
| `SavedProgression` | `id`, `name`, `key`, `chords[]` (symbol, beats, inversion), `schemaVersion`, `createdAt`, `updatedAt` |
| `Preferences` | everything in Settings, plus `latencyOffsets` per output route |

- **Repository:** `LearningRepository` is a typed interface. `recordAttempt()` MUST write the attempt, the review-schedule changes and the session cursor **in one transaction**. Generators and validators MUST NOT know Dexie exists.
- **IDs:** stable record IDs (UUID) leave room for a future sync adapter. No sync code ships in v2.

### 10.2 Migration from the current database

The existing database is `guitar-lab` at Dexie v3, with tables `attempts` and `settings`. Version 4 MUST:
- keep every existing attempt. Each one is mapped to the new fields:
  - `topicId fretboard.note.X` + `targetString` → `reviewItemIds ['fret.note.X.sN']`
  - ear-training topics → `ear.*` items
- create synthetic `PracticeSession` rows for legacy attempts. Today, ear-training `sessionId` holds the question ID; those attempts are grouped per day.
- move `settings.audio` into `Preferences`.
- rebuild `ReviewSchedule` by replaying the legacy attempts through the scheduler.

Migration tests MUST use v1, v2 and v3 fixtures and assert that no attempts are lost.

### 10.3 Backup and failure handling

- **Export:** versioned JSON of all user-owned records.
- **Import:**
  - Validate before writing: envelope, schema version, record types, IDs, timestamps, references, a size limit (e.g. ≤ 20 MB) and nested payloads.
  - Show a preview, then ask the learner to choose replace or merge.
  - Write in one transaction.
  - Create an automatic pre-import backup when replacing.
  - Never evaluate imported content as code or render it as HTML.
- **Failures:** detect and report IndexedDB denial, quota, migration and transaction failures. On a failed write:
  - keep the result in memory
  - show a clear banner (「此答案尚未儲存」)
  - offer retry and export

  Never claim a save that did not happen.
- **Storage persistence:** request `navigator.storage.persist()` after a meaningful gesture, e.g. finishing the first session. Show the real persistence and install state.
- **PWA:**
  - Offline app shell with bundled curriculum, generators and synth.
  - Service-worker updates apply on next launch or at an idle moment, never mid-session, and never touch IndexedDB.
  - Precache all built assets, including images and icons.

---

## 11. Music theory engine requirements

Pure TypeScript, deterministic, with exhaustive tests.

- **Notes:**
  - Separate **pitch** (MIDI and pitch class) from **spelling** (letter + accidental, including double sharps and flats).
  - Key-aware spelling.
  - Frequency conversion.
  - Enharmonic comparison.
- **Intervals:**
  - Generic size + quality from spelled notes (C–E♯ is an augmented 3rd, not a perfect 4th).
  - Semitones, direction, inversion, compound intervals.
- **Scales and modes:**
  - Formulas for major, the three minors, the pentatonics, blues, and all 7 modes.
  - Spelled per key.
  - Degrees and characteristic tones.
- **Chords:**
  - Triads, 7ths, 6ths, sus, add, extensions and alterations.
  - Inversions and slash chords.
  - Parsing and spelling.
  - **Identification from a note set**, which returns ranked candidates (e.g. C E G A → C6 or Am7/C).
- **Keys and harmony:**
  - Key signatures.
  - Diatonic triads and 7ths in major and minor (natural/harmonic).
  - Roman numerals with quality and inversion figures.
  - Secondary dominants and leading-tone chords.
  - Borrowed chords.
  - Function labels.
  - Ambiguity-aware reading sets (§7.4).
  - Transposition that preserves sensible spelling.
  - Voice-leading cost between voicings.
- **Guitar:**
  - Tunings.
  - (string, fret) ↔ MIDI.
  - Note → positions in a range.
  - Octave and interval shapes.
  - A **shape library** (open, barre, CAGED, 7th, string-set triads) with fingering, validated against chord spelling.
  - Position windows.

**Required test anchors:**
- F♯m7♭5 = F♯ A C E
- Cmaj7 = C E G B
- G7 = G B D F
- Gsus4 = G C D
- D major's signature is F♯ and C♯
- The relative minor of G is Em
- In C major: D7 → {V7/V}, Fm → {borrowed iv}, B° → {vii°}
- E♭ major is spelled E♭ F G A♭ B♭ C D (never with D♯)
- Every shape in the library matches its chord's pitch classes

---

## 12. Audio output

- **Reusable engine:** notes, intervals (melodic and harmonic), chords (block or strummed), arpeggios, progressions, metronome, count-in.
- **Settings:** tempo, durations and mute.
- **Sound:** the existing Tone.js engine (modeled-string pluck, keys and click) is kept. A small sampled nylon or steel-string set MAY be added if it measurably improves timbre and stays ≤ about 2 MB, precached.
- **Lifecycle:**
  - Start only after a user gesture.
  - Single-owner scheduling: starting new playback cancels the previous one, so sounds never pile up.
  - Clean up on `visibilitychange` and `pagehide`.
- **Ear training extras:** replay, a slower tempo, and an arpeggiate option.

---

## 13. UX, visual design, accessibility, i18n

- **Visual style:** minimal, precise, "creative tool" rather than a children's game. Dark by default, light optional. Subtle micro-interactions, honoring `prefers-reduced-motion`. No heavy gradients or glassmorphism.
- **Layout and touch:**
  - Portrait 320–430 px first.
  - Safe-area insets.
  - No horizontal page overflow at any width.
  - Touch targets ≥ 44 px.
  - No hover-only features.
  - One-handed reach: primary actions sit in the bottom half.
- **Accessibility:**
  - Semantic HTML.
  - Accessible names on SVG targets.
  - Full keyboard paths through every exercise type, including the fretboard, circle, diagrams, ordering and rhythm (Space/J/K for taps).
  - Correctness, roots and chord tones are never conveyed by color alone.
  - Visible focus.
  - Text feedback for every audio cue.
  - No audio required outside ear training.
- **i18n:**
  - zh-TW by default, with English music terms on first use.
  - All strings live in typed message catalogs, ready for `en` and `ja`.
  - Note names are not translated.
  - Explanation content is stored as structured data, not as JSX strings.

---

## 14. Current state → target

This is the state at commit `4c3061f`.

| Area | Today | Action |
|---|---|---|
| App shell | One file, `src/app/App.tsx`, with tab state and no router; 6 tabs (Fretboard, Explore, Progressions, Compare, Ear, Settings) | **Refactor:** add a router and split into `app/`, `screens/`, `components/{fretboard,diagram,circle,rhythm}`. Map the existing tabs into Lab and Learn (§9.1) |
| Theory | `src/music/theory.ts`: sharp/flat pitch tables, 19 chord qualities, 5 scales, slash parsing, voice-led voicings, progression planner | **Extend** to §11: spelled notes, keys, modes, Roman numerals, reading sets, shape library. Keep `chordVoicing` and `planProgression` |
| Fretboard recall | `src/music/fretboardQuiz.ts`: 72 note × string items, frets 1–12, 1/3/7/14/30-day ladder, 1-minute assisted recheck, weighted seeded choice | **Generalize** into `learning/scheduler.ts` (§6). Add fret 0 |
| Ear training | `src/music/ear.ts`: 7 multiple-choice types | Keep. Wrap them in the exercise contract. Add review items |
| A/B comparisons | `src/music/comparisons.ts` | Keep, inside Lab |
| Persistence | `src/data/db.ts`: Dexie v3 with `attempts` and `settings`; mastery is the rolling last 10 per topic | **Migrate** to v4 (§10.2). Add `LearningRepository`, sessions and export/import |
| Audio | `src/audio/AudioEngine.ts`: Tone.js pluck/keys/click, limiter, gesture start, cleanup on hide | Keep. Add count-in and cancellation ownership checks |
| Microphone, tuner, chord diagrams, rhythm pad, circle, lessons, Today, Progress | Missing | Build in the phases below |
| Tests | 11 Vitest tests, 6 Playwright tests (desktop Chrome only) | Add mobile viewport projects and the suites in §15 |
| Deploy | Git-connected Cloudflare Pages, `music-learning-52z.pages.dev`; PWA cache leaves out png files | Keep. Check deep-link reloads work (Pages SPA fallback when no `404.html` exists). Fix the precache patterns |
| Legacy | Empty `public/models/`; `packages/three-core/` listed in `.gitignore` | Remove |

---

## 15. Roadmap (each phase ships deployable and honestly labeled)

**Phase A — Foundation + Tier 1 pocket loop**
- Router and file split.
- Theory engine extension with tests.
- Repository layer, DB v4 migration, sessions, export/import.
- Generalized scheduler.
- Fretboard frets 0–12 with focus mode.
- Chord diagram component and the open-chord shape library.
- Rhythm/strum pad with calibration.
- Lesson-template runner.
- Today screen with guided sessions.
- Tier 1 nodes marked `available`. Others marked `planned`.
- Start Here pathway.

*Exit criteria:*
- A new user completes a 5-minute guided session in Start Here on a 375 px phone.
- The session survives a reload mid-way.
- Attempts persist.
- Recommendations show reasons.

**Phase B — At the guitar**
- Guitar tab.
- Tuner.
- Pitch detector with fixtures.
- mic-note exercise.
- Chord-change timer.
- Strum with metronome.
- Bridge Queue and self-check.
- Played badges.

*Exit criteria:*
- Microphone features work on iOS Safari and Android Chrome (manually verified).
- Permission denial degrades gracefully.
- Detector fixture tests pass.

**Phase C — Tier 2**
- Barre chords, CAGED, positions, 7th chords, string-set triads, modes, cadences, ii–V–I.
- Guide tones and target notes.
- Rhythm 16ths and syncopation.
- Ear: sevenths, cadences, degrees.
- Circle of fifths.
- Chord & Scale Explorer upgrades.
- Pathways A–C.

**Phase D — Tier 3**
- Secondary and borrowed chords, tritone substitution, modulation.
- Extensions and drop-2 voicings.
- Improvisation phrasing.
- Song analysis with user input.
- Composition and reharmonization in the Progression Lab.
- Dictation.
- Alternate tunings.
- Pathway D.

Do not mark a node `available` until every lesson stage it uses meets the exercise contract (§5.1).

The README MUST list functional, preview and planned features accurately at every release.

---

## 16. Testing and quality

**Vitest**
- **Theory:** the §11 anchors, spelling edge cases (E♯, C♭, double sharps), every shape in the library, and reading sets.
- **Exercises:** seed reproducibility, validators, partial grading, error classification, difficulty stepping.
- **Learning:**
  - scheduler transitions for every rule in §6.2
  - late reviews
  - assisted rechecks
  - no effect from skips, exploration or aborts
  - deterministic ranking and its reasons
  - mastery-state thresholds
- **Data:**
  - v1/v2/v3 → v4 migration fixtures
  - transactional `recordAttempt`
  - injected write failures
  - export/import round trips
  - malformed and oversized import rejection
  - pre-import backup
- **Audio input:** the pitch detector on committed WAV fixtures: each open string, fretted notes, a slightly detuned note, and noise. The fixtures are original recordings or synthesized audio.

**Playwright**
- **Viewport projects:** 320×568, 375×812, 390×844 and 430×932, plus tablet and desktop.
- **Flows:**
  - cold start → first item in ≤ 2 taps
  - guided session completion and resume after reload
  - a fretboard tap (adjacent-fret accuracy on 320 px)
  - a keyboard-only fretboard answer
  - chord-diagram input
  - a rhythm tap using a fake clock
  - circle interaction
  - Progression Lab save and reload
  - export and import
  - deep-link reload
  - offline reload
  - the microphone flow with Chromium fake media
- **Layout and accessibility:** no horizontal overflow on any route; axe accessibility scan on every route.

**Before every deploy:** typecheck, build, Vitest and the critical Playwright suite MUST pass. Do not present a placeholder as a feature.

---

## 17. Deployment

- **Setup:** keep the existing Git-connected Cloudflare Pages project, with production branch `main`, `npm run build` and output `dist`. Pushes to `main` deploy automatically.
- **Repository hygiene:** a useful README, a committed lockfile, no secrets, and meaningful commits.
- **After each deploy:**
  - Open the live URL.
  - Verify Today → guided session.
  - Verify a fretboard answer persists after reload.
  - Verify deep-link reload.
  - Verify offline reload.

Never report a deployment as successful before the live site has been checked.

**Final delivery for each phase:**
- repository URL
- live URL
- features grouped as functional, preview or planned
- test results
- known limitations
- local development steps
- how deployment works

---

## 18. Definition of Done (v2 complete)

1. React + TS + SVG app. No 3D or WebGL dependencies.
2. All skill nodes appear in the graph with accurate availability. Tier 1 and Tier 2 are `available`. Tier 3 is `available` or clearly `preview`.
3. Every available node runs the lesson loop, including a bridge task. Its exercises validate, classify errors, explain, retry and continue.
4. The fretboard (0–12), chord diagrams, circle and rhythm pad work with touch and keyboard on the representative phones.
5. At-the-guitar mode works with the microphone where supported, falls back gracefully, and is honest about what it verifies.
6. The theory engine passes the spelling, shape and analysis test suites.
7. Every graded attempt, session, schedule and self-report persists transactionally and survives reload. Migration from the current v3 database loses nothing.
8. Recommendations are deterministic, explained and overridable. Free selection is always available. There are no punitive streaks.
9. Export and import are validated. Failure states are visible and tested.
10. Typecheck, build, Vitest and the critical Playwright suites pass. The live Cloudflare Pages site has been verified.
11. The learning outcomes in §0.1 are measurable from stored data; the Progress screen can show them.

---

## Appendix A — v1 module → v2 node mapping

| v1 module | v2 nodes |
|---|---|
| 01 Fretboard Knowledge | fret.open, fret.naturals.low/all, fret.accidentals, fret.octaves, interval.shapes, fret.caged, scale.positions, fret.alt-tunings |
| 02 Intervals | interval.basics, interval.shapes, ear.basic (intervals); compound intervals → chord.extensions |
| 03 Scales & Modes | scale.major, scale.penta1, scale.positions, harmony.minor-keys, scale.modes |
| 04 Chord Construction | chord.diagram, chord.open, triad.basic, chord.barre, chord.seventh, chord.sus-add6, triad.stringsets, chord.extensions, chord.drop2, chord.slash |
| 05 Keys & Circle | key.diatonic, key.circle, harmony.modulation; transposition → analysis.progression |
| 06 Harmony & Progressions | harmony.basic, harmony.cadences, harmony.ii-V-I, harmony.secondary-dom, harmony.borrowed, harmony.tritone-sub, harmony.modulation, voice.* |
| 07 Rhythm & Timing | rhythm.pulse, rhythm.strum, rhythm.sixteenths, rhythm.syncopation, rhythm.triplets-swing, rhythm.dictation, rhythm.polyrhythm |
| 08 Ear Training | ear.basic, ear.sevenths, ear.cadences, ear.degrees, ear.bass-motion, ear.progression-dictation, ear.melody-dictation |
| 09 Improvisation | improv.targets, voice.guide-tones, improv.approach, improv.motif, improv.phrase |
| 10 Melody & Voice Leading | voice.common-tones, voice.guide-tones, triad.stringsets (inversion movement), improv.phrase (contour, tension) |
| 11 Song Analysis | analysis.progression, harmony.* (reading sets) |
| 12 Composition & Reharm | compose.progression, compose.melody-harmonize, compose.reharm, Progression Lab |

## Appendix B — Changes from v1

1. **Playing-centered outcomes.** Measurable can-do outcomes replace feature checklists as the definition of success.
2. **Hybrid practice.** Adds the At-the-guitar mode (tuner, monophonic pitch check, chord-change timer, strumming), bridge tasks and the Bridge Queue. The app is honest about what the microphone can verify.
3. **Guitar-specific content added:**
   - open strings (frets 0–12)
   - chord diagrams and fingerings
   - open chords
   - chord changes
   - strumming
   - barre chords
   - CAGED
   - scale positions
4. **A concrete lesson loop** replaces the abstract four stages: Learn → Recall → Locate → Hear → Apply → Play → Keep.
5. **A skill graph with three tiers** replaces 12 flat modules. Tier 1 is the MVP. A "Start Here" beginner pathway is added. All v1 topics are kept (Appendix A).
6. **One scheduler for all review items**, generalized from the existing fretboard ladder. Evidence levels separate recognition, recall, application and playing. Mastery states are defined.
7. **Error-specific feedback and adaptive difficulty** are now requirements.
8. **Habit design:** weekly goals, no punitive streaks, welcome-back planning and a Today screen with a 2-tap start.
9. **Construct types merged:** the three construction types become one; four new types are added.
10. **Records consolidated** into one section. Adds `PracticeSession`, `SelfReport`, `BridgeQueue` and a concrete migration plan from the current Dexie v3 database.
11. **A gap table and a phased roadmap**, both grounded in the existing codebase.
12. **Duplication removed:** sections that repeated records, scheduler and accessibility rules (v1 §7, §9, §12, §13, §18, §19) are merged.
