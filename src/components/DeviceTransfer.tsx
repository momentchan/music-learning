import { useState } from 'react'
import { navigate } from '../app/router'
import { repository } from '../database/repository'
import { downloadJson } from '../stores/learning'

export function DeviceTransfer() {
  const [error, setError] = useState('')
  return <section className="device-transfer">
    <h3>移轉進度</h3>
    <p className="helper">跨裝置需匯出，再到另一台合併匯入。</p>
    <div className="button-row">
      <button className="secondary-button" onClick={() => void repository.exportAll().then(data => downloadJson('guitar-lab-transfer.json', data)).catch(() => setError('匯出失敗，請稍後重試。'))}>匯出練習進度</button>
      <button className="text-button" onClick={() => navigate('/settings')}>匯入進度／備份設定</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>
}
