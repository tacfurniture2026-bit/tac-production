const fs = require('fs');

function cleanFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Cut everything after "window.manualHealMonthlyData"
  const idx = code.indexOf('window.manualHealMonthlyData = function() {');
  if (idx !== -1) {
    code = code.substring(0, idx);
  }
  
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

    const m = monthly.find(x => x.month === '2026-03');
    if (m) {
        // Cache destroy!
        let tempMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
        tempMonthly = tempMonthly.filter(x => x.month !== '2026-03');
        DB.save(DB.KEYS.INV_MONTHLY, tempMonthly);

        const tScans = DB.getTempScans() || [];
        const meta = tScans.find(s => s.month === '2026-03' && s.productId === 'META_F1_TOTAL');
        let realF1 = meta ? meta.amountWithTax : null;
        if (realF1 === 100223895 || realF1 === 100223877) realF1 = null;
        
        // NOW recalculate completely fresh without cache!
        const finalResult = calculateInvMonthly('2026-03', realF1);
        
        // Save back
        let finalMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
        const existingIdx = finalMonthly.findIndex(x => x.month === '2026-03');
        const newData = {
          month: '2026-03',
          items: finalResult.items,
          summary: finalResult.summary,
          total: finalResult.total,
          f1Total: finalResult.f1Total,
          prevTotal: finalResult.prevTotal,
          lastUpdated: new Date().toISOString()
        };
        if (existingIdx >= 0) finalMonthly[existingIdx] = newData;
        else finalMonthly.push(newData);
        DB.save(DB.KEYS.INV_MONTHLY, finalMonthly);
        
        alert("【究極の修正完了】\\nキャッシュの破壊に成功しました！\\n新しい正しい合計金額は: " + finalResult.total + " です。\\n画面を再読み込みします。");
        location.reload();
    } else {
        alert("異常なデータは見つかりませんでした。（既に正常です）");
    }
  } catch(e) {
    alert("エラーが発生しました: " + e.message);
  }
};
`;

  code += manualFunc;
  fs.writeFileSync(filename, code);
}

cleanFile('app.js');
cleanFile('app-mobile.js');
console.log('App cleaned');
