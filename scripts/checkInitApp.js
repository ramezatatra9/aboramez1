const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');

const initAppIdx = appJs.indexOf('async function initApp()');
console.log('initApp index:', initAppIdx);
if (initAppIdx !== -1) {
  console.log(appJs.slice(initAppIdx, initAppIdx + 2000));
}
