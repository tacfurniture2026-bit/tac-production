const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldIIFE = `
        let f1 = m.f1Total;
        if (!f1 || f1 === 100223895) {
           const tScans = DB.getTempScans() || [];
           const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
           if (meta) f1 = meta.amountWithTax;
        }
        const result = calculateInvMonthly(m.month, f1);
  `;
  const newIIFE = `
        let f1 = m.f1Total;
        if (f1 === 100223895 || f1 === 100223877) f1 = null;
        if (!f1) {
           const tScans = DB.getTempScans() || [];
           const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
           if (meta) f1 = meta.amountWithTax;
           if (f1 === 100223895 || f1 === 100223877) f1 = null;
        }
        const result = calculateInvMonthly(m.month, f1);
  `;
  
  code = code.replace(oldIIFE, newIIFE);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('IIFE fixed');
