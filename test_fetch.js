const fs = require('fs');
const oldData = JSON.parse(fs.readFileSync('data/new_master.json'));
console.log(oldData.length);
