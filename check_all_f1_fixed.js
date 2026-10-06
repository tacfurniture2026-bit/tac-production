const fs = require('fs');
const xlsx = require('xlsx');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const dir = './inventory_data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv') && !f.endsWith('.bak'));

files.forEach(file => {
  const buffer = fs.readFileSync(dir + '/' + file);
  const text = decodeCsvBuffer(buffer);
  const workbook = xlsx.read(text, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  let f1 = sheet['F1'] ? String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '') : 'undefined';
  let f1Num = parseFloat(f1);
  console.log(`File: ${file} => F1 parsed: ${f1Num}`);
});
