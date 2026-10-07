const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const dir = './inventory_data';
const file = dir + '/【2課】2026年3月棚卸表.csv';
const buffer = fs.readFileSync(file);
const text = decodeCsvBuffer(buffer);
const workbook = xlsx.read(text, { type: 'string' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

let target = 329423;
let amounts = [];
rows.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const name = row[6];
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(name)) return;
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  
  const amountWithTax = parseFloat(String(row[20]).replace(/[^0-9.-]/g, '')) || 0;
  amounts.push({ pid, name, amountWithTax });
});

console.log("Looking for single product with 329423...");
amounts.forEach(a => {
  if (Math.abs(a.amountWithTax - target) <= 10) {
    console.log("Found!", a);
  }
});

console.log("Looking for pair...");
for(let i=0; i<amounts.length; i++) {
  for(let j=i+1; j<amounts.length; j++) {
    if (Math.abs(amounts[i].amountWithTax + amounts[j].amountWithTax - target) <= 2) {
      console.log("Found pair!", amounts[i], amounts[j]);
    }
  }
}
