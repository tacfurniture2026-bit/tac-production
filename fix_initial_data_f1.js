const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldCode = `        DB.save(DB.KEYS.INV_LOGS, JSON.parse(JSON.stringify(logs)));

        // INV_MONTHLY レコードの生成
        const monthlyData = {
          month: targetMonth,
          items: monthlyItems,
          summary: summary,
          total: Math.round(total),
          closedAt: new Date().toISOString()
        };`;
        
  const newCode = `        DB.save(DB.KEYS.INV_LOGS, JSON.parse(JSON.stringify(logs)));

        // ExcelのF1セル(合計金額)を抽出して強制適用する
        let f1TotalVal = null;
        if (sheet['F1']) {
          const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '');
          const num = parseFloat(val);
          if (!isNaN(num)) {
            f1TotalVal = num;
          }
        }

        // INV_MONTHLY レコードの生成
        const monthlyData = {
          month: targetMonth,
          items: monthlyItems,
          summary: summary,
          total: f1TotalVal !== null ? f1TotalVal : Math.round(total),
          f1Total: f1TotalVal,
          closedAt: new Date().toISOString()
        };`;
        
  code = code.replace(oldCode, newCode);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Initial data import F1 override applied');
