const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldCacheReturn = `
        // total も保存済みアイテムの和として正確に算出
        savedData.total = savedData.items.reduce((sum, i) => { if (i.productId === 'META_F1_TOTAL' || String(i.productId).startsWith('TEMP_')) return sum; return sum + (Number(i.amount) || 0); }, 0);

        // summary の再構築
  `;
  const newCacheReturn = `
        // total も保存済みアイテムの和として正確に算出
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
  `;
  
  code = code.replace(oldCacheReturn, newCacheReturn);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Cache return F1 logic fixed');
