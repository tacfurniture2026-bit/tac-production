const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Regex replacement for defect scanner
  code = code.replace(/id="defect-start-scan-btn"[^>]*>/g, match => {
      if (!match.includes('onclick')) {
          return match.replace('>', ' onclick="startDefectQrScanner()">');
      }
      return match;
  });
  code = code.replace(/id="defect-stop-scan-btn"[^>]*>/g, match => {
      if (!match.includes('onclick')) {
          return match.replace('>', ' onclick="stopDefectQrScanner()">');
      }
      return match;
  });

  // Regex replacement for regular scanner
  code = code.replace(/id="start-scan-btn"[^>]*>/g, match => {
      if (!match.includes('onclick')) {
          return match.replace('>', ' onclick="startQrScanner()">');
      }
      return match;
  });
  code = code.replace(/id="stop-scan-btn"[^>]*>/g, match => {
      if (!match.includes('onclick')) {
          return match.replace('>', ' onclick="stopQrScanner()">');
      }
      return match;
  });

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');
console.log('HTML patched with regex');
