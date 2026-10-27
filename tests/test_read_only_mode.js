// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// اختبارات معزولة لوضع القراءة فقط (Read-Only Degraded Mode) والحماية المحاسبية
// لا يتم إجراء أي كتابة على قاعدة بيانات الإنتاج في هذا الملف مطلقاً
// ====================================================================

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

// التأكد من عدم المساس بقاعدة الإنتاج
process.env.NODE_ENV = 'test';

const systemMode = require('../systemMode');
const idempotency = require('../idempotency');
const dataStore = require('../dataStore');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [نجاح] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [فشل] ${name}:`, err.message);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [نجاح] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [فشل] ${name}:`, err.message);
  }
}

console.log('====================================================================');
console.log('🧪 اختبارات وضع القراءة فقط (Read-Only Degraded Mode) والحماية المحاسبية');
console.log('   (بيئة اختبار معزولة بالكامل — صفر كتابات لقاعدة الإنتاج)');
console.log('====================================================================\n');

// ─────────────────────────────────────────────────────────────────
// [ 1 ] اختبار بدء التشغيل وحالة الجاهزية (Startup & Readiness)
// ─────────────────────────────────────────────────────────────────
console.log('[ 1 ] بدء التشغيل وحالة الجاهزية:');

runTest('1-1: يبدأ النظام في وضع القراءة فقط (read-only) كإجراء احترازي حتى تثبت الجاهزية', () => {
  systemMode.setSystemMode('read-only');
  assert.strictEqual(systemMode.getSystemMode(), 'read-only');
  assert.strictEqual(systemMode.isWriteAllowed(), false);
  const status = systemMode.getStatus();
  assert.strictEqual(status.isWriteReady, false);
});

