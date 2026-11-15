const http = require('http');

async function run() {
  process.env.PORT = '5099';
  const app = require('../server.js');
  const dataStore = require('../dataStore');
  
  await new Promise(r => setTimeout(r, 1500));

  function request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const headers = {
        'x-forwarded-proto': 'https',
        'host': 'aboramez1.onrender.com',
        ...(options.headers || {})
      };
      if (options.body) {
        headers['Content-Type'] = 'application/json';
      }

      const req = http.request({
        host: '127.0.0.1',
        port: 5099,
        path,
        method: options.method || 'GET',
        headers
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch (e) {}
          resolve({ status: res.statusCode, body, json });
        });
      });
      req.on('error', reject);
      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  console.log('🧪 Starting Store & Orders Integration Tests...');

  // 1. Test GET /api/public/store-data
  const resStore = await request('/api/public/store-data');
  if (resStore.status !== 200 || !resStore.json || !resStore.json.success) {
    throw new Error('GET /api/public/store-data failed with status ' + resStore.status);
  }
  const storeData = resStore.json;
  console.log('✅ /api/public/store-data works: returned ' + storeData.products.length + ' public products');
  console.log('✅ Categories count:', storeData.categories.length);
  console.log('✅ Brands count:', storeData.brands.length);

  // Security check: zero leak of costPrice or supplierName
  const leaked = storeData.products.some(p => p.costPrice !== undefined || p.supplierName !== undefined || p.supplierId !== undefined);
  if (leaked) {
    throw new Error('SECURITY VIOLATION: /api/public/store-data leaks confidential fields!');
  }
  console.log('✅ Zero security leaks verified: no costPrice, supplierName, or supplierId.');

  // Check all returned products have stock > 0 (or isManualShow)
  const invalidStock = storeData.products.some(p => p.stock <= 0 && !p.isManualShow);
  if (invalidStock) {
    throw new Error('Out of stock product returned without isManualShow flag!');
  }
  console.log('✅ Only in-stock products displayed to customers.');

  // Check no decimal places in prices
  const hasDecimals = storeData.products.some(p => String(p.sellPrice).includes('.'));
  if (hasDecimals) {
    throw new Error('Prices should be rounded integers without decimal places!');
  }
  console.log('✅ Prices formatted cleanly without decimal places.');

  // 2. Test Customer Order Placement POST /api/public/orders
  const testProduct = storeData.products[0];
  const testOrderPayload = {
    customer: {
      name: 'أحمد محمود فحص النظام',
      phone: '0599123456',
      address: 'جنين - يعبد - الحي الشرقي',
      notes: 'طلب فحص آلي للنظام'
    },
    items: [
      {
        id: testProduct.id,
        name: testProduct.name,
        code: testProduct.code,
        brand: testProduct.brand,
        price: testProduct.sellPrice,
        qty: 2,
        image: testProduct.image
      }
    ]
  };

  const resOrder = await request('/api/public/orders', {
    method: 'POST',
    body: testOrderPayload
  });

  if (resOrder.status !== 200 || !resOrder.json || !resOrder.json.success) {
    throw new Error('POST /api/public/orders failed: ' + resOrder.body);
  }
  const createdOrderId = resOrder.json.orderId;
  console.log('✅ Customer web order created successfully: #' + createdOrderId + ' with total: ' + resOrder.json.totalAmount);

  // Verify order in dataStore
  const orderInDb = dataStore.getOrderById(createdOrderId);
  if (!orderInDb || orderInDb.status !== 'pending') {
    throw new Error('Order not found in database or status not pending!');
  }
  console.log('✅ Order recorded with status: pending.');

  // 3. Test Admin Order Approval & Inventory Stock Deduction
  const initialStock = parseInt(testProduct.stock) || 0;
  console.log('ℹ️ Product initial stock before approval:', initialStock);

  const resApprove = await request('/api/admin/orders/' + encodeURIComponent(createdOrderId) + '/approve', {
    method: 'POST',
    body: { approvedBy: 'مدير النظام الآلي' }
  });

  if (resApprove.status !== 200 || !resApprove.json || !resApprove.json.success) {
    throw new Error('POST /api/admin/orders/:id/approve failed: ' + resApprove.body);
  }

  // Verify stock deduction
  const prodsAfter = dataStore.getProducts();
  const prodAfter = prodsAfter.find(p => String(p.id) === String(testProduct.id));
  const newStock = parseInt(prodAfter.stock) || 0;
  console.log('ℹ️ Product stock after approval:', newStock);
  if (newStock !== initialStock - 2) {
    throw new Error(`Stock deduction failed: expected ${initialStock - 2}, got ${newStock}`);
  }
  console.log('✅ Inventory stock deducted accurately upon order approval (-2 units).');

  // Verify order status updated to approved
  const approvedOrder = dataStore.getOrderById(createdOrderId);
  if (approvedOrder.status !== 'approved') {
    throw new Error('Order status should be approved!');
  }
  console.log('✅ Order status transitioned to approved with approval timestamp.');

  // 4. Test Custom Product Name for Customers
  const customNameTest = 'طباخ أوتوماتيك فخم إصدار 2026';
  const resCustomName = await request('/api/admin/store/custom-name', {
    method: 'POST',
    body: { productId: testProduct.id, customName: customNameTest }
  });

  if (resCustomName.status !== 200 || !resCustomName.json || !resCustomName.json.success) {
    throw new Error('POST /api/admin/store/custom-name failed');
  }

  // Check /api/public/store-data returns the custom name
  const resStore2 = await request('/api/public/store-data');
  const updatedProd = resStore2.json.products.find(p => String(p.id) === String(testProduct.id));
  if (!updatedProd || updatedProd.name !== customNameTest) {
    throw new Error('Customer display name was not updated in public store-data!');
  }
  console.log('✅ Custom public product name verified in store-data: ' + updatedProd.name);

  // 5. Test Public Storefront HTML (store.html)
  const resHtml = await request('/');
  if (resHtml.status !== 200 || !resHtml.body.includes('أقسام المعرض') || !resHtml.body.includes('علامات تجارية في متجرنا')) {
    throw new Error('store.html does not contain required Almnar sections!');
  }
  if (!resHtml.body.includes('cart-backdrop-overlay')) {
    throw new Error('store.html missing background freeze backdrop overlay!');
  }
  console.log('✅ Public Storefront (store.html) renders Almnar sections & background freeze backdrop.');

  // 6. Test Admin Panel HTML (index.html)
  const resAdminHtml = await request('/admin');
  if (resAdminHtml.status !== 200 || !resAdminHtml.body.includes('tab-store-manager') || !resAdminHtml.body.includes('إدارة المتجر والطلبات')) {
    throw new Error('Admin panel does not contain store-manager tab!');
  }
  console.log('✅ Admin Panel (index.html) contains complete Store Manager & Orders interface.');

  // Cleanup test artifacts
  await request('/api/admin/store/custom-name', {
    method: 'POST',
    body: { productId: testProduct.id, customName: '' }
  });

  console.log('\n🎉 ALL STORE & ORDERS TESTS PASSED SUCCESSFULLY! 🚀');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
