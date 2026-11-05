# Project: Guitar Lab — Interactive Guitar & Music Theory Learning Web App

## 0. Your Role and Mission

You are a senior full-stack frontend engineer, creative technologist, UI/UX designer, and music education software architect.

Build a production-ready, mobile-first interactive web application called **Guitar Lab**.

The application helps guitar players develop fretboard knowledge, music theory, harmonic understanding, ear training, improvisation skills, and composition skills through interactive exercises. Learning tracking is a core product capability: every completed practice attempt must be recoverable locally and inform specific skill feedback.

The primary use case is learning and practicing on a smartphone during commuting, **without having a physical guitar available**.

This is not a static music theory website or a simple collection of multiple-choice quizzes. It should be a highly interactive learning environment that connects music theory with fretboard visualization, musical sound, and practical guitar knowledge.

You are responsible for:

1. Planning the application architecture.
2. Implementing the complete frontend.
3. Building accurate, touch-friendly SVG fretboard and theory visualizations.
4. Implementing a reusable music theory engine.
5. Building real, functional learning exercises.
6. Designing a polished and responsive mobile interface.
7. Implementing reliable, structured local learning records and adaptive review.
8. Testing the application and correcting errors.
9. Preparing and pushing the project to GitHub.
10. Deploying the application to Cloudflare Pages and verifying the live website.

**Do not stop at generating a plan or mockup. Implement the application and make it functional.**

Use the available development tools, terminal, browser, GitHub integration, and Cloudflare tooling where authorized.

If an external account connection or authorization is necessary, request the minimum required user action. Never assume authentication has succeeded.

---

# 1. Product Philosophy

The central principle is:

**Understand music. Visualize it. Practice it. Apply it.**

The app should help users progress through four learning stages:

### Stage 1 — Understand

Learn what a musical concept means.

Example: What is a dominant seventh chord?

### Stage 2 — Recall

Retrieve the information from memory.

Example: What notes make up G7?

### Stage 3 — Visualize

Locate and understand those notes on a guitar fretboard.

Example: Find G, B, D, and F on the fretboard.

### Stage 4 — Apply

Use that knowledge in a musical context.

Example: Explain why G7 resolves to C, then choose good target notes when improvising over G7 → C.

These stages should connect across different learning modules.

Avoid isolated exercises that teach facts without meaningful musical application.

---

# 2. Target Users

Primary audience:

- Beginner to intermediate guitar players.
- Players who know common guitar chord shapes but struggle with music theory.
- Players who understand basic theory intellectually but cannot visualize it on the fretboard.
- Self-taught players interested in improvisation, composition, and songwriting.
- Users who want productive 3–10 minute learning sessions while commuting.

The app should also support more advanced concepts without overwhelming beginners.

### Language

Default interface language: Traditional Chinese (`zh-TW`).

Use English for standard music terminology where appropriate.

For example:

- 音程 / Interval
- 屬和弦 / Dominant Chord
- 導音 / Leading Tone
- 聲部進行 / Voice Leading

Provide concise explanations in Traditional Chinese.

Design the localization architecture so English and Japanese can be added later.

---

# 3. Technical Stack and Architecture

Use:

- React and TypeScript with strict typing
- Vite
- Tailwind CSS
- SVG for all interactive music visualizations
- Zustand for transient shared UI and session state
- Dexie over IndexedDB for persistent learning data
- Web Audio API or Tone.js for optional sound
- PWA support for installable, offline use
- Vitest for unit and integration tests
- Playwright for browser and mobile interaction tests
- GitHub for version control
- GitHub-connected Cloudflare Pages for static deployment

Use current stable, compatible package versions. Do not use Three.js, React Three Fiber, Drei, Canvas-based rendering, or WebGL for the fretboard, circle of fifths, chord diagrams, scale displays, or note selection. Render those interfaces with React and SVG; use semantic HTML for controls, text, and accessible alternatives.

Keep the application static and local-first. Music theory calculations, curriculum content, question generation, validation, progress recording, and recommendations must run on-device without a network connection. Do not add authentication, Cloudflare D1, backend APIs, or external AI dependencies in v1.

Separate the pure TypeScript music theory engine, exercise engine, recommendation logic, SVG components, audio, and storage. UI and exercise logic should depend on a typed learning-data repository interface, with Dexie as its v1 implementation. This boundary should permit a future synchronization adapter without changing exercise generation or screens. Do not build speculative sync infrastructure in v1.

Product priority, in order: **music theory correctness; mobile learning experience; functional exercise interactions; reliable learning records; adaptive practice; visual polish**.

---

# 4. UX and Visual Design

Create a modern, polished educational application with a high-quality visual identity.

Design direction:

