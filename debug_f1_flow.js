const fs = require('fs');

function checkFile(filename) {
  const code = fs.readFileSync(filename, 'utf8');
  
  const setupRegex = /f1AmountRaw = num;/;
  const setupPushRegex = /amountWithTax: f1AmountRaw/;
  const viewRegex = /const f1Meta = currentTempScans.find\(s => s.productId === 'META_F1_TOTAL'\);/;
  const confirmRegex = /const f1MetaConfirm = currentTempScans.find\(s => s.productId === 'META_F1_TOTAL'\);/;
  const calcRegex = /f1Total = existing\.f1Total;/;
  const calcAssignRegex = /total = f1Total;/;
  
  console.log('Setup f1 parse:', setupRegex.test(code));
  console.log('Setup f1 push:', setupPushRegex.test(code));
  console.log('View f1 fetch:', viewRegex.test(code));
  console.log('Confirm f1 fetch:', confirmRegex.test(code));
  console.log('Calc auto-heal f1:', calcRegex.test(code));
  console.log('Calc assign f1:', calcAssignRegex.test(code));
}

checkFile('app.js');
