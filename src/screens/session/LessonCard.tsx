import { ChordDiagram } from '../../components/diagram/ChordDiagram'
import { Fretboard } from '../../components/fretboard/Fretboard'
import { PatternGrid } from '../../components/rhythm/RhythmPad'
import type { SkillNode } from '../../curriculum/nodes'
import { shapeById, STANDARD } from '../../music-theory/guitar'

/** Learn stage: definition, why it matters, worked example, visual, common mistake. */
export function LessonContentView({ node, layout = 'vertical' }: { node: SkillNode; layout?: 'vertical' | 'horizontal' }) {
  const c = node.content
  if (!c) return null
  return <div className="lesson-content">
    <section><h3>是什麼</h3><p>{c.definition}</p></section>
    <section><h3>為什麼重要</h3><p>{c.why}</p></section>
    {c.visual?.kind === 'fretboard' && <figure className="lesson-visual">
      <Fretboard tuning={STANDARD.midi} orientation={layout} label={c.visual.caption} fitHeight={420} marks={c.visual.positions.map(([string, fret, label]) => ({ string, fret, label, tone: 'target' }))}/>
      <figcaption>{c.visual.caption}</figcaption>
    </figure>}
    {c.visual?.kind === 'shape' && <figure className="lesson-visual shapes">
      <div className="shape-row">{c.visual.shapeIds.map(id => <ChordDiagram key={id} shape={shapeById(id)} size={130}/>)}</div>
      <figcaption>{c.visual.caption}</figcaption>
    </figure>}
    {c.visual?.kind === 'pattern' && <figure className="lesson-visual"><PatternGrid pattern={c.visual.pattern}/><figcaption>{c.visual.caption}</figcaption></figure>}
    <section><h3>例子</h3><p>{c.example}</p></section>
    <section className="mistake"><h3>常見錯誤</h3><p>{c.mistake}</p></section>
  </div>
}
