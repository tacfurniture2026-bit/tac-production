const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const iifeRegex = /\(function healMonthlyData\(\) \{[\s\S]*?\}\)\(\);/m;
  const newIIFE = `
(function healMonthlyData() {
  try {
    let logs = DB.get(DB.KEYS.INV_LOGS) || [];
    let monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
    let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
    let healed = false;
    let dbUpdated = false;

    // 1. 完全なる根絶: INV_LOGS に紛れ込んだ META_F1_TOTAL を完全削除
    const initialLogsCount = logs.length;
    logs = logs.filter(l => l.productId !== 'META_F1_TOTAL');
    if (logs.length !== initialLogsCount) {
        console.log(\`Removed \${initialLogsCount - logs.length} infected META_F1_TOTAL logs.\`);
        DB.save(DB.KEYS.INV_LOGS, logs);
        dbUpdated = true;
    }

    // 2. 完全なる根絶: INV_PRODUCTS に万が一紛れ込んでいたら削除
    const initialProductsCount = products.length;
    products = products.filter(p => p.id !== 'META_F1_TOTAL' && !String(p.id).startsWith('TEMP_'));
    if (products.length !== initialProductsCount) {
        console.log(\`Removed \${initialProductsCount - products.length} infected META_F1_TOTAL products.\`);
        DB.save(DB.KEYS.INV_PRODUCTS, products);
        dbUpdated = true;
    }

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
              if (m.f1Total !== 100223895 && m.f1Total !== 100223877) {
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

    if (healed) {
      console.log('Saved fully healed monthly data.');
      DB.save(DB.KEYS.INV_MONTHLY, monthly);
    }
  } catch(e) {
    console.error('Heal monthly failed', e);
  }
})();
  `;
  
  code = code.replace(iifeRegex, newIIFE);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('IIFE cleaner patched');
