const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. In saveInvMonthlyClosing
  code = code.replace(/const closingData = \{[\s\S]*?closedAt: new Date\(\)\.toISOString\(\)\n\s*\};\n\s*if \(existingIndex >= 0\) \{/g, (match) => {
    return match.replace(/if \(existingIndex >= 0\) \{/, 'const cleanClosingData = JSON.parse(JSON.stringify(closingData));\n\n  if (existingIndex >= 0) {');
  });
  code = code.replace(/monthly\[existingIndex\] = closingData;/g, 'monthly[existingIndex] = cleanClosingData;');
  code = code.replace(/monthly\.push\(closingData\);/g, 'monthly.push(cleanClosingData);');
  
  // 2. In confirmInvTempData
  code = code.replace(/DB\.save\(DB\.KEYS\.INV_PRODUCTS, products\);/g, 'DB.save(DB.KEYS.INV_PRODUCTS, JSON.parse(JSON.stringify(products)));');
  code = code.replace(/DB\.save\(DB\.KEYS\.INV_LOGS, logs\);/g, 'DB.save(DB.KEYS.INV_LOGS, JSON.parse(JSON.stringify(logs)));');
  
  // 3. In setupInvExcelImport
  //   DB.save(DB.KEYS.INV_SCAN_TEMP, tempScans);
  //   DB.save(DB.KEYS.INV_PRODUCTS, products);
  code = code.replace(/DB\.save\(DB\.KEYS\.INV_SCAN_TEMP, tempScans\);/g, 'DB.save(DB.KEYS.INV_SCAN_TEMP, JSON.parse(JSON.stringify(tempScans)));');
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Patched JSON.stringify cleanup for Firebase');
