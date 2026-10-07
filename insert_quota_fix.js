const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. In confirmInvTempData
  code = code.replace(
    /\/\/ 4\. Compute and save monthly closing/g,
    "// Actually clear tempScans from DB to prevent QuotaExceededError\n  const __currentTempScans = DB.getTempScans() || [];\n  const __filteredTempScans = __currentTempScans.filter(s => s.month !== selectedMonth);\n  DB.save(DB.KEYS.INV_SCAN_TEMP, __filteredTempScans);\n\n  // 4. Compute and save monthly closing"
  );
  
  // 2. In setupInvExcelImport
  code = code.replace(
    /let tempScans = DB\.get\(DB\.KEYS\.INV_SCAN_TEMP\) \|\| \[\];\s*if \(targetMonth\) \{\s*tempScans = tempScans\.filter\(s => s\.month !== currentMonth\);\s*\}/g,
    "let tempScans = DB.get(DB.KEYS.INV_SCAN_TEMP) || [];\n          tempScans = tempScans.filter(s => s.month !== currentMonth);"
  );

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Inserted quota fix');
