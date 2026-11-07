import { scalePractice } from './templates/scalePractice'
import { chordTones, positionWindow } from './templates/applied'
import { fretAccidentals, fretNaturalsAll, fretNaturalsLow, fretOctaves, fretOpen, intervalShapes } from './templates/fretboard'
import { chordDiagram, chordOpen, earBasic, rhythmPulse, rhythmStrum } from './templates/practical'
import { harmonyBasic, intervalBasics, keyDiatonic, scaleMajor, triadBasic } from './templates/theory'
import type { Difficulty, ExerciseTemplate, Question } from './types'

export const TEMPLATES: readonly ExerciseTemplate[] = [
  chordTones, positionWindow,
  ...fretOpen, ...fretNaturalsLow, ...fretNaturalsAll, ...fretAccidentals, ...fretOctaves, ...intervalShapes, ...scalePractice,
  ...intervalBasics, ...triadBasic, ...scaleMajor, ...keyDiatonic, ...harmonyBasic,
  ...chordDiagram, ...chordOpen, ...rhythmPulse, ...rhythmStrum, ...earBasic,
]

const byId = new Map(TEMPLATES.map(t => [t.id, t]))

export function templateById(id: string): ExerciseTemplate {
  const template = byId.get(id)
  if (!template) throw new Error(`Unknown exercise template ${id}`)
  return template
}

export const templatesForNode = (nodeId: string) => TEMPLATES.filter(t => t.nodeId === nodeId)

/** All review items a node can produce (its mastery universe), excluding shared spelling items. */
export function nodeItems(nodeId: string): string[] {
  return [...new Set(templatesForNode(nodeId).flatMap(t => t.items()))].filter(id => !id.startsWith('spell.'))
}

/** Templates able to produce a question for a given review item (first = preferred). */
let itemIndex: Map<string, ExerciseTemplate[]> | undefined
export function templatesForItem(itemId: string): ExerciseTemplate[] {
  if (!itemIndex) {
    itemIndex = new Map()
    for (const template of TEMPLATES) for (const id of template.items()) itemIndex.set(id, [...(itemIndex.get(id) ?? []), template])
  }
  return itemIndex.get(itemId) ?? []
}

export function generate(templateId: string, seed: number, difficulty: Difficulty, itemId?: string): Question {
  return templateById(templateId).generate(seed, { difficulty, itemId })
}


export function supportedInputs(template: ExerciseTemplate): readonly ('tap' | 'keyboard' | 'microphone')[] {
  return template.supportedInputs ?? (template.kind === 'fret-locate' ? ['tap', 'keyboard', 'microphone'] : ['tap', 'keyboard'])
}
