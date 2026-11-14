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

  // 1. Regular preview on main domain
  const res1 = await request('/home');
  if (res1.status !== 200 || !res1.body.includes('نظام المبيعات والفواتير')) {
    throw new Error('Admin home failed on main domain: ' + res1.status);
  }
  console.log('✅ Admin home works on main domain.');

  // 2. Block on preview domain
  const res2 = await request('/pos', { host: 'aboramez-preview.onrender.com' });
  if (res2.status !== 403 || !res2.body.includes('بوابة المعاينة الرسمية للزبائن')) {
    throw new Error('Preview domain did not block /pos: ' + res2.status);
  }
  console.log('✅ Preview domain successfully BLOCKS admin routes (/pos).');

  // 3. Public catalog on preview domain root
  const res3 = await request('/', { host: 'aboramez-preview.onrender.com' });
  if (res3.status !== 200 || !res3.body.includes('معرض الأصناف والمنتجات')) {
    throw new Error('Preview domain did not show public catalog on root: ' + res3.status);
  }
  console.log('✅ Preview domain successfully shows public catalog on root (/).');

  // 4. Test a product preview
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

  console.log('🎉 ALL LIVE INTEGRATION TESTS PASSED!');
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
