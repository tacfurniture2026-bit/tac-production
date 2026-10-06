const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. In confirmInvTempData, clean old logs for the month before pushing
  const oldLogInit = "let logs = DB.get(DB.KEYS.INV_LOGS) || [];";
  const newLogInit = `let logs = DB.get(DB.KEYS.INV_LOGS) || [];
  // 重複加算を防ぐため、確定対象月の古い棚卸ログを削除
  logs = logs.filter(l => !(l.type === 'count' && l.note && l.note.includes('棚卸確定') && l.timestamp && l.timestamp.startsWith(selectedMonth)));`;
  
  code = code.replace(oldLogInit, newLogInit);
  
  // 2. Add a global auto-healer at the end of window.onload or globally
  const autoHealer = `
// --- Auto Healer for Duplicate Logs ---
(function healDuplicateLogs() {
  try {
    let logs = DB.get(DB.KEYS.INV_LOGS) || [];
    let initialCount = logs.length;
    let keepLogs = [];
    let seen = new Set();
    
    // We want to keep the LATEST log for each (productId, month) if it's a 'count' log from '棚卸確定'
    // To do this easily, we process backwards
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if (l.type === 'count' && l.note && l.note.includes('棚卸確定') && l.timestamp) {
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
      console.log('Healed duplicate logs:', initialCount - keepLogs.length);
      DB.save(DB.KEYS.INV_LOGS, JSON.parse(JSON.stringify(keepLogs)));
    }
  } catch (e) {
    console.error('Healer error:', e);
  }
})();
`;
  
  // Append healer to the end of the file
  if (!code.includes('healDuplicateLogs')) {
    code += autoHealer;
  }

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Patched log deduplication');
