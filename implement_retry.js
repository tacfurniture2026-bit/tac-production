const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Replace runAiMasterCheck fetch logic
  const targetCheck = /const url = `https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.8-flash:generateContent\?key=\$\{apiKey\}`;[\s\S]*?const data = await response\.json\(\);/m;
  const replaceCheck = `const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=\${apiKey}\`;
    
    let response;
    let data;
    let retries = 3;
    while (retries > 0) {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        if (response.ok) {
            data = await response.json();
            break;
        }
        
        const err = await response.json();
        const msg = err.error?.message || 'API Error';
        
        if (response.status === 503 || msg.includes('high demand') || msg.includes('Spikes in demand')) {
            retries--;
            if (retries === 0) throw new Error('AIサーバーが非常に混み合っています。数分待って再度お試しください。');
            await new Promise(r => setTimeout(r, 2000));
        } else {
            throw new Error(msg);
        }
    }`;
  code = code.replace(targetCheck, replaceCheck);

  // Replace sendAiChatMessage fetch logic
  const targetChat = /const url = `https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.8-flash:generateContent\?key=\$\{apiKey\}`;[\s\S]*?const data = await response\.json\(\);/m;
  const replaceChat = `const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=\${apiKey}\`;
        
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
            const msg = err.error?.message || 'API Error';
            
            if (response.status === 503 || msg.includes('high demand') || msg.includes('Spikes in demand')) {
                retries--;
                if (retries === 0) throw new Error('AIサーバー混雑中');
                await new Promise(r => setTimeout(r, 2000));
            } else {
                throw new Error(msg);
            }
        }`;
  code = code.replace(targetChat, replaceChat);

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('Retry logic added');
