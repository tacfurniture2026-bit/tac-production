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
const sheet = wbMar.Sheets[wbMar.SheetNames[0]];

console.log('E1:', sheet['E1'] ? sheet['E1'].v : 'undefined');
console.log('F1:', sheet['F1'] ? sheet['F1'].v : 'undefined');
console.log('G1:', sheet['G1'] ? sheet['G1'].v : 'undefined');
