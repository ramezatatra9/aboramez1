const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

let changed = 0;

// 1. Fix initialPath parsing to support /admin/xxx paths
const oldInitialPath = `  // قراءة المسار المباشر من المتصفح (SPA Router) لفتح الصفحة المطلوبة فوراً\r\n  const initialPath = window.location.pathname.replace(/^\\/+/, '').split('/')[0].toLowerCase();\r\n  const initialTab = ROUTE_MAP[initialPath] || 'catalog';`;
const newInitialPath = `  // قراءة المسار المباشر من المتصفح (SPA Router) لفتح الصفحة المطلوبة فوراً\r\n  // دعم /admin/xxx أو /xxx (للتوافق مع الإصدارات القديمة)\r\n  const pathParts = window.location.pathname.replace(/^\\/+/, '').split('/');\r\n  const isAdminPath = pathParts[0].toLowerCase() === 'admin';\r\n  const initialPath = (isAdminPath ? (pathParts[1] || '') : pathParts[0]).toLowerCase();\r\n  const initialTab = ROUTE_MAP[initialPath] || 'catalog';`;
if (content.includes(oldInitialPath)) {
  content = content.replace(oldInitialPath, newInitialPath);
  changed++;
  console.log('✅ Fixed initialPath parsing');
} else {
  // Try LF version
  const oldLF = oldInitialPath.replace(/\r\n/g, '\n');
  const newLF = newInitialPath.replace(/\r\n/g, '\n');
  if (content.includes(oldLF)) {
    content = content.replace(oldLF, newLF);
    changed++;
    console.log('✅ Fixed initialPath parsing (LF)');
  } else {
    console.log('⚠️ Could not find initialPath block - searching for key line...');
    // Try a simpler approach - just replace the one-line match
    const simpleLine = `  const initialPath = window.location.pathname.replace(/^\\/+/, '').split('/')[0].toLowerCase();`;
    if (content.includes(simpleLine)) {
      const replacement = `  // دعم /admin/xxx أو /xxx (للتوافق مع الإصدارات القديمة)\r\n  const pathParts = window.location.pathname.replace(/^\\/+/, '').split('/');\r\n  const isAdminPath = pathParts[0].toLowerCase() === 'admin';\r\n  const initialPath = (isAdminPath ? (pathParts[1] || '') : pathParts[0]).toLowerCase();`;
      content = content.replace(simpleLine, replacement);
      changed++;
      console.log('✅ Fixed initialPath (simple replace)');
    } else {
      console.log('❌ Could not fix initialPath');
    }
  }
}

// 2. Fix TAB_TO_ROUTE to use /admin/ prefix
const oldTabToRoute = `const TAB_TO_ROUTE = {\r\n  'catalog': '/home',\r\n  'pos': '/pos',\r\n  'customers': '/customers',\r\n  'invoices-list': '/invoices',\r\n  'create-invoice': '/create-invoice',\r\n  'receipts': '/receipts',\r\n  'inventory': '/inventory',\r\n  'warranties': '/warranties',\r\n  'dashboard': '/dashboard',\r\n  'settings': '/settings',\r\n  'brands-audit': '/brands-audit'\r\n};`;
const newTabToRoute = `const TAB_TO_ROUTE = {\r\n  'catalog': '/admin/home',\r\n  'pos': '/admin/pos',\r\n  'customers': '/admin/customers',\r\n  'invoices-list': '/admin/invoices',\r\n  'create-invoice': '/admin/create-invoice',\r\n  'receipts': '/admin/receipts',\r\n  'inventory': '/admin/inventory',\r\n  'warranties': '/admin/warranties',\r\n  'dashboard': '/admin/dashboard',\r\n  'settings': '/admin/settings',\r\n  'brands-audit': '/admin/brands-audit'\r\n};`;

if (content.includes(oldTabToRoute)) {
  content = content.replace(oldTabToRoute, newTabToRoute);
  changed++;
  console.log('✅ Fixed TAB_TO_ROUTE with /admin/ prefix');
} else {
  // Try LF
  const oldLF = oldTabToRoute.replace(/\r\n/g, '\n');
  const newLF = newTabToRoute.replace(/\r\n/g, '\n');
  if (content.includes(oldLF)) {
    content = content.replace(oldLF, newLF);
    changed++;
    console.log('✅ Fixed TAB_TO_ROUTE with /admin/ prefix (LF)');
  } else {
    // Individual replacements
    const routes = [
      ["'catalog': '/home'", "'catalog': '/admin/home'"],
      ["'pos': '/pos'", "'pos': '/admin/pos'"],
      ["'customers': '/customers'", "'customers': '/admin/customers'"],
      ["'invoices-list': '/invoices'", "'invoices-list': '/admin/invoices'"],
      ["'create-invoice': '/create-invoice'", "'create-invoice': '/admin/create-invoice'"],
      ["'receipts': '/receipts'", "'receipts': '/admin/receipts'"],
      ["'inventory': '/inventory'", "'inventory': '/admin/inventory'"],
      ["'warranties': '/warranties'", "'warranties': '/admin/warranties'"],
      ["'dashboard': '/dashboard'", "'dashboard': '/admin/dashboard'"],
      ["'settings': '/settings'", "'settings': '/admin/settings'"],
      ["'brands-audit': '/brands-audit'", "'brands-audit': '/admin/brands-audit'"],
    ];
    let routeChanges = 0;
    for (const [old, neu] of routes) {
      // Only replace inside TAB_TO_ROUTE context (after it's declared)
      // Use a regex to be safe
      if (content.includes(old) && !content.includes(neu)) {
        content = content.split(old).join(neu);
        routeChanges++;
      }
    }
    if (routeChanges > 0) {
      changed++;
      console.log(`✅ Fixed TAB_TO_ROUTE individually (${routeChanges} routes)`);
    } else {
      console.log('⚠️ TAB_TO_ROUTE may already be updated or not found');
    }
  }
}

// 3. Fix the cleanPath fallback in the else block at the end of initApp
// was: const cleanPath = window.location.pathname === '/' ? '/' : '/home';
const oldCleanPath = `const cleanPath = window.location.pathname === '/' ? '/' : '/home';`;
const newCleanPath = `const cleanPath = window.location.pathname === '/' ? '/admin/home' : (window.location.pathname.startsWith('/admin') ? window.location.pathname : '/admin/home');`;
if (content.includes(oldCleanPath)) {
  content = content.replace(oldCleanPath, newCleanPath);
  changed++;
  console.log('✅ Fixed cleanPath fallback');
} else {
  console.log('⚠️ cleanPath not found (may be OK)');
}

fs.writeFileSync(appJsPath, content, 'utf8');
console.log(`\n📝 Total changes: ${changed}`);
console.log('✅ app.js patched successfully');
