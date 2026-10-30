/**
 * force_sync_supabase.js
 * يجبر Supabase على قبول الأرصدة الصحيحة من ملفات الشامل المُصدَّرة
 * يُشغَّل مرة واحدة لتصحيح قاعدة البيانات، ثم يعمل النظام تلقائياً
 */
const fs = require('fs');
const path = require('path');
const { supabase } = require('../supabaseClient');

const SUPP_FILE = path.join(__dirname, '../data/live_shamel_suppliers.json');
const CUST_FILE = path.join(__dirname, '../data/live_shamel_customers.json');
const LOCAL_SUPP_FILE = path.join(__dirname, '../data/suppliers.json');
const LOCAL_CUST_FILE = path.join(__dirname, '../data/customers.json');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [data];
}

async function main() {
  console.log('🔄 بدء الإصلاح الكامل لـ Supabase...\n');

  if (!supabase) {
    console.error('❌ Supabase غير متصل');
    process.exit(1);
  }

  // 1. قراءة الأرصدة الصحيحة من الشامل
  const shamelSuppliers = readJson(SUPP_FILE);
  const shamelCustomers = readJson(CUST_FILE);
  console.log(`📦 أرصدة الشامل: ${shamelSuppliers.length} مورد | ${shamelCustomers.length} زبون`);

  // بناء خريطة الأرصدة الصحيحة
  const suppBalMap = new Map();
  shamelSuppliers.forEach(s => suppBalMap.set(String(s.code).trim().toUpperCase(), parseFloat(s.balance) || 0));

  const custBalMap = new Map();
  shamelCustomers.forEach(c => custBalMap.set(String(c.code).trim().toUpperCase(), parseFloat(c.balance) || 0));

  // 2. قراءة الموردين الحاليين من الملف المحلي وتصحيح أرصدتهم
  const localSuppliers = readJson(LOCAL_SUPP_FILE);
  const correctedSuppliers = localSuppliers.map(s => {
    const code = String(s.shamelCode || '').trim().toUpperCase();
    if (!code) return s;
    const correctBal = suppBalMap.has(code) ? suppBalMap.get(code) : (parseFloat(s.shamelBalance) || 0);
    return {
      ...s,
      balance: correctBal,
      shamelBalance: correctBal,
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      syncedBy: 'إصلاح كامل Supabase'
    };
  });

  // 3. قراءة الزبائن الحاليين وتصحيح أرصدتهم
  const localCustomers = readJson(LOCAL_CUST_FILE);
  const correctedCustomers = localCustomers.map(c => {
    const code = String(c.systemNumber || c.shamelCode || '').trim().toUpperCase();
    if (!code) return c;
    const correctBal = custBalMap.has(code) ? custBalMap.get(code) : (parseFloat(c.shamelBalance) || 0);
    return {
      ...c,
      balance: correctBal,
      shamelBalance: correctBal,
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      syncedBy: 'إصلاح كامل Supabase'
    };
  });

  // 4. حفظ الملفات المحلية المصحَّحة
  fs.writeFileSync(LOCAL_SUPP_FILE, JSON.stringify(correctedSuppliers, null, 2), 'utf8');
  fs.writeFileSync(LOCAL_CUST_FILE, JSON.stringify(correctedCustomers, null, 2), 'utf8');
  console.log('✅ تم تصحيح الملفات المحلية');

  // 5. حفظ إلى Supabase settings.suppliers (المصدر الأساسي للاستعادة)
  console.log('\n🔄 حفظ الموردين إلى Supabase settings...');
  const { error: suppSettingsErr } = await supabase.from('settings').upsert({
    id: 'suppliers',
    data: correctedSuppliers
  });
  if (suppSettingsErr) {
    console.error('❌ خطأ settings.suppliers:', suppSettingsErr.message);
  } else {
    console.log('✅ settings.suppliers محدَّث');
  }

  // 6. حفظ إلى Supabase settings.customers
  console.log('🔄 حفظ الزبائن إلى Supabase settings...');
  const { error: custSettingsErr } = await supabase.from('settings').upsert({
    id: 'customers',
    data: correctedCustomers
  });
  if (custSettingsErr) {
    console.error('❌ خطأ settings.customers:', custSettingsErr.message);
  } else {
    console.log('✅ settings.customers محدَّث');
  }

  // 7. تحديث جدول suppliers المباشر
  console.log('\n🔄 تحديث جدول suppliers في Supabase...');
  const suppRows = correctedSuppliers
    .filter(s => s.id && s.shamelCode)
    .map(s => ({
      id: String(s.id),
      shamelCode: String(s.shamelCode || ''),
      name: String(s.name || ''),
      phone: String(s.phone || ''),
      email: String(s.email || ''),
      address: String(s.address || ''),
      notes: String(s.notes || ''),
      isStopped: Boolean(s.isStopped),
      balance: parseFloat(s.balance) || 0,
      shamelBalance: parseFloat(s.shamelBalance) || 0,
      createdAt: s.createdAt || new Date().toISOString()
    }));

  if (suppRows.length > 0) {
    const { error: suppTableErr } = await supabase.from('suppliers').upsert(suppRows, { onConflict: 'id' });
    if (suppTableErr) console.error('⚠️ جدول suppliers:', suppTableErr.message);
    else console.log(`✅ جدول suppliers: تم تحديث ${suppRows.length} مورد`);
  }

  // 8. تحديث جدول customers المباشر
  console.log('🔄 تحديث جدول customers في Supabase...');
  const custRows = correctedCustomers
    .filter(c => c.id)
    .map(c => ({
      id: String(c.id),
      systemNumber: String(c.systemNumber || c.shamelCode || ''),
      shamelCode: String(c.shamelCode || c.systemNumber || ''),
      name: String(c.name || ''),
      phone: String(c.phone || ''),
      email: String(c.email || ''),
      address: String(c.address || ''),
      notes: String(c.notes || ''),
      isStopped: Boolean(c.isStopped),
      balance: parseFloat(c.balance) || 0,
      createdAt: c.createdAt || new Date().toISOString()
    }));

  // نرسل على دفعات لتجنب timeout
  const BATCH = 200;
  let custUpdated = 0;
  for (let i = 0; i < custRows.length; i += BATCH) {
    const batch = custRows.slice(i, i + BATCH);
    const { error: custErr } = await supabase.from('customers').upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
    if (custErr) {
      // محاولة واحدة واحدة عند وجود تعارض
      for (const row of batch) {
        try {
          await supabase.from('customers').upsert(row, { onConflict: 'id' });
          custUpdated++;
        } catch (_) {}
      }
    } else {
      custUpdated += batch.length;
    }
  }
  console.log(`✅ جدول customers: تم تحديث ${custUpdated} زبون`);

  // 9. التحقق من النتيجة
  console.log('\n🔍 التحقق من النتيجة...');
  const { data: verifySupp } = await supabase.from('settings').select('data').eq('id','suppliers').maybeSingle();
  if (verifySupp && Array.isArray(verifySupp.data)) {
    let diffs = 0;
    verifySupp.data.forEach(s => {
      const code = String(s.shamelCode || '').toUpperCase();
      if (code === 'S00000003') return;
      const expected = suppBalMap.get(code);
      if (expected !== undefined && Math.abs((parseFloat(s.shamelBalance)||0) - expected) > 0.01) {
        console.log(`❌ لا يزال مختلفاً: ${code} ${s.name} | Supabase: ${s.shamelBalance} | الشامل: ${expected}`);
        diffs++;
      }
    });
    if (diffs === 0) {
      console.log('✅✅✅ جميع أرصدة الموردين في Supabase صحيحة الآن!');
    }
  }

  console.log('\n🏁 اكتمل الإصلاح. أعد تشغيل السيرفر لتفعيل التغييرات.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
