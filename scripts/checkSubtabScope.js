const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');

const sIdx = appJs.indexOf('function switchStoreSubtab');
console.log(appJs.slice(sIdx - 500, sIdx + 500));
