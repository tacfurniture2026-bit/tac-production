const fs = require('fs');
const xlsx = require('xlsx');

const dir = './inventory_data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

for (const file of files) {
  if (file.includes('4') || file.includes('5')) {
    const buffer = fs.readFileSync(dir + '/' + file);
    let str = buffer.toString('utf8');
    if (str.indexOf('') !== -1) {
       // just use xlsx to parse buffer as array
    }
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    
    let f1AmountRaw = null;
    if (rows[0] && rows[0].length >= 6) {
       const val = String(rows[0][5] || '').replace(/[,¥\s\\]/g, '');
       const num = parseFloat(val);
       if (!isNaN(num)) {
         f1AmountRaw = num;
       }
    }
    console.log(file, 'F1 Amount:', f1AmountRaw, 'Raw value:', rows[0] ? rows[0][5] : 'No row 0');
  }
}
