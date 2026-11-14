const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');

const idx = appJs.indexOf('async function saveSettings(');
if (idx === -1) {
  const idx2 = appJs.indexOf('saveSettings');
  console.log('saveSettings index:', idx2);
  console.log(appJs.slice(idx2, idx2 + 800));
} else {
  console.log(appJs.slice(idx, idx + 800));
}
