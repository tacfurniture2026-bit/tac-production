const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Hide the urgent-orders-grid card
  code = code.replace(
    /<div class="card">\s*<div class="card-header">\s*<h3>⚠ 納期間近 \(GRID\)<\/h3>/g,
    '<div class="card" style="display: none;">\n                        <div class="card-header">\n                            <h3>⚠ 納期間近 (GRID)</h3>'
  );

  // Add stat-pending card to stats-grid
  if (!code.includes('id="stat-pending"')) {
    const statPendingHtml = `
                    <div class="stat-card">
                        <div class="stat-icon stat-total" style="background: #f59e0b; color: white;">⚠</div>
                        <div class="stat-content">
                            <span class="stat-value" id="stat-pending">0</span>
                            <span class="stat-label">注残件数</span>
                        </div>
                    </div>`;
    code = code.replace(
      /<div class="stats-grid">/,
      '<div class="stats-grid">' + statPendingHtml
    );
  }

  // Mobile version string update
  if (filename === 'mobile_source.html') {
    if (!code.includes('<div style="text-align: right; padding: 1rem; color: #a1a1aa; font-size: 0.8rem;" id="mobile-version-display">')) {
      code = code.replace(
        /<\/div>\s*<!-- 共通ボトムナビ -->/g,
        '    <div style="text-align: right; padding: 1rem; color: #a1a1aa; font-size: 0.8rem;" id="mobile-version-display">v6.45.0</div>\n            </div>\n            <!-- 共通ボトムナビ -->'
      );
    }
  }

  // Responsive design fix for mobile table overflowing
  if (filename === 'mobile_source.html') {
      if(!code.includes('.table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }')) {
          code = code.replace('</style>', '  .table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; }\n  table { width: 100%; min-width: 600px; }\n</style>');
      }
  }

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Calculate stat-pending
  const oldStatComplete = "$('#stat-complete').textContent = complete;";
  const newStatComplete = "$('#stat-complete').textContent = complete;\n  const statPendingEl = $('#stat-pending');\n  if (statPendingEl) statPendingEl.textContent = (total - complete);";
  if (!code.includes('statPendingEl.textContent')) {
      code = code.replace(oldStatComplete, newStatComplete);
  }
  
  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');

console.log('Dashboard and mobile fixes applied');