- Minimal and contemporary.
- Inspired by creative software tools rather than children's educational games.
- Visually precise, interactive, and satisfying.
- Clean typography with generous spacing.
- Dark mode as the default theme.
- Optional light mode.
- Subtle animations and micro-interactions.
- Clear hierarchy and accessible contrast.
- Avoid excessive gradients, glassmorphism, or distracting decoration.

### Mobile-first requirements

Design for portrait smartphone use first.

Target widths approximately 320–430 CSS pixels, while remaining responsive on tablets and desktop.

Requirements:

- Comfortable one-handed operation.
- Large touch targets, ideally at least 44 × 44 CSS pixels.
- Bottom navigation for primary sections.
- No mandatory hover interactions.
- Respect safe-area insets.
- Avoid accidental page scrolling during fretboard interaction.
- No horizontal page overflow.
- Support touch, pointer, and keyboard interactions.
- Avoid requiring precise finger placement for small fretboard elements.
- Offer zoom or focused-string modes when necessary.
- Support short sessions that can be interrupted at any time.

The user should be able to open the app and start practicing within a few seconds.

---

# 5. Application Navigation

Create the following main sections.

### Home

Dashboard showing:

- Continue learning
- Recommended exercises
- Quick Practice
- Current learning goals
- Recent activity
- Weak topics
- Progress overview

### Explore

Browse all learning modules and topics.

Organize them by subject, skill level, and learning pathway.

### Practice

Start an exercise session with configurable settings.

### Progress

Display progress, mastery, review recommendations, and learning history.

### Settings

Configure:

- Language
- Theme
- Audio
- Guitar tuning
- Note naming preferences
- Preferred difficulty
- Practice duration
- Left-handed display preference
- Data export/import

---

# 6. Complete Learning Curriculum

Implement a curriculum system covering the following twelve domains.

Each domain must contain multiple topics with metadata:

- ID
- Title
- Description
- Difficulty
- Prerequisites
- Learning objectives
- Explanation content
- Exercise types
- Estimated practice time
- Related topics

## Module 01 — Fretboard Knowledge

Topics:

1. Standard guitar tuning: E A D G B E
2. Natural note positions
3. Sharps, flats, and enharmonic equivalents
4. Notes across all six strings
5. Octave patterns
6. Find all occurrences of a given note
7. Root note identification
8. Interval shapes on the fretboard
9. Position-based note recognition
10. Alternative tuning foundations

Exercise examples:

- Identify the note at string 5, fret 7.
- Find all C notes between frets 0 and 12.
- Locate the nearest octave of a selected note.
- Find the major third above a specified fretboard position.

Support selecting the active string range and fret range.

## Module 02 — Intervals

Topics:

1. Semitones and whole tones
2. Major and minor seconds
3. Major and minor thirds
4. Perfect fourths and fifths
5. Tritones
6. Major and minor sixths
7. Major and minor sevenths
8. Octaves
9. Interval inversion
10. Compound intervals

Exercises:

- Calculate intervals between two notes.
- Find a specified interval on the fretboard.
- Construct a target note from a root and interval.
- Recognize intervals by ear.
- Compare interval shapes across strings.

## Module 03 — Scales and Modes

Topics:

1. Major scale
2. Natural minor scale
3. Harmonic minor
4. Melodic minor
5. Major pentatonic
6. Minor pentatonic
7. Blues scale
8. Ionian
9. Dorian
10. Phrygian
11. Lydian
12. Mixolydian
13. Aeolian
14. Locrian
15. Scale degrees
16. Characteristic tones
17. Scale patterns across the fretboard

Exercises:

- Construct a major scale.
- Identify missing scale notes.
- Select all notes belonging to a scale on the fretboard.
- Compare major and minor pentatonic.
- Identify the characteristic note of a mode.
- Practice scale degrees relative to a tonic.

## Module 04 — Chord Construction

Topics:

1. Major triads
2. Minor triads
3. Diminished triads
4. Augmented triads
5. Major seventh chords
6. Minor seventh chords
7. Dominant seventh chords
8. Half-diminished seventh chords
9. Fully diminished seventh chords
10. Suspended chords
11. Add9 and other added-tone chords
12. Sixth chords
13. Extended chords: 9, 11, 13
14. Inversions
15. Slash chords
16. Close and open voicings
17. Drop voicings
18. Triads on adjacent string sets
19. Chord tones across the fretboard

Exercise examples:

- Build Dm7 from its intervals.
- Identify the notes in F#m7♭5.
- Explain the difference between G and Gsus4.
- Identify the bass note in G/B.
- Find a C major triad using only strings 1–3.
- Convert a root-position triad into first inversion.

## Module 05 — Keys and Circle of Fifths

Topics:

