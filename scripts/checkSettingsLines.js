const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');
const lines = appJs.split('\n');
console.log(lines.slice(1545, 1600).join('\n'));
