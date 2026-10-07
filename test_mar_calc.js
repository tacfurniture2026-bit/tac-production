const fs = require('fs');
const xlsx = require('xlsx');

let appJs = fs.readFileSync('app.js', 'utf8');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const dir = './inventory_data';
const file = dir + '/【2課】2026年3月棚卸表.csv';
const buffer = fs.readFileSync(file);
const text = decodeCsvBuffer(buffer);
const workbook = xlsx.read(text, { type: 'string' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

let colIndex = { id: 4, name: 6, category: 1, unitPrice: 13, quantity: 18, amount: 19, amountWithTax: 20 };

const tempScans = [];
const products = [];
rows.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  let productCode = row[colIndex.id] ? String(row[colIndex.id]).trim() : '';
  const productName = row[colIndex.name] ? String(row[colIndex.name]).trim() : '';
  const category = row[colIndex.category] ? String(row[colIndex.category]).trim() : '99';
  if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(productName) || /(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(productCode) || /(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(category)) return;
  
  const sColValue = row[colIndex.quantity];
  if (sColValue === undefined || sColValue === null || String(sColValue).trim() === '') return;
  const quantity = parseInt(String(sColValue).replace(/[^0-9.-]/g, ''), 10);
  if (isNaN(quantity)) return;
  if (!productCode) {
    if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(productName)) return;
    productCode = `TEMP_${rowIndex}`;
  }

  const amountWithTaxRaw = row[colIndex.amountWithTax];
  const amountWithTax = parseFloat(String(amountWithTaxRaw || '0').replace(/[^0-9.-]/g, '')) || 0;
  
  const unitPriceRaw = row[colIndex.unitPrice];
  const unitPrice = parseFloat(String(unitPriceRaw || '0').replace(/[^0-9.-]/g, '')) || 0;

  products.push({ id: productCode, name: productName, category, price: unitPrice, isFixed: false });
  tempScans.push({ productId: productCode, quantity, amountWithTax, month: '2026-03' });
});

// simulate sum of duplicates like confirmInvTempData now does
const summedLogs = [];
const pids = new Set(tempScans.map(s => s.productId));
Array.from(pids).forEach((pid, idx) => {
  const pScans = tempScans.filter(s => s.productId === pid);
  let qty = 0;
  let amt = 0;
  pScans.forEach(s => { qty += s.quantity; amt += s.amountWithTax; });
  summedLogs.push({
    id: Date.now() + idx,
    productId: pid,
    quantity: qty,
    unitPrice: 0,
    type: 'count',
    worker: 'system',
    note: '棚卸確定締め(2026-03)',
    timestamp: new Date(2026, 3, 0, 23, 59, 59).toISOString(),
    amountWithTax: amt
  });
});

const mockDB = `
const DB = {
  KEYS: { INV_PRODUCTS: 'a', INV_LOGS: 'b', INV_MONTHLY: 'c', INV_SCAN_TEMP: 'd' },
  get: function(k) {
    if (k === 'a') return ${JSON.stringify(products)};
    if (k === 'b') return ${JSON.stringify(summedLogs)};
    if (k === 'c') return [];
    if (k === 'd') return ${JSON.stringify(tempScans)};
    return [];
  },
  getTempScans: function() { return ${JSON.stringify(tempScans)}; },
  save: function() {}
};
const window = { location: { search: '' } };
const document = { getElementById: () => null, addEventListener: () => {} };
function $(s) { return null; }
function toast() {}
const INV_CATEGORIES = {};
`;

const calcFuncMatch = appJs.match(/function calculateInvMonthly[\s\S]*?\n\}/);
let codeToRun = mockDB + '\n' + (calcFuncMatch ? calcFuncMatch[0] : '') + `
const res = calculateInvMonthly('2026-03', null);
console.log('March calculated total WITHOUT F1:', res.total);
`;
fs.writeFileSync('test_mar_calc_run.js', codeToRun);
