const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const manualFunc = `
window.manualHealMonthlyData = function() {
  try {
    let monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
    
    // まずTEMP_商品を消す
    let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
    products = products.filter(p => p.id && !String(p.id).startsWith('TEMP_') && p.id !== 'META_F1_TOTAL');
    const uniqueById = new Map();
    products.forEach(p => uniqueById.set(p.id, p));
    products = Array.from(uniqueById.values());
    DB.save(DB.KEYS.INV_PRODUCTS, products);

    // ALL broken months
    const brokenMonths = monthly.filter(x => x.total > 90000000 || x.total === 100223895 || x.total === 100223877);
    
    if (brokenMonths.length > 0) {
        // Cache completely destroy!
        let tempMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
        brokenMonths.forEach(m => {
            tempMonthly = tempMonthly.filter(x => x.month !== m.month);
        });
        DB.save(DB.KEYS.INV_MONTHLY, tempMonthly);

        let report = "【究極の修正完了】\\n以下の月の異常キャッシュを破壊し、完全再計算しました。\\n";
        
        let finalMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];

        brokenMonths.forEach(m => {
            const tScans = DB.getTempScans() || [];
            const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
            let realF1 = meta ? meta.amountWithTax : null;
            if (realF1 === 100223895 || realF1 === 100223877) realF1 = null;
            
            // NOW recalculate completely fresh without cache!
            const finalResult = calculateInvMonthly(m.month, realF1);
            
            // Add back
            const newData = {
              month: m.month,
              items: finalResult.items,
              summary: finalResult.summary,
              total: finalResult.total,
              f1Total: finalResult.f1Total,
              prevTotal: finalResult.prevTotal,
              lastUpdated: new Date().toISOString()
            };
            const existingIdx = finalMonthly.findIndex(x => x.month === m.month);
            if (existingIdx >= 0) finalMonthly[existingIdx] = newData;
            else finalMonthly.push(newData);
            
            report += m.month + " の新しい合計: " + finalResult.total + "\\n";
        });
        
        DB.save(DB.KEYS.INV_MONTHLY, finalMonthly);
        
        alert(report + "\\n画面を再読み込みします。");
        location.reload();
    } else {
        alert("異常なデータは見つかりませんでした。（既に正常です）");
    }
  } catch(e) {
    alert("エラーが発生しました: " + e.message);
  }
};
`;

  // Cut everything after "window.manualHealMonthlyData"
  const idx = code.indexOf('window.manualHealMonthlyData = function() {');
  if (idx !== -1) {
    code = code.substring(0, idx);
  }
  
  code += manualFunc;
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Nuke cache ready');
