const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Change the button in the HTML if this is index.html
  if (filename === 'index.html') {
      code = code.replace(/downloadQrZip\(\)/g, 'showQrCopyPasteGallery()');
      code = code.replace(/💾 ZIP出力/g, '📋 Excel用コピペ出力');
      fs.writeFileSync(filename, code);
      return;
  }

  // If this is app.js or app-mobile.js, completely replace downloadQrZip
  if (filename.endsWith('.js')) {
      const startIdx = code.indexOf('async function downloadQrZip()');
      if (startIdx !== -1) {
          // Find the end of the function. Since we know it's at the end of the file or followed by another block, we can just replace everything from here to the end if it's the last function, or use regex.
          // Let's use a targeted replace for the exact function signature we know is there.
          const beforeFunc = code.substring(0, startIdx);
          
          const newFunc = `
function showQrCopyPasteGallery() {
  const checkboxes = document.querySelectorAll('.order-checkbox:checked');
  if (checkboxes.length === 0) {
    toast('出力する指示書を選択してください', 'warning');
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

  toast('ギャラリーを生成中...', 'info');

  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }

  // Build HTML
  let html = \`
  <div style="padding: 20px; text-align: center;">
    <h2 style="margin-bottom: 10px;">📋 QRコード一覧 (Excelコピペ用)</h2>
    <p style="color: #555; margin-bottom: 20px;">画像を右クリックして「画像をコピー」し、Excelに貼り付けてください。</p>
    <button onclick="document.getElementById('qr-gallery-modal').remove()" style="margin-bottom: 30px; padding: 10px 20px; font-size: 16px; cursor: pointer; background: #6b7280; color: white; border: none; border-radius: 4px;">閉じる</button>
    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px;">
  \`;

  for (let data of qrDataList) {
    try {
      const qr = qrcode(0, 'L');
      qr.addData(data.text);
      qr.make();
      // Use size 6 for good quality
      const dataUrl = qr.createDataURL(6, 0);
      
      html += \`
      <div style="border: 1px solid #ccc; background: #fff; padding: 15px; width: 160px; text-align: center; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <img src="\${dataUrl}" alt="QR" style="max-width: 100%; display: block; margin: 0 auto 10px auto;">
        <div style="font-size: 11px; font-weight: bold; color: #333; line-height: 1.4;">
          \${data.projectName}<br>
          \${data.productName}<br>
          <span style="color: #2563eb;">\${data.bomName}</span>
        </div>
      </div>\`;
    } catch (e) {
      console.error('QR生成エラー:', e);
    }
  }

  html += \`
    </div>
  </div>
  \`;

  // Create Modal
  let modal = document.getElementById('qr-gallery-modal');
  if (modal) modal.remove();
  
  modal = document.createElement('div');
  modal.id = 'qr-gallery-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.backgroundColor = '#f3f4f6';
  modal.style.overflowY = 'auto';
  modal.style.zIndex = '999999';
  modal.innerHTML = html;
  
  document.body.appendChild(modal);
}
`;
          // Replace from startIdx to the end of the file. (Since downloadQrZip is the last function added!)
          // Wait, is it the last function?
          // Let's do a substring replace to be safe.
          const endIdx = code.indexOf('zip.generateAsync', startIdx);
          // If we just cut from startIdx to the end of the file, it's safer assuming it was appended at the end.
          // Let's check if there is anything after downloadQrZip.
          code = beforeFunc + newFunc;
          fs.writeFileSync(filename, code);
      }
  }
}

patchJs('index.html');
patchJs('app.js');
patchJs('app-mobile.js');
console.log('Gallery feature added');
