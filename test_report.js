const fs = require('fs');

// Mock DOM
const domElements = {};
const $ = (selector) => {
  if (!domElements[selector]) {
    domElements[selector] = { value: '', innerHTML: '', addEventListener: () => {} };
  }
  return domElements[selector];
};
global.$ = $;
global.$$ = () => [];
global.toast = console.log;
global.formatDate = (d) => d;
global.calculateProgress = () => 100;
global.navigator = { userAgent: 'node' };

const fileContent = fs.readFileSync('app.js', 'utf8');

// evaluate everything up to just the functions
try {
  eval(fileContent);
} catch (e) {
  // It will throw on window.location etc, but let's just extract renderReport
}

// Just mock DB
global.DB = {
  KEYS: { ORDERS: 'o', RATES: 'r', BOM: 'b', DEFECTS: 'd', INV_PRODUCTS: 'ip', INV_LOGS: 'il', INV_MONTHLY: 'im' },
  get: (key) => {
    if (key === 'o') return [{ id:1, productName: 'TEST', dueDate: '2026/04/15', quantity: 1, items: [] }];
    if (key === 'r') return [{ minuteRate: 50, subsection: '加工係' }];
    if (key === 'b') return [];
    if (key === 'd') return [];
    if (key === 'ip') return [];
    if (key === 'il') return [];
    if (key === 'im') return [];
    return [];
  }
};

// set inputs
$('#report-start-date').value = '2026-04-01';
$('#report-end-date').value = '2026-04-30';

// We just copy renderReport code
function renderReport() {
  const startDate = $('#report-start-date').value;
  const endDate = $('#report-end-date').value;

  const orders = DB.get(DB.KEYS.ORDERS);
  const rates = DB.get(DB.KEYS.RATES);
  const boms = DB.get(DB.KEYS.BOM);
  const defects = DB.get(DB.KEYS.DEFECTS) || [];

  let filteredOrders = orders.filter(o => calculateProgress(o) === 100);

  const normDate = (d) => d ? d.replace(/\//g, '-') : '';

  if (startDate) {
    filteredOrders = filteredOrders.filter(o => normDate(o.dueDate) >= normDate(startDate));
  }
  if (endDate) {
    filteredOrders = filteredOrders.filter(o => normDate(o.dueDate) <= normDate(endDate));
  }

  let filteredDefects = [];
  if (startDate || endDate) {
    filteredDefects = defects.filter(d => {
      const dDate = (d.createdAt || d.date || '').substring(0, 10);
      let matchStart = true;
      let matchEnd = true;
      if (startDate) matchStart = dDate >= startDate;
      if (endDate) matchEnd = dDate <= endDate;
      return matchStart && matchEnd;
    });
  } else {
    filteredDefects = defects;
  }

  const totalDefects = filteredDefects.length;

  const defectReasons = {};
  let totalDefectQty = 0;
  filteredDefects.forEach(d => {
    const r = d.reason || 'その他';
    const qty = parseInt(d.quantity) || 1;
    defectReasons[r] = (defectReasons[r] || 0) + qty;
    totalDefectQty += qty;
  });

  let totalQuantity = 0;
  let totalCost = 0;
  let totalTime = 0;
  let departmentCosts = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };
  let departmentTimes = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };

  const rateMap = {};
  rates.forEach(r => {
    rateMap[r.subsection || r.section || r.department] = parseFloat(r.minuteRate) || 0;
  });

  const processToDept = {
    '芯材カット': '基材係',
    '面材カット': '基材係',
    '芯組': '基材係',
    'フラッシュ': '基材係',
    'ランニングソー': '加工係',
    'エッヂバンダー': '加工係',
    'TOYO': '加工係',
    'HOMAG': '加工係',
    '仕上・梱包': '梱包仕上係',
    'フロア加工': '加工係',
    'アクリルBOX作成': '基材係',
    '扉面材くり抜き': '加工係'
  };

  const detailRows = filteredOrders.map(order => {
    totalQuantity += order.quantity;
    const productBoms = boms.filter(b => b.productName === order.productName);

    let orderTime = 0;
    let orderCost = 0;
    let orderDeptTimes = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };
    let orderDeptCosts = { '基材係': 0, '加工係': 0, '梱包仕上係': 0 };

    productBoms.forEach(bom => {
      if (bom.processTimes) {
        Object.entries(bom.processTimes).forEach(([process, time]) => {
          const dept = processToDept[process] || '加工係';
          const deptRate = rateMap[dept] || 50; 
          const totalTimeForProcess = time * order.quantity;
          const costForProcess = totalTimeForProcess * deptRate;

          orderTime += totalTimeForProcess;
          orderCost += costForProcess;
          orderDeptTimes[dept] = (orderDeptTimes[dept] || 0) + totalTimeForProcess;
          orderDeptCosts[dept] = (orderDeptCosts[dept] || 0) + costForProcess;
        });
      }
    });

    if (orderTime === 0) {
      orderTime = 60 * order.quantity;
      orderCost = 25000 * order.quantity;
      orderDeptCosts = { '基材係': orderCost * 0.4, '加工係': orderCost * 0.45, '梱包仕上係': orderCost * 0.15 };
    }

    totalCost += orderCost;
    totalTime += orderTime;

    Object.keys(departmentCosts).forEach(dept => {
      departmentCosts[dept] += orderDeptCosts[dept] || 0;
      departmentTimes[dept] += orderDeptTimes[dept] || 0;
    });

    return `row`;
  }).join('');

  const dateRangeText = startDate && endDate ? 'filtered' : 'all';
  const now = new Date();
  const createdAt = 'now';

  const invProducts = DB.get(DB.KEYS.INV_PRODUCTS);
  const invLogs = DB.get(DB.KEYS.INV_LOGS);
  const invMonthly = DB.get(DB.KEYS.INV_MONTHLY);

  const categoryStocks = {};
  let totalInvAmount = 0;
  let totalFixedAmount = 0;
  let totalNormalAmount = 0;

  invProducts.forEach(product => {
    // WAIT getCurrentStock is not defined
    // const stock = getCurrentStock(product.id, invLogs);
  });
  
  return Object.keys(rateMap);
}

try {
  console.log(renderReport());
  console.log("SUCCESS");
} catch(e) {
  console.error("ERROR", e);
}
