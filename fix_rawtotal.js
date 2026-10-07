const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldCode = `const rawTotal = items.reduce((sum, i) => sum + (i.rawAmount !== undefined ? i.rawAmount : i.amount), 0);`;
  const newCode = `const rawTotal = items.reduce((sum, i) => {
    if (i.productId === 'META_F1_TOTAL' || String(i.productId).startsWith('TEMP_')) return sum;
    return sum + (i.rawAmount !== undefined ? i.rawAmount : i.amount);
  }, 0);`;
  
  code = code.replace(oldCode, newCode);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('rawTotal calculation fixed');
