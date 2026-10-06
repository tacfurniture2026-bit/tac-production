const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

const regex = /let f1AmountRaw = null;[\s\S]*?f1AmountRaw = num;\n\s*}\n\s*}/;
const replaceWith = `
          let f1AmountRaw = null;
          if (sheet['F1']) {
            const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[,¥\\s\\\\]/g, '');
            const num = parseFloat(val);
            if (!isNaN(num)) {
              f1AmountRaw = num;
            }
          }
`;

appJs = appJs.replace(regex, replaceWith);
appJs = appJs.replace(/v6\.14\.0/g, 'v6.15.0');
fs.writeFileSync('app.js', appJs);

let appMobileJs = fs.readFileSync('app-mobile.js', 'utf8');
appMobileJs = appMobileJs.replace(/v6\.14\.0/g, 'v6.15.0');
fs.writeFileSync('app-mobile.js', appMobileJs);

console.log('Patched F1 cell access.');
