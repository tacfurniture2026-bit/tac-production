
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

function calculateInvMonthly(month, f1Total = null) {
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  const logs = DB.get(DB.KEYS.INV_LOGS) || [];
  const monthly = DB.get(DB.KEYS.INV_MONTHLY) || [];

  // 前月データを取得
  const prevDate = new Date(month + '-01');
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = prevDate.toISOString().substring(0, 7);
  let prevData = monthly.find(m => m.month === prevMonth);
  
  // 前月データの破損チェックと自己修復
  if (prevData && prevData.items) {
    const isPrevCorrupted = isNaN(Number(prevData.total)) || prevData.items.some(i => isNaN(Number(i.amount)) || isNaN(Number(i.price)));
    if (isPrevCorrupted) {
      console.warn(`Corrupted previous monthly data (${prevMonth}) detected. Recalculating...`);
      prevData = calculateInvMonthly(prevMonth);
    }
  }

  // 当月がすでに締め済みか確認
  const isClosed = monthly.some(m => m.month === month);
  if (isClosed) {
    const savedData = monthly.find(m => m.month === month);
    if (savedData && savedData.items) {
      // 破損チェック（NaNが含まれているか）
      const isCorrupted = isNaN(Number(savedData.total)) || savedData.items.some(i => isNaN(Number(i.amount)) || isNaN(Number(i.price)));
      if (!isCorrupted) {
        // 前月合計金額を取得
        let calcPrevTotal = 0;
        if (prevData && prevData.items) {
          calcPrevTotal = prevData.items.reduce((sum, pi) => sum + (Number(pi.amount) || 0), 0);
        }
        savedData.prevTotal = calcPrevTotal;

        // 保存済みアイテムの金額(amount)はそのまま尊重し、前月金額(prevAmount)と差分(diff)のみ前月データから更新
        savedData.items.forEach(item => {
          // 保存済み金額が万が一欠損している場合のみ計算
          if (item.amount === undefined || item.amount === null || isNaN(Number(item.amount))) {
            if (item.csvAmountWithTax > 0) {
              item.amount = Math.round(Number(item.csvAmountWithTax));
            } else {
              item.amount = Math.round((Number(item.currQty) || 0) * (Number(item.price) || 0) * 1.01);
            }
          } else {
            item.amount = Math.round(Number(item.amount));
          }

          // prevAmount は前月締めデータから取得（存在すれば前月の確定金額）
          let pa = 0;
          if (prevData && prevData.items) {
            const pi = prevData.items.find(p => p.productId === item.productId);
            if (pi) {
              pa = Math.round(Number(pi.amount) || 0);
            }
          }
          item.prevAmount = pa;
          item.diff = (Number(item.currQty) || 0) - (Number(item.prevQty) || 0);
        });

        // total も保存済みアイテムの和として正確に算出
        savedData.total = savedData.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

        // summary の再構築
        savedData.summary = {};
        savedData.items.forEach(item => {
          const catKey = item.isFixed ? 'fixed' : item.category;
          if (!savedData.summary[catKey]) {
            const catName = typeof INV_CATEGORIES !== 'undefined' ? (INV_CATEGORIES[item.category] || `分類${item.category}`) : `分類${item.category}`;
            savedData.summary[catKey] = { name: item.isFixed ? '不動品' : catName, amount: 0, diff: 0, prevAmount: 0 };
          }
          savedData.summary[catKey].amount += (Number(item.amount) || 0);
          savedData.summary[catKey].prevAmount += (Number(item.prevAmount) || 0);
        });
        Object.keys(savedData.summary).forEach(k => {
          const s = savedData.summary[k];
          s.diff = (Number(s.amount) || 0) - (Number(s.prevAmount) || 0);
        });

        return savedData;
      }
      console.warn(`Corrupted monthly data (${month}) detected. Recalculating...`);
    }
  }

  // 当月のログをフィルタ
  const monthLogs = logs.filter(l => l.timestamp && l.timestamp.startsWith(month));
  
  // CSV取込ログかどうか判定
  const csvLogs = monthLogs.filter(l => l.type === 'count' && l.amountWithTax > 0);
  const hasCsvImport = csvLogs.length > 0;
  
  const items = [];
  const summary = {};
  
  const safeNum = (val) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  // 全集計対象商品IDの特定
  // マスタ商品、当月ログ、前月データを統合して漏れなく集計対象とする
  const allProductIds = new Set();
  products.forEach(p => allProductIds.add(p.id));
  monthLogs.forEach(l => { if (l.productId) allProductIds.add(l.productId); });
  if (prevData && prevData.items) {
    prevData.items.forEach(i => allProductIds.add(i.productId));
  }

  // 商品ID順でソート
  const sortedProductIds = Array.from(allProductIds).sort((a, b) => a.localeCompare(b));

  sortedProductIds.forEach(pid => {
    if (pid.startsWith('TEMP_')) return;

    const masterProduct = products.find(x => x.id === pid);
    const prevItem = prevData && prevData.items ? prevData.items.find(i => i.productId === pid) : null;

    const name = masterProduct ? masterProduct.name : (prevItem ? prevItem.name : pid);
    const category = masterProduct ? masterProduct.category : (prevItem ? prevItem.category : (pid.includes('-') ? pid.split('-')[0] : ((pid.startsWith('N') && pid.length > 3) ? pid.substring(1, 3) : '99')));
    const price = masterProduct ? safeNum(masterProduct.price) : (prevItem ? safeNum(prevItem.price) : 0);
    const isFixed = masterProduct ? !!masterProduct.isFixed : (prevItem ? !!prevItem.isFixed : false);

    // 前月数量・金額の取得（生精度小数の保持）
    const prevQty = prevItem ? safeNum(prevItem.currQty) : 0;
    let prevAmountRaw = 0;
    if (prevItem) {
      if (prevItem.csvAmountWithTax !== undefined && prevItem.csvAmountWithTax !== null) {
        prevAmountRaw = safeNum(prevItem.csvAmountWithTax);
      } else if (prevItem.rawAmount !== undefined && prevItem.rawAmount !== null) {
        prevAmountRaw = safeNum(prevItem.rawAmount);
      } else if (prevItem.amount !== undefined && prevItem.amount !== null && !isNaN(Number(prevItem.amount))) {
        prevAmountRaw = safeNum(prevItem.amount);
      } else {
        prevAmountRaw = prevQty * price * 1.01;
      }
    }
    const prevAmount = Math.round(prevAmountRaw);

    // 当月数量およびCSV U列金額の算出
    let currQty = 0;
    let csvAmountWithTax = 0;
    let hasCountLog = false;
    const productLogs = monthLogs.filter(l => l.productId === pid);

    if (!isClosed && monthLogs.length === 0 && !hasCsvImport) {
      currQty = isFixed ? prevQty : 0;
    } else {
      const countLogs = productLogs.filter(l => l.type === 'count');
      const inOutLogs = productLogs.filter(l => l.type === 'in' || l.type === 'out');

      if (countLogs.length > 0) {
        hasCountLog = true;
        if (hasCsvImport) {
          // CSVインポート時は全CSV行の数量・U列金額を合算（0円も含め集計）
          countLogs.forEach(log => {
            currQty += safeNum(log.quantity);
            csvAmountWithTax += safeNum(log.amountWithTax);
          });
        } else {
          // 手動棚卸スキャン等の場合は最新のcountログの数量を採用（重複加算防止）
          const latestCountLog = countLogs[countLogs.length - 1];
          currQty = safeNum(latestCountLog.quantity);
          if (latestCountLog.amountWithTax > 0) {
            csvAmountWithTax = safeNum(latestCountLog.amountWithTax);
          }
        }
      } else if (isFixed && !hasCsvImport) {
        // CSV取込が行われていない月のみ、棚卸カウントログがない不動品は前月数量を自動引き継ぎ
        currQty = prevQty;
      } else {
        currQty = 0;
      }

      // 入出庫ログ（in/out）を反映
      inOutLogs.forEach(log => {
        if (log.type === 'in') currQty += safeNum(log.quantity);
        else if (log.type === 'out') currQty -= safeNum(log.quantity);
      });
    }

    const diff = currQty - prevQty;

    // 当月金額 (amount) の算出
    let amountRaw = 0;
    if (hasCsvImport && hasCountLog) {
      amountRaw = csvAmountWithTax;
    } else if (csvAmountWithTax > 0) {
      amountRaw = csvAmountWithTax;
    } else if (isFixed && currQty === prevQty && prevAmountRaw > 0 && !hasCsvImport) {
      amountRaw = prevAmountRaw;
    } else {
      amountRaw = currQty * price * 1.01;
    }
    const amount = Math.round(amountRaw);

    items.push({
      productId: pid,
      name: name,
      category: category,
      price: price,
      prevQty: prevQty,
      currQty: currQty,
      diff: diff,
      amount: amount,
      isFixed: isFixed,
      prevAmount: prevAmount,
      rawAmount: amountRaw,
      rawPrevAmount: prevAmountRaw,
      csvAmountWithTax: (hasCountLog && hasCsvImport) ? csvAmountWithTax : (csvAmountWithTax > 0 ? csvAmountWithTax : undefined)
    });

    const catKey = isFixed ? 'fixed' : category;
    if (!summary[catKey]) {
      const catName = typeof INV_CATEGORIES !== 'undefined' ? (INV_CATEGORIES[category] || `分類${category}`) : `分類${category}`;
      summary[catKey] = { name: isFixed ? '不動品' : catName, rawAmount: 0, rawPrevAmount: 0, amount: 0, diff: 0, prevAmount: 0 };
    }
    summary[catKey].rawAmount = (summary[catKey].rawAmount || 0) + amountRaw;
    summary[catKey].rawPrevAmount = (summary[catKey].rawPrevAmount || 0) + prevAmountRaw;
  });

  // 端数誤差を吸収し、ExcelセルF1 / U列合計と1円単位で完全一致させるため総和を最後に四捨五入
  
  // 端数誤差を吸収し、ExcelセルF1 / U列合計と1円単位で完全一致させるため総和を最後に四捨五入
  const rawTotal = items.reduce((sum, i) => sum + (i.rawAmount !== undefined ? i.rawAmount : i.amount), 0);
  let total = Math.round(rawTotal);
  
  if (f1Total !== null && !isNaN(f1Total)) {
    const diff = f1Total - total;
    if (diff !== 0) {
      if (!summary['adjustment']) {
        summary['adjustment'] = { name: 'エクセル補正(F1)', rawAmount: 0, rawPrevAmount: 0, amount: 0, diff: 0, prevAmount: 0 };
      }
      summary['adjustment'].rawAmount = diff;
      summary['adjustment'].amount = diff;
      total = f1Total;
    }
  }

  const rawPrevTotal = items.reduce((sum, i) => sum + (i.rawPrevAmount !== undefined ? i.rawPrevAmount : i.prevAmount), 0);

  const prevTotal = Math.round(rawPrevTotal);

  let largestCatKey = null;
  let maxCatRawAmt = -1;

  Object.keys(summary).forEach(k => {
    const amt = Math.round(summary[k].rawAmount || 0);
    const prevAmt = Math.round(summary[k].rawPrevAmount || 0);
    summary[k].diff = amt - prevAmt;
    summary[k].amount = amt;
    summary[k].prevAmount = prevAmt;
    if ((summary[k].rawAmount || 0) > maxCatRawAmt) {
      maxCatRawAmt = summary[k].rawAmount || 0;
      largestCatKey = k;
    }
  });

  // 分類別合計の四捨五入端数を最大カテゴリで補正し、全体合計(total/prevTotal)と完全一致させる
  const catSum = Object.values(summary).reduce((s, c) => s + c.amount, 0);
  const catDiff = total - catSum;
  if (catDiff !== 0 && largestCatKey && summary[largestCatKey]) {
    summary[largestCatKey].amount += catDiff;
    summary[largestCatKey].diff = summary[largestCatKey].amount - summary[largestCatKey].prevAmount;
  }

  const prevCatSum = Object.values(summary).reduce((s, c) => s + c.prevAmount, 0);
  const prevCatDiff = prevTotal - prevCatSum;
  if (prevCatDiff !== 0 && largestCatKey && summary[largestCatKey]) {
    summary[largestCatKey].prevAmount += prevCatDiff;
    summary[largestCatKey].diff = summary[largestCatKey].amount - summary[largestCatKey].prevAmount;
  }

  return { month, items, summary, total, prevTotal };
}
console.log(calculateInvMonthly("2026-04", 5000));