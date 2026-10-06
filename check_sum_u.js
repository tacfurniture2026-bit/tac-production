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
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  
  let uSum = 0;
  rows.forEach((row, rowIndex) => {
    if (rowIndex < 1) return;
    const productName = String(row[6] || '').trim();
    if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(productName)) return;
    
    let uVal = parseFloat(String(row[20] || '0').replace(/[^0-9.-]/g, '')) || 0;
    uSum += uVal;
  });
  
  console.log(`File: ${file} => Sum of U: ${uSum}`);
});