1. Major keys
2. Minor keys
3. Key signatures
4. Circle of fifths
5. Relative major and minor
6. Parallel major and minor
7. Diatonic chord construction
8. Key relationships
9. Transposition
10. Basic modulation

Exercises:

- Identify the fifth of a selected note.
- Navigate the interactive circle of fifths.
- Identify the key signature of D major.
- Find the relative minor of G major.
- Generate all diatonic triads in a selected key.
- Transpose a chord progression to another key.

The circle of fifths should be fully interactive.

## Module 06 — Harmony and Chord Progressions

Topics:

1. Roman numeral analysis
2. Tonic function
3. Predominant function
4. Dominant function
5. Authentic and half cadences
6. Plagal cadences
7. Common pop chord progressions
8. ii–V–I
9. Circle progressions
10. Secondary dominants
11. Secondary leading-tone chords
12. Leading tones and resolution
13. Modal mixture and borrowed chords
14. Voice leading
15. Common-tone movement
16. Bass-line movement
17. Harmonic rhythm
18. Tritone substitution
19. Tonicization and modulation

Exercises:

- Identify the Roman numerals of a progression.
- Complete D7 → G7 → ? in C major.
- Explain why E7 often leads to Am.
- Find the borrowed chord in F → Fm → C.
- Identify the guide-tone movement in G7 → Cmaj7.
- Compare two valid chord progressions.

Important: harmonic analysis must support ambiguity.

Do not assume every chord has only one possible interpretation.

Distinguish theoretical facts from context-dependent analysis.

## Module 07 — Rhythm and Timing

Topics:

1. Note durations
2. Time signatures
3. Subdivisions
4. Dotted rhythms
5. Triplets
6. Syncopation
7. Swing and shuffle
8. Accent placement
9. Rhythmic dictation
10. Basic polyrhythms

Exercises:

- Tap along with a metronome.
- Identify rhythmic patterns.
- Reconstruct a played rhythm.
- Place notes on a rhythmic grid.
- Identify subdivisions.

Account for mobile touch/audio latency.

Do not present raw touch timing as a scientifically precise measurement without calibration.

## Module 08 — Ear Training

Topics:

1. Melodic interval recognition
2. Harmonic interval recognition
3. Major/minor chord recognition
4. Seventh chord recognition
5. Scale-degree recognition
6. Cadence recognition
7. Bass movement recognition
8. Chord progression recognition
9. Short melody dictation
10. Rhythm dictation

Provide replay, slower playback where musically appropriate, and controlled audio examples.

Audio must be optional.

Users should be able to practice other modules with sound disabled.

## Module 09 — Improvisation Theory

Topics:

1. Chord tones
2. Non-chord tones
3. Pentatonic application
4. Target notes
5. Thirds and sevenths
6. Approach notes
7. Passing tones
8. Enclosures
9. Guide-tone lines
10. Motif development
11. Phrase construction
12. Call and response

Exercises:

- Select appropriate target notes over G7 → Cmaj7.
- Construct a simple melody over ii–V–I.
- Identify strong and weak resolution choices.
- Create a four-note phrase.
- Connect chord tones across a progression.

Do not treat improvisation as merely selecting notes from a scale.

Explain harmonic context and melodic choices.

## Module 10 — Melody and Voice Leading

Topics:

1. Melodic contour
2. Common tones
3. Stepwise motion
4. Chromatic approach
5. Guide tones
6. Chord inversion movement
7. Minimal voice movement
8. Melodic tension and resolution
9. Two-voice counterpoint basics

Exercises:

- Find the smallest note movement between two chords.
- Select a smoother inversion.
- Resolve the seventh of G7.
- Build a descending guide-tone melody.

## Module 11 — Song Analysis

Topics:

1. Key identification
2. Roman numeral analysis
3. Progression recognition
4. Section comparison
5. Non-diatonic chord interpretation
6. Bass movement
7. Voice leading
8. Cadences and harmonic resolution

Support curated example progressions and user-entered chord progressions.

Include useful built-in examples such as:

- G → D → Cmaj7
- Cmaj7 → Em7 → D
- C → G/B → Am → Fmaj7
- Dm7 → G7 → Cmaj7
- F → Fm → C
- E7 → Am
- D7 → G7 → C

Use original educational explanations.

Do not include copyrighted full lyrics, recordings, or unauthorized sheet-music assets.

## Module 12 — Composition and Reharmonization

Topics:

1. Create a four-chord progression
2. Build an eight-bar progression
3. Select chords for a melody
4. Chord substitution
5. Secondary dominant insertion
6. Borrowed chord application
7. Bass movement design
8. Inversion selection
9. Reharmonization
10. Creating melodic tension and resolution

