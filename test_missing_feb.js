const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

// Feb
const bufferFeb = fs.readFileSync('./inventory_data/【2課】2026年2月棚卸表.csv');
const rowsFeb = xlsx.utils.sheet_to_json(xlsx.read(decodeCsvBuffer(bufferFeb), { type: 'string' }).Sheets[xlsx.read(decodeCsvBuffer(bufferFeb), { type: 'string' }).SheetNames[0]], { header: 1, raw: false, defval: '' });

let febMap = {};
rowsFeb.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  const amountWithTax = parseFloat(String(row[20]).replace(/[^0-9.-]/g, '')) || 0;
  if(!febMap[pid]) febMap[pid] = amountWithTax;
  else febMap[pid] += amountWithTax;
});

// Mar
const bufferMar = fs.readFileSync('./inventory_data/【2課】2026年3月棚卸表.csv');
const rowsMar = xlsx.utils.sheet_to_json(xlsx.read(decodeCsvBuffer(bufferMar), { type: 'string' }).Sheets[xlsx.read(decodeCsvBuffer(bufferMar), { type: 'string' }).SheetNames[0]], { header: 1, raw: false, defval: '' });

let marMap = {};
rowsMar.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  marMap[pid] = true;
});

let missingSum = 0;
Object.keys(febMap).forEach(pid => {
  if (!marMap[pid]) {
    missingSum += febMap[pid];
  }
});

console.log("Sum of Feb items MISSING from March:", missingSum);
