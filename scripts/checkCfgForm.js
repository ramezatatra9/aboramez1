const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

const cfgIdx = html.indexOf('id="cfgCompanyName"');
console.log('cfgCompanyName index:', cfgIdx);
if (cfgIdx !== -1) {
  console.log(html.slice(cfgIdx - 150, cfgIdx + 400));
}
