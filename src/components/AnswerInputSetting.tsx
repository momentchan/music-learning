import { useLearning } from '../stores/learning'

/** Input is independent of practice context; naming questions always keep naming input. */
export function AnswerInputSetting({ forInstrument = false }: { forInstrument?: boolean }) {
  const { preferences, savePreferences } = useLearning()
  if (!forInstrument && preferences.practiceContext === 'pocket') return <p className="helper">點一下位置就送出。非聽力題可以全程靜音。</p>
  return <div className="practice-input-settings">
    <label className="answer-input">找音題作答方式
      <select value={preferences.answerInput} onChange={e => void savePreferences({ answerInput: e.target.value as 'tap' | 'play' })}>
        <option value="tap">點選指板／鍵盤</option><option value="play">彈單音，麥克風驗證音高</option>
      </select>
    </label>
    <p className="helper">麥克風只能驗證音高，不能確認使用哪條弦。說音名的題目仍以音名作答。</p>
  </div>
}
