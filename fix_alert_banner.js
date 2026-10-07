const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const alertLogicOld = `
  if (total === 100223895 || rawTotal === 100223895 || total > 90000000) {
    const debugMsg = "【システム診断情報】\\n" + 
      "表示合計(total): " + total + "\\n" +
      "自然計算(rawTotal): " + rawTotal + "\\n" +
      "F1補正値(f1Total): " + f1Total + "\\n" +
      "hasCsvImport: " + hasCsvImport + "\\n" +
      "F1強制検索結果: " + (tScans ? tScans.find(s=>s.productId==='META_F1_TOTAL')?.amountWithTax : 'なし');
    console.error(debugMsg);
    setTimeout(() => alert(debugMsg), 500);
  }
  return { month, items, summary, total, f1Total, prevTotal };`;
  
  const alertLogicNew = `
  if (total === 100223895 || rawTotal === 100223895 || total > 90000000) {
    const debugMsg = "【システム診断情報】<br>" + 
      "表示合計(total): " + total + "<br>" +
      "自然計算(rawTotal): " + rawTotal + "<br>" +
      "F1補正値(f1Total): " + f1Total + "<br>" +
      "hasCsvImport: " + hasCsvImport + "<br>" +
      "F1強制検索結果: " + (tScans ? tScans.find(s=>s.productId==='META_F1_TOTAL')?.amountWithTax : 'なし');
    
    setTimeout(() => {
      let banner = document.getElementById('debug-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'debug-banner';
        banner.style.position = 'fixed';
        banner.style.top = '0';
        banner.style.left = '0';
        banner.style.width = '100%';
        banner.style.backgroundColor = 'red';
        banner.style.color = 'white';
        banner.style.padding = '20px';
        banner.style.zIndex = '999999';
        banner.style.fontSize = '18px';
        banner.style.fontWeight = 'bold';
        document.body.appendChild(banner);
      }
      banner.innerHTML = debugMsg + "<br><br>【この画面をスクリーンショットして開発者に送ってください】";
    }, 100);
  }
  return { month, items, summary, total, f1Total, prevTotal };`;
  
  code = code.replace(alertLogicOld, alertLogicNew);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('DOM Banner Alert added');
