const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Replace the .find() logic in confirmInvTempData with a .filter() and sum
  const oldLogic = `const tempScan = currentTempScans.find(s => s.productId === pid);
    
    let qty = 0;
    let amountWithTax = 0;
    let worker = 'システム自動';
    if (tempScan) {
      qty = tempScan.quantity;
      worker = tempScan.workerName || tempScan.worker;
      if (tempScan.amountWithTax !== undefined) amountWithTax = tempScan.amountWithTax;
    }`;
    
  const newLogic = `const productTempScans = currentTempScans.filter(s => s.productId === pid);
    
    let qty = 0;
    let amountWithTax = 0;
    let worker = 'システム自動';
    
    if (productTempScans.length > 0) {
      worker = productTempScans[0].workerName || productTempScans[0].worker;
      productTempScans.forEach(scan => {
        qty += (Number(scan.quantity) || 0);
        if (scan.amountWithTax !== undefined) {
          amountWithTax += (Number(scan.amountWithTax) || 0);
        }
      });
    }`;
    
  code = code.replace(oldLogic, newLogic);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fixed confirmInvTempData sum logic');
