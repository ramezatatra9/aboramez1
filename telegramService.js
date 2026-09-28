// وحدة الربط مع تيليجرام (Telegram Bot Service)

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatCurrency(amount, currency = 'شيكل') {
  const num = parseFloat(amount) || 0;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDateTime(dateInput) {
  const d = new Date(dateInput || Date.now());
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'مساءً' : 'صباحاً';
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} الساعة ${hours}:${minutes} ${period}`;
}

const telegramService = {
  /**
   * إرسال رسالة فحص واختبار الاتصال مع تيليجرام
   */
  async testConnection(botToken, chatId, companyName = 'رامز عطاطرة') {
    if (!botToken || !chatId) {
      throw new Error('يرجى إدخال Bot Token و Chat ID أولاً');
    }

    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();

    const message = 
`🔔 <b>تجربة اتصال ناجحة بنظام الفواتير والمبيعات</b>

🏢 <b>الشركة / المحل:</b> ${escapeHtml(companyName)}
⏰ <b>الوقت:</b> ${formatDateTime(new Date())}
✅ تم ضبط البوت بنجاح! ستصلك إشعارات الفواتير وتفاصيل الأرباح فور إنشائها من قِبل الموظفين مباشرة على هذا الحساب.`;

    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.description || 'فشل إرسال الرسالة عبر تيليجرام');
    }

    return result;
  },

  /**
   * تنسيق وإرسال تفاصيل الفاتورة الكاملة إلى تيليجرام
   */
  async sendInvoiceNotification(invoice, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || 'شيكل';

    if (!botToken || !chatId) {
      console.warn('Telegram token or chat ID not set. Skipping notification.');
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام (Bot Token أو Chat ID)' };
    }

    const companyName = settings.companyName || 'رامز عطاطرة';
    const invoiceDate = formatDateTime(invoice.createdAt);

    // بناء قائمة المنتجات
    let itemsText = '';
    (invoice.items || []).forEach((item, idx) => {
      const itemTotalSell = (item.sellPrice || 0) * (item.quantity || 1);
      const itemUnitProfit = (item.sellPrice || 0) - (item.costPrice || 0);
      const itemTotalProfit = itemUnitProfit * (item.quantity || 1);

      itemsText += 
`▫️ <b>${idx + 1}. ${escapeHtml(item.productName)}</b>
   الكمية: <b>${item.quantity}</b> | سعر البيع: ${formatCurrency(item.sellPrice, currency)}
   رأس المال (التكلفة): ${formatCurrency(item.costPrice, currency)}
   ربح القطعة: <b>${formatCurrency(itemUnitProfit, currency)}</b>
   إجمالي البند: <b>${formatCurrency(itemTotalSell, currency)}</b> (إجمالي ربح الصنف: +${formatCurrency(itemTotalProfit, currency)})
`;
    });

    // تفاصيل طريقة الدفع
    let paymentDetailsText = '';
    if (invoice.paymentMethod === 'installments') {
      const inst = invoice.installmentDetails || {};
      paymentDetailsText = 
`💳 <b>طريقة الدفع:</b> ⏳ <b>أقساط مجدولة</b>
   🔹 <b>الدفعة الأولى المدفوعة:</b> ${formatCurrency(inst.downPayment, currency)}
   🔹 <b>المبلغ المتبقي:</b> ${formatCurrency(inst.remainingAmount, currency)}
   🔹 <b>مدة سداد باقي المبلغ:</b> <b>${escapeHtml(inst.duration || 'غير محددة')}</b>
${inst.scheduleNotes ? `   🔹 <b>ملاحظات الأقساط:</b> ${escapeHtml(inst.scheduleNotes)}\n` : ''}`;
    } else {
      paymentDetailsText = 
`💳 <b>طريقة الدفع:</b> ✅ <b>نقداً (كاش كامل)</b>`;
    }

    const totalProfit = invoice.summary?.totalProfit || 0;
    const totalAmount = invoice.summary?.totalAmount || 0;
    const totalCost = invoice.summary?.totalCost || 0;
    const profitMargin = invoice.summary?.profitMarginPercentage || (totalAmount > 0 ? ((totalProfit / totalAmount) * 100).toFixed(1) : 0);

    const message = 
`🧾 <b>فاتورة مبيعات جديدة #${invoice.invoiceNumber || invoice.id}</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
👨‍💼 <b>الموظف المسؤول:</b> ${escapeHtml(invoice.employeeName || 'غير محدد')}
👤 <b>الزبون:</b> ${escapeHtml(invoice.customerName)}
${invoice.customerPhone ? `📞 <b>هاتف الزبون:</b> ${escapeHtml(invoice.customerPhone)}\n` : ''}📅 <b>التاريخ:</b> ${invoiceDate}
━━━━━━━━━━━━━━━━━━
📦 <b>تفاصيل المنتجات المباعة:</b>
${itemsText}
━━━━━━━━━━━━━━━━━━
💰 <b>الحساب المالي والأرباح:</b>
💵 <b>إجمالي الفاتورة النهائي:</b> <b>${formatCurrency(totalAmount, currency)}</b>
📉 <b>إجمالي التكلفة (رأس المال):</b> ${formatCurrency(totalCost, currency)}
📈 <b>صافي الربح لكامل الفاتورة:</b> 🟢 <b>${formatCurrency(totalProfit, currency)}</b> (${profitMargin}%)
━━━━━━━━━━━━━━━━━━
${paymentDetailsText}
${invoice.notes ? `\n📝 <b>ملاحظات:</b> ${escapeHtml(invoice.notes)}\n` : ''}
<i>نظام إدارة الفواتير والمبيعات الآلي</i>`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.description || 'فشل إرسال الإشعار إلى تيليجرام');
      }

      return { ok: true, data: result };
    } catch (err) {
      console.error('Error sending telegram message:', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * تنسيق وإرسال فاتورة مشتريات وتوريد بضاعة إلى تيليجرام
   */
  async sendPurchaseInvoiceNotification(invoice, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || 'شيكل';

    if (!botToken || !chatId) {
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام' };
    }

    const companyName = settings.companyName || 'رامز عطاطرة';
    const invoiceDate = formatDateTime(invoice.createdAt);

    let itemsText = '';
    (invoice.items || []).forEach((item, idx) => {
      const itemCost = item.costPrice || 0;
      const itemTotalCost = itemCost * (item.quantity || 1);
      itemsText += 
`▫️ <b>${idx + 1}. ${escapeHtml(item.productName)}</b>
   الكمية المشتراة: <b>${item.quantity}</b> | سعر الشراء (التكلفة): ${formatCurrency(itemCost, currency)}
   إجمالي الشراء للصنف: <b>${formatCurrency(itemTotalCost, currency)}</b>
`;
    });

    const totalCost = invoice.summary?.totalCost || invoice.summary?.totalAmount || 0;
    const totalQty = invoice.summary?.totalQuantity || 0;

    const message = 
`📥 <b>فاتورة مشتريات وتوريد بضاعة جديدة #${invoice.invoiceNumber || invoice.id}</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
👨‍💼 <b>الموظف المستلم:</b> ${escapeHtml(invoice.employeeName || 'غير محدد')}
🚚 <b>المورد / المصدر:</b> ${escapeHtml(invoice.customerName || 'مورد بضاعة')}
${invoice.customerPhone ? `📞 <b>هاتف المورد:</b> ${escapeHtml(invoice.customerPhone)}\n` : ''}📅 <b>التاريخ:</b> ${invoiceDate}
━━━━━━━━━━━━━━━━━━
📦 <b>الأصناف المشتراة المضافة للمخزون:</b>
${itemsText}
━━━━━━━━━━━━━━━━━━
💰 <b>إجمالي قيمة المشتريات:</b> <b>${formatCurrency(totalCost, currency)}</b>
🔢 <b>إجمالي عدد القطع الواردة للمخزن:</b> <b>${totalQty} قطعة</b>
${invoice.notes ? `\n📝 <b>ملاحظات التوريد:</b> ${escapeHtml(invoice.notes)}\n` : ''}
<i>تمت زيادة المخزون تلقائياً بالكميات المشتراة</i>`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      const result = await response.json();
      return { ok: result.ok, data: result };
    } catch (err) {
      console.error('Error sending purchase invoice notification:', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * إرسال رسالة نصية عامة إلى تيليجرام
   */
  async sendRawMessage(botToken, chatId, text, parseMode = 'Markdown') {
    if (!botToken || !chatId) return { ok: false, error: 'بيانات تيليجرام غير مكتملة' };
    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: text,
          parse_mode: parseMode
        })
      });
      const result = await response.json();
      return { ok: result.ok, data: result };
    } catch (err) {
      console.error('Error in sendRawMessage:', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * إرسال ملف مستند (PDF أو غيره) إلى محادثة تيليجرام عبر sendDocument
   */
  async sendDocument(botToken, chatId, fileBuffer, fileName = 'report.pdf', caption = '', parseMode = 'HTML') {
    if (!botToken || !chatId) {
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام (Bot Token أو Chat ID)' };
    }

    const cleanToken = botToken.trim();
    const cleanChatId = chatId.trim();
    const url = `https://api.telegram.org/bot${cleanToken}/sendDocument`;

    try {
      // تيليجرام يفرض حداً أقصى لشرح المستند (caption) قدره 1024 حرفاً
      let safeCaption = (caption || '').trim();
      if (safeCaption.length > 900) {
        safeCaption = safeCaption.substring(0, 850) + '...\n<i>📎 تم إرفاق التفاصيل الكاملة بالملف.</i>';
      }

      const form = new FormData();
      form.append('chat_id', cleanChatId);
      if (safeCaption) {
        form.append('caption', safeCaption);
        form.append('parse_mode', parseMode);
      }
      
      let blob;
      if (fileBuffer instanceof Blob) {
        blob = fileBuffer;
      } else {
        blob = new Blob([fileBuffer], { type: 'application/pdf' });
      }
      form.append('document', blob, fileName);

      let response = await fetch(url, {
        method: 'POST',
        body: form
      });

      let result = await response.json();

      // إذا رفض تيليجرام وسوم الـ HTML (parse error) أو طول الشرح، نعيد المحاولة فوراً بنص نظيف مجرد
      if (!result.ok && result.description && (result.description.toLowerCase().includes('parse') || result.description.toLowerCase().includes('caption'))) {
        const plainCaption = safeCaption.replace(/<[^>]*>/g, '').substring(0, 800);
        const retryForm = new FormData();
        retryForm.append('chat_id', cleanChatId);
        if (plainCaption) {
          retryForm.append('caption', plainCaption);
        }
        retryForm.append('document', blob, fileName);

        response = await fetch(url, { method: 'POST', body: retryForm });
        result = await response.json();
      }

      if (!result.ok) {
        console.error('Telegram sendDocument failed:', result.description);
        return { ok: false, error: result.description || 'فشل إرسال ملف الـ PDF لتيليجرام' };
      }

      return { ok: true, data: result };
    } catch (err) {
      console.error('Error in sendDocument:', err);
      return { ok: false, error: err.message };
    }
  },

  /**
   * إرسال إشعار سند قبض مالي جديد بتنسيق واضح ومفهوم
   */
  async sendReceiptNotification(receipt, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || 'شيكل';

    if (!botToken || !chatId) {
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام' };
    }

    const companyName = settings.companyName || 'رامز عطاطرة';
    const methodNames = {
      cash: '💵 نقداً (كاش)',
      transfer: '🏦 تحويل بنكي',
      check: '📝 شيك مصرفي'
    };
    const paymentMethodText = methodNames[receipt.paymentMethod] || '💵 نقداً (كاش)';
    const prevBal = parseFloat(receipt.previousBalance) || 0;
    const remBal = parseFloat(receipt.remainingBalance) || 0;

    let balanceSection = '';
    if (prevBal > 0 || remBal >= 0) {
      balanceSection = 
`━━━━━━━━━━━━━━━━━━
📊 <b>حركة الحساب والذمة المالية للزبون:</b>
🔹 <b>الدين السابق قبل السند:</b> ${formatCurrency(prevBal, currency)}
🔹 <b>المبلغ المسدد الآن:</b> -${formatCurrency(receipt.amount, currency)}
📉 <b>الرصيد المتبقي بذمته حالياً:</b> <b>${formatCurrency(remBal, currency)}</b>`;
    }

    const message = 
`💰 <b>سند قبض مالي معتمد جديد #${receipt.receiptNumber}</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
👤 <b>اسم الزبون:</b> <b>${escapeHtml(receipt.customerName)}</b>${receipt.customerSystemNumber ? ` [رقم الحساب: #${escapeHtml(receipt.customerSystemNumber)}]` : ''}
${receipt.customerPhone ? `📞 <b>هاتف الزبون:</b> ${escapeHtml(receipt.customerPhone)}\n` : ''}👨‍💼 <b>الموظف المستلم:</b> ${escapeHtml(receipt.employeeName || 'غير محدد')}
📅 <b>تاريخ ووقت السند:</b> ${formatDateTime(receipt.createdAt)}
━━━━━━━━━━━━━━━━━━
💵 <b>المبلغ المقبوض:</b> 🟢 <b>${formatCurrency(receipt.amount, currency)}</b>
💳 <b>طريقة الدفع:</b> ${paymentMethodText}
${receipt.description ? `📝 <b>البيان / مقابل:</b> ${escapeHtml(receipt.description)}\n` : ''}${balanceSection}
${receipt.notes ? `\n📌 <b>ملاحظات:</b> ${escapeHtml(receipt.notes)}\n` : ''}
<i>✅ تم خصم المبلغ من رصيد دين الزبون آلياً وتوثيق السند في السجلات.</i>`;

    return this.sendRawMessage(botToken, chatId, message, 'HTML');
  },

  /**
   * إرسال تذكير استحقاق دفعة لزبون متبقي عليه دين
   */
  async sendCustomerReminderNotification({ customer, debt, lastReceipt, daysSinceLastReceipt, settings }) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || 'شيكل';

    if (!botToken || !chatId) {
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام' };
    }

    const companyName = settings.companyName || 'رامز عطاطرة';
    let lastPaymentDesc = '⚠️ <i>لم يتم تسجيل أي سند قبض سابق لهذا الزبون في النظام</i>';

    if (lastReceipt) {
      const recDate = formatDateTime(lastReceipt.createdAt);
      lastPaymentDesc = `<b>منذ ${daysSinceLastReceipt} يوماً</b> (بتاريخ ${recDate} بمبلغ <b>${formatCurrency(lastReceipt.amount, currency)}</b>)`;
    }

    const message = 
`⏰ <b>تذكير استحقاق دفعة مالية لزبون</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
👤 <b>اسم الزبون:</b> <b>${escapeHtml(customer.name)}</b>
🔢 <b>رقم الحساب بالنظام:</b> #${escapeHtml(customer.systemNumber || '--')}
${customer.phone ? `📞 <b>هاتف الزبون:</b> <a href="tel:${escapeHtml(customer.phone)}">${escapeHtml(customer.phone)}</a>\n` : ''}━━━━━━━━━━━━━━━━━━
💰 <b>إجمالي الدين المتبقي بذمته:</b> 🔴 <b>${formatCurrency(debt, currency)}</b>
⏳ <b>تاريخ آخر دفعة تم سدادها:</b> ${lastPaymentDesc}
━━━━━━━━━━━━━━━━━━
⚠️ <b>حالة الحساب:</b> ${daysSinceLastReceipt > 30 ? '🔴 <b>تأخير شديد عن السداد</b>' : '🟠 <b>دفعة مستحقة المتابعة</b>'}
${customer.notes ? `📝 <b>ملاحظات مسجلة على الزبون:</b> ${escapeHtml(customer.notes)}\n` : ''}
<i>📞 يُرجى الاتصال بالزبون أو إرسال كشف الحساب لتحصيل الدفعة المستحقة.</i>`;

    return this.sendRawMessage(botToken, chatId, message, 'HTML');
  },

  /**
   * إرسال إشعار تحديث كميات الجرد والمخزون بتنسيق HTML واضح
   */
  async sendInventoryUpdateNotification(result, editorName, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    if (!botToken || !chatId) return { ok: false, error: 'إعدادات تيليجرام غير مضبوطة' };

    const companyName = settings.companyName || 'رامز عطاطرة';
    let detailsText = '';
    (result.modifiedDetails || []).slice(0, 30).forEach((item, idx) => {
      const diffSign = item.diff > 0 ? `+${item.diff}` : `${item.diff}`;
      detailsText += 
`▫️ <b>${idx + 1}. ${escapeHtml(item.name)}</b> ${item.code ? `[كود: <code>${escapeHtml(item.code)}</code>]` : ''}
   الكمية: كانت (<b>${item.oldStock}</b>) ⬅️ أصبحت (<b>${item.newStock}</b>) [الفرق: <b>${diffSign}</b>]
`;
    });

    if ((result.modifiedDetails || []).length > 30) {
      detailsText += `\n<i>... وباقي ${result.modifiedDetails.length - 30} صنفاً آخر تم تعديله موثق في ملف الـ PDF المرفق.</i>\n`;
    }

    const message = 
`📦 <b>محضر تحديث كميات الجرد والمخزون</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
👨‍💼 <b>القائم بعملية الجرد:</b> <b>${escapeHtml(editorName || 'غير محدد')}</b>
🔢 <b>عدد الأصناف المعدلة:</b> <b>${result.changedCount || 0} صنف</b>
🕐 <b>تاريخ ووقت الجرد:</b> ${formatDateTime(new Date())}
━━━━━━━━━━━━━━━━━━
📝 <b>قائمة الأصناف التي تم تعديل كمياتها:</b>
${detailsText}
━━━━━━━━━━━━━━━━━━
<i>📎 مرفق كشف الجرد الرسمي بصيغة PDF لتوثيق المحضر والاحتفاظ به.</i>`;

    return this.sendRawMessage(botToken, chatId, message, 'HTML');
  },

  /**
   * إرسال تقرير مالي رسمي للأرباح والمبيعات بتنسيق عالي الوضوح
   */
  async sendFinancialReportNotification(reportData, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || 'شيكل';
    if (!botToken || !chatId) return { ok: false, error: 'إعدادات تيليجرام غير مضبوطة' };

    const companyName = settings.companyName || 'رامز عطاطرة';
    const periodTitle = reportData.periodTitle || 'كامل الفترة';
    const totalSales = parseFloat(reportData.totalSales) || 0;
    const totalCost = parseFloat(reportData.totalCost) || 0;
    const totalProfit = parseFloat(reportData.totalProfit) || 0;
    const profitMargin = reportData.profitMargin || (totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0);
    const invoiceCount = reportData.invoiceCount || 0;

    const message = 
`📊 <b>التقرير المالي وحساب الأرباح الرسمي</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
⏱️ <b>فترة التقرير:</b> <b>${escapeHtml(periodTitle)}</b>
📅 <b>تاريخ الإصدار:</b> ${formatDateTime(new Date())}
🔢 <b>عدد الفواتير الصادرة:</b> <b>${invoiceCount} فاتورة</b>
━━━━━━━━━━━━━━━━━━
💰 <b>الملخص المالي العام:</b>
💵 <b>إجمالي المبيعات (الإيرادات):</b> <b>${formatCurrency(totalSales, currency)}</b>
📉 <b>إجمالي التكلفة (رأس المال):</b> ${formatCurrency(totalCost, currency)}
📈 <b>صافي الربح المحقق:</b> 🟢 <b>${formatCurrency(totalProfit, currency)}</b>
🎯 <b>نسبة هامش الربح:</b> <b>${profitMargin}%</b>
━━━━━━━━━━━━━━━━━━
${reportData.cashSales !== undefined ? `▫️ مبيعات الكاش المباشر: ${formatCurrency(reportData.cashSales, currency)}\n` : ''}${reportData.installmentSales !== undefined ? `▫️ مبيعات الأقساط المجدولة: ${formatCurrency(reportData.installmentSales, currency)}\n` : ''}<i>📎 تجدون أعلاه ملف الـ PDF المعتمد للتقرير المالي شاملاً كافة التفاصيل.</i>`;

    return this.sendRawMessage(botToken, chatId, message, 'HTML');
  },

  /**
   * إرسال تقرير حالة المخزون الشامل بتنسيق فائق الوضوح
   */
  async sendStockReportNotification(stockData, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || 'شيكل';
    if (!botToken || !chatId) return { ok: false, error: 'إعدادات تيليجرام غير مضبوطة' };

    const companyName = settings.companyName || 'رامز عطاطرة';
    const scope = stockData.scope || 'كامل المخزون';
    const totalItems = stockData.totalItems || 0;
    const totalUnits = stockData.totalUnits || 0;
    const totalCapital = parseFloat(stockData.totalCapital) || 0;
    const outOfStockCount = stockData.outOfStockCount || 0;
    const lowStockCount = stockData.lowStockCount || 0;

    const message = 
`📋 <b>تقرير جرد المخزون ورأس المال المستثمر</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
🏷️ <b>نطاق الجرد:</b> <b>${escapeHtml(scope)}</b>
📅 <b>تاريخ ووقت الجرد:</b> ${formatDateTime(new Date())}
━━━━━━━━━━━━━━━━━━
📊 <b>مؤشرات المخزون العامة:</b>
🔢 <b>إجمالي عدد الأصناف:</b> <b>${totalItems} صنف</b>
📦 <b>إجمالي القطع المتوفرة:</b> <b>${totalUnits.toLocaleString('en-US')} قطعة</b>
💰 <b>إجمالي رأس المال المستثمر:</b> <b>${formatCurrency(totalCapital, currency)}</b>
━━━━━━━━━━━━━━━━━━
⚠️ <b>حالة النواقص والكميات الحرجة:</b>
🔴 أصناف نفدت بالكامل (0): <b>${outOfStockCount} صنف</b>
🟠 أصناف كميتها منخفضة (≤3): <b>${lowStockCount} صنف</b>
━━━━━━━━━━━━━━━━━━
<i>📎 تجدون أعلاه ملف الـ PDF الكامل لجرد المخزون جاهزاً للطباعة والتدقيق.</i>`;

    return this.sendRawMessage(botToken, chatId, message, 'HTML');
  }
};

module.exports = telegramService;

