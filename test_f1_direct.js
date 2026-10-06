const fs = require('fs');
const xlsx = require('xlsx');

const dir = './inventory_data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

for (const file of files) {
  if (file.includes('4') || file.includes('5')) {
    const buffer = fs.readFileSync(dir + '/' + file);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    
    let f1AmountRaw = null;
    if (sheet['F1']) {
      const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[,¥\s\\]/g, '');
      const num = parseFloat(val);
      if (!isNaN(num)) {
        f1AmountRaw = num;
      }
    }
    console.log(file, 'F1 Amount:', f1AmountRaw, 'Cell:', sheet['F1']);
  }
}
