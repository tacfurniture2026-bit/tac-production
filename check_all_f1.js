const fs = require('fs');
const xlsx = require('xlsx');

const dir = './inventory_data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv') && !f.endsWith('.bak'));

files.forEach(file => {
  const buffer = fs.readFileSync(dir + '/' + file);
  // decode using Shift-JIS or UTF-8
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.indexOf('\uFFFD') !== -1) {
    text = new TextDecoder('shift-jis').decode(buffer);
  }
  const workbook = xlsx.read(text, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  let f1AmountRaw = null;
  if (sheet['F1']) {
    const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '');
    f1AmountRaw = parseFloat(val);
  }
  console.log(`File: ${file} => F1: ${f1AmountRaw}`);
});
