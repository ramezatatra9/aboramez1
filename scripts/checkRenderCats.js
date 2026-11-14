const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');

const fnIdx = appJs.indexOf('function renderAdminCategories');
console.log('renderAdminCategories index:', fnIdx);
if (fnIdx !== -1) {
  console.log(appJs.slice(fnIdx, fnIdx + 1200));
}
