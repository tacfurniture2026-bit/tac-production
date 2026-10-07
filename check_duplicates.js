const fs = require('fs');
let dbContent = fs.readFileSync('data.js', 'utf8');

// Mock DB
const DB = { KEYS: { INV_LOGS: 'pms_inv_logs' } };
const match = dbContent.match(/localStorage\.setItem\('pms_inv_logs',\s*JSON\.stringify\((.*?)\)\)/);
let logs = [];
if (match) {
    // We can't parse it easily if it's dynamic. Let's just run in a browser env.
}

// Instead, let's extract it manually from localStorage backup
