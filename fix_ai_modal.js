const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. Fix closeModal globally
  if (!code.includes('window.closeModal = hideModal;')) {
    code = code.replace(/function hideModal\(\) {/, "window.closeModal = hideModal;\nfunction hideModal() {");
  }

  // 2. Widen modal
  const targetModal = /showModal\('🤖 AIマスターチェック結果', body, footer\);/;
  const replaceModal = "$('#modal').style.maxWidth = '800px';\n    showModal('🤖 AIマスターチェック結果', body, footer);";
  code = code.replace(targetModal, replaceModal);

  // 3. Update AI Prompt
  const targetPrompt = /- 簡潔で分かりやすい箇条書きで出力してください。/;
  const replacePrompt = "- 簡潔で分かりやすい箇条書きで出力してください。\n- 人間が後から「何番を修正して」と指示しやすくするため、報告する異常や提案の一つ一つに必ず「【1】」「【2】」のような連番を振ってください。";
  code = code.replace(targetPrompt, replacePrompt);

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('AI modal fixed');
