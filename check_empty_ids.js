const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const bufferMar = fs.readFileSync('./inventory_data/【2課】2026年3月棚卸表.csv');
const textMar = decodeCsvBuffer(bufferMar);
const wbMar = xlsx.read(textMar, { type: 'string' });
const rowsMar = xlsx.utils.sheet_to_json(wbMar.Sheets[wbMar.SheetNames[0]], { header: 1, raw: false, defval: '' });

let emptyCount = 0;
let emptySum = 0;
rowsMar.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const name = row[6];
  const pid = row[4];
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(name)) return;
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(pid)) return;
  
  if (!pid) {
    emptyCount++;
    emptySum += parseFloat(String(row[20]).replace(/[^0-9.-]/g, '')) || 0;
  }
});
console.log("Empty IDs:", emptyCount, "Sum of their amounts:", emptySum);
