// contextBridgeによるIPC公開（セキュリティ境界）
// レンダラープロセスからはwindow.electronApi経由でのみアクセス可能

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApi', {
  // SMTP設定を保存
  smtpSave: (config) => ipcRenderer.invoke('smtp:save', config),

  // SMTP設定を取得（パスワードはマスク済み）
  smtpLoad: () => ipcRenderer.invoke('smtp:load'),

  // SMTP設定を削除
  smtpClear: () => ipcRenderer.invoke('smtp:clear'),

  // HTMLファイルをパス指定で読み込む
  fileRead: (filePath) => ipcRenderer.invoke('file:read', filePath),

  // ファイル選択ダイアログを開く
  fileDialog: () => ipcRenderer.invoke('file:dialog'),

  // メールを送信する
  mailSend: (params) => ipcRenderer.invoke('mail:send', params),

  // HTMLを一時ファイルに書き出してデフォルトブラウザで開く
  previewOpen: (htmlContent) => ipcRenderer.invoke('preview:open', htmlContent)
});
