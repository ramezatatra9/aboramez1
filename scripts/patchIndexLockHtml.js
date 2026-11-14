const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Make pinLockScreen display: flex by default
html = html.replace('id="pinLockScreen" class="pin-lock-overlay" style="display:none;"', 'id="pinLockScreen" class="pin-lock-overlay" style="display:flex;"');

// 2. Hide pinUserPills
const pillsTarget = '<div class="pin-user-pills" id="pinUserPills">';
if (html.includes(pillsTarget)) {
  html = html.replace(pillsTarget, '<div class="pin-user-pills" id="pinUserPills" style="display:none !important;">');
  console.log('✅ Hidden pinUserPills in index.html');
}

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log('✅ index.html saved');
