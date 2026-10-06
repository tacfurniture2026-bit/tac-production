const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldStr = "function calculateInvMonthly(month, f1Total = null) {\n  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];\n  const logs = DB.get(DB.KEYS.INV_LOGS) || [];\n  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];";
  const newStr = "function calculateInvMonthly(month, f1TotalOverride = null) {\n  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];\n  const logs = DB.get(DB.KEYS.INV_LOGS) || [];\n  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];\n  let f1Total = f1TotalOverride;\n  if (f1Total === null) {\n    const existing = monthly.find(m => m.month === month);\n    if (existing && existing.f1Total !== undefined) {\n      f1Total = existing.f1Total;\n    }\n  }";
  
  code = code.replace(oldStr, newStr);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fixed calc definition');
