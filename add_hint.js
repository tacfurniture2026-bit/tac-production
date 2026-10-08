const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const targetHeader = /<h3>📊 分類別集計表<\/h3>/g;
  const newHeader = "<h3>📊 分類別集計表 <span style=\"font-size: 0.8rem; font-weight: normal; color: #64748b; margin-left: 10px;\">※行をクリックすると下の明細を絞り込みます</span></h3>";
  
  code = code.replace(targetHeader, newHeader);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Hint added');
