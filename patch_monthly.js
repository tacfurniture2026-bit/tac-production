const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  code = code.replace(/const invMonthly = DB\.get\(DB\.KEYS\.INV_MONTHLY\);/g, 'const invMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];');
  code = code.replace(/const monthly = DB\.get\(DB\.KEYS\.INV_MONTHLY\);/g, 'const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];');
  
  // Also fix optional chaining just in case
  code = code.replace(/result\.summary\['fixed'\]\?\.amount/g, "(result.summary['fixed'] ? result.summary['fixed'].amount : 0)");
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Patched DB.get for INV_MONTHLY');
