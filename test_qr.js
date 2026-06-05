const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Execute qrcode.js
const code = fs.readFileSync('qrcode.min.js', 'utf8');
// wait, qrcode.min.js is not locally downloaded. Let me download it.
const code = fs.readFileSync('qrcode.min.js', 'utf8');
eval(code);

try {
  let div = document.createElement('div');
  new window.QRCode(div, {
    text: JSON.stringify({ project: "日本語テスト", product: "とても長い日本語のテストです", bom: "あいうえおかきくけこ" }),
    correctLevel: window.QRCode.CorrectLevel.M
  });
  console.log("Success with raw Japanese!");
} catch (e) {
  console.error("Failed with raw Japanese:", e.message);
}

try {
  let div2 = document.createElement('div');
  let raw = JSON.stringify({ project: "日本語テスト", product: "とても長い日本語のテストです", bom: "あいうえおかきくけこ" });
  let encoded = unescape(encodeURIComponent(raw));
  new window.QRCode(div2, {
    text: encoded,
    correctLevel: window.QRCode.CorrectLevel.M
  });
  console.log("Success with unescape(encodeURIComponent())!");
} catch (e) {
  console.error("Failed with unescape(encodeURIComponent()):", e.message);
}
