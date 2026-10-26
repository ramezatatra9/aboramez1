// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// سكربت الترحيل الشامل والمُحكَم: نقل البيانات الحقيقية من الملفات المحلية إلى Supabase
// النسخة 2.0 — مع دعم جداول customers وsuppliers المستقلة وضمان عدم مسح الحقول المخصصة
// ====================================================================

const fs = require('fs');
const path = require('path');
const { supabase, testSupabaseConnection, SUPABASE_KEY_SOURCE } = require('../supabaseClient');

const DATA_DIR = path.join(__dirname, '..', 'data');

// =====================================================
// أدوات مساعدة
// =====================================================

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`❌ تعذر قراءة ${path.basename(filePath)}:`, e.message);
    return null;
  }
}

// دفعات متسلسلة آمنة مع معالجة أخطاء الشبكة وتكرار المحاولة
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
        if (!error) {
          success = true;
          break;
        }
        lastErr = error.message;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      } catch (e) {
        lastErr = e.message;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    if (success) {
      uploaded += batch.length;
      if (onProgress) onProgress(uploaded, records.length, b + 1, totalBatches);
    } else {
      failed += batch.length;
      errors.push(`دفعة ${b + 1}/${totalBatches} فشلت (${batch.length} سجل): ${lastErr}`);
      // إيقاف فوري عند فشل دفعة — لا نستمر بصمت
      return { ok: false, uploaded, failed, errors };
    }
  }

  return { ok: true, uploaded, failed, errors };
}

