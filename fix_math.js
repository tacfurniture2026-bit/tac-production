const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. Do not skip TEMP_ IDs in calculateInvMonthly
  code = code.replace(/if \(pid\.startsWith\('TEMP_'\)\) return;/g, "");
  
  // 2. Sum up duplicate count logs instead of taking only the last one
  const oldCountLog = `
      if (countLogs.length > 0) {
        hasCountLog = true;
        // 常に最新のログ1件を採用する（重複加算バグ防止）
        const latestCountLog = countLogs[countLogs.length - 1];
        currQty = safeNum(latestCountLog.quantity);
        if (latestCountLog.amountWithTax !== undefined && latestCountLog.amountWithTax !== null && latestCountLog.amountWithTax > 0) {
          csvAmountWithTax = safeNum(latestCountLog.amountWithTax);
        } else if (hasCsvImport) {
          // CSVインポートだが単価0で金額が0の場合も0円として処理
          csvAmountWithTax = 0;
        }
      } else if (isFixed && !hasCsvImport) {
  `;
  
  const newCountLog = `
      if (countLogs.length > 0) {
        hasCountLog = true;
        // エクセル内に同じIDが複数行ある場合、全て合算する（完全一致のため）
        currQty = 0;
        csvAmountWithTax = 0;
        let hasValidCsvAmount = false;
        
        countLogs.forEach(log => {
            currQty += safeNum(log.quantity);
            if (log.amountWithTax !== undefined && log.amountWithTax !== null && log.amountWithTax > 0) {
                csvAmountWithTax += safeNum(log.amountWithTax);
                hasValidCsvAmount = true;
            }
        });
        
        if (!hasValidCsvAmount && hasCsvImport) {
            csvAmountWithTax = 0;
        }
      } else if (isFixed && !hasCsvImport) {
  `;
  
  code = code.replace(oldCountLog, newCountLog);

  // 3. Remove TEMP_ skip from rawTotal calculation
  code = code.replace(
    /const rawTotal = items\.reduce\(\(sum, i\) => \{\s*if \(i\.productId === 'META_F1_TOTAL' \|\| String\(i\.productId\)\.startsWith\('TEMP_'\)\) return sum;\s*return sum \+ \(i\.rawAmount !== undefined \? i\.rawAmount : i\.amount\);\s*\}, 0\);/g,
    "const rawTotal = items.reduce((sum, i) => { if (i.productId === 'META_F1_TOTAL') return sum; return sum + (i.rawAmount !== undefined ? i.rawAmount : i.amount); }, 0);"
  );
  
  // 4. Remove TEMP_ skip from isClosed cache recalculation
  code = code.replace(
    /let calculatedTotal = savedData\.items\.reduce\(\(sum, i\) => \{ if \(i\.productId === 'META_F1_TOTAL' \|\| String\(i\.productId\)\.startsWith\('TEMP_'\)\) return sum; return sum \+ \(Number\(i\.amount\) \|\| 0\); \}, 0\);/g,
    "let calculatedTotal = savedData.items.reduce((sum, i) => { if (i.productId === 'META_F1_TOTAL') return sum; return sum + (Number(i.amount) || 0); }, 0);"
  );

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Math logic fixed');
