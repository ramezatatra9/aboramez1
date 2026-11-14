const fs = require('fs');
const content = fs.readFileSync('public/js/pin-barcode.js', 'utf8');

const lines = content.split('\n');
const lockLines = [];
lines.forEach((l, idx) => {
  if (l.includes('pinLockScreen') || l.includes('verifyEnteredPin') || l.includes('PIN_SESSION_KEY') || l.includes('showLockScreen') || l.includes('unlockScreen')) {
    lockLines.push({ lineNum: idx + 1, text: l.trim() });
  }
});
console.log('Found', lockLines.length, 'lock references in pin-barcode.js:');
lockLines.slice(0, 30).forEach(l => console.log(l.lineNum + ': ' + l.text.slice(0, 100)));
