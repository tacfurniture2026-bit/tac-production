const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

const mockDB = `
const DB = {
  KEYS: { INV_PRODUCTS: 'a', INV_LOGS: 'b', INV_MONTHLY: 'c', INV_SCAN_TEMP: 'd' },
  get: function(k) {
    if (k === 'a') return [{ id: '01', name: 'Item1', category: '01', price: 100, isFixed: false }];
    if (k === 'b') return [];
    if (k === 'c') return [];
    if (k === 'd') return [];
    return [];
  },
  getTempScans: function() { return []; },
  save: function() {}
};
const window = { location: { search: '' } };
const document = { getElementById: () => null, addEventListener: () => {} };
function $(s) { return null; }
function toast() {}
`;

// Extract just the calculateInvMonthly function
const calcFuncMatch = appJs.match(/function calculateInvMonthly[\s\S]*?\n\}/);

let codeToRun = mockDB + '\n' + (calcFuncMatch ? calcFuncMatch[0] : '');

fs.writeFileSync('test_calc_runner.js', codeToRun + '\nconsole.log(calculateInvMonthly("2026-04", 5000));');
