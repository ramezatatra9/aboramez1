const fs = require('fs');
const lines = fs.readFileSync('telegramService.js', 'utf8').split('\n');
lines[944] = '  },';
fs.writeFileSync('telegramService.js', lines.join('\n'), 'utf8');
console.log('Fixed line 945');
