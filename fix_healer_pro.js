const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldHealer = `      if (l.type === 'count' && l.timestamp) {
        const month = l.timestamp.substring(0, 7);
        const key = l.productId + '_' + month;
        if (seen.has(key)) {
          continue; // duplicate, skip it
        }
        seen.add(key);
      }`;
      
  const newHealer = `      if (l.type === 'count') {
        let month = '';
        if (l.timestamp) {
          month = l.timestamp.substring(0, 7);
        } else if (l.note) {
          const match = l.note.match(/\\((\\d{4}-\\d{2})\\)/);
          if (match) month = match[1];
        }
        if (month) {
          const key = l.productId + '_' + month;
          if (seen.has(key)) {
            continue; // duplicate, skip it
          }
          seen.add(key);
        }
      }`;
      
  code = code.replace(oldHealer, newHealer);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Auto-healer made bulletproof');
