const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const bufferApr = fs.readFileSync('./inventory_data/【2課】2026年4月棚卸表.csv');
const sheet = xlsx.read(decodeCsvBuffer(bufferApr), { type: 'string' }).Sheets[xlsx.read(decodeCsvBuffer(bufferApr), { type: 'string' }).SheetNames[0]];

let f1 = null;
if (sheet['F1']) {
  f1 = parseFloat(String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, ''));
}
console.log("Apr F1:", f1);
