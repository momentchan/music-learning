import type { PracticeFocus } from '../learning/records'
import { useLearning } from '../stores/learning'

export function PracticeContextSetting({ instrumentOnly = false }: { instrumentOnly?: boolean }) {
  const { preferences, savePreferences, loaded } = useLearning()
  return <div className="practice-context-setting">
    {!instrumentOnly && <p className="field-title">現在怎麼練？</p>}
    {!instrumentOnly && <div className="context-options" role="group" aria-label="練習情境">
      <button disabled={!loaded} className={preferences.practiceContext === 'pocket' ? 'active' : ''} aria-pressed={preferences.practiceContext === 'pocket'} onClick={() => void savePreferences({ practiceContext: 'pocket', answerInput: 'tap' })}><strong>通勤練習</strong><span>沒有吉他，單手也能練</span></button>
      <button disabled={!loaded} className={preferences.practiceContext === 'instrument' ? 'active' : ''} aria-pressed={preferences.practiceContext === 'instrument'} onClick={() => void savePreferences({ practiceContext: 'instrument' })}><strong>拿起吉他</strong><span>看指板，用手與耳朵連起來</span></button>
    </div>}
    <label className="focus-setting">這次練什麼
      <select disabled={!loaded} value={preferences.practiceFocus} onChange={e => void savePreferences({ practiceFocus: e.target.value as PracticeFocus })}>
        <option value="notes">指板音名：找出位置</option><option value="naming">看位置說音名</option><option value="positions">限定把位找音</option><option value="intervals">相鄰弦音程</option><option value="chord-tones">和弦中的根音、三音、五音</option>
      </select>
    </label>
  </div>
}
