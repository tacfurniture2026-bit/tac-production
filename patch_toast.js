const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  code = code.replace(/toast\('取り込み中にエラーが発生しました: ' \+ err\.message, 'error'\);/g, "toast('取り込み中にエラーが発生しました: ' + err.message, 'error'); alert('詳細エラー: ' + (err.stack || err));");
  code = code.replace(/toast\('月次締め処理の計算でエラーが発生しました', 'error'\);/g, "toast('月次締め処理の計算でエラーが発生しました', 'error'); alert('詳細エラー: ' + (err.stack || err));");
  
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Patched toast alerts');
