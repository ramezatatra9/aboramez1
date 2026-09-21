const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const dataStore = require('./dataStore');
const telegramService = require('./telegramService');

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

// إنشاء فاتورة جديدة
app.post('/api/invoices', async (req, res) => {
  try {
    const {
      employeeName,
      customerName,
      customerPhone,
      notes,
      items,
      paymentMethod,
      installmentDetails
    } = req.body;

    if (!customerName || customerName.trim() === '') {
      return res.status(400).json({ success: false, error: 'اسم الزبون مطلوب' });
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
      const sellPrice = parseFloat(item.sellPrice) || 0;
      const unitProfit = sellPrice - costPrice;
      const totalItemCost = costPrice * quantity;
      const totalItemSell = sellPrice * quantity;
      const totalItemProfit = unitProfit * quantity;

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

    const totalProfit = totalAmount - totalCost;
    const profitMarginPercentage = totalAmount > 0 ? parseFloat(((totalProfit / totalAmount) * 100).toFixed(1)) : 0;

    // معالجة الأقساط
    let validatedInstallments = null;
    if (paymentMethod === 'installments') {
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
      employeeName,
      customerName,
      customerPhone,
      notes,
      items: validatedItems,
      summary: {
        totalQuantity,
        totalCost,
        totalAmount,
        totalProfit,
        profitMarginPercentage
      },
      paymentMethod: paymentMethod === 'installments' ? 'installments' : 'cash',
      installmentDetails: validatedInstallments
    });

    // إرسال إشعار تيليجرام فوراً
    const settings = dataStore.getSettings();
    let telegramResult = { ok: false, error: 'غير مهيأ' };

    if (settings.telegramBotToken && settings.telegramChatId) {
      try {
        telegramResult = await telegramService.sendInvoiceNotification(newInvoice, settings);
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

// إحصائيات لوحة التحكم
app.get('/api/dashboard', (req, res) => {
  try {
    const invoices = dataStore.getInvoices();
    const products = dataStore.getProducts();

    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let cashSales = 0;
    let installmentsTotal = 0;
    let installmentsRemaining = 0;
    let installmentsDownPayments = 0;

    invoices.forEach(inv => {
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
        totalInvoicesCount: invoices.length,
        totalProductsCount: products.length,
        totalSales,
        totalCost,
        totalProfit,
        profitMarginPercentage: totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0,
        cashSales,
        installmentsTotal,
        installmentsDownPayments,
        installmentsRemaining
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

    // إشعار تيليجرام باجراء الجرد
    const settings = dataStore.getSettings();
    if (settings.telegramBotToken && settings.telegramChatId && result.changedCount > 0) {
      const msg =
        `📦 *تحديث جرد المخزون - ${settings.companyName || 'رامز عطاطرة'}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👨‍💼 القائم بالجرد: *${editorName || 'غير محدد'}*\n` +
        `🔢 عدد الأصناف المعدلة: *${result.changedCount} صنف*\n` +
        `🕐 الوقت: ${formatServerDateTime(new Date())}`;
      try {
        const telegramService = require('./telegramService');
        await telegramService.sendRawMessage(settings.telegramBotToken, settings.telegramChatId, msg);
      } catch (e) { /* ignore */ }
    }

    res.json({ success: true, ...result });
  } catch (err) {
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
    const { employeeName, customerName, customerPhone, amount, description, notes, paymentMethod } = req.body;

    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الموظف مطلوب' });
    }
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الزبون مطلوب' });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'المبلغ يجب أن يكون أكبر من صفر' });
    }

    const receipt = dataStore.createReceipt({ employeeName, customerName, customerPhone, amount, description, notes, paymentMethod });

    // إشعار تيليجرام للسند
    const settings = dataStore.getSettings();
    if (settings.telegramBotToken && settings.telegramChatId) {
      const cur = settings.currency || 'شيكل';
      const method = { cash: '💵 نقداً', transfer: '🏦 تحويل بنكي', check: '📝 شيك' }[receipt.paymentMethod] || '💵 نقداً';
      const msg =
        `💰 *سند قبض جديد - ${settings.companyName || 'رامز عطاطرة'}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📄 رقم السند: *#${receipt.receiptNumber.toLocaleString('en-US')}*\n` +
        `👤 الزبون: *${receipt.customerName}*${receipt.customerPhone ? ` (${receipt.customerPhone})` : ''}\n` +
        `💲 المبلغ: *${receipt.amount.toLocaleString('en-US')} ${cur}*\n` +
        `💳 طريقة الدفع: ${method}\n` +
        `${receipt.description ? `📝 البيان: ${receipt.description}\n` : ''}` +
        `👨‍💼 الموظف: ${receipt.employeeName}\n` +
        `🕐 التاريخ: ${formatServerDateTime(receipt.createdAt)}`;

      try {
        const telegramService = require('./telegramService');
        await telegramService.sendRawMessage(settings.telegramBotToken, settings.telegramChatId, msg);
      } catch (e) { /* تجاهل خطأ تيليجرام */ }
    }

    res.json({ success: true, receipt });
  } catch (err) {
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
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 نظام المبيعات وإصدار الفواتير يعمل بنجاح على:`);
  console.log(`🔗 الرابط المحلي: http://localhost:${PORT}`);
  console.log(`=======================================================`);
  // فحص ومزامنة البيانات السحابية مع Supabase
  await dataStore.initFromSupabase();
});
