const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Replace aspect-ratio: 4 / 3 with 1 / 1 for all scanners
  code = code.replace(/aspect-ratio:\s*4\s*\/\s*3/g, 'aspect-ratio: 1 / 1');
  
  // Let's also increase max-width slightly for modern phones to make it look better
  // max-width: 320px -> max-width: 100% (or 360px)
  code = code.replace(/max-width:\s*320px/g, 'max-width: 360px');

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');
console.log('Camera frame aspect ratio and width fixed');
