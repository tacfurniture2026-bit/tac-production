const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  const newFunction = `
// ========================================
// QRコード ZIPダウンロード
// ========================================

async function downloadQrZip() {
  if (typeof JSZip === 'undefined') {
    toast('ZIPライブラリの読み込み中です。ページを更新してください。', 'warning');
    return;
  }

  const checkboxes = document.querySelectorAll('.order-checkbox:checked');
  if (checkboxes.length === 0) {
    toast('QRコードを出力する指示書を選択してください', 'warning');
    return;
  }

  const idsToPrint = Array.from(checkboxes).map(cb => parseInt(cb.value));
  const orders = DB.get(DB.KEYS.ORDERS).filter(o => idsToPrint.includes(o.id));

  let qrDataList = [];
  orders.forEach(order => {
    if (order.items) {
      order.items.forEach(item => {
        const qrText = JSON.stringify({
          project: order.projectName,
          product: order.productName,
          bom: item.bomName
        });
        qrDataList.push({
          projectName: order.projectName || '',
          productName: order.productName || '',
          bomName: item.bomName || '',
          text: qrText
        });
      });
    }
  });

  if (qrDataList.length === 0) {
    toast('出力するデータがありません', 'warning');
    return;
  }

  toast('ZIPファイルを生成中...', 'info');
  
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }

  const zip = new JSZip();
  const folder = zip.folder("QR_Codes");

  // Helper to convert GIF data URL to JPEG Blob
  const dataUrlToJpegBlob = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Add some padding (quiet zone)
        const padding = 20;
        canvas.width = img.width + padding * 2;
        canvas.height = img.height + padding * 2;
        const ctx = canvas.getContext('2d');
        
        // Fill white background for JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw image in center
        ctx.drawImage(img, padding, padding);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 1.0);
      };
      img.src = dataUrl;
    });
  };

  for (let data of qrDataList) {
    try {
      const qr = qrcode(0, 'L');
      qr.addData(data.text);
      qr.make();
      // createDataURL returns GIF. Get it at module size 8 for high quality
      const gifDataUrl = qr.createDataURL(8, 0);
      
      const jpegBlob = await dataUrlToJpegBlob(gifDataUrl);
      
      // Filename: [部材名]_[品名]_[現場名].jpeg
      const safeFilename = (name) => name.replace(/[\\\\/:*?"<>|]/g, '-').trim();
      let filename = \`\${safeFilename(data.bomName)}_\${safeFilename(data.productName)}_\${safeFilename(data.projectName)}.jpeg\`;
      
      folder.file(filename, jpegBlob);
    } catch (e) {
      console.error('QR生成エラー:', e);
    }
  }

  zip.generateAsync({ type: "blob" }).then((content) => {
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "QR_Codes.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('ZIPファイルのダウンロードが完了しました', 'success');
  });
}
`;

  if (!code.includes('async function downloadQrZip()')) {
      code += newFunction;
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js'); // just in case, although mobile doesn't typically download zips of QRs
console.log('downloadQrZip function added');
