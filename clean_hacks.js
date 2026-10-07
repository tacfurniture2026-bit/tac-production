const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Remove f1Total eradication hacks from calculateInvMonthly
  code = code.replace(/if \(f1Total === 100223895 \|\| f1Total === 100223877\) f1Total = null; \/\/ ERADICATE VIRUS/g, "");
  code = code.replace(/if \(existing\.f1Total !== 100223895 && existing\.f1Total !== 100223877\) \{/g, "if (true) {");
  code = code.replace(/if \(f1Meta && f1Meta\.amountWithTax !== undefined\) \{\s*if \(f1Meta\.amountWithTax !== 100223895 && f1Meta\.amountWithTax !== 100223877\) \{\s*f1Total = f1Meta\.amountWithTax;\s*\}\s*\}/g, "if (f1Meta && f1Meta.amountWithTax !== undefined) { f1Total = f1Meta.amountWithTax; }");
  code = code.replace(/if \(f1MetaAny && f1MetaAny\.amountWithTax !== undefined\) \{\s*if \(f1MetaAny\.amountWithTax !== 100223895 && f1MetaAny\.amountWithTax !== 100223877\) \{\s*f1Total = f1MetaAny\.amountWithTax;\s*\}\s*\}/g, "if (f1MetaAny && f1MetaAny.amountWithTax !== undefined) { f1Total = f1MetaAny.amountWithTax; }");

  // Also remove the hardcoded 100223895 check in the IIFE so it checks ALL months!
  // Wait, if I remove it, the IIFE will run on ALL months! This is exactly what we want to clean up the DB!
  code = code.replace(/if \(m\.total === 100223895 \|\| m\.total > 90000000 \|\| m\.total === 100223877\) \{/g, "if (true) {");

  // In IIFE: remove f1Total check
  code = code.replace(/if \(m\.f1Total !== 100223895 && m\.f1Total !== 100223877\) \{/g, "if (true) {");

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Hacks cleaned');
