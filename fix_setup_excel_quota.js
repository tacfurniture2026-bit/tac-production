const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldClear = `
          if (targetMonth) {
            products.forEach(p => {
              if (p.tempMonth === currentMonth) {
                delete p.tempQty;
                delete p.tempWorker;
                delete p.tempWorkerName;
                delete p.tempTimestamp;
                delete p.tempMonth;
                delete p.tempId;
              }
            });
          }

          let tempScans = DB.get(DB.KEYS.INV_SCAN_TEMP) || [];
          if (targetMonth) {
            tempScans = tempScans.filter(s => s.month !== currentMonth);
          }
  `;
  const newClear = `
          // Always clear temp values for the current month being imported to avoid accumulation
          products.forEach(p => {
            if (p.tempMonth === currentMonth) {
              delete p.tempQty;
              delete p.tempWorker;
              delete p.tempWorkerName;
              delete p.tempTimestamp;
              delete p.tempMonth;
              delete p.tempId;
            }
          });

          let tempScans = DB.get(DB.KEYS.INV_SCAN_TEMP) || [];
          tempScans = tempScans.filter(s => s.month !== currentMonth);
  `;
  
  code = code.replace(oldClear, newClear);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Setup excel quota fixed');
