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
      const form = new FormData();
      form.append('chat_id', cleanChatId);
      if (caption) {
        form.append('caption', caption);
        form.append('parse_mode', parseMode);
      }
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      form.append('document', blob, fileName);

      const response = await fetch(url, {
        method: 'POST',
        body: form
      });

      const result = await response.json();
      if (!result.ok) {
        console.error('Telegram sendDocument failed:', result.description);
        return { ok: false, error: result.description || 'فشل إرسال ملف الـ PDF لتيليجرام' };
      }

      return { ok: true, data: result };
    } catch (err) {
      console.error('Error in sendDocument:', err);
      return { ok: false, error: err.message };
    }
  }
};

module.exports = telegramService;

