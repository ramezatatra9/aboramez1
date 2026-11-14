const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');

const idx = appJs.indexOf('function applySettingsToUI()');
console.log(appJs.slice(idx, idx + 1200));
