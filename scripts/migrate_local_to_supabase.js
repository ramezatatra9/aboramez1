// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// سكربت الترحيل الشامل v3.0
// الاستخدام:
//   node migrate_local_to_supabase.js           (ترحيل فعلي)
//   node migrate_local_to_supabase.js --dry-run (معاينة فقط، لا كتابة)
// ====================================================================

const fs = require('fs');
const path = require('path');
const { supabase, testSupabaseConnection, SUPABASE_KEY_SOURCE } = require('../supabaseClient');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ---------------------------------------------------------------
// وضع التشغيل: dry-run أم ترحيل فعلي؟
// ---------------------------------------------------------------
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------
// أدوات مساعدة
// ---------------------------------------------------------------
function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`❌ تعذر قراءة ${path.basename(filePath)}:`, e.message);
    return null;
  }
}

// قراءة عدد الصفوف الموجودة في جدول Supabase (بدون تعديل)
async function getTableCount(table) {
  try {
    const { count, error, status, statusText } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .limit(1);
    if (error || (status && status >= 400)) {
      const errMsg = (error && error.message) ? error.message : (statusText || `HTTP ${status}`);
      return { count: null, error: errMsg, code: error ? error.code : String(status), status };
    }
    return { count: count || 0, error: null, status };
  } catch (e) {
    return { count: null, error: e.message, code: 'EXCEPTION' };
  }
}

// دفعات متسلسلة آمنة — لا تُستدعى في وضع dry-run
async function upsertInBatches(table, records, { batchSize = 50, retries = 2, onProgress } = {}) {
  if (!records || records.length === 0) return { ok: true, uploaded: 0, failed: 0, errors: [] };

  let uploaded = 0;
  let failed = 0;
  const errors = [];
  const totalBatches = Math.ceil(records.length / batchSize);

  for (let b = 0; b < totalBatches; b++) {
    const batch = records.slice(b * batchSize, (b + 1) * batchSize);
    let success = false;
    let lastErr = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
        if (!error) { success = true; break; }
        lastErr = error.message;
        if (attempt < retries) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      } catch (e) {
        lastErr = e.message;
        if (attempt < retries) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }

    if (success) {
      uploaded += batch.length;
      if (onProgress) onProgress(uploaded, records.length, b + 1, totalBatches);
    } else {
      failed += batch.length;
      errors.push(`دفعة ${b + 1}/${totalBatches} فشلت (${batch.length} سجل): ${lastErr}`);
      return { ok: false, uploaded, failed, errors };
    }
  }
  return { ok: true, uploaded, failed, errors };
}

