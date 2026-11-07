import { createRng, pick } from '../../lib/rng'
import { STANDARD, midiAt, positionsOfMidi, positionsOfPc } from '../../music-theory/guitar'
import { MAJOR_KEYS, scaleNotes } from '../../music-theory/keys'
import { displayNote, mod12, noteId, noteLabel, parseNote, pitchClass } from '../../music-theory/notes'
import type { ConstructQuestion, ExerciseTemplate, FretLocateQuestion, Question } from '../types'
import { questionBase } from './common'

export const SCALE_KEY_ORDER = ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab', 'B', 'Db', 'F#']
export const scaleItem = (tonic: string, degree: number, skill: 'locate' | 'name') => `scale.degree.${tonic}.${degree}.${skill}`
const OFFSETS = [0, 2, 4, 5, 7, 9, 11]
const handPositionMin = (fret: number) => fret <= 3 ? 0 : fret <= 6 ? 3 : fret <= 9 ? 6 : 9
export const scaleRelation = (q: Question) => q.scale ? `${displayNote(q.scale.tonic)} 大調 · 第 ${q.scale.degree} 級 = ${displayNote(q.scale.target)}` : ''

export const scalePractice: ExerciseTemplate[] = (['locate', 'name'] as const).map(skill => ({
  id: `scale.practice.${skill}`, nodeId: 'scale.major', kind: skill === 'locate' ? 'fret-locate' : 'construct',
  version: 1, evidenceLevel: skill === 'locate' ? 'locate' : 'recall', stage: skill === 'locate' ? 'locate' : 'recall',
  title: skill === 'locate' ? '找出音階級數' : '回想音階音名',
  items: () => [...MAJOR_KEYS.flatMap(tonic => [2, 3, 4, 5, 6, 7].map(degree => scaleItem(tonic, degree, skill))), ...(skill === 'name' ? ['spell.scale'] : [])],
  generate(seed, { difficulty, itemId }) {
    const rng = createRng(seed)
    const parts = itemId?.startsWith('scale.degree.') ? itemId.split('.') : []
    const tonic = MAJOR_KEYS.find(k => k === parts[2]) ?? pick(rng, SCALE_KEY_ORDER.slice(0, difficulty === 1 ? 1 : difficulty === 2 ? 5 : 12))
    const degree = [2, 3, 4, 5, 6, 7].includes(Number(parts[3])) ? Number(parts[3]) : pick(rng, [2, 3, 4, 5, 6, 7])
    const notes = scaleNotes(parseNote(tonic), 'major')
    const target = noteId(notes[degree - 1])
    const roots = positionsOfPc(STANDARD, pitchClass(parseNote(tonic)), 0, 10, [6, 5]).filter(p => {
      const min = handPositionMin(p.fret)
      return positionsOfMidi(STANDARD, midiAt(STANDARD, p.string, p.fret) + OFFSETS[degree - 1], min, min + 3).length > 0
    })
    const root = pick(rng, roots)
    const rootMidi = midiAt(STANDARD, root.string, root.fret)
    const targetMidi = rootMidi + OFFSETS[degree - 1]
    const scale = { tonic, mode: 'major' as const, degree, target, rootMidi, targetMidi }
    const base = {
      ...questionBase(this, seed, difficulty), scale,
      reviewItemIds: [scaleItem(tonic, degree, skill), ...(skill === 'name' ? ['spell.scale'] : [])],
      explanation: `${displayNote(tonic)} 大調：${notes.map((n, i) => `${i + 1}=${noteLabel(n)}`).join('、')}。主音算第 1 級；大調的半音間距是 2、2、1、2、2、2、1。`,
    }
    if (skill === 'name') return {
      ...base, kind: 'construct', prompt: `${displayNote(tonic)} 大調的第 ${degree} 級是什麼音？`,
      expected: [target], given: [tonic], ordered: true, spellingItemId: 'spell.scale',
      answerAudio: [{ notes: [rootMidi], duration: 0.6 }, { notes: [targetMidi], duration: 0.8 }],
    } satisfies ConstructQuestion
    // Prefer one compact hand position that also keeps the tonic visible on a phone.
    const localMin = handPositionMin(root.fret)
    const cost = (p: { string: number; fret: number }) =>
      (p.fret < localMin || p.fret > localMin + 3 ? 100 : 0) + Math.abs(p.fret - root.fret) + Math.abs(p.string - root.string) * 0.6
    const positions = positionsOfMidi(STANDARD, targetMidi).sort((a, b) => cost(a) - cost(b))
    return {
      ...base, kind: 'fret-locate', prompt: `${displayNote(tonic)} 大調：找出第 ${degree} 級`,
      tuning: [...STANDARD.midi], targetPc: mod12(targetMidi), targetMidi, targetLabel: displayNote(target),
      string: positions[0].string, minFret: 0, maxFret: 12,
      reference: { ...root, label: displayNote(tonic) }, display: { positions: [[root.string, root.fret, displayNote(tonic)]] },
    } satisfies FretLocateQuestion
  },
}))
