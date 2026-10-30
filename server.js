const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const dataStore = require('./dataStore');
const telegramService = require('./telegramService');
const excelParser = require('./excelParser');
const { supabase } = require('./supabaseClient');
const systemMode = require('./systemMode');
const {
  generateInvoiceFingerprint,
  generateReceiptFingerprint,
  checkIdempotency,
  resolveIdempotency,
  releaseIdempotency
} = require('./idempotency');

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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB لأجهزة الأندرويد والكاميرات عالية الدقة
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|svg|bmp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype.startsWith('image/');
    if (ext || mime) {
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
app.use(compression({ threshold: 1024 }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '2h', etag: true }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d', etag: true }));

// ─── فحص جاهزية Supabase قبل كل عملية كتابة (Read-Only Degraded Mode) ───
app.use(systemMode.requireWritePermission);

// ─── endpoints للصحة والجاهزية ───
const { getSafeKeyMetadata } = require('./supabaseClient');

app.get('/api/health', (req, res) => {
  const meta = typeof getSafeKeyMetadata === 'function' ? getSafeKeyMetadata() : {};
  res.json({
    status: 'ok',
    ...systemMode.getStatus(),
    meta: {
      uptimeSeconds: Math.floor(process.uptime()),
      ...meta
    }
  });
});

app.get('/api/ready', (req, res) => {
  const s = systemMode.getStatus();
  res.status(s.isWriteReady ? 200 : 503).json(s);
});

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
app.post('/api/products', async (req, res) => {
  try {
    const { id, code, barcode, name, brand, brandAr, mainCategory, category, costPrice, sellPrice, stock, image, images, description } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'اسم المنتج مطلوب' });
    }

    const saved = await dataStore.saveProduct({
      id,
      code,
      barcode: barcode ? String(barcode).trim() : undefined,
      name: name.trim(),
      brand: (brand && brand.trim()) || 'أخرى',
      brandAr: (brandAr && brandAr.trim()) || (brand && brand.trim()) || 'أخرى / عام',
      mainCategory: mainCategory || 'أجهزة كهربائية كبيرة',
      category: category || 'عام',
      costPrice: parseFloat(costPrice) || 0,
      sellPrice: parseFloat(sellPrice) || 0,
      stock: parseInt(stock) || 0,
      image,
      images,
      description
    });

    res.json({ success: true, product: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تعيين باركود لصنف مع فحص ومنع التكرار
app.post('/api/products/:id/barcode', async (req, res) => {
  try {
    const { id } = req.params;
    const { barcode } = req.body;
    const cleanBarcode = (barcode || '').trim();

    if (!cleanBarcode) {
      return res.status(400).json({ success: false, error: 'رمز الباركود مطلوب' });
    }

    const products = dataStore.getProducts();
    // فحص هل الباركود مستخدم لصنف آخر؟
    const duplicate = products.find(p => 
      p.barcode && 
      p.barcode.trim().toLowerCase() === cleanBarcode.toLowerCase() && 
      p.id !== id
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'duplicate',
        message: 'تم تعريف هذا الباركود مسبقاً لصنف آخر',
        existingProduct: {
          id: duplicate.id,
          code: duplicate.code || 'بدون كود',
          name: duplicate.name || 'بدون اسم',
          brand: duplicate.brand || 'عام',
          category: duplicate.category || 'عام',
          barcode: duplicate.barcode
        }
      });
    }

    // الصنف المستهدف
    const target = products.find(p => p.id === id);
    if (!target) {
      return res.status(404).json({ success: false, error: 'الصنف المستهدف غير موجود' });
    }

    // تحديث الباركود
    target.barcode = cleanBarcode;
    target.updatedAt = new Date().toISOString();

    const saved = await dataStore.saveProduct(target);
    res.json({ 
      success: true, 
      product: saved,
      message: `تم ربط الباركود (${cleanBarcode}) بالصنف بنجاح`
    });
  } catch (err) {
    console.error('Barcode assignment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// البحث عن منتج بواسطة الباركود
app.get('/api/barcodes/lookup', (req, res) => {
  try {
    const rawBarcode = req.query.barcode || req.query.code || '';
    const cleanBarcode = String(rawBarcode).trim();

    if (!cleanBarcode) {
      return res.status(400).json({ success: false, error: 'رمز الباركود مطلوب' });
    }

    const products = dataStore.getProducts();
    const matched = products.find(p => 
      p.barcode && String(p.barcode).trim().toLowerCase() === cleanBarcode.toLowerCase()
    );

    if (matched) {
      return res.json({
        success: true,
        registered: true,
        product: {
          id: matched.id,
          code: matched.code || 'بدون كود',
          name: matched.name || 'بدون اسم',
          brand: matched.brand || 'عام',
          brandAr: matched.brandAr || 'عام',
          category: matched.category || 'عام',
          costPrice: matched.costPrice || 0,
          sellPrice: matched.sellPrice || 0,
          stock: matched.stock !== undefined ? matched.stock : 0,
          image: matched.image || '',
          barcode: String(matched.barcode).trim()
        }
      });
    }

    res.json({
      success: true,
      registered: false,
      barcode: cleanBarcode,
      message: 'الباركود غير مسجل مسبقاً'
    });
  } catch (err) {
    console.error('Barcode lookup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// البحث السريع في المنتجات بالاسم أو رقم الصنف لربط الباركود
app.get('/api/products/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const products = dataStore.getProducts();

    if (!q) {
      return res.json({ success: true, count: 0, products: [] });
    }

    const matches = products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const code = (p.code || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(q) || code.includes(q) || brand.includes(q) || barcode.includes(q);
    }).slice(0, limit);

    res.json({
      success: true,
      count: matches.length,
      products: matches.map(p => ({
        id: p.id,
        code: p.code || 'PRD',
        name: p.name,
        brand: p.brand || 'عام',
        category: p.category || 'عام',
        sellPrice: p.sellPrice || 0,
        stock: p.stock !== undefined ? p.stock : 0,
        image: p.image || '',
        barcode: p.barcode ? String(p.barcode).trim() : ''
      }))
    });
  } catch (err) {
    console.error('Product search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// جلب باركودات منتج محدد
app.get('/api/products/:id/barcodes', (req, res) => {
  try {
    const { id } = req.params;
    const products = dataStore.getProducts();
    const product = products.find(p => p.id === id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }

    const barcodes = product.barcode ? [String(product.barcode).trim()] : [];
    res.json({
      success: true,
      productId: product.id,
      productName: product.name,
      barcodes
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إعادة تعيين أو نقل باركود من صنف إلى صنف آخر بصلاحية إدارية صريحة
app.post('/api/barcodes/reassign', async (req, res) => {
  try {
    const { barcode, targetProductId, note } = req.body;
    const cleanBarcode = String(barcode || '').trim();

    if (!cleanBarcode || !targetProductId) {
      return res.status(400).json({ success: false, error: 'الباركود ومعرف الصنف المستهدف مطلوبان' });
    }

    const products = dataStore.getProducts();
    const targetProduct = products.find(p => p.id === targetProductId);
    if (!targetProduct) {
      return res.status(404).json({ success: false, error: 'الصنف المستهدف غير موجود' });
    }

    // البحث عن الصنف المرتبط حالياً بهذا الباركود إن وجد
    const currentOwner = products.find(p => 
      p.barcode && String(p.barcode).trim().toLowerCase() === cleanBarcode.toLowerCase()
    );

    let previousOwnerInfo = null;
    if (currentOwner && currentOwner.id !== targetProductId) {
      previousOwnerInfo = {
        id: currentOwner.id,
        name: currentOwner.name,
        code: currentOwner.code
      };
      currentOwner.barcode = '';
      currentOwner.updatedAt = new Date().toISOString();
      await dataStore.saveProduct(currentOwner);
    }

    // ربط الباركود بالصنف المستهدف
    targetProduct.barcode = cleanBarcode;
    targetProduct.updatedAt = new Date().toISOString();
    const saved = await dataStore.saveProduct(targetProduct);

    console.log(`[Barcode Reassign] Barcode '${cleanBarcode}' reassigned to '${targetProduct.name}' (${targetProduct.id}) from '${previousOwnerInfo ? previousOwnerInfo.name : 'none'}'`);

    res.json({
      success: true,
      message: `تم نقل الباركود (${cleanBarcode}) إلى الصنف "${targetProduct.name}" بنجاح`,
      product: saved,
      previousOwner: previousOwnerInfo
    });
  } catch (err) {
    console.error('Barcode reassign error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// إزالة باركود من صنف
app.delete('/api/products/:id/barcode', async (req, res) => {
  try {
    const { id } = req.params;
    const products = dataStore.getProducts();
    const target = products.find(p => p.id === id);

    if (!target) {
      return res.status(404).json({ success: false, error: 'الصنف غير موجود' });
    }

    const oldBarcode = target.barcode;
    target.barcode = '';
    target.updatedAt = new Date().toISOString();
    const saved = await dataStore.saveProduct(target);

    res.json({
      success: true,
      message: `تم حذف الباركود (${oldBarcode}) من الصنف بنجاح`,
      product: saved
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// حذف منتج
app.delete('/api/products/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteProduct(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// رفع صورة للمنتج (مع دعم التخزين السحابي الدائم في Supabase والأندرويد)
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'لم يتم اختيار أي صورة' });
    }
    const localUrl = `/uploads/${req.file.filename}`;
    let finalUrl = localUrl;

    // رفع دائم إلى Supabase Storage حتى لا تضيع الصور عند نوم أو إعادة نشر خادم Render
    if (supabase) {
      try {
        const fileContent = fs.readFileSync(req.file.path);
        const remoteName = `prod-${Date.now()}-${Math.round(Math.random() * 1e5)}${path.extname(req.file.originalname).toLowerCase() || '.jpg'}`;
        const { data: upData, error: upError } = await supabase.storage
          .from('product-images')
          .upload(remoteName, fileContent, {
            contentType: req.file.mimetype || 'image/jpeg',
            upsert: true
          });

        if (!upError && upData) {
          const { data: pUrl } = supabase.storage.from('product-images').getPublicUrl(remoteName);
          if (pUrl && pUrl.publicUrl) {
            finalUrl = pUrl.publicUrl;
          }
        }
      } catch (sbErr) {
        console.warn('⚠️ Supabase image upload fallback to local:', sbErr.message);
      }
    }

    res.json({ success: true, imageUrl: finalUrl, localUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: مزامنة برنامج الشامل لايت (Al-Shamel Lite Sync API)
// -------------------------------------------------------------

// وسيط التحقق من مفتاح الأمان (API Key Middleware)
const SYNC_API_KEY = process.env.SYNC_API_KEY || 'shamel_sync_secret_key_2026';

function requireSyncAuth(req, res, next) {
  const providedKey = req.headers['x-api-key'] || 
                     (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, '')) ||
                     req.query.apiKey;

  if (!providedKey || providedKey !== SYNC_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'غير مصرح: مفتاح المزامنة (API Key) غير صالح أو مفقود'
    });
  }
  next();
}

// 1. فحص صحة الاتصال وحالة المزامنة
app.get('/api/sync/status', requireSyncAuth, (req, res) => {
  try {
    const meta = dataStore.getLastSyncMeta();
    const products = dataStore.getProducts();
    const availableCount = products.filter(p => !p.isSuspended).length;
    const suspendedCount = products.filter(p => p.isSuspended).length;

    res.json({
      success: true,
      status: 'online',
      message: 'خادم موقع أبو رامز متصل وجاهز للمزامنة',
      storeName: 'Aboramez Store',
      serverTime: new Date().toISOString(),
      catalog: {
        totalProducts: products.length,
        available: availableCount,
        suspended: suspendedCount
      },
      lastSync: meta
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. إرسال دفعة أصناف للمزامنة (Upsert)
app.post('/api/sync/batch', requireSyncAuth, async (req, res) => {
  try {
    const { items, mode = 'full', dryRun = false } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'يجب إرسال مصفوفة أصناف صالحة في الحقل items'
      });
    }

    if (items.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'الحد الأقصى للدفعة الواحدة هو 500 صنف لضمان سرعة واستقرار المزامنة'
      });
    }

    const result = await dataStore.syncBatchProducts(items, {
      mode,
      dryRun: Boolean(dryRun),
      editorName: 'برنامج مزامنة الشامل'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إعادة ضبط واستبدال جميع الأصناف بالكامل بنظافة تامة من الشامل
app.post('/api/sync/reset-products', requireSyncAuth, async (req, res) => {
  try {
    const { items, dryRun = false } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'قائمة الأصناف فارغة' });
    }
    const result = await dataStore.resetAllProducts(items, {
      dryRun: Boolean(dryRun),
      editorName: 'إعادة بناء نظيفة من الشامل'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. الاستعلام عن حالة صنف معين في الموقع بالكود
app.get('/api/sync/product/:code', requireSyncAuth, (req, res) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const products = dataStore.getProducts();
    const product = products.find(p => p.code && String(p.code).trim().toUpperCase() === code);

    if (!product) {
      return res.status(404).json({ success: false, error: 'الصنف غير موجود في الموقع' });
    }

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. فحص حالة مزامنة الزبائن والموردين
app.get('/api/sync/contacts/status', requireSyncAuth, (req, res) => {
  try {
    const customers = dataStore.getCustomers();
    const suppliers = dataStore.getSuppliers();
    const custMeta = dataStore.getLastCustomersSyncMeta();
    const suppMeta = dataStore.getLastSuppliersSyncMeta();

    res.json({
      success: true,
      status: 'online',
      serverTime: new Date().toISOString(),
      customers: {
        total: customers.length,
        shamelSynced: customers.filter(c => c.shamelCode).length,
        lastSync: custMeta
      },
      suppliers: {
        total: suppliers.length,
        shamelSynced: suppliers.filter(s => s.shamelCode).length,
        lastSync: suppMeta
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. مزامنة دفعة زبائن من الشامل
app.post('/api/sync/customers', requireSyncAuth, async (req, res) => {
  try {
    const { items, dryRun = false, syncMode = 'upsert' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'يجب إرسال مصفوفة زبائن صالحة في الحقل items' });
    }
    if (items.length > 1000) {
      return res.status(400).json({ success: false, error: 'الحد الأقصى للدفعة هو 1000 زبون' });
    }

    const validModes = ['upsert', 'new_only', 'update_only'];
    if (!validModes.includes(syncMode)) {
      return res.status(400).json({ success: false, error: 'قيمة syncMode غير صالحة' });
    }

    const result = await dataStore.syncBatchCustomers(items, {
      dryRun: Boolean(dryRun),
      syncMode,
      editorName: 'برنامج مزامنة الشامل'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. مزامنة دفعة موردين من الشامل
app.post('/api/sync/suppliers', requireSyncAuth, async (req, res) => {
  try {
    const { items, dryRun = false, syncMode = 'upsert' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'يجب إرسال مصفوفة موردين صالحة في الحقل items' });
    }
    if (items.length > 500) {
      return res.status(400).json({ success: false, error: 'الحد الأقصى للدفعة هو 500 مورد' });
    }

    const validModes = ['upsert', 'new_only', 'update_only'];
    if (!validModes.includes(syncMode)) {
      return res.status(400).json({ success: false, error: 'قيمة syncMode غير صالحة' });
    }

    const result = await dataStore.syncBatchSuppliers(items, {
      dryRun: Boolean(dryRun),
      syncMode,
      editorName: 'برنامج مزامنة الشامل'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. الاستعلام عن زبون بكوده من الشامل
app.get('/api/sync/customer/:code', requireSyncAuth, (req, res) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const customers = dataStore.getCustomers();
    const customer = customers.find(c =>
      (c.shamelCode && String(c.shamelCode).toUpperCase() === code) ||
      (c.systemNumber && String(c.systemNumber).toUpperCase() === code)
    );
    if (!customer) return res.status(404).json({ success: false, error: 'الزبون غير موجود' });
    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. الاستعلام عن مورد بكوده من الشامل
app.get('/api/sync/supplier/:code', requireSyncAuth, (req, res) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const suppliers = dataStore.getSuppliers();
    const supplier = suppliers.find(s =>
      s.shamelCode && String(s.shamelCode).toUpperCase() === code
    );
    if (!supplier) return res.status(404).json({ success: false, error: 'المورد غير موجود' });
    res.json({ success: true, supplier });
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
      invoiceType, // 'sales' or 'purchase' or 'quotation'
      isQuotation,
      employeeName,
      customerName,
      customerPhone,
      customerAddress,
      customerId,
      warrantyMonths,
      notes,
      items,
      paymentMethod,
      installmentDetails,
      customTotalOverride  // سعر معدّل يدوياً (اختياري)
    } = req.body;

    const isQuotationMode = (isQuotation === true || invoiceType === 'quotation');
    const isPurchase = !isQuotationMode && invoiceType === 'purchase';

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

      const prod = dataStore.getProductById(item.productId || item.id);
      const code = item.code || prod?.code || '';
      const brand = item.brandAr || item.brand || prod?.brandAr || prod?.brand || '';

      return {
        productId: item.productId || item.id,
        code,
        brand,
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

    // تطبيق السعر المعدّل يدوياً (إن وجد) على إجمالي الفاتورة
    const effectiveTotalAmount = (!isPurchase && customTotalOverride && parseFloat(customTotalOverride) > 0)
      ? parseFloat(customTotalOverride)
      : totalAmount;

    const totalProfit = isPurchase ? 0 : (effectiveTotalAmount - totalCost);
    const profitMarginPercentage = (!isPurchase && effectiveTotalAmount > 0)
      ? parseFloat(((totalProfit / effectiveTotalAmount) * 100).toFixed(1))
      : 0;

    // معالجة الأقساط (لفواتير المبيعات الفعلية فقط)
    let validatedInstallments = null;
    if (!isPurchase && !isQuotationMode && paymentMethod === 'installments') {
      const downPayment = parseFloat(installmentDetails?.downPayment) || 0;
      const remainingAmount = Math.max(0, effectiveTotalAmount - downPayment);
      validatedInstallments = {
        downPayment,
        remainingAmount,
        duration: installmentDetails?.duration || 'غير محدد',
        scheduleNotes: installmentDetails?.scheduleNotes || ''
      };
    }

    // ─── فحص تكرار الطلب (Idempotency) ───
    const invoiceFingerprint = generateInvoiceFingerprint(req.body);
    const idemCheck = checkIdempotency(invoiceFingerprint);
    if (idemCheck.isDuplicate) {
      if (idemCheck.status === 'completed') return res.json(idemCheck.response);
      return res.status(429).json({ success: false, error: 'طلب مماثل قيد المعالجة حالياً، يرجى الانتظار لحظة ثم المحاولة مرة واحدة فقط' });
    }

    // حفظ الفاتورة
    const newInvoice = await dataStore.createInvoice({
      invoiceType: isQuotationMode ? 'quotation' : (isPurchase ? 'purchase' : 'sales'),
      isQuotation: isQuotationMode,
      employeeName,
      customerName,
      customerPhone,
      customerAddress,
      customerId,
      warrantyMonths: isQuotationMode ? 0 : (parseInt(warrantyMonths) || 12),
      notes,
      items: validatedItems,
      summary: {
        totalQuantity,
        totalCost,
        totalAmount: effectiveTotalAmount,
        totalAmountBeforeOverride: customTotalOverride ? totalAmount : undefined,
        totalProfit,
        profitMarginPercentage,
        customPriceApplied: !!customTotalOverride
      },
      paymentMethod: (!isPurchase && !isQuotationMode && paymentMethod === 'installments') ? 'installments' : 'cash',
      installmentDetails: validatedInstallments
    });

    // تحديث المخزون:
    // إذا كانت فاتورة مشتريات -> زيادة المخزون
    // إذا كانت فاتورة مبيعات فعلية -> خصم المخزون
    // إذا كانت عرض سعر (فاتورة تقديرية/وهمية) -> لا يتم تعديل المخزون مطلقاً!
    let updatedStockProducts = [];
    if (isQuotationMode) {
      updatedStockProducts = [];
    } else if (isPurchase) {
      updatedStockProducts = await dataStore.addStockForPurchaseInvoice(validatedItems, employeeName);
    } else {
      updatedStockProducts = await dataStore.deductStockForInvoice(validatedItems, employeeName);
    }

    // إرسال إشعار تيليجرام فوراً (لفواتير المبيعات والتوريد الفعلية فقط)
    const settings = dataStore.getSettings();
    let telegramResult = { ok: false, error: 'غير مهيأ' };

    if (!isQuotationMode && settings.telegramBotToken && settings.telegramChatId) {
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

    const invoiceResponse = {
      success: true,
      invoice: newInvoice,
      telegramNotification: telegramResult
    };
    resolveIdempotency(invoiceFingerprint, invoiceResponse);
    res.json(invoiceResponse);
  } catch (err) {
    if (typeof invoiceFingerprint !== 'undefined') releaseIdempotency(invoiceFingerprint);
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
    const result = invoice.invoiceType === 'purchase'
      ? await telegramService.sendPurchaseInvoiceNotification(invoice, settings)
      : await telegramService.sendInvoiceNotification(invoice, settings);
    dataStore.updateInvoiceTelegramStatus(invoice.id, result.ok, result.error);

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تحويل فاتورة العرض إلى فاتورة مبيعات فعلية
app.post('/api/invoices/:id/convert-to-sales', async (req, res) => {
  try {
    const { employeeName } = req.body;
    const result = await dataStore.convertQuotationToSalesInvoice(req.params.id, employeeName || 'مسؤول المبيعات');
    const { invoice, warranty } = result;

    // إرسال تيليجرام بعد تحويل العرض لفاتورة فعلية
    const settings = dataStore.getSettings();
    if (settings.telegramBotToken && settings.telegramChatId) {
      try {
        const telegramResult = await telegramService.sendInvoiceNotification(invoice, settings);
        dataStore.updateInvoiceTelegramStatus(invoice.id, telegramResult.ok, telegramResult.error);
      } catch (e) {
        console.error('Telegram on quotation convert error:', e.message);
      }
    }

    res.json({ success: true, invoice, warranty });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: الكفالات والضمان (Warranties)
// -------------------------------------------------------------

// جلب جميع الكفالات
app.get('/api/warranties', (req, res) => {
  try {
    dataStore.checkWarrantyStatuses();
    const warranties = dataStore.getWarranties();
    res.json({ success: true, warranties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// جلب كفالة واحدة
app.get('/api/warranties/:id', (req, res) => {
  try {
    const warranty = dataStore.getWarrantyById(req.params.id);
    if (!warranty) return res.status(404).json({ success: false, error: 'الكفالة غير موجودة' });
    res.json({ success: true, warranty });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء كفالة يدوياً (بدون فاتورة)
app.post('/api/warranties/manual', (req, res) => {
  try {
    const { customerName } = req.body;
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الزبون مطلوب' });
    }
    const warranty = dataStore.createManualWarranty(req.body);
    res.json({ success: true, warranty });
  } catch (err) {
    console.error('Manual warranty error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء كفالة يدوياً لفاتورة موجودة
app.post('/api/warranties/from-invoice/:invoiceId', (req, res) => {
  try {
    const invoice = dataStore.getInvoiceById(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ success: false, error: 'الفاتورة غير موجودة' });
    const { durationMonths, customerAddress } = req.body;
    const warranty = dataStore.createWarrantyFromInvoice(invoice, {
      durationMonths: durationMonths || 12,
      customerAddress: customerAddress || invoice.customerAddress || ''
    });
    res.json({ success: true, warranty });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تحديث بيانات كفالة (مدة الكفالة، السيريال، العنوان)
app.patch('/api/warranties/:id', (req, res) => {
  try {
    const updated = dataStore.updateWarranty(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'الكفالة غير موجودة' });
    res.json({ success: true, warranty: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// حذف كفالة
app.delete('/api/warranties/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteWarranty(req.params.id);
    res.json({ success: true, deleted });
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
app.post('/api/settings', async (req, res) => {
  try {
    const updated = await dataStore.saveSettings(req.body);
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

    console.log(`[Telegram PDF API] Sending document "${resolvedFileName}", buffer size: ${req.file.buffer.length} bytes`);

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

    // ─── فحص تكرار الطلب (Idempotency) ───
    const receiptFingerprint = generateReceiptFingerprint(req.body);
    const receiptIdem = checkIdempotency(receiptFingerprint);
    if (receiptIdem.isDuplicate) {
      if (receiptIdem.status === 'completed') return res.json(receiptIdem.response);
      return res.status(429).json({ success: false, error: 'طلب مماثل قيد المعالجة حالياً، يرجى الانتظار لحظة ثم المحاولة مرة واحدة فقط' });
    }
        const receipt = await dataStore.createReceipt({
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

    resolveIdempotency(receiptFingerprint, { success: true, receipt });
    res.json({ success: true, receipt });
  } catch (err) {
    if (typeof receiptFingerprint !== 'undefined') releaseIdempotency(receiptFingerprint);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: دليل ديون وأرصدة الزبائن (Customers & Debts)
// -------------------------------------------------------------

// جلب جميع الزبائن والأرصدة (مع إمكانية تضمين الموردين كحسابات)
app.get('/api/customers', (req, res) => {
  try {
    const customers = dataStore.getCustomers().map(c => ({
      ...c,
      accountType: 'customer',
      isSupplier: false,
      systemNumber: c.systemNumber || c.shamelCode || ''
    }));

    if (req.query.includeSuppliers === 'true' || req.query.allAccounts === 'true') {
      const suppliers = dataStore.getSuppliers().map(s => {
        const rawBal = parseFloat(s.balance) || 0;
        return {
          id: s.id,
          systemNumber: s.shamelCode || s.systemNumber || '',
          shamelCode: s.shamelCode,
          name: s.name,
          phone: s.phone || s.mobile || '',
          balance: s.shamelBalance !== undefined ? s.shamelBalance : rawBal,
          notes: s.notes || (rawBal !== 0 ? `مستحق دائن للمورد: ${rawBal.toLocaleString('en-US')} شيكل` : ''),
          accountType: 'supplier',
          isSupplier: true,
          isStopped: Boolean(s.isStopped),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          syncedAt: s.syncedAt,
          syncedBy: s.syncedBy,
          source: s.source
        };
      });
      return res.json({
        success: true,
        customers: [...customers, ...suppliers],
        totalCustomers: customers.length,
        totalSuppliers: suppliers.length
      });
    }

    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// جلب جميع الموردين والأرصدة
app.get('/api/suppliers', (req, res) => {
  try {
    // نُرجع الموردين مع shamelBalance كرصيد العرض النهائي من الشامل
    const suppliers = dataStore.getSuppliers().map(function(s) {
      var displayBal = s.shamelBalance !== undefined ? s.shamelBalance : (parseFloat(s.balance) || 0);
      return Object.assign({}, s, { balance: displayBal });
    });
    res.json({ success: true, suppliers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إضافة أو تعديل زبون
app.post('/api/customers', async (req, res) => {
  try {
    const { id, systemNumber, name, phone, balance, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'اسم الزبون مطلوب' });
    }
    const saved = await dataStore.saveCustomer({ id, systemNumber, name, phone, balance, notes });
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
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteCustomer(req.params.id);
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
app.delete('/api/receipts/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteReceipt(req.params.id);
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

// -------------------------------------------------------------
// APIs: النسخ الاحتياطي وحماية البيانات (Backup & Restore)
// -------------------------------------------------------------

// جلب قائمة ملفات النسخ الاحتياطي
app.get('/api/backups', (req, res) => {
  try {
    const list = dataStore.getBackupList();
    res.json({ success: true, backups: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إنشاء نسخة احتياطية جديدة
app.post('/api/backups/create', (req, res) => {
  try {
    const label = req.body?.label || req.query?.label || 'manual';
    const result = dataStore.createBackup(label);
    res.json({ success: true, backup: result, message: 'تم إنشاء النسخة الاحتياطية بنجاح!' });
  } catch (err) {
    console.error('Backup create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// تحميل ملف النسخة الاحتياطية
app.get('/api/backups/download/:filename', (req, res) => {
  try {
    const filePath = dataStore.getBackupFilePath(req.params.filename);
    if (!filePath) {
      return res.status(404).json({ success: false, error: 'ملف النسخة الاحتياطية غير موجود' });
    }
    res.download(filePath, req.params.filename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إرسال النسخة الاحتياطية فوراً لتيليجرام
app.post('/api/backups/send-telegram', async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'لم يتم ضبط إعدادات تيليجرام بعد' });
    }

    const backup = dataStore.createBackup('telegram_cloud');
    const buffer = fs.readFileSync(backup.filePath);

    const caption = 
`📦 <b>نسخة احتياطية شاملة للنظام (Cloud Backup)</b>
🏢 <b>${settings.companyName || 'شركة أبو رامز'}</b>
━━━━━━━━━━━━━━━━━━
📅 <b>الوقت:</b> ${formatServerDateTime(new Date())}
📦 <b>الأصناف:</b> <b>${backup.counts.products} صنف</b>
🧾 <b>الفواتير:</b> <b>${backup.counts.invoices} فاتورة</b>
👥 <b>الزبائن:</b> <b>${backup.counts.customers} زبون</b>
💰 <b>سندات القبض:</b> <b>${backup.counts.receipts} سند</b>
━━━━━━━━━━━━━━━━━━
<i>🔒 احتفظ بهذا الملف بأمان، يتيح لك استرجاع كامل بيانات المتجر في أي وقت بنقرة زر.</i>`;

    const result = await telegramService.sendDocument(
      settings.telegramBotToken,
      settings.telegramChatId,
      buffer,
      backup.filename,
      caption,
      'HTML'
    );

    if (result.ok) {
      res.json({ success: true, message: 'تم إرسال النسخة الاحتياطية لتيليجرام بنجاح!' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'تعذر الإرسال لتيليجرام' });
    }
  } catch (err) {
    console.error('Send backup to telegram error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// استعادة نسخة احتياطية
app.post('/api/backups/restore', pdfUpload.single('backupFile'), (req, res) => {
  try {
    let payload = null;

    if (req.file && req.file.buffer) {
      const content = req.file.buffer.toString('utf-8');
      payload = JSON.parse(content);
    } else if (req.body && req.body.data) {
      payload = req.body;
    } else if (req.body && req.body.filename) {
      const filePath = dataStore.getBackupFilePath(req.body.filename);
      if (!filePath) {
        return res.status(404).json({ success: false, error: 'الملف غير موجود' });
      }
      payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    if (!payload || !payload.data) {
      return res.status(400).json({ success: false, error: 'ملف النسخة الاحتياطية غير صالح أو تالف' });
    }

    const restoreResult = dataStore.restoreBackup(payload);
    console.log(`✅ تم استعادة نسخة احتياطية بنجاح في: ${formatServerDateTime(new Date())}`);

    res.json({
      success: true,
      message: 'تم استعادة النسخة الاحتياطية بنجاح!',
      counts: restoreResult.counts
    });
  } catch (err) {
    console.error('Restore backup error:', err);
    res.status(400).json({ success: false, error: 'فشل استعادة النسخة: ' + err.message });
  }
});

// -------------------------------------------------------------
// APIs: إدارة وتصنيف الماركات الذكي (Smart Brand Classification)
// -------------------------------------------------------------
const brandClassifier = require('./brandClassifier');

// جلب التدقيق الكامل لجميع الأصناف والماركات
app.get('/api/brands-classification/audit', (req, res) => {
  try {
    const products = dataStore.getProducts();
    const dictionary = brandClassifier.loadDictionary();
    const analysis = brandClassifier.analyzeAllProducts(products, dictionary);
    res.json({ success: true, ...analysis });
  } catch (err) {
    console.error('Brand audit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// فحص تعارض الماركة عند إضافة أو تعديل منتج (Real-time conflict detection)
app.post('/api/brands-classification/check-conflict', (req, res) => {
  try {
    const { name, model, brand } = req.body;
    const dictionary = brandClassifier.loadDictionary();
    const analysis = brandClassifier.analyzeProductBrand({ name, description: model, brand }, dictionary);
    const hasConflict = analysis.status === 'candidate_change' && analysis.proposedBrand.toLowerCase() !== (brand || '').toLowerCase();
    res.json({
      success: true,
      hasConflict,
      currentBrand: brand,
      proposedBrand: analysis.proposedBrand,
      proposedBrandAr: analysis.proposedBrandAr,
      confidence: analysis.confidence,
      reason: analysis.reason
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تطبيق التغييرات المعتمدة على الماركات
app.post('/api/brands-classification/apply', async (req, res) => {
  try {
    const { items, allHighConfidence, editorName } = req.body;
    const productsPath = path.join(__dirname, 'data', 'products.json');
    let itemsToUpdate = [];

    if (allHighConfidence) {
      const products = dataStore.getProducts();
      const dictionary = brandClassifier.loadDictionary();
      const analysis = brandClassifier.analyzeAllProducts(products, dictionary);
      itemsToUpdate = analysis.items.filter(i => i.status === 'candidate_change' && i.confidence === 'high');
    } else if (Array.isArray(items)) {
      itemsToUpdate = items;
    } else {
      return res.status(400).json({ success: false, error: 'لم يتم تحديد أي أصناف للتحديث' });
    }

    if (itemsToUpdate.length === 0) {
      return res.json({ success: true, updatedCount: 0, message: 'لا توجد أصناف مؤهلة للتحديث' });
    }

    const result = brandClassifier.applyBrandChanges(productsPath, itemsToUpdate, editorName || 'مدير النظام');

    // حفظ سحابي دائم ومباشر في Supabase عبر dataStore
    const brandUpdates = itemsToUpdate.map(u => ({
      code: u.code,
      brand: u.proposedBrand,
      brandAr: u.proposedBrandAr
    }));
    await dataStore.bulkUpdateBrands(brandUpdates, editorName || 'مدير النظام');

    res.json({
      success: true,
      ...result,
      message: `تم بنجاح تحديث ماركات ${result.updatedCount} صنف وحفظها في قاعدة بيانات Supabase بشكل دائم.`
    });
  } catch (err) {
    console.error('Apply brand changes error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// التراجع عن آخر عملية تعديل للماركات
app.post('/api/brands-classification/rollback', (req, res) => {
  try {
    const productsPath = path.join(__dirname, 'data', 'products.json');
    const result = brandClassifier.rollbackLastChange(productsPath);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Rollback brand error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// جلب قاموس الماركات
app.get('/api/brands-classification/dictionary', (req, res) => {
  try {
    const dict = brandClassifier.loadDictionary();
    res.json({ success: true, dictionary: dict });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// حفظ / تعديل قاموس الماركات
app.post('/api/brands-classification/dictionary', (req, res) => {
  try {
    const { dictionary } = req.body;
    if (!Array.isArray(dictionary)) {
      return res.status(400).json({ success: false, error: 'صيغة القاموس غير صالحة' });
    }
    const saved = brandClassifier.saveDictionary(dictionary);
    res.json({ success: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// جلب سجل التدقيق وتاريخ التعديلات
app.get('/api/brands-classification/logs', (req, res) => {
  try {
    const logFile = path.join(__dirname, 'data', 'brand_changes_log.json');
    const logs = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// جدولة النسخ الاحتياطي التلقائي اليومي (كل 24 ساعة)
function startAutoBackupSchedule() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('⏰ بدء إنشاء النسخة الاحتياطية التلقائية اليومية...');
      const backup = dataStore.createBackup('auto_daily');
      console.log(`✅ تم إنشاء النسخة الاحتياطية التلقائية: ${backup.filename}`);

      // إرسال لتيليجرام إذا كان البوت مهيأ
      const settings = dataStore.getSettings();
      if (settings.telegramBotToken && settings.telegramChatId) {
        const buffer = fs.readFileSync(backup.filePath);
        const caption = 
`🌙 <b>النسخة الاحتياطية التلقائية اليومية (إغلاق اليوم)</b>
🏢 <b>${settings.companyName || 'شركة أبو رامز'}</b>
📅 <b>التاريخ:</b> ${formatServerDateTime(new Date())}
📦 الأصناف: <b>${backup.counts.products}</b> | 🧾 الفواتير: <b>${backup.counts.invoices}</b> | 👥 الزبائن: <b>${backup.counts.customers}</b>`;

        await telegramService.sendDocument(
          settings.telegramBotToken,
          settings.telegramChatId,
          buffer,
          backup.filename,
          caption,
          'HTML'
        );
        console.log('✈️ تم إرسال النسخة الاحتياطية اليومية لتيليجرام بنجاح');
      }
    } catch (e) {
      console.error('Auto backup schedule error:', e.message);
    }
  }, TWENTY_FOUR_HOURS);
}

// تشغيل الخادم

// ================================================================
// معالجة الأخطاء الحرجة غير المتوقعة — إشعار فوري عبر Telegram
// ================================================================
process.on('uncaughtException', function(err) {
  console.error('💥 uncaughtException:', err.message);
  telegramService.sendSystemAlert('server_crash', {
    errorType: 'UncaughtException',
    error: err.message + (err.stack ? '\n' + err.stack.slice(0, 200) : '')
  }).catch(function() {}).finally(function() { process.exit(1); });
});

process.on('unhandledRejection', function(reason) {
  var msg = reason instanceof Error ? reason.message : String(reason);
  console.error('💥 unhandledRejection:', msg);
  telegramService.sendSystemAlert('server_crash', {
    errorType: 'UnhandledRejection',
    error: msg
  }).catch(function() {});
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`=======================================================`);
  console.log(`🚀 نظام المبيعات وإصدار الفواتير يعمل بنجاح على:`);
  console.log(`🔗 الرابط المحلي: http://localhost:${PORT}`);
  console.log(`=======================================================`);

  // بدء جدولة النسخ الاحتياطي التلقائي
  startAutoBackupSchedule();

  // ─── فحص جاهزية Supabase قبل استقبال أي طلبات كتابة ───
  const readiness = await systemMode.verifyReadiness();
  if (readiness.ok) {
    console.log(`✅ وضع النظام: قراءة وكتابة (Read-Write Mode) — جميع العمليات مفعّلة`);
    // تم إلغاء إرسال إشعار النجاح — يتم إرسال إشعارات الفشل فقط
  } else {
    console.warn(`⚠️ وضع النظام: قراءة فقط (Read-Only Degraded Mode) — سبب: ${readiness.error || 'تعذر الاتصال بـ Supabase'}`);
    console.warn(`   ستُرفض جميع عمليات الحفظ والتعديل والحذف حتى يعود الاتصال.`);
    telegramService.sendSystemAlert('startup', { mode: 'read-only', error: readiness.error }).catch(() => {});
  }

  // فحص دوري كل 30 ثانية لاستعادة وضع الكتابة عند عودة الاتصال
  systemMode.startPeriodicHealthCheck(30000, async () => {
    await dataStore.initFromSupabase();
  });

  // استعادة البيانات من Supabase
  await dataStore.initFromSupabase();
});
