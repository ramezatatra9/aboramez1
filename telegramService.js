// وحدة الربط مع تيليجرام (Telegram Bot Service)
let dataStore = null;
try {
  dataStore = require('./dataStore');
} catch (e) {
  console.warn('dataStore load in telegramService:', e.message);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatCurrency(amount, currency = '₪') {
  const num = parseFloat(amount) || 0;
  const sym = (!currency || currency === 'شيكل' || currency === 'ILS') ? '₪' : currency;
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${sym}`;
}

function formatDateTime(dateInput) {
  const d = new Date(dateInput || Date.now());
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'مساءً' : 'صباحاً';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} — ${hours}:${minutes} ${period}`;
}

function getNumberEmoji(num) {
  const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  if (num >= 1 && num <= 10) return emojis[num];
  return `${num}️⃣`;
}

function formatPhoneDisplay(phone) {
  if (!phone) return '';
  return `${escapeHtml(phone)}`;
}

const telegramService = {
  /**
   * إرسال رسالة HTML مع آلية أمان ذكية (Fallback) للإرسال كنص مجرد عند أي خطأ في الوسوم
   */
  async sendHtmlWithFallback(botToken, chatId, htmlMessage) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    try {
      let response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlMessage,
          parse_mode: 'HTML'
        })
      });

      let result = await response.json();

      // إذا رفض تيليجرام وسوم HTML بسبب Parse error، إعادة المحاولة فوراً بنص نظيف مجرد
      if (!result.ok && result.description && result.description.toLowerCase().includes('parse')) {
        console.warn('Telegram HTML parse failed, retrying with stripped text:', result.description);
        const plainText = htmlMessage.replace(/<[^>]*>/g, '');
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: plainText
          })
        });
        result = await response.json();
      }

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

    return this.sendHtmlWithFallback(cleanToken, cleanChatId, message);
  },

  /**
   * تنسيق وإرسال تفاصيل الفاتورة الكاملة (مبيعات) إلى تيليجرام بتصميم احترافي وشامل
   */
  /**
   * تنسيق وإرسال تفاصيل الفاتورة الكاملة (مبيعات) إلى تيليجرام
   */
  async sendInvoiceNotification(invoice, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || '₪';

    if (!botToken || !chatId) {
      console.warn('Telegram token or chat ID not set. Skipping notification.');
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام (Bot Token أو Chat ID)' };
    }

    const companyName = settings.companyName || 'شركة أبو رامز';
    const invoiceDate = formatDateTime(invoice.createdAt);
    const invoiceNum = invoice.invoiceNumber || invoice.id;
    const isInstallments = invoice.paymentMethod === 'installments';

    // بناء قائمة المنتجات المباعة
    let itemsText = '';
    const items = invoice.items || [];
    const totalItemsCount = items.length;
    const maxDisplayItems = 20;
    const itemsToDisplay = items.slice(0, maxDisplayItems);

    itemsToDisplay.forEach((item, idx) => {
      const qty = item.quantity || 1;
      const sellPrice = item.sellPrice || 0;
      const costPrice = item.costPrice || 0;
      const itemTotalSell = sellPrice * qty;
      const itemUnitProfit = sellPrice - costPrice;
      const itemTotalProfit = itemUnitProfit * qty;

      itemsText += 
`${getNumberEmoji(idx + 1)} ${escapeHtml(item.productName)}
الكمية: ${qty} × ${formatCurrency(sellPrice, currency)} = ${formatCurrency(itemTotalSell, currency)}
التكلفة: ${formatCurrency(costPrice, currency)}
الربح: 🟢 ${formatCurrency(itemTotalProfit, currency)}

`;
    });

    if (totalItemsCount > maxDisplayItems) {
      itemsText += `<i>... وباقي ${totalItemsCount - maxDisplayItems} أصناف أخرى مسجلة بالفاتورة</i>\n\n`;
    }

    // تفاصيل طريقة السداد والأقساط
    const totalProfit = invoice.summary?.totalProfit || 0;
    const totalAmount = invoice.summary?.totalAmount || 0;
    const totalCost = invoice.summary?.totalCost || 0;
    const profitMargin = invoice.summary?.profitMarginPercentage || (totalAmount > 0 ? ((totalProfit / totalAmount) * 100).toFixed(1) : 0);

    let paymentStatusText = '';
    let summaryText = '';

    if (isInstallments) {
      const inst = invoice.installmentDetails || {};
      const downPayment = parseFloat(inst.downPayment) || 0;
      const remainingAmount = (inst.remainingAmount !== undefined) ? parseFloat(inst.remainingAmount) : Math.max(0, totalAmount - downPayment);
      const duration = inst.duration || 'غير محدد';

      paymentStatusText = 
`💵 المدفوع: ${formatCurrency(downPayment, currency)}
🔴 المتبقي: ${formatCurrency(remainingAmount, currency)}
📅 مدة التقسيط: ${escapeHtml(duration)}`;

      if (downPayment === 0) {
        summaryText = `إجمالي الفاتورة ${formatCurrency(totalAmount, currency)}، لم يتم دفع أي مبلغ حتى الآن، والمتبقي ${formatCurrency(remainingAmount, currency)}.\nصافي ربح الفاتورة ${formatCurrency(totalProfit, currency)}.`;
      } else {
        summaryText = `إجمالي الفاتورة ${formatCurrency(totalAmount, currency)}، تم دفع ${formatCurrency(downPayment, currency)} كدفعة أولى، والمتبقي ${formatCurrency(remainingAmount, currency)}.\nصافي ربح الفاتورة ${formatCurrency(totalProfit, currency)}.`;
      }
    } else {
      paymentStatusText = 
`💵 المدفوع: ${formatCurrency(totalAmount, currency)}
🟢 المتبقي: 0 ₪`;

      summaryText = `إجمالي الفاتورة ${formatCurrency(totalAmount, currency)}، تم استلام كامل المبلغ نقداً.\nصافي ربح الفاتورة ${formatCurrency(totalProfit, currency)}.`;
    }

    const message = 
`🧾 <b>فاتورة مبيعات #${invoiceNum}</b>

🏢 <b>${escapeHtml(companyName)}</b>
📅 ${invoiceDate}
👨‍💼 الموظف: ${escapeHtml(invoice.employeeName || 'غير محدد')}
👤 الزبون: ${escapeHtml(invoice.customerName)}
💳 طريقة الدفع: ${isInstallments ? 'أقساط' : 'نقداً'}

━━━━━━━━━━━━━━

📦 <b>المنتجات</b>

${itemsText.trim()}

━━━━━━━━━━━━━━

💰 <b>ملخص الفاتورة</b>

💵 إجمالي المبيعات: ${formatCurrency(totalAmount, currency)}
📦 إجمالي التكلفة: ${formatCurrency(totalCost, currency)}
📈 صافي الربح: ${formatCurrency(totalProfit, currency)}
📊 هامش الربح: ${profitMargin}%

━━━━━━━━━━━━━━

💳 <b>حالة السداد</b>

${paymentStatusText}

━━━━━━━━━━━━━━

📌
${summaryText}

⚡ نظام رامز عطاطرة لإدارة المبيعات والفواتير`;

    return this.sendHtmlWithFallback(botToken, chatId, message);
  },

  /**
   * تنسيق وإرسال فاتورة مشتريات وتوريد بضاعة إلى تيليجرام
   */
  async sendPurchaseInvoiceNotification(invoice, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || '₪';

    if (!botToken || !chatId) {
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام (Bot Token أو Chat ID)' };
    }

    const companyName = settings.companyName || 'شركة أبو رامز';
    const invoiceDate = formatDateTime(invoice.createdAt);
    const invoiceNum = invoice.invoiceNumber || invoice.id;

    // بناء قائمة الأصناف المشتراة
    let itemsText = '';
    const items = invoice.items || [];
    const totalItemsCount = items.length;
    const maxDisplayItems = 20;
    const itemsToDisplay = items.slice(0, maxDisplayItems);

    itemsToDisplay.forEach((item, idx) => {
      const qty = item.quantity || 1;
      const itemCost = item.costPrice || 0;
      const itemTotalCost = itemCost * qty;

      let product = null;
      if (dataStore && (item.productId || item.id)) {
        try {
          product = dataStore.getProductById(item.productId || item.id);
        } catch (e) {}
      }

      const currentStock = product ? product.stock : null;

      itemsText += 
`${getNumberEmoji(idx + 1)} ${escapeHtml(item.productName)}
الكمية: ${qty} قطع
سعر التكلفة: ${formatCurrency(itemCost, currency)} للقطعة
إجمالي الصنف: ${formatCurrency(itemTotalCost, currency)}
${currentStock !== null ? `📦 المخزون الحالي: ${currentStock} قطع\n` : ''}\n`;
    });

    if (totalItemsCount > maxDisplayItems) {
      itemsText += `<i>... وباقي ${totalItemsCount - maxDisplayItems} أصناف مشتراة أخرى</i>\n\n`;
    }

    const totalCost = invoice.summary?.totalCost || invoice.summary?.totalAmount || 0;
    const totalQty = invoice.summary?.totalQuantity || items.reduce((acc, it) => acc + (it.quantity || 1), 0);
    const phoneRow = invoice.customerPhone ? `\n📞 ${escapeHtml(invoice.customerPhone)}` : '';
    const notesRow = invoice.notes ? `\n━━━━━━━━━━━━━━\n\n📝 <b>ملاحظات</b>\n${escapeHtml(invoice.notes)}\n` : '';

    const message = 
`📥 <b>فاتورة مشتريات #${invoiceNum}</b>

🏢 <b>${escapeHtml(companyName)}</b>
📅 ${invoiceDate}
👨‍💼 الموظف المستلم: ${escapeHtml(invoice.employeeName || 'غير محدد')}
🚚 المورد: ${escapeHtml(invoice.customerName || 'مورد بضاعة')}${phoneRow}

━━━━━━━━━━━━━━

📦 <b>الأصناف الجديدة</b>

${itemsText.trim()}

━━━━━━━━━━━━━━

💰 <b>ملخص المشتريات</b>

💵 إجمالي قيمة المشتريات: ${formatCurrency(totalCost, currency)}
📦 إجمالي الكمية المضافة: ${totalQty} قطع
📋 عدد الأصناف: ${totalItemsCount}
${notesRow}
━━━━━━━━━━━━━━

✅ تم استلام البضاعة وإضافتها إلى المخزون بنجاح.

💰 <b>إجمالي قيمة التوريد:</b> ${formatCurrency(totalCost, currency)}
📦 <b>تمت إضافة ${totalQty} قطع إلى المخزون.</b>

⚡ نظام رامز عطاطرة لإدارة المشتريات والمخزون`;

    return this.sendHtmlWithFallback(botToken, chatId, message);
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

    const bufferSize = fileBuffer instanceof Blob ? fileBuffer.size : (fileBuffer?.length || 0);
    console.log(`[Telegram Bot] Sending document "${fileName}" (${bufferSize} bytes) to chat ${cleanChatId}`);

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
  /**
   * إرسال إشعار سند قبض مالي جديد بتنسيق معتمد
   */
  async sendReceiptNotification(receipt, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || '₪';

    if (!botToken || !chatId) {
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام' };
    }

    const companyName = settings.companyName || 'شركة أبو رامز';
    const receiptDate = formatDateTime(receipt.createdAt);
    const receiptNum = receipt.receiptNumber || receipt.id;
    const remBal = parseFloat(receipt.remainingBalance) || 0;

    const message = 
`💰 <b>سند قبض #${receiptNum}</b>

🏢 <b>${escapeHtml(companyName)}</b>

👤 <b>الزبون:</b> ${escapeHtml(receipt.customerName)}
💵 <b>المبلغ المقبوض:</b> 🟢 <b>${formatCurrency(receipt.amount, currency)}</b>

⏳المبلغ المتبقي : <b>${formatCurrency(remBal, currency)}</b>
📅 <b>تاريخ القبض:</b> ${receiptDate}

━━━━━━━━━━━━━━

✅ تم تسجيل عملية القبض بنجاح.

📎 مرفق سند القبض الرسمي بصيغة PDF.

⚡ نظام رامز عطاطرة للإدارة المالية`;

    return this.sendHtmlWithFallback(botToken, chatId, message);
  },

  /**
   * إرسال تذكير استحقاق دفعة لزبون متبقي عليه دين
   */
  async sendCustomerReminderNotification({ customer, debt, lastReceipt, daysSinceLastReceipt, settings }) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || '₪';

    if (!botToken || !chatId) {
      return { ok: false, error: 'لم يتم ضبط إعدادات تيليجرام' };
    }

    const companyName = settings.companyName || 'شركة أبو رامز';
    const debtAmount = parseFloat(debt) || 0;

    let lastPaymentDesc = 'لم يتم تسجيل أي دفعة سابقة في النظام.';
    if (lastReceipt) {
      const recDate = formatDateTime(lastReceipt.createdAt);
      lastPaymentDesc = `بتاريخ ${recDate} بمبلغ ${formatCurrency(lastReceipt.amount, currency)} (منذ ${daysSinceLastReceipt} يوماً).`;
    }

    const noteDesc = customer.notes
      ? escapeHtml(customer.notes)
      : `يوجد دين مسجل على الزبون بقيمة ${formatCurrency(debtAmount, currency)}.`;

    const statusDesc = (daysSinceLastReceipt > 30 || !lastReceipt)
      ? 'مبلغ مستحق — يحتاج متابعة للتحصيل'
      : 'دفعة مستحقة المتابعة';

    const message = 
`⏰ <b>تنبيه: حساب عميل يحتاج متابعة</b>

🏢 <b>${escapeHtml(companyName)}</b>

👤 <b>الزبون:</b> ${escapeHtml(customer.name)}
🔢 <b>رقم الحساب:</b> #${escapeHtml(customer.systemNumber || '--')}

━━━━━━━━━━━━━━

🔴 <b>المبلغ المستحق:</b> <b>${formatCurrency(debtAmount, currency)}</b>

📅 <b>آخر دفعة:</b>
${lastPaymentDesc}

⚠️ <b>حالة الحساب:</b>
${statusDesc}

📝 <b>ملاحظة:</b>
${noteDesc}

━━━━━━━━━━━━━━

📞 <b>الإجراء المطلوب:</b>
يرجى التواصل مع الزبون لمتابعة تحصيل المبلغ، أو إرسال كشف حسابه لمعرفة تفاصيل المديونية.

⚡ نظام رامز عطاطرة لإدارة حسابات العملاء والتحصيل`;

    return this.sendHtmlWithFallback(botToken, chatId, message);
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
    const currency = settings?.currency || '₪';
    if (!botToken || !chatId) return { ok: false, error: 'إعدادات تيليجرام غير مضبوطة' };

    const companyName = settings.companyName || 'شركة أبو رامز';
    let periodTitle = reportData.periodTitle || 'أكتوبر 2026';
    periodTitle = periodTitle.replace(/^شهر\s*/, '').replace(/\s*\(.*\)$/, '').trim();

    const reportDate = formatDateTime(new Date());
    const totalSales = parseFloat(reportData.totalSales) || 0;
    const totalCost = parseFloat(reportData.totalCost) || 0;
    const totalProfit = parseFloat(reportData.totalProfit) || 0;
    const profitMargin = reportData.profitMargin || (totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0);
    const invoiceCount = reportData.invoiceCount || 0;
    const cashSales = reportData.cashSales !== undefined ? parseFloat(reportData.cashSales) : 0;
    const installmentSales = reportData.installmentSales !== undefined ? parseFloat(reportData.installmentSales) : 0;

    const message = 
`📊 <b>التقرير المالي — ${escapeHtml(periodTitle)}</b>

🏢 <b>${escapeHtml(companyName)}</b>
📅 صادر بتاريخ: ${reportDate}
🧾 عدد الفواتير: ${invoiceCount} فاتورة

━━━━━━━━━━━━━━

💰 <b>النتيجة المالية</b>

💵 إجمالي المبيعات: ${formatCurrency(totalSales, currency)}
📦 تكلفة البضاعة: ${formatCurrency(totalCost, currency)}
━━━━━━━━━━━━━━
🟢 صافي الربح: ${formatCurrency(totalProfit, currency)}
📊 هامش الربح: ${profitMargin}%

━━━━━━━━━━━━━━

💳 <b>حسب طريقة الدفع</b>

💵 مبيعات نقدية: ${formatCurrency(cashSales, currency)}
⏳ مبيعات بالأقساط: ${formatCurrency(installmentSales, currency)}

━━━━━━━━━━━━━━

📌 <b>الخلاصة</b>

تم تحقيق مبيعات بقيمة ${formatCurrency(totalSales, currency)} خلال الفترة،
وبعد خصم تكلفة البضاعة البالغة ${formatCurrency(totalCost, currency)}، بلغ صافي الربح ${formatCurrency(totalProfit, currency)}.

📎 مرفق التقرير المالي الكامل بصيغة PDF.

⚡ نظام رامز عطاطرة للإدارة المالية والأرباح`;

    return this.sendHtmlWithFallback(botToken, chatId, message);
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
  },

  /**
   * إرسال التقرير الشامل لديون وأرصدة الزبائن إلى تيليجرام
   */
  async sendCustomerDebtsReportNotification(data, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || 'شيكل';
    if (!botToken || !chatId) return { ok: false, error: 'إعدادات تيليجرام غير مضبوطة' };

    const companyName = settings.companyName || 'رامز عطاطرة';
    const totalDebit = parseFloat(data.totalDebit) || 0;
    const totalCredit = parseFloat(data.totalCredit) || 0;
    const netBalance = parseFloat(data.netBalance) || (totalDebit - totalCredit);
    const countDebtors = data.countDebtors || 0;
    const countCreditors = data.countCreditors || 0;
    const countSettled = data.countSettled || 0;
    const totalCount = data.totalCount || 0;

    let netBadge = '';
    if (netBalance > 0) {
      netBadge = `🟢 <b>صافي مطلوب لصالح المعرض:</b> <b>+${formatCurrency(netBalance, currency)}</b>`;
    } else if (netBalance < 0) {
      netBadge = `🔵 <b>صافي التزام على المعرض لصالح الزبائن:</b> <b>${formatCurrency(Math.abs(netBalance), currency)}</b>`;
    } else {
      netBadge = `⚖️ <b>الرصيد الصافي متوازن:</b> <b>0 ${currency}</b>`;
    }

    const message = 
`👥 <b>التقرير الشامل لأرصدة وديون الزبائن</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
📅 <b>تاريخ ووقت التقرير:</b> ${formatDateTime(new Date())}
👥 <b>إجمالي عدد الزبائن:</b> <b>${totalCount} زبون</b>
━━━━━━━━━━━━━━━━━━
💰 <b>الملخص المالي العام للأرصدة:</b>
🔴 <b>إجمالي الديون التي عليهم (مدين / مطلوب منهم):</b> <b>${formatCurrency(totalDebit, currency)}</b> (${countDebtors} زبون)
🔵 <b>إجمالي الديون التي لهم (دائن / رصيد لصالحه):</b> <b>${formatCurrency(totalCredit, currency)}</b> (${countCreditors} زبون)
🟢 <b>زبائن حسابهم مسدد بالكامل (خالص):</b> <b>${countSettled} زبون</b>
━━━━━━━━━━━━━━━━━━
${netBadge}
━━━━━━━━━━━━━━━━━━
<i>📎 مرفق أعلاه ملف الـ PDF الرسمي الكامل لجدول ديون وأرصدة كافة الزبائن.</i>`;

    return this.sendRawMessage(botToken, chatId, message, 'HTML');
  },

  /**
   * إرسال كشف حساب تفصيلي لزبون إلى تيليجرام
   */
  async sendCustomerStatementNotification(customer, statementData, settings) {
    const botToken = settings?.telegramBotToken?.trim();
    const chatId = settings?.telegramChatId?.trim();
    const currency = settings?.currency || 'شيكل';
    if (!botToken || !chatId) return { ok: false, error: 'إعدادات تيليجرام غير مضبوطة' };

    const companyName = settings.companyName || 'رامز عطاطرة';
    const balance = parseFloat(customer.balance) || 0;
    let balDesc = '';
    if (balance > 0) {
      balDesc = `🔴 <b>دين مستحق بذمته (عليه):</b> <b>${formatCurrency(balance, currency)}</b>`;
    } else if (balance < 0) {
      balDesc = `🔵 <b>رصيد دائن لصالحه (له):</b> <b>${formatCurrency(Math.abs(balance), currency)}</b>`;
    } else {
      balDesc = `🟢 <b>الحساب مسدد بالكامل (خالص):</b> <b>0 ${currency}</b>`;
    }

    const message = 
`📑 <b>كشف حساب تفصيلي معتمد لزبون</b>
🏢 <b>${escapeHtml(companyName)}</b>
━━━━━━━━━━━━━━━━━━
👤 <b>اسم الزبون:</b> <b>${escapeHtml(customer.name)}</b>
🔢 <b>رقم الحساب بالنظام:</b> #${escapeHtml(customer.systemNumber || '--')}
${customer.phone ? `📞 <b>رقم الهاتف:</b> ${escapeHtml(customer.phone)}\n` : ''}📅 <b>تاريخ إصدار الكشف:</b> ${formatDateTime(new Date())}
━━━━━━━━━━━━━━━━━━
💰 <b>الرصيد المالي الحالي:</b>
${balDesc}
━━━━━━━━━━━━━━━━━━
📊 <b>ملخص العمليات المسجلة:</b>
🧾 عدد الفواتير: <b>${statementData.invoicesCount || 0} فاتورة</b>
💰 عدد سندات القبض: <b>${statementData.receiptsCount || 0} سند</b>
💵 إجمالي المسددات بسندات القبض: <b>${formatCurrency(statementData.totalPaid || 0, currency)}</b>
━━━━━━━━━━━━━━━━━━
<i>📎 مرفق كشف الحساب الرسمي المعتمد بصيغة PDF يحتوي على جميع الحركات والتواريخ بالتفصيل.</i>`;

    return this.sendRawMessage(botToken, chatId, message, 'HTML');
  },

  /**
   * إرسال مستند أو ملف (PDF أو JSON للنسخ الاحتياطي) إلى تيليجرام
   */
  async sendDocument(botToken, chatId, fileBuffer, fileName, caption = '', parseMode = 'HTML') {
    if (!botToken || !chatId || !fileBuffer) {
      return { ok: false, error: 'بيانات إرسال المستند غير مكتملة' };
    }

    try {
      const cleanToken = botToken.trim();
      const cleanChatId = chatId.trim();
      const url = `https://api.telegram.org/bot${cleanToken}/sendDocument`;

      const formData = new FormData();
      formData.append('chat_id', cleanChatId);
      const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
      formData.append('document', blob, fileName);

      if (caption) {
        formData.append('caption', caption);
        if (parseMode) formData.append('parse_mode', parseMode);
      }

      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.description || 'فشل إرسال الملف إلى تيليجرام');
      }

      return { ok: true, data: result };
    } catch (err) {
      console.error('Error sending telegram document:', err);
      return { ok: false, error: err.message };
    }
  }
};

module.exports = telegramService;


