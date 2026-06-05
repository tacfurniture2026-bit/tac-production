// ========================================
// 生産管理システム - メインアプリケーション
// ========================================

// 初期化
DB.init();

// ========================================
// データマイグレーション (v4.76)
// ========================================
function migrateCorruptedData() {
  let needsBOMSave = false;
  let needsOrderSave = false;

  const boms = DB.get(DB.KEYS.BOM) || [];
  boms.forEach(b => {
    if (b.processes && b.processes.length === 1 && typeof b.processes[0] === 'string') {
      if (b.processes[0].includes('、') || b.processes[0].includes('，')) {
        b.processes = b.processes[0].split(/[,、，]/).map(x => x.trim()).filter(Boolean);
        needsBOMSave = true;
      }
    }
    if (!b.processes || b.processes.length === 0) {
       // デフォルトの標準工程を付与（完了確認ではなく実際の工程名を使う）
       b.processes = ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', 'エッヂバンダー', '仕上・梱包'];
       needsBOMSave = true;
    }
  });
  if (needsBOMSave) DB.save(DB.KEYS.BOM, boms);

  // BOMマップを作成（注文の工程修復に使用）
  const bomMap = {};
  boms.forEach(b => {
    const key = (b.bomName || '') + '|' + (b.partCode || '');
    bomMap[key] = b.processes;
  });

  const orders = DB.get(DB.KEYS.ORDERS) || [];
  orders.forEach(o => {
    if (o.items) {
      o.items.forEach(item => {
        if (item.processes && item.processes.length === 1 && typeof item.processes[0] === 'string') {
          if (item.processes[0].includes('、') || item.processes[0].includes('，')) {
            item.processes = item.processes[0].split(/[,、，]/).map(x => x.trim()).filter(Boolean);
            needsOrderSave = true;
          }
        }
        if (!item.processes || item.processes.length === 0) {
           // BOMから工程を復元
           const key = (item.bomName || '') + '|' + (item.partCode || '');
           if (bomMap[key] && bomMap[key].length > 0) {
             item.processes = [...bomMap[key]];
           } else {
             item.processes = ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', 'エッヂバンダー', '仕上・梱包'];
           }
           needsOrderSave = true;
        }
      });
    }
  });
  if (needsOrderSave) DB.save(DB.KEYS.ORDERS, orders);

  // 特定製品名の修正 (N05000000000184)
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  let fixedCount = 0;
  products.forEach(p => {
    if (p.id === 'N05000000000184') {
      p.name = '+ﾄﾗｽ小ﾈｼﾞ　ﾕﾆｸﾛ 4X30';
      fixedCount++;
    }
  });
  if (fixedCount > 0) {
    DB.save(DB.KEYS.INV_PRODUCTS, products);
    console.log(`✅ 製品名修正: N05000000000184 -> +ﾄﾗｽ小ﾈｼﾞ　ﾕﾆｸﾛ 4X30 (${fixedCount}件)`);
  }
}
migrateCorruptedData();

// ========================================
// グローバル変数
// ========================================

let currentUser = null;
let expandedOrders = new Set();
let ganttFilter = 'all';

// カテゴリ別カラー定義
const CATEGORY_COLORS = {
  'T-G': '#e0f2fe', // Light Blue
  'P-G': '#f0fdf4', // Light Green
  'DRB': '#fefce8', // Light Yellow
  'S-G': '#f3e8ff', // Light Purple
  'T-R': '#ffe4e6', // Light Red
};


// ========================================
// ユーティリティ
// ========================================

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

function toast(message, type = 'success') {
  const container = $('#toast-container');
  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.textContent = message;
  container.appendChild(toastEl);

  setTimeout(() => {
    toastEl.remove();
  }, 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function calculateProgress(order) {
  if (!order) return 0;
  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) return 0;

  let totalProcesses = 0;
  let completedProcesses = 0;

  order.items.forEach(item => {
    // プロセス未定義のアイテムをスキップ
    if (!item || !item.processes || !Array.isArray(item.processes)) return;

    totalProcesses += item.processes.length;
    completedProcesses += (Array.isArray(item.completed) ? item.completed.length : 0);
  });

  return totalProcesses > 0 ? Math.round((completedProcesses / totalProcesses) * 100) : 0;
}

// ========================================
// 認証
// ========================================

function login(username, password) {
  const users = DB.get(DB.KEYS.USERS);
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    currentUser = user;
    DB.save(DB.KEYS.CURRENT_USER, user);
    return true;
  }
  return false;
}

// グローバルスコープに明示的に公開
window.logout = function () {
  // モバイルメニューが開いていれば閉じる
  const moreMenu = document.getElementById('more-menu');
  if (moreMenu && !moreMenu.classList.contains('hidden')) {
    moreMenu.classList.add('hidden');
  }

  currentUser = null;
  localStorage.removeItem(DB.KEYS.CURRENT_USER);
  showLoginScreen();
  toast('ログアウトしました', 'success');
};

function checkAuth() {
  const savedUser = localStorage.getItem(DB.KEYS.CURRENT_USER);
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showMainScreen();
  } else {
    showLoginScreen();
  }
}

// ========================================
// 画面切り替え
// ========================================

function showLoginScreen() {
  $('#login-screen').classList.add('active');
  $('#main-screen').classList.remove('active');
}

function showMainScreen() {
  $('#login-screen').classList.remove('active');
  $('#main-screen').classList.add('active');

  // ユーザー情報を表示
  if ($('#current-user-name')) {
    $('#current-user-name').textContent = currentUser.displayName;
  }
  if ($('#current-user-role')) {
    $('#current-user-role').textContent = currentUser.role === 'admin' ? '管理者' : '作業者';
  }

  // 管理者メニューの表示/非表示
  $$('.admin-only').forEach(el => {
    el.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
  });

  // モバイルナビの初期化
  initMobileNav();

  // ロール別の初期画面（前回開いていたページがあれば復元）
  const lastPage = localStorage.getItem('lastPage');
  if (lastPage) {
    navigateTo(lastPage);
  } else if (currentUser.role === 'admin') {
    navigateTo('dashboard');
  } else {
    // 作業者はQR進捗登録画面を初期表示
    navigateTo('qr');
  }

  // 特定データの修正（Firebase読み込み待ちを考慮して遅延実行）
  setTimeout(() => {
    emergencyRestoreProductsFromLogs(); // 緊急復元チェック
    
    console.log('🔍 データメンテナンス実行中...');
    const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
    let fixedCount = 0;
    products.forEach(p => {
      // ID一致かつ名称が不正（#ERROR!等）な場合に修正
      if (p.id === 'N05000000000184') {
        p.name = '+ﾄﾗｽ小ﾈｼﾞ　ﾕﾆｸﾛ 4X30';
        fixedCount++;
      }
    });
    if (fixedCount > 0) {
      DB.save(DB.KEYS.INV_PRODUCTS, products);
      console.log(`✅ 製品名修正完了: N05000000000184 (${fixedCount}件)`);
      if (typeof toast === 'function') toast('資材データを修正・復元しました', 'success');
      if (typeof currentActivePage !== 'undefined' && currentActivePage === 'inv-products') {
        renderInvProductsTable();
      }
    }
  }, 5000);
}

/**
 * 在庫ログから商品マスタを緊急復元する（データ消失対策）
 */
function emergencyRestoreProductsFromLogs() {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  if (products.length > 0) return; // すでにデータがある場合は何もしない

  console.log('🚨 商品マスタが空のため、在庫ログから復元を試みます...');
  const logs = DB.get(DB.KEYS.INV_LOGS);
  if (logs.length === 0) {
    console.warn('⚠️ 復元対象の在庫ログも見つかりません');
    return;
  }

  const newProducts = [];
  const productMap = new Map();

  // ログを日付順（古い順）に走査してマスタを構築
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  sortedLogs.forEach(log => {
    if (!log.productId) return;
    
    if (!productMap.has(log.productId)) {
      productMap.set(log.productId, {
        id: log.productId,
        name: log.productName || log.productId,
        category: log.productId.startsWith('N') ? log.productId.substring(1, 3) : '99',
        price: log.unitPrice || 0,
        isFixed: false
      });
    } else {
      // すでに存在する場合、名前や価格を最新のログで更新
      const p = productMap.get(log.productId);
      if (log.productName && !log.productName.includes('#')) p.name = log.productName;
      if (log.unitPrice) p.price = log.unitPrice;
    }
  });

  const restoredList = Array.from(productMap.values());
  if (restoredList.length > 0) {
    // 保護を一時解除して強制保存（またはフラグを確認）
    if (DB._loaded[DB.KEYS.INV_PRODUCTS]) {
        DB.save(DB.KEYS.INV_PRODUCTS, restoredList);
        console.log(`✅ 商品マスタを ${restoredList.length} 件復元しました`);
        toast(`消失した商品マスタを ${restoredList.length} 件復元しました`, 'success');
        if (typeof renderInvProductsTable === 'function') renderInvProductsTable();
    } else {
        console.warn('⚠️ マスタの同期が完了していないため復元保存を待機します');
        setTimeout(emergencyRestoreProductsFromLogs, 2000);
    }
  }
}

// 現在表示中のページを再描画する（Firebaseデータ同期時のUI更新用）
window.refreshCurrentPage = function () {
  const activePage = localStorage.getItem('lastPage') || 'dashboard';

  switch (activePage) {
    case 'dashboard': renderDashboard(); break;
    case 'gantt': renderGantt(); break;
    case 'qr': renderQrPage(); break;
    case 'defects': renderDefects(); break;
    case 'orders': renderOrders(); break;
    case 'bom': renderBom(); break;
    case 'rates': renderRates(); break;
    case 'users': renderUsers(); break;
    case 'report': renderReport(); break;
    case 'backup': renderBackupPage(); break;
    case 'inv-scan': renderInvScanPage(); break;
    case 'inv-search': renderInvSearchPage(); break;
    case 'inv-products': renderInvProductsPage(); break;
    case 'inv-check': renderInvCheckPage(); break; // ← ADDED
    case 'inv-adjust': renderInvAdjustPage(); break;
    case 'inv-monthly': renderInvMonthlyPage(); break;
  }
};

function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
}

function initSidebarHover() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  // マウスホバーでの展開（PC向け）
  sidebar.addEventListener('mouseenter', () => {
    if (isTouchDevice()) return;
    sidebar.classList.add('expanded');
  });

  sidebar.addEventListener('mouseleave', () => {
    if (isTouchDevice()) return;
    sidebar.classList.remove('expanded');
  });

  // タッチデバイスでの開閉トグル（サイドバー自体がタップされたとき）
  sidebar.addEventListener('click', (e) => {
    if (isTouchDevice()) {
      if (e.target.closest('.nav-item') || e.target.closest('#logout-btn')) {
        // 項目選択時はクローズを優先
        sidebar.classList.remove('expanded');
        return;
      }
      sidebar.classList.toggle('expanded');
    }
  });

  // メインエリアがタッチされたらサイドバーを閉じる（タッチデバイス向け）
  const mainContent = document.querySelector('.main-content') || document.querySelector('.page-container') || document.body;
  mainContent.addEventListener('touchstart', (e) => {
    if (isTouchDevice() && !sidebar.contains(e.target)) {
      sidebar.classList.remove('expanded');
    }
  });
}

function navigateTo(pageName) {
  // ページ状態を保存
  localStorage.setItem('lastPage', pageName);

  // iPad等タッチデバイスでのホバー残留対策
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.remove('expanded');
    if (document.activeElement) {
      document.activeElement.blur();
    }
  }

  // ページ切り替え
  $$('.page').forEach(p => p.classList.remove('active'));
  $(`#page-${pageName}`).classList.add('active');

  // ナビゲーション更新
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = $(`.nav-item[data-page="${pageName}"]`);
  if (navItem) navItem.classList.add('active');

  // モバイルナビ更新
  $$('.mobile-nav-btn').forEach(n => n.classList.remove('active'));
  const mobileBtn = $(`.mobile-nav-btn[data-page="${pageName}"]`);
  if (mobileBtn) mobileBtn.classList.add('active');

  // ページ初期化
  // カメラ停止（タブ切り替え時にリセット）
  stopQrScanner();
  stopInvScanner();

  switch (pageName) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'gantt':
      renderGantt();
      break;
    case 'qr':
      renderQrPage();
      break;
    case 'defects':
      renderDefects();
      break;
    case 'orders':
      renderOrders();
      break;
    case 'bom':
      renderBom();
      break;
    case 'rates':
      renderRates();
      break;
    case 'users':
      renderUsers();
      break;
    case 'report':
      renderReport();
      break;
    case 'backup':
      renderBackupPage();
      break;
    // 在庫管理
    case 'inv-scan':
      renderInvScanPage();
      break;
    case 'inv-search':
      renderInvSearchPage();
      break;
    case 'inv-products':
      renderInvProductsPage();
      break;
    case 'inv-adjust':
      renderInvAdjustPage();
      break;
    case 'inv-check':
      renderInvCheckPage();
      break;
    case 'inv-monthly':
      renderInvMonthlyPage();
      break;
  }
}

// ========================================
// ダッシュボード
// ========================================

// ページ遷移ヘルパー
function navigateToOrder(orderId) {
  // ページ切り替え
  navigateTo('orders');

  const isWorker = currentUser && currentUser.role !== 'admin';
  if (isWorker) {
    navigateTo('gantt');
    // 作業者の場合はGanttで該当箇所へ（簡易実装）
    // TODO: Gantt側にもIDを振ってスクロールさせる機能などを追加検討
  } else {
    // 管理者の場合
    navigateTo('orders');

    // 確実に最新のDOM（ID付き）にするために再描画
    // フィルタリングで非表示になっている可能性も考慮してフラグ操作が必要だが
    // ここではまず描画を優先
    renderOrders();

    // DOM更新待ち
    setTimeout(() => {
      const rowId = `order-row-${orderId}`;
      const row = document.getElementById(rowId);

      if (row) {
        // スクロールとハイライト
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 強調表示エフェクト
        row.style.transition = 'background-color 0.5s';
        const originalBg = row.style.backgroundColor;
        row.style.backgroundColor = '#fbbf24'; // アンバー色で目立たせる

        setTimeout(() => {
          row.style.backgroundColor = originalBg || '';
        }, 2000);
      } else {
        // 見つからない場合（完了分として非表示の可能性）
        if (!showCompletedOrders) {
          // 完了分も表示して再トライ
          $('#show-completed-check').checked = true;
          toggleShowCompleted(); // これがrenderOrdersを呼ぶ

          setTimeout(() => {
            const retryRow = document.getElementById(rowId);
            if (retryRow) {
              retryRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
              retryRow.style.backgroundColor = '#fbbf24';
              setTimeout(() => { retryRow.style.backgroundColor = ''; }, 2000);
            } else {
              toast('該当する指示書が見つかりませんでした', 'warning');
            }
          }, 300);
        } else {
          toast('該当する指示書が見つかりませんでした', 'warning');
        }
      }
    }, 300);
  }
}

