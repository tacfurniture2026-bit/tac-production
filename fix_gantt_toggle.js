const fs = require('fs');

console.log('--- Applying Gantt toggle responsiveness & stability fix (v6.68.0) ---');

// 1. Update data.js
let dataJs = fs.readFileSync('data.js', 'utf8');
const oldDataRefresh = `function refreshCurrentPage() {
    // 現在表示中のページを再描画
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        if (typeof navigateTo === 'function') {`;

const newDataRefresh = `function refreshCurrentPage() {
    // 現在表示中のページを再描画
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        if (pageId === 'gantt' && typeof window !== 'undefined' && window._isGanttLocalToggleActive) {
            return;
        }
        if (typeof navigateTo === 'function') {`;

if (dataJs.includes(oldDataRefresh)) {
    dataJs = dataJs.replace(oldDataRefresh, newDataRefresh);
    fs.writeFileSync('data.js', dataJs);
    console.log('Updated data.js');
} else {
    console.log('data.js already updated or pattern not matched');
}

// 2. Function to update app.js and app-mobile.js
function patchAppFile(filename) {
    let code = fs.readFileSync(filename, 'utf8');

    // a) refreshCurrentPage
    const oldRefreshApp = `window.refreshCurrentPage = function () {
  const activePage = localStorage.getItem('lastPage') || 'dashboard';`;
    const newRefreshApp = `window.refreshCurrentPage = function () {
  const activePage = localStorage.getItem('lastPage') || 'dashboard';

  // 棚卸スキャン画面およびガントチャート操作中の全再描画抑止
  if (activePage === 'inv-scan') return;
  if (activePage === 'gantt' && window._isGanttLocalToggleActive) return;`;

    if (code.includes(oldRefreshApp) && !code.includes('if (activePage === \'gantt\' && window._isGanttLocalToggleActive) return;')) {
        code = code.replace(oldRefreshApp, newRefreshApp);
    }

    // b) navigateTo
    const oldNav = `function navigateTo(pageName) {
  if (isNavigating) return;`;
    const newNav = `function navigateTo(pageName) {
  if (typeof window.flushGanttSave === 'function') window.flushGanttSave();
  if (isNavigating) return;`;
    if (code.includes(oldNav) && !code.includes('if (typeof window.flushGanttSave === \'function\') window.flushGanttSave();\n  if (isNavigating) return;')) {
        code = code.replace(oldNav, newNav);
    }

    // c) renderGantt onclick passing event
    const oldOnclick = `onclick="toggleProcessStatus(this, '\${safeOrderId}', \${itemIdx}, '\${safeProcess}')"`;
    const newOnclick = `onclick="toggleProcessStatus(this, '\${safeOrderId}', \${itemIdx}, '\${safeProcess}', event)"`;
    code = code.replace(oldOnclick, newOnclick);

    // d) toggleExpand, expandAll, collapseAll
    const oldToggleExpand = `function toggleExpand(event, orderId) {
  if (event) event.stopPropagation();`;
    const newToggleExpand = `function toggleExpand(event, orderId) {
  if (event) event.stopPropagation();
  if (typeof window.flushGanttSave === 'function') window.flushGanttSave();`;
    if (code.includes(oldToggleExpand) && !code.includes('if (typeof window.flushGanttSave === \'function\') window.flushGanttSave();\n\n  // String / Number 型両方に対応')) {
        code = code.replace(oldToggleExpand, newToggleExpand);
    }

    const oldExpandAll = `function expandAll() {
  const orders = DB.get(DB.KEYS.ORDERS);`;
    const newExpandAll = `function expandAll() {
  if (typeof window.flushGanttSave === 'function') window.flushGanttSave();
  const orders = DB.get(DB.KEYS.ORDERS);`;
    if (code.includes(oldExpandAll) && !code.includes('if (typeof window.flushGanttSave === \'function\') window.flushGanttSave();\n  const orders = DB.get(DB.KEYS.ORDERS);')) {
        code = code.replace(oldExpandAll, newExpandAll);
    }

    const oldCollapseAll = `function collapseAll() {
  expandedOrders = new Set();`;
    const newCollapseAll = `function collapseAll() {
  if (typeof window.flushGanttSave === 'function') window.flushGanttSave();
  expandedOrders = new Set();`;
    if (code.includes(oldCollapseAll) && !code.includes('if (typeof window.flushGanttSave === \'function\') window.flushGanttSave();\n  expandedOrders = new Set();')) {
        code = code.replace(oldCollapseAll, newCollapseAll);
    }

    // e) filter-btn click listener
    const oldFilterBtn = `ganttFilter = btn.dataset.filter;
      renderGantt();`;
    const newFilterBtn = `ganttFilter = btn.dataset.filter;
      if (typeof window.flushGanttSave === 'function') window.flushGanttSave();
      renderGantt();`;
    if (code.includes(oldFilterBtn)) {
        code = code.replace(oldFilterBtn, newFilterBtn);
    }

    // f) Replace toggleProcessStatus implementation
    const toggleFuncStart = code.indexOf('window.toggleProcessStatus = function (cellElement, orderId, itemIdx, processName)');
    if (toggleFuncStart !== -1) {
        const toggleSectionComment = code.lastIndexOf('// 工程進捗トグル', toggleFuncStart);
        const replaceStart = (toggleSectionComment !== -1) ? toggleSectionComment : toggleFuncStart;
        
        // Find next section
        const nextSection = code.indexOf('// ========================================', toggleFuncStart);
        if (nextSection !== -1) {
            const before = code.substring(0, replaceStart);
            const after = code.substring(nextSection);

            const newImplementation = `// 工程進捗トグル（完了/未完了の切り替え）
// ========================================
window._ganttSaveTimer = null;
window._ganttDefectNeedsSave = false;

window.flushGanttSave = function () {
  if (window._ganttSaveTimer) {
    clearTimeout(window._ganttSaveTimer);
    window._ganttSaveTimer = null;
    try {
      const orders = DB.get(DB.KEYS.ORDERS);
      DB.save(DB.KEYS.ORDERS, orders);
      if (window._ganttDefectNeedsSave) {
        const defects = DB.get(DB.KEYS.DEFECTS);
        DB.save(DB.KEYS.DEFECTS, defects);
        window._ganttDefectNeedsSave = false;
      }
    } catch (e) {
      console.error('Flush Gantt Save error:', e);
    }
  }
};

// ページ離脱時やタブ閉じ時に確実に保存
window.addEventListener('beforeunload', () => {
  if (typeof window.flushGanttSave === 'function') {
    window.flushGanttSave();
  }
});

window.toggleProcessStatus = function (cellElement, orderId, itemIdx, processName, ev) {
  // クリック時のイベント伝播を即座に防止
  const e = ev || window.event;
  if (e) {
    if (e.stopPropagation) e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (e.preventDefault) e.preventDefault();
  }

  try {
    // 1. メモリ上のデータを即座に同期更新（一切の遅延・タイムラグなし）
    const orders = DB.get(DB.KEYS.ORDERS);
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) {
      console.error('Order not found:', orderId);
      return;
    }

    const item = order.items && order.items[itemIdx];
    if (!item) {
      console.error('Item not found:', itemIdx);
      return;
    }

    if (!Array.isArray(item.completed)) {
      item.completed = [];
    }

    const proc = (processName || '').trim();
    const idx = item.completed.findIndex(p => p.trim() === proc);
    const willBeDone = (idx === -1);

    if (willBeDone) {
      // 未完了 -> 完了
      item.completed.push(proc);

      // 保留中の不良データがあれば resolved に更新
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
        window._ganttDefectNeedsSave = true;
      }
    } else {
      // 完了 -> 未完了
      item.completed.splice(idx, 1);
    }

    // 2. DOM要素を即座に更新 (0ms 体感レスポンス)
    if (cellElement) {
      if (willBeDone) {
        cellElement.className = 'matrix-cell status-done';
        cellElement.innerHTML = '<span style="font-size:10px; color:#15803d; font-weight:bold;">完了</span>';
      } else {
        cellElement.className = 'matrix-cell status-todo';
        cellElement.innerHTML = '<span style="font-size:10px; color:#94a3b8;">未</span>';
      }
    }

    // 3. ローカル操作中フラグ（Firebase同期やrefreshCurrentPageによるテーブル全体の無駄な再描画を抑止）
    window._isGanttLocalToggleActive = true;

    // 4. 重いLocalStorage圧縮保存 & Firebase同期をデバウンス（連打しても超軽快）
    if (window._ganttSaveTimer) {
      clearTimeout(window._ganttSaveTimer);
    }
    window._ganttSaveTimer = setTimeout(() => {
      window._ganttSaveTimer = null;
      try {
        const curOrders = DB.get(DB.KEYS.ORDERS);
        DB.save(DB.KEYS.ORDERS, curOrders);
        if (window._ganttDefectNeedsSave) {
          const curDefects = DB.get(DB.KEYS.DEFECTS);
          DB.save(DB.KEYS.DEFECTS, curDefects);
          window._ganttDefectNeedsSave = false;
        }
      } catch (err) {
        console.error('Async Gantt Save error:', err);
      } finally {
        // Firebaseのリアルタイム同期エコーが落ち着くまで少しフラグを維持
        setTimeout(() => {
          window._isGanttLocalToggleActive = false;
        }, 1000);
      }
    }, 250);

  } catch (err) {
    console.error('toggleProcessStatus error:', err);
  }
};

`;
            code = before + newImplementation + after;
        }
    }

    fs.writeFileSync(filename, code);
    console.log(`Updated ${filename}`);
}

patchAppFile('app.js');
patchAppFile('app-mobile.js');

// 3. Bump versions to v6.68.0
function bumpVersion(filename) {
    let content = fs.readFileSync(filename, 'utf8');
    content = content.replace(/v6\.67\.0/g, 'v6.68.0');
    fs.writeFileSync(filename, content);
    console.log(`Bumped version in ${filename}`);
}

bumpVersion('index.html');
bumpVersion('mobile_source.html');
bumpVersion('sw.js');

console.log('All patches applied successfully!');
