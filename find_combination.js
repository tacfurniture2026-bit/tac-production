const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const dir = './inventory_data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv') && !f.endsWith('.bak'));

let allAmounts = [];
files.forEach(file => {
  const buffer = fs.readFileSync(dir + '/' + file);
  const text = decodeCsvBuffer(buffer);
  const workbook = xlsx.read(text, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  
  let sumU = 0;
  let sumT = 0;
  let f1 = 0;
  if (sheet['F1']) {
    const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '');
    f1 = parseFloat(val) || 0;
  }
  
  rows.forEach((row, rowIndex) => {
    if (rowIndex < 1) return;
    const pid = row[4];
    const name = row[6];
    if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(name)) return;
    if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
    
    const amountWithTax = parseFloat(String(row[20]).replace(/[^0-9.-]/g, '')) || 0;
    sumU += amountWithTax;
    
    const amount = parseFloat(String(row[19]).replace(/[^0-9.-]/g, '')) || 0;
    sumT += amount;
  });
  
  allAmounts.push({ file, f1, sumU, sumT });
});

console.log(allAmounts);
