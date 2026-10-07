const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

// Read Feb qty and amountWithTax
const bufferFeb = fs.readFileSync('./inventory_data/【2課】2026年2月棚卸表.csv');
const rowsFeb = xlsx.utils.sheet_to_json(xlsx.read(decodeCsvBuffer(bufferFeb), { type: 'string' }).Sheets[xlsx.read(decodeCsvBuffer(bufferFeb), { type: 'string' }).SheetNames[0]], { header: 1, raw: false, defval: '' });

let sumU = 0;
let f1Raw = null;
if (rowsFeb[0] && rowsFeb[0][5]) { // F1 might be in col 5
   f1Raw = rowsFeb[0][5];
}

rowsFeb.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  const amountWithTax = parseFloat(String(row[20]).replace(/[^0-9.-]/g, '')) || 0;
  sumU += amountWithTax;
});

console.log("Feb Sum U:", sumU);
