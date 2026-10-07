const fs = require('fs');

// We simulate the exact calculation of March when hasCsvImport is false.
// This means all items carry over from Feb unless overridden by count.

// 1. Read Feb CSV to build prevDataMap
const xlsx = require('xlsx');
function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const bufferFeb = fs.readFileSync('./inventory_data/【2課】2026年2月棚卸表.csv');
const textFeb = decodeCsvBuffer(bufferFeb);
const wbFeb = xlsx.read(textFeb, { type: 'string' });
const rowsFeb = xlsx.utils.sheet_to_json(wbFeb.Sheets[wbFeb.SheetNames[0]], { header: 1, raw: false, defval: '' });

let prevDataMap = {};
rowsFeb.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  const qty = parseInt(String(row[18]).replace(/[^0-9.-]/g, ''), 10) || 0;
  const amount = parseFloat(String(row[19]).replace(/[^0-9.-]/g, '')) || 0;
  if (qty > 0 || amount > 0) {
    if(!prevDataMap[pid]) prevDataMap[pid] = { qty, amount };
    else { prevDataMap[pid].qty += qty; prevDataMap[pid].amount += amount; }
  }
});

// 2. Read March CSV to simulate count logs (without amountWithTax)
const bufferMar = fs.readFileSync('./inventory_data/【2課】2026年3月棚卸表.csv');
const textMar = decodeCsvBuffer(bufferMar);
const wbMar = xlsx.read(textMar, { type: 'string' });
const rowsMar = xlsx.utils.sheet_to_json(wbMar.Sheets[wbMar.SheetNames[0]], { header: 1, raw: false, defval: '' });

let countLogsMap = {};
let priceMap = {};
rowsMar.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  const qty = parseInt(String(row[18]).replace(/[^0-9.-]/g, ''), 10) || 0;
  const price = parseFloat(String(row[13]).replace(/[^0-9.-]/g, '')) || 0;
  priceMap[pid] = price;
  if(!countLogsMap[pid]) countLogsMap[pid] = qty;
  else countLogsMap[pid] += qty;
});

// 3. Calculate rawTotal
let rawTotal = 0;
const allPids = new Set([...Object.keys(prevDataMap), ...Object.keys(countLogsMap)]);

allPids.forEach(pid => {
  const prev = prevDataMap[pid] || { qty: 0, amount: 0 };
  const hasCountLog = countLogsMap[pid] !== undefined;
  const countQty = countLogsMap[pid] || 0;
  
  let currQty = prev.qty;
  if (hasCountLog) currQty = countQty;
  
  // Since hasCsvImport is false, it uses currQty * price * 1.01
  const price = priceMap[pid] || 0;
  const amountRaw = currQty * price * 1.01;
  rawTotal += amountRaw;
});

console.log("Calculated rawTotal when hasCsvImport is FALSE:", Math.round(rawTotal));
console.log("Difference from 100223895:", Math.round(rawTotal) - 100223895);
