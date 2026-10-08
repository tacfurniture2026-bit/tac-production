const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Remove the FIRST toggleProcessStatus completely
  const oldFuncRegex = /function toggleProcessStatus\(el, orderId, itemIndex, process\) \{[\s\S]*?window\.toggleProcessStatus = toggleProcessStatus;\n/m;
  code = code.replace(oldFuncRegex, '');

  // Find and replace the SECOND window.toggleProcessStatus completely
  const secondFuncStart = code.indexOf('window.toggleProcessStatus = function (cellElement, orderId, itemIdx, processName) {');
  if (secondFuncStart !== -1) {
    // Find the end of this function (it ends before // ======================================== // バックアップ管理)
    const backupSection = code.indexOf('// ========================================', secondFuncStart);
    if (backupSection !== -1) {
      const before = code.substring(0, secondFuncStart);
      const after = code.substring(backupSection);
      
      const fastFunction = `window.toggleProcessStatus = function (cellElement, orderId, itemIdx, processName) {
  // クリック時のイベント伝播を防止 (不要な親要素のクリックを防ぐ)
  if (window.event) window.event.stopPropagation();

  // 1. 即時UIフィードバック（Optimistic Update）で体感速度を爆速化
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

  // 画面の描画を確実に先に終わらせてから、裏側で重いDB処理を行う
  requestAnimationFrame(() => {
    setTimeout(() => {
      // 2. データ処理
      try {
        const orders = DB.get(DB.KEYS.ORDERS);
        const order = orders.find(o => String(o.id) === String(orderId));

        if (!order) return;

        const item = order.items && order.items[itemIdx];
        if (!item) return;

        if (!Array.isArray(item.completed)) {
          item.completed = [];
        }

        const proc = processName.trim();
        const idx = item.completed.findIndex(p => p.trim() === proc);

        if (idx > -1) {
          // 完了 -> 未
          item.completed.splice(idx, 1);
        } else {
          // 未 -> 完了
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
        // サイレントエラーにしてUIの邪魔をしない
      }
    }, 10); // 10ms待機して確実にUIをレンダリングさせる
  });
};

`;
      code = before + fastFunction + after;
    }
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('toggleProcessStatus performance fixed!');
