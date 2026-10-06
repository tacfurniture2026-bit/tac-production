const fs = require('fs');

let appJs = fs.readFileSync('app-mobile.js', 'utf8');

// Update calculateInvMonthly signature and apply F1 adjustment
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

fs.writeFileSync('app-mobile.js', appJs);
console.log('app-mobile.js patched');
