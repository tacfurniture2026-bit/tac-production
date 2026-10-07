const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Insert button in dashboard
  const btnHTML = `
  <div style="margin: 20px 0; padding: 15px; background: #fee2e2; border: 2px solid red; border-radius: 8px; text-align: center;">
    <h3 style="color: red; margin-bottom: 10px;">【重要】3月の異常数値(1億円)の修正はこちら</h3>
    <button onclick="manualHealMonthlyData()" style="background: red; color: white; padding: 10px 20px; font-size: 16px; border-radius: 5px; font-weight: bold;">異常数値を強制修正する</button>
  </div>
  `;
  
  if (code.includes('<div class="stats-grid">')) {
    code = code.replace(/<div class="stats-grid">/i, btnHTML + '\n<div class="stats-grid">');
    console.log('Button added to', filename);
  } else {
    console.log('Could not find stats-grid in', filename);
  }

  fs.writeFileSync(filename, code);
}

patchFile('index.html');
patchFile('mobile_source.html');
