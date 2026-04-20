// Electronメインプロセス・nodemailer送信処理・IPC受信

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const Store = require('electron-store');

// electron-store の暗号化設定
// 環境変数または固定キーを使用（本番環境ではより安全なキー管理を推奨）
const store = new Store({
  encryptionKey: 'htmlsend-secure-key-2024',
  name: 'smtp-config'
});

// メインウィンドウの参照
let mainWindow;

// ウィンドウ作成関数
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 760,
    minWidth: 780,
    minHeight: 600,
    // macOSはhiddenInsetスタイルのタイトルバー
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      // セキュリティ必須設定
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// アプリ起動時にウィンドウを作成
app.whenReady().then(() => {
  createWindow();

  // macOSでDockアイコンクリック時にウィンドウを再作成
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// すべてのウィンドウが閉じられたらアプリを終了（macOS以外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: SMTP設定を保存
ipcMain.handle('smtp:save', async (event, config) => {
  try {
    store.set('smtp', {
      email: config.email,
      password: config.password,
      senderName: config.senderName
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: SMTP設定を取得
ipcMain.handle('smtp:load', async () => {
  try {
    const config = store.get('smtp');
    if (!config) return { success: true, data: null };
    // パスワードはマスクして返す（確認用）
    return {
      success: true,
      data: {
        email: config.email,
        password: '••••••••',
        senderName: config.senderName,
        hasSaved: true
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: SMTP設定を削除
ipcMain.handle('smtp:clear', async () => {
  try {
    store.delete('smtp');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: HTMLファイルを読み込む（レンダラーではfsが使えないためmain経由）
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: ファイル選択ダイアログを開く
ipcMain.handle('file:dialog', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, filePath: null };
    }
    return { success: true, filePath: result.filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: メール送信
ipcMain.handle('mail:send', async (event, { subject, recipients, htmlBody }) => {
  try {
    // 保存済みのSMTP設定を取得
    const config = store.get('smtp');
    if (!config) {
      return { success: false, error: 'SMTP設定が保存されていません。' };
    }

    // Gmail SMTPトランスポートを作成（SSL:465）
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: config.email,
        pass: config.password
      }
    });

    const results = [];

    // 宛先ごとに個別送信
    for (const to of recipients) {
      try {
        await transporter.sendMail({
          from: `"${config.senderName}" <${config.email}>`,
          to,
          subject,
          html: htmlBody
        });
        results.push({ to, success: true });
      } catch (err) {
        results.push({ to, success: false, error: err.message });
      }
    }

    return { success: true, results };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
