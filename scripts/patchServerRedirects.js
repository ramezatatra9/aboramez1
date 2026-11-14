const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let code = fs.readFileSync(serverPath, 'utf8');

const legacyRedirectsCode = `
// ================================================================
// إعادة التوجيه التلقائي للمسارات الإدارية القديمة إلى /admin/...
// لمنع الوصول المباشر من النطاق العام وإلزام استخدام بادئة /admin/
// ================================================================
const ADMIN_LEGACY_REDIRECT_MAP = {
  '/create-invoice': '/admin/create-invoice',
  '/new-invoice': '/admin/create-invoice',
  '/pos': '/admin/pos',
  '/home': '/admin/home',
  '/catalog': '/admin/home',
  '/customers': '/admin/customers',
  '/suppliers': '/admin/customers',
  '/invoices': '/admin/invoices',
  '/invoices-list': '/admin/invoices',
  '/receipts': '/admin/receipts',
  '/vouchers': '/admin/receipts',
  '/inventory': '/admin/inventory',
  '/stocktake': '/admin/inventory',
  '/warranties': '/admin/warranties',
  '/dashboard': '/admin/dashboard',
  '/settings': '/admin/settings',
  '/brands-audit': '/admin/brands-audit',
  '/store-manager': '/admin/store'
};

app.use((req, res, next) => {
  const cleanPath = req.path.toLowerCase().replace(/\\/+$/, '');
  const targetAdminRoute = ADMIN_LEGACY_REDIRECT_MAP[cleanPath];
  if (targetAdminRoute) {
    return res.redirect(302, targetAdminRoute);
  }
  next();
});
`;

if (!code.includes('ADMIN_LEGACY_REDIRECT_MAP')) {
  // Place it right before "app.get(['/', '/store', '/shop']"
  const target = "app.get(['/', '/store', '/shop'], (req, res) => {";
  if (code.includes(target)) {
    code = code.replace(target, legacyRedirectsCode + '\n' + target);
    console.log('✅ Added ADMIN_LEGACY_REDIRECT_MAP middleware to server.js');
  } else {
    console.error('❌ Target for redirect map not found in server.js');
  }
} else {
  console.log('ℹ️ ADMIN_LEGACY_REDIRECT_MAP already in server.js');
}

fs.writeFileSync(serverPath, code, 'utf8');
console.log('✅ server.js saved');
