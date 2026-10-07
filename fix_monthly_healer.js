const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const healerCode = `
// 【究極の自動修復機能・第2弾】保存済みの月次データがバグで1億円になっている場合、起動時に自動で再計算して修正する
(function healMonthlyData() {
  try {
    let monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
    let healed = false;
    monthly.forEach(m => {
      // もし合計金額が100223895や9000万を超えている異常値の場合、かつ3月などの場合
      if (m.total === 100223895 || m.total > 90000000) {
        console.log(\`Healing corrupted monthly data for \${m.month}: \${m.total}\`);
        // 過去のF1を引っ張り出す
        let f1 = m.f1Total;
        if (!f1 || f1 === 100223895) {
           const tScans = DB.getTempScans() || [];
           const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
           if (meta) f1 = meta.amountWithTax;
        }
        // 完全再計算
        const result = calculateInvMonthly(m.month, f1);
        m.items = result.items;
        m.summary = result.summary;
        m.total = result.total;
        m.f1Total = result.f1Total;
        m.prevTotal = result.prevTotal;
        healed = true;
      }
    });
    if (healed) {
      console.log('Saved healed monthly data.');
      DB.save(DB.KEYS.INV_MONTHLY, monthly);
    }
  } catch(e) {
    console.error('Heal monthly failed', e);
  }
})();
`;
  
  // Insert at the bottom
  if (!code.includes('healMonthlyData')) {
    code += '\n' + healerCode;
    fs.writeFileSync(filename, code);
  }
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Monthly healer applied');
