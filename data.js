// ========================================
// データストレージ（LocalStorage + Firebase対応）
// ========================================

const DB = {
    // キー名
    KEYS: {
        USERS: 'pms_users',
        BOM: 'pms_bom',
        ORDERS: 'pms_orders',
        RATES: 'pms_rates',
        DEFECTS: 'pms_defects',
        PROGRESS_HISTORY: 'pms_progress_history',
        CURRENT_USER: 'pms_current_user',
        // 在庫管理
        INV_PRODUCTS: 'pms_inv_products',      // 商品マスタ
        INV_LOGS: 'pms_inv_logs',              // 棚卸ログ
        INV_MONTHLY: 'pms_inv_monthly'         // 月次在庫データ
    },

    // Firebaseキーへの変換（pms_プレフィックスを除去）
    toFirebaseKey(key) {
        return key.replace('pms_', '');
    },

    // キャッシュ（Firebase用）
    _cache: {},
    _listeners: {},

    // 初期データ
    init() {
        // Firebase接続時はリスナーを設定
        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB) {
            this.initFirebase();
            return;
        }

        // Firebase未設定時はローカルストレージで初期化
        this.initLocalStorage();
    },

    // LocalStorage初期化
    initLocalStorage() {
        console.log('📦 ローカルストレージモードで起動');

        // ユーザーに通知（Firebaseが設定されていないことへの注意喚起）
        setTimeout(() => {
            toast('⚠️ 現在オフラインモード（自分のみ）です。<br>共有するには設定が必要です。', 'warning', 10000);
        }, 2000);

        // ユーザー
        if (!localStorage.getItem(this.KEYS.USERS)) {
            this.save(this.KEYS.USERS, [
                { id: 1, username: 'admin', password: 'admin123', displayName: '管理者', role: 'admin', department: '管理部' },
                { id: 2, username: 'worker', password: 'worker123', displayName: '作業者A', role: 'worker', department: '製造部' }
            ]);
        }

        // BOM（サンプル）
        if (!localStorage.getItem(this.KEYS.BOM)) {
            this.save(this.KEYS.BOM, [
                {
                    id: 1,
                    category: 'PAO',
                    productName: 'PAO1012BL',
                    bomName: 'PaO1012BL(正面)',
                    partCode: 'FR1012BL',
                    processes: ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', 'エッヂバンダー', '仕上・梱包']
                },
                {
                    id: 2,
                    category: 'PAO',
                    productName: 'PAO1012BL',
                    bomName: 'PaO1012BL(側面L)',
                    partCode: 'SL1012BL',
                    processes: ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', '仕上・梱包']
                },
                {
                    id: 3,
                    category: 'PAO',
                    productName: 'PAO1012BL',
                    bomName: 'PaO1012BL(側面R)',
                    partCode: 'SR1012BL',
                    processes: ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', '仕上・梱包']
                }
            ]);
        }

        // 指示書（サンプル）
        if (!localStorage.getItem(this.KEYS.ORDERS)) {
            const today = new Date().toISOString().split('T')[0];
            const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            this.save(this.KEYS.ORDERS, [
                {
                    id: 1,
                    orderNo: 'TK-2026-001',
                    projectName: '○○ビル改装工事',
                    productName: 'PAO1012BL',
                    quantity: 5,
                    startDate: today,
                    dueDate: nextWeek,
                    color: 'ホワイト',
                    items: [
                        { id: 1, bomName: 'PaO1012BL(正面)', partCode: 'FR1012BL', processes: ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', 'エッヂバンダー', '仕上・梱包'], completed: [] },
                        { id: 2, bomName: 'PaO1012BL(側面L)', partCode: 'SL1012BL', processes: ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', '仕上・梱包'], completed: [] },
                        { id: 3, bomName: 'PaO1012BL(側面R)', partCode: 'SR1012BL', processes: ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', '仕上・梱包'], completed: [] }
                    ]
                }
            ]);
        }

        // 賃率
        if (!localStorage.getItem(this.KEYS.RATES)) {
            this.save(this.KEYS.RATES, [
                { id: 1, rateCode: 'A01', department: '基材係', rate: 50 },
                { id: 2, rateCode: 'A02', department: '加工係', rate: 55 },
                { id: 3, rateCode: 'A03', department: '梱包仕上係', rate: 45 }
            ]);
        }

        // 不良品
        if (!localStorage.getItem(this.KEYS.DEFECTS)) {
            this.save(this.KEYS.DEFECTS, []);
        }

        // 進捗履歴
        if (!localStorage.getItem(this.KEYS.PROGRESS_HISTORY)) {
            this.save(this.KEYS.PROGRESS_HISTORY, []);
        }

        // 在庫：商品マスタ（サンプル）
        if (!localStorage.getItem(this.KEYS.INV_PRODUCTS)) {
            this.save(this.KEYS.INV_PRODUCTS, [
                { id: 'N01000000001', name: 'パーティクルボード 18mm', category: '01', price: 3500, isFixed: false },
                { id: 'N02000000001', name: 'メラミン化粧板 白', category: '02', price: 2800, isFixed: false },
                { id: 'N05000000001', name: 'スライド丁番', category: '05', price: 150, isFixed: false }
            ]);
        }

        // 在庫：棚卸ログ
        if (!localStorage.getItem(this.KEYS.INV_LOGS)) {
            this.save(this.KEYS.INV_LOGS, []);
        }

        // 在庫：月次データ
        if (!localStorage.getItem(this.KEYS.INV_MONTHLY)) {
            this.save(this.KEYS.INV_MONTHLY, []);
        }
    },

    // Firebase初期化
    initFirebase() {
        console.log('🔥 Firebaseモードで起動');

        // 接続状態監視
        firebaseDB.ref('.info/connected').on('value', (snap) => {
            if (snap.val() === true) {
                console.log('✅ Firebase接続完了');
                toast('☁️ サーバーに接続しました（共有有効）', 'success');
            } else {
                console.warn('⚠️ Firebase未接続');
                // 切断時（または初期接続失敗時）
                // toast('⚠️ サーバー接続が切れています', 'warning');
            }
        });

        // 各データタイプにリスナーを設定
        const dataKeys = [
            this.KEYS.USERS, this.KEYS.BOM, this.KEYS.ORDERS,
            this.KEYS.RATES, this.KEYS.DEFECTS, this.KEYS.PROGRESS_HISTORY,
            this.KEYS.INV_PRODUCTS, this.KEYS.INV_LOGS, this.KEYS.INV_MONTHLY
        ];

        dataKeys.forEach(key => {
            const fbKey = this.toFirebaseKey(key);

            // リアルタイムリスナー
            firebaseDB.ref(fbKey).on('value', (snapshot) => {
                const data = snapshot.val();
                this._cache[key] = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
                console.log(`🔄 ${fbKey} 更新:`, this._cache[key].length, '件');

                // UI更新（定義されている場合）
                if (typeof refreshCurrentPage === 'function') {
                    refreshCurrentPage();
                }
            }, (error) => {
                console.error(`❌ ${fbKey} 読み込みエラー:`, error);
            });
        });

        // 初期データがない場合は作成
        setTimeout(() => {
            this.ensureInitialData();
        }, 2000);
    },

    // Firebase初期データ確認
    ensureInitialData() {
        if (this.get(this.KEYS.USERS).length === 0) {
            this.save(this.KEYS.USERS, [
                { id: 1, username: 'admin', password: 'admin123', displayName: '管理者', role: 'admin', department: '管理部' },
                { id: 2, username: 'worker', password: 'worker123', displayName: '作業者A', role: 'worker', department: '製造部' }
            ]);
        }
        if (this.get(this.KEYS.RATES).length === 0) {
            this.save(this.KEYS.RATES, [
                { id: 1, rateCode: 'A01', department: '基材係', rate: 50 },
                { id: 2, rateCode: 'A02', department: '加工係', rate: 55 },
                { id: 3, rateCode: 'A03', department: '梱包仕上係', rate: 45 }
            ]);
        }
    },

    // 保存
    save(key, data) {
        // Firebase使用時
        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB && key !== this.KEYS.CURRENT_USER) {
            const fbKey = this.toFirebaseKey(key);
            firebaseDB.ref(fbKey).set(data)
                .then(() => console.log(`💾 ${fbKey} 保存完了`))
                .catch(err => console.error(`❌ ${fbKey} 保存エラー:`, err));
            this._cache[key] = data;
        } else {
            // ローカルストレージ
            localStorage.setItem(key, JSON.stringify(data));
        }
    },

    // 取得
    get(key) {
        // Firebase使用時（キャッシュから取得）
        if (typeof useFirebase !== 'undefined' && useFirebase && key !== this.KEYS.CURRENT_USER) {
            return this._cache[key] || [];
        }
        // ローカルストレージ
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },

    // 次のID
    nextId(key) {
        const data = this.get(key);
        return data.length > 0 ? Math.max(...data.map(d => d.id || 0)) + 1 : 1;
    }
};

// 標準工程リスト
const STANDARD_PROCESSES = [
    '芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー',
    'エッヂバンダー', 'TOYO', 'HOMAG', '仕上・梱包', 'フロア加工',
    'アクリルBOX作成', '扉面材くり抜き'
];

// 現在のページを更新（Firebase用）
function refreshCurrentPage() {
    // 現在表示中のページを再描画
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        if (typeof navigateTo === 'function') {
            // ナビゲーション状態は変えずに再描画のみ
            switch (pageId) {
                case 'dashboard': if (typeof renderDashboard === 'function') renderDashboard(); break;
                case 'gantt': if (typeof renderGantt === 'function') renderGantt(); break;
                case 'orders': if (typeof renderOrders === 'function') renderOrders(); break;
                case 'bom': if (typeof renderBom === 'function') renderBom(); break;
            }
        }
    }
}
