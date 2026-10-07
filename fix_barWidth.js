const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Dashboard category
  code = code.replace(
    /const barWidth = totalInvAmount > 0 \? Math\.round\(\(data\.total \/ totalInvAmount\) \* 100\) : 0;/g,
    "const barWidth = totalInvAmount > 0 ? ((data.total / totalInvAmount) * 100).toFixed(2) : '0.00';"
  );
  
  // Monthly Summary category
  code = code.replace(
    /const barWidth = summaryTotal > 0 \? Math\.round\(\(cat\.amount \/ summaryTotal\) \* 100\) : 0;/g,
    "const barWidth = summaryTotal > 0 ? ((cat.amount / summaryTotal) * 100).toFixed(2) : '0.00';"
  );

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('barWidth fixed');
