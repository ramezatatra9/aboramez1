const http = require('http');

async function run() {
  process.env.PORT = '5098';
  const app = require('../server.js');
  
  await new Promise(r => setTimeout(r, 1500));

  function request(path, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: 5098,
        path,
        method: 'GET',
        headers: {
          'x-forwarded-proto': 'https',
          'host': 'aboramez1.onrender.com',
          ...headers
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  console.log('Testing Live Server endpoints...');

  // 1. Root / → store.html (public storefront)
  const res0 = await request('/');
  if (res0.status !== 200 || !res0.body.includes('متجر') || res0.body.includes('app.js')) {
    throw new Error('Root / did not show public storefront: status=' + res0.status);
  }
  console.log('✅ Root / shows public storefront (store.html).');

  // 2. Admin home at /admin or /admin/home → index.html (admin SPA)
  const res1 = await request('/admin');
  if (res1.status !== 200 || !res1.body.includes('نظام المبيعات والفواتير')) {
    throw new Error('Admin home at /admin failed: ' + res1.status);
  }
  console.log('✅ Admin home works at /admin.');

  // 3. Old /home route → store.html (NOT index.html — admin routes moved to /admin/*)
  const res1b = await request('/home');
  if (res1b.status !== 200 || res1b.body.includes('نظام المبيعات والفواتير')) {
    throw new Error('/home should NOT serve admin anymore but got admin SPA');
  }
  console.log('✅ /home now correctly shows public store (not admin SPA).');

  // 4. Block on preview domain
  const res2 = await request('/admin/pos', { host: 'aboramez-preview.onrender.com' });
  if (res2.status !== 403 || !res2.body.includes('بوابة المعاينة الرسمية للزبائن')) {
    throw new Error('Preview domain did not block /admin/pos: ' + res2.status);
  }
  console.log('✅ Preview domain successfully BLOCKS admin routes (/admin/pos).');

  // 5. Public storefront on preview domain root
  const res3 = await request('/', { host: 'aboramez-preview.onrender.com' });
  if (res3.status !== 200 || res3.body.includes('نظام المبيعات والفواتير')) {
    throw new Error('Preview domain should NOT show admin SPA on root: ' + res3.status);
  }
  console.log('✅ Preview domain shows public storefront on root (/) - no admin data exposed.');

  // 6. Test a product preview
  const dataStore = require('../dataStore');
  const prods = dataStore.getProducts();
  if (prods.length > 0) {
    const testProd = prods[0];
    const resProd = await request('/p/' + encodeURIComponent(testProd.id));
    if (resProd.status !== 200 || resProd.body.includes('app.js') || !resProd.body.includes('اطلب هذا الصنف')) {
      throw new Error('Product preview failed on /p/:id');
    }
    console.log('✅ Standalone product preview served cleanly with 0 admin leaks: ' + testProd.name);
  }

  // 7. /api/public/store-data returns safe data
  const resApi = await request('/api/public/store-data');
  if (resApi.status !== 200) {
    throw new Error('/api/public/store-data returned: ' + resApi.status);
  }
  const apiData = JSON.parse(resApi.body);
  if (!apiData.success) throw new Error('/api/public/store-data: success=false');
  // Check no leaked fields
  const leaked = (apiData.products || []).some(p => p.costPrice || p.supplierName || p.supplierId);
  if (leaked) throw new Error('/api/public/store-data leaks confidential data!');
  console.log('✅ /api/public/store-data returns safe data (' + (apiData.products || []).length + ' products, 0 leaks).');

  console.log('🎉 ALL LIVE INTEGRATION TESTS PASSED!');
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
