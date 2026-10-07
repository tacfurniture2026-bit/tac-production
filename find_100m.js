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

let sumU = 0;
let sumT = 0;
let sumN = 0;
let qtySum = 0;

rows.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  
  const pid = row[4];
  const name = row[6];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(name)) return;
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  
  const qty = parseInt(String(row[18]).replace(/[^0-9.-]/g, ''), 10) || 0;
  qtySum += qty;
  
  const amountWithTax = parseFloat(String(row[20]).replace(/[^0-9.-]/g, '')) || 0;
  sumU += amountWithTax;
  
  const amount = parseFloat(String(row[19]).replace(/[^0-9.-]/g, '')) || 0;
  sumT += amount;

  const unitPrice = parseFloat(String(row[13]).replace(/[^0-9.-]/g, '')) || 0;
  sumN += (unitPrice * qty * 1.01);
});

console.log("Sum U (amountWithTax):", sumU);
console.log("Sum T (amount):", sumT);
console.log("Sum N (qty * price * 1.01):", sumN);
console.log("Target:", 100223895);
console.log("Diff from Target to Sum U * 2:", 100223895 - (sumU * 2));
console.log("Sum U * 2:", sumU * 2);
