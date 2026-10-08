const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');

const tNormal = /summaryRows \+= `<tr><td>\$\{code\}: \$\{s\.name\}<\/td><td style="text-align: right;">¥\$\{roundedAmount\.toLocaleString\(\)\}<\/td><td style="text-align: right; color: \$\{roundedDiff >= 0 \? 'green' : 'red'\};">\$\{roundedDiff >= 0 \? '\+' : ''\}¥\$\{roundedDiff\.toLocaleString\(\)\}<\/td><\/tr>`;/g;
console.log('Normal match:', code.match(tNormal) ? 'YES' : 'NO');

const tFixed = /summaryRows \+= `<tr class="row-fixed-product"><td>不動品<\/td><td style="text-align: right;">¥\$\{roundedAmount\.toLocaleString\(\)\}<\/td><td style="text-align: right; color: \$\{roundedDiff >= 0 \? 'green' : 'red'\};">\$\{roundedDiff >= 0 \? '\+' : ''\}¥\$\{roundedDiff\.toLocaleString\(\)\}<\/td><\/tr>`;/g;
console.log('Fixed match:', code.match(tFixed) ? 'YES' : 'NO');

const tItem = /<tr class="\$\{i\.isFixed \? 'row-fixed-product' : ''\}">/g;
console.log('Item match:', code.match(tItem) ? 'YES' : 'NO');
