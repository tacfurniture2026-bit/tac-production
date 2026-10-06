const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldLoop = `// 1〜12月のデータを計算
      for (let m = 1; m <= 12; m++) {
        const monthStr = \`\${year}-\${String(m).padStart(2, '0')}\`;
        const result = calculateInvMonthly(monthStr);
        monthlyData.push(result);`;
        
  const newLoop = `// 1〜12月のデータを計算
      const allSavedMonthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
      for (let m = 1; m <= 12; m++) {
        const monthStr = \`\${year}-\${String(m).padStart(2, '0')}\`;
        const result = calculateInvMonthly(monthStr);
        // DBに確定済みの月次データがあれば、その数値を優先する（F1補正などを反映するため）
        const savedData = allSavedMonthly.find(x => x.month === monthStr);
        if (savedData && savedData.total !== undefined) {
          result.total = savedData.total;
        }
        monthlyData.push(result);`;
        
  code = code.replace(oldLoop, newLoop);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fixed annual report totals');
