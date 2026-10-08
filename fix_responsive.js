const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Replace the custom body css injected earlier
  const oldBodyCss = 'body { overflow-x: hidden; max-width: 100vw; }';
  const newBodyCss = `html, body { 
    width: 100vw; 
    max-width: 100vw; 
    overflow-x: hidden; 
    margin: 0; 
    padding: 0; 
    box-sizing: border-box; 
  }
  * { box-sizing: inherit; }
  .main-content, .page { max-width: 100vw; width: 100%; overflow-x: hidden; }
  .card { max-width: 100%; overflow: hidden; }
  .card-body { max-width: 100%; overflow-x: hidden; }
  .qr-layout { max-width: 100%; overflow: hidden; }`;

  if (code.includes(oldBodyCss)) {
      code = code.replace(oldBodyCss, newBodyCss);
  } else {
      // If it doesn't contain oldBodyCss (e.g. index.html doesn't have it), we prepend it to styles
      if (filename === 'index.html' && !code.includes('html, body { \n    width: 100vw;')) {
          code = code.replace('<style>', '<style>\n' + newBodyCss);
      }
  }
  
  // Replace the table-container CSS to force max-width
  const oldTable = `.table-container { 
    overflow-x: auto !important; 
    -webkit-overflow-scrolling: touch; 
    width: 100%; 
    padding-bottom: 10px; /* Space for scrollbar */
  }`;
  const newTable = `.table-container { 
    overflow-x: auto !important; 
    -webkit-overflow-scrolling: touch; 
    width: 100%; 
    max-width: 100%;
    padding-bottom: 10px;
  }`;
  if (code.includes(oldTable)) {
      code = code.replace(oldTable, newTable);
  }

  // Defect Scanner Preview hardcoded aspect ratio
  code = code.replace(/aspect-ratio: 1 \/ 1/g, "aspect-ratio: 1 / 1");
  // Ensure scanner width is 100% up to 360px
  code = code.replace(/max-width: 360px/g, "max-width: 100%");

  // QR result wrapper might also push width. Let's make sure it wraps word.
  const oldData = '<div id="defect-scan-data" style="font-size: 14px;"></div>';
  const newData = '<div id="defect-scan-data" style="font-size: 14px; word-break: break-all;"></div>';
  code = code.replace(oldData, newData);

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');
console.log('HTML responsive rules added');
