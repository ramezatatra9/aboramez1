const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const sIdx = html.indexOf('id="tab-store-manager"');
console.log(html.slice(sIdx + 1000, sIdx + 3000));
