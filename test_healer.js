// Mock DB
let mockMonthly = [{
  month: '2026-03',
  total: 100223895,
  f1Total: null
}];

const DB = {
  KEYS: { INV_MONTHLY: 'INV_MONTHLY' },
  get: () => mockMonthly,
  save: (k, v) => { mockMonthly = v; console.log('SAVED!'); },
  getTempScans: () => []
};

function calculateInvMonthly(month, f1) {
  // Mock calculate
  return {
    items: [],
    summary: {},
    total: 50276659,
    f1Total: 50276659,
    prevTotal: 0
  };
}

(function healMonthlyData() {
  try {
    let monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];
    let healed = false;
    monthly.forEach(m => {
      if (m.total === 100223895 || m.total > 90000000) {
        console.log(`Healing corrupted monthly data for ${m.month}: ${m.total}`);
        let f1 = m.f1Total;
        if (!f1 || f1 === 100223895) {
           const tScans = DB.getTempScans() || [];
           const meta = tScans.find(s => s.month === m.month && s.productId === 'META_F1_TOTAL');
           if (meta) f1 = meta.amountWithTax;
        }
        const result = calculateInvMonthly(m.month, f1);
        m.items = result.items;
        m.summary = result.summary;
        m.total = result.total;
        m.f1Total = result.f1Total;
        m.prevTotal = result.prevTotal;
        healed = true;
      }
    });
    if (healed) {
      console.log('Saved healed monthly data.');
      DB.save(DB.KEYS.INV_MONTHLY, monthly);
    }
  } catch(e) {
    console.error('Heal monthly failed', e);
  }
})();

console.log('Result:', mockMonthly);