Provide a small interactive chord progression editor.

Allow users to construct, edit, play, transpose, and save their own progressions.

---

# 7. Exercise Engine Architecture

Build a reusable, extensible exercise engine. Define each supported exercise type with a deterministic question generator, serializable question definition (or reproducible seed plus generator version), answer schema, validator, feedback and explanation generator, difficulty metadata, and skill tags. Keep validation independent of the React view and Dexie implementation.

Required exercise types to support across the curriculum:

1. Multiple Choice
2. Multi-select
3. Fretboard Note Identification
4. Fretboard Position Selection
5. Chord Construction
6. Interval Construction
7. Scale Construction
8. Roman Numeral Identification
9. Chord Progression Completion
10. Drag-and-Drop Ordering, with a tap/keyboard alternative
11. Circle of Fifths Interaction
12. Audio Recognition
13. Rhythm Tapping
14. Melody Note Selection
15. Chord Progression Editor

Prioritize implementation quality over superficial coverage. Every exercise presented as available must provide a prompt, real input, validation, immediate feedback, an accurate explanation, retry, next question, difficulty and topic metadata, and persisted attempt records. Include more than one question template per supported topic, using generated questions where suitable. Mark unavailable exercises honestly; do not show decorative controls or claim a module is complete because its topic list exists.

Each submitted attempt must record the exercise type, topic ID, question definition or reproducible seed and generator version, user response, expected answer, correctness, response time when meaningful, timestamp, session ID, difficulty, and specific skill tags. Record retries as distinct attempts with their retry relationship. Validate responses against the original question definition, not regenerated mutable UI state. If storage fails, preserve the in-memory result, show a clear warning, and offer retry/export rather than silently claiming it was saved.

Record exploratory actions separately from graded recall attempts. Exploration must not reduce mastery. A skipped or interrupted question must not be recorded as an incorrect answer. Speed can inform session feedback when meaningful, but correctness and demonstrated understanding determine mastery.

---

# 8. Music Theory Engine

Create a pure TypeScript music theory engine independent of React, SVG, audio, state management, and persistence.

It must support:

### Notes

- Chromatic pitch classes, octaves, MIDI note numbers, and frequencies
- Enharmonic spelling and key-aware note spelling

### Intervals

- Generic diatonic intervals, interval quality, semitone distance, direction, and inversion

### Scales

- Scale formulas, key-specific spelling, modes, and scale degrees

### Chords

- Triads, seventh chords, extensions, alterations, suspensions, inversions, slash chords, and identification from note sets

### Harmony

- Diatonic chord generation, Roman numerals, secondary dominants, common functions, basic voice-leading calculations, and progression transposition

### Guitar

- Standard and configured tunings, string/fret-to-note mapping, note-to-position mapping, octave relationships, intervals between positions, and chord tone locations

Use deterministic, testable functions. Keep pitch identity, written spelling, and harmonic interpretation distinct. For example, F#m7♭5 = F# A C E; Cmaj7 = C E G B; G7 = G B D F; Gsus4 = G C D. In C major, D7 can function as V7/V and Fm can be analyzed as borrowed iv. Those harmonic labels depend on context; do not imply a unique interpretation when several are valid. Add unit tests for spelling, edge cases, and context-dependent analysis.

---

# 9. Interactive SVG Guitar Fretboard

Create one reusable React/TypeScript SVG fretboard used by exercises and explorers. SVG is the primary rendering and interaction layer on every device; no 3D mode or WebGL fallback is needed.

### Display

- Six strings, configurable tuning, and frets 1–12 in the default practice view
- Accurate string order, nut, fret positions, markers, string/fret labels, and left-handed display option
- Readable note labels and selected-position indicators at 320–430 CSS-pixel widths
- Root, interval, scale-degree, and chord-tone indicators with text or shapes in addition to color
- Horizontal desktop and vertical mobile layout showing frets 1–12 together, without horizontal paging on phones
- Wood and fret wires bounded by the first and sixth strings, with single inlays at frets 3, 5, 7, 9 and double inlays at fret 12
- SVG chord diagrams and scale overlays generated from the same music theory data

Use a stable coordinate model that maps each string/fret position to a generous hit region. Keep hit regions at least about 44 × 44 CSS pixels where practical and verify adjacent-fret selection on small phones. Fit the full 1–12 layout above the mobile navigation where feasible. Avoid tiny overlapping targets and accidental sideways page scrolling.

### Interaction

Users must be able to tap or keyboard-select a position, select multiple positions, reveal/hide note labels, highlight pitch classes, intervals, scales and chord tones, change supported tunings, and play selected notes when audio is enabled. Provide visible focus, clear selection state, and a semantic position list or grid for screen readers. Use SVG pointer events with explicit hit targets and a single logical position model; do not rely on hover or pixel-color hit testing.