function renderDashboard() {
  const orders = DB.get(DB.KEYS.ORDERS);
  const defects = DB.get(DB.KEYS.DEFECTS);

  // 統計
  const total = orders.length;
  const complete = orders.filter(o => calculateProgress(o) === 100).length;
  const inProgress = orders.filter(o => {
    const p = calculateProgress(o);
    return p > 0 && p < 100;
  }).length;

  $('#stat-total').textContent = total;
  $('#stat-progress').textContent = inProgress;
  $('#stat-complete').textContent = complete;
  $('#stat-defects').textContent = defects.length;

  // 緊急案件 (カテゴリ別)
  const urgentOrders = orders.filter(o => {
    if (!o.dueDate) return false;
    const days = Math.ceil((new Date(o.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days <= 3 && calculateProgress(o) < 100;
  });

  const boms = DB.get(DB.KEYS.BOM) || [];

  // カテゴリ分類
  const paoOrders = [];
  const gridOrders = [];
  const otherOrders = [];

  urgentOrders.forEach(o => {
    const bom = boms.find(b => b.productName === o.productName);
    const category = bom ? (bom.category || '') : '';

    // キーワード判定 (BOMのカテゴリ または 品名から推測)
    if (category.includes('PAO') || o.productName.includes('PAO')) {
      paoOrders.push(o);
    } else if (category.includes('GRID') || o.productName.includes('GRID')) {
      gridOrders.push(o);
    } else {
      otherOrders.push(o);
    }
  });

  const generateUrgentHtml = (list) => {
    if (list.length === 0) return '<p class="text-muted">緊急案件はありません</p>';
    return list.map(o => {
      const days = Math.ceil((new Date(o.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      const daysClass = days < 0 ? 'text-danger' : (days <= 1 ? 'text-warning' : '');
      return `
        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border);">
          <div>
            <div style="font-weight: 500; cursor: pointer; color: var(--color-primary);" onclick="navigateToOrder(${o.id})">${o.projectName}</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-muted);">${o.productName} × ${o.quantity}</div>
          </div>
          <div class="${daysClass}" style="font-weight: bold;">
            ${days <= 0 ? '今日' : `あと${days}日`}
          </div>
        </div>
      `;
    }).join('');
  };

  $('#urgent-orders-pao').innerHTML = generateUrgentHtml(paoOrders);
  $('#urgent-orders-grid').innerHTML = generateUrgentHtml(gridOrders);
  $('#urgent-orders-other').innerHTML = generateUrgentHtml(otherOrders);
}




// ========================================
// ガントチャート（工程管理）- Monorevo風
// ========================================

function renderGantt() {
  const orders = DB.get(DB.KEYS.ORDERS);
  const boms = DB.get(DB.KEYS.BOM);
  const defects = DB.get(DB.KEYS.DEFECTS) || [];

  // フィルタリング
  let filtered = orders;
  if (ganttFilter === 'progress') {
    filtered = orders.filter(o => {
      const p = calculateProgress(o);
      return p > 0 && p < 100;
    });
  } else if (ganttFilter === 'complete') {
    filtered = orders.filter(o => calculateProgress(o) === 100);
  } else if (ganttFilter === 'pending') {
    filtered = orders.filter(o => calculateProgress(o) === 0);
  } else if (ganttFilter === 'incomplete') {
    // 未完了 = 進行中 OR 未着手 (進捗 < 100)
    filtered = orders.filter(o => calculateProgress(o) < 100);
  } else if (['pao_incomplete', 'grid_incomplete', 'other_incomplete'].includes(ganttFilter)) {
    filtered = orders.filter(o => {
      if (calculateProgress(o) === 100) return false; // 完了は除外

      // カテゴリ判定
      const bom = boms ? boms.find(b => b.productName === o.productName) : null;
      const category = bom ? (bom.category || '') : '';
      const isPAO = category.includes('PAO') || o.productName.includes('PAO');
      const isGRID = category.includes('GRID') || o.productName.includes('GRID');

      if (ganttFilter === 'pao_incomplete') return isPAO;
      if (ganttFilter === 'grid_incomplete') return isGRID;
      if (ganttFilter === 'other_incomplete') return !isPAO && !isGRID;
      return false;
    });
  }

  // 納期順にソート（昇順）
  filtered.sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  // 全工程リストを取得（ユニーク: 標準 + 実データから収集）
  const allProcesses = [...STANDARD_PROCESSES];
  filtered.forEach(order => {
    if (order.items) {
      order.items.forEach(item => {
        if (item.processes && Array.isArray(item.processes)) {
          item.processes.forEach(p => {
            if (!allProcesses.includes(p)) {
              allProcesses.push(p);
            }
          });
        }
      });
    }
  });
  console.log('Active Processes:', allProcesses); // Debug log

  // マトリクス表示のメインコンテナ
  // index.htmlには .card-body がないので .gantt-container-mono をターゲットにする
  const pageBody = document.querySelector('.gantt-container-mono');
  if (!pageBody) {
    console.error('Target container .gantt-container-mono not found');
    return;
  }

  if (filtered.length === 0) {
    pageBody.innerHTML = `<div class="text-center text-muted p-4">データがありません</div>`;
    return;
  }

  // HTML生成開始
  let html = `
    <div class="matrix-container" style="max-height: 75vh; overflow-y: auto; overflow-x: auto; position: relative;">
      <table class="matrix-table" style="border-collapse: separate; border-spacing: 0;">
        <thead>
          <tr>
            <th class="col-part-name" style="position: sticky; top: 0; left: 0; z-index: 20; background: var(--color-bg-tertiary); color: var(--color-text-primary); border-bottom: 2px solid var(--color-border);">部材名</th>
            ${allProcesses.map(p => `<th style="width: 100px; min-width: 100px; position: sticky; top: 0; z-index: 10; background: var(--color-bg-tertiary); color: var(--color-text-primary); border-bottom: 2px solid var(--color-border);">${p}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  filtered.forEach(order => {
    // オーダーヘッダー行
    const daysUntilDue = order.dueDate ? Math.ceil((new Date(order.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
    let dueStyle = '';
    if (daysUntilDue !== null && daysUntilDue <= 1) dueStyle = 'color: #ef4444; font-weight: bold;';
    else if (daysUntilDue !== null && daysUntilDue <= 3) dueStyle = 'color: #f59e0b;';

    const isExpanded = expandedOrders.has(order.id);
    const expandIcon = isExpanded ? '▼' : '▶';

    // カテゴリ色判定
    let rowStyle = '';
    const bom = boms ? boms.find(b => b.productName === order.productName) : null;
    const category = bom ? (bom.category || '') : '';
    if (typeof CATEGORY_COLORS !== 'undefined' && CATEGORY_COLORS[category]) {
      rowStyle = `background-color: ${CATEGORY_COLORS[category]}; color: #1e293b;`;
    }

    html += `
      <tr style="${rowStyle}">
        <td colspan="${allProcesses.length + 1}" class="matrix-group-header" style="${rowStyle}">
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleExpand(event, ${order.id})">
            <div>
              <span class="expand-btn" style="margin-right: 8px; font-weight: bold; display: inline-block; width: 20px; text-align: center;">${expandIcon}</span>
              <span style="display: inline-block; background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 8px; cursor: pointer;" onclick="event.stopPropagation(); jumpToOrder('${order.id}')">生産指示書 ↗</span>
              <span style="font-weight:600; cursor: pointer;" onclick="event.stopPropagation(); jumpToOrder('${order.id}')">[${order.orderNo}] ${order.projectName}</span> / ${order.productName} (数量: ${order.quantity}, 部材数: ${order.items ? order.items.length : 0}) <span style="margin-left:8px; font-size:0.8rem; background:var(--color-bg-secondary); padding:2px 4px; border-radius:4px;">色: ${order.color || '-'}</span>
              ${category ? `<span style="font-size:0.7rem; background:rgba(255,255,255,0.7); padding:1px 4px; border-radius:3px; color:#333; margin-left:8px;">${category}</span>` : ''}
            </div>
            <span style="font-weight: normal; font-size: 0.85rem; ${dueStyle}">
              納期: ${formatDate(order.dueDate)}
            </span>
          </div>
        </td>
      </tr>
    `;

    // アイテム（部材）行 - 展開時のみ表示
    if (isExpanded && order.items && order.items.length > 0) {
      order.items.forEach((item, itemIdx) => {
        // データ整合性
        if (!item) return;
        // ID重複対策
        const uniqueItemId = `${order.id}-${item.id || itemIdx}`;

        html += `
           <tr>
             <td class="col-part-name">
               <span style="color: #64748b; margin-right: 4px; margin-left: 1rem;">┗</span>
               ${item.bomName || item.partCode || '<span style="color:var(--color-text-muted)">(名称なし)</span>'}
             </td>
         `;

        // 各工程セル
        allProcesses.forEach(process => {
          const hasProcess = Array.isArray(item.processes) && item.processes.includes(process);
          const isComplete = Array.isArray(item.completed) && item.completed.includes(process);
          const hasPendingDefect = Array.isArray(defects) && defects.some(d => 
            String(d.orderId) === String(order.id) &&
            String(d.itemId) === String(item.id) &&
            d.processName === process &&
            d.status === 'pending'
          );

          if (!hasProcess) {
            html += `<td class="matrix-cell status-disabled"></td>`;
          } else {
            let statusClass = 'status-todo';
            let statusText = '<span style="font-size:10px; color:#94a3b8;">未</span>';
            if (isComplete) {
              statusClass = 'status-done';
              statusText = '<span style="font-size:10px; color:#15803d; font-weight:bold;">完了</span>';
            } else if (hasPendingDefect) {
              statusClass = 'status-defect';
              statusText = '<span style="font-size:10px; color:#ffffff; font-weight:bold;">不良</span>';
            }

            // エスケープ処理（シングルクォート対策）
            const safeProcess = process.replace(/'/g, "\\'");
            const safeOrderId = String(order.id).replace(/'/g, "\\'");

            html += `
               <td class="matrix-cell ${statusClass}"
                   onclick="toggleProcessStatus(this, '${safeOrderId}', ${itemIdx}, '${safeProcess}')"
                   style="width: 100px; min-width: 100px;">
                   ${statusText}
               </td>
             `;
          }
        });

        html += `</tr>`;
      });
    } else if (isExpanded) {
      // 展開しているがアイテムがない場合
      html += `<tr><td colspan="${allProcesses.length + 1}" style="text-align:center; color:var(--color-text-muted); padding: 1rem;">部材データなし</td></tr>`;
    }
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  // スクロール位置の保存
  const oldContainer = pageBody.querySelector('.matrix-container');
  let savedScrollTop = 0;
  let savedScrollLeft = 0;
  if (oldContainer) {
    savedScrollTop = oldContainer.scrollTop;
    savedScrollLeft = oldContainer.scrollLeft;
  }

  pageBody.innerHTML = html;

  // スクロール位置の復元
  const newContainer = pageBody.querySelector('.matrix-container');
  if (newContainer) {
    newContainer.scrollTop = savedScrollTop;
    newContainer.scrollLeft = savedScrollLeft;
  }
}

function jumpToOrder(orderId) {
  // 指示書ページへ移動
  navigateTo('orders');
  
  // 該当オーダーを強調表示するための処理
  setTimeout(() => {
    const row = document.querySelector(`.order-row[data-order-id="${orderId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.transition = 'background-color 0.5s';
      row.style.backgroundColor = '#fef3c7'; // 一時的にハイライト
      setTimeout(() => {
        row.style.backgroundColor = '';
      }, 2000);
    }
  }, 300);
}

function toggleExpand(event, orderId) {
  if (event) event.stopPropagation();
  // IDの数値・文字列ゆらぎ対策
  if (expandedOrders.has(orderId)) {
    expandedOrders.delete(orderId);
    expandedOrders.delete(String(orderId));
    expandedOrders.delete(Number(orderId));
  } else {
    expandedOrders.add(orderId);
    expandedOrders.add(String(orderId));
    expandedOrders.add(Number(orderId));
  }
  renderGantt();
}

function expandAll() {
  const orders = DB.get(DB.KEYS.ORDERS);
  expandedOrders = new Set();
  orders.forEach(o => {
    expandedOrders.add(o.id);
    expandedOrders.add(String(o.id));
    expandedOrders.add(Number(o.id));
  });
  renderGantt();
}

function collapseAll() {
  expandedOrders = new Set();
  renderGantt();
}

// ========================================
// QR読取（進捗登録）
// ========================================

// QRスキャナーインスタンス
let qrScanner = null;
let defectQrScanner = null;

function renderQrPage() {
  const orders = DB.get(DB.KEYS.ORDERS);
  const history = DB.get(DB.KEYS.PROGRESS_HISTORY);

  // 指示書セレクト
  const orderSelect = $('#qr-order');
  orderSelect.innerHTML = '<option value="">選択してください</option>' +
    orders.map(o => `<option value="${o.id}">${o.projectName} - ${o.productName}</option>`).join('');

  // 履歴表示
  const historyContainer = $('#qr-history');
  if (history.length === 0) {
    historyContainer.innerHTML = '<p class="text-muted">履歴がありません</p>';
  } else {
    historyContainer.innerHTML = history.slice(0, 10).map(h => `
      <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--color-bg-secondary); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
        <div>
          <div style="font-weight: 500;">${h.processName}</div>
          <div style="font-size: 0.8125rem; color: var(--color-text-muted);">${h.bomName}</div>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-muted);">${h.time}</div>
      </div>
    `).join('');
  }

  // スキャナーボタンのイベント
  const startBtn = $('#start-scan-btn');
  const stopBtn = $('#stop-scan-btn');

  if (startBtn) {
    startBtn.onclick = startQrScanner;
  }
  if (stopBtn) {
    stopBtn.onclick = stopQrScanner;
  }

  // スマホの場合は自動でカメラ起動 -> 廃止（ボタンで起動）
  /*
  if (isMobileDevice()) {
    setTimeout(() => {
      startQrScanner();
    }, 500);
  }
  */
}

// スマホ判定
function isMobileDevice() {
  return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function startQrScanner() {
  const videoEl = $('#qr-video');
  const placeholder = $('#qr-scanner-placeholder');
  const startBtn = $('#start-scan-btn');
  const stopBtn = $('#stop-scan-btn');
  const resultDiv = $('#qr-scan-result');

  // 二重起動防止
  if (qrScanner) {
    console.log('QR Scanner is already running');
    return;
  }

  // 競合する他のスキャナーを停止
  stopInvScanner();

  // プレースホルダーを非表示、ビデオを表示
  if (placeholder) placeholder.style.display = 'none';
  if (videoEl) videoEl.style.display = 'block';
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'inline-block';
  if (resultDiv) resultDiv.style.display = 'none';

  // html5-qrcodeが読み込まれているか確認
  if (typeof Html5Qrcode === 'undefined') {
    toast('QRスキャナーが読み込めません。ページを再読み込みしてください。', 'error');
    return;
  }

  // スキャナーを初期化
  qrScanner = new Html5Qrcode('qr-scanner-preview');

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1
  };

  qrScanner.start(
    { facingMode: 'environment' }, // 背面カメラを優先
    config,
    onQrCodeScanned,
    (error) => {
      // エラーは頻繁に発生するのでログしない
    }
  ).catch(err => {
    console.error('カメラ起動エラー:', err);
    toast('カメラを起動できません。カメラの権限を許可してください。', 'error');
    stopQrScanner();
  });
}

function stopQrScanner() {
  const videoEl = $('#qr-video');
  const placeholder = $('#qr-scanner-placeholder');
  const startBtn = $('#start-scan-btn');
  const stopBtn = $('#stop-scan-btn');

  if (qrScanner) {
    qrScanner.stop().then(() => {
      qrScanner.clear();
      qrScanner = null;
    }).catch(err => console.log(err));
  }

  // UIを元に戻す
  if (placeholder) placeholder.style.display = 'block';
  if (videoEl) videoEl.style.display = 'none';
  if (startBtn) startBtn.style.display = 'inline-block';
  if (stopBtn) stopBtn.style.display = 'none';
}

function onQrCodeScanned(decodedText, decodedResult) {
  try {
    // Define safeSet helper early
    const safeSet = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    console.log('Force Raw Data:', decodedText);
    safeSet('qr-raw-data', decodedText);
    console.log(`QR Scanned: ${decodedText}`);
    // Debug toast
    const debugMsg = decodedText.length > 20 ? decodedText.substring(0, 20) + '...' : decodedText;
    toast(`読取成功: ${debugMsg}`, 'success');

    // Stop scanner
    stopQrScanner();

    const resultDiv = document.getElementById('qr-scan-result');
    const dataDiv = document.getElementById('qr-scan-data');
    if (resultDiv) resultDiv.style.display = 'block';

    // Parse
    let projectName = '';
    let productName = '';
    let bomName = '';
    let parsed = false;

    // 1. JSON
    try {
      const json = JSON.parse(decodedText);
      if (json.project || json.projectName) {
        projectName = (json.project || json.projectName || '').trim();
        productName = (json.product || json.productName || '').trim();
        bomName = (json.bom || json.bomName || json.item || '').trim();
        parsed = true;
      }
    } catch (e) { }

    // 2. Delimiter
    if (!parsed) {
      const parts = decodedText.split(/[|\t_]/);
      if (parts.length >= 3) {
        projectName = parts[0].trim();
        productName = parts[1].trim();
        bomName = parts[2].trim();
        parsed = true;
      } else {
        const commaParts = decodedText.split(',');
        if (commaParts.length >= 3) {
          projectName = commaParts[0].trim();
          productName = commaParts[1].trim();
          bomName = commaParts[2].trim();
          parsed = true;
        }
      }
    }

    // 3. Two parts
    if (!parsed) {
      const parts2 = decodedText.split(/[|,\t_]/);
      if (parts2.length === 2) {
        productName = parts2[0].trim();
        bomName = parts2[1].trim();
        parsed = true;
      }
    }

    // 4. Single string search
    if (!parsed) {
      const orders = DB.get(DB.KEYS.ORDERS) || [];
      const searchText = decodedText.trim();
      const matchOrder = orders.find(o =>
        o.orderNo === searchText ||
        o.projectName === searchText ||
        o.productName === searchText ||
        (o.items && o.items.some(i => i.bomName === searchText || i.partCode === searchText))
      );

      if (matchOrder) {
        projectName = matchOrder.projectName;
        productName = matchOrder.productName;
        const matchItem = matchOrder.items?.find(i => i.bomName === searchText || i.partCode === searchText);
        if (matchItem) bomName = matchItem.bomName;
        parsed = true;
      }
    }

    // Display and Auto Transcription
    if (dataDiv) {
      if (parsed && (projectName || productName || bomName)) {
        dataDiv.innerHTML = `
            ${projectName ? `<div><strong>現場名:</strong> ${projectName}</div>` : ''}
            ${productName ? `<div><strong>品名:</strong> ${productName}</div>` : ''}
            ${bomName ? `<div><strong>部材:</strong> ${bomName}</div>` : ''}
          `;

        safeSet('qr-project-name', projectName || '');
        safeSet('qr-product-name', productName || '');
        safeSet('qr-bom-name', bomName || '');

      } else {
        dataDiv.innerHTML = `<div>読取データ: ${decodedText}</div>`;
      }
    }

    // Auto Select
    if (parsed && (projectName || productName)) {
      selectFromQrData(projectName, productName, bomName);
    } else {
      toast('データが見つかりませんでした (転記不可)', 'warning');
    }

    // Vibrate
    if (navigator.vibrate) {
      try { navigator.vibrate(100); } catch (e) { }
    }

  } catch (e) {
    console.error('QR Scan Error:', e);
    alert('エラー: ' + e.message);
    toast('システムエラー: ' + e.message, 'error');
  }
}


function selectFromQrData(projectName, productName, bomName) {
  const orders = DB.get(DB.KEYS.ORDERS) || [];

  const normalize = s => (s || '').trim().replace(/\s+/g, '').replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).toLowerCase();

  const pNameNorm = normalize(projectName);
  const prodNameNorm = normalize(productName);
  const bomNameNorm = normalize(bomName);

  // 1. Strict
  let order = orders.find(o =>
    o.projectName.includes(projectName) && o.productName.includes(productName)
  );


  // 2. Fuzzy
  if (!order) {
    order = orders.find(o =>
      normalize(o.projectName).includes(pNameNorm) && normalize(o.productName).includes(prodNameNorm)
    );
  }

  if (!order) {
    // Partial check
    const pMatch = orders.find(o => normalize(o.projectName).includes(pNameNorm));

    toast(`該当データなし (現場: ${projectName}, 品名: ${productName})`, 'warning');
    return;
  }

  // Select Order
  const orderSelect = document.getElementById('qr-order');
  if (orderSelect) {
    // Create option if missing? Be careful.
    // Check if option exists
    const opt = orderSelect.querySelector(`option[value="${order.id}"]`);
    if (!opt) {
      const newOpt = document.createElement('option');
      newOpt.value = order.id;
      newOpt.text = `${order.projectName} - ${order.productName}`;
      orderSelect.add(newOpt);
    }
    orderSelect.value = order.id;
    // Trigger change event if needed? No, updateQrItemSelect reads value.
  } else {
  }

  updateQrItemSelect();

  // Select Item
  setTimeout(() => {
    let item = order.items?.find(i =>
      i.bomName.includes(bomName) || (i.partCode && i.partCode.includes(bomName))
    );

    if (!item && bomNameNorm) {
      item = order.items?.find(i =>
        normalize(i.bomName).includes(bomNameNorm) || (i.partCode && normalize(i.partCode).includes(bomNameNorm))
      );
    }

    if (item) {
      const itemSelect = document.getElementById('qr-item');
      if (itemSelect) {
        itemSelect.value = item.id;
      }
      updateQrProcessSelect();
      toast(`指示書と部材を選択しました`, 'success');
    } else {
      toast(`部材が見つかりません: ${bomName}`, 'warning');
    }
  }, 100);
}

function updateQrItemSelect() {
  const orderId = parseInt($('#qr-order').value);
  const itemSelect = $('#qr-item');
  const processContainer = $('#qr-process-buttons');
  const processHidden = $('#qr-process');

  if (!orderId) {
    itemSelect.innerHTML = '<option value="">先に指示書を選択</option>';
    itemSelect.disabled = true;
    if (processContainer) processContainer.innerHTML = '<p class="text-muted" style="width:100%;">先に部材を選択してください</p>';
    if (processHidden) processHidden.value = '';
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);

  if (order && order.items) {
    itemSelect.innerHTML = '<option value="">選択してください</option>' +
      order.items.map(i => `<option value="${i.id}">${i.bomName} (${i.partCode})</option>`).join('');
    itemSelect.disabled = false;
  }
}

function updateQrProcessSelect() {
  const orderId = parseInt($('#qr-order').value);
  const itemId = parseInt($('#qr-item').value);
  const processContainer = $('#qr-process-buttons');
  const processHidden = $('#qr-process');

  if (!processContainer) return;

  if (!orderId || !itemId) {
    processContainer.innerHTML = '<p class="text-muted" style="width:100%;">先に部材を選択してください</p>';
    if (processHidden) processHidden.value = '';
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);
  const item = order?.items?.find(i => i.id === itemId);

  if (!item || !item.processes || item.processes.length === 0) {
    processContainer.innerHTML = '<p class="text-muted" style="width:100%;">工程がありません</p>';
    if (processHidden) processHidden.value = '';
    return;
  }

  const completed = item.completed || [];

  // ボタンで工程を表示
  processContainer.innerHTML = item.processes.map(p => {
    const isCompleted = completed.includes(p);
    const cls = isCompleted ? 'process-btn completed' : 'process-btn';
    const label = isCompleted ? `✓ ${p}` : p;
    const disabled = isCompleted ? 'disabled' : '';
    return `<button type="button" class="${cls}" data-process="${p}" ${disabled} onclick="selectProcess(this, '${p.replace(/'/g, "\\\\'")}')">${label}</button>`;
  }).join('');

  if (processHidden) processHidden.value = '';

  // 未完了が1つだけなら自動選択
  const uncompleted = item.processes.filter(p => !completed.includes(p));
  if (uncompleted.length === 1) {
    const btn = processContainer.querySelector(`[data-process="${uncompleted[0]}"]`);
    if (btn) selectProcess(btn, uncompleted[0]);
  }
}

// 工程ボタン選択
function selectProcess(btn, processName) {
  // 1. UI Feedback (Instant)
  const container = btn.closest('.process-btn-grid');
  if (container) {
    container.querySelectorAll('.process-btn').forEach(b => b.classList.remove('selected'));
  }
  btn.classList.add('selected');
  // Add temporary processing state
  btn.style.opacity = '0.7';
  btn.innerText = '登録中...';

  // 2. Get Data
  const orderId = parseInt(document.getElementById('qr-order').value);
  const itemId = parseInt(document.getElementById('qr-item').value);

  if (!orderId || !itemId) {
    toast('指示書と部材が選択されていません', 'error');
    btn.style.opacity = '1';
    btn.innerText = processName;
    return;
  }

  // 3. Register (Async simulation)
  // registerProgress retrieves from DB and calls save. It is synchronous in this app (localStorage/Firebase shim).
  // But if Firebase is real, it might take time?
  // Current app.js registerProgress handles DB.

  const success = registerProgress(orderId, itemId, processName);

  if (success) {
    toast(`${processName} を完了として登録しました`, 'success');
    btn.classList.add('completed');
    btn.innerText = `✓ ${processName}`;
    btn.disabled = true;
    btn.style.opacity = '1';

    // Vibrate
    if (navigator.vibrate) try { navigator.vibrate(50); } catch (e) { }
  } else {
    toast('登録に失敗しました', 'error');
    btn.style.opacity = '1';
    btn.innerText = processName;
  }
}

function registerProgress(orderId, itemId, processName) {
  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);

  if (!order) return false;

  const item = order.items.find(i => i.id === itemId);
  if (!item) return false;

  if (!item.completed) item.completed = [];
  if (!item.completed.includes(processName)) {
    item.completed.push(processName);
  }

  DB.save(DB.KEYS.ORDERS, orders);

  // 履歴追加
  const history = DB.get(DB.KEYS.PROGRESS_HISTORY);
  history.unshift({
    orderId,
    itemId,
    bomName: item.bomName,
    processName,
    worker: currentUser.displayName,
    time: new Date().toLocaleTimeString('ja-JP')
  });
  DB.save(DB.KEYS.PROGRESS_HISTORY, history.slice(0, 100));

  return true;
}

// ========================================
// 不良品QRスキャン & フォーム連携
// ========================================

function startDefectQrScanner() {
  const placeholder = $('#defect-scanner-placeholder');
  const startBtn = $('#defect-start-scan-btn');
  const stopBtn = $('#defect-stop-scan-btn');
  const resultDiv = $('#defect-scan-result');

  if (defectQrScanner) {
    console.log('Defect QR Scanner is already running');
    return;
  }

  // 他のスキャナーを停止
  if (typeof stopQrScanner === 'function') stopQrScanner();
  if (typeof stopInvScanner === 'function') stopInvScanner();

  if (placeholder) placeholder.style.display = 'none';
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'inline-block';
  if (resultDiv) resultDiv.style.display = 'none';

  if (typeof Html5Qrcode === 'undefined') {
    toast('QRスキャナーが読み込めません。ページを再読み込みしてください。', 'error');
    return;
  }

  defectQrScanner = new Html5Qrcode('defect-scanner-preview');

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1
  };

  defectQrScanner.start(
    { facingMode: 'environment' },
    config,
    onDefectQrCodeScanned,
    (error) => { /* エラー無視 */ }
  ).catch(err => {
    console.error('カメラ起動エラー:', err);
    toast('カメラを起動できません。カメラの権限を許可してください。', 'error');
    stopDefectQrScanner();
  });
}

function stopDefectQrScanner() {
  const placeholder = $('#defect-scanner-placeholder');
  const startBtn = $('#defect-start-scan-btn');
  const stopBtn = $('#defect-stop-scan-btn');

  if (defectQrScanner) {
    defectQrScanner.stop().then(() => {
      defectQrScanner.clear();
      defectQrScanner = null;
    }).catch(err => console.log(err));
  }

  if (placeholder) placeholder.style.display = 'block';
  if (startBtn) startBtn.style.display = 'inline-block';
  if (stopBtn) stopBtn.style.display = 'none';
}

function onDefectQrCodeScanned(decodedText) {
  try {
    const safeSet = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    console.log('Defect QR Scanned:', decodedText);
    const debugMsg = decodedText.length > 20 ? decodedText.substring(0, 20) + '...' : decodedText;
    toast(`読取成功: ${debugMsg}`, 'success');

    stopDefectQrScanner();

    const resultDiv = document.getElementById('defect-scan-result');
    const dataDiv = document.getElementById('defect-scan-data');
    if (resultDiv) resultDiv.style.display = 'block';

    let projectName = '';
    let productName = '';
    let bomName = '';
    let parsed = false;

    // JSON パース
    try {
      const json = JSON.parse(decodedText);
      if (json.project || json.projectName) {
        projectName = (json.project || json.projectName || '').trim();
        productName = (json.product || json.productName || '').trim();
        bomName = (json.bom || json.bomName || json.item || '').trim();
        parsed = true;
      }
    } catch (e) { }

    // 区切り文字
    if (!parsed) {
      const parts = decodedText.split(/[|\t_]/);
      if (parts.length >= 3) {
        projectName = parts[0].trim();
        productName = parts[1].trim();
        bomName = parts[2].trim();
        parsed = true;
      } else {
        const commaParts = decodedText.split(',');
        if (commaParts.length >= 3) {
          projectName = commaParts[0].trim();
          productName = commaParts[1].trim();
          bomName = commaParts[2].trim();
          parsed = true;
        }
      }
    }

    if (!parsed) {
      const parts2 = decodedText.split(/[|,\t_]/);
      if (parts2.length === 2) {
        productName = parts2[0].trim();
        bomName = parts2[1].trim();
        parsed = true;
      }
    }

    if (!parsed) {
      const orders = DB.get(DB.KEYS.ORDERS) || [];
      const searchText = decodedText.trim();
      const matchOrder = orders.find(o =>
        o.orderNo === searchText ||
        o.projectName === searchText ||
        o.productName === searchText ||
        (o.items && o.items.some(i => i.bomName === searchText || i.partCode === searchText))
      );

      if (matchOrder) {
        projectName = matchOrder.projectName;
        productName = matchOrder.productName;
        const matchItem = matchOrder.items?.find(i => i.bomName === searchText || i.partCode === searchText);
        if (matchItem) bomName = matchItem.bomName;
        parsed = true;
      }
    }

    if (dataDiv) {
      if (parsed && (projectName || productName || bomName)) {
        dataDiv.innerHTML = `
          ${projectName ? `<div><strong>現場名:</strong> ${projectName}</div>` : ''}
          ${productName ? `<div><strong>品名:</strong> ${productName}</div>` : ''}
          ${bomName ? `<div><strong>部材:</strong> ${bomName}</div>` : ''}
        `;
        safeSet('defect-qr-project-name', projectName || '');
        safeSet('defect-qr-product-name', productName || '');
        safeSet('defect-qr-bom-name', bomName || '');
      } else {
        dataDiv.innerHTML = `<div>読取データ: ${decodedText}</div>`;
      }
    }

    if (parsed && (projectName || productName)) {
      selectFromDefectQrData(projectName, productName, bomName);
    } else {
      toast('データが見つかりませんでした (手動選択してください)', 'warning');
    }

    if (navigator.vibrate) {
      try { navigator.vibrate(100); } catch (e) { }
    }
  } catch (e) {
    console.error('Defect QR Scan Error:', e);
    toast('システムエラー: ' + e.message, 'error');
  }
}

function selectFromDefectQrData(projectName, productName, bomName) {
  const orders = DB.get(DB.KEYS.ORDERS) || [];
  const normalize = s => (s || '').trim().replace(/\s+/g, '').replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).toLowerCase();

  const pNameNorm = normalize(projectName);
  const prodNameNorm = normalize(productName);
  const bomNameNorm = normalize(bomName);

  let order = orders.find(o =>
    o.projectName.includes(projectName) && o.productName.includes(productName)
  );

  if (!order) {
    order = orders.find(o =>
      normalize(o.projectName).includes(pNameNorm) && normalize(o.productName).includes(prodNameNorm)
    );
  }

  if (!order) {
    toast(`該当する指示書が見つかりません (現場: ${projectName}, 品名: ${productName})`, 'warning');
    return;
  }

  const orderSelect = document.getElementById('defect-reg-order');
  if (orderSelect) {
    const opt = orderSelect.querySelector(`option[value="${order.id}"]`);
    if (!opt) {
      const newOpt = document.createElement('option');
      newOpt.value = order.id;
      newOpt.text = `${order.projectName} - ${order.productName}`;
      orderSelect.add(newOpt);
    }
    orderSelect.value = order.id;
  }

  updateDefectRegItemSelect();

  setTimeout(() => {
    let item = order.items?.find(i =>
      i.bomName.includes(bomName) || (i.partCode && i.partCode.includes(bomName))
    );

    if (!item && bomNameNorm) {
      item = order.items?.find(i =>
        normalize(i.bomName).includes(bomNameNorm) || (i.partCode && normalize(i.partCode).includes(bomNameNorm))
      );
    }

    if (item) {
      const itemSelect = document.getElementById('defect-reg-item');
      if (itemSelect) {
        itemSelect.value = item.id;
      }
      updateDefectRegProcessButtons();
      toast(`指示書と部材を選択しました`, 'success');
    } else {
      toast(`部材が見つかりません: ${bomName}`, 'warning');
    }
  }, 100);
}

function updateDefectRegOrderSelect() {
  const orders = DB.get(DB.KEYS.ORDERS) || [];
  const orderSelect = document.getElementById('defect-reg-order');
  if (!orderSelect) return;
  orderSelect.innerHTML = '<option value="">選択してください</option>' +
    orders.map(o => `<option value="${o.id}">${o.projectName} - ${o.productName}</option>`).join('');
}

function updateDefectRegItemSelect() {
  const orderId = parseInt($('#defect-reg-order').value);
  const itemSelect = $('#defect-reg-item');
  const processContainer = $('#defect-reg-process-buttons');
  const processHidden = $('#defect-reg-process');

  if (!orderId) {
    itemSelect.innerHTML = '<option value="">先に指示書を選択</option>';
    itemSelect.disabled = true;
    if (processContainer) processContainer.innerHTML = '<p class="text-muted" style="width:100%;">先に部材を選択してください</p>';
    if (processHidden) processHidden.value = '';
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);

  if (order && order.items) {
    itemSelect.innerHTML = '<option value="">選択してください</option>' +
      order.items.map(i => `<option value="${i.id}">${i.bomName} (${i.partCode})</option>`).join('');
    itemSelect.disabled = false;
  }
}

function updateDefectRegProcessButtons() {
  const orderId = parseInt($('#defect-reg-order').value);
  const itemId = parseInt($('#defect-reg-item').value);
  const processContainer = $('#defect-reg-process-buttons');
  const processHidden = $('#defect-reg-process');

  if (!processContainer) return;

  if (!orderId || !itemId) {
    processContainer.innerHTML = '<p class="text-muted" style="width:100%;">先に部材を選択してください</p>';
    if (processHidden) processHidden.value = '';
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);
  const item = order?.items?.find(i => i.id === itemId);

  if (!item || !item.processes || item.processes.length === 0) {
    processContainer.innerHTML = '<p class="text-muted" style="width:100%;">工程がありません</p>';
    if (processHidden) processHidden.value = '';
    return;
  }

  // 不良発生工程を選択するためのボタンを配置
  processContainer.innerHTML = item.processes.map(p => {
    return `<button type="button" class="process-btn" data-process="${p}" onclick="selectDefectProcess(this, '${p.replace(/'/g, "\\\\'")}')">${p}</button>`;
  }).join('');

  if (processHidden) processHidden.value = '';
}

function selectDefectProcess(btn, processName) {
  const container = btn.parentElement;
  container.querySelectorAll('.process-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const processHidden = $('#defect-reg-process');
  if (processHidden) processHidden.value = processName;
}

function onDefectReasonSelectChange() {
  const select = document.getElementById('defect-reg-reason-select');
  const textInput = document.getElementById('defect-reg-reason-text');
  if (!select || !textInput) return;
  if (select.value === 'その他') {
    textInput.style.display = 'block';
    textInput.required = true;
  } else {
    textInput.style.display = 'none';
    textInput.required = false;
  }
}

function submitDefectRegForm(event) {
  event.preventDefault();

  const orderId = parseInt($('#defect-reg-order').value);
  const itemId = parseInt($('#defect-reg-item').value);
  const processName = $('#defect-reg-process').value;
  const reasonSelect = $('#defect-reg-reason-select').value;
  const reasonText = $('#defect-reg-reason-text').value;
  const count = parseInt($('#defect-reg-count').value) || 1;

  if (!orderId || !itemId || !processName || !reasonSelect) {
    toast('必須項目を入力してください', 'warning');
    return;
  }

  const reason = reasonSelect === 'その他' ? reasonText : reasonSelect;
  if (reasonSelect === 'その他' && !reason) {
    toast('具体的な理由を入力してください', 'warning');
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);
  const item = order?.items?.find(i => i.id === itemId);

  if (!order || !item) {
    toast('該当する指示書または部材が見つかりません', 'error');
    return;
  }

  // 不良データを追加
  DB.add(DB.KEYS.DEFECTS, {
    id: DB.nextId(DB.KEYS.DEFECTS),
    orderId,
    itemId,
    projectName: order.projectName,
    productName: order.productName,
    bomName: item.bomName,
    processName,
    count,
    reason,
    reporter: currentUser ? currentUser.displayName : '作業員',
    reportedAt: new Date().toISOString(),
    status: 'pending' // pending = 未解決（再製作中）
  });

  // 不良発生工程を完了から未完了（completed配列から除外）に戻す
  if (Array.isArray(item.completed)) {
    item.completed = item.completed.filter(p => p !== processName);
  }

  DB.save(DB.KEYS.ORDERS, orders);

  toast('不良品を登録しました', 'success');

  // フォームのリセット
  document.getElementById('defect-reg-form').reset();
  $('#defect-reg-process').value = '';
  const processContainer = $('#defect-reg-process-buttons');
  if (processContainer) processContainer.innerHTML = '<p class="text-muted" style="width:100%;">先に部材を選択してください</p>';
  $('#defect-reg-item').disabled = true;
  $('#defect-reg-reason-text').style.display = 'none';

  // 自動転記フィールドもリセット
  const safeSet = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  safeSet('defect-qr-project-name', '');
  safeSet('defect-qr-product-name', '');
  safeSet('defect-qr-bom-name', '');
  
  const resultDiv = document.getElementById('defect-scan-result');
  if (resultDiv) resultDiv.style.display = 'none';

  // 画面の更新
  renderDefects();
  renderGantt();
}

// ========================================
// 不良品管理
// ========================================

function renderDefects() {
  const defects = DB.get(DB.KEYS.DEFECTS) || [];
  const tbody = $('#defects-body');

  if (!tbody) return;

  // スキャナーボタンのイベントを設定
  const startBtn = $('#defect-start-scan-btn');
  const stopBtn = $('#defect-stop-scan-btn');
  if (startBtn) startBtn.onclick = startDefectQrScanner;
  if (stopBtn) stopBtn.onclick = stopDefectQrScanner;

  // 指示書セレクトボックスの初期値設定
  updateDefectRegOrderSelect();

  if (defects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted p-4">不良品の記録がありません</td></tr>';
    return;
  }

  // 逆順で表示（新しいものが上）
  const displayList = [...defects].reverse();

  tbody.innerHTML = displayList.map(d => {
    const statusText = d.status === 'resolved' 
      ? '<span style="color:#22c55e; font-weight:600;">✓ 解決済</span>' 
      : '<span style="color:#ef4444; font-weight:600;">⚠ 再製作中</span>';

    // 解決（完了）ボタンの表示。解決済みなら表示しない
    const resolveBtn = d.status === 'resolved' 
      ? '' 
      : `<button class="btn btn-success btn-sm" onclick="resolveDefect('${d.id}')" style="margin-right: 4px;">解決</button>`;

    return `
      <tr>
        <td>${d.projectName}</td>
        <td>${d.productName}</td>
        <td>${d.bomName}</td>
        <td>${d.processName}</td>
        <td class="text-danger font-semibold">${d.count}</td>
        <td>${d.reason || '-'}</td>
        <td>${d.reporter}</td>
        <td>${statusText}</td>
        <td>
          ${resolveBtn}
          <button class="btn btn-sm btn-icon" onclick="editDefect('${d.id}')" title="編集" style="margin-right: 4px;">✎</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDefect('${d.id}')">削除</button>
        </td>
      </tr>
    `;
  }).join('');
}

function resolveDefect(id) {
  if (!confirm('この不良件を解決済みにしますか？\n（工程セルを再度「完了」にトグルすることでも自動解決されます）')) return;

  const defects = DB.get(DB.KEYS.DEFECTS) || [];
  const idx = defects.findIndex(d => String(d.id) === String(id));
  if (idx === -1) return;

  defects[idx].status = 'resolved';
  DB.save(DB.KEYS.DEFECTS, defects);

  toast('解決済みにしました', 'success');
  renderDefects();
  renderGantt();
}

function deleteDefect(id) {
  if (!confirm('この記録を削除しますか？')) return;

  const defects = DB.get(DB.KEYS.DEFECTS);
  const filtered = defects.filter(d => String(d.id) !== String(id));
  DB.save(DB.KEYS.DEFECTS, filtered);

  toast('削除しました', 'success');
  renderDefects();
  renderGantt();
}

function editDefect(id) {
  console.log('Edit defect clicked:', id);
  const defects = DB.get(DB.KEYS.DEFECTS);
  // 型変換して検索
  const target = defects.find(d => String(d.id) === String(id));

  if (!target) {
    console.error('Target defect not found:', id);
    return;
  }

  // 簡易的にpromptで数量修正だけ先に実装
  // const newCount = prompt('不良数を入力してください', target.count);
  // if (newCount === null) return;
  // const countVal = parseInt(newCount);
  // if (isNaN(countVal) || countVal < 1) {
  //   alert('正しい数値を入力してください');
  //   return;
  // }
  // target.count = countVal;
  // const newReason = prompt('理由を入力してください', target.reason);
  // if (newReason !== null) target.reason = newReason;
  // DB.save(DB.KEYS.DEFECTS, defects);
  // renderDefects();

  // やっぱりちゃんとしたUIにするために、動的モーダルを表示
  const modalHtml = `
    <div id="edit-defect-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:10000;">
      <div style="background:var(--color-bg-card); padding:2rem; border-radius:8px; width:90%; max-width:500px; box-shadow:var(--shadow-xl);">
        <h3 style="margin-bottom:1rem; color:var(--color-text-primary);">不良記録の編集</h3>
        <div class="form-group">
          <label>案件名: ${target.projectName}</label>
        </div>
        <div class="form-group">
          <label>部材名: ${target.productName}</label>
        </div>
        <div class="form-group">
          <label>不良数</label>
          <input type="number" id="edit-defect-count" class="form-input" value="${target.count}" min="1">
        </div>
        <div class="form-group">
          <label>理由</label>
          <input type="text" id="edit-defect-reason" class="form-input" value="${target.reason || ''}">
        </div>
        <div class="form-group">
          <label>報告者</label>
          <input type="text" id="edit-defect-reporter" class="form-input" value="${target.reporter || ''}">
        </div>
        <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:1.5rem;">
          <button class="btn btn-secondary" onclick="document.getElementById('edit-defect-modal').remove()">キャンセル</button>
          <button class="btn btn-primary" onclick="updateDefect(${target.id})">更新</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function updateDefect(id) {
  const countInput = document.getElementById('edit-defect-count');
  const reasonInput = document.getElementById('edit-defect-reason');
  const reporterInput = document.getElementById('edit-defect-reporter');

  if (!countInput || !reasonInput) return;

  const count = parseInt(countInput.value);
  if (isNaN(count) || count < 1) {
    alert('正しい数値を入力してください');
    return;
  }

  const defects = DB.get(DB.KEYS.DEFECTS);
  const idx = defects.findIndex(d => String(d.id) === String(id));
  if (idx === -1) return;

  defects[idx].count = count;
  defects[idx].reason = reasonInput.value;
  defects[idx].reporter = reporterInput.value;

  DB.save(DB.KEYS.DEFECTS, defects);

  document.getElementById('edit-defect-modal').remove();
  toast('不良記録を更新しました', 'success');
  renderDefects();
}

// ========================================
// 生産指示書
// ========================================

let showCompletedOrders = false;

function toggleShowCompleted() {
  showCompletedOrders = $('#show-completed-check').checked;
  renderOrders();
}

function renderOrders() {
  try {
    const allOrders = DB.get(DB.KEYS.ORDERS) || [];
    console.log('renderOrders: allOrders count =', allOrders.length);

    // デバッグ: 強制的に全件表示（フィルタ・ソート無効化）
    let orders = [...allOrders];

    // 完了分を非表示にするフィルタリング
    if (!showCompletedOrders) {
      orders = orders.filter(o => {
        const p = calculateProgress(o);
        // 進捗が100未満、または計算できない場合は表示
        return typeof p !== 'number' || p < 100;
      });
    }

    orders.sort((a, b) => {
      // 納期が設定されていないものは後ろへ
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
    });

    const tbody = $('#orders-body');
    if (!tbody) {
      console.error('#orders-body not found');
      return;
    }

    const completedCheck = $('#show-completed-check');
    if (completedCheck) completedCheck.checked = showCompletedOrders;

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted p-4">表示できる指示書がありません (全${allOrders.length}件)</td></tr>`;
      return;
    }

    // HTMLヘッダー列数調整 (9->10列: checkbox, No, Project, Product, Qty, Color, Start, Due, Progress, Actions)
    // ... ここではtbodyのみ

    tbody.innerHTML = orders.map(o => {
      // エラーハンドリング: 個別のオーダー描画でコケても他は出す
      try {
        if (!o) return ''; // Nullデータはスキップ

        const progress = calculateProgress(o);
        // getProgressClassが存在しない、またはエラーになる可能性を考慮
        let progressClass = 'bg-gray-200';
        try {
          if (typeof getProgressClass === 'function') {
            progressClass = getProgressClass(progress);
          }
        } catch (e) {
          console.warn('getProgressClass error', e);
        }

        // カテゴリ色判定
        let rowStyle = '';
        let category = '';

        if (typeof CATEGORY_COLORS !== 'undefined') {
          const boms = DB.get(DB.KEYS.BOM) || [];
          const productName = o.productName || '';
          const bom = boms.find(b => b && b.productName === productName);
          category = bom ? bom.category : '';

          const catColor = CATEGORY_COLORS[category];
          if (catColor) {
            // カテゴリ色がある場合: パステル背景＋濃い文字色で固定
            rowStyle = `background-color: ${catColor}; color: #1e293b;`;
          } else {
            // カテゴリ色がない場合: スタイルを指定せずCSS(ダークモード対応)に任せる
            rowStyle = '';
          }
        }

        const isLate = o.dueDate && new Date(o.dueDate) < new Date() && progress < 100;
        const dueDateStyle = isLate ? 'color: var(--color-danger); font-weight: bold;' : '';

        return `
          <tr id="order-row-${o.id}" style="${rowStyle}">
            <td><input type="checkbox" class="order-checkbox" value="${o.id}"></td>
            <td style="text-align: center;">
              <input type="checkbox" onchange="toggleOrderDistributed(${o.id}, this.checked)" ${o.isDistributed ? 'checked' : ''} style="transform: scale(1.3); cursor: pointer;" title="現場に配布済み">
            </td>
            <td>${o.orderNo || '-'}</td>
            <td>${o.projectName || '(名称なし)'}</td>
            <td>
                <div>${o.productName || '(品名なし)'}</div>
                ${category ? `<span style="font-size:0.7rem; background:rgba(255,255,255,0.7); padding:1px 4px; border-radius:3px; color:#333;">${category}</span>` : ''}
            </td>
            <td>${o.quantity || 0}</td>
            <td>${o.color || '-'}</td>
            <td>${o.startDate || '-'}</td>
            <td style="${dueDateStyle}">${o.dueDate || '-'}</td>
            <td>
              <div class="progress-cell">
                <div class="progress-bar">
                  <div class="progress-bar-fill ${progressClass}" style="width: ${progress}%"></div>
                </div>
                <span class="progress-text">${Math.round(progress)}%</span>
              </div>
            </td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="editOrder(${o.id})" style="border-color: currentColor;">編集</button>
              <button class="btn btn-sm btn-icon" onclick="copyOrder(${o.id})" title="複製">❐</button>
              <button class="btn btn-danger btn-sm" onclick="deleteOrder(${o.id})">削除</button>
            </td>
          </tr>
          `;
      } catch (e) {
        console.error('Error rendering order:', o, e);
        const errorId = o ? o.id : 'unknown';
        // エラー詳細を表示し、削除ボタンを提供する
        return `
          <tr style="background-color: #fee2e2;">
            <td><input type="checkbox" class="order-checkbox" value="${errorId}"></td>
            <td colspan="8" class="text-danger" style="font-size: 0.8rem;">
                <strong>描画エラー (ID: ${errorId})</strong><br>
                ${e.message || '不明なエラー'}
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteOrder(${errorId})">強制削除</button>
            </td>
          </tr>`;
      }
    }).join('');
  } catch (e) {
    console.error('Fatal error in renderOrders:', e);
    toast('一覧描画エラー: ' + e.message, 'error');
  }
}

// 配布状態の切り替え
function toggleOrderDistributed(id, isDistributed) {
  const orders = DB.get(DB.KEYS.ORDERS) || [];
  const index = orders.findIndex(o => o.id === id);
  if (index !== -1) {
    orders[index].isDistributed = isDistributed;
    DB.set(DB.KEYS.ORDERS, orders);
    toast(isDistributed ? '配布済みにしました' : '未配布に戻しました', 'success');
  }
}

// 個別複製
function copyOrder(id) {
  const orders = DB.get(DB.KEYS.ORDERS);
  const target = orders.find(o => o.id === id);
  if (!target) return;

  if (!confirm(`「${target.projectName}」を複製しますか？`)) return;

  const newOrder = JSON.parse(JSON.stringify(target));
  newOrder.id = DB.nextId(DB.KEYS.ORDERS);
  newOrder.orderNo = (newOrder.orderNo || '') + '-copy';
  newOrder.projectName = newOrder.projectName + ' (コピー)';
  newOrder.startDate = formatDate(new Date()); // 今日を開始日に

  // 完了状態をリセット
  if (newOrder.items) {
    newOrder.items.forEach(item => {
      item.completed = [];
    });
  }

  orders.push(newOrder);
  DB.save(DB.KEYS.ORDERS, orders);
  toast('指示書を複製しました', 'success');
  renderOrders();
}

// 一括複製
function copySelectedOrders() {
  const checkboxes = document.querySelectorAll('.order-checkbox:checked');
  if (checkboxes.length === 0) {
    toast('複製する指示書を選択してください', 'warning');
    return;
  }

  if (!confirm(`選択した${checkboxes.length}件を複製しますか？`)) return;

  const orders = DB.get(DB.KEYS.ORDERS);
  const newOrders = [];

  checkboxes.forEach(cb => {
    const id = parseInt(cb.value);
    const target = orders.find(o => o.id === id);
    if (target) {
      const newOrder = JSON.parse(JSON.stringify(target));
      newOrder.id = DB.nextId(DB.KEYS.ORDERS) + newOrders.length;
      newOrder.orderNo = (newOrder.orderNo || '') + '-cp';
      newOrder.projectName = newOrder.projectName + ' (コピー)';
      newOrder.startDate = formatDate(new Date());

      if (newOrder.items) {
        newOrder.items.forEach(item => {
          item.completed = [];
        });
      }
      newOrders.push(newOrder);
    }
  });

  const updatedOrders = [...orders, ...newOrders];
  DB.save(DB.KEYS.ORDERS, updatedOrders);
  toast(`${newOrders.length}件複製しました`, 'success');
  renderOrders();
}

// 一括削除
function deleteSelectedOrders() {
  const checkboxes = document.querySelectorAll('.order-checkbox:checked');
  if (checkboxes.length === 0) {
    toast('削除する指示書を選択してください', 'warning');
    return;
  }

  if (!confirm(`選択した${checkboxes.length}件を削除しますか？\nこの操作は取り消せません。\n（完了済みのデータも含めて削除されます）`)) return;

  const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value));
  const orders = DB.get(DB.KEYS.ORDERS);
  const filtered = orders.filter(o => !idsToDelete.includes(o.id));

  DB.save(DB.KEYS.ORDERS, filtered);
  toast(`${idsToDelete.length}件削除しました`, 'success');
  renderOrders();
}

function deleteOrder(id) {
  if (!confirm('この指示書を削除しますか？')) return;

  const orders = DB.get(DB.KEYS.ORDERS);
  const filtered = orders.filter(o => o.id !== id);
  DB.save(DB.KEYS.ORDERS, filtered);

  toast('指示書を削除しました', 'success');
  renderOrders();
}

// ========================================
// BOM管理
// ========================================

function renderBom() {
  const boms = DB.get(DB.KEYS.BOM);
  const container = $('#bom-list');
  const searchInput = $('#bom-search-input');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (boms.length === 0) {
    container.innerHTML = '<div class="card p-4 text-center text-muted">BOMが登録されていません</div>';
    return;
  }

  // 検索クエリでフィルタリング
  let filteredBoms = boms;
  if (query) {
    filteredBoms = boms.filter(b => 
      (b.productName && b.productName.toLowerCase().includes(query)) ||
      (b.partCode && b.partCode.toLowerCase().includes(query)) ||
      (b.bomName && b.bomName.toLowerCase().includes(query)) ||
      (b.category && b.category.toLowerCase().includes(query))
    );
  }

  if (filteredBoms.length === 0) {
    container.innerHTML = '<div class="card p-4 text-center text-muted">該当するBOMはありません</div>';
    return;
  }

  // 製品別にグループ化
  const grouped = filteredBoms.reduce((acc, bom) => {
    if (!acc[bom.productName]) acc[bom.productName] = [];
    acc[bom.productName].push(bom);
    return acc;
  }, {});

  container.innerHTML = Object.entries(grouped).map(([productName, items]) => `
    <div class="card" style="margin-bottom: 1rem;">
      <div class="card-header">
        <h3>${productName}</h3>
        <span class="badge badge-info">${items.length}件</span>
      </div>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" onchange="toggleBomChecks(this, '${productName}')"></th>
              <th>BOM名</th>
              <th>部材CD</th>
              <th>工程数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(b => `
              <tr>
                <td><input type="checkbox" class="bom-check" value="${b.id}" data-model="${productName}" onchange="updateBomDeleteBtn()"></td>
                <td>${b.bomName}</td>
                <td><code style="background: var(--color-bg-secondary); padding: 0.125rem 0.375rem; border-radius: 4px;">${b.partCode}</code></td>
                <td>${b.processes?.length || 0}工程</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="showEditBomModal(${b.id})" style="margin-right: 0.25rem;">編集</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteBom(${b.id})">削除</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function deleteBom(id) {
  if (!confirm('このBOMを削除しますか？')) return;

  const boms = DB.get(DB.KEYS.BOM);
  const filtered = boms.filter(b => b.id !== id);
  DB.save(DB.KEYS.BOM, filtered);

  toast('BOMを削除しました', 'success');
  renderBom();
}

function exportBomsToCsv() {
  const boms = DB.get(DB.KEYS.BOM);
  if (boms.length === 0) {
    toast('出力するBOMデータがありません', 'warning');
    return;
  }

  // ヘッダー
  let csvContent = 'id,productName,category,bomName,partCode,processes,processTimes,note\n';

  boms.forEach(b => {
    const processes = (b.processes || []).join('|'); // パイプ区切りで工程を結合
    const processTimesObj = b.processTimes || {};
    const processTimes = (b.processes || []).map(p => {
      const time = processTimesObj[p] || 0;
      return `${p}:${time}`;
    }).join('|');
    const note = (b.note || '').replace(/"/g, '""'); // ダブルクォートエスケープ
    const row = [
      b.id,
      `"${b.productName || ''}"`,
      `"${b.category || ''}"`,
      `"${b.bomName || ''}"`,
      `"${b.partCode || ''}"`,
      `"${processes}"`,
      `"${processTimes}"`,
      `"${note}"`
    ].join(',');
    csvContent += row + '\n';
  });

  // BOM付与してダウンロード (UTF-8)
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `bom_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importBomsFromCsv(input) {
  const file = input.files[0];
  if (!file) return;

  const tryRead = (encoding) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ text: e.target.result, encoding });
      reader.readAsText(file, encoding);
    });
  };

  tryRead('UTF-8').then(({ text }) => {
    const hasReplacementChar = text.includes('\uFFFD');
    let lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');

    if (lines.length < 2) {
      if (hasReplacementChar) {
        tryRead('Shift_JIS').then(result => processBomCsv(result.text, input));
        return;
      }
      toast('データが含まれていません', 'warning');
      input.value = '';
      return;
    }

    if (lines.length > 0 && lines[0].charCodeAt(0) === 0xFEFF) {
      lines[0] = lines[0].slice(1);
    }

    // ヘッダーチェック (簡易: id, productNameが含まれているか)
    const headerRow = lines[0].toLowerCase();
    const isValidHeader = headerRow.includes('id') && headerRow.includes('productname');

    if (!isValidHeader || hasReplacementChar) {
      tryRead('Shift_JIS').then(result => processBomCsv(result.text, input));
    } else {
      processBomCsv(text, input);
    }
  });

  function processBomCsv(text, input) {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    // 再度BOMケア
    if (lines.length > 0 && lines[0].charCodeAt(0) === 0xFEFF) {
      lines[0] = lines[0].slice(1);
    }

    const header = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''));
    // マッピング
    const colMap = {
      id: header.indexOf('id'),
      productName: header.indexOf('productname'), // または日本語ヘッダー対応 "品名"
      category: header.indexOf('category'),
      bomName: header.indexOf('bomname'),
      partCode: header.indexOf('partcode'),
      processes: header.indexOf('processes'),
      processTimes: header.indexOf('processtimes'),
      note: header.indexOf('note')
    };

    // 日本語ヘッダー対応のフォールバック
    if (colMap.productName === -1) colMap.productName = header.indexOf('品名');
    if (colMap.category === -1) colMap.category = header.indexOf('カテゴリ');
    if (colMap.bomName === -1) colMap.bomName = header.indexOf('bom名');
    if (colMap.partCode === -1) colMap.partCode = header.indexOf('部材cd');
    if (colMap.processes === -1) colMap.processes = header.indexOf('工程');
    if (colMap.processTimes === -1) colMap.processTimes = header.indexOf('processtime');
    if (colMap.processTimes === -1) colMap.processTimes = header.indexOf('工程時間');
    if (colMap.processTimes === -1) colMap.processTimes = header.indexOf('時間(分)');
    if (colMap.note === -1) colMap.note = header.indexOf('備考');


    if (colMap.productName === -1 || colMap.bomName === -1) {
      toast('CSVヘッダーに必要な列（productName/品名, bomName/BOM名）が見つかりません', 'error');
      input.value = '';
      return;
    }

    const currentBoms = DB.get(DB.KEYS.BOM);
    let nextId = DB.nextId(DB.KEYS.BOM);
    let updatedCount = 0;
    let createdCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

      if (cols.length < 3) continue;

      const idVal = parseInt(cols[colMap.id]);
      const productName = cols[colMap.productName];
      const category = colMap.category !== -1 ? cols[colMap.category] : '';
      const bomName = cols[colMap.bomName];
      const partCode = colMap.partCode !== -1 ? cols[colMap.partCode] : '';
      const processesRaw = colMap.processes !== -1 ? cols[colMap.processes] : '';
      const processTimesRaw = colMap.processTimes !== -1 ? cols[colMap.processTimes] : '';
      const note = colMap.note !== -1 ? cols[colMap.note] : '';

      if (!productName || !bomName) continue;

      const rawProcesses = processesRaw ? processesRaw.split('|').map(p => p.trim()).filter(Boolean) : [];
      const processTimes = {};

      rawProcesses.forEach(p => {
        processTimes[p] = 0;
      });

      if (processTimesRaw) {
        processTimesRaw.split('|').forEach(item => {
          const parts = item.split(':');
          if (parts.length >= 2) {
            const pName = parts[0].trim();
            const pTime = parseInt(parts[1]) || 0;
            processTimes[pName] = pTime;
          }
        });
      }

      const cleanedProcesses = [];
      rawProcesses.forEach(p => {
        let cleanName = p;
        let timeVal = 0;

        if (p.includes(':')) {
          const parts = p.split(':');
          cleanName = parts[0].trim();
          timeVal = parseInt(parts[1]) || 0;
        } else if (p.includes('(') && p.endsWith(')')) {
          const start = p.indexOf('(');
          cleanName = p.substring(0, start).trim();
          timeVal = parseInt(p.substring(start + 1, p.length - 1)) || 0;
        }

        cleanedProcesses.push(cleanName);

        if (processTimes[p] !== undefined && processTimes[p] !== 0) {
          processTimes[cleanName] = processTimes[p];
          if (p !== cleanName) delete processTimes[p];
        } else if (processTimes[cleanName] !== undefined && processTimes[cleanName] !== 0) {
          // Keep existing parsed time
        } else {
          processTimes[cleanName] = timeVal;
        }
      });

      // 重複チェック (ID または 品名+BOM名)
      let existingIdx = -1;

      if (!isNaN(idVal) && idVal > 0) {
        existingIdx = currentBoms.findIndex(b => b.id === idVal);
      }

      // IDで見つからなければ複合キーで探す
      if (existingIdx === -1) {
        existingIdx = currentBoms.findIndex(b => b.productName === productName && b.bomName === bomName);
      }

      const newBomData = {
        productName, category, bomName, partCode, processes: cleanedProcesses, processTimes, note
      };

      if (existingIdx !== -1) {
        // 更新
        currentBoms[existingIdx] = { ...currentBoms[existingIdx], ...newBomData };
        updatedCount++;
      } else {
        // 新規
        currentBoms.push({ id: nextId++, ...newBomData });
        createdCount++;
      }
    }

    DB.save(DB.KEYS.BOM, currentBoms);
    toast(`BOMインポート完了: 新規${createdCount}件, 更新${updatedCount}件`, 'success');
    renderBom();
    input.value = '';
  }
}


// ========================================
// 賃率管理
// ========================================

function renderRates() {
  const rates = DB.get(DB.KEYS.RATES);
  const tbody = $('#rates-body');

  if (rates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted p-4">賃率が登録されていません</td></tr>';
    return;
  }

  tbody.innerHTML = rates.map(r => `
    <tr>
      <td><code style="background: var(--color-bg-secondary); padding: 0.125rem 0.375rem; border-radius: 4px;">${r.rateCode}</code></td>
      <td>${r.department}</td>
      <td>${r.section}</td>
      <td>${r.subsection || '-'}</td>
      <td class="text-right">${r.monthlyRate?.toLocaleString() || 0}</td>
      <td class="text-right">${r.dailyRate?.toLocaleString() || 0}</td>
      <td class="text-right">${r.hourlyRate?.toLocaleString() || 0}</td>
      <td class="text-right">${r.minuteRate?.toFixed(2) || 0}</td>
      <td class="text-right">${r.secondRate?.toFixed(2) || 0}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteRate(${r.id})">削除</button></td>
    </tr>
  `).join('');
}

function deleteRate(id) {
  if (!confirm('この賃率を削除しますか？')) return;

  const rates = DB.get(DB.KEYS.RATES);
  const filtered = rates.filter(r => r.id !== id);
  DB.save(DB.KEYS.RATES, filtered);

  toast('賃率を削除しました', 'success');
  renderRates();
}

// ========================================
// ユーザー管理
// ========================================

function renderUsers() {
  const users = DB.get(DB.KEYS.USERS);
  const tbody = $('#users-body');

  tbody.innerHTML = users.map(u => `
    <tr>
      <td><code style="background: var(--color-bg-secondary); padding: 0.125rem 0.375rem; border-radius: 4px;">${u.username}</code></td>
      <td>${u.displayName}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}">${u.role === 'admin' ? '管理者' : '作業者'}</span></td>
      <td>${u.department || '-'}</td>
      <td>
        ${u.username !== 'admin' ? `
          <button class="btn btn-primary btn-sm" onclick="showEditUserModal(${u.id})" style="margin-right: 4px;">編集</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">削除</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function deleteUser(id) {
  if (!confirm('このユーザーを削除しますか？')) return;

  DB.delete(DB.KEYS.USERS, id);

  toast('ユーザーを削除しました', 'success');
  renderUsers();
}

// ========================================
// モーダル
// ========================================

function showModal(title, bodyHtml, footerHtml) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-footer').innerHTML = footerHtml;
  $('#modal-overlay').classList.remove('hidden');
}

function hideModal() {
  $('#modal-overlay').classList.add('hidden');
}

// ========================================
// 各種モーダル表示
// ========================================

// ========================================
// 各種モーダル表示
// ========================================

function showAddOrderModal() {
  const boms = DB.get(DB.KEYS.BOM);
  const products = [...new Set(boms.map(b => String(b.productName || '')))].sort();

  // 備考欄のデフォルトラベル
  const defaultNoteLabels = ['採光部', '丁番色', '備考3', '備考4', '備考5', '備考6', '備考7', '備考8', '備考9', '備考10'];
  const notesFields = [];
  for (let i = 1; i <= 10; i++) {
    notesFields.push(`
      <div class="form-group" style="margin-bottom: 0.5rem;">
        <div class="note-row">
          <input type="text" id="order-note-label-${i}" class="form-input" value="${defaultNoteLabels[i - 1]}" placeholder="ラベル" style="font-size: 0.75rem;">
          <input type="text" id="order-note-value-${i}" class="form-input" placeholder="内容を入力" style="font-size: 0.75rem;">
        </div>
      </div>
    `);
  }

  const body = `
    <div class="modal-body-scrollable">
      <div class="form-group">
        <label>特注No.</label>
        <input type="text" id="order-no" class="form-input" placeholder="例: TK-2026-001">
      </div>
      <div class="form-group">
        <label>物件名 *</label>
        <input type="text" id="order-project" class="form-input" required>
      </div>
      <div class="form-group">
        <label>品名 *</label>
        <select id="order-product" class="form-input" required onchange="updateNewOrderBoms(this.value)">
          <option value="">品名を選択してください</option>
          ${products.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
      </div>

      <!-- BOM選択エリア -->
      <div class="form-group" style="background: var(--color-bg-secondary); padding: 0.75rem; border-radius: 4px; border: 1px solid var(--color-border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
          <label style="font-weight:bold; color:var(--color-primary); margin:0;">
            部材選択（除外対応）
          </label>
          <span id="bom-selection-counter" style="font-size: 0.75rem; color: var(--color-text-muted);">選択中: -</span>
        </div>
        <div id="order-bom-list" style="display:block; max-height: 150px; overflow-y: auto; padding-left: 0.5rem; border-left: 2px solid var(--color-primary);">
          <div class="text-muted" style="font-size: 0.75rem;">品名を選択するとBOM一覧が表示されます</div>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label>数量</label>
          <input type="number" id="order-qty" class="form-input" value="1" min="1">
        </div>
        <div class="form-group">
          <label>色 * (必須)</label>
          <input type="text" id="order-color" class="form-input" required placeholder="例: シルバー, SC">
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>着工日</label>
          <input type="date" id="order-start" class="form-input">
        </div>
        <div class="form-group">
          <label>納期</label>
          <input type="date" id="order-due" class="form-input">
        </div>
      </div>
      <div class="form-group" style="margin-top: 1rem;">
        <label style="margin-bottom: 0.5rem;">備考欄（ラベルはカスタマイズ可能）</label>
        <div class="notes-container">
          ${notesFields.join('')}
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="submitNewOrder()">作成</button>
  `;

  showModal('新規生産指示書', body, footer);
}



// 実況カウンター更新
function updateBomSelectionCounter() {
  const modalBody = document.querySelector('#modal-body');
  if (!modalBody) return;

  const all = modalBody.querySelectorAll('.new-order-bom-check').length;
  const checked = modalBody.querySelectorAll('.new-order-bom-check:checked').length;
  const el = document.getElementById('bom-selection-counter');
  if (el) {
    el.textContent = `選択中: ${checked} / ${all}`;
    if (checked < all) {
      el.style.color = '#ef4444'; // Red if partial
      el.style.fontWeight = 'bold';
    } else {
      el.style.color = 'var(--color-text-muted)';
    }
  }
}

// 品名選択時のBOMリスト更新
function updateNewOrderBoms(productName) {
  const container = document.getElementById('order-bom-list');
  if (!container) return;

  if (!productName) {
    container.innerHTML = '<div class="text-muted" style="font-size: 0.75rem;">品名を選択するとBOM一覧が表示されます</div>';
    updateBomSelectionCounter();
    return;
  }

  const boms = DB.get(DB.KEYS.BOM);
  const productBoms = boms.filter(b => String(b.productName || '') === productName);

  if (productBoms.length === 0) {
    container.innerHTML = '<div class="text-danger" style="font-size: 0.75rem;">該当するBOMがありません</div>';
    updateBomSelectionCounter();
    return;
  }

  container.innerHTML = productBoms.map((b, idx) => `
    <div style="margin-bottom: 0.25rem;">
      <label style="display:flex; align-items:center; font-size: 0.875rem; cursor:pointer;" onclick="setTimeout(updateBomSelectionCounter, 0)">
        <input type="checkbox" class="new-order-bom-check" value="${b.id}" checked style="margin-right: 0.5rem;" onchange="updateBomSelectionCounter()">
        ${b.bomName} (${b.partCode})
      </label>
    </div>
  `).join('');

  updateBomSelectionCounter();
}

function submitNewOrder() {
  const orderNo = $('#order-no').value;
  const projectName = $('#order-project').value.trim();
  const productName = $('#order-product').value;
  const quantity = parseInt($('#order-qty').value) || 1;
  const color = $('#order-color').value; // Color取得
  const startDate = $('#order-start').value;
  const dueDate = $('#order-due').value;

  if (!projectName || !productName) {
    toast('物件名と品名は必須です', 'warning');
    return;
  }

  if (!color) {
    toast('「色」は必須項目です', 'warning');
    return;
  }

  // 備考欄取得
  const notes = [];
  for (let i = 1; i <= 10; i++) {
    const labelEl = $(`#order-note-label-${i}`);
    const valueEl = $(`#order-note-value-${i}`);
    if (labelEl && valueEl) {
      notes.push({ label: labelEl.value || `備考${i}`, value: valueEl.value || '' });
    }
  }
  // BOM取得
  const boms = DB.get(DB.KEYS.BOM);
  let productBoms = boms.filter(b => String(b.productName || '') === productName);

  // フィルタリング実行
  // モーダル内のチェックボックスのみを対象にする
  const modalBody = document.querySelector('#modal-body');
  if (!modalBody) {
    toast('システムエラー: モーダルが見つかりません', 'error');
    return;
  }

  const allBomCheckboxes = Array.from(modalBody.querySelectorAll('.new-order-bom-check'));

  // 安全策: チェックボックスの数と、論理上のBOM数が一致するか確認
  if (productBoms.length !== allBomCheckboxes.length) {
    console.warn('BOM count mismatch', productBoms.length, allBomCheckboxes.length);
    // 万が一不一致の場合は、従来のIDベース（ただしID重複時は全選択されるリスクあり）あるいは警告を出す
    // ここでは、ユーザーの混乱を避けるため、「チェックされている数」を正として、配列のindexで照合する
    // 不一致時は「全部表示」の安全側に倒すか、IDで頑張るか
    // 今回はアラートを出して中断する（データの整合性問題）
    toast(`システム警告: 画面上の部材数(${allBomCheckboxes.length})とマスターデータ(${productBoms.length})が一致しません。画面を更新してください。`, 'error');
    return;
  }

  // INDEXベースでのフィルタリング（ID重複対策）
  // 画面に表示されている順序 = productBomsの順序 であることを前提とする
  const selectedIndices = [];
  allBomCheckboxes.forEach((cb, index) => {
    if (cb.checked) {
      selectedIndices.push(index);
    }
  });

  // checkされているindexのみを抽出
  productBoms = productBoms.filter((_, index) => selectedIndices.includes(index));

  // デバッグ用（本番では消して良いが、確認のため残す）
  // console.log('Selected Indices:', selectedIndices);

  if (productBoms.length === 0 && allBomCheckboxes.length > 0) {
    if (!confirm('部材が1つも選択されていません（チェックボックスを確認してください）。\n部材なしで作成しますか？')) {
      return;
    }
  } else if (productBoms.length === 0 && allBomCheckboxes.length === 0) {
    if (!confirm(`警告: 「${productName}」のBOMが見つかりません。部材なしで作成しますか？`)) return;
  } else {
    // 最終確認ダイアログ
    const itemNames = productBoms.map(b => `・${b.bomName}`).join('\n');
    const unselectedCount = allBomCheckboxes.length - productBoms.length;

    let msg = `以下の${productBoms.length}件の部材で指示書を作成します。（除外: ${unselectedCount}件）\n\n${itemNames}`;
    if (unselectedCount === 0) {
      msg = `全${productBoms.length}件の部材（フルセット）で指示書を作成します。よろしいですか？\n\n${itemNames}`;
    }

    if (!confirm(msg)) return;

    // 成功通知
    toast(`${productBoms.length}件の部材で登録しました`, 'success');
  }

  const items = productBoms.map((bom, idx) => {
    let parsedProcesses = Array.isArray(bom.processes) ? bom.processes : [];
    if (parsedProcesses.length === 0) {
      parsedProcesses = ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', 'エッヂバンダー', 'TOYO', 'HOMAG', '仕上・梱包'];
    }
    return {
      id: idx + 1,
      bomName: bom.bomName,
      partCode: bom.partCode,
      processes: parsedProcesses,
      completed: []
    };
  });

  // 【デバッグ用】実際に保存されるアイテム数を表示
  // alert(`【デバッグ】保存されるアイテム数: ${items.length}件`);

  DB.add(DB.KEYS.ORDERS, {
    id: DB.nextId(DB.KEYS.ORDERS),
    orderNo,
    projectName,
    productName,
    quantity,
    color,
    startDate,
    dueDate,
    notes,
    items
  });

  toast('生産指示書を作成しました', 'success');
  hideModal();
  renderOrders();
  if (typeof renderGantt === 'function') renderGantt();
}

// ========================================
// QR出力
// ========================================

function printQrCodes() {
  const checkboxes = document.querySelectorAll('.order-checkbox:checked');
  if (checkboxes.length === 0) {
    toast('QRコードを出力する指示書を選択してください', 'warning');
    return;
  }

  const idsToPrint = Array.from(checkboxes).map(cb => parseInt(cb.value));
  const orders = DB.get(DB.KEYS.ORDERS).filter(o => idsToPrint.includes(o.id));

  let qrDataList = [];
  orders.forEach(order => {
    if (order.items) {
      order.items.forEach(item => {
        // 工程ごとはやめて部材ごとに1つにする
        const qrText = JSON.stringify({
          project: order.projectName,
          product: order.productName,
          bom: item.bomName
        });
        qrDataList.push({
          orderNo: order.orderNo || '',
          projectName: order.projectName,
          productName: order.productName,
          bomName: item.bomName,
          text: qrText
        });
      });
    }
  });

  if (qrDataList.length === 0) {
    toast('出力するデータがありません', 'warning');
    return;
  }

  // 別ウィンドウでのスクリプト実行エラーを防ぐため、親ウィンドウで画像データ(Base64)化する
  toast('QRコードを生成中...', 'info');

  // qrcode-generatorで日本語(UTF-8)を正しく処理するための設定
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }

  for (let data of qrDataList) {
    try {
      // qrcode-generator ライブラリ使用（typeNumber=0で自動バージョン選択、最大2953バイト対応）
      const qr = qrcode(0, 'L');
      qr.addData(data.text);
      qr.make();
      data.dataUrl = qr.createDataURL(4, 0);
    } catch (e) {
      console.error('QR生成エラー:', e, 'Data:', data.text);
      toast(`QRコードの生成に失敗しました: ${e.message || e}`, 'danger');
      return;
    }
  }


  let printArea = document.getElementById('print-area');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'print-area';
    document.body.appendChild(printArea);
  }

  let html = `
    <style>
      #print-area { display: none; }
      @media print {
        body > *:not(#print-area) { display: none !important; }
        #print-area { display: block !important; }
        @page { size: A4; margin: 10mm; }
        .grid { 
          display: grid !important; 
          grid-template-columns: repeat(3, 1fr) !important; 
          gap: 15px !important; 
          padding: 10px !important;
        }
        .qr-card { 
          border: 1px solid #000 !important; 
          padding: 12px !important; 
          text-align: center !important; 
          border-radius: 4px !important; 
          page-break-inside: avoid !important; 
          box-sizing: border-box !important;
          background: #fff !important;
        }
        .qr-card h4 { 
          margin: 0 0 8px 0 !important; 
          font-size: 13px !important; 
          color: #000 !important; 
          border-bottom: 1px solid #ccc !important; 
          padding-bottom: 4px !important; 
          white-space: nowrap !important; 
          overflow: hidden !important; 
          text-overflow: ellipsis !important; 
        }
        .qr-card p { 
          margin: 4px 0 !important; 
          font-size: 11px !important; 
          color: #333 !important; 
          text-align: left !important; 
          font-weight: bold !important;
        }
        .qr-code { 
          margin-top: 10px !important; 
          display: flex !important; 
          justify-content: center !important; 
        }
        .qr-code img { 
          width: 90px !important; 
          height: 90px !important; 
          display: block !important; 
        }
      }
    </style>
    <div class="grid">
  `;

  qrDataList.forEach(data => {
    html += `
      <div class="qr-card">
        <h4>${data.projectName}</h4>
        <p><strong>品名:</strong> ${data.productName}</p>
        <p><strong>部材:</strong> ${data.bomName}</p>
        <div class="qr-code">
          ${data.dataUrl ? `<img src="${data.dataUrl}" alt="QR Code">` : '<span style="color:red; font-size:10px;">QR生成失敗</span>'}
        </div>
      </div>
    `;
  });

  html += `
      </div>
  `;

  printArea.innerHTML = html;

  // 画像のDOM反映を待ってから印刷ダイアログを呼び出す（真っ白になるのを防ぐ）
  setTimeout(() => {
    window.print();
  }, 500);
}

// ========================================
// CSV一括登録 & 一括削除
// ========================================

function downloadCsvTemplate() {
  const csvContent = '特注No.,物件名,品名,数量,色,着工日,納期,備考1,備考2,備考3\n' +
    'TK-001,A邸,PAO1012BL,1,シルバー,2024-02-01,2024-02-10,急ぎ,,\n' +
    'TK-002,Bビル,DRB-2020,10,ブラック,2024-02-05,2024-02-20,,分納,';

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'production_orders_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportOrdersToCsv() {
  const orders = DB.get(DB.KEYS.ORDERS);
  if (orders.length === 0) {
    toast('出力するデータがありません', 'warning');
    return;
  }

  // ヘッダー
  let csvContent = 'id,orderNo,projectName,productName,quantity,color,startDate,dueDate,progress,status,isDistributed,note1,note2,note3,note4,note5\n';

  orders.forEach(o => {
    // 備考の展開 (最大5個まで出力してみる)
    const notes = o.notes || [];
    const n1 = notes[0] ? notes[0].value : '';
    const n2 = notes[1] ? notes[1].value : '';
    const n3 = notes[2] ? notes[2].value : '';
    const n4 = notes[3] ? notes[3].value : '';
    const n5 = notes[4] ? notes[4].value : '';

    const progress = calculateProgress(o);
    const status = progress === 100 ? '完了' : (progress > 0 ? '進行中' : '未着手');

    // CSVエスケープ処理 (" -> "")
    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    csvContent += [
      o.id,
      o.orderNo,
      o.projectName,
      o.productName,
      o.quantity,
      o.color,
      o.startDate,
      o.dueDate,
      progress,
      status,
      o.isDistributed ? '配布済' : '',
      n1, n2, n3, n4, n5
    ].map(escape).join(',') + '\n';
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  link.setAttribute('href', url);
  link.setAttribute('download', `production_orders_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast('CSVを出力しました', 'success');
}

// インポートエラー表示用モーダル
function showImportErrorModal(errors) {
  const errorText = errors.map(e => `【${e.row}行目】${e.reason}`).join('\n');
  const csvContent = errors.map(e => e.rawData).join('\n');

  const body = `
    <div style="margin-bottom: 1rem;">
      <p class="text-danger" style="font-weight: bold; margin-bottom: 0.5rem;">以下のデータは取り込めませんでした（${errors.length}件）</p>
      <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 1rem;">マスタ未登録の製品が含まれている可能性があります。コピーまたはダウンロードして修正してください。</p>
      
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; justify-content: flex-end;">
        <button class="btn btn-sm btn-secondary" onclick="copyErrorText()">📋 エラー内容をコピー</button>
        <button class="btn btn-sm btn-secondary" onclick="downloadErrorCsv()">📥 エラー分をCSVダウンロード</button>
      </div>

      <textarea id="import-error-text" class="form-input" style="height: 200px; font-family: monospace; font-size: 0.8rem;" readonly>${errorText}</textarea>
      
      <!-- 隠しデータ保持用 -->
      <textarea id="import-error-csv" style="display: none;">${csvContent}</textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">閉じる</button>
  `;

  showModal('インポート結果（エラーあり）', body, footer);
}

function copyErrorText() {
  const text = document.getElementById('import-error-text');
  if (text) {
    text.select();
    document.execCommand('copy');
    toast('クリップボードにコピーしました', 'success');
  }
}

function downloadErrorCsv() {
  const rawData = document.getElementById('import-error-csv').value;
  if (!rawData) return;

  // ヘッダーを追加（標準フォーマット）
  const header = 'あ,物件名,品名,数量,色,着工日,納期,備考1,備考2,備考3'; // 簡易ヘッダー
  // 実際には元のCSVヘッダーがあればそれがベストだが、ここでは簡易的に付与

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, header + '\n' + rawData], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `import_errors_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}



// CSV読み込み (エンコーディング自動判別)
function importOrdersFromCsv(input) {
  const file = input.files[0];
  if (!file) return;

  const tryRead = (encoding) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ text: e.target.result, encoding });
      reader.readAsText(file, encoding);
    });
  };

  // まずUTF-8で試行
  tryRead('UTF-8').then(({ text, encoding }) => {
    // 文字化け判定:  (U+FFFD) が含まれている場合、またはヘッダーが期待通りでない場合はShift_JISとみなす
    // Excelで保存したShift_JISファイルは、UTF-8で読むと置換文字()が含まれる可能性が高い
    const hasReplacementChar = text.includes('\uFFFD');

    let lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      if (hasReplacementChar) {
        // データなしに見えるが文字化けのせいかもしれない
        tryRead('Shift_JIS').then(result => processCsv(result.text, input));
        return;
      }
      toast('データが含まれていません', 'warning');
      input.value = '';
      return;
    }

    // BOM削除 (UTF-8の場合)
    if (lines.length > 0 && lines[0].charCodeAt(0) === 0xFEFF) {
      lines[0] = lines[0].slice(1);
    }

    // ヘッダーチェック
    let firstCell = lines[0].split(',')[0].trim().replace(/^"|"$/g, '').toLowerCase();
    const expectedHeaders = ['id', 'orderno', '特注no.', '特注no'];

    // ヘッダーキーワード確認
    const isValidHeader = expectedHeaders.some(h => firstCell.includes(h));

    // 判定ロジック強化: ヘッダー不一致 OR データ中に文字化け()がある場合 -> Shift_JISで再試行
    if (!isValidHeader || hasReplacementChar) {
      // console.log('Encoding mismatch detected (Header invalid or Replacement char found). Retrying as Shift_JIS...');
      tryRead('Shift_JIS').then(result => processCsv(result.text, input));
    } else {
      processCsv(text, input);
    }
  });

  function processCsv(text, input) {
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');

    // 再度BOMケア
    if (lines.length > 0 && lines[0].charCodeAt(0) === 0xFEFF) {
      lines[0] = lines[0].slice(1);
    }

    // ヘッダー判定
    const headerCols = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/^"|"$/g, ''));
    let colMap = {
      orderNo: 0,
      projectName: 1,
      productName: 2,
      quantity: 3,
      color: 4,
      startDate: 5,
      dueDate: 6,
      notesStart: 7
    };

    // エクスポート形式判定 (先頭が 'id')
    if (headerCols[0] === 'id') {
      colMap = {
        orderNo: 1,
        projectName: 2,
        productName: 3,
        quantity: 4,
        color: 5,
        startDate: 6,
        dueDate: 7,
        notesStart: headerCols.includes('isdistributed') ? 11 : 10 // 配布列がある場合は11から
      };
    }

    const boms = DB.get(DB.KEYS.BOM);
    const validProductNames = [...new Set(boms.map(b => String(b.productName || '')))];
    const existingOrders = DB.get(DB.KEYS.ORDERS);

    let errors = [];
    let processedList = []; // { type: 'create'|'update', data: obj }

    // 1行ずつ解析
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

      // 簡易的な列数チェック
      if (cols.length < 5) continue;

      const orderNo = cols[colMap.orderNo];
      const projectName = cols[colMap.projectName];
      const productName = cols[colMap.productName];
      const quantity = parseInt(cols[colMap.quantity]) || 1;
      const color = cols[colMap.color];
      const startDate = cols[colMap.startDate];
      const dueDate = cols[colMap.dueDate];

      const notes = [];
      for (let j = 0; j < 10; j++) {
        const val = cols[colMap.notesStart + j];
        if (val) notes.push({ label: `備考${j + 1}`, value: val });
      }

      // 必須＆マスタチェック
      if (!orderNo || !productName) continue;
      if (!validProductNames.includes(productName)) {
        errors.push({ row: i + 1, reason: `製品名「${productName}」未登録`, rawData: line });
        continue;
      }

      // --- 差分チェック & リスト作成処理 (既存ロジック) ---
      const newOrderData = {
        orderNo, projectName, productName, quantity, color, startDate, dueDate, notes
      };

      const existingIndex = existingOrders.findIndex(o => o.orderNo === orderNo);
      if (existingIndex !== -1) {
        const existing = existingOrders[existingIndex];
        let hasDiff = false;

        if (existing.projectName !== projectName) hasDiff = true;
        if (existing.productName !== productName) hasDiff = true;
        if (existing.quantity !== quantity) hasDiff = true;
        if (existing.color !== color) hasDiff = true; // color undefined対策はDB読み込み時になされている前提
        if ((existing.startDate || '') !== (startDate || '')) hasDiff = true; // 日付の空文字・Null対策
        if ((existing.dueDate || '') !== (dueDate || '')) hasDiff = true;

        const exNotes = existing.notes || [];
        if (exNotes.length !== notes.length) hasDiff = true;
        else {
          notes.forEach((n, idx) => {
            if (!exNotes[idx] || exNotes[idx].value !== n.value) hasDiff = true;
          });
        }

        if (hasDiff) {
          const updateData = { ...newOrderData, id: existing.id, items: existing.items };
          if (existing.productName !== productName) {
            const productBoms = boms.filter(b => b.productName === productName);
            updateData.items = productBoms.map((bom, idx) => ({
              id: idx + 1, bomName: bom.bomName, partCode: bom.partCode, processes: bom.processes || [], completed: []
            }));
          }
          processedList.push({ type: 'update', data: updateData });
        }
      } else {
        const productBoms = boms.filter(b => b.productName === productName);
        const items = productBoms.map((bom, idx) => ({
          id: idx + 1, bomName: bom.bomName, partCode: bom.partCode, processes: bom.processes || [], completed: []
        }));
        processedList.push({ type: 'create', data: { ...newOrderData, items } });
      }
    }

    // 結果適用
    if (errors.length > 0) showImportErrorModal(errors);

    if (processedList.length === 0 && errors.length === 0) {
      toast('取込データなし（変更なし）', 'info');
      input.value = '';
      return;
    }

    // 確認ダイアログ
    const updateCount = processedList.filter(a => a.type === 'update').length;
    const createCount = processedList.filter(a => a.type === 'create').length;

    if (updateCount > 0) {
      if (!confirm(`${updateCount}件の既存データが更新され、${createCount}件が新規登録されます。\n実行してもよろしいですか？\n（更新対象: ID重複または特注No重複）`)) {
        toast('インポートをキャンセルしました', 'info');
        input.value = '';
        return;
      }
    }

    let updatedCount = 0;
    let createdCount = 0;
    let nextId = DB.nextId(DB.KEYS.ORDERS);

    processedList.forEach(action => {
      if (action.type === 'update') {
        const idx = existingOrders.findIndex(o => o.id === action.data.id);
        if (idx !== -1) {
          existingOrders[idx] = action.data;
          updatedCount++;
        }
      } else {
        const order = action.data;
        order.id = nextId++;
        existingOrders.push(order);
        createdCount++;
      }
    });

    if (updatedCount > 0 || createdCount > 0) {
      DB.save(DB.KEYS.ORDERS, existingOrders);
      toast(`インポート完了: 新規${createdCount}, 更新${updatedCount}`, 'success');
      renderOrders();
      if (typeof renderGantt === 'function') renderGantt();
    }
    input.value = '';
  }
}

