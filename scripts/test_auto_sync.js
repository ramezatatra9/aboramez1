/**
 * test_auto_sync.js
 * يثبت أن المزامنة التلقائية من ShamelSyncPro تعمل 100%
 * بدون أي تدخل يدوي
 */
const http = require('http');

const API_KEY = 'shamel_sync_secret_key_2026';
const HOST = 'localhost';
const PORT = 3000;

function apiCall(endpoint, method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: HOST, port: PORT, path: endpoint, method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data),
        'x-api-key': API_KEY
      }
    };
    const req = http.request(options, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log('=== اختبار المزامنة التلقائية من ShamelSyncPro ===\n');

  // الخطوة 1: فحص الأرصدة الحالية
  console.log('📊 الخطوة 1: الأرصدة قبل المزامنة...');
  const before = await apiCall('/api/suppliers', 'GET', {});
  // نستخدم endpoint مختلف
  const statusRes = await apiCall('/api/sync/status', 'GET', {});
  console.log('حالة المزامنة:', statusRes.lastSync || 'لم تتم بعد');

  // الخطوة 2: نُرسل أرصدة مختلفة (محاكاة تغيير في الشامل)
  console.log('\n📤 الخطوة 2: إرسال أرصدة محدَّثة من الشامل...');

  const suppliersFromShamel = [
    // رصيد شركة المنار تغيّر إلى 500000 (محاكاة)
    { shamelCode: 'S00000001', name: 'شركة المنار - سائد', balance: 500000, phone: '', email: '', address: '' },
    // رصيد سائد ابو عصبة تغيّر إلى 25000 (محاكاة)
    { shamelCode: 'S00000012', name: 'سائد ابو عصبة', balance: 25000, phone: '', email: '', address: '' },
    // احمد عطاري تغيّر إلى -500 (محاكاة دفعة منه)
    { shamelCode: 'S00000006', name: 'احمد عطاري', balance: -500, phone: '', email: '', address: '' },
    // الباقين بدون تغيير
    { shamelCode: 'S00000002', name: 'النجاح للكمبيوتر', balance: 0 },
    { shamelCode: 'S00000003', name: 'مورد بضاعة قديمة', balance: 27607 },
    { shamelCode: 'S00000004', name: 'شركة الاسراء للبرمجة والكمبيوتر', balance: 0 },
    { shamelCode: 'S00000005', name: 'مالك مخيم طولكرم', balance: 0 },
    { shamelCode: 'S00000007', name: 'فاخر نابلس', balance: 2520 },
    { shamelCode: 'S00000008', name: 'غسان مقالدة / هيك فيجين', balance: 0 },
    { shamelCode: 'S00000009', name: 'رامي السايغ', balance: 0 },
    { shamelCode: 'S00000010', name: 'شركة يافا نابلس / ابو صالح', balance: 2570 },
    { shamelCode: 'S00000011', name: 'ابو عنان برقين', balance: 0 },
    { shamelCode: 'S00000013', name: 'عواد عرقاوي', balance: 0 },
    { shamelCode: 'S00000014', name: 'فادي شخشير', balance: 700 },
    { shamelCode: 'S00000015', name: 'امير عطعوط', balance: 0 },
  ];

  const syncResult = await apiCall('/api/sync/suppliers', 'POST', {
    items: suppliersFromShamel,
    dryRun: false,
    syncMode: 'upsert'
  });

  console.log('نتيجة المزامنة:', JSON.stringify(syncResult.summary, null, 2));

  // الخطوة 3: التحقق من تحديث الأرصدة
  console.log('\n✅ الخطوة 3: التحقق من تحديث الأرصدة تلقائياً...');

  // نستعمل dataStore مباشرة للتحقق
  const ds = require('../dataStore');
  const updatedSupps = ds.getSuppliers();

  const tests = [
    { code: 'S00000001', expectedBal: 500000, name: 'شركة المنار' },
    { code: 'S00000012', expectedBal: 25000, name: 'سائد ابو عصبة' },
    { code: 'S00000006', expectedBal: -500, name: 'احمد عطاري' },
    { code: 'S00000007', expectedBal: 2520, name: 'فاخر نابلس' },
  ];

  let allPassed = true;
  tests.forEach(test => {
    const s = updatedSupps.find(x => x.shamelCode === test.code);
    const bal = s ? (s.shamelBalance !== undefined ? s.shamelBalance : s.balance) : null;
    const passed = s && Math.abs(bal - test.expectedBal) < 0.01;
    console.log(`${passed ? '✅' : '❌'} ${test.name}: الموقع=${bal} | الشامل=${test.expectedBal}`);
    if (!passed) allPassed = false;
  });

  if (allPassed) {
    console.log('\n🎉 النجاح الكامل! المزامنة التلقائية تعمل 100%');
    console.log('عند تشغيل ShamelSyncPro، تتحدث الأرصدة فوراً وتلقائياً.');
  } else {
    console.log('\n⚠️ بعض الأرصدة لم تتحدث');
  }

  // إعادة الأرصدة الصحيحة
  console.log('\n🔄 إعادة الأرصدة الصحيحة...');
  const correctItems = suppliersFromShamel.map(s => {
    const correct = {
      'S00000001': 468958.36,
      'S00000012': 22378,
      'S00000006': 0,
    };
    return { ...s, balance: correct[s.shamelCode] !== undefined ? correct[s.shamelCode] : s.balance };
  });
  await apiCall('/api/sync/suppliers', 'POST', { items: correctItems, dryRun: false });
  console.log('✅ تمت إعادة الأرصدة الصحيحة');

  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
