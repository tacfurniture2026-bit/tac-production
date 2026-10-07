const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldLine = 'const isCorrupted = isNaN(Number(savedData.total)) || savedData.items.some(i => isNaN(Number(i.amount)) || isNaN(Number(i.price)));';
  const newLine = 'const isCorrupted = isNaN(Number(savedData.total)) || savedData.total === 100223895 || savedData.total === 100223877 || savedData.items.some(i => isNaN(Number(i.amount)) || isNaN(Number(i.price)));';
  
  code = code.replace(oldLine, newLine);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('isCorrupted patched');
