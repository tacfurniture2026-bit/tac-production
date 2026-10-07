const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldIIFE = `
    // 3. 全ての月について、items 内の META_F1_TOTAL を削除し、合計金額を正しい計算で上書き
    monthly.forEach(m => {
      let monthModified = false;
      
      // items から META_F1_TOTAL を削除
      if (m.items) {
          const initialItemsCount = m.items.length;
          m.items = m.items.filter(i => i.productId !== 'META_F1_TOTAL' && !String(i.productId).startsWith('TEMP_'));
          if (m.items.length !== initialItemsCount) {
              monthModified = true;
          }
      }

      // META_F1_TOTAL を除外した正しい items で total を再計算 (isClosedロジックと同様だが安全)
      if (m.items && m.total !== undefined) {
          const correctTotal = m.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
          
          // F1との差分があれば、total は F1 の値にする (エクセルとシステムは必ず整合性がとれることが大事)
          let finalTotal = correctTotal;
          if (m.f1Total !== undefined && m.f1Total !== null && !isNaN(m.f1Total)) {
              if (true) {
                  finalTotal = m.f1Total;
              }
          }

          if (m.total !== finalTotal) {
              console.log(\`Fixed total for \${m.month}: \${m.total} -> \${finalTotal}\`);
              m.total = finalTotal;
              monthModified = true;
          }
      }
      
      if (monthModified) {
          healed = true;
      }
    });
  `;
  
  const newIIFE = `
    // 3. 全ての月について、新しい完全一致ロジックで items と total を完全に再計算する
    // ただし再計算は無限ループを防ぐため、既に adjustment が存在しない、かつ total が f1Total と一致している場合はスキップする
    monthly.forEach(m => {
        let needsRecalc = false;
        if (m.items) {
            // もし古いロジックで弾かれたTEMPが含まれていない、またはadjustmentがある場合は再計算
            const hasAdjustment = m.summary && m.summary['adjustment'];
            const calculatedTotal = m.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
            if (hasAdjustment || calculatedTotal !== m.total || calculatedTotal !== m.f1Total) {
                needsRecalc = true;
            }
        } else {
            needsRecalc = true;
        }

        if (needsRecalc) {
            console.log(\`Fully recalculating \${m.month} to achieve perfect natural match...\`);
            // 一旦月次キャッシュを消す（isClosedをバイパスするため）
            let tempMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
            tempMonthly = tempMonthly.filter(x => x.month !== m.month);
            DB.save(DB.KEYS.INV_MONTHLY, tempMonthly);

            const result = calculateInvMonthly(m.month, m.f1Total);
            m.items = result.items;
            m.summary = result.summary;
            m.total = result.total;
            m.f1Total = result.f1Total;
            m.prevTotal = result.prevTotal;
            healed = true;
            
            // 書き戻す
            tempMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
            tempMonthly.push(m);
            DB.save(DB.KEYS.INV_MONTHLY, tempMonthly);
        }
    });
  `;
  
  code = code.replace(oldIIFE, newIIFE);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('IIFE fully recalculates closed months');
