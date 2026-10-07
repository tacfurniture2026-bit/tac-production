const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. isClosed
  code = code.replace(
    /const diff = savedData\.total - calculatedTotal;[\s\S]*?savedData\.summary\['adjustment'\]\.amount = diff;\s*}/g,
    "const diff = savedData.total - calculatedTotal;" // keep diff var just in case
  );
  code = code.replace(/&& k !== 'adjustment'/g, "");

  // 2. calculateInvMonthly
  code = code.replace(
    /const diff = f1Total - total;[\s\S]*?total = f1Total;\s*}/g,
    "const diff = f1Total - total;\n    if (diff !== 0) {\n      total = f1Total;\n    }"
  );

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Forced deletion of adjustment');
