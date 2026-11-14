const fs = require('fs');
const storeHtml = fs.readFileSync('public/store.html', 'utf8');

const fnIdx = storeHtml.indexOf('function renderCompanyInfo()');
console.log(storeHtml.slice(fnIdx, fnIdx + 1200));
