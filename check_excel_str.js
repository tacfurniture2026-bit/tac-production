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

const range = xlsx.utils.decode_range(sheet['!ref']);
for(let R = 0; R <= range.e.r; ++R) {
  for(let C = 0; C <= range.e.c; ++C) {
    const cell = sheet[xlsx.utils.encode_cell({c: C, r: R})];
    if (cell && typeof cell.v === 'string' && cell.v.includes('合計')) {
      console.log('Found', cell.v, 'at', xlsx.utils.encode_cell({c: C, r: R}));
    }
  }
}
