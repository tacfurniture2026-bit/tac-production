const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Replace v1beta/models/gemini-pro with v1/models/gemini-1.5-flash
  code = code.replace(/\/v1beta\/models\/gemini-pro/g, '/v1/models/gemini-1.5-flash');

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('API version changed to v1 and model to gemini-1.5-flash');
