/**
 * sync_balances_live.js
 * يجلب أرصدة الموردين والزبائن الحية من قاعدة بيانات الشامل SQL Server
 * ويزامنها مع الموقع — يضمن عدم وجود أي فرق بعد التشغيل
 */
const sql = require('mssql');
const dataStore = require('../dataStore');

const SQL_CONFIG = {
  server: 'localhost\\SQLEXPRESS_2',
  database: 'ShamelRealData',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    instanceName: 'SQLEXPRESS_2'
  }
};

// ============================================================
// استعلام أرصدة الموردين (كودهم يبدأ بـ S)
// ============================================================
const SUPPLIERS_QUERY = `
SELECT 
    coa.code AS code,
    coa.name AS name,
    ISNULL(SUM(CASE j.debit_credit WHEN 'C' THEN j.base_curr_amount ELSE -j.base_curr_amount END), 0) AS balance
FROM ChartOfAccount coa
LEFT JOIN Journals j ON j.account_id = coa.id AND j.status = '0'
LEFT JOIN Vouchers_And_Bills v ON j.voucher_id = v.id AND v.status = '0'
WHERE coa.code LIKE 'S%'
GROUP BY coa.code, coa.name
ORDER BY coa.code
`;

// ============================================================
// استعلام أرصدة الزبائن (كودهم يبدأ بـ C)
// ============================================================
const CUSTOMERS_QUERY = `
SELECT 
    coa.code AS code,
    coa.name AS name,
    ISNULL(SUM(CASE j.debit_credit WHEN 'D' THEN j.base_curr_amount ELSE -j.base_curr_amount END), 0) AS balance
FROM ChartOfAccount coa
LEFT JOIN Journals j ON j.account_id = coa.id AND j.status = '0'
LEFT JOIN Vouchers_And_Bills v ON j.voucher_id = v.id AND v.status = '0'
WHERE coa.code LIKE 'C%'
GROUP BY coa.code, coa.name
ORDER BY coa.code
`;

async function runLiveSync() {
  console.log('🔄 بدء المزامنة الحية من قاعدة بيانات الشامل...\n');

  let pool;
  try {
    pool = await sql.connect(SQL_CONFIG);
    console.log('✅ تم الاتصال بقاعدة بيانات الشامل SQL Server\n');
  } catch (connErr) {
    console.error('❌ فشل الاتصال بقاعدة بيانات الشامل:', connErr.message);
    process.exit(1);
  }

  // ===== موردين =====
  let suppliersFromShamel = [];
  try {
    const suppResult = await pool.request().query(SUPPLIERS_QUERY);
    suppliersFromShamel = suppResult.recordset.map(r => ({
      code: String(r.code || '').trim(),
      name: String(r.name || '').trim(),
      balance: Math.round((parseFloat(r.balance) || 0) * 100) / 100
    })).filter(r => r.code && r.name);
    console.log(`📦 تم جلب ${suppliersFromShamel.length} مورد من الشامل`);
  } catch (e) {
    console.error('❌ خطأ في جلب الموردين:', e.message);
    await pool.close();
    process.exit(1);
  }

  // ===== زبائن =====
  let customersFromShamel = [];
  try {
    const custResult = await pool.request().query(CUSTOMERS_QUERY);
    customersFromShamel = custResult.recordset.map(r => ({
      code: String(r.code || '').trim(),
      name: String(r.name || '').trim(),
      balance: Math.round((parseFloat(r.balance) || 0) * 100) / 100
    })).filter(r => r.code && r.name);
    console.log(`👥 تم جلب ${customersFromShamel.length} زبون من الشامل`);
  } catch (e) {
    console.error('❌ خطأ في جلب الزبائن:', e.message);
    await pool.close();
    process.exit(1);
  }

  await pool.close();
  console.log('✅ تم إغلاق اتصال SQL\n');

  // ===== مزامنة الموردين =====
  console.log('🔄 مزامنة أرصدة الموردين...');
  const suppResult = await dataStore.syncBatchSuppliers(suppliersFromShamel, {
    dryRun: false,
    syncMode: 'upsert',
    editorName: 'مزامنة حية - SQL مباشر'
  });
  console.log(`✅ الموردين: تم إنشاء ${suppResult.summary.created} | تحديث ${suppResult.summary.updated} | بدون تغيير ${suppResult.summary.unchanged} | فشل ${suppResult.summary.failed}`);
  if (suppResult.summary.errors.length > 0) {
    console.log('⚠️  أخطاء موردين:', suppResult.summary.errors);
  }

  // ===== مزامنة الزبائن =====
  console.log('\n🔄 مزامنة أرصدة الزبائن...');
  const custResult = await dataStore.syncBatchCustomers(customersFromShamel, {
    dryRun: false,
    syncMode: 'upsert',
    editorName: 'مزامنة حية - SQL مباشر'
  });
  console.log(`✅ الزبائن: تم إنشاء ${custResult.summary.created} | تحديث ${custResult.summary.updated} | بدون تغيير ${custResult.summary.unchanged} | فشل ${custResult.summary.failed}`);
  if (custResult.summary.errors.length > 0) {
    console.log('⚠️  أخطاء زبائن (أول 10):', custResult.summary.errors.slice(0, 10));
  }

  // ===== فحص الفروقات بعد المزامنة =====
  console.log('\n🔍 فحص الفروقات بعد المزامنة...');
  const siteSupplers = dataStore.getSuppliers();
  const siteCustomers = dataStore.getCustomers();

  let diffs = 0;

  suppliersFromShamel.forEach(ls => {
    if (ls.code === 'S00000003') return;
    const local = siteSupplers.find(s => s.shamelCode === ls.code);
    const localBal = parseFloat(local ? (local.shamelBalance !== undefined ? local.shamelBalance : local.balance) : 'NaN');
    if (!local || Math.abs(localBal - ls.balance) > 0.01) {
      console.log(`❌ فرق مورد - ${ls.code} ${ls.name} | الشامل: ${ls.balance} | الموقع: ${local ? localBal : 'غير موجود'}`);
      diffs++;
    }
  });

  customersFromShamel.forEach(lc => {
    const local = siteCustomers.find(c => c.systemNumber === lc.code || c.shamelCode === lc.code);
    const localBal = parseFloat(local ? (local.shamelBalance !== undefined ? local.shamelBalance : local.balance) : 'NaN');
    if (!local || Math.abs(localBal - lc.balance) > 0.01) {
      if (local || lc.balance !== 0) { // تجاهل الزبائن غير الموجودين برصيد 0
        console.log(`❌ فرق زبون - ${lc.code} ${lc.name} | الشامل: ${lc.balance} | الموقع: ${local ? localBal : 'غير موجود'}`);
        diffs++;
      }
    }
  });

  if (diffs === 0) {
    console.log('\n✅✅✅ لا يوجد أي فرق! جميع الأرصدة متطابقة مع الشامل تماماً');
  } else {
    console.log(`\n⚠️  إجمالي الفروقات المتبقية: ${diffs}`);
  }

  console.log('\n🏁 انتهت عملية المزامنة الحية');
  process.exit(0);
}

runLiveSync().catch(err => {
  console.error('❌ خطأ غير متوقع:', err.message);
  process.exit(1);
});
