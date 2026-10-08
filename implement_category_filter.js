const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // 1. Add interactive classes to Category Summary Rows
  const tNormal = /summaryRows \+= `<tr><td>\$\{code\}: \$\{s\.name\}<\/td><td style="text-align: right;">¥\$\{roundedAmount\.toLocaleString\(\)\}<\/td><td style="text-align: right; color: \$\{roundedDiff >= 0 \? 'green' : 'red'\};">\$\{roundedDiff >= 0 \? '\+' : ''\}¥\$\{roundedDiff\.toLocaleString\(\)\}<\/td><\/tr>`;/g;
  const newNormal = "summaryRows += `<tr class=\"category-summary-row\" data-cat=\"${code}\" onclick=\"filterInvMonthlyItems('${code}')\" style=\"cursor:pointer; transition: background-color 0.2s;\" title=\"クリックでこの分類のみ表示\"><td>${code}: ${s.name}</td><td style=\"text-align: right;\">¥${roundedAmount.toLocaleString()}</td><td style=\"text-align: right; color: ${roundedDiff >= 0 ? 'green' : 'red'};\">${roundedDiff >= 0 ? '+' : ''}¥${roundedDiff.toLocaleString()}</td></tr>`;";
  code = code.replace(tNormal, newNormal);

  const tFixed = /summaryRows \+= `<tr class="row-fixed-product"><td>不動品<\/td><td style="text-align: right;">¥\$\{roundedAmount\.toLocaleString\(\)\}<\/td><td style="text-align: right; color: \$\{roundedDiff >= 0 \? 'green' : 'red'\};">\$\{roundedDiff >= 0 \? '\+' : ''\}¥\$\{roundedDiff\.toLocaleString\(\)\}<\/td><\/tr>`;/g;
  const newFixed = "summaryRows += `<tr class=\"category-summary-row row-fixed-product\" data-cat=\"fixed\" onclick=\"filterInvMonthlyItems('fixed')\" style=\"cursor:pointer; transition: background-color 0.2s;\" title=\"クリックで不動品のみ表示\"><td>不動品</td><td style=\"text-align: right;\">¥${roundedAmount.toLocaleString()}</td><td style=\"text-align: right; color: ${roundedDiff >= 0 ? 'green' : 'red'};\">${roundedDiff >= 0 ? '+' : ''}¥${roundedDiff.toLocaleString()}</td></tr>`;";
  code = code.replace(tFixed, newFixed);

  // 2. Add classes to Items Detail Rows
  const tItem = /<tr class="\$\{i\.isFixed \? 'row-fixed-product' : ''\}">/g;
  const newItem = "<tr class=\"inv-monthly-item-row category-${i.isFixed ? 'fixed' : (i.category || '99')} ${i.isFixed ? 'row-fixed-product' : ''}\">";
  code = code.replace(tItem, newItem);

  // 3. Add Amount Difference Column
  const tThead = /<th>差分<\/th>\s*<th>在庫金額<\/th>/g;
  const newThead = "<th>差分</th>\n                <th>在庫金額</th>\n                <th>金額差</th>";
  code = code.replace(tThead, newThead);

  const tTdata = /<td style="color: \$\{safeNum\(i\.diff\) >= 0 \? 'green' : 'red'\};">\$\{safeNum\(i\.diff\) >= 0 \? '\+' : ''\}\$\{safeNum\(i\.diff\)\}<\/td>\s*<td>¥\$\{safeNum\(i\.amount\)\.toLocaleString\(\)\}<\/td>/g;
  const newTdata = `<td style="color: \${safeNum(i.diff) >= 0 ? 'green' : 'red'};">\${safeNum(i.diff) >= 0 ? '+' : ''}\${safeNum(i.diff)}</td>
                  <td>¥\${safeNum(i.amount).toLocaleString()}</td>
                  <td style="color: \${(safeNum(i.amount) - safeNum(i.prevAmount)) >= 0 ? 'green' : 'red'};">\${(safeNum(i.amount) - safeNum(i.prevAmount)) >= 0 ? '+' : ''}¥\${(safeNum(i.amount) - safeNum(i.prevAmount)).toLocaleString()}</td>`;
  code = code.replace(tTdata, newTdata);

  // 4. Inject the JS function globally
  if (!code.includes('window.filterInvMonthlyItems')) {
      const jsFunc = `
// 分類別明細フィルタリング機能
window.currentInvMonthlyFilter = null;
window.filterInvMonthlyItems = function(catKey) {
  const rows = document.querySelectorAll('.inv-monthly-item-row');
  let showingAll = false;
  
  if (window.currentInvMonthlyFilter === String(catKey)) {
    window.currentInvMonthlyFilter = null;
    showingAll = true;
  } else {
    window.currentInvMonthlyFilter = String(catKey);
  }
  
  rows.forEach(r => {
    if (showingAll || r.classList.contains('category-' + catKey)) {
      r.style.display = '';
    } else {
      r.style.display = 'none';
    }
  });

  document.querySelectorAll('.category-summary-row').forEach(r => {
    if (r.dataset.cat === window.currentInvMonthlyFilter) {
      r.style.backgroundColor = '#e2e8f0'; // Tailwind gray-200
      r.style.fontWeight = 'bold';
    } else {
      r.style.backgroundColor = '';
      r.style.fontWeight = 'normal';
    }
  });
};
`;
      // Append it right before displayInvMonthlyResult or at the end
      code += jsFunc;
  }

  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('Category filter implemented');