Provide one-note practice that asks learners to find every position of a chosen pitch class. Random review prompts a note on a specific string to prevent repeated use of a familiar position. Track all 72 note-and-string combinations across frets 1–12, and prioritize missed, overdue, and unseen combinations with deterministic 1/3/7/14/30-day intervals. A correct answer after a miss should return for a short recheck before a full-day interval. Give broad fret-region hints after wrong answers. Record each answer with target note and position, selected string and fret, correctness, elapsed time, and timestamp. Do not grade based on speed; allow learners to skip a random prompt without a penalty.

Keep rendering lightweight: no permanent animation loop, GPU resource management, or camera controls. Handle resize and orientation changes, and preserve legibility at device zoom and high text scaling. Test the component with touch, mouse, and keyboard input.

---

# 10. Interactive SVG Circle of Fifths

Create a reusable React/TypeScript SVG circle-of-fifths visualization with generous touch targets and an accessible key list. Display twelve pitch classes, major and relative minor keys, key signatures, adjacent fifth relationships, related keys, diatonic chords, and secondary dominant relationships. Keep theoretical labels and enharmonic spelling correct for the selected key.

Example interaction:

1. User selects C major.
2. App highlights G as its dominant.
3. User selects G.
4. App identifies D as G's dominant.
5. App visualizes D7 → G7 → C.

The user should be able to inspect the relationship through touch or keyboard input and receive a concise explanation. Use the shared theory engine for calculations; the SVG should only render and capture interaction.

---

# 11. Chord and Scale Explorer

Create a dedicated interactive explorer.

Users can select:

- Root
- Chord or scale type
- Inversion
- Fret range
- String set

The SVG fretboard and chord/scale diagrams update immediately.

Examples:

- Select C major → highlight C E G on the SVG fretboard and chord diagram.
- Select Cmaj7 → highlight C E G B.
- Select Dm7 → highlight D F A C.
- Select G Mixolydian → highlight G A B C D E F.

Provide:

- Note list
- Interval formula
- Relevant theoretical explanation
- Audio preview
- Optional degree labels
- Relationship to the current key

Make this useful both as an educational tool and as an exploration environment.

---

# 12. Practice Session System

Support Free Practice and Guided Practice. Free Practice lets users choose any topic, key, difficulty, exercise type, question count, and audio setting, including topics outside recommendations. Guided Practice offers approximately 3-, 5-, and 10-minute sessions plus a custom duration, selecting exercises from due reviews, missed skills, and prerequisites.

Create a practice-session record when a session starts and update it when completed, paused, or abandoned. Link each graded attempt to its session. Persist enough state to resume an interrupted short session without double-counting an attempt. A session summary should show accuracy, average response time only where meaningful, topics practiced, specific recurring mistakes, review changes, and a suggested next exercise. Speed must not reward random guessing or excessively penalize thoughtful responses.

Example five-minute session: fretboard recall, interval identification, chord construction, harmonic function, and application. Recommendations guide the session but never lock free topic selection.

---

# 13. Adaptive Practice and Spaced Repetition

Implement a deterministic, explainable local review scheduler. Topic mastery and skill weakness are separate records: a topic can be broadly familiar while a specific string, fret region, note, exercise type, or theory concept remains weak. Use stable skill IDs so historical attempts can be aggregated after UI changes.

For fretboard work, tag and aggregate attempts by string, exact fret position, target note, tuning, and exercise type; broader fret-region summaries may be derived from those records. For theory work, tag concepts such as interval quality, chord construction, Roman numeral analysis, secondary dominants, and relevant key context. Avoid treating a single miss as permanent weakness; show sample counts and recent evidence.

Use a documented rule-based scheduler, for example:

- Initial successful recall: review in 1 day. Repeated successful reviews expand the interval to 3, 7, 14, then 30 days (with a sensible cap).
- Incorrect graded recall: shorten the interval to the next day and raise the skill's priority. A retry that succeeds records recovery but does not erase the original miss.
- A late review remains due until a graded response is submitted. Skips, ungraded exploration, and aborted sessions do not change mastery or the schedule.
- Rank available recommendations by overdue status, recent error rate with minimum evidence, and weakness in prerequisites. Break ties deterministically; show a short reason such as “Due today” or “Missed 3 of the last 5 interval questions.”

These intervals are defaults, not a claim of scientific optimization. Store scheduler version and enough attempt history to recompute mastery. Never use raw response time as a major penalty. Let users select any topic, start a free session, or dismiss a recommendation without a mastery penalty.

---

# 14. Learning Content and Explanations

All major concepts must have concise educational content.

Each topic should ideally include:

