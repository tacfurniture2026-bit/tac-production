// =====================================================
// Firebase 設定ファイル
// =====================================================
// 
// 【設定手順】
// 1. Firebase Console (https://console.firebase.google.com) にアクセス
// 2. プロジェクトを作成
// 3. Realtime Database を有効化
// 4. プロジェクト設定 > マイアプリ > ウェブ でアプリを登録
// 5. 表示される設定値を下記に貼り付け
// 
// =====================================================

// Firebase設定
const firebaseConfig = {
    apiKey: "AIzaSyAtXI3uz70l5P6UF26OC1Tru1fte35343g",
    authDomain: "tac-production-bfd08.firebaseapp.com",
    databaseURL: "https://tac-production-bfd08-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tac-production-bfd08",
    storageBucket: "tac-production-bfd08.firebasestorage.app",
    messagingSenderId: "299994554225",
    appId: "1:299994554225:web:33f0de3f5f9e53f21de0d0"
};

// =====================================================
// Firebase初期化（設定が有効な場合のみ）
// =====================================================

let firebaseApp = null;
let firebaseDB = null;
let useFirebase = false;

// Firebase設定が有効かチェック
function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== "YOUR_API_KEY" &&
        firebaseConfig.databaseURL !== "https://YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app";
}

// Firebase初期化
if (typeof firebase !== 'undefined' && isFirebaseConfigured()) {
    try {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseDB = firebase.database();
        useFirebase = true;
        console.log('✅ Firebase 接続成功！リアルタイム同期が有効です。');
    } catch (error) {
        console.warn('⚠️ Firebase 初期化エラー:', error.message);
        useFirebase = false;
    }
} else {
    console.log('ℹ️ Firebase未設定：ローカルストレージモードで動作します。');
    console.log('   リアルタイム共有を有効にするには、firebase-config.js を設定してください。');
}
