const fs = require('fs');

const appJs = fs.readFileSync('public/js/app.js', 'utf8');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');

console.log('=== Checking Auth in index.html ===');
const ids = [...indexHtml.matchAll(/id=["']([^"']*(login|auth|lock|pass|pin)[^"']*)["']/gi)].map(m => m[1]);
console.log('Auth-related IDs in index.html:', ids);

console.log('\n=== Checking Auth in app.js ===');
const authLines = appJs.split('\n').filter(l => l.includes('pinLock') || l.includes('lockScreen') || l.includes('currentUser') || l.includes('SETTINGS_PASSWORD') || l.includes('checkLogin') || l.includes('sessionStorage'));
console.log('Found', authLines.length, 'auth related lines. First 15:');
authLines.slice(0, 15).forEach(l => console.log('  ' + l.trim().slice(0, 120)));
