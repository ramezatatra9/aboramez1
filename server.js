const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const dataStore = require('./dataStore');
const telegramService = require('./telegramService');
const excelParser = require('./excelParser');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد مجلد الرفع
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// إعداد Multer لتخزين صور المنتجات
function formatServerDateTime(dateInput) {
  const d = new Date(dateInput || Date.now());
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'مسائاً' : 'صباحاً';
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} الساعة ${hours}:${minutes} ${period}`;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = 'prod-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      return cb(null, true);
    }
    cb(new Error('الملف المرفوع يجب أن يكون صورة'));
  }
});

// إعداد Multer لتخزين ملفات الـ PDF المؤقتة في الذاكرة للإرسال المباشر لتيليجرام
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// -------------------------------------------------------------
// APIs: المنتجات (Products)
// -------------------------------------------------------------

// جلب جميع المنتجات
app.get('/api/products', (req, res) => {
  try {
    const products = dataStore.getProducts();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إضافة أو تعديل منتج
app.post('/api/products', (req, res) => {
  try {
    const { id, code, name, category, costPrice, sellPrice, stock, image, description } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'اسم المنتج مطلوب' });
    }

    const saved = dataStore.saveProduct({
      id,
      code,
      name: name.trim(),
      category: category || 'عام',
      costPrice: parseFloat(costPrice) || 0,
      sellPrice: parseFloat(sellPrice) || 0,
      stock: parseInt(stock) || 0,
      image,
      description
    });

    res.json({ success: true, product: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// حذف منتج
app.delete('/api/products/:id', (req, res) => {
  try {
    const deleted = dataStore.deleteProduct(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// رفع صورة للمنتج
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'لم يتم اختيار أي صورة' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: الفواتير (Invoices)
// -------------------------------------------------------------

// جلب جميع الفواتير
app.get('/api/invoices', (req, res) => {
  try {
    const invoices = dataStore.getInvoices();
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// جلب تفاصيل فاتورة واحدة
app.get('/api/invoices/:id', (req, res) => {
  try {
    const invoice = dataStore.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'الفاتورة غير موجودة' });
    }
    res.json({ success: true, invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء فاتورة جديدة (مبيعات أو مشتريات)
app.post('/api/invoices', async (req, res) => {
  try {
    const {
      invoiceType, // 'sales' or 'purchase'
      employeeName,
      customerName,
      customerPhone,
      customerId,
      notes,
      items,
      paymentMethod,
      installmentDetails
    } = req.body;

    const isPurchase = invoiceType === 'purchase';

    if (!customerName || customerName.trim() === '') {
      return res.status(400).json({ success: false, error: isPurchase ? 'اسم المورد مطلوب' : 'اسم الزبون مطلوب' });
    }

    if (!employeeName || employeeName.trim() === '') {
      return res.status(400).json({ success: false, error: 'يرجى كتابة اسم الموظف' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'يجب اختيار منتج واحد على الأقل في الفاتورة' });
    }

    // حساب التفاصيل المالية بدقة
    let totalQuantity = 0;
    let totalCost = 0;
    let totalAmount = 0;

    const validatedItems = items.map(item => {
      const quantity = Math.max(1, parseInt(item.quantity) || 1);
      const costPrice = parseFloat(item.costPrice) || 0;
      const sellPrice = isPurchase ? costPrice : (parseFloat(item.sellPrice) || 0);
      const unitProfit = isPurchase ? 0 : (sellPrice - costPrice);
      const totalItemCost = costPrice * quantity;
      const totalItemSell = isPurchase ? totalItemCost : (sellPrice * quantity);
      const totalItemProfit = isPurchase ? 0 : (unitProfit * quantity);

      totalQuantity += quantity;
      totalCost += totalItemCost;
      totalAmount += totalItemSell;

      return {
        productId: item.productId || item.id,
        productName: item.productName || item.name,
        productImage: item.productImage || item.image || '',
        quantity,
        costPrice,
        sellPrice,
        unitProfit,
        totalCost: totalItemCost,
        totalSell: totalItemSell,
        totalProfit: totalItemProfit
      };
    });

    const totalProfit = isPurchase ? 0 : (totalAmount - totalCost);
    const profitMarginPercentage = (!isPurchase && totalAmount > 0) ? parseFloat(((totalProfit / totalAmount) * 100).toFixed(1)) : 0;

    // معالجة الأقساط (لفواتير المبيعات)
    let validatedInstallments = null;
    if (!isPurchase && paymentMethod === 'installments') {
      const downPayment = parseFloat(installmentDetails?.downPayment) || 0;
      const remainingAmount = Math.max(0, totalAmount - downPayment);
      validatedInstallments = {
        downPayment,
        remainingAmount,
        duration: installmentDetails?.duration || 'غير محدد',
        scheduleNotes: installmentDetails?.scheduleNotes || ''
      };
    }

    // حفظ الفاتورة
    const newInvoice = dataStore.createInvoice({
      invoiceType: isPurchase ? 'purchase' : 'sales',
      employeeName,
      customerName,
      customerPhone,
      customerId,
      notes,
      items: validatedItems,
      summary: {
        totalQuantity,
        totalCost,
        totalAmount,
        totalProfit,
        profitMarginPercentage
      },
      paymentMethod: (!isPurchase && paymentMethod === 'installments') ? 'installments' : 'cash',
      installmentDetails: validatedInstallments
    });

    // تحديث المخزون:
    // إذا كانت فاتورة مشتريات -> زيادة المخزون
    // إذا كانت فاتورة مبيعات -> خصم المخزون
    let updatedStockProducts = [];
    if (isPurchase) {
      updatedStockProducts = dataStore.addStockForPurchaseInvoice(validatedItems, employeeName);
    } else {
      updatedStockProducts = dataStore.deductStockForInvoice(validatedItems, employeeName);
    }

    // إرسال إشعار تيليجرام فوراً
    const settings = dataStore.getSettings();
    let telegramResult = { ok: false, error: 'غير مهيأ' };

    if (settings.telegramBotToken && settings.telegramChatId) {
      try {
        if (isPurchase) {
          telegramResult = await telegramService.sendPurchaseInvoiceNotification(newInvoice, settings);
        } else {
          telegramResult = await telegramService.sendInvoiceNotification(newInvoice, settings);
        }
        dataStore.updateInvoiceTelegramStatus(newInvoice.id, telegramResult.ok, telegramResult.error);
        newInvoice.telegramStatus = {
          sent: telegramResult.ok,
          sentAt: telegramResult.ok ? new Date().toISOString() : null,
          error: telegramResult.error || null
        };
      } catch (telErr) {
        console.error('Telegram notification error:', telErr);
        dataStore.updateInvoiceTelegramStatus(newInvoice.id, false, telErr.message);
        newInvoice.telegramStatus = { sent: false, sentAt: null, error: telErr.message };
      }
    } else {
      newInvoice.telegramStatus = {
        sent: false,
        sentAt: null,
        error: 'لم يتم ضبط إعدادات تيليجرام (Bot Token و Chat ID)'
      };
    }

    res.json({
      success: true,
      invoice: newInvoice,
      telegramNotification: telegramResult
    });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// إعادة إرسال الفاتورة لتيليجرام يدوياً إذا رغب المستخدم
app.post('/api/invoices/:id/resend-telegram', async (req, res) => {
  try {
    const invoice = dataStore.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'الفاتورة غير موجودة' });
    }

    const settings = dataStore.getSettings();
    const result = await telegramService.sendInvoiceNotification(invoice, settings);
    dataStore.updateInvoiceTelegramStatus(invoice.id, result.ok, result.error);

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: الإعدادات وتيليجرام (Settings & Telegram)
// -------------------------------------------------------------

// جلب الإعدادات
app.get('/api/settings', (req, res) => {
  try {
    const settings = dataStore.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// حفظ الإعدادات
app.post('/api/settings', (req, res) => {
  try {
    const updated = dataStore.saveSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// فحص الاتصال مع تيليجرام
app.post('/api/telegram/test', async (req, res) => {
  try {
    const { telegramBotToken, telegramChatId, companyName } = req.body;
    const result = await telegramService.testConnection(
      telegramBotToken,
      telegramChatId,
      companyName || 'نظام الفواتير'
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// إحصائيات لوحة التحكم مع دعم فلاتر المدة الزمنية وحساب رأس المال الكلي للمخزون
app.get('/api/dashboard', (req, res) => {
  try {
    const invoices = dataStore.getInvoices();
    const products = dataStore.getProducts();

    const period = (req.query.period || 'all').toLowerCase();
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // حساب رأس المال الكلي للمخزون الفعلي بالقطع والتكلفة والبيع
    let totalInventoryCapital = 0;
    let totalStockUnits = 0;
    let totalInventoryRetail = 0;

    products.forEach(p => {
      const stock = Math.max(0, parseInt(p.stock) || 0);
      const cost = Math.max(0, parseFloat(p.costPrice) || 0);
      const sell = Math.max(0, parseFloat(p.sellPrice) || 0);

      totalInventoryCapital += cost * stock;
      totalStockUnits += stock;
      totalInventoryRetail += sell * stock;
    });

    const expectedInventoryProfit = Math.max(0, totalInventoryRetail - totalInventoryCapital);

    // فلترة الفواتير بحسب المدة الزمنية المطلوبة
    let filteredInvoices = invoices;
    const now = new Date();

    if (period === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      filteredInvoices = invoices.filter(inv => {
        const t = new Date(inv.createdAt).getTime();
        return !isNaN(t) && t >= todayStart;
      });
    } else if (period === 'week') {
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
      filteredInvoices = invoices.filter(inv => {
        const t = new Date(inv.createdAt).getTime();
        return !isNaN(t) && t >= weekStart;
      });
    } else if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      filteredInvoices = invoices.filter(inv => {
        const t = new Date(inv.createdAt).getTime();
        return !isNaN(t) && t >= monthStart;
      });
    } else if (period === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
      filteredInvoices = invoices.filter(inv => {
        const t = new Date(inv.createdAt).getTime();
        return !isNaN(t) && t >= yearStart;
      });
    } else if (period === 'custom' && (startDate || endDate)) {
      const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : 0;
      const endMs = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Infinity;
      filteredInvoices = invoices.filter(inv => {
        const t = new Date(inv.createdAt).getTime();
        return !isNaN(t) && t >= startMs && t <= endMs;
      });
    }

    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let cashSales = 0;
    let installmentsTotal = 0;
    let installmentsRemaining = 0;
    let installmentsDownPayments = 0;

    filteredInvoices.forEach(inv => {
      const amount = inv.summary?.totalAmount || 0;
      const cost = inv.summary?.totalCost || 0;
      const profit = inv.summary?.totalProfit || 0;

      totalSales += amount;
      totalCost += cost;
      totalProfit += profit;

      if (inv.paymentMethod === 'installments') {
        installmentsTotal += amount;
        const down = inv.installmentDetails?.downPayment || 0;
        const rem = inv.installmentDetails?.remainingAmount || 0;
        installmentsDownPayments += down;
        installmentsRemaining += rem;
      } else {
        cashSales += amount;
      }
    });

    res.json({
      success: true,
      stats: {
        totalInvoicesCount: filteredInvoices.length,
        allInvoicesCount: invoices.length,
        totalProductsCount: products.length,
        totalSales,
        totalCost,
        totalProfit,
        profitMarginPercentage: totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0,
        cashSales,
        installmentsTotal,
        installmentsDownPayments,
        installmentsRemaining,
        // إحصائيات رأس مال المخزون الحالي
        totalInventoryCapital,
        totalStockUnits,
        totalInventoryRetail,
        expectedInventoryProfit,
        // معلومات الفلترة
        period,
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تحديث كميات الجرد دفعةً واحدة
app.post('/api/inventory/update', async (req, res) => {
  try {
    const { updates, editorName } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'لا توجد بيانات للتحديث' });
    }
    const result = dataStore.updateInventoryBulk(updates, editorName);

    // إشعار تيليجرام بإجراء الجرد مع تفاصيل التعديلات التي حصلت بتنسيق HTML واضح
    const settings = dataStore.getSettings();
    if (settings.telegramBotToken && settings.telegramChatId && result.changedCount > 0) {
      try {
        const telegramService = require('./telegramService');
        await telegramService.sendInventoryUpdateNotification(result, editorName, settings);
      } catch (e) {
        console.error('Telegram inventory notification error:', e.message);
      }
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال تقرير نتائج الجرد إلى تيليجرام
app.post('/api/inventory/send-report-telegram', async (req, res) => {
  try {
    const { title, searchQuery, category, brand, summary, items } = req.body;
    const settings = dataStore.getSettings();

    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام بعد' });
    }

    const cur = settings.currency || 'شيكل';
    const reportTitle = title || 'تقرير جرد المخزون';

    let filterDesc = 'كامل المخزون';
    if (searchQuery) filterDesc = `نتائج البحث عن: "${searchQuery}"`;
    else if (category && category !== 'all') filterDesc = `قسم: ${category}`;
    else if (brand && brand !== 'all') filterDesc = `ماركة: ${brand}`;

    let itemsText = '';
    (items || []).slice(0, 30).forEach((item, idx) => {
      const stock = parseInt(item.stock) || 0;
      const cost = parseFloat(item.costPrice) || 0;
      const totalCost = stock * cost;
      const zeroTag = stock === 0 ? ' [⚠️ نافد]' : '';

      itemsText += `▫️ *${idx + 1}. ${item.name}* ${item.code ? `(#${item.code})` : ''}${zeroTag}\n` +
        `   الكمية: *${stock}* | التكلفة: ${cost.toLocaleString('en-US')} ${cur} (إجمالي: *${totalCost.toLocaleString('en-US')}*)\n`;
    });

    if ((items || []).length > 30) {
      itemsText += `\n... وباقي ${items.length - 30} صنفاً آخر ضمن نتائج التقرير.`;
    }

    const msg =
      `📊 *${reportTitle} - ${settings.companyName || 'رامز عطاطرة'}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔍 نطاق التقرير: *${filterDesc}*\n` +
      `📦 عدد الأصناف: *${summary?.count || (items || []).length} صنف*\n` +
      `🔢 إجمالي القطع: *${(summary?.totalUnits || 0).toLocaleString('en-US')} قطعة*\n` +
      `💰 إجمالي رأس المال: *${(summary?.totalCapital || 0).toLocaleString('en-US')} ${cur}*\n` +
      `⚠️ أصناف نافدة (0): *${summary?.zeroCount || 0} صنف*\n` +
      `🕐 وقت التقرير: ${formatServerDateTime(new Date())}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *جدول الأصناف والتكلفة:*\n` +
      itemsText;

    const telegramService = require('./telegramService');
    const result = await telegramService.sendRawMessage(settings.telegramBotToken, settings.telegramChatId, msg);

    if (result.ok) {
      res.json({ success: true, message: 'تم إرسال التقرير لتيليجرام بنجاح' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'تعذر إرسال التقرير لتيليجرام' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال ملف PDF الفعلي لتقرير الجرد إلى تيليجرام
app.post('/api/inventory/send-pdf-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();

    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام بعد' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'لم يتم استلام ملف الـ PDF' });
    }

    const { scope, totalUnits, totalCapital, zeroCount, itemCount, title } = req.body;
    const cur = settings.currency || 'شيكل';
    const reportTitle = title || 'تقرير جرد المخزون ورأس المال';

    const caption = 
`📄 <b>${reportTitle} (ملف PDF رسمي مرفق)</b>
🏢 <b>${settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
🔍 <b>نطاق الجرد:</b> ${scope || 'نتائج البحث الحالية'}
📦 <b>عدد الأصناف:</b> <b>${itemCount || 0} صنف</b>
🔢 <b>إجمالي القطع:</b> <b>${Number(totalUnits || 0).toLocaleString('en-US')} قطعة</b>
💰 <b>إجمالي رأس المال:</b> <b>${Number(totalCapital || 0).toLocaleString('en-US')} ${cur}</b>
⚠️ <b>أصناف نافدة (0):</b> <b>${zeroCount || 0} صنف</b>
🕐 <b>وقت إصدار التقرير:</b> ${formatServerDateTime(new Date())}
━━━━━━━━━━━━━━━━━━
<i>📎 تجدون أعلاه ملف الـ PDF الكامل لجرد المخزون، جاهز للمعاينة والتحميل والطباعة.</i>`;

    const fileName = req.file.originalname || `تقرير_جرد_${Date.now()}.pdf`;
    const result = await telegramService.sendDocument(
      settings.telegramBotToken,
      settings.telegramChatId,
      req.file.buffer,
      fileName,
      caption,
      'HTML'
    );

    if (result.ok) {
      res.json({ success: true, message: 'تم إرسال ملف الـ PDF إلى تيليجرام بنجاح' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'تعذر إرسال ملف الـ PDF لتيليجرام' });
    }
  } catch (err) {
    console.error('Error sending PDF to telegram:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال أي ملف PDF رسمي (فاتورة، سند قبض، محضر جرد، تقرير مالي، تقرير مخزون) مباشرة لتيليجرام
app.post('/api/telegram/send-pdf-document', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();

    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام (Bot Token أو Chat ID) بعد' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'لم يتم استلام ملف الـ PDF' });
    }

    const { fileName, caption } = req.body;
    const resolvedFileName = fileName || req.file.originalname || `document_${Date.now()}.pdf`;

    const result = await telegramService.sendDocument(
      settings.telegramBotToken,
      settings.telegramChatId,
      req.file.buffer,
      resolvedFileName,
      caption || '📎 ملف PDF رسمي مرفق من النظام',
      'HTML'
    );

    if (result.ok) {
      res.json({ success: true, message: 'تم إرسال ملف الـ PDF الرسمي إلى تيليجرام بنجاح' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'تعذر إرسال الملف لتيليجرام' });
    }
  } catch (err) {
    console.error('Error sending document to telegram:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: سندات القبض (Receipts)
// -------------------------------------------------------------

// جلب جميع السندات
app.get('/api/receipts', (req, res) => {
  try {
    const receipts = dataStore.getReceipts();
    res.json({ success: true, receipts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء سند قبض جديد
app.post('/api/receipts', async (req, res) => {
  try {
    const {
      employeeName,
      customerName,
      customerPhone,
      customerId,
      customerSystemNumber,
      previousBalance,
      remainingBalance,
      amount,
      description,
      notes,
      paymentMethod
    } = req.body;

    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الموظف مطلوب' });
    }
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الزبون مطلوب' });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'المبلغ يجب أن يكون أكبر من صفر' });
    }

    const receipt = dataStore.createReceipt({
      employeeName,
      customerName,
      customerPhone,
      customerId,
      customerSystemNumber,
      previousBalance,
      remainingBalance,
      amount,
      description,
      notes,
      paymentMethod
    });

    // إشعار تيليجرام للسند بتنسيق واضح
    const settings = dataStore.getSettings();
    if (settings.telegramBotToken && settings.telegramChatId) {
      try {
        await telegramService.sendReceiptNotification(receipt, settings);
      } catch (e) {
        console.error('Telegram receipt notification error:', e.message);
      }
    }

    res.json({ success: true, receipt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: دليل ديون وأرصدة الزبائن (Customers & Debts)
// -------------------------------------------------------------

// جلب جميع الزبائن والأرصدة
app.get('/api/customers', (req, res) => {
  try {
    const customers = dataStore.getCustomers();
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إضافة أو تعديل زبون
app.post('/api/customers', (req, res) => {
  try {
    const { id, systemNumber, name, phone, balance, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الزبون مطلوب' });
    }
    const saved = dataStore.saveCustomer({ id, systemNumber, name, phone, balance, notes });
    res.json({ success: true, customer: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استيراد جماعي من CSV
app.post('/api/customers/bulk', (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ success: false, error: 'قائمة الزبائن فارغة' });
    }
    const result = dataStore.importCustomersBulk(customers);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// استيراد ملف Excel أو CSV للزبائن
app.post('/api/customers/upload-excel', pdfUpload.single('file'), (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'لم يتم استلام أي ملف' });
    }

    const parsed = excelParser.parseCustomerExcel(req.file.buffer);
    if (!parsed || !parsed.customers || parsed.customers.length === 0) {
      return res.status(400).json({ success: false, error: 'لم يتم العثور على أي زبائن صالحين داخل الملف' });
    }

    if (req.query.preview === 'true' || req.body.preview === 'true') {
      return res.json({
        success: true,
        isPreview: true,
        parsedCount: parsed.count,
        summary: parsed.summary,
        sample: parsed.customers.slice(0, 10),
        message: `تم تحليل الملف بنجاح! تم العثور على ${parsed.count} زبون.`
      });
    }

    const result = dataStore.importCustomersBulk(parsed.customers);

    res.json({
      success: true,
      imported: result.imported,
      updated: result.updated,
      total: result.total,
      parsedCount: parsed.count,
      summary: parsed.summary,
      message: `تم بنجاح استيراد وتحديث ${parsed.count} زبون مع أرصدتهم بالنظام!`
    });
  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(400).json({ success: false, error: 'خطأ في معالجة ملف الإكسل: ' + err.message });
  }
});

// تحميل نموذج Excel فارغ استرشادي لتعبئة الزبائن
app.get('/api/customers/download-template', (req, res) => {
  try {
    const buffer = excelParser.generateCustomerTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const safeName = encodeURIComponent('نموذج_استيراد_الزبائن.xlsx');
    res.setHeader('Content-Disposition', `attachment; filename="customers_template.xlsx"; filename*=UTF-8''${safeName}`);
    res.send(buffer);
  } catch (err) {
    console.error('Template download error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// جلب كشف حساب زبون تفصيلي
app.get('/api/customers/:id/statement', (req, res) => {
  try {
    const statement = dataStore.getCustomerStatement(req.params.id);
    if (!statement) {
      return res.status(404).json({ success: false, error: 'الزبون غير موجود' });
    }
    res.json({ success: true, statement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال كشف حساب الزبون الرسمي مع ملف PDF لتيليجرام
app.post('/api/customers/:id/send-statement-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام بعد' });
    }

    const statement = dataStore.getCustomerStatement(req.params.id);
    if (!statement) {
      return res.status(404).json({ success: false, error: 'الزبون غير موجود' });
    }

    // 1. إرسال الرسالة النصية
    await telegramService.sendCustomerStatementNotification(statement.customer, statement.summary, settings);

    // 2. إرفاق ملف PDF
    if (req.file && req.file.buffer) {
      const fileName = req.file.originalname || `كشف_حساب_${statement.customer.name.replace(/\s+/g, '_')}.pdf`;
      const cur = settings.currency || 'شيكل';
      const bal = parseFloat(statement.customer.balance) || 0;
      const balText = bal > 0 ? `دين عليه: ${bal.toLocaleString('en-US')} ${cur}` : (bal < 0 ? `رصيد له: ${Math.abs(bal).toLocaleString('en-US')} ${cur}` : `رصيد خالص`);

      const caption = 
`📄 <b>كشف حساب تفصيلي معتمد (ملف PDF رسمي)</b>
🏢 <b>${settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
👤 <b>الزبون:</b> ${statement.customer.name} (حساب #${statement.customer.systemNumber || '--'})
💰 <b>الرصيد:</b> <b>${balText}</b>
📅 <b>التاريخ:</b> ${formatServerDateTime(new Date())}
<i>📎 مرفق أعلاه ملف كشف الحساب الرسمي المعتمد جاهز للطباعة والتدقيق.</i>`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({ success: true, message: `تم إرسال كشف حساب "${statement.customer.name}" مع ملف الـ PDF لتيليجرام بنجاح!` });
  } catch (err) {
    console.error('Send statement error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال كشف شامل لديون وأرصدة كافة الزبائن مع ملف PDF لتيليجرام
app.post('/api/customers/send-debts-report-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام بعد' });
    }

    const { totalDebit, totalCredit, netBalance, countDebtors, countCreditors, countSettled, totalCount } = req.body;

    const reportData = {
      totalDebit: parseFloat(totalDebit) || 0,
      totalCredit: parseFloat(totalCredit) || 0,
      netBalance: parseFloat(netBalance) || 0,
      countDebtors: parseInt(countDebtors) || 0,
      countCreditors: parseInt(countCreditors) || 0,
      countSettled: parseInt(countSettled) || 0,
      totalCount: parseInt(totalCount) || 0
    };

    // 1. إرسال الرسالة النصية
    await telegramService.sendCustomerDebtsReportNotification(reportData, settings);

    // 2. إرفاق ملف PDF
    if (req.file && req.file.buffer) {
      const cur = settings.currency || 'شيكل';
      const fileName = req.file.originalname || `كشف_ديون_الزبائن_${Date.now()}.pdf`;
      const caption = 
`📄 <b>تقرير ديون وأرصدة الزبائن (ملف PDF رسمي كامل)</b>
🏢 <b>${settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
👥 <b>عدد الزبائن:</b> <b>${reportData.totalCount} زبون</b>
🔴 <b>الديون التي عليهم:</b> <b>${reportData.totalDebit.toLocaleString('en-US')} ${cur}</b>
🔵 <b>الديون التي لهم:</b> <b>${reportData.totalCredit.toLocaleString('en-US')} ${cur}</b>
📅 <b>الوقت:</b> ${formatServerDateTime(new Date())}
<i>📎 مرفق أعلاه الجدول الكامل لكافة الزبائن وأرصدتهم.</i>`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({ success: true, message: 'تم إرسال كشف ديون الزبائن وملف الـ PDF إلى تيليجرام بنجاح!' });
  } catch (err) {
    console.error('Send debts report error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال التقرير المالي والأرباح كملف PDF لتيليجرام
app.post('/api/financial-report/send-pdf-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام بعد' });
    }

    const { periodTitle, totalSales, totalCost, totalProfit, profitMargin, invoiceCount } = req.body;

    const reportData = {
      periodTitle: periodTitle || 'كامل الفترة',
      totalSales: parseFloat(totalSales) || 0,
      totalCost: parseFloat(totalCost) || 0,
      totalProfit: parseFloat(totalProfit) || 0,
      profitMargin: profitMargin || '0',
      invoiceCount: parseInt(invoiceCount) || 0
    };

    // 1. إرسال الرسالة النصية التلخيصية
    await telegramService.sendFinancialReportNotification(reportData, settings);

    // 2. إرفاق ملف PDF
    if (req.file && req.file.buffer) {
      const fileName = req.file.originalname || `تقرير_مالي_${Date.now()}.pdf`;
      const cur = settings.currency || 'شيكل';
      const caption = 
`📄 <b>التقرير المالي والأرباح التنفيذي (ملف PDF رسمي)</b>
🏢 <b>${settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
⏱️ <b>الفترة:</b> <b>${reportData.periodTitle}</b>
💵 <b>إجمالي المبيعات:</b> <b>${reportData.totalSales.toLocaleString('en-US')} ${cur}</b>
📈 <b>صافي الربح:</b> 🟢 <b>+${reportData.totalProfit.toLocaleString('en-US')} ${cur}</b> (${reportData.profitMargin}%)
📅 <b>تاريخ الإصدار:</b> ${formatServerDateTime(new Date())}
<i>📎 مرفق التقرير المالي الرسمي الشامل بصيغة PDF.</i>`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({ success: true, message: 'تم إرسال التقرير المالي وملف الـ PDF إلى تيليجرام بنجاح!' });
  } catch (err) {
    console.error('Financial report send error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال سند قبض مع ملف PDF لتيليجرام
app.post('/api/receipts/:id/send-pdf-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام بعد' });
    }

    const receipts = dataStore.getReceipts();
    const receipt = receipts.find(r => r.id === req.params.id || String(r.receiptNumber) === String(req.params.id));
    if (!receipt) {
      return res.status(404).json({ success: false, error: 'سند القبض غير موجود' });
    }

    // 1. إرسال الرسالة النصية للسند
    await telegramService.sendReceiptNotification(receipt, settings);

    // 2. إرفاق ملف PDF
    if (req.file && req.file.buffer) {
      const cur = settings.currency || 'شيكل';
      const fileName = req.file.originalname || `سند_قبض_${receipt.receiptNumber}.pdf`;
      const caption = 
`📄 <b>سند قبض مالي معتمد #${receipt.receiptNumber} (ملف PDF رسمي)</b>
🏢 <b>${settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
👤 <b>الزبون:</b> ${receipt.customerName}
💰 <b>المبلغ المقبوض:</b> 🟢 <b>${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</b>
📅 <b>التاريخ:</b> ${formatServerDateTime(receipt.createdAt)}
<i>📎 مرفق أعلاه ملف سند القبض الرسمي المعتمد بصيغة PDF.</i>`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({ success: true, message: `تم إرسال سند القبض #${receipt.receiptNumber} وملف الـ PDF لتيليجرام بنجاح!` });
  } catch (err) {
    console.error('Receipt send error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// حذف زبون
app.delete('/api/customers/:id', (req, res) => {
  try {
    const deleted = dataStore.deleteCustomer(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال تذكير استحقاق دفعة مالية لزبون عبر تيليجرام مع مرفق PDF اختياري
app.post('/api/customers/:id/send-reminder-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام (Bot Token أو Chat ID) بعد' });
    }

    const customers = dataStore.getCustomers();
    const strId = String(req.params.id || '').trim();
    const customer = customers.find(c => String(c.id).trim() === strId || String(c.systemNumber || '').trim() === strId);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'الزبون غير موجود في النظام' });
    }

    const debt = parseFloat(customer.balance) || 0;
    if (debt <= 0) {
      return res.status(400).json({ success: false, error: 'الزبون ليس عليه أي ديون مستحقة (رصيده مسدد بالكامل)' });
    }

    // جلب آخر سند قبض مسجل للزبون
    const receipts = dataStore.getReceipts();
    const custReceipts = receipts.filter(r => 
      (customer.id && r.customerId === customer.id) ||
      (customer.systemNumber && String(r.customerSystemNumber) === String(customer.systemNumber)) ||
      (r.customerName && r.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
    );

    custReceipts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastReceipt = custReceipts[0] || null;

    let daysSinceLastReceipt = 0;
    if (lastReceipt) {
      daysSinceLastReceipt = Math.floor((Date.now() - new Date(lastReceipt.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    } else {
      daysSinceLastReceipt = Math.floor((Date.now() - new Date(customer.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
    }

    // 1. إرسال الرسالة النصية التوضيحية
    const textResult = await telegramService.sendCustomerReminderNotification({
      customer,
      debt,
      lastReceipt,
      daysSinceLastReceipt,
      settings
    });

    // 2. إذا تم إرسال ملف PDF لكشف الحساب، يتم إرفاقه
    if (req.file && req.file.buffer) {
      const fileName = req.file.originalname || `كشف_حساب_${customer.name.replace(/\s+/g, '_')}.pdf`;
      const cur = settings.currency || 'شيكل';
      const caption = 
`📄 <b>كشف حساب وإشعار استحقاق دفعة (ملف PDF رسمي)</b>
👤 <b>الزبون:</b> ${customer.name} (حساب #${customer.systemNumber || '--'})
💰 <b>الدين المستحق:</b> ${debt.toLocaleString('en-US')} ${cur}
⏳ <b>آخر دفعة:</b> ${lastReceipt ? `منذ ${daysSinceLastReceipt} يوماً` : 'لا يوجد سداد سابق'}`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({
      success: true,
      message: `تم إرسال تذكير استحقاق الدفعة للزبون "${customer.name}" عبر تيليجرام بنجاح!`
    });
  } catch (err) {
    console.error('Error sending customer reminder:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// حذف سند قبض
app.delete('/api/receipts/:id', (req, res) => {
  try {
    const deleted = dataStore.deleteReceipt(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: إعادة تعيين بيانات المبيعات والإحصائيات
// -------------------------------------------------------------

// إعادة تعيين جميع الفواتير وسندات القبض (مع الاحتفاظ بالمنتجات والإعدادات)
app.post('/api/reset-sales', (req, res) => {
  try {
    const { confirmPhrase } = req.body;

    // كلمة تأكيد إضافية للحماية
    if (confirmPhrase !== 'تأكيد الحذف') {
      return res.status(400).json({ success: false, error: 'عبارة التأكيد غير صحيحة' });
    }

    const INVOICES_FILE = path.join(__dirname, 'data', 'invoices.json');
    const RECEIPTS_FILE = path.join(__dirname, 'data', 'receipts.json');

    // مسح جميع الفواتير
    fs.writeFileSync(INVOICES_FILE, JSON.stringify([], null, 2), 'utf-8');
    // مسح جميع سندات القبض
    fs.writeFileSync(RECEIPTS_FILE, JSON.stringify([], null, 2), 'utf-8');

    // مسح من Supabase أيضاً في السحابة
    const { supabase } = require('./supabaseClient');
    if (supabase) {
      supabase.from('invoices').delete().neq('id', '___non_existent___').then(() => {});
      supabase.from('receipts').delete().neq('id', '___non_existent___').then(() => {});
    }

    console.log(`⚠️ تم إعادة تعيين جميع بيانات المبيعات والإحصائيات في: ${formatServerDateTime(new Date())}`);

    res.json({ success: true, message: 'تم إعادة تعيين جميع بيانات المبيعات وسندات القبض بنجاح. المنتجات والإعدادات محفوظة.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تشغيل الخادم
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`=======================================================`);
  console.log(`🚀 نظام المبيعات وإصدار الفواتير يعمل بنجاح على:`);
  console.log(`🔗 الرابط المحلي: http://localhost:${PORT}`);
  console.log(`=======================================================`);
  // فحص ومزامنة البيانات السحابية مع Supabase
  await dataStore.initFromSupabase();
});