function deleteSelectedOrders() {
  const checkboxes = document.querySelectorAll('.order-checkbox:checked');
  if (checkboxes.length === 0) {
    toast('削除する項目を選択してください', 'warning');
    return;
  }

  if (!confirm(`選択された${checkboxes.length}件の指示書を削除しますか？\n進捗データも完全に削除されます。この操作は取り消せません。`)) {
    return;
  }

  const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value));
  let orders = DB.get(DB.KEYS.ORDERS);

  // 削除実行
  const initialLength = orders.length;
  orders = orders.filter(o => !idsToDelete.includes(o.id));

  if (orders.length === initialLength) {
    toast('削除に失敗しました', 'error');
    return;
  }

  DB.save(DB.KEYS.ORDERS, orders);

  // 進捗履歴も削除すべきだが、今回はオーダーのみ削除とする（整合性のためには本来削除すべき）
  // 簡易実装としてオーダー削除のみ

  toast(`${idsToDelete.length}件を削除しました`, 'success');
  renderOrders();
  if (typeof renderGantt === 'function') renderGantt();
}

function editOrder(id) {
  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === id);
  if (!order) return;

  const boms = DB.get(DB.KEYS.BOM);
  const products = [...new Set(boms.map(b => b.productName))].sort();

  // 備考欄
  const notesFields = [];
  const currentNotes = order.notes || [];
  const defaultNoteLabels = ['採光部', '丁番色', '備考3', '備考4', '備考5', '備考6', '備考7', '備考8', '備考9', '備考10'];

  for (let i = 1; i <= 10; i++) {
    const note = currentNotes[i - 1] || { label: defaultNoteLabels[i - 1], value: '' };
    notesFields.push(`
      <div class="form-group" style="margin-bottom: 0.5rem;">
        <div class="note-row">
          <input type="text" id="edit-note-label-${i}" class="form-input" value="${note.label || ''}" placeholder="ラベル" style="font-size: 0.75rem;">
          <input type="text" id="edit-note-value-${i}" class="form-input" value="${note.value || ''}" placeholder="内容を入力" style="font-size: 0.75rem;">
        </div>
      </div>
    `);
  }

  // 編集モードでのBOM選択は、品名変更時のみ有効にするのが安全だが、
  // UIの一貫性のため「品名を選択しなおす」場合にアラートを出す既存仕様を踏襲しつつ、
  // 項目構成は新規作成と合わせる。Colorを追加。
  const body = `
    <div class="modal-body-scrollable">
      <div class="form-group">
        <label>特注No.</label>
        <input type="text" id="edit-order-no" class="form-input" value="${order.orderNo || ''}">
      </div>
      <div class="form-group">
        <label>物件名 *</label>
        <input type="text" id="edit-order-project" class="form-input" value="${order.projectName}" required>
      </div>
      <div class="form-group">
        <label>品名 * <small style="color: var(--color-text-muted);">（変更すると部材がリセットされます）</small></label>
        <input type="text" id="edit-order-product" class="form-input" list="product-list" value="${order.productName}" required>
        <datalist id="product-list">
          ${products.map(p => `<option value="${p}">`).join('')}
        </datalist>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>数量 *</label>
          <input type="number" id="edit-order-quantity" class="form-input" value="${order.quantity}" min="1" required>
        </div>
        <div class="form-group">
          <label>色 *</label>
          <input type="text" id="edit-order-color" class="form-input" value="${order.color || ''}" required placeholder="例: シルバー">
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>着工日</label>
          <input type="date" id="edit-order-start" class="form-input" value="${order.startDate || ''}">
        </div>
        <div class="form-group">
          <label>納期</label>
          <input type="date" id="edit-order-due" class="form-input" value="${order.dueDate || ''}">
        </div>
      </div>
      
      <div class="form-group" style="margin-top: 1rem;">
        <label style="margin-bottom: 0.5rem;">備考欄</label>
        <div class="notes-container">
          ${notesFields.join('')}
        </div>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="updateOrder(${order.id})">更新</button>
  `;

  showModal('指示書を編集', body, footer);
}

function updateOrder(id) {
  const orderNo = $('#edit-order-no').value;
  const projectName = $('#edit-order-project').value;
  const productName = $('#edit-order-product').value;
  const quantity = parseInt($('#edit-order-quantity').value);
  const color = $('#edit-order-color').value; // Color追加
  const startDate = $('#edit-order-start').value;
  const dueDate = $('#edit-order-due').value;

  if (!projectName || !productName || !quantity) {
    toast('必須項目を入力してください', 'warning');
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const index = orders.findIndex(o => o.id === id);
  if (index === -1) return;

  const order = orders[index];
  const oldProductName = order.productName;

  // 備考の取得
  const notes = [];
  for (let i = 1; i <= 10; i++) {
    const label = $(`#edit-note-label-${i}`).value;
    const value = $(`#edit-note-value-${i}`).value;
    if (label || value) {
      notes.push({ label, value });
    } else {
      notes.push({ label: '', value: '' });
    }
  }

  // 更新
  order.orderNo = orderNo;
  order.projectName = projectName;
  order.quantity = quantity;
  order.color = color; // 保存
  order.startDate = startDate;
  order.dueDate = dueDate;
  order.notes = notes;

  // 品名の変更があればBOMを再取得
  if (oldProductName !== productName) {
    const boms = DB.get(DB.KEYS.BOM);
    const productBoms = boms.filter(b => b.productName === productName);

    if (productBoms.length > 0) {
      if (confirm('品名が変更されました。工程情報（進捗）をリセットしてBOMを再展開しますか？')) {
        order.productName = productName;
        order.items = productBoms.map((bom, idx) => ({
          id: idx + 1,
          bomName: bom.bomName,
          partCode: bom.partCode,
          processes: bom.processes || [],
          completed: []
        }));
        toast('品名変更に伴い工程情報を更新しました', 'info');
      } else {
        order.productName = productName;
      }
    } else {
      order.productName = productName;
      toast('新しい品名に対するBOMが見つかりません。工程情報は更新されませんでした。', 'warning');
    }
  }

  // atomic update
  DB.update(DB.KEYS.ORDERS, id, order);
  toast('指示書を更新しました', 'success');
  hideModal();
  renderOrders();
}

function showAddDefectModal() {
  const orders = DB.get(DB.KEYS.ORDERS);

  const body = `
    <div class="form-group">
      <label>指示書 *</label>
      <select id="defect-order" class="form-input" onchange="updateDefectItemSelect()" required>
        <option value="">選択してください</option>
        ${orders.map(o => `<option value="${o.id}">${o.projectName} - ${o.productName}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>部材 *</label>
      <select id="defect-item" class="form-input" disabled required>
        <option value="">先に指示書を選択</option>
      </select>
    </div>
    <div class="form-group">
      <label>工程 *</label>
      <input type="text" id="defect-process" class="form-input" placeholder="例: フラッシュ" required>
    </div>
    <div class="form-group">
      <label>不良数</label>
      <input type="number" id="defect-count" class="form-input" value="1" min="1">
    </div>
    <div class="form-group">
      <label>理由</label>
      <textarea id="defect-reason" class="form-input" rows="2" placeholder="キズ、寸法不良など"></textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="createDefect()">登録</button>
  `;

  showModal('不良品登録', body, footer);
}

function updateDefectItemSelect() {
  const orderId = parseInt($('#defect-order').value);
  const itemSelect = $('#defect-item');

  if (!orderId) {
    itemSelect.innerHTML = '<option value="">先に指示書を選択</option>';
    itemSelect.disabled = true;
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);

  if (order && order.items) {
    itemSelect.innerHTML = '<option value="">選択してください</option>' +
      order.items.map(i => `<option value="${i.id}" data-bom="${i.bomName}">${i.bomName}</option>`).join('');
    itemSelect.disabled = false;
  }
}

function createDefect() {
  const orderId = parseInt($('#defect-order').value);
  const itemId = parseInt($('#defect-item').value);
  const processName = $('#defect-process').value;
  const count = parseInt($('#defect-count').value) || 1;
  const reason = $('#defect-reason').value;

  if (!orderId || !itemId || !processName) {
    toast('必須項目を入力してください', 'warning');
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);
  const item = order?.items?.find(i => i.id === itemId);

  // atomic add
  DB.add(DB.KEYS.DEFECTS, {
    id: DB.nextId(DB.KEYS.DEFECTS),
    orderId,
    itemId,
    projectName: order.projectName,
    productName: order.productName,
    bomName: item.bomName,
    processName,
    count,
    reason,
    reporter: currentUser.displayName,
    reportedAt: new Date().toISOString()
  });

  toast('不良品を登録しました', 'success');
  hideModal();
  renderDefects();
}

// ========================================
// BOM管理 (一括処理対応)
// ========================================

function renderBom() {
  try {
    const list = document.getElementById('bom-list');
    if (!list) return;

    const boms = DB.get(DB.KEYS.BOM);
    const searchInput = document.getElementById('bom-search-input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    if (!Array.isArray(boms)) {
      console.warn('BOM data is not an array:', boms);
      list.innerHTML = '<p class="text-danger">データ形式エラー (リセット推奨)</p>';
      return;
    }

    if (boms.length === 0) {
      list.innerHTML = '<p class="text-muted">登録データがありません</p>';
      return;
    }

    // 検索クエリでフィルタリング
    let filteredBoms = boms;
    if (query) {
      filteredBoms = boms.filter(b => 
        (b.productName && b.productName.toLowerCase().includes(query)) ||
        (b.partCode && b.partCode.toLowerCase().includes(query)) ||
        (b.bomName && b.bomName.toLowerCase().includes(query)) ||
        (b.category && b.category.toLowerCase().includes(query))
      );
    }

    if (filteredBoms.length === 0) {
      list.innerHTML = '<p class="text-muted">該当するBOMはありません</p>';
      return;
    }

    // Debug: データ確認
    console.log('Rendering BOMs:', filteredBoms.length);

    // カテゴリごとにグループ化
    const grouped = {};
    filteredBoms.forEach(b => {
      if (!b) return;
      const cat = b.category || '未分類';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(b);
    });

    let html = '';
    Object.keys(grouped).sort().forEach(cat => {
      // 標準工程のヘッダー項目を生成
      const processHeaders = STANDARD_PROCESSES.map(p => {
        let shortName = p;
        if (p === '芯材カット') shortName = '芯材';
        else if (p === '面材カット') shortName = '面材';
        else if (p === 'フラッシュ') shortName = 'フラ';
        else if (p === 'ランニングソー') shortName = 'ラン';
        else if (p === 'エッヂバンダー') shortName = 'エッ';
        else if (p === '仕上・梱包') shortName = '仕上';
        else if (p === 'フロア加工') shortName = 'フロ';
        else if (p === 'アクリルBOX作成') shortName = 'アク';
        else if (p === '扉面材くり抜き') shortName = 'くり';
        
        return `<th style="font-size: 0.7rem; padding: 4px 2px; text-align: center; min-width: 38px; font-weight: 500;">${shortName}</th>`;
      }).join('');

      html += `
      <div style="margin-bottom: 2rem;">
        <h3 style="border-bottom: 2px solid var(--color-border); padding-bottom: 0.5rem; margin-bottom: 1rem; display:flex; align-items:center;">
          <input type="checkbox" class="bom-cat-check" onchange="toggleBomChecks(this, '${cat}')" style="margin-right:0.5rem;">
          ${cat}
        </h3>
        <div class="table-container" style="overflow-x: auto;">
          <table class="table" style="min-width: 100%; white-space: nowrap;">
            <thead>
              <tr>
                <th style="width: 40px; min-width: 40px;">選択</th>
                <th style="min-width: 120px;">製品名</th>
                <th style="min-width: 160px;">BOM名</th>
                <th style="min-width: 90px;">部材CD</th>
                ${processHeaders}
                <th style="min-width: 100px; text-align: center;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${grouped[cat].map(b => {
        const safeProcesses = Array.isArray(b.processes) ? b.processes : [];
        const processCells = STANDARD_PROCESSES.map(p => {
          const hasProcess = safeProcesses.includes(p);
          const bgStyle = hasProcess ? 'background-color: #fef08a; font-weight: bold; color: #854d0e;' : 'color: #cbd5e1;';
          const checkMark = hasProcess ? '✓' : '';
          return `<td style="${bgStyle} text-align: center; font-size: 0.75rem; padding: 4px;">${checkMark}</td>`;
        }).join('');

        return `
                <tr>
                  <td style="text-align:center;">
                    <input type="checkbox" class="bom-check" value="${b.id}" data-cat="${cat}">
                  </td>
                  <td>${b.productName || ''}</td>
                  <td>${b.bomName || ''}</td>
                  <td>${b.partCode || ''}</td>
                  ${processCells}
                  <td style="text-align: center;">
                    <button class="btn btn-sm btn-secondary" onclick="showEditBomModal(${b.id})" style="margin-right: 0.25rem; padding: 2px 6px; font-size: 0.75rem;">編集</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteBom(${b.id})" style="padding: 2px 6px; font-size: 0.75rem;">削除</button>
                  </td>
                </tr>
              `;
      }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    });

    list.innerHTML = html;
  } catch (e) {
    console.error('renderBom Error:', e);
    toast('BOM表示エラー: ' + e.message, 'error');
  }
}

