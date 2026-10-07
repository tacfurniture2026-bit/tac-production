const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const healerCode = `
// 【究極の自動修復機能】商品マスタの重複やゴミデータを起動時に完全クリーンアップ
(function healMasterData() {
  try {
    let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
    let initialCount = products.length;
    if (initialCount === 0) return;

    // 1. TEMP_商品はすべて削除（エクセルでIDがなかったゴミデータ）
    products = products.filter(p => p.id && !String(p.id).startsWith('TEMP_') && p.id !== 'META_F1_TOTAL');

    // 2. IDの完全重複を排除
    const uniqueById = new Map();
    products.forEach(p => {
      // 同じIDなら、後勝ち（最新）を残す
      uniqueById.set(p.id, p);
    });
    products = Array.from(uniqueById.values());

    if (products.length !== initialCount) {
      console.log(\`Healed master data: removed \${initialCount - products.length} invalid/duplicate products.\`);
      DB.save(DB.KEYS.INV_PRODUCTS, products);
    }
  } catch(e) {
    console.error('Heal master failed', e);
  }
})();
`;
  
  // Insert at the bottom of the file
  if (!code.includes('healMasterData')) {
    code += '\n' + healerCode;
    fs.writeFileSync(filename, code);
  }
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Master healer applied');