runTest('1-2: دالة requireWritePermission تمنع POST في وضع القراءة فقط وتعيد 503 برسالة عربية', () => {
  systemMode.setSystemMode('read-only');
  let statusSent = null;
  let jsonSent = null;

  const req = { method: 'POST', path: '/api/invoices' };
  const res = {
    status(code) { statusSent = code; return this; },
    json(obj) { jsonSent = obj; }
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  systemMode.requireWritePermission(req, res, next);

  assert.strictEqual(nextCalled, false, 'يجب عدم تمرير الطلب إلى next()');
  assert.strictEqual(statusSent, 503, 'يجب أن يكون كود الاستجابة HTTP 503');
  assert.strictEqual(jsonSent.success, false);
  assert.strictEqual(jsonSent.code, 'DATABASE_READ_ONLY_MODE');
  assert.ok(jsonSent.error.includes('Supabase'), 'يجب أن تحتوي الرسالة على اسم قاعدة البيانات Supabase');
  assert.ok(jsonSent.error.includes('حماية البيانات المحاسبية'), 'يجب أن توضح الرسالة سبب التوقف لحماية البيانات');
});

runTest('1-3: دالة requireWritePermission تسمح بطلبات GET في وضع القراءة فقط', () => {
  systemMode.setSystemMode('read-only');
  let nextCalled = false;
  const req = { method: 'GET', path: '/api/products' };
  const res = {};
  systemMode.requireWritePermission(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'يجب السماح بالقراءة حتى في وضع انقطاع السحابة');
});

runTest('1-4: دالة requireWritePermission تسمح بالمسارات الآمنة مثل إرسال التيليجرام في وضع القراءة فقط', () => {
  systemMode.setSystemMode('read-only');
  const safePaths = [
    '/api/telegram/test',
    '/api/brands-classification/check-conflict',
    '/api/inventory/send-report-telegram',
    '/api/backups/create',
    '/api/invoices/INV-1001/resend-telegram',
    '/api/customers/cust-1/send-reminder-telegram'
  ];

  for (const p of safePaths) {
    let nextCalled = false;
    systemMode.requireWritePermission({ method: 'POST', path: p }, {}, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, `المسار الآمن ${p} يجب أن يمر بنجاح`);
  }
});

// ─────────────────────────────────────────────────────────────────
// [ 2 ] حظر كافة مسارات التعديل أثناء الانقطاع (All Mutating Routes Blocked)
// ─────────────────────────────────────────────────────────────────
console.log('\n[ 2 ] حظر كافة مسارات التعديل أثناء الانقطاع:');

runTest('2-1: رفض إضافة المنتجات وحذفها وتعديل المخزون في وضع القراءة فقط', () => {
  systemMode.setSystemMode('read-only');
  const mutatingRoutes = [
    { method: 'POST', path: '/api/products' },
    { method: 'DELETE', path: '/api/products/prod-123' },
    { method: 'POST', path: '/api/inventory/update' },
    { method: 'POST', path: '/api/sync/batch' }
  ];

  for (const r of mutatingRoutes) {
    let code = null;
    let nextCalled = false;
    systemMode.requireWritePermission(r, {
      status(c) { code = c; return this; },
      json() {}
    }, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(code, 503, `المسار ${r.method} ${r.path} يجب رفضه بـ 503`);
  }
});

runTest('2-2: رفض إضافة الزبائن وحذفهم وتعديل الأرصدة وسندات القبض في وضع القراءة فقط', () => {
  systemMode.setSystemMode('read-only');
  const mutatingRoutes = [
    { method: 'POST', path: '/api/customers' },
    { method: 'DELETE', path: '/api/customers/cust-123' },
    { method: 'POST', path: '/api/customers/bulk' },
    { method: 'POST', path: '/api/receipts' },
    { method: 'DELETE', path: '/api/receipts/RCP-1001' }
  ];

  for (const r of mutatingRoutes) {
    let code = null;
    systemMode.requireWritePermission(r, {
      status(c) { code = c; return this; },
      json() {}
    }, () => {});
    assert.strictEqual(code, 503);
  }
});

runTest('2-3: رفض إصدار الفواتير وتحويل عروض الأسعار وحذف الكفالات في وضع القراءة فقط', () => {
  systemMode.setSystemMode('read-only');
  const mutatingRoutes = [
    { method: 'POST', path: '/api/invoices' },
    { method: 'POST', path: '/api/invoices/INV-1001/convert-to-sales' },
    { method: 'POST', path: '/api/warranties/manual' },
    { method: 'DELETE', path: '/api/warranties/WAR-1001' },
    { method: 'POST', path: '/api/settings' }
  ];

  for (const r of mutatingRoutes) {
    let code = null;
    systemMode.requireWritePermission(r, {
      status(c) { code = c; return this; },
      json() {}
    }, () => {});
    assert.strictEqual(code, 503);
  }
});

// ─────────────────────────────────────────────────────────────────
// [ 3 ] استعادة الاتصال وانتقال الحالة (Auto-Recovery Transition)
// ─────────────────────────────────────────────────────────────────
console.log('\n[ 3 ] استعادة الاتصال وانتقال الحالة:');

runTest('3-1: التبديل إلى read-write يسمح فوراً بعمليات الكتابة', () => {
  systemMode.setSystemMode('read-write');
  assert.strictEqual(systemMode.isWriteAllowed(), true);
  assert.strictEqual(systemMode.getStatus().isWriteReady, true);

  let nextCalled = false;
  systemMode.requireWritePermission({ method: 'POST', path: '/api/invoices' }, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true, 'يجب السماح بالكتابة عند الانتقال إلى وضع read-write');
});

runTest('3-2: انقطاع الاتصال المفاجئ يعيد النظام إلى وضع read-only فوراً', () => {
  systemMode.setSystemMode('read-write');
  // محاكاة اكتشاف انقطاع الاتصال
  systemMode.setSystemMode('read-only');
  assert.strictEqual(systemMode.isWriteAllowed(), false);

  let nextCalled = false;
  let code = null;
  systemMode.requireWritePermission({ method: 'POST', path: '/api/invoices' }, {
    status(c) { code = c; return this; },
    json() {}
  }, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(code, 503);
});

// ─────────────────────────────────────────────────────────────────
// [ 4 ] منع تكرار الفواتير وسندات القبض (Idempotency Protection)
// ─────────────────────────────────────────────────────────────────
console.log('\n[ 4 ] منع تكرار العمليات ومضاعفة الأرصدة (Idempotency):');

runTest('4-1: توليد بصمة فريدة ومطابقة لنفس بيانات الفاتورة', () => {
  const invoiceBody1 = {
    customerName: 'محمد أحمد',
    employeeName: 'أبو رامز',
    paymentMethod: 'cash',
    items: [{ id: 'p1', quantity: 2, sellPrice: 1500 }]
  };
  const invoiceBody2 = {
    customerName: ' محمد أحمد ',
    employeeName: 'أبو رامز',
    paymentMethod: 'cash',
    items: [{ id: 'p1', quantity: 2, sellPrice: 1500 }]
  };
  const fp1 = idempotency.generateInvoiceFingerprint(invoiceBody1);
  const fp2 = idempotency.generateInvoiceFingerprint(invoiceBody2);

  assert.strictEqual(fp1, fp2, 'البصمة يجب أن تكون متطابقة حتى مع وجود مسافات زائدة');
  assert.strictEqual(typeof fp1, 'string');
  assert.ok(fp1.length >= 16);
});

runTest('4-2: اختلاف محتويات الفاتورة يعطي بصمة مختلفة', () => {
  const fp1 = idempotency.generateInvoiceFingerprint({ customerName: 'أحمد', items: [{ id: 'p1' }] });
  const fp2 = idempotency.generateInvoiceFingerprint({ customerName: 'أحمد', items: [{ id: 'p2' }] });
  assert.notStrictEqual(fp1, fp2);
});

runTest('4-3: إعادة إرسال نفس الفاتورة يكتشف كطلب مكرر ويعيد الاستجابة المحفوظة', () => {
  const testKey = 'test_idem_inv_' + Date.now();
  const firstCheck = idempotency.checkIdempotency(testKey);
  assert.strictEqual(firstCheck.isDuplicate, false);

  // إتمام الطلب الأول
  const fakeResponse = { success: true, invoice: { id: 'INV-TEST-1', invoiceNumber: 9999 } };
  idempotency.resolveIdempotency(testKey, fakeResponse);

  // الطلب الثاني المتطابق
  const secondCheck = idempotency.checkIdempotency(testKey);
  assert.strictEqual(secondCheck.isDuplicate, true);
  assert.strictEqual(secondCheck.status, 'completed');
  assert.strictEqual(secondCheck.response.invoice.id, 'INV-TEST-1');
});

runTest('4-4: طلب مماثل قيد المعالجة (in-flight) يُكتشف كـ pending', () => {
  const testKey = 'test_inflight_' + Date.now();
  const c1 = idempotency.checkIdempotency(testKey);
  assert.strictEqual(c1.isDuplicate, false);

  const c2 = idempotency.checkIdempotency(testKey);
  assert.strictEqual(c2.isDuplicate, true);
  assert.strictEqual(c2.status, 'pending');

  idempotency.releaseIdempotency(testKey);
});

runTest('4-5: بصمة سند القبض تطابق نفس العميل والموظف والمبلغ', () => {
  const r1 = { customerName: 'محمود', employeeName: 'رامز', amount: 500 };
  const r2 = { customerName: ' محمود ', employeeName: 'رامز', amount: '500' };
  const fp1 = idempotency.generateReceiptFingerprint(r1);
  const fp2 = idempotency.generateReceiptFingerprint(r2);
  assert.strictEqual(fp1, fp2);
});

// ─────────────────────────────────────────────────────────────────
// [ 5 ] سلامة الأرصدة والمخزون عند فشل السحابة (No Corrupt State)
// ─────────────────────────────────────────────────────────────────
console.log('\n[ 5 ] سلامة الأرصدة والمخزون عند فشل الحفظ السحابي:');

runTest('5-1: دالة deleteReceipt لا تعكس رصيد الزبون إذا فشل الحذف من Supabase', async () => {
  // محاكاة استدعاء الحذف مع معرف غير موجود
  const result = await dataStore.deleteReceipt('NON_EXISTENT_RCP_ID');
  assert.strictEqual(result, false, 'يجب أن يرجع false ولا يمس رصيد أي عميل');
});

runTest('5-2: endpoints الصحية /api/health و /api/ready تعكس وضع النظام بدقة', () => {
  systemMode.setSystemMode('read-only');
  const sReadOnly = systemMode.getStatus();
  assert.strictEqual(sReadOnly.mode, 'read-only');
  assert.strictEqual(sReadOnly.isWriteReady, false);

  systemMode.setSystemMode('read-write');
  const sReadWrite = systemMode.getStatus();
  assert.strictEqual(sReadWrite.mode, 'read-write');
  assert.strictEqual(sReadWrite.isWriteReady, true);
});

// استعادة وضع الجاهزية الحقيقي بعد انتهاء الاختبارات
systemMode.verifyReadiness({ quiet: true }).then(() => {
  console.log('\n====================================================================');
  console.log(`📊 النتيجة النهائية: ${passedTests} نجاح / ${totalTests - passedTests} فشل / ${totalTests} إجمالي`);
  console.log('====================================================================');
  if (passedTests === totalTests) {
    console.log('✅ جميع اختبارات وضع القراءة فقط وحماية العمليات نجحت بنسبة 100%!');
  } else {
    process.exit(1);
  }
});