// サンプルデータ復元（緊急用）
// サンプルデータ復元（BOM）
// サンプルデータ復元（指示書）
function restoreSampleOrders() {
  if (!confirm('現在の生産指示書データを全て削除し、サンプルの初期データに戻しますか？')) return;

  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const sampleOrders = [
    {
      id: 1,
      orderNo: 'ORD-001',
      projectName: 'A邸新築工事',
      productName: 'PAO1012BL',
      quantity: 4,
      color: 'シルバー',
      startDate: dateStr,
      dueDate: nextWeekStr,
      notes: [{ label: '備考1', value: '急ぎ' }],
      items: [
        { id: 1, bomName: '上枠', partCode: 'PAO-U100', processes: ['切断', '穴あけ'], completed: [] },
        { id: 2, bomName: '下枠', partCode: 'PAO-S100', processes: ['切断', '水抜き'], completed: [] },
        { id: 3, bomName: '縦枠', partCode: 'PAO-T100', processes: ['切断', '組立'], completed: [] }
      ]
    },
    {
      id: 2,
      orderNo: 'ORD-002',
      projectName: 'Bビル改修',
      productName: 'DRB-2020',
      quantity: 10,
      color: 'ブラック',
      startDate: dateStr,
      dueDate: nextWeekStr,
      notes: [],
      items: [
        { id: 1, bomName: '中骨', partCode: 'DRB-M20', processes: ['切断', '被覆'], completed: [] }
      ]
    }
  ];

  DB.save(DB.KEYS.ORDERS, sampleOrders);
  toast('生産指示書を初期データに戻しました', 'success');
  renderOrders();
  if (typeof renderGantt === 'function') renderGantt();
}

function restoreSampleBom() {
  if (!confirm('BOMデータを初期サンプルデータに戻しますか？\\n現在のデータは全て削除されます。')) return;


  const sampleBoms = [
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
  ];

  DB.save(DB.KEYS.BOM, sampleBoms);
  toast('サンプルデータを復元しました', 'success');
  renderBom();
}

function showAddBomModal() {
  const body = `
    <div style="margin-bottom: 1rem; padding: 1rem; background: var(--color-bg-secondary); border-radius: 4px;">
      <h4 style="margin-bottom: 0.5rem;">一括登録オプション</h4>
      <div style="display:flex; gap:1rem;">
        <button class="btn btn-sm btn-secondary" onclick="showBomPasteImport()">📋 Excelからコピペ登録</button>
        <button class="btn btn-sm btn-secondary" onclick="document.getElementById('bom-csv-upload').click()">📂 CSVインポート</button>
        <input type="file" id="bom-csv-upload" accept=".csv" style="display: none;" onchange="importBomsFromCsv(this)">
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div class="form-group">
        <label>カテゴリ</label>
        <input type="text" id="bom-category" class="form-input" placeholder="例: PAO">
      </div>
      <div class="form-group">
        <label>製品名 *</label>
        <input type="text" id="bom-product" class="form-input" required>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div class="form-group">
        <label>BOM名 *</label>
        <input type="text" id="bom-name" class="form-input" required>
      </div>
      <div class="form-group">
        <label>部材CD *</label>
        <input type="text" id="bom-code" class="form-input" required>
      </div>
    </div>
    <div class="form-group">
      <label>工程（カンマ区切り）</label>
      <input type="text" id="bom-processes" class="form-input" placeholder="例: 芯材カット,面材カット,芯組,フラッシュ" oninput="updateAddBomProcessTimes()">
    </div>
    <div class="form-group">
      <label>工程別の生産時間（分）</label>
      <div id="add-bom-process-times-container" style="max-height: 200px; overflow-y: auto; padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-bg-secondary);">
        <span class="text-muted" style="font-size: 0.875rem;">工程が設定されていません</span>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="createBom()">作成</button>
  `;

  showModal('新規BOM登録', body, footer);
}

window.updateAddBomProcessTimes = function() {
  const processesStr = $('#bom-processes').value;
  const container = $('#add-bom-process-times-container');
  if (!container) return;

  const processes = processesStr ? processesStr.split(/[,、，]/).map(p => p.trim()).filter(Boolean) : [];
  
  const tempTimes = {};
  document.querySelectorAll('.add-process-time').forEach(input => {
    tempTimes[input.dataset.process] = parseInt(input.value) || 0;
  });

  if (processes.length === 0) {
    container.innerHTML = '<span class="text-muted" style="font-size: 0.875rem;">工程が設定されていません</span>';
    return;
  }

  container.innerHTML = processes.map(p => {
    const time = tempTimes[p] || 0;
    return `
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
        <span style="width: 120px; font-size: 0.875rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${p}</span>
        <input type="number" class="form-input add-process-time" data-process="${p}" value="${time}" min="0" style="width: 80px; padding: 2px 6px;">
        <span style="font-size: 0.875rem;">分</span>
      </div>
    `;
  }).join('');
};

function createBom() {
  const category = $('#bom-category').value;
  const productName = $('#bom-product').value;
  const bomName = $('#bom-name').value;
  let partCode = $('#bom-code').value;
  const processesStr = $('#bom-processes').value;

  if (category && category.toUpperCase() === 'GRID' && !partCode) {
    partCode = productName;
  }

  if (!productName || !bomName || !partCode) {
    toast('製品名、BOM名、部材CDは必須です', 'warning');
    return;
  }

  const processes = processesStr ? processesStr.split(/[,、，]/).map(p => p.trim()).filter(Boolean) : [];

  if (processes.length === 0) {
    if (!confirm('工程が入力されていません。工程がない場合、工程管理画面等のグラフに「完・未」の表示枠が作成されませんが、このまま登録してよろしいですか？')) {
      return;
    }
  }

  const processTimes = {};
  document.querySelectorAll('.add-process-time').forEach(input => {
    const p = input.dataset.process;
    const t = parseInt(input.value) || 0;
    processTimes[p] = t;
  });

  const boms = DB.get(DB.KEYS.BOM);
  boms.push({
    id: DB.nextId(DB.KEYS.BOM),
    category,
    productName,
    bomName,
    partCode,
    processes,
    processTimes
  });
  DB.save(DB.KEYS.BOM, boms);

  toast('BOMを登録しました', 'success');
  hideModal();
  renderBom();
}

function showEditBomModal(id) {
  const boms = DB.get(DB.KEYS.BOM);
  const bom = boms.find(b => b.id === id);
  if (!bom) {
    toast('BOMが見つかりません', 'error');
    return;
  }

  const processes = bom.processes || [];
  const processTimes = bom.processTimes || {};

  const processRowsHtml = processes.map(p => {
    const time = processTimes[p] || 0;
    return `
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
        <span style="width: 120px; font-size: 0.875rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${p}</span>
        <input type="number" class="form-input edit-process-time" data-process="${p}" value="${time}" min="0" style="width: 80px; padding: 2px 6px;">
        <span style="font-size: 0.875rem;">分</span>
      </div>
    `;
  }).join('');

  const body = `
    <input type="hidden" id="edit-bom-id" value="${bom.id}">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div class="form-group">
        <label>カテゴリ</label>
        <input type="text" id="edit-bom-category" class="form-input" value="${bom.category || ''}">
      </div>
      <div class="form-group">
        <label>製品名 *</label>
        <input type="text" id="edit-bom-product" class="form-input" value="${bom.productName || ''}" required>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div class="form-group">
        <label>BOM名 *</label>
        <input type="text" id="edit-bom-name" class="form-input" value="${bom.bomName || ''}" required>
      </div>
      <div class="form-group">
        <label>部材CD *</label>
        <input type="text" id="edit-bom-code" class="form-input" value="${bom.partCode || ''}" required>
      </div>
    </div>
    <div class="form-group">
      <label>工程（カンマ区切り）</label>
      <input type="text" id="edit-bom-processes" class="form-input" value="${processes.join(',')}" placeholder="例: 芯材カット,面材カット,芯組" oninput="updateEditBomProcessTimes()">
    </div>
    <div class="form-group">
      <label>工程別の生産時間（分）</label>
      <div id="edit-bom-process-times-container" style="max-height: 200px; overflow-y: auto; padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-bg-secondary);">
        ${processRowsHtml || '<span class="text-muted" style="font-size: 0.875rem;">工程が設定されていません</span>'}
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="updateBom()">保存</button>
  `;

  showModal('BOMの編集', body, footer);
}

window.updateEditBomProcessTimes = function() {
  const processesStr = $('#edit-bom-processes').value;
  const container = $('#edit-bom-process-times-container');
  if (!container) return;

  const processes = processesStr ? processesStr.split(/[,、，]/).map(p => p.trim()).filter(Boolean) : [];
  
  const tempTimes = {};
  document.querySelectorAll('.edit-process-time').forEach(input => {
    tempTimes[input.dataset.process] = parseInt(input.value) || 0;
  });

  if (processes.length === 0) {
    container.innerHTML = '<span class="text-muted" style="font-size: 0.875rem;">工程が設定されていません</span>';
    return;
  }

  container.innerHTML = processes.map(p => {
    const time = tempTimes[p] || 0;
    return `
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
        <span style="width: 120px; font-size: 0.875rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${p}</span>
        <input type="number" class="form-input edit-process-time" data-process="${p}" value="${time}" min="0" style="width: 80px; padding: 2px 6px;">
        <span style="font-size: 0.875rem;">分</span>
      </div>
    `;
  }).join('');
};

function syncOrdersWithUpdatedBom(oldProductName, oldBomName, newProductName, newBomName, newPartCode) {
  const orders = DB.get(DB.KEYS.ORDERS) || [];
  let updated = false;

  orders.forEach(order => {
    if (order.productName === oldProductName) {
      if (newProductName && oldProductName !== newProductName) {
        order.productName = newProductName;
        updated = true;
      }
      if (order.items) {
        order.items.forEach(item => {
          if (item.bomName === oldBomName) {
            if (newBomName) item.bomName = newBomName;
            if (newPartCode) item.partCode = newPartCode;
            updated = true;
          }
        });
      }
    }
  });

  if (updated) {
    DB.save(DB.KEYS.ORDERS, orders);
    console.log(`Sync orders completed for Product: ${oldProductName}, BOM: ${oldBomName} -> New PartCode: ${newPartCode}`);
  }
}

function updateBom() {
  const id = parseInt($('#edit-bom-id').value);
  const category = $('#edit-bom-category').value;
  const productName = $('#edit-bom-product').value;
  const bomName = $('#edit-bom-name').value;
  let partCode = $('#edit-bom-code').value;
  const processesStr = $('#edit-bom-processes').value;

  if (category && category.toUpperCase() === 'GRID' && !partCode) {
    partCode = productName;
  }

  if (!productName || !bomName || !partCode) {
    toast('製品名、BOM名、部材CDは必須です', 'warning');
    return;
  }

  const processes = processesStr ? processesStr.split(/[,、，]/).map(p => p.trim()).filter(Boolean) : [];

  const processTimes = {};
  document.querySelectorAll('.edit-process-time').forEach(input => {
    const p = input.dataset.process;
    const t = parseInt(input.value) || 0;
    processTimes[p] = t;
  });

  const boms = DB.get(DB.KEYS.BOM);
  const idx = boms.findIndex(b => b.id === id);
  if (idx !== -1) {
    const oldBom = boms[idx];
    const newBom = {
      ...oldBom,
      category,
      productName,
      bomName,
      partCode,
      processes,
      processTimes
    };
    boms[idx] = newBom;
    DB.save(DB.KEYS.BOM, boms);
    
    // 既存指示書の部材CD同期
    syncOrdersWithUpdatedBom(oldBom.productName, oldBom.bomName, productName, bomName, partCode);

    toast('BOMを更新しました', 'success');
    hideModal();
    renderBom();
    if (typeof renderGantt === 'function') renderGantt();
  } else {
    toast('更新に失敗しました', 'error');
  }
}

// ========================================
// BOMインポート機能（復旧）
// ========================================

function showImportBomModal() {
  const body = `
    <div style="text-align: center; padding: 2rem;">
       <p style="margin-bottom: 1rem;">CSVファイルを選択してください</p>
       <input type="file" id="modal-csv-upload" accept=".csv" class="form-input">
       <div style="margin-top: 1rem; text-align: left; background: #f8fafc; padding: 1rem; border-radius: 4px; font-size: 0.85rem;">
         <strong>フォーマット:</strong><br>
         カテゴリ, 製品名, BOM名, 部材CD, (工程列...)<br>
         または<br>
         (ヘッダーあり: 大分類, 品名, BOM名, 部材CD, ...)
       </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="executeBomCsvImport()">インポート実行</button>
  `;
  showModal('BOM一括インポート', body, footer);
}

function executeBomCsvImport() {
  const fileInput = document.getElementById('modal-csv-upload');
  if (!fileInput || !fileInput.files[0]) {
    toast('ファイルを選択してください', 'warning');
    return;
  }
  importBomsFromCsv(fileInput);
}

function importBomsFromCsv(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const text = e.target.result;
    processBomCsv(text);
  };
  reader.readAsText(file, 'Shift_JIS'); // Excel CSV default
  input.value = ''; // Reset
}

// 共通BOM解析ロジック (CSV/TSV)
function parseBomText(text, separator) {
  const lines = text.split(/\r\n|\n/).filter(l => l.trim());
  const boms = [];
  const duplicates = [];

  if (lines.length === 0) return { boms: [], duplicates: [] };

  // ヘッダー解析
  let headers = lines[0].split(separator).map(c => c.replace(/^"|"$/g, '').trim());

  let processNames = [];
  let startIndex = 0;
  let hasPartCodeCol = true; // 部材CD列の有無

  // ヘッダー判定: 複数のエイリアスに対応
  const isHeader = (h) => {
    const candidates = ['カテゴリ', '大分類', '製品名', '品名', 'BOM名', 'BOM', '部材CD', '部材cd',
      '芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', 'エッヂバンダー',
      '仕上・梱包', 'TOYO', 'HOMAG', 'productname', 'bomname', 'partcode', 'category'];
    return candidates.some(c => h.toLowerCase().includes(c.toLowerCase()));
  };

  const headerMatch = headers.some(h => isHeader(h));

  if (headerMatch) {
    startIndex = 1;

    // 部材CD列があるか判定
    hasPartCodeCol = headers.some(h => h === '部材CD' || h === '部材cd' || h.toLowerCase() === 'partcode');
    const fixedCols = hasPartCodeCol ? 4 : 3; // 固定列数

    if (headers.length > fixedCols) {
      processNames = headers.slice(fixedCols).filter(h => h && h.length > 0);
    }
  } else {
    console.warn('No headers detected');
  }

  let lastCategory = '';
  let lastProductName = '';

  // 時間値またはフラグ判定 (例: "5分", "10", "○", "TRUE")
  const isTimeOrFlag = (val) => {
    const clean = (val || '').trim().toUpperCase();
    if (!clean) return false;
    return /^\d+(?:\.\d+)?分$/.test(clean) || 
           /^\d+(?:\.\d+)?$/.test(clean) || 
           ['○', 'TRUE', '1'].includes(clean);
  };

  const isPartCodeOmittableCategory = (cat) => {
    if (!cat) return false;
    const upper = cat.toUpperCase();
    return upper.includes('GRID') || 
           upper.includes('ロッカー') || 
           upper.includes('パーソナル') || 
           upper.includes('フリージョイント') || 
           upper.includes('LOCKER') || 
           upper.includes('JOINT');
  };

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(separator).map(c => c.replace(/^"|"$/g, '').trim());

    let category = cols[0] || lastCategory;
    let productName = cols[1] || lastProductName;
    let bomName = cols[2];
    let partCode = '';
    let processStartCol = hasPartCodeCol ? 4 : 3;

    if (hasPartCodeCol) {
      partCode = cols[3] || '';
      // GRID、パーソナルロッカー、フリージョイントロッカー等の特殊処理: 部材CD列に時間値が入っている場合、部材CD列は無いとみなす
      if (isPartCodeOmittableCategory(category) && isTimeOrFlag(partCode)) {
        processStartCol = 3;
        partCode = ''; // 後で設定
      }
    }

    // BOM名がない行はスキップ
    if (!bomName) continue;

    // 補完
    if (!partCode) {
      if (category && category.toUpperCase() === 'GRID') {
        partCode = productName; // GRIDルール: partCode = productName
      } else {
        partCode = bomName; // デフォルト: partCode = bomName
      }
    }

    // 継続値更新
    if (cols[0]) lastCategory = cols[0];
    if (cols[1]) lastProductName = cols[1];

    // 工程解析
    let processes = [];
    const processTimes = {};
    if (processNames.length > 0) {
      processNames.forEach((procName, idx) => {
        const val = cols[processStartCol + idx];
        // 空欄以外（1, TRUE, ○, 数字+分 など）なら採用
        if (val && !['0', 'FALSE', '-', ''].includes(String(val).toUpperCase().trim())) {
          processes.push(procName);

          // 時間のパース
          let minutes = 0;
          const cleanVal = String(val).trim();
          const match = cleanVal.match(/^(\d+(?:\.\d+)?)/);
          if (match) {
            minutes = parseInt(match[1]) || 0;
          }
          processTimes[procName] = minutes;
        }
      });
    }

    boms.push({
      category: category || lastCategory || '未分類',
      productName: productName || lastProductName || '名称未設定',
      bomName,
      partCode,
      processes,
      processTimes
    });
  }

  return { boms, duplicates };
}

function processBomCsv(text) {
  // ヘッダー行を解析して形式を自動判定
  const lines = text.split(/\r\n|\n/).filter(l => l.trim());
  if (lines.length < 2) {
    toast('データが含まれていません', 'warning');
    return;
  }

  // BOMケア
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].slice(1);
  }

  const headerRaw = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  const headerLower = headerRaw.map(h => h.toLowerCase());

  // エクスポート形式の判定: id,productName,category,bomName,partCode,processes,note
  const isExportFormat = headerLower.includes('id') &&
    (headerLower.includes('productname') || headerLower.includes('品名')) &&
    (headerLower.includes('processes') || headerLower.includes('工程'));

  if (isExportFormat) {
    // ========== エクスポート形式パーサー ==========
    const colMap = {};
    headerLower.forEach((h, idx) => {
      if (h === 'id') colMap.id = idx;
      else if (h === 'productname' || h === '品名' || h === '製品名') colMap.productName = idx;
      else if (h === 'category' || h === 'カテゴリ') colMap.category = idx;
      else if (h === 'bomname' || h === 'bom名') colMap.bomName = idx;
      else if (h === 'partcode' || h === '部材cd') colMap.partCode = idx;
      else if (h === 'processes' || h === '工程') colMap.processes = idx;
      else if (h === 'processtimes' || h === 'processtime' || h === '工程時間' || h === '時間(分)') colMap.processTimes = idx;
      else if (h === 'note' || h === '備考') colMap.note = idx;
    });

    if (colMap.productName === undefined || colMap.bomName === undefined) {
      toast('CSVヘッダーに必要な列（productName, bomName）が見つかりません', 'error');
      return;
    }

    const existingBoms = DB.get(DB.KEYS.BOM);
    let nextId = DB.nextId(DB.KEYS.BOM);
    let updatedCount = 0;
    let createdCount = 0;

    for (let i = 1; i < lines.length; i++) {
      // CSVパース（ダブルクォート内のカンマに対応）
      const cols = parseCSVLine(lines[i]);
      if (cols.length < 3) continue;

      const idVal = colMap.id !== undefined ? parseInt(cols[colMap.id]) : NaN;
      const productName = (cols[colMap.productName] || '').trim();
      const category = colMap.category !== undefined ? (cols[colMap.category] || '').trim() : '';
      const bomName = (cols[colMap.bomName] || '').trim();
      const partCode = colMap.partCode !== undefined ? (cols[colMap.partCode] || '').trim() : '';
      const processesRaw = colMap.processes !== undefined ? (cols[colMap.processes] || '').trim() : '';
      const processTimesRaw = colMap.processTimes !== undefined ? (cols[colMap.processTimes] || '').trim() : '';
      const note = colMap.note !== undefined ? (cols[colMap.note] || '').trim() : '';

      if (!productName || !bomName) continue;

      // パイプ区切りの工程を配列に変換
      const rawProcesses = processesRaw ? processesRaw.split('|').map(p => p.trim()).filter(Boolean) : [];
      const processTimes = {};

      rawProcesses.forEach(p => {
        processTimes[p] = 0;
      });

      if (processTimesRaw) {
        processTimesRaw.split('|').forEach(item => {
          const parts = item.split(':');
          if (parts.length >= 2) {
            const pName = parts[0].trim();
            const pTime = parseInt(parts[1]) || 0;
            processTimes[pName] = pTime;
          }
        });
      }

      const cleanedProcesses = [];
      rawProcesses.forEach(p => {
        let cleanName = p;
        let timeVal = 0;

        if (p.includes(':')) {
          const parts = p.split(':');
          cleanName = parts[0].trim();
          timeVal = parseInt(parts[1]) || 0;
        } else if (p.includes('(') && p.endsWith(')')) {
          const start = p.indexOf('(');
          cleanName = p.substring(0, start).trim();
          timeVal = parseInt(p.substring(start + 1, p.length - 1)) || 0;
        }

        cleanedProcesses.push(cleanName);

        if (processTimes[p] !== undefined && processTimes[p] !== 0) {
          processTimes[cleanName] = processTimes[p];
          if (p !== cleanName) delete processTimes[p];
        } else if (processTimes[cleanName] !== undefined && processTimes[cleanName] !== 0) {
          // Keep existing parsed time
        } else {
          processTimes[cleanName] = timeVal;
        }
      });

      // 重複チェック (ID → 品名+BOM名)
      let existingIdx = -1;
      if (!isNaN(idVal) && idVal > 0) {
        existingIdx = existingBoms.findIndex(b => b.id === idVal);
      }
      if (existingIdx === -1) {
        existingIdx = existingBoms.findIndex(b => b.productName === productName && b.bomName === bomName);
      }

      const newBomData = { productName, category, bomName, partCode, processes: cleanedProcesses, processTimes, note };

      if (existingIdx !== -1) {
        const oldBom = existingBoms[existingIdx];
        existingBoms[existingIdx] = { ...oldBom, ...newBomData };
        // エクスポート形式：既存指示書に部材CD変更を同期
        syncOrdersWithUpdatedBom(oldBom.productName, oldBom.bomName, productName, bomName, partCode);
        updatedCount++;
      } else {
        existingBoms.push({ id: nextId++, ...newBomData });
        createdCount++;
      }
    }

    DB.save(DB.KEYS.BOM, existingBoms);
    toast(`BOMインポート完了: 新規${createdCount}件, 更新${updatedCount}件`, 'success');
    hideModal();
    renderBom();
  } else {
    // ========== テンプレート形式 (カテゴリ,製品名,BOM名,部材CD,...工程) ==========
    const existingBoms = DB.get(DB.KEYS.BOM);
    const { boms: newBomsRaw } = parseBomText(text, ',');

    if (newBomsRaw.length === 0) {
      toast('有効なデータが見つかりませんでした', 'warning');
      return;
    }

    let currentId = DB.nextId(DB.KEYS.BOM);
    let updatedCount = 0;
    const newBoms = [];

    newBomsRaw.forEach(raw => {
      // 重複チェックを「品名とBOM名」で行い、存在すれば部材CD・工程等の情報を更新する
      const existingIdx = existingBoms.findIndex(e =>
        e.productName === raw.productName && e.bomName === raw.bomName
      );

      if (existingIdx !== -1) {
        const oldBom = existingBoms[existingIdx];
        existingBoms[existingIdx] = {
          ...oldBom,
          category: raw.category || oldBom.category,
          partCode: raw.partCode,
          processes: raw.processes,
          processTimes: raw.processTimes
        };
        // テンプレート形式：既存指示書に部材CD変更を同期
        syncOrdersWithUpdatedBom(oldBom.productName, oldBom.bomName, raw.productName, raw.bomName, raw.partCode);
        updatedCount++;
      } else {
        raw.id = currentId++;
        newBoms.push(raw);
      }
    });

    const updatedBoms = [...existingBoms, ...newBoms];
    DB.save(DB.KEYS.BOM, updatedBoms);
    toast(`インポート完了: 新規${newBoms.length}件, 更新${updatedCount}件`, 'success');
    hideModal();
    renderBom();
  }
}

// CSV行パーサー（ダブルクォート内のカンマに対応）
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// Paste Import
function showBomPasteImport() {
  const body = `
        <div class="form-group">
            <label>Excelからコピーしたデータを貼り付けてください</label>
            <p class="text-muted" style="font-size:0.8rem;">
              ※1行目にヘッダーを含めてください。<br>
              <strong>形式:</strong> 大分類 / 品名 / BOM / 部材CD / [工程1] / [工程2]...<br>
              ※工程列に値（5分, 1, ○ など）があれば、その工程を登録します。<br>
              ※GRID行は部材CD列なしでもOKです。
            </p>
            <textarea id="bom-paste-area" class="form-input" style="height: 200px; font-family: monospace;" placeholder="大分類\t品名\tBOM\t部材CD\t芯材カット\t面材カット..."></textarea>
            
            <div style="text-align:right; margin-top:0.5rem;">
               <button class="btn btn-sm btn-outline" onclick="downloadBomCsvTemplate()">📥 CSVテンプレート</button>
               <button class="btn btn-sm btn-outline" onclick="exportBomsToCsv()">📤 現在のBOMをCSV出力</button>
            </div>
        </div>
    `;
  const footer = `
        <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
        <button class="btn btn-danger" onclick="if(confirm('既存BOMを全て削除して貼り付けデータで置き換えますか？'))executeBomPasteReplace()">全置換</button>
        <button class="btn btn-primary" onclick="executeBomPasteImport()">追加インポート</button>
    `;
  showModal('BOMペースト登録', body, footer);
}

// 全置換ペーストインポート
function executeBomPasteReplace() {
  const text = document.getElementById('bom-paste-area').value;
  if (!text.trim()) { toast('データを貼り付けてください', 'warning'); return; }

  const { boms: newBomsRaw } = parseBomText(text, '\t');
  if (newBomsRaw.length === 0) {
    toast('データが解析できませんでした', 'warning');
    return;
  }

  let id = 1;
  newBomsRaw.forEach(b => { b.id = id++; });
  DB.save(DB.KEYS.BOM, newBomsRaw);
  toast(`${newBomsRaw.length}件のBOMで全置換しました`, 'success');
  hideModal();
  renderBom();
}

function executeBomPasteImport() {
  const text = document.getElementById('bom-paste-area').value;
  if (!text.trim()) return;

  const existingBoms = DB.get(DB.KEYS.BOM);
  const { boms: newBomsRaw } = parseBomText(text, '\t'); // TSV

  if (newBomsRaw.length === 0) {
    toast('データが解析できませんでした', 'warning');
    return;
  }

  let currentId = DB.nextId(DB.KEYS.BOM);
  let addedCount = 0;

  newBomsRaw.forEach(raw => {
    const exists = existingBoms.some(e =>
      e.bomName === raw.bomName && e.partCode === raw.partCode && e.productName === raw.productName
    );
    if (!exists) {
      raw.id = currentId++;
      existingBoms.push(raw);
      addedCount++;
    }
  });

  DB.save(DB.KEYS.BOM, existingBoms);
  toast(`${addedCount}件登録しました`, 'success');
  hideModal();
  renderBom();
}

