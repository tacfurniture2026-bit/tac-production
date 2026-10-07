const fs = require('fs');

let dataJs = fs.readFileSync('data.js', 'utf8');

const oldAuto = `
            if (key.startsWith('pms_')) {
                const raw = localStorage.getItem(key);
                if (raw && (raw.startsWith('[') || raw.startsWith('{'))) {
                    // 非圧縮データを発見。圧縮して保存し直す
                    const compressed = LZString.compressToUTF16(raw);
                    localStorage.setItem(key, compressed);
                    compressedCount++;
                }
            }
`;

const newAuto = `
            if (key.startsWith('pms_') && !key.includes('local_batch') && !key.includes('current_user') && !key.includes('last_backup')) {
                const raw = localStorage.getItem(key);
                if (raw && (raw.startsWith('[') || raw.startsWith('{'))) {
                    // 非圧縮データを発見。圧縮して保存し直す
                    const compressed = LZString.compressToUTF16(raw);
                    localStorage.setItem(key, compressed);
                    compressedCount++;
                }
            }
`;

dataJs = dataJs.replace(oldAuto, newAuto);
fs.writeFileSync('data.js', dataJs);
console.log('autoCompressDB fixed');
