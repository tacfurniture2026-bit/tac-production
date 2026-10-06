const fs = require('fs');

function patchTz(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  const regex = /const prevDate = new Date\(month \+ '-01'\);\n\s*prevDate\.setMonth\(prevDate\.getMonth\(\) - 1\);\n\s*const prevMonth = prevDate\.toISOString\(\)\.substring\(0, 7\);/g;
  const replaceWith = `const [yearStr, monthStr] = month.split('-');
  const prevDateLocal = new Date(parseInt(yearStr), parseInt(monthStr) - 2, 1);
  const prevMonth = \`\${prevDateLocal.getFullYear()}-\${String(prevDateLocal.getMonth() + 1).padStart(2, '0')}\`;`;
  
  code = code.replace(regex, replaceWith);
  fs.writeFileSync(filename, code);
}

patchTz('app.js');
patchTz('app-mobile.js');
console.log('Patched timezone bug.');
