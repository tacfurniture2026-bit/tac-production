const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. In manualHealMonthlyData, remove from INV_MONTHLY before calling calculateInvMonthly
  const oldManual = `
        let realF1 = meta ? meta.amountWithTax : null;
        if (realF1 === 100223895 || realF1 === 100223877) realF1 = null;
        
        // COMPLETELY recalculate without the virus
        const finalResult = calculateInvMonthly(m.month, realF1);
        m.items = finalResult.items;
  `;
  const newManual = `
        let realF1 = meta ? meta.amountWithTax : null;
        if (realF1 === 100223895 || realF1 === 100223877) realF1 = null;
        
        // COMPLETELY recalculate without the virus
        // MUST DELETE FROM DB CACHE FIRST OR IT WILL SHORT-CIRCUIT
        let tempMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
        tempMonthly = tempMonthly.filter(x => x.month !== m.month);
        DB.save(DB.KEYS.INV_MONTHLY, tempMonthly);
        
        const finalResult = calculateInvMonthly(m.month, realF1);
        m.items = finalResult.items;
  `;
  code = code.replace(oldManual, newManual);

  // 2. Also patch the IIFE to delete from DB before calling
  const oldIIFE = `
        if (!f1) {
           const tScans = DB.getTempScans() || [];
           const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
           if (meta) f1 = meta.amountWithTax;
           if (f1 === 100223895 || f1 === 100223877) f1 = null;
        }
        const result = calculateInvMonthly(m.month, f1);
  `;
  const newIIFE = `
        if (!f1) {
           const tScans = DB.getTempScans() || [];
           const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
           if (meta) f1 = meta.amountWithTax;
           if (f1 === 100223895 || f1 === 100223877) f1 = null;
        }
        let tempMonthly2 = DB.get(DB.KEYS.INV_MONTHLY) || [];
        tempMonthly2 = tempMonthly2.filter(x => x.month !== m.month);
        DB.save(DB.KEYS.INV_MONTHLY, tempMonthly2);
        const result = calculateInvMonthly(m.month, f1);
  `;
  code = code.replace(oldIIFE, newIIFE);

  // 3. Make the diagnostic alert back into a success alert
  const oldAlert = `
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
    banner.innerHTML = "<h3>【開発者用データダンプ】この画面全体をスクリーンショットしてください！</h3><pre style='background:#eee;padding:10px;font-size:12px;white-space:pre-wrap;'>" + dumpStr + "</pre><button onclick='document.getElementById(\\"debug-banner-dump\\").style.display=\\"none\\"\' style='padding:10px;margin-top:10px;background:red;color:white;'>閉じる</button>";
  `;
  
  const newAlert = `
        // Save the fresh result!
        let finalMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
        // Add it back
        const existingIdx = finalMonthly.findIndex(x => x.month === finalResult.month);
        if (existingIdx >= 0) finalMonthly[existingIdx] = finalResult;
        else finalMonthly.push(finalResult);
        DB.save(DB.KEYS.INV_MONTHLY, finalMonthly);
        
        alert("【究極の修正完了】\\n異常データによる計算のショートカット(キャッシュ)を完全に破壊しました。\\n新しい正しい合計金額は: " + finalResult.total + " です。\\n画面を再読み込みします。");
        location.reload();
  `;
  code = code.replace(oldAlert, newAlert);

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('isClosed cache bypass patched');
