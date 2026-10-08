const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Fix AI Check button
  code = code.replace(
      'id="ai-master-check-btn" style="background-color: #8b5cf6; border-color: #8b5cf6;">🤖 AIチェック',
      'id="ai-master-check-btn" onclick="runAiMasterCheck()" style="background-color: #8b5cf6; border-color: #8b5cf6;">🤖 AIチェック'
  );

  // Fix AI Settings button
  code = code.replace(
      'id="ai-api-settings-btn" style="margin-left: 10px;" title="AI機能の設定">⚙️',
      'id="ai-api-settings-btn" onclick="openAiSettingsModal()" style="margin-left: 10px;" title="AI機能の設定">⚙️'
  );

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');
console.log('AI Buttons fixed');
