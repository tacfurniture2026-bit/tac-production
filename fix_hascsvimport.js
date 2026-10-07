const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldCode = `const csvLogs = monthLogs.filter(l => l.type === 'count' && l.amountWithTax > 0);
  const hasCsvImport = csvLogs.length > 0;`;
  
  const newCode = `// 過去の破損データ（金額null）でも一括取込として認識させるため、単なるcountログの存在で判定
  const csvLogs = monthLogs.filter(l => l.type === 'count');
  const hasCsvImport = csvLogs.length > 0;`;
  
  code = code.replace(oldCode, newCode);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('hasCsvImport logic fixed');
