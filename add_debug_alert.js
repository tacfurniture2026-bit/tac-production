const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const searchStr = `return { month, items, summary, total, prevTotal };`;
  const debugAlert = `
  if (total === 100223895 || rawTotal === 100223895) {
    const debugInfo = "DEBUG: rawTotal=" + rawTotal + 
      ", f1Total=" + f1Total + 
      ", hasCsvImport=" + hasCsvImport + 
      ", missingItemsQtySum=" + items.filter(i=>i.amount===0).length + 
      ", F1MetaInProducts=" + items.some(i=>i.productId === 'META_F1_TOTAL');
    console.error(debugInfo);
    // setTimeout(() => alert(debugInfo), 500);
  }
  return { month, items, summary, total, f1Total, prevTotal };`;
  
  code = code.replace(searchStr, debugAlert);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Debug alert added');
