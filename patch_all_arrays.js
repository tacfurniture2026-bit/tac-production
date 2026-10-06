const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Replace array gets that are missing || []
  code = code.replace(/const products = DB\.get\(DB\.KEYS\.INV_PRODUCTS\);/g, 'const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];');
  code = code.replace(/const logs = DB\.get\(DB\.KEYS\.INV_LOGS\);/g, 'const logs = DB.get(DB.KEYS.INV_LOGS) || [];');
  code = code.replace(/const monthly = DB\.get\(DB\.KEYS\.INV_MONTHLY\);/g, 'const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];');
  code = code.replace(/const tempScans = DB\.getTempScans\(\);/g, 'const tempScans = DB.getTempScans() || [];');

  // Also replace any let declarations
  code = code.replace(/let products = DB\.get\(DB\.KEYS\.INV_PRODUCTS\);/g, 'let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];');
  code = code.replace(/let logs = DB\.get\(DB\.KEYS\.INV_LOGS\);/g, 'let logs = DB.get(DB.KEYS.INV_LOGS) || [];');
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Patched all arrays to default to []');
