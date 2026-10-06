const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');

// We just want to test if the regex actually replaced it.
console.log("Check if sheet['F1'] is in app.js:", appJs.includes("sheet['F1']"));
