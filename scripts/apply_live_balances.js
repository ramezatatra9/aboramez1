/**
 * apply_live_balances.js
 * يقرأ الأرصدة المصدّرة من الشامل ويزامنها مع قاعدة بيانات الموقع
 */
const fs = require('fs');
const path = require('path');
const dataStore = require('../dataStore');

const SUPP_FILE = path.join(__dirname, '../data/live_shamel_suppliers.json');
const CUST_FILE = path.join(__dirname, '../data/live_shamel_customers.json');

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  // يمكن أن يكون مصفوفة أو كائن واحد من ConvertTo-Json
  return Array.isArray(data) ? data : [data];
}

async function main() {
  console.log('🔄 بدء تطبيق الأرصدة الحية من الشامل على الموقع...\n');

  // قراءة ملفات الأرصدة
  const rawSuppliers = readJsonFile(SUPP_FILE);
  const rawCustomers = readJsonFile(CUST_FILE);

  console.log(`📦 موردين من الشامل: ${rawSuppliers.length}`);
  console.log(`👥 زبائن من الشامل: ${rawCustomers.length}\n`);

  // تحويل إلى الصيغة التي تتوقعها syncBatch
  const suppliers = rawSuppliers.map(r => ({
    code: String(r.code || '').trim(),
    name: String(r.name || '').trim(),
    balance: parseFloat(r.balance) || 0
  })).filter(r => r.code && r.name);

  const customers = rawCustomers.map(r => ({
    code: String(r.code || '').trim(),
    name: String(r.name || '').trim(),
    balance: parseFloat(r.balance) || 0
  })).filter(r => r.code && r.name);

  // مزامنة الموردين
  console.log('🔄 مزامنة الموردين...');
  const suppResult = await dataStore.syncBatchSuppliers(suppliers, {
    dryRun: false,
    syncMode: 'upsert',
    editorName: 'مزامنة حية مباشرة'
  });
  const ss = suppResult.summary;
  console.log(`✅ الموردين: أُنشئ=${ss.created} | حُدّث=${ss.updated} | بلا تغيير=${ss.unchanged} | فشل=${ss.failed}`);
  if (ss.errors.length > 0) console.log('⚠️ أخطاء موردين:', ss.errors);

  // مزامنة الزبائن (على دفعات لتجنب حد 1000)
  console.log('\n🔄 مزامنة الزبائن...');
  const BATCH_SIZE = 800;
  let totalCreated = 0, totalUpdated = 0, totalUnchanged = 0, totalFailed = 0;
  const allCustErrors = [];

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    const result = await dataStore.syncBatchCustomers(batch, {
      dryRun: false,
      syncMode: 'upsert',
      editorName: 'مزامنة حية مباشرة'
    });
    const cs = result.summary;
    totalCreated += cs.created;
    totalUpdated += cs.updated;
    totalUnchanged += cs.unchanged;
    totalFailed += cs.failed;
    if (cs.errors.length > 0) allCustErrors.push(...cs.errors);
    console.log(`  دفعة ${Math.floor(i/BATCH_SIZE)+1}: أُنشئ=${cs.created} | حُدّث=${cs.updated} | بلا تغيير=${cs.unchanged} | فشل=${cs.failed}`);
  }

  console.log(`✅ إجمالي الزبائن: أُنشئ=${totalCreated} | حُدّث=${totalUpdated} | بلا تغيير=${totalUnchanged} | فشل=${totalFailed}`);
  if (allCustErrors.length > 0) console.log('⚠️ أخطاء زبائن (أول 10):', allCustErrors.slice(0, 10));

  // فحص الفروقات بعد المزامنة
  console.log('\n🔍 فحص الفروقات بعد المزامنة...');
  const siteSuppliers = dataStore.getSuppliers();
  const siteCustomers = dataStore.getCustomers();

  let diffs = 0;

  suppliers.forEach(ls => {
    if (ls.code === 'S00000003') return;
    const local = siteSuppliers.find(s => s.shamelCode === ls.code);
    const localBal = local ? parseFloat(local.shamelBalance !== undefined ? local.shamelBalance : local.balance) : NaN;
    if (!local || Math.abs(localBal - ls.balance) > 0.01) {
      console.log(`❌ فرق مورد | ${ls.code} ${ls.name} | الشامل: ${ls.balance} | الموقع: ${local ? localBal : 'غير موجود'}`);
      diffs++;
    }
  });

  customers.forEach(lc => {
    const local = siteCustomers.find(c => c.systemNumber === lc.code || c.shamelCode === lc.code);
    if (!local) {
      if (Math.abs(lc.balance) > 0.01) {
        console.log(`❌ زبون غير موجود | ${lc.code} ${lc.name} | الشامل: ${lc.balance}`);
        diffs++;
      }
      return;
    }
    const localBal = parseFloat(local.shamelBalance !== undefined ? local.shamelBalance : local.balance);
    if (Math.abs(localBal - lc.balance) > 0.01) {
      console.log(`❌ فرق زبون | ${lc.code} ${lc.name} | الشامل: ${lc.balance} | الموقع: ${localBal}`);
      diffs++;
    }
  });

  console.log('');
  if (diffs === 0) {
    console.log('✅✅✅ ممتاز! لا يوجد أي فرق — جميع الأرصدة متطابقة 100% مع الشامل');
  } else {
    console.log(`⚠️  إجمالي الفروقات المتبقية: ${diffs}`);
  }

  console.log('\n🏁 انتهت عملية المزامنة الحية بنجاح');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});

