const fs = require('fs');
const xlsx = require('xlsx');

let appJs = fs.readFileSync('app.js', 'utf8');

const calcFuncMatch = appJs.match(/function calculateInvMonthly[\s\S]*?\n\}/);
const funcCode = calcFuncMatch ? calcFuncMatch[0] : '';

// We just want to find out what throws an error, or if anything throws an error.
// The user said: "４月を取り込むと最終的に取り込みエラー発生。"

