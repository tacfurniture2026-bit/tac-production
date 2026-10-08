const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const target = 'onclick="printQrCodes()" title="選択した指示書のQRコードを出力">🖨️ QR出力</button>';
const newHTML = 'onclick="printQrCodes()" title="選択した指示書のQR一括印刷">🖨️ QR一括印刷</button>\n                        <button class="btn btn-sm btn-secondary" onclick="downloadQrZip()" title="選択した指示書のQRを個別にZIP保存">💾 ZIP出力</button>';

if (code.includes(target)) {
    code = code.replace(target, newHTML);
}
fs.writeFileSync('index.html', code);
console.log('Button fixed in index.html');
