const fs = require('fs');
const xlsx = require('xlsx');

// 1. Mock DOM and global variables
const dom = {};
global.document = {
  getElementById: (id) => dom[id] || { value: '', textContent: '', style: {} }
};
global.$ = (sel) => {
  const id = sel.replace('#', '');
  if (!dom[id]) dom[id] = { value: '', textContent: '', style: {}, files: [] };
  return dom[id];
};
global.window = {};
global.toast = console.log;
global.alert = console.log;

// 2. Mock DB
let mockDB = {
  INV_PRODUCTS: [],
  INV_LOGS: [],
  INV_MONTHLY: [],
  INV_SCAN_TEMP: []
};

global.DB = {
  KEYS: {
    INV_PRODUCTS: 'INV_PRODUCTS',
    INV_LOGS: 'INV_LOGS',
    INV_MONTHLY: 'INV_MONTHLY',
    INV_SCAN_TEMP: 'INV_SCAN_TEMP'
  },
  get: (key) => JSON.parse(JSON.stringify(mockDB[key] || [])),
  save: (key, val) => { mockDB[key] = JSON.parse(JSON.stringify(val)); },
  getTempScans: () => JSON.parse(JSON.stringify(mockDB['INV_SCAN_TEMP'] || []))
};

// 3. Load app.js functions needed
const appJsCode = fs.readFileSync('app.js', 'utf8');
// Evaluate app.js in this context
// We need to bypass the immediate execution parts, so we extract functions
const evalCode = `
  let currentMonthlyResult = null;
  const INV_CATEGORIES = {};
  function safeNum(v) { return isNaN(Number(v)) ? 0 : Number(v); }
  ` + appJsCode.match(/function decodeCsvBuffer[\s\S]*?(?=function renderInvCheckPage)/)[0] + `
  ` + appJsCode.match(/function calculateInvMonthly[\s\S]*?(?=window.saveSingleTempScan)/)[0] + `
  ` + appJsCode.match(/function confirmInvTempData[\s\S]*?(?=function undoConfirmInvTempData)/)[0] + `
  ` + appJsCode.match(/function saveInvMonthlyClosing[\s\S]*?(?=function deleteInvMonthlyClosing)/)[0] + `
`;

eval(evalCode);

// 4. Set up the exact initial state (simulating a clean March import)
const bufferMar = fs.readFileSync('./inventory_data/【2課】2026年3月棚卸表.csv');
const textMar = decodeCsvBuffer(bufferMar);

// Simulate the logic of setupInvExcelImport (since we can't easily trigger the file input event)
// We will manually parse the Excel file using the EXACT logic in app.js
const workbook = xlsx.read(textMar, { type: 'string' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

// 5. Run setupInvExcelImport logic
let tempScans = DB.getTempScans() || [];
let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
const targetMonth = '2026-03';
tempScans = tempScans.filter(s => s.month !== targetMonth);

const summaryPattern = /(小計|合計|総計|資材計|資材分類計|分類合計|総合計|SUBTOTAL|TOTAL|【.*】)/i;

let f1AmountRaw = null;
if (sheet['F1']) {
  const val = String(sheet['F1'].w || sheet['F1'].v || '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(val);
  if (!isNaN(num)) {
    f1AmountRaw = num;
  }
}

if (f1AmountRaw !== null) {
  tempScans.push({
      id: 'META_F1_TOTAL',
      productId: 'META_F1_TOTAL',
      quantity: 0,
      amountWithTax: f1AmountRaw,
      worker: 'Excel一括取込',
      workerName: 'Excel取込',
      timestamp: new Date().toISOString(),
      month: targetMonth
  });
}

// simulate parsing items
let colIndex = { id: 4, name: 6, category: 9, quantity: 18, amount: 19, amountWithTax: 20, unitPrice: 13 };
let parsedItems = [];
rows.forEach((row, rowIndex) => {
  if (rowIndex < 1) return;
  const sColValue = row[colIndex.quantity];
  if (sColValue === undefined || sColValue === null || String(sColValue).trim() === '') return;
  const quantity = parseInt(String(sColValue).replace(/[^0-9.-]/g, ''), 10);
  if (isNaN(quantity)) return;
  
  let productCode = row[colIndex.id] ? String(row[colIndex.id]).trim() : '';
  const productName = row[colIndex.name] ? String(row[colIndex.name]).trim() : '';
  if (!productCode) {
    if (summaryPattern.test(productName)) return;
    productCode = `TEMP_${rowIndex}`;
  }
  if (summaryPattern.test(productCode) || summaryPattern.test(productName)) return;
  
  const category = row[colIndex.category] ? String(row[colIndex.category]).trim() : '99';
  const amountRaw = row[colIndex.amount];
  const amountWithTaxRaw = row[colIndex.amountWithTax];
  const amount = parseFloat(String(amountRaw || '0').replace(/[^0-9.-]/g, '')) || 0;
  const amountWithTax = parseFloat(String(amountWithTaxRaw || '0').replace(/[^0-9.-]/g, '')) || 0;
  
  const unitPriceRaw = row[colIndex.unitPrice];
  let unitPrice = parseFloat(String(unitPriceRaw || '0').replace(/[^0-9.-]/g, '')) || 0;
  if (unitPrice === 0 && quantity > 0 && amount > 0) {
    unitPrice = (amount / quantity);
  }
  
  let matchedProduct = products.find(p => p.id === productCode);
  let pData = matchedProduct ? { ...matchedProduct } : { id: productCode, name: productName, category, price: unitPrice };
  
  parsedItems.push({ product: pData, quantity, amountWithTax, amount });
});

parsedItems.forEach(item => {
  const pData = item.product;
  const existingIdx = products.findIndex(p => p.id === pData.id || (pData.name && p.name === pData.name));
  if (existingIdx >= 0) {
    products[existingIdx].price = pData.price;
    products[existingIdx].category = pData.category;
    if (pData.name) products[existingIdx].name = pData.name;
  } else {
    products.push({ ...pData, isFixed: false });
  }
});

// Create temp scans
const lastDay = new Date(2026, 3, 0, 23, 59, 59).toISOString();
parsedItems.forEach((item, index) => {
  const pData = item.product;
  const scanId = Date.now() + "_" + index + "_" + pData.id;
  tempScans.push({
    id: scanId,
    productId: pData.id,
    quantity: item.quantity,
    amountWithTax: item.amountWithTax,
    amount: item.amount,
    worker: 'admin',
    workerName: 'admin',
    timestamp: lastDay,
    month: targetMonth,
    type: 'count_temp'
  });
});

DB.save(DB.KEYS.INV_SCAN_TEMP, tempScans);
DB.save(DB.KEYS.INV_PRODUCTS, products);

// 6. Run Confirm
dom['inv-check-month'] = { value: '2026-03' };
confirmInvTempData('2026-03', true, true);

// 7. Check the result!
const monthly = DB.get(DB.KEYS.INV_MONTHLY);
console.log("FINAL MONTHLY DATA SAVED TO DB:");
console.log(JSON.stringify(monthly, null, 2));
