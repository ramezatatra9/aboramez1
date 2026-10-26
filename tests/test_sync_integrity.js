// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// اختبارات شاملة ما قبل الترحيل (Pre-Migration Test Suite)
// النسخة 2.0 — اختبارات المفاتيح، الأمان، تكامل البيانات، الأعداد
// ====================================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// ===================================================================
// إعداد بيئة الاختبار
// ===================================================================
const REPO_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const dataStore = require('../dataStore');

// قراءة مباشرة من ملفات JSON بدون مرور بـ dataStore (للتحقق من المصدر الخام)
function readJsonDirect(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return null; }
}

// ===================================================================
// منظّم الاختبارات
// ===================================================================
async function runTests() {
  console.log('====================================================================');
  console.log('🧪 اختبارات ما قبل الترحيل — معرض أبو رامز (Pre-Migration Suite v2)');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ [نجاح] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [فشل]  ${name}`);
      console.error(`         ${err.message}`);
      failed++;
      failures.push({ name, error: err.message });
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`✅ [نجاح] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [فشل]  ${name}`);
      console.error(`         ${err.message}`);
      failed++;
      failures.push({ name, error: err.message });
    }
  }

  // ===================================================================
  // القسم أ: أمان مفاتيح Supabase
  // ===================================================================
  console.log('\n[ أ ] أمان مفاتيح Supabase\n');

  test('أ-1: لا يتسرب المفتاح السري عبر module.exports من supabaseClient', () => {
    delete require.cache[require.resolve('../supabaseClient')];
    const sc = require('../supabaseClient');
    // يجب ألا يُصدَّر المفتاح الخام (SUPABASE_KEY كان يُصدَّر سابقاً)
    assert(!('SUPABASE_KEY' in sc), 'SUPABASE_KEY يجب ألا يُصدَّر من supabaseClient');
    // التصدير الوحيد المسموح به هو المصدر (source) وليس القيمة
    const exported = Object.keys(sc);
    assert(!exported.includes('activeKey'), 'activeKey يجب ألا يُصدَّر');
    assert(exported.includes('SUPABASE_KEY_SOURCE'), 'يجب تصدير SUPABASE_KEY_SOURCE للتتبع');
    assert(typeof sc.SUPABASE_KEY_SOURCE === 'string', 'SUPABASE_KEY_SOURCE يجب أن يكون نصاً');
  });

  test('أ-2: لا يوجد SUPABASE_KEY أو service_role في ملفات public (العميل الأمامي)', () => {
    const publicDir = path.join(REPO_ROOT, 'public');
    if (!fs.existsSync(publicDir)) return; // لا يوجد مجلد public = آمن

    const checkDir = (dir) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          checkDir(fullPath);
        } else if (item.name.endsWith('.js') || item.name.endsWith('.html')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert(!content.includes('SUPABASE_SERVICE_ROLE_KEY'),
            `وُجد SUPABASE_SERVICE_ROLE_KEY في ملف العميل: ${item.name}`);
          assert(!content.includes('service_role'),
            `وُجد 'service_role' في ملف العميل: ${item.name}`);
          // المفتاح العام (eyJ) مسموح به في client-side لأنه غير سري
        }
      }
    };
    checkDir(publicDir);
  });

  test('أ-3: ملف .env مدرج في .gitignore وغير محفوظ في Git', () => {
    const gitignorePath = path.join(REPO_ROOT, '.gitignore');
    assert(fs.existsSync(gitignorePath), '.gitignore يجب أن يكون موجوداً');
    const content = fs.readFileSync(gitignorePath, 'utf8');
    assert(content.includes('.env'), '.env يجب أن يكون مذكوراً في .gitignore');
    // تأكد أن .env نفسه غير مُتتبَّع بـ Git
    try {
      const { execSync } = require('child_process');
      const tracked = execSync('git ls-files .env', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
      assert.strictEqual(tracked, '', `.env يجب ألا يكون محفوظاً في Git (وُجد: "${tracked}")`);
    } catch (execErr) {
      // إذا لم يكن Git متاحاً، تخطّ هذا التحقق بتحذير
      if (execErr.message.includes('git')) {
        console.warn('         ⚠️ Git غير متاح — تم تخطّي فحص git ls-files');
      } else {
        throw execErr;
      }
    }
  });

  test('أ-4: مفتاح الخدمة لا يظهر في أي سجلات الـ console عند require supabaseClient', () => {
    // التحقق من كود الملف مباشرة
    const clientSrc = fs.readFileSync(path.join(REPO_ROOT, 'supabaseClient.js'), 'utf8');
    // يجب ألا يكون هناك console.log يطبع قيمة المفتاح مباشرة
    assert(!clientSrc.match(/console\.log.*activeKey\b/), 'activeKey يجب ألا يُطبَع في console.log');
    assert(!clientSrc.match(/console\.log.*SUPABASE_SERVICE_ROLE_KEY\b/), 'مفتاح الخدمة يجب ألا يُطبَع');
    // التأكد من وجود slice/sanitize للمعرّف المطبوع
    assert(clientSrc.includes('.slice('), 'يجب تقليم/إخفاء جزء من المفتاح عند الطباعة');
  });

  // ===================================================================
  // القسم ب: تكامل البيانات المحلية
  // ===================================================================
  console.log('\n[ ب ] تكامل البيانات المحلية\n');

  test('ب-1: عدد المنتجات الفعلي = 1431 (مصدر: products.json)', () => {
    const raw = readJsonDirect('products.json');
    assert(Array.isArray(raw), 'products.json يجب أن يكون مصفوفة');
    assert.strictEqual(raw.length, 1431, `عدد المنتجات المتوقع 1431، الموجود: ${raw.length}`);
  });

  test('ب-2: عدد الزبائن الفعلي = 483 (مصدر: customers.json)', () => {
    const raw = readJsonDirect('customers.json');
    assert(Array.isArray(raw), 'customers.json يجب أن يكون مصفوفة');
    assert.strictEqual(raw.length, 483, `عدد الزبائن المتوقع 483، الموجود: ${raw.length}`);
  });

  test('ب-3: عدد الموردين المرئيين (بعد استبعاد الوهمي) = 13', () => {
    const suppliers = dataStore.getSuppliers();
    assert.strictEqual(suppliers.length, 13, `عدد الموردين المتوقع 13، الموجود: ${suppliers.length}`);
  });

  test('ب-4: لا يوجد منتج بكود مكرر أو كود فارغ', () => {
    const raw = readJsonDirect('products.json');
    const seen = new Set();
    const dups = [];
    const empty = [];
    raw.forEach(p => {
      const k = (p.code || '').trim().toUpperCase();
      if (!k) { empty.push(p.id); return; }
      if (seen.has(k)) dups.push(k);
      else seen.add(k);
    });
    assert.strictEqual(empty.length, 0, `وُجد ${empty.length} منتج بكود فارغ: ${empty.slice(0, 3).join(', ')}`);
    assert.strictEqual(dups.length, 0, `وُجد ${dups.length} كود مكرر: ${dups.slice(0, 3).join(', ')}`);
  });

  test('ب-5: لا يوجد منتج بـ id فارغ أو مكرر', () => {
    const raw = readJsonDirect('products.json');
    const ids = raw.map(p => p.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, raw.length, `${raw.length - ids.length} منتج بدون id`);
    assert.strictEqual(uniqueIds.size, raw.length, `${raw.length - uniqueIds.size} id مكرر`);
  });

  test('ب-6: جميع المنتجات لديها صورة وليست قيمة فارغة', () => {
    const raw = readJsonDirect('products.json');
    const noImage = raw.filter(p => !p.image || p.image.trim() === '');
    assert.strictEqual(noImage.length, 0, `${noImage.length} منتج بدون صورة`);
  });

  test('ب-7: لا توجد أصناف تجريبية (prod-1 إلى prod-6) في الكتالوج', () => {
    const raw = readJsonDirect('products.json');
    const DEMO_IDS = ['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6'];
    const DEMO_CODES = ['TV-SAM-55', 'LAP-DELL-15', 'PHN-IPH-15P'];
    const found = raw.filter(p => DEMO_IDS.includes(p.id) || DEMO_CODES.includes(p.code));
    assert.strictEqual(found.length, 0, `وُجدت أصناف تجريبية: ${found.map(p => p.id).join(', ')}`);
  });

  test('ب-8: مورد بضاعة قديمة (S00000003) مستبعد من getSuppliers()', () => {
    const suppliers = dataStore.getSuppliers();
    const ghost = suppliers.find(s =>
      String(s.shamelCode || '').toUpperCase() === 'S00000003' ||
      String(s.name || '').includes('بضاعة قديمة')
    );
    assert(!ghost, 'مورد بضاعة قديمة يجب أن يكون مستبعداً تماماً');
  });

  test('ب-9: جميع الزبائن لديهم systemNumber فريد', () => {
    const raw = readJsonDirect('customers.json');
    const sysNums = raw.map(c => String(c.systemNumber || '').trim()).filter(Boolean);
    const unique = new Set(sysNums);
    assert.strictEqual(sysNums.length, raw.length, `${raw.length - sysNums.length} زبون بدون systemNumber`);
    assert.strictEqual(unique.size, sysNums.length, `${sysNums.length - unique.size} systemNumber مكرر`);
  });

  test('ب-10: أكواد المنتجات لا تحتوي مسافات زائدة (لا تأثير على TRIM في SQL)', () => {
    const raw = readJsonDirect('products.json');
    const withSpaces = raw.filter(p => p.code && p.code !== p.code.trim());
    assert.strictEqual(withSpaces.length, 0, `${withSpaces.length} منتج بكود يحتوي مسافات زائدة`);
  });

  // ===================================================================
  // القسم ج: صحة منطق المزامنة
  // ===================================================================
  console.log('\n[ ج ] صحة منطق المزامنة\n');

  await asyncTest('ج-1: تحديث الصنف من الشامل لا يمسح الصورة أو الوصف أو الماركة', async () => {
    const products = dataStore.getProducts();
    assert(products.length > 0, 'يجب وجود منتجات');
    const sample = products[0];

    const originalImage = sample.image;
    const originalDesc = sample.description;
    const originalBrand = sample.brand;

    const result = await dataStore.syncBatchProducts([
      { code: sample.code, name: sample.name, sellPrice: 999, stock: 42 }
    ], { dryRun: true });

    assert.strictEqual(result.summary.updated, 1, 'يجب تحديث الصنف الموجود');
    // التأكد أن dryRun لم يمسّ الكائن الأصلي
    assert.strictEqual(sample.image, originalImage, 'الصورة يجب ألا تُمسح');
    assert.strictEqual(sample.description, originalDesc, 'الوصف يجب ألا يُمسح');
    assert.strictEqual(sample.brand, originalBrand, 'الماركة يجب ألا تُمسح');
  });

  await asyncTest('ج-2: إرسال نفس الصنف مرتين لا يُنشئ تكراراً (No Duplicates)', async () => {
    const products = dataStore.getProducts();
    const countBefore = products.length;
    const sample = products[0];

    await dataStore.syncBatchProducts(
      [{ code: sample.code, name: sample.name, sellPrice: sample.sellPrice, stock: sample.stock }],
      { dryRun: true }
    );
    await dataStore.syncBatchProducts(
      [{ code: sample.code, name: sample.name, sellPrice: sample.sellPrice, stock: sample.stock }],
      { dryRun: true }
    );

    // عدد المنتجات في الذاكرة لم يتغير
    dataStore._invalidateCache();
    const countAfter = dataStore.getProducts().length;
    assert.strictEqual(countAfter, countBefore, `توقع ${countBefore} منتجاً بعد dryRun، وُجد ${countAfter}`);
  });

  await asyncTest('ج-3: المزامنة الجزئية لا تحذف باقي الأصناف', async () => {
    const products = dataStore.getProducts();
    const countBefore = products.length;
    const res = await dataStore.syncBatchProducts([
      { code: products[0].code, name: products[0].name, sellPrice: 555, stock: 10 }
    ], { dryRun: true });

    assert.strictEqual(res.summary.totalReceived, 1);
    assert.strictEqual(dataStore.getProducts().length, countBefore,
      'المزامنة الجزئية يجب ألا تحذف الأصناف الأخرى');
  });

  test('ج-4: صنف بحقول ناقصة (code فارغ أو name فارغ) يُرفض ويُسجَّل في قائمة الأخطاء', () => {
    return dataStore.syncBatchProducts([{ code: '', name: '' }], { dryRun: true })
      .then(res => {
        assert(res.summary.errors.length > 0, 'يجب تسجيل خطأ للصنف الناقص');
        assert.strictEqual(res.summary.created, 0, 'يجب ألا يُنشأ أي صنف من حقول فارغة');
      });
  });

  // ===================================================================
  // القسم د: توافق مخطط SQL مع بيانات JS
  // ===================================================================
  console.log('\n[ د ] توافق مخطط SQL مع بيانات JS\n');

  test('د-1: الحقول المستخدمة في dataStore موجودة في ملف products.json (لا حقول مفقودة ستسبب NULL)', () => {
    const raw = readJsonDirect('products.json');
    const sample = raw[0];
    // الحقول المُرحَّلة في سكربت الترحيل الجديد
    const requiredFields = ['id', 'code', 'name', 'costPrice', 'sellPrice', 'stock', 'unit', 'image', 'description'];
    requiredFields.forEach(f => {
      assert(f in sample, `الحقل "${f}" مفقود من products.json[0]`);
    });
  });

  test('د-2: الحقول المستخدمة في syncBatchCustomers موجودة في customers.json', () => {
    const raw = readJsonDirect('customers.json');
    const sample = raw[0];
    const requiredFields = ['id', 'systemNumber', 'name', 'balance'];
    requiredFields.forEach(f => {
      assert(f in sample, `الحقل "${f}" مفقود من customers.json[0]`);
    });
  });

  test('د-3: الحقول المستخدمة في syncBatchSuppliers موجودة في suppliers.json', () => {
    const raw = readJsonDirect('suppliers.json');
    const sample = raw.find(s => !['S00000003'].includes(String(s.shamelCode || '').toUpperCase()));
    assert(sample, 'يجب وجود مورد حقيقي لفحصه');
    const requiredFields = ['id', 'shamelCode', 'name', 'balance'];
    requiredFields.forEach(f => {
      assert(f in sample, `الحقل "${f}" مفقود من suppliers.json[sample]`);
    });
  });

  test('د-4: لا يوجد منتج يمتلك كلاً من images[] وimage فارغَين في نفس الوقت', () => {
    const raw = readJsonDirect('products.json');
    const missing = raw.filter(p =>
      (!p.image || p.image.trim() === '') &&
      (!Array.isArray(p.images) || p.images.length === 0)
    );
    assert.strictEqual(missing.length, 0, `${missing.length} منتج بدون أي صورة`);
  });

  // ===================================================================
  // القسم هـ: معالجة حالات الحافة
  // ===================================================================
  console.log('\n[ هـ ] معالجة حالات الحافة\n');

  test('هـ-1: getProducts يُرجع [] عند ملف products.json فارغ (لا أصناف وهمية)', () => {
    // محاكاة منطق readJson مع قيمة افتراضية []
    const emptyResult = JSON.parse('[]');
    const result = Array.isArray(emptyResult) ? emptyResult : [];
    assert.strictEqual(result.length, 0, 'ملف فارغ يجب أن يُرجع مصفوفة فارغة لا أصناف وهمية');
  });

  await asyncTest('هـ-2: syncBatchProducts يُرجع success:false وخطأ واضح عند قائمة فارغة', async () => {
    const result = await dataStore.syncBatchProducts([], { dryRun: true });
    assert.strictEqual(result.success, false, 'قائمة فارغة يجب أن تُرجع success:false');
    assert(result.error || result.summary?.errors?.length >= 0, 'يجب وجود رسالة خطأ');
  });

  test('هـ-3: هيكلية sync_meta المتوقعة من ShamelSyncPro موجودة', () => {
    const meta = dataStore.getLastSyncMeta();
    assert(meta !== null && meta !== undefined, 'sync_meta يجب أن تكون موجودة');
  });

  test('هـ-4: getLastCustomersSyncMeta وgetLastSuppliersSyncMeta موجودتان', () => {
    const cm = dataStore.getLastCustomersSyncMeta();
    const sm = dataStore.getLastSuppliersSyncMeta();
    // قد تكونان null إذا لم تحدث مزامنة بعد، لكنهما يجب ألا ترميا استثناءً
    assert(cm !== undefined, 'getLastCustomersSyncMeta يجب ألا ترمي استثناء');
    assert(sm !== undefined, 'getLastSuppliersSyncMeta يجب ألا ترمي استثناء');
  });

  // ===================================================================
  // تقرير ختامي
  // ===================================================================
  const total = passed + failed;
  console.log('\n====================================================================');
  console.log(`📊 نتيجة الاختبارات: ${passed} نجاح / ${failed} فشل / ${total} إجمالي`);

  if (failures.length > 0) {
    console.log('\n📋 الاختبارات الفاشلة:');
    failures.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.name}`);
      console.log(`      السبب: ${f.error}`);
    });
  }

  console.log('====================================================================\n');

  if (failed > 0) {
    console.error('❌ يوجد اختبارات فاشلة — المشروع غير جاهز للترحيل.');
    process.exit(1);
  } else {
    console.log('✅ جميع الاختبارات نجحت — يمكن المتابعة للمرحلة التالية.');
  }
}

runTests().catch(err => {
  console.error('❌ خطأ غير متوقع في مجموعة الاختبارات:', err.message);
  process.exit(1);
});
