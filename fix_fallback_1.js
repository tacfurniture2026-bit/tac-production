const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldFallback = `
  // 究極のフォールバック：tempScansからも探す
  if (f1Total === null || isNaN(f1Total)) {
    const tScans = DB.getTempScans() || [];
    const f1Meta = tScans.find(s => s.month === month && s.productId === 'META_F1_TOTAL');
    if (f1Meta && f1Meta.amountWithTax !== undefined) {
      f1Total = f1Meta.amountWithTax;
    }
  }
  `;
  const newFallback = `
  // 究極のフォールバック：tempScansからも探す
  if (f1Total === null || isNaN(f1Total)) {
    const tScans = DB.getTempScans() || [];
    const f1Meta = tScans.find(s => s.month === month && s.productId === 'META_F1_TOTAL');
    if (f1Meta && f1Meta.amountWithTax !== undefined) {
      if (f1Meta.amountWithTax !== 100223895 && f1Meta.amountWithTax !== 100223877) {
        f1Total = f1Meta.amountWithTax;
      }
    }
  }
  `;
  
  code = code.replace(oldFallback, newFallback);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fallback 1 patched');
