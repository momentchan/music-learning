/** Human-readable zh-TW labels for review items and error classes (display only). */
import { displayNote } from '../music-theory/notes'
import { intervalLabel } from '../music-theory/intervals'
import { STRUM_PATTERNS } from '../exercise-engine/templates/practical'

const noteText = (id: string) => {
  const flats: Record<string, string> = { 'C#': 'D♭', 'D#': 'E♭', 'F#': 'G♭', 'G#': 'A♭', 'A#': 'B♭' }
  return flats[id] ? `${displayNote(id)}/${flats[id]}` : displayNote(id)
}
const TRIAD: Record<string, string> = { major: '大三和弦', minor: '小三和弦', dim: '減三和弦', aug: '增三和弦' }

export function itemLabel(itemId: string): string {
  const p = itemId.split('.')
  try {
    if (itemId.startsWith('fret.note.')) return `第 ${p[3].slice(1)} 弦的 ${noteText(p[2])}`
    if (itemId.startsWith('fret.open.')) return `第 ${p[2].slice(1)} 弦空弦`
    if (itemId.startsWith('fret.octave.')) return `八度：第 ${p[2].replace('s', '').replace('-s', '→')} 弦`
    if (itemId.startsWith('interval.name.')) return `${intervalLabel(p[2])} 音名`
    if (itemId.startsWith('interval.shape.')) return `${intervalLabel(p[2])} 形狀${p[3] === 'gb' ? '（跨 G–B 弦）' : ''}`
    if (itemId.startsWith('interval.')) return intervalLabel(p[1])
    if (itemId.startsWith('triad.')) return TRIAD[p[1]] ?? itemId
    if (itemId.startsWith('scale.major.')) return `${displayNote(p[2])} 大調音階`
    if (itemId.startsWith('key.sig.')) return `${displayNote(p[2])} 大調調號`
    if (itemId.startsWith('key.')) return `${displayNote(p[1])} 大調第 ${p[2]} 級`
    if (itemId.startsWith('harmony.function.')) return `第 ${p[2]} 級的功能`
    if (itemId.startsWith('harmony.prog.')) return `進行 ${p.slice(2).join('.').replace(/-/g, '–')}`
    if (itemId.startsWith('chord.tone.')) return `${p[2]} 和弦的${p[3] === '1' ? '根音' : p[3] === '3' ? '三音' : '五音'}`
    if (itemId.startsWith('chord.shape.')) return `${p[2]} 指型`
    if (itemId === 'chord.diagram.muted') return '和弦圖：不彈的弦'
    if (itemId === 'chord.diagram.frets') return '和弦圖：格數'
    if (itemId === 'chord.diagram.fingers') return '和弦圖：指法'
    if (itemId.startsWith('rhythm.pattern.')) return `節奏：${STRUM_PATTERNS[p[2]]?.name ?? p[2]}`
    if (itemId === 'rhythm.count') return '數拍子'
    if (itemId === 'rhythm.strum.direction') return '撥弦方向'
    if (itemId === 'ear.triad.major-minor') return '聽：大／小三和弦'
    if (itemId.startsWith('ear.interval.')) return `聽：${intervalLabel(p[2])}`
    if (itemId === 'spell.interval') return '拼寫：音程'
    if (itemId === 'spell.triad') return '拼寫：三和弦'
    if (itemId === 'spell.scale') return '拼寫：音階'
  } catch { /* fall through */ }
  return itemId
}

export const ERROR_LABEL: Record<string, string> = {
  'off-by-one': '差一格', 'wrong-string': '找錯弦', 'wrong-octave': '八度不對', 'gb-offset': 'G–B 弦位移', 'wrong-note': '音名不對',
  spelling: '拼法', quality: '音程性質（大小完全）', 'generic-size': '度數（字母數）', 'wrong-notes': '組成音', distractor: '選錯選項',
  'stroke-direction': '撥弦方向', early: '偏早', late: '偏晚', missing: '漏拍', extra: '多拍',
}
