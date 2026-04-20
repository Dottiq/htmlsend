# HTMLSend

## プロジェクト概要
Electronベースのデスクトップアプリ。HTMLメールのテスト送信を行う。  
各ユーザーが自分のGoogleアカウント（Gmailアプリパスワード）で送信する仕組みで、  
運営側がアカウント情報を持たない設計。  
配布元：[nobusue.com/tools](https://nobusue.com/tools)（Nobleサイトのtoolsページ）

---

## 絶対に守るルール
- インラインCSS・インラインJS 禁止（Sitekernelと同じルール）
- コメントは日本語で書く
- 作業前に `git status` で cwd を確認する
- 不要になったCSS・JSは削除する（放置しない）
- `electron-store` のデータは必ず `encryptionKey` を設定して暗号化する
- IPC通信は必ず `contextIsolation: true` + `preload.js` 経由で行う（`nodeIntegration: false`）

---

## ファイル構成・What Goes Where

```
htmlsend/
├── main.js          — Electronメインプロセス・nodemailer送信処理・IPC受信
├── preload.js       — contextBridge によるIPC公開（セキュリティ境界）
├── renderer/
│   ├── index.html   — アプリUI（単一ページ）
│   ├── style.css    — スタイル（外部ファイルのみ、インライン禁止）
│   └── app.js       — レンダラー側JS（UIロジック・IPC送信）
├── package.json
├── .gitignore
└── README.md
```

| 書きたいこと | 書く場所 |
|---|---|
| SMTP送信処理 | `main.js`（nodemailer） |
| アプリパスワードの保存・読み込み | `main.js`（electron-store） |
| IPCチャンネルの定義・公開 | `preload.js` |
| UIレイアウト・HTML構造 | `renderer/index.html` |
| スタイル全般 | `renderer/style.css` |
| UIイベント・IPC呼び出し | `renderer/app.js` |

---

## IPCチャンネル一覧

| チャンネル名 | 方向 | 内容 |
|---|---|---|
| `smtp:save` | renderer → main | SMTP設定を保存 |
| `smtp:load` | renderer → main | SMTP設定を取得 |
| `smtp:clear` | renderer → main | SMTP設定を削除 |
| `mail:send` | renderer → main | メール送信実行（件名・宛先・HTML本文を渡す） |
| `file:read` | renderer → main | HTMLファイルパスを受け取り内容を返す |
| `preview:open` | renderer → main | HTMLを一時ファイルに書き出してブラウザで開く |

---

## 機能仕様

### HTMLファイル読み込み
- D&Dまたはファイル選択ダイアログ
- ファイルパスは `file:read` IPC経由で main.js が読み込む（`fs.readFileSync`）
- 読み込んだHTMLはペーストエリア（textarea）にも反映される
- 「ブラウザで確認する」ボタンで一時ファイルに書き出し `shell.openExternal()` で開く

### HTMLコード直接入力
- textareaに直接HTMLを貼り付け可能
- ファイルD&Dとtextarea入力は同一の `currentHtmlBody` 変数に格納

### 宛先入力
- テキストエリアに1行1アドレスで入力
- 送信時に改行・カンマで分割・トリム・重複除去して配列化

### SMTP設定（アプリパスワード）
- 入力項目：メールアドレス、アプリパスワード（差出人表示名は廃止済み）
- `electron-store` に `encryptionKey` 付きで暗号化保存
- パスワード欄は `type="password"` 表示
- 設定済みの場合はマスク表示で確認できる

### 送信処理
- `nodemailer.createTransport` で Gmail SMTP（`smtp.gmail.com:465`、SSL）
- 宛先ごとに個別送信（`to` を1件ずつループ）
- 送信結果（成功/失敗）をレンダラーに返してUIに表示

---

## デザイン方針
Noble（nobusue.com/tools）と統一したテイストにする。

### カラー
| 変数名 | 値 | 用途 |
|---|---|---|
| `--color-bg` | `#f7f6f3` | 背景色（オフホワイト） |
| `--color-text` | `#4a4643` | メインテキスト |
| `--color-muted` | `#706c68` | 補足テキスト |
| `--color-accent` | `#7b9eb8` | コーポレートカラー（スチールブルー） |
| `--color-cta` | `#4a6741` | CTAボタン・送信ボタン（深緑） |
| `--color-border` | `#e2e0db` | ボーダー |
| `--color-error` | `#c0392b` | エラー表示 |
| `--color-success` | `#4a6741` | 成功表示（CTAと同値） |

### フォント
- 見出し：`'Zen Kaku Gothic New', sans-serif`
- 本文・UI：`'Noto Sans JP', 'Hiragino Sans', sans-serif`
- 英数字・ラベル：`'Inter', sans-serif`
- ※ Google Fontsは使用可（Electronはオンライン前提でも可だが、オフライン時のフォールバックを必ず設定する）

### レイアウト
- シングルウィンドウ（960×760、最小780×600）
- 1カラム中央寄せ。スクロールなしで全要素が収まる設計
- タイトルバー：macOSは `hiddenInset`、Windowsはデフォルト

---

## セキュリティ
- `contextIsolation: true`、`nodeIntegration: false` を厳守
- `electron-store` は `encryptionKey` を必ず設定する（素のJSONで保存しない）
- アプリパスワードはローカル保存のみ。ネットワーク通信はGmailへのSMTPのみ
- ユーザー自身のGoogleアカウント設定でアプリパスワードをいつでも失効できることをREADMEに明記する

---

## よくある落とし穴

| 問題 | 正しい対応 |
|---|---|
| `nodeIntegration: true` にしたくなる | 絶対にダメ。`preload.js` + `contextBridge` を使う |
| アプリパスワードを平文保存 | `electron-store` の `encryptionKey` を設定すること |
| D&DのファイルパスをそのままJSで読む | レンダラーで `fs` は使えない。`file:read` IPC経由で main.js に読ませる |
| Gmailの送信エラーを握りつぶす | `try/catch` で必ずキャッチしてレンダラーにエラー内容を返す |
| `type="password"` を忘れる | アプリパスワード入力欄は必ずマスク表示にする |

---

## 開発・ビルド

```bash
# 開発起動
npm start

# Mac向けビルド
npm run build:mac

# Windows向けビルド
npm run build:win
```

### .gitignore に必ず含めるもの
```
node_modules/
dist/
*.dmg
*.exe
*.zip
```

---

## AI開発指示（共通ルール）

作業前に必ず以下を守ること：

- このファイル（CLAUDE.md）を最初に読む
- インラインCSS・インラインJS は禁止（外部ファイルに書く）
- コメントは日本語で記述する
- IPC通信は `preload.js` + `contextBridge` 経由のみ（`nodeIntegration: false` を崩さない）
- `electron-store` への保存は必ず `encryptionKey` を設定する
- 修正完了後、変更したファイルの一覧を出力すること
- `git add / commit / push` を実行すること
- コミットメッセージは英語で内容を端的に表すこと

---

*最終更新: 2026-04*
