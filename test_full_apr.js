const fs = require('fs');
const xlsx = require('xlsx');
let appJs = fs.readFileSync('app.js', 'utf8');

function decodeCsvBuffer(uint8Array) {
  const enc = new TextDecoder('utf-8').decode(uint8Array);
  if (enc.indexOf('\uFFFD') === -1) return enc;
  return new TextDecoder('shift-jis').decode(uint8Array);
}

const dir = './inventory_data';
const file = dir + '/【2課】2026年4月棚卸表.csv';
const buffer = fs.readFileSync(file);
const text = decodeCsvBuffer(buffer);
const workbook = xlsx.read(text, { type: 'string' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

let colIndex = { id: 4, name: 6, category: 1, unitPrice: 13, quantity: 18, amount: 19, amountWithTax: 20 };
// Dynamically find it just like app.js
for (let r = 0; r < Math.min(10, rows.length); r++) {
  const rowStr = rows[r].map(c => String(c || '').trim()).join('|');
  if ((rowStr.includes('数量') || rowStr.includes('実棚')) && (rowStr.includes('識別コード') || rowStr.includes('資材コード') || rowStr.includes('単価') || rowStr.includes('品名'))) {
    rows[r].forEach((cellVal, cIdx) => {
      const val = String(cellVal || '').trim();
      if (/^(資材ID|品番|識別コード|商品コード|コード|資材コード)$/i.test(val)) colIndex.id = cIdx;
      else if (/^(品名|資材名|商品名)$/i.test(val)) colIndex.name = cIdx;
      else if (/^(資材分類|分類|カテゴリ)$/i.test(val)) colIndex.category = cIdx;
      else if (/^(単価|購入単価)$/i.test(val)) colIndex.unitPrice = cIdx;
      else if (/^(棚卸数量|実棚数量|実存数|数量|数量合計の合計|数量合計)$/i.test(val)) colIndex.quantity = cIdx;
      else if (/^(金額|在庫金額|金額\(税抜\)|金額（税抜）|合計金額の合計|合計金額)$/i.test(val)) colIndex.amount = cIdx;
      else if (/^(金額\(税込\)|金額（税込）|税込金額|合計金額\(1%増し\)|合計金額（1%増し）)$/i.test(val)) colIndex.amountWithTax = cIdx;
    });
    break;
  }
}

let f1AmountRaw = null;
if (sheet['F1']) {
  const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[,¥\s\\]/g, '');
  const num = parseFloat(val);
  if (!isNaN(num)) f1AmountRaw = num;
}

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
  const quantity = parseInt(String(sColValue).replace(/[,¥\s\\]/g, ''), 10);
  if (isNaN(quantity)) return;
  if (!productCode) {
    if (/(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i.test(productName)) return;
    productCode = `TEMP_${rowIndex}`;
  }

  const amountWithTaxRaw = row[colIndex.amountWithTax];
  const amountWithTax = parseFloat(String(amountWithTaxRaw || '0').replace(/[,¥\s\\]/g, '')) || 0;
  
  const unitPriceRaw = row[colIndex.unitPrice];
  const unitPrice = parseFloat(String(unitPriceRaw || '0').replace(/[,¥\s\\]/g, '')) || 0;

  products.push({ id: productCode, name: productName, category, price: unitPrice, isFixed: false });
  tempScans.push({ productId: productCode, quantity, amountWithTax, month: '2026-04' });
});

if (f1AmountRaw !== null) {
  tempScans.push({ productId: 'META_F1_TOTAL', amountWithTax: f1AmountRaw, month: '2026-04' });
}

const mockDB = `
const DB = {
  KEYS: { INV_PRODUCTS: 'a', INV_LOGS: 'b', INV_MONTHLY: 'c', INV_SCAN_TEMP: 'd' },
  get: function(k) {
    if (k === 'a') return ${JSON.stringify(products)};
    if (k === 'b') return [];
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
const res = calculateInvMonthly('2026-04', ${f1AmountRaw});
console.log('Result total:', res.total);
console.log('Adjustment:', res.summary['adjustment']);
`;
fs.writeFileSync('test_apr_calc.js', codeToRun);
