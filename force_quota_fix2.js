const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. In confirmInvTempData:
  const targetConfirm = `
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
  const replaceConfirm = `
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
  const __currentTempScans = DB.getTempScans() || [];
  const __filteredTempScans = __currentTempScans.filter(s => s.month !== selectedMonth);
  DB.save(DB.KEYS.INV_SCAN_TEMP, __filteredTempScans);
  `;
  code = code.replace(targetConfirm, replaceConfirm);

  // 2. In setupInvExcelImport:
  const targetImport = `
          let tempScans = DB.get(DB.KEYS.INV_SCAN_TEMP) || [];
          if (targetMonth) {
            tempScans = tempScans.filter(s => s.month !== currentMonth);
          }
  `;
  const replaceImport = `
          let tempScans = DB.get(DB.KEYS.INV_SCAN_TEMP) || [];
          tempScans = tempScans.filter(s => s.month !== currentMonth);
  `;
  code = code.replace(targetImport, replaceImport);

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Force quota fix 2 applied');
