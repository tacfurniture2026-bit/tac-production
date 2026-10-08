const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Remove the getGeminiModelUrl helper
  code = code.replace(/window\.getGeminiModelUrl = async function\(apiKey\) \{[\s\S]*?\};\n/, '');

  // Replace getGeminiModelUrl calls with hardcoded gemini-3.8-flash
  code = code.replace(
      /const url = await window\.getGeminiModelUrl\(apiKey\);/g,
      'const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;'
  );

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('Reverted to gemini-3.8-flash for the mock environment');