// CSVテンプレートダウンロード
function downloadBomCsvTemplate() {
  const headers = ['カテゴリ', '製品名', 'BOM名', '部材CD', '芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', 'エッヂバンダー', '仕上・梱包', '〇〇加工'];
  const example1 = ['PAO', 'PAO1012BL', 'PaO1012BL(正面)', 'FR1012BL', '1', '1', '1', '1', '1', '1', '1', ''];
  const example2 = ['GRID', 'GR1212', 'GRID1212', 'GR1212', '', '', '', '', '', '', '', '1'];

  // Excelで文字化けしないよう BOM (0xEF, 0xBB, 0xBF) を付与
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  let csv = headers.join(',') + '\n';
  csv += example1.join(',') + '\n';
  csv += example2.join(',') + '\n';

  const blob = new Blob([bom, csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `BOM_import_template_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast('テンプレートをダウンロードしました', 'success');
}

// ========================================
// 賃率管理 (CSV対応)
// ========================================

function showAddRateModal() {
  const body = `
    <div style="margin-bottom: 1rem; padding: 1rem; background: var(--color-bg-secondary); border-radius: 4px;">
      <h4 style="margin-bottom: 0.5rem;">一括登録オプション</h4>
      <div style="display:flex; gap:1rem;">
        <button class="btn btn-sm btn-secondary" onclick="showRatePasteImport()">📋 Excelからコピペ登録</button>
        <button class="btn btn-sm btn-secondary" onclick="document.getElementById('rate-csv-upload').click()">📂 CSVインポート</button>
        <input type="file" id="rate-csv-upload" accept=".csv" style="display: none;" onchange="importRatesFromCsv(this)">
      </div>
    </div>
    <div class="form-group">
      <label>判定CD *</label>
      <input type="text" id="rate-code" class="form-input" required>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
      <div class="form-group">
        <label>部 *</label>
        <input type="text" id="rate-dept" class="form-input" required>
      </div>
      <div class="form-group">
        <label>課 *</label>
        <input type="text" id="rate-section" class="form-input" required>
      </div>
      <div class="form-group">
        <label>係</label>
        <input type="text" id="rate-subsection" class="form-input">
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div class="form-group">
        <label>月額(円)</label>
        <input type="number" id="rate-monthly" class="form-input" value="0">
      </div>
      <div class="form-group">
        <label>日額(円)</label>
        <input type="number" id="rate-daily" class="form-input" value="0">
      </div>
      <div class="form-group">
        <label>時給(円)</label>
        <input type="number" id="rate-hourly" class="form-input" value="0">
      </div>
      <div class="form-group">
        <label>分給(円)</label>
        <input type="number" id="rate-minute" class="form-input" step="0.1" value="0">
      </div>
      <div class="form-group">
        <label>秒給(円)</label>
        <input type="number" id="rate-second" class="form-input" step="0.01" value="0">
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="createRate()">作成</button>
  `;

  showModal('新規賃率作成', body, footer);
}

// 賃率CSVインポート
function importRatesFromCsv(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    processRateCsv(e.target.result);
  };
  reader.readAsText(file, 'Shift_JIS');
  input.value = '';
}

// 賃率ペーストインポート
function showRatePasteImport() {
  const body = `
        <div class="form-group">
            <label>Excelからコピーしたデータを貼り付けてください</label>
            <p class="text-muted" style="font-size:0.8rem;">
              フォーマット: 判定CD, 部, 課, 係, 月額, 日額, 時給, 分給
            </p>
            <textarea id="rate-paste-area" class="form-input" style="height: 200px; font-family: monospace;" placeholder="CD001	製造部	組立課	第一係	300000..."></textarea>
            
            <div style="text-align:right; margin-top:0.5rem;">
               <button class="btn btn-sm btn-outline" onclick="downloadRateCsvTemplate()">📥 CSVテンプレートをダウンロード</button>
            </div>
        </div>
    `;
  const footer = `
        <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
        <button class="btn btn-primary" onclick="executeRatePasteImport()">インポート</button>
    `;
  showModal('賃率ペースト登録', body, footer);
}

function processRateCsv(text, separator = ',') {
  const lines = text.split(/\r\n|\n/).filter(l => l.trim());
  const existingRates = DB.get(DB.KEYS.RATES);
  const newRates = [];
  let currentId = DB.nextId(DB.KEYS.RATES);
  let updatedCount = 0;

  // 区切り文字の自動判定 (引数優先だが、内容から推測)
  let char = separator;
  if (text.indexOf('\t') !== -1 && (text.indexOf(',') === -1 || separator === '\t')) {
    char = '\t';
  }

  // ヘッダー判定
  let startIdx = 0;
  // 1行目に「判定CD」や「部」が含まれていればヘッダーとみなす
  if (lines.length > 0 && (lines[0].includes('判定CD') || lines[0].includes('部'))) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(char).map(c => c.replace(/^"|"$/g, '').trim());

    // 最低限の列数チェック (CD, 部, 課)
    if (cols.length < 3) continue;

    const rateCode = cols[0];
    if (!rateCode) continue;

    const rateData = {
      id: currentId, // 仮ID
      rateCode: cols[0], // 表示用プロパティ名は rateCode
      department: cols[1],
      section: cols[2],
      subsection: cols[3] || '',
      monthlyRate: parseInt(cols[4]) || 0,
      dailyRate: parseInt(cols[5]) || 0,
      hourlyRate: parseInt(cols[6]) || 0,
      minuteRate: parseFloat(cols[7]) || 0
    };

    // 重複チェック（判定CDで上書き）
    const idx = existingRates.findIndex(r => r.rateCode === rateData.rateCode);
    if (idx !== -1) {
      // IDは既存を維持
      rateData.id = existingRates[idx].id;
      existingRates[idx] = rateData;
      updatedCount++;
    } else {
      rateData.id = currentId++;
      existingRates.push(rateData);
      newRates.push(rateData);
    }
  }

  if (newRates.length === 0 && updatedCount === 0) {
    toast('有効なデータが見つかりませんでした。フォーマットを確認してください。', 'warning');
    return;
  }

  DB.save(DB.KEYS.RATES, existingRates);
  toast(`${newRates.length}件追加、${updatedCount}件更新しました`, 'success');
  hideModal();

  // 画面更新
  if (typeof renderRates === 'function') {
    renderRates();
  } else {
    location.reload();
  }
}

function executeRatePasteImport() {
  const text = document.getElementById('rate-paste-area').value;
  if (!text.trim()) return;
  processRateCsv(text, '\t');
}

function downloadRateCsvTemplate() {
  const headers = ['判定CD', '部', '課', '係', '月額', '日額', '時給', '分給'];
  const example = ['CD001', '製造部', '組立課', '第一係', '300000', '15000', '1800', '30'];

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  let csv = headers.join(',') + '\n';
  csv += example.join(',') + '\n';

  const blob = new Blob([bom, csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Rate_template_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function createRate() {
  const rateCode = $('#rate-code').value;
  const department = $('#rate-dept').value;
  const section = $('#rate-section').value;
  const subsection = $('#rate-subsection').value;
  const monthlyRate = parseInt($('#rate-monthly').value) || 0;
  const dailyRate = parseInt($('#rate-daily').value) || 0;
  const hourlyRate = parseInt($('#rate-hourly').value) || 0;
  const minuteRate = parseFloat($('#rate-minute').value) || 0;
  const secondRate = parseFloat($('#rate-second').value) || 0;

  if (!rateCode || !department || !section) {
    toast('判定CD、部、課は必須です', 'warning');
    return;
  }

  const rates = DB.get(DB.KEYS.RATES);
  rates.push({
    id: DB.nextId(DB.KEYS.RATES),
    rateCode,
    department,
    section,
    subsection,
    monthlyRate,
    dailyRate,
    hourlyRate,
    minuteRate,
    secondRate
  });
  DB.save(DB.KEYS.RATES, rates);

  toast('賃率を作成しました', 'success');
  hideModal();
  renderRates();
}

function showImportRateModal() {
  const body = `
    <div style="margin-bottom: 1rem; color: var(--color-text-secondary); font-size: 0.875rem;">
      <p>スプレッドシートからコピー&ペーストで賃率をインポートできます。</p>
      <div style="margin: 0.5rem 0; padding: 0.5rem; background: var(--color-bg-secondary); border-radius: 4px;">
        <strong>形式A（9列 - 推奨）:</strong><br>
        判定CD | 部 | 課 | 係 | 月額 | 日額 | 時給 | 分給 | 秒給<br>
        <br>
        <strong>形式B（11列 - 旧形式）:</strong><br>
        [A列:名称] [ID] [C列:判定CD] [部] [課] [係] [G列:月給] [日給] [時給] [分給] [秒給]
      </div>
      <small>※ヘッダー行を含めてもOKです。自動判別します。</small>
    </div>
    <textarea id="import-rate-data" class="form-input" rows="10" placeholder="ここに貼り付けてください..."></textarea>
    <div style="margin-top: 0.5rem; text-align: right;">
      <button class="btn btn-sm btn-outline" onclick="exportRatesToClipboard()">📋 現在のデータをコピー（編集用）</button>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-danger" onclick="if(confirm('既存の賃率を全て削除して、貼り付けデータで置き換えますか？'))importRatesReplace()">全置換インポート</button>
    <button class="btn btn-primary" onclick="importRates()">追加/更新インポート</button>
  `;

  showModal('賃率一括インポート', body, footer);
}

// 賃率データをクリップボードにコピー（コピペ編集用）
function exportRatesToClipboard() {
  const rates = DB.get(DB.KEYS.RATES);
  if (rates.length === 0) {
    toast('賃率データがありません', 'warning');
    return;
  }

  const header = '判定CD\t部\t課\t係\t月額\t日額\t時給\t分給\t秒給';
  const rows = rates.map(r =>
    [r.rateCode, r.department, r.section, r.subsection || '',
    r.monthlyRate || 0, r.dailyRate || 0, r.hourlyRate || 0,
    r.minuteRate || 0, r.secondRate || 0].join('\t')
  );

  const text = [header, ...rows].join('\n');

  // テキストエリアにも表示
  const ta = document.getElementById('import-rate-data');
  if (ta) ta.value = text;

  // クリップボードにコピー
  navigator.clipboard.writeText(text).then(() => {
    toast('賃率データをクリップボードにコピーしました。編集後に貼り直して再インポートできます。', 'success');
  }).catch(() => {
    toast('テキストエリアに出力しました。手動でコピーしてください。', 'info');
  });
}

// 全置換インポート
function importRatesReplace() {
  const data = $('#import-rate-data').value.trim();
  if (!data) {
    toast('データを入力してください', 'warning');
    return;
  }

  const parsed = parseRateLines(data);
  if (parsed.length === 0) {
    toast('インポートできるデータがありませんでした', 'warning');
    return;
  }

  // 全置換
  let id = 1;
  parsed.forEach(r => { r.id = id++; });
  DB.save(DB.KEYS.RATES, parsed);
  renderRates();
  hideModal();
  toast(`${parsed.length}件の賃率を全置換しました`, 'success');
}

// 賃率行パーサー（9列 or 11列 自動判定）
function parseRateLines(data) {
  const lines = data.split('\n');
  const results = [];

  const parseVal = (val) => {
    if (!val) return 0;
    const numStr = val.toString().replace(/[¥,]/g, '').trim();
    const num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
  };

  const isHeader = (cols) => {
    const joined = cols.join(' ');
    return joined.includes('判定CD') || joined.includes('コード') ||
      joined.includes('労務費率') || joined.includes('月額') ||
      joined.includes('職種');
  };

  lines.forEach(line => {
    if (!line.trim()) return;
    const cols = line.split('\t');

    if (isHeader(cols)) return;

    let rateCode, department, section, subsection;
    let monthlyRate, dailyRate, hourlyRate, minuteRate, secondRate;

    if (cols.length >= 10) {
      // 11列形式: [名称][ID][CD][部][課][係][月][日][時][分][秒]
      rateCode = (cols[2] || '').trim();
      department = (cols[3] || '').trim();
      section = (cols[4] || '').trim();
      subsection = (cols[5] || '').trim();
      monthlyRate = parseVal(cols[6]);
      dailyRate = parseVal(cols[7]);
      hourlyRate = parseVal(cols[8]);
      minuteRate = parseVal(cols[9]);
      secondRate = parseVal(cols[10]);
    } else if (cols.length >= 5) {
      // 9列形式: [CD][部][課][係][月][日][時][分][秒]
      rateCode = (cols[0] || '').trim();
      department = (cols[1] || '').trim();
      section = (cols[2] || '').trim();
      subsection = (cols[3] || '').trim();
      monthlyRate = parseVal(cols[4]);
      dailyRate = parseVal(cols[5]);
      hourlyRate = parseVal(cols[6]);
      minuteRate = parseVal(cols[7]);
      secondRate = parseVal(cols[8]);
    } else {
      return; // skip
    }

    if (!rateCode) return;

    results.push({
      rateCode, department, section, subsection,
      monthlyRate, dailyRate, hourlyRate, minuteRate, secondRate
    });
  });

  return results;
}

function importRates() {
  const data = $('#import-rate-data').value.trim();
  if (!data) {
    toast('データを入力してください', 'warning');
    return;
  }

  const newRates = parseRateLines(data);

  if (newRates.length === 0) {
    toast('インポートできるデータがありませんでした。\n形式を確認してください（タブ区切り）', 'warning');
    return;
  }

  // 既存データとマージ
  const existingRates = DB.get(DB.KEYS.RATES);
  let addedCount = 0;
  let updatedCount = 0;

  newRates.forEach(rate => {
    const index = existingRates.findIndex(r => r.rateCode === rate.rateCode);
    if (index !== -1) {
      // 更新
      rate.id = existingRates[index].id;
      existingRates[index] = rate;
      updatedCount++;
    } else {
      // 新規
      rate.id = DB.nextId(DB.KEYS.RATES) + addedCount;
      existingRates.push(rate);
      addedCount++;
    }
  });

  DB.save(DB.KEYS.RATES, existingRates);
  renderRates();
  hideModal();

  const msg = `インポート完了: 追加 ${addedCount}件, 更新 ${updatedCount}件`;
  toast(msg, 'success');
}

function showAddUserModal() {
  const body = `
    <div class="form-group">
      <label>ユーザー名 *</label>
      <input type="text" id="user-username" class="form-input" required>
    </div>
    <div class="form-group">
      <label>パスワード *</label>
      <input type="password" id="user-password" class="form-input" required>
    </div>
    <div class="form-group">
      <label>表示名 *</label>
      <input type="text" id="user-display" class="form-input" required>
    </div>
    <div class="form-group">
      <label>権限</label>
      <select id="user-role" class="form-input">
        <option value="worker">作業者</option>
        <option value="admin">管理者</option>
      </select>
    </div>
    <div class="form-group">
      <label>部門</label>
      <input type="text" id="user-dept" class="form-input">
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="createUser()">作成</button>
  `;

  showModal('新規ユーザー作成', body, footer);
}

function createUser() {
  const username = $('#user-username').value;
  const password = $('#user-password').value;
  const displayName = $('#user-display').value;
  const role = $('#user-role').value;
  const department = $('#user-dept').value;

  if (!username || !password || !displayName) {
    toast('ユーザー名、パスワード、表示名は必須です', 'warning');
    return;
  }

  const users = DB.get(DB.KEYS.USERS);

  if (users.some(u => u.username === username)) {
    toast('このユーザー名は既に使用されています', 'error');
    return;
  }

  const newUser = {
    id: DB.nextId(DB.KEYS.USERS),
    username,
    password,
    displayName,
    role,
    department
  };
  DB.add(DB.KEYS.USERS, newUser);

  toast('ユーザーを作成しました', 'success');
  hideModal();
  renderUsers();
}

function showEditUserModal(id) {
  const users = DB.get(DB.KEYS.USERS);
  const user = users.find(u => u.id === id);
  if (!user) return;

  const body = `
    <div class="form-group">
      <label>ユーザー名 * (変更不可)</label>
      <input type="text" id="edit-user-username" class="form-input" value="${user.username}" readonly style="background-color: #f1f5f9;">
    </div>
    <div class="form-group">
      <label>パスワード *</label>
      <input type="text" id="edit-user-password" class="form-input" value="${user.password}" required>
    </div>
    <div class="form-group">
      <label>表示名 *</label>
      <input type="text" id="edit-user-display" class="form-input" value="${user.displayName}" required>
    </div>
    <div class="form-group">
      <label>権限</label>
      <select id="edit-user-role" class="form-input">
        <option value="worker" ${user.role === 'worker' ? 'selected' : ''}>作業者</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理者</option>
      </select>
    </div>
    <div class="form-group">
      <label>部門</label>
      <input type="text" id="edit-user-dept" class="form-input" value="${user.department || ''}">
    </div>
    <input type="hidden" id="edit-user-id" value="${user.id}">
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="updateUser()">更新</button>
  `;

  showModal('ユーザー情報の編集', body, footer);
}

function updateUser() {
  const id = parseInt($('#edit-user-id').value);
  const password = $('#edit-user-password').value;
  const displayName = $('#edit-user-display').value;
  const role = $('#edit-user-role').value;
  const department = $('#edit-user-dept').value;

  if (!password || !displayName) {
    toast('パスワード、表示名は必須です', 'warning');
    return;
  }

  const users = DB.get(DB.KEYS.USERS);
  const userToUpdate = users.find(u => u.id === id);
  if (!userToUpdate) return;

  const updatedUser = {
    ...userToUpdate,
    password,
    displayName,
    role,
    department
  };

  DB.update(DB.KEYS.USERS, id, updatedUser);
  toast('ユーザー情報を更新しました', 'success');
  hideModal();
  renderUsers();
}

function safeAddListener(selector, event, callback) {
  const el = $(selector);
  if (el) {
    el.addEventListener(event, callback);
  }
}

// ========================================
// イベントリスナー
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // サイドバーのホバー制御初期化
  initSidebarHover();

  // 認証チェック
  checkAuth();

  // ログインフォーム
  safeAddListener('#login-form', 'submit', (e) => {
    e.preventDefault();
    const username = $('#login-username').value;
    const password = $('#login-password').value;

    if (login(username, password)) {
      showMainScreen();
      toast('ログインしました', 'success');
    } else {
      toast('ユーザー名またはパスワードが正しくありません', 'error');
    }
  });

  // ログアウト
  safeAddListener('#logout-btn', 'click', logout);

  // ナビゲーション
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // ガントチャートフィルター
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ganttFilter = btn.dataset.filter;
      renderGantt();
    });
  });

  // ガントチャート展開/折りたたみ
  safeAddListener('#expand-all', 'click', expandAll);
  safeAddListener('#collapse-all', 'click', collapseAll);

  // QRページ
  safeAddListener('#qr-order', 'change', updateQrItemSelect);
  safeAddListener('#qr-item', 'change', updateQrProcessSelect);

  const qrForm = $('#qr-form');
  if (qrForm) {
    qrForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const orderId = parseInt($('#qr-order').value);
      const itemId = parseInt($('#qr-item').value);
      const processName = $('#qr-process').value;

      if (!orderId || !itemId || !processName) {
        toast('すべての項目を選択してください', 'warning');
        return;
      }

      if (registerProgress(orderId, itemId, processName)) {
        toast('進捗を登録しました', 'success');
        renderQrPage();
        $('#qr-order').value = '';
        $('#qr-item').value = '';
        $('#qr-item').disabled = true;
        $('#qr-process').value = '';
        $('#qr-process').disabled = true;
      }
    });
  }

  // モーダル
  safeAddListener('#modal-close', 'click', hideModal);
  const modalOverlay = $('#modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) hideModal();
    });
  }

  // 各種追加ボタン
  safeAddListener('#add-order-btn', 'click', showAddOrderModal);
  safeAddListener('#add-defect-btn', 'click', showAddDefectModal);
  safeAddListener('#add-bom-btn', 'click', showAddBomModal);

  safeAddListener('#delete-all-bom-btn', 'click', deleteAllBoms);
  safeAddListener('#delete-selected-bom-btn', 'click', deleteSelectedBoms);

  // ボタン登録（null安全）
  safeAddListener('#import-bom-btn', 'click', showImportBomModal);
  safeAddListener('#add-rate-btn', 'click', showAddRateModal);
  safeAddListener('#import-rates-btn', 'click', showAddRateModal);
  safeAddListener('#add-user-btn', 'click', showAddUserModal);

  // 月次報告
  safeAddListener('#filter-report-btn', 'click', renderReport);
  safeAddListener('#generate-report-btn', 'click', printReport);
  safeAddListener('#export-report-btn', 'click', exportReportCSV);
});


// ========================================
// 月次報告
// ========================================

function renderReport(argStart, argEnd) {
  const startDateEl = document.getElementById('report-start-date');
  const endDateEl = document.getElementById('report-end-date');
  
  // 優先順位: 1.引数 2.DOM 3.フォールバック
  let startDate = (argStart !== undefined && typeof argStart === 'string') ? argStart.trim() : (startDateEl ? startDateEl.value.trim() : '');
  let endDate = (argEnd !== undefined && typeof argEnd === 'string') ? argEnd.trim() : (endDateEl ? endDateEl.value.trim() : '');

  // 究極のフォールバック: 引数もDOMも空で、ユーザーが「どうしても集計したい」場合のための手入力ダイアログ
  if (startDate === '' && endDate === '' && argStart === '') {
    // 引数として空文字が明示的に渡された（ボタンがおされたが値が取れなかった）場合にのみ発動
    const pStart = window.prompt("期間が自動取得できませんでした。開始日を直接入力してください (例: 2025/01/01)\n※全期間を集計する場合はキャンセルか空のままOKを押してください");
    if (pStart) {
      startDate = pStart.trim();
      const pEnd = window.prompt("終了日を入力してください (例: 2026/12/31)\n※未入力で開始日以降すべて", "2026/12/31");
      if (pEnd) endDate = pEnd.trim();
    }
  }

  console.log('[renderReport] startDateEl found:', !!startDateEl, 'DOM value:', startDateEl ? startDateEl.value : null);
  console.log('[renderReport] argument argStart:', argStart);
  console.log('[renderReport] Final startDate:', startDate);

  const orders = DB.get(DB.KEYS.ORDERS);
  const rates = DB.get(DB.KEYS.RATES);
  const boms = DB.get(DB.KEYS.BOM);
  const defects = DB.get(DB.KEYS.DEFECTS) || []; // 不良データ取得

  // 完了案件をフィルタ
  let filteredOrders = orders.filter(o => calculateProgress(o) === 100);

  // 日付文字列をDateオブジェクトに変換する堅牢な関数
  const parseDate = (d) => {
    if (!d) return null;
    // 全角数字を半角に変換
    let s = String(d).replace(/[\uff10-\uff19]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    // スラッシュ/ドット/年月日をハイフンに統一
    s = s.replace(/\//g, '-').replace(/\./g, '-').replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').trim();
    s = s.replace(/\s+/g, '');
    // YYYY-MM-DD形式かチェック
    const parts = s.split('-').filter(Boolean);
    if (parts.length >= 3) {
      const y = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      if (y > 1900 && m >= 0 && day > 0) {
        return new Date(y, m, day);
      }
    }
    // それ以外の場合、Dateコンストラクタで試行
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) return dt;
    return null;
  };

  const filterStart = parseDate(startDate);
  const filterEnd = parseDate(endDate);

  console.log('[renderReport] startDate入力:', startDate, '-> parseDate:', filterStart);
  console.log('[renderReport] endDate入力:', endDate, '-> parseDate:', filterEnd);
  console.log('[renderReport] 完了案件数:', filteredOrders.length);
  // デバッグ: 最初の3件のdueDateを表示
  filteredOrders.slice(0, 3).forEach((o, i) => {
    console.log('[renderReport] サンプル案件' + i + ': dueDate=' + JSON.stringify(o.dueDate) + ' parseDate=' + parseDate(o.dueDate));
  });

  // 日付フィルタ (Date型比較)
  if (filterStart) {
    filterStart.setHours(0, 0, 0, 0);
    filteredOrders = filteredOrders.filter(o => {
      const d = parseDate(o.dueDate);
      return !d || d >= filterStart; // 日付パース不可なら除外しない
    });
  }
  if (filterEnd) {
    filterEnd.setHours(23, 59, 59, 999);
    filteredOrders = filteredOrders.filter(o => {
      const d = parseDate(o.dueDate);
      return !d || d <= filterEnd; // 日付パース不可なら除外しない
    });
  }
  console.log('[renderReport] フィルタ後の案件数:', filteredOrders.length);

  // 不良数集計 (期間内)
  let filteredDefects = [];
  if (startDate || endDate) {
    filteredDefects = defects.filter(d => {
      const dDate = (d.createdAt || d.date || '').substring(0, 10);
      let matchStart = true;
      let matchEnd = true;
      if (startDate) matchStart = dDate >= startDate;
      if (endDate) matchEnd = dDate <= endDate;
      return matchStart && matchEnd;
    });
  } else {
    filteredDefects = defects;
  }

  const totalDefects = filteredDefects.length;

  // 不良理由別集計
  const defectReasons = {};
  let totalDefectQty = 0;
  filteredDefects.forEach(d => {
    const r = d.reason || 'その他';
    const qty = parseInt(d.quantity) || 1;
    defectReasons[r] = (defectReasons[r] || 0) + qty;
    totalDefectQty += qty;
  });

  // 統計計算
  let totalQuantity = 0;
  let totalCost = 0;
  let totalTime = 0;
  let departmentCosts = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };
  let departmentTimes = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };

  // 賃率マップ
  const rateMap = {};
  rates.forEach(r => {
    // 部署・係をキーとして分当り賃率をマッピング
    rateMap[r.subsection || r.section || r.department] = parseFloat(r.minuteRate) || 0;
  });

  // 工程→部門マッピング
  const processToDept = {
    '芯材カット': '基材係',
    '面材カット': '基材係',
    '芯組': '基材係',
    'フラッシュ': '基材係',
    'ランニングソー': '加工係',
    'エッヂバンダー': '加工係',
    'TOYO': '加工係',
    'HOMAG': '加工係',
    '仕上・梱包': '梱包仕上係',
    'フロア加工': '加工係',
    'アクリルBOX作成': '基材係',
    '扉面材くり抜き': '加工係'
  };
  const detailRows = filteredOrders.map(order => {
    totalQuantity += order.quantity;

    // 製品のBOMから工程時間を計算
    const productBoms = boms.filter(b => b.productName === order.productName);

    let orderTime = 0;
    let orderCost = 0;
    let orderDeptTimes = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };
    let orderDeptCosts = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };

    productBoms.forEach(bom => {
      if (bom.processTimes) {
        Object.entries(bom.processTimes).forEach(([process, time]) => {
          const dept = processToDept[process] || '加工係';
          const deptRate = rateMap[dept] || 50; // デフォルト賃率50円/分
          const totalTimeForProcess = time * order.quantity;
          const costForProcess = totalTimeForProcess * deptRate;

          orderTime += totalTimeForProcess;
          orderCost += costForProcess;
          orderDeptTimes[dept] = (orderDeptTimes[dept] || 0) + totalTimeForProcess;
          orderDeptCosts[dept] = (orderDeptCosts[dept] || 0) + costForProcess;
        });
      }
    });

    // フォールバック：BOMに時間データがない場合
    if (orderTime === 0) {
      orderTime = 60 * order.quantity;
      orderCost = 25000 * order.quantity;
      orderDeptCosts = { '基材係': orderCost * 0.4, '加工係': orderCost * 0.45, '梱包仕上係': orderCost * 0.15 };
      orderDeptTimes = { '基材係': orderTime * 0.4, '加工係': orderTime * 0.45, '梱包仕上係': orderTime * 0.15 };
    }

    totalCost += orderCost;
    totalTime += orderTime;

    Object.keys(departmentCosts).forEach(dept => {
      departmentCosts[dept] += orderDeptCosts[dept] || 0;
      departmentTimes[dept] += orderDeptTimes[dept] || 0;
    });

    const unitCost = Math.round(orderCost / order.quantity);
    const unitTime = Math.round(orderTime / order.quantity);

    return `
      <tr>
        <td>${order.projectName}</td>
        <td>${order.productName}</td>
        <td>${formatDate(order.dueDate)}</td>
        <td style="text-align: right;">${order.quantity}</td>
        <td style="text-align: right;">${unitTime.toLocaleString()} 分</td>
        <td style="text-align: right;">¥${unitCost.toLocaleString()}</td>
        <td style="text-align: right;">${orderTime.toLocaleString()} 分</td>
        <td style="text-align: right;">¥${Math.round(orderCost).toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  const dateRangeText = startDate && endDate
    ? `${formatDate(startDate)} ～ ${formatDate(endDate)}`
    : '全期間';

  const now = new Date();
  const createdAt = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // ========================================
  // 在庫データの取得と計算
  // ========================================
  const invProducts = DB.get(DB.KEYS.INV_PRODUCTS);
  const invLogs = DB.get(DB.KEYS.INV_LOGS);
  const invMonthly = DB.get(DB.KEYS.INV_MONTHLY);

  // 最新の月次締めデータを取得
  const latestMonthly = invMonthly.length > 0 ? [...invMonthly].sort((a, b) => b.month.localeCompare(a.month))[0] : null;

  // 在庫計算（月次締めデータから直接取得し、完全一致させる）
  const categoryStocks = {};
  let totalInvAmount = latestMonthly ? latestMonthly.total : 0;
  let totalFixedAmount = 0;
  let totalNormalAmount = 0;

  if (latestMonthly && latestMonthly.summary) {
    Object.entries(latestMonthly.summary).forEach(([code, s]) => {
      const catName = s.name;
      categoryStocks[catName] = { total: s.amount, normal: 0, fixed: 0 };
      if (code === 'fixed') {
         categoryStocks[catName].fixed = s.amount;
         totalFixedAmount += s.amount;
      } else {
         categoryStocks[catName].normal = s.amount;
         totalNormalAmount += s.amount;
      }
    });
  } else {
    // 月次締めがない場合のフォールバック（リアルタイム）
    invProducts.forEach(product => {
      const stock = getCurrentStock(product.id, invLogs);
      const amount = Math.round(stock * product.price);
      const catName = INV_CATEGORIES[product.category] || product.category;
      if (!categoryStocks[catName]) categoryStocks[catName] = { normal: 0, fixed: 0, total: 0 };
      
      if (product.isFixed) {
        categoryStocks[catName].fixed += amount;
        totalFixedAmount += amount;
      } else {
        categoryStocks[catName].normal += amount;
        totalNormalAmount += amount;
      }
      categoryStocks[catName].total += amount;
      totalInvAmount += amount;
    });
  }

  // 月別在庫推移データ（過去6ヶ月）
  const monthlyTrend = [];
  const currentMonth = new Date();
  for (let i = 5; i >= 0; i--) {
    const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
    const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    const monthData = invMonthly.find(m => m.month === monthKey);
    let fixedTotal = 0;
    if (monthData && monthData.summary && monthData.summary['fixed']) {
      fixedTotal = monthData.summary['fixed'].amount;
    }
    monthlyTrend.push({
      month: monthKey,
      label: `${targetDate.getMonth() + 1}月`,
      total: monthData?.total || 0,
      fixedTotal: fixedTotal
    });
  }

  // 分類別グラフHTML生成
  const categoryRows = Object.entries(categoryStocks)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, data]) => {
      const barWidth = totalInvAmount > 0 ? Math.round((data.total / totalInvAmount) * 100) : 0;
      return `
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
            <span style="font-size: 0.875rem; color: #334155;">${cat}</span>
            <span style="font-size: 0.875rem; font-weight: 500; color: #1e293b;">¥${Math.round(data.total).toLocaleString()}</span>
          </div>
          <div style="background: #e2e8f0; border-radius: 4px; height: 12px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #2563eb, #60a5fa); height: 100%; width: ${barWidth}%; transition: width 0.3s;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
            <span>通常: ¥${Math.round(data.normal).toLocaleString()}</span>
            <span>不動品: ¥${Math.round(data.fixed).toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join('');

  // 月別推移グラフ
  const maxTrendValue = Math.max(...monthlyTrend.map(m => m.total), 1);
  const trendBars = monthlyTrend.map(m => {
    const barHeight = Math.round((m.total / maxTrendValue) * 100);
    const fixedRatio = m.total > 0 ? Math.round((m.fixedTotal / m.total) * 100) : 0;
    const minBarHeight = m.total > 0 ? Math.max(barHeight, 5) : 0;
    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
        <div style="width: 100%; max-width: 40px; display: flex; flex-direction: column; justify-content: flex-end; height: 100px;">
          <div style="background: linear-gradient(180deg, #2563eb, #60a5fa); width: 100%; height: ${minBarHeight}%; min-height: ${m.total > 0 ? '4px' : '0'}; border-radius: 4px 4px 0 0; position: relative;">
            ${fixedRatio > 0 ? `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: ${fixedRatio}%; background: #f59e0b; opacity: 0.8; border-radius: 0 0 4px 4px;"></div>` : ''}
          </div>
        </div>
        <div style="font-size: 0.75rem; margin-top: 0.5rem; color: #64748b;">${m.label}</div>
        <div style="font-size: 0.625rem; color: #64748b;">${m.total > 0 ? `¥${Math.round(m.total / 10000)}万` : '-'}</div>
      </div>
    `;
  }).join('');

  const avgCostPerUnit = totalQuantity > 0 ? Math.round(totalCost / totalQuantity) : 0;
  const totalDays = (totalTime / 480).toFixed(1); // 1日=8時間換算
  const defectRate = totalQuantity > 0 ? ((totalDefects / totalQuantity) * 100).toFixed(1) : 0;
  const deadStockRatio = totalInvAmount > 0 ? ((totalFixedAmount / totalInvAmount) * 100).toFixed(1) : 0;



  const html = `
    <div class="report-print" id="report-print-area" style="background: #ffffff; color: #1e293b; font-family: 'Inter', 'Noto Sans JP', sans-serif; max-width: 1000px; margin: 0 auto; padding: 2.5rem; border-top: 8px solid #0B2D48; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px;">
      <!-- 会議資料ヘッダー -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem;">
        <div>
          <span style="font-size: 0.75rem; font-weight: 700; color: #0B2D48; text-transform: uppercase; letter-spacing: 0.1em; background: #e0f2fe; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 0.5rem;">経営会議報告資料</span>
          <h2 style="font-size: 1.75rem; font-weight: 800; color: #0B2D48; margin: 0;">月次製造実績・原価実績報告書</h2>
          <p style="font-size: 0.875rem; color: #64748b; margin: 4px 0 0 0;">対象期間: <strong style="color: #0f172a;">${dateRangeText}</strong></p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #dc2626; border: 1.5px solid #fecaca; padding: 4px 10px; border-radius: 4px; display: inline-block; margin-bottom: 0.5rem; background: #fef2f2;">社外秘 (CONFIDENTIAL)</span>
          <p style="font-size: 0.75rem; color: #64748b; margin: 0;">出力日時: ${createdAt}</p>
          <p style="font-size: 0.75rem; color: #64748b; margin: 2px 0 0 0;">TAC製造部 管理システム</p>
        </div>
      </div>
      
      <!-- 総括サマリ -->
      <div style="margin-bottom: 2.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #0B2D48; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; border-left: 4px solid #0B2D48; padding-left: 0.5rem;">
          <span>■ 月次総括サマリ (主要KPI)</span>
        </h3>
        <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          <!-- 生産数量 -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem;">総完成数</span>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 1.75rem; font-weight: 800; color: #0b2d48;">${totalQuantity.toLocaleString()}<span style="font-size: 0.875rem; font-weight: 500; color: #64748b; margin-left: 4px;">台</span></span>
              <span style="font-size: 0.75rem; color: #10b981; font-weight: 600; background: #ecfdf5; padding: 2px 8px; border-radius: 9999px;">通常稼働</span>
            </div>
          </div>
          <!-- 加工費総額 -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem;">製造加工費総額</span>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 1.75rem; font-weight: 800; color: #0b2d48;">¥${Math.round(totalCost).toLocaleString()}</span>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">労務・加工賃率換算</span>
            </div>
          </div>
          <!-- 1台あたり加工費 -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem;">1台当り平均加工単価</span>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 1.75rem; font-weight: 800; color: #0b2d48;">¥${avgCostPerUnit.toLocaleString()}<span style="font-size: 0.875rem; font-weight: 500; color: #64748b; margin-left: 2px;">/台</span></span>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">BOM標準加工費基準</span>
            </div>
          </div>
          <!-- 総生産時間 -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #64748b; margin-bottom: 0.5rem;">総工数（生産時間）</span>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 1.5rem; font-weight: 800; color: #0b2d48;">${totalTime.toLocaleString()}<span style="font-size: 0.875rem; font-weight: 500; color: #64748b; margin-left: 2px;">分</span><span style="font-size: 0.875rem; font-weight: 500; color: #64748b; margin-left: 8px;">(${(totalTime / 60).toFixed(1)}h)</span></span>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">稼働換算: ${totalDays} 人日</span>
            </div>
          </div>
          <!-- 不良率 -->
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #991b1b; margin-bottom: 0.5rem;">歩留まり不良率</span>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 1.75rem; font-weight: 800; color: #991b1b;">${defectRate}<span style="font-size: 0.875rem; font-weight: 500; margin-left: 2px;">%</span></span>
              <span style="font-size: 0.75rem; color: #991b1b; font-weight: 600; background: #fee2e2; padding: 2px 8px; border-radius: 9999px;">不良数: ${totalDefects} 件</span>
            </div>
          </div>
          <!-- 不動品比率 -->
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #92400e; margin-bottom: 0.5rem;">不動在庫（長期滞留）比率</span>
            <div style="display: flex; align-items: baseline; justify-content: space-between;">
              <span style="font-size: 1.75rem; font-weight: 800; color: #92400e;">${deadStockRatio}<span style="font-size: 0.875rem; font-weight: 500; margin-left: 2px;">%</span></span>
              <span style="font-size: 0.75rem; color: #92400e; font-weight: 600; background: #fef3c7; padding: 2px 8px; border-radius: 9999px;">要改善</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 不良品分析 -->
      <div style="margin-bottom: 2.5rem; page-break-inside: avoid;">
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #0B2D48; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; border-left: 4px solid #0B2D48; padding-left: 0.5rem;">
          <span>■ 不良品発生分析</span>
        </h3>
        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
          <div style="flex: 2; min-width: 300px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; border: 1px solid #cbd5e1;">
              <thead>
                <tr style="background: #0B2D48; color: #ffffff;">
                  <th style="padding: 10px 14px; font-weight: 600; border: 1px solid #0b2d48;">発生理由（原因分類）</th>
                  <th style="padding: 10px 14px; font-weight: 600; text-align: right; border: 1px solid #0b2d48; width: 120px;">発生個数</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(defectReasons).length > 0 ?
                  Object.entries(defectReasons)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, qty], idx) => `
                      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 14px; border: 1px solid #cbd5e1;">${reason}</td>
                        <td style="padding: 10px 14px; text-align: right; font-weight: 600; color: #ef4444; border: 1px solid #cbd5e1;">${qty} 個</td>
                      </tr>
                    `).join('') :
                  '<tr><td colspan="2" style="padding: 16px; text-align: center; color: #94a3b8; border: 1px solid #cbd5e1;">期間内の不良発生データはありません</td></tr>'
                }
              </tbody>
            </table>
          </div>
          <div style="flex: 1; min-width: 220px; background: #fff5f5; border: 1px solid #fecaca; border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <span style="font-size: 0.875rem; font-weight: 700; color: #c53030; margin-bottom: 0.5rem;">不良品総数 (個数ベース)</span>
            <span style="font-size: 2.25rem; font-weight: 800; color: #e53e3e;">${totalDefectQty} <span style="font-size: 1rem; font-weight: 500;">個</span></span>
            <div style="margin-top: 1rem; font-size: 0.75rem; color: #742a2a; text-align: center;">
              発生レコード数: ${totalDefects} 件<br>
              ※不良率は出荷台数に対する個数換算です
            </div>
          </div>
        </div>
      </div>

      <!-- 在庫金額分析 -->
      <div style="margin-bottom: 2.5rem; page-break-inside: avoid; background: #ffffff; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #0B2D48; margin-bottom: 1.25rem; border-bottom: 2px solid #0B2D48; padding-bottom: 0.5rem; display: inline-block;">■ 資産（在庫）評価分析</h3>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; background: #f8fafc; padding: 1.25rem; border-radius: 8px; border: 1px solid #cbd5e1;">
          <div style="text-align: center; border-right: 1px solid #cbd5e1;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">総在庫評価額</span>
            <span style="font-size: 1.75rem; font-weight: 800; color: #1e40af;">¥${Math.round(totalInvAmount).toLocaleString()}</span>
          </div>
          <div style="text-align: center; border-right: 1px solid #cbd5e1;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">内通常在庫</span>
            <span style="font-size: 1.5rem; font-weight: 800; color: #059669;">¥${Math.round(totalNormalAmount).toLocaleString()}</span>
          </div>
          <div style="text-align: center;">
            <span style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">内不動品在庫</span>
            <span style="font-size: 1.5rem; font-weight: 800; color: #d97706;">¥${Math.round(totalFixedAmount).toLocaleString()}</span>
          </div>
        </div>
        
        <div class="inventory-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; flex-wrap: wrap;">
          <!-- 分類別グラフ -->
          <div>
            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 1rem; color: #334155; border-left: 3px solid #1e40af; padding-left: 0.5rem;">資材分類別 在庫金額構成</h4>
            ${categoryRows || '<p style="color: #94a3b8; font-size: 0.875rem;">在庫データがありません</p>'}
          </div>
          
          <!-- 月別推移グラフ (印刷でもはっきり見えるように再設計) -->
          <div>
            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 1rem; color: #334155; border-left: 3px solid #1e40af; padding-left: 0.5rem;">過去6ヶ月の在庫推移（対比グラフ）</h4>
            <div style="display: flex; gap: 0.75rem; align-items: flex-end; padding: 1.25rem; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1; height: 180px; box-sizing: border-box;">
              ${trendBars}
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 0.75rem; font-size: 0.75rem; color: #64748b; justify-content: center;">
              <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 12px; height: 12px; background: linear-gradient(180deg, #2563eb, #60a5fa); border-radius: 2px;"></span> 通常在庫</span>
              <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 12px; height: 12px; background: #f59e0b; border-radius: 2px;"></span> 不動在庫（滞留）</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 詳細データ一覧 -->
      <div style="margin-bottom: 2.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #0B2D48; margin-bottom: 1rem; border-left: 4px solid #0B2D48; padding-left: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
          <span>■ 物件別・製品別詳細原価内訳</span>
          <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">(納期順)</span>
        </h3>
        <table class="detail-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #0B2D48; color: #ffffff;">
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600;">物件名</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600;">製品名</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; text-align: center; width: 70px;">納期</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; text-align: right; width: 50px;">数量</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; text-align: right; width: 90px;">時間/台</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; text-align: right; width: 90px;">加工費/台</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; text-align: right; width: 90px;">総生産時間</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; text-align: right; width: 100px;">総加工費額</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows || '<tr><td colspan="8" style="padding: 16px; text-align: center; color: #94a3b8; border: 1px solid #cbd5e1;">集計対象となる完了案件データはありません</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <!-- 部門別集計 -->
      <div style="page-break-inside: avoid;">
        <h3 style="font-size: 1.1rem; font-weight: 700; color: #0B2D48; margin-bottom: 1rem; border-left: 4px solid #0B2D48; padding-left: 0.5rem;">■ 製造部門別（係別）コスト配分内訳</h3>
        <div class="dept-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
          ${Object.entries(departmentCosts).map(([dept, cost]) => {
            const pct = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : '0.0';
            return `
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1.25rem; border-top: 4px solid #0B2D48;">
                <div style="font-weight: 700; color: #475569; font-size: 0.875rem; margin-bottom: 4px;">${dept}</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: #0b2d48; margin: 4px 0;">¥${Math.round(cost).toLocaleString()}</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                  <span>構成比: <strong>${pct}%</strong></span>
                  <span>時間: ${(departmentTimes[dept] || 0).toLocaleString()} 分</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- 報告書フッターサインエリア (会議用) -->
      <div style="margin-top: 3.5rem; border-top: 1px solid #cbd5e1; padding-top: 1.5rem; display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b; page-break-inside: avoid;">
        <div>
          <span>TAC FURNITURE CO., LTD. MANUFACTURING DEPT.</span>
        </div>
        <div style="display: flex; gap: 2rem; text-align: center;">
          <div style="width: 100px;">
            <div style="height: 40px; border: 1px solid #cbd5e1; border-bottom: none; background: #f8fafc;"></div>
            <div style="border: 1px solid #cbd5e1; padding: 4px; font-weight: 600;">承認者</div>
          </div>
          <div style="width: 100px;">
            <div style="height: 40px; border: 1px solid #cbd5e1; border-bottom: none; background: #f8fafc;"></div>
            <div style="border: 1px solid #cbd5e1; padding: 4px; font-weight: 600;">報告者</div>
          </div>
        </div>
      </div>
    </div>
  `;

  $('#report-content').innerHTML = html;
}

function exportReportCSV() {
  try {
    const startDateEl = document.getElementById('report-start-date');
    const endDateEl = document.getElementById('report-end-date');
    const startDate = startDateEl ? startDateEl.value.trim() : '';
    const endDate = endDateEl ? endDateEl.value.trim() : '';
    const orders = DB.get(DB.KEYS.ORDERS) || [];
    const rates = DB.get(DB.KEYS.RATES) || [];
    const boms = DB.get(DB.KEYS.BOM) || [];

    const parseDate = (d) => {
      if (!d) return null;
      let s = String(d).replace(/[\uff10-\uff19]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      s = s.replace(/\//g, '-').replace(/\./g, '-').replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').trim();
      s = s.replace(/\s+/g, '');
      const parts = s.split('-').filter(Boolean);
      if (parts.length >= 3) {
        const y = parseInt(parts[0]); const m = parseInt(parts[1]) - 1; const day = parseInt(parts[2]);
        if (y > 1900 && m >= 0 && day > 0) return new Date(y, m, day);
      }
      const dt = new Date(d);
      if (!isNaN(dt.getTime())) return dt;
      return null;
    };
    
    let filteredOrders = orders.filter(o => calculateProgress(o) === 100);
    const filterStart = parseDate(startDate);
    const filterEnd = parseDate(endDate);
    if (filterStart) {
      filterStart.setHours(0, 0, 0, 0);
      filteredOrders = filteredOrders.filter(o => { const d = parseDate(o.dueDate); return !d || d >= filterStart; });
    }
    if (filterEnd) {
      filterEnd.setHours(23, 59, 59, 999);
      filteredOrders = filteredOrders.filter(o => { const d = parseDate(o.dueDate); return !d || d <= filterEnd; });
    }

    if (filteredOrders.length === 0) {
      toast('エクスポートするデータがありません。集計期間内に完了したオーダーがあるか確認してください。', 'warning');
      return;
    }

    const rateMap = {};
    rates.forEach(r => {
      rateMap[r.subsection || r.section || r.department] = parseFloat(r.minuteRate) || 0;
    });
    const processToDept = {
      '芯材カット': '基材係', '面材カット': '基材係', '芯組': '基材係', 'フラッシュ': '基材係',
      'ランニングソー': '加工係', 'エッヂバンダー': '加工係', 'TOYO': '加工係', 'HOMAG': '加工係',
      '仕上・梱包': '梱包仕上係', 'フロア加工': '加工係', 'アクリルBOX作成': '基材係', '扉面材くり抜き': '加工係'
    };
    const headers = ['物件名', '製品名', '納期', '台数', '台/生産時間(分)', '台/加工費(円)', '総生産時間(分)', '総加工費(円)'];
    let csvContent = headers.join(',') + '\n';

    filteredOrders.forEach(order => {
      const productBoms = boms.filter(b => b.productName === order.productName);
      let orderTime = 0;
      let orderCost = 0;

      productBoms.forEach(bom => {
        if (bom.processTimes) {
          Object.entries(bom.processTimes).forEach(([process, time]) => {
            const dept = processToDept[process] || '加工係';
            const deptRate = rateMap[dept] || 50;
            const totalTimeForProcess = time * order.quantity;
            const costForProcess = totalTimeForProcess * deptRate;
            orderTime += totalTimeForProcess;
            orderCost += costForProcess;
          });
        }
      });

      if (orderTime === 0) {
        orderTime = 60 * order.quantity;
        orderCost = 25000 * order.quantity;
      }

      const unitTime = Math.round(orderTime / order.quantity);
      const unitCost = Math.round(orderCost / order.quantity);

      // エスケープ処理
      const row = [
        `"${order.projectName.replace(/"/g, '""')}"`,
        `"${order.productName.replace(/"/g, '""')}"`,
        order.dueDate || '',
        order.quantity,
        unitTime,
        unitCost,
        Math.round(orderTime),
        Math.round(orderCost)
      ];
      csvContent += row.join(',') + '\n';
    });

    const bomArray = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bomArray, csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = URL.createObjectURL(blob);
    link.download = `月次製造原価報告書_詳細_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    toast('CSVエクスポートが完了しました。', 'success');
  } catch (err) {
    console.error('CSVエクスポートエラー:', err);
    alert('CSV出力中にエラーが発生しました:\n' + err.message + '\n' + err.stack);
  }
}

function printReport() {
  // ポップアップブロック回避のため、まず同期的に空ウィンドウを確保
  const printWindow = window.open('about:blank', '_blank');
  if (!printWindow) {
    toast('ポップアップがブロックされました。ブラウザの設定で許可してください。', 'error');
    alert('ポップアップブロックを検知しました。印刷画面を開くにはブラウザの設定でポップアップを許可してください。');
    return;
  }

  try {
    let reportArea = $('#report-print-area');
    if (!reportArea) {
      // レポートが未生成の場合、まずDOMから期間を取得して生成
      const startDateEl = document.getElementById('report-start-date');
      const endDateEl = document.getElementById('report-end-date');
      const startDate = startDateEl ? startDateEl.value.trim() : '';
      const endDate = endDateEl ? endDateEl.value.trim() : '';
      renderReport(startDate, endDate);
      
      reportArea = $('#report-print-area');
      if (!reportArea) {
        printWindow.close();
        toast('レポートの生成に失敗しました。先に「集計」ボタンを押してください。', 'error');
        return;
      }
    }
    openPrintReportWindow(reportArea, printWindow);
  } catch (err) {
    if (printWindow) printWindow.close();
    console.error('PDF出力エラー:', err);
    alert('PDF印刷中にエラーが発生しました:\n' + err.message + '\n' + err.stack);
  }
}

function openPrintReportWindow(reportArea, targetWindow) {
  const reportData = {
    html: reportArea.innerHTML
  };
  targetWindow.sessionStorage.setItem('print_report_data', JSON.stringify(reportData));
  targetWindow.location.href = 'print_report.html';
}

// ========================================
// モバイルナビゲーション
// ========================================

function initMobileNav() {
  const mobileNav = $('#mobile-nav');
  const mobileNavWorker = $('#mobile-nav-worker');
  const mobileNavAdmin = $('#mobile-nav-admin');
  const moreMenu = $('#more-menu');

  if (!mobileNav) return;

  // モバイルナビを表示
  mobileNav.classList.remove('hidden');

  // ロールに応じたナビを表示
  if (currentUser.role === 'admin') {
    mobileNavWorker.classList.add('hidden');
    mobileNavAdmin.classList.remove('hidden');
  } else {
    mobileNavWorker.classList.remove('hidden');
    mobileNavAdmin.classList.add('hidden');
  }

  // ボトムナビのクリックイベント
  $$('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;

      if (page === 'more') {
        // その他メニューを表示
        showMoreMenu();
      } else {
        navigateTo(page);
      }
    });
  });

  // その他メニューの項目クリック
  $$('.more-menu-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      hideMoreMenu();
      navigateTo(page);
    });
  });

  // その他メニューを閉じる
  const moreMenuClose = $('.more-menu-close');
  if (moreMenuClose) {
    moreMenuClose.addEventListener('click', hideMoreMenu);
  }

  const moreMenuOverlay = $('.more-menu-overlay');
  if (moreMenuOverlay) {
    moreMenuOverlay.addEventListener('click', hideMoreMenu);
  }

  // モバイルログアウトボタン
  const mobileLogoutBtn = $('#mobile-logout-btn');
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', () => {
      hideMoreMenu();
      logout();
    });
  }
}

function showMoreMenu() {
  const moreMenu = $('#more-menu');
  if (moreMenu) {
    moreMenu.classList.remove('hidden');
  }
}

function hideMoreMenu() {
  const moreMenu = $('#more-menu');
  if (moreMenu) {
    moreMenu.classList.add('hidden');
  }
}

// ========================================
// 在庫管理
// ========================================

// 資材分類
const INV_CATEGORIES = {
  '01': '基材',
  '02': '面材',
  '03': 'シート',
  '04': '木口ﾃｰﾌﾟ',
  '05': '金具',
  '06': 'ﾀﾞﾝﾎﾞｰﾙ',
  '07': '接着剤',
  '08': '仕入備品',
  '09': 'PAO資材',
  '10': '工場部材',
  '11': '仕掛品芯組のみ',
  '12': '仕掛品カット',
  '13': '部材完成品',
  '14': '製品在庫',
  '15': 'シェルフ製品在庫',
  '16': 'キャビネット製品在庫',
  '17': 'ラミテック',
  '18': '天野木工',
  '19': 'いろは',
  '20': 'Real',
  '21': 'イイダアックス',
  '22': '下請け預かり品',
  '23': 'GRID不動品',
  '24': '仕掛品フラッシュのみ',
  '26': '仕掛品(未完成品)'
};

// 在庫スキャナー用
let invQrScanner = null;

// 現在庫数を取得（ログから集計）
function getCurrentStock(productId) {
  const logs = DB.get(DB.KEYS.INV_LOGS);
  let stock = 0;
  logs.forEach(log => {
    if (log.productId === productId) {
      if (log.type === 'count') {
        stock = log.quantity; // 棚卸の場合は上書き
      } else if (log.type === 'in') {
        stock += log.quantity;
      } else if (log.type === 'out') {
        stock -= log.quantity;
      }
    }
  });
  return stock;
}

// ========================================
// 棚卸スキャン画面
// ========================================

function getInventoryNextTargetMonth() {
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
  if (monthly.length > 0) {
    // Copy and sort descending
    const sorted = [...monthly].sort((a, b) => b.month.localeCompare(a.month));
    const latestMonthStr = sorted[0].month; // YYYY-MM
    const [y, m] = latestMonthStr.split('-');
    const nextDate = new Date(parseInt(y), parseInt(m), 1);
    return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function renderInvScanPage() {
  // 締め状況に基づきデフォルト月を設定
  const monthInput = $('#inv-scan-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = getInventoryNextTargetMonth();
  }

  // イベント設定
  const startBtn = $('#inv-start-scan-btn');
  const stopBtn = $('#inv-stop-scan-btn');
  const productIdInput = $('#inv-scan-product-id');
  const form = $('#inv-scan-form');

  if (startBtn) startBtn.onclick = startInvScanner;
  if (stopBtn) stopBtn.onclick = stopInvScanner;

  // 資材ID入力時に商品情報を表示
  if (productIdInput) {
    productIdInput.oninput = () => {
      let id = productIdInput.value.trim();
      // 新バーコード(識別コード)または旧バーコード(資材コード)入力時の変換
      const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
      const prodByCode = products.find(p => p.identCode === id || p.id === id);
      if (prodByCode) {
        id = prodByCode.id;
        productIdInput.value = id;
      }
      displayProductInfo(id);
    };
  }

  // フォーム送信
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      submitInventoryCount();
    };
  }

  // 本日の棚卸履歴を表示
  renderTodayInvLogs();

  // ExcelインポートUIの初期化
  setupInvExcelImport();

  // スマホの場合は自動でカメラ起動 -> 廃止（ボタンで起動）
  /*
  if (isMobileDevice()) {
    setTimeout(() => startInvScanner(), 500);
  }
  */
}

function setupInvExcelImport() {
  const fileInput = $('#inv-excel-upload');
  const importBtn = $('#inv-excel-import-btn');
  const confirmBtn = $('#inv-excel-confirm-btn');
  const previewDiv = $('#inv-excel-preview');
  const tbody = $('#inv-excel-preview-body');
  const monthInput = $('#inv-excel-month');

  if (!fileInput || !importBtn) return;

  let parsedItems = [];

  importBtn.onclick = () => {
    const file = fileInput.files[0];
    if (!file) {
      toast('Excelファイルを選択してください', 'error');
      return;
    }

    if (typeof XLSX === 'undefined') {
      toast('Excel解析ライブラリが読み込まれていません', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        
        // ファイル拡張子が .csv の場合は Shift-JIS としてテキストデコードしてからパース
        let workbook;
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = new TextDecoder('shift-jis').decode(data);
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          workbook = XLSX.read(data, { type: 'array' });
        }
        
        // 「提出書類」シートを探す、見つからなければ最初のシート
        const sheetName = workbook.SheetNames.find(n => n.includes('提出書類')) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // ヘッダーなしの2次元配列としてパース
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // F1セルの合計金額を取得（参考表示用）
        let f1Total = 0;
        if (rows.length > 0 && rows[0][5]) {
          const f1Str = String(rows[0][5]).replace(/[¥\\,\s]/g, '');
          f1Total = parseFloat(f1Str) || 0;
        }
        
        const products = DB.get(DB.KEYS.INV_PRODUCTS);
        parsedItems = [];

        // CSV列マッピング:
        // E列(idx 4) = 資材コード, G列(idx 6) = 品名, N列(idx 13) = 単価
        // S列(idx 18) = 数量, T列(idx 19) = 合計金額, U列(idx 20) = 合計金額(1%増し)
        rows.forEach((row, rowIndex) => {
          if (rowIndex < 2) return; // ヘッダー行スキップ（0:サマリ, 1:列名）
          
          // S列（数量）を取得
          const sColValue = row[18];
          if (sColValue === undefined || sColValue === null || sColValue === '') return;
          
          const quantity = parseInt(sColValue, 10);
          if (isNaN(quantity)) return; // 数字でない場合はスキップ

          // 各列の値を取得
          const productCode = row[4] ? String(row[4]).trim() : '';  // E列: 資材コード
          const productName = row[6] ? String(row[6]).trim() : '';  // G列: 品名
          const category = row[1] ? String(row[1]).trim() : '99';   // B列: 識別コード分類
          const unitPriceRaw = row[13];                              // N列: 単価
          const amountRaw = row[19];                                 // T列: 合計金額
          const amountWithTaxRaw = row[20];                          // U列: 合計金額(1%増し)
          
          const unitPrice = parseFloat(String(unitPriceRaw || '0').replace(/[,]/g, '')) || 0;
          const amount = parseFloat(String(amountRaw || '0').replace(/[,]/g, '')) || 0;
          const amountWithTax = parseFloat(String(amountWithTaxRaw || '0').replace(/[,]/g, '')) || 0;

          if (!productCode && !productName) return; // コードも品名もない行はスキップ

          // マスタから検索
          let matchedProduct = products.find(p => p.id === productCode);
          
          // マスタにない場合は仮情報として保持
          const productInfo = matchedProduct || {
            id: productCode || `TEMP_${rowIndex}`,
            name: productName || `不明品(行${rowIndex + 1})`,
            category: category,
            price: unitPrice,
            isFixed: false
          };

          parsedItems.push({
            product: productInfo,
            quantity: quantity,
            unitPrice: unitPrice,
            amount: amount,
            amountWithTax: amountWithTax,
            isMatched: !!matchedProduct
          });
        });

        if (parsedItems.length === 0) {
          toast('取り込み対象のデータが見つかりませんでした', 'warning');
          return;
        }

        // 集計
        const totalAmount = parsedItems.reduce((s, i) => s + i.amountWithTax, 0);
        const matchedCount = parsedItems.filter(i => i.isMatched).length;

        // プレビュー表示
        tbody.innerHTML = parsedItems.slice(0, 50).map(item => `
          <tr>
            <td style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.product.name}">
              ${item.product.name}
            </td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">¥${item.amountWithTax.toLocaleString()}</td>
            <td style="color:${item.isMatched ? 'var(--color-success)' : '#f59e0b'};">${item.isMatched ? 'マスタ一致' : 'CSV直接'}</td>
          </tr>
        `).join('') + (parsedItems.length > 50 ? `<tr><td colspan="4" style="text-align:center; color:#666;">…他${parsedItems.length - 50}件</td></tr>` : '');

        previewDiv.style.display = 'block';
        toast(`${parsedItems.length}件読込 (合計: ¥${totalAmount.toLocaleString()}, CSV合計: ¥${f1Total.toLocaleString()})`, 'success');

      } catch (err) {
        console.error(err);
        toast('Excelの解析に失敗しました: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (parsedItems.length === 0) {
        toast('取り込みデータがありません', 'warning');
        return;
      }

      const targetMonth = monthInput ? monthInput.value : '';
      // targetMonth がある場合はその月末日時をタイムスタンプにする、ない場合は現在日時
      let timestamp = new Date().toISOString();
      if (targetMonth) {
        // 対象月の末日を作成 (例: "2026-04" -> 2026-04-30 23:59:59)
        const [y, m] = targetMonth.split('-');
        const lastDay = new Date(y, m, 0, 23, 59, 59);
        timestamp = lastDay.toISOString();
      }

      const currentUser = DB.get(DB.KEYS.CURRENT_USER);
      const userName = (currentUser && currentUser.displayName) ? currentUser.displayName : (currentUser && currentUser.username) ? currentUser.username : '未設定';
      const itemCount = parsedItems.length; // 件数を先に保存

      const newLogs = parsedItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name || '',
        type: 'count', // 棚卸
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        amount: item.amount || 0,
        amountWithTax: item.amountWithTax || 0,
        note: targetMonth ? `Excel一括取込(${targetMonth}分)` : 'Excel一括取込',
        user: userName,
        timestamp: timestamp
      }));

      console.log('🔄 Excel取込: 登録開始', newLogs.length, '件');
      console.log('🔄 サンプルデータ:', JSON.stringify(newLogs[0]));
      console.log('🔄 合計金額:', newLogs.reduce((s,l) => s + (l.amountWithTax || 0), 0).toLocaleString());

      // ボタン無効化（二重クリック防止）
      confirmBtn.disabled = true;
      confirmBtn.textContent = '登録中...';

      // 【重要】取り込んだ資材を商品マスタへ反映（新規追加・単価更新）
      const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
      let masterUpdateCount = 0;
      let masterAddCount = 0;

      parsedItems.forEach(item => {
        const pData = item.product;
        const existingIdx = products.findIndex(p => p.id === pData.id || (pData.name && p.name === pData.name));
        
        if (existingIdx >= 0) {
          products[existingIdx].price = item.unitPrice;
          masterUpdateCount++;
        } else {
          products.push({
            id: pData.id,
            name: pData.name,
            category: pData.category || '99',
            price: item.unitPrice,
            isFixed: false
          });
          masterAddCount++;
        }
      });
      DB.save(DB.KEYS.INV_PRODUCTS, products);
      console.log(`✅ 商品マスタ同期完了: 新規${masterAddCount}件、更新${masterUpdateCount}件`);

      // 棚卸仮データに追加 (INV_PRODUCTS 内への埋め込み UPSERT)
      const currentMonth = targetMonth || new Date().toISOString().substring(0, 7);

      parsedItems.forEach(item => {
        const prod = products.find(p => p.id === item.product.id);
        if (prod) {
          prod.tempQty = item.quantity;
          prod.tempWorker = currentUser.username;
          prod.tempWorkerName = currentUser.displayName;
          prod.tempTimestamp = timestamp;
          prod.tempMonth = currentMonth;
          prod.tempId = Date.now() + "_" + item.product.id;
        }
      });
      DB.save(DB.KEYS.INV_PRODUCTS, products);
      console.log('✅ Excel仮取込: 完了');
      
      toast(`${itemCount}件の棚卸データを仮登録しました。「棚卸スキャン確認」画面にて確認・確定処理を行ってください（マスタ新規:${masterAddCount}, 更新:${masterUpdateCount}）`, 'success');

      // 初期化
      parsedItems = [];
      previewDiv.style.display = 'none';
      if (fileInput) fileInput.value = '';
      if (monthInput) monthInput.value = '';
      
      renderTodayInvLogs();
      confirmBtn.disabled = false;
      confirmBtn.textContent = '確定して登録';
    };
  }
}

window.forceReloadMaster = function() {
  if (typeof firebaseDB === 'undefined' || !firebaseDB) {
    toast('Firebaseに接続されていません', 'error');
    return;
  }
  toast('商品マスタを最新に同期しています...', 'info');
  const fbKey = DB.toFirebaseKey(DB.KEYS.INV_PRODUCTS);
  firebaseDB.ref(fbKey).once('value')
    .then((snapshot) => {
      const data = snapshot.val();
      let parsedData = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
      parsedData = parsedData.filter(item => item !== null);
      DB._cache[DB.KEYS.INV_PRODUCTS] = parsedData;
      localStorage.setItem(DB.KEYS.INV_PRODUCTS, JSON.stringify(parsedData));
      toast('商品マスタを最新に更新しました', 'success');
      if (typeof renderInvCheckPage === 'function') renderInvCheckPage();
    })
    .catch(error => {
      console.error('マスタ再読込エラー:', error);
      toast('マスタの再読込に失敗しました', 'error');
    });
};

// 締め処理保存用のヘルパー関数（既存ロジック分離）
function saveInvMonthlyClosing(month, result) {
  const monthly = DB.get(DB.KEYS.INV_MONTHLY);
  const existingIndex = monthly.findIndex(m => m.month === month);

  const closingData = {
    month: month,
    items: result.items,
    summary: result.summary,
    total: result.total,
    fixedTotal: result.summary['fixed']?.amount || 0,
    closedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    monthly[existingIndex] = closingData;
  } else {
    monthly.push(closingData);
  }
  
  DB.save(DB.KEYS.INV_MONTHLY, monthly);
}

/**
 * 在庫ログから商品マスタへの同期（ユーザー要望: 4月機データ取込用）
 */
function syncInventoryToMaster(month) {
  const logs = DB.get(DB.KEYS.INV_LOGS);
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  
  // 指定された月のログ（Excel取込分）を抽出
  const monthLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith(month));
  
  if (monthLogs.length === 0) {
    toast(`${month}のログデータが見つかりません`, 'warning');
    return;
  }
  
  let addCount = 0;
  let updateCount = 0;
  
  monthLogs.forEach(log => {
    // IDまたは品名で重複チェック
    const existing = products.find(p => p.id === log.productId || (log.productName && p.name === log.productName));
    
    if (existing) {
      // 金額は上書き
      existing.price = log.unitPrice || existing.price;
      updateCount++;
    } else {
      // 新規登録
      products.push({
        id: log.productId,
        name: log.productName || log.productId,
        category: log.productId.startsWith('N') ? log.productId.substring(1, 3) : '99',
        price: log.unitPrice || 0,
        isFixed: false
      });
      addCount++;
    }
  });
  
  DB.save(DB.KEYS.INV_PRODUCTS, products);
  toast(`${month}のデータからマスタを更新しました（新規:${addCount}, 更新:${updateCount}）`, 'success');
  
  if (typeof renderInvProductsTable === 'function') renderInvProductsTable();
}

// グローバルに公開
window.syncInventoryToMaster = syncInventoryToMaster;

function displayProductInfo(productId) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const product = products.find(p => p.id === productId);
  const infoDiv = $('#inv-product-info');

  if (product) {
    const stock = getCurrentStock(productId);
    $('#inv-product-name').textContent = product.name;
    $('#inv-current-stock').textContent = stock;
    $('#inv-product-price').textContent = product.price.toLocaleString();
    infoDiv.style.display = 'block';
  } else {
    infoDiv.style.display = 'none';
  }
}

function startInvScanner() {
  const placeholder = $('#inv-scanner-placeholder');
  const videoEl = $('#inv-qr-video');
  const startBtn = $('#inv-start-scan-btn');
  const stopBtn = $('#inv-stop-scan-btn');

  // 二重起動防止
  if (invQrScanner) {
    console.log('Inventory Scanner is already running');
    return;
  }

  // 競合する他のスキャナーを停止
  stopQrScanner();
  const resultDiv = $('#inv-scan-result');

  if (placeholder) placeholder.style.display = 'none';
  if (videoEl) videoEl.style.display = 'block';
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'inline-block';
  if (resultDiv) resultDiv.style.display = 'none';

  if (typeof Html5Qrcode === 'undefined') {
    toast('QRスキャナーが読み込めません', 'error');
    return;
  }

  invQrScanner = new Html5Qrcode('inv-scanner-preview');

  invQrScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onInvQrScanned,
    () => { }
  ).catch(err => {
    console.error('カメラ起動エラー:', err);
    toast('カメラを起動できません', 'error');
    stopInvScanner();
  });
}

function stopInvScanner() {
  const placeholder = $('#inv-scanner-placeholder');
  const videoEl = $('#inv-qr-video');
  const startBtn = $('#inv-start-scan-btn');
  const stopBtn = $('#inv-stop-scan-btn');

  if (invQrScanner) {
    invQrScanner.stop().then(() => {
      invQrScanner.clear();
      invQrScanner = null;
    }).catch(err => console.log(err));
  }

  if (placeholder) placeholder.style.display = 'block';
  if (videoEl) videoEl.style.display = 'none';
  if (startBtn) startBtn.style.display = 'inline-block';
  if (stopBtn) stopBtn.style.display = 'none';
}

function onInvQrScanned(decodedText) {
  stopInvScanner();

  const rawScanned = decodedText.trim();
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const product = products.find(p => p.id === rawScanned || p.identCode === rawScanned);
  const finalId = product ? product.id : rawScanned;

  const resultDiv = $('#inv-scan-result');
  const dataDiv = $('#inv-scan-data');
  const productIdInput = $('#inv-scan-product-id');

  // 資材IDをセット
  productIdInput.value = finalId;
  displayProductInfo(finalId);

  if (resultDiv) resultDiv.style.display = 'block';
  if (dataDiv) dataDiv.innerHTML = `<div>読取データ: ${rawScanned}</div>`;

  if (navigator.vibrate) navigator.vibrate(100);
  toast('QRコードを読み取りました', 'success');

  // 数量入力欄にフォーカス
  setTimeout(() => $('#inv-scan-quantity')?.focus(), 100);
}

function submitInventoryCount() {
  const productId = $('#inv-scan-product-id').value.trim();
  const quantity = parseInt($('#inv-scan-quantity').value) || 0;

  if (!productId) {
    toast('資材IDを入力してください', 'error');
    return;
  }

  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const product = products.find(p => p.id === productId);

  if (!product) {
    showQuickProductRegisterModal(productId, quantity, false);
    return;
  }

  // 対象月の指定があれば、その月の末日をタイムスタンプとする
  let targetTimestamp = new Date().toISOString();
  let targetMonth = '';
  const monthInput = $('#inv-scan-month');
  if (monthInput && monthInput.value) {
    targetMonth = monthInput.value;
  } else {
    const now = new Date();
    targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // 棚卸仮データに追加 (INV_PRODUCTS 内への埋め込み UPSERT)
  DB.saveTempScan(productId, quantity, currentUser.username, currentUser.displayName, targetTimestamp, targetMonth);

  toast(`${product.name}の棚卸を仮登録しました（${quantity}個、締め処理待ち）`, 'success');

  // フォームリセット
  $('#inv-scan-product-id').value = '';
  $('#inv-scan-quantity').value = '';
  $('#inv-product-info').style.display = 'none';
  $('#inv-scan-result').style.display = 'none';

  // 履歴更新
  renderTodayInvLogs();

  // 連続スキャンモード（スマホ）
  if (isMobileDevice()) {
    setTimeout(() => startInvScanner(), 500);
  }
}

function renderTodayInvLogs() {
  const logs = DB.get(DB.KEYS.INV_LOGS) || [];
  const tempScans = DB.getTempScans() || [];
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const today = new Date().toISOString().split('T')[0];

  const todayLogs = [
    ...tempScans.map(t => ({ ...t, type: 'count_temp', timestamp: t.timestamp || new Date().toISOString() })),
    ...logs
  ].filter(log => log.timestamp.startsWith(today)).reverse().slice(0, 10);
  
  const container = $('#inv-today-logs');

  if (todayLogs.length === 0) {
    container.innerHTML = '<p class="text-muted">本日の履歴がありません</p>';
    return;
  }

  container.innerHTML = todayLogs.map(log => {
    const product = products.find(p => p.id === log.productId);
    const typeLabel = log.type === 'count_temp' ? '棚卸(仮)' : log.type === 'count' ? '棚卸' : log.type === 'in' ? '入庫' : '出庫';
    const time = new Date(log.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `
      <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--color-bg-secondary); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
        <div>
          <div style="font-weight: 500;">${product?.name || log.productId}</div>
          <div style="font-size: 0.8125rem; color: var(--color-text-muted);">${typeLabel}: ${log.quantity}個</div>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-muted);">${time}</div>
      </div>
    `;
  }).join('');
}

// ========================================
// 在庫検索画面
// ========================================

function renderInvSearchPage() {
  const searchBtn = $('#inv-search-btn');
  const keywordInput = $('#inv-search-keyword');

  if (searchBtn) searchBtn.onclick = executeInvSearch;
  if (keywordInput) {
    keywordInput.onkeypress = (e) => {
      if (e.key === 'Enter') executeInvSearch();
    };
    // 初期表示で全件表示
    executeInvSearch();
  }
}

function executeInvSearch() {
  const keyword = ($('#inv-search-keyword')?.value || '').toLowerCase().trim();
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const tbody = $('#inv-search-results');

  let filtered = products;
  if (keyword) {
    filtered = products.filter(p =>
      p.id.toLowerCase().includes(keyword) ||
      p.name.toLowerCase().includes(keyword) ||
      (INV_CATEGORIES[p.category] || '').toLowerCase().includes(keyword)
    );
  }

  tbody.innerHTML = filtered.map(p => {
    const stock = getCurrentStock(p.id);
    const amount = stock * p.price;
    return `
      <tr>
        <td>${p.id}</td>
        <td>${INV_CATEGORIES[p.category] || p.category}</td>
        <td>${p.name}</td>
        <td>${stock}</td>
        <td>¥${p.price.toLocaleString()}</td>
        <td>¥${amount.toLocaleString()}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6" class="text-muted text-center">該当なし</td></tr>';
}

// ========================================
// 商品マスタ画面
// ========================================

function renderInvProductsPage() {
  // カテゴリフィルタ初期化
  const categoryFilter = $('#inv-products-category-filter');
  categoryFilter.innerHTML = '<option value="">全分類</option>' +
    Object.entries(INV_CATEGORIES).map(([code, name]) =>
      `<option value="${code}">${code}: ${name}</option>`
    ).join('');

  // イベント設定
  categoryFilter.onchange = renderInvProductsTable;
  $('#inv-products-search').oninput = renderInvProductsTable;
  $('#inv-products-fixed-only').onchange = renderInvProductsTable;
  $('#add-inv-product-btn').onclick = showAddInvProductModal;

  // CSV取り込み・エクスポート
  $('#import-inv-csv-btn').onclick = showCsvImportArea;
  $('#export-inv-csv-btn').onclick = exportInvProductsCsv;
  $('#print-inv-qrs-btn').onclick = printInvProductsQrs;
  $('#execute-csv-import-btn').onclick = executeInvCsvImport;
  $('#cancel-csv-import-btn').onclick = hideCsvImportArea;
  $('#csv-file-input').onchange = previewCsvFile;

  // テーブル描画
  renderInvProductsTable();
}

function renderInvProductsTable() {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const categoryFilter = $('#inv-products-category-filter').value;
  const searchKeyword = ($('#inv-products-search').value || '').toLowerCase();
  const fixedOnly = $('#inv-products-fixed-only').checked;

  let filtered = products.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (fixedOnly && !p.isFixed) return false;
    if (searchKeyword && !p.id.toLowerCase().includes(searchKeyword) && !p.name.toLowerCase().includes(searchKeyword)) return false;
    return true;
  });

  const tbody = $('#inv-products-body');
  const usageStats = calculateUsageStats(); // 基準在庫算出用データ取得

  $('#inv-products-count').textContent = products.length; // 登録件数表示

  tbody.innerHTML = filtered.map(p => {
    // 基準在庫（参考値）の取得
    const stat = usageStats[p.id];
    const suggested = stat ? Math.ceil((stat.totalUsage / stat.months) * 1.5) : '-';

    return `
    <tr class="${p.isFixed ? 'fixed-product-row' : ''}">
      <td>${p.identCode || p.id}</td>
      <td>${INV_CATEGORIES[p.category] || p.category}</td>
      <td>${p.name}</td>
      <td>¥${p.price.toLocaleString()}</td>
      <td>${suggested.toLocaleString()}</td>
      <td>${p.isFixed ? '✓' : ''}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editInvProduct('${p.id}')">編集</button>
        <button class="btn btn-sm btn-danger" onclick="deleteInvProduct('${p.id}')">削除</button>
      </td>
    </tr>
  `;
  }).join('');
}

/**
 * 過去の在庫増減から平均的な消費動向を算出
 */
function calculateUsageStats() {
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
  const logs = DB.get(DB.KEYS.INV_LOGS) || [];
  const stats = {}; // { productId: { totalUsage: 0, months: 0 } }
  
  if (monthly.length >= 2) {
    // 月次締めデータがある場合、月ごとの在庫減を算出
    const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1];
      const curr = sorted[i];
      curr.items.forEach(item => {
        const prevItem = prev.items.find(pi => pi.productId === item.productId);
        if (prevItem) {
          const usage = Math.max(0, prevItem.currQty - item.currQty);
          if (usage > 0) {
            if (!stats[item.productId]) stats[item.productId] = { totalUsage: 0, months: 0 };
            stats[item.productId].totalUsage += usage;
            stats[item.productId].months += 1;
          }
        }
      });
    }
  }

  // 直近1ヶ月の出庫（out）ログも考慮（月次締めがない場合や最新データの補完）
  const outLogs = logs.filter(l => l.type === 'out');
  outLogs.forEach(log => {
    if (!stats[log.productId]) stats[log.productId] = { totalUsage: 0, months: 0 };
    stats[log.productId].totalUsage += (log.quantity || 0);
    // 月次締めがない場合、暫定的に1ヶ月分としてカウント
    if (stats[log.productId].months === 0) stats[log.productId].months = 1;
  });

  return stats;
}

