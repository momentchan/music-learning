import type { PracticeFocus } from '../learning/records'
import { useLearning } from '../stores/learning'

export function PracticeContextSetting() {
  const { preferences, savePreferences, loaded } = useLearning()
  return <div className="practice-context-setting">
    <p className="field-title">練習方式</p>
    <div className="context-options" role="group" aria-label="練習情境">
      <button disabled={!loaded} className={preferences.practiceContext === 'pocket' ? 'active' : ''} aria-pressed={preferences.practiceContext === 'pocket'} onClick={() => void savePreferences({ practiceContext: 'pocket', answerInput: 'tap' })}><strong>通勤練習</strong><span>點指板作答</span></button>
      <button disabled={!loaded} className={preferences.practiceContext === 'instrument' ? 'active' : ''} aria-pressed={preferences.practiceContext === 'instrument'} onClick={() => void savePreferences({ practiceContext: 'instrument', answerInput: 'play' })}><strong>彈吉他</strong><span>麥克風作答</span></button>
    </div>
    <label className="focus-setting">這次練什麼
      <select disabled={!loaded} value={preferences.practiceFocus === 'positions' ? 'notes' : preferences.practiceFocus} onChange={e => void savePreferences({ practiceFocus: e.target.value as PracticeFocus })}>
        <option value="notes">找音</option><option value="naming">說出音名</option><option value="intervals">音程</option><option value="scales">音階</option><option value="chord-tones">和弦音</option>
      </select>
    </label>
  </div>
}