1. Definition
2. Why it matters
3. Example
4. Interactive visualization
5. Practice exercise
6. Common mistake
7. Related concepts

Explain concepts in approachable Traditional Chinese.

Avoid oversimplified or misleading statements.

Examples:

- A leading tone is specifically the scale degree a semitone below the tonic in tonal context, rather than every note that happens to be a semitone below another note.
- Dominant can refer to scale degree V, a dominant-function harmony, or a dominant-seventh chord quality. These are related but distinct concepts.
- A borrowed chord is an analytical interpretation, not proof of the composer's intention.
- The circle of fifths describes relationships; it does not prescribe a mandatory chord sequence.
- Not every dissonance must resolve identically in every musical style.

When harmonic analysis is ambiguous, explain the most useful interpretation without pretending it is the only possible one.

---

# 15. Audio System

Implement a reusable audio engine.

Requirements:

- Play individual notes.
- Play intervals.
- Play triads and seventh chords.
- Play arpeggios.
- Play chord progressions.
- Allow tempo configuration.
- Support chord and note durations.
- Support mute mode.

A simple synthesized sound is acceptable initially.

Prefer a musically pleasant electric-piano, plucked-string, or guitar-like timbre.

Avoid requiring large external sample libraries unless they materially improve the result.

Handle mobile browser audio restrictions correctly.

Audio must start only after an appropriate user interaction.

Manage audio scheduling, cancellation, and cleanup.

Do not allow overlapping playback to accumulate unexpectedly.

---

# 16. Song and Progression Lab

Create a chord progression workspace.

Users should be able to:

- Select a key.
- Add chords.
- Rearrange chords.
- Set chord duration.
- Play a progression.
- View Roman numerals.
- Highlight chord tones on the fretboard.
- Examine common notes and voice leading.
- Transpose the entire progression.
- Save custom progressions locally.

Include a few original educational example progressions.

Example:

Cmaj7 → Am7 → Dm7 → G7

Visualize:

Imaj7 → vi7 → ii7 → V7

Allow users to inspect how each chord relates to the key.

Do not generate unsupported harmonic explanations.

For complex or ambiguous progressions, distinguish deterministic calculations from interpretive commentary.

---

# 17. Learning Pathways

Alongside free module selection, provide four optional learning pathways.

### Path A — Fretboard Mastery

Notes → Octaves → Intervals → Triads → Chord Tones → Scale Positions

### Path B — Harmony Understanding

Keys → Diatonic Chords → Functional Harmony → Secondary Dominants → Borrowed Chords → Voice Leading

### Path C — Improvisation Foundations

Intervals → Scales → Chord Tones → Target Notes → Phrase Construction

### Path D — Composition and Song Analysis

Roman Numerals → Progressions → Cadences → Voice Leading → Chord Substitution → Reharmonization

A user should be able to explore any pathway or switch between them.

Track pathway progress separately from topic mastery.

---

# 18. Learning Data, Safety, and Offline Functionality

The app works without accounts. Dexie/IndexedDB is the source of truth for local learning data; Zustand holds ephemeral UI state and current-session state, not the only copy of a completed attempt.

### Required records

- **PracticeSession:** ID, mode, settings, start/end timestamps, status, and summary fields.
- **ExerciseAttempt:** ID, session ID, exercise type, topic ID, generator version and serialized question or seed, response, expected answer, correctness, meaningful response time, timestamp, difficulty, skill IDs, and retry link when applicable.
- **TopicMastery:** topic ID, evidence counts, recent accuracy, mastery estimate, last practiced time, and calculation version.
- **SkillWeakness:** stable skill ID, dimensions (such as string, exact fret position, note, exercise type, or theory concept), evidence counts, recent misses, and last observed time.
- **ReviewSchedule:** topic/skill target ID, due time, interval, successful-review streak, last review time, and scheduler version.
- **UserPreference:** language, theme, audio, tuning, note naming, difficulty, duration, and left-handed display choices.
- **SavedChordProgression:** ID, name, key/context, ordered chords with durations, timestamps, and schema version.
- **PathwayProgress:** pathway ID, completed topic IDs, and last update time, distinct from topic mastery.

Use explicit Dexie schema versions and migrations. Migration tests must cover upgrading representative older databases without losing attempt history or saved progressions. Derived mastery/weakness data may be rebuilt from attempts; never discard the underlying attempts during a routine upgrade.

Define a typed `LearningRepository` interface for reading/writing records and performing atomic attempt-plus-review updates. The Dexie adapter must use transactions where several records must change together. Keep question generation and validation unaware of Dexie. Future cloud synchronization should be possible through an adapter and stable record IDs, with conflict policy designed when sync is actually introduced.

### Backup and failure handling

