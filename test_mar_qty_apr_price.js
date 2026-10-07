const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

// 1. Read Mar qty
const bufferMar = fs.readFileSync('./inventory_data/【2課】2026年3月棚卸表.csv');
const rowsMar = xlsx.utils.sheet_to_json(xlsx.read(decodeCsvBuffer(bufferMar), { type: 'string' }).Sheets[xlsx.read(decodeCsvBuffer(bufferMar), { type: 'string' }).SheetNames[0]], { header: 1, raw: false, defval: '' });

let marQtyMap = {};
rowsMar.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  const qty = parseInt(String(row[18]).replace(/[^0-9.-]/g, ''), 10) || 0;
  if(!marQtyMap[pid]) marQtyMap[pid] = qty;
  else marQtyMap[pid] += qty;
});

// 2. Read Apr price
const bufferApr = fs.readFileSync('./inventory_data/【2課】2026年4月棚卸表.csv');
const rowsApr = xlsx.utils.sheet_to_json(xlsx.read(decodeCsvBuffer(bufferApr), { type: 'string' }).Sheets[xlsx.read(decodeCsvBuffer(bufferApr), { type: 'string' }).SheetNames[0]], { header: 1, raw: false, defval: '' });

let aprPriceMap = {};
rowsApr.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  const price = parseFloat(String(row[13]).replace(/[^0-9.-]/g, '')) || 0;
  aprPriceMap[pid] = price;
});

// 3. Read Mar price for fallback
let marPriceMap = {};
rowsMar.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const pid = row[4];
  const price = parseFloat(String(row[13]).replace(/[^0-9.-]/g, '')) || 0;
  marPriceMap[pid] = price;
});

let total = 0;
Object.keys(marQtyMap).forEach(pid => {
  const qty = marQtyMap[pid];
  const price = aprPriceMap[pid] !== undefined ? aprPriceMap[pid] : marPriceMap[pid];
  total += qty * price * 1.01;
});

console.log("Mar Qty * Apr Price * 1.01 =", Math.round(total));
