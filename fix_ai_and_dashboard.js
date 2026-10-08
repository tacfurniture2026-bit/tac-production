const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // 1. Fix Gemini Model
  code = code.replace(/models\/gemini-3\.8-flash/g, 'models/gemini-1.5-flash');

  // 2. Fix Dashboard Pending Stats (Orders + Quantity)
  const oldPending = "const statPendingEl = $('#stat-pending');\n  if (statPendingEl) statPendingEl.textContent = (total - complete);";
  const newPending = `
  const pendingOrders = orders.filter(o => calculateProgress(o) < 100);
  const pendingCount = pendingOrders.length;
  const pendingQty = pendingOrders.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
  const statPendingEl = $('#stat-pending');
  if (statPendingEl) statPendingEl.innerHTML = pendingCount + '<span style="font-size:1rem;">件</span><br><span style="font-size:1rem;">(' + pendingQty + '台)</span>';
  `;
  if (!code.includes('pendingOrders.reduce')) {
    code = code.replace(oldPending, newPending);
  }

  // 3. Graceful Error Handling for AI
  const oldErr = "let aiResult = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';";
  const newErr = "let aiResult = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';\n        if (aiResult.includes('high demand') || aiResult.includes('Spikes in demand')) aiResult = '現在AIサーバーが非常に混み合っています。数分待ってから再度お試しください。';";
  if (!code.includes('high demand')) {
    code = code.replace(oldErr, newErr);
  }
  
  const oldCatch = "loadDiv.innerHTML = '<span style=\"color:red;\">エラーが発生しました</span>';";
  const newCatch = "loadDiv.innerHTML = '<span style=\"color:red;\">エラーが発生しました。AIサーバーが混雑している可能性があります。時間を置いて再度お試しください。</span>';";
  if (!code.includes('AIサーバーが混雑')) {
    code = code.replace(oldCatch, newCatch);
  }

  // Also in runAiMasterCheck
  const oldCheckErr = "throw new Error(err.error?.message || 'APIリクエストに失敗しました');";
  const newCheckErr = "const msg = err.error?.message || 'APIリクエストに失敗しました';\n      if (msg.includes('high demand')) throw new Error('現在AIサーバーが非常に混み合っています。数分待ってから再度お試しください。');\n      throw new Error(msg);";
  if (!code.includes('現在AIサーバーが非常に混み合っています')) {
    code = code.replace(oldCheckErr, newCheckErr);
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('JS patched');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Fix Mobile Table Readability
  if (filename === 'mobile_source.html') {
    const oldStyle = ".table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; }\n  table { width: 100%; min-width: 600px; }";
    const newStyle = `
  body { overflow-x: hidden; max-width: 100vw; }
  .table-container { 
    overflow-x: auto !important; 
    -webkit-overflow-scrolling: touch; 
    width: 100%; 
    padding-bottom: 10px; /* Space for scrollbar */
  }
  table { 
    width: 100%; 
    min-width: 600px; 
    border-collapse: collapse;
  }
  th, td { 
    white-space: nowrap !important; /* Prevents text from wrapping/shrinking */
    font-size: 1rem !important; /* Forces readable font size */
    padding: 0.75rem !important;
  }
  .gantt-container, .gantt-container-mono {
    overflow-x: auto !important;
    white-space: nowrap !important;
  }
    `;
    code = code.replace(oldStyle, newStyle);
  }

  fs.writeFileSync(filename, code);
}

patchHtml('mobile_source.html');
console.log('HTML patched');
