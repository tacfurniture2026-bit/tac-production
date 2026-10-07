const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const iifeRegex = /\(function healMonthlyData\(\) \{[\s\S]*?\}\)\(\);/m;
  const newIIFE = `
(function healMonthlyData() {
  try {
    let monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
    let healed = false;
    monthly.forEach(m => {
      if (m.total === 100223895 || m.total > 90000000 || m.total === 100223877) {
        console.log(\`Healing corrupted monthly data for \${m.month}: \${m.total}\`);
        
        // DESTROY CACHE FOR THIS MONTH
        let tempMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
        tempMonthly = tempMonthly.filter(x => x.month !== m.month);
        DB.save(DB.KEYS.INV_MONTHLY, tempMonthly);

        let f1 = m.f1Total;
        if (f1 === 100223895 || f1 === 100223877) f1 = null;
        if (!f1) {
           const tScans = DB.getTempScans() || [];
           const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
           if (meta) f1 = meta.amountWithTax;
           if (f1 === 100223895 || f1 === 100223877) f1 = null;
        }
        
        // NOW recalculate
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
  
  code = code.replace(iifeRegex, newIIFE);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('IIFE rewritten');
