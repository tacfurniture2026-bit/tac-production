const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Modify stop functions to return Promises
  code = code.replace(/function stopQrScanner\(\) \{[\s\S]*?if \(qrScanner\) \{[\s\S]*?qrScanner\.stop\(\)\.then\(\(\) => \{[\s\S]*?qrScanner\.clear\(\);[\s\S]*?qrScanner = null;[\s\S]*?\}\)\.catch\(err => console\.log\(err\)\);[\s\S]*?\}/m, match => {
      return match.replace(
          /if \(qrScanner\) \{[\s\S]*?qrScanner\.stop\(\)\.then\(\(\) => \{[\s\S]*?qrScanner\.clear\(\);[\s\S]*?qrScanner = null;[\s\S]*?\}\)\.catch\(err => console\.log\(err\)\);[\s\S]*?\}/,
          `let p = Promise.resolve();
  if (qrScanner) {
    p = qrScanner.stop().then(() => {
      qrScanner.clear();
      qrScanner = null;
    }).catch(err => console.log(err));
  }
  return p;`
      );
  });
  
  code = code.replace(/function stopDefectQrScanner\(\) \{[\s\S]*?if \(defectQrScanner\) \{[\s\S]*?defectQrScanner\.stop\(\)\.then\(\(\) => \{[\s\S]*?defectQrScanner\.clear\(\);[\s\S]*?defectQrScanner = null;[\s\S]*?\}\)\.catch\(err => console\.log\(err\)\);[\s\S]*?\}/m, match => {
      return match.replace(
          /if \(defectQrScanner\) \{[\s\S]*?defectQrScanner\.stop\(\)\.then\(\(\) => \{[\s\S]*?defectQrScanner\.clear\(\);[\s\S]*?defectQrScanner = null;[\s\S]*?\}\)\.catch\(err => console\.log\(err\)\);[\s\S]*?\}/,
          `let p = Promise.resolve();
  if (defectQrScanner) {
    p = defectQrScanner.stop().then(() => {
      defectQrScanner.clear();
      defectQrScanner = null;
    }).catch(err => console.log(err));
  }
  return p;`
      );
  });
  
  code = code.replace(/function stopInvScanner\(\) \{[\s\S]*?if \(invScanner\) \{[\s\S]*?invScanner\.stop\(\)\.then\(\(\) => \{[\s\S]*?invScanner\.clear\(\);[\s\S]*?invScanner = null;[\s\S]*?\}\)\.catch\(err => console\.log\(err\)\);[\s\S]*?\}/m, match => {
      return match.replace(
          /if \(invScanner\) \{[\s\S]*?invScanner\.stop\(\)\.then\(\(\) => \{[\s\S]*?invScanner\.clear\(\);[\s\S]*?invScanner = null;[\s\S]*?\}\)\.catch\(err => console\.log\(err\)\);[\s\S]*?\}/,
          `let p = Promise.resolve();
  if (invScanner) {
    p = invScanner.stop().then(() => {
      invScanner.clear();
      invScanner = null;
    }).catch(err => console.log(err));
  }
  return p;`
      );
  });

  // Now modify start functions to await stopping
  code = code.replace(/function startQrScanner\(\) \{/g, 'async function startQrScanner() {');
  code = code.replace(/function startDefectQrScanner\(\) \{/g, 'async function startDefectQrScanner() {');
  code = code.replace(/function startInvScanner\(\) \{/g, 'async function startInvScanner() {');

  code = code.replace(/if \(typeof stopDefectQrScanner === 'function'\) stopDefectQrScanner\(\);/g, "if (typeof stopDefectQrScanner === 'function') await stopDefectQrScanner();");
  code = code.replace(/if \(typeof stopInvScanner === 'function'\) stopInvScanner\(\);/g, "if (typeof stopInvScanner === 'function') await stopInvScanner();");
  code = code.replace(/if \(typeof stopQrScanner === 'function'\) stopQrScanner\(\);/g, "if (typeof stopQrScanner === 'function') await stopQrScanner();");

  // Also hook into navigateTo to stop all scanners
  const navPatch = `
  // Stop any running scanners when changing pages
  if (typeof stopQrScanner === 'function') stopQrScanner();
  if (typeof stopDefectQrScanner === 'function') stopDefectQrScanner();
  if (typeof stopInvScanner === 'function') stopInvScanner();

  // ページ切り替え`;
  if (!code.includes('stop any running scanners')) {
      code = code.replace('// ページ切り替え', navPatch);
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('JS scanner logic patched');
