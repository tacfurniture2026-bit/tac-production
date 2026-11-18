const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function createMockEnv(htmlPath, jsPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Assert HTML contains the new admin menu items and page container
  assert(html.includes('data-page="pao-analytics"'), `${htmlPath} should contain data-page="pao-analytics"`);
  assert(html.includes('id="page-pao-analytics"'), `${htmlPath} should contain #page-pao-analytics`);
  assert(html.includes('exportPaoAnalyticsExcel()'), `${htmlPath} should contain exportPaoAnalyticsExcel()`);
  assert(html.includes('printPaoAnalyticsPdf()'), `${htmlPath} should contain printPaoAnalyticsPdf()`);

  const elements = {};
  const makeEl = (id, initVal = '') => ({
    id,
    value: initVal,
    innerHTML: '',
    textContent: '',
    style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._set.has(c)) this._set.delete(c); else this._set.add(c);
        } else if (force) {
          this._set.add(c);
        } else {
          this._set.delete(c);
        }
      },
      contains(c) { return this._set.has(c); }
    },
    setAttribute(k, v) { this[k] = v; },
    querySelectorAll() { return []; },
    cloneNode() {
      return {
        innerHTML: this.innerHTML,
        querySelectorAll() { return []; }
      };
    }
  });

  elements['pao-filter-year'] = makeEl('pao-filter-year', 'all');
  elements['pao-filter-year-type'] = makeEl('pao-filter-year-type', 'calendar');
  elements['pao-filter-month'] = makeEl('pao-filter-month', 'all');
  elements['pao-filter-date-basis'] = makeEl('pao-filter-date-basis', 'dueDate');
  elements['pao-filter-status'] = makeEl('pao-filter-status', 'all');
  elements['pao-filter-scope'] = makeEl('pao-filter-scope', 'pao_strict');
  elements['pao-analytics-content'] = makeEl('pao-analytics-content', '');
  elements['pao-report-print-area'] = makeEl('pao-report-print-area', '');
  elements['page-pao-analytics'] = makeEl('page-pao-analytics', '');

  const storage = {};
  const sessionStore = {};
  const writtenExcelFiles = [];
  let openedUrls = [];

  const mockOrders = [
    { id: 'ORD-1', projectName: '東京A案件', productName: 'PAO1012BL-F', quantity: 4, color: 'オーク(OK)', startDate: '2026-01-10', dueDate: '2026-01-25' },
    { id: 'ORD-2', projectName: '大阪B案件', productName: 'PAO1012SR-F', quantity: 6, color: 'ウォールナット(WN)', startDate: '2026-02-05', dueDate: '2026-02-18' },
    { id: 'ORD-3', projectName: '名古屋C案件', productName: 'PAO1218BL-F', quantity: 3, color: 'オーク(OK)', startDate: '2026-02-12', dueDate: '2026-02-27' },
    { id: 'ORD-4', projectName: '福岡D案件', productName: 'PAO1618-4SR-F', quantity: 2, color: 'ホワイト(WH)', startDate: '2026-03-01', dueDate: '2026-03-20' },
    { id: 'ORD-5', projectName: '札幌E案件', productName: 'PAOBABY1318', quantity: 5, color: 'オーク(OK)', startDate: '2025-11-10', dueDate: '2025-11-28' },
    { id: 'ORD-6', projectName: '仙台F案件', productName: 'SEMI1218S', quantity: 7, color: 'グレー(GR)', startDate: '2026-03-05', dueDate: '2026-03-25' },
    { id: 'ORD-7', projectName: '非PAO案件', productName: 'OTHER-DESK-999', quantity: 10, color: 'ブラック', startDate: '2026-01-10', dueDate: '2026-01-20' }
  ];

  const mockBom = [
    { productName: 'PAO1012BL-F', category: 'PAO', items: [{ name: 'パネル', processes: ['NC'] }] },
    { productName: 'PAO1012SR-F', category: 'PAO', items: [{ name: 'パネル', processes: ['NC'] }] },
    { productName: 'PAO1218BL-F', category: 'PAO', items: [{ name: 'パネル', processes: ['NC'] }] },
    { productName: 'PAO1618-4SR-F', category: 'PAO', items: [{ name: 'パネル', processes: ['NC'] }] },
    { productName: 'PAOBABY1318', category: 'PAO', items: [{ name: 'パネル', processes: ['NC'] }] },
    { productName: 'SEMI1218S', category: 'PAO', items: [{ name: 'パネル', processes: ['NC'] }] },
    { productName: 'OTHER-DESK-999', category: 'OTHER', items: [{ name: '天板', processes: ['NC'] }] }
  ];

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => {},
    clearInterval: () => {},
    Date,
    Math,
    JSON,
    Map,
    Set,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    encodeURIComponent,
    decodeURIComponent,
    NEW_BOM_DATA: mockBom,
    DB: {
      KEYS: {
        ORDERS: 'pms_orders',
        BOM: 'pms_bom',
        PROCESSES: 'pms_processes',
        USERS: 'pms_users',
        RATES: 'pms_rates',
        DEFECTS: 'pms_defects',
        INV_PRODUCTS: 'pms_inv_products',
        INV_LOGS: 'pms_inv_logs'
      },
      _loaded: {},
      init() {},
      get(key) {
        if (key === 'pms_orders') return mockOrders;
        if (key === 'pms_bom') return mockBom;
        return [];
      },
      save() {}
    },
    XLSX: {
      utils: {
        book_new() { return { SheetNames: [], Sheets: {} }; },
        aoa_to_sheet(rows) { return { _rows: rows }; },
        book_append_sheet(wb, ws, name) { wb.SheetNames.push(name); wb.Sheets[name] = ws; }
      },
      writeFile(wb, filename) {
        writtenExcelFiles.push({ wb, filename });
      }
    },
    localStorage: {
      getItem(k) { return storage[k] || null; },
      setItem(k, v) { storage[k] = String(v); },
      removeItem(k) { delete storage[k]; }
    },
    sessionStorage: {
      getItem(k) { return sessionStore[k] || null; },
      setItem(k, v) { sessionStore[k] = String(v); }
    },
    location: { reload() {}, search: '?v=v6.77.0', protocol: 'https:', host: 'localhost', pathname: '/', hash: '' },
    navigator: { maxTouchPoints: 0, serviceWorker: { getRegistrations: async () => [] } },
    screen: { orientation: { unlock() {}, lock: async () => {} } },
    document: {
      body: makeEl('body'),
      activeElement: null,
      getElementById(id) {
        if (id === 'pao-report-print-area' && elements['pao-analytics-content'].innerHTML.includes('id="pao-report-print-area"')) {
          elements['pao-report-print-area'].innerHTML = elements['pao-analytics-content'].innerHTML;
          return elements['pao-report-print-area'];
        }
        return elements[id] || null;
      },
      querySelector(sel) {
        if (sel.startsWith('#')) return this.getElementById(sel.slice(1));
        return makeEl(sel);
      },
      querySelectorAll() { return []; },
      addEventListener() {},
      createElement(tag) { return makeEl(tag); }
    },
    window: null
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.window.removeEventListener = () => {};
  sandbox.window.open = (url) => { openedUrls.push(url); return {}; };
  sandbox.window.print = () => {};

  const jsCode = fs.readFileSync(jsPath, 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(jsCode, sandbox);

  // Override DB.get and calculateOrderProgress for deterministic testing
  sandbox.DB.get = (key) => {
    if (key === sandbox.DB.KEYS.ORDERS) return mockOrders;
    if (key === sandbox.DB.KEYS.BOM) return mockBom;
    return [];
  };
  sandbox.calculateOrderProgress = (orderId) => {
    // ORD-1 (4 units) & ORD-2 (6 units) & ORD-5 (5 units) are 100% complete; ORD-3 (3 units) & ORD-4 (2 units) are 50%
    if (['ORD-1', 'ORD-2', 'ORD-5'].includes(orderId)) return 100;
    return 50;
  };
  sandbox.toast = () => {};

  return { sandbox, elements, sessionStore, writtenExcelFiles, openedUrls };
}

