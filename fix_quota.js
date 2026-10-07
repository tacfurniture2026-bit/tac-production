const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldClear = `
  // 3. Clear temporary scans for this month
  products.forEach(p => {
    if (p.tempMonth === selectedMonth) {
      delete p.tempQty;
      delete p.tempWorker;
      delete p.tempWorkerName;
      delete p.tempTimestamp;
      delete p.tempMonth;
      delete p.tempId;
    }
  });
  DB.save(DB.KEYS.INV_PRODUCTS, JSON.parse(JSON.stringify(products)));
  `;
  
  const newClear = `
  // 3. Clear temporary scans for this month
  products.forEach(p => {
    if (p.tempMonth === selectedMonth) {
      delete p.tempQty;
      delete p.tempWorker;
      delete p.tempWorkerName;
      delete p.tempTimestamp;
      delete p.tempMonth;
      delete p.tempId;
    }
  });
  DB.save(DB.KEYS.INV_PRODUCTS, JSON.parse(JSON.stringify(products)));
  
  // Actually clear tempScans from DB to prevent QuotaExceededError
  const filteredTempScans = tempScans.filter(s => s.month !== selectedMonth);
  DB.save(DB.KEYS.INV_SCAN_TEMP, filteredTempScans);
  `;
  
  code = code.replace(oldClear, newClear);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Quota fix applied');