// ---------------------------------------------------------------
// دالة dry-run: تفحص وتعرض المعلومات دون أي كتابة إطلاقاً
// ---------------------------------------------------------------
async function runDryRun() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         🔍  وضع المعاينة (--dry-run) — لا كتابة فعلية       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // فحص الاتصال دون أي عملية كتابة (allowWriteProbe: false)
  console.log(`🔑 مصدر المفتاح: ${SUPABASE_KEY_SOURCE}`);
  const conn = await testSupabaseConnection({ allowWriteProbe: false });
  console.log('📡 الاتصال:', conn.readOk ? '✅ متصل ومتاح للقراءة' : '❌ غير متصل / غير مصادق عليه');
  console.log('✏️  الكتابة:', conn.writeOk ? '✅ متاح دور الخادم' : '⚠️ محجوبة أو المفتاح عام فقط');
  console.log('');

  // ---- حالة البيانات المحلية ----
  console.log('═══ [ البيانات المحلية — المصدر ] ═══');
  const productsRaw = readJson(path.join(DATA_DIR, 'products.json')) || [];
  const customersRaw = readJson(path.join(DATA_DIR, 'customers.json')) || [];
  const suppliersRaw = readJson(path.join(DATA_DIR, 'suppliers.json')) || [];
  const invoicesRaw = readJson(path.join(DATA_DIR, 'invoices.json')) || [];
  const receiptsRaw = readJson(path.join(DATA_DIR, 'receipts.json')) || [];
  const warrantiesRaw = readJson(path.join(DATA_DIR, 'warranties.json')) || [];
  const settingsRaw = readJson(path.join(DATA_DIR, 'settings.json')) || null;

  const EXCLUDED_SUPPLIER_CODES = ['S00000003'];
  const suppliersFiltered = suppliersRaw.filter(s => {
    const code = String(s.shamelCode || '').toUpperCase();
    const name = String(s.name || '');
    return !EXCLUDED_SUPPLIER_CODES.includes(code) && !name.includes('بضاعة قديمة');
  });

  // إحصاءات المنتجات
  const withImage = productsRaw.filter(p => p.image && p.image.trim()).length;
  const withDesc = productsRaw.filter(p => p.description && p.description.trim()).length;
  const withBrand = productsRaw.filter(p => p.brand && p.brand !== 'أخرى').length;
  const withImages = productsRaw.filter(p => Array.isArray(p.images) && p.images.length > 0).length;
  const isSuspended = productsRaw.filter(p => p.isSuspended).length;

  console.log(`  products.json   : ${productsRaw.length} صنف`);
  console.log(`    ↳ لديه image      : ${withImage}/${productsRaw.length}`);
  console.log(`    ↳ لديه description: ${withDesc}/${productsRaw.length}`);
  console.log(`    ↳ لديه brand≠أخرى : ${withBrand}/${productsRaw.length}`);
  console.log(`    ↳ لديه images[]   : ${withImages}/${productsRaw.length} (الحقل غير ممتلئ بعد)`);
  console.log(`    ↳ مُعلَّق (isSuspended): ${isSuspended}`);
  console.log(`  customers.json  : ${customersRaw.length} زبون`);
  console.log(`  suppliers.json  : ${suppliersRaw.length} (إجمالي) → ${suppliersFiltered.length} بعد استبعاد مورد بضاعة قديمة`);
  console.log(`  invoices.json   : ${invoicesRaw.length} فاتورة`);
  console.log(`  receipts.json   : ${receiptsRaw.length} سند قبض`);
  console.log(`  warranties.json : ${warrantiesRaw.length} كفالة وضمان`);
  console.log(`  settings.json   : ${settingsRaw ? '✅ متوفر (إعدادات عامة)' : '⚠️ غير متوفر'}`);

  // ---- حالة Supabase الفعلية ----
  console.log('\n═══ [ حالة Supabase الفعلية — قبل الترحيل ] ═══');
  const tables = ['products', 'settings', 'customers', 'suppliers', 'invoices', 'receipts', 'warranties'];
  const supabaseCounts = {};
  for (const tbl of tables) {
    const r = await getTableCount(tbl);
    if (r.code === '42P01' || r.code === 'PGRST205' || (r.error && r.error.includes('does not exist'))) {
      console.log(`  ${tbl}: ❌ الجدول غير موجود — يحتاج تنفيذ SQL Migration أولاً`);
      supabaseCounts[tbl] = 'missing';
    } else if (r.error) {
      console.log(`  ${tbl}: ⚠️ خطأ: ${r.error.slice(0, 60)}`);
      supabaseCounts[tbl] = 'error';
    } else {
      console.log(`  ${tbl}: ✅ موجود — ${r.count} صف حالياً`);
      supabaseCounts[tbl] = r.count;
    }
  }

  // ---- التحقق من تطابق الحقول ----
  console.log('\n═══ [ تطابق الحقول بين JSON والمخطط SQL ] ═══');
  if (productsRaw.length > 0) {
    console.log('  ✅ التعيينات الخاصة للمنتجات:');
    console.log('     JSON.mainCategory → SQL.category    (الفئة الرئيسية)');
    console.log('     JSON.category     → SQL.subcategory (الفئة الفرعية)');
    console.log('     images[]          → SQL.images      (مصفوفة jsonb)');
  }

  // ---- ما سيُرحَّل ----
  console.log('\n═══ [ ما سيُرحَّل عند تشغيل الترحيل الفعلي ] ═══');
  const planned = [
    { table: 'products',   records: productsRaw.length,       current: supabaseCounts['products'] },
    { table: 'customers',  records: customersRaw.length,      current: supabaseCounts['customers'] },
    { table: 'suppliers',  records: suppliersFiltered.length, current: supabaseCounts['suppliers'] },
    { table: 'invoices',   records: invoicesRaw.length,       current: supabaseCounts['invoices'] },
    { table: 'receipts',   records: receiptsRaw.length,       current: supabaseCounts['receipts'] },
    { table: 'warranties', records: warrantiesRaw.length,     current: supabaseCounts['warranties'] },
    { table: 'settings',   records: (settingsRaw ? 1 : 0) + 4, current: supabaseCounts['settings'], note: 'الإعدادات العامة + 4 لقطات نسخ احتياطي' }
  ];
  for (const p of planned) {
    const status = p.current === 'missing' ? '❌ جدول غير موجود — يحتاج SQL Migration' :
                   p.current === 'error'   ? '⚠️ خطأ في فحص الجدول' :
                   p.current === 0         ? '✅ جدول فارغ — ترحيل نظيف' :
                   `⚠️ يحتوي ${p.current} صف موجود — upsert سيحدّثها لا يحذفها`;
    const note = p.note ? ` (${p.note})` : '';
    console.log(`  ${p.table}: ${p.records} سجل محلي${note} | ${status}`);
  }

  // ---- المتطلبات قبل الترحيل ----
  console.log('\n═══ [ المتطلبات المفقودة قبل الترحيل الفعلي ] ═══');
  const missingTables = tables.filter(t => supabaseCounts[t] === 'missing');
  if (missingTables.length > 0) {
    console.log(`  ❌ جداول مفقودة في Supabase: ${missingTables.join(', ')}`);
    console.log('     → نفّذ migrations/001_permanent_schema.sql في Supabase SQL Editor');
  } else {
    console.log('  ✅ جميع الجداول موجودة في Supabase');
  }
  const needsServiceKey = !conn.readOk;
  if (needsServiceKey) {
    console.log('  ❌ الاتصال بقاعدة البيانات غير موثق بنجاح');
    console.log('     → تحقق من صحة المفتاح السري المخصص لمشروع Supabase الحالي في .env و Render');
    console.log(`     → مصدر المفتاح الحالي: [${SUPABASE_KEY_SOURCE}]`);
  } else {
    console.log('  ✅ الاتصال السحابي يعمل بنجاح');
  }

  console.log('\n✅ انتهى وضع المعاينة. لا كتابة حدثت.');
}

