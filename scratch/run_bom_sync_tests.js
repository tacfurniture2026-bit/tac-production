const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting Fukasawa-style Automated Validation for BOM Sync...');

// 1. Mock Browser Environment
const mockLocalStorage = {};
global.localStorage = {
  getItem: (key) => mockLocalStorage[key] || null,
  setItem: (key, val) => { mockLocalStorage[key] = String(val); },
  removeItem: (key) => { delete mockLocalStorage[key]; },
  clear: () => { for (let k in mockLocalStorage) delete mockLocalStorage[k]; }
};

// Global mock form values storage
global.mockFormValues = {};

global.window = {};
const classListMock = {
  add: () => {},
  remove: () => {},
  contains: () => false
};

const domElementMock = (id = '') => {
  const el = {
    id: id,
    className: '',
    innerHTML: '',
    value: '',
    dataset: {},
    style: {},
    classList: classListMock,
    appendChild: () => {},
    removeChild: () => {},
    addEventListener: () => {},
    remove: () => {},
    querySelector: (sel) => domElementMock(sel),
    querySelectorAll: () => []
  };
  return el;
};

global.document = {
  body: domElementMock('body'),
  createElement: (tag) => domElementMock(tag),
  getElementById: (id) => domElementMock(id),
  querySelectorAll: () => [],
  querySelector: (selector) => {
    const el = domElementMock(selector);
    el.value = global.mockFormValues[selector] || '';
    return el;
  }
};
global.$ = (selector) => global.document.querySelector(selector);
global.toast = (msg, type) => {
  console.log(`[ToastMock] ${type.toUpperCase()}: ${msg}`);
};
global.hideModal = () => {
  console.log('[ModalMock] Closed');
};
global.renderBom = () => {};
global.renderGantt = () => {};

// 2. Load and Evaluate data.js and app.js
const dataJsPath = path.join(__dirname, '../data.js');
let dataJsContent = fs.readFileSync(dataJsPath, 'utf8');

