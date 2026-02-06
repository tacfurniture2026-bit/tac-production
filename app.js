// ========================================
// 生産管理システム - メインアプリケーション
// ========================================

// 初期化
DB.init();

// ========================================
// グローバル変数
// ========================================

let currentUser = null;
let expandedOrders = new Set();
let ganttFilter = 'all';

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
  if (!order.items || order.items.length === 0) return 0;

  let totalProcesses = 0;
  let completedProcesses = 0;

  order.items.forEach(item => {
    // プロセス未定義のアイテムをスキップ
    if (!item || !item.processes) return;

    totalProcesses += item.processes.length;
    completedProcesses += (item.completed || []).length;
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
  $('#current-user-name').textContent = currentUser.displayName;
  $('#current-user-role').textContent = currentUser.role === 'admin' ? '管理者' : '作業者';

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
}

function navigateTo(pageName) {
  // ページ状態を保存
  localStorage.setItem('lastPage', pageName);

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

  // 緊急案件
  const urgentContainer = $('#urgent-orders');
  const urgentOrders = orders.filter(o => {
    if (!o.dueDate) return false;
    const days = Math.ceil((new Date(o.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    return days <= 3 && calculateProgress(o) < 100;
  });

  if (urgentOrders.length === 0) {
    urgentContainer.innerHTML = '<p class="text-muted">緊急案件はありません</p>';
  } else {
    urgentContainer.innerHTML = urgentOrders.map(o => {
      const days = Math.ceil((new Date(o.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      return `
        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border);">
          <div>
            <div style="font-weight: 500; cursor: pointer; color: var(--color-primary);" onclick="navigateToOrder(${o.id})">${o.projectName}</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-muted);">${o.productName} × ${o.quantity}</div>
          </div>
          <div style="color: ${days <= 1 ? 'var(--color-danger)' : 'var(--color-warning)'}; font-weight: 600;">
            ${days <= 0 ? '今日' : `あと${days}日`}
          </div>
        </div>
      `;
    }).join('');
  }

  // 最近の指示書
  const recentContainer = $('#recent-orders');
  if (orders.length === 0) {
    recentContainer.innerHTML = '<p class="text-muted">指示書がありません</p>';
  } else {
    recentContainer.innerHTML = orders.slice(0, 5).map(o => {
      const progress = calculateProgress(o);
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border);">
          <div>
            <div style="font-weight: 500; cursor: pointer; color: var(--color-primary);" onclick="navigateToOrder(${o.id})">${o.projectName}</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-muted);">${o.productName}</div>
          </div>
          <div class="progress-cell">
            <span class="progress-text">${progress}%</span>
            <div class="progress-bar">
              <div class="progress-bar-fill" style="width: ${progress}%;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ========================================
// ガントチャート（工程管理）- Monorevo風
// ========================================

function renderGantt() {
  const orders = DB.get(DB.KEYS.ORDERS);
  const boms = DB.get(DB.KEYS.BOM);

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

    html += `
      <tr>
        <td colspan="${allProcesses.length + 1}" class="matrix-group-header">
          <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleExpand(event, ${order.id})">
            <div>
              <span class="expand-btn" style="margin-right: 8px; font-weight: bold; display: inline-block; width: 20px; text-align: center;">${expandIcon}</span>
              <span style="display: inline-block; background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 8px;">生産指示書</span>
              <span style="font-weight:600;">${order.projectName}</span> / ${order.productName} (数量: ${order.quantity}, 部材数: ${order.items ? order.items.length : 0}) <span style="margin-left:8px; font-size:0.8rem; background:var(--color-bg-secondary); padding:2px 4px; border-radius:4px;">色: ${order.color || '-'}</span>
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

          if (!hasProcess) {
            html += `<td class="matrix-cell status-disabled"></td>`;
          } else {
            const statusClass = isComplete ? 'status-done' : 'status-todo';
            // エスケープ処理（シングルクォート対策）
            const safeProcess = process.replace(/'/g, "\\'");
            const safeOrderId = String(order.id).replace(/'/g, "\\'");

            html += `
               <td class="matrix-cell ${statusClass}"
                   onclick="toggleProcessStatus(this, '${safeOrderId}', ${itemIdx}, '${safeProcess}')"
                   style="width: 100px; min-width: 100px;">
                   ${isComplete ? '<span style="font-size:10px; color:#15803d; font-weight:bold;">完了</span>' : '<span style="font-size:10px; color:#94a3b8;">未</span>'}
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

function onQrCodeScanned(decodedText) {
  // スキャン成功時の処理
  stopQrScanner();

  const resultDiv = $('#qr-scan-result');
  const dataDiv = $('#qr-scan-data');

  if (resultDiv) resultDiv.style.display = 'block';

  // QRコードのフォーマットをパース
  // 期待フォーマット: "現場名|品名|部材コード" または "現場名,品名,部材コード"
  const parts = decodedText.split(/[|,\t]/);

  if (parts.length >= 3) {
    const projectName = parts[0].trim();
    const productName = parts[1].trim();
    const bomName = parts[2].trim();

    if (dataDiv) {
      dataDiv.innerHTML = `
        <div><strong>現場名:</strong> ${projectName}</div>
        <div><strong>品名:</strong> ${productName}</div>
        <div><strong>部材:</strong> ${bomName}</div>
      `;
    }

    // 自動選択を試みる
    selectFromQrData(projectName, productName, bomName);
  } else {
    // シンプルなフォーマットの場合
    if (dataDiv) {
      dataDiv.innerHTML = `<div>読取データ: ${decodedText}</div>`;
    }
    toast('QRコードを読み取りましたが、フォーマットが一致しません', 'warning');
  }

  // 成功音（バイブレーション）
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }
  toast('QRコードを読み取りました', 'success');
}

function selectFromQrData(projectName, productName, bomName) {
  const orders = DB.get(DB.KEYS.ORDERS);

  // 現場名と品名で指示書を検索
  const order = orders.find(o =>
    o.projectName.includes(projectName) && o.productName.includes(productName)
  );

  if (!order) {
    toast(`指示書が見つかりません: ${projectName} - ${productName}`, 'warning');
    return;
  }

  // 指示書を選択
  const orderSelect = $('#qr-order');
  orderSelect.value = order.id;
  updateQrItemSelect();

  // 部材を検索して選択
  setTimeout(() => {
    const item = order.items?.find(i =>
      i.bomName.includes(bomName) || i.partCode?.includes(bomName)
    );

    if (item) {
      const itemSelect = $('#qr-item');
      itemSelect.value = item.id;
      updateQrProcessSelect();
      toast('部材を自動選択しました。工程を選んで登録してください。', 'success');
    } else {
      toast(`部材が見つかりません: ${bomName}`, 'warning');
    }
  }, 100);
}

function updateQrItemSelect() {
  const orderId = parseInt($('#qr-order').value);
  const itemSelect = $('#qr-item');
  const processSelect = $('#qr-process');

  if (!orderId) {
    itemSelect.innerHTML = '<option value="">先に指示書を選択</option>';
    itemSelect.disabled = true;
    processSelect.innerHTML = '<option value="">先に部材を選択</option>';
    processSelect.disabled = true;
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
  const processSelect = $('#qr-process');

  if (!orderId || !itemId) {
    processSelect.innerHTML = '<option value="">先に部材を選択</option>';
    processSelect.disabled = true;
    return;
  }

  const orders = DB.get(DB.KEYS.ORDERS);
  const order = orders.find(o => o.id === orderId);
  const item = order?.items?.find(i => i.id === itemId);

  if (item) {
    const uncompletedProcesses = item.processes.filter(p => !(item.completed || []).includes(p));
    processSelect.innerHTML = '<option value="">選択してください</option>' +
      uncompletedProcesses.map(p => `<option value="${p}">${p}</option>`).join('');
    processSelect.disabled = false;
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
// 不良品管理
// ========================================

function renderDefects() {
  const defects = DB.get(DB.KEYS.DEFECTS);
  const tbody = $('#defects-body');

  if (defects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted p-4">不良品の記録がありません</td></tr>';
    return;
  }

  tbody.innerHTML = defects.map(d => `
    <tr>
      <td>${d.projectName}</td>
      <td>${d.productName}</td>
      <td>${d.bomName}</td>
      <td>${d.processName}</td>
      <td class="text-danger font-semibold">${d.count}</td>
      <td>${d.reason || '-'}</td>
      <td>${d.reporter}</td>
      <td><button class="btn btn-sm btn-icon" onclick="editDefect('${d.id}')" title="編集" style="margin-right: 4px;">✎</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDefect('${d.id}')">削除</button></td>
    </tr>
  `).join('');
}

function deleteDefect(id) {
  if (!confirm('この記録を削除しますか？')) return;

  const defects = DB.get(DB.KEYS.DEFECTS);
  // 型変換して比較（IDが数値か文字列か不明なため）
  const filtered = defects.filter(d => String(d.id) !== String(id));
  DB.save(DB.KEYS.DEFECTS, filtered);

  toast('削除しました', 'success');
  renderDefects();
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
  const allOrders = DB.get(DB.KEYS.ORDERS);
  // フィルタリング: 完了分を表示するかどうか
  const orders = allOrders.filter(o => {
    if (showCompletedOrders) return true;
    return calculateProgress(o) < 100;
  }).sort((a, b) => {
    // 納期が早い順（昇順）。未設定は最後尾へ。
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const tbody = $('#orders-body');

  // チェックボックスの状態を反映させるため、描画前にツールバーのチェック状態も同期
  const completedCheck = $('#show-completed-check');
  if (completedCheck) completedCheck.checked = showCompletedOrders;

  if (orders.length === 0) {
    if (allOrders.length > 0 && !showCompletedOrders) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted p-4">進行中の指示書はありません（完了分: ' + (allOrders.length - orders.length) + '件）</td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted p-4">指示書がありません</td></tr>';
    }
    return;
  }

  // テーブルヘッダーの修正も必要だが、JSで書き換えるか、HTMLで修正するか。
  // ここではHTMLのヘッダー修正もコードで行う（またはHTMLファイルを編集する）
  // 既存のHTMLヘッダーは8列。チェックボックス列を追加して9列にする必要がある。
  // ここではtbodyのみ生成。ヘッダーの修正はindex.htmlで行うこととする。

  tbody.innerHTML = orders.map(o => {
    const progress = calculateProgress(o);
    // 進捗100%ならスタイルを変える
    const isCompleted = progress === 100;
    const rowClass = isCompleted ? 'background: var(--color-bg-secondary); opacity: 0.8;' : '';

    return `
      <tr id="order-row-${o.id}" style="${rowClass}">
        <td class="text-center">
          <input type="checkbox" class="order-checkbox" value="${o.id}">
        </td>
        <td>${o.orderNo || '-'}</td>
        <td>${o.projectName}</td>
        <td>${o.productName}</td>
        <td>${o.quantity}</td>
        <td>${o.color || '-'}</td>
        <td>${o.startDate || '-'}</td>
        <td>${o.dueDate || '-'}</td>
        <td>
          <div class="progress-cell">
            <span class="progress-text">${progress}%</span>
            <div class="progress-bar">
              <div class="progress-bar-fill" style="width: ${progress}%; background: ${isCompleted ? 'var(--color-success)' : 'var(--color-primary)'};"></div>
            </div>
          </div>
        </td>
        <td>
          <button class="btn btn-sm btn-icon" onclick="editOrder(${o.id})" title="編集" style="margin-right: 4px;">✎</button>
          <button class="btn btn-sm btn-icon" onclick="copyOrder(${o.id})" title="複製">❐</button>
          <button class="btn btn-danger btn-sm" onclick="deleteOrder(${o.id})">削除</button>
        </td>
      </tr>
    `;
  }).join('');
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

  if (boms.length === 0) {
    container.innerHTML = '<div class="card p-4 text-center text-muted">BOMが登録されていません</div>';
    return;
  }

  // 製品別にグループ化
  const grouped = boms.reduce((acc, bom) => {
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
                <td><button class="btn btn-danger btn-sm" onclick="deleteBom(${b.id})">削除</button></td>
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

// ========================================
// 賃率管理
// ========================================

function renderRates() {
  const rates = DB.get(DB.KEYS.RATES);
  const tbody = $('#rates-body');

  if (rates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted p-4">賃率が登録されていません</td></tr>';
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
      <td class="text-right">${r.minuteRate?.toFixed(1) || 0}</td>
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
        ${u.username !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">削除</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function deleteUser(id) {
  if (!confirm('このユーザーを削除しますか？')) return;

  const users = DB.get(DB.KEYS.USERS);
  const filtered = users.filter(u => u.id !== id);
  DB.save(DB.KEYS.USERS, filtered);

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

  const items = productBoms.map((bom, idx) => ({
    id: idx + 1,
    bomName: bom.bomName,
    partCode: bom.partCode,
    processes: bom.processes || [],
    completed: []
  }));

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
// CSV一括登録 & 一括削除
// ========================================

function downloadCsvTemplate() {
  const headers = [
    'OrderNo', 'ProjectName', 'ProductName', 'Quantity', 'Color', 'StartDate', 'DueDate',
    'Note1', 'Note2', 'Note3', 'Note4', 'Note5', 'Note6', 'Note7', 'Note8', 'Note9', 'Note10'
  ];
  const example = [
    'Example-001', 'Aマンション', '片開きドア(H2000)', '1', 'シルバー', '2026-02-01', '2026-02-28',
    '採光部あり', '丁番色：黒', '', '', '', '', '', '', '', ''
  ];

  // BOM (Shift-JIS is hard in JS only without libraries, so we use UTF-8 with BOM for Excel compatibility)
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const content = headers.join(',') + '\n' + example.join(',');
  const blob = new Blob([bom, content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'order_import_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function importOrdersFromCsv(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');

    // ヘッダー行をスキップ
    if (lines.length < 2) {
      toast('データが含まれていません', 'warning');
      return;
    }

    const boms = DB.get(DB.KEYS.BOM);
    const validProductNames = [...new Set(boms.map(b => String(b.productName || '')))];

    let successCount = 0;
    let errorCount = 0;
    let errorMessages = [];

    // 1行ずつ処理 (1行目はヘッダーなのでスキップ)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 5) continue; // 最低限の列数チェック

      const orderNo = cols[0];
      const projectName = cols[1];
      const productName = cols[2];
      const quantity = parseInt(cols[3]) || 1;
      const color = cols[4];
      const startDate = cols[5];
      const dueDate = cols[6];
      // Note1~10
      const notes = [];
      for (let n = 0; n < 10; n++) {
        if (cols[7 + n]) {
          notes.push({ label: `備考${n + 1}`, value: cols[7 + n] });
        }
      }

      // バリデーション
      if (!projectName || !productName) {
        errorCount++;
        errorMessages.push(`${i + 1}行目: 物件名または品名が不足しています`);
        continue;
      }

      if (!validProductNames.includes(productName)) {
        errorCount++;
        errorMessages.push(`${i + 1}行目: 品名「${productName}」はマスターに存在しません`);
        continue;
      }

      // 部材展開 (自動的にFull Set)
      const productBoms = boms.filter(b => String(b.productName || '') === productName);
      const items = productBoms.map((bom, idx) => ({
        id: idx + 1,
        bomName: bom.bomName,
        partCode: bom.partCode,
        processes: bom.processes || [],
        completed: []
      }));

      // データ登録
      DB.add(DB.KEYS.ORDERS, {
        id: DB.nextId(DB.KEYS.ORDERS),
        orderNo,
        projectName,
        productName,
        quantity,
        color: color || '未指定',
        startDate,
        dueDate,
        notes,
        items
      });
      successCount++;
    }

    input.value = ''; // Reset input

    if (errorCount > 0) {
      alert(`インポート結果:\n成功: ${successCount}件\nエラー: ${errorCount}件\n\nエラー内容:\n${errorMessages.slice(0, 10).join('\n')}${errorMessages.length > 10 ? '\n...' : ''}`);
    } else {
      toast(`${successCount}件の指示書をインポートしました`, 'success');
    }

    renderOrders();
    if (typeof renderGantt === 'function') renderGantt();
  };

  reader.readAsText(file);
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

    if (!Array.isArray(boms)) {
      console.warn('BOM data is not an array:', boms);
      list.innerHTML = '<p class="text-danger">データ形式エラー (リセット推奨)</p>';
      return;
    }

    if (boms.length === 0) {
      list.innerHTML = '<p class="text-muted">登録データがありません</p>';
      return;
    }

    // Debug: データ確認
    console.log('Rendering BOMs:', boms.length);

    // カテゴリごとにグループ化
    const grouped = {};
    boms.forEach(b => {
      if (!b) return;
      const cat = b.category || '未分類';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(b);
    });

    let html = '';
    Object.keys(grouped).sort().forEach(cat => {
      html += `
      <div style="margin-bottom: 2rem;">
        <h3 style="border-bottom: 2px solid var(--color-border); padding-bottom: 0.5rem; margin-bottom: 1rem; display:flex; align-items:center;">
          <input type="checkbox" class="bom-cat-check" onchange="toggleBomChecks(this, '${cat}')" style="margin-right:0.5rem;">
          ${cat}
        </h3>
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 40px;">選択</th>
                <th>製品名</th>
                <th>BOM名</th>
                <th>部材CD</th>
                <th>工程</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${grouped[cat].map(b => {
        // 安全策: processesがundefinedの場合は空配列扱い
        const safeProcesses = Array.isArray(b.processes) ? b.processes : [];
        return `
                <tr>
                  <td style="text-align:center;">
                    <input type="checkbox" class="bom-check" value="${b.id}" data-cat="${cat}">
                  </td>
                  <td>${b.productName || ''}</td>
                  <td>${b.bomName || ''}</td>
                  <td>${b.partCode || ''}</td>
                  <td>
                    ${safeProcesses.length > 0 ?
            safeProcesses.map(p => `<span class="badge badge-primary">${p}</span>`).join('') :
            '<span class="text-muted">なし</span>'}
                  </td>
                  <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteBom(${b.id})">削除</button>
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
function restoreSampleBom() {
  if (!confirm('BOMデータを初期サンプルデータに戻しますか？\n現在のデータは全て削除されます。')) return;

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
      <input type="text" id="bom-processes" class="form-input" placeholder="例: 芯材カット,面材カット,芯組,フラッシュ">
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="createBom()">作成</button>
  `;

  showModal('新規BOM登録', body, footer);
}

function toggleBomChecks(catCheck, catName) {
  const checks = document.querySelectorAll(`.bom-check[data-cat="${catName}"]`);
  checks.forEach(c => c.checked = catCheck.checked);
}

function deleteSelectedBoms() {
  const checks = document.querySelectorAll('.bom-check:checked');
  if (checks.length === 0) {
    toast('削除するBOMを選択してください', 'warning');
    return;
  }

  if (!confirm(`選択された${checks.length}件のBOMを削除しますか？`)) return;

  const ids = Array.from(checks).map(c => parseInt(c.value));
  let boms = DB.get(DB.KEYS.BOM);
  boms = boms.filter(b => !ids.includes(b.id)); // ID is number

  DB.save(DB.KEYS.BOM, boms);
  toast(`${checks.length}件削除しました`, 'success');
  renderBom();
}

function createBom() {
  const category = $('#bom-category').value;
  const productName = $('#bom-product').value;
  const bomName = $('#bom-name').value;
  let partCode = $('#bom-code').value;
  const processesStr = $('#bom-processes').value;

  // GRIDロジック: カテゴリがGRIDの場合、不整合を防ぐため強制的に 部材CD = 製品名 とする
  if (category && category.toUpperCase() === 'GRID') {
    partCode = productName;
  }

  if (!productName || !bomName || !partCode) {
    toast('製品名、BOM名、部材CDは必須です', 'warning');
    return;
  }

  const processes = processesStr ? processesStr.split(',').map(p => p.trim()) : [];

  const boms = DB.get(DB.KEYS.BOM);
  boms.push({
    id: DB.nextId(DB.KEYS.BOM),
    category,
    productName,
    bomName,
    partCode,
    processes
  });
  DB.save(DB.KEYS.BOM, boms);

  toast('BOMを登録しました', 'success');
  hideModal();
  renderBom();
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

function processBomCsv(text) {
  const lines = text.split(/\r\n|\n/);
  const boms = DB.get(DB.KEYS.BOM);
  const existingBoms = [...boms];
  const newBoms = [];
  const duplicates = [];

  // 工程列の定義（標準的な並び順と仮定、またはヘッダーから推測）
  // ここでは固定のカラム位置から読み取る簡易ロジックを採用
  const PROCESS_COLUMNS = ['芯材カット', '面材カット', '芯組', 'フラッシュ', 'ランニングソー', 'エッヂバンダー', '仕上・梱包'];

  let lastCategory = '';
  let lastProductName = '';

  lines.forEach((line) => {
    if (!line.trim()) return;
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim()); // Simple CSV parse

    // ヘッダー行判定 (簡易)
    if (cols[0] === 'カテゴリ' || cols[1] === '製品名') return;
    if (cols[1] === '大分類') return;

    // データマッピング (A:カテゴリ, B:製品名, C:BOM名, D:部材CD, E~:工程)
    // Excelコピペ(TSV)とCSVで区切りが違うが、ここではCSV前提
    // もしTSVなら cols = line.split('\t');

    // CSVの場合のインデックス
    // 0: カテゴリ, 1: 製品名, 2: BOM名, 3: 部材CD, 4...: 工程

    let category = cols[0] || lastCategory;
    let productName = cols[1] || lastProductName;
    let bomName = cols[2];
    let partCode = cols[3];

    if (!bomName || !partCode) return;

    // 継続値の更新
    if (cols[0]) lastCategory = cols[0];
    if (cols[1]) lastProductName = cols[1];

    // GRIDロジック
    if (category && category.toUpperCase() === 'GRID') {
      partCode = productName;
    }

    // 重複チェック
    if (existingBoms.some(b => b.bomName === bomName && b.partCode === partCode)) {
      duplicates.push(bomName);
      // 上書きモードならここで既存を除外するか、newBomsに含めて後でマージ
    }

    // 工程解析 (4列目以降に '1' や '○' がある、または工程名が入っていると仮定)
    // ここではシンプルに「標準工程全て」または「指定なし」
    // 要望のCSVフォーマットに合わせて調整が必要だが、復旧優先で空配列または標準
    // 今回は空で登録し、後で編集可能にする
    const processes = [];

    newBoms.push({
      id: DB.nextId(DB.KEYS.BOM), // ID will be reassigned strictly later
      category,
      productName,
      bomName,
      partCode,
      processes
    });
  });

  if (newBoms.length === 0) {
    toast('インポート可能なデータが見つかりませんでした', 'warning');
    return;
  }

  // 重複確認
  if (duplicates.length > 0) {
    if (!confirm(`${duplicates.length}件の重複があります。上書き（追加）しますか？`)) return;
  }

  // ID採番し直しして保存
  let currentId = DB.nextId(DB.KEYS.BOM);
  newBoms.forEach(b => {
    b.id = currentId++;
    boms.push(b);
  });

  DB.save(DB.KEYS.BOM, boms);
  toast(`${newBoms.length}件インポートしました`, 'success');
  hideModal();
  renderBom();
}

// Paste Import (Excel copy-paste)
function showBomPasteImport() {
  const body = `
        <div class="form-group">
            <label>Excelからコピーしたデータを貼り付けてください</label>
            <textarea id="bom-paste-area" class="form-input" style="height: 200px; font-family: monospace;" placeholder="カテゴリ	製品名	BOM名	部材CD	工程..."></textarea>
            <p class="text-muted" style="font-size: 0.8rem; margin-top: 0.5rem;">※タブ区切りテキスト（Excel標準）に対応しています</p>
        </div>
    `;
  const footer = `
        <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
        <button class="btn btn-primary" onclick="executeBomPasteImport()">インポート</button>
    `;
  showModal('BOMペースト登録', body, footer);
}

function executeBomPasteImport() {
  const text = document.getElementById('bom-paste-area').value;
  if (!text.trim()) return;

  // Process TSV
  // Reuse processBomCsv logic but with tab split?
  // For safety/speed, implementing separate simple logic here

  const lines = text.split(/\r\n|\n/);
  const boms = DB.get(DB.KEYS.BOM);
  let count = 0;
  let nextId = DB.nextId(DB.KEYS.BOM);

  lines.forEach(line => {
    if (!line.trim()) return;
    const cols = line.split('\t');
    if (cols.length < 4) return;

    const category = cols[0].trim();
    const productName = cols[1].trim();
    const bomName = cols[2].trim();
    let partCode = cols[3].trim();

    if (!productName || !bomName) return;

    // GRID Logic
    if (category.toUpperCase() === 'GRID') {
      partCode = productName;
    }

    boms.push({
      id: nextId++,
      category,
      productName,
      bomName,
      partCode,
      processes: [] // Default empty
    });
    count++;
  });

  DB.save(DB.KEYS.BOM, boms);
  toast(`${count}件登録しました`, 'success');
  hideModal();
  renderBom();
}

function showAddRateModal() {
  const body = `
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
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="createRate()">作成</button>
  `;

  showModal('新規賃率作成', body, footer);
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
    minuteRate
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
        <strong>形式（11列）:</strong><br>
        [A列:名称] [ID] [C列:判定CD] [部] [課] [係] [G列:月給] [日給] [時給] [分給] [秒給]
      </div>
      <small>※ヘッダー行（3行目）も含めて、A列〜J列（またはK列）をまとめてコピーしてください。</small>
    </div>
    <textarea id="import-rate-data" class="form-input" rows="10" placeholder="ここに貼り付けてください..."></textarea>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="hideModal()">キャンセル</button>
    <button class="btn btn-primary" onclick="importRates()">インポート</button>
  `;

  showModal('賃率一括インポート', body, footer);
}

function importRates() {
  const data = $('#import-rate-data').value.trim();
  if (!data) {
    toast('データを入力してください', 'warning');
    return;
  }

  const lines = data.split('\n');
  const existingRates = DB.get(DB.KEYS.RATES);
  const newRates = [];
  let skipCount = 0;
  let errorDetails = [];

  console.log(`Starting import of ${lines.length} lines...`);

  lines.forEach((line, index) => {
    // 空行はスキップ
    if (!line.trim()) return;

    // タブ区切り以外（例えばExcelからのコピペでスペース変換されてしまった場合など）も考慮したいが、
    // 基本はタブ区切りを想定。
    const cols = line.split('\t');

    // 列数チェック緩和: 最低限 コード(2), 部門(3), 月給(6) くらいがあれば許可
    if (cols.length < 7) {
      console.warn(`Line ${index + 1} skipped: Not enough columns (${cols.length})`, line);
      skipCount++;
      return;
    }

    // ヘッダー判定（C列が空、または "コード" などの文字列）
    const col2 = (cols[2] || '').trim();
    if (col2 === 'コード' || col2 === '職種・役職CD' || !col2) {
      console.log(`Line ${index + 1} skipped: Header or empty code`);
      skipCount++;
      return;
    }

    // 数値パース（カンマ除去）
    const parseVal = (val) => {
      if (!val) return 0;
      // 円マークやカンマを除去
      const numStr = val.toString().replace(/[¥,]/g, '').trim();
      const num = parseFloat(numStr);
      return isNaN(num) ? 0 : num;
    };

    // データマッピング (A=0, Start from C=2)
    // C=Code, D=Dept, E=Section, F=SubSection
    // G=Monthly, H=Daily, I=Hourly, J=Minute

    const rateCode = col2;
    const department = (cols[3] || '').trim();
    const section = (cols[4] || '').trim();
    const subsection = (cols[5] || '').trim();

    const monthlyRate = parseVal(cols[6]);
    const dailyRate = parseVal(cols[7]);
    const hourlyRate = parseVal(cols[8]);
    const minuteRate = parseVal(cols[9]); // J列がなくても0になる

    if (!rateCode || !department) {
      console.warn(`Line ${index + 1} skipped: Missing code or dept`);
      skipCount++;
      return;
    }

    newRates.push({
      // IDは後で採番
      rateCode,
      department,
      section,
      subsection,
      monthlyRate,
      dailyRate,
      hourlyRate,
      minuteRate
    });
  });

  if (newRates.length === 0) {
    console.error('No valid rates parsed');
    toast('インポートできるデータがありませんでした。\n形式を確認してください（タブ区切り）', 'warning');
    return;
  }

  // 既存データとマージ
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

  const msg = `インポート完了: 追加 ${addedCount}件, 更新 ${updatedCount}件 (スキップ ${skipCount}行)`;
  console.log(msg);
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

  users.push({
    id: DB.nextId(DB.KEYS.USERS),
    username,
    password,
    displayName,
    role,
    department
  });
  DB.save(DB.KEYS.USERS, users);

  toast('ユーザーを作成しました', 'success');
  hideModal();
  renderUsers();
}

// ========================================
// イベントリスナー
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // 認証チェック
  checkAuth();

  // ログインフォーム
  $('#login-form').addEventListener('submit', (e) => {
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
  $('#logout-btn').addEventListener('click', logout);

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
  $('#expand-all').addEventListener('click', expandAll);
  $('#collapse-all').addEventListener('click', collapseAll);

  // QRページ
  $('#qr-order').addEventListener('change', updateQrItemSelect);
  $('#qr-item').addEventListener('change', updateQrProcessSelect);

  $('#qr-form').addEventListener('submit', (e) => {
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

  // モーダル
  $('#modal-close').addEventListener('click', hideModal);
  $('#modal-overlay').addEventListener('click', (e) => {
    if (e.target === $('#modal-overlay')) hideModal();
  });

  // 各種追加ボタン
  $('#add-order-btn').addEventListener('click', showAddOrderModal);
  $('#add-defect-btn').addEventListener('click', showAddDefectModal);
  $('#add-bom-btn').addEventListener('click', showAddBomModal);

  const deleteBomBtn = $('#delete-all-bom-btn');
  if (deleteBomBtn) deleteBomBtn.addEventListener('click', deleteAllBoms);

  const deleteSelBtn = $('#delete-selected-bom-btn');
  if (deleteSelBtn) deleteSelBtn.addEventListener('click', deleteSelectedBoms);

  $('#import-bom-btn').addEventListener('click', showImportBomModal);
  $('#add-rate-btn').addEventListener('click', showAddRateModal);
  $('#import-rates-btn').addEventListener('click', showImportRateModal);
  $('#add-user-btn').addEventListener('click', showAddUserModal);

  // 月次報告
  $('#filter-report-btn').addEventListener('click', renderReport);
  $('#generate-report-btn').addEventListener('click', printReport);
});

// ========================================
// 月次報告
// ========================================

function renderReport() {
  const startDate = $('#report-start-date').value;
  const endDate = $('#report-end-date').value;

  const orders = DB.get(DB.KEYS.ORDERS);
  const rates = DB.get(DB.KEYS.RATES);
  const boms = DB.get(DB.KEYS.BOM);

  // 完了案件をフィルタ
  let filteredOrders = orders.filter(o => calculateProgress(o) === 100);

  // 日付フィルタ
  if (startDate) {
    filteredOrders = filteredOrders.filter(o => o.dueDate >= startDate);
  }
  if (endDate) {
    filteredOrders = filteredOrders.filter(o => o.dueDate <= endDate);
  }

  // 統計計算
  let totalQuantity = 0;
  let totalCost = 0;
  let totalTime = 0;
  let departmentCosts = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };
  let departmentTimes = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };

  // 賃率マップ
  const rateMap = {};
  rates.forEach(r => {
    rateMap[r.department] = parseFloat(r.rate) || 0;
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
    }

    totalCost += orderCost;
    totalTime += orderTime;

    Object.keys(departmentCosts).forEach(dept => {
      departmentCosts[dept] += orderDeptCosts[dept] || 0;
      departmentTimes[dept] += orderDeptTimes[dept] || 0;
    });

    return `
      <tr>
        <td>${order.projectName}</td>
        <td>${order.productName}</td>
        <td>${formatDate(order.dueDate)}</td>
        <td>${order.quantity}</td>
        <td>${Math.round(orderCost).toLocaleString()}</td>
        <td>${orderTime.toLocaleString()}</td>
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

  // 在庫計算（カテゴリ別）
  const categoryStocks = {};
  let totalInvAmount = 0;
  let totalFixedAmount = 0;
  let totalNormalAmount = 0;

  invProducts.forEach(product => {
    const stock = getCurrentStock(product.id, invLogs);
    const amount = stock * product.price;

    // カテゴリ別集計
    const catName = INV_CATEGORIES[product.category] || product.category;
    if (!categoryStocks[catName]) {
      categoryStocks[catName] = { normal: 0, fixed: 0, total: 0 };
    }

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

  // 月別在庫推移データ（過去6ヶ月）
  const monthlyTrend = [];
  const currentMonth = new Date();
  for (let i = 5; i >= 0; i--) {
    const targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
    const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    const monthData = invMonthly.find(m => m.month === monthKey);
    monthlyTrend.push({
      month: monthKey,
      label: `${targetDate.getMonth() + 1}月`,
      total: monthData?.total || 0,
      fixedTotal: monthData?.fixedTotal || 0
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
            <span style="font-size: 0.875rem;">${cat}</span>
            <span style="font-size: 0.875rem; font-weight: 500;">¥${data.total.toLocaleString()}</span>
          </div>
          <div style="background: var(--color-bg-tertiary); border-radius: 4px; height: 12px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light)); height: 100%; width: ${barWidth}%; transition: width 0.3s;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem;">
            <span>通常: ¥${data.normal.toLocaleString()}</span>
            <span>不動品: ¥${data.fixed.toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join('');

  // 月別推移グラフ
  const maxTrendValue = Math.max(...monthlyTrend.map(m => m.total), 1);
  const trendBars = monthlyTrend.map(m => {
    const barHeight = Math.round((m.total / maxTrendValue) * 100);
    const fixedHeight = m.total > 0 ? Math.round((m.fixedTotal / m.total) * barHeight) : 0;
    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
        <div style="flex: 1; width: 100%; max-width: 40px; display: flex; flex-direction: column; justify-content: flex-end; height: 120px;">
          <div style="background: linear-gradient(180deg, var(--color-primary), var(--color-primary-light)); width: 100%; height: ${barHeight}%; border-radius: 4px 4px 0 0; position: relative;">
            ${fixedHeight > 0 ? `<div style="position: absolute; bottom: 0; left: 0; right: 0; height: ${fixedHeight}%; background: var(--color-warning); opacity: 0.7; border-radius: 0 0 4px 4px;"></div>` : ''}
          </div>
        </div>
        <div style="font-size: 0.75rem; margin-top: 0.5rem; color: var(--color-text-muted);">${m.label}</div>
        <div style="font-size: 0.625rem; color: var(--color-text-muted);">${m.total > 0 ? `¥${Math.round(m.total / 10000)}万` : '-'}</div>
      </div>
    `;
  }).join('');

  const html = `
    <div class="report-print" id="report-print-area">
      <div class="report-title">★月次・製造原価報告書 (${dateRangeText})</div>
      <div class="report-meta">作成日時: ${createdAt}</div>
      
      <div class="report-section">
        <h3>■月次総括サマリ</h3>
        <div class="report-summary">
          <div class="summary-item">
            <span class="summary-label">総出荷台数</span>
            <span class="summary-value">${totalQuantity} 台</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">加工費総額</span>
            <span class="summary-value">${totalCost.toLocaleString()} 円</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">総生産時間</span>
            <span class="summary-value">${totalTime.toLocaleString()} 分</span>
          </div>
        </div>
      </div>

      <!-- 在庫金額セクション -->
      <div class="report-section" style="background: var(--color-bg-secondary); padding: 1.5rem; border-radius: var(--radius-lg); margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">■在庫金額サマリ</h3>
        <div class="report-summary" style="margin-bottom: 1.5rem;">
          <div class="summary-item">
            <span class="summary-label">在庫金額合計</span>
            <span class="summary-value" style="color: var(--color-primary);">¥${totalInvAmount.toLocaleString()}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">通常在庫</span>
            <span class="summary-value" style="color: var(--color-success);">¥${totalNormalAmount.toLocaleString()}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">不動品在庫</span>
            <span class="summary-value" style="color: var(--color-warning);">¥${totalFixedAmount.toLocaleString()}</span>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          <!-- 分類別グラフ -->
          <div>
            <h4 style="font-size: 0.875rem; margin-bottom: 1rem; color: var(--color-text-secondary);">📊 分類別在庫金額</h4>
            ${categoryRows || '<p class="text-muted">在庫データがありません</p>'}
          </div>
          
          <!-- 月別推移グラフ -->
          <div>
            <h4 style="font-size: 0.875rem; margin-bottom: 1rem; color: var(--color-text-secondary);">📈 月別在庫推移（過去6ヶ月）</h4>
            <div style="display: flex; gap: 0.5rem; align-items: flex-end; padding: 1rem; background: var(--color-bg-primary); border-radius: var(--radius-md);">
              ${trendBars}
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.75rem;">
              <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 12px; height: 12px; background: var(--color-primary); border-radius: 2px;"></span> 通常</span>
              <span style="display: flex; align-items: center; gap: 0.25rem;"><span style="width: 12px; height: 12px; background: var(--color-warning); border-radius: 2px;"></span> 不動品</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="report-section">
        <h3>■詳細データ一覧</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>物件名</th>
              <th>製品名</th>
              <th>納期</th>
              <th>台数</th>
              <th>加工費合計</th>
              <th>時間(分)</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows || '<tr><td colspan="6" class="text-center text-muted">完了案件がありません</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div class="report-section">
        <h3>■部門別集計</h3>
        <div class="report-departments">
          ${Object.entries(departmentCosts).map(([dept, cost]) => `
            <div class="dept-item">
              <span class="dept-name">${dept}</span>
              <span class="dept-cost">${Math.round(cost).toLocaleString()} 円</span>
              <span class="dept-time" style="font-size: 0.75rem; color: var(--color-text-muted);">(${(departmentTimes[dept] || 0).toLocaleString()} 分)</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  $('#report-content').innerHTML = html;
}

function printReport() {
  const reportArea = $('#report-print-area');
  if (!reportArea) {
    toast('先に集計を実行してください', 'warning');
    return;
  }

  // 印刷用ウィンドウで開く
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>月次報告書</title>
      <style>
        body { font-family: 'Noto Sans JP', sans-serif; padding: 2rem; color: #1F2937; }
        .report-title { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; }
        .report-meta { color: #6B7280; margin-bottom: 2rem; }
        .report-section { margin-bottom: 2rem; }
        .report-section h3 { font-size: 1rem; margin-bottom: 1rem; color: #1F2937; }
        .report-summary { display: flex; gap: 2rem; margin-bottom: 1rem; }
        .summary-item { display: flex; flex-direction: column; }
        .summary-label { font-size: 0.875rem; color: #6B7280; }
        .summary-value { font-size: 1.25rem; font-weight: bold; }
        .report-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .report-table th, .report-table td { border: 1px solid #D1D5DB; padding: 0.5rem; text-align: left; }
        .report-table th { background: #F3F4F6; font-weight: 600; }
        .report-departments { display: flex; gap: 2rem; }
        .dept-item { display: flex; flex-direction: column; }
        .dept-name { font-size: 0.875rem; color: #6B7280; }
        .dept-cost { font-size: 1rem; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      ${reportArea.innerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
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
  '04': '小口テープ',
  '05': '金具',
  '06': 'ダンボール',
  '07': '接着剤',
  '08': '仕入備品',
  '09': 'PAO資材',
  '10': '製品在庫',
  '11': '工場部材',
  '15': '外注在庫',
  '16': '仕掛品'
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

function renderInvScanPage() {
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
      const id = productIdInput.value.trim();
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

  // スマホの場合は自動でカメラ起動 -> 廃止（ボタンで起動）
  /*
  if (isMobileDevice()) {
    setTimeout(() => startInvScanner(), 500);
  }
  */
}

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

  const resultDiv = $('#inv-scan-result');
  const dataDiv = $('#inv-scan-data');
  const productIdInput = $('#inv-scan-product-id');

  // 資材IDをセット
  productIdInput.value = decodedText.trim();
  displayProductInfo(decodedText.trim());

  if (resultDiv) resultDiv.style.display = 'block';
  if (dataDiv) dataDiv.innerHTML = `<div>読取ID: ${decodedText}</div>`;

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
    toast('商品が見つかりません', 'error');
    return;
  }

  // 棚卸ログに追加
  const logs = DB.get(DB.KEYS.INV_LOGS);
  logs.push({
    id: Date.now(),
    productId: productId,
    quantity: quantity,
    type: 'count',
    worker: currentUser.displayName,
    note: '',
    timestamp: new Date().toISOString()
  });
  DB.save(DB.KEYS.INV_LOGS, logs);

  toast(`${product.name}の棚卸を登録しました（${quantity}個）`, 'success');

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
  const logs = DB.get(DB.KEYS.INV_LOGS);
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const today = new Date().toISOString().split('T')[0];

  const todayLogs = logs.filter(log => log.timestamp.startsWith(today)).reverse().slice(0, 10);
  const container = $('#inv-today-logs');

  if (todayLogs.length === 0) {
    container.innerHTML = '<p class="text-muted">本日の履歴がありません</p>';
    return;
  }

  container.innerHTML = todayLogs.map(log => {
    const product = products.find(p => p.id === log.productId);
    const typeLabel = log.type === 'count' ? '棚卸' : log.type === 'in' ? '入庫' : '出庫';
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
  tbody.innerHTML = filtered.map(p => `
    <tr class="${p.isFixed ? 'fixed-product-row' : ''}">
      <td>${p.id}</td>
      <td>${INV_CATEGORIES[p.category] || p.category}</td>
      <td>${p.name}</td>
      <td>¥${p.price.toLocaleString()}</td>
      <td>${p.isFixed ? '✓' : ''}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editInvProduct('${p.id}')">編集</button>
        <button class="btn btn-sm btn-danger" onclick="deleteInvProduct('${p.id}')">削除</button>
      </td>
    </tr>
  `).join('');
}

function showAddInvProductModal() {
  $('#modal-title').textContent = '商品登録';
  $('#modal-body').innerHTML = `
    <form id="inv-product-form">
      <div class="form-group">
        <label>分類</label>
        <select id="inv-prod-category" class="form-input" required>
          ${Object.entries(INV_CATEGORIES).map(([code, name]) =>
    `<option value="${code}">${code}: ${name}</option>`
  ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>品名</label>
        <input type="text" id="inv-prod-name" class="form-input" required>
      </div>
      <div class="form-group">
        <label>単価</label>
        <input type="number" id="inv-prod-price" class="form-input" min="0" required>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="inv-prod-fixed"> 不動品</label>
      </div>
    </form>
  `;
  $('#modal-footer').innerHTML = `
    <button class="btn btn-secondary" id="modal-cancel">キャンセル</button>
    <button class="btn btn-primary" id="modal-save">登録</button>
  `;
  $('#modal-overlay').classList.remove('hidden');

  $('#modal-cancel').onclick = closeModal;
  $('#modal-close').onclick = closeModal;
  $('#modal-save').onclick = saveNewInvProduct;
}

function saveNewInvProduct() {
  const category = $('#inv-prod-category').value;
  const name = $('#inv-prod-name').value.trim();
  const price = parseInt($('#inv-prod-price').value) || 0;
  const isFixed = $('#inv-prod-fixed').checked;

  if (!name) {
    toast('品名を入力してください', 'error');
    return;
  }

  const products = DB.get(DB.KEYS.INV_PRODUCTS);

  // ID自動採番
  const prefix = 'N' + category;
  const existingIds = products.filter(p => p.id.startsWith(prefix)).map(p => parseInt(p.id.substring(3)) || 0);
  const nextNum = Math.max(0, ...existingIds) + 1;
  const newId = prefix + String(nextNum).padStart(12, '0');

  products.push({
    id: newId,
    name: name,
    category: category,
    price: price,
    isFixed: isFixed
  });
  DB.save(DB.KEYS.INV_PRODUCTS, products);

  toast(`${name}を登録しました（${newId}）`, 'success');
  closeModal();
  renderInvProductsTable();
}

function editInvProduct(id) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const product = products.find(p => p.id === id);
  if (!product) return;

  $('#modal-title').textContent = '商品編集';
  $('#modal-body').innerHTML = `
    <form id="inv-product-form">
      <div class="form-group">
        <label>資材ID</label>
        <input type="text" class="form-input" value="${product.id}" disabled>
      </div>
      <div class="form-group">
        <label>分類</label>
        <select id="inv-prod-category" class="form-input" required>
          ${Object.entries(INV_CATEGORIES).map(([code, name]) =>
    `<option value="${code}" ${product.category === code ? 'selected' : ''}>${code}: ${name}</option>`
  ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>品名</label>
        <input type="text" id="inv-prod-name" class="form-input" value="${product.name}" required>
      </div>
      <div class="form-group">
        <label>単価</label>
        <input type="number" id="inv-prod-price" class="form-input" value="${product.price}" min="0" required>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="inv-prod-fixed" ${product.isFixed ? 'checked' : ''}> 不動品</label>
      </div>
    </form>
  `;
  $('#modal-footer').innerHTML = `
    <button class="btn btn-secondary" id="modal-cancel">キャンセル</button>
    <button class="btn btn-primary" id="modal-save">更新</button>
  `;
  $('#modal-overlay').classList.remove('hidden');

  $('#modal-cancel').onclick = closeModal;
  $('#modal-close').onclick = closeModal;
  $('#modal-save').onclick = () => updateInvProduct(id);
}

function updateInvProduct(id) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS);
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return;

  products[idx].category = $('#inv-prod-category').value;
  products[idx].name = $('#inv-prod-name').value.trim();
  products[idx].price = parseInt($('#inv-prod-price').value) || 0;
  products[idx].isFixed = $('#inv-prod-fixed').checked;

  DB.save(DB.KEYS.INV_PRODUCTS, products);
  toast('更新しました', 'success');
  closeModal();
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

  $('#view-inv-monthly-btn').onclick = viewInvMonthlySummary;
  $('#run-inv-closing-btn').onclick = runInvMonthlyClosing;
}

function viewInvMonthlySummary() {
  const month = $('#inv-closing-month').value;
  if (!month) {
    toast('年月を選択してください', 'error');
    return;
  }

  const result = calculateInvMonthly(month);
  displayInvMonthlyResult(result);
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

  // 当月のログをフィルタ
  const monthLogs = logs.filter(l => l.timestamp.startsWith(month));

  // 商品ごとの在庫計算
  const items = [];
  const summary = {};

  products.forEach(p => {
    // 前月在庫
    let prevQty = 0;
    if (prevData) {
      const prevItem = prevData.items.find(i => i.productId === p.id);
      if (prevItem) prevQty = prevItem.currQty;
    }

    // 当月在庫（ログから計算）
    let currQty = prevQty;
    const productLogs = monthLogs.filter(l => l.productId === p.id);
    productLogs.forEach(log => {
      if (log.type === 'count') {
        currQty = log.quantity;
      } else if (log.type === 'in') {
        currQty += log.quantity;
      } else if (log.type === 'out') {
        currQty -= log.quantity;
      }
    });

    // 不動品の場合、ログがなければ前月在庫を引き継ぐ
    if (p.isFixed && productLogs.length === 0) {
      currQty = prevQty;
    }

    const diff = currQty - prevQty;
    const amount = currQty * p.price;

    items.push({
      productId: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      prevQty: prevQty,
      currQty: currQty,
      diff: diff,
      amount: amount,
      isFixed: p.isFixed
    });

    // 分類別集計
    const catKey = p.isFixed ? 'fixed' : p.category;
    if (!summary[catKey]) {
      summary[catKey] = { name: p.isFixed ? '不動品' : (INV_CATEGORIES[p.category] || 'その他'), amount: 0, diff: 0 };
    }
    summary[catKey].amount += amount;
    summary[catKey].diff += diff * p.price;
  });

  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return { month, items, summary, total };
}

function displayInvMonthlyResult(result) {
  const container = $('#inv-monthly-result');

  // 分類別集計表
  let summaryRows = '';
  let summaryTotal = 0, summaryDiff = 0;
  let normalTotal = 0, fixedTotal = 0;

  // カテゴリデータを収集
  const categoryData = [];

  // カテゴリ順に表示
  Object.keys(INV_CATEGORIES).forEach(code => {
    if (result.summary[code]) {
      const s = result.summary[code];
      summaryRows += `<tr><td>${code}: ${s.name}</td><td style="text-align: right;">¥${s.amount.toLocaleString()}</td><td style="text-align: right; color: ${s.diff >= 0 ? 'green' : 'red'};">${s.diff >= 0 ? '+' : ''}¥${s.diff.toLocaleString()}</td></tr>`;
      summaryTotal += s.amount;
      summaryDiff += s.diff;
      normalTotal += s.amount;
      categoryData.push({ name: s.name, amount: s.amount, isFixed: false });
    }
  });

  // 不動品
  if (result.summary['fixed']) {
    const s = result.summary['fixed'];
    summaryRows += `<tr class="row-fixed-product"><td>不動品</td><td style="text-align: right;">¥${s.amount.toLocaleString()}</td><td style="text-align: right; color: ${s.diff >= 0 ? 'green' : 'red'};">${s.diff >= 0 ? '+' : ''}¥${s.diff.toLocaleString()}</td></tr>`;
    summaryTotal += s.amount;
    summaryDiff += s.diff;
    fixedTotal = s.amount;
    categoryData.push({ name: '不動品', amount: s.amount, isFixed: true });
  }

  const tacTotal = Math.round(summaryTotal * 1.01);

  // 分類別グラフバー生成
  const sortedCategories = categoryData.sort((a, b) => b.amount - a.amount);
  const categoryBars = sortedCategories.map(cat => {
    const barWidth = summaryTotal > 0 ? Math.round((cat.amount / summaryTotal) * 100) : 0;
    const bgColor = cat.isFixed ? '#ffc107' : 'var(--color-primary)';
    return `
      <div style="margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.875rem;">
          <span>${cat.name}</span>
          <span style="font-weight: 500;">¥${cat.amount.toLocaleString()} (${barWidth}%)</span>
        </div>
        <div style="background: var(--color-bg-tertiary); border-radius: 4px; height: 16px; overflow: hidden;">
          <div style="background: ${bgColor}; height: 100%; width: ${barWidth}%; transition: width 0.3s;"></div>
        </div>
      </div>
    `;
  }).join('');

  // ドーナツ風サマリー
  const normalPercent = summaryTotal > 0 ? Math.round((normalTotal / summaryTotal) * 100) : 0;
  const fixedPercent = summaryTotal > 0 ? Math.round((fixedTotal / summaryTotal) * 100) : 0;

  container.innerHTML = `
    <!-- サマリーカード -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
      <div class="card" style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light)); color: white; padding: 1.25rem;">
        <div style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">📦 在庫金額合計</div>
        <div style="font-size: 1.5rem; font-weight: bold;">¥${summaryTotal.toLocaleString()}</div>
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
  `;
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
  link.click();
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
  // テーマ初期化
  if (typeof initTheme === 'function') initTheme();

  // リアルタイム同期インジケータ
  setTimeout(() => {
    const indicator = document.createElement('div');
    Object.assign(indicator.style, {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 'bold',
      zIndex: '9999',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: 'sans-serif'
    });

    // Firebase接続状態チェック
    const isOnline = (typeof firebase !== 'undefined' && typeof firebase.apps !== 'undefined' && firebase.apps.length > 0);

    if (isOnline) {
      indicator.style.background = '#ECFDF5';
      indicator.style.color = '#047857';
      indicator.style.border = '1px solid #A7F3D0';
      indicator.innerHTML = '<span style="width:8px; height:8px; background:#10B981; border-radius:50%;"></span> リアルタイム同期: ON';
    } else {
      indicator.style.background = '#FEF2F2';
      indicator.style.color = '#B91C1C';
      indicator.style.border = '1px solid #FECACA';
      indicator.innerHTML = '<span style="width:8px; height:8px; background:#EF4444; border-radius:50%;"></span> リアルタイム同期: OFF';
    }

    document.body.appendChild(indicator);
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
  // ユーザーに「反応した」ことを伝えるため、データ保存を待たずに色を変える
  if (cellElement) {
    const isDone = cellElement.classList.contains('status-done');
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
    }

    // 3. 保存
    DB.save(DB.KEYS.ORDERS, orders);

    // 再描画はFirebaseのリスナー任せにするか、遅延させる
    // 即時再描画すると、Optimistic Updateと競合してチカチカする場合があるため
  } catch (e) {
    console.error('Toggle Error:', e);
    alert('エラーが発生しました: ' + e.message);
  }
};
