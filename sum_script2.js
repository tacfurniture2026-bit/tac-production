const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const dir = './inventory_data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));

for (const file of files) {
  if (file.includes('4') || file.includes('5')) {
    const filePath = path.join(dir, file);
    const buffer = fs.readFileSync(filePath);
    let str = buffer.toString('utf8');
    if (str.indexOf('') !== -1 || str.indexOf('??') !== -1) {
      str = iconv.decode(buffer, 'Shift_JIS');
    }
    
    // Fallback to shift_jis if still looks weird? Let's just always do Shift_JIS since they were Shift_JIS earlier
    str = iconv.decode(buffer, 'Shift_JIS');

    const lines = str.split(/\r?\n/);
    let sum = 0;
    
    lines.forEach(line => {
      // Split by comma. This will break on commas inside quotes, but standard Japanese numbers often don't have quotes if they are just numbers,
      // or if they do, we'll see.
      const cols = line.split(',');
      if (cols.length > 20) {
        let val = cols[20];
        if (val) {
           val = val.replace(/["']/g, ''); // remove quotes
           const num = parseFloat(val);
           if (!isNaN(num)) {
             sum += num;
           }
        }
      }
    });
    console.log('Total for', file, 'Sum Column U:', sum);
  }
}
