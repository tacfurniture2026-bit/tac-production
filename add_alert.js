const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const searchStr = `  return { month, items, summary, total, f1Total, prevTotal };`;
  const alertLogic = `
  if (total === 100223895 || rawTotal === 100223895 || total > 90000000) {
    const debugMsg = "【システム診断情報】\\n" + 
      "表示合計(total): " + total + "\\n" +
      "自然計算(rawTotal): " + rawTotal + "\\n" +
      "F1補正値(f1Total): " + f1Total + "\\n" +
      "hasCsvImport: " + hasCsvImport + "\\n" +
      "F1強制検索結果: " + (tScans ? tScans.find(s=>s.productId==='META_F1_TOTAL')?.amountWithTax : 'なし');
    console.error(debugMsg);
    // setTimeout(() => alert(debugMsg), 500);
  }
  return { month, items, summary, total, f1Total, prevTotal };`;
  
  // I will UNCOMMENT the alert!
  const actualAlertLogic = alertLogic.replace('// setTimeout', 'setTimeout');
  
  code = code.replace(searchStr, actualAlertLogic);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Diagnostic alert added');
