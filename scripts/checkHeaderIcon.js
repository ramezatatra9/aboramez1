const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

const brandIdx = html.indexOf('class="brand-icon"');
console.log('brand-icon index:', brandIdx);
if (brandIdx !== -1) {
  console.log(html.slice(brandIdx - 50, brandIdx + 200));
}
