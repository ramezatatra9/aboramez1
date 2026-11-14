const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'telegramService.js');
let code = fs.readFileSync(filePath, 'utf8');

const targetFunction = `  /**
   * إشعار فوري لطلب شراء إلكتروني جديد قادم من متجر الزبائن العام
   */
  async sendStoreOrderNotification(order, settings) {
    const botToken = settings?.telegramBotToken;
    const chatId = settings?.telegramChatId;
    if (!botToken || !chatId) {
      return { ok: false, error: 'إعدادات تيليجرام غير مكتملة' };
    }

    const companyName = settings?.companyName || 'شركة رامز عطاطرة';
    const currency = settings?.currency || 'شيكل';
    const dateFormatted = formatDateTime(order.createdAt);
    
    const cust = order.customer || {};
    const custName = escapeHtml(cust.name || 'زبون المتجر');
    const custPhone = escapeHtml(cust.phone || 'غير مسجل');
    const custAddress = escapeHtml(cust.address || 'غير محدد');
    const custNotes = cust.notes ? escapeHtml(cust.notes) : null;

    const itemsLines = (order.items || []).map((it, idx) => {
      const numEmoji = getNumberEmoji(idx + 1);
      const name = escapeHtml(it.name);
      const code = it.code ? ' [' + escapeHtml(it.code) + ']' : '';
      const brand = it.brand ? ' (' + escapeHtml(it.brand) + ')' : '';
      const qty = it.qty || 1;
      const price = it.price ? it.price.toLocaleString('en-US') : '0';
      const total = it.total ? it.total.toLocaleString('en-US') : '0';
      return numEmoji + ' <b>' + name + '</b>' + code + brand + '\\n   الكمية: (<b>' + qty + '</b>) × ' + price + ' = <b>' + total + ' ' + currency + '</b>';
    });

    const totalStr = (order.totalAmount || 0).toLocaleString('en-US');

    const cleanPhone = (cust.phone || '').replace(/[^\\d+]/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '970' + cleanPhone.slice(1) : cleanPhone;
    const phoneContactLine = cleanPhone 
      ? '• <b>رقم الهاتف:</b> <code>' + custPhone + '</code> (<a href="tel:' + cleanPhone + '">اتصال</a> | <a href="https://wa.me/' + waPhone + '">واتساب</a>)'
      : '• <b>رقم الهاتف:</b> <code>' + custPhone + '</code>';

    const lines = [
      '🛍️ <b>طلب شراء جديد من متجر الزبائن الإلكتروني!</b>',
      '🏢 <b>' + escapeHtml(companyName) + '</b>',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '🔢 <b>رقم الطلب:</b> <code>#' + escapeHtml(order.id) + '</code>',
      '🕒 <b>تاريخ الطلب:</b> ' + dateFormatted,
      '',
      '👤 <b>بيانات المشتري والتوصيل:</b>',
      '• <b>الاسم الكريم:</b> <b>' + custName + '</b>',
      phoneContactLine,
      '• <b>عنوان التوصيل:</b> <b>' + custAddress + '</b>',
      custNotes ? '• 📝 <b>ملاحظات الزبون:</b> <i>' + custNotes + '</i>' : null,
      '',
      '📦 <b>الأصناف المطلوبة (' + (order.items || []).length + ' صنف):</b>',
      itemsLines.join('\\n\\n'),
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '💰 <b>المجموع الإجمالي للطلب:</b> <b>' + totalStr + ' ' + currency + '</b>',
      '🚚 <b>طريقة الدفع:</b> الدفع عند الاستلام مع المعاينة والفحص',
      '⏳ <b>حالة الطلب في النظام:</b> <b>قيد المراجعة والاعتماد</b>',
      '━━━━━━━━━━━━━━━━━━━━━━━━━',
      '<i>ℹ️ يمكنك اعتماد هذا الطلب وخصم كمياته من المخزون تلقائياً من لوحة التحكم: /admin</i>'
    ].filter(l => l !== null);

    const htmlMessage = lines.join('\\n');
    return this.sendHtmlWithFallback(botToken, chatId, htmlMessage);
  },
`;

if (!code.includes('sendStoreOrderNotification')) {
  const lastExportsIdx = code.lastIndexOf('module.exports = telegramService;');
  if (lastExportsIdx !== -1) {
    const lastBraceIdx = code.lastIndexOf('};', lastExportsIdx);
    if (lastBraceIdx !== -1) {
      code = code.slice(0, lastBraceIdx) + '\n' + targetFunction + '\n' + code.slice(lastBraceIdx);
      console.log('✅ Injected sendStoreOrderNotification into telegramService');
    }
  }
} else {
  console.log('ℹ️ telegramService already contains sendStoreOrderNotification');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('✅ telegramService.js saved');
