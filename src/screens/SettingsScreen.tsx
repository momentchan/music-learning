import { useEffect, useRef, useState } from 'react'
import { Calibration } from '../components/rhythm/RhythmPad'
import { parseBackupText, type BackupEnvelope } from '../database/backup'
import { repository } from '../database/repository'
import type { Preferences } from '../learning/records'
import { downloadJson, useLearning } from '../stores/learning'
import { AudioSettingsPanel } from './lab/LabTools'

function StorageStatus() {
  const [status, setStatus] = useState<{ persisted?: boolean; usage?: number; quota?: number; supported: boolean }>({ supported: false })
  const check = async () => {
    if (!navigator.storage) return setStatus({ supported: false })
    const [persisted, estimate] = await Promise.all([navigator.storage.persisted?.(), navigator.storage.estimate?.()])
    setStatus({ supported: true, persisted, usage: estimate?.usage, quota: estimate?.quota })
  }
  useEffect(() => { void check() }, [])
  return <div className="storage-status">
    {!status.supported ? <p className="helper">這個瀏覽器不提供儲存狀態資訊。</p> : <>
      <p>永久儲存：<strong>{status.persisted ? '已啟用（降低自動清除機率，仍建議備份）' : '未啟用（空間不足時瀏覽器可能清除資料）'}</strong></p>
      {status.usage !== undefined && <p className="helper">已使用約 {(status.usage / 1024 / 1024).toFixed(1)} MB{status.quota ? ` / 可用約 ${(status.quota / 1024 / 1024 / 1024).toFixed(1)} GB` : ''}</p>}
      {!status.persisted && <button className="secondary-button" onClick={() => void navigator.storage.persist?.().then(check)}>要求永久儲存</button>}
    </>}
  </div>
}

function DataPanel() {
  const learning = useLearning()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ envelope: BackupEnvelope; counts: Record<string, number> } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [confirmReplace, setConfirmReplace] = useState(false)

  async function exportData() {
    try { downloadJson(`guitar-lab-backup-${new Date().toISOString().slice(0, 10)}.json`, await repository.exportAll()); setMessage('已匯出備份檔。') }
    catch { setMessage('匯出失敗：無法讀取本機資料。') }
  }
  async function onFile(file: File) {
    setPreview(null); setErrors([]); setMessage(''); setConfirmReplace(false)
    const result = parseBackupText(await file.text())
    if (result.ok) setPreview({ envelope: result.envelope, counts: result.counts })
    else setErrors(result.errors)
  }
  async function runImport() {
    if (!preview) return
    if (mode === 'replace' && !confirmReplace) { setConfirmReplace(true); return }
    try {
      const result = await repository.importBackup(preview.envelope, mode)
      await learning.refresh()
      setPreview(null); setConfirmReplace(false)
      setMessage(`匯入完成，目前共有 ${result.attempts} 筆作答紀錄。${result.preImportBackupId ? '匯入前的資料已自動備份，可在下方下載。' : ''}`)
    } catch (e) { setMessage(`匯入失敗，資料沒有變更（${e instanceof Error ? e.message : '交易失敗'}）。`) }
  }
  async function downloadPreImport() {
    const backup = await repository.latestPreImportBackup()
    if (backup) downloadJson('guitar-lab-pre-import-backup.json', backup)
    else setMessage('沒有匯入前的備份。')
  }
  const labels: Record<string, string> = { attempts: '作答紀錄', sessions: '練習時段', reviews: '複習排程', events: '跳過/瀏覽', selfReports: '吉他自評', bridgeQueue: '吉他任務', progressions: '和弦進行', pathways: '路徑進度', settings: '設定' }
  return <section className="card">
    <h3>資料備份</h3>
    <p className="helper">所有紀錄只存在這台裝置的瀏覽器裡。定期匯出備份，換手機或清除瀏覽器資料時才不會遺失。</p>
    <div className="button-row">
      <button className="primary-button" onClick={() => void exportData()}>匯出備份（JSON）</button>
      <button className="secondary-button" onClick={() => fileRef.current?.click()}>匯入備份…</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} aria-label="選擇備份檔"/>
    </div>
    {errors.length > 0 && <div className="notice" role="alert"><strong>無法匯入這個檔案：</strong><ul>{errors.map(e => <li key={e}>{e}</li>)}</ul></div>}
    {preview && <div className="import-preview">
      <h4>備份內容預覽（匯出於 {new Date(preview.envelope.exportedAt).toLocaleString('zh-TW')}）</h4>
      <ul>{Object.entries(preview.counts).filter(([, n]) => n > 0).map(([k, n]) => <li key={k}>{labels[k] ?? k}：{n}</li>)}</ul>
      <fieldset><legend>匯入方式</legend>
        <label><input type="radio" name="mode" checked={mode === 'merge'} onChange={() => { setMode('merge'); setConfirmReplace(false) }}/> 合併：保留這台裝置的紀錄，只加入沒有的</label>
        <label><input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')}/> 取代：用備份覆蓋（會先自動備份目前資料）</label>
      </fieldset>
      {confirmReplace && <p className="notice">確定要用備份取代目前所有學習紀錄嗎？目前的資料會先存成「匯入前備份」。</p>}
      <div className="button-row"><button className="primary-button" onClick={() => void runImport()}>{confirmReplace ? '確定取代' : '匯入'}</button><button className="secondary-button" onClick={() => { setPreview(null); setConfirmReplace(false) }}>取消</button></div>
    </div>}
    {message && <p role="status">{message}</p>}
    <button className="text-button" onClick={() => void downloadPreImport()}>下載最近一次的「匯入前備份」</button>
    <StorageStatus/>
  </section>
}

export function SettingsScreen() {
  const { preferences, savePreferences } = useLearning()
  const set = (patch: Partial<Preferences>) => void savePreferences(patch)
  return <div className="settings">
    <section className="card settings-card">
      <h3>練習</h3>
      <label>每週目標天數<select value={preferences.weeklyGoalDays} onChange={e => set({ weeklyGoalDays: Number(e.target.value) })}>{[2, 3, 4, 5, 6, 7].map(d => <option key={d} value={d}>{d} 天</option>)}</select></label>
      <label>難度<select value={String(preferences.difficulty)} onChange={e => set({ difficulty: e.target.value === 'auto' ? 'auto' : Number(e.target.value) as 1 | 2 | 3 })}>
        <option value="auto">自動（依你的正確率調整）</option><option value="1">1 · 入門</option><option value="2">2 · 進階</option><option value="3">3 · 挑戰</option></select></label>
      <div className="setting"><div><strong>左手琴</strong><p>把指板左右鏡像</p></div><input type="checkbox" checked={preferences.leftHanded} onChange={e => set({ leftHanded: e.target.checked })} aria-label="左手琴顯示"/></div>
      <p className="helper">語言：繁體中文（之後會加入 English、日本語）。調音：標準調音（其他調音規劃中）。</p>
    </section>
    <section className="card">
      <h3>節奏延遲校準</h3>
      <p className="helper">目前：{preferences.latencyOffsetMs === null ? '尚未校準' : `${preferences.latencyOffsetMs} ms`}。換耳機或喇叭後建議重新校準。</p>
      <Calibration onDone={offset => set({ latencyOffsetMs: offset })}/>
    </section>
    <AudioSettingsPanel/>
    <DataPanel/>
  </div>
}