async function migrate() {
  console.log('===============================================================');
  console.log('🚀 بدء ترحيل البيانات الحقيقية إلى قاعدة بيانات Supabase الدائمة');
  console.log('===============================================================');

  // ---- 0. التحقق من جاهزية الاتصال والصلاحيات ----
  if (!supabase) {
    console.error('❌ خطأ فادح: عميل Supabase غير مهيأ. تعذر المتابعة.');
    console.error('   تأكد من وجود SUPABASE_URL في ملف .env.');
    process.exit(1);
  }

  console.log(`\n🔑 مصدر المفتاح المستخدم: ${SUPABASE_KEY_SOURCE}`);
  const conn = await testSupabaseConnection();
  console.log('📡 فحص الاتصال:', {
    'القراءة': conn.readOk ? '✅ متاحة' : '❌ محجوبة',
    'الكتابة': conn.writeOk ? '✅ متاحة' : '⚠️ محجوبة بـ RLS',
    'العنوان': conn.url,
    'مصدر المفتاح': conn.keySource
  });

  if (!conn.readOk) {
    console.error('❌ تعذر الاتصال بـ Supabase. تحقق من SUPABASE_URL والإنترنت.');
    process.exit(1);
  }

  if (!conn.writeOk) {
    console.error('\n❌ صلاحية الكتابة محجوبة. لا يمكن تنفيذ الترحيل.');
    console.error('   الحل المطلوب: أضف SUPABASE_SERVICE_ROLE_KEY الصحيح إلى ملف .env ثم أعد التشغيل.');
    if (conn.rlsNotice) console.error('   تفاصيل الخطأ:', conn.rlsNotice);
    process.exit(1);
  }

  let totalErrors = 0;
  const migrationReport = {};

  // ====================================================
  // 1. ترحيل المنتجات (1431 صنف → جدول products)
  // ====================================================
  console.log('\n--- [ 1/4 ] ترحيل المنتجات ---');
  const productsRaw = readJson(path.join(DATA_DIR, 'products.json'));
  if (!productsRaw || !Array.isArray(productsRaw)) {
    console.error('❌ تعذر قراءة products.json أو الملف تالف. إيقاف الترحيل.');
    process.exit(1);
  }

  console.log(`📦 إجمالي المنتجات في الملف المحلي: ${productsRaw.length}`);

  // بناء حمولة المنتجات بتطابق كامل مع مخطط SQL
  // مهم: نحتفظ بجميع حقول الموقع المخصصة (images, brand, description)
  const productsPayload = productsRaw.map(p => ({
    id: String(p.id),
    code: String(p.code || '').trim(),
    name: String(p.name || '').trim(),
    // category في الجدول = mainCategory في JS
    category: String(p.mainCategory || p.category || 'أجهزة كهربائية كبيرة'),
    // subcategory في الجدول = category (التصنيف الفرعي) في JS
    subcategory: String(p.category || 'عام'),
    costPrice: Number(p.costPrice) || 0,
    sellPrice: Number(p.sellPrice) || 0,
    stock: parseInt(p.stock) || 0,
    unit: String(p.unit || 'قطعة'),
    // الحقول المخصصة للموقع — لا تُستبدل بقيم فارغة
    image: String(p.image || ''),
    description: String(p.description || ''),
    barcode: String(p.barcode || ''),
    isSuspended: Boolean(p.isSuspended),
    brand: String(p.brand || 'أخرى'),
    brandAr: String(p.brandAr || 'أخرى / عام'),
    images: (Array.isArray(p.images) && p.images.length > 0) ? p.images : [],
    lastStockUpdate: p.lastStockUpdate || null,
    lastStockEditor: p.lastStockEditor || null,
    updatedAt: p.updatedAt || null,
    lastSyncAt: p.lastSyncAt || null,
    createdAt: p.createdAt || new Date().toISOString()
  }));

  console.log(`📤 جاري الرفع بدفعات (50 صنف/دفعة)...`);
  const prodResult = await upsertInBatches('products', productsPayload, {
    batchSize: 50,
    onProgress: (done, total) => {
      if (done % 200 === 0 || done === total) {
        console.log(`   ↳ تم رفع ${done}/${total} صنف...`);
      }
    }
  });

  migrationReport.products = {
    source: productsRaw.length,
    uploaded: prodResult.uploaded,
    failed: prodResult.failed,
    ok: prodResult.ok
  };

  if (!prodResult.ok) {
    console.error(`❌ فشل ترحيل المنتجات: ${prodResult.errors.join(' | ')}`);
    totalErrors++;
  } else {
    console.log(`✅ تم ترحيل ${prodResult.uploaded}/${productsRaw.length} صنف بنجاح.`);
  }

  // حفظ snapshot كامل في settings كطبقة حماية إضافية
  try {
    const { error: snapErr } = await supabase.from('settings').upsert({
      id: 'products_snapshot',
      data: productsRaw
    });
    if (!snapErr) {
      console.log(`✅ تم حفظ snapshot كامل للمنتجات في settings.`);
    } else {
      console.warn(`⚠️ تحذير: تعذر حفظ products_snapshot:`, snapErr.message);
    }
  } catch (e) {
    console.warn('⚠️ استثناء في حفظ snapshot:', e.message);
  }

  // ====================================================
  // 2. ترحيل الزبائن (483 → جدول customers + settings)
  // ====================================================
  console.log('\n--- [ 2/4 ] ترحيل الزبائن ---');
  const customersRaw = readJson(path.join(DATA_DIR, 'customers.json'));
  if (!customersRaw || !Array.isArray(customersRaw)) {
    console.warn('⚠️ تعذر قراءة customers.json أو الملف غير موجود — تخطّي.');
    migrationReport.customers = { source: 0, uploaded: 0, ok: false };
  } else {
    console.log(`👥 إجمالي الزبائن في الملف المحلي: ${customersRaw.length}`);

    // حمولة تتطابق مع مخطط جدول customers في SQL
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
    migrationReport.customers = {
      source: customersRaw.length,
      uploaded: custResult.uploaded,
      failed: custResult.failed,
      ok: custResult.ok
    };

    if (!custResult.ok) {
      console.error(`❌ فشل ترحيل الزبائن: ${custResult.errors.join(' | ')}`);
      totalErrors++;
    } else {
      console.log(`✅ تم ترحيل ${custResult.uploaded}/${customersRaw.length} زبون بنجاح.`);
    }

    // حفظ نسخة احتياطية في settings أيضاً
    try {
      const { error: cSnapErr } = await supabase.from('settings').upsert({
        id: 'customers',
        data: customersRaw
      });
      if (!cSnapErr) console.log(`✅ تم حفظ نسخة الزبائن في settings.`);
      else console.warn('⚠️ تعذر حفظ الزبائن في settings:', cSnapErr.message);
    } catch (e) {
      console.warn('⚠️ استثناء في حفظ الزبائن في settings:', e.message);
    }
  }

  // ====================================================
  // 3. ترحيل الموردين (13 → جدول suppliers + settings)
  // ====================================================
  console.log('\n--- [ 3/4 ] ترحيل الموردين ---');
  const EXCLUDED_SUPPLIER_CODES = ['S00000003'];
  const suppliersRaw = readJson(path.join(DATA_DIR, 'suppliers.json'));
  if (!suppliersRaw || !Array.isArray(suppliersRaw)) {
    console.warn('⚠️ تعذر قراءة suppliers.json أو الملف غير موجود — تخطّي.');
    migrationReport.suppliers = { source: 0, uploaded: 0, ok: false };
  } else {
    // استبعاد المورد الوهمي نهائياً
    const suppliersFiltered = suppliersRaw.filter(s => {
      const code = String(s.shamelCode || '').toUpperCase();
      const name = String(s.name || '');
      return !EXCLUDED_SUPPLIER_CODES.includes(code) && !name.includes('بضاعة قديمة');
    });
    console.log(`🏢 الموردين في الملف: ${suppliersRaw.length} | بعد استبعاد الوهميين: ${suppliersFiltered.length}`);

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
    migrationReport.suppliers = {
      source: suppliersFiltered.length,
      uploaded: suppResult.uploaded,
      failed: suppResult.failed,
      ok: suppResult.ok
    };

    if (!suppResult.ok) {
      console.error(`❌ فشل ترحيل الموردين: ${suppResult.errors.join(' | ')}`);
      totalErrors++;
    } else {
      console.log(`✅ تم ترحيل ${suppResult.uploaded}/${suppliersFiltered.length} مورد بنجاح.`);
    }

    // حفظ في settings أيضاً
    try {
      const { error: sSnapErr } = await supabase.from('settings').upsert({
        id: 'suppliers',
        data: suppliersFiltered
      });
      if (!sSnapErr) console.log(`✅ تم حفظ نسخة الموردين في settings.`);
      else console.warn('⚠️ تعذر حفظ الموردين في settings:', sSnapErr.message);
    } catch (e) {
      console.warn('⚠️ استثناء في حفظ الموردين في settings:', e.message);
    }
  }

  // ====================================================
  // 4. ترحيل الفواتير (→ جدول invoices)
  // ====================================================
  console.log('\n--- [ 4/4 ] ترحيل الفواتير ---');
  const invoicesRaw = readJson(path.join(DATA_DIR, 'invoices.json'));
  if (!invoicesRaw || !Array.isArray(invoicesRaw) || invoicesRaw.length === 0) {
    console.log('ℹ️ لا توجد فواتير لترحيلها.');
    migrationReport.invoices = { source: 0, uploaded: 0, ok: true };
  } else {
    console.log(`🧾 إجمالي الفواتير: ${invoicesRaw.length}`);
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
    migrationReport.invoices = {
      source: invoicesRaw.length,
      uploaded: invResult.uploaded,
      failed: invResult.failed,
      ok: invResult.ok
    };

    if (!invResult.ok) {
      console.error(`❌ فشل ترحيل الفواتير: ${invResult.errors.join(' | ')}`);
      totalErrors++;
    } else {
      console.log(`✅ تم ترحيل ${invResult.uploaded}/${invoicesRaw.length} فاتورة بنجاح.`);
    }
  }

  // ====================================================
  // 5. التحقق من الأعداد الفعلية في Supabase
  // ====================================================
  console.log('\n--- [ تحقق نهائي ] مقارنة الأعداد بين المصدر وSupabase ---');

  const tables = ['products', 'customers', 'suppliers', 'invoices'];
  for (const tbl of tables) {
    try {
      const { count, error } = await supabase
        .from(tbl)
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.warn(`⚠️ ${tbl}: تعذر فحص العدد —`, error.message);
      } else {
        const sourceCount = migrationReport[tbl]?.source ?? '—';
        const match = (count === migrationReport[tbl]?.uploaded) ? '✅ تطابق' : '⚠️ تباين';
        console.log(`   ${tbl}: Supabase=${count} | مصدر محلي=${sourceCount} | ${match}`);
      }
    } catch (e) {
      console.warn(`⚠️ ${tbl}: استثناء في الفحص —`, e.message);
    }
  }

  // ====================================================
  // 6. تقرير ختامي
  // ====================================================
  console.log('\n===============================================================');
  if (totalErrors === 0) {
    console.log('🎉 اكتمل الترحيل بنجاح — لا أخطاء مسجلة.');
  } else {
    console.error(`⚠️ اكتمل الترحيل مع ${totalErrors} جدول/جداول فاشلة. راجع السجلات أعلاه.`);
  }
  console.log('تقرير الترحيل:');
  Object.entries(migrationReport).forEach(([tbl, r]) => {
    const status = r.ok ? '✅' : '❌';
    console.log(`  ${status} ${tbl}: مصدر=${r.source ?? '—'} | تم رفعه=${r.uploaded ?? 0} | فشل=${r.failed ?? 0}`);
  });
  console.log('===============================================================\n');

  if (totalErrors > 0) {
    process.exit(1);
  }
}

migrate();
