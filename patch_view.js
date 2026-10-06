const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

const regex = /function viewInvMonthlySummary\(\) \{([\s\S]*?)const result = calculateInvMonthly\(month\);/g;
const replaceWith = `function viewInvMonthlySummary() {$1const tempScans = DB.getTempScans() || [];
  const currentTempScans = tempScans.filter(s => s.month === month);
  const f1Meta = currentTempScans.find(s => s.productId === 'META_F1_TOTAL');
  const f1Total = f1Meta ? f1Meta.amountWithTax : null;
  const result = calculateInvMonthly(month, f1Total);`;

appJs = appJs.replace(regex, replaceWith);
appJs = appJs.replace(/v6\.15\.0/g, 'v6.16.0');
fs.writeFileSync('app.js', appJs);

let appMobileJs = fs.readFileSync('app-mobile.js', 'utf8');
appMobileJs = appMobileJs.replace(regex, replaceWith);
appMobileJs = appMobileJs.replace(/v6\.15\.0/g, 'v6.16.0');
fs.writeFileSync('app-mobile.js', appMobileJs);

console.log('Patched viewInvMonthlySummary.');
