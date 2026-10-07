const fs = require('fs');
let code = fs.readFileSync('test_mar_calc_run.js', 'utf8');
code = code.replace(/if \(k === 'b'\) return \[\{.*\}\];/g, "if (k === 'b') return [];");
fs.writeFileSync('test_mar_calc_no_logs.js', code);
