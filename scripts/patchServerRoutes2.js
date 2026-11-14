const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// Remove old legacy routes from ADMIN_FRONTEND_ROUTES, keep only /admin and /admin/*
const oldBlock = `const ADMIN_FRONTEND_ROUTES = [\r\n  '/admin',\r\n  '/admin/*',\r\n  '/home',\r\n  '/pos',\r\n  '/catalog',\r\n  '/products',\r\n  '/customers',\r\n  '/suppliers',\r\n  '/invoices',\r\n  '/invoices-list',\r\n  '/receipts',\r\n  '/vouchers',\r\n  '/create-invoice',\r\n  '/new-invoice',\r\n  '/inventory',\r\n  '/warranties',\r\n  '/dashboard',\r\n  '/settings',\r\n  '/brands-audit'\r\n];\r\n\r\nADMIN_FRONTEND_ROUTES.forEach(route => {\r\n  app.get(route, (req, res) => {\r\n    res.sendFile(path.join(__dirname, 'public', 'index.html'));\r\n  });\r\n});`;

const newBlock = `// مسارات نظام الأدمن - كل شيء تحت /admin\r\napp.get('/admin', (req, res) => {\r\n  res.sendFile(path.join(__dirname, 'public', 'index.html'));\r\n});\r\napp.get('/admin/*', (req, res) => {\r\n  res.sendFile(path.join(__dirname, 'public', 'index.html'));\r\n});`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log('✅ Cleaned up ADMIN_FRONTEND_ROUTES - removed legacy non-/admin routes');
} else {
  // Try LF
  const oldLF = oldBlock.replace(/\r\n/g, '\n');
  const newLF = newBlock.replace(/\r\n/g, '\n');
  if (content.includes(oldLF)) {
    content = content.replace(oldLF, newLF);
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('✅ Cleaned up ADMIN_FRONTEND_ROUTES (LF)');
  } else {
    console.log('⚠️ Could not find old block, trying partial match...');
    // Check what lines are there
    const lines = content.split('\n');
    const idx = lines.findIndex(l => l.includes('ADMIN_FRONTEND_ROUTES'));
    if (idx >= 0) {
      console.log('Found ADMIN_FRONTEND_ROUTES at line', idx + 1);
      console.log(lines.slice(idx, idx + 25).join('\n'));
    }
  }
}

// Verify syntax
const { execSync } = require('child_process');
try {
  execSync('node -c server.js', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
  console.log('✅ server.js syntax OK');
} catch (e) {
  console.error('❌ Syntax error:', e.stderr.toString());
}