Provide versioned JSON export and import for all user-owned records. Validate the import envelope, schema version, record types, IDs, timestamps, references, size limits, and nested question/response payloads before writing. Reject malformed or unsupported backups with actionable errors; show a preview and require a deliberate replace-or-merge choice. Import atomically where possible and preserve a pre-import backup when replacing data. Do not evaluate imported content as code or render it as unsanitized HTML.

Detect and report IndexedDB denial, quota, migration, and transaction failures. Never silently lose an answer or claim persistence after a failed write. Offer export/retry and explain when data is only in memory. Request persistent storage through `navigator.storage.persist()` when supported after a suitable user gesture, without blocking practice if the browser denies it.

The PWA must provide an offline application shell, bundled curriculum and exercise generation, optional local audio, and local progress storage. Handle service-worker updates without clearing IndexedDB or interrupting an active session. Installation and storage persistence are browser-dependent; show their actual state accurately.

---

# 19. Accessibility

Use semantic HTML for navigation and controls and accessible names for SVG interactive regions. Support keyboard traversal and activation for every major exercise, including fretboard and circle-of-fifths positions. Provide a screen-reader-compatible fretboard position grid or list. Do not convey note function or correctness through color alone. Provide sufficient contrast, reduced-motion support, visible focus, clear textual answer feedback, suitable mobile touch targets, and no mandatory audio for non-audio learning activities. Give drag-and-drop exercises a tap or keyboard alternative.

---

# 20. Suggested Project Architecture

Use a scalable structure similar to:

```text
src/
  app/                 # navigation, routes, PWA integration
  components/
    ui/
    layout/
    fretboard/         # shared React + SVG fretboard
    visualizations/    # SVG circle, chord diagrams, scale views
    exercises/
  modules/             # twelve curriculum domains and lesson content
  music-theory/        # pure notes, intervals, scales, chords, harmony, guitar
  exercise-engine/     # generators, validators, feedback, skill tags
  learning/            # mastery, weakness aggregation, review scheduling
  audio/
  curriculum/
  stores/              # transient Zustand state
  database/            # Dexie schema, migrations, repository adapter, backups
  hooks/
  i18n/
  styles/
  tests/
```

This is a suggested layout, not a mandatory exact directory structure. Keep theory and exercise logic testable without UI or storage. React components receive typed data and callbacks; SVG rendering does not contain music theory calculations. Keep abstractions proportional to actual use.

---

# 21. Testing and Quality Requirements

Use Vitest for pure logic and storage integration tests and Playwright for browser flows. Include meaningful tests for:

- Theory: note/fret mapping, key-aware spelling and enharmonic cases, intervals, scales, chords, inversions, diatonic harmony, transposition, secondary dominants, and ambiguity-aware analyses.
- Exercises: deterministic question reproduction, answer validation, multi-select equivalence, difficulty, feedback, skill tagging, retries, and interrupted sessions.
- Learning data: attempt/session writes, per-string/fret/note and per-concept aggregation, overdue/prerequisite recommendation ordering, no penalty for exploration or skips, and scheduler version behavior.
- Data safety: Dexie migrations from older fixtures, failed writes, JSON export/import round trips, malformed and oversized backup rejection, transactional import, and pre-import backup preservation.
- Browser flows: navigation, real answer submission and feedback, session completion and resume, persistent history across reloads, fretboard touch selection, chord explorer, circle interaction, optional audio initialization, and offline use where testable.
- Accessibility and mobile: keyboard alternatives, readable SVG labels and hit targets, no horizontal overflow, and representative viewports of 320 × 568, 375 × 812, 390 × 844, and 430 × 932, plus tablet and desktop.

Before deployment, TypeScript checking, production build, unit tests, and critical Playwright flows must pass. Inspect runtime errors and verify there are no broken routes or placeholder screens presented as completed features. Test live deployment after publishing.

---

# 22. Development Strategy

Implement in phases without sacrificing correctness or reliable records. All twelve domains remain in the curriculum model and navigation, with clear availability states for lessons and exercises.

## Phase 1 — Foundation

- Inspect and preserve useful current work. If the repository is a Three.js template, remove Three.js, React Three Fiber, Drei, WebGL-only code, and obsolete dependencies before building the new experience.
- Initialize React/TypeScript/Vite/Tailwind, navigation, localization, and the mobile design system.
- Implement the pure music theory engine and twelve-domain curriculum metadata.
- Implement the Dexie schema, migrations, repository interface, backup import/export, and storage-error behavior.
- Implement the exercise contract and attempt recording before shipping exercises.

## Phase 2 — Core Interactive Experience

Complete and test the SVG fretboard, fretboard recall, interval trainer, chord builder, key and scale trainer, SVG circle of fifths, and basic harmony trainer. Wire all completed attempts to the learning repository.

