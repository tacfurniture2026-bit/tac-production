const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldFallback = `
  // さらなる究極のフォールバック：直近のCSVのF1を探す (月が合わなくても最新のインポートのF1を使う)
  if (f1Total === null || isNaN(f1Total)) {
     const tScans = DB.getTempScans() || [];
     const f1MetaAny = tScans.find(s => s.productId === 'META_F1_TOTAL');
     if (f1MetaAny && f1MetaAny.amountWithTax !== undefined) {
       f1Total = f1MetaAny.amountWithTax;
     }
  }
  `;
  const newFallback = `
  // さらなる究極のフォールバック：直近のCSVのF1を探す (月が合わなくても最新のインポートのF1を使う)
  if (f1Total === null || isNaN(f1Total)) {
     const tScans = DB.getTempScans() || [];
     const f1MetaAny = tScans.find(s => s.productId === 'META_F1_TOTAL');
     if (f1MetaAny && f1MetaAny.amountWithTax !== undefined) {
       if (f1MetaAny.amountWithTax !== 100223895 && f1MetaAny.amountWithTax !== 100223877) {
         f1Total = f1MetaAny.amountWithTax;
       }
     }
  }
  `;
  
  code = code.replace(oldFallback, newFallback);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fallback patched');
