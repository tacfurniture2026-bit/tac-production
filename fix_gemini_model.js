const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Replace gemini-1.5-flash with gemini-pro which is universally supported
  code = code.replace(/gemini-1\.5-flash/g, 'gemini-pro');

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('Model switched to gemini-pro');
