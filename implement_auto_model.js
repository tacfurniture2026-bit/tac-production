const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Add getGeminiModelUrl helper
  const helperLogic = `
window.getGeminiModelUrl = async function(apiKey) {
    try {
        const listUrl = \`https://generativelanguage.googleapis.com/v1beta/models?key=\${apiKey}\`;
        const res = await fetch(listUrl);
        if (!res.ok) throw new Error('API key check failed');
        const data = await res.json();
        
        let models = data.models || [];
        models = models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'));
        
        // Priority: 1.5-flash -> 1.5-pro -> 1.0-pro -> anything gemini
        let targetModel = models.find(m => m.name.includes('gemini-1.5-flash'));
        if (!targetModel) targetModel = models.find(m => m.name.includes('gemini-1.5'));
        if (!targetModel) targetModel = models.find(m => m.name.includes('gemini-pro'));
        if (!targetModel) targetModel = models.find(m => m.name.includes('gemini'));
        if (!targetModel) targetModel = models[0];
        
        if (targetModel) {
            console.log("Auto-selected Gemini model:", targetModel.name);
            return \`https://generativelanguage.googleapis.com/v1beta/\${targetModel.name}:generateContent?key=\${apiKey}\`;
        }
    } catch(e) {
        console.warn("Failed to list models, using fallback", e);
    }
    // Fallback if list models fails
    return \`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}\`;
};
`;
  if (!code.includes('window.getGeminiModelUrl')) {
      code = helperLogic + '\n' + code;
  }

  // Replace hardcoded URLs with dynamic ones
  // In runAiMasterCheck:
  code = code.replace(
      /const url = `https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-pro:generateContent\?key=\$\{apiKey\}`;/g,
      'const url = await window.getGeminiModelUrl(apiKey);'
  );
  code = code.replace(
      /const url = `https:\/\/generativelanguage\.googleapis\.com\/v1\/models\/gemini-1\.5-flash:generateContent\?key=\$\{apiKey\}`;/g,
      'const url = await window.getGeminiModelUrl(apiKey);'
  );

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('Dynamic model selection implemented');
