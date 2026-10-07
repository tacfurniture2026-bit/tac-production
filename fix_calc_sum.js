const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldSum = `if (hasCsvImport) {
          // CSVインポート時は全CSV行の数量・U列金額を合算（0円も含め集計）
          countLogs.forEach(log => {
            currQty += safeNum(log.quantity);
            csvAmountWithTax += safeNum(log.amountWithTax);
          });
        } else {
          // 手動棚卸スキャン等の場合は最新のcountログの数量を採用（重複加算防止）
          const latestCountLog = countLogs[countLogs.length - 1];
          currQty = safeNum(latestCountLog.quantity);
          if (latestCountLog.amountWithTax > 0) {
            csvAmountWithTax = safeNum(latestCountLog.amountWithTax);
          }
        }`;
        
  const newSum = `// 常に最新のログ1件を採用する（重複加算バグ防止）
        const latestCountLog = countLogs[countLogs.length - 1];
        currQty = safeNum(latestCountLog.quantity);
        if (latestCountLog.amountWithTax !== undefined && latestCountLog.amountWithTax !== null && latestCountLog.amountWithTax > 0) {
          csvAmountWithTax = safeNum(latestCountLog.amountWithTax);
        } else if (hasCsvImport) {
          // CSVインポートだが単価0で金額が0の場合も0円として処理
          csvAmountWithTax = 0;
        }`;
        
  code = code.replace(oldSum, newSum);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Fixed calculateInvMonthly sum logic');
