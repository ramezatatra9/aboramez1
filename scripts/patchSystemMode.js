const fs = require('fs');
const path = require('path');

const sysModePath = path.join(__dirname, '..', 'systemMode.js');
let code = fs.readFileSync(sysModePath, 'utf8');

const targetStr = "const SAFE_POST_ROUTES = [";
const replacementStr = `const SAFE_POST_ROUTES = [
  '/api/public/orders',
  '/api/store-config',
  '/api/admin/store-config',
  '/api/admin/store/custom-name',
  '/api/admin/store/toggle-manual-show',`;

if (!code.includes("'/api/public/orders'")) {
  code = code.replace(targetStr, replacementStr);
  console.log('✅ Added store routes to SAFE_POST_ROUTES');
}

const targetFunc = "if (/^\\/api\\/receipts\\/[^/]+\\/send-pdf-telegram$/.test(path)) return true;";
const replacementFunc = `if (/^\\/api\\/receipts\\/[^/]+\\/send-pdf-telegram$/.test(path)) return true;
  if (/^\\/api\\/admin\\/orders\\/[^/]+\\/(approve|cancel)$/.test(path)) return true;`;

if (!code.includes("orders/[^/]+/(approve|cancel)")) {
  code = code.replace(targetFunc, replacementFunc);
  console.log('✅ Added orders approve/cancel regex to isSafePostRoute');
}

fs.writeFileSync(sysModePath, code, 'utf8');
console.log('✅ systemMode.js saved');
