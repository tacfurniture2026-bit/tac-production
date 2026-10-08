const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Update the success toast for ZIP download
  const oldToast = "toast('ZIPファイルのダウンロードが完了しました', 'success');";
  const newToast = "toast('✅ ダウンロード完了！\\n※Excelに貼る時は、必ずZIPファイルを「すべて展開（解凍）」してからドラッグ＆ドロップしてください', 'success');";
  
  if (code.includes(oldToast)) {
      code = code.replace(oldToast, newToast);
  }
  
  // Actually, toast might not support multiline perfectly without CSS, but alert is annoying.
  // Let's use a standard JS alert for this specific UX guidance since it's critical.
  const oldLogic = "toast('ZIPファイルのダウンロードが完了しました', 'success');";
  const newLogic = `
    toast('ZIPダウンロード完了', 'success');
    alert('【Excelに貼り付ける際のご注意】\\n\\nWindowsの仕様により、ダウンロードしたZIPファイル（チャックのアイコン）の中身をそのままExcelにドラッグ＆ドロップすることはできません。\\n\\n必ず、ZIPファイルを右クリックして「すべて展開（解凍）」を行い、展開された普通のフォルダの中から画像をドラッグ＆ドロップしてください。');
  `;
  
  if (code.includes(oldToast)) {
      code = code.replace(oldToast, newLogic);
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('ZIP download toast updated');
