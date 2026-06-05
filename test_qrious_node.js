const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

const fs = require('fs');
const code = fs.readFileSync('node_modules/qrious/dist/qrious.js', 'utf8').catch ? "Error" : ""; 
// wait, I don't have qrious downloaded. Let's just download it via curl and run it.
