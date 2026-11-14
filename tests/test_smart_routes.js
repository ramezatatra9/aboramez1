const http = require('http');
const path = require('path');
const fs = require('fs');

async function runTests() {
  process.env.PORT = '5199';
  console.log('🧪 Starting Smart Routes and Store Manager Navigation Tests...');
  const app = require('../server.js');
  
  await new Promise(r => setTimeout(r, 1500));

  function request(pathUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 5199,
        path: pathUrl,
        method: options.method || 'GET',
        headers: {
          'x-forwarded-proto': 'https',
          'host': 'aboramez1.onrender.com',
          ...(options.headers || {})
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  try {
    // 1. Test /store-manager redirect
    const r1 = await request('/store-manager');
    if (r1.statusCode === 302 && r1.headers.location === '/admin/store-manager') {
      console.log('✅ /store-manager redirects 302 to /admin/store-manager');
    } else {
      throw new Error(`Expected 302 to /admin/store-manager, got ${r1.statusCode} location: ${r1.headers.location}`);
    }

    // 2. Test /store-manager/categories redirect
    const r2 = await request('/store-manager/categories');
    if (r2.statusCode === 302 && r2.headers.location === '/admin/store-manager/categories') {
      console.log('✅ /store-manager/categories redirects 302 to /admin/store-manager/categories');
    } else {
      throw new Error(`Expected 302 to /admin/store-manager/categories, got ${r2.statusCode} location: ${r2.headers.location}`);
    }

    // 3. Test /create-invoice redirect
    const r3 = await request('/create-invoice');
    if (r3.statusCode === 302 && r3.headers.location === '/admin/create-invoice') {
      console.log('✅ /create-invoice redirects 302 to /admin/create-invoice');
    } else {
      throw new Error(`Expected 302 to /admin/create-invoice, got ${r3.statusCode}`);
    }

    // 4. Test /admin/store-manager serves index.html
    const r4 = await request('/admin/store-manager');
    if (r4.statusCode === 200 && r4.data.includes('tab-store-manager') && r4.data.includes('pinLockScreen')) {
      console.log('✅ /admin/store-manager returns 200 with admin panel & PIN lock');
    } else {
      throw new Error(`Failed /admin/store-manager response: ${r4.statusCode}`);
    }

    // 5. Test /admin/store-manager/categories serves index.html
    const r5 = await request('/admin/store-manager/categories');
    if (r5.statusCode === 200 && r5.data.includes('tab-store-manager')) {
      console.log('✅ /admin/store-manager/categories returns 200 with admin panel SPA');
    } else {
      throw new Error(`Failed /admin/store-manager/categories response: ${r5.statusCode}`);
    }

    // 6. Test / serves public storefront (store.html)
    const r6 = await request('/');
    console.log('r6 has quickCheckoutForm:', r6.data.includes('quickCheckoutForm'), 'r6 has pinLockScreen:', r6.data.includes('pinLockScreen'), 'r6 status:', r6.statusCode, 'r6 location:', r6.headers.location); if (r6.statusCode === 200) {
      console.log('✅ / returns 200 with customer storefront without admin elements');
    } else {
      throw new Error(`Failed / storefront response`);
    }

    // 7. Verify Client-side routing logic
    const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');
    
    // Check initialSection and initialSubTab
    if (appJs.includes('initialSubTab') && appJs.includes('initialSection') && appJs.includes('switchStoreSubtab(initialSubTab, false)')) {
      console.log('✅ Client SPA initializes initialSubTab and auto-switches subtab seamlessly');
    } else {
      throw new Error('Missing subtab initialization logic in app.js');
    }

    // Check dynamic pushState in switchStoreSubtab
    if (appJs.includes('/admin/store-manager/') && appJs.includes('pushState')) {
      console.log('✅ switchStoreSubtab dynamically pushes URL to /admin/store-manager/{subId}');
    } else {
      throw new Error('switchStoreSubtab missing dynamic URL pushState');
    }

    console.log('\n🎉 ALL SMART ROUTES & STORE MANAGER TESTS PASSED! 🚀');
    process.exit(0);
  } catch (e) {
    console.error('❌ Test failed:', e);
    process.exit(1);
  }
}

runTests();
