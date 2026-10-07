const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // In calculateInvMonthly
  const oldAdj1 = `
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
  `;
  const newAdj1 = `
  if (f1Total !== null && !isNaN(f1Total)) {
    // 差分は最大の分類に吸収させる（エクセル補正という名前の調整項目は作成しない）
    total = f1Total;
  }
  `;
  code = code.replace(oldAdj1, newAdj1);
  
  // In isClosed
  const oldAdj2 = `
        // 差分補正
        const diff = savedData.total - calculatedTotal;
        if (diff !== 0) {
            if (!savedData.summary['adjustment']) {
                savedData.summary['adjustment'] = { name: 'エクセル補正(F1)', amount: 0, diff: 0, prevAmount: 0 };
            }
            savedData.summary['adjustment'].amount = diff;
        }

        Object.keys(savedData.summary).forEach(k => {
          const s = savedData.summary[k];
          s.diff = (Number(s.amount) || 0) - (Number(s.prevAmount) || 0);
          if (s.amount > maxCatAmt && k !== 'adjustment') {
              maxCatAmt = s.amount;
              largestCatKey = k;
          }
        });
  `;
  const newAdj2 = `
        Object.keys(savedData.summary).forEach(k => {
          const s = savedData.summary[k];
          s.diff = (Number(s.amount) || 0) - (Number(s.prevAmount) || 0);
          if (s.amount > maxCatAmt) {
              maxCatAmt = s.amount;
              largestCatKey = k;
          }
        });
  `;
  code = code.replace(oldAdj2, newAdj2);

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Adjustment plug deleted');
