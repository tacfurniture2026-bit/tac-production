const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Replace the hidden GRID card with the Pending Orders List card
  const targetGrid = /<div class="card" style="display: none;">\s*<div class="card-header">\s*<h3>⚠ 納期間近 \(GRID\)<\/h3>\s*<\/div>\s*<div class="card-body" id="urgent-orders-grid">\s*<p class="text-muted">読み込み中\.\.\.<\/p>\s*<\/div>\s*<\/div>/g;
  
  const newPendingCard = `<div class="card" id="pending-orders-card">
                        <div class="card-header">
                            <h3>⚠ 現在の注残一覧</h3>
                        </div>
                        <div class="card-body" id="pending-orders-list" style="max-height: 400px; overflow-y: auto;">
                            <p class="text-muted">読み込み中...</p>
                        </div>
                    </div>`;
                    
  if (code.match(targetGrid)) {
      code = code.replace(targetGrid, newPendingCard);
  }

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');
console.log('HTML updated for pending list');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const targetRender = "$('#urgent-orders-pao').innerHTML = generateUrgentHtml(paoOrders);";
  const newRender = `
  const pendingOrdersList = orders.filter(o => calculateProgress(o) < 100);
  const generatePendingHtml = (list) => {
    if (list.length === 0) return '<p class="text-muted">注残はありません</p>';
    return list.map(o => {
      const days = o.dueDate ? Math.ceil((new Date(o.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      let daysStr = '未定';
      let color = 'var(--color-text-muted)';
      if (days !== null) {
          daysStr = days <= 0 ? '今日' : \`あと\${days}日\`;
          color = days <= 1 ? 'red' : 'inherit';
      }
      return \`
        <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--color-border);">
          <div>
            <div style="font-weight: 500; cursor: pointer; color: var(--color-primary);" onclick="navigateToOrder(\${o.id})">\${o.projectName}</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-muted);">\${o.productName}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold;">\${o.quantity}台</div>
            <div style="font-size: 0.75rem; color: \${color};">\${daysStr}</div>
          </div>
        </div>
      \`;
    }).join('');
  };
  
  const pendingListEl = $('#pending-orders-list');
  if (pendingListEl) pendingListEl.innerHTML = generatePendingHtml(pendingOrdersList);

  $('#urgent-orders-pao').innerHTML = generateUrgentHtml(paoOrders);
  `;
  
  if (!code.includes('pendingListEl.innerHTML')) {
      code = code.replace(targetRender, newRender);
  }
  
  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('JS updated for pending list');