function showAddInvProductModal() {
  $('#modal-title').textContent = '商品登録';
  $('#modal-body').innerHTML = `
    <form id="inv-product-form" style="display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
      <div class="form-group">
        <label>識別コード分類(必須)</label>
        <select id="inv-prod-category" class="form-input" required>
          ${Object.entries(INV_CATEGORIES).map(([code, name]) =>
    `<option value="${code}">${code}: ${name}</option>`
  ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>品名(必須)</label>
        <input type="text" id="inv-prod-name" class="form-input" required>
      </div>
      <div class="form-group">
        <label>資材区分</label>
        <input type="text" id="inv-prod-material-type" class="form-input">
      </div>
      <div class="form-group">
        <label>単価</label>
        <input type="number" id="inv-prod-price" class="form-input" min="0" required value="0">
      </div>
      <div class="form-group">
        <label>色/他</label>
        <input type="text" id="inv-prod-color" class="form-input">
      </div>
      <div class="form-group">
        <label>寸法 (巾/長さ/t厚み)</label>
        <div style="display: flex; gap: 4px;">
          <input type="text" id="inv-prod-width" class="form-input" placeholder="巾">
          <input type="text" id="inv-prod-length" class="form-input" placeholder="長さ">
          <input type="text" id="inv-prod-thickness" class="form-input" placeholder="t厚み">
        </div>
      </div>
      <div class="form-group">
        <label>単位</label>
        <input type="text" id="inv-prod-unit" class="form-input">
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="inv-prod-fixed"> 不動品（変動なし）</label>
      </div>
    </form>
  `;
  $('#modal-footer').innerHTML = `
    <button class="btn btn-secondary" id="modal-cancel">キャンセル</button>
    <button class="btn btn-primary" id="modal-save">登録</button>
  `;
  $('#modal-overlay').classList.remove('hidden');

  $('#modal-cancel').onclick = hideModal;
  $('#modal-close').onclick = hideModal;
  $('#modal-save').onclick = saveNewInvProduct;
}

function saveNewInvProduct() {
  const category = $('#inv-prod-category').value;
  const name = $('#inv-prod-name').value.trim();
  const price = parseFloat($('#inv-prod-price').value) || 0;
  const isFixed = $('#inv-prod-fixed').checked;
  const materialType = $('#inv-prod-material-type').value.trim();
  const colorOther = $('#inv-prod-color').value.trim();
  const width = $('#inv-prod-width').value.trim();
  const length = $('#inv-prod-length').value.trim();
  const thickness = $('#inv-prod-thickness').value.trim();
  const unit = $('#inv-prod-unit').value.trim();

  if (!name) {
    toast('品名を入力してください', 'error');
    return;
  }

  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];

  // ID自動採番
  const existingNums = products
    .filter(p => p.identClass === category || p.category === category || p.id.startsWith(category + '-'))
    .map(p => parseInt(p.id.split('-')[1]) || 0);
  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
  const newIdentCode = `${category}-${nextNum}`;
  const newMaterialCode = `N${category}${String(nextNum).padStart(13, '0')}`;

  products.push({
    id: newIdentCode,
    name: name,
    category: category,
    price: price,
    isFixed: isFixed,
    materialCode: newMaterialCode,
    materialType: materialType,
    identClass: category,
    identOrder: nextNum.toString(),
    colorOther: colorOther,
    width: width,
    length: length,
    thickness: thickness,
    unit: unit
  });
  DB.save(DB.KEYS.INV_PRODUCTS, products);

  toast(`${name}を登録しました（${newId}）`, 'success');
  hideModal();
  renderInvProductsTable();
}

function editInvProduct(id) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const product = products.find(p => p.id === id);
  if (!product) return;

  $('#modal-title').textContent = '商品編集';
  $('#modal-body').innerHTML = `
    <form id="inv-product-form" style="display: grid; grid-template-columns: 1fr; gap: 0.5rem;">
      <div class="form-group">
        <label>資材ID(システム内コード)</label>
        <input type="text" class="form-input" value="${product.id}" disabled>
      </div>
      <div class="form-group">
        <label>識別コード(QR表示用)</label>
        <input type="text" id="inv-prod-ident-code" class="form-input" value="${product.identCode || product.id}">
      </div>
      <div class="form-group">
        <label>識別コード分類(必須)</label>
        <select id="inv-prod-category" class="form-input" required>
          ${Object.entries(INV_CATEGORIES).map(([code, name]) =>
    `<option value="${code}" ${product.identClass === code || product.category === code ? 'selected' : ''}>${code}: ${name}</option>`
  ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>品名(必須)</label>
        <input type="text" id="inv-prod-name" class="form-input" value="${product.name}" required>
      </div>
      <div class="form-group">
        <label>資材区分</label>
        <input type="text" id="inv-prod-material-type" class="form-input" value="${product.materialType || ''}">
      </div>
      <div class="form-group">
        <label>単価</label>
        <input type="number" id="inv-prod-price" class="form-input" value="${product.price}" min="0" required>
      </div>
      <div class="form-group">
        <label>色/他</label>
        <input type="text" id="inv-prod-color" class="form-input" value="${product.colorOther || ''}">
      </div>
      <div class="form-group">
        <label>寸法 (巾/長さ/t厚み)</label>
        <div style="display: flex; gap: 4px;">
          <input type="text" id="inv-prod-width" class="form-input" value="${product.width || ''}" placeholder="巾">
          <input type="text" id="inv-prod-length" class="form-input" value="${product.length || ''}" placeholder="長さ">
          <input type="text" id="inv-prod-thickness" class="form-input" value="${product.thickness || ''}" placeholder="t厚み">
        </div>
      </div>
      <div class="form-group">
        <label>単位</label>
        <input type="text" id="inv-prod-unit" class="form-input" value="${product.unit || ''}" placeholder="例: 枚, 個, ヶ, 式">
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="inv-prod-fixed" ${product.isFixed ? 'checked' : ''}> 不動品（変動なし）</label>
      </div>
    </form>
  `;
  $('#modal-footer').innerHTML = `
    <button class="btn btn-secondary" id="modal-cancel">キャンセル</button>
    <button class="btn btn-primary" id="modal-save">更新</button>
  `;
  $('#modal-overlay').classList.remove('hidden');

  $('#modal-cancel').onclick = hideModal;
  $('#modal-close').onclick = hideModal;
  $('#modal-save').onclick = () => updateInvProduct(id);
}

function updateInvProduct(id) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return;

  const category = $('#inv-prod-category').value;
  products[idx].identClass = category;
  products[idx].category = category;
  products[idx].identCode = $('#inv-prod-ident-code').value.trim();
  products[idx].name = $('#inv-prod-name').value.trim();
  products[idx].price = parseFloat($('#inv-prod-price').value) || 0;
  products[idx].isFixed = $('#inv-prod-fixed').checked;
  products[idx].materialType = $('#inv-prod-material-type').value.trim();
  products[idx].colorOther = $('#inv-prod-color').value.trim();
  products[idx].width = $('#inv-prod-width').value.trim();
  products[idx].length = $('#inv-prod-length').value.trim();
  products[idx].thickness = $('#inv-prod-thickness').value.trim();
  products[idx].unit = $('#inv-prod-unit').value.trim();

  DB.save(DB.KEYS.INV_PRODUCTS, products);
  toast('更新しました', 'success');
  hideModal();
  renderInvProductsTable();
}

function deleteInvProduct(id) {
  if (!confirm('この商品を削除しますか？')) return;

  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const filtered = products.filter(p => p.id !== id);
  DB.save(DB.KEYS.INV_PRODUCTS, filtered);
  toast('削除しました', 'success');
  renderInvProductsTable();
}

// ========================================
// 在庫増減画面
// ========================================

function renderInvAdjustPage() {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const productSelect = $('#inv-adjust-product');

  productSelect.innerHTML = '<option value="">選択してください</option>' +
    products.map(p => `<option value="${p.id}">${p.id}: ${p.name}</option>`).join('');

  const form = $('#inv-adjust-form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      submitInvAdjust();
    };
  }

  renderInvAdjustLogs();
}

function submitInvAdjust() {
  const type = $('#inv-adjust-type').value;
  const productId = $('#inv-adjust-product').value;
  const quantity = parseInt($('#inv-adjust-quantity').value) || 0;
  const note = $('#inv-adjust-note').value.trim();

  if (!productId || quantity <= 0) {
    toast('商品と数量を入力してください', 'error');
    return;
  }

  const logs = DB.get(DB.KEYS.INV_LOGS);
  logs.push({
    id: Date.now(),
    productId: productId,
    quantity: quantity,
    type: type,
    worker: currentUser.displayName,
    note: note,
    timestamp: new Date().toISOString()
  });
  DB.save(DB.KEYS.INV_LOGS, logs);

  const typeLabel = type === 'in' ? '入庫' : '出庫';
  toast(`${typeLabel}を登録しました`, 'success');

  $('#inv-adjust-product').value = '';
  $('#inv-adjust-quantity').value = '';
  $('#inv-adjust-note').value = '';

  renderInvAdjustLogs();
}

function renderInvAdjustLogs() {
  const logs = DB.get(DB.KEYS.INV_LOGS).filter(l => l.type !== 'count').reverse().slice(0, 20);
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const container = $('#inv-adjust-logs');

  if (logs.length === 0) {
    container.innerHTML = '<p class="text-muted">履歴がありません</p>';
    return;
  }

  container.innerHTML = logs.map(log => {
    const product = products.find(p => p.id === log.productId);
    const typeLabel = log.type === 'in' ? '➕入庫' : '➖出庫';
    const date = new Date(log.timestamp).toLocaleDateString('ja-JP');
    return `
      <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: var(--color-bg-secondary); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
        <div>
          <div style="font-weight: 500;">${product?.name || log.productId}</div>
          <div style="font-size: 0.8125rem; color: var(--color-text-muted);">${typeLabel}: ${log.quantity}個 ${log.note ? `(${log.note})` : ''}</div>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-text-muted);">${date}</div>
      </div>
    `;
  }).join('');
}

// ========================================
// 月次締め画面
// ========================================

function renderInvMonthlyPage() {
  // 当月をデフォルト設定
  const monthInput = $('#inv-closing-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = new Date().toISOString().substring(0, 7);
  }

  // 年度チェック表の年度デフォルト設定
  const yearInput = $('#inv-annual-year');
  if (yearInput && !yearInput.value) {
    yearInput.value = new Date().getFullYear();
  }

  $('#view-inv-monthly-btn').onclick = viewInvMonthlySummary;
  $('#run-inv-closing-btn').onclick = runInvMonthlyClosing;
  const undoInvBtn = $('#undo-inv-closing-btn');
  if (undoInvBtn) undoInvBtn.onclick = undoInvMonthlyClosing;
  
  if ($('#export-inv-monthly-btn')) {
    $('#export-inv-monthly-btn').onclick = exportInvMonthlyExcel;
  }
  if ($('#view-inv-annual-btn')) {
    $('#view-inv-annual-btn').onclick = viewInvAnnualSummary;
  }
  if ($('#export-inv-annual-btn')) {
    $('#export-inv-annual-btn').onclick = exportInvAnnualExcel;
  }
}

// 現在表示中の月次締め結果を保持（Excel出力用）
let currentMonthlyResult = null;

function viewInvMonthlySummary() {
  const month = $('#inv-closing-month').value;
  if (!month) {
    toast('年月を選択してください', 'error');
    return;
  }

  const result = calculateInvMonthly(month);
  currentMonthlyResult = result;
  displayInvMonthlyResult(result);
  
  if ($('#export-inv-monthly-btn')) {
    $('#export-inv-monthly-btn').style.display = 'inline-block';
  }
}

function exportInvMonthlyExcel() {
  if (!currentMonthlyResult) {
    toast('まず集計確認を行ってください', 'warning');
    return;
  }
  
  if (typeof XLSX === 'undefined') {
    toast('Excel出力ライブラリが読み込まれていません', 'error');
    return;
  }
  
  try {
    const wb = XLSX.utils.book_new();
    const month = currentMonthlyResult.month;
    
    // シート1: 分類別集計
    const summaryData = [
      ['資材分類', '分類名', '当月在庫金額', '前月比']
    ];
    let summaryTotal = 0, summaryDiff = 0;
    
    // カテゴリ順
    Object.keys(INV_CATEGORIES).forEach(code => {
      if (currentMonthlyResult.summary[code]) {
        const s = currentMonthlyResult.summary[code];
        summaryData.push([code, s.name, s.amount, s.diff]);
        summaryTotal += s.amount;
        summaryDiff += s.diff;
      }
    });
    // 不動品
    if (currentMonthlyResult.summary['fixed']) {
      const s = currentMonthlyResult.summary['fixed'];
      summaryData.push(['fixed', '不動品', s.amount, s.diff]);
      summaryTotal += s.amount;
      summaryDiff += s.diff;
    }
    
    summaryData.push(['', '合計', summaryTotal, summaryDiff]);
    summaryData.push(['', '1.01（TAC口銭1%）', Math.round(summaryTotal * 1.01), '']);
    
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, '月次集計');
    
    // シート2: 商品別明細
    const itemsData = [
      ['資材ID', '品名', '分類', '単価', '前月在庫', '当月在庫', '差分', '在庫金額']
    ];
    
    // 品番順にソートして出力
    const sortedItems = [...currentMonthlyResult.items].sort((a, b) => a.productId.localeCompare(b.productId));
    
    sortedItems.forEach(i => {
      itemsData.push([
        i.productId,
        i.name,
        INV_CATEGORIES[i.category] || i.category,
        i.price,
        i.prevQty,
        i.currQty,
        i.diff,
        i.amount
      ]);
    });
    
    const wsItems = XLSX.utils.aoa_to_sheet(itemsData);
    XLSX.utils.book_append_sheet(wb, wsItems, '商品別明細');
    
    // ダウンロード
    XLSX.writeFile(wb, `棚卸月次集計_${month}.xlsx`);
    toast('Excelファイルを出力しました', 'success');
  } catch (err) {
    console.error('Excel出力エラー:', err);
    toast('Excel出力に失敗しました', 'error');
  }
}

function calculateInvMonthly(month) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const logs = DB.get(DB.KEYS.INV_LOGS);
  const monthly = DB.get(DB.KEYS.INV_MONTHLY);

  // 前月データを取得
  const prevDate = new Date(month + '-01');
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = prevDate.toISOString().substring(0, 7);
  const prevData = monthly.find(m => m.month === prevMonth);
  
  // 当月がすでに締め済みか確認
  const isClosed = monthly.some(m => m.month === month);
  if (isClosed) {
    const savedData = monthly.find(m => m.month === month);
    if (savedData && savedData.items) {
      return savedData;
    }
  }

  // 当月のログをフィルタ
  const monthLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith(month));
  
  // CSV取込ログかどうか判定
  const csvLogs = monthLogs.filter(l => l.type === 'count' && l.amountWithTax > 0);
  const isCsvImport = csvLogs.length > 0;
  
  const items = [];
  const summary = {};
  
  if (isCsvImport) {
    const productMap = new Map();
    csvLogs.forEach(log => {
      const pid = log.productId;
      if (!productMap.has(pid)) {
        productMap.set(pid, {
          productId: pid,
          name: log.productName || pid,
          category: pid.includes('-') ? pid.split('-')[0] : ((pid.startsWith('N') && pid.length > 3) ? pid.substring(1, 3) : '99'),
          price: log.unitPrice || 0,
          prevQty: 0,
          currQty: log.quantity || 0,
          diff: log.quantity || 0,
          amount: Math.round(log.amountWithTax || 0),
          isFixed: false,
          prevAmount: 0
        });
      } else {
        const existing = productMap.get(pid);
        existing.currQty += log.quantity || 0;
        existing.diff += log.quantity || 0;
        existing.amount += Math.round(log.amountWithTax || 0);
      }
    });

    if (prevData && prevData.items) {
      prevData.items.forEach(prevItem => {
        if (!productMap.has(prevItem.productId)) {
          productMap.set(prevItem.productId, {
            productId: prevItem.productId,
            name: prevItem.name,
            category: prevItem.category,
            price: prevItem.price,
            prevQty: prevItem.currQty,
            currQty: 0,
            diff: -prevItem.currQty,
            amount: 0,
            isFixed: prevItem.isFixed,
            prevAmount: Math.round(prevItem.amount || 0)
          });
        }
      });
    }
    
    productMap.forEach((item, pid) => {
      const masterProduct = products.find(p => p.id === pid);
      if (masterProduct) {
        item.name = item.name === pid ? masterProduct.name : item.name;
        item.category = masterProduct.category;
        item.price = item.price === 0 ? masterProduct.price : item.price;
        item.isFixed = !!masterProduct.isFixed;
      }
      
      if (prevData && prevData.items) {
        const prevItem = prevData.items.find(i => i.productId === pid);
        if (prevItem) {
          item.prevQty = prevItem.currQty;
          item.prevAmount = Math.round(prevItem.amount || 0);
          item.diff = item.currQty - item.prevQty;
        }
      }
      
      items.push(item);
      
      const catKey = item.isFixed ? 'fixed' : item.category;
      if (!summary[catKey]) {
        summary[catKey] = { name: item.isFixed ? '不動品' : (INV_CATEGORIES[item.category] || `分類${item.category}`), amount: 0, diff: 0, prevAmount: 0 };
      }
      summary[catKey].amount += item.amount;
      summary[catKey].prevAmount += (item.prevAmount || 0);
    });
    
  } else {
    // 手動入力/スキャンモード
    const productIds = new Set(products.map(p => p.id));
    if (prevData && prevData.items) {
      prevData.items.forEach(i => productIds.add(i.productId));
    }

    productIds.forEach(pid => {
      const p = products.find(x => x.id === pid) || {
        id: pid,
        name: pid,
        category: pid.includes('-') ? pid.split('-')[0] : ((pid.startsWith('N') && pid.length > 3) ? pid.substring(1, 3) : '99'),
        price: 0,
        isFixed: false
      };

      let prevQty = 0;
      let prevAmount = 0;
      if (prevData && prevData.items) {
        const prevItem = prevData.items.find(i => i.productId === pid);
        if (prevItem) {
          prevQty = prevItem.currQty;
          prevAmount = Math.round(prevItem.amount || 0);
          if (!products.find(x => x.id === pid)) {
            p.name = prevItem.name;
            p.category = prevItem.category;
            p.price = prevItem.price;
            p.isFixed = prevItem.isFixed;
          }
        }
      }

      // 未締めかつログなしの場合は0にする（ユーザー要望）
      let currQty = prevQty;
      const productLogs = monthLogs.filter(l => l.productId === pid);
      if (!isClosed && monthLogs.length === 0) {
          currQty = 0;
      } else {
          productLogs.forEach(log => {
            if (log.type === 'count') {
              currQty = log.quantity;
            } else if (log.type === 'in') {
              currQty += log.quantity;
            } else if (log.type === 'out') {
              currQty -= log.quantity;
            }
          });
          if (p.isFixed && productLogs.length === 0) {
            currQty = prevQty;
          }
      }

      const diff = currQty - prevQty;
      const amount = Math.round(currQty * p.price);

      items.push({
        productId: pid,
        name: p.name,
        category: p.category,
        price: p.price,
        prevQty: prevQty,
        currQty: currQty,
        diff: diff,
        amount: amount,
        isFixed: p.isFixed,
        prevAmount: prevAmount
      });

      const catKey = p.isFixed ? 'fixed' : p.category;
      if (!summary[catKey]) {
        summary[catKey] = { name: p.isFixed ? '不動品' : (INV_CATEGORIES[p.category] || 'その他'), amount: 0, diff: 0, prevAmount: 0 };
      }
      summary[catKey].amount += amount;
      summary[catKey].prevAmount += prevAmount;
    });
  }

  // 分類別前月比の計算
  Object.keys(summary).forEach(k => {
    summary[k].diff = summary[k].amount - summary[k].prevAmount;
  });

  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const prevTotal = items.reduce((sum, i) => sum + (i.prevAmount || 0), 0);

  return { month, items, summary, total, prevTotal };
}

window.saveSingleTempScan = function(productId) {
  const input = document.getElementById(`inv-check-qty-${productId}`);
  if (!input) return;
  const newQty = parseInt(input.value) || 0;
  const selectedMonth = $('#inv-check-month').value || new Date().toISOString().substring(0, 7);

  const [y, m] = selectedMonth.split('-');
  const lastDay = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59);
  const timestamp = lastDay.toISOString();
  const user = window.currentUser || DB.get(DB.KEYS.CURRENT_USER) || {};

  // Firebase のルールエラーを回避しつつ古いデータも生かすため、新規・更新分はすべて INV_PRODUCTS に保存する
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const prodIndex = products.findIndex(p => p.id === productId);
  
  if (prodIndex !== -1) {
    products[prodIndex].tempQty = newQty;
    products[prodIndex].tempWorker = user.username || 'unknown';
    products[prodIndex].tempWorkerName = user.displayName || '不明な作業者';
    products[prodIndex].tempTimestamp = timestamp;
    products[prodIndex].tempMonth = selectedMonth;
    delete products[prodIndex].tempId;
    
    DB.save(DB.KEYS.INV_PRODUCTS, products);
    toast('仮登録数量を保存しました', 'success');
  } else {
    toast('対象の資材が見つかりません', 'error');
  }

  renderInvCheckPage();
};

window.deleteSingleTempScan = function(productId) {
  if (!confirm('仮スキャンデータを消去しますか？')) return;
  
  // INV_PRODUCTS 側のテンポラリデータを削除
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const prodIndex = products.findIndex(p => p.id === productId);
  if (prodIndex !== -1) {
    delete products[prodIndex].tempQty;
    delete products[prodIndex].tempWorker;
    delete products[prodIndex].tempWorkerName;
    delete products[prodIndex].tempTimestamp;
    delete products[prodIndex].tempMonth;
    delete products[prodIndex].tempId;
    DB.save(DB.KEYS.INV_PRODUCTS, products);
  }

  // もし INV_LOGS 側にも残っていたら、念のため消去を試みる（ルールで弾かれる可能性はあるがローカルからは消える）
  const tempScans = DB.getTempScans() || [];
  const scan = tempScans.find(s => s.productId === productId);
  if (scan && scan.id && scan.id !== productId) {
    DB.deleteTempScan(scan.id);
  }
  
  toast('仮スキャンデータから削除しました', 'success');
  renderInvCheckPage();
};

function displayInvMonthlyResult(result) {
  const container = $('#inv-monthly-result');

  // 分類別集計表
  let summaryRows = '';
  let summaryTotal = 0, summaryDiff = 0;
  let normalTotal = 0, fixedTotal = 0;

  // カテゴリデータを収集
  const categoryData = [];

  // カテゴリ順にソートしてループ
  const sortedCodes = Object.keys(INV_CATEGORIES).sort((a, b) => a.localeCompare(b));
  
  sortedCodes.forEach(code => {
    if (result.summary[code]) {
      const s = result.summary[code];
      const roundedAmount = Math.round(s.amount);
      const roundedDiff = Math.round(s.diff);
      summaryRows += `<tr><td>${code}: ${s.name}</td><td style="text-align: right;">¥${roundedAmount.toLocaleString()}</td><td style="text-align: right; color: ${roundedDiff >= 0 ? 'green' : 'red'};">${roundedDiff >= 0 ? '+' : ''}¥${roundedDiff.toLocaleString()}</td></tr>`;
      summaryTotal += roundedAmount;
      summaryDiff += roundedDiff;
      normalTotal += roundedAmount;
      categoryData.push({ name: s.name, amount: roundedAmount, isFixed: false });
    }
  });

  // 不動品
  if (result.summary['fixed']) {
    const s = result.summary['fixed'];
    const roundedAmount = Math.round(s.amount);
    const roundedDiff = Math.round(s.diff);
    summaryRows += `<tr class="row-fixed-product"><td>不動品</td><td style="text-align: right;">¥${roundedAmount.toLocaleString()}</td><td style="text-align: right; color: ${roundedDiff >= 0 ? 'green' : 'red'};">${roundedDiff >= 0 ? '+' : ''}¥${roundedDiff.toLocaleString()}</td></tr>`;
    summaryTotal += roundedAmount;
    summaryDiff += roundedDiff;
    fixedTotal = roundedAmount;
    categoryData.push({ name: '不動品', amount: roundedAmount, isFixed: true });
  }

  const tacTotal = Math.round(summaryTotal * 1.01);

  // 分類別グラフバー生成
  const sortedCategories = categoryData.sort((a, b) => b.amount - a.amount);
  const categoryBars = sortedCategories.map(cat => {
    const barWidth = summaryTotal > 0 ? Math.round((cat.amount / summaryTotal) * 100) : 0;
    const bgColor = cat.isFixed ? '#ffc107' : '#2563eb';
    return `
      <div style="margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.875rem;">
          <span>${cat.name}</span>
          <span style="font-weight: 500;">¥${cat.amount.toLocaleString()} (${barWidth}%)</span>
        </div>
        <div style="background: #e2e8f0; border-radius: 4px; height: 16px; overflow: hidden;">
          <div style="background: ${bgColor}; height: 100%; width: ${barWidth}%; transition: width 0.3s;"></div>
        </div>
      </div>
    `;
  }).join('');

  // ドーナツ風サマリー
  const normalPercent = summaryTotal > 0 ? Math.round((normalTotal / summaryTotal) * 100) : 0;
  const fixedPercent = summaryTotal > 0 ? Math.round((fixedTotal / summaryTotal) * 100) : 0;
  const totalDiff = Math.round(result.total - result.prevTotal);

  container.innerHTML = `
    <!-- サマリーカード -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="card" style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 1.25rem; box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);">
        <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">📦 在庫金額合計</div>
        <div style="font-size: 1.5rem; font-weight: bold;">¥${summaryTotal.toLocaleString()}</div>
        <div style="font-size: 0.75rem; opacity: 0.9; margin-top: 4px;">
            前月比: <span style="font-weight: bold;">${totalDiff >= 0 ? '+' : ''}¥${totalDiff.toLocaleString()}</span>
        </div>
      </div>
      <div class="card" style="background: linear-gradient(135deg, #10b981, #34d399); color: white; padding: 1.25rem;">
        <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">✓ 通常在庫</div>
        <div style="font-size: 1.5rem; font-weight: bold;">¥${normalTotal.toLocaleString()}</div>
        <div style="font-size: 0.75rem; opacity: 0.8;">${normalPercent}%</div>
      </div>
      <div class="card" style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; padding: 1.25rem;">
        <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">⚠ 不動品在庫</div>
        <div style="font-size: 1.5rem; font-weight: bold;">¥${fixedTotal.toLocaleString()}</div>
        <div style="font-size: 0.75rem; opacity: 0.8;">${fixedPercent}%</div>
      </div>
      <div class="card" style="background: linear-gradient(135deg, #8b5cf6, #a78bfa); color: white; padding: 1.25rem;">
        <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">💰 TAC口銭込</div>
        <div style="font-size: 1.5rem; font-weight: bold;">¥${tacTotal.toLocaleString()}</div>
        <div style="font-size: 0.75rem; opacity: 0.8;">×1.01</div>
      </div>
    </div>

    <!-- グラフとテーブル -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
      <!-- 分類別グラフ -->
      <div class="card">
        <div class="card-header">
          <h3>📊 分類別構成比</h3>
        </div>
        <div class="card-body">
          ${categoryBars || '<p class="text-muted">データがありません</p>'}
        </div>
      </div>
      
      <!-- 分類別集計表 -->
      <div class="card">
        <div class="card-header">
          <h3>📋 ${result.month} 分類別集計表</h3>
        </div>
        <div class="card-body">
          <table class="table">
            <thead>
              <tr>
                <th>資材分類</th>
                <th style="text-align: right;">当月在庫金額</th>
                <th style="text-align: right;">前月比</th>
              </tr>
            </thead>
            <tbody>
              ${summaryRows}
              <tr style="font-weight: bold; background: var(--color-bg-secondary);">
                <td>合計</td>
                <td style="text-align: right;">¥${summaryTotal.toLocaleString()}</td>
                <td style="text-align: right; color: ${summaryDiff >= 0 ? 'green' : 'red'};">${summaryDiff >= 0 ? '+' : ''}¥${summaryDiff.toLocaleString()}</td>
              </tr>
              <tr class="row-tac-fee">
                <td>1.01（TAC口銭1%）</td>
                <td style="text-align: right;">¥${tacTotal.toLocaleString()}</td>
                <td style="text-align: right;">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 商品別明細 -->
    <div class="card">
      <div class="card-header">
        <h3>📋 商品別明細</h3>
      </div>
      <div class="card-body">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>資材ID</th>
                <th>品名</th>
                <th>単価</th>
                <th>前月在庫</th>
                <th>当月在庫</th>
                <th>差分</th>
                <th>在庫金額</th>
              </tr>
            </thead>
            <tbody>
              ${result.items.map(i => `
                <tr class="${i.isFixed ? 'row-fixed-product' : ''}">
                  <td>${i.productId}</td>
                  <td>${i.name}</td>
                  <td>¥${i.price.toLocaleString()}</td>
                  <td>${i.prevQty}</td>
                  <td>${i.currQty}</td>
                  <td style="color: ${i.diff >= 0 ? 'green' : 'red'};">${i.diff >= 0 ? '+' : ''}${i.diff}</td>
                  <td>¥${i.amount.toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  `;
}

// 年度別データ保持用
let currentAnnualResult = null;

function viewInvAnnualSummary() {
  const year = $('#inv-annual-year').value;
  if (!year) {
    toast('表示年度を入力してください', 'warning');
    return;
  }
  
  const container = $('#inv-annual-result');
  container.innerHTML = '<p>データ集計中...</p>';
  container.style.display = 'block';
  
  // setTimeoutを使ってUIがブロックされるのを防ぐ
  setTimeout(() => {
    try {
      const monthlyData = [];
      const productsMap = new Map();
      
      // 1〜12月のデータを計算
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${String(m).padStart(2, '0')}`;
        const result = calculateInvMonthly(monthStr);
        monthlyData.push(result);
        
        result.items.forEach(item => {
          if (!productsMap.has(item.productId)) {
            productsMap.set(item.productId, {
              productId: item.productId,
              name: item.name,
              category: item.category,
              price: item.price,
              isFixed: item.isFixed,
              qty: Array(12).fill(null)
            });
          }
          productsMap.get(item.productId).qty[m - 1] = item.currQty;
        });
      }
      
      // マスタ順にソート
      const sortedItems = Array.from(productsMap.values()).sort((a, b) => a.productId.localeCompare(b.productId));
      
      currentAnnualResult = { year, items: sortedItems };
      
      // テーブル生成
      let tableHTML = `
        <div class="table-container" style="max-height: 500px; overflow: auto;">
          <table class="table" style="font-size: 0.8rem; white-space: nowrap;">
            <thead style="position: sticky; top: 0; background: var(--color-bg-secondary); z-index: 10;">
              <tr>
                <th>資材ID</th>
                <th>品名</th>
                <th>分類</th>
                ${Array.from({length: 12}, (_, i) => `<th style="text-align: right;">${i+1}月</th>`).join('')}
              </tr>
            </thead>
            <tbody>
      `;
      
      sortedItems.forEach(item => {
        let rowHTML = `<tr>
          <td>${item.productId}</td>
          <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</td>
          <td>${INV_CATEGORIES[item.category] || item.category}</td>
        `;
        
        for (let i = 0; i < 12; i++) {
          const currentQty = item.qty[i];
          const prevQty = i > 0 ? item.qty[i-1] : null;
          
          let bgStyle = '';
          // 異常値チェック（前月比 ±50% 以上、かつ数量が10以上の変動がある場合など）
          // 今回は単純に ±50% を検知（0の場合は比較不能なので除外）
          if (currentQty !== null && prevQty !== null && prevQty > 0) {
             const ratio = currentQty / prevQty;
             if (ratio >= 1.5 || ratio <= 0.5) {
               // 極端な増減は赤文字強調
               bgStyle = 'background-color: rgba(239, 68, 68, 0.1); color: #dc2626; font-weight: bold;';
             }
          } else if (currentQty !== null && prevQty === 0 && currentQty > 10) {
             // 0から10以上に増えた場合も一応ハイライト
             bgStyle = 'background-color: rgba(245, 158, 11, 0.1); color: #d97706; font-weight: bold;';
          }
          
          rowHTML += `<td style="text-align: right; ${bgStyle}">${currentQty !== null ? currentQty.toLocaleString() : '-'}</td>`;
        }
        rowHTML += '</tr>';
        tableHTML += rowHTML;
      });
      
      tableHTML += `</tbody></table></div>`;
      tableHTML += `<div style="margin-top: 0.5rem; font-size: 0.75rem; color: #666;">
        💡 前月比 ±50% 以上の増減があるセルは赤色で強調表示されています。
      </div>`;
      
      container.innerHTML = tableHTML;
      
      if ($('#export-inv-annual-btn')) {
        $('#export-inv-annual-btn').style.display = 'inline-block';
      }
      
    } catch (err) {
      console.error(err);
      container.innerHTML = `<p style="color: red;">エラーが発生しました: ${err.message}</p>`;
    }
  }, 100);
}

