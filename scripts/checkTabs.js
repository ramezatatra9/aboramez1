const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const tabs = [...html.matchAll(/id=['"]tab-([^'"]+)['"]/g)].map(m => m[1]);
console.log('Existing tabs in index.html:', tabs);
const navBtns = [...html.matchAll(/data-tab=['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log('Nav buttons:', [...new Set(navBtns)]);
