const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

const lockIdx = html.indexOf('id="pinLockScreen"');
console.log('Index of pinLockScreen:', lockIdx);
if (lockIdx !== -1) {
  console.log(html.slice(lockIdx - 50, lockIdx + 1600));
}
