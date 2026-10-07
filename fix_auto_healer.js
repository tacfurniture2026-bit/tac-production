const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Replace the old healer with a stricter one
  const oldHealerRegex = /\/\/ --- Auto Healer for Duplicate Logs ---[\s\S]*?\}\)\(\);/g;
  
  const newHealer = `// --- Auto Healer for Duplicate Logs ---
(function healDuplicateLogs() {
  try {
    let logs = DB.get(DB.KEYS.INV_LOGS) || [];
    let initialCount = logs.length;
    let keepLogs = [];
    let seen = new Set();
    
    // We want to keep the LATEST 'count' log for each (productId, month)
    // regardless of whether it's from '初期在庫データ取込' or '棚卸確定'
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (l.type === 'count' && l.timestamp) {
        const month = l.timestamp.substring(0, 7);
        const key = l.productId + '_' + month;
        if (seen.has(key)) {
          continue; // duplicate, skip it
        }
        seen.add(key);
      }
      keepLogs.unshift(l);
    }
    
    if (keepLogs.length < initialCount) {
      console.log('Healed strict duplicate logs:', initialCount - keepLogs.length);
      DB.save(DB.KEYS.INV_LOGS, JSON.parse(JSON.stringify(keepLogs)));
    }
  } catch (e) {
    console.error('Healer error:', e);
  }
})();`;

  code = code.replace(oldHealerRegex, newHealer);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fixed auto healer');
