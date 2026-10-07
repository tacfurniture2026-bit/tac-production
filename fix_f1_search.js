const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const searchLogic = `
          let f1AmountRaw = null;
          if (sheet['F1']) {
            const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '');
            const num = parseFloat(val);
            if (!isNaN(num)) {
              f1AmountRaw = num;
            }
          }
          // セルずれ対策：合計金額という文字を探してその右のセルを取得する
          if (f1AmountRaw === null) {
            const range = XLSX.utils.decode_range(sheet['!ref']);
            for(let R = 0; R <= Math.min(5, range.e.r); ++R) {
              for(let C = 0; C <= range.e.c; ++C) {
                const cell = sheet[XLSX.utils.encode_cell({c: C, r: R})];
                if (cell && typeof cell.v === 'string' && cell.v.includes('合計金額')) {
                  const rightCell = sheet[XLSX.utils.encode_cell({c: C+1, r: R})];
                  if (rightCell) {
                    const val = String(rightCell.w || rightCell.v || '').replace(/[^0-9.-]/g, '');
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                      f1AmountRaw = num;
                      console.log('Found total via keyword search:', num);
                      break;
                    }
                  }
                }
              }
              if (f1AmountRaw !== null) break;
            }
          }
  `;
  
  // replace in setupInvExcelImport
  let oldF1 = `          let f1AmountRaw = null;
          if (sheet['F1']) {
            const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '');
            const num = parseFloat(val);
            if (!isNaN(num)) {
              f1AmountRaw = num;
            }
          }`;
  code = code.replace(oldF1, searchLogic);
  
  // replace in setupInitialDataImport
  let oldF1_2 = `        let f1TotalVal = null;
        if (sheet['F1']) {
          const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '');
          const num = parseFloat(val);
          if (!isNaN(num)) {
            f1TotalVal = num;
          }
        }`;
        
  let searchLogic_2 = `        let f1TotalVal = null;
        if (sheet['F1']) {
          const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '');
          const num = parseFloat(val);
          if (!isNaN(num)) {
            f1TotalVal = num;
          }
        }
        if (f1TotalVal === null) {
          const range = XLSX.utils.decode_range(sheet['!ref']);
          for(let R = 0; R <= Math.min(5, range.e.r); ++R) {
            for(let C = 0; C <= range.e.c; ++C) {
              const cell = sheet[XLSX.utils.encode_cell({c: C, r: R})];
              if (cell && typeof cell.v === 'string' && cell.v.includes('合計金額')) {
                const rightCell = sheet[XLSX.utils.encode_cell({c: C+1, r: R})];
                if (rightCell) {
                  const val = String(rightCell.w || rightCell.v || '').replace(/[^0-9.-]/g, '');
                  const num = parseFloat(val);
                  if (!isNaN(num)) {
                    f1TotalVal = num;
                    break;
                  }
                }
              }
            }
            if (f1TotalVal !== null) break;
          }
        }`;
  code = code.replace(oldF1_2, searchLogic_2);
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('F1 smart search applied');
