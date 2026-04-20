// レンダラー側JS — UIイベント処理・IPC呼び出し
// window.electronApi は preload.js の contextBridge 経由で公開されている

/* ===========================
   DOM要素の参照
   =========================== */
const inputEmail = document.getElementById('input-email');
const inputPassword = document.getElementById('input-password');
const inputSenderName = document.getElementById('input-sender-name');
const btnSmtpSave = document.getElementById('btn-smtp-save');
const btnSmtpClear = document.getElementById('btn-smtp-clear');
const smtpStatus = document.getElementById('smtp-status');

const dropZone = document.getElementById('drop-zone');
const btnFileSelect = document.getElementById('btn-file-select');
const fileName = document.getElementById('file-name');

const inputSubject = document.getElementById('input-subject');
const inputRecipients = document.getElementById('input-recipients');
const btnSend = document.getElementById('btn-send');
const sendLog = document.getElementById('send-log');

const previewIframe = document.getElementById('preview-iframe');
const previewEmpty = document.getElementById('preview-empty');

/* ===========================
   状態管理
   =========================== */
// 現在読み込んでいるHTMLの内容
let currentHtmlBody = null;

/* ===========================
   SMTP設定 — 初期読み込み
   =========================== */
async function loadSmtpConfig() {
  const result = await window.electronApi.smtpLoad();
  if (result.success && result.data) {
    inputEmail.value = result.data.email;
    inputPassword.value = result.data.password; // マスク済みの文字列
    inputSenderName.value = result.data.senderName;
    showSmtpStatus('設定済み', 'success');
  }
}

// SMTP保存ボタン
btnSmtpSave.addEventListener('click', async () => {
  const email = inputEmail.value.trim();
  const password = inputPassword.value.trim();
  const senderName = inputSenderName.value.trim();

  if (!email || !password) {
    showSmtpStatus('メールアドレスとアプリパスワードは必須です。', 'error');
    return;
  }

  // マスク表示の場合は保存しない（変更なし）
  if (password === '••••••••') {
    showSmtpStatus('変更がありません。', 'success');
    return;
  }

  const result = await window.electronApi.smtpSave({ email, password, senderName });
  if (result.success) {
    showSmtpStatus('保存しました。', 'success');
    // パスワード欄をマスク表示に切り替え
    inputPassword.value = '••••••••';
  } else {
    showSmtpStatus(`保存失敗: ${result.error}`, 'error');
  }
});

// SMTP削除ボタン
btnSmtpClear.addEventListener('click', async () => {
  const result = await window.electronApi.smtpClear();
  if (result.success) {
    inputEmail.value = '';
    inputPassword.value = '';
    inputSenderName.value = '';
    showSmtpStatus('設定を削除しました。', 'success');
  } else {
    showSmtpStatus(`削除失敗: ${result.error}`, 'error');
  }
});

// SMTPステータスメッセージを表示するヘルパー
function showSmtpStatus(message, type) {
  smtpStatus.textContent = message;
  smtpStatus.className = 'form-status';
  if (type === 'success') smtpStatus.classList.add('form-status--success');
  if (type === 'error') smtpStatus.classList.add('form-status--error');
}

/* ===========================
   HTMLファイル読み込み
   =========================== */

// ファイル選択ダイアログ
btnFileSelect.addEventListener('click', async () => {
  const result = await window.electronApi.fileDialog();
  if (result.success && result.filePath) {
    await loadHtmlFile(result.filePath);
  }
});

// ドラッグ＆ドロップ
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drop-zone--active');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drop-zone--active');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drop-zone--active');

  const files = e.dataTransfer.files;
  if (files.length === 0) return;

  const file = files[0];
  // HTMLファイルのみ受け付ける
  if (!file.name.match(/\.html?$/i)) {
    fileName.textContent = 'HTMLファイルのみ対応しています。';
    fileName.className = 'file-name form-status--error';
    return;
  }

  // D&Dで取得できるファイルパスを使用
  await loadHtmlFile(file.path);
});

// HTMLファイルを読み込んでプレビューに表示
async function loadHtmlFile(filePath) {
  const result = await window.electronApi.fileRead(filePath);
  if (!result.success) {
    fileName.textContent = `読み込みエラー: ${result.error}`;
    fileName.className = 'file-name form-status--error';
    return;
  }

  currentHtmlBody = result.content;

  // ファイル名を表示（パスの最後の部分のみ）
  const baseName = filePath.split('/').pop().split('\\').pop();
  fileName.textContent = `✓ ${baseName}`;
  fileName.className = 'file-name file-name--loaded';

  // プレビューをiframeに表示（blob URLを使用してsandbox内でレンダリング）
  const blob = new Blob([result.content], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  previewIframe.src = blobUrl;
  previewIframe.classList.add('preview-iframe--visible');
  previewEmpty.classList.add('preview-empty--hidden');
}

/* ===========================
   メール送信
   =========================== */
btnSend.addEventListener('click', async () => {
  if (!currentHtmlBody) {
    appendLog({ to: '', success: false, error: 'HTMLファイルが読み込まれていません。' }, true);
    return;
  }

  const subject = inputSubject.value.trim();
  const rawRecipients = inputRecipients.value;

  if (!subject) {
    appendLog({ to: '', success: false, error: '件名を入力してください。' }, true);
    return;
  }

  // 改行・カンマで分割してトリム・空行除去・重複除去
  const recipients = [...new Set(
    rawRecipients
      .split(/[\n,]+/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
  )];

  if (recipients.length === 0) {
    appendLog({ to: '', success: false, error: '宛先を入力してください。' }, true);
    return;
  }

  // 送信中はボタンを無効化
  btnSend.disabled = true;
  btnSend.textContent = '送信中…';
  sendLog.innerHTML = '';

  const result = await window.electronApi.mailSend({
    subject,
    recipients,
    htmlBody: currentHtmlBody
  });

  btnSend.disabled = false;
  btnSend.textContent = '送信する';

  if (!result.success) {
    // 設定エラーなど全体的な失敗
    appendLog({ to: '', success: false, error: result.error }, true);
    return;
  }

  // 個別送信結果をログに表示
  for (const item of result.results) {
    appendLog(item, false);
  }
});

// ログアイテムをDOMに追加するヘルパー
function appendLog(item, isGlobal) {
  const div = document.createElement('div');
  div.className = `log-item ${item.success ? 'log-item--success' : 'log-item--error'}`;

  const badge = document.createElement('span');
  badge.className = 'log-item__badge';
  badge.textContent = item.success ? 'OK' : 'NG';

  const address = document.createElement('span');
  address.className = 'log-item__address';
  address.textContent = isGlobal ? '—' : item.to;

  const message = document.createElement('span');
  message.className = 'log-item__message';
  message.textContent = item.success ? '送信完了' : item.error;

  div.appendChild(badge);
  div.appendChild(address);
  div.appendChild(message);
  sendLog.appendChild(div);
}

/* ===========================
   初期化
   =========================== */
loadSmtpConfig();