// ---------------------------------------------------------------
// الترحيل الفعلي
// ---------------------------------------------------------------
async function migrate() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     🚀  ترحيل البيانات الحقيقية إلى Supabase الدائمة        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!supabase) {
    console.error('❌ خطأ فادح: عميل Supabase غير مهيأ. تعذر المتابعة.');
    process.exit(1);
  }

  console.log(`🔑 مصدر المفتاح: ${SUPABASE_KEY_SOURCE}`);
  const conn = await testSupabaseConnection();
  console.log('📡 القراءة:', conn.readOk ? '✅' : '❌');
  console.log('✏️  الكتابة:', conn.writeOk ? '✅' : '❌');

  if (!conn.readOk) {
    console.error('❌ تعذر الاتصال بـ Supabase. تحقق من SUPABASE_URL والإنترنت.');
    process.exit(1);
  }

  if (!conn.writeOk) {
    console.error('\n❌ صلاحية الكتابة محجوبة. لا يمكن تنفيذ الترحيل.');
    console.error(`   المفتاح الحالي [${SUPABASE_KEY_SOURCE}] لا يملك صلاحية INSERT/UPDATE.`);
    console.error('   الحل: أضف SUPABASE_SERVICE_ROLE_KEY (JWT من Dashboard → API) إلى .env ثم أعد التشغيل.');
    if (conn.rlsNotice) console.error('   تفاصيل:', conn.rlsNotice);
    process.exit(1);
  }

  // ---- فحص حالة جداول Supabase قبل البدء ----
  console.log('\n═══ [ فحص حالة Supabase قبل البدء ] ═══');
  const requiredTables = ['products', 'settings', 'customers', 'suppliers', 'invoices', 'receipts', 'warranties'];
  const missingTables = [];
  for (const tbl of requiredTables) {
    const r = await getTableCount(tbl);
    if (r.code === '42P01' || r.code === 'PGRST205' || (r.error && r.error.includes('not exist'))) {
      console.log(`  ${tbl}: ❌ مفقود`);
      missingTables.push(tbl);
    } else if (r.error) {
      console.log(`  ${tbl}: ⚠️ ${r.error.slice(0,60)}`);
    } else {
      console.log(`  ${tbl}: ✅ ${r.count} صف حالي`);
    }
  }

  if (missingTables.length > 0) {
    console.error(`\n❌ جداول مفقودة: ${missingTables.join(', ')}`);
    console.error('   نفّذ migrations/001_permanent_schema.sql في Supabase SQL Editor ثم أعد المحاولة.');
    process.exit(1);
  }

  let totalErrors = 0;
  const migrationReport = {};

  // ====================================================
  // 1. المنتجات → products
  // ====================================================
  console.log('\n─── [ 1/4 ] ترحيل المنتجات ───');
  const productsRaw = readJson(path.join(DATA_DIR, 'products.json'));
  if (!productsRaw || !Array.isArray(productsRaw)) {
    console.error('❌ تعذر قراءة products.json. إيقاف الترحيل.');
    process.exit(1);
  }
  console.log(`📦 ${productsRaw.length} صنف في products.json`);

  // تعيين دقيق: JSON → SQL schema
  // mainCategory (JS) → category (SQL)
  // category (JS)     → subcategory (SQL)
  const productsPayload = productsRaw.map(p => ({
    id: String(p.id),
    code: String(p.code || '').trim(),
    name: String(p.name || '').trim(),
    category: String(p.mainCategory || p.category || 'أجهزة كهربائية كبيرة'),
    subcategory: String(p.category || 'عام'),
    costPrice: Number(p.costPrice) || 0,
    sellPrice: Number(p.sellPrice) || 0,
    stock: parseInt(p.stock) || 0,
    unit: String(p.unit || 'قطعة'),
    image: String(p.image || ''),
    description: String(p.description || ''),
    barcode: String(p.barcode || ''),
    isSuspended: Boolean(p.isSuspended),
    brand: String(p.brand || 'أخرى'),
    brandAr: String(p.brandAr || 'أخرى / عام'),
    // images: حقل موجود في JSON فعلياً كـ undefined/مفقود لجميع المنتجات، نُرسَل [] للحفاظ على القيمة الافتراضية
    images: (Array.isArray(p.images) && p.images.length > 0) ? p.images : [],
    lastStockUpdate: p.lastStockUpdate || null,
    lastStockEditor: p.lastStockEditor || null,
    updatedAt: p.updatedAt || null,
    lastSyncAt: p.lastSyncAt || null,
    createdAt: p.createdAt || new Date().toISOString()
  }));

  const prodResult = await upsertInBatches('products', productsPayload, {
    batchSize: 50,
    onProgress: (done, total) => {
      if (done % 250 === 0 || done === total) console.log(`   ↳ ${done}/${total} صنف...`);
    }
  });
  migrationReport.products = { source: productsRaw.length, uploaded: prodResult.uploaded, failed: prodResult.failed, ok: prodResult.ok };
  if (!prodResult.ok) { console.error(`❌ فشل المنتجات: ${prodResult.errors[0]}`); totalErrors++; }
  else console.log(`✅ ${prodResult.uploaded}/${productsRaw.length} صنف`);

  // snapshot احتياطي في settings
  try {
    const { error: snapErr } = await supabase.from('settings').upsert({ id: 'products_snapshot', data: productsRaw });
    if (!snapErr) console.log('✅ snapshot المنتجات في settings');
    else console.warn('⚠️ snapshot فشل:', snapErr.message);
  } catch (e) { console.warn('⚠️ snapshot استثناء:', e.message); }

  // ====================================================
  // 2. الزبائن → customers + settings
  // ====================================================
  console.log('\n─── [ 2/4 ] ترحيل الزبائن ───');
  const customersRaw = readJson(path.join(DATA_DIR, 'customers.json'));
  if (!customersRaw || !Array.isArray(customersRaw)) {
    console.warn('⚠️ customers.json غير موجود — تخطّي.');
    migrationReport.customers = { source: 0, ok: false };
  } else {
    console.log(`👥 ${customersRaw.length} زبون`);
    const custPayload = customersRaw.map(c => ({
      id: String(c.id),
      systemNumber: String(c.systemNumber || c.shamelCode || '').trim() || null,
      shamelCode: String(c.shamelCode || c.systemNumber || '').trim() || null,
      name: String(c.name || '').trim(),
      phone: String(c.phone || '').trim(),
      mobile: String(c.mobile || c.phone || '').trim(),
      email: String(c.email || '').trim(),
      address: String(c.address || '').trim(),
      balance: parseFloat(c.balance) || 0,
      shamelBalance: parseFloat(c.shamelBalance !== undefined ? c.shamelBalance : c.balance) || 0,
      isStopped: Boolean(c.isStopped),
      notes: String(c.notes || '').trim(),
      source: String(c.source || '').trim(),
      syncedAt: c.syncedAt || null,
      syncedBy: String(c.syncedBy || '').trim() || null,
      createdAt: c.createdAt || new Date().toISOString(),
      updatedAt: c.updatedAt || null,
      lastSyncAt: c.lastSyncAt || null
    }));
    const custResult = await upsertInBatches('customers', custPayload, { batchSize: 50 });
    migrationReport.customers = { source: customersRaw.length, uploaded: custResult.uploaded, failed: custResult.failed, ok: custResult.ok };
    if (!custResult.ok) { console.error(`❌ فشل الزبائن: ${custResult.errors[0]}`); totalErrors++; }
    else console.log(`✅ ${custResult.uploaded}/${customersRaw.length} زبون`);
    // نسخة احتياطية في settings
    try {
      await supabase.from('settings').upsert({ id: 'customers', data: customersRaw });
    } catch (e) {}
  }

  // ====================================================
  // 3. الموردون → suppliers + settings
  // ====================================================
  console.log('\n─── [ 3/4 ] ترحيل الموردين ───');
  const EXCLUDED = ['S00000003'];
  const suppliersRaw = readJson(path.join(DATA_DIR, 'suppliers.json'));
  if (!suppliersRaw || !Array.isArray(suppliersRaw)) {
    console.warn('⚠️ suppliers.json غير موجود — تخطّي.');
    migrationReport.suppliers = { source: 0, ok: false };
  } else {
    const suppliersFiltered = suppliersRaw.filter(s => {
      const code = String(s.shamelCode || '').toUpperCase();
      const name = String(s.name || '');
      return !EXCLUDED.includes(code) && !name.includes('بضاعة قديمة');
    });
    console.log(`🏢 ${suppliersRaw.length} إجمالي → ${suppliersFiltered.length} بعد الاستبعاد`);
    const suppPayload = suppliersFiltered.map(s => ({
      id: String(s.id),
      shamelCode: String(s.shamelCode || '').trim() || null,
      name: String(s.name || '').trim(),
      phone: String(s.phone || '').trim(),
      mobile: String(s.mobile || s.phone || '').trim(),
      email: String(s.email || '').trim(),
      address: String(s.address || '').trim(),
      balance: parseFloat(s.balance) || 0,
      shamelBalance: parseFloat(s.shamelBalance !== undefined ? s.shamelBalance : s.balance) || 0,
      isStopped: Boolean(s.isStopped),
      notes: String(s.notes || '').trim(),
      source: String(s.source || '').trim(),
      syncedAt: s.syncedAt || null,
      syncedBy: String(s.syncedBy || '').trim() || null,
      createdAt: s.createdAt || new Date().toISOString(),
      updatedAt: s.updatedAt || null,
      lastSyncAt: s.lastSyncAt || null
    }));
    const suppResult = await upsertInBatches('suppliers', suppPayload, { batchSize: 50 });
    migrationReport.suppliers = { source: suppliersFiltered.length, uploaded: suppResult.uploaded, failed: suppResult.failed, ok: suppResult.ok };
    if (!suppResult.ok) { console.error(`❌ فشل الموردين: ${suppResult.errors[0]}`); totalErrors++; }
    else console.log(`✅ ${suppResult.uploaded}/${suppliersFiltered.length} مورد`);
    try { await supabase.from('settings').upsert({ id: 'suppliers', data: suppliersFiltered }); } catch(e) {}
  }

  // ====================================================
  // 4. الفواتير → invoices
  // ====================================================
  console.log('\n─── [ 4/4 ] ترحيل الفواتير ───');
  const invoicesRaw = readJson(path.join(DATA_DIR, 'invoices.json'));
  if (!invoicesRaw || !Array.isArray(invoicesRaw) || invoicesRaw.length === 0) {
    console.log('ℹ️ لا فواتير.');
    migrationReport.invoices = { source: 0, ok: true };
  } else {
    console.log(`🧾 ${invoicesRaw.length} فاتورة`);
    const invPayload = invoicesRaw.map(inv => ({
      id: String(inv.id),
      invoiceNumber: inv.invoiceNumber || null,
      invoiceType: inv.invoiceType || 'sales',
      isQuotation: Boolean(inv.isQuotation),
      createdAt: inv.createdAt || new Date().toISOString(),
      convertedAt: inv.convertedAt || null,
      convertedBy: inv.convertedBy || null,
      employeeName: inv.employeeName || null,
      customerName: inv.customerName || null,
      customerPhone: inv.customerPhone || null,
      customerAddress: inv.customerAddress || null,
      customerId: inv.customerId || null,
      customerSystemNumber: inv.customerSystemNumber || null,
      notes: inv.notes || null,
      items: inv.items || [],
      summary: inv.summary || null,
      paymentMethod: inv.paymentMethod || null,
      installmentDetails: inv.installmentDetails || null,
      warrantyId: inv.warrantyId || null,
      warrantyNumber: inv.warrantyNumber || null,
      warrantyMonths: inv.warrantyMonths || 12,
      telegramStatus: inv.telegramStatus || null
    }));
    const invResult = await upsertInBatches('invoices', invPayload, { batchSize: 50 });
    migrationReport.invoices = { source: invoicesRaw.length, uploaded: invResult.uploaded, failed: invResult.failed, ok: invResult.ok };
    if (!invResult.ok) { console.error(`❌ فشل الفواتير: ${invResult.errors[0]}`); totalErrors++; }
    else console.log(`✅ ${invResult.uploaded}/${invoicesRaw.length} فاتورة`);
  }

  // ====================================================
  // 5. سندات القبض → receipts
  // ====================================================
  console.log('\n─── [ 5/7 ] ترحيل سندات القبض ───');
  const receiptsRaw = readJson(path.join(DATA_DIR, 'receipts.json'));
  if (!receiptsRaw || !Array.isArray(receiptsRaw) || receiptsRaw.length === 0) {
    console.log('ℹ️ لا سندات قبض.');
    migrationReport.receipts = { source: 0, uploaded: 0, failed: 0, ok: true };
  } else {
    console.log(`💵 ${receiptsRaw.length} سند قبض`);
    const rcpPayload = receiptsRaw.map(r => ({
      id: String(r.id),
      receiptNumber: r.receiptNumber ? parseInt(r.receiptNumber) : null,
      createdAt: r.createdAt || new Date().toISOString(),
      employeeName: String(r.employeeName || '').trim() || null,
      customerName: String(r.customerName || '').trim() || null,
      customerPhone: String(r.customerPhone || '').trim() || null,
      amount: parseFloat(r.amount) || 0,
      description: String(r.description || '').trim() || null,
      notes: String(r.notes || '').trim() || null,
      paymentMethod: String(r.paymentMethod || 'cash').trim()
    }));
    const rcpResult = await upsertInBatches('receipts', rcpPayload, { batchSize: 50 });
    migrationReport.receipts = { source: receiptsRaw.length, uploaded: rcpResult.uploaded, failed: rcpResult.failed, ok: rcpResult.ok };
    if (!rcpResult.ok) { console.error(`❌ فشل سندات القبض: ${rcpResult.errors[0]}`); totalErrors++; }
    else console.log(`✅ ${rcpResult.uploaded}/${receiptsRaw.length} سند قبض`);
  }

  // ====================================================
  // 6. الكفالات والضمانات → warranties + settings
  // ====================================================
  console.log('\n─── [ 6/7 ] ترحيل الكفالات والضمانات ───');
  const warrantiesRaw = readJson(path.join(DATA_DIR, 'warranties.json'));
  if (!warrantiesRaw || !Array.isArray(warrantiesRaw) || warrantiesRaw.length === 0) {
    console.log('ℹ️ لا كفالات.');
    migrationReport.warranties = { source: 0, uploaded: 0, failed: 0, ok: true };
  } else {
    console.log(`🛡️ ${warrantiesRaw.length} كفالة وضمان`);
    const warPayload = warrantiesRaw.map(w => ({
      id: String(w.id),
      warrantyNumber: w.warrantyNumber ? parseInt(w.warrantyNumber) : null,
      invoiceId: String(w.invoiceId || ''),
      invoiceNumber: w.invoiceNumber ? parseInt(w.invoiceNumber) : null,
      createdAt: w.createdAt || new Date().toISOString(),
      purchaseDate: w.purchaseDate || null,
      durationMonths: parseInt(w.durationMonths) || 12,
      expiryDate: w.expiryDate || null,
      customerName: String(w.customerName || '').trim() || null,
      customerPhone: String(w.customerPhone || '').trim() || null,
      customerAddress: String(w.customerAddress || '').trim() || null,
      items: Array.isArray(w.items) ? w.items : [],
      status: String(w.status || 'active'),
      customerId: w.customerId ? String(w.customerId) : null,
      customerSystemNumber: w.customerSystemNumber ? String(w.customerSystemNumber) : null,
      durationText: w.durationText ? String(w.durationText) : null,
      terms: Array.isArray(w.terms) ? w.terms : [],
      companyName: w.companyName ? String(w.companyName) : null,
      companyPhone: w.companyPhone ? String(w.companyPhone) : null,
      companyAddress: w.companyAddress ? String(w.companyAddress) : null,
      notes: String(w.notes || '').trim(),
      updatedAt: w.updatedAt || new Date().toISOString()
    }));
    const warResult = await upsertInBatches('warranties', warPayload, { batchSize: 50 });
    migrationReport.warranties = { source: warrantiesRaw.length, uploaded: warResult.uploaded, failed: warResult.failed, ok: warResult.ok };
    if (!warResult.ok) { console.error(`❌ فشل الكفالات: ${warResult.errors[0]}`); totalErrors++; }
    else console.log(`✅ ${warResult.uploaded}/${warrantiesRaw.length} كفالة وضمان`);

    // حفظ نسخة احتياطية كاملة في settings (بما فيها الشروط وتفاصيل الشركة المخصصة)
    try {
      await supabase.from('settings').upsert({ id: 'warranties', data: warrantiesRaw });
    } catch (e) {}
  }

  // ====================================================
  // 7. الإعدادات العامة → settings (general)
  // ====================================================
  console.log('\n─── [ 7/7 ] ترحيل الإعدادات العامة ───');
  const settingsRaw = readJson(path.join(DATA_DIR, 'settings.json'));
  if (settingsRaw) {
    try {
      const { error: stErr } = await supabase.from('settings').upsert({
        id: 'general',
        data: settingsRaw
      });
      if (!stErr) {
        console.log('✅ تم حفظ الإعدادات العامة في settings');
        migrationReport.settings = { source: 1, uploaded: 1, failed: 0, ok: true };
      } else {
        console.warn('⚠️ فشل حفظ الإعدادات العامة:', stErr.message);
        migrationReport.settings = { source: 1, uploaded: 0, failed: 1, ok: false };
        totalErrors++;
      }
    } catch (e) {
      console.warn('⚠️ استثناء الإعدادات العامة:', e.message);
      migrationReport.settings = { source: 1, uploaded: 0, failed: 1, ok: false };
      totalErrors++;
    }
  }

  // ====================================================
  // تحقق عددي بعد الترحيل
  // ====================================================
  console.log('\n═══ [ التحقق العددي في Supabase بعد الترحيل ] ═══');
  const verifyTables = ['products', 'customers', 'suppliers', 'invoices', 'receipts', 'warranties', 'settings'];
  for (const tbl of verifyTables) {
    const r = await getTableCount(tbl);
    const sourceCount = migrationReport[tbl]?.source ?? '—';
    const uploadCount = migrationReport[tbl]?.uploaded ?? '—';
    if (r.error) {
      console.log(`  ${tbl}: ⚠️ تعذر فحص — ${r.error.slice(0,60)}`);
    } else {
      const match = r.count === uploadCount ? '✅ تطابق' : `⚠️ فرق (رُفِع=${uploadCount}، في Supabase=${r.count})`;
      console.log(`  ${tbl}: مصدر=${sourceCount} | رُفِع=${uploadCount} | Supabase=${r.count} | ${match}`);
    }
  }

  // ====================================================
  // تقرير ختامي
  // ====================================================
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  if (totalErrors === 0) {
    console.log('║  🎉  اكتمل الترحيل بنجاح — لا أخطاء                         ║');
  } else {
    console.log(`║  ⚠️  اكتمل مع ${totalErrors} أخطاء — راجع السجلات أعلاه          ║`);
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');
  Object.entries(migrationReport).forEach(([tbl, r]) => {
    const s = r.ok ? '✅' : '❌';
    console.log(`  ${s} ${tbl}: ${r.source ?? '—'}→${r.uploaded ?? 0} | فشل=${r.failed ?? 0}`);
  });

  if (totalErrors > 0) process.exit(1);
}

// ---------------------------------------------------------------
// نقطة الدخول
// ---------------------------------------------------------------
if (DRY_RUN) {
  if (!supabase) {
    console.warn('⚠️ Supabase غير متصل — dry-run سيعمل مع البيانات المحلية فقط');
  }
  runDryRun().catch(e => { console.error('❌ خطأ في dry-run:', e.message); process.exit(1); });
} else {
  migrate().catch(e => { console.error('❌ خطأ غير متوقع:', e.message); process.exit(1); });
}
