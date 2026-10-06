const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Replace undefined with null in csvAmountWithTax
  code = code.replace(/csvAmountWithTax: \(hasCountLog && hasCsvImport\) \? csvAmountWithTax : \(csvAmountWithTax > 0 \? csvAmountWithTax : undefined\)/g, "csvAmountWithTax: (hasCountLog && hasCsvImport) ? csvAmountWithTax : (csvAmountWithTax > 0 ? csvAmountWithTax : null)");
  
  // Replace any other potential undefined properties that I might have added in items push
  // Wait, I also did:
  // rawAmount: amountRaw,
  // rawPrevAmount: prevAmountRaw,
  // Are these ever undefined? 
  // let prevAmountRaw = 0; -> number
  // let amountRaw = 0; -> number
  // So they are numbers, never undefined.
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Patched Firebase undefined error');
