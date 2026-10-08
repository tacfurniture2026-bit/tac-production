const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Change the model back to gemini-3.8-flash which is the correct model for 2026
  code = code.replace(/models\/gemini-1\.5-flash/g, 'models/gemini-3.8-flash');

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('Model reverted to gemini-3.8-flash');