function exportInvAnnualExcel() {
  if (!currentAnnualResult) return;
  const { year, items } = currentAnnualResult;
  
  if (typeof XLSX === 'undefined') {
    toast('Excel出力ライブラリが読み込まれていません', 'error');
    return;
  }
  
  try {
    const wb = XLSX.utils.book_new();
    const data = [
      ['資材ID', '品名', '分類', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    ];
    
    items.forEach(item => {
      data.push([
        item.productId,
        item.name,
        INV_CATEGORIES[item.category] || item.category,
        ...item.qty
      ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, `${year}年_在庫推移表`);
    XLSX.writeFile(wb, `棚卸年度推移表_${year}.xlsx`);
    toast('Excel出力しました', 'success');
  } catch (err) {
    console.error('Excel出力エラー:', err);
    toast('Excel出力に失敗しました', 'error');
  }
}

function undoInvMonthlyClosing() {
  const month = $('#inv-closing-month').value;
  if (!month) {
    toast('年月を選択してください', 'error');
    return;
  }

  if (!confirm(`${month}の月次締めを取り消しますか？\n（既に取り消し済みの場合は何も起こりません）`)) return;

  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
  const existingIdx = monthly.findIndex(m => m.month === month);

  if (existingIdx >= 0) {
    monthly.splice(existingIdx, 1);
    DB.save(DB.KEYS.INV_MONTHLY, monthly);
    toast(`${month}の月次締めを取り消しました`, 'success');
    const resultContainer = $('#inv-monthly-result');
    if (resultContainer) resultContainer.innerHTML = '';
  } else {
    toast(`${month}の締めデータは見つかりませんでした`, 'warning');
  }
}

function runInvMonthlyClosing() {
  const month = $('#inv-closing-month').value;
  if (!month) {
    toast('年月を選択してください', 'error');
    return;
  }

  if (!confirm(`${month}の月次締めを実行しますか？`)) return;

  const result = calculateInvMonthly(month);

  // 月次データを保存
  const monthly = DB.get(DB.KEYS.INV_MONTHLY);
  const existingIdx = monthly.findIndex(m => m.month === month);

  const monthlyData = {
    month: month,
    items: result.items,
    summary: result.summary,
    total: result.total,
    fixedTotal: result.summary['fixed']?.amount || 0,
    closedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    monthly[existingIdx] = monthlyData;
  } else {
    monthly.push(monthlyData);
  }
  DB.save(DB.KEYS.INV_MONTHLY, monthly);

  toast(`${month}の月次締めを完了しました`, 'success');
  displayInvMonthlyResult(result);
}

// ========================================
// 棚卸スキャン確認画面
// ========================================

function renderInvCheckPage() {
  const monthInput = $('#inv-check-month');
  if (monthInput && !monthInput.value) {
    monthInput.value = new Date().toISOString().substring(0, 7);
  }

  // Bind buttons & selectors
  const statusFilter = $('#inv-check-filter-status');
  if (statusFilter) {
    statusFilter.onchange = renderInvCheckPage;
  }
  $('#confirm-inv-temp-btn').onclick = confirmInvTempData;
  const undoConfirmBtn = $('#undo-confirm-inv-temp-btn');
  if (undoConfirmBtn) undoConfirmBtn.onclick = undoConfirmInvTempData;
  const exportBtn = $('#export-inv-check-btn');
  if (exportBtn) {
    exportBtn.onclick = exportInvCheckToCsv;
  }
  const printQrBtn = $('#print-inv-check-qrs-btn');
  if (printQrBtn) {
    printQrBtn.onclick = printInvCheckQrs;
  }

  const selectedMonth = monthInput.value;

  // Calculate previous month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const tempScans = DB.getTempScans() || [];
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];

  // Get previous month closing data
  const prevClosing = monthly.find(m => m.month === prevMonthKey);
  const prevStockMap = {};
  if (prevClosing && prevClosing.items) {
    prevClosing.items.forEach(item => {
      prevStockMap[item.productId] = item.currQty || 0;
    });
  }

  // Scanned items for this month
  const currentTempScans = tempScans.filter(s => s.month === selectedMonth);
  const tempScanMap = {};
  currentTempScans.forEach(s => {
    tempScanMap[s.productId] = s;
  });

  // Build unified lists (include all products from master, skipping invalid TEMP_ IDs)
  const renderedProductIds = new Set();
  products.forEach(p => {
    if (!p.id.startsWith('TEMP_')) {
      renderedProductIds.add(p.id);
    }
  });
  currentTempScans.forEach(s => {
    if (!s.productId.startsWith('TEMP_')) {
      renderedProductIds.add(s.productId);
    }
  });

  const listItems = Array.from(renderedProductIds).map(pid => {
    const prod = products.find(p => p.id === pid) || { id: pid, name: `不明な資材 (${pid})`, category: '99', price: 0 };
    const scan = tempScanMap[pid];
    const prevQty = prevStockMap[pid] || 0;
    const isFixed = !!prod.isFixed;
    
    let isAutoFixed = false;
    if (!scan && isFixed) {
      isAutoFixed = true;
    }

    const currQty = scan ? scan.quantity : (isAutoFixed ? prevQty : 0);
    const diff = currQty - prevQty;
    const isScanned = !!scan || isAutoFixed; // 不動品は自動的にスキャン済扱い

    return {
      productId: pid,
      category: prod.category,
      name: prod.name,
      price: prod.price || 0,
      quantity: currQty,
      prevQty: prevQty,
      diff: diff,
      worker: scan ? (scan.workerName || scan.worker || '-') : (isAutoFixed ? '自動(不動品)' : '-'),
      workerId: scan ? (scan.worker || '-') : (isAutoFixed ? 'SYSTEM' : '-'),
      isScanned: isScanned,
      isAutoFixed: isAutoFixed,
      isFixed: isFixed,
      hasPrevQty: prevQty > 0,
      isZeroCheck: (prevQty === 0 && !isScanned)
    };
  });

  // Sort listItems by category, then by ID
  listItems.sort((a, b) => a.category.localeCompare(b.category) || a.productId.localeCompare(b.productId));

  // Filter based on selected status
  const filterStatus = (statusFilter ? statusFilter.value : 'all') || 'all';
  let filteredItems = listItems;
  if (filterStatus === 'scanned') {
    filteredItems = listItems.filter(item => item.isScanned && !item.isAutoFixed);
  } else if (filterStatus === 'fixed') {
    filteredItems = listItems.filter(item => item.isFixed);
  } else if (filterStatus === 'missing') {
    filteredItems = listItems.filter(item => item.hasPrevQty && !item.isScanned);
  } else if (filterStatus === 'zerocheck') {
    filteredItems = listItems.filter(item => item.prevQty === 0 && !item.isScanned);
  } else if (filterStatus === 'unpriced') {
    filteredItems = listItems.filter(item => item.price <= 0);
  }

  // Count scan state (always based on unfiltered monthly list)
  const totalItems = listItems.length;
  const scannedCount = listItems.filter(item => item.isScanned).length;
  const missingCount = listItems.filter(item => item.hasPrevQty && !item.isScanned).length;
  const zeroCheckCount = listItems.filter(item => item.prevQty === 0 && !item.isScanned).length;

  // Summary alerts HTML
  const summaryAlertsContainer = $('#inv-check-summary-alerts');
  if (summaryAlertsContainer) {
    summaryAlertsContainer.innerHTML = `
      <div style="background: var(--color-bg-secondary); padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem;">
        仮登録: <strong>${scannedCount}</strong> 件
      </div>
      ${missingCount > 0 ? `
      <div style="background: #fee2e2; color: #b91c1c; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 500;">
        ⚠️ 未スキャン漏れ: <strong>${missingCount}</strong> 件
      </div>
      ` : `
      <div style="background: #dcfce7; color: #15803d; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 500;">
        ✓ スキャン漏れなし
      </div>
      `}
      ${zeroCheckCount > 0 ? `
      <div style="background: #fffbeb; color: #d97706; padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; font-weight: 500;">
        ⚠️ 0のまま未確認: <strong>${zeroCheckCount}</strong> 件
      </div>
      ` : ''}
    `;
  }

  // Draw table body
  const tbody = $('#inv-check-table-body');
  if (tbody) {
    if (filteredItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center text-muted" style="padding: 3rem;">
            表示対象の棚卸仮登録データはありません。
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filteredItems.map(item => {
        let rowClass = '';
        if (item.hasPrevQty && !item.isScanned) {
          rowClass = 'style="background-color: #fee2e2; color: #991b1b;"';
        } else if (item.prevQty === 0 && !item.isScanned) {
          rowClass = 'style="background-color: #fffbeb; color: #92400e;"';
        } else if (item.price <= 0) {
          rowClass = 'style="background-color: #fff3cd; color: #856404;"';
        }

        const badgeStyle = 'display: inline-block; min-width: 110px; text-align: center; padding: 4px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white;';
        let statusBadge = '';
        if (item.isAutoFixed) {
          statusBadge = `<span style="background: #0ea5e9; ${badgeStyle}">✓ 不動品の為</span>`;
        } else if (item.isScanned) {
          statusBadge = `<span style="background: #16a34a; ${badgeStyle}">✓ 仮登録済</span>`;
        } else if (item.hasPrevQty) {
          statusBadge = `<span style="background: #b91c1c; ${badgeStyle}">⚠️ 未スキャン</span>`;
        } else {
          statusBadge = `<span style="background: #d97706; ${badgeStyle}">⚠️ 未確認(0)</span>`;
        }

        if (item.price <= 0) {
          statusBadge += ` <div style="margin-top: 4px;"><span style="background: #d97706; ${badgeStyle}">⚠️ 単価未登録</span></div>`;
        }

        return `
          <tr ${rowClass}>
            <td><strong>${item.productId}</strong></td>
            <td>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                <span>${INV_CATEGORIES[item.category] || item.category}</span>
                <button class="btn btn-sm btn-outline" style="padding: 2px 6px; font-size: 11px;" onclick="showCategoryEditModal('${item.productId.replace(/'/g, "\\'")}', '${item.category}')">✎</button>
              </div>
            </td>
            <td>${item.name}</td>
            <td>¥${item.price.toLocaleString()}</td>
            <td style="text-align: center;">
              <input type="number" class="form-input text-center" style="width: 100px; font-weight: bold; font-size: 15px; display: inline-block; padding: 4px;"
                     id="inv-check-qty-${item.productId}" value="${item.quantity}" min="0" 
                     onkeydown="if(event.key==='Enter'){this.blur();}" 
                     onchange="saveSingleTempScan('${item.productId.replace(/'/g, "\\'")}')">
            </td>
            <td>${item.prevQty}</td>
            <td style="font-weight: 600; color: ${item.diff > 0 ? '#16a34a' : item.diff < 0 ? '#dc2626' : 'inherit'};">
              ${item.diff > 0 ? '+' : ''}${item.diff}
            </td>
            <td>
              ${item.worker} <span style="font-size: 11px; color: #64748b;">(${item.workerId})</span>
            </td>
            <td>${statusBadge}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                ${item.isScanned ? `<button class="btn btn-sm btn-danger" style="padding: 2px 8px; font-size: 11px;" onclick="deleteSingleTempScan('${item.productId.replace(/'/g, "\\'")}')">🗑️ 削除</button>` : ''}
                <label style="display:inline-flex; align-items:center; gap:4px; font-size:11px; cursor:pointer; background: ${item.isFixed ? '#e0f2fe' : '#f1f5f9'}; color: ${item.isFixed ? '#0284c7' : '#475569'}; padding: 4px 8px; border-radius: 4px; border: 1px solid ${item.isFixed ? '#bae6fd' : '#cbd5e1'}; font-weight: ${item.isFixed ? 'bold' : 'normal'}; user-select: none; transition: all 0.2s ease; margin: 0;">
                  <input type="checkbox" style="margin: 0; width: 14px; height: 14px; accent-color: #0284c7;" ${item.isFixed ? 'checked' : ''} onchange="toggleFixedStatus('${item.productId.replace(/'/g, "\\'")}', this.checked)">
                  不動品
                </label>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Draw banner alert warning if missing scans exist
  const alertContainer = $('#inv-check-alerts-container');
  if (alertContainer) {
    let alertHtml = '';
    if (missingCount > 0) {
      alertHtml += `
        <div style="background: #fee2e2; border-left: 6px solid #ef4444; color: #991b1b; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 24px;">⚠️</span>
          <div>
            <div style="font-weight: bold;">棚卸の漏れチェック警告</div>
            <div style="font-size: 0.875rem;">前月に在庫があった商品で、今月まだ棚卸登録されていない商品が <strong>${missingCount}</strong> 件あります（赤くハイライトされた行）。スキャンを完了させるか、実棚数量を入力して保存してください。</div>
          </div>
        </div>
      `;
    }
    if (zeroCheckCount > 0) {
      alertHtml += `
        <div style="background: #fffbeb; border-left: 6px solid #f59e0b; color: #92400e; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 24px;">⚠️</span>
          <div>
            <div style="font-weight: bold;">0のまま未確認アラート</div>
            <div style="font-size: 0.875rem;">前月の在庫が0だった商品で、今月まだ棚卸登録されていない商品が <strong>${zeroCheckCount}</strong> 件あります（薄い黄色の行）。本当に0のまま問題ないか確認し、在庫がある場合は数量を入力するかスキャン登録してください。</div>
          </div>
        </div>
      `;
    }
    alertContainer.innerHTML = alertHtml;
  }
}

// Global functions for inline actions

window.toggleFixedStatus = function(productId, isFixed) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const prodIndex = products.findIndex(p => p.id === productId);
  if (prodIndex === -1) {
    toast('商品マスタが見つかりません', 'error');
    return;
  }
  
  products[prodIndex].isFixed = isFixed;
  DB.save(DB.KEYS.INV_PRODUCTS, products);
  toast(`資材 ${productId} を不動品に${isFixed ? '設定' : '解除'}しました`, 'success');
  renderInvCheckPage();
};

window.updateMasterFromInvCheck = function(productId, field, value) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const prodIndex = products.findIndex(p => p.id === productId);
  if (prodIndex === -1) {
    toast('商品マスタが見つかりません', 'error');
    return;
  }
  
  if (field === 'category') {
    products[prodIndex].category = value;
  }
  
  DB.save(DB.KEYS.INV_PRODUCTS, products);
  toast('商品マスタを更新しました', 'success');
  renderInvCheckPage(); // 分類の場合は再描画する
};

window.showCategoryEditModal = function(productId, currentCategory) {
  const optionsHtml = Object.keys(INV_CATEGORIES).map(catKey => 
    `<option value="${catKey}" ${catKey === currentCategory ? 'selected' : ''}>${INV_CATEGORIES[catKey]}</option>`
  ).join('');

  const body = `
    <div style="padding: 1rem;">
      <p style="margin-bottom: 1rem;">資材ID: <strong>${productId}</strong> の分類を変更します。</p>
      <div class="form-group">
        <label>新しい分類</label>
        <select id="inv-check-category-select-${productId}" class="form-input">
          ${optionsHtml}
        </select>
      </div>
    </div>
  `;
  
  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="submitCategoryEdit('${productId.replace(/'/g, "\\'")}')">保存する</button>
  `;
  
  showModal('分類の編集', body, footer);
};

window.submitCategoryEdit = function(productId) {
  const select = document.getElementById(`inv-check-category-select-${productId}`);
  if (!select) return;
  const newCat = select.value;
  hideModal();
  updateMasterFromInvCheck(productId, 'category', newCat);
};

// 単価未登録商品の価格設定モーダル
function showPriceRegisterModal(unpricedItems, onSaveCallback) {
  const rowsHtml = unpricedItems.map(item => `
    <tr>
      <td><strong>${item.productId}</strong></td>
      <td>${item.name}</td>
      <td>
        <input type="number" class="form-input quick-price-input" 
               data-product-id="${item.productId}" value="0" min="1" 
               style="width:120px; font-weight:bold; font-size:1.1rem; text-align:right;"> 円
      </td>
    </tr>
  `).join('');

  const body = `
    <div style="padding: 1rem; max-height: 400px; overflow-y: auto;">
      <p style="margin-bottom: 1rem; color: #b91c1c; font-weight: 600; font-size: 0.95rem; line-height: 1.5;">
        ⚠️ 以下の商品の単価が未登録です。価格未登録のまま締め処理を実行することはできません。<br>
        すべての商品の単価を入力してください（1円以上）。
      </p>
      <table class="table" style="width: 100%;">
        <thead>
          <tr>
            <th>資材ID</th>
            <th>品名</th>
            <th style="width: 150px;">単価</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" id="quick-price-submit-btn">単価を登録して締め処理を実行</button>
  `;

  showModal('⚠️ 単価未登録商品の価格設定', body, footer);

  const submitBtn = document.getElementById('quick-price-submit-btn');
  if (submitBtn) {
    submitBtn.onclick = function() {
      const inputs = document.querySelectorAll('.quick-price-input');
      const priceUpdates = {};
      let allValid = true;

      inputs.forEach(input => {
        const pid = input.dataset.productId;
        const price = parseInt(input.value) || 0;
        if (price <= 0) {
          allValid = false;
        }
        priceUpdates[pid] = price;
      });

      if (!allValid) {
        alert('すべての商品に1円以上の単価を入力してください。');
        return;
      }

      // マスタ（INV_PRODUCTS）更新
      const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
      products.forEach(p => {
        if (priceUpdates[p.id] !== undefined) {
          p.price = priceUpdates[p.id];
        }
      });
      DB.save(DB.KEYS.INV_PRODUCTS, products);

      toast('単価をマスタに登録しました', 'success');
      hideModal();

      // 締め処理の続行
      onSaveCallback();
    };
  }
}

function toggleFixedStatus(productId, isFixed) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const p = products.find(x => x.id === productId);
  if (p) {
    p.isFixed = isFixed;
    if (isFixed) {
      // 不動品チェックをONにした際、仮スキャンデータをクリアする
      delete p.tempQty;
      delete p.tempWorker;
      delete p.tempWorkerName;
      delete p.tempMonth;
      delete p.tempTimestamp;
      delete p.tempId;
    }
    DB.save(DB.KEYS.INV_PRODUCTS, products);
    toast(`商品「${p.name || productId}」の不動品設定を${isFixed ? '有効' : '無効'}にしました`, 'success');
    renderInvCheckPage();
  }
}

window.bulkDeleteInvTempScans = function() {
  if (!confirm('本当にすべての仮スキャンデータを一括削除しますか？\\n（この操作は元に戻せません）')) return;

  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  let deletedCount = 0;
  
  products.forEach(p => {
    if (p.tempMonth) {
      delete p.tempQty;
      delete p.tempWorker;
      delete p.tempWorkerName;
      delete p.tempTimestamp;
      delete p.tempMonth;
      delete p.tempId;
      deletedCount++;
    }
  });

  if (deletedCount > 0) {
    DB.save(DB.KEYS.INV_PRODUCTS, products);
    toast(`${deletedCount}件の仮スキャンデータを削除しました`, 'success');
    renderInvCheckPage();
  } else {
    toast('削除する仮スキャンデータがありません', 'info');
  }
};

function undoConfirmInvTempData() {
  const selectedMonth = $('#inv-check-month').value || new Date().toISOString().substring(0, 7);
  
  if (!confirm(`${selectedMonth} の棚卸確定（締め処理）を取り消し、仮スキャン状態に戻しますか？\n（既に次月の棚卸を開始している場合など、データが競合する恐れがあります）`)) return;

  const logs = DB.get(DB.KEYS.INV_LOGS) || [];
  let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];

  const targetNote = `棚卸確定締め(${selectedMonth})`;
  const countLogs = logs.filter(l => l.note === targetNote && l.type === 'count');

  if (countLogs.length === 0) {
    toast(`${selectedMonth} の確定履歴が見つからないため、仮状態への復元はできません`, 'error');
    return;
  }

  // 1. 商品マスタの仮データを復元
  countLogs.forEach(log => {
    const p = products.find(prod => prod.id === log.productId);
    if (p && log.worker !== '自動(不動品)') {
      p.tempQty = log.quantity;
      p.tempWorker = log.worker === 'システム自動' ? 'System' : log.worker;
      p.tempWorkerName = log.worker;
      p.tempTimestamp = log.timestamp;
      p.tempMonth = selectedMonth;
      p.tempId = log.id;
    }
  });

  // 2. 確定ログを削除
  const newLogs = logs.filter(l => !(l.note === targetNote && l.type === 'count'));

  // 3. INV_MONTHLYから該当月を削除
  const monthlyIdx = monthly.findIndex(m => m.month === selectedMonth);
  if (monthlyIdx >= 0) {
    monthly.splice(monthlyIdx, 1);
  }

  DB.save(DB.KEYS.INV_LOGS, newLogs);
  DB.save(DB.KEYS.INV_PRODUCTS, products);
  DB.save(DB.KEYS.INV_MONTHLY, monthly);

  toast(`${selectedMonth} の棚卸確定を取り消し、仮状態に復元しました`, 'success');
  renderInvCheckPage();
}

// Confirm temp data and close month
function confirmInvTempData() {
  const selectedMonth = $('#inv-check-month').value || new Date().toISOString().substring(0, 7);
  
  // Calculate missing scans to prompt user
  const tempScans = DB.getTempScans() || [];
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];

  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const prevClosing = monthly.find(m => m.month === prevMonthKey);
  const prevStockMap = {};
  if (prevClosing && prevClosing.items) {
    prevClosing.items.forEach(item => {
      prevStockMap[item.productId] = item.currQty || 0;
    });
  }

  const currentTempScans = tempScans.filter(s => s.month === selectedMonth);

  // 価格未登録チェック用の checkProductIds 構築 (skipping invalid TEMP_ IDs)
  const checkProductIds = new Set();
  currentTempScans.forEach(s => {
    if (!s.productId.startsWith('TEMP_')) {
      checkProductIds.add(s.productId);
    }
  });
  Object.keys(prevStockMap).forEach(id => {
    if (prevStockMap[id] > 0 && !id.startsWith('TEMP_')) {
      checkProductIds.add(id);
    }
  });

  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const unpricedItems = Array.from(checkProductIds).map(pid => {
    const prod = products.find(p => p.id === pid) || { id: pid, name: `不明な資材 (${pid})`, category: '99', price: 0 };
    return {
      productId: pid,
      name: prod.name,
      price: prod.price || 0
    };
  }).filter(item => item.price <= 0);

  if (unpricedItems.length > 0) {
    showPriceRegisterModal(unpricedItems, () => {
      confirmInvTempData();
    });
    return;
  }

  const missingCount = Object.keys(prevStockMap).filter(pid => {
    if (prevStockMap[pid] <= 0) return false;
    if (currentTempScans.some(s => s.productId === pid)) return false;
    const prod = products.find(p => p.id === pid);
    if (prod && prod.isFixed) return false; // 不動品は自動セットされるため漏れに含めない
    return true;
  }).length;

  let confirmMsg = `${selectedMonth} の棚卸データを確定して締め処理を実行しますか？\n（確定後、正式な在庫情報として反映され、月次報告に表示されます）`;
  if (missingCount > 0) {
    confirmMsg = `⚠️ 警告 ⚠️\n前月に在庫があった商品で、今月まだ棚卸登録されていない商品が ${missingCount} 件あります。\nこれらは【実棚数量 0個】として登録されますが、このまま確定してよろしいですか？`;
  }

  if (!confirm(confirmMsg)) return;

  // Let's perform final closing:
  // 1. Clean existing type count logs AND count_temp logs for this month from INV_LOGS
  let logs = DB.get(DB.KEYS.INV_LOGS) || [];
  logs = logs.filter(l => {
      if (!(l.timestamp && l.timestamp.startsWith(selectedMonth))) return true;
      if (l.type === 'count' || l.type === 'count_temp') return false; // 確定分と仮データを一掃
      return true;
  });

  // 2. Commit all listItems as official count logs
  // (We'll generate counts for ALL items scanned, with previous stocks, or fixed products)
  const renderedProductIds = new Set();
  currentTempScans.forEach(s => {
    if (!s.productId.startsWith('TEMP_')) {
      renderedProductIds.add(s.productId);
    }
  });
  Object.keys(prevStockMap).forEach(id => {
    if (prevStockMap[id] > 0 && !id.startsWith('TEMP_')) {
      renderedProductIds.add(id);
    }
  });
  products.forEach(p => {
    if (p.isFixed && !p.id.startsWith('TEMP_')) {
      renderedProductIds.add(p.id);
    }
  });

  const timestamp = new Date(year, month, 0, 23, 59, 59).toISOString(); // End of target month

  Array.from(renderedProductIds).forEach((pid, index) => {
    const tempScan = currentTempScans.find(s => s.productId === pid);
    const prod = products.find(p => p.id === pid);
    const isFixed = prod && prod.isFixed;
    const prevQty = prevStockMap[pid] || 0;
    
    let qty = 0;
    let worker = 'システム自動';
    
    if (tempScan) {
      qty = tempScan.quantity;
      worker = tempScan.workerName || tempScan.worker;
    } else if (isFixed) {
      qty = prevQty;
      worker = '自動(不動品)';
    }
    
    logs.push({
      id: Date.now() + index,
      productId: pid,
      quantity: qty,
      type: 'count',
      worker: worker,
      note: `棚卸確定締め(${selectedMonth})`,
      timestamp: timestamp
    });
  });

  // Save official logs
  DB.save(DB.KEYS.INV_LOGS, logs);

  // 3. Clear temporary scans for this month
  products.forEach(p => {
    if (p.tempMonth === selectedMonth) {
      delete p.tempQty;
      delete p.tempWorker;
      delete p.tempWorkerName;
      delete p.tempTimestamp;
      delete p.tempMonth;
      delete p.tempId;
    }
  });
  DB.save(DB.KEYS.INV_PRODUCTS, products);

  // 4. Compute and save monthly closing
  try {
    const monthlyResult = calculateInvMonthly(selectedMonth);
    saveInvMonthlyClosing(selectedMonth, monthlyResult);
    toast(`${selectedMonth} の棚卸確定および月次締め処理を完了しました！`, 'success');
  } catch (err) {
    console.error('月次締め処理エラー:', err);
    toast('月次締め処理の計算でエラーが発生しました', 'error');
  }

  // Reload the check page
  renderInvCheckPage();
}

function exportInvCheckToCsv() {
  const monthInput = $('#inv-check-month');
  const selectedMonth = monthInput ? monthInput.value : new Date().toISOString().substring(0, 7);

  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const tempScans = DB.getTempScans() || [];
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];

  // Calculate previous month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const prevClosing = monthly.find(m => m.month === prevMonthKey);
  const prevStockMap = {};
  if (prevClosing && prevClosing.items) {
    prevClosing.items.forEach(item => {
      prevStockMap[item.productId] = item.currQty || 0;
    });
  }

  const currentTempScans = tempScans.filter(s => s.month === selectedMonth);
  const tempScanMap = {};
  currentTempScans.forEach(s => {
    tempScanMap[s.productId] = s;
  });

  const renderedProductIds = new Set();
  currentTempScans.forEach(s => {
    if (!s.productId.startsWith('TEMP_')) {
      renderedProductIds.add(s.productId);
    }
  });
  Object.keys(prevStockMap).forEach(id => {
    if (prevStockMap[id] > 0 && !id.startsWith('TEMP_')) {
      renderedProductIds.add(id);
    }
  });

  const listItems = Array.from(renderedProductIds).map(pid => {
    const prod = products.find(p => p.id === pid) || { id: pid, name: `不明な資材 (${pid})`, category: '99', price: 0 };
    const scan = tempScanMap[pid];
    const prevQty = prevStockMap[pid] || 0;
    const currQty = scan ? scan.quantity : 0;
    const diff = currQty - prevQty;
    const isScanned = !!scan;

    return {
      productId: pid,
      categoryName: INV_CATEGORIES[prod.category] || prod.category,
      name: prod.name,
      price: prod.price || 0,
      quantity: currQty,
      prevQty: prevQty,
      diff: diff,
      worker: scan ? (scan.workerName || scan.worker || '-') : '-',
      status: (prevQty > 0 && !isScanned) ? '未スキャン' : '仮登録済'
    };
  });

  // Sort
  listItems.sort((a, b) => a.productId.localeCompare(b.productId));

  // CSV content
  const headers = ['資材ID', '分類', '品名', '単価', '実棚数量', '前月在庫', '差分', 'スキャン実行者', '状況'];
  const rows = listItems.map(item => [
    item.productId,
    item.categoryName,
    item.name,
    item.price,
    item.quantity,
    item.prevQty,
    item.diff,
    item.worker,
    item.status
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\r\n');

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 with BOM
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `棚卸チェック表_${selectedMonth}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ========================================
// CSV取り込み・エクスポート
// ========================================

// CSV取り込みエリア表示
function showCsvImportArea() {
  $('#csv-import-area').style.display = 'block';
  $('#csv-file-input').value = '';
  $('#csv-import-preview').innerHTML = '';
}

// CSV取り込みエリア非表示
function hideCsvImportArea() {
  $('#csv-import-area').style.display = 'none';
  $('#csv-file-input').value = '';
  $('#csv-import-preview').innerHTML = '';
}

// CSVファイルプレビュー
function previewCsvFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const text = evt.target.result;
    const rows = parseCsv(text);

    if (rows.length < 2) {
      $('#csv-import-preview').innerHTML = '<p class="text-muted">データがありません</p>';
      return;
    }

    // ヘッダー確認（2行目以降のデータをプレビュー）
    const dataRows = rows.slice(1).filter(row => row[2]); // ID(C列)があるもの
    const preview = dataRows.slice(0, 5).map(row => {
      const id = row[2] || '';    // C列: ID
      const cat = row[3] || '';   // D列: 資材分類
      const name = row[4] || '';  // E列: 品名
      const price = row[11] || ''; // L列: 単価
      const isFixed = row[1] === 'TRUE' || row[1] === '1';
      return `<tr><td>${id}</td><td>${cat}</td><td>${name}</td><td>${price}</td><td>${isFixed ? '✓' : ''}</td></tr>`;
    }).join('');

    $('#csv-import-preview').innerHTML = `
      <p style="margin-bottom: 0.5rem;"><strong>${dataRows.length}件</strong>のデータを取り込みます（最初の5件をプレビュー）</p>
      <table class="table" style="font-size: 0.875rem;">
        <thead><tr><th>ID</th><th>資材分類</th><th>品名</th><th>単価</th><th>不動</th></tr></thead>
        <tbody>${preview}</tbody>
      </table>
    `;
  };
  reader.readAsText(file, 'UTF-8');
}

// CSV解析
// 進捗切り替え（Gantt）
function toggleProcessStatus(el, orderId, itemIndex, process) {
  toast('toggleProcessStatus called: ' + orderId + ', ' + itemIndex + ', ' + process, 'debug'); // Debug log

  // イベント伝播防止
  if (window.event) window.event.stopPropagation();

  // Optimistic Update (UIを即時更新)
  const isDone = el.classList.contains('status-done');
  const newClass = isDone ? 'status-todo' : 'status-done';
  const newText = isDone ? '<span style="font-size:10px; color:#94a3b8;">未</span>' : '<span style="font-size:10px; color:#15803d; font-weight:bold;">完了</span>';

  el.className = `matrix-cell ${newClass}`;
  el.innerHTML = newText;

  // データ更新処理
  setTimeout(() => {
    try {
      // 検索の堅牢化 (IDが文字列でも数値でも対応)
      const orders = DB.get(DB.KEYS.ORDERS);
      const order = orders.find(o => String(o.id) === String(orderId));

      if (!order) {
        console.error('Order not found:', orderId);
        return;
      }

      if (!order.items || !order.items[itemIndex]) {
        console.error('Target item not found', orderId, itemIndex, order.items);
        return;
      }

      const item = order.items[itemIndex];
      if (!Array.isArray(item.completed)) item.completed = [];

      if (isDone) {
        // 完了 -> 未完了 (削除)
        item.completed = item.completed.filter(p => p !== process);
      } else {
        // 未完了 -> 完了 (追加)
        if (!item.completed.includes(process)) {
          item.completed.push(process);
        }
      }

      // 保存
      DB.save(DB.KEYS.ORDERS, orders);

      // 進捗履歴の保存 (registerProgressと同じロジックならいいが、簡易的にここで済ますか、関数呼ぶか)
      // ここでは履歴保存は省略するか、あるいはregisterProgressを呼ぶか。
      // Ganttからのクリックは頻度が高いので履歴は必須ではないかもしれないが、
      // 整合性を取るなら履歴もあったほうがいい。

      // 再描画はFirebaseのリスナー任せにするか、遅延させる
    } catch (e) {
      console.error('Toggle Error:', e);
      // UIを戻す処理が必要だが、シンプルにするため省略
      toast('エラーが発生しました: ' + e.message, 'error');
    }
  }, 0);
}

// 確実にグローバル公開
window.toggleProcessStatus = toggleProcessStatus;

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let inQuotes = false;
  let currentCell = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        if (char === '\r') i++;
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }
  return rows;
}

// CSV取り込み実行
function executeInvCsvImport() {
  const file = $('#csv-file-input').files[0];
  if (!file) {
    toast('ファイルを選択してください', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (evt) => {
    const text = evt.target.result;
    const rows = parseCsv(text);

    if (rows.length < 2) {
      toast('データがありません', 'error');
      return;
    }

    const products = DB.get(DB.KEYS.INV_PRODUCTS);
    const dataRows = rows.slice(1).filter(row => row[2]); // ID(C列)があるもの

    let addCount = 0, updateCount = 0;

    dataRows.forEach(row => {
      const id = (row[2] || '').trim();         // C列: ID
      const categoryName = (row[3] || '').trim(); // D列: 資材分類名
      const name = (row[4] || '').trim();        // E列: 品名
      const colorOther = (row[5] || '').trim();  // F列: 色/他
      const material = (row[6] || '').trim();    // G列: 構成
      const width = parseFloat(row[7]) || 0;     // H列: 巾
      const length = parseFloat(row[8]) || 0;    // I列: 長さ
      const maker = (row[9] || '').trim();       // J列: メーカー
      const supplier = (row[10] || '').trim();   // K列: 仕入先
      const price = parseInt((row[11] || '0').replace(/[^\d.-]/g, '')) || 0; // L列: 単価
      const isFixed = row[1] === 'TRUE' || row[1] === '1' || row[1] === 'true';

      if (!id || !name) return;

      // 分類名からコードを逆引き
      let categoryCode = '';
      for (const [code, catName] of Object.entries(INV_CATEGORIES)) {
        if (categoryName.includes(catName) || catName.includes(categoryName)) {
          categoryCode = code;
          break;
        }
      }
      // 見つからない場合はIDから抽出
      if (!categoryCode && id.startsWith('N')) {
        categoryCode = id.substring(1, 3);
      }

      const existingIdx = products.findIndex(p => p.id === id);

      const productData = {
        id: id,
        name: name,
        category: categoryCode,
        price: price,
        isFixed: isFixed,
        colorOther: colorOther,
        material: material,
        width: width,
        length: length,
        maker: maker,
        supplier: supplier
      };

      if (existingIdx >= 0) {
        products[existingIdx] = { ...products[existingIdx], ...productData };
        updateCount++;
      } else {
        products.push(productData);
        addCount++;
      }
    });

    DB.save(DB.KEYS.INV_PRODUCTS, products);
    toast(`取り込み完了: 新規${addCount}件、更新${updateCount}件`, 'success');
    hideCsvImportArea();
    renderInvProductsTable();
  };
  reader.readAsText(file, 'UTF-8');
}

// CSVエクスポート
function exportInvProductsCsv() {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);

  // ヘッダー（スプレッドシートと同じ形式）
  const header = ['印刷', '不動', 'ID', '資材分類', '品名', '色/他', '構成', '巾', '長さ', 'メーカー', '仕入先', '単価'];

  const rows = products.map(p => [
    '',                                    // 印刷（空白）
    p.isFixed ? 'TRUE' : 'FALSE',         // 不動
    p.id,                                  // ID
    INV_CATEGORIES[p.category] || p.category, // 資材分類名
    p.name,                                // 品名
    p.colorOther || '',                    // 色/他
    p.material || '',                      // 構成
    p.width || '',                         // 巾
    p.length || '',                        // 長さ
    p.maker || '',                         // メーカー
    p.supplier || '',                      // 仕入先
    p.price                                // 単価
  ]);

  const csvContent = [header, ...rows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  // BOM付きUTF-8でダウンロード
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `商品マスタ_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast('CSVをダウンロードしました', 'success');
}

// テーマ切替機能
// テーマ切替機能
function initTheme() {
  // ID変更に対応
  const toggleSwitch = document.getElementById('theme-toggle') || document.querySelector('.theme-switch input[type="checkbox"]');
  if (!toggleSwitch) return;

  const currentTheme = localStorage.getItem('theme');
  if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'dark') {
      toggleSwitch.checked = true;
      document.body.classList.add('dark-mode');
    }
  }

  toggleSwitch.addEventListener('change', function (e) {
    if (e.target.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  });
}

// ========================================
// 初期化・イベントリスナー
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // ログインボタン
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const username = $('#username').value;
      const password = $('#password').value;
      if (login(username, password)) {
        showMainScreen();
        toast('ログインしました', 'success');
      } else {
        toast('ユーザー名またはパスワードが間違っています', 'error');
      }
    });
  }

  // モバイル判定
  const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // ===== モバイルUI調整 =====
  if (isMobile) {
    // 1. テーマ切替をトップに移動
    const themeWrapper = document.querySelector('.theme-switch-wrapper');
    if (themeWrapper) {
      themeWrapper.style.position = 'fixed';
      themeWrapper.style.bottom = 'auto';
      themeWrapper.style.top = '8px';
      themeWrapper.style.left = '8px';
      themeWrapper.style.zIndex = '20002';
    }

    // 2. バージョンバナーを非表示
    const versionBanner = document.getElementById('version-banner');
    if (versionBanner) {
      versionBanner.style.display = 'none';
    }
  }
  // テーマ初期化
  if (typeof initTheme === 'function') initTheme();

  // 認証状態チェック (ログイン画面/メイン画面の切り替え)
  checkAuth();

  setTimeout(() => {
    // フルスクリーン切り替え
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        const container = document.querySelector('.gantt-container-mono');
        if (!container) return;

        if (!document.fullscreenElement) {
          container.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
          });
        } else {
          document.exitFullscreen();
        }
      });
    }

    // フルスクリーン状態監視（クラス付与用）
    document.addEventListener('fullscreenchange', () => {
      const container = document.querySelector('.gantt-container-mono');
      if (document.fullscreenElement) {
        container.classList.add('is-fullscreen');
      } else {
        container.classList.remove('is-fullscreen');
      }
    });

  }, 2000); // 初期化待ち
});

// ========================================
// 工程進捗トグル（完了/未完了の切り替え）
// ========================================
window.toggleProcessStatus = function (cellElement, orderId, itemIdx, processName) {
  // 1. 即時UIフィードバック（Optimistic Update）
  let isDone = false;
  if (cellElement) {
    isDone = cellElement.classList.contains('status-done');
    if (isDone) {
      cellElement.className = 'matrix-cell status-todo'; // クラスを完全に書き換え
      cellElement.innerHTML = '<span style="font-size:10px; color:#94a3b8;">未</span>';
    } else {
      cellElement.className = 'matrix-cell status-done'; // クラスを完全に書き換え
      cellElement.innerHTML = '<span style="font-size:10px; color:#15803d; font-weight:bold;">完了</span>';
    }
  }

  // 2. データ処理
  try {
    const orders = DB.get(DB.KEYS.ORDERS);
    const order = orders.find(o => o.id == orderId);

    if (!order) {
      console.error('Order not found');
      return;
    }

    const item = order.items && order.items[itemIdx];
    if (!item) {
      console.error('Item not found');
      return;
    }

    if (!Array.isArray(item.completed)) {
      item.completed = [];
    }

    // trim()して比較（目に見えない空白対策）
    const proc = processName.trim();
    const idx = item.completed.findIndex(p => p.trim() === proc);

    if (idx > -1) {
      item.completed.splice(idx, 1);
    } else {
      item.completed.push(proc);
      
      // 未完了/不良 -> 完了になる際、もしこの工程の保留中の不良データがあれば status を 'resolved' にする
      const defects = DB.get(DB.KEYS.DEFECTS) || [];
      let defectChanged = false;
      defects.forEach(d => {
        if (String(d.orderId) === String(order.id) &&
            String(d.itemId) === String(item.id) &&
            d.processName === proc &&
            d.status === 'pending') {
          d.status = 'resolved';
          defectChanged = true;
        }
      });
      if (defectChanged) {
        DB.save(DB.KEYS.DEFECTS, defects);
      }
    }

    // 3. 保存
    DB.save(DB.KEYS.ORDERS, orders);
  } catch (e) {
    console.error('Toggle Error:', e);
    alert('エラーが発生しました: ' + e.message);
  }
};

// ========================================
// バックアップ管理
// ========================================

function renderBackupPage() {
  const container = document.getElementById('backup-list');
  if (!container) return;

  const backups = DB.getBackupList().sort((a, b) => b.id - a.id);
  const lastBackup = localStorage.getItem('pms_last_backup_date');

  let nextAutoText = '未定';
  if (lastBackup) {
    const nextDate = new Date(new Date(lastBackup).getTime() + 28 * 24 * 60 * 60 * 1000);
    // 次の日曜日を計算
    while (nextDate.getDay() !== 0) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    nextAutoText = nextDate.toLocaleDateString('ja-JP');
  }

  let html = `
    <div class="card" style="margin-bottom: 1rem;">
      <div style="padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <strong>📅 自動バックアップ設定</strong><br>
          <span style="font-size: 0.85rem; color: var(--text-secondary);">
            毎月1回・日曜日に自動実行 ｜ 最新6件を保持 ｜
            最終バックアップ: ${lastBackup ? new Date(lastBackup).toLocaleString('ja-JP') : 'なし'} ｜
            次回予定: ${nextAutoText}
          </span>
        </div>
        <button class="btn btn-sm btn-outline" onclick="downloadAllBackupJson()">📥 全データJSON出力</button>
      </div>
    </div>
  `;

  if (backups.length === 0) {
    html += `
      <div class="card" style="padding: 2rem; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 1.2rem;">💾 バックアップはまだありません</p>
        <p>「今すぐバックアップ」ボタンで手動バックアップを作成できます。</p>
      </div>
    `;
  } else {
    html += `
      <div class="card">
        <table class="data-table">
          <thead>
            <tr>
              <th>日時</th>
              <th>種類</th>
              <th>レコード数</th>
              <th>サイズ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
    `;

    backups.forEach(b => {
      const date = new Date(b.createdAt).toLocaleString('ja-JP');
      const sizeKB = (b.dataSize / 1024).toFixed(1);
      const isAuto = b.label.includes('自動');
      const labelClass = isAuto ? 'badge badge-info' : 'badge badge-success';

      html += `
        <tr>
          <td>${date}</td>
          <td><span class="${labelClass}">${b.label}</span></td>
          <td>${b.totalRecords.toLocaleString()}件</td>
          <td>${sizeKB} KB</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="restoreFromBackup(${b.id})" title="このバックアップから復元">🔄 復元</button>
            <button class="btn btn-sm btn-outline" onclick="downloadBackup(${b.id})" title="JSONダウンロード">📥</button>
            <button class="btn btn-sm btn-danger" onclick="deleteBackupItem(${b.id})" title="削除">🗑</button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  }

  container.innerHTML = html;
}

// 手動バックアップ
function createManualBackup() {
  try {
    const backup = DB.createBackup('手動バックアップ');
    toast(`💾 バックアップを作成しました（${backup.totalRecords}件, ${(backup.dataSize / 1024).toFixed(1)}KB）`, 'success');
    renderBackupPage();
  } catch (e) {
    toast('バックアップの作成に失敗しました: ' + e.message, 'error');
  }
}

// バックアップから復元
function restoreFromBackup(backupId) {
  if (!confirm('このバックアップからデータを復元しますか？\n\n現在のデータは全て上書きされます。\n（復元前に自動バックアップを作成します）')) return;

  try {
    // 復元前に自動でバックアップ
    DB.createBackup('復元前の自動バックアップ');

    const success = DB.restoreBackup(backupId);
    if (success) {
      toast('✅ バックアップから復元しました。ページをリロードします。', 'success');
      setTimeout(() => location.reload(), 1500);
    } else {
      toast('復元に失敗しました。バックアップデータが見つかりません。', 'error');
    }
  } catch (e) {
    toast('復元に失敗しました: ' + e.message, 'error');
  }
}

// バックアップ削除
function deleteBackupItem(backupId) {
  if (!confirm('このバックアップを削除しますか？')) return;
  DB.deleteBackupById(backupId);
  toast('バックアップを削除しました', 'info');
  renderBackupPage();
}

// バックアップJSONダウンロード
function downloadBackup(backupId) {
  const backups = DB.get(DB.KEYS.BACKUPS);
  const backup = backups.find(b => b.id === backupId);
  if (!backup) { toast('バックアップが見つかりません', 'error'); return; }

  const json = JSON.stringify(backup.snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_${new Date(backup.createdAt).toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast('バックアップをダウンロードしました', 'success');
}

// 全データJSON出力（復元用）
function downloadAllBackupJson() {
  const snapshot = {};
  DB._backupTargetKeys().forEach(key => {
    snapshot[key] = DB.get(key);
  });
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `full_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast('全データをJSONファイルとしてダウンロードしました', 'success');
}

// ========================================
// 未登録資材のクイック登録モーダル
// ========================================
function showQuickProductRegisterModal(productId, quantity = 0, isMobile = false) {
  const categoriesHtml = Object.entries(INV_CATEGORIES)
    .map(([key, name]) => `<option value="${key}">${name}</option>`)
    .join('');

  const body = `
    <div style="padding: 1rem;">
      <p style="margin-bottom: 1.5rem; color: #b91c1c; font-weight: 600; font-size: 0.95rem; line-height: 1.5;">
        ⚠️ 資材ID <strong>${productId}</strong> は商品マスタに存在しません。<br>
        棚卸登録と同時に、商品マスタにクイック新規登録できます。
      </p>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.875rem;">資材ID (スキャン値)</label>
        <input type="text" class="form-input" id="quick-prod-id" value="${productId}" readonly style="background: var(--color-bg-secondary); font-weight: bold;">
      </div>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.875rem;">品名 <span style="color:red;">*</span></label>
        <input type="text" class="form-input" id="quick-prod-name" placeholder="例: スプルース小割無垢" required style="font-size: 0.95rem;">
      </div>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.875rem;">分類 <span style="color:red;">*</span></label>
        <select class="form-input" id="quick-prod-category" style="font-size: 0.95rem;">
          ${categoriesHtml}
        </select>
      </div>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.875rem;">単価 (参考円)</label>
        <input type="number" class="form-input" id="quick-prod-price" value="0" min="0" style="font-size: 0.95rem;">
      </div>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.875rem;">今回の棚卸数量</label>
        <input type="number" class="form-input" id="quick-prod-qty" value="${quantity}" min="0" style="font-size: 1.1rem; font-weight: bold; text-align: center; color: var(--color-primary);">
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="submitQuickProductRegister('${productId}', ${isMobile})">マスタ登録して棚卸に追加</button>
  `;

  showModal('⚠️ 未登録資材のクイック登録', body, footer);
}

window.submitQuickProductRegister = function(productId, isMobile) {
  const name = $('#quick-prod-name').value.trim();
  const category = $('#quick-prod-category').value;
  const price = parseInt($('#quick-prod-price').value) || 0;
  const qty = parseInt($('#quick-prod-qty').value) || 0;

  if (!name) {
    alert('品名を入力してください');
    return;
  }

  // 1. Add to product master
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  
  // Calculate max numeric ID
  let maxId = 0;
  products.forEach(p => {
    const numId = parseInt(p.idStr || p.id, 10);
    if (!isNaN(numId) && numId > maxId) maxId = numId;
  });
  const newIdNum = maxId + 1;

  const newProduct = {
    id: productId,
    name: name,
    category: category,
    price: price,
    unit: '本',
    idStr: String(newIdNum)
  };

  products.push(newProduct);
  DB.save(DB.KEYS.INV_PRODUCTS, products);

  // 2. Perform inventory scan submission
  const targetTimestamp = new Date().toISOString();
  let targetMonth = '';
  const monthInput = $('#inv-scan-month');
  if (monthInput && monthInput.value) {
    targetMonth = monthInput.value;
  } else {
    const now = new Date();
    targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  DB.saveTempScan(productId, qty, currentUser.username, currentUser.displayName, targetTimestamp, targetMonth);

  toast(`新資材「${name}」をマスタ登録し、棚卸に ${qty}個 仮登録しました！`, 'success');
  hideModal();

  // Reset inputs and refresh history logs
  if (isMobile) {
    const scanIdInput = $('#inv-scan-id');
    if (scanIdInput) scanIdInput.value = '';
    const scanQtyInput = $('#inv-scan-qty');
    if (scanQtyInput) scanQtyInput.value = '';
    const resultEl = $('#inv-scan-result');
    if (resultEl) resultEl.style.display = 'none';
    const infoEl = $('#inv-product-info');
    if (infoEl) infoEl.style.display = 'none';

    if (window.renderTodayInvLogs) renderTodayInvLogs();
  } else {
    const scanIdInput = $('#inv-scan-product-id');
    if (scanIdInput) scanIdInput.value = '';
    const scanQtyInput = $('#inv-scan-quantity');
    if (scanQtyInput) scanQtyInput.value = '';
    const resultEl = $('#inv-scan-result');
    if (resultEl) resultEl.style.display = 'none';
    const infoEl = $('#inv-product-info');
    if (infoEl) infoEl.style.display = 'none';

    if (window.renderTodayInvLogs) renderTodayInvLogs();
  }
};

function printInvProductsQrs() {
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const categoryFilter = $('#inv-products-category-filter').value;
  const searchKeyword = ($('#inv-products-search').value || '').toLowerCase();
  const fixedOnly = $('#inv-products-fixed-only').checked;

  let filtered = products.filter(p => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (fixedOnly && !p.isFixed) return false;
    if (searchKeyword && !p.id.toLowerCase().includes(searchKeyword) && !p.name.toLowerCase().includes(searchKeyword)) return false;
    return true;
  });

  if (filtered.length === 0) {
    toast('印刷対象の資材がありません', 'warning');
    return;
  }

  const ids = filtered.map(p => p.id);
  sessionStorage.setItem('print_qr_ids', JSON.stringify(ids));
  window.open('print_qrs.html', '_blank');
}

function printInvCheckQrs() {
  const monthInput = $('#inv-check-month');
  if (!monthInput) return;
  const selectedMonth = monthInput.value;
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const prevDate = new Date(year, month - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const tempScans = DB.getTempScans() || [];
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];

  const prevClosing = monthly.find(m => m.month === prevMonthKey);
  const prevStockMap = {};
  if (prevClosing && prevClosing.items) {
    prevClosing.items.forEach(item => {
      prevStockMap[item.productId] = item.currQty || 0;
    });
  }

  const currentTempScans = tempScans.filter(s => s.month === selectedMonth);
  const tempScanMap = {};
  currentTempScans.forEach(s => {
    tempScanMap[s.productId] = s;
  });

  const listItems = products.map(prod => {
    const pid = prod.id;
    const scan = tempScanMap[pid];
    const prevQty = prevStockMap[pid] || 0;
    const currQty = scan ? scan.quantity : 0;
    const isScanned = !!scan;

    return {
      productId: pid,
      price: prod.price || 0,
      isScanned: isScanned,
      hasPrevQty: prevQty > 0
    };
  });

  const statusFilter = $('#inv-check-filter-status');
  const filterStatus = (statusFilter ? statusFilter.value : 'all') || 'all';
  let filteredItems = listItems;
  if (filterStatus === 'scanned') {
    filteredItems = listItems.filter(item => item.isScanned);
  } else if (filterStatus === 'missing') {
    filteredItems = listItems.filter(item => item.hasPrevQty && !item.isScanned);
  } else if (filterStatus === 'unpriced') {
    filteredItems = listItems.filter(item => item.price <= 0);
  }

  if (filteredItems.length === 0) {
    toast('印刷対象の資材がありません', 'warning');
    return;
  }

  const ids = filteredItems.map(item => item.productId);
  sessionStorage.setItem('print_qr_ids', JSON.stringify(ids));
  window.open('print_qrs.html', '_blank');
}
