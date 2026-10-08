const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Find where runAiMasterCheck starts
  const startIdx = code.indexOf('async function runAiMasterCheck()');
  if (startIdx === -1) return;

  // Find where showQrCopyPasteGallery starts
  const nextFuncIdx = code.indexOf('function showQrCopyPasteGallery()', startIdx);
  if (nextFuncIdx === -1) return;

  const beforeFunc = code.substring(0, startIdx);
  const afterFunc = code.substring(nextFuncIdx);

  const restoredFuncs = `
async function runAiMasterCheck() {
  const apiKey = localStorage.getItem('AI_API_KEY');
  if (!apiKey) {
    toast('先に「AI設定」からAPIキーを登録してください', 'warning');
    return;
  }

  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  if (products.length === 0) {
    toast('商品マスタが登録されていません', 'warning');
    return;
  }

  const payloadData = products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    isFixed: p.isFixed
  }));

  const prompt = \`
# 命令書:
あなたはプロのデータアナリストであり、生産管理システムのマスターデータ管理者です。
以下の前提条件と入力データ（商品マスターデータ）を元に、データの不整合や異常値をチェックしてレポートを作成してください。

# 前提条件:
- 単価は原則1円以上であること。ただし、名前に「不動品」「仕掛品」「死蔵」が含まれるもの、またはisFixedがtrueのものは0円でも正常とする。
- それ以外の単価0円の商品は「価格設定漏れ」としてリストアップすること。
- 分類が「99」や未設定などの不明なコードになっていないこと。
- 商品名と分類が明らかに矛盾していないこと。

# 出力形式:
- 簡潔で分かりやすい箇条書きで出力してください。
- 人間が後から「何番を修正して」と指示しやすくするため、報告する異常や提案の一つ一つに必ず「【1】」「【2】」のような連番を振ってください。
- 異常がない場合は「異常なし」と出力してください。
- 出力フォーマットはHTMLとして画面表示しやすい形式（<ul>, <li>, <strong>タグなどを使用して装飾）にしてください。Markdownのコードブロック記法は不要です。

# 入力（商品マスターデータ）:
\${JSON.stringify(payloadData)}\`;

  showModal('🤖 AIマスターチェック', '<div style="text-align: center; padding: 2rem;">🔄 AIにデータを送信しチェックしています...<br>しばらくお待ちください。</div>', '');

  try {
    const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=\${apiKey}\`;
    
    let response;
    let data;
    let retries = 3;
    while (retries > 0) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });
      
      if (response.ok) {
        data = await response.json();
        break;
      }
      
      const err = await response.json();
      const msg = err.error?.message || 'API Error';
      
      if (response.status === 503 || msg.includes('high demand') || msg.includes('Spikes in demand')) {
        retries--;
        if (retries === 0) throw new Error('AIサーバー混雑中');
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw new Error(msg);
      }
    }

    let aiResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '結果を取得できませんでした。';
    aiResult = aiResult.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');

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

    const footer = \`<button class="btn btn-secondary" onclick="closeModal()">閉じる</button>\`;
    $('#modal').style.maxWidth = '800px';
    showModal('🤖 AIマスターチェック結果', body, footer);

  } catch (error) {
    console.error('AI Check Error:', error);
    showModal('エラー', \`<p style="color: red;">AIチェック中にエラーが発生しました。</p><p>\${error.message}</p>\`, '<button class="btn btn-secondary" onclick="closeModal()">閉じる</button>');
  }
}

window.sendAiChatMessage = async function() {
  const inputEl = document.getElementById('ai-chat-input');
  if (!inputEl) return;
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
    
    let response;
    let data;
    let retries = 3;
    while (retries > 0) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: window.aiChatContext })
      });
      
      if (response.ok) {
        data = await response.json();
        break;
      }
      
      const err = await response.json();
      const errorMsg = err.error?.message || 'API Error';
      
      if (response.status === 503 || errorMsg.includes('high demand') || errorMsg.includes('Spikes in demand')) {
        retries--;
        if (retries === 0) throw new Error('AIサーバー混雑中');
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw new Error(errorMsg);
      }
    }

    let aiResult = data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラーが発生しました';
    if (aiResult.includes('high demand') || aiResult.includes('Spikes in demand')) aiResult = '現在AIサーバーが非常に混み合っています。数分待ってから再度お試しください。';
    aiResult = aiResult.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
    
    window.aiChatContext.push({ role: 'model', parts: [{ text: aiResult }] });
    
    loadDiv.remove();
    
    const aiDiv = document.createElement('div');
    aiDiv.style.margin = '10px 0';
    aiDiv.innerHTML = \`<span style="background:#f1f5f9; padding:8px 12px; border-radius:12px; display:inline-block; max-width:95%; border: 1px solid #e2e8f0;">\${aiResult.replace(/\\n/g, '<br>')}</span>\`;
    historyEl.appendChild(aiDiv);
    historyEl.scrollTop = historyEl.scrollHeight;
  } catch(e) {
    loadDiv.innerHTML = \`<span style="color:red;">エラーが発生しました: \${e.message}</span>\`;
  }
};

`;

  code = beforeFunc + restoredFuncs + afterFunc;
  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('AI logic fixed');
