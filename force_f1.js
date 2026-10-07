const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. Force calculating F1 from temp scans directly in calculateInvMonthly if missing
  const oldF1 = `let f1Total = f1TotalOverride;
  if (f1Total === null) {
    const existing = monthly.find(m => m.month === month);
    if (existing && existing.f1Total !== undefined) {
      f1Total = existing.f1Total;
    }
  }`;
  
  const newF1 = `let f1Total = f1TotalOverride;
  if (f1Total === null || isNaN(f1Total)) {
    const existing = monthly.find(m => m.month === month);
    if (existing && existing.f1Total !== undefined && existing.f1Total !== null && !isNaN(existing.f1Total)) {
      f1Total = existing.f1Total;
    }
  }
  // 究極のフォールバック：tempScansからも探す
  if (f1Total === null || isNaN(f1Total)) {
    const tScans = DB.getTempScans() || [];
    const f1Meta = tScans.find(s => s.month === month && s.productId === 'META_F1_TOTAL');
    if (f1Meta && f1Meta.amountWithTax !== undefined) {
      f1Total = f1Meta.amountWithTax;
    }
  }
  
  // さらなる究極のフォールバック：直近のCSVのF1を探す (月が合わなくても最新のインポートのF1を使う)
  if (f1Total === null || isNaN(f1Total)) {
     const tScans = DB.getTempScans() || [];
     const f1MetaAny = tScans.find(s => s.productId === 'META_F1_TOTAL');
     if (f1MetaAny && f1MetaAny.amountWithTax !== undefined) {
       f1Total = f1MetaAny.amountWithTax;
     }
  }
  `;
  
  code = code.replace(oldF1, newF1);
  
  // 2. Prevent missing items from carrying over their previous quantity if it's a full CSV import
  const oldCarry = `let currQty = prevQty;`;
  const newCarry = `// CSV一括取込の場合、CSVに存在しない商品は数量0として扱う（前月からの自動繰り越しをしない）
    let currQty = hasCsvImport ? 0 : prevQty;`;
    
  code = code.replace(oldCarry, newCarry);
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Forced F1 and zeroed missing items');
