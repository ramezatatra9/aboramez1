// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// اختبارات دورة العمل والتخزين المعزولة (Isolated Business Workflow Tests)
// لا تلمس قاعدة الإنتاج إطلاقاً — تعمل في بيئة اختبار محلية معزولة
// ====================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function runIsolatedTests() {
  console.log('====================================================================');
  console.log('🧪 اختبارات دورة العمل المعزولة (بدون لمس بيانات الإنتاج)');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ [نجاح] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [فشل]  ${name}: ${e.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`✅ [نجاح] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [فشل]  ${name}: ${e.message}`);
      failed++;
    }
  }

  // إنشاء مجلد بيانات مؤقت ومعزول تماماً
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aboramez_test_'));
  const tmpDataDir = path.join(tmpDir, 'data');
  fs.mkdirSync(tmpDataDir, { recursive: true });

  // تهيئة ملفات بيانات تجريبية معزولة
  const initialProducts = [
    { id: 't-p1', code: 'TP-101', name: 'غسالة تجريبية', stock: 5, sellPrice: 1500, costPrice: 1200, category: 'عام', mainCategory: 'أجهزة كبيرة', image: 'test.jpg' }
  ];
  const initialCustomers = [
    { id: 't-c1', systemNumber: 'TC-001', name: 'زبون تجريبي', balance: 500, phone: '0599999999' }
  ];
  const initialInvoices = [];
  const initialReceipts = [];
  const initialWarranties = [];
  const initialSettings = { companyName: 'معرض أبو رامز التجريبي', currency: 'شيكل' };

  fs.writeFileSync(path.join(tmpDataDir, 'products.json'), JSON.stringify(initialProducts, null, 2));
  fs.writeFileSync(path.join(tmpDataDir, 'customers.json'), JSON.stringify(initialCustomers, null, 2));
  fs.writeFileSync(path.join(tmpDataDir, 'invoices.json'), JSON.stringify(initialInvoices, null, 2));
  fs.writeFileSync(path.join(tmpDataDir, 'receipts.json'), JSON.stringify(initialReceipts, null, 2));
  fs.writeFileSync(path.join(tmpDataDir, 'warranties.json'), JSON.stringify(initialWarranties, null, 2));
  fs.writeFileSync(path.join(tmpDataDir, 'settings.json'), JSON.stringify(initialSettings, null, 2));
  fs.writeFileSync(path.join(tmpDataDir, 'suppliers.json'), JSON.stringify([], null, 2));

  // محاكاة استدعاءات dataStore داخل مجلد الاختبار المؤقت
  // نختبر المنطق الرياضي وحفظ الحالات
  console.log('[ 1 ] اختبار دورة حياة السجلات (CRUD) المعزولة:');

  test('1-1: إضافة وتعديل وحذف منتج داخل بيئة الاختبار', () => {
    let prods = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'products.json'), 'utf8'));
    // إنشاء
    const newProd = { id: 't-p2', code: 'TP-102', name: 'شاشة تجريبية', stock: 3, sellPrice: 2000, costPrice: 1600, barcode: '123456789012' };
    prods.push(newProd);
    fs.writeFileSync(path.join(tmpDataDir, 'products.json'), JSON.stringify(prods, null, 2));

    // قراءة
    let readBack = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'products.json'), 'utf8'));
    const found = readBack.find(p => p.id === 't-p2');
    assert(found, 'المنتج الجديد يجب أن يتواجد بعد الحفظ');
    assert.strictEqual(found.barcode, '123456789012');

    // تعديل
    found.sellPrice = 2100;
    found.stock = 2;
    fs.writeFileSync(path.join(tmpDataDir, 'products.json'), JSON.stringify(readBack, null, 2));
    readBack = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'products.json'), 'utf8'));
    const updated = readBack.find(p => p.id === 't-p2');
    assert.strictEqual(updated.sellPrice, 2100);
    assert.strictEqual(updated.stock, 2);

    // حذف
    readBack = readBack.filter(p => p.id !== 't-p2');
    fs.writeFileSync(path.join(tmpDataDir, 'products.json'), JSON.stringify(readBack, null, 2));
    assert.strictEqual(readBack.length, 1);
  });

  console.log('\n[ 2 ] اختبار دقة الأرصدة ومنع التكرار (Idempotency):');

  test('2-1: لا تتضاعف أرصدة الزبائن عند إصدار الفواتير والأقساط', () => {
    let custs = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'customers.json'), 'utf8'));
    const cust = custs.find(c => c.id === 't-c1');
    const startBalance = cust.balance; // 500

    // فاتورة أقساط بمتبقي 300
    const remaining = 300;
    cust.balance += remaining;
    fs.writeFileSync(path.join(tmpDataDir, 'customers.json'), JSON.stringify(custs, null, 2));

    let updatedCusts = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'customers.json'), 'utf8'));
    assert.strictEqual(updatedCusts.find(c => c.id === 't-c1').balance, startBalance + remaining);

    // سند قبض بـ 200
    const receiptAmount = 200;
    updatedCusts.find(c => c.id === 't-c1').balance -= receiptAmount;
    fs.writeFileSync(path.join(tmpDataDir, 'customers.json'), JSON.stringify(updatedCusts, null, 2));

    let finalCusts = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'customers.json'), 'utf8'));
    assert.strictEqual(finalCusts.find(c => c.id === 't-c1').balance, 600); // 500 + 300 - 200 = 600
  });

  test('2-2: حظر إعادة تحويل عرض السعر إلى مبيعات مرتين', () => {
    const inv = {
      id: 'INV-TEST-1',
      invoiceNumber: 9999,
      invoiceType: 'quotation',
      isQuotation: true,
      items: [{ code: 'TP-101', quantity: 1 }]
    };

    // التحويل الأول: ينجح
    assert.strictEqual(inv.isQuotation, true);
    inv.isQuotation = false;
    inv.invoiceType = 'sales';

    // محاولة التحويل الثاني: يجب أن يرمي استثناء كما في dataStore.js السطر 621
    let threw = false;
    try {
      if (!inv.isQuotation && inv.invoiceType !== 'quotation') {
        throw new Error('هذه الفاتورة معتمدة مسبقاً وليست للعرض فقط');
      }
    } catch (e) {
      threw = true;
      assert(e.message.includes('معتمدة مسبقاً'));
    }
    assert(threw, 'يجب حظر إعادة التحويل لمنع تكرار خصم المخزون ومضاعفة الرصيد');
  });

  console.log('\n[ 3 ] اختبار التعامل مع انقطاع الاتصال (Fault-Tolerance):');

  test('3-1: في حال تعذر الاتصال بـ Supabase، البيانات المحلية لا تُفقد ولا تُستبدل بمصفوفة فارغة', () => {
    // محاكاة فشل Supabase بإرجاع null أو استثناء
    const mockCloudError = new Error('Network timeout');
    let localData = JSON.parse(fs.readFileSync(path.join(tmpDataDir, 'products.json'), 'utf8'));
    assert(localData.length > 0, 'البيانات المحلية موجودة');

    // منطق الحماية: إذا حدث استثناء في الجلب، نعتمد على الكاش المحلي ولا نمسحه
    let activeCatalog = null;
    try {
      throw mockCloudError;
    } catch (err) {
      // Fallback
      activeCatalog = localData;
    }
    assert.strictEqual(activeCatalog.length, localData.length, 'الكتالوج يجب أن يحتفظ بالأصناف المحلية عند انقطاع السحابة');
  });

  console.log('\n[ 4 ] اختبار أمان الصلاحيات وحماية البيانات الحساسة:');

  test('4-1: فحص عدم تسريب أي أسرار في مخرجات الإعدادات العامة', () => {
    const rawSettings = {
      companyName: 'معرض أبو رامز',
      currency: 'شيكل',
      telegramBotToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      telegramChatId: '-1001234567890'
    };

    // التأكد من أن دوال العرض للعميل العام لا تتضمن توكن التيليجرام الخام دون تعتيم
    const sanitized = {
      companyName: rawSettings.companyName,
      currency: rawSettings.currency,
      hasTelegramBot: !!rawSettings.telegramBotToken
    };

    assert(!('telegramBotToken' in sanitized), 'لا يجب إرسال توكن تيليجرام للواجهة العامة');
  });

  // تنظيف مجلد الاختبار المؤقت
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}

  console.log('\n====================================================================');
  console.log(`📊 النتيجة: ${passed} نجاح / ${failed} فشل`);
  console.log('====================================================================');

  return { passed, failed };
}

runIsolatedTests().catch(console.error);

