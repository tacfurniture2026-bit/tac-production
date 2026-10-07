const fs = require('fs');
const lz = fs.readFileSync('lz-string.js', 'utf8');

let dataJs = fs.readFileSync('data.js', 'utf8');
if (!dataJs.includes('LZString = ')) {
    // Inject LZString at the top of data.js
    dataJs = lz + '\n\n' + dataJs;
    
    // Replace localStorage.setItem in DB.save
    dataJs = dataJs.replace(
        /localStorage\.setItem\(key, JSON\.stringify\((.*?)\)\);/g,
        "localStorage.setItem(key, typeof LZString !== 'undefined' ? LZString.compressToUTF16(JSON.stringify($1)) : JSON.stringify($1));"
    );
    
    // Patch DB.get
    const oldGet = `
        // 未ロード、オフライン時、またはローカル専用時はローカルストレージから取得
        const data = localStorage.getItem(key);
        try {
            const parsed = data ? JSON.parse(data) : [];
    `;
    const newGet = `
        // 未ロード、オフライン時、またはローカル専用時はローカルストレージから取得
        let data = localStorage.getItem(key);
        if (data && !data.startsWith('[') && !data.startsWith('{')) {
            try {
                if (typeof LZString !== 'undefined') {
                    const decompressed = LZString.decompressFromUTF16(data);
                    if (decompressed) data = decompressed;
                }
            } catch(e) {
                console.warn('LZString decompress failed for', key);
            }
        }
        try {
            const parsed = data ? JSON.parse(data) : [];
    `;
    dataJs = dataJs.replace(oldGet, newGet);
    
    fs.writeFileSync('data.js', dataJs);
    console.log('LZString injected and DB patched.');
} else {
    console.log('Already patched.');
}
