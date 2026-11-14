const fs = require('fs');
const appJs = fs.readFileSync('public/js/app.js', 'utf8');

const storeManagerStart = appJs.indexOf('// لوحة تحكم إدارة المتجر الإلكتروني العام والطلبات');
const storeCode = appJs.slice(storeManagerStart);

// Find all function calls in storeCode: foo(...)
const calls = [...storeCode.matchAll(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g)].map(m => m[1]);
const uniqueCalls = [...new Set(calls)];

const knownGlobals = new Set([
  'fetch', 'setTimeout', 'setInterval', 'alert', 'confirm', 'prompt', 'parseInt', 'parseFloat',
  'String', 'Number', 'Boolean', 'Date', 'Promise', 'Math', 'JSON', 'FormData', 'encodeURIComponent',
  'decodeURIComponent', 'showToast', 'escapeHtml', 'actuallySwitchTab', 'loadProducts', 'switchTab'
]);

console.log('Unique function calls in store manager code:', uniqueCalls.length);
const missing = [];
uniqueCalls.forEach(fn => {
  if (knownGlobals.has(fn)) return;
  // check if defined in appJs as function fn
  const isDefined = appJs.includes(`function ${fn}`) || appJs.includes(`const ${fn} =`) || appJs.includes(`let ${fn} =`) || appJs.includes(`var ${fn} =`);
  if (!isDefined) {
    missing.push(fn);
  }
});
console.log('Potentially missing functions in app.js:', missing);
