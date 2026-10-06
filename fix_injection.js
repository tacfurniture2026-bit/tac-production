const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Remove the bad injection from setupInitialDataImport
  code = code.replace(/let logs = DB\.get\(DB\.KEYS\.INV_LOGS\) \|\| \[\];\n\s*\/\/[^\n]*\n\s*logs = logs\.filter\(l => !\(l\.type === 'count' && l\.note && l\.note\.includes\('棚卸確定'\) && l\.timestamp && l\.timestamp\.startsWith\(selectedMonth\)\)\);/g, "let logs = DB.get(DB.KEYS.INV_LOGS) || [];");
  
  // Replace the filter logic in confirmInvTempData
  const oldFilter = `logs = logs.filter(l => {
      if (!(l.timestamp && l.timestamp.startsWith(selectedMonth))) return true;
      if (l.type === 'count_temp') return false;
      if (l.type === 'count' && l.worker === 'Excel一括取込') return false; 
      // 手動スキャン等のログは消さない
      return true;
  });`;

  const newFilter = `logs = logs.filter(l => {
      if (!(l.timestamp && l.timestamp.startsWith(selectedMonth))) return true;
      if (l.type === 'count_temp') return false;
      // 確定ボタンを複数回押した時の重複加算を防ぐため、確定時のログはすべて消して作り直す
      if (l.type === 'count' && l.note && l.note.includes('棚卸確定')) return false; 
      return true;
  });`;
  
  code = code.replace(oldFilter, newFilter);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fixed log filter injection');
