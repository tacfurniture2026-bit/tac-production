const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// 1. In setupInvExcelImport, extract F1
const extractF1Logic = `
          let f1AmountRaw = null;
          if (rows[0] && rows[0].length >= 6) {
             const val = String(rows[0][5] || '').replace(/[,¥\\s\\\\]/g, '');
             const num = parseFloat(val);
             if (!isNaN(num)) {
               f1AmountRaw = num;
             }
          }
          
          let skippedSummaryCount = 0;`;

appJs = appJs.replace('let skippedSummaryCount = 0;', extractF1Logic);

// 2. Save F1 to tempScans
const saveF1Logic = `
          if (f1AmountRaw !== null) {
            tempScans.push({
                id: 'META_F1_TOTAL',
                productId: 'META_F1_TOTAL',
                quantity: 1,
                amountWithTax: f1AmountRaw,
                worker: 'system',
                workerName: 'system',
                timestamp: timestamp,
                month: currentMonth,
                type: 'meta_f1'
            });
          }
          
          DB.save(DB.KEYS.INV_SCAN_TEMP, tempScans);`;

appJs = appJs.replace('DB.save(DB.KEYS.INV_SCAN_TEMP, tempScans);', saveF1Logic);

// 3. In confirmInvTempData, read F1 and pass to calculateInvMonthly
const readF1Logic = `
  const currentTempScans = tempScans.filter(s => s.month === selectedMonth);
  
  const f1Meta = currentTempScans.find(s => s.productId === 'META_F1_TOTAL');
  const f1Total = f1Meta ? f1Meta.amountWithTax : null;
`;
appJs = appJs.replace('const currentTempScans = tempScans.filter(s => s.month === selectedMonth);', readF1Logic);

const passF1Logic = `const monthlyResult = calculateInvMonthly(selectedMonth, f1Total);`;
appJs = appJs.replace('const monthlyResult = calculateInvMonthly(selectedMonth);', passF1Logic);

// 4. Update calculateInvMonthly signature and apply F1 adjustment
appJs = appJs.replace('function calculateInvMonthly(month) {', 'function calculateInvMonthly(month, f1Total = null) {');

const applyF1Logic = `
  // 端数誤差を吸収し、ExcelセルF1 / U列合計と1円単位で完全一致させるため総和を最後に四捨五入
  const rawTotal = items.reduce((sum, i) => sum + (i.rawAmount !== undefined ? i.rawAmount : i.amount), 0);
  let total = Math.round(rawTotal);
  
  if (f1Total !== null && !isNaN(f1Total)) {
    const diff = f1Total - total;
    if (diff !== 0) {
      if (!summary['adjustment']) {
        summary['adjustment'] = { name: 'エクセル補正(F1)', rawAmount: 0, rawPrevAmount: 0, amount: 0, diff: 0, prevAmount: 0 };
      }
      summary['adjustment'].rawAmount = diff;
      summary['adjustment'].amount = diff;
      total = f1Total;
    }
  }

  const rawPrevTotal = items.reduce((sum, i) => sum + (i.rawPrevAmount !== undefined ? i.rawPrevAmount : i.prevAmount), 0);
`;
appJs = appJs.replace('const rawTotal = items.reduce((sum, i) => sum + (i.rawAmount !== undefined ? i.rawAmount : i.amount), 0);\n  const total = Math.round(rawTotal);\n  const rawPrevTotal = items.reduce((sum, i) => sum + (i.rawPrevAmount !== undefined ? i.rawPrevAmount : i.prevAmount), 0);', applyF1Logic);


// 5. When calculating previous closed months, keep f1Total null unless we have it stored?
// Wait, if it's already closed, we just use savedData.total.
// We only calculate if it's NOT closed. So that's fine.

// Update version string to 6.14.0 for cache busting
appJs = appJs.replace(/v6\.13\.0/g, 'v6.14.0');

fs.writeFileSync('app.js', appJs);
console.log('app.js patched');
