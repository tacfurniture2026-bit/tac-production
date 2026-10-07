const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const newManualFunc = `
window.manualHealMonthlyData = function() {
  try {
    let monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
    let msgs = [];
    
    // First, let's just calculate it RAW without any F1 fallback
    const resultRaw = calculateInvMonthly('2026-03', null);
    
    // Let's also see what's in INV_LOGS
    const logs = DB.get(DB.KEYS.INV_LOGS) || [];
    const marchLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith('2026-03') && l.type === 'count');
    const hasCsvImport = marchLogs.length > 0;
    const marchLogSum = marchLogs.reduce((sum, l) => sum + (Number(l.amountWithTax) || 0), 0);
    const marchLogQty = marchLogs.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    
    const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
    
    // Calculate how many items are missing
    let missingCount = 0;
    products.forEach(p => {
       const hasLog = marchLogs.some(l => l.productId === p.id);
       if (!hasLog) missingCount++;
    });

    const m = monthly.find(x => x.month === '2026-03');
    
    msgs.push("--- 診断レポート ---");
    msgs.push("現在のDB保存値: " + (m ? m.total : 'なし'));
    msgs.push("現在のDB F1値: " + (m ? m.f1Total : 'なし'));
    msgs.push("F1無視の再計算値(rawTotal): " + resultRaw.total);
    msgs.push("3月ログ数: " + marchLogs.length);
    msgs.push("3月ログAmountSum: " + marchLogSum);
    msgs.push("商品マスタ総数: " + products.length);
    msgs.push("ログに存在しない商品数: " + missingCount);
    
    // Force fix
    if (m) {
        // Find REAL F1 if possible
        const tScans = DB.getTempScans() || [];
        const meta = tScans.find(s => s.month === '2026-03' && s.productId === 'META_F1_TOTAL');
        let realF1 = meta ? meta.amountWithTax : null;
        
        const finalResult = calculateInvMonthly('2026-03', realF1);
        m.items = finalResult.items;
        m.summary = finalResult.summary;
        m.total = finalResult.total;
        m.f1Total = finalResult.f1Total;
        m.prevTotal = finalResult.prevTotal;
        DB.save(DB.KEYS.INV_MONTHLY, monthly);
        msgs.push("---");
        msgs.push("強制適用後: " + finalResult.total);
    }

    alert(msgs.join("\\n"));
  } catch(e) {
    alert("エラー: " + e.message);
  }
};
  `;
  
  // Replace the old manual function
  code = code.replace(/window\.manualHealMonthlyData = function\(\) \{[\s\S]*?\};\s*$/m, newManualFunc);
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
