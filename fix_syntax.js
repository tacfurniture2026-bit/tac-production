const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const badLine = 'banner.innerHTML = "<h3>【開発者用データダンプ】この画面全体をスクリーンショットしてください！</h3><pre style=\'background:#eee;padding:10px;font-size:12px;white-space:pre-wrap;\'>" + dumpStr + "</pre><button onclick=\'document.getElementById("debug-banner-dump").style.display="none"\' style=\'padding:10px;margin-top:10px;background:red;color:white;\'>閉じる</button>";';
  
  const goodLine = 'banner.innerHTML = "<h3>【開発者用データダンプ】この画面全体をスクリーンショットしてください！</h3><pre style=\'background:#eee;padding:10px;font-size:12px;white-space:pre-wrap;\'>" + dumpStr + "</pre><button onclick=\'document.getElementById(\\"debug-banner-dump\\").style.display=\\"none\\"\' style=\'padding:10px;margin-top:10px;background:red;color:white;\'>閉じる</button>";';
  
  code = code.replace(badLine, goodLine);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Syntax fixed');
