const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const dir = './inventory_data';
const file = dir + '/【2課】2026年4月棚卸表.csv';
const buffer = fs.readFileSync(file);
const text = decodeCsvBuffer(buffer);
const workbook = xlsx.read(text, { type: 'string' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

let f1AmountRaw = null;
if (sheet['F1']) {
  const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[,¥\s\\]/g, '');
  const num = parseFloat(val);
  if (!isNaN(num)) {
    f1AmountRaw = num;
  }
}
console.log('April F1:', f1AmountRaw);
