/** zh-TW message catalog for shared UI. Structured so `en` / `ja` catalogs can be added with the same keys. */
export const zhTW = {
  appName: 'Guitar Lab',
  tagline: '理解 · 找到 · 聽見 · 彈出來',
  nav: { today: '練習', learn: '課程', lab: '工具', guitar: '持琴練習', progress: '進度' },
  common: {
    start: '開始', continue: '繼續', next: '下一題', retry: '再試一次', why: '為什麼', hideWhy: '收起說明', skip: '跳過', submit: '送出',
    close: '關閉', back: '返回', settings: '設定', play: '▶ 播放', replay: '↻ 重播', soundOn: '◖ 有聲', silent: '◌ 靜音', exit: '離開',
    minutes: (n: number) => `${n} 分鐘`, questions: (n: number) => `${n} 題`,
  },
  availability: { available: '可練習', preview: '預覽', planned: '規劃中' },
  storage: {
    unsaved: '此答案尚未儲存。答案已批改並暫存在記憶體中，關閉頁面就會遺失。',
    retry: '重新儲存', export: '匯出暫存答案',
  },
} as const

export type Messages = typeof zhTW
export const t: Messages = zhTW
