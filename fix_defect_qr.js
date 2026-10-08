const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Hardcode onclick directly to the HTML buttons to be absolutely foolproof
  code = code.replace(
      'id="defect-start-scan-btn">',
      'id="defect-start-scan-btn" onclick="startDefectQrScanner()">'
  );
  code = code.replace(
      'id="defect-stop-scan-btn"\n                                        style="display: none;">',
      'id="defect-stop-scan-btn"\n                                        style="display: none;" onclick="stopDefectQrScanner()">'
  );

  // Also do it for the regular QR scanner just in case!
  code = code.replace(
      'id="start-scan-btn">',
      'id="start-scan-btn" onclick="startQrScanner()">'
  );
  code = code.replace(
      'id="stop-scan-btn"\n                                    style="display: none;">',
      'id="stop-scan-btn"\n                                    style="display: none;" onclick="stopQrScanner()">'
  );

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');
console.log('HTML patched for QR buttons');
