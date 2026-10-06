const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. Fix cleanupInvalidTempProducts
  const oldCleanup = `const p = products.find(prod => prod.id === scan.productId);
    if (!p) {`;
  const newCleanup = `if (scan.productId === 'META_F1_TOTAL') return true;
    const p = products.find(prod => prod.id === scan.productId);
    if (!p) {`;
  code = code.replace(oldCleanup, newCleanup);

  // 2. Add f1Total to INV_MONTHLY inside calculateInvMonthly
  const oldCalcReturn = `return {
    month: month,
    items: items,
    summary: summary,
    total: total,
    prevTotal: prevTotal,
    closedAt: new Date().toISOString()
  };`;
  const newCalcReturn = `return {
    month: month,
    items: items,
    summary: summary,
    total: total,
    f1Total: f1Total, // Store F1 total permanently
    prevTotal: prevTotal,
    closedAt: new Date().toISOString()
  };`;
  code = code.replace(oldCalcReturn, newCalcReturn);
  
  // 3. In saveInvMonthlyClosing, preserve f1Total
  const oldSaveClosing = `total: result.total,
    fixedTotal: (result.summary['fixed'] ? result.summary['fixed'].amount : 0) || 0,`;
  const newSaveClosing = `total: result.total,
    f1Total: result.f1Total,
    fixedTotal: (result.summary['fixed'] ? result.summary['fixed'].amount : 0) || 0,`;
  code = code.replace(oldSaveClosing, newSaveClosing);

  // 4. In calculateInvMonthly, load f1Total if override is null
  const oldCalcStart = `function calculateInvMonthly(month, f1Total = null) {
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];`;
  const newCalcStart = `function calculateInvMonthly(month, f1TotalOverride = null) {
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
  let f1Total = f1TotalOverride;
  if (f1Total === null) {
    const existing = monthly.find(m => m.month === month);
    if (existing && existing.f1Total !== undefined) {
      f1Total = existing.f1Total;
    }
  }`;
  code = code.replace(oldCalcStart, newCalcStart);

  // 5. Ensure the auto-healer and log deduplicator from my earlier uncommitted script are included
  const autoHealer = `
// --- Auto Healer for Duplicate Logs ---
(function healDuplicateLogs() {
  try {
    let logs = DB.get(DB.KEYS.INV_LOGS) || [];
    let initialCount = logs.length;
    let keepLogs = [];
    let seen = new Set();
    
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
  if (!code.includes('healDuplicateLogs')) {
    code += autoHealer;
  }
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fixed the root cause!');
