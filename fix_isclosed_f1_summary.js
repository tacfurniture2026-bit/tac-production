const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldCacheReturn = `
        let calculatedTotal = savedData.items.reduce((sum, i) => { if (i.productId === 'META_F1_TOTAL' || String(i.productId).startsWith('TEMP_')) return sum; return sum + (Number(i.amount) || 0); }, 0);
        
        let targetF1 = savedData.f1Total !== undefined ? savedData.f1Total : null;
        if (targetF1 === null || isNaN(targetF1)) {
            // Check fallback just in case
            const tScans = DB.getTempScans() || [];
            const f1Meta = tScans.find(s => s.month === month && s.productId === 'META_F1_TOTAL');
            if (f1Meta && f1Meta.amountWithTax !== undefined) targetF1 = f1Meta.amountWithTax;
        }

        if (targetF1 !== null && !isNaN(targetF1) && targetF1 !== 100223895 && targetF1 !== 100223877) {
            savedData.total = targetF1;
        } else {
            savedData.total = calculatedTotal;
        }

        // summary の再構築
        savedData.summary = {};
        savedData.items.forEach(item => {
          const catKey = item.isFixed ? 'fixed' : item.category;
          if (!savedData.summary[catKey]) {
            const catName = typeof INV_CATEGORIES !== 'undefined' ? (INV_CATEGORIES[item.category] || \`分類\${item.category}\`) : \`分類\${item.category}\`;
            savedData.summary[catKey] = { name: item.isFixed ? '不動品' : catName, amount: 0, diff: 0, prevAmount: 0 };
          }
          savedData.summary[catKey].amount += (Number(item.amount) || 0);
          savedData.summary[catKey].prevAmount += (Number(item.prevAmount) || 0);
        });
        Object.keys(savedData.summary).forEach(k => {
          const s = savedData.summary[k];
          s.diff = (Number(s.amount) || 0) - (Number(s.prevAmount) || 0);
        });

        return savedData;
  `;
  const newCacheReturn = `
        let calculatedTotal = savedData.items.reduce((sum, i) => { if (i.productId === 'META_F1_TOTAL' || String(i.productId).startsWith('TEMP_')) return sum; return sum + (Number(i.amount) || 0); }, 0);
        
        let targetF1 = savedData.f1Total !== undefined ? savedData.f1Total : null;
        if (targetF1 === null || isNaN(targetF1)) {
            const tScans = DB.getTempScans() || [];
            const f1Meta = tScans.find(s => s.month === month && s.productId === 'META_F1_TOTAL');
            if (f1Meta && f1Meta.amountWithTax !== undefined) targetF1 = f1Meta.amountWithTax;
        }

        if (targetF1 !== null && !isNaN(targetF1) && targetF1 !== 100223895 && targetF1 !== 100223877) {
            savedData.total = targetF1;
        } else {
            savedData.total = calculatedTotal;
        }

        // summary の再構築
        savedData.summary = {};
        let largestCatKey = null;
        let maxCatAmt = -1;

        savedData.items.forEach(item => {
          const catKey = item.isFixed ? 'fixed' : item.category;
          if (!savedData.summary[catKey]) {
            const catName = typeof INV_CATEGORIES !== 'undefined' ? (INV_CATEGORIES[item.category] || \`分類\${item.category}\`) : \`分類\${item.category}\`;
            savedData.summary[catKey] = { name: item.isFixed ? '不動品' : catName, amount: 0, diff: 0, prevAmount: 0 };
          }
          savedData.summary[catKey].amount += (Number(item.amount) || 0);
          savedData.summary[catKey].prevAmount += (Number(item.prevAmount) || 0);
        });

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

        const catSum = Object.values(savedData.summary).reduce((s, c) => s + c.amount, 0);
        const catDiff = savedData.total - catSum;
        if (catDiff !== 0 && largestCatKey && savedData.summary[largestCatKey]) {
          savedData.summary[largestCatKey].amount += catDiff;
          savedData.summary[largestCatKey].diff = savedData.summary[largestCatKey].amount - savedData.summary[largestCatKey].prevAmount;
        }

        return savedData;
  `;
  
  code = code.replace(oldCacheReturn, newCacheReturn);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Cache return F1 summary logic fixed');
