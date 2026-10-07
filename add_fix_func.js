const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const manualFunc = `
window.manualHealMonthlyData = function() {
  try {
    let monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
    let healed = false;
    let msgs = [];
    
    // まずTEMP_商品を消す
    let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
    const beforeCount = products.length;
    products = products.filter(p => p.id && !String(p.id).startsWith('TEMP_') && p.id !== 'META_F1_TOTAL');
    
    // 重複も排除
    const uniqueById = new Map();
    products.forEach(p => uniqueById.set(p.id, p));
    products = Array.from(uniqueById.values());
    
    DB.save(DB.KEYS.INV_PRODUCTS, products);
    msgs.push("商品マスタ整理: " + beforeCount + " -> " + products.length);

    monthly.forEach(m => {
      if (m.month === '2026-03' || m.total > 90000000 || m.total === 100223895) {
        msgs.push("対象発見: " + m.month + " (現在値: " + m.total + ")");
        let f1 = m.f1Total;
        if (!f1 || f1 === 100223895) {
           const tScans = DB.getTempScans() || [];
           const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
           if (meta) f1 = meta.amountWithTax;
        }
        const result = calculateInvMonthly(m.month, f1);
        m.items = result.items;
        m.summary = result.summary;
        m.total = result.total;
        m.f1Total = result.f1Total;
        m.prevTotal = result.prevTotal;
        healed = true;
        msgs.push("修正後: " + m.total);
      }
    });
    
    if (healed) {
      DB.save(DB.KEYS.INV_MONTHLY, monthly);
      alert("【修正成功】\\n" + msgs.join("\\n") + "\\n\\n画面を再読み込みします。");
      location.reload();
    } else {
      alert("修正対象のデータが見つかりませんでした。\\n既に修正されているか、対象月がありません。\\n" + msgs.join("\\n"));
    }
  } catch(e) {
    alert("エラーが発生しました: " + e.message);
  }
};
  `;
  
  if (!code.includes('manualHealMonthlyData')) {
    code += '\n' + manualFunc;
    fs.writeFileSync(filename, code);
    console.log('Function added to', filename);
  }
}

patchFile('app.js');
patchFile('app-mobile.js');
