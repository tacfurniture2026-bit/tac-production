const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');

const tThead = /<th>差分<\/th>\s*<th>在庫金額<\/th>/g;
console.log('Thead match:', code.match(tThead) ? 'YES' : 'NO');

const tTdata = /<td style="color: \$\{safeNum\(i\.diff\) >= 0 \? 'green' : 'red'\};">\$\{safeNum\(i\.diff\) >= 0 \? '\+' : ''\}\$\{safeNum\(i\.diff\)\}<\/td>\s*<td>¥\$\{safeNum\(i\.amount\)\.toLocaleString\(\)\}<\/td>/g;
console.log('Tdata match:', code.match(tTdata) ? 'YES' : 'NO');
