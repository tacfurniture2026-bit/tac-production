const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Add an HTML index file inside the ZIP for easy copy-pasting
  const targetLine = 'folder.file(filename, pngBlob);';
  
  if (code.includes(targetLine) && !code.includes('htmlContent +=')) {
      // First, add the html string initialization before the loop
      const loopStart = 'for (let data of qrDataList) {';
      const newLoopStart = `
  let htmlContent = \`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>QRコード一覧</title>
<style>
  body { font-family: sans-serif; padding: 20px; }
  .qr-item { display: inline-block; margin: 15px; text-align: center; border: 1px solid #ccc; padding: 10px; background: #fff; }
  .qr-item img { display: block; margin: 0 auto 10px auto; }
  .qr-info { font-size: 12px; font-weight: bold; color: #333; }
</style>
</head>
<body>
  <h2>QRコード一覧 (Excelへ直接コピー＆ペーストできます)</h2>
  <p>※画像を右クリックして「画像をコピー」し、Excelに貼り付けてください。</p>
  <div style="display: flex; flex-wrap: wrap;">
\`;
  for (let data of qrDataList) {`;
      code = code.replace(loopStart, newLoopStart);
      
      // Inside the loop, append to htmlContent
      const insideLoop = 'folder.file(filename, pngBlob);';
      const newInsideLoop = `folder.file(filename, pngBlob);
      htmlContent += \`
    <div class="qr-item">
      <img src="\${filename}" alt="\${data.bomName}">
      <div class="qr-info">\${data.projectName}<br>\${data.productName}<br>\${data.bomName}</div>
    </div>\`;`;
      code = code.replace(insideLoop, newInsideLoop);
      
      // After the loop, write the HTML file
      const loopEnd = 'zip.generateAsync({ type: "blob" }).then((content) => {';
      const newLoopEnd = `
  htmlContent += \`
  </div>
</body>
</html>\`;
  folder.file("一覧(Excelコピペ用).html", htmlContent);
  
  zip.generateAsync({ type: "blob" }).then((content) => {`;
      code = code.replace(loopEnd, newLoopEnd);
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('HTML copy-paste index added to ZIP');
