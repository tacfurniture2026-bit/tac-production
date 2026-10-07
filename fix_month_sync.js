const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  // Update inv-check-month when Excel import happens
  const oldCode = `toast('Excelデータの取り込みが完了しました。', 'success');`;
  const newCode = `toast('Excelデータの取り込みが完了しました。', 'success');
          // 取込月の選択状態をチェック画面にも同期させる
          if (monthInput && monthInput.value) {
            const checkMonth = document.getElementById('inv-check-month');
            const summaryMonth = document.getElementById('inv-closing-month');
            if (checkMonth) checkMonth.value = monthInput.value;
            if (summaryMonth) summaryMonth.value = monthInput.value;
          }
          // すぐに再描画
          if (typeof renderInvCheckPage === 'function') renderInvCheckPage();`;
          
  code = code.replace(oldCode, newCode);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Month sync fix applied');
