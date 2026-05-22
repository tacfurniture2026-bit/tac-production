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
        INV_MONTHLY: 'pms_inv_monthly',        // 月次在庫データ
        INV_SCAN_TEMP: 'pms_inv_scan_temp',    // 棚卸仮スキャンデータ
        // バックアップ
        BACKUPS: 'pms_backups'                 // バックアップ履歴
    },

    // Firebaseキーへの変換（pms_プレフィックスを除去）
    toFirebaseKey(key) {
        return key.replace('pms_', '');
    },

    // キャッシュ（Firebase用）
    _cache: {},
    _listeners: {},
    _loaded: {}, // Firebaseからの初回読み込み完了フラグ

    // 初期データ
    init() {
        // Firebase接続時はリスナーを設定
        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB) {
            this.initFirebase();
            setTimeout(() => {
                this.applyLatestBom();
            }, 3000);
            return;
        }

        // Firebase未設定時はローカルストレージで初期化
        this.initLocalStorage();
        this.applyLatestBom();
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

        // 賃率（localStorageモードのみ。Firebaseモードは ensureInitialData で処理）
        const isFirebaseMode = typeof useFirebase !== 'undefined' && useFirebase;
        if (!isFirebaseMode) {
            const defaultRates = [
                { id: 1, rateCode: '第二製造課基材係', department: '製造部', section: '第二製造課', subsection: '基材係', monthlyRate: 480855, dailyRate: 22898, hourlyRate: 2862, minuteRate: 47.7, secondRate: 0.8 },
                { id: 2, rateCode: '第二製造課加工係', department: '製造部', section: '第二製造課', subsection: '加工係', monthlyRate: 487041, dailyRate: 23192, hourlyRate: 2899, minuteRate: 48.3, secondRate: 0.8 },
                { id: 3, rateCode: '第二製造課梱包仕上係', department: '製造部', section: '第二製造課', subsection: '梱包仕上係', monthlyRate: 360695, dailyRate: 17176, hourlyRate: 2147, minuteRate: 35.8, secondRate: 0.6 }
            ];
            const existingRates = localStorage.getItem(this.KEYS.RATES);
            if (!existingRates) {
                this.save(this.KEYS.RATES, defaultRates);
            } else {
                try {
                    const parsed = JSON.parse(existingRates);
                    const isOldFormat = Array.isArray(parsed) && parsed.length > 0 &&
                        (parsed[0].rate !== undefined ||
                            parsed[0].secondRate === undefined ||
                            parsed[0].rateCode === 'A01');
                    if (isOldFormat) {
                        console.log('🔄 賃率データをマイグレーション: 旧形式 → 新形式');
                        this.save(this.KEYS.RATES, defaultRates);
                    }
                } catch (e) {
                    this.save(this.KEYS.RATES, defaultRates);
                }
            }
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

        // 在庫：棚卸仮スキャンデータ
        if (!localStorage.getItem(this.KEYS.INV_SCAN_TEMP)) {
            this.save(this.KEYS.INV_SCAN_TEMP, []);
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
            this.KEYS.INV_PRODUCTS, this.KEYS.INV_LOGS, this.KEYS.INV_MONTHLY,
            this.KEYS.BACKUPS, this.KEYS.INV_SCAN_TEMP
        ];

        dataKeys.forEach(key => {
            const fbKey = this.toFirebaseKey(key);

            // リアルタイムリスナー
            firebaseDB.ref(fbKey).on('value', (snapshot) => {
                const data = snapshot.val();
                let parsedData = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
                this._cache[key] = parsedData.filter(item => item !== null);
                this._loaded[key] = true; // 同期完了フラグをセット
                localStorage.setItem(key, JSON.stringify(this._cache[key])); // 常にローカルにバックアップ
                console.log(`🔄 ${fbKey} 更新:`, this._cache[key].length, '件');

                // UI更新（定義されている場合）
                if (typeof refreshCurrentPage === 'function') {
                    refreshCurrentPage();
                }
            }, (error) => {
                console.error(`❌ ${fbKey} 読み込みエラー:`, error);
                // エラー時もロックを解除してローカルキャッシュで動作可能にする
                this._loaded[key] = true;
            });
        });

        // 初期データがない場合は作成
        setTimeout(() => {
            this.ensureInitialData();
        }, 2000);

        // 自動バックアップチェック（データ読み込み後）
        setTimeout(() => {
            this.checkAutoBackup();
        }, 5000);
    },

    // Firebase初期データ確認
    ensureInitialData() {
        const defaultRates = [
            { id: 1, rateCode: '第二製造課基材係', department: '製造部', section: '第二製造課', subsection: '基材係', monthlyRate: 480855, dailyRate: 22898, hourlyRate: 2862, minuteRate: 47.7, secondRate: 0.8 },
            { id: 2, rateCode: '第二製造課加工係', department: '製造部', section: '第二製造課', subsection: '加工係', monthlyRate: 487041, dailyRate: 23192, hourlyRate: 2899, minuteRate: 48.3, secondRate: 0.8 },
            { id: 3, rateCode: '第二製造課梱包仕上係', department: '製造部', section: '第二製造課', subsection: '梱包仕上係', monthlyRate: 360695, dailyRate: 17176, hourlyRate: 2147, minuteRate: 35.8, secondRate: 0.6 }
        ];

        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB) {
            firebaseDB.ref(this.toFirebaseKey(this.KEYS.USERS)).once('value').then(snap => {
                if (!snap.exists() || !snap.val() || Object.keys(snap.val()).length === 0) {
                    this.save(this.KEYS.USERS, [
                        { id: 1, username: 'admin', password: 'admin123', displayName: '管理者', role: 'admin', department: '管理部' },
                        { id: 2, username: 'worker', password: 'worker123', displayName: '作業者A', role: 'worker', department: '製造部' }
                    ]);
                }
            });

            firebaseDB.ref(this.toFirebaseKey(this.KEYS.RATES)).once('value').then(snap => {
                let needsInit = false;
                if (!snap.exists() || !snap.val() || Object.keys(snap.val()).length === 0) {
                    needsInit = true;
                } else {
                    const data = snap.val();
                    const rates = Array.isArray(data) ? data : Object.values(data);
                    if (rates.length > 0 && (
                        rates[0].secondRate === undefined ||
                        rates[0].rate !== undefined ||
                        rates[0].rateCode === 'A01'
                    )) {
                        needsInit = true;
                    }
                }

                if (needsInit) {
                    console.log('🔄 ensureInitialData: 賃率データを初期化/マイグレーション');
                    this.save(this.KEYS.RATES, defaultRates);
                }
            });
        } else {
            if (this.get(this.KEYS.USERS).length === 0) {
                this.save(this.KEYS.USERS, [
                    { id: 1, username: 'admin', password: 'admin123', displayName: '管理者', role: 'admin', department: '管理部' },
                    { id: 2, username: 'worker', password: 'worker123', displayName: '作業者A', role: 'worker', department: '製造部' }
                ]);
            }

            // 賃率: 空 OR 旧形式なら初期値を設定
            const rates = this.get(this.KEYS.RATES);
            const needsInit = rates.length === 0 ||
                (rates.length > 0 && (
                    rates[0].secondRate === undefined ||
                    rates[0].rate !== undefined ||
                    rates[0].rateCode === 'A01'
                ));

            if (needsInit) {
                console.log('🔄 ensureInitialData: 賃率データを初期化/マイグレーション');
                this.save(this.KEYS.RATES, defaultRates);
            }
        }
        
        // 既存スキャンデータの救済（INV_PRODUCTS 内から INV_SCAN_TEMP へ抽出・移行）
        setTimeout(() => {
            this.migrateTempScansFromProducts();
        }, 3000);
    },

    // 既存の埋め込みスキャンデータを INV_SCAN_TEMP に移行する（データロスト防止）
    migrateTempScansFromProducts() {
        if (typeof useFirebase !== 'undefined' && useFirebase && (!this._loaded[this.KEYS.INV_PRODUCTS] || !this._loaded[this.KEYS.INV_SCAN_TEMP])) {
            // Firebase読込待機
            setTimeout(() => this.migrateTempScansFromProducts(), 1000);
            return;
        }

        const products = this.get(this.KEYS.INV_PRODUCTS) || [];
        const tempScans = this.get(this.KEYS.INV_SCAN_TEMP) || [];
        let migratedCount = 0;
        let needsProductSave = false;

        products.forEach(p => {
            if (p.tempQty !== undefined && p.tempQty !== null) {
                const scanId = p.tempId || (Date.now() + "_" + p.id);
                // 既に存在しない場合のみ追加
                if (!tempScans.some(s => s.id === scanId)) {
                    tempScans.push({
                        id: scanId,
                        productId: p.id,
                        quantity: p.tempQty,
                        worker: p.tempWorker || '',
                        workerName: p.tempWorkerName || '',
                        timestamp: p.tempTimestamp || new Date().toISOString(),
                        month: p.tempMonth || '',
                        type: 'count_temp'
                    });
                    migratedCount++;
                }
                // products から削除
                delete p.tempQty;
                delete p.tempWorker;
                delete p.tempWorkerName;
                delete p.tempTimestamp;
                delete p.tempMonth;
                delete p.tempId;
                needsProductSave = true;
            }
        });

        if (migratedCount > 0 || needsProductSave) {
            console.log(`🔄 ${migratedCount}件の仮スキャンデータを INV_SCAN_TEMP に移行・救済しました。`);
            this.save(this.KEYS.INV_SCAN_TEMP, tempScans);
            this.save(this.KEYS.INV_PRODUCTS, products);
        }
    },

    // 保存（全置換 - 初期化時など限定）
    save(key, data) {
        // Firebase同期前の空データ上書きを防止
        if (typeof useFirebase !== 'undefined' && useFirebase && !this._loaded[key]) {
            console.warn(`⚠️ ${key} の保存をスキップ: Firebaseからの初回読み込みが未完了です`);
            return;
        }

        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB && key !== this.KEYS.CURRENT_USER) {
            const fbKey = this.toFirebaseKey(key);
            firebaseDB.ref(fbKey).set(data)
                .then(() => console.log(`💾 ${fbKey} 保存完了`))
                .catch(err => console.error(`❌ ${fbKey} 保存エラー:`, err));
            this._cache[key] = data;
            // 常にLocalStorageにもキャッシュを保存（オフライン・権限エラー対策の強力なフォールバック）
            localStorage.setItem(key, JSON.stringify(data));
        } else {
            localStorage.setItem(key, JSON.stringify(data));
            if (typeof refreshCurrentPage === 'function') refreshCurrentPage();
        }
    },

    // 棚卸仮スキャンデータ
    getTempScans() {
        const logs = this.get(this.KEYS.INV_LOGS) || [];
        return logs.filter(log => log && log.type === 'count_temp');
    },

    saveTempScan(productId, quantity, worker, workerName, timestamp, month, terminalId) {
        const newScan = {
            id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
            productId: productId,
            quantity: quantity,
            worker: worker,
            workerName: workerName,
            timestamp: timestamp,
            month: month,
            terminalId: terminalId || '',
            type: 'count_temp'
        };
        // Firebaseルールに合わせるため INV_LOGS に保存する
        this.add(this.KEYS.INV_LOGS, newScan);
    },

    deleteTempScan(scanId) {
        // Firebaseでremoveが禁止されている可能性を考慮し、deleteではなく論理削除(0に更新)するか、
        // 少なくとも INV_LOGS からの削除を試みるがエラーはcatchする。
        // ここは一旦 INV_LOGSのdeleteに戻す
        this.delete(this.KEYS.INV_LOGS, scanId);
    },

    clearTempScans() {
        const tempScans = this.getTempScans();
        tempScans.forEach(scan => {
            if (scan && scan.id) {
                this.delete(this.KEYS.INV_LOGS, scan.id);
            }
        });
    },

    // ========================================
    // 棚卸バッチスキャン（オフライン・ローカル蓄積用）
    // ========================================
    LOCAL_BATCH_KEY: 'pms_local_batch_scans',

    getLocalBatchScans() {
        try {
            const data = localStorage.getItem(this.LOCAL_BATCH_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('ローカルバッチ読み込みエラー', e);
            return [];
        }
    },

    saveLocalBatchScan(scanItem) {
        const scans = this.getLocalBatchScans();
        scans.push(scanItem);
        localStorage.setItem(this.LOCAL_BATCH_KEY, JSON.stringify(scans));
    },

    updateLocalBatchScan(productId, newQty) {
        const scans = this.getLocalBatchScans();
        // 最新のものを上書きする（通常はproductIdごとに1件を想定）
        let found = false;
        for (let i = scans.length - 1; i >= 0; i--) {
            if (scans[i].productId === productId) {
                scans[i].quantity = newQty;
                scans[i].timestamp = new Date().toISOString();
                found = true;
                break;
            }
        }
        if (found) {
            localStorage.setItem(this.LOCAL_BATCH_KEY, JSON.stringify(scans));
            return true;
        }
        return false;
    },

    deleteLocalBatchScan(productId) {
        let scans = this.getLocalBatchScans();
        // IDが完全一致するものを除外。また、productId自体が存在しない不正なデータもついでに掃除する
        scans = scans.filter(s => s && s.productId && String(s.productId) !== String(productId));
        localStorage.setItem(this.LOCAL_BATCH_KEY, JSON.stringify(scans));
    },

    clearLocalBatchScans() {
        localStorage.setItem(this.LOCAL_BATCH_KEY, JSON.stringify([]));
    },

    // 追加（競合回避：トランザクション使用）
    add(key, newItem) {
        // 即座にローカルに反映してリロード消失を防止（オプティミスティックUI保護）
        let localData = this._cache[key] || [];
        if (!Array.isArray(localData)) localData = Object.values(localData).filter(item => item !== null);
        if (newItem.id && !localData.some(d => d.id === newItem.id)) {
            localData.push(newItem);
            this._cache[key] = localData;
            localStorage.setItem(key, JSON.stringify(localData));
        }

        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB && key !== this.KEYS.CURRENT_USER) {
            const fbKey = this.toFirebaseKey(key);
            // オフライン時のキューイングをサポートするため、トランザクションではなく個別の child に対して set を行う
            firebaseDB.ref(fbKey).child(newItem.id).set(newItem, (error) => {
                if (error) {
                    console.error('Add failed:', error, 'newItem:', newItem);
                    toast('追加に失敗しました: ' + (error.message || error), 'error');
                }
            });
        } else {
            this.save(key, localData);
        }
    },

    // 複数件の追加を安全に行う（競合回避のための update 使用）
    addMultiple(key, newItems) {
        if (!newItems || newItems.length === 0) return Promise.resolve(true);
        
        let localData = this._cache[key] || [];
        if (!Array.isArray(localData)) localData = Object.values(localData).filter(item => item !== null);
        
        newItems.forEach(newItem => {
            if (newItem.id && !localData.some(d => d.id === newItem.id)) {
                localData.push(newItem);
            }
        });
        this._cache[key] = localData;
        localStorage.setItem(key, JSON.stringify(localData));

        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB && key !== this.KEYS.CURRENT_USER) {
            const fbKey = this.toFirebaseKey(key);
            
            // ルールによるPermission Deniedやレートリミットを防ぐため、直列（1件ずつ順番に）set() を実行する
            const processSequentially = async () => {
                for (const item of newItems) {
                    // Firebaseでは undefined なプロパティはエラーになるため削除
                    Object.keys(item).forEach(k => item[k] === undefined && delete item[k]);
                    
                    await new Promise((resolve, reject) => {
                        firebaseDB.ref(fbKey).child(item.id).set(item, (error) => {
                            if (error) {
                                console.error('Firebase set error for item:', item.id, error);
                                reject(error);
                            } else {
                                resolve();
                            }
                        });
                    });
                }
            };

            return processSequentially()
                .then(() => true)
                .catch(error => {
                    console.error('addMultiple failed (sequential set):', error);
                    toast('データの送信に一部失敗しました: ' + (error.message || error), 'error');
                    return Promise.reject(error);
                });
        } else {
            this.save(key, localData);
            return Promise.resolve(true);
        }
    },

    // 一括追加（Promise対応・Firebase非同期対応）
    addBulk(key, newItems) {
        if (!newItems || newItems.length === 0) return Promise.resolve(true);
        
        console.log(`📦 addBulk開始: key=${key}, 件数=${newItems.length}`);
        
        // 現在のデータを取得してローカルで結合
        const currentData = this.get(key);
        console.log(`📦 addBulk: 既存データ ${currentData.length}件`);
        
        // 最大IDを算出（数値IDのみ対象）
        let maxId = 0;
        currentData.forEach(item => {
            if (item && item.id) {
                const numId = typeof item.id === 'number' ? item.id : parseInt(item.id, 10);
                if (!isNaN(numId) && numId > maxId) maxId = numId;
            }
        });
        console.log(`📦 addBulk: 現在の最大ID=${maxId}`);
        
        // 新アイテムにIDを付与してコピー（元データを変更しない）
        const itemsToAdd = newItems.map(item => {
            maxId++;
            return Object.assign({}, item, { id: maxId });
        });
        
        // 結合
        const merged = currentData.concat(itemsToAdd);
        console.log(`📦 addBulk: 結合後 ${merged.length}件, Firebase=${typeof useFirebase !== 'undefined' && useFirebase}`);
        
        // Firebase使用時は直接setして完了を待つ
        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB && key !== this.KEYS.CURRENT_USER) {
            const fbKey = this.toFirebaseKey(key);
            this._cache[key] = merged;
            localStorage.setItem(key, JSON.stringify(merged));
            return firebaseDB.ref(fbKey).set(merged)
                .then(() => {
                    console.log(`✅ addBulk Firebase保存完了: ${itemsToAdd.length}件追加`);
                    return true;
                })
                .catch(err => {
                    console.error(`❌ addBulk Firebase保存エラー:`, err);
                    throw err;
                });
        } else {
            // ローカルストレージ
            try {
                localStorage.setItem(key, JSON.stringify(merged));
                console.log(`✅ addBulk ローカル保存完了: ${itemsToAdd.length}件追加`);
                return Promise.resolve(true);
            } catch (err) {
                console.error('addBulk ローカル保存エラー:', err);
                return Promise.reject(err);
            }
        }
    },

    // 更新（競合回避：トランザクション使用）
    update(key, id, updatedItem) {
        // 即座にローカルに反映してリロード消失を防止
        let localData = this._cache[key] || [];
        if (!Array.isArray(localData)) localData = Object.values(localData).filter(item => item !== null);
        const index = localData.findIndex(item => item && item.id === id);
        if (index !== -1) {
            localData[index] = updatedItem;
            this._cache[key] = localData;
            localStorage.setItem(key, JSON.stringify(localData));
        }

        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB && key !== this.KEYS.CURRENT_USER) {
            const fbKey = this.toFirebaseKey(key);
            // オフライン対応のため、個別の child に対して update/set を行う
            firebaseDB.ref(fbKey).child(id).set(updatedItem, (error) => {
                if (error) {
                    console.error('Update failed:', error);
                    toast('更新に失敗しました: ' + error.message, 'error');
                }
            });
        } else {
            this.save(key, localData);
        }
    },

    // 削除（競合回避：トランザクション使用）
    delete(key, id) {
        // 即座にローカルに反映してリロード消失を防止
        let localData = this._cache[key] || [];
        if (!Array.isArray(localData)) localData = Object.values(localData).filter(item => item !== null);
        const filteredLocal = localData.filter(item => item && item.id !== id);
        this._cache[key] = filteredLocal;
        localStorage.setItem(key, JSON.stringify(filteredLocal));

        if (typeof useFirebase !== 'undefined' && useFirebase && firebaseDB && key !== this.KEYS.CURRENT_USER) {
            const fbKey = this.toFirebaseKey(key);
            // オフライン対応のため、個別の child を削除する
            firebaseDB.ref(fbKey).child(id).remove((error) => {
                if (error) {
                    console.error('Delete failed:', error);
                    toast('削除に失敗しました: ' + error.message, 'error');
                }
            });
        } else {
            this.save(key, filteredLocal);
        }
    },

    // 取得
    get(key) {
        // Firebase使用時（ロード完了している場合はキャッシュから取得）
        if (typeof useFirebase !== 'undefined' && useFirebase && key !== this.KEYS.CURRENT_USER) {
            if (this._loaded[key]) {
                return this._cache[key] || [];
            }
        }
        // 未ロード、オフライン時、またはローカル専用時はローカルストレージから取得
        const data = localStorage.getItem(key);
        try {
            const parsed = data ? JSON.parse(data) : [];
            const parsedArray = Array.isArray(parsed) ? parsed : [];
            return parsedArray.filter(item => item !== null);
        } catch (e) {
            console.error('DB Parse Error:', key, e);
            return [];
        }
    },

    // 次のID
    nextId(key) {
        const data = this.get(key);
        return data.length > 0 ? Math.max(...data.map(d => d.id || 0)) + 1 : 1;
    },

    // ========================================
    // バックアップ機能
    // ========================================

    // バックアップ対象のキー一覧
    _backupTargetKeys() {
        return [
            this.KEYS.USERS, this.KEYS.BOM, this.KEYS.ORDERS,
            this.KEYS.RATES, this.KEYS.DEFECTS, this.KEYS.PROGRESS_HISTORY,
            this.KEYS.INV_PRODUCTS, this.KEYS.INV_LOGS, this.KEYS.INV_MONTHLY
        ];
    },

    // バックアップ作成
    createBackup(label) {
        const snapshot = {};
        let totalRecords = 0;
        this._backupTargetKeys().forEach(key => {
            const data = this.get(key);
            snapshot[key] = data;
            totalRecords += data.length;
        });

        const backups = this.get(this.KEYS.BACKUPS);
        const backup = {
            id: Date.now(),
            label: label || '手動バックアップ',
            createdAt: new Date().toISOString(),
            totalRecords,
            dataSize: JSON.stringify(snapshot).length,
            snapshot
        };
        backups.push(backup);
        this.save(this.KEYS.BACKUPS, backups);
        localStorage.setItem('pms_last_backup_date', new Date().toISOString());
        return backup;
    },

    // バックアップから復元
    restoreBackup(backupId) {
        const backups = this.get(this.KEYS.BACKUPS);
        const backup = backups.find(b => b.id === backupId);
        if (!backup || !backup.snapshot) return false;

        this._backupTargetKeys().forEach(key => {
            if (backup.snapshot[key] !== undefined) {
                this.save(key, backup.snapshot[key]);
            }
        });
        return true;
    },

    // バックアップ削除
    deleteBackupById(backupId) {
        let backups = this.get(this.KEYS.BACKUPS);
        backups = backups.filter(b => b.id !== backupId);
        this.save(this.KEYS.BACKUPS, backups);
    },

    // バックアップ一覧取得(スナップショットなし=軽量)
    getBackupList() {
        const backups = this.get(this.KEYS.BACKUPS);
        return backups.map(b => ({
            id: b.id,
            label: b.label,
            createdAt: b.createdAt,
            totalRecords: b.totalRecords,
            dataSize: b.dataSize
        }));
    },

    // 自動バックアップチェック（月1回・日曜日）
    checkAutoBackup() {
        const now = new Date();
        // 日曜日（0）でなければスキップ
        if (now.getDay() !== 0) return;

        const lastBackup = localStorage.getItem('pms_last_backup_date');
        if (lastBackup) {
            const lastDate = new Date(lastBackup);
            const daysSince = (now - lastDate) / (1000 * 60 * 60 * 24);
            if (daysSince < 28) return; // 28日未満ならスキップ
        }

        // 自動バックアップ実行
        console.log('💾 自動バックアップを実行中...');
        const backup = this.createBackup('自動バックアップ（月次）');
        console.log(`✅ 自動バックアップ完了: ${backup.totalRecords}件`);
        if (typeof toast === 'function') {
            toast(`💾 月次自動バックアップを作成しました（${backup.totalRecords}件）`, 'success');
        }

        // 古いバックアップを整理（最新6件のみ保持）
        let backups = this.get(this.KEYS.BACKUPS);
        if (backups.length > 6) {
            backups.sort((a, b) => b.id - a.id);
            backups = backups.slice(0, 6);
            this.save(this.KEYS.BACKUPS, backups);
        }
    },
    // BOM強制アップデート (v5.03)
    applyLatestBom() {
        if (localStorage.getItem('pms_bom_v503_applied') !== 'true') {
            console.log('🔄 v5.03の最新BOMデータを強制適用します...');
            this.save(this.KEYS.BOM, NEW_BOM_DATA);
            localStorage.setItem('pms_bom_v503_applied', 'true');
        }
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


// 最新のBOMデータ (v5.02)
const NEW_BOM_DATA = [
    {
        "id": 1,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(正面)",
        "partCode": "FR1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 2,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(後面)",
        "partCode": "BA1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 3,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(右側面)",
        "partCode": "RI1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 4,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(左側面)",
        "partCode": "LE1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 5,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(天井)",
        "partCode": "TN1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 6,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(床)",
        "partCode": "YK1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 7,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(デスク)",
        "partCode": "DK1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 8,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(幕板大)",
        "partCode": "ML1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 9,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(幕板小)",
        "partCode": "MS1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 10,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(開扉)",
        "partCode": "DO1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 11,
        "category": "PAO",
        "productName": "PAO1012BL-F",
        "bomName": "PAO1012BL-F(フロア)",
        "partCode": "FL1012BL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 12,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(正面)",
        "partCode": "FR1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 13,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(後面)",
        "partCode": "BA1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 14,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(右側面)",
        "partCode": "RI1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 15,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(左側面)",
        "partCode": "LE1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 16,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(天井)",
        "partCode": "TN1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 17,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(床)",
        "partCode": "YK1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 18,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(デスク)",
        "partCode": "DK1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 19,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(幕板大)",
        "partCode": "ML1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 20,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(幕板小)",
        "partCode": "MS1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 21,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(開扉)",
        "partCode": "DO1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 22,
        "category": "PAO",
        "productName": "PAO1012BR-F",
        "bomName": "PAO1012BR-F(フロア)",
        "partCode": "FL1012BR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 23,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(正面)",
        "partCode": "FR1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 24,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(後面)",
        "partCode": "BA1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 25,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(右側面)",
        "partCode": "RI1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 26,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(左側面)",
        "partCode": "LE1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 27,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(天井)",
        "partCode": "TN1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 28,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(床)",
        "partCode": "YK1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 29,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(デスク)",
        "partCode": "DK1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 30,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(幕板大)",
        "partCode": "ML1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 31,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(幕板小)",
        "partCode": "MS1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 32,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(開扉)",
        "partCode": "DO1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 33,
        "category": "PAO",
        "productName": "PAO1012SL-F",
        "bomName": "PAO1012SL-F(フロア)",
        "partCode": "FL1012SL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 34,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(正面)",
        "partCode": "FR1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 35,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(後面)",
        "partCode": "BA1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 36,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(右側面)",
        "partCode": "RI1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 37,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(左側面)",
        "partCode": "LE1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 38,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(天井)",
        "partCode": "TN1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 39,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(床)",
        "partCode": "YK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 40,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(デスク)",
        "partCode": "DK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 41,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(幕板大)",
        "partCode": "ML1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 42,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(幕板小)",
        "partCode": "MS1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 43,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(開扉)",
        "partCode": "DO1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 44,
        "category": "PAO",
        "productName": "PAO1012SR-F",
        "bomName": "PAO1012SR-F(フロア)",
        "partCode": "FL1012SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 45,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(正面)",
        "partCode": "FR1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 46,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(後面)",
        "partCode": "BA1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 47,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(右側面前)",
        "partCode": "RF1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 48,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(右側面後)",
        "partCode": "RB1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 49,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(左側面前)",
        "partCode": "LF1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 50,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(左側面後)",
        "partCode": "LB1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 51,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(天井)",
        "partCode": "TN1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 52,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(床)",
        "partCode": "YK1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 53,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(デスク)",
        "partCode": "DK1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 54,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(幕板大)",
        "partCode": "ML1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 55,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(幕板小)",
        "partCode": "MS1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 56,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(開扉)",
        "partCode": "DO1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 57,
        "category": "PAO",
        "productName": "PAO1018BL-F",
        "bomName": "PAO1018BL-F(フロア)",
        "partCode": "FL1018BL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 58,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(正面)",
        "partCode": "FR1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 59,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(後面)",
        "partCode": "BA1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 60,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(右側面前)",
        "partCode": "RF1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 61,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(右側面後)",
        "partCode": "RB1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 62,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(左側面前)",
        "partCode": "LF1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 63,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(左側面後)",
        "partCode": "LB1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 64,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(天井)",
        "partCode": "TN1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 65,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(床)",
        "partCode": "YK1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 66,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(デスク)",
        "partCode": "DK1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 67,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(幕板大)",
        "partCode": "ML1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 68,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(幕板小)",
        "partCode": "MS1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 69,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(開扉)",
        "partCode": "DO1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 70,
        "category": "PAO",
        "productName": "PAO1018BR-F",
        "bomName": "PAO1018BR-F(フロア)",
        "partCode": "FL1018BR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 71,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(正面)",
        "partCode": "FR1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 72,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(後面)",
        "partCode": "BA1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 73,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(右側面前)",
        "partCode": "RF1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 74,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(右側面後)",
        "partCode": "RB1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 75,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(左側面前)",
        "partCode": "LF1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 76,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(左側面後)",
        "partCode": "LB1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 77,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(天井)",
        "partCode": "TN1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 78,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(床)",
        "partCode": "YK1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 79,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(デスク)",
        "partCode": "DK1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 80,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(幕板大)",
        "partCode": "ML1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 81,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(幕板小)",
        "partCode": "MS1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 82,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(開扉)",
        "partCode": "DO1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 83,
        "category": "PAO",
        "productName": "PAO1018SL-F",
        "bomName": "PAO1018SL-F(フロア)",
        "partCode": "FL1018SL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 84,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(正面)",
        "partCode": "FR1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 85,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(後面)",
        "partCode": "BA1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 86,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(右側面前)",
        "partCode": "RF1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 87,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(右側面後)",
        "partCode": "RB1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 88,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(左側面前)",
        "partCode": "LF1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 89,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(左側面後)",
        "partCode": "LB1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 90,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(天井)",
        "partCode": "TN1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 91,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(床)",
        "partCode": "YK1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 92,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(デスク)",
        "partCode": "DK1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 93,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(幕板大)",
        "partCode": "ML1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 94,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(幕板小)",
        "partCode": "MS1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 95,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(開扉)",
        "partCode": "DO1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 96,
        "category": "PAO",
        "productName": "PAO1018SR-F",
        "bomName": "PAO1018SR-F(フロア)",
        "partCode": "FL1018SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 97,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(正面)",
        "partCode": "FR1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 98,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(後面)",
        "partCode": "BA1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 99,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(右側面前)",
        "partCode": "RF1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 100,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(右側面後)",
        "partCode": "RB1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 101,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(左側面前)",
        "partCode": "LF1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 102,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(左側面後)",
        "partCode": "LB1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 103,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(天井)",
        "partCode": "TN1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 104,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(床)",
        "partCode": "YK1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 105,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(デスク)",
        "partCode": "DK1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 106,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(幕板大)",
        "partCode": "ML1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 107,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(幕板小)",
        "partCode": "MS1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 108,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(開扉)",
        "partCode": "DO1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 109,
        "category": "PAO",
        "productName": "PAO1218BL-F",
        "bomName": "PAO1218BL-F(フロア)",
        "partCode": "FL1218BL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 110,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(正面)",
        "partCode": "FR1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 111,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(後面)",
        "partCode": "BA1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 112,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(右側面前)",
        "partCode": "RF1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 113,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(右側面後)",
        "partCode": "RB1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 114,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(左側面前)",
        "partCode": "LF1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 115,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(左側面後)",
        "partCode": "LB1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 116,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(天井)",
        "partCode": "TN1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 117,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(床)",
        "partCode": "YK1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 118,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(デスク)",
        "partCode": "DK1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 119,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(幕板大)",
        "partCode": "ML1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 120,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(幕板小)",
        "partCode": "MS1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 121,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(開扉)",
        "partCode": "DO1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 122,
        "category": "PAO",
        "productName": "PAO1218BR-F",
        "bomName": "PAO1218BR-F(フロア)",
        "partCode": "FL1218BR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 123,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(正面)",
        "partCode": "FR1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 124,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(後面)",
        "partCode": "BA1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 125,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(右側面前)",
        "partCode": "RF1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 126,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(右側面後)",
        "partCode": "RB1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 127,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(左側面前)",
        "partCode": "LF1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 128,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(左側面後)",
        "partCode": "LB1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 129,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(天井)",
        "partCode": "TN1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 130,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(床)",
        "partCode": "YK1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 131,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(デスク)",
        "partCode": "DK1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 132,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(幕板大)",
        "partCode": "ML1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 133,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(幕板小)",
        "partCode": "MS1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 134,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(開扉)",
        "partCode": "DO1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 135,
        "category": "PAO",
        "productName": "PAO1218SL-F",
        "bomName": "PAO1218SL-F(フロア)",
        "partCode": "FL1218SL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 136,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(正面)",
        "partCode": "FR1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 137,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(後面)",
        "partCode": "BA1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 138,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(右側面前)",
        "partCode": "RF1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 139,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(右側面後)",
        "partCode": "RB1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 140,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(左側面前)",
        "partCode": "LF1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 141,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(左側面後)",
        "partCode": "LB1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 142,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(天井)",
        "partCode": "TN1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 143,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(床)",
        "partCode": "YK1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 144,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(デスク)",
        "partCode": "DK1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 145,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(幕板大)",
        "partCode": "ML1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 146,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(幕板小)",
        "partCode": "MS1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 147,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(開扉)",
        "partCode": "DO1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 148,
        "category": "PAO",
        "productName": "PAO1218SR-F",
        "bomName": "PAO1218SR-F(フロア)",
        "partCode": "FL1218SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 149,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(正面右)",
        "partCode": "FF1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 150,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(正面左)",
        "partCode": "FB1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 151,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(後面右)",
        "partCode": "BF1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 152,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(後面左)",
        "partCode": "BB1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 153,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(右側面)",
        "partCode": "RI1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 154,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(左側面)",
        "partCode": "LE1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 155,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(天井)",
        "partCode": "TN1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 156,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(床)",
        "partCode": "YK1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 157,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(デスク)",
        "partCode": "DK1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 158,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(幕板大)",
        "partCode": "ML1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 159,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(幕板小)",
        "partCode": "MS1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 160,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(開扉)",
        "partCode": "DO1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 161,
        "category": "PAO",
        "productName": "PAO1218SL-2Y-F",
        "bomName": "PAO1218SL 2人用横並び-F(フロア)",
        "partCode": "FL1218SL2Y",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 162,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(正面右)",
        "partCode": "FF1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 163,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(正面左)",
        "partCode": "FB1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 164,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(後面右)",
        "partCode": "BF1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 165,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(後面左)",
        "partCode": "BB1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 166,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(右側面)",
        "partCode": "RI1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 167,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(左側面)",
        "partCode": "LE1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 168,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(天井)",
        "partCode": "TN1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 169,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(床)",
        "partCode": "YK1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 170,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(デスク)",
        "partCode": "DK1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 171,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(幕板大)",
        "partCode": "ML1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 172,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(幕板小)",
        "partCode": "MS1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 173,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(開扉)",
        "partCode": "DO1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 174,
        "category": "PAO",
        "productName": "PAO1218SR-2Y-F",
        "bomName": "PAO1218SR 2人用横並び-F(フロア)",
        "partCode": "FL1218SR2Y",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 175,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(正面右)",
        "partCode": "FF1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 176,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(正面左)",
        "partCode": "FB1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 177,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(後面右)",
        "partCode": "BF1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 178,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(後面左)",
        "partCode": "BB1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 179,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(右側面)",
        "partCode": "RI1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 180,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(左側面)",
        "partCode": "LE1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 181,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(天井)",
        "partCode": "TN1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 182,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(床)",
        "partCode": "YK1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 183,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(デスク)",
        "partCode": "DK1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "仕上・梱包": 15
        }
    },
    {
        "id": 184,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(幕板大)",
        "partCode": "ML1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 185,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(幕板小)",
        "partCode": "MS1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 186,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(開扉)",
        "partCode": "DO1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 187,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(フロア)",
        "partCode": "FL1218SL2T",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 188,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(台輪天板)",
        "partCode": "DT1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 189,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(台輪側板)",
        "partCode": "DG1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 190,
        "category": "PAO",
        "productName": "PAO1218SL-2T-F",
        "bomName": "PAO1218SL 2人用対面-F(台輪前後板)",
        "partCode": "DZ1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 191,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(正面右)",
        "partCode": "FF1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 192,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(正面左)",
        "partCode": "FB1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 193,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(後面右)",
        "partCode": "BF1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 194,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(後面左)",
        "partCode": "BB1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 195,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(右側面)",
        "partCode": "RI1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 196,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(左側面)",
        "partCode": "LE1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 197,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(天井)",
        "partCode": "TN1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 198,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(床)",
        "partCode": "YK1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 199,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(デスク)",
        "partCode": "DK1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "仕上・梱包": 15
        }
    },
    {
        "id": 200,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(幕板大)",
        "partCode": "ML1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 201,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(幕板小)",
        "partCode": "MS1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 202,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(開扉)",
        "partCode": "DO1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 203,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(フロア)",
        "partCode": "FL1218SR2T",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 204,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(台輪天板)",
        "partCode": "DT1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 205,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(台輪側板)",
        "partCode": "DG1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 206,
        "category": "PAO",
        "productName": "PAO1218SR-2T-F",
        "bomName": "PAO1218SR 2人用対面-F(台輪前後板)",
        "partCode": "DZ1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 207,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(正面)",
        "partCode": "FR1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 208,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(後面)",
        "partCode": "BA1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 209,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(右側面)",
        "partCode": "RI1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 210,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(左側面)",
        "partCode": "LE1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 211,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(天井)",
        "partCode": "TN1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 212,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(床)",
        "partCode": "YK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 213,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(デスク)",
        "partCode": "DK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 214,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(幕板大)",
        "partCode": "ML1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 215,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(幕板小)",
        "partCode": "MS1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 216,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(開扉)",
        "partCode": "DO1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 217,
        "category": "PAO",
        "productName": "PAO1212SR-F",
        "bomName": "PAO1212SR-F(フロア)",
        "partCode": "FL1012SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 218,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(正面)",
        "partCode": "FR1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 219,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(後面)",
        "partCode": "BA1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 220,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(右側面)",
        "partCode": "RI1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 221,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(左側面)",
        "partCode": "LE1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 222,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(天井)",
        "partCode": "TN1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 223,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(床)",
        "partCode": "YK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 224,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(デスク)",
        "partCode": "DK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 225,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(幕板大)",
        "partCode": "ML1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 226,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(幕板小)",
        "partCode": "MS1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 227,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(開扉)",
        "partCode": "DO1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 228,
        "category": "PAO",
        "productName": "PAO1212SL-F",
        "bomName": "PAO1212SL-F(フロア)",
        "partCode": "FL1012SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 229,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(正面)",
        "partCode": "FR1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 230,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(後面)",
        "partCode": "BA1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 231,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(右側面)",
        "partCode": "RI1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 232,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(左側面)",
        "partCode": "LE1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 233,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(天井)",
        "partCode": "TN1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 234,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(床)",
        "partCode": "YK1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 235,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(デスク)",
        "partCode": "DK1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 236,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(幕板大)",
        "partCode": "ML1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 237,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(幕板小)",
        "partCode": "MS1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 238,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(開扉)",
        "partCode": "DO1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 239,
        "category": "PAO",
        "productName": "PAO1212BL-F",
        "bomName": "PAO1212BL-F(フロア)",
        "partCode": "FL1212BL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 240,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(正面)",
        "partCode": "FR1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 241,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(後面)",
        "partCode": "BA1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 242,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(右側面)",
        "partCode": "RI1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 243,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(左側面)",
        "partCode": "LE1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 244,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(天井)",
        "partCode": "TN1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 245,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(床)",
        "partCode": "YK1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 246,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(デスク)",
        "partCode": "DK1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 247,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(幕板大)",
        "partCode": "ML1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 248,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(幕板小)",
        "partCode": "MS1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 249,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(開扉)",
        "partCode": "DO1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 250,
        "category": "PAO",
        "productName": "PAO1212BR-F",
        "bomName": "PAO1212BR-F(フロア)",
        "partCode": "FL1212BR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 251,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(正面右)",
        "partCode": "FF1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 252,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(正面左)",
        "partCode": "FB1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 253,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(後面右)",
        "partCode": "BF1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 254,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(後面左)",
        "partCode": "BB1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 255,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(右側前)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 256,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(右側後ろ)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 257,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(左側前)",
        "partCode": "LE1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 258,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(左側後ろ)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 259,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(天井)",
        "partCode": "TN1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 260,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(床)",
        "partCode": "YK1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 261,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(デスク)",
        "partCode": "DK1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 262,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(幕板大)",
        "partCode": "ML1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 263,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(幕板小)",
        "partCode": "MS1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 264,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(開扉)",
        "partCode": "DO1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 265,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(フロア)",
        "partCode": "FL1618-4S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 266,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(台輪天板)",
        "partCode": "DT1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 267,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(台輪側板)",
        "partCode": "DG1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 268,
        "category": "PAO",
        "productName": "PAO1618-4SR-F",
        "bomName": "PAO1618-4SR-F(台輪前後板)",
        "partCode": "DZ1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 269,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(正面右)",
        "partCode": "FF1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 270,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(正面左)",
        "partCode": "FB1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 271,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(後面右)",
        "partCode": "BF1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 272,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(後面左)",
        "partCode": "BB1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 273,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(右側前)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 274,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(右側後ろ)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 275,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(左側前)",
        "partCode": "LE1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 276,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(左側後ろ)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 277,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(天井)",
        "partCode": "TN1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 278,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(床)",
        "partCode": "YK1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 279,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(デスク)",
        "partCode": "DK1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 280,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(幕板大)",
        "partCode": "ML1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 281,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(幕板小)",
        "partCode": "MS1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 282,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(開扉)",
        "partCode": "DO1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 283,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(フロア)",
        "partCode": "FL1618-4S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 284,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(台輪天板)",
        "partCode": "DT1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 285,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(台輪側板)",
        "partCode": "DG1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 286,
        "category": "PAO",
        "productName": "PAO1618-4SL-F",
        "bomName": "PAO1618-4SL-F(台輪前後板)",
        "partCode": "DZ1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 287,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(正面右)",
        "partCode": "FF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 288,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(正面左)",
        "partCode": "FB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 289,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(後面右)",
        "partCode": "BF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 290,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(後面左)",
        "partCode": "BB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 291,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(右側前)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 292,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(右側後ろ)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 293,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(左側前)",
        "partCode": "LE2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 294,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(左側後ろ)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 295,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(天井)",
        "partCode": "TN2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 296,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(床)",
        "partCode": "YK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 297,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(デスク)",
        "partCode": "DK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 298,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(幕板大)",
        "partCode": "ML2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 299,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(幕板小)",
        "partCode": "MS2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 300,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(開扉)",
        "partCode": "DO2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 301,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(フロア)",
        "partCode": "FL2424S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 302,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(台輪天板)",
        "partCode": "DT2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 303,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(台輪側板)",
        "partCode": "DG2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 304,
        "category": "PAO",
        "productName": "PAO2424SR-F",
        "bomName": "PAO2424SR-F(台輪前後板)",
        "partCode": "DZ2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 305,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(正面右)",
        "partCode": "FF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 306,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(正面左)",
        "partCode": "FB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 307,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(後面右)",
        "partCode": "BF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 308,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(後面左)",
        "partCode": "BB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 309,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(右側前)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 310,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(右側後ろ)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 311,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(左側前)",
        "partCode": "LE2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 312,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(左側後ろ)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 313,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(天井)",
        "partCode": "TN2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 314,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(床)",
        "partCode": "YK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 315,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(デスク)",
        "partCode": "DK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 316,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(幕板大)",
        "partCode": "ML2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 317,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(幕板小)",
        "partCode": "MS2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 318,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(開扉)",
        "partCode": "DO2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 319,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(フロア)",
        "partCode": "FL2424S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 320,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(台輪天板)",
        "partCode": "DT2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 321,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(台輪側板)",
        "partCode": "DG2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 322,
        "category": "PAO",
        "productName": "PAO2424SL-F",
        "bomName": "PAO2424SL-F(台輪前後板)",
        "partCode": "DZ2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 323,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(正面)",
        "partCode": "FR1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 324,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(後面)",
        "partCode": "BA1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 325,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(右側面)",
        "partCode": "RI1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 326,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(左側面)",
        "partCode": "LE1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 327,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(天井)",
        "partCode": "TN1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 328,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(床)",
        "partCode": "YK1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 329,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(デスク)",
        "partCode": "DK1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 330,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(幕板大)",
        "partCode": "ML1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 331,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(幕板小)",
        "partCode": "MS1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 332,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(開扉)",
        "partCode": "DO1012BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 333,
        "category": "PAO",
        "productName": "PAO1012BL",
        "bomName": "PAO1012BL(フロア)",
        "partCode": "FL1012BL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 334,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(正面)",
        "partCode": "FR1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 335,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(後面)",
        "partCode": "BA1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 336,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(右側面)",
        "partCode": "RI1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 337,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(左側面)",
        "partCode": "LE1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 338,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(天井)",
        "partCode": "TN1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 339,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(床)",
        "partCode": "YK1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 340,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(デスク)",
        "partCode": "DK1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 341,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(幕板大)",
        "partCode": "ML1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 342,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(幕板小)",
        "partCode": "MS1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 343,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(開扉)",
        "partCode": "DO1012BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 344,
        "category": "PAO",
        "productName": "PAO1012BR",
        "bomName": "PAO1012BR(フロア)",
        "partCode": "FL1012BR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 345,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(正面)",
        "partCode": "FR1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 346,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(後面)",
        "partCode": "BA1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 347,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(右側面)",
        "partCode": "RI1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 348,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(左側面)",
        "partCode": "LE1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 349,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(天井)",
        "partCode": "TN1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 350,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(床)",
        "partCode": "YK1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 351,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(デスク)",
        "partCode": "DK1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 352,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(幕板大)",
        "partCode": "ML1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 353,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(幕板小)",
        "partCode": "MS1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 354,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(開扉)",
        "partCode": "DO1012SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 355,
        "category": "PAO",
        "productName": "PAO1012SL",
        "bomName": "PAO1012SL(フロア)",
        "partCode": "FL1012SL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 356,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(正面)",
        "partCode": "FR1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 357,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(後面)",
        "partCode": "BA1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 358,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(右側面)",
        "partCode": "RI1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 359,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(左側面)",
        "partCode": "LE1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 360,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(天井)",
        "partCode": "TN1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 361,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(床)",
        "partCode": "YK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 362,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(デスク)",
        "partCode": "DK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 363,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(幕板大)",
        "partCode": "ML1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 364,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(幕板小)",
        "partCode": "MS1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 365,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(開扉)",
        "partCode": "DO1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 366,
        "category": "PAO",
        "productName": "PAO1012SR",
        "bomName": "PAO1012SR(フロア)",
        "partCode": "FL1012SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 367,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(正面)",
        "partCode": "FR1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 368,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(後面)",
        "partCode": "BA1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 369,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(右側面前)",
        "partCode": "RF1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 370,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(右側面後)",
        "partCode": "RB1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 371,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(左側面前)",
        "partCode": "LF1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 372,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(左側面後)",
        "partCode": "LB1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 373,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(天井)",
        "partCode": "TN1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 374,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(床)",
        "partCode": "YK1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 375,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(デスク)",
        "partCode": "DK1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 376,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(幕板大)",
        "partCode": "ML1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 377,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(幕板小)",
        "partCode": "MS1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 378,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(開扉)",
        "partCode": "DO1018BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 379,
        "category": "PAO",
        "productName": "PAO1018BL",
        "bomName": "PAO1018BL(フロア)",
        "partCode": "FL1018BL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 380,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(正面)",
        "partCode": "FR1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 381,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(後面)",
        "partCode": "BA1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 382,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(右側面前)",
        "partCode": "RF1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 383,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(右側面後)",
        "partCode": "RB1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 384,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(左側面前)",
        "partCode": "LF1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 385,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(左側面後)",
        "partCode": "LB1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 386,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(天井)",
        "partCode": "TN1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 387,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(床)",
        "partCode": "YK1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 388,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(デスク)",
        "partCode": "DK1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 389,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(幕板大)",
        "partCode": "ML1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 390,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(幕板小)",
        "partCode": "MS1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 391,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(開扉)",
        "partCode": "DO1018BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 392,
        "category": "PAO",
        "productName": "PAO1018BR",
        "bomName": "PAO1018BR(フロア)",
        "partCode": "FL1018BR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 393,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(正面)",
        "partCode": "FR1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 394,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(後面)",
        "partCode": "BA1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 395,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(右側面前)",
        "partCode": "RF1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 396,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(右側面後)",
        "partCode": "RB1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 397,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(左側面前)",
        "partCode": "LF1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 398,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(左側面後)",
        "partCode": "LB1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 399,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(天井)",
        "partCode": "TN1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 400,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(床)",
        "partCode": "YK1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 401,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(デスク)",
        "partCode": "DK1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 402,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(幕板大)",
        "partCode": "ML1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 403,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(幕板小)",
        "partCode": "MS1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 404,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(開扉)",
        "partCode": "DO1018SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 405,
        "category": "PAO",
        "productName": "PAO1018SL",
        "bomName": "PAO1018SL(フロア)",
        "partCode": "FL1018SL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 406,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(正面)",
        "partCode": "FR1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 407,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(後面)",
        "partCode": "BA1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 408,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(右側面前)",
        "partCode": "RF1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 409,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(右側面後)",
        "partCode": "RB1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 410,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(左側面前)",
        "partCode": "LF1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 411,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(左側面後)",
        "partCode": "LB1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 412,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(天井)",
        "partCode": "TN1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 413,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(床)",
        "partCode": "YK1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 414,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(デスク)",
        "partCode": "DK1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 415,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(幕板大)",
        "partCode": "ML1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 416,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(幕板小)",
        "partCode": "MS1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 417,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(開扉)",
        "partCode": "DO1018SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 418,
        "category": "PAO",
        "productName": "PAO1018SR",
        "bomName": "PAO1018SR(フロア)",
        "partCode": "FL1018SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 419,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(正面)",
        "partCode": "FR1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 420,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(後面)",
        "partCode": "BA1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 421,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(右側面前)",
        "partCode": "RF1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 422,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(右側面後)",
        "partCode": "RB1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 423,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(左側面前)",
        "partCode": "LF1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 424,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(左側面後)",
        "partCode": "LB1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 425,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(天井)",
        "partCode": "TN1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 426,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(床)",
        "partCode": "YK1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 427,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(デスク)",
        "partCode": "DK1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 428,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(幕板大)",
        "partCode": "ML1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 429,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(幕板小)",
        "partCode": "MS1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 430,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(開扉)",
        "partCode": "DO1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 431,
        "category": "PAO",
        "productName": "PAO1218BL",
        "bomName": "PAO1218BL(フロア)",
        "partCode": "FL1218BL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 432,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(正面)",
        "partCode": "FR1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 433,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(後面)",
        "partCode": "BA1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 434,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(右側面前)",
        "partCode": "RF1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 435,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(右側面後)",
        "partCode": "RB1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 436,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(左側面前)",
        "partCode": "LF1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 437,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(左側面後)",
        "partCode": "LB1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 438,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(天井)",
        "partCode": "TN1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 439,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(床)",
        "partCode": "YK1218BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 440,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(デスク)",
        "partCode": "DK1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 441,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(幕板大)",
        "partCode": "ML1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 442,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(幕板小)",
        "partCode": "MS1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 443,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(開扉)",
        "partCode": "DO1218BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 444,
        "category": "PAO",
        "productName": "PAO1218BR",
        "bomName": "PAO1218BR(フロア)",
        "partCode": "FL1218BR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 445,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(正面)",
        "partCode": "FR1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 446,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(後面)",
        "partCode": "BA1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 447,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(右側面前)",
        "partCode": "RF1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 448,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(右側面後)",
        "partCode": "RB1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 449,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(左側面前)",
        "partCode": "LF1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 450,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(左側面後)",
        "partCode": "LB1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 451,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(天井)",
        "partCode": "TN1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 452,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(床)",
        "partCode": "YK1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 453,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(デスク)",
        "partCode": "DK1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 454,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(幕板大)",
        "partCode": "ML1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 455,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(幕板小)",
        "partCode": "MS1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 456,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(開扉)",
        "partCode": "DO1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 457,
        "category": "PAO",
        "productName": "PAO1218SL",
        "bomName": "PAO1218SL(フロア)",
        "partCode": "FL1218SL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 458,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(正面)",
        "partCode": "FR1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 459,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(後面)",
        "partCode": "BA1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 460,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(右側面前)",
        "partCode": "RF1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 461,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(右側面後)",
        "partCode": "RB1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 462,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(左側面前)",
        "partCode": "LF1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 463,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(左側面後)",
        "partCode": "LB1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 464,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(天井)",
        "partCode": "TN1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 465,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(床)",
        "partCode": "YK1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 466,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(デスク)",
        "partCode": "DK1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 467,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(幕板大)",
        "partCode": "ML1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 468,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(幕板小)",
        "partCode": "MS1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 469,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(開扉)",
        "partCode": "DO1218SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 470,
        "category": "PAO",
        "productName": "PAO1218SR",
        "bomName": "PAO1218SR(フロア)",
        "partCode": "FL1218SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 471,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(正面右)",
        "partCode": "FF1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 472,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(正面左)",
        "partCode": "FB1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 473,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(後面右)",
        "partCode": "BF1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 474,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(後面左)",
        "partCode": "BB1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 475,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(右側面)",
        "partCode": "RI1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 476,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(左側面)",
        "partCode": "LE1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 477,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(天井)",
        "partCode": "TN1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 478,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(床)",
        "partCode": "YK1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 479,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(デスク)",
        "partCode": "DK1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 480,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(幕板大)",
        "partCode": "ML1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 481,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(幕板小)",
        "partCode": "MS1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 482,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(開扉)",
        "partCode": "DO1218SL2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 483,
        "category": "PAO",
        "productName": "PAO1218SL-2Y",
        "bomName": "PAO1218SL 2人用横並び(フロア)",
        "partCode": "FL1218SL2Y",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 484,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(正面右)",
        "partCode": "FF1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 485,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(正面左)",
        "partCode": "FB1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 486,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(後面右)",
        "partCode": "BF1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 487,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(後面左)",
        "partCode": "BB1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 488,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(右側面)",
        "partCode": "RI1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 489,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(左側面)",
        "partCode": "LE1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 490,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(天井)",
        "partCode": "TN1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 491,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(床)",
        "partCode": "YK1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 492,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(デスク)",
        "partCode": "DK1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 493,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(幕板大)",
        "partCode": "ML1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 494,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(幕板小)",
        "partCode": "MS1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 495,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(開扉)",
        "partCode": "DO1218SR2Y",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 496,
        "category": "PAO",
        "productName": "PAO1218SR-2Y",
        "bomName": "PAO1218SR 2人用横並び(フロア)",
        "partCode": "FL1218SR2Y",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 497,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(正面右)",
        "partCode": "FF1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 498,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(正面左)",
        "partCode": "FB1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 499,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(後面右)",
        "partCode": "BF1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 500,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(後面左)",
        "partCode": "BB1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 501,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(右側面)",
        "partCode": "RI1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 502,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(左側面)",
        "partCode": "LE1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 503,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(天井)",
        "partCode": "TN1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 504,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(床)",
        "partCode": "YK1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 505,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(デスク)",
        "partCode": "DK1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "仕上・梱包": 15
        }
    },
    {
        "id": 506,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(幕板大)",
        "partCode": "ML1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 507,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(幕板小)",
        "partCode": "MS1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 508,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(開扉)",
        "partCode": "DO1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 509,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(フロア)",
        "partCode": "FL1218SL2T",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 510,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(台輪天板)",
        "partCode": "DT1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 511,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(台輪側板)",
        "partCode": "DG1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 512,
        "category": "PAO",
        "productName": "PAO1218SL-2T",
        "bomName": "PAO1218SL 2人用対面(台輪前後板)",
        "partCode": "DZ1218SL2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 513,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(正面右)",
        "partCode": "FF1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 514,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(正面左)",
        "partCode": "FB1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 515,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(後面右)",
        "partCode": "BF1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 516,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(後面左)",
        "partCode": "BB1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 517,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(右側面)",
        "partCode": "RI1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 518,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(左側面)",
        "partCode": "LE1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 519,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(天井)",
        "partCode": "TN1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 520,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(床)",
        "partCode": "YK1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 521,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(デスク)",
        "partCode": "DK1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "仕上・梱包": 15
        }
    },
    {
        "id": 522,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(幕板大)",
        "partCode": "ML1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 523,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(幕板小)",
        "partCode": "MS1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 524,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(開扉)",
        "partCode": "DO1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 525,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(フロア)",
        "partCode": "FL1218SR2T",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 526,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(台輪天板)",
        "partCode": "DT1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 527,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(台輪側板)",
        "partCode": "DG1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 528,
        "category": "PAO",
        "productName": "PAO1218SR-2T",
        "bomName": "PAO1218SR 2人用対面(台輪前後板)",
        "partCode": "DZ1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 529,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(正面)",
        "partCode": "FR1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 530,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(後面)",
        "partCode": "BA1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 531,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(右側面)",
        "partCode": "RI1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 532,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(左側面)",
        "partCode": "LE1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 533,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(天井)",
        "partCode": "TN1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 534,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(床)",
        "partCode": "YK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 535,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(デスク)",
        "partCode": "DK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 536,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(幕板大)",
        "partCode": "ML1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 537,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(幕板小)",
        "partCode": "MS1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 538,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(開扉)",
        "partCode": "DO1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 539,
        "category": "PAO",
        "productName": "PAO1212SR",
        "bomName": "PAO1212SR(フロア)",
        "partCode": "FL1012SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 540,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(正面)",
        "partCode": "FR1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 541,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(後面)",
        "partCode": "BA1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 542,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(右側面)",
        "partCode": "RI1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 543,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(左側面)",
        "partCode": "LE1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 544,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(天井)",
        "partCode": "TN1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 545,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(床)",
        "partCode": "YK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 546,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(デスク)",
        "partCode": "DK1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 547,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(幕板大)",
        "partCode": "ML1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 548,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(幕板小)",
        "partCode": "MS1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 549,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(開扉)",
        "partCode": "DO1012SR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 550,
        "category": "PAO",
        "productName": "PAO1212SL",
        "bomName": "PAO1212SL(フロア)",
        "partCode": "FL1012SR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 551,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(正面)",
        "partCode": "FR1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 552,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(後面)",
        "partCode": "BA1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 553,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(右側面)",
        "partCode": "RI1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 554,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(左側面)",
        "partCode": "LE1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 13
        }
    },
    {
        "id": 555,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(天井)",
        "partCode": "TN1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 556,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(床)",
        "partCode": "YK1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 557,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(デスク)",
        "partCode": "DK1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 558,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(幕板大)",
        "partCode": "ML1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 559,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(幕板小)",
        "partCode": "MS1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 560,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(開扉)",
        "partCode": "DO1212BL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 561,
        "category": "PAO",
        "productName": "PAO1212BL",
        "bomName": "PAO1212BL(フロア)",
        "partCode": "FL1212BL",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 562,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(正面)",
        "partCode": "FR1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 563,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(後面)",
        "partCode": "BA1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 564,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(右側面)",
        "partCode": "RI1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 565,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(左側面)",
        "partCode": "LE1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 566,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(天井)",
        "partCode": "TN1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 8,
            "仕上・梱包": 20
        }
    },
    {
        "id": 567,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(床)",
        "partCode": "YK1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 568,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(デスク)",
        "partCode": "DK1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 569,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(幕板大)",
        "partCode": "ML1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 570,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(幕板小)",
        "partCode": "MS1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 571,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(開扉)",
        "partCode": "DO1212BR",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 572,
        "category": "PAO",
        "productName": "PAO1212BR",
        "bomName": "PAO1212BR(フロア)",
        "partCode": "FL1212BR",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 573,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(正面右)",
        "partCode": "FF1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 574,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(正面左)",
        "partCode": "FB1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 575,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(後面右)",
        "partCode": "BF1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 576,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(後面左)",
        "partCode": "BB1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 577,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(右側前)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 578,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(右側後ろ)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 579,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(左側前)",
        "partCode": "LE1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 580,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(左側後ろ)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 581,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(天井)",
        "partCode": "TN1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 582,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(床)",
        "partCode": "YK1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 583,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(デスク)",
        "partCode": "DK1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 584,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(幕板大)",
        "partCode": "ML1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 585,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(幕板小)",
        "partCode": "MS1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 586,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(開扉)",
        "partCode": "DO1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 587,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(フロア)",
        "partCode": "FL1618-4S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 588,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(台輪天板)",
        "partCode": "DT1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 589,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(台輪側板)",
        "partCode": "DG1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 590,
        "category": "PAO",
        "productName": "PAO1618-4SR",
        "bomName": "PAO1618-4SR(台輪前後板)",
        "partCode": "DZ1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 591,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(正面右)",
        "partCode": "FF1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 592,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(正面左)",
        "partCode": "FB1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 593,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(後面右)",
        "partCode": "BF1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 594,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(後面左)",
        "partCode": "BB1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 595,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(右側前)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 596,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(右側後ろ)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 597,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(左側前)",
        "partCode": "LE1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 598,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(左側後ろ)",
        "partCode": "RI1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 599,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(天井)",
        "partCode": "TN1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 600,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(床)",
        "partCode": "YK1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 601,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(デスク)",
        "partCode": "DK1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 602,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(幕板大)",
        "partCode": "ML1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 603,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(幕板小)",
        "partCode": "MS1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 604,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(開扉)",
        "partCode": "DO1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 605,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(フロア)",
        "partCode": "FL1618-4S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 606,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(台輪天板)",
        "partCode": "DT1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 607,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(台輪側板)",
        "partCode": "DG1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 608,
        "category": "PAO",
        "productName": "PAO1618-4SL",
        "bomName": "PAO1618-4SL(台輪前後板)",
        "partCode": "DZ1618-4S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 609,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(正面右)",
        "partCode": "FF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 610,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(正面左)",
        "partCode": "FB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 611,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(後面右)",
        "partCode": "BF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 612,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(後面左)",
        "partCode": "BB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 613,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(右側前)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 614,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(右側後ろ)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 615,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(左側前)",
        "partCode": "LE2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 616,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(左側後ろ)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 617,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(天井)",
        "partCode": "TN2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 618,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(床)",
        "partCode": "YK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 619,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(デスク)",
        "partCode": "DK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 620,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(幕板大)",
        "partCode": "ML2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 621,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(幕板小)",
        "partCode": "MS2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 622,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(開扉)",
        "partCode": "DO2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 623,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(フロア)",
        "partCode": "FL2424S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 624,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(台輪天板)",
        "partCode": "DT2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 625,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(台輪側板)",
        "partCode": "DG2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 626,
        "category": "PAO",
        "productName": "PAO2424SR",
        "bomName": "PAO2424SR(台輪前後板)",
        "partCode": "DZ2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 627,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(正面右)",
        "partCode": "FF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 628,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(正面左)",
        "partCode": "FB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 629,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(後面右)",
        "partCode": "BF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 630,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(後面左)",
        "partCode": "BB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 631,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(右側前)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 632,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(右側後ろ)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 633,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(左側前)",
        "partCode": "LE2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 634,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(左側後ろ)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 635,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(天井)",
        "partCode": "TN2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 636,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(床)",
        "partCode": "YK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 637,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(デスク)",
        "partCode": "DK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 638,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(幕板大)",
        "partCode": "ML2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 639,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(幕板小)",
        "partCode": "MS2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 640,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(開扉)",
        "partCode": "DO2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 641,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(フロア)",
        "partCode": "FL2424S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 642,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(台輪天板)",
        "partCode": "DT2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 643,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(台輪側板)",
        "partCode": "DG2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 644,
        "category": "PAO",
        "productName": "PAO2424SL",
        "bomName": "PAO2424SL(台輪前後板)",
        "partCode": "DZ2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 645,
        "category": "PAO",
        "productName": "PAO0912M",
        "bomName": "PAO0912M(正面)",
        "partCode": "FR0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 646,
        "category": "PAO",
        "productName": "PAO0912M",
        "bomName": "PAO0912M(後面)",
        "partCode": "BA0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 647,
        "category": "PAO",
        "productName": "PAO0912M",
        "bomName": "PAO0912M(右側面)",
        "partCode": "RI0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 648,
        "category": "PAO",
        "productName": "PAO0912M",
        "bomName": "PAO0912M(左側面)",
        "partCode": "LE0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 649,
        "category": "PAO",
        "productName": "PAO0912M",
        "bomName": "PAO0912M(デスク)",
        "partCode": "DK0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 650,
        "category": "PAO",
        "productName": "PAO0912M",
        "bomName": "PAO0912M(補強桟)",
        "partCode": "HO0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 651,
        "category": "PAO",
        "productName": "PAO0912M",
        "bomName": "PAO0912M(開扉)",
        "partCode": "DO0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 652,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1212M(正面)",
        "partCode": "FR1212M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 653,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1212M(後面)",
        "partCode": "BA1212M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 654,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1212M(右側面)",
        "partCode": "RI1212M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 655,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1212M(左側面)",
        "partCode": "LE1212M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 656,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1212M(デスク)",
        "partCode": "DK1212M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 657,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1212M(補強桟)",
        "partCode": "HO1212M",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    },
    {
        "id": 658,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1212M(開扉)",
        "partCode": "DO1212M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 659,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1218M(正面)",
        "partCode": "FR1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 660,
        "category": "PAO",
        "productName": "PAO1212M",
        "bomName": "PAO1218M(後面)",
        "partCode": "BA1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 661,
        "category": "PAO",
        "productName": "PAO1218M",
        "bomName": "PAO1218M(右側面前)",
        "partCode": "RF1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 662,
        "category": "PAO",
        "productName": "PAO1218M",
        "bomName": "PAO1218M(右側面後)",
        "partCode": "RB1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 663,
        "category": "PAO",
        "productName": "PAO1218M",
        "bomName": "PAO1218M(左側面前)",
        "partCode": "LF1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 664,
        "category": "PAO",
        "productName": "PAO1218M",
        "bomName": "PAO1218M(左側面後)",
        "partCode": "LB1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 665,
        "category": "PAO",
        "productName": "PAO1218M",
        "bomName": "PAO1218M(デスク)",
        "partCode": "DK1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 666,
        "category": "PAO",
        "productName": "PAO1218M",
        "bomName": "PAO1218M(補強桟)",
        "partCode": "HO1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    },
    {
        "id": 667,
        "category": "PAO",
        "productName": "PAO1218M",
        "bomName": "PAO1218M(開扉)",
        "partCode": "DO1218M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 668,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(正面)",
        "partCode": "FR1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 669,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(後面)",
        "partCode": "BA1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 670,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(右側面前)",
        "partCode": "RF1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 671,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218SL(右側面後)",
        "partCode": "RB1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 672,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(左側面前)",
        "partCode": "LF1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 673,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(左側面後)",
        "partCode": "LB1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 674,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(補強桟左)",
        "partCode": "TN1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    },
    {
        "id": 675,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(補強桟右)",
        "partCode": "TN1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    },
    {
        "id": 676,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(補強桟中央)",
        "partCode": "TN1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    },
    {
        "id": 677,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(デスク)",
        "partCode": "DK1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 678,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(台輪天板)",
        "partCode": "DT1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 679,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(台輪側板)",
        "partCode": "DG1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 680,
        "category": "PAO",
        "productName": "SEMI1218S",
        "bomName": "SEMI1218S(台輪前後板)",
        "partCode": "DZ1218SR2T",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 681,
        "category": "PAO",
        "productName": "CALM1290",
        "bomName": "CALM1290(正面)",
        "partCode": "FR0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 682,
        "category": "PAO",
        "productName": "CALM1290",
        "bomName": "CALM1290(後面)",
        "partCode": "BA0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 683,
        "category": "PAO",
        "productName": "CALM1290",
        "bomName": "CALM1290(右側面)",
        "partCode": "RI0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 684,
        "category": "PAO",
        "productName": "CALM1290",
        "bomName": "CALM1290(左側面)",
        "partCode": "LE0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 685,
        "category": "PAO",
        "productName": "CALM1290",
        "bomName": "CALM1290(補強桟)",
        "partCode": "HO0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 686,
        "category": "PAO",
        "productName": "CALM1290",
        "bomName": "CALM1290(開扉)",
        "partCode": "DO0912M",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15
        }
    },
    {
        "id": 687,
        "category": "PAO",
        "productName": "DRB1210",
        "bomName": "DRB1210(正面)",
        "partCode": "FRDRB1210",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 688,
        "category": "PAO",
        "productName": "DRB1210",
        "bomName": "DRB1210(後面)",
        "partCode": "BADRB1210",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 689,
        "category": "PAO",
        "productName": "DRB1210",
        "bomName": "DRB1210(右側面)",
        "partCode": "RIDRB1210",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 690,
        "category": "PAO",
        "productName": "DRB1210",
        "bomName": "DRB1210(左側面)",
        "partCode": "LEDRB1210",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 691,
        "category": "PAO",
        "productName": "DRB1210",
        "bomName": "DRB1210(デスク)",
        "partCode": "DKDRB1210",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 692,
        "category": "PAO",
        "productName": "DRB1210",
        "bomName": "DRB1210(補強桟)",
        "partCode": "HODRB1210",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    },
    {
        "id": 693,
        "category": "PAO",
        "productName": "DRB1210",
        "bomName": "DRB1210(開扉)",
        "partCode": "DODRB1210",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 694,
        "category": "PAO",
        "productName": "DRB1212",
        "bomName": "DRB1212(正面)",
        "partCode": "FRDRB1212",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 695,
        "category": "PAO",
        "productName": "DRB1212",
        "bomName": "DRB1212(後面)",
        "partCode": "BADRB1212",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 696,
        "category": "PAO",
        "productName": "DRB1212",
        "bomName": "DRB1212(右側面)",
        "partCode": "RIDRB1212",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 697,
        "category": "PAO",
        "productName": "DRB1212",
        "bomName": "DRB1212(左側面)",
        "partCode": "LEDRB1212",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 698,
        "category": "PAO",
        "productName": "DRB1212",
        "bomName": "DRB1212(デスク)",
        "partCode": "DKDRB1212",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 699,
        "category": "PAO",
        "productName": "DRB1212",
        "bomName": "DRB1212(補強桟)",
        "partCode": "HODRB1212",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    },
    {
        "id": 700,
        "category": "PAO",
        "productName": "DRB1212",
        "bomName": "DRB1212(開扉)",
        "partCode": "DODRB1212",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 701,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(授乳室①)",
        "partCode": "P1mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 702,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(授乳室②)",
        "partCode": "P2mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 703,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(授乳室③)",
        "partCode": "P3mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 704,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(授乳室④)",
        "partCode": "P4mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 705,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(授乳室⑤)",
        "partCode": "P5mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 706,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(ﾄﾞｱ①)",
        "partCode": "DO1mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "HOMAG": 5,
            "仕上・梱包": 10
        }
    },
    {
        "id": 707,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(ﾄﾞｱ②)",
        "partCode": "DO2mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "HOMAG": 5,
            "仕上・梱包": 10
        }
    },
    {
        "id": 708,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(鴨居)",
        "partCode": "KAmAmA",
        "processes": [],
        "processTimes": {}
    },
    {
        "id": 709,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(ソファ台輪前後板)",
        "partCode": "DZmAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 710,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(ソファ台輪側板)",
        "partCode": "DGmAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 711,
        "category": "PAO",
        "productName": "PAOBABY",
        "bomName": "PAO＿BAbY mamapod(ソファ台輪中板)",
        "partCode": "DNmAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 712,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(授乳室①)",
        "partCode": "P1mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 713,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(授乳室②)",
        "partCode": "P2mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 714,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(授乳室③)",
        "partCode": "P3mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 715,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(授乳室④)",
        "partCode": "P4mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 716,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(授乳室⑤)",
        "partCode": "P5mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 717,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(授乳室⑥)",
        "partCode": "P4mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 718,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(授乳室⑦)",
        "partCode": "P5mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 5,
            "仕上・梱包": 8
        }
    },
    {
        "id": 719,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(ﾄﾞｱ①)",
        "partCode": "DO1mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "HOMAG": 5,
            "仕上・梱包": 10
        }
    },
    {
        "id": 720,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(ﾄﾞｱ②)",
        "partCode": "DO2mAmA",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "HOMAG": 5,
            "仕上・梱包": 10
        }
    },
    {
        "id": 721,
        "category": "PAO",
        "productName": "PAOBABY1318",
        "bomName": "PAO＿BAbY mamapod(鴨居)",
        "partCode": "KAmAmA",
        "processes": [],
        "processTimes": {}
    },
    {
        "id": 722,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(左側面前)",
        "partCode": "LFMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 10,
            "仕上・梱包": 13
        }
    },
    {
        "id": 723,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(左側面後)",
        "partCode": "LBMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 10,
            "仕上・梱包": 13
        }
    },
    {
        "id": 724,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(右側面前)",
        "partCode": "RFMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 10,
            "仕上・梱包": 13
        }
    },
    {
        "id": 725,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(右側面後)",
        "partCode": "RBMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 10,
            "仕上・梱包": 13
        }
    },
    {
        "id": 726,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(後面右)",
        "partCode": "BARMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 10,
            "仕上・梱包": 13
        }
    },
    {
        "id": 727,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(後面左)",
        "partCode": "BALMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 10,
            "仕上・梱包": 13
        }
    },
    {
        "id": 728,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(天井右)",
        "partCode": "TNRMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 8,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 20,
            "仕上・梱包": 10
        }
    },
    {
        "id": 729,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(天井左)",
        "partCode": "TNLMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 8,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 20,
            "仕上・梱包": 10
        }
    },
    {
        "id": 730,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(床)",
        "partCode": "YKMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "芯組": 8,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "HOMAG": 18,
            "仕上・梱包": 15
        }
    },
    {
        "id": 731,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(デスク)",
        "partCode": "DKMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "仕上・梱包": 8
        }
    },
    {
        "id": 732,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(見付下)",
        "partCode": "MDMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5,
            "仕上・梱包": 6
        }
    },
    {
        "id": 733,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(見付右)",
        "partCode": "MRMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5,
            "仕上・梱包": 6
        }
    },
    {
        "id": 734,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(見付左)",
        "partCode": "MLMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5,
            "仕上・梱包": 6
        }
    },
    {
        "id": 735,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(見付右上)",
        "partCode": "MRUMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5,
            "仕上・梱包": 6
        }
    },
    {
        "id": 736,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(見付左上)",
        "partCode": "MLUMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5,
            "仕上・梱包": 6
        }
    },
    {
        "id": 737,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(ソファ天板)",
        "partCode": "DNMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5,
            "仕上・梱包": 10
        }
    },
    {
        "id": 738,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(ソファ背板)",
        "partCode": "DZMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 1,
            "HOMAG": 5,
            "仕上・梱包": 10
        }
    },
    {
        "id": 739,
        "category": "PAO",
        "productName": "MEET4",
        "bomName": "PAO＿Pencil Meet4(ソファ側板)",
        "partCode": "DGMeet4",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5,
            "仕上・梱包": 10
        }
    },
    {
        "id": 740,
        "category": "PAO",
        "productName": "PAODESK1200",
        "bomName": "PAO＿Desk1200(右側面)",
        "partCode": "DR1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 741,
        "category": "PAO",
        "productName": "PAODESK1200",
        "bomName": "PAO＿Desk1200(左側面)",
        "partCode": "DL1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 742,
        "category": "PAO",
        "productName": "PAODESK1200",
        "bomName": "PAO＿Desk1200(背板)",
        "partCode": "DB1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 743,
        "category": "PAO",
        "productName": "PAODESK1200",
        "bomName": "PAO＿Desk1200(デスク)",
        "partCode": "DD1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 744,
        "category": "PAO",
        "productName": "PAODESK1200",
        "bomName": "PAO＿Desk1200(可動棚)",
        "partCode": "DS1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 6,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 8,
            "仕上・梱包": 10
        }
    },
    {
        "id": 745,
        "category": "PAO",
        "productName": "PAODESK1400",
        "bomName": "PAO＿Desk1400(右側面)",
        "partCode": "DR1400",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 746,
        "category": "PAO",
        "productName": "PAODESK1400",
        "bomName": "PAO＿Desk1400(左側面)",
        "partCode": "DL1400",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 747,
        "category": "PAO",
        "productName": "PAODESK1400",
        "bomName": "PAO＿Desk1400(背板)",
        "partCode": "DB1400",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 748,
        "category": "PAO",
        "productName": "PAODESK1400",
        "bomName": "PAO＿Desk1400(デスク)",
        "partCode": "DD1400",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 749,
        "category": "PAO",
        "productName": "PAODESK1400",
        "bomName": "PAO＿Desk1400(可動棚)",
        "partCode": "DS1400",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 6,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 8,
            "仕上・梱包": 10
        }
    },
    {
        "id": 750,
        "category": "PAO",
        "productName": "PAODESK1200A",
        "bomName": "PAO＿Desk1200 低側板(右側面)",
        "partCode": "DR1200L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 751,
        "category": "PAO",
        "productName": "PAODESK1200A",
        "bomName": "PAO＿Desk1200 低側板(左側面)",
        "partCode": "DL1200L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 752,
        "category": "PAO",
        "productName": "PAODESK1200A",
        "bomName": "PAO＿Desk1200 低側板(背板)",
        "partCode": "DB1200L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 753,
        "category": "PAO",
        "productName": "PAODESK1200A",
        "bomName": "PAO＿Desk1200 低側板(デスク)",
        "partCode": "DD1200L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 754,
        "category": "PAO",
        "productName": "PAODESK1200A",
        "bomName": "PAO＿Desk1200 低側板(可動棚)",
        "partCode": "DS1200L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 6,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 8,
            "仕上・梱包": 10
        }
    },
    {
        "id": 755,
        "category": "PAO",
        "productName": "PAODESK1400A",
        "bomName": "PAO＿Desk1400 低側板(右側面)",
        "partCode": "DR1400L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 756,
        "category": "PAO",
        "productName": "PAODESK1400A",
        "bomName": "PAO＿Desk1400 低側板(左側面)",
        "partCode": "DL1400L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 757,
        "category": "PAO",
        "productName": "PAODESK1400A",
        "bomName": "PAO＿Desk1400 低側板(背板)",
        "partCode": "DB1400L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 758,
        "category": "PAO",
        "productName": "PAODESK1400A",
        "bomName": "PAO＿Desk1400 低側板(デスク)",
        "partCode": "DD1400L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 759,
        "category": "PAO",
        "productName": "PAODESK1400A",
        "bomName": "PAO＿Desk1400 低側板(可動棚)",
        "partCode": "DS1400L",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 6,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 8,
            "仕上・梱包": 10
        }
    },
    {
        "id": 760,
        "category": "PAO",
        "productName": "ROOFDESK1000",
        "bomName": "PAO＿ROOfDesk1000(右側面)",
        "partCode": "RR1000",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 761,
        "category": "PAO",
        "productName": "ROOFDESK1000",
        "bomName": "PAO＿ROOfDesk1000(左側面)",
        "partCode": "RL1000",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 762,
        "category": "PAO",
        "productName": "ROOFDESK1000",
        "bomName": "PAO＿ROOfDesk1000(背板)",
        "partCode": "RB1000",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 763,
        "category": "PAO",
        "productName": "ROOFDESK1000",
        "bomName": "PAO＿ROOfDesk1000(デスク)",
        "partCode": "RD1000",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 764,
        "category": "PAO",
        "productName": "ROOFDESK1000",
        "bomName": "PAO＿ROOfDesk1000(天井)",
        "partCode": "RT1000",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 8,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 20,
            "仕上・梱包": 10
        }
    },
    {
        "id": 765,
        "category": "PAO",
        "productName": "ROOFDESK1200",
        "bomName": "PAO＿ROOfDesk1200(右側面)",
        "partCode": "RR1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 766,
        "category": "PAO",
        "productName": "ROOFDESK1200",
        "bomName": "PAO＿ROOfDesk1200(左側面)",
        "partCode": "RL1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 767,
        "category": "PAO",
        "productName": "ROOFDESK1200",
        "bomName": "PAO＿ROOfDesk1200(背板)",
        "partCode": "RB1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 9,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 768,
        "category": "PAO",
        "productName": "ROOFDESK1200",
        "bomName": "PAO＿ROOfDesk1200(デスク)",
        "partCode": "RD1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 769,
        "category": "PAO",
        "productName": "ROOFDESK1200",
        "bomName": "PAO＿ROOfDesk1200(天井)",
        "partCode": "RT1200",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 8,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "HOMAG": 20,
            "仕上・梱包": 10
        }
    },
    {
        "id": 770,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2400",
        "bomName": "G1HV240BWH2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 771,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2400",
        "bomName": "G1HV240BSH2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 772,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2400",
        "bomName": "G1HV240BLO2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 773,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2400",
        "bomName": "G1HV240BGO2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 774,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2400",
        "bomName": "G1HV240BMC2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 775,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2400",
        "bomName": "G1HV240BBW2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 776,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2400",
        "bomName": "G1HV240BWM2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 777,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2700",
        "bomName": "G1HV270BWH2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 778,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2700",
        "bomName": "G1HV270BSH2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 779,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2700",
        "bomName": "G1HV270BLO2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 780,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2700",
        "bomName": "G1HV270BGO2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 781,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2700",
        "bomName": "G1HV270BMC2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 782,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2700",
        "bomName": "G1HV270BBW2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 783,
        "category": "GRID",
        "productName": "左右方立2枚セット D240 H2700",
        "bomName": "G1HV270BWM2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 784,
        "category": "GRID",
        "productName": "中方立 D240 H2400",
        "bomName": "G1HV240BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 785,
        "category": "GRID",
        "productName": "中方立 D240 H2400",
        "bomName": "G1HV240BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 786,
        "category": "GRID",
        "productName": "中方立 D240 H2400",
        "bomName": "G1HV240BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 787,
        "category": "GRID",
        "productName": "中方立 D240 H2400",
        "bomName": "G1HV240BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 788,
        "category": "GRID",
        "productName": "中方立 D240 H2400",
        "bomName": "G1HV240BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 789,
        "category": "GRID",
        "productName": "中方立 D240 H2400",
        "bomName": "G1HV240BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 790,
        "category": "GRID",
        "productName": "中方立 D240 H2400",
        "bomName": "G1HV240BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 791,
        "category": "GRID",
        "productName": "中方立 D240 H2700",
        "bomName": "G1HV270BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 792,
        "category": "GRID",
        "productName": "中方立 D240 H2700",
        "bomName": "G1HV270BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 793,
        "category": "GRID",
        "productName": "中方立 D240 H2700",
        "bomName": "G1HV270BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 794,
        "category": "GRID",
        "productName": "中方立 D240 H2700",
        "bomName": "G1HV270BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 795,
        "category": "GRID",
        "productName": "中方立 D240 H2700",
        "bomName": "G1HV270BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 796,
        "category": "GRID",
        "productName": "中方立 D240 H2700",
        "bomName": "G1HV270BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 797,
        "category": "GRID",
        "productName": "中方立 D240 H2700",
        "bomName": "G1HV270BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 798,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2400",
        "bomName": "G1HV240AWH2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 799,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2400",
        "bomName": "G1HV240ASH2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 800,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2400",
        "bomName": "G1HV240ALO2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 801,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2400",
        "bomName": "G1HV240AGO2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 802,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2400",
        "bomName": "G1HV240AMC2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 803,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2400",
        "bomName": "G1HV240ABW2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 804,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2400",
        "bomName": "G1HV240AWM2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 805,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2700",
        "bomName": "G1HV270AWH2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 806,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2700",
        "bomName": "G1HV270ASH2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 807,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2700",
        "bomName": "G1HV270A]LO2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 808,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2700",
        "bomName": "G1HV270AGO2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 809,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2700",
        "bomName": "G1HV270AMC2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 810,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2700",
        "bomName": "G1HV270ABW2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 811,
        "category": "GRID",
        "productName": "左右方立2枚セット D380 H2700",
        "bomName": "G1HV270AWM2",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 812,
        "category": "GRID",
        "productName": "中方立 D380 H2400",
        "bomName": "G1HV240AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 813,
        "category": "GRID",
        "productName": "中方立 D380 H2400",
        "bomName": "G1HV240ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 814,
        "category": "GRID",
        "productName": "中方立 D380 H2400",
        "bomName": "G1HV240ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 815,
        "category": "GRID",
        "productName": "中方立 D380 H2400",
        "bomName": "G1HV240AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 816,
        "category": "GRID",
        "productName": "中方立 D380 H2400",
        "bomName": "G1HV240AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 817,
        "category": "GRID",
        "productName": "中方立 D380 H2400",
        "bomName": "G1HV240ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 818,
        "category": "GRID",
        "productName": "中方立 D380 H2400",
        "bomName": "G1HV240AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 819,
        "category": "GRID",
        "productName": "中方立 D380 H2700",
        "bomName": "G1HV270AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 820,
        "category": "GRID",
        "productName": "中方立 D380 H2700",
        "bomName": "G1HV270ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 821,
        "category": "GRID",
        "productName": "中方立 D380 H2700",
        "bomName": "G1HV270ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 822,
        "category": "GRID",
        "productName": "中方立 D380 H2700",
        "bomName": "G1HV270AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 823,
        "category": "GRID",
        "productName": "中方立 D380 H2700",
        "bomName": "G1HV270AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 824,
        "category": "GRID",
        "productName": "中方立 D380 H2700",
        "bomName": "G1HV270ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 825,
        "category": "GRID",
        "productName": "中方立 D380 H2700",
        "bomName": "G1HV270AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 5,
            "HOMAG": 9
        }
    },
    {
        "id": 826,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W400",
        "bomName": "G1E4003BWH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 827,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W400",
        "bomName": "G1E4003BSH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 828,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W400",
        "bomName": "G1E4003BLO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 829,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W400",
        "bomName": "G1E4003BGO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 830,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W400",
        "bomName": "G1E4003BMC3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 831,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W400",
        "bomName": "G1E4003BBW3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 832,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W400",
        "bomName": "G1E4003BWM3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 833,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W600",
        "bomName": "G1E6003BWH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 834,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W600",
        "bomName": "G1E6003BSH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 835,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W600",
        "bomName": "G1E6003BLO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 836,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W600",
        "bomName": "G1E6003BGO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 837,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W600",
        "bomName": "G1E6003BMC3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 838,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W600",
        "bomName": "G1E6003BBW3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 839,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W600",
        "bomName": "G1E6003BWM3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 840,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W800",
        "bomName": "G1E8003BWH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 841,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W800",
        "bomName": "G1E8003BSH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 842,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W800",
        "bomName": "G1E8003BLO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 843,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W800",
        "bomName": "G1E8003BGO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 844,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W800",
        "bomName": "G1E8003BMC3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 845,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W800",
        "bomName": "G1E8003BBW3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 846,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W800",
        "bomName": "G1E8003BWM3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 847,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W1200",
        "bomName": "G1EC003BWH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 848,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W1200",
        "bomName": "G1EC003BSH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 849,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W1200",
        "bomName": "G1EC003BLO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 850,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W1200",
        "bomName": "G1EC003BGO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 851,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W1200",
        "bomName": "G1EC003BMC3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 852,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W1200",
        "bomName": "G1EC003BBW3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 853,
        "category": "GRID",
        "productName": "施工棚板3枚セット D240 W1200",
        "bomName": "G1EC003BWM3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 854,
        "category": "GRID",
        "productName": "追加棚板 D240 W400",
        "bomName": "G1K4003BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 855,
        "category": "GRID",
        "productName": "追加棚板 D240 W400",
        "bomName": "G1K4003BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 856,
        "category": "GRID",
        "productName": "追加棚板 D240 W400",
        "bomName": "G1K4003BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 857,
        "category": "GRID",
        "productName": "追加棚板 D240 W400",
        "bomName": "G1K4003BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 858,
        "category": "GRID",
        "productName": "追加棚板 D240 W400",
        "bomName": "G1K4003BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 859,
        "category": "GRID",
        "productName": "追加棚板 D240 W400",
        "bomName": "G1K4003BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 860,
        "category": "GRID",
        "productName": "追加棚板 D240 W400",
        "bomName": "G1K4003BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 861,
        "category": "GRID",
        "productName": "追加棚板 D240 W600",
        "bomName": "G1K6003BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 862,
        "category": "GRID",
        "productName": "追加棚板 D240 W600",
        "bomName": "G1K6003BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 863,
        "category": "GRID",
        "productName": "追加棚板 D240 W600",
        "bomName": "G1K6003BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 864,
        "category": "GRID",
        "productName": "追加棚板 D240 W600",
        "bomName": "G1K6003BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 865,
        "category": "GRID",
        "productName": "追加棚板 D240 W600",
        "bomName": "G1K6003BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 866,
        "category": "GRID",
        "productName": "追加棚板 D240 W600",
        "bomName": "G1K6003BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 867,
        "category": "GRID",
        "productName": "追加棚板 D240 W600",
        "bomName": "G1K6003BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 868,
        "category": "GRID",
        "productName": "追加棚板 D240 W800",
        "bomName": "G1K8003BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 869,
        "category": "GRID",
        "productName": "追加棚板 D240 W800",
        "bomName": "G1K8003BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 870,
        "category": "GRID",
        "productName": "追加棚板 D240 W800",
        "bomName": "G1K8003BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 871,
        "category": "GRID",
        "productName": "追加棚板 D240 W800",
        "bomName": "G1K8003BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 872,
        "category": "GRID",
        "productName": "追加棚板 D240 W800",
        "bomName": "G1K8003BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 873,
        "category": "GRID",
        "productName": "追加棚板 D240 W800",
        "bomName": "G1K8003BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 874,
        "category": "GRID",
        "productName": "追加棚板 D240 W800",
        "bomName": "G1K8003BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 875,
        "category": "GRID",
        "productName": "追加棚板 D240 W1200",
        "bomName": "G1KC003BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 876,
        "category": "GRID",
        "productName": "追加棚板 D240 W1200",
        "bomName": "G1KC003BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 877,
        "category": "GRID",
        "productName": "追加棚板 D240 W1200",
        "bomName": "G1KC003BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 878,
        "category": "GRID",
        "productName": "追加棚板 D240 W1200",
        "bomName": "G1KC003BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 879,
        "category": "GRID",
        "productName": "追加棚板 D240 W1200",
        "bomName": "G1KC003BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 880,
        "category": "GRID",
        "productName": "追加棚板 D240 W1200",
        "bomName": "G1KC003BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 881,
        "category": "GRID",
        "productName": "追加棚板 D240 W1200",
        "bomName": "G1KC003BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 882,
        "category": "GRID",
        "productName": "可動棚板 D240 W400",
        "bomName": "G1S4003BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 883,
        "category": "GRID",
        "productName": "可動棚板 D240 W400",
        "bomName": "G1S4003BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 884,
        "category": "GRID",
        "productName": "可動棚板 D240 W400",
        "bomName": "G1S4003BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 885,
        "category": "GRID",
        "productName": "可動棚板 D240 W400",
        "bomName": "G1S4003BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 886,
        "category": "GRID",
        "productName": "可動棚板 D240 W400",
        "bomName": "G1S4003BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 887,
        "category": "GRID",
        "productName": "可動棚板 D240 W400",
        "bomName": "G1S4003BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 888,
        "category": "GRID",
        "productName": "可動棚板 D240 W400",
        "bomName": "G1S4003BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 889,
        "category": "GRID",
        "productName": "可動棚板 D240 W600",
        "bomName": "G1S6003BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 890,
        "category": "GRID",
        "productName": "可動棚板 D240 W600",
        "bomName": "G1S6003BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 891,
        "category": "GRID",
        "productName": "可動棚板 D240 W600",
        "bomName": "G1S6003BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 892,
        "category": "GRID",
        "productName": "可動棚板 D240 W600",
        "bomName": "G1S6003BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 893,
        "category": "GRID",
        "productName": "可動棚板 D240 W600",
        "bomName": "G1S6003BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 894,
        "category": "GRID",
        "productName": "可動棚板 D240 W600",
        "bomName": "G1S6003BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 895,
        "category": "GRID",
        "productName": "可動棚板 D240 W600",
        "bomName": "G1S6003BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 896,
        "category": "GRID",
        "productName": "可動棚板 D240 W800",
        "bomName": "G1S8003BWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 897,
        "category": "GRID",
        "productName": "可動棚板 D240 W800",
        "bomName": "G1S8003BSH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 898,
        "category": "GRID",
        "productName": "可動棚板 D240 W800",
        "bomName": "G1S8003BLO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 899,
        "category": "GRID",
        "productName": "可動棚板 D240 W800",
        "bomName": "G1S8003BGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 900,
        "category": "GRID",
        "productName": "可動棚板 D240 W800",
        "bomName": "G1S8003BMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 901,
        "category": "GRID",
        "productName": "可動棚板 D240 W800",
        "bomName": "G1S8003BBW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 902,
        "category": "GRID",
        "productName": "可動棚板 D240 W800",
        "bomName": "G1S8003BWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 903,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W400",
        "bomName": "G1E4003AWH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 904,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W400",
        "bomName": "G1E4003ASH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 905,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W400",
        "bomName": "G1E4003ALO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 906,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W400",
        "bomName": "G1E4003AGO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 907,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W400",
        "bomName": "G1E4003AMC3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 908,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W400",
        "bomName": "G1E4003ABW3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 909,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W400",
        "bomName": "G1E4003AWM3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 910,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W600",
        "bomName": "G1E6003AWH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 911,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W600",
        "bomName": "G1E6003ASH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 912,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W600",
        "bomName": "G1E6003ALO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 913,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W600",
        "bomName": "G1E6003AGO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 914,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W600",
        "bomName": "G1E6003AMC3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 915,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W600",
        "bomName": "G1E6003ABW3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 916,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W600",
        "bomName": "G1E6003AWM3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 917,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W800",
        "bomName": "G1E8003AWH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 918,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W800",
        "bomName": "G1E8003ASH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 919,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W800",
        "bomName": "G1E8003ALO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 920,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W800",
        "bomName": "G1E8003AGO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 921,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W800",
        "bomName": "G1E8003AMC3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 922,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W800",
        "bomName": "G1E8003ABW3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 923,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W800",
        "bomName": "G1E8003AWM3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 924,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W1200",
        "bomName": "G1EC003AWH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 925,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W1200",
        "bomName": "G1EC003ASH3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 926,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W1200",
        "bomName": "G1EC003ALO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 927,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W1200",
        "bomName": "G1EC003AGO3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 928,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W1200",
        "bomName": "G1EC003AMC3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 929,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W1200",
        "bomName": "G1EC003ABW3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 930,
        "category": "GRID",
        "productName": "施工棚板3枚セット D380 W1200",
        "bomName": "G1EC003AWM3",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 931,
        "category": "GRID",
        "productName": "追加棚板 D380 W400",
        "bomName": "G1K4003AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 932,
        "category": "GRID",
        "productName": "追加棚板 D380 W400",
        "bomName": "G1K4003ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 933,
        "category": "GRID",
        "productName": "追加棚板 D380 W400",
        "bomName": "G1K4003ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 934,
        "category": "GRID",
        "productName": "追加棚板 D380 W400",
        "bomName": "G1K4003AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 935,
        "category": "GRID",
        "productName": "追加棚板 D380 W400",
        "bomName": "G1K4003AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 936,
        "category": "GRID",
        "productName": "追加棚板 D380 W400",
        "bomName": "G1K4003ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 937,
        "category": "GRID",
        "productName": "追加棚板 D380 W400",
        "bomName": "G1K4003AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 938,
        "category": "GRID",
        "productName": "追加棚板 D380 W600",
        "bomName": "G1K6003AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 939,
        "category": "GRID",
        "productName": "追加棚板 D380 W600",
        "bomName": "G1K6003ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 940,
        "category": "GRID",
        "productName": "追加棚板 D380 W600",
        "bomName": "G1K6003ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 941,
        "category": "GRID",
        "productName": "追加棚板 D380 W600",
        "bomName": "G1K6003AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 942,
        "category": "GRID",
        "productName": "追加棚板 D380 W600",
        "bomName": "G1K6003AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 943,
        "category": "GRID",
        "productName": "追加棚板 D380 W600",
        "bomName": "G1K6003ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 944,
        "category": "GRID",
        "productName": "追加棚板 D380 W600",
        "bomName": "G1K6003AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 945,
        "category": "GRID",
        "productName": "追加棚板 D380 W800",
        "bomName": "G1K8003AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 946,
        "category": "GRID",
        "productName": "追加棚板 D380 W800",
        "bomName": "G1K8003ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 947,
        "category": "GRID",
        "productName": "追加棚板 D380 W800",
        "bomName": "G1K8003ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 948,
        "category": "GRID",
        "productName": "追加棚板 D380 W800",
        "bomName": "G1K8003AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 949,
        "category": "GRID",
        "productName": "追加棚板 D380 W800",
        "bomName": "G1K8003AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 950,
        "category": "GRID",
        "productName": "追加棚板 D380 W800",
        "bomName": "G1K8003ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 951,
        "category": "GRID",
        "productName": "追加棚板 D380 W800",
        "bomName": "G1K8003AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 952,
        "category": "GRID",
        "productName": "追加棚板 D380 W1200",
        "bomName": "G1KC003AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 953,
        "category": "GRID",
        "productName": "追加棚板 D380 W1200",
        "bomName": "G1KC003ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 954,
        "category": "GRID",
        "productName": "追加棚板 D380 W1200",
        "bomName": "G1KC003ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 955,
        "category": "GRID",
        "productName": "追加棚板 D380 W1200",
        "bomName": "G1KC003AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 956,
        "category": "GRID",
        "productName": "追加棚板 D380 W1200",
        "bomName": "G1KC003AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 957,
        "category": "GRID",
        "productName": "追加棚板 D380 W1200",
        "bomName": "G1KC003ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 958,
        "category": "GRID",
        "productName": "追加棚板 D380 W1200",
        "bomName": "G1KC003AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "エッヂバンダー": 3,
            "HOMAG": 5
        }
    },
    {
        "id": 959,
        "category": "GRID",
        "productName": "可動棚板 D380 W400",
        "bomName": "G1S4003AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 960,
        "category": "GRID",
        "productName": "可動棚板 D380 W400",
        "bomName": "G1S4003ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 961,
        "category": "GRID",
        "productName": "可動棚板 D380 W400",
        "bomName": "G1S4003ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 962,
        "category": "GRID",
        "productName": "可動棚板 D380 W400",
        "bomName": "G1S4003AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 963,
        "category": "GRID",
        "productName": "可動棚板 D380 W400",
        "bomName": "G1S4003AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 964,
        "category": "GRID",
        "productName": "可動棚板 D380 W400",
        "bomName": "G1S4003ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 965,
        "category": "GRID",
        "productName": "可動棚板 D380 W400",
        "bomName": "G1S4003AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 966,
        "category": "GRID",
        "productName": "可動棚板 D380 W600",
        "bomName": "G1S6003AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 967,
        "category": "GRID",
        "productName": "可動棚板 D380 W600",
        "bomName": "G1S6003ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 968,
        "category": "GRID",
        "productName": "可動棚板 D380 W600",
        "bomName": "G1S6003ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 969,
        "category": "GRID",
        "productName": "可動棚板 D380 W600",
        "bomName": "G1S6003AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 970,
        "category": "GRID",
        "productName": "可動棚板 D380 W600",
        "bomName": "G1S6003AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 971,
        "category": "GRID",
        "productName": "可動棚板 D380 W600",
        "bomName": "G1S6003ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 972,
        "category": "GRID",
        "productName": "可動棚板 D380 W600",
        "bomName": "G1S6003AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 973,
        "category": "GRID",
        "productName": "可動棚板 D380 W800",
        "bomName": "G1S8003AWH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 974,
        "category": "GRID",
        "productName": "可動棚板 D380 W800",
        "bomName": "G1S8003ASH1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 975,
        "category": "GRID",
        "productName": "可動棚板 D380 W800",
        "bomName": "G1S8003ALO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 976,
        "category": "GRID",
        "productName": "可動棚板 D380 W800",
        "bomName": "G1S8003AGO1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 977,
        "category": "GRID",
        "productName": "可動棚板 D380 W800",
        "bomName": "G1S8003AMC1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 978,
        "category": "GRID",
        "productName": "可動棚板 D380 W800",
        "bomName": "G1S8003ABW1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 979,
        "category": "GRID",
        "productName": "可動棚板 D380 W800",
        "bomName": "G1S8003AWM1",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 8,
            "芯組": 9,
            "フラッシュ": 3,
            "ランニングソー": 2,
            "TOYO": 2,
            "HOMAG": 5
        }
    },
    {
        "id": 980,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S4001AWH5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 981,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S4001ASH5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 982,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S4001ALO5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 983,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S4001AGO5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 984,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S4001AMC5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 985,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S4001ABW5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 986,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S4001AWM5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 987,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S6001AWH5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 988,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S6001ASH5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 989,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S6001ALO5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 990,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S6001AGO5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 991,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S6001AMC5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 992,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S6001ABW5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 993,
        "category": "GRID",
        "productName": "スリム可動棚板",
        "bomName": "G1S6001AWM5",
        "partCode": "4分",
        "processes": [
            "芯材カット",
            "芯組",
            "フラッシュ",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "芯組": 9,
            "フラッシュ": 3,
            "HOMAG": 3
        }
    },
    {
        "id": 994,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1CMP",
        "bomName": "RIRGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 995,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1CMP",
        "bomName": "LERGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 996,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2CMP",
        "bomName": "TNRGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 997,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2CMP",
        "bomName": "JIRGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 998,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2CMP",
        "bomName": "BARGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 999,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2CMP",
        "bomName": "FRGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1000,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2CMP",
        "bomName": "SRGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1001,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2CMP",
        "bomName": "DORGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1002,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-3CMP",
        "bomName": "SERGFSCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1003,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1BW",
        "bomName": "RIRGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1004,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1BW",
        "bomName": "LERGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1005,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2BW",
        "bomName": "TNRGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1006,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2BW",
        "bomName": "JIRGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1007,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2BW",
        "bomName": "BARGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1008,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2BW",
        "bomName": "FRGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1009,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2BW",
        "bomName": "SRGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1010,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2BW",
        "bomName": "DORGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1011,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-3BW",
        "bomName": "SERGFSBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1012,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1KKA",
        "bomName": "RIRGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1013,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1KKA",
        "bomName": "LERGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1014,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2KKA",
        "bomName": "TNRGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1015,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2KKA",
        "bomName": "JIRGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1016,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2KKA",
        "bomName": "BARGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1017,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2KKA",
        "bomName": "FRGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1018,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2KKA",
        "bomName": "SRGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1019,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2KKA",
        "bomName": "DORGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1020,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-3KKA",
        "bomName": "SERGFSKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1021,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1GO",
        "bomName": "RIRGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1022,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1GO",
        "bomName": "LERGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1023,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2GO",
        "bomName": "TNRGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1024,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2GO",
        "bomName": "JIRGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1025,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2GO",
        "bomName": "BARGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1026,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2GO",
        "bomName": "FRGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1027,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2GO",
        "bomName": "SRGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1028,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2GO",
        "bomName": "DORGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1029,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-3GO",
        "bomName": "SERGFSGO",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1030,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1MPP",
        "bomName": "RIRGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1031,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1MPP",
        "bomName": "LERGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1032,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2MPP",
        "bomName": "TNRGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1033,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2MPP",
        "bomName": "JIRGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1034,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2MPP",
        "bomName": "BARGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1035,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2MPP",
        "bomName": "FRGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1036,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2MPP",
        "bomName": "SRGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1037,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2MPP",
        "bomName": "DORGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1038,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-3MPP",
        "bomName": "SERGFSMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1039,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1WH",
        "bomName": "RIRGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1040,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-1WH",
        "bomName": "LERGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1041,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2WH",
        "bomName": "TNRGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1042,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2WH",
        "bomName": "JIRGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1043,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2WH",
        "bomName": "BARGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1044,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2WH",
        "bomName": "FRGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1045,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2WH",
        "bomName": "SRGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1046,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-2WH",
        "bomName": "DORGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1047,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNS-3WH",
        "bomName": "SERGFSWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1048,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1CMP",
        "bomName": "RIRGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1049,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1CMP",
        "bomName": "LERGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1050,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2CMP",
        "bomName": "TNRGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1051,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2CMP",
        "bomName": "JIRGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1052,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2CMP",
        "bomName": "BARGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1053,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2CMP",
        "bomName": "FRGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1054,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2CMP",
        "bomName": "SRGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1055,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2CMP",
        "bomName": "DORGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1056,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-3CMP",
        "bomName": "SERGFWCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1057,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1BW",
        "bomName": "RIRGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1058,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1BW",
        "bomName": "LERGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1059,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2BW",
        "bomName": "TNRGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1060,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2BW",
        "bomName": "JIRGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1061,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2BW",
        "bomName": "BARGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1062,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2BW",
        "bomName": "FRGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1063,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2BW",
        "bomName": "SRGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1064,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2BW",
        "bomName": "DORGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1065,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-3BW",
        "bomName": "SERGFWBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1066,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1KKA",
        "bomName": "RIRGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1067,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1KKA",
        "bomName": "LERGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1068,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2KKA",
        "bomName": "TNRGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1069,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2KKA",
        "bomName": "JIRGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1070,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2KKA",
        "bomName": "BARGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1071,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2KKA",
        "bomName": "FRGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1072,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2KKA",
        "bomName": "SRGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1073,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2KKA",
        "bomName": "DORGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1074,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-3KKA",
        "bomName": "SERGFWKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1075,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1MPP",
        "bomName": "RIRGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1076,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1MPP",
        "bomName": "LERGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1077,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2MPP",
        "bomName": "TNRGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1078,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2MPP",
        "bomName": "JIRGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1079,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2MPP",
        "bomName": "BARGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1080,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2MPP",
        "bomName": "FRGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1081,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2MPP",
        "bomName": "SRGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1082,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2MPP",
        "bomName": "DORGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1083,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-3MPP",
        "bomName": "SERGFWMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1084,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1WH",
        "bomName": "RIRGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1085,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-1WH",
        "bomName": "LERGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1086,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2WH",
        "bomName": "TNRGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1087,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2WH",
        "bomName": "JIRGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1088,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2WH",
        "bomName": "BARGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1089,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2WH",
        "bomName": "FRGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1090,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2WH",
        "bomName": "SRGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1091,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-2WH",
        "bomName": "DORGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1092,
        "category": "ﾌﾘｰｼﾞｮｲﾝﾄﾛｯｶｰ",
        "productName": "RGFJLNW-3WH",
        "bomName": "SERGFWWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1093,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "RIRGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1094,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "LERGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1095,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "TNRGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1096,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "JIRGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1097,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "BARGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1098,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "FRGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1099,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "SRGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1100,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "DORGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1101,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-CMP",
        "bomName": "MRGPCMP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1102,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "RIRGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1103,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "LERGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1104,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "TNRGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1105,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "JIRGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1106,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "BARGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1107,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "FRGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1108,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "SRGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1109,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "DORGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1110,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-BW",
        "bomName": "MRGPBW",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1111,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "RIRGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1112,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "LERGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1113,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "TNRGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1114,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "JIRGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1115,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "BARGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1116,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "FRGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1117,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "SRGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1118,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "DORGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1119,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-KKA",
        "bomName": "MRGPKKA",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1120,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "RIRGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1121,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "LERGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1122,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "TNRGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1123,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "JIRGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1124,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "BARGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1125,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "FRGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1126,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "SRGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1127,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "DORGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1128,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-MPP",
        "bomName": "MRGPMPP",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1129,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "RIRGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1130,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "LERGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1131,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "TNRGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1132,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "JIRGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1133,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "BARGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1134,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "FRGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1135,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "SRGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1136,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "DORGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1137,
        "category": "ﾊﾟｰｿﾅﾙﾛｯｶｰ",
        "productName": "RGP4545-WH",
        "bomName": "MRGPWH",
        "partCode": "5分",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "TOYO",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 3,
            "フラッシュ": 3,
            "ランニングソー": 4,
            "TOYO": 5,
            "HOMAG": 5
        }
    },
    {
        "id": 1138,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(①)",
        "partCode": "FF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1139,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(②)",
        "partCode": "FB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1140,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(③)",
        "partCode": "BF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1141,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(④)",
        "partCode": "BB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1142,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(⑤)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1143,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(⑥)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1144,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(⑦)",
        "partCode": "LE2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1145,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(⑧)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1146,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(⑨)",
        "partCode": "LE2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1147,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(⑩)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1148,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(天井)",
        "partCode": "TN2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 7,
            "面材カット": 3,
            "芯組": 10,
            "フラッシュ": 4,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 12,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1149,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(床)",
        "partCode": "YK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 15,
            "HOMAG": 10,
            "仕上・梱包": 15
        }
    },
    {
        "id": 1150,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(デスク)",
        "partCode": "DK2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 3,
            "フラッシュ": 2,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 6,
            "仕上・梱包": 8
        }
    },
    {
        "id": 1151,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(幕板大)",
        "partCode": "ML2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 1152,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(幕板小)",
        "partCode": "MS2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4,
            "仕上・梱包": 3
        }
    },
    {
        "id": 1153,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(開扉)",
        "partCode": "DO2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "仕上・梱包",
            "アクリルBOX作成",
            "扉面材くり抜き"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 5,
            "芯組": 20,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 5,
            "TOYO": 13,
            "仕上・梱包": 15,
            "アクリルBOX作成": 18,
            "扉面材くり抜き": 4
        }
    },
    {
        "id": 1154,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(フロア)",
        "partCode": "FL2424S",
        "processes": [
            "ランニングソー",
            "フロア加工"
        ],
        "processTimes": {
            "ランニングソー": 10,
            "フロア加工": 30
        }
    },
    {
        "id": 1155,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(台輪天板)",
        "partCode": "DT2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1156,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(台輪側板)",
        "partCode": "DG2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1157,
        "category": "PAO",
        "productName": "PAO-T",
        "bomName": "PAO-T(台輪前後板)",
        "partCode": "DZ2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 3,
            "HOMAG": 4,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1158,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(①)",
        "partCode": "FF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1159,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(②)",
        "partCode": "FB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1160,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(③)",
        "partCode": "BF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1161,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(④)",
        "partCode": "BB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1162,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑤)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1163,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑥)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1164,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑦)",
        "partCode": "LE2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1165,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑧)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1166,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑨)",
        "partCode": "LE2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1167,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑩)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1168,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑪)",
        "partCode": "FF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1169,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑫)",
        "partCode": "FB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 11,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1170,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑬)",
        "partCode": "BF2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1171,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑭)",
        "partCode": "BB2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1172,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑮)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1173,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(⑯)",
        "partCode": "RI2424S",
        "processes": [
            "芯材カット",
            "面材カット",
            "芯組",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "TOYO",
            "HOMAG",
            "仕上・梱包"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "芯組": 10,
            "フラッシュ": 5,
            "ランニングソー": 3,
            "エッヂバンダー": 4,
            "TOYO": 16,
            "HOMAG": 7,
            "仕上・梱包": 10
        }
    },
    {
        "id": 1174,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(補強桟①②)",
        "partCode": "TN1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    },
    {
        "id": 1175,
        "category": "PAO",
        "productName": "PAOW-T",
        "bomName": "PAOW-T(補強桟③④)",
        "partCode": "TN1218SL",
        "processes": [
            "芯材カット",
            "面材カット",
            "フラッシュ",
            "ランニングソー",
            "エッヂバンダー",
            "HOMAG"
        ],
        "processTimes": {
            "芯材カット": 5,
            "面材カット": 4,
            "フラッシュ": 3,
            "ランニングソー": 3,
            "エッヂバンダー": 2,
            "HOMAG": 4
        }
    }
];
