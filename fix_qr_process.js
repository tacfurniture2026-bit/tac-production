const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Add Register Button
  const targetHtml = '<input type="hidden" id="qr-process" value="">';
  const newHtml = `<input type="hidden" id="qr-process" value="">\n                                    <button type="button" class="btn btn-primary btn-full" style="margin-top: 1rem; padding: 1rem; font-size: 1.1rem; display: none;" id="qr-submit-btn" onclick="submitQrProgress()">進捗を登録する</button>`;
  
  if (!code.includes('id="qr-submit-btn"')) {
      code = code.replace(targetHtml, newHtml);
  }

  // Change Label
  const targetLabel = '<label>工程（タップして選択）</label>';
  const newLabel = '<label>工程（タップして選択し、登録ボタンを押す）</label>';
  if (code.includes(targetLabel)) {
      code = code.replace(targetLabel, newLabel);
  }

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');
console.log('HTML updated');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  const oldSelectProcess = /function selectProcess\(btn, processName\) \{[\s\S]*?\}\n\nfunction registerProgress/m;
  
  const newSelectProcess = `function selectProcess(btn, processName) {
  // 1. UI Feedback (Selection only)
  const container = btn.closest('.process-btn-grid');
  if (container) {
    container.querySelectorAll('.process-btn').forEach(b => b.classList.remove('selected'));
  }
  btn.classList.add('selected');
  
  // Set hidden input
  const processHidden = document.getElementById('qr-process');
  if (processHidden) processHidden.value = processName;
  
  // Show submit button
  const submitBtn = document.getElementById('qr-submit-btn');
  if (submitBtn) {
    submitBtn.style.display = 'block';
    submitBtn.innerText = processName + ' を登録する';
  }
}

function submitQrProgress() {
  const orderId = parseInt(document.getElementById('qr-order').value);
  const itemId = parseInt(document.getElementById('qr-item').value);
  const processHidden = document.getElementById('qr-process');
  
  if (!orderId || !itemId) {
    toast('指示書と部材が選択されていません', 'error');
    return;
  }
  
  if (!processHidden || !processHidden.value) {
    toast('工程を選択してください', 'error');
    return;
  }
  
  const processName = processHidden.value;
  const processContainer = document.getElementById('qr-process-buttons');
  const btn = processContainer ? processContainer.querySelector(\`.process-btn[data-process="\${processName}"]\`) : null;
  
  if (btn) {
    btn.style.opacity = '0.7';
    btn.innerText = '登録中...';
  }
  
  // Disable submit button during process
  const submitBtn = document.getElementById('qr-submit-btn');
  if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = '登録中...';
  }

  setTimeout(() => {
      const success = registerProgress(orderId, itemId, processName);

      if (success) {
        toast(\`\${processName} を完了として登録しました\`, 'success');
        if (btn) {
            btn.classList.add('completed');
            btn.innerText = \`✓ \${processName}\`;
            btn.disabled = true;
            btn.style.opacity = '1';
        }
        
        // Hide submit button and clear hidden input
        if (submitBtn) {
            submitBtn.style.display = 'none';
            submitBtn.disabled = false;
        }
        processHidden.value = '';

        if (navigator.vibrate) try { navigator.vibrate(50); } catch (e) { }
      } else {
        toast('登録に失敗しました', 'error');
        if (btn) {
            btn.style.opacity = '1';
            btn.innerText = processName;
        }
        if (submitBtn) {
            submitBtn.innerText = processName + ' を登録する';
            submitBtn.disabled = false;
        }
      }
  }, 100);
}

function registerProgress`;

  if (!code.includes('function submitQrProgress')) {
      code = code.replace(oldSelectProcess, newSelectProcess);
  }

  // Also modify updateQrProcessSelect to hide submit button when processes load
  const oldUpdateProcessEnd = "if (processHidden) processHidden.value = '';\n\n  // 未完了が1つだけなら自動選択";
  const newUpdateProcessEnd = "if (processHidden) processHidden.value = '';\n  const submitBtn = $('#qr-submit-btn');\n  if(submitBtn) submitBtn.style.display = 'none';\n\n  // 未完了が1つだけなら自動選択";
  
  if (!code.includes("submitBtn.style.display = 'none'")) {
      code = code.replace(oldUpdateProcessEnd, newUpdateProcessEnd);
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('JS updated');
