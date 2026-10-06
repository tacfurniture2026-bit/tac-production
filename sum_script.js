const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');
const iconv = require('iconv-lite');

const dir = './inventory_data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

for (const file of files) {
  if (file.includes('4') || file.includes('5')) {
    console.log('Processing:', file);
    const filePath = path.join(dir, file);
    const buffer = fs.readFileSync(filePath);
    let str = buffer.toString('utf8');
    if (str.indexOf('') !== -1) {
      str = iconv.decode(buffer, 'Shift_JIS');
    }
    
    // Parse it as CSV manually to see everything
    const lines = str.split(/\r?\n/);
    let sumU = 0;
    
    lines.forEach((line, index) => {
      // Very basic CSV split (doesn't handle quotes with commas, but should be ok for numbers)
      // Actually we have SheetJS, let's just use it to be safe
    });
    
    // Use SheetJS
    const workbook = xlsx.read(str, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let sumSheetJS = 0;
    jsonData.forEach((row, i) => {
      // Column U is index 20
      const val = row[20];
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val.toString().replace(/,/g, ''));
        if (!isNaN(num)) {
          sumSheetJS += num;
        }
      }
    });
    console.log('Total for', file, 'Sum Column U:', sumSheetJS);
  }
}