## Phase 3 — Musical Application and Adaptive Practice

Add the audio engine, basic ear training, progression explorer, voice-leading and chord-tone exercises, guided sessions, per-skill analysis, review schedules, and transparent recommendations.

## Phase 4 — Extended Learning

Complete rhythm, improvisation, melody construction, song analysis, composition and reharmonization, and advanced harmony exercises as functional interactions. Keep unavailable content clearly labeled until it meets the exercise contract.

## Phase 5 — Quality and Deployment

Review mobile usability, accessibility, performance, backup recovery, migrations, offline behavior, and automated tests. Commit and push the project to GitHub, then deploy and verify through GitHub-connected Cloudflare Pages.

Document what is functional, partial, and unavailable. Do not claim complete coverage based on visual screens or topic metadata alone.

---

# 23. GitHub and Cloudflare Pages Deployment

Deployment is part of the task, not an optional afterthought.

Use a **GitHub-connected Cloudflare Pages project**, so future pushes to the production branch trigger automatic deployments.

Do not substitute Cloudflare Workers for Pages without a technical reason and explicit explanation.

### Repository

Preferred repository name:

`guitar-lab`

Use the existing repository if the current working directory is already connected to the intended repository.

Otherwise, create a new repository through available authorized GitHub tooling.

Ensure:

- A useful README.
- A correct `.gitignore`.
- A committed package lockfile.
- No committed secrets.
- Meaningful initial commits.
- A clean main branch.

### Build configuration

For this React + Vite static application:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`

Ensure that the app works when deployed as a Cloudflare Pages static site.

Use appropriate SPA routing behavior.

If additional routing configuration is needed, include it.

### Deployment workflow

1. Verify all required local checks.
2. Commit the completed changes.
3. Push to the authorized GitHub repository.
4. Check whether a Cloudflare Pages project already exists for this repository.
5. If none exists, create a new Git-connected Cloudflare Pages project when authorized.
6. Configure the correct production branch and build settings.
7. Deploy.
8. Inspect deployment logs.
9. Open the public deployment URL.
10. Verify that the homepage and critical interactive features work on the deployed version.

Use the appropriate available Cloudflare authentication mechanism.

If the Cloudflare Pages project must be linked manually, provide exact dashboard instructions and continue any remaining automatable steps afterward.

Never expose API tokens or credentials.

Never claim that deployment succeeded until the live URL has been verified.

### Required final delivery

Provide:

- GitHub repository URL.
- Live Cloudflare Pages URL.
- Summary of completed features.
- Test results.
- Known limitations.
- Instructions for local development.
- Instructions for future deployments.

If GitHub or Cloudflare authorization is unavailable, complete and test the local project, then clearly identify the blocked external action and the precise steps necessary to finish deployment.

---

# 24. Definition of Done

The project is successfully delivered when:

1. It is a functional, responsive React + TypeScript application using SVG for all core music visualizations, with no Three.js, React Three Fiber, Drei, or WebGL dependency.
2. Navigation works and the curriculum includes all twelve domains with accurate availability labels.
3. Available exercises accept real input, validate it, explain the answer, and support retry and continuation.
4. The fretboard and circle of fifths work reliably with touch and keyboard input on representative phones.
5. The music theory engine passes correctness and spelling tests.
6. Every graded attempt, session, topic mastery update, skill weakness, and review schedule persists through the Dexie repository and survives reload.
7. Recommendations are deterministic, explainable, and overridable; free topic selection is always available.
8. JSON backup export/import is validated; schema migrations and storage failure states are tested.
9. The interface is comfortable for short phone sessions, accessible, and usable offline where supported.
10. TypeScript, build, Vitest, and critical Playwright checks pass.
11. The repository is pushed to GitHub and the GitHub-connected Cloudflare Pages site is deployed and checked live.

Do not substitute screenshots, design prototypes, or decorative exercise controls for working functionality.

---

# 25. Final Instructions

Inspect the current working directory, repository state, package configuration, and authorized deployment tooling. Preserve useful code, but remove legacy 3D/WebGL dependencies and interactions that conflict with this SVG-first specification.

Make a brief implementation plan and execute it. Make reasonable technical and design decisions autonomously. Prioritize music theory correctness, mobile usability, functional exercises, reliable records, adaptive practice, then polish. Build a cohesive product that users can practice with daily on a phone.

Proceed with implementation, testing, GitHub integration, and GitHub-connected Cloudflare Pages deployment as far as available authorization permits. Never claim an unverified feature or deployment is complete. The final delivery should state the repository and live URLs, tests run, known limitations, local development steps, and how future pushes deploy.

---
