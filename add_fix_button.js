const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Insert button in dashboard
  const btnHTML = `
  <div style="margin: 20px 0; padding: 15px; background: #fee2e2; border: 2px solid red; border-radius: 8px; text-align: center;">
    <h3 style="color: red; margin-bottom: 10px;">【重要】3月の異常数値(1億円)の修正はこちら</h3>
    <button onclick="manualHealMonthlyData()" style="background: red; color: white; padding: 10px 20px; font-size: 16px; border-radius: 5px; font-weight: bold;">異常数値を強制修正する</button>
  </div>
  `;
  
  if (code.includes('id="dashboard"')) {
    code = code.replace(/<div class="grid grid-cols-2/i, btnHTML + '<div class="grid grid-cols-2');
  } else if (code.includes('dash-stat-grid')) {
    code = code.replace(/<div class="dash-stat-grid"/i, btnHTML + '<div class="dash-stat-grid"');
  }

  // Insert manual function
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
    DB.save(DB.KEYS.INV_PRODUCTS, products);
    msgs.push("商品マスタ整理: " + beforeCount + " -> " + products.length);

    monthly.forEach(m => {
      if (m.month === '2026-03' || m.total > 90000000) {
        msgs.push("対象発見: " + m.month + " (現在値: " + m.total + ")");
        const result = calculateInvMonthly(m.month);
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
      alert("【修正成功】\\n" + msgs.join("\\n") + "\\n\\n画面を再読み込みしてください。");
      location.reload();
    } else {
      alert("修正対象のデータが見つかりませんでした。\\n(既に修正済みか、異常値ではありません)");
    }
  } catch(e) {
    alert("エラーが発生しました: " + e.message);
  }
};
  `;
  
  if (!code.includes('manualHealMonthlyData')) {
    code = code.replace('// Setup navigation', manualFunc + '\n// Setup navigation');
  }
  
  fs.writeFileSync(filename, code);
}

patchFile('index.html');
patchFile('mobile_source.html');
patchFile('app.js');
patchFile('app-mobile.js');

console.log('Manual fix button added');
