const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Fix model name
  code = code.replace(/gemini-3\.8-flash/g, 'gemini-1.5-flash');

  // Add progress timer to AI master check
  const oldShowModal = "showModal('🤖 AIマスターチェック', '<div style=\"text-align: center; padding: 2rem;\">🔄 AIにデータを送信しチェックしています...<br>しばらくお待ちください。</div>', '');";
  const newShowModal = `
  let aiCheckTimerInterval;
  let elapsedSeconds = 0;
  showModal('🤖 AIマスターチェック', \`
    <div style="text-align: center; padding: 2rem;">
      🔄 AIにデータを送信し、マスターデータの整合性をチェックしています...<br>
      <span style="font-size: 0.9em; color: #666;">（商品数によっては30秒〜1分ほどかかる場合があります）</span><br><br>
      <div id="ai-check-timer" style="font-weight: bold; color: #2563eb; font-size: 1.2em;">経過時間: 0秒</div>
    </div>\`, '');
  
  aiCheckTimerInterval = setInterval(() => {
    elapsedSeconds++;
    const timerEl = document.getElementById('ai-check-timer');
    if (timerEl) {
      timerEl.textContent = \`経過時間: \${elapsedSeconds}秒\`;
    } else {
      clearInterval(aiCheckTimerInterval);
    }
  }, 1000);
  `;
  
  if (code.includes(oldShowModal)) {
      code = code.replace(oldShowModal, newShowModal);
  }

  // Clear timer on success
  const oldClearTimer = "let aiResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '結果を取得できませんでした。';";
  const newClearTimer = "if (typeof aiCheckTimerInterval !== 'undefined') clearInterval(aiCheckTimerInterval);\n    " + oldClearTimer;
  if (code.includes(oldClearTimer)) {
      code = code.replace(oldClearTimer, newClearTimer);
  }
  
  // Clear timer on error
  const oldError = "showModal('エラー', `<p style=\"color: red;\">AIチェック中にエラーが発生しました。</p><p>${error.message}</p>`, '<button class=\"btn btn-secondary\" onclick=\"closeModal()\">閉じる</button>');";
  const newError = "if (typeof aiCheckTimerInterval !== 'undefined') clearInterval(aiCheckTimerInterval);\n    " + oldError;
  if (code.includes(oldError)) {
      code = code.replace(oldError, newError);
  }

  // Chatbot Logic
  if (filename === 'app.js') {
    const chatbotLogic = `
// ========================================
// フローティングチャットボット (PC版のみ)
// ========================================
let floatingChatContext = [];

window.toggleFloatingChat = function() {
  const body = document.getElementById('floating-chat-body');
  const toggleIcon = document.getElementById('floating-chat-toggle-icon');
  if (body.style.display === 'none') {
    body.style.display = 'flex';
    toggleIcon.textContent = '▼';
    // 初期メッセージがない場合は追加
    if (floatingChatContext.length === 0) {
        appendFloatingChat('model', 'こんにちは！TAC生産管理システムのAIアシスタントです。使い方や、データについて何でも質問してください。');
    }
  } else {
    body.style.display = 'none';
    toggleIcon.textContent = '▲';
  }
};

window.appendFloatingChat = function(role, text) {
  const historyEl = document.getElementById('floating-chat-history');
  if (!historyEl) return;
  
  const div = document.createElement('div');
  div.style.margin = '8px 0';
  if (role === 'user') {
    div.style.textAlign = 'right';
    div.innerHTML = \`<span style="background:#3b82f6; color:white; padding:8px 12px; border-radius:12px; display:inline-block; max-width:85%; text-align:left; font-size: 0.85rem;">\${text}</span>\`;
  } else if (role === 'model') {
    div.style.textAlign = 'left';
    div.innerHTML = \`<span style="background:#f1f5f9; color:#333; padding:8px 12px; border-radius:12px; display:inline-block; max-width:85%; text-align:left; font-size: 0.85rem; border: 1px solid #e2e8f0;">\${text.replace(/\\n/g, '<br>')}</span>\`;
  } else if (role === 'loading') {
    div.id = 'floating-chat-loading';
    div.style.textAlign = 'left';
    div.innerHTML = \`<span style="background:#e2e8f0; color:#666; padding:8px 12px; border-radius:12px; display:inline-block; font-size: 0.85rem;">AIが考え中...</span>\`;
  }
  
  historyEl.appendChild(div);
  historyEl.scrollTop = historyEl.scrollHeight;
};

window.sendFloatingChat = async function() {
  const inputEl = document.getElementById('floating-chat-input');
  if (!inputEl) return;
  const msg = inputEl.value.trim();
  if(!msg) return;
  
  const apiKey = localStorage.getItem('AI_API_KEY');
  if (!apiKey) {
    toast('先にAI設定からAPIキーを登録してください', 'warning');
    return;
  }
  
  inputEl.value = '';
  appendFloatingChat('user', msg);
  appendFloatingChat('loading', '');

  // プロンプトにシステムコンテキストを含める
  if (floatingChatContext.length === 0) {
    floatingChatContext.push({
        role: 'user',
        parts: [{ text: "あなたはTAC製造部の生産管理システムのAIアシスタントです。親切に答えてください。" }]
    });
    floatingChatContext.push({
        role: 'model',
        parts: [{ text: "はい、承知いたしました。TAC製造部の生産管理システムについて何でもお尋ねください。" }]
    });
  }
  
  floatingChatContext.push({ role: 'user', parts: [{ text: msg }] });
  
  try {
    const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: floatingChatContext })
    });
    
    const loadingEl = document.getElementById('floating-chat-loading');
    if (loadingEl) loadingEl.remove();
    
    if (!response.ok) {
        throw new Error('APIリクエストに失敗しました');
    }
    
    const data = await response.json();
    let aiResult = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';
    aiResult = aiResult.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
    
    floatingChatContext.push({ role: 'model', parts: [{ text: aiResult }] });
    appendFloatingChat('model', aiResult);
    
  } catch(e) {
    const loadingEl = document.getElementById('floating-chat-loading');
    if (loadingEl) loadingEl.remove();
    appendFloatingChat('model', 'エラーが発生しました: ' + e.message);
  }
};
`;
    if (!code.includes('floatingChatContext')) {
      code += chatbotLogic;
    }
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');

// Add HTML for floating chatbot to index.html
let indexCode = fs.readFileSync('index.html', 'utf8');
const chatbotHtml = `
    <!-- フローティングAIチャット (PC専用) -->
    <div id="ai-floating-chat" style="position: fixed; bottom: 20px; right: 20px; width: 340px; background: #fff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 9999; display: flex; flex-direction: column; overflow: hidden;">
        <div onclick="toggleFloatingChat()" style="background: #8b5cf6; color: #fff; padding: 12px 15px; cursor: pointer; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
            <span>🤖 AIアシスタント</span>
            <span id="floating-chat-toggle-icon">▲</span>
        </div>
        <div id="floating-chat-body" style="display: none; flex-direction: column; height: 380px;">
            <div id="floating-chat-history" style="flex: 1; padding: 12px; overflow-y: auto; background: #f8fafc;"></div>
            <div style="display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e2e8f0; background: #fff;">
                <input type="text" id="floating-chat-input" class="form-input" placeholder="質問を入力..." style="flex: 1; font-size: 0.85rem; padding: 6px 10px;" onkeypress="if(event.key === 'Enter') sendFloatingChat()">
                <button onclick="sendFloatingChat()" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.85rem; background-color: #8b5cf6; border-color: #8b5cf6;">送信</button>
            </div>
        </div>
    </div>
    
    <style>
        /* モバイル画面ではフローティングチャットを非表示にする */
        @media (max-width: 768px) {
            #ai-floating-chat { display: none !important; }
        }
    </style>
`;
if (!indexCode.includes('ai-floating-chat')) {
    indexCode = indexCode.replace('</body>', chatbotHtml + '\n</body>');
    fs.writeFileSync('index.html', indexCode);
}

console.log('AI logic updated and chatbot added');
