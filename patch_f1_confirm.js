const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Need to insert f1Total definition before it is used in confirmInvTempData
  // We can insert it right before the try block
  
  const insertText = `
  const f1MetaConfirm = currentTempScans.find(s => s.productId === 'META_F1_TOTAL');
  const f1Total = f1MetaConfirm ? f1MetaConfirm.amountWithTax : null;
  `;
  
  code = code.replace(/try {\n\s*const monthlyResult = calculateInvMonthly\(selectedMonth, f1Total\);/, insertText + 'try {\n    const monthlyResult = calculateInvMonthly(selectedMonth, f1Total);');
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Patched confirmInvTempData f1Total');
