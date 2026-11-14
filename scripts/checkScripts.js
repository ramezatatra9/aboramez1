const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const scriptMatches = [...html.matchAll(/<script[^>]*src=['"]([^'"]+)['"][^>]*>/gi)];
scriptMatches.forEach(m => console.log(m[0]));
