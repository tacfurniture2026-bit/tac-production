const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const manualFunc = `
window.manualHealMonthlyData = function() {
  try {
    let monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
    let logs = DB.get(DB.KEYS.INV_LOGS) || [];
    let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
    let tScans = DB.getTempScans() || [];

    const m = monthly.find(x => x.month === '2026-03');
    
    // Calculate completely raw
    const resultRaw = calculateInvMonthly('2026-03', null);
    
    const debugObj = {
      rawTotal: resultRaw.total,
      f1Total: resultRaw.f1Total,
      hasCsvImport: logs.filter(l => l.timestamp && l.timestamp.startsWith('2026-03') && l.type === 'count').length > 0,
      tScansF1: tScans.filter(s => s.productId === 'META_F1_TOTAL'),
      itemsCount: resultRaw.items.length,
      itemsSum: resultRaw.items.reduce((sum, i) => sum + i.amount, 0),
      top5Items: resultRaw.items.sort((a,b) => b.amount - a.amount).slice(0, 5),
      monthlyF1: m ? m.f1Total : 'm_is_null',
      monthlyTotal: m ? m.total : 'm_is_null',
    };
    
    const dumpStr = JSON.stringify(debugObj, null, 2);
    
    // Show in a textarea so they can screenshot or copy it
    let banner = document.getElementById('debug-banner-dump');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'debug-banner-dump';
      banner.style.position = 'fixed';
      banner.style.top = '10%';
      banner.style.left = '5%';
      banner.style.width = '90%';
      banner.style.height = '80%';
      banner.style.backgroundColor = 'white';
      banner.style.border = '5px solid red';
      banner.style.zIndex = '9999999';
      banner.style.padding = '20px';
      banner.style.overflow = 'auto';
      document.body.appendChild(banner);
    }
    banner.innerHTML = "<h3>【開発者用データダンプ】この画面全体をスクリーンショットしてください！</h3><pre style='background:#eee;padding:10px;font-size:12px;white-space:pre-wrap;'>" + dumpStr + "</pre><button onclick='document.getElementById(\"debug-banner-dump\").style.display=\"none\"' style='padding:10px;margin-top:10px;background:red;color:white;'>閉じる</button>";

  } catch(e) {
    alert("エラーが発生しました: " + e.message);
  }
};
  `;
  
  code = code.replace(/window\.manualHealMonthlyData = function\(\) \{[\s\S]*?\};\s*$/m, manualFunc);
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Dump button ready');
