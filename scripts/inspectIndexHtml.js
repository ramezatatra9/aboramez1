const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');

const navIdx = html.indexOf('data-tab="settings"');
console.log('Index of settings tab in nav:', navIdx);
if (navIdx !== -1) {
  console.log('=== Surrounding HTML in Navbar ===');
  console.log(html.slice(navIdx - 300, navIdx + 300));
}

const tabIdx = html.indexOf('id="tab-settings"');
console.log('\nIndex of tab-settings:', tabIdx);
if (tabIdx !== -1) {
  console.log('=== Surrounding HTML around tab-settings ===');
  console.log(html.slice(tabIdx - 200, tabIdx + 300));
}
