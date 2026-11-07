import { useState } from 'react'
import { navigate } from '../app/router'
import { repository } from '../database/repository'
import { downloadJson } from '../stores/learning'

export function DeviceTransfer() {
  const [error, setError] = useState('')
  return <section className="device-transfer">
    <h3>把練習帶到另一台裝置</h3>
    <p className="helper">進度存在這台瀏覽器，不會自動同步。匯出後把檔案帶到另一台，在設定選「合併匯入」；作答與待彈任務會一起帶過去。</p>
    <div className="button-row">
      <button className="secondary-button" onClick={() => void repository.exportAll().then(data => downloadJson('guitar-lab-transfer.json', data)).catch(() => setError('匯出失敗，請稍後重試。'))}>匯出練習進度</button>
      <button className="text-button" onClick={() => navigate('/settings')}>匯入進度／備份設定</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>
}
