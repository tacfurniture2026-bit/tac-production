const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

const code = fs.readFileSync('qrcode.min.js', 'utf8');
eval(code);

let div = document.createElement('div');
let longStr = "A".repeat(1600); // 1600 bytes
try {
  new window.QRCode(div, {
    text: longStr,
    correctLevel: window.QRCode.CorrectLevel.M
  });
  console.log("Success with 1600 bytes!");
} catch (e) {
  console.error("Error at M:", e.message);
}

try {
  new window.QRCode(div, {
    text: longStr,
    correctLevel: window.QRCode.CorrectLevel.L
  });
  console.log("Success with 1600 bytes at L!");
} catch (e) {
  console.error("Error at L:", e.message);
}
