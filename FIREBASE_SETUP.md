# 🔥 Firebase リアルタイム共有 設定ガイド

## 端末間でデータをリアルタイム共有するための設定

---

## 📋 このガイドで実現できること

✅ 作業員がスマホで進捗登録 → 管理者PCに即座に反映  
✅ 複数端末でデータを共有  
✅ 月間 10GB まで無料（小規模事業なら十分）

---

## 🚀 設定手順（約15分）

---

### 【ステップ1】Firebaseアカウント作成（3分）

1. ブラウザで **https://firebase.google.com** を開く
2. 右上の「**コンソールに移動**」をクリック
3. **Googleアカウント**でログイン
   - Googleアカウントがない場合は作成

---

### 【ステップ2】プロジェクト作成（3分）

1. 「**プロジェクトを追加**」をクリック
2. プロジェクト名を入力
   ```
   tac-production
   ```
3. Google Analytics を**無効**にする（下のトグルをオフ）
4. 「**プロジェクトを作成**」をクリック
5. 完了したら「**続行**」をクリック

---

### 【ステップ3】Realtime Database を作成（3分）

1. 左メニューから「**構築**」→「**Realtime Database**」を選択
2. 「**データベースを作成**」をクリック
3. ロケーション選択
   - 「**asia-southeast1 (シンガポール)**」を選択
4. セキュリティルール
   - 「**テストモードで開始**」を選択
   - ⚠️ 注意: 30日後にルール設定が必要です
5. 「**有効にする**」をクリック

---

### 【ステップ4】Webアプリを登録（2分）

1. 左上の歯車アイコン「**プロジェクトの設定**」をクリック
2. 下にスクロールして「**マイアプリ**」セクションへ
3. 「**</>**」（ウェブ）アイコンをクリック
4. アプリ名を入力
   ```
   tac-web
   ```
5. 「**アプリを登録**」をクリック
6. **表示される設定情報を保存**（次のステップで使用）

---

### 【ステップ5】設定ファイルを編集（3分）

1. `firebase-config.js` をテキストエディタで開く
2. 以下の部分を、ステップ4で表示された値に置き換え

**置き換え前:**
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

**置き換え後（例）:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB1234567890abcdefg",
  authDomain: "tac-production.firebaseapp.com",
  databaseURL: "https://tac-production-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tac-production",
  storageBucket: "tac-production.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

3. ファイルを保存

---

### 【ステップ6】動作確認（2分）

1. ブラウザで `index.html` を開く
2. **F12キー**を押してデベロッパーツールを開く
3. 「**Console**」タブを確認
4. 以下のメッセージが表示されれば成功！

```
✅ Firebase 接続成功！リアルタイム同期が有効です。
🔥 Firebaseモードで起動
```

5. ログインして、生産指示書を作成
6. **別のブラウザ**（または別端末）で同じURLを開く
7. 作成した指示書が表示されればリアルタイム共有成功！

---

## 🔒 セキュリティ設定（本番運用前に必須）

テストモードは30日間有効です。本番運用前に以下を設定：

### Firebaseコンソールでルールを設定

1. 「**Realtime Database**」→「**ルール**」タブ
2. 以下のルールに置き換え：

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ 上記は簡易版です。より厳格なセキュリティが必要な場合は認証機能を追加してください。

---

## ❓ よくある問題と対処法

### Q: 「Firebase 接続成功」が表示されない

**対処:**
1. `firebase-config.js` の設定値が正しいか確認
2. `databaseURL` が正しいか確認（**asia-southeast1** が含まれているか）
3. インターネット接続を確認

### Q: データが同期されない

**対処:**
1. Firebaseコンソールで「**Realtime Database**」を開く
2. データが保存されているか確認
3. ルールが「**読み取り/書き込み: 許可**」になっているか確認

### Q: 「Permission denied」エラー

**対処:**
1. Firebaseコンソール → Realtime Database → ルール
2. ルールを以下に変更：
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
3. 「**公開**」をクリック

---

## 📊 料金について

| 項目 | 無料枠（Sparkプラン） |
|------|----------------------|
| 同時接続数 | 100 |
| 保存容量 | 1 GB |
| ダウンロード | 10 GB/月 |
| 書き込み | 無制限 |

**💡 10人程度の事業所なら無料枠で十分です！**

---

## 📁 アップロードするファイル（4つ）

Firebase設定後、GitHub Pagesにアップロードするファイル：

```
tac-production/
├── index.html          ← 変更なし
├── app.js              ← 変更なし
├── styles.css          ← 変更なし
├── data.js             ← 変更なし
└── firebase-config.js  ← ★設定値を入力済み★
```

---

**作成日**: 2026年2月1日  
**バージョン**: 2.0（Firebase統合版）
