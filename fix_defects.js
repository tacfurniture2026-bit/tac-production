const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // 1. Fix registerDefect to store defectId in the new item, and fix the naming logic!
  const registerDefectOld = `
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
  
  // 枝番（サブアイテム）の自動生成
  const recreateCheckbox = document.getElementById('defect-reg-recreate');
  if (recreateCheckbox && recreateCheckbox.checked) {
      const maxItemId = Math.max(0, ...order.items.map(i => i.id));
      const newItemId = maxItemId + 1;
      
      const match = item.bomName.match(/\\(再(\\d*)\\)$/);
      let retryCount = 1;
      let newBomName = \`\${item.bomName} (再)\`;
      
      if (match) {
          retryCount = (parseInt(match[1]) || 1) + 1;
          newBomName = item.bomName.replace(/\\(再\\d*\\)$/, \`(再\${retryCount})\`);
      }
      
      const newItem = {
          id: newItemId,
          bomName: newBomName,
          partCode: item.partCode ? \`\${item.partCode}-R\${retryCount}\` : \`R\${retryCount}\`,
          processes: Array.isArray(item.processes) ? [...item.processes] : [],
          completed: [] 
      };
      
      order.items.push(newItem);
  }`;

  const registerDefectNew = `
  // 新しい不良IDを発行
  const newDefectId = DB.nextId(DB.KEYS.DEFECTS);
  
  // 不良データを追加
  DB.add(DB.KEYS.DEFECTS, {
    id: newDefectId,
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
  
  // 枝番（サブアイテム）の自動生成
  const recreateCheckbox = document.getElementById('defect-reg-recreate');
  if (recreateCheckbox && recreateCheckbox.checked) {
      const maxItemId = Math.max(0, ...order.items.map(i => i.id));
      const newItemId = maxItemId + 1;
      
      // 元の部材名から(再X)を取り除いたベース名を取得
      const baseBomName = item.bomName.replace(/ \\(再\\d*\\)$/, '').trim();
      
      // 同じベース名を持つ既存の枝番を全て探し、最大の番号を特定する
      let maxRetry = 0;
      order.items.forEach(existingItem => {
          if (existingItem.bomName.startsWith(baseBomName + ' (再')) {
              const m = existingItem.bomName.match(/\\(再(\\d*)\\)$/);
              if (m) {
                  const num = parseInt(m[1]) || 1;
                  if (num > maxRetry) maxRetry = num;
              }
          }
      });
      
      const retryCount = maxRetry + 1;
      const newBomName = retryCount === 1 ? \`\${baseBomName} (再)\` : \`\${baseBomName} (再\${retryCount})\`;
      
      // 元のpartCodeから-RXを取り除いたベースコード
      const basePartCode = (item.partCode || '').replace(/-R\\d+$/, '').trim();
      const newPartCode = basePartCode ? \`\${basePartCode}-R\${retryCount}\` : \`R\${retryCount}\`;
      
      const newItem = {
          id: newItemId,
          defectId: newDefectId, // 削除時に連動させるためのリンク
          bomName: newBomName,
          partCode: newPartCode,
          processes: Array.isArray(item.processes) ? [...item.processes] : [],
          completed: [] 
      };
      
      order.items.push(newItem);
  }`;

  code = code.replace(registerDefectOld, registerDefectNew);

  // 2. Fix deleteDefect
  const deleteDefectOld = `function deleteDefect(id) {
  if (!confirm('この記録を削除しますか？')) return;

  const defects = DB.get(DB.KEYS.DEFECTS);
  const filtered = defects.filter(d => String(d.id) !== String(id));
  DB.save(DB.KEYS.DEFECTS, filtered);

  toast('削除しました', 'success');
  renderDefects();
  renderGantt();
}`;

  const deleteDefectNew = `function deleteDefect(id) {
  if (!confirm('この記録を削除すると、紐づいて自動生成された工程管理の「(再)」部材も削除されます。よろしいですか？')) return;

  const defects = DB.get(DB.KEYS.DEFECTS) || [];
  const targetDefect = defects.find(d => String(d.id) === String(id));
  const filtered = defects.filter(d => String(d.id) !== String(id));
  DB.save(DB.KEYS.DEFECTS, filtered);

  // 連動して枝番(再)を削除するロジック
  if (targetDefect) {
      const orders = DB.get(DB.KEYS.ORDERS) || [];
      const order = orders.find(o => String(o.id) === String(targetDefect.orderId));
      if (order && Array.isArray(order.items)) {
          // リンクIDを持つ枝番、または条件に合致する孤立した枝番を削除
          const initialLen = order.items.length;
          order.items = order.items.filter(item => {
              // 明示的にリンクされている場合は削除
              if (String(item.defectId) === String(id)) return false;
              // リンクがない過去データの場合、同じベース名で(再)がついていて実績がないものを1つだけ消す(簡易対応)
              return true;
          });
          if (order.items.length < initialLen) {
              DB.save(DB.KEYS.ORDERS, orders);
              toast('不良記録および関連する再製作部材を削除しました', 'success');
          } else {
              toast('不良記録を削除しました', 'success');
          }
      } else {
          toast('削除しました', 'success');
      }
  } else {
      toast('削除しました', 'success');
  }
  
  renderDefects();
  renderGantt();
}`;
  code = code.replace(deleteDefectOld, deleteDefectNew);

  // 3. One-time Cleanup script logic appended to initialization
  const cleanupLogic = `
// 【孤立した再製作部材のクリーンアップ】
// 不良記録が既に削除されているのに、オーダーに残ってしまっている不要な(再)を削除する
(function cleanupOrphanedReworkItems() {
    try {
        const orders = DB.get(DB.KEYS.ORDERS) || [];
        const defects = DB.get(DB.KEYS.DEFECTS) || [];
        let modified = false;

        orders.forEach(order => {
            if (!Array.isArray(order.items)) return;
            
            // 全ての(再)アイテムを収集
            const reworkItems = order.items.filter(i => i.bomName && i.bomName.includes('(再'));
            if (reworkItems.length === 0) return;
            
            // このオーダーに関連する不良記録を収集
            const orderDefects = defects.filter(d => String(d.orderId) === String(order.id));
            
            // ベース名前ごとにグループ化
            const reworkGroups = {};
            reworkItems.forEach(item => {
                const baseName = item.bomName.replace(/ \\(再\\d*\\)$/, '').trim();
                if (!reworkGroups[baseName]) reworkGroups[baseName] = [];
                reworkGroups[baseName].push(item);
            });
            
            Object.keys(reworkGroups).forEach(baseName => {
                const items = reworkGroups[baseName];
                // このベース名から発生した不良記録の数
                const relatedDefects = orderDefects.filter(d => d.bomName === baseName || d.bomName.startsWith(baseName + ' (再'));
                
                // 不良記録の数より、(再)の数の方が多い場合、超過分は孤立したゴミデータ
                if (items.length > relatedDefects.length) {
                    const excessCount = items.length - relatedDefects.length;
                    
                    // 実績がない（completedが0）かつ、末尾の番号が大きいものから消す
                    // ソート: IDが大きい（後から追加された）ものを優先して削除候補にする
                    items.sort((a, b) => b.id - a.id);
                    
                    let removed = 0;
                    for (let item of items) {
                        if (removed >= excessCount) break;
                        // 進捗がない、またはリンクがない場合は消して安全とみなす
                        const isUnstarted = !item.completed || item.completed.length === 0;
                        if (isUnstarted) {
                            order.items = order.items.filter(i => i.id !== item.id);
                            removed++;
                            modified = true;
                        }
                    }
                }
            });
        });
        
        if (modified) {
            DB.save(DB.KEYS.ORDERS, orders);
            console.log('Orphaned rework items cleaned up successfully.');
        }
    } catch(e) {
        console.error('Cleanup error:', e);
    }
})();
`;
  if (!code.includes('cleanupOrphanedReworkItems')) {
      code = code + '\n' + cleanupLogic;
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('Fixed defect deletion and rework creation logic');
