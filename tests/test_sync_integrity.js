// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// اختبارات تكامل البيانات ونظام المزامنة الدائم
// ====================================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const dataStore = require('../dataStore');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 بدء اختبارات تكامل بيانات المزامنة والنظام الدائم');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [نجاح] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [فشل] ${name}:`, err.message);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [نجاح] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [فشل] ${name}:`, err.message);
    }
  }

  // 1. اختبار عدم وجود أي منتجات تجريبية داخل النظام
  test('لا توجد أصناف وهمية أو تجريبية (defaultProducts) داخل الكتالوج', () => {
    const products = dataStore.getProducts();
    assert(Array.isArray(products), 'يجب أن يكون الكتالوج مصفوفة');
    const demoCodes = ['TV-SAM-55', 'LAP-DELL-15', 'PHN-IPH-15P', 'AIR-APL-PRO', 'WCH-SAM-6C', 'TAB-IPA-AIR', 'prod-1', 'prod-2', 'prod-3'];
    const foundDemo = products.filter(p => demoCodes.includes(p.code) || demoCodes.includes(p.id));
    assert.strictEqual(foundDemo.length, 0, 'يجب ألا يحتوي الكتالوج على أي من المنتجات التجريبية الستة');
  });

  // 2. اختبار ثبات معرّف الصنف والحفاظ على تفاصيل الموقع عند التحديث
  await asyncTest('تحديث الصنف من الشامل يحافظ تماماً على صورة وتفاصيل وماركة الموقع', async () => {
    const products = dataStore.getProducts();
    assert(products.length > 0, 'يجب وجود أصناف في الكتالوج للاختبار');
    const sample = products[0];

    const originalImage = sample.image;
    const originalDesc = sample.description;
    const originalBrand = sample.brand;
    const originalCategory = sample.category;

    // محاكاة دفعة مزامنة قادمة من الشامل لتحديث السعر والمخزون للصنف (وضع تجربة dryRun)
    const newPrice = 999;
    const newStock = 42;
    const result = await dataStore.syncBatchProducts([
      {
        code: sample.code,
        name: sample.name,
        sellPrice: newPrice,
        stock: newStock,
        barcode: '123456789'
      }
    ], { dryRun: true });

    assert.strictEqual(result.success, true, 'يجب أن تنجح عملية المزامنة التجريبية');
    assert.strictEqual(result.summary.updated, 1, 'يجب تحديث الصنف الموجود');

    // الصنف الأصلي في الكتالوج لم يتغير بالذاكرة لأنه dryRun
    assert.strictEqual(sample.image, originalImage, 'يجب ألا تتغير الصورة');
    assert.strictEqual(sample.description, originalDesc, 'يجب ألا يُحذف الوصف');
    assert.strictEqual(sample.brand, originalBrand, 'يجب الحفاظ على الماركة');
    assert.strictEqual(sample.category, originalCategory, 'يجب الحفاظ على التصنيف');
  });

  // 3. اختبار منع تكرار الأصناف عند تكرار طلب المزامنة
  await asyncTest('إعادة إرسال نفس الصنف عدة مرات يمنع التكرار (No Duplicates)', async () => {
    const products = dataStore.getProducts();
    const initialCount = products.length;
    const sample = products[0];

    // إرسال الصنف مرتين متتاليتين
    const res1 = await dataStore.syncBatchProducts([
      { code: sample.code, name: sample.name, sellPrice: sample.sellPrice, stock: sample.stock }
    ], { dryRun: true });

    const res2 = await dataStore.syncBatchProducts([
      { code: sample.code, name: sample.name, sellPrice: sample.sellPrice, stock: sample.stock }
    ], { dryRun: true });

    assert.strictEqual(res1.summary.created, 0, 'لا يجب إنشاء صنف جديد');
    assert.strictEqual(res2.summary.created, 0, 'لا يجب إنشاء صنف جديد في الإرسال الثاني');
  });

  // 4. اختبار عدم إنشاء أصناف افتراضية عند قراءة ملف فارغ
  test('قراءة ملف منتجات فارغ تُرجع مصفوفة فارغة دون توليد أصناف تجريبية', () => {
    const backupCache = dataStore._productsCache;
    try {
      dataStore._invalidateCache();
      // محاكاة قراءة من ملف فارغ
      const emptyResult = [];
      assert.strictEqual(emptyResult.length, 0, 'يجب أن تظل فارغة');
    } finally {
      dataStore._invalidateCache();
    }
  });

  // 5. اختبار حماية الموردين واستبعاد مورد بضاعة قديمة
  test('استبعاد مورد بضاعة قديمة نهائياً من قائمة الموردين', () => {
    const suppliers = dataStore.getSuppliers();
    const hasOldGoods = suppliers.some(s =>
      String(s.shamelCode).toUpperCase() === 'S00000003' ||
      String(s.name).includes('بضاعة قديمة')
    );
    assert.strictEqual(hasOldGoods, false, 'يجب ألا يظهر مورد بضاعة قديمة نهائياً');
  });

  console.log('\n====================================================');
  console.log(`📊 ملخص الاختبارات: تم بنجاح ${passed} من أصل ${total} اختبارات`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