const appJsPath = path.join(__dirname, '../app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// We need to evaluate app.js, but since it has some IIFE or top-level browser executions,
// let's isolate the specific functions or mock the initialization to prevent crash.
// Let's replace top-level event listeners or function calls that might crash on Node.
// In app.js, things like document.addEventListener('DOMContentLoaded', ...) will run.
// Let's mock document.addEventListener.
global.document.addEventListener = (event, callback) => {
  console.log(`[EventMock] Registered listener for: ${event}`);
};

try {
  // Replace top-level const definitions in data.js with global variables
  dataJsContent = dataJsContent.replace('const DB =', 'global.DB =');
  dataJsContent = dataJsContent.replace('const STANDARD_PROCESSES =', 'global.STANDARD_PROCESSES =');
  dataJsContent = dataJsContent.replace('const NEW_BOM_DATA =', 'global.NEW_BOM_DATA =');

  // Execute data.js and app.js in global context
  eval(dataJsContent);
  console.log('✅ data.js successfully loaded.');
  eval(appJsContent);
  console.log('✅ app.js successfully loaded in Node.js mock environment.');

  // Re-apply mocks that app.js might have overwritten
  global.toast = (msg, type) => {
    console.log(`[ToastMock] ${type.toUpperCase()}: ${msg}`);
  };
  global.hideModal = () => {
    console.log('[ModalMock] Closed');
  };
  global.renderBom = () => {};
  global.renderGantt = () => {};
} catch (e) {
  console.error('❌ Failed to load files in mock environment:', e);
  process.exit(1);
}

// 3. Test Cases
try {
  // Test Case 1: syncOrdersWithUpdatedBom
  console.log('\n--- Test Case 1: syncOrdersWithUpdatedBom ---');
  const initialOrders = [
    {
      id: 101,
      productName: 'Product-X',
      items: [
        { bomName: 'Panel-A', partCode: 'OLD-CODE-1' },
        { bomName: 'Panel-B', partCode: 'OLD-CODE-2' }
      ]
    },
    {
      id: 102,
      productName: 'Product-Y',
      items: [
        { bomName: 'Panel-A', partCode: 'OLD-CODE-1' } // Different product name, shouldn't change
      ]
    }
  ];

  DB.save(DB.KEYS.ORDERS, initialOrders);

  // Trigger sync: Product-X, Panel-A: OLD-CODE-1 -> NEW-CODE-99
  syncOrdersWithUpdatedBom('Product-X', 'Panel-A', 'Product-X', 'Panel-A', 'NEW-CODE-99');

  const updatedOrders = DB.get(DB.KEYS.ORDERS);
  
  // Assertions for Test Case 1
  assert.strictEqual(updatedOrders[0].items[0].partCode, 'NEW-CODE-99', 'Product-X Panel-A partCode should be updated to NEW-CODE-99');
  assert.strictEqual(updatedOrders[0].items[1].partCode, 'OLD-CODE-2', 'Product-X Panel-B partCode should remain unchanged');
  assert.strictEqual(updatedOrders[1].items[0].partCode, 'OLD-CODE-1', 'Product-Y Panel-A partCode should remain unchanged because of different product name');
  console.log('✅ Test Case 1 passed: syncOrdersWithUpdatedBom synchronized correctly.');

  // Test Case 2: updateBom with relaxed GRID logic and order sync
  console.log('\n--- Test Case 2: updateBom with GRID category rules and order sync ---');
  // Mock form values
  global.mockFormValues = {
    '#edit-bom-id': '10',
    '#edit-bom-category': 'GRID',
    '#edit-bom-product': 'GridProduct',
    '#edit-bom-name': 'GridBom',
    '#edit-bom-code': 'CUSTOM-GRID-CODE', // custom, shouldn't be overwritten
    '#edit-bom-processes': 'ProcessA, ProcessB'
  };

  const initialBoms = [
    {
      id: 10,
      category: 'GRID',
      productName: 'GridProduct',
      bomName: 'GridBom',
      partCode: 'OLD-GRID-CODE',
      processes: ['ProcessA'],
      processTimes: {}
    }
  ];
  DB.save(DB.KEYS.BOM, initialBoms);

  const testOrders = [
    {
      id: 201,
      productName: 'GridProduct',
      items: [
        { bomName: 'GridBom', partCode: 'OLD-GRID-CODE' }
      ]
    }
  ];
  DB.save(DB.KEYS.ORDERS, testOrders);

  // Call updateBom
  updateBom();

  const finalBoms = DB.get(DB.KEYS.BOM);
  const finalOrders = DB.get(DB.KEYS.ORDERS);

  assert.strictEqual(finalBoms[0].partCode, 'CUSTOM-GRID-CODE', 'GRID category custom partCode should be preserved');
  assert.strictEqual(finalOrders[0].items[0].partCode, 'CUSTOM-GRID-CODE', 'Orders should sync with the updated custom partCode');
  console.log('✅ Test Case 2.1 (Custom GRID code preserved & synced) passed.');

  // Test Case 2.2: GRID category with empty code
  console.log('\n--- Test Case 2.2: GRID category with empty code ---');
  mockFormValues['#edit-bom-code'] = ''; // Empty code, should be auto-filled with productName
  updateBom();

  const finalBomsEmpty = DB.get(DB.KEYS.BOM);
  assert.strictEqual(finalBomsEmpty[0].partCode, 'GridProduct', 'GRID category empty partCode should fall back to productName');
  console.log('✅ Test Case 2.2 (GRID empty code fallback) passed.');

  // Test Case 3: CSV Import template duplicates and update sync
  console.log('\n--- Test Case 3: CSV Import template duplicates and sync ---');
  
  // Set up existing BOM
  const preImportBoms = [
    {
      id: 1,
      category: 'PAO',
      productName: 'PaoProduct',
      bomName: 'PaoBom',
      partCode: 'PAO-OLD-CODE',
      processes: ['Proc1'],
      processTimes: {}
    }
  ];
  DB.save(DB.KEYS.BOM, preImportBoms);

  const preImportOrders = [
    {
      id: 301,
      productName: 'PaoProduct',
      items: [
        { bomName: 'PaoBom', partCode: 'PAO-OLD-CODE' }
      ]
    }
  ];
  DB.save(DB.KEYS.ORDERS, preImportOrders);

  // Simulate CSV import for template format (category, productName, bomName, partCode, ...processes)
  // CSV text:
  // カテゴリ,製品名,BOM名,部材CD,Proc1,Proc2
  // PAO,PaoProduct,PaoBom,PAO-NEW-CODE,1,1
  const csvText = 'カテゴリ,製品名,BOM名,部材CD,Proc1,Proc2\nPAO,PaoProduct,PaoBom,PAO-NEW-CODE,1,1';

  // We mock processBomCsv's internal check. But we want to call processBomCsv(csvText).
  // In app.js, processBomCsv is parsed, let's call it.
  processBomCsv(csvText);

  const postImportBoms = DB.get(DB.KEYS.BOM);
  const postImportOrders = DB.get(DB.KEYS.ORDERS);

  assert.strictEqual(postImportBoms.length, 1, 'BOM length should still be 1 (deduplicated)');
  assert.strictEqual(postImportBoms[0].partCode, 'PAO-NEW-CODE', 'BOM partCode should be updated');
  assert.deepStrictEqual(postImportBoms[0].processes, ['Proc1', 'Proc2'], 'BOM processes should be updated');
  assert.strictEqual(postImportOrders[0].items[0].partCode, 'PAO-NEW-CODE', 'Orders should sync with imported new code');
  console.log('✅ Test Case 3 passed: CSV import duplicates prevented and changes synced.');

  // Test Case 4: Omittable partCode in Locker/Grid during CSV Import
  console.log('\n--- Test Case 4: Omittable partCode in Locker/Grid during CSV Import ---');
  
  // 4.1. GRIDカテゴリ: 部材CD省略（4列目が数値時間）
  const gridCsv = 'カテゴリ,製品名,BOM名,部材CD,工程A,工程B\nGRID,GridP,GridB,5,10,20';
  DB.save(DB.KEYS.BOM, []); // 初期化
  processBomCsv(gridCsv);
  const gridResult = DB.get(DB.KEYS.BOM);
  assert.strictEqual(gridResult.length, 1);
  assert.strictEqual(gridResult[0].partCode, 'GridP', 'GRID partCode should be productName when omitted');
  assert.deepStrictEqual(gridResult[0].processes, ['工程A', '工程B'], 'GRID processes should be correct');
  assert.strictEqual(gridResult[0].processTimes['工程A'], 5, 'GRID process A time should be 5');
  assert.strictEqual(gridResult[0].processTimes['工程B'], 10, 'GRID process B time should be 10');
  console.log('✅ Test Case 4.1 (GRID PartCode Omitted) passed.');

  // 4.2. パーソナルロッカーカテゴリ: 部材CD省略（4列目が分付き時間）
  const lockerCsv = 'カテゴリ,製品名,BOM名,部材CD,工程A,工程B\nパーソナルロッカー,LockerP,LockerB,5分,10分,20分';
  DB.save(DB.KEYS.BOM, []); // 初期化
  processBomCsv(lockerCsv);
  const lockerResult = DB.get(DB.KEYS.BOM);
  assert.strictEqual(lockerResult.length, 1);
  assert.strictEqual(lockerResult[0].partCode, 'LockerB', 'Locker partCode should be bomName when omitted');
  assert.deepStrictEqual(lockerResult[0].processes, ['工程A', '工程B'], 'Locker processes should be correct');
  assert.strictEqual(lockerResult[0].processTimes['工程A'], 5, 'Locker process A time should be 5');
  assert.strictEqual(lockerResult[0].processTimes['工程B'], 10, 'Locker process B time should be 10');
  console.log('✅ Test Case 4.2 (Locker PartCode Omitted) passed.');

  // 4.3. フリージョイントロッカーカテゴリ: 部材CDあり（4列目が非時間値）
  const lockerWithCdCsv = 'カテゴリ,製品名,BOM名,部材CD,工程A,工程B\nフリージョイントロッカー,FJProd,FJBom,FJCD,10,20';
  DB.save(DB.KEYS.BOM, []); // 初期化
  processBomCsv(lockerWithCdCsv);
  const lockerWithCdResult = DB.get(DB.KEYS.BOM);
  assert.strictEqual(lockerWithCdResult.length, 1);
  assert.strictEqual(lockerWithCdResult[0].partCode, 'FJCD', 'Locker partCode should be FJCD when provided');
  assert.deepStrictEqual(lockerWithCdResult[0].processes, ['工程A', '工程B'], 'Locker processes should be correct');
  assert.strictEqual(lockerWithCdResult[0].processTimes['工程A'], 10, 'Locker process A time should be 10');
  assert.strictEqual(lockerWithCdResult[0].processTimes['工程B'], 20, 'Locker process B time should be 20');
  console.log('✅ Test Case 4.3 (Locker PartCode Provided) passed.');

  console.log('\n🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);

} catch (err) {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
}
