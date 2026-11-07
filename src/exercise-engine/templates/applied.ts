import { createRng, int, pick } from '../../lib/rng'
import { STANDARD, positionsOfPc, shapeById, type StringNumber } from '../../music-theory/guitar'
import { PC_SHARP, mod12 } from '../../music-theory/notes'
import type { ExerciseTemplate, FretLocateQuestion } from '../types'
import { questionBase } from './common'
import { fretItem } from './fretboard'

export const positionWindow: ExerciseTemplate = {
  id: 'fret.naturals.all.window', nodeId: 'fret.naturals.all', kind: 'fret-locate', version: 1, evidenceLevel: 'locate', stage: 'apply', title: '把位內找音',
  items: () => [6, 5, 4, 3, 2, 1].flatMap(s => [0, 2, 4, 5, 7, 9, 11].map(pc => fretItem(pc, s))),
  generate(seed, { difficulty, itemId }) {
    const rng = createRng(seed)
    const parsed = itemId ? /^fret\.note\.([A-G]#?)\.s([1-6])$/.exec(itemId) : null
    const string = (parsed ? Number(parsed[2]) : int(rng, 1, 6)) as StringNumber
    const pc = parsed ? PC_SHARP.indexOf(parsed[1] as typeof PC_SHARP[number]) : pick(rng, [0, 2, 4, 5, 7, 9, 11])
    const position = pick(rng, positionsOfPc(STANDARD, pc, 0, 12, [string]))
    const minFret = Math.max(0, Math.min(9, position.fret - int(rng, 0, 3)))
    return {
      ...questionBase(this, seed, difficulty), kind: 'fret-locate', tuning: [...STANDARD.midi], string,
      targetPc: pc, targetLabel: PC_SHARP[pc], minFret, maxFret: minFret + 3,
      prompt: `第 ${minFret}–${minFret + 3} 格之間，在第 ${string} 弦找出 ${PC_SHARP[pc]}`,
      reviewItemIds: [fretItem(pc, string)], explanation: `第 ${string} 弦第 ${position.fret} 格是 ${PC_SHARP[pc]}。練習用把位和定位點找音，而不是每次從空弦開始數。`,
    } satisfies FretLocateQuestion
  },
}

const SHAPES = ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm']
const tones = [{ degree: 1, semis: 0, name: '根音' }, { degree: 3, semis: 4, name: '三音' }, { degree: 5, semis: 7, name: '五音' }]
export const chordTones: ExerciseTemplate = {
  id: 'chord.open.tones', nodeId: 'chord.open', kind: 'fret-locate', version: 1, evidenceLevel: 'apply', stage: 'apply', title: '和弦中的音',
  items: () => SHAPES.flatMap(id => tones.map(t => `chord.tone.${id}.${t.degree}`)),
  generate(seed, { difficulty, itemId }) {
    const rng = createRng(seed)
    const parsed = itemId ? /^chord\.tone\.(\w+)\.([135])$/.exec(itemId) : null
    const shape = shapeById(parsed?.[1] ?? pick(rng, SHAPES))
    const tone = tones.find(t => t.degree === Number(parsed?.[2])) ?? pick(rng, tones)
    const roots: Record<string, number> = { C: 0, G: 7, D: 2, A: 9, E: 4, Am: 9, Em: 4, Dm: 2 }
    const semis = tone.degree === 3 && shape.id.endsWith('m') ? 3 : tone.semis
    const pc = mod12(roots[shape.id] + semis)
    const positions = shape.frets.flatMap((fret, index) => fret >= 0 ? [{ string: 6 - index, fret }] : [])
    return {
      ...questionBase(this, seed, difficulty), kind: 'fret-locate', tuning: [...STANDARD.midi], targetPc: pc, targetLabel: PC_SHARP[pc], minFret: 0, maxFret: 3,
      allowedPositions: positions, prompt: `在 ${shape.symbol} 和弦的指型中點出${tone.name} ${PC_SHARP[pc]}（任一個）`,
      reviewItemIds: [`chord.tone.${shape.id}.${tone.degree}`],
      display: { shapeId: shape.id, positions: positions.map(p => [p.string, p.fret, '·'] as [number, number, string]) },
      explanation: `${shape.symbol} 的${tone.name}是 ${PC_SHARP[pc]}。只接受這個和弦指型實際使用的位置；同一個和弦音可能在不同弦重複。`,
    } satisfies FretLocateQuestion
  },
}
