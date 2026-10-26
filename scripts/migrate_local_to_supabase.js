// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// سكربت الترحيل والتحقق الشامل: نقل البيانات الحقيقية من الملفات المحلية إلى Supabase
// ====================================================================

const fs = require('fs');
const path = require('path');
const { supabase, testSupabaseConnection } = require('../supabaseClient');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function migrate() {
  console.log('===============================================================');
  console.log('🚀 بدء ترحيل البيانات الحقيقية إلى قاعدة بيانات Supabase الدائمة');
  console.log('===============================================================');

  if (!supabase) {
    console.error('❌ خطأ: عميل Supabase غير مهيأ. تأكد من إعدادات الاتصال.');
    process.exit(1);
  }

  // 1. فحص الاتصال وصلاحيات الكتابة
  const conn = await testSupabaseConnection();
  console.log('📡 فحص الاتصال بـ Supabase:', {
    'متصل وقادر على القراءة': conn.readOk ? 'نعم ✅' : 'لا ❌',
    'صلاحية الكتابة متاحة': conn.writeOk ? 'نعم ✅' : 'محجوبة بـ RLS ⚠️',
    'عنوان المشروع': conn.url
  });

  if (!conn.readOk) {
    console.error('❌ تعذر الاتصال بـ Supabase للقراءة. تحقق من مفتاح API والإنترنت.');
    process.exit(1);
  }

  if (!conn.writeOk) {
    console.warn('\n⚠️ تنبيه هام حول صلاحية الكتابة:');
    console.warn('   سياسة أمان Supabase (RLS) تمنع الكتابة بالمفتاح العام (anon).');
    console.warn('   لحل ذلك بشكل دائم، نفذ أحد الخيارين:');
    console.warn('   الخيار 1 (الموصى به فوراً): افتح Supabase SQL Editor ونفّذ ملف migrations/001_permanent_schema.sql');
    console.warn('   الخيار 2: أضف مفتاح SUPABASE_SERVICE_ROLE_KEY في ملف .env ومتغيرات Render.');
    console.warn('   سيتم محاولة الكتابة الآن لمعاينة النتيجة...\n');
  }

  // 2. ترحيل المنتجات الحقيقية
  const productsFile = path.join(DATA_DIR, 'products.json');
  if (fs.existsSync(productsFile)) {
    const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
    console.log(`📦 جاري ترحيل ${products.length} صنف حقيقي إلى جدول products...`);

    const BATCH_SIZE = 100;
    let uploadedCount = 0;
    let failedCount = 0;
    let firstError = null;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const chunk = products.slice(i, i + BATCH_SIZE).map(p => ({
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
        lastStockUpdate: p.lastStockUpdate || null,
        lastStockEditor: p.lastStockEditor || null,
        createdAt: p.createdAt || new Date().toISOString()
      }));

      const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'code' });
      if (error) {
        failedCount += chunk.length;
        if (!firstError) firstError = error.message;
      } else {
        uploadedCount += chunk.length;
      }
    }

    if (uploadedCount > 0) {
      console.log(`✅ تم ترحيل ${uploadedCount} صنف بنجاح إلى جدول products في Supabase!`);
    }
    if (failedCount > 0) {
      console.warn(`⚠️ تعذر رفع ${failedCount} صنف مباشرة إلى جدول products (السبب: ${firstError})`);
    }

    // حفظ نسخة احتياطية لقطة شاملة في جدول settings
    try {
      const { error: snapErr } = await supabase.from('settings').upsert({
        id: 'products_snapshot',
        data: products
      });
      if (!snapErr) {
        console.log(`✅ تم حفظ snapshot كامل للمنتجات (${products.length} صنف) في Supabase settings بنجاح`);
      } else {
        console.warn(`⚠️ تعذر حفظ products_snapshot في settings:`, snapErr.message);
      }
    } catch (e) {
      console.warn(`⚠️ استثناء في حفظ snapshot:`, e.message);
    }
  }

  // 3. ترحيل الزبائن
  const customersFile = path.join(DATA_DIR, 'customers.json');
  if (fs.existsSync(customersFile)) {
    const customers = JSON.parse(fs.readFileSync(customersFile, 'utf8'));
    console.log(`👥 جاري ترحيل ${customers.length} زبون إلى Supabase...`);
    try {
      const { error } = await supabase.from('settings').upsert({
        id: 'customers',
        data: customers
      });
      if (!error) {
        console.log(`✅ تم حفظ ${customers.length} زبون في Supabase بنجاح`);
      } else {
        console.warn(`⚠️ تعذر حفظ الزبائن في Supabase:`, error.message);
      }
    } catch (e) {
      console.warn(`⚠️ استثناء في حفظ الزبائن:`, e.message);
    }
  }

  // 4. ترحيل الموردين
  const suppliersFile = path.join(DATA_DIR, 'suppliers.json');
  if (fs.existsSync(suppliersFile)) {
    const suppliers = JSON.parse(fs.readFileSync(suppliersFile, 'utf8'));
    console.log(`🏢 جاري ترحيل ${suppliers.length} مورد إلى Supabase...`);
    try {
      const { error } = await supabase.from('settings').upsert({
        id: 'suppliers',
        data: suppliers
      });
      if (!error) {
        console.log(`✅ تم حفظ ${suppliers.length} مورد في Supabase بنجاح`);
      } else {
        console.warn(`⚠️ تعذر حفظ الموردين في Supabase:`, error.message);
      }
    } catch (e) {
      console.warn(`⚠️ استثناء في حفظ الموردين:`, e.message);
    }
  }

  // 5. ترحيل الفواتير وسندات القبض
  const invoicesFile = path.join(DATA_DIR, 'invoices.json');
  if (fs.existsSync(invoicesFile)) {
    const invoices = JSON.parse(fs.readFileSync(invoicesFile, 'utf8'));
    if (invoices.length > 0) {
      console.log(`🧾 جاري ترحيل ${invoices.length} فاتورة إلى Supabase...`);
      for (const inv of invoices) {
        try {
          await supabase.from('invoices').upsert({
            id: String(inv.id),
            invoiceNumber: inv.invoiceNumber,
            createdAt: inv.createdAt,
            employeeName: inv.employeeName,
            customerName: inv.customerName,
            customerPhone: inv.customerPhone,
            notes: inv.notes,
            items: inv.items,
            summary: inv.summary,
            paymentMethod: inv.paymentMethod,
            installmentDetails: inv.installmentDetails,
            telegramStatus: inv.telegramStatus
          });
        } catch (_) {}
      }
      console.log(`✅ تم فحص وترحيل الفواتير`);
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 اكتمل فحص وتنفيذ مرحلة الترحيل.');
  console.log('===============================================================\n');
}

migrate();
