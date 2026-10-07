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

let amounts = [];
rows.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const name = row[6];
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(name)) return;
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  
  const amountWithTax = parseFloat(String(row[20]).replace(/[^0-9.-]/g, '')) || 0;
  amounts.push(amountWithTax);
});

amounts.sort((a, b) => b - a);
let sum = 50276659; // Base F1
let target = 100223895;
let diff = target - sum; // 49947236

console.log("Looking for a subset that sums to:", diff);
let currentSum = 0;
let subset = [];
for (let i = 0; i < amounts.length; i++) {
  if (currentSum + amounts[i] <= diff + 1) { // allow 1 rounding error
    currentSum += amounts[i];
    subset.push(amounts[i]);
  }
}
console.log("Found subset sum:", currentSum, "Diff from target:", diff - currentSum);

// Let's also check if the difference is EXACTLY the sum of amounts EXCEPT duplicates!
let uniqueIds = new Set();
let uniqueSum = 0;
rows.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const name = row[6];
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(name)) return;
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  
  const amountWithTax = parseFloat(String(row[20]).replace(/[^0-9.-]/g, '')) || 0;
  if (!uniqueIds.has(pid)) {
    uniqueIds.add(pid);
    uniqueSum += amountWithTax;
  }
});
console.log("Sum of unique products:", uniqueSum);
console.log("Target minus uniqueSum:", target - uniqueSum);
