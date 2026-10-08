const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Add JSZip
  if (!code.includes('jszip.min.js')) {
      code = code.replace(
          '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>',
          '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>'
      );
  }

  // Add Download ZIP Button
  const btnPattern = /<button class="btn btn-secondary" onclick="printQrCodes\(\)">🖨 QR出力<\/button>/;
  const newBtn = '<button class="btn btn-secondary" onclick="printQrCodes()">🖨 QR一括印刷</button>\n                        <button class="btn btn-secondary" onclick="downloadQrZip()">💾 個別QR出力(ZIP)</button>';
  
  if (!code.includes('downloadQrZip()')) {
      code = code.replace(btnPattern, newBtn);
  }

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
console.log('HTML patched with JSZip and Button');
