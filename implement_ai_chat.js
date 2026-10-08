const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. Add interactive chat rendering
  const oldBody = /    const body = `[\s\S]*?<\/div>\n    `;/m;
  const newBody = `
    window.aiChatContext = [
      { role: 'user', parts: [{ text: prompt }] },
      { role: 'model', parts: [{ text: aiResult }] }
    ];
    const body = \`
      <div id="ai-chat-history" style="background: var(--color-bg-secondary); padding: 16px; border-radius: 8px; max-height: 50vh; overflow-y: auto; margin-bottom: 12px; display: flex; flex-direction: column;">
        <div style="margin: 10px 0;"><span style="background:#f1f5f9; padding:8px 12px; border-radius:12px; display:inline-block; max-width:95%; border: 1px solid #e2e8f0;">\${aiResult}</span></div>
      </div>
      <div style="display: flex; gap: 8px; border-top: 1px solid #cbd5e1; padding-top: 12px;">
        <input type="text" id="ai-chat-input" class="form-input" placeholder="例: 【1】を修正してください" style="flex: 1;" onkeypress="if(event.key === 'Enter') sendAiChatMessage()">
        <button class="btn btn-primary" onclick="sendAiChatMessage()" style="white-space: nowrap;">送信</button>
      </div>
    \`;
`;
  code = code.replace(oldBody, newBody);

  // 2. Add sendAiChatMessage function globally
  if (!code.includes('window.sendAiChatMessage')) {
    const chatFunc = `
window.sendAiChatMessage = async function() {
    const inputEl = document.getElementById('ai-chat-input');
    const msg = inputEl.value.trim();
    if(!msg) return;
    
    inputEl.value = '';
    const historyEl = document.getElementById('ai-chat-history');
    
    const userDiv = document.createElement('div');
    userDiv.style.margin = '10px 0';
    userDiv.style.textAlign = 'right';
    userDiv.innerHTML = \`<span style="background:#3b82f6; color:white; padding:8px 12px; border-radius:12px; display:inline-block; max-width:80%; text-align:left;">\${msg}</span>\`;
    historyEl.appendChild(userDiv);
    historyEl.scrollTop = historyEl.scrollHeight;
    
    const loadDiv = document.createElement('div');
    loadDiv.style.margin = '10px 0';
    loadDiv.innerHTML = \`<span style="background:#e2e8f0; padding:8px 12px; border-radius:12px; display:inline-block;">AIが応答を生成中...</span>\`;
    historyEl.appendChild(loadDiv);
    historyEl.scrollTop = historyEl.scrollHeight;

    window.aiChatContext.push({ role: 'user', parts: [{ text: msg }] });
    
    try {
        const apiKey = localStorage.getItem('AI_API_KEY');
        const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=\${apiKey}\`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: window.aiChatContext })
        });
        
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        let aiResult = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';
        aiResult = aiResult.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
        
        window.aiChatContext.push({ role: 'model', parts: [{ text: aiResult }] });
        
        loadDiv.remove();
        
        const aiDiv = document.createElement('div');
        aiDiv.style.margin = '10px 0';
        aiDiv.innerHTML = \`<span style="background:#f1f5f9; padding:8px 12px; border-radius:12px; display:inline-block; max-width:95%; border: 1px solid #e2e8f0;">\${aiResult.replace(/\\n/g, '<br>')}</span>\`;
        historyEl.appendChild(aiDiv);
        historyEl.scrollTop = historyEl.scrollHeight;
    } catch(e) {
        loadDiv.innerHTML = '<span style="color:red;">エラーが発生しました</span>';
    }
};
`;
    code += chatFunc;
  }
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Chat logic implemented');
