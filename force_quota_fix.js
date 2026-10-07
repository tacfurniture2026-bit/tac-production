const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. Fix confirmInvTempData to clear tempScans AFTER saving products
  code = code.replace(
    /DB\.save\(DB\.KEYS\.INV_PRODUCTS, JSON\.parse\(JSON\.stringify\(products\)\)\);/g,
    "DB.save(DB.KEYS.INV_PRODUCTS, JSON.parse(JSON.stringify(products)));\n\n  // Force clear tempScans to prevent QuotaExceededError\n  const currentTempScans2 = DB.getTempScans() || [];\n  const filteredTempScans2 = currentTempScans2.filter(s => s.month !== selectedMonth);\n  DB.save(DB.KEYS.INV_SCAN_TEMP, filteredTempScans2);"
  );

  // 2. Fix setupInvExcelImport to clear tempScans before importing new ones
  code = code.replace(
    /let tempScans = DB\.get\(DB\.KEYS\.INV_SCAN_TEMP\) \|\| \[\];\s*if \(targetMonth\) \{\s*tempScans = tempScans\.filter\(s => s\.month !== currentMonth\);\s*\}/g,
    "let tempScans = DB.get(DB.KEYS.INV_SCAN_TEMP) || [];\n          tempScans = tempScans.filter(s => s.month !== currentMonth);"
  );

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Force quota fix applied');
