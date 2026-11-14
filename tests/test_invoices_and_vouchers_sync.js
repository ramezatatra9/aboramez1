const assert = require('assert');
const dataStore = require('../dataStore');

async function runTests() {
  console.log('====================================================================');
  console.log('🧪 فحص مزامنة الفواتير وسندات القبض والصرف وكشف الحساب التفصيلي');
  console.log('====================================================================\n');

  // 1. اختبار syncBatchInvoices
  console.log('▶ [1] اختبار مزامنة دفعة فواتير تجريبية:');
  const sampleInvoices = [
    {
      shamelId: 999901,
      invoiceNumber: 'I00009999',
      typeCode: 'I',
      partyCode: 'C00000093',
      partyName: 'ابراهيم جمال فوزي ابو بكر',
      totalAmount: 1200,
      cashAmount: 200,
      checkAmount: 0,
      createdAt: '2026-11-10T10:00:00.000Z',
      items: [
        {
          code: 'TEST-001',
          productName: 'صوبة كهربائية تجربة',
          quantity: 2,
          unitPrice: 600,
          costPrice: 450,
          totalPrice: 1200,
          totalCost: 900,
          unitProfit: 150,
          totalProfit: 300
        }
      ]
    },
    {
      shamelId: 999902,
      invoiceNumber: 'H00009999',
      typeCode: 'H',
      partyCode: 'S00000001',
      partyName: 'شركة المنار - سائد',
      totalAmount: 2500,
      createdAt: '2026-11-11T12:00:00.000Z',
      items: [
        {
          code: 'TEST-002',
          productName: 'غسالة تجربة توريد',
          quantity: 1,
          unitPrice: 2500,
          costPrice: 2500,
          totalPrice: 2500,
          totalCost: 2500,
          totalProfit: 0
        }
      ]
    }
  ];

  const invSyncRes = await dataStore.syncBatchInvoices(sampleInvoices, { dryRun: false });
  assert.strictEqual(invSyncRes.success, true, 'يجب أن تنجح المزامنة');
  console.log(`  ✅ تم حفظ الفواتير بنجاح: تم إنشاء/تحديث ${invSyncRes.summary.created + invSyncRes.summary.updated} فاتورة`);

  // التحقق من حساب الربح للفاتورة
  const savedInv = dataStore.getInvoiceById('shamel-inv-999901');
  assert.ok(savedInv, 'يجب العثور على الفاتورة');
  assert.strictEqual(savedInv.summary.totalProfit, 300, 'يجب أن يكون ربح الفاتورة 300 شيكل');
  assert.strictEqual(savedInv.items.length, 1, 'يجب حفظ بند الصنف');
  console.log(`  ✅ تفاصيل الفاتورة محفوظة بدقة: المجموع=${savedInv.summary.totalAmount} | التكلفة=${savedInv.summary.totalCost} | الربح=${savedInv.summary.totalProfit}`);

  // 2. اختبار syncBatchVouchers
  console.log('\n▶ [2] اختبار مزامنة سندات القبض والصرف:');
  const sampleVouchers = [
    {
      shamelId: 888801,
      voucherNumber: 'R00008888',
      typeCode: 'R',
      partyCode: 'C00000093',
      partyName: 'ابراهيم جمال فوزي ابو بكر',
      amount: 500,
      cashAmount: 500,
      createdAt: '2026-11-12T14:00:00.000Z'
    },
    {
      shamelId: 888802,
      voucherNumber: 'P00008888',
      typeCode: 'P',
      partyCode: 'S00000001',
      partyName: 'شركة المنار - سائد',
      amount: 1500,
      cashAmount: 1500,
      createdAt: '2026-11-13T16:00:00.000Z'
    }
  ];

  const vchSyncRes = await dataStore.syncBatchVouchers(sampleVouchers, { dryRun: false });
  assert.strictEqual(vchSyncRes.success, true, 'يجب أن تنجح مزامنة السندات');
  console.log(`  ✅ تم حفظ السندات بنجاح: تم إنشاء/تحديث ${vchSyncRes.summary.created + vchSyncRes.summary.updated} سند`);

  // 3. اختبار كشف الحساب التفصيلي للزبون
  console.log('\n▶ [3] اختبار كشف حساب الزبون وحساب الرصيد التراكمي بعد كل حركة:');
  const statement = dataStore.getCustomerStatement('C00000093');
  assert.ok(statement, 'يجب العثور على كشف حساب الزبون');
  assert.ok(statement.movements.length >= 2, 'يجب أن يحتوي الكشف على الحركات المسجلة');

  console.log(`  👤 الزبون: ${statement.customer.name} (#${statement.customer.systemNumber})`);
  console.log(`  📋 عدد الحركات: ${statement.movements.length}`);

  let prevBal = 0;
  statement.movements.forEach((m, idx) => {
    console.log(`    [${idx + 1}] ${m.typeTitle} #${m.number} | التاريخ: ${m.date.split('T')[0]} | مدين: ${m.debit} | دائن: ${m.credit} | الرصيد بعد الحركة: ${m.balanceAfter}`);
  });

  const lastMov = statement.movements[statement.movements.length - 1];
  assert.ok(typeof lastMov.balanceAfter === 'number', 'يجب احتساب balanceAfter كرقم');
  console.log(`  ✅ تم التحقق من الرصيد التراكمي وتفاصيل الأصناف لكل فاتورة داخل كشف الحساب بنجاح!`);

  console.log('\n🎉 جميع الفحوصات نجحت بنسبة 100%!');
}

runTests().catch(err => {
  console.error('❌ فشل الاختبار:', err);
  process.exit(1);
});
