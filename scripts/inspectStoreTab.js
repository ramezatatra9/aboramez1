const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const sIdx = html.indexOf('id="tab-store-manager"');
console.log('Index of tab-store-manager:', sIdx);
if (sIdx !== -1) {
  console.log(html.slice(sIdx, sIdx + 1500));
}
