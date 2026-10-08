const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Replace dataUrlToJpegBlob to dataUrlToPngBlob
  code = code.replace(/const dataUrlToJpegBlob =/g, 'const dataUrlToPngBlob =');
  code = code.replace(/image\/jpeg/g, 'image/png');
  // Remove the quality parameter 1.0 since png doesn't use it
  code = code.replace(/, 'image\/png', 1\.0/g, ", 'image/png'");
  
  // Update usage
  code = code.replace(/const jpegBlob = await dataUrlToJpegBlob\(gifDataUrl\);/g, 'const pngBlob = await dataUrlToPngBlob(gifDataUrl);');
  
  // Update filename to .png
  code = code.replace(/\.jpeg/g, '.png');
  
  // Update blob variable name in folder.file
  code = code.replace(/folder\.file\(filename, jpegBlob\);/g, 'folder.file(filename, pngBlob);');

  // Update ZIP filename logic
  const oldZipLogic = 'a.download = "QR_Codes.zip";';
  const newZipLogic = `
    const safeFilename = (name) => (name || '').replace(/[\\\\/:*?"<>|]/g, '-').trim();
    let zipFilename = "QR_Codes.zip";
    if (orders && orders.length > 0) {
        let base = \`\${safeFilename(orders[0].projectName)}_\${safeFilename(orders[0].productName)}\`;
        zipFilename = orders.length > 1 ? \`\${base}_他.zip\` : \`\${base}.zip\`;
    }
    a.download = zipFilename;`;
    
  if (code.includes(oldZipLogic)) {
      code = code.replace(oldZipLogic, newZipLogic);
  }

  // Also change the folder name inside the ZIP to match
  const oldFolder = 'const folder = zip.folder("QR_Codes");';
  const newFolder = `
  const safeFilename2 = (name) => (name || '').replace(/[\\\\/:*?"<>|]/g, '-').trim();
  let folderName = "QR_Codes";
  if (orders && orders.length > 0) {
      let base = \`\${safeFilename2(orders[0].projectName)}_\${safeFilename2(orders[0].productName)}\`;
      folderName = orders.length > 1 ? \`\${base}_他\` : base;
  }
  const folder = zip.folder(folderName);`;
  
  if (code.includes(oldFolder)) {
      code = code.replace(oldFolder, newFolder);
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('ZIP download patched for PNG and Filenames');
