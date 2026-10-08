const fs = require('fs');

let code = fs.readFileSync('mobile_source.html', 'utf8');

if (!code.includes('<div id="mobile-version-display"')) {
    const target = /<\/div>\s*<\/div>\s*<\/div>\s*<!-- トースト通知 -->/g;
    const versionHtml = `
            <div id="mobile-version-display" style="text-align: right; padding: 1rem; color: #a1a1aa; font-size: 0.8rem;">
                Version: v6.44.0
            </div>
        </div>
    </div>
</div>
<!-- トースト通知 -->`;
    code = code.replace(target, versionHtml);
}

fs.writeFileSync('mobile_source.html', code);
console.log('Mobile version display injected');
