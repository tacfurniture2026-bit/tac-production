const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. Prevent confirmInvTempData from treating META_F1_TOTAL as a product
  code = code.replace(
    /if \(!s\.productId\.startsWith\('TEMP_'\)\) \{\s*renderedProductIds\.add\(s\.productId\);\s*\}/g,
    "if (!s.productId.startsWith('TEMP_') && s.productId !== 'META_F1_TOTAL') { renderedProductIds.add(s.productId); }"
  );

  // 2. Prevent calculateInvMonthly from including META_F1_TOTAL in products list
  code = code.replace(
    /monthLogs\.forEach\(l => \{ if \(l\.productId\) allProductIds\.add\(l\.productId\); \}\);/g,
    "monthLogs.forEach(l => { if (l.productId && l.productId !== 'META_F1_TOTAL') allProductIds.add(l.productId); });"
  );
  
  // 3. Fix the isClosed cache to skip META_F1_TOTAL when recalculating total
  code = code.replace(
    /savedData\.total = savedData\.items\.reduce\(\(sum, i\) => sum \+ \(Number\(i\.amount\) \|\| 0\), 0\);/g,
    "savedData.total = savedData.items.reduce((sum, i) => { if (i.productId === 'META_F1_TOTAL' || String(i.productId).startsWith('TEMP_')) return sum; return sum + (Number(i.amount) || 0); }, 0);"
  );

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Root cause patched');
