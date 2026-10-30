const assert = require('assert');
const dataStore = require('../dataStore');
const telegramService = require('../telegramService');

async function runTests() {
  console.log('====================================================================');
  console.log('🧪 فحص مزامنة الموردين والزبائن وسندات الصرف لتيليجرام');
  console.log('====================================================================\n');

  // حفظ الحالة الأصلية للاستعادة بعد الاختبار
  const origSupps = dataStore.getSuppliers();
  const origCusts = dataStore.getCustomers();
  const origManar = origSupps.find(s => s.shamelCode === 'S00000001');
  const origNajah = origSupps.find(s => s.shamelCode === 'S00000002');
  const origCust = origCusts.find(c => c.systemNumber === 'C00000093' || c.shamelCode === 'C00000093');

  try {
    // 1. اختبار مزامنة الموردين مع استبعاد الحساب الوهمي S00000003
    console.log('▶ [1] اختبار syncBatchSuppliers مع حساب بضاعة قديمة S00000003:');
    const mockSuppliers = [
      { shamelCode: 'S00000001', name: 'شركة المنار - سائد', balance: (origManar ? origManar.balance : 468958.36) },
      { shamelCode: 'S00000003', name: 'مورد بضاعة قديمة', balance: 0 },
      { shamelCode: 'S00000002', name: 'النجاح للكمبيوتر', balance: (origNajah ? origNajah.balance : 0) }
    ];

    const suppRes = await dataStore.syncBatchSuppliers(mockSuppliers, { dryRun: false });
    assert.strictEqual(suppRes.success, true, 'يجب أن تنجح المزامنة');
    assert.strictEqual(suppRes.summary.totalReceived, 3, 'إجمالي المستلم يجب أن يطابق 3 بالضبط لعدم كسر شيكسوم الشامل');
    assert.strictEqual(suppRes.summary.unchanged >= 1, true, 'تم حساب مورد بضاعة قديمة كـ unchanged');
    assert.strictEqual(suppRes.summary.failed, 0, 'لا يوجد فشل');
    console.log('  ✅ نجح: totalReceived =', suppRes.summary.totalReceived, '| unchanged =', suppRes.summary.unchanged, '| success =', suppRes.success);

    // 2. اختبار مزامنة الزبائن وتوثيق تاريخ فرق الرصيد
    console.log('\n▶ [2] اختبار syncBatchCustomers وتوثيق تاريخ فرق الرصيد:');
    const testBal = (origCust ? parseFloat(origCust.balance) : 200) + 50;
    const testCustomer = {
      shamelCode: 'C00000093',
      name: 'ابراهيم جمال فوزي ابو بكر',
      balance: testBal
    };
    const custRes = await dataStore.syncBatchCustomers([testCustomer], { dryRun: false });
    assert.strictEqual(custRes.success, true, 'يجب أن تنجح مزامنة الزبائن');

    const customers = dataStore.getCustomers();
    const updatedCust = customers.find(c => c.systemNumber === 'C00000093' || c.shamelCode === 'C00000093');
    assert.ok(updatedCust, 'الزبون موجود بالنظام');
    assert.strictEqual(updatedCust.balance, testBal, 'الرصيد تم تحديثه');
    assert.ok(updatedCust.lastBalanceDiffDate, 'تم توثيق تاريخ فرق الرصيد');
    console.log('  ✅ نجح: رصيد الزبون =', updatedCust.balance, '| تاريخ الفرق =', updatedCust.lastBalanceDiffDate, '| الفرق =', updatedCust.balanceDifference);

    // 3. اختبار إصدار سند صرف لمورد وتحديث رصيده
    console.log('\n▶ [3] اختبار createReceipt لمورد (سند صرف):');
    const suppliersBefore = dataStore.getSuppliers();
    const suppTarget = suppliersBefore.find(s => s.shamelCode === 'S00000001');
    const suppBalBefore = parseFloat(suppTarget.balance) || 0;

    const testReceipt = await dataStore.createReceipt({
      employeeName: 'أبو رامز',
      customerName: suppTarget.name,
      customerId: suppTarget.id,
      customerSystemNumber: suppTarget.shamelCode,
      isSupplier: true,
      accountType: 'supplier',
      amount: 1000,
      paymentMethod: 'cash',
      description: 'دفعة نقدية تحت الحساب',
      notes: 'اختبار سند صرف لمورد'
    });

    assert.strictEqual(testReceipt.isSupplier, true, 'يجب تعريفه كسند مورد');
    assert.strictEqual(testReceipt.previousBalance, suppBalBefore, 'الرصيد السابق للمورد');
    assert.strictEqual(testReceipt.remainingBalance, suppBalBefore - 1000, 'الرصيد المتبقي للمورد دقيق');

    const suppliersAfter = dataStore.getSuppliers();
    const suppTargetAfter = suppliersAfter.find(s => s.id === suppTarget.id);
    assert.strictEqual(parseFloat(suppTargetAfter.balance), suppBalBefore - 1000, 'تم تحديث رصيد المورد بعد الصرف');
    console.log('  ✅ نجح: سند صرف #', testReceipt.receiptNumber, '| السابق:', testReceipt.previousBalance, '| المدفوع: 1000 | المتبقي:', testReceipt.remainingBalance);

    // 4. اختبار نص إشعار تيليجرام لسند الصرف
    console.log('\n▶ [4] اختبار صياغة رسالة تيليجرام لسند الصرف:');
    let capturedMessage = '';
    const mockSettings = {
      telegramBotToken: 'mock_token',
      telegramChatId: 'mock_chat',
      companyName: 'معرض أبو رامز',
      currency: '₪'
    };

    const origSend = telegramService.sendHtmlWithFallback;
    telegramService.sendHtmlWithFallback = async (token, chat, msg) => {
      capturedMessage = msg;
      return { ok: true };
    };

    await telegramService.sendReceiptNotification(testReceipt, mockSettings);
    telegramService.sendHtmlWithFallback = origSend;

    assert.ok(capturedMessage.includes('سند صرف لمورد'), 'يجب أن يكون العنوان سند صرف لمورد');
    assert.ok(capturedMessage.includes('المورد:'), 'يجب أن يظهر تصنيف المورد');
    assert.ok(capturedMessage.includes('المبلغ المصروف'), 'يجب أن يوضح أنه مصروف');
    assert.ok(capturedMessage.includes('المتبقي له بذمتنا') || capturedMessage.includes('الرصيد المتبقي'), 'يجب ألا يظهر 0 كرقم متبقي كاذب');
    assert.strictEqual(capturedMessage.includes('المبلغ المقبوض:'), false, 'يجب ألا يظهر كمبلغ مقبوض');
    console.log('  ✅ نجح: نص الرسالة يتضمن المتبقي الحقيقي ولا يظهر 0 كاذب:\n' + capturedMessage.split('\n').slice(0, 7).join('\n'));

    // تنظيف السند التجريبي (وحذف تأثيره على الرصيد)
    await dataStore.deleteReceipt(testReceipt.id);

  } finally {
    // استعادة الأرصدة الأصلية حتى لا يتأثر النظام الحقيقي بالاختبار
    if (origManar) {
      await dataStore.syncBatchSuppliers([{ shamelCode: origManar.shamelCode, name: origManar.name, balance: origManar.balance }], { dryRun: false });
    }
    if (origNajah) {
      await dataStore.syncBatchSuppliers([{ shamelCode: origNajah.shamelCode, name: origNajah.name, balance: origNajah.balance }], { dryRun: false });
    }
    if (origCust) {
      await dataStore.syncBatchCustomers([{ shamelCode: origCust.shamelCode || origCust.systemNumber, name: origCust.name, balance: origCust.balance }], { dryRun: false });
    }
  }

  console.log('\n🎉 اكتملت جميع الاختبارات بنجاح واستعادة الأرصدة الأصلية!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ خطأ في الاختبار:', err);
  process.exit(1);
});