function runVerificationSuite(label, htmlPath, jsPath) {
  console.log(`\n=== Verifying ${label} ===`);
  const { sandbox, elements, sessionStore, writtenExcelFiles, openedUrls } = createMockEnv(htmlPath, jsPath);

  // Test 1: Default All-period strict PAO aggregation
  sandbox.renderPaoAnalyticsPage();
  const dataAll = sandbox._lastPaoAnalyticsData;
  assert(dataAll, 'dataAll should be computed');
  // Strict PAO includes ORD-1 (4), ORD-2 (6), ORD-3 (3), ORD-4 (2), ORD-5 (5) = 20 units across 5 orders
  assert.strictEqual(dataAll.totalQty, 20, `Expected totalQty=20 in strict PAO mode, got ${dataAll.totalQty}`);
  assert.strictEqual(dataAll.completeQty, 15, `Expected completeQty=15, got ${dataAll.completeQty}`);
  assert.strictEqual(dataAll.incompleteQty, 5, `Expected incompleteQty=5, got ${dataAll.incompleteQty}`);
  assert.strictEqual(dataAll.totalOrders, 5, `Expected totalOrders=5, got ${dataAll.totalOrders}`);

  // Size ranking check: 1012 has ORD-1 (4) + ORD-2 (6) = 10 units (50.0% share, #1)
  assert.strictEqual(dataAll.sizeStatsByQty[0].key, '1012', 'Top size should be 1012');
  assert.strictEqual(dataAll.sizeStatsByQty[0].qty, 10, '1012 qty should be 10');
  assert.strictEqual(dataAll.sizeStatsByQty[0].share, 50, '1012 share should be 50%');

  // Color ranking check: オーク(OK) has ORD-1 (4) + ORD-3 (3) + ORD-5 (5) = 12 units (60.0% share, #1)
  assert.strictEqual(dataAll.colorStats[0].color, 'オーク(OK)', 'Top color should be オーク(OK)');
  assert.strictEqual(dataAll.colorStats[0].qty, 12, 'オーク(OK) qty should be 12');
  assert.strictEqual(dataAll.colorStats[0].share, 60, 'オーク(OK) share should be 60%');

  // Cross-tabulation check: 1012 x オーク(OK) = 4, 1012 x ウォールナット(WN) = 6
  assert.strictEqual(dataAll.crossMap.get('1012__オーク(OK)'), 4, 'Cross 1012 x オーク(OK) should be 4');
  assert.strictEqual(dataAll.crossMap.get('1012__ウォールナット(WN)'), 6, 'Cross 1012 x ウォールナット(WN) should be 6');

  // Test 2: Year filter (2026 Calendar Year)
  sandbox.setPaoQuickYearFilter('2026');
  const data2026 = sandbox._lastPaoAnalyticsData;
  // In 2026: ORD-1 (4), ORD-2 (6), ORD-3 (3), ORD-4 (2) => 15 units
  assert.strictEqual(data2026.totalQty, 15, `Expected 2026 totalQty=15, got ${data2026.totalQty}`);
  assert.strictEqual(data2026.monthlyTotals[1], 4, 'Jan 2026 should have 4 units');
  assert.strictEqual(data2026.monthlyTotals[2], 9, 'Feb 2026 should have 9 units');
  assert.strictEqual(data2026.monthlyTotals[3], 2, 'Mar 2026 should have 2 units');

  // Test 3: Fiscal Year (会計年度 4月〜翌3月)
  // In Fiscal Year 2025 (2025-04 to 2026-03): all 5 orders (2025-11 and 2026-01/02/03) belong to FY2025!
  elements['pao-filter-year-type'].value = 'fiscal';
  sandbox.setPaoQuickYearFilter('2025');
  const dataFy2025 = sandbox._lastPaoAnalyticsData;
  assert.strictEqual(dataFy2025.totalQty, 20, `Expected FY2025 totalQty=20, got ${dataFy2025.totalQty}`);
  assert.strictEqual(JSON.stringify(dataFy2025.monthOrder), JSON.stringify([4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]), 'Fiscal year month order should start at April');

  // Test 4: Category scope (include SEMI1218S which is in BOM category "PAO")
  elements['pao-filter-year-type'].value = 'calendar';
  sandbox.setPaoQuickYearFilter('all');
  elements['pao-filter-scope'].value = 'pao_category';
  sandbox.renderPaoAnalyticsPage();
  const dataCategory = sandbox._lastPaoAnalyticsData;
  assert.strictEqual(dataCategory.totalQty, 27, `Expected pao_category totalQty=27 (including SEMI1218S 7 units), got ${dataCategory.totalQty}`);

  // Test 5: Excel (.xlsx) export
  elements['pao-filter-scope'].value = 'pao_strict';
  sandbox.exportPaoAnalyticsExcel();
  assert.strictEqual(writtenExcelFiles.length, 1, 'Excel file should be written');
  const { wb, filename } = writtenExcelFiles[0];
  assert(filename.startsWith('PAO生産_サイズ_色柄トレンド分析_'), `Unexpected Excel filename: ${filename}`);
  assert.strictEqual(JSON.stringify(wb.SheetNames), JSON.stringify([
    '1_年度別・月別生産数',
    '2_サイズ別生産数',
    '3_色柄トレンド集計',
    '4_サイズ×色柄クロス表',
    '5_品番別・案件明細'
  ]), 'Excel workbook should contain all 5 analytical sheets');

  // Test 6: PDF / Print output
  sandbox.printPaoAnalyticsPdf();
  assert.strictEqual(openedUrls[0], 'print_report.html', 'PDF export should open print_report.html');
  const savedPayload = JSON.parse(sessionStore['print_report_data']);
  assert(savedPayload.title.includes('PAO 生産数量・サイズ・色柄トレンド分析報告書'), 'PDF payload title should be set');
  assert(savedPayload.html.includes('PAO1012BL-F'), 'PDF payload HTML should include detailed model breakdown');

  // Test 7: navigateTo('pao-analytics') sets allow-landscape on body
  sandbox.navigateTo('pao-analytics');
  assert(sandbox.document.body.classList.contains('allow-landscape'), 'navigateTo("pao-analytics") should enable allow-landscape');

  console.log(`✅ All assertions passed for ${label}!`);
}

const path = require('path');
const rootDir = path.resolve(__dirname, '..');

runVerificationSuite(
  'PC (index.html + app.js)',
  path.join(rootDir, 'index.html'),
  path.join(rootDir, 'app.js')
);

runVerificationSuite(
  'Mobile (mobile_source.html + app-mobile.js)',
  path.join(rootDir, 'mobile_source.html'),
  path.join(rootDir, 'app-mobile.js')
);

const mobileBuiltHtml = fs.readFileSync(path.join(rootDir, 'mobile.html'), 'utf8');
assert(mobileBuiltHtml.includes('v6.80.0'), 'mobile.html should be updated to v6.80.0');
assert(mobileBuiltHtml.includes('renderPaoAnalyticsPage'), 'mobile.html should contain inlined renderPaoAnalyticsPage');
assert(mobileBuiltHtml.includes('exportPaoAnalyticsExcel'), 'mobile.html should contain inlined exportPaoAnalyticsExcel');
assert(mobileBuiltHtml.includes('printPaoAnalyticsPdf'), 'mobile.html should contain inlined printPaoAnalyticsPdf');
console.log('✅ Built mobile.html integrity check passed!');
