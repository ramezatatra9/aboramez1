const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabaseClient');
const { categorizeProduct, getDefaultImageForCategory, detectBrand } = require('./categoryHelper');

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const RECEIPTS_FILE = path.join(DATA_DIR, 'receipts.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const SUPPLIERS_FILE = path.join(DATA_DIR, 'suppliers.json');
const WARRANTIES_FILE = path.join(DATA_DIR, 'warranties.json');
const SYNC_INVOICES_META_FILE = path.join(DATA_DIR, 'sync_invoices_meta.json');
const SYNC_VOUCHERS_META_FILE = path.join(DATA_DIR, 'sync_vouchers_meta.json');
const STORE_CONFIG_FILE = path.join(DATA_DIR, 'store_config.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
let debounceInvoicesSnapshotTimer = null;
let debounceReceiptsSnapshotTimer = null;
const BACKUPS_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// مزامنة صنف مع قاعدة بيانات Supabase الدائمة مع الحفاظ الصارم على كافة الحقول
async function syncProductToSupabase(product) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  try {
    const payload = {
      id: String(product.id),
      code: String(product.code || '').trim(),
      name: String(product.name || '').trim(),
      category: String(product.mainCategory || product.category || 'أجهزة كهربائية كبيرة'),
      subcategory: String(product.category || 'عام'),
      costPrice: Number(product.costPrice) || 0,
      sellPrice: Number(product.sellPrice) || 0,
      stock: parseInt(product.stock) || 0,
      unit: String(product.unit || 'قطعة'),
      image: String(product.image || ''),
      description: String(product.description || ''),
      barcode: String(product.barcode || ''),
      isSuspended: Boolean(product.isSuspended),
      brand: String(product.brand || 'أخرى'),
      brandAr: String(product.brandAr || 'أخرى / عام'),
      images: Array.isArray(product.images) ? product.images : (product.images ? [product.images] : []),
      lastStockUpdate: product.lastStockUpdate || null,
      lastStockEditor: product.lastStockEditor || null,
      updatedAt: product.updatedAt || new Date().toISOString(),
      lastSyncAt: product.lastSyncAt || null,
      createdAt: product.createdAt || new Date().toISOString()
    };
    const { error } = await supabase.from('products').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Supabase product sync error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase product sync error:', err.message);
    return { success: false, error: err.message };
  }
}

// مزامنة زبون مع جدول customers في Supabase
async function syncCustomerToSupabase(customer) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  try {
    const payload = {
      id: String(customer.id),
      systemNumber: String(customer.systemNumber || customer.shamelCode || '').trim() || null,
      shamelCode: String(customer.shamelCode || customer.systemNumber || '').trim() || null,
      name: String(customer.name || '').trim(),
      phone: String(customer.phone || '').trim(),
      mobile: String(customer.mobile || customer.phone || '').trim(),
      email: String(customer.email || '').trim(),
      address: String(customer.address || '').trim(),
      balance: parseFloat(customer.balance) || 0,
      shamelBalance: parseFloat(customer.shamelBalance !== undefined ? customer.shamelBalance : customer.balance) || 0,
      isStopped: Boolean(customer.isStopped),
      notes: String(customer.notes || '').trim(),
      source: String(customer.source || '').trim(),
      syncedAt: customer.syncedAt || null,
      syncedBy: String(customer.syncedBy || '').trim() || null,
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: customer.updatedAt || new Date().toISOString(),
      lastSyncAt: customer.lastSyncAt || null
    };
    const { error } = await supabase.from('customers').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Supabase customer sync error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase customer sync exception:', err.message);
    return { success: false, error: err.message };
  }
}

async function deleteCustomerFromSupabase(id) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  try {
    const { error } = await supabase.from('customers').delete().eq('id', String(id));
    if (error) {
      console.error('Supabase customer delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase customer delete error:', err.message);
    return { success: false, error: err.message };
  }
}

// مزامنة مورد مع جدول suppliers في Supabase (مع استبعاد مورد بضاعة قديمة)
async function syncSupplierToSupabase(supplier) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  const code = String(supplier.shamelCode || '').toUpperCase();
  const name = String(supplier.name || '');
  if (code === 'S00000003' || name.includes('بضاعة قديمة')) {
    return { success: true, excluded: true };
  }
  try {
    const payload = {
      id: String(supplier.id),
      shamelCode: String(supplier.shamelCode || '').trim() || null,
      name: String(supplier.name || '').trim(),
      phone: String(supplier.phone || '').trim(),
      mobile: String(supplier.mobile || supplier.phone || '').trim(),
      email: String(supplier.email || '').trim(),
      address: String(supplier.address || '').trim(),
      balance: parseFloat(supplier.balance) || 0,
      shamelBalance: parseFloat(supplier.shamelBalance !== undefined ? supplier.shamelBalance : supplier.balance) || 0,
      isStopped: Boolean(supplier.isStopped),
      notes: String(supplier.notes || '').trim(),
      source: String(supplier.source || '').trim(),
      syncedAt: supplier.syncedAt || null,
      syncedBy: String(supplier.syncedBy || '').trim() || null,
      createdAt: supplier.createdAt || new Date().toISOString(),
      updatedAt: supplier.updatedAt || new Date().toISOString(),
      lastSyncAt: supplier.lastSyncAt || null
    };
    const { error } = await supabase.from('suppliers').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Supabase supplier sync error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase supplier sync exception:', err.message);
    return { success: false, error: err.message };
  }
}

async function deleteSupplierFromSupabase(id) {
  if (!supabase) return;
  try {
    await supabase.from('suppliers').delete().eq('id', String(id));
  } catch (err) {
    console.error('Supabase supplier delete error:', err.message);
  }
}

async function deleteProductFromSupabase(id) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  try {
    const { error } = await supabase.from('products').delete().eq('id', String(id));
    if (error) {
      console.error('Supabase product delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase product delete error:', err.message);
    return { success: false, error: err.message };
  }
}

async function syncInvoiceToSupabase(invoice) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  try {
    const cleanInvNum = parseInt(String(invoice.invoiceNumber || '').replace(/\D/g, '')) || 0;
    const { error } = await supabase.from('invoices').upsert({
      id: String(invoice.id),
      invoiceNumber: cleanInvNum,
      invoiceType: invoice.invoiceType || 'sales',
      isQuotation: Boolean(invoice.isQuotation),
      createdAt: invoice.createdAt,
      convertedAt: invoice.convertedAt || null,
      convertedBy: invoice.convertedBy || null,
      employeeName: invoice.employeeName,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerAddress: invoice.customerAddress || null,
      customerId: invoice.customerId || null,
      customerSystemNumber: invoice.customerSystemNumber || null,
      notes: invoice.notes,
      items: invoice.items,
      summary: invoice.summary,
      paymentMethod: invoice.paymentMethod,
      installmentDetails: invoice.installmentDetails,
      warrantyId: invoice.warrantyId || null,
      warrantyNumber: invoice.warrantyNumber || null,
      warrantyMonths: invoice.warrantyMonths || 12,
      telegramStatus: invoice.telegramStatus
    }, { onConflict: 'id' });
    if (error) {
      console.error('Supabase invoice sync error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase invoice sync error:', err.message);
    return { success: false, error: err.message };
  }
}

async function deleteInvoiceFromSupabase(id) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  try {
    const { error } = await supabase.from('invoices').delete().eq('id', String(id));
    if (error) {
      console.error('Supabase invoice delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase invoice delete error:', err.message);
    return { success: false, error: err.message };
  }
}


async function syncReceiptToSupabase(receipt) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  try {
    const cleanRcpNum = parseInt(String(receipt.receiptNumber || '').replace(/\D/g, '')) || 0;
    const { error } = await supabase.from('receipts').upsert({
      id: String(receipt.id),
      receiptNumber: cleanRcpNum,
      createdAt: receipt.createdAt,
      employeeName: receipt.employeeName,
      customerName: receipt.customerName,
      customerPhone: receipt.customerPhone,
      amount: receipt.amount,
      description: receipt.description,
      notes: receipt.notes,
      paymentMethod: receipt.paymentMethod
    }, { onConflict: 'id' });
    if (error) {
      console.error('Supabase receipt sync error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase receipt sync error:', err.message);
    return { success: false, error: err.message };
  }
}

async function deleteReceiptFromSupabase(id) {
  if (!supabase) return { success: false, error: 'Supabase غير متصل' };
  try {
    const { error } = await supabase.from('receipts').delete().eq('id', id);
    if (error) {
      console.error('Supabase receipt delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase receipt delete error:', err.message);
    return { success: false, error: err.message };
  }
}

async function syncWarrantyToSupabase(warranty) {
  if (!supabase) return { success: false, error: 'Supabase غير مهيأ' };
  try {
    const { error } = await supabase.from('warranties').upsert({
      id: String(warranty.id),
      warrantyNumber: warranty.warrantyNumber,
      invoiceId: String(warranty.invoiceId || ''),
      invoiceNumber: warranty.invoiceNumber || null,
      createdAt: warranty.createdAt,
      purchaseDate: warranty.purchaseDate,
      durationMonths: warranty.durationMonths,
      expiryDate: warranty.expiryDate,
      customerName: warranty.customerName,
      customerPhone: warranty.customerPhone,
      customerAddress: warranty.customerAddress,
      items: warranty.items,
      status: warranty.status,
      customerId: warranty.customerId ? String(warranty.customerId) : null,
      customerSystemNumber: warranty.customerSystemNumber ? String(warranty.customerSystemNumber) : null,
      durationText: warranty.durationText ? String(warranty.durationText) : null,
      terms: Array.isArray(warranty.terms) ? warranty.terms : [],
      companyName: warranty.companyName ? String(warranty.companyName) : null,
      companyPhone: warranty.companyPhone ? String(warranty.companyPhone) : null,
      companyAddress: warranty.companyAddress ? String(warranty.companyAddress) : null,
      notes: String(warranty.notes || '').trim(),
      updatedAt: warranty.updatedAt || new Date().toISOString()
    }, { onConflict: 'id' });
    if (error) {
      console.error('Supabase warranty sync error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase warranty sync error:', err.message);
    return { success: false, error: err.message };
  }
}

async function deleteWarrantyFromSupabase(id) {
  if (!supabase) return { success: false, error: 'Supabase غير مهيأ' };
  try {
    const { error } = await supabase.from('warranties').delete().eq('id', String(id));
    if (error) {
      console.error('Supabase warranty delete error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase warranty delete error:', err.message);
    return { success: false, error: err.message };
  }
}

function calculateExpiryDate(startDateInput, durationMonths = 12) {
  const d = new Date(startDateInput || Date.now());
  if (isNaN(d.getTime())) {
    return new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  }
  const months = parseInt(durationMonths) || 12;
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

async function syncSettingsToSupabase(settings) {
  if (!supabase) return { success: false, error: 'Supabase غير مهيأ' };
  try {
    const { error } = await supabase.from('settings').upsert({
      id: 'general',
      data: settings
    }, { onConflict: 'id' });
    if (error) {
      console.error('Supabase settings sync error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase settings sync error:', err.message);
    return { success: false, error: err.message };
  }
}

// مزامنة إعدادات المتجر (store_config) مع Supabase لمشاركتها بين عدة سيرفرات
// إشعار خادم متجر الزبائن فوراً لسحب التعديلات من Supabase دون انتظار
function notifyStoreServers() {
  const currentHost = (process.env.RENDER_EXTERNAL_HOSTNAME || '').toLowerCase();
  const targets = [
    process.env.STORE_REFRESH_URL,
    'https://aboramez1.onrender.com/api/refresh-from-cloud',
    'https://aboramez.store/api/refresh-from-cloud'
  ].filter(Boolean);

  targets.forEach(urlStr => {
    try {
      const u = new URL(urlStr);
      if (currentHost && u.hostname.toLowerCase() === currentHost) return;
      const httpModule = u.protocol === 'https:' ? require('https') : require('http');
      const req = httpModule.get(urlStr, (res) => { res.resume(); });
      req.on('error', () => {});
      req.setTimeout(4000, () => req.destroy());
    } catch (e) {}
  });
}

async function syncStoreConfigToSupabase(config) {
  if (!supabase) return { success: false, error: 'Supabase غير مهيأ' };
  try {
    const { error } = await supabase.from('settings').upsert({
      id: 'store_config',
      data: config
    }, { onConflict: 'id' });
    if (error) {
      console.error('Supabase store_config sync error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('Supabase store_config sync error:', err.message);
    return { success: false, error: err.message };
  }
}

// تأكد من وجود مجلد البيانات
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// قراءة ملف JSON بشكل آمن
function readJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

// كتابة ملف JSON بشكل آمن
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
    return false;
  }
}

// الإعدادات الافتراضية
const defaultSettings = {
  companyName: "رامز عطاطرة",
  companyPhone: "059-1234567",
  companyAddress: "المركز التجاري الرئيسي - الطابق الأول",
  currency: "شيكل",
  telegramBotToken: "",
  telegramChatId: "",
  invoiceFooterText: "شكراً لتعاملكم معنا - بضاعة الشركة مكفولة حسب شروط الضمان",
  pinLockEnabled: true,
  securityUsers: [
    { id: 'u-admin', name: 'المدير العام (أبو رامز)', pin: '8802', role: 'admin' },
    { id: 'u-cashier-1', name: 'موظف مبيعات (1111)', pin: '1111', role: 'cashier' },
    { id: 'u-cashier-2', name: 'موظف مبيعات (1234)', pin: '1234', role: 'cashier' }
  ]
};

// تم إلغاء استخدام أي منتجات تجريبية أو مثبتة داخل الكود نهائياً
// الاعتماد الحصري هو على بيانات الشامل لايت المحفوظة في قاعدة بيانات Supabase الدائمة

// ذاكرة تخزين مؤقت للمنتجات (تُحدَّث عند كل عملية تعديل أو مزامنة)
let _productsCache = null;
let _productsCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق

const dataStore = {
  // المنتجات - يقرأ من الذاكرة المؤقتة ثم الملف المحلي المتزامن (بدون أي منتجات وهمية نهائياً)
  getProducts() {
    // إن كانت الذاكرة المؤقتة حديثة استخدمها فوراً
    if (_productsCache && (Date.now() - _productsCacheTime) < CACHE_TTL_MS) {
      return _productsCache;
    }
    // قراءة من الملف المحلي المتزامن دون أي افتراضات وهمية
    const data = readJson(PRODUCTS_FILE, []);
    _productsCache = Array.isArray(data) ? data : [];
    _productsCacheTime = Date.now();
    return _productsCache;
  },

  // تحديث الذاكرة المؤقتة
  _invalidateCache() {
    _productsCache = null;
    _productsCacheTime = 0;
  },

  getProductById(id) {
    const products = this.getProducts();
    return products.find(p => p.id === id);
  },

  async saveProduct(productData) {
    const products = this.getProducts();
    let product;

    // معالجة مصفوفة الصور ودعم إضافة أكثر من صورة للصنف
    let images = [];
    if (Array.isArray(productData.images)) {
      images = productData.images.filter(img => typeof img === 'string' && img.trim() !== '');
    } else if (typeof productData.images === 'string' && productData.images.trim()) {
      try {
        const parsed = JSON.parse(productData.images);
        if (Array.isArray(parsed)) images = parsed.filter(img => typeof img === 'string' && img.trim() !== '');
        else images = [productData.images.trim()];
      } catch (e) {
        images = [productData.images.trim()];
      }
    }
    if (images.length === 0 && productData.image && typeof productData.image === 'string' && productData.image.trim()) {
      images = [productData.image.trim()];
    }
    const defaultPlaceholder = "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80";
    const primaryImage = images.length > 0 ? images[0] : (productData.image || defaultPlaceholder);

    if (productData.id) {
      // تعديل
      const index = products.findIndex(p => p.id === productData.id);
      if (index !== -1) {
        let finalBrand = productData.brand || products[index].brand;
        let finalBrandAr = productData.brandAr || products[index].brandAr;
        if (!finalBrand || finalBrand === 'أخرى') {
          const detected = detectBrand(productData.name || products[index].name);
          finalBrand = detected.brand;
          finalBrandAr = detected.brandAr;
        }
        product = {
          ...products[index],
          ...productData,
          brand: finalBrand,
          brandAr: finalBrandAr,
          costPrice: parseFloat(productData.costPrice) || 0,
          sellPrice: parseFloat(productData.sellPrice) || 0,
          stock: parseInt(productData.stock) || 0,
          image: primaryImage,
          images: images.length > 0 ? images : [primaryImage],
          updatedAt: new Date().toISOString()
        };
        products[index] = product;
      }
    }

    if (!product) {
      // إضافة جديد
      let finalBrand = productData.brand;
      let finalBrandAr = productData.brandAr;
      if (!finalBrand || finalBrand === 'أخرى') {
        const detected = detectBrand(productData.name);
        finalBrand = detected.brand;
        finalBrandAr = detected.brandAr;
      }
      product = {
        id: "prod-" + Date.now(),
        code: productData.code || "PRD-" + Math.floor(100 + Math.random() * 900),
        barcode: productData.barcode ? String(productData.barcode).trim() : "",
        name: productData.name,
        brand: finalBrand,
        brandAr: finalBrandAr,
        mainCategory: productData.mainCategory || "أجهزة كهربائية كبيرة",
        category: productData.category || "عام",
        costPrice: parseFloat(productData.costPrice) || 0,
        sellPrice: parseFloat(productData.sellPrice) || 0,
        stock: parseInt(productData.stock) || 0,
        image: primaryImage,
        images: images.length > 0 ? images : [primaryImage],
        description: productData.description || "",
        createdAt: new Date().toISOString()
      };
      products.unshift(product);
    }

    if (supabase) {
      const res = await syncProductToSupabase(product);
      if (!res.success) {
        throw new Error('تعذر حفظ المنتج في قاعدة البيانات الدائمة (Supabase): ' + res.error);
      }
    }
    writeJson(PRODUCTS_FILE, products);
    notifyStoreServers();
    return product;
  },

  async deleteProduct(id) {
    const products = this.getProducts();
    const toDelete = products.find(p => p.id === id);
    if (!toDelete) return false;
    if (supabase) {
      const res = await deleteProductFromSupabase(id);
      if (!res.success) {
        throw new Error('تعذر حذف المنتج من قاعدة البيانات الدائمة (Supabase): ' + res.error);
      }
    }
    const filtered = products.filter(p => p.id !== id);
    writeJson(PRODUCTS_FILE, filtered);
    notifyStoreServers();
    return true;
  },

  // خصم الكميات المباعة من المخزون عند إنشاء فاتورة
  async deductStockForInvoice(items, editorName) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const products = this.getProducts();
    const now = new Date().toISOString();
    const modifiedProducts = [];

    items.forEach(item => {
      const prodId = item.productId || item.id;
      const qty = Math.max(1, parseInt(item.quantity) || 1);
      const index = products.findIndex(p => p.id === prodId);
      if (index !== -1) {
        const currentStock = parseInt(products[index].stock) || 0;
        products[index].stock = Math.max(0, currentStock - qty);
        products[index].lastStockUpdate = now;
        products[index].lastStockEditor = editorName ? `فاتورة (${editorName.trim()})` : 'فاتورة مبيعات';
        modifiedProducts.push(products[index]);
      }
    });

    if (modifiedProducts.length > 0) {
      if (supabase) {
        for (const p of modifiedProducts) {
          await syncProductToSupabase(p);
        }
      }
      writeJson(PRODUCTS_FILE, products);
    }
    return modifiedProducts;
  },

  // زيادة كميات المخزون عند إنشاء فاتورة مشتريات / توريد
  addStockForPurchaseInvoice(items, editorName) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const products = this.getProducts();
    const now = new Date().toISOString();
    const modifiedProducts = [];

    items.forEach(item => {
      const prodId = item.productId || item.id;
      const qty = Math.max(1, parseInt(item.quantity) || 1);
      const index = products.findIndex(p => p.id === prodId);
      if (index !== -1) {
        const currentStock = parseInt(products[index].stock) || 0;
        products[index].stock = currentStock + qty;
        // تحديث سعر التكلفة إذا ورد بسعر جديد
        if (item.costPrice && parseFloat(item.costPrice) > 0) {
          products[index].costPrice = parseFloat(item.costPrice);
        }
        products[index].lastStockUpdate = now;
        products[index].lastStockEditor = editorName ? `فاتورة مشتريات (${editorName.trim()})` : 'فاتورة مشتريات وتوريد';
        modifiedProducts.push(products[index]);
      }
    });

    if (modifiedProducts.length > 0) {
      writeJson(PRODUCTS_FILE, products);
      modifiedProducts.forEach(p => syncProductToSupabase(p));
    }
    return modifiedProducts;
  },

  // الفواتير
  getInvoices() {
    return readJson(INVOICES_FILE, []);
  },

  getInvoiceById(id) {
    const invoices = this.getInvoices();
    return invoices.find(inv => inv.id === id || inv.invoiceNumber === parseInt(id));
  },

  async createInvoice(invoiceData) {
    const invoices = this.getInvoices();
    const nextNumber = invoices.length > 0 ? Math.max(...invoices.map(i => i.invoiceNumber || 1000)) + 1 : 1001;

    const isQuotation = !!invoiceData.isQuotation || invoiceData.invoiceType === 'quotation';
    const invoiceType = isQuotation ? 'quotation' : (invoiceData.invoiceType === 'purchase' ? 'purchase' : 'sales');

    const invoice = {
      id: "INV-" + nextNumber,
      invoiceNumber: nextNumber,
      invoiceType,
      isQuotation,
      createdAt: new Date().toISOString(),
      employeeName: invoiceData.employeeName?.trim() || "غير محدد",
      customerName: invoiceData.customerName?.trim() || (isQuotation ? "عرض سعر لزبون" : (invoiceType === 'purchase' ? "مورد بضاعة" : "زبون نقدي")),
      customerPhone: invoiceData.customerPhone?.trim() || "",
      customerAddress: invoiceData.customerAddress?.trim() || "",
      customerId: invoiceData.customerId || null,
      customerSystemNumber: invoiceData.customerSystemNumber || '',
      notes: invoiceData.notes || "",
      items: invoiceData.items || [],
      summary: invoiceData.summary || {
        totalQuantity: 0,
        totalCost: 0,
        totalAmount: 0,
        totalProfit: 0,
        profitMarginPercentage: 0
      },
      paymentMethod: invoiceData.paymentMethod || "cash", // 'cash' or 'installments'
      installmentDetails: invoiceData.paymentMethod === 'installments' ? {
        downPayment: parseFloat(invoiceData.installmentDetails?.downPayment) || 0,
        remainingAmount: parseFloat(invoiceData.installmentDetails?.remainingAmount) || 0,
        duration: invoiceData.installmentDetails?.duration || "",
        scheduleNotes: invoiceData.installmentDetails?.scheduleNotes || ""
      } : null,
      warrantyMonths: parseInt(invoiceData.warrantyMonths) || 12,
      warrantyId: null,
      warrantyNumber: null,
      telegramStatus: {
        sent: false,
        sentAt: null,
        error: null
      }
    };

    // إذا كان Supabase متصلاً، نتحقق من نجاح الحفظ السحابي أولاً لمنع حفظ وهمي
    if (supabase) {
      const sbRes = await syncInvoiceToSupabase(invoice);
      if (!sbRes || !sbRes.success) {
        throw new Error('تعذر حفظ الفاتورة في قاعدة البيانات الدائمة: ' + (sbRes?.error || 'خطأ غير معروف'));
      }
    }

    invoices.unshift(invoice);
    writeJson(INVOICES_FILE, invoices);
    if (supabase) { supabase.from('settings').upsert({ id: 'invoices', data: invoices }).catch(() => {}); }

    // إذا كانت فاتورة مبيعات فعلية (وليست للعرض فقط وليست مشتريات)
    if (!isQuotation && invoice.invoiceType === 'sales') {
      if (invoice.customerName && invoice.customerName !== 'زبون نقدي') {
        const customers = this.getCustomers();
        const existing = customers.find(c => 
          (invoice.customerId && c.id === invoice.customerId) ||
          (invoice.customerSystemNumber && c.systemNumber === invoice.customerSystemNumber) ||
          (c.name && c.name.trim().toLowerCase() === invoice.customerName.trim().toLowerCase())
        );
        const remainingToAdd = (invoice.paymentMethod === 'installments' && invoice.installmentDetails?.remainingAmount) ? invoice.installmentDetails.remainingAmount : 0;
        if (existing) {
          invoice.previousCustomerBalance = existing.balance || 0;
          if (remainingToAdd > 0) {
            try {
              await this.adjustCustomerBalance(existing.id, remainingToAdd);
            } catch (balErr) {
              if (supabase) { await deleteInvoiceFromSupabase(invoice.id); }
              throw new Error('تعذر تحديث رصيد العميل في قاعدة البيانات، تم التراجع عن حفظ الفاتورة: ' + balErr.message);
            }
          }
          invoice.customerId = existing.id;
          invoice.customerSystemNumber = existing.systemNumber;
          invoice.currentCustomerBalance = (existing.balance || 0) + remainingToAdd;
          if (invoice.customerAddress && !existing.address) {
            await this.saveCustomer({ id: existing.id, address: invoice.customerAddress });
          }
        } else {
          const newCust = await this.saveCustomer({
            name: invoice.customerName,
            phone: invoice.customerPhone || '',
            address: invoice.customerAddress || '',
            balance: remainingToAdd,
            notes: 'أضيف تلقائياً من فاتورة مبيعات #' + invoice.invoiceNumber
          });
          invoice.previousCustomerBalance = 0;
          invoice.customerId = newCust.id;
          invoice.customerSystemNumber = newCust.systemNumber;
          invoice.currentCustomerBalance = remainingToAdd;
        }
      }

      // توليد الكفالة تلقائياً لكل عملية بيع جديدة
      try {
        const warranty = this.createWarrantyFromInvoice(invoice, {
          durationMonths: invoice.warrantyMonths,
          customerAddress: invoice.customerAddress
        });
        invoice.warrantyId = warranty.id;
        invoice.warrantyNumber = warranty.warrantyNumber;
      } catch (warErr) {
        console.error('Error auto-generating warranty for invoice:', warErr.message);
      }

      writeJson(INVOICES_FILE, invoices);
      syncInvoiceToSupabase(invoice);
    }

    return invoice;
  },

  async convertQuotationToSalesInvoice(invoiceId, employeeName = 'مسؤول المبيعات') {
    const invoices = this.getInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId || String(i.invoiceNumber) === String(invoiceId));
    if (idx === -1) {
      throw new Error('الفاتورة غير موجودة');
    }

    const inv = invoices[idx];
    if (!inv.isQuotation && inv.invoiceType !== 'quotation') {
      throw new Error('هذه الفاتورة معتمدة مسبقاً وليست للعرض فقط');
    }

    // 1. التحقق من الحفظ السحابي أولاً قبل أي خصم للمخزون أو الأرصدة
    inv.isQuotation = false;
    inv.invoiceType = 'sales';
    inv.convertedAt = new Date().toISOString();
    inv.convertedBy = employeeName;

    if (supabase) {
      const sbRes = await syncInvoiceToSupabase(inv);
      if (!sbRes || !sbRes.success) {
        throw new Error('تعذر اعتماد الفاتورة في قاعدة البيانات الدائمة (Supabase): ' + (sbRes?.error || 'خطأ غير معروف'));
      }
    }

    // 2. خصم المخزون
    await this.deductStockForInvoice(inv.items, employeeName || inv.employeeName);

    // 3. ربط الزبون وتحديث الرصيد إذا كان هناك متبقي
    if (inv.customerName && inv.customerName !== 'زبون نقدي') {
      const customers = this.getCustomers();
      const existing = customers.find(c =>
        (inv.customerId && c.id === inv.customerId) ||
        (inv.customerSystemNumber && c.systemNumber === inv.customerSystemNumber) ||
        (c.name && c.name.trim().toLowerCase() === inv.customerName.trim().toLowerCase())
      );
      const remainingToAdd = (inv.paymentMethod === 'installments' && inv.installmentDetails?.remainingAmount)
        ? inv.installmentDetails.remainingAmount
        : 0;

      if (existing) {
        inv.previousCustomerBalance = existing.balance || 0;
        if (remainingToAdd > 0) {
          this.adjustCustomerBalance(existing.id, remainingToAdd);
        }
        inv.customerId = existing.id;
        inv.customerSystemNumber = existing.systemNumber;
        inv.currentCustomerBalance = (existing.balance || 0) + remainingToAdd;
      } else {
        const newCust = this.saveCustomer({
          name: inv.customerName,
          phone: inv.customerPhone || '',
          address: inv.customerAddress || '',
          balance: remainingToAdd,
          notes: 'أضيف تلقائياً عند اعتماد فاتورة العرض #' + inv.invoiceNumber
        });
        inv.previousCustomerBalance = 0;
        inv.customerId = newCust.id;
        inv.customerSystemNumber = newCust.systemNumber;
        inv.currentCustomerBalance = remainingToAdd;
      }
    }

    // 4. توليد الكفالة تلقائياً
    const warranty = this.createWarrantyFromInvoice(inv, {
      durationMonths: inv.warrantyMonths || 12,
      customerAddress: inv.customerAddress || ''
    });
    inv.warrantyId = warranty.id;
    inv.warrantyNumber = warranty.warrantyNumber;

    writeJson(INVOICES_FILE, invoices);
    if (supabase) { syncInvoiceToSupabase(inv); }

    return { invoice: inv, warranty };
  },

  updateInvoiceTelegramStatus(id, sent, error = null) {
    const invoices = this.getInvoices();
    const index = invoices.findIndex(i => i.id === id);
    if (index !== -1) {
      invoices[index].telegramStatus = {
        sent: !!sent,
        sentAt: sent ? new Date().toISOString() : null,
        error: error || null
      };
      writeJson(INVOICES_FILE, invoices);
      syncInvoiceToSupabase(invoices[index]);
      return invoices[index];
    }
    return null;
  },

  // تحديث الكميات دفعةً واحدة (الجرد)
  updateInventoryBulk(updates, editorName) {
    const products = this.getProducts();
    const now = new Date().toISOString();
    let changedCount = 0;
    const modifiedProducts = [];
    const modifiedDetails = [];

    updates.forEach(({ id, stock }) => {
      const index = products.findIndex(p => p.id === id);
      if (index !== -1) {
        const newStock = parseInt(stock);
        if (!isNaN(newStock) && newStock !== products[index].stock) {
          const oldStock = products[index].stock || 0;
          products[index].stock = Math.max(0, newStock);
          products[index].lastStockUpdate = now;
          products[index].lastStockEditor = editorName || 'غير محدد';
          modifiedProducts.push(products[index]);
          modifiedDetails.push({
            id: products[index].id,
            code: products[index].code,
            name: products[index].name,
            oldStock,
            newStock: products[index].stock,
            diff: products[index].stock - oldStock
          });
          changedCount++;
        }
      }
    });

    writeJson(PRODUCTS_FILE, products);

    // مزامنة التحديثات مع Supabase
    if (modifiedProducts.length > 0) {
      modifiedProducts.forEach(p => syncProductToSupabase(p));
    }

    return { changedCount, modifiedDetails };
  },

  // سندات القبض
  getReceipts() {
    return readJson(RECEIPTS_FILE, []);
  },

  async createReceipt(data) {
    const receipts = this.getReceipts();
    const nextNumber = receipts.length > 0
      ? Math.max(...receipts.map(r => r.receiptNumber || 1)) + 1
      : 1001;

    const isSuppDeclared = Boolean(
      data.isSupplier ||
      data.accountType === 'supplier' ||
      (data.customerId && String(data.customerId).startsWith('supp-'))
    );

    let matchedSupplier = null;
    let matchedCustomer = null;

    const suppList = this.getSuppliers();
    const custNameNorm = String(data.customerName || '').trim().toLowerCase();
    const reqCustId = data.customerId ? String(data.customerId).trim() : '';
    const reqSysNum = data.customerSystemNumber ? String(data.customerSystemNumber).trim().toUpperCase() : '';

    if (isSuppDeclared || reqCustId.startsWith('supp-')) {
      matchedSupplier = suppList.find(s =>
        (reqCustId && s.id === reqCustId) ||
        (reqSysNum && String(s.shamelCode || '').trim().toUpperCase() === reqSysNum) ||
        (s.name && s.name.trim().toLowerCase() === custNameNorm)
      );
    } else {
      // فحص إذا كان يطابق مورداً بالاسم أو الكود أولاً لمنع إنشاء زبون مكرر
      matchedSupplier = suppList.find(s =>
        (reqCustId && s.id === reqCustId) ||
        (reqSysNum && String(s.shamelCode || '').trim().toUpperCase() === reqSysNum) ||
        (custNameNorm && custNameNorm !== 'زبون نقدي' && s.name && s.name.trim().toLowerCase() === custNameNorm)
      );
      if (!matchedSupplier && custNameNorm && custNameNorm !== 'زبون نقدي') {
        const custList = this.getCustomers();
        matchedCustomer = custList.find(c =>
          (reqCustId && c.id === reqCustId) ||
          (reqSysNum && String(c.systemNumber || c.shamelCode || '').trim().toUpperCase() === reqSysNum) ||
          (c.name && c.name.trim().toLowerCase() === custNameNorm)
        );
      }
    }

    const amt = parseFloat(data.amount) || 0;
    let prevBal = parseFloat(data.previousBalance) || 0;
    let remBal = parseFloat(data.remainingBalance) || 0;

    if (matchedSupplier) {
      prevBal = parseFloat(matchedSupplier.balance) || 0;
      remBal = parseFloat((prevBal - amt).toFixed(2));
    } else if (matchedCustomer) {
      prevBal = parseFloat(matchedCustomer.balance) || 0;
      remBal = parseFloat((prevBal - amt).toFixed(2));
    }

    const receipt = {
      id: 'RCP-' + nextNumber,
      receiptNumber: nextNumber,
      createdAt: new Date().toISOString(),
      employeeName: (data.employeeName || '').trim(),
      customerName: (data.customerName || (matchedSupplier ? matchedSupplier.name : '') || '').trim(),
      customerPhone: (data.customerPhone || (matchedSupplier ? (matchedSupplier.phone || matchedSupplier.mobile) : '') || '').trim(),
      customerId: matchedSupplier ? matchedSupplier.id : (matchedCustomer ? matchedCustomer.id : (data.customerId || null)),
      customerSystemNumber: matchedSupplier ? (matchedSupplier.shamelCode || '') : (matchedCustomer ? (matchedCustomer.systemNumber || '') : (data.customerSystemNumber || '')),
      isSupplier: Boolean(matchedSupplier),
      accountType: matchedSupplier ? 'supplier' : 'customer',
      previousBalance: prevBal,
      remainingBalance: remBal,
      amount: amt,
      description: (data.description || '').trim(),
      notes: (data.notes || '').trim(),
      paymentMethod: data.paymentMethod || 'cash'  // cash | transfer | check
    };

    // التحقق من الحفظ السحابي أولاً لمنع حفظ مالي غير مؤكد
    if (supabase) {
      const res = await syncReceiptToSupabase(receipt);
      if (!res || !res.success) {
        throw new Error('تعذر حفظ سند القبض في قاعدة البيانات الدائمة (Supabase): ' + (res?.error || 'خطأ غير معروف'));
      }
    }

    // ربط الحساب وتحديث رصيده بدقة (مورد أو زبون)
    if (matchedSupplier) {
      try {
        await this.adjustSupplierBalance(matchedSupplier.id, -receipt.amount);
      } catch (balErr) {
        if (supabase) { await deleteReceiptFromSupabase(receipt.id); }
        throw new Error('فشل تحديث رصيد المورد بعد إصدار السند: ' + balErr.message);
      }
    } else if (matchedCustomer) {
      try {
        await this.adjustCustomerBalance(matchedCustomer.id, -receipt.amount);
      } catch (balErr) {
        if (supabase) { await deleteReceiptFromSupabase(receipt.id); }
        throw new Error('فشل تحديث رصيد الزبون بعد إصدار السند، تم التراجع عن العملية: ' + balErr.message);
      }
    } else if (receipt.customerName && receipt.customerName !== 'زبون نقدي') {
      const newCust = await this.saveCustomer({
        name: receipt.customerName,
        phone: receipt.customerPhone || '',
        balance: 0,
        notes: 'أضيف تلقائياً عند إصدار سند قبض #' + receipt.receiptNumber
      });
      receipt.customerId = newCust.id;
      receipt.customerSystemNumber = newCust.systemNumber;
    }

    receipts.unshift(receipt);
    writeJson(RECEIPTS_FILE, receipts);
    if (supabase) { supabase.from('settings').upsert({ id: 'receipts', data: receipts }).catch(() => {}); }
    return receipt;
  },

  async deleteReceipt(id) {
    const receipts = this.getReceipts();
    const toDelete = receipts.find(r => r.id === id);
    if (!toDelete) return false;

    // إذا كان Supabase متصلاً، نتأكد أولاً من نجاح الحذف السحابي قبل التعديل المحلي
    if (supabase) {
      const res = await deleteReceiptFromSupabase(id);
      if (!res.success) {
        throw new Error(`فشل حذف سند القبض من قاعدة البيانات السحابية: ${res.error}`);
      }
    }

    const filtered = receipts.filter(r => r.id !== id);
    writeJson(RECEIPTS_FILE, filtered);

    // إعادة عكس رصيد الزبون أو المورد بحذر
    if (toDelete && toDelete.customerId && toDelete.amount && toDelete.customerName !== 'زبون نقدي') {
      try {
        if (toDelete.isSupplier || toDelete.accountType === 'supplier' || String(toDelete.customerId).startsWith('supp-')) {
          await this.adjustSupplierBalance(toDelete.customerId, parseFloat(toDelete.amount) || 0);
        } else {
          await this.adjustCustomerBalance(toDelete.customerId, parseFloat(toDelete.amount) || 0);
        }
      } catch (_) {}
    }

    return true;
  },

  // -----------------------------------------------------------
  // الكفالات والضمان (Warranties & Serial Tracking)
  // -----------------------------------------------------------
  getWarranties() {
    return readJson(WARRANTIES_FILE, []);
  },

  getWarrantyById(id) {
    const warranties = this.getWarranties();
    return warranties.find(w => w.id === id || String(w.warrantyNumber) === String(id));
  },

  getWarrantiesByInvoiceId(invoiceId) {
    const warranties = this.getWarranties();
    return warranties.filter(w => w.invoiceId === invoiceId);
  },

  createWarrantyFromInvoice(invoice, opts) {
    if (!opts) opts = {};
    const warranties = this.getWarranties();
    const durationMonths = parseInt(opts.durationMonths) || 12;
    const nextNum = warranties.length > 0
      ? Math.max(...warranties.map(w => w.warrantyNumber || 5000)) + 1
      : 5001;

    const purchaseDate = invoice.createdAt || new Date().toISOString();
    const expiryDate = calculateExpiryDate(purchaseDate, durationMonths);
    const settings = this.getSettings();

    let durationText = durationMonths + ' شهراً';
    if (durationMonths === 12) durationText = 'سنة واحدة (12 شهراً)';
    else if (durationMonths === 24) durationText = 'سنتان (24 شهراً)';
    else if (durationMonths === 6) durationText = 'ستة أشهر';
    else if (durationMonths === 3) durationText = 'ثلاثة أشهر';

    const warranty = {
      id: 'WAR-' + nextNum,
      warrantyNumber: nextNum,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      createdAt: new Date().toISOString(),
      purchaseDate,
      durationMonths,
      durationText,
      expiryDate,
      customerName: invoice.customerName || '',
      customerId: invoice.customerId || null,
      customerSystemNumber: invoice.customerSystemNumber || '',
      customerPhone: invoice.customerPhone || '',
      customerAddress: (opts.customerAddress || invoice.customerAddress || ''),
      items: (invoice.items || []).map(function(item) {
        return {
          productId: item.productId || '',
          productName: item.productName || '',
          brand: item.brand || item.brandAr || '',
          code: item.code || '',
          quantity: item.quantity || 1,
          serialNumber: item.serialNumber || '',
          notes: item.warrantyNote || ''
        };
      }),
      terms: [
        'الرجاء قراءة الكفالة وكتيب التعليمات قبل الاستخدام.',
        'الكفالة لا تشمل الكسر وسوء الاستخدام للمنتج.',
        'هذا الضمان لا يغطي الفساد الذي يتسبب به المنتج من خلال النقل او التركيب والتشغيل بطريقة غير مطابقة لدليل الاستعمال.',
        'يلغى الضمان في حال تم تدخل اي مصلح خارجي بالمنتج وليس من طرف شركة ابو رامز للاجهزة الكهربائية.',
        'هذا المنتج مضمون من كل عيب مصنعي.',
        'الاصلاحات التي تتم في اطار مدة الكفالة تكون مجانا.',
        'القطع واليد العاملة بدون مقابل.'
      ],
      status: 'active',
      companyName: settings.companyName || 'شركة أبو رامز للأجهزة الكهربائية',
      companyPhone: settings.companyPhone || '059-1234567',
      companyAddress: settings.companyAddress || '',
      notes: ''
    };

    warranties.unshift(warranty);
    writeJson(WARRANTIES_FILE, warranties);
    syncWarrantyToSupabase(warranty);
    return warranty;
  },

  createManualWarranty(data) {
    const warranties = this.getWarranties();
    const durationMonths = parseInt(data.durationMonths) || 12;
    const nextNum = warranties.length > 0
      ? Math.max(...warranties.map(w => w.warrantyNumber || 5000)) + 1
      : 5001;

    const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate).toISOString() : new Date().toISOString();
    const expiryDate = calculateExpiryDate(purchaseDate, durationMonths);
    const settings = this.getSettings();

    let durationText = durationMonths + ' شهراً';
    if (durationMonths === 12) durationText = 'سنة واحدة (12 شهراً)';
    else if (durationMonths === 24) durationText = 'سنتان (24 شهراً)';
    else if (durationMonths === 36) durationText = '3 سنوات (36 شهراً)';
    else if (durationMonths === 6) durationText = 'ستة أشهر';
    else if (durationMonths === 3) durationText = 'ثلاثة أشهر';

    const warranty = {
      id: 'WAR-' + nextNum,
      warrantyNumber: nextNum,
      invoiceId: null,
      invoiceNumber: null,
      createdAt: new Date().toISOString(),
      purchaseDate,
      durationMonths,
      durationText,
      expiryDate,
      customerName: (data.customerName || '').trim(),
      customerId: data.customerId || null,
      customerSystemNumber: data.customerSystemNumber || '',
      customerPhone: (data.customerPhone || '').trim(),
      customerAddress: (data.customerAddress || '').trim(),
      items: (data.items || []).map(function(item) {
        return {
          productId: item.productId || '',
          productName: item.productName || '',
          brand: item.brand || '',
          code: item.code || '',
          quantity: parseInt(item.quantity) || 1,
          serialNumber: item.serialNumber || '',
          notes: item.notes || ''
        };
      }),
      terms: [
        'الرجاء قراءة الكفالة وكتيب التعليمات قبل الاستخدام.',
        'الكفالة لا تشمل الكسر وسوء الاستخدام للمنتج.',
        'هذا الضمان لا يغطي الفساد الذي يتسبب به المنتج من خلال النقل او التركيب والتشغيل بطريقة غير مطابقة لدليل الاستعمال.',
        'يلغى الضمان في حال تم تدخل اي مصلح خارجي بالمنتج وليس من طرف شركة ابو رامز للاجهزة الكهربائية.',
        'هذا المنتج مضمون من كل عيب مصنعي.',
        'الاصلاحات التي تتم في اطار مدة الكفالة تكون مجانا.',
        'القطع واليد العاملة بدون مقابل.'
      ],
      status: 'active',
      companyName: settings.companyName || 'شركة أبو رامز للأجهزة الكهربائية',
      companyPhone: settings.companyPhone || '059-1234567',
      companyAddress: settings.companyAddress || '',
      notes: (data.notes || '').trim(),
      manual: true
    };

    warranties.unshift(warranty);
    writeJson(WARRANTIES_FILE, warranties);
    syncWarrantyToSupabase(warranty);
    return warranty;
  },

  updateWarranty(id, updates) {
    const warranties = this.getWarranties();
    const idx = warranties.findIndex(w => w.id === id || String(w.warrantyNumber) === String(id));
    if (idx === -1) return null;

    if (updates.purchaseDate) {
      warranties[idx].purchaseDate = new Date(updates.purchaseDate).toISOString();
    }

    if (updates.durationMonths !== undefined) {
      const months = parseInt(updates.durationMonths) || 12;
      warranties[idx].durationMonths = months;
      let durationText = months + ' شهراً';
      if (months === 12) durationText = 'سنة واحدة (12 شهراً)';
      else if (months === 24) durationText = 'سنتان (24 شهراً)';
      else if (months === 36) durationText = '3 سنوات (36 شهراً)';
      else if (months === 6) durationText = 'ستة أشهر';
      else if (months === 3) durationText = 'ثلاثة أشهر';
      warranties[idx].durationText = durationText;
      warranties[idx].expiryDate = calculateExpiryDate(warranties[idx].purchaseDate, months);
    }

    const allowed = ['customerName', 'customerAddress', 'customerPhone', 'notes', 'status', 'durationText'];
    allowed.forEach(function(k) {
      if (updates[k] !== undefined) warranties[idx][k] = updates[k];
    });

    if (Array.isArray(updates.items)) {
      updates.items.forEach(function(upd, i) {
        if (warranties[idx].items[i]) {
          if (upd.serialNumber !== undefined) warranties[idx].items[i].serialNumber = upd.serialNumber;
          if (upd.notes !== undefined) warranties[idx].items[i].notes = upd.notes;
          if (upd.productName !== undefined) warranties[idx].items[i].productName = upd.productName;
          if (upd.brand !== undefined) warranties[idx].items[i].brand = upd.brand;
        }
      });
    }

    warranties[idx].updatedAt = new Date().toISOString();
    writeJson(WARRANTIES_FILE, warranties);
    syncWarrantyToSupabase(warranties[idx]);
    return warranties[idx];
  },

  async deleteWarranty(id) {
    const warranties = this.getWarranties();
    const toDelete = warranties.find(w => w.id === id);
    if (!toDelete) return false;
    if (supabase) {
      const res = await deleteWarrantyFromSupabase(id);
      if (!res.success) {
        throw new Error('تعذر حذف الكفالة من قاعدة البيانات الدائمة (Supabase): ' + res.error);
      }
    }
    const filtered = warranties.filter(w => w.id !== id);
    writeJson(WARRANTIES_FILE, filtered);
    return true;
  },

  checkWarrantyStatuses() {
    const warranties = this.getWarranties();
    const now = new Date();
    let changed = false;
    warranties.forEach(function(w) {
      if (w.status === 'active' && new Date(w.expiryDate) < now) {
        w.status = 'expired';
        changed = true;
      }
    });
    if (changed) writeJson(WARRANTIES_FILE, warranties);
  },

  // -------------------------------------------------------------
  // دليل وأرصدة ديون الزبائن (Customers & Outstanding Balances)
  // -------------------------------------------------------------

  getCustomers() {
    const list = readJson(CUSTOMERS_FILE, []);
    return list.map(function(c) {
      var rawBal = typeof c.balance === 'number' ? c.balance : (parseFloat(String(c.balance || '0').replace(/,/g, '')) || 0);
      var shamelBal = c.shamelBalance !== undefined
        ? (typeof c.shamelBalance === 'number' ? c.shamelBalance : (parseFloat(String(c.shamelBalance || '0').replace(/,/g, '')) || 0))
        : rawBal;
      return Object.assign({}, c, { shamelBalance: shamelBal, balance: shamelBal });
    });
  },

  async saveCustomer(custData) {
    const customers = this.getCustomers();
    let customer = null;

    if (custData.id) {
      const idx = customers.findIndex(c => c.id === custData.id);
      if (idx !== -1) {
        customer = {
          ...customers[idx],
          systemNumber: String(custData.systemNumber || customers[idx].systemNumber || '').trim(),
          name: String(custData.name || customers[idx].name).trim(),
          phone: String(custData.phone || customers[idx].phone || '').trim(),
          balance: parseFloat(custData.balance !== undefined ? custData.balance : customers[idx].balance) || 0,
          notes: String(custData.notes !== undefined ? custData.notes : (customers[idx].notes || '')).trim(),
          updatedAt: new Date().toISOString()
        };
        customers[idx] = customer;
      }
    }

    if (!customer) {
      customer = {
        id: custData.id || 'cust-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        systemNumber: String(custData.systemNumber || '').trim(),
        name: String(custData.name || '').trim(),
        phone: String(custData.phone || '').trim(),
        balance: parseFloat(custData.balance) || 0,
        notes: String(custData.notes || '').trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      customers.push(customer);
    }

    if (supabase) {
      const res = await syncCustomerToSupabase(customer);
      if (!res.success) {
        throw new Error('تعذر حفظ بيانات العميل في قاعدة البيانات الدائمة (Supabase): ' + res.error);
      }
    }
    writeJson(CUSTOMERS_FILE, customers);
    return customer;
  },

  async deleteCustomer(id) {
    const customers = this.getCustomers();
    const strId = String(id || '').trim();
    const toDelete = customers.find(c => {
      const matchId = String(c.id || '').trim() === strId;
      const matchSys = c.systemNumber && String(c.systemNumber).trim() === strId;
      return matchId || matchSys;
    });
    if (!toDelete) return false;
    if (supabase) {
      const res = await deleteCustomerFromSupabase(toDelete.id);
      if (!res.success) {
        throw new Error('تعذر حذف العميل من قاعدة البيانات الدائمة (Supabase): ' + res.error);
      }
    }
    const filtered = customers.filter(c => c.id !== toDelete.id);
    writeJson(CUSTOMERS_FILE, filtered);
    return true;
  },

  // تعديل رصيد زبون (مثلاً عند سداد سند قبض أو إضافة دين جديد)
  async adjustCustomerBalance(idOrSysNumOrName, deltaAmount) {
    const customers = this.getCustomers();
    const query = String(idOrSysNumOrName).trim().toLowerCase();
    const idx = customers.findIndex(c =>
      c.id === idOrSysNumOrName ||
      (c.systemNumber && String(c.systemNumber).trim() === query) ||
      (c.name && c.name.trim().toLowerCase() === query)
    );

    if (idx !== -1) {
      const current = parseFloat(customers[idx].balance) || 0;
      const delta = parseFloat(deltaAmount) || 0;
      const updated = parseFloat((current + delta).toFixed(2));
      const now = new Date().toISOString();
      const hasDiff = Math.abs(current - updated) > 0.01;

      let balanceHistory = Array.isArray(customers[idx].balanceHistory) ? [...customers[idx].balanceHistory] : [];
      if (hasDiff) {
        balanceHistory.unshift({
          date: now,
          oldBalance: current,
          newBalance: updated,
          difference: delta,
          source: 'balance_adjustment'
        });
        if (balanceHistory.length > 50) balanceHistory = balanceHistory.slice(0, 50);
      }

      const updatedCustomer = {
        ...customers[idx],
        balance: updated,
        shamelBalance: updated,
        lastBalanceDiffDate: hasDiff ? now : (customers[idx].lastBalanceDiffDate || null),
        lastBalanceChangeDate: hasDiff ? now : (customers[idx].lastBalanceChangeDate || null),
        previousBalance: hasDiff ? current : (customers[idx].previousBalance !== undefined ? customers[idx].previousBalance : current),
        balanceDifference: hasDiff ? delta : (customers[idx].balanceDifference || 0),
        balanceHistory,
        updatedAt: now
      };

      customers[idx] = updatedCustomer;
      writeJson(CUSTOMERS_FILE, customers);

      if (supabase) {
        try {
          await syncCustomerToSupabase(updatedCustomer);
          await supabase.from('settings').upsert({ id: 'customers', data: customers });
        } catch (sbErr) {
          console.warn('adjustCustomerBalance supabase warn:', sbErr.message);
        }
      }
      return customers[idx];
    }
    return null;
  },

  // تعديل رصيد مورد (مثلاً عند إصدار سند صرف أو تسديد دفعة)
  async adjustSupplierBalance(idOrCodeOrName, deltaAmount) {
    const suppliers = readJson(SUPPLIERS_FILE, []);
    const query = String(idOrCodeOrName).trim().toLowerCase();
    const idx = suppliers.findIndex(s =>
      s.id === idOrCodeOrName ||
      (s.shamelCode && String(s.shamelCode).trim().toLowerCase() === query) ||
      (s.name && s.name.trim().toLowerCase() === query)
    );

    if (idx !== -1) {
      const current = parseFloat(suppliers[idx].balance) || 0;
      const updated = current + parseFloat(deltaAmount);
      const updatedSupplier = {
        ...suppliers[idx],
        balance: parseFloat(updated.toFixed(2)),
        shamelBalance: parseFloat(updated.toFixed(2)),
        updatedAt: new Date().toISOString()
      };
      if (supabase) {
        try {
          await syncSupplierToSupabase(updatedSupplier);
          const allSupps = [...suppliers];
          allSupps[idx] = updatedSupplier;
          await supabase.from('settings').upsert({ id: 'suppliers', data: allSupps });
        } catch (sbErr) {
          console.warn('adjustSupplierBalance supabase warn:', sbErr.message);
        }
      }
      suppliers[idx] = updatedSupplier;
      writeJson(SUPPLIERS_FILE, suppliers);
      return suppliers[idx];
    }
    return null;
  },

  // استيراد جماعي للأرصدة من CSV أو مصفوفة
  importCustomersBulk(importedList) {
    if (!Array.isArray(importedList) || importedList.length === 0) return { imported: 0, updated: 0 };
    const customers = this.getCustomers();
    let imported = 0;
    let updated = 0;
    const now = new Date().toISOString();
    const touched = [];

    importedList.forEach(item => {
      const name = String(item.name || item['اسم الزبون'] || item['الاسم'] || item['اسم الحساب'] || '').trim();
      if (!name) return;

      const sysNum = String(item.systemNumber || item.accountNo || item['رقم الزبون'] || item['رقم الحساب'] || item['رقم النظام'] || item['الرقم'] || '').trim();
      const rawBalance = item.balance !== undefined ? item.balance : (item['الرصيد'] || item['رصيد'] || item['الرصيد النهائي'] || item['المبلغ'] || 0);
      const cleanBalanceStr = String(rawBalance).replace(/,/g, '').replace(/[\sشيكل$]/g, '').trim();
      const balance = parseFloat(cleanBalanceStr) || 0;
      const phone = String(item.phone || item['الهاتف'] || item['الجوال'] || item['رقم الهاتف'] || '').trim();
      const notes = String(item.notes || item['ملاحظات'] || '').trim();

      // البحث إن كان الزبون موجوداً مسبقاً بالرقم أو الاسم
      const existingIdx = customers.findIndex(c =>
        (sysNum && c.systemNumber && c.systemNumber === sysNum) ||
        (c.name.toLowerCase() === name.toLowerCase())
      );

      if (existingIdx !== -1) {
        customers[existingIdx].systemNumber = sysNum || customers[existingIdx].systemNumber;
        customers[existingIdx].name = name;
        customers[existingIdx].balance = balance;
        if (phone) customers[existingIdx].phone = phone;
        if (notes) customers[existingIdx].notes = notes;
        customers[existingIdx].updatedAt = now;
        touched.push(customers[existingIdx]);
        updated++;
      } else {
        const newC = {
          id: 'cust-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
          systemNumber: sysNum,
          name,
          phone,
          balance,
          notes,
          createdAt: now,
          updatedAt: now
        };
        customers.push(newC);
        touched.push(newC);
        imported++;
      }
    });

    writeJson(CUSTOMERS_FILE, customers);
    if (supabase && touched.length > 0) {
      touched.forEach(c => syncCustomerToSupabase(c));
    }
    return { imported, updated, total: customers.length };
  },

  // كشف حساب تفصيلي للزبون أو المورد يجمع الفواتير وسندات القبض وحركة الرصيد
  getCustomerStatement(id, options) {
    options = options || {};
    const fromDateStr = options.fromDate ? String(options.fromDate).substring(0, 10) : null;
    const toDateStr = options.toDate ? String(options.toDate).substring(0, 10) : null;
    const sortOrder = options.sortOrder || 'desc';
    const filterType = options.filterType || 'all';
    const customers = this.getCustomers();
    const strId = String(id || '').trim();
    let customer = customers.find(c =>
      String(c.id).trim() === strId ||
      String(c.systemNumber || '').trim() === strId ||
      (c.shamelCode && String(c.shamelCode).trim() === strId) ||
      c.name.trim().toLowerCase() === strId.toLowerCase()
    );

    let isSupplier = false;
    if (!customer) {
      const suppliers = this.getSuppliers();
      const supp = suppliers.find(s =>
        String(s.id).trim() === strId ||
        String(s.shamelCode || '').trim() === strId ||
        s.name.trim().toLowerCase() === strId.toLowerCase()
      );
      if (supp) {
        customer = {
          ...supp,
          systemNumber: supp.shamelCode || supp.id,
          isSupplier: true,
          accountType: 'supplier'
        };
        isSupplier = true;
      }
    } else {
      isSupplier = Boolean(customer.isSupplier || customer.accountType === 'supplier');
    }

    if (!customer) return null;

    const invoices = this.getInvoices();
    const receipts = this.getReceipts();

    const custCodes = new Set([
      String(customer.id || '').trim().toUpperCase(),
      String(customer.systemNumber || '').trim().toUpperCase(),
      String(customer.shamelCode || '').trim().toUpperCase()
    ].filter(Boolean));
    const custName = customer.name.trim().toLowerCase();

    // مطابقة كافة فواتير الزبون أو المورد
    const custInvoices = invoices.filter(inv => {
      if (inv.customerId && custCodes.has(String(inv.customerId).trim().toUpperCase())) return true;
      if (inv.customerSystemNumber && custCodes.has(String(inv.customerSystemNumber).trim().toUpperCase())) return true;
      if (inv.partyCode && custCodes.has(String(inv.partyCode).trim().toUpperCase())) return true;
      if (inv.supplierShamelCode && custCodes.has(String(inv.supplierShamelCode).trim().toUpperCase())) return true;
      if (inv.customerName && inv.customerName.trim().toLowerCase() === custName) return true;
      if (inv.partyName && inv.partyName.trim().toLowerCase() === custName) return true;
      if (inv.supplierName && inv.supplierName.trim().toLowerCase() === custName) return true;
      return false;
    });

    // مطابقة كافة سندات القبض والصرف
    const custReceipts = receipts.filter(rcp => {
      if (rcp.customerId && custCodes.has(String(rcp.customerId).trim().toUpperCase())) return true;
      if (rcp.customerSystemNumber && custCodes.has(String(rcp.customerSystemNumber).trim().toUpperCase())) return true;
      if (rcp.partyCode && custCodes.has(String(rcp.partyCode).trim().toUpperCase())) return true;
      if (rcp.supplierShamelCode && custCodes.has(String(rcp.supplierShamelCode).trim().toUpperCase())) return true;
      if (rcp.customerName && rcp.customerName.trim().toLowerCase() === custName) return true;
      if (rcp.partyName && rcp.partyName.trim().toLowerCase() === custName) return true;
      return false;
    });

    // بناء قائمة الحركات المدمجة
    const movements = [];

    custInvoices.forEach(inv => {
      const isPurchase = inv.invoiceType === 'purchase' || inv.typeCode === 'H';
      const isSalesReturn = inv.invoiceType === 'sales_return' || inv.typeCode === 'S';
      const isPurchaseReturn = inv.invoiceType === 'purchase_return' || inv.typeCode === 'M';
      const isSales = !isPurchase && !isSalesReturn && !isPurchaseReturn;
      const amount = Number(inv.summary?.totalAmount ?? inv.totalAmount) || 0;

      let type = 'sales_invoice';
      let typeTitle = 'فاتورة مبيعات';
      let debit = 0;
      let credit = 0;

      if (!isSupplier) {
        // حساب زبون: المبيعات تزيد الدين، والمردودات تنقصه
        if (isSales) {
          type = 'sales_invoice';
          typeTitle = 'فاتورة مبيعات';
          debit = amount;
        } else if (isSalesReturn) {
          type = 'sales_return';
          typeTitle = 'مردودات مبيعات';
          credit = amount;
        } else if (isPurchase) {
          type = 'purchase_invoice';
          typeTitle = 'فاتورة مشتريات';
          credit = amount;
        }
      } else {
        // حساب مورد: المشتريات تزيد حقه (دائن)، والمردودات تنقصه (مدين)
        if (isPurchase) {
          type = 'purchase_invoice';
          typeTitle = 'فاتورة مشتريات (توريد)';
          credit = amount;
        } else if (isPurchaseReturn) {
          type = 'purchase_return';
          typeTitle = 'مردودات مشتريات';
          debit = amount;
        } else if (isSales) {
          type = 'sales_invoice';
          typeTitle = 'فاتورة مبيعات';
          debit = amount;
        }
      }

      movements.push({
        type,
        typeTitle,
        title: `${typeTitle} #${inv.invoiceNumber || inv.id}`,
        id: inv.id,
        refNumber: inv.invoiceNumber || inv.id,
        number: inv.invoiceNumber || inv.id,
        date: inv.createdAt,
        employeeName: inv.employeeName || 'الشامل لايت',
        paymentMethod: inv.paymentMethod || 'cash',
        debit,
        credit,
        amount,
        notes: inv.notes || '',
        itemsCount: (inv.items || []).length,
        items: inv.items || [],
        summary: inv.summary || null,
        totalProfit: inv.summary?.totalProfit || 0
      });
    });

    custReceipts.forEach(vch => {
      const isPayment = vch.voucherType === 'payment' || vch.typeCode === 'P';
      const amount = Number(vch.amount) || 0;

      let type = isPayment ? 'payment' : 'receipt';
      let typeTitle = isPayment ? 'سند صرف مالي' : 'سند قبض مالي';
      let debit = 0;
      let credit = 0;

      if (!isSupplier) {
        // زبون: سند القبض يسدد الدين (دائن)، وسند الصرف يزيد الدين (مدين)
        if (!isPayment) {
          credit = amount;
        } else {
          debit = amount;
        }
      } else {
        // مورد: سند الصرف يسدد حقه (مدين)، وسند القبض يزيد حقه (دائن)
        if (isPayment) {
          debit = amount;
        } else {
          credit = amount;
        }
      }

      movements.push({
        type,
        typeTitle,
        title: `${typeTitle} #${vch.voucherNumber || vch.receiptNumber || vch.id}`,
        id: vch.id,
        refNumber: vch.voucherNumber || vch.receiptNumber || vch.id,
        number: vch.voucherNumber || vch.receiptNumber || vch.id,
        date: vch.createdAt,
        employeeName: vch.employeeName || 'الشامل لايت',
        paymentMethod: vch.paymentMethod || 'cash',
        debit,
        credit,
        amount,
        notes: vch.description ? `${vch.description} ${vch.notes ? `(${vch.notes})` : ''}` : (vch.notes || ''),
        itemsCount: 0
      });
    });

    // ترتيب الحركات تصاعدياً حسب التاريخ لاحتساب الرصيد التراكمي بدقة
    movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // احتساب الرصيد التراكمي بدقة بعد كل حركة
    let running = 0;
    movements.forEach(m => {
      running += (m.debit - m.credit);
      m.balanceAfter = Math.round(running * 100) / 100;
    });

    // دالة استخراج التاريخ YYYY-MM-DD بدقة ومناعة ضد فروق المناطق الزمنية
    const toDateYmd = (val) => {
      if (!val) return '';
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        return val.substring(0, 10);
      }
      try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      } catch (_) {
        return '';
      }
    };

    // تطبيق فلتر الفترة الزمنية بدقة تامة (بعد احتساب الرصيد التراكمي حتى لا يتأثر)
    let filteredMovements = movements.filter(m => {
      const mDateStr = toDateYmd(m.date);
      if (fromDateStr && mDateStr && mDateStr < fromDateStr) return false;
      if (toDateStr && mDateStr && mDateStr > toDateStr) return false;
      return true;
    });

    // تطبيق فلتر نوع الحركة
    if (filterType !== 'all') {
      filteredMovements = filteredMovements.filter(m => {
        if (filterType === 'invoices') return m.type.includes('invoice') || m.type.includes('return');
        if (filterType === 'vouchers') return m.type === 'receipt' || m.type === 'payment';
        if (filterType === 'receipts') return m.type === 'receipt';
        if (filterType === 'payments') return m.type === 'payment';
        return true;
      });
    }

    // ترتيب الحركات المفلترة حسب خيار المستخدم (الأحدث أولاً افتراضياً)
    if (sortOrder === 'asc') {
      filteredMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      filteredMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const totalSales = movements.filter(m => m.type === 'sales_invoice').reduce((s, m) => s + m.amount, 0);
    const totalPaid = movements.filter(m => m.type === 'receipt').reduce((s, m) => s + m.amount, 0);
    const totalPayments = movements.filter(m => m.type === 'payment').reduce((s, m) => s + m.amount, 0);
    const totalReturns = movements.filter(m => m.type.includes('return')).reduce((s, m) => s + m.amount, 0);
    const lastReceipt = [...movements].reverse().find(m => m.type === 'receipt');
    const lastInvoice = [...movements].reverse().find(m => m.type.includes('invoice'));

    const balance = parseFloat(customer.balance) || Math.round(running * 100) / 100;

    const summary = {
      totalSales,
      totalPaid,
      totalInvoiced: totalSales,
      totalPayments,
      totalReturns,
      invoicesCount: custInvoices.length,
      receiptsCount: custReceipts.filter(r => r.voucherType !== 'payment' && r.typeCode !== 'P').length,
      paymentsCount: custReceipts.filter(r => r.voucherType === 'payment' || r.typeCode === 'P').length,
      transactionsCount: movements.length,
      isDebtor: balance > 0,
      isCreditor: balance < 0,
      isSettled: balance === 0,
      lastReceiptDate: lastReceipt ? lastReceipt.date : null,
      lastReceiptAmount: lastReceipt ? lastReceipt.amount : 0,
      lastInvoiceDate: lastInvoice ? lastInvoice.date : null,
      lastInvoiceAmount: lastInvoice ? lastInvoice.amount : 0
    };

    // إحصائيات خاصة بالفترة المفلترة المحددة
    const periodDebit = filteredMovements.reduce((s, m) => s + (m.debit || 0), 0);
    const periodCredit = filteredMovements.reduce((s, m) => s + (m.credit || 0), 0);
    const periodSales = filteredMovements.filter(m => m.type === 'sales_invoice').reduce((s, m) => s + m.amount, 0);
    const periodPaid = filteredMovements.filter(m => m.type === 'receipt').reduce((s, m) => s + m.amount, 0);
    const periodPayments = filteredMovements.filter(m => m.type === 'payment').reduce((s, m) => s + m.amount, 0);
    const periodReturns = filteredMovements.filter(m => m.type.includes('return')).reduce((s, m) => s + m.amount, 0);
    const periodInvoicesCount = filteredMovements.filter(m => m.type.includes('invoice') || m.type.includes('return')).length;
    const periodVouchersCount = filteredMovements.filter(m => m.type === 'receipt' || m.type === 'payment').length;

    const periodSummary = {
      periodDebit: Math.round(periodDebit * 100) / 100,
      periodCredit: Math.round(periodCredit * 100) / 100,
      periodNetChange: Math.round((periodDebit - periodCredit) * 100) / 100,
      periodSales: Math.round(periodSales * 100) / 100,
      periodPaid: Math.round(periodPaid * 100) / 100,
      periodPayments: Math.round(periodPayments * 100) / 100,
      periodReturns: Math.round(periodReturns * 100) / 100,
      periodInvoicesCount,
      periodVouchersCount,
      totalMovements: filteredMovements.length
    };

    return {
      customer,
      balance,
      summary,
      periodSummary,
      movements: filteredMovements,
      allMovementsCount: movements.length,
      filteredCount: filteredMovements.length,
      appliedFilters: { fromDate: fromDateStr, toDate: toDateStr, sortOrder, filterType },
      transactions: filteredMovements,
      invoices: custInvoices,
      receipts: custReceipts
    };
  },


  // الإعدادات
  getSettings() {
    const s = readJson(SETTINGS_FILE, defaultSettings);
    return {
      ...defaultSettings,
      ...s,
      securityUsers: (s && Array.isArray(s.securityUsers) && s.securityUsers.length > 0) ? s.securityUsers : defaultSettings.securityUsers
    };
  },

  saveSettings(newSettings) {
    const current = this.getSettings();
    const updated = {
      ...current,
      ...newSettings
    };
    writeJson(SETTINGS_FILE, updated);
    syncSettingsToSupabase(updated);
    notifyStoreServers();
    return updated;
  },

  // -----------------------------------------------------------
  // نظام النسخ الاحتياطي وحماية البيانات
  // -----------------------------------------------------------
  createBackup(label = 'manual') {
    const products = this.getProducts();
    const invoices = this.getInvoices();
    const customers = this.getCustomers();
    const receipts = this.getReceipts();
    const settings = this.getSettings();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `backup_${dateStr}_${label}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);

    const payload = {
      system: 'شركة أبو رامز - نظام المبيعات والفواتير',
      version: '1.0',
      label,
      createdAt: now.toISOString(),
      counts: {
        products: products.length,
        invoices: invoices.length,
        customers: customers.length,
        receipts: receipts.length
      },
      data: {
        settings,
        products,
        invoices,
        customers,
        receipts
      }
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    fs.writeFileSync(filePath, jsonStr, 'utf-8');

    // تدوير وحفظ آخر 30 نسخة احتياطية فقط لمنع امتلاء القرص
    try {
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 30) {
        files.slice(30).forEach(oldF => {
          try { fs.unlinkSync(path.join(BACKUPS_DIR, oldF.name)); } catch (e) {}
        });
      }
    } catch (e) {
      console.warn('Backup cleanup warning:', e.message);
    }

    return {
      filename,
      filePath,
      sizeBytes: Buffer.byteLength(jsonStr),
      createdAt: now.toISOString(),
      counts: payload.counts
    };
  },

  getBackupList() {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(filename => {
        const fullPath = path.join(BACKUPS_DIR, filename);
        const stats = fs.statSync(fullPath);
        return {
          filename,
          sizeBytes: stats.size,
          sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
          createdAt: stats.mtime.toISOString(),
          isAuto: filename.includes('auto')
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return files;
  },

  getBackupFilePath(filename) {
    const safeName = path.basename(filename);
    const fullPath = path.join(BACKUPS_DIR, safeName);
    if (fs.existsSync(fullPath)) return fullPath;
    return null;
  },

  restoreBackup(backupPayload) {
    if (!backupPayload || !backupPayload.data) {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف');
    }

    const { products, invoices, customers, receipts, settings } = backupPayload.data;

    // 1. أخذ نسخة أمان احترازية فورية قبل تطبيق الاستعادة
    this.createBackup('pre_restore_safety');

    // 2. تطبيق استعادة البيانات بأمان
    if (Array.isArray(products)) {
      writeJson(PRODUCTS_FILE, products);
    }
    if (Array.isArray(invoices)) {
      writeJson(INVOICES_FILE, invoices);
    }
    if (Array.isArray(customers)) {
      writeJson(CUSTOMERS_FILE, customers);
    }
    if (Array.isArray(receipts)) {
      writeJson(RECEIPTS_FILE, receipts);
    }
    if (settings && typeof settings === 'object') {
      writeJson(SETTINGS_FILE, settings);
    }

    return {
      success: true,
      restoredAt: new Date().toISOString(),
      counts: {
        products: Array.isArray(products) ? products.length : 0,
        invoices: Array.isArray(invoices) ? invoices.length : 0,
        customers: Array.isArray(customers) ? customers.length : 0,
        receipts: Array.isArray(receipts) ? receipts.length : 0
      }
    };
  },

  // جلب معلومات آخر مزامنة
  getLastSyncMeta() {
    const syncMetaFile = path.join(DATA_DIR, 'sync_meta.json');
    return readJson(syncMetaFile, { lastSyncAt: null, itemsCount: 0 });
  },

  // مزامنة دفعة أصناف من برنامج الشامل لايت
  async syncBatchProducts(items, options = {}) {
    const {
      mode = 'full',        // 'full', 'prices_only', 'stock_only'
      dryRun = false,       // وضع التجربة (بدون حفظ فعلي)
      editorName = 'مزامنة الشامل لايت'
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        error: 'دفعة الأصناف فارغة أو غير صالحة',
        summary: { totalReceived: 0, created: 0, updated: 0, unchanged: 0, suspended: 0, errors: [] }
      };
    }

    const products = this.getProducts();
    const now = new Date().toISOString();

    // إنشاء خريطة سريعة للأصناف الحالية بالكود (Case-insensitive) بربط مرجعي مباشر للكائن (تمنع أي خطأ إزاحة بالمصفوفة)
    const productMap = new Map();
    products.forEach((p) => {
      if (p.code) {
        productMap.set(String(p.code).trim().toUpperCase(), p);
      }
    });

    const summary = {
      totalReceived: items.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      suspended: 0,
      errors: [],
      details: []
    };

    const updatedOrNewProducts = [];

    for (const item of items) {
      try {
        if (!item || !item.code || !item.name) {
          summary.errors.push(`صنف غير مكتمل: ${JSON.stringify(item)}`);
          continue;
        }

        const cleanCode = String(item.code).trim();
        const codeKey = cleanCode.toUpperCase();
        const existing = productMap.get(codeKey);

        const newSellPrice = item.sellPrice !== undefined ? Math.max(0, parseFloat(item.sellPrice) || 0) : null;
        const newCostPrice = item.costPrice !== undefined ? Math.max(0, parseFloat(item.costPrice) || 0) : null;
        const newStock = item.stock !== undefined ? Math.max(0, parseInt(item.stock) || 0) : null;
        const isSuspended = Boolean(item.isSuspended);

        if (existing) {
          // --- الصنف موجود مسبقاً: تحديث آمن ودقيق للأسعار ورأس المال والكميات والاسم مع الحفاظ على الصور ---
          let changed = false;
          const changes = [];

          // 0. تحديث اسم الصنف إن تغير في الشامل
          if (item.name && String(item.name).trim()) {
            const cleanName = String(item.name).trim();
            if (existing.name !== cleanName) {
              changes.push(`اسم الصنف: من "${existing.name}" إلى "${cleanName}"`);
              existing.name = cleanName;
              changed = true;
            }
          }

          // 1. تحديث سعر البيع
          if (mode !== 'stock_only' && newSellPrice !== null) {
            if (existing.sellPrice !== newSellPrice) {
              changes.push(`سعر البيع: من ${existing.sellPrice} إلى ${newSellPrice}`);
              existing.sellPrice = newSellPrice;
              changed = true;
            }
          }

          // 2. تحديث رأس المال (التكلفة) داخلياً
          if (newCostPrice !== null && existing.costPrice !== newCostPrice) {
            changes.push(`رأس المال: من ${existing.costPrice} إلى ${newCostPrice}`);
            existing.costPrice = newCostPrice;
            changed = true;
          }

          // 3. تحديث كمية المخزون
          if (mode !== 'prices_only' && newStock !== null) {
            if (existing.stock !== newStock) {
              changes.push(`المخزون: من ${existing.stock} إلى ${newStock}`);
              existing.stock = newStock;
              existing.lastStockUpdate = now;
              existing.lastStockEditor = editorName;
              changed = true;
            }
          }

          // 4. حالة الإيقاف
          if (existing.isSuspended !== isSuspended) {
            existing.isSuspended = isSuspended;
            changes.push(`حالة التوفر: ${isSuspended ? 'متوقف' : 'متاح'}`);
            changed = true;
          }

          // 5. الباركود
          if (item.barcode && existing.barcode !== String(item.barcode).trim()) {
            existing.barcode = String(item.barcode).trim();
            changed = true;
          }

          if (changed) {
            existing.updatedAt = now;
            existing.lastSyncAt = now;
            if (!dryRun) {
              updatedOrNewProducts.push(existing);
            }
            summary.updated++;
            summary.details.push({ code: cleanCode, name: existing.name, action: 'updated', changes });
          } else {
            summary.unchanged++;
          }

          if (isSuspended) {
            summary.suspended++;
          }

        } else {
          // --- صنف جديد قادم من الشامل: إضافة في نهاية المصفوفة مع تصنيف تلقائي وصورة افتراضية ---
          const categoryResult = categorizeProduct(item.name);
          const defaultImage = getDefaultImageForCategory(categoryResult.sub);
          const safeId = 'prod-' + cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Math.floor(100 + Math.random() * 900);

          const newProduct = {
            id: safeId,
            code: cleanCode,
            name: String(item.name).trim(),
            brand: (item.brand && item.brand !== 'أخرى') ? item.brand : detectBrand(item.name).brand,
            brandAr: (item.brandAr && item.brandAr !== 'أخرى / عام') ? item.brandAr : detectBrand(item.name).brandAr,
            mainCategory: categoryResult.main,
            category: categoryResult.sub,
            costPrice: newCostPrice || 0,
            sellPrice: newSellPrice || 0,
            stock: (mode === 'prices_only') ? 0 : (newStock || 0),
            barcode: item.barcode ? String(item.barcode).trim() : '',
            unit: item.unit || 'قطعة',
            image: item.image || defaultImage,
            description: item.description || `${item.name} (كود: ${cleanCode})`,
            isSuspended: isSuspended,
            createdAt: now,
            updatedAt: now,
            lastSyncAt: now,
            lastStockUpdate: now,
            lastStockEditor: editorName
          };

          if (!dryRun) {
            products.push(newProduct);
            productMap.set(codeKey, newProduct);
            updatedOrNewProducts.push(newProduct);
          }
          summary.created++;
          if (isSuspended) summary.suspended++;
          summary.details.push({ code: cleanCode, name: newProduct.name, action: 'created', price: newSellPrice, stock: newStock });
        }
      } catch (err) {
        summary.errors.push(`خطأ في معالجة الصنف ${item?.code}: ${err.message}`);
      }
    }

    let persisted = false;
    let verifiedSample = [];

    // إذا لم يكن الوضع تجريبياً، نقوم بالحفظ النهائي وتثبيته في قاعدة البيانات الدائمة
    if (!dryRun) {
      if (updatedOrNewProducts.length > 0) {
        // 1. إنشاء نسخة احتياطية سريعة قبل الكتابة
        this.createBackup('pre_sync_batch');

        // 2. كتابة ملف JSON محلياً
        writeJson(PRODUCTS_FILE, products);

        // 3. إبطال الذاكرة المؤقتة
        this._invalidateCache();
      }

      // كتابة الملف المحلي للميتا
      const syncMetaObj = {
        lastSyncAt: now,
        mode,
        itemsReceived: items.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        suspended: summary.suspended,
        totalCatalogProducts: products.length,
        editorName
      };
      const syncMetaFile = path.join(DATA_DIR, 'sync_meta.json');
      writeJson(syncMetaFile, syncMetaObj);

      persisted = true;
      notifyStoreServers();

      // 4. مزامنة سحابية خلفية فائقة السرعة مع Supabase دون تعطيل برنامج الشامل
      if (supabase && updatedOrNewProducts.length > 0) {
        setImmediate(async () => {
          try {
            const withTimeout = (p, ms = 8000) => Promise.race([
              p,
              new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))
            ]);

            const supabaseBatch = updatedOrNewProducts.map(p => ({
              id: String(p.id),
              code: String(p.code || '').trim(),
              name: String(p.name || '').trim(),
              category: String(p.mainCategory || p.category || 'أجهزة كهربائية كبيرة'),
              subcategory: String(p.category || 'عام'),
              costPrice: Number(p.costPrice) || 0,
              sellPrice: Number(p.sellPrice) || 0,
              stock: parseInt(p.stock) || 0,
              unit: String(p.unit || 'قطعة'),
              image: String(p.image || ''),
              description: String(p.description || ''),
              barcode: String(p.barcode || ''),
              isSuspended: Boolean(p.isSuspended),
              brand: String(p.brand || 'أخرى'),
              brandAr: String(p.brandAr || 'أخرى / عام'),
              images: (Array.isArray(p.images) && p.images.length > 0) ? p.images : [],
              lastStockUpdate: p.lastStockUpdate || null,
              lastStockEditor: p.lastStockEditor || null,
              updatedAt: p.updatedAt || null,
              lastSyncAt: p.lastSyncAt || null,
              createdAt: p.createdAt || now
            }));

            await withTimeout(supabase.from('products').upsert(supabaseBatch), 8000).catch(e => {
              console.warn('⚠️ Supabase products upsert warning:', e.message);
            });

            await withTimeout(supabase.from('settings').upsert({
              id: 'products_snapshot',
              data: products
            }), 8000).catch(e => {
              console.warn('⚠️ Supabase snapshot warning:', e.message);
            });

            await withTimeout(supabase.from('settings').upsert({
              id: 'sync_meta',
              data: syncMetaObj
            }), 5000).catch(() => {});
          } catch (err) {
            console.warn('⚠️ Background Supabase sync error:', err.message);
          }
        });
      }
    }

    return {
      success: true,
      persisted: true,
      verifiedSample: updatedOrNewProducts.slice(0, 3).map(p => ({ code: p.code, name: p.name, sellPrice: p.sellPrice, stock: p.stock })),
      storageType: supabase ? 'Supabase Cloud PostgreSQL + Local Cache' : 'Local Container',
      dryRun,
      summary,
      totalCatalogProducts: products.length,
      timestamp: now
    };
  },

  // إعادة ضبط واستبدال جميع الأصناف بالكامل بنظافة تامة من الشامل
  async resetAllProducts(items, options = {}) {
    const { dryRun = false, editorName = 'إعادة بناء نظيفة من الشامل' } = options;
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'قائمة الأصناف فارغة' };
    }
    const current = this.getProducts();
    const curMap = new Map();
    current.forEach(p => { if (p.code) curMap.set(p.code.toUpperCase(), p); });

    this.createBackup('pre_reset_products');
    const now = new Date().toISOString();
    const rebuilt = [];

    for (const item of items) {
      if (!item || !item.code || !item.name) continue;
      const cleanCode = String(item.code).trim();
      const codeKey = cleanCode.toUpperCase();
      const existing = curMap.get(codeKey);

      const sellPrice = item.sellPrice !== undefined ? Math.max(0, parseFloat(item.sellPrice) || 0) : 0;
      const costPrice = item.costPrice !== undefined ? Math.max(0, parseFloat(item.costPrice) || 0) : 0;
      const stock = item.stock !== undefined ? Math.max(0, parseInt(item.stock) || 0) : 0;
      const isSuspended = Boolean(item.isSuspended);
      const barcode = item.barcode ? String(item.barcode).trim() : '';

      let mainCategory, category, image;
      if (existing && existing.category && existing.category !== 'عام') {
        mainCategory = existing.mainCategory || 'أجهزة كهربائية كبيرة';
        category = existing.category;
        image = existing.image;
      } else {
        const catRes = categorizeProduct(item.name);
        mainCategory = catRes.main;
        category = catRes.sub;
        image = (existing && existing.image) ? existing.image : getDefaultImageForCategory(catRes.sub);
      }

      rebuilt.push({
        id: existing ? existing.id : 'prod-' + cleanCode.toLowerCase().replace(/[^a-z0-9]/g, ''),
        code: cleanCode,
        name: String(item.name).trim(),
        brand: (existing && existing.brand && existing.brand !== 'أخرى') ? existing.brand : detectBrand(item.name).brand,
        brandAr: (existing && existing.brandAr && existing.brandAr !== 'أخرى / عام') ? existing.brandAr : detectBrand(item.name).brandAr,
        mainCategory,
        category,
        costPrice,
        sellPrice,
        stock,
        barcode,
        unit: item.unit || 'قطعة',
        image: image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80',
        description: (existing && existing.description) ? existing.description : `${item.name} (كود: ${cleanCode})`,
        isSuspended,
        createdAt: existing && existing.createdAt ? existing.createdAt : now,
        updatedAt: now,
        lastSyncAt: now,
        lastStockUpdate: now,
        lastStockEditor: editorName
      });
    }

    if (!dryRun) {
      writeJson(PRODUCTS_FILE, rebuilt);
      _productsCache = rebuilt;
      _productsCacheTime = Date.now();

      const syncMetaObj = {
        lastSyncAt: now,
        mode: 'reset_all',
        itemsReceived: items.length,
        totalCatalogProducts: rebuilt.length,
        editorName
      };

      const syncMetaFile = path.join(DATA_DIR, 'sync_meta.json');
      writeJson(syncMetaFile, syncMetaObj);

      if (supabase) {
        try {
          // رفع الأصناف المعاد بناؤها إلى جدول products بدفعات
          const CHUNK_SIZE = 100;
          for (let i = 0; i < rebuilt.length; i += CHUNK_SIZE) {
            const chunk = rebuilt.slice(i, i + CHUNK_SIZE).map(p => ({
              id: String(p.id),
              code: String(p.code || '').trim(),
              name: String(p.name || '').trim(),
              category: String(p.mainCategory || p.category || 'أجهزة كهربائية كبيرة'),
              subcategory: String(p.category || 'عام'),
              costPrice: Number(p.costPrice) || 0,
              sellPrice: Number(p.sellPrice) || 0,
              stock: parseInt(p.stock) || 0,
              unit: String(p.unit || 'قطعة'),
              image: String(p.image || ''),
              description: String(p.description || ''),
              barcode: String(p.barcode || ''),
              isSuspended: Boolean(p.isSuspended),
              brand: String(p.brand || 'أخرى'),
              brandAr: String(p.brandAr || 'أخرى / عام'),
              images: (Array.isArray(p.images) && p.images.length > 0) ? p.images : [],
              lastStockUpdate: p.lastStockUpdate || null,
              lastStockEditor: p.lastStockEditor || null,
              updatedAt: p.updatedAt || null,
              lastSyncAt: p.lastSyncAt || null,
              createdAt: p.createdAt || now
            }));
            await supabase.from('products').upsert(chunk);
          }

          // حفظ snapshot كامل في settings
          await supabase.from('settings').upsert({
            id: 'products_snapshot',
            data: rebuilt
          });

          // حفظ sync_meta في settings
          await supabase.from('settings').upsert({
            id: 'sync_meta',
            data: syncMetaObj
          });
        } catch (sbEx) {
          console.error('Supabase resetAllProducts error:', sbEx.message);
        }
      }
    }

    return {
      success: true,
      dryRun,
      totalCatalogProducts: rebuilt.length,
      storageType: supabase ? 'Supabase Cloud PostgreSQL' : 'Local Ephemeral Container',
      timestamp: now
    };
  },

  // -------------------------------------------------------------
  // مزامنة دفعة زبائن من برنامج الشامل لايت (syncBatchCustomers)
  // -------------------------------------------------------------
  async syncBatchCustomers(items, options = {}) {
    const {
      dryRun = false,
      syncMode = 'upsert',
      editorName = 'مزامنة الشامل لايت'
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        error: 'قائمة الزبائن فارغة أو غير صالحة',
        summary: { totalReceived: 0, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }
      };
    }

    if (items.length > 1000) {
      return {
        success: false,
        error: 'الحد الأقصى لدفعة الزبائن هو 1000 سجل',
        summary: { totalReceived: items.length, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }
      };
    }

    const customers = this.getCustomers();
    const now = new Date().toISOString();

    // خريطة سريعة بكود الزبون من الشامل وبكافة المفاتيح الممكنة
    const custLookup = new Map();
    customers.forEach((c, idx) => {
      if (c.systemNumber) custLookup.set(String(c.systemNumber).trim().toUpperCase(), idx);
      if (c.shamelCode) custLookup.set(String(c.shamelCode).trim().toUpperCase(), idx);
      if (c.id) custLookup.set(String(c.id).trim().toUpperCase(), idx);
    });

    const summary = { totalReceived: items.length, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] };
    const updatedCustomers = [...customers];

    for (const item of items) {
      try {
        const shamelCode = String(item.shamelCode || item.code || item.systemNumber || '').trim();
        const name = String(item.name || '').trim();
        if (!shamelCode || !name) {
          summary.failed++;
          summary.errors.push(`سجل ناقص: كود=${shamelCode} اسم=${name}`);
          continue;
        }

        const key = shamelCode.toUpperCase();
        let existingIdx = custLookup.get(key);
        if (existingIdx === undefined && name) {
          const matchIdx = updatedCustomers.findIndex(c => c.name && c.name.trim().toLowerCase() === name.toLowerCase());
          if (matchIdx !== -1) existingIdx = matchIdx;
        }
        const exists = existingIdx !== undefined;

        if (exists && syncMode === 'new_only') { summary.unchanged++; continue; }
        if (!exists && syncMode === 'update_only') { summary.unchanged++; continue; }

        const phone = String(item.phone || item.mobile || '').trim();
        const mobile = String(item.mobile || item.phone || '').trim();
        const email = String(item.email || '').trim();
        const address = String(item.address || '').trim();
        const notes = String(item.notes || '').trim();
        const isStopped = Boolean(item.isStopped);

        // استخراج الرصيد من مختلف الحقول المحتملة
        let rawBal = item.balance !== undefined ? item.balance : (item.currentBalance !== undefined ? item.currentBalance : (item.debt !== undefined ? item.debt : (item.totalBalance !== undefined ? item.totalBalance : item.shamelBalance)));
        let itemBal = undefined;
        if (rawBal !== undefined && rawBal !== null) {
          const parsed = typeof rawBal === 'number' ? rawBal : parseFloat(String(rawBal).replace(/,/g, '').trim());
          if (!isNaN(parsed)) itemBal = Math.round(parsed * 100) / 100;
        }

        if (exists) {
          const cur = updatedCustomers[existingIdx];
          const curBal = parseFloat(cur.balance) || 0;
          const curShamelBal = parseFloat(cur.shamelBalance !== undefined ? cur.shamelBalance : cur.balance) || 0;
          // مقارنة الرصيد مع shamelBalance أيضاً لضمان عدم تجاهل التغييرات
          const hasBalDiff = itemBal !== undefined && Math.abs(curShamelBal - itemBal) > 0.01;
          const changed =
            cur.name !== name ||
            (phone && cur.phone !== phone) ||
            (email && cur.email !== email) ||
            (address && cur.address !== address) ||
            hasBalDiff ||
            Boolean(cur.isStopped) !== isStopped;

          if (!changed) { summary.unchanged++; continue; }

          if (!dryRun) {
            let lastBalanceDiffDate = cur.lastBalanceDiffDate || cur.lastBalanceChangeDate || null;
            let previousBalance = cur.previousBalance !== undefined ? cur.previousBalance : curShamelBal;
            let balanceDifference = cur.balanceDifference || 0;
            let balanceHistory = Array.isArray(cur.balanceHistory) ? [...cur.balanceHistory] : [];

            if (hasBalDiff) {
              lastBalanceDiffDate = now;
              previousBalance = curShamelBal;
              balanceDifference = Math.round((itemBal - curShamelBal) * 100) / 100;
              balanceHistory.unshift({
                date: now,
                oldBalance: curShamelBal,
                newBalance: itemBal,
                difference: balanceDifference,
                source: 'shamel_sync'
              });
              if (balanceHistory.length > 50) balanceHistory = balanceHistory.slice(0, 50);
            }

            // دائماً نحدّث shamelBalance و balance معاً من قيمة الشامل
            const newBal = itemBal !== undefined ? itemBal : curShamelBal;
            updatedCustomers[existingIdx] = {
              ...cur,
              name,
              phone: phone || cur.phone || '',
              mobile: mobile || cur.mobile || '',
              email: email || cur.email || '',
              address: address || cur.address || '',
              notes: notes || cur.notes || '',
              isStopped,
              shamelBalance: newBal,
              balance: newBal,
              lastBalanceDiffDate,
              lastBalanceChangeDate: lastBalanceDiffDate,
              previousBalance,
              balanceDifference,
              balanceHistory,
              shamelCode,
              systemNumber: cur.systemNumber || shamelCode,
              syncedAt: now,
              syncedBy: editorName,
              updatedAt: now
            };
          }
          summary.updated++;
        } else {
          if (!dryRun) {
            const initialBal = itemBal !== undefined ? itemBal : 0;
            const newCustomer = {
              id: 'cust-shamel-' + shamelCode + '-' + Date.now(),
              systemNumber: shamelCode,
              shamelCode,
              name,
              phone,
              mobile,
              email,
              address,
              notes,
              isStopped,
              shamelBalance: initialBal,
              balance: initialBal,
              lastBalanceDiffDate: initialBal !== 0 ? now : null,
              lastBalanceChangeDate: initialBal !== 0 ? now : null,
              previousBalance: 0,
              balanceDifference: initialBal,
              balanceHistory: initialBal !== 0 ? [{
                date: now,
                oldBalance: 0,
                newBalance: initialBal,
                difference: initialBal,
                source: 'shamel_sync'
              }] : [],
              createdAt: now,
              updatedAt: now,
              syncedAt: now,
              syncedBy: editorName,
              source: 'shamel_sync'
            };
            updatedCustomers.push(newCustomer);
            custLookup.set(key, updatedCustomers.length - 1);
          }
          summary.created++;
        }
      } catch (err) {
        summary.failed++;
        summary.errors.push(`خطأ في معالجة زبون: ${err.message}`);
      }
    }

    let persisted = false;
    let verifiedSample = [];

    if (!dryRun) {
      writeJson(CUSTOMERS_FILE, updatedCustomers);

      const custMeta = {
        lastSyncAt: now,
        mode: syncMode,
        itemsReceived: items.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        failed: summary.failed,
        totalCustomers: updatedCustomers.length,
        editorName
      };
      writeJson(path.join(DATA_DIR, 'sync_customers_meta.json'), custMeta);
      persisted = true;
      notifyStoreServers();

      // مزامنة سحابية خلفية غير معطلة مع Supabase
      if (supabase) {
        setImmediate(async () => {
          try {
            const withTimeout = (p, ms = 8000) => Promise.race([
              p,
              new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))
            ]);
            await withTimeout(supabase.from('settings').upsert({ id: 'customers', data: updatedCustomers }), 8000).catch(() => {});
            await withTimeout(supabase.from('settings').upsert({ id: 'sync_customers_meta', data: custMeta }), 5000).catch(() => {});
          } catch (e) {
            console.warn('⚠️ Background customers sync warning:', e.message);
          }
        });
      }
    }

    return {
      success: true,
      persisted: true,
      verifiedSample: updatedCustomers.slice(0, 3).map(c => ({ code: c.systemNumber || c.shamelCode, name: c.name, balance: c.balance })),
      storageType: supabase ? 'Supabase Cloud PostgreSQL + Local Cache' : 'Local Container',
      dryRun,
      summary,
      totalCustomers: updatedCustomers.length,
      timestamp: now
    };
  },

  // -------------------------------------------------------------
  // مزامنة دفعة موردين من برنامج الشامل لايت (syncBatchSuppliers)
  // -------------------------------------------------------------
  getSuppliers() {
    const list = readJson(SUPPLIERS_FILE, []);
    // استبعاد "مورد بضاعة قديمة" (S00000003) - حساب جرد داخلي وليس موردًا حقيقيًا
    const EXCLUDED_SUPPLIER_CODES = ['S00000003'];
    return list
      .filter(function(s) { return !EXCLUDED_SUPPLIER_CODES.includes(String(s.shamelCode || '').toUpperCase()); })
      .map(function(s) {
        var rawBal = typeof s.balance === 'number' ? s.balance : (parseFloat(String(s.balance || '0').replace(/,/g, '')) || 0);
        var shamelBal = s.shamelBalance !== undefined
          ? (typeof s.shamelBalance === 'number' ? s.shamelBalance : (parseFloat(String(s.shamelBalance || '0').replace(/,/g, '')) || 0))
          : rawBal;
        return Object.assign({}, s, { shamelBalance: shamelBal, balance: shamelBal });
      });
  },

  getLastCustomersSyncMeta() {
    return readJson(path.join(DATA_DIR, 'sync_customers_meta.json'), null);
  },

  getLastSuppliersSyncMeta() {
    return readJson(path.join(DATA_DIR, 'sync_suppliers_meta.json'), null);
  },

  async syncBatchSuppliers(items, options = {}) {
    const {
      dryRun = false,
      syncMode = 'upsert',
      editorName = 'مزامنة الشامل لايت'
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        error: 'قائمة الموردين فارغة أو غير صالحة',
        summary: { totalReceived: 0, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }
      };
    }

    if (items.length > 500) {
      return {
        success: false,
        error: 'الحد الأقصى لدفعة الموردين هو 500 سجل',
        summary: { totalReceived: items.length, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }
      };
    }

    const suppliers = this.getSuppliers();
    const now = new Date().toISOString();

    const shamelCodeMap = new Map();
    suppliers.forEach((s, idx) => {
      if (s.shamelCode) shamelCodeMap.set(String(s.shamelCode).trim().toUpperCase(), idx);
      if (s.id) shamelCodeMap.set(String(s.id).trim().toUpperCase(), idx);
    });

    const summary = { totalReceived: items.length, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] };
    const updatedSuppliers = [...suppliers];

    for (const item of items) {
      try {
        const shamelCode = String(item.shamelCode || item.code || '').trim();
        const name = String(item.name || '').trim();
        if (!shamelCode || !name) {
          summary.failed++;
          summary.errors.push(`سجل مورد ناقص: كود=${shamelCode} اسم=${name}`);
          continue;
        }

        // استبعاد المورد الوهمي "مورد بضاعة قديمة" (S00000003) كـ unchanged دون التأثير على إجمالي الدفعة
        if (shamelCode.toUpperCase() === 'S00000003' || name.includes('بضاعة قديمة')) {
          summary.unchanged++;
          continue;
        }

        const key = shamelCode.toUpperCase();
        let existingIdx = shamelCodeMap.get(key);
        if (existingIdx === undefined && name) {
          const matchIdx = updatedSuppliers.findIndex(s => s.name && s.name.trim().toLowerCase() === name.toLowerCase());
          if (matchIdx !== -1) existingIdx = matchIdx;
        }
        const exists = existingIdx !== undefined;

        if (exists && syncMode === 'new_only') { summary.unchanged++; continue; }
        if (!exists && syncMode === 'update_only') { summary.unchanged++; continue; }

        const phone = String(item.phone || item.mobile || '').trim();
        const mobile = String(item.mobile || item.phone || '').trim();
        const email = String(item.email || '').trim();
        const address = String(item.address || '').trim();
        const notes = String(item.notes || '').trim();
        const isStopped = Boolean(item.isStopped);

        let rawBal = item.balance !== undefined ? item.balance : (item.currentBalance !== undefined ? item.currentBalance : (item.totalBalance !== undefined ? item.totalBalance : item.shamelBalance));
        let itemBal = undefined;
        if (rawBal !== undefined && rawBal !== null) {
          const parsed = typeof rawBal === 'number' ? rawBal : parseFloat(String(rawBal).replace(/,/g, '').trim());
          if (!isNaN(parsed)) itemBal = Math.round(parsed * 100) / 100;
        }

        if (exists) {
          const cur = updatedSuppliers[existingIdx];
          const curShamelBal = parseFloat(cur.shamelBalance !== undefined ? cur.shamelBalance : cur.balance) || 0;
          // مقارنة مع shamelBalance لضمان اكتشاف الفروقات الحقيقية من الشامل
          const hasBalDiff = itemBal !== undefined && Math.abs(curShamelBal - itemBal) > 0.01;
          const changed =
            cur.name !== name ||
            (phone && cur.phone !== phone) ||
            (email && cur.email !== email) ||
            (address && cur.address !== address) ||
            hasBalDiff ||
            Boolean(cur.isStopped) !== isStopped;

          if (!changed) { summary.unchanged++; continue; }

          if (!dryRun) {
            let lastBalanceDiffDate = cur.lastBalanceDiffDate || cur.lastBalanceChangeDate || null;
            let previousBalance = cur.previousBalance !== undefined ? cur.previousBalance : curShamelBal;
            let balanceDifference = cur.balanceDifference || 0;
            let balanceHistory = Array.isArray(cur.balanceHistory) ? [...cur.balanceHistory] : [];

            if (hasBalDiff) {
              lastBalanceDiffDate = now;
              previousBalance = curShamelBal;
              balanceDifference = Math.round((itemBal - curShamelBal) * 100) / 100;
              balanceHistory.unshift({
                date: now,
                oldBalance: curShamelBal,
                newBalance: itemBal,
                difference: balanceDifference,
                source: 'shamel_sync'
              });
              if (balanceHistory.length > 50) balanceHistory = balanceHistory.slice(0, 50);
            }

            // دائماً نحدّث shamelBalance و balance معاً بالقيمة القادمة من الشامل
            const newBal = itemBal !== undefined ? itemBal : curShamelBal;
            updatedSuppliers[existingIdx] = {
              ...cur,
              name,
              phone: phone || cur.phone || '',
              mobile: mobile || cur.mobile || '',
              email: email || cur.email || '',
              address: address || cur.address || '',
              notes: notes || cur.notes || '',
              isStopped,
              shamelBalance: newBal,
              balance: newBal,
              lastBalanceDiffDate,
              lastBalanceChangeDate: lastBalanceDiffDate,
              previousBalance,
              balanceDifference,
              balanceHistory,
              updatedAt: now,
              syncedAt: now,
              syncedBy: editorName
            };
          }
          summary.updated++;
        } else {
          if (!dryRun) {
            const initialBal = itemBal !== undefined ? itemBal : 0;
            const newSupplier = {
              id: 'supp-shamel-' + shamelCode + '-' + Date.now(),
              shamelCode,
              name,
              phone,
              mobile,
              email,
              address,
              notes,
              isStopped,
              shamelBalance: initialBal,
              balance: initialBal,
              lastBalanceDiffDate: initialBal !== 0 ? now : null,
              lastBalanceChangeDate: initialBal !== 0 ? now : null,
              previousBalance: 0,
              balanceDifference: initialBal,
              balanceHistory: initialBal !== 0 ? [{
                date: now,
                oldBalance: 0,
                newBalance: initialBal,
                difference: initialBal,
                source: 'shamel_sync'
              }] : [],
              createdAt: now,
              updatedAt: now,
              syncedAt: now,
              syncedBy: editorName,
              source: 'shamel_sync'
            };
            updatedSuppliers.push(newSupplier);
            shamelCodeMap.set(key, updatedSuppliers.length - 1);
          }
          summary.created++;
        }
      } catch (err) {
        summary.failed++;
        summary.errors.push(`خطأ في معالجة مورد: ${err.message}`);
      }
    }

    let persisted = false;
    let verifiedSample = [];

    if (!dryRun) {
      writeJson(SUPPLIERS_FILE, updatedSuppliers);

      const suppMeta = {
        lastSyncAt: now,
        mode: syncMode,
        itemsReceived: items.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        failed: summary.failed,
        totalSuppliers: updatedSuppliers.length,
        excludedDummyCount: 0,
        editorName
      };
      writeJson(path.join(DATA_DIR, 'sync_suppliers_meta.json'), suppMeta);
      persisted = true;
      notifyStoreServers();

      // مزامنة سحابية خلفية غير معطلة مع Supabase
      if (supabase) {
        setImmediate(async () => {
          try {
            const withTimeout = (p, ms = 8000) => Promise.race([
              p,
              new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))
            ]);
            await withTimeout(supabase.from('settings').upsert({ id: 'suppliers', data: updatedSuppliers }), 8000).catch(() => {});
            await withTimeout(supabase.from('settings').upsert({ id: 'sync_suppliers_meta', data: suppMeta }), 5000).catch(() => {});
          } catch (e) {
            console.warn('⚠️ Background suppliers sync warning:', e.message);
          }
        });
      }
    }

    return {
      success: true,
      persisted: true,
      verifiedSample: updatedSuppliers.slice(0, 3).map(s => ({ code: s.shamelCode, name: s.name, balance: s.balance })),
      storageType: supabase ? 'Supabase Cloud PostgreSQL + Local Cache' : 'Local Container',
      dryRun,
      summary,
      totalSuppliers: updatedSuppliers.length,
      timestamp: now
    };
  },

  // -------------------------------------------------------------
  // مزامنة الفواتير من برنامج الشامل لايت (Invoices Sync)
  // -------------------------------------------------------------
  getLastInvoicesSyncMeta() {
    return readJson(SYNC_INVOICES_META_FILE, null);
  },

  async syncBatchInvoices(items, options = {}) {
    const {
      dryRun = false,
      syncMode = 'upsert',
      editorName = 'برنامج مزامنة الشامل'
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        error: 'قائمة الفواتير فارغة أو غير صالحة',
        summary: { totalReceived: 0, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }
      };
    }

    const invoices = this.getInvoices();
    const customers = this.getCustomers();
    const suppliers = this.getSuppliers();
    const now = new Date().toISOString();

    const custByCode = new Map();
    customers.forEach(c => {
      if (c.systemNumber) custByCode.set(String(c.systemNumber).trim().toUpperCase(), c);
      if (c.shamelCode) custByCode.set(String(c.shamelCode).trim().toUpperCase(), c);
      if (c.id) custByCode.set(String(c.id).trim().toUpperCase(), c);
    });

    const suppByCode = new Map();
    suppliers.forEach(s => {
      if (s.shamelCode) suppByCode.set(String(s.shamelCode).trim().toUpperCase(), s);
      if (s.id) suppByCode.set(String(s.id).trim().toUpperCase(), s);
    });

    const invLookup = new Map();
    invoices.forEach((inv, idx) => {
      if (inv.id) invLookup.set(String(inv.id).trim().toUpperCase(), idx);
      if (inv.invoiceNumber) invLookup.set(String(inv.invoiceNumber).trim().toUpperCase(), idx);
      if (inv.shamelNo) invLookup.set(String(inv.shamelNo).trim().toUpperCase(), idx);
      if (inv.shamelId) invLookup.set(String(inv.shamelId).trim(), idx);
    });

    const summary = { totalReceived: items.length, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] };
    const updatedInvoices = [...invoices];

    for (const raw of items) {
      try {
        const shamelId = raw.shamelId || raw.voucherId || raw.id;
        const invNo = String(raw.invoiceNumber || raw.no || shamelId || '').trim();
        if (!invNo) {
          summary.failed++;
          summary.errors.push('تخطي فاتورة مجهولة الرقم');
          continue;
        }

        const partyCode = String(raw.partyCode || raw.accountNo || '').trim();
        const partyName = String(raw.partyName || raw.customerName || raw.person_name || 'نقداً').trim();
        const partyType = raw.partyType || (partyCode.startsWith('S') ? 'supplier' : (partyCode.startsWith('C') ? 'customer' : 'cash'));

        const matchedCust = custByCode.get(partyCode.toUpperCase());
        const matchedSupp = suppByCode.get(partyCode.toUpperCase());

        const typeCode = (raw.typeCode || raw.type || 'I').toUpperCase();
        let invType = 'sales';
        let invTypeAr = 'فاتورة مبيعات';
        if (typeCode === 'H') {
          invType = 'purchase';
          invTypeAr = 'فاتورة مشتريات';
        } else if (typeCode === 'S') {
          invType = 'sales_return';
          invTypeAr = 'مردودات مبيعات';
        } else if (typeCode === 'M') {
          invType = 'purchase_return';
          invTypeAr = 'مردودات مشتريات';
        }

        const invTotal = Number(raw.totalAmount ?? raw.total_amount) || 0;
        const cashAmt = Number(raw.cashAmount ?? raw.cash_amount) || 0;
        const checkAmt = Number(raw.checkAmount ?? raw.check_amount) || 0;
        const discountAmt = Number(raw.discountAmount ?? raw.deduction_amount) || 0;
        const vatAmt = Number(raw.vatAmount ?? raw.vat) || 0;

        let payMethod = raw.paymentMethod || 'cash';
        if (checkAmt > 0 && cashAmt === 0) payMethod = 'check';
        else if (checkAmt > 0 && cashAmt > 0) payMethod = 'mixed';
        else if (cashAmt === 0 && checkAmt === 0 && partyCode && partyCode !== 'A11111000') payMethod = 'installments';

        // معالجة بنود الأصناف بدقة تامة
        const processedItems = (raw.items || []).map(it => {
          const qty = Number(it.quantity) || 1;
          const uPrice = Number(it.unitPrice ?? it.sellPrice ?? it.unit_price) || 0;
          const cPrice = Number(it.costPrice ?? it.cost) || 0;
          const disc = Number(it.discount ?? it.item_discount_amount) || 0;
          const tSell = (qty * uPrice) - disc;
          const tCost = qty * cPrice;
          const uProfit = uPrice - cPrice;
          const tProfit = tSell - tCost;

          return {
            itemId: it.itemId || it.item_service_id || null,
            code: it.code || it.item_no || '',
            productName: it.productName || it.name || it.item_print_name || 'صنف',
            quantity: qty,
            unitPrice: uPrice,
            sellPrice: uPrice,
            costPrice: cPrice,
            discount: disc,
            totalPrice: tSell,
            totalSell: tSell,
            totalCost: tCost,
            unitProfit: uProfit,
            totalProfit: tProfit,
            barcode: it.barcode || it.item_unit_bar_code || ''
          };
        });

        const totalItemsCost = processedItems.reduce((acc, it) => acc + (it.totalCost || 0), 0);
        const totalItemsQty = processedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
        const rawProfit = invType === 'purchase' ? 0 : (invTotal - totalItemsCost);
        const totalProfit = invType === 'sales_return' ? -Math.abs(rawProfit) : rawProfit;
        const marginPct = (invTotal > 0 && invType === 'sales') ? Math.round((totalProfit / invTotal) * 1000) / 10 : 0;

        const invSummary = {
          totalAmount: invTotal,
          totalCost: totalItemsCost,
          totalProfit: totalProfit,
          profitMarginPercentage: marginPct,
          totalQuantity: totalItemsQty,
          itemsCount: processedItems.length
        };

        const targetId = 'shamel-inv-' + (shamelId || invNo);
        const lookupKey = targetId.toUpperCase();
        const altKey = String(invNo).toUpperCase();

        const existingIdx = invLookup.has(lookupKey) ? invLookup.get(lookupKey) :
                           (invLookup.has(altKey) ? invLookup.get(altKey) : -1);

        const invRecord = {
          id: targetId,
          shamelId: Number(shamelId) || null,
          shamelNo: invNo,
          invoiceNumber: invNo,
          invoiceType: invType,
          typeCode,
          invoiceTypeArabic: invTypeAr,
          createdAt: raw.createdAt || raw.date || now,
          customerName: partyName,
          partyName,
          partyCode,
          partyType,
          customerId: matchedCust ? matchedCust.id : (raw.customerId || null),
          customerSystemNumber: matchedCust ? (matchedCust.systemNumber || matchedCust.shamelCode) : (partyCode || null),
          customerPhone: matchedCust ? (matchedCust.mobile || matchedCust.phone) : (raw.customerPhone || ''),
          customerAddress: matchedCust ? (matchedCust.address || '') : '',
          supplierId: matchedSupp ? matchedSupp.id : (raw.supplierId || null),
          supplierShamelCode: matchedSupp ? matchedSupp.shamelCode : (partyType === 'supplier' ? partyCode : null),
          supplierName: matchedSupp ? matchedSupp.name : (partyType === 'supplier' ? partyName : ''),
          employeeName: raw.employeeName || 'الشامل لايت',
          paymentMethod: payMethod,
          totalAmount: invTotal,
          cashAmount: cashAmt,
          checkAmount: checkAmt,
          discountAmount: discountAmt,
          vatAmount: vatAmt,
          notes: raw.notes || '',
          source: 'shamel_sync',
          syncedAt: now,
          syncedBy: editorName,
          summary: invSummary,
          items: processedItems
        };

        if (existingIdx !== -1) {
          const cur = updatedInvoices[existingIdx];
          if (!dryRun) {
            updatedInvoices[existingIdx] = {
              ...cur,
              ...invRecord,
              warrantyId: cur.warrantyId || invRecord.warrantyId,
              warrantyNumber: cur.warrantyNumber || invRecord.warrantyNumber,
              telegramStatus: cur.telegramStatus || invRecord.telegramStatus,
              internalNotes: cur.internalNotes || '',
              updatedAt: now
            };
          }
          summary.updated++;
        } else {
          if (!dryRun) {
            updatedInvoices.push(invRecord);
            invLookup.set(lookupKey, updatedInvoices.length - 1);
            invLookup.set(altKey, updatedInvoices.length - 1);
          }
          summary.created++;
        }
      } catch (err) {
        summary.failed++;
        summary.errors.push(`خطأ في معالجة فاتورة: ${err.message}`);
      }
    }

    if (!dryRun) {
      writeJson(INVOICES_FILE, updatedInvoices);

      const invMeta = {
        lastSyncAt: now,
        mode: syncMode,
        itemsReceived: items.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        failed: summary.failed,
        totalInvoices: updatedInvoices.length,
        editorName
      };
      writeJson(SYNC_INVOICES_META_FILE, invMeta);

      if (supabase) {
        // تشغيل حفظ Supabase في الخلفية لعدم إبطاء استجابة الدفعة
        Promise.resolve().then(async () => {
          try {
            await supabase.from('settings').upsert({ id: 'sync_invoices_meta', data: invMeta });
            // حفظ نسخة snapshot كاملة في جدول settings لضمان استرجاع الفواتير بعد إعادة تشغيل الخادم
            // جدولة حفظ نسخة snapshot كاملة بـ debounce لتجنب تكرار رفع 15MB مع كل دفعة متتالية واستهلاك الذاكرة
            if (debounceInvoicesSnapshotTimer) clearTimeout(debounceInvoicesSnapshotTimer);
            debounceInvoicesSnapshotTimer = setTimeout(async () => {
              try {
                const latestInvoices = readJson(INVOICES_FILE, []);
                await supabase.from('settings').upsert({ id: 'invoices', data: latestInvoices });
              } catch (snErr) {
                console.warn('⚠️ تنبيه أثناء حفظ لقطة الفواتير الكاملة في Supabase:', snErr.message);
              }
            }, 8000);

            // حفظ فواتير الدفعة الحالية في جدول invoices مع تنظيف رقم الفاتورة كـ integer
            const currentBatchIds = new Set(items.map(it => 'shamel-inv-' + (it.shamelId || it.invoiceNumber || it.id)));
            const sbInvoices = updatedInvoices.filter(inv => currentBatchIds.has(inv.id)).map(inv => ({
              id: String(inv.id),
              invoiceNumber: parseInt(String(inv.invoiceNumber || inv.shamelNo || inv.shamelId || '').replace(/\D/g, '')) || 0,
              invoiceType: inv.invoiceType || 'sales',
              createdAt: inv.createdAt,
              employeeName: inv.employeeName,
              customerName: inv.customerName,
              customerId: inv.customerId,
              customerSystemNumber: inv.customerSystemNumber,
              notes: inv.notes,
              paymentMethod: inv.paymentMethod,
              summary: inv.summary,
              items: inv.items
            }));
            if (sbInvoices.length > 0) {
              const { error: sbErr } = await supabase.from('invoices').upsert(sbInvoices, { onConflict: 'id' });
              if (sbErr) {
                console.warn('⚠️ تنبيه أثناء حفظ الفواتير في جدول invoices بـ Supabase:', sbErr.message);
              }
            }
          } catch (sbEx) {
            console.warn('⚠️ استثناء أثناء حفظ الفواتير في Supabase:', sbEx.message);
          }
        });
      }
    }

    return {
      success: summary.failed === 0 || (summary.created + summary.updated + summary.unchanged) > 0,
      dryRun,
      summary,
      totalInvoices: updatedInvoices.length,
      timestamp: now
    };
  },

  // -------------------------------------------------------------
  // مزامنة سندات القبض والصرف من الشامل (Vouchers Sync)
  // -------------------------------------------------------------
  getLastVouchersSyncMeta() {
    return readJson(SYNC_VOUCHERS_META_FILE, null);
  },

  async syncBatchVouchers(items, options = {}) {
    const {
      dryRun = false,
      syncMode = 'upsert',
      editorName = 'برنامج مزامنة الشامل'
    } = options;

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        error: 'قائمة السندات فارغة أو غير صالحة',
        summary: { totalReceived: 0, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }
      };
    }

    const receipts = this.getReceipts();
    const customers = this.getCustomers();
    const suppliers = this.getSuppliers();
    const now = new Date().toISOString();

    const custByCode = new Map();
    customers.forEach(c => {
      if (c.systemNumber) custByCode.set(String(c.systemNumber).trim().toUpperCase(), c);
      if (c.shamelCode) custByCode.set(String(c.shamelCode).trim().toUpperCase(), c);
      if (c.id) custByCode.set(String(c.id).trim().toUpperCase(), c);
    });

    const suppByCode = new Map();
    suppliers.forEach(s => {
      if (s.shamelCode) suppByCode.set(String(s.shamelCode).trim().toUpperCase(), s);
      if (s.id) suppByCode.set(String(s.id).trim().toUpperCase(), s);
    });

    const vchLookup = new Map();
    receipts.forEach((r, idx) => {
      if (r.id) vchLookup.set(String(r.id).trim().toUpperCase(), idx);
      if (r.voucherNumber) vchLookup.set(String(r.voucherNumber).trim().toUpperCase(), idx);
      if (r.receiptNumber) vchLookup.set(String(r.receiptNumber).trim().toUpperCase(), idx);
      if (r.shamelNo) vchLookup.set(String(r.shamelNo).trim().toUpperCase(), idx);
      if (r.shamelId) vchLookup.set(String(r.shamelId).trim(), idx);
    });

    const summary = { totalReceived: items.length, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] };
    const updatedReceipts = [...receipts];

    for (const raw of items) {
      try {
        const shamelId = raw.shamelId || raw.voucherId || raw.id;
        const vchNo = String(raw.voucherNumber || raw.receiptNumber || raw.no || shamelId || '').trim();
        if (!vchNo) {
          summary.failed++;
          summary.errors.push('تخطي سند مجهول الرقم');
          continue;
        }

        const partyCode = String(raw.partyCode || raw.accountNo || '').trim();
        const partyName = String(raw.partyName || raw.customerName || raw.person_name || 'نقداً').trim();
        const partyType = raw.partyType || (partyCode.startsWith('S') ? 'supplier' : (partyCode.startsWith('C') ? 'customer' : 'other'));

        const typeCode = (raw.typeCode || raw.type || (vchNo.startsWith('P') ? 'P' : 'R')).toUpperCase();
        const isPayment = typeCode === 'P' || raw.voucherType === 'payment';
        const vchType = isPayment ? 'payment' : 'receipt';
        const vchTypeAr = isPayment ? 'سند صرف' : 'سند قبض';

        const matchedCust = custByCode.get(partyCode.toUpperCase());
        const matchedSupp = suppByCode.get(partyCode.toUpperCase());

        const amt = Number(raw.amount ?? raw.totalAmount ?? raw.total_amount) || 0;
        const cashAmt = Number(raw.cashAmount ?? raw.cash_amount) || 0;
        const checkAmt = Number(raw.checkAmount ?? raw.check_amount) || 0;

        let payMethod = raw.paymentMethod || 'cash';
        if (checkAmt > 0 && cashAmt === 0) payMethod = 'check';
        else if (checkAmt > 0 && cashAmt > 0) payMethod = 'mixed';

        const targetId = 'shamel-vch-' + (shamelId || vchNo);
        const lookupKey = targetId.toUpperCase();
        const altKey = String(vchNo).toUpperCase();

        const existingIdx = vchLookup.has(lookupKey) ? vchLookup.get(lookupKey) :
                           (vchLookup.has(altKey) ? vchLookup.get(altKey) : -1);

        const vchRecord = {
          id: targetId,
          shamelId: Number(shamelId) || null,
          shamelNo: vchNo,
          voucherNumber: vchNo,
          receiptNumber: vchNo,
          voucherType: vchType,
          typeCode,
          voucherTypeArabic: vchTypeAr,
          createdAt: raw.createdAt || raw.date || now,
          customerName: partyName,
          partyName,
          partyCode,
          partyType,
          customerId: matchedCust ? matchedCust.id : (raw.customerId || null),
          customerSystemNumber: matchedCust ? (matchedCust.systemNumber || matchedCust.shamelCode) : (partyCode || null),
          customerPhone: matchedCust ? (matchedCust.mobile || matchedCust.phone) : (raw.customerPhone || ''),
          supplierId: matchedSupp ? matchedSupp.id : (raw.supplierId || null),
          supplierShamelCode: matchedSupp ? matchedSupp.shamelCode : (partyType === 'supplier' ? partyCode : null),
          supplierName: matchedSupp ? matchedSupp.name : (partyType === 'supplier' ? partyName : ''),
          employeeName: raw.employeeName || 'الشامل لايت',
          paymentMethod: payMethod,
          amount: amt,
          cashAmount: cashAmt,
          checkAmount: checkAmt,
          description: raw.description || (vchTypeAr + ' #' + vchNo),
          notes: raw.notes || '',
          source: 'shamel_sync',
          syncedAt: now,
          syncedBy: editorName
        };

        if (existingIdx !== -1) {
          const cur = updatedReceipts[existingIdx];
          if (!dryRun) {
            updatedReceipts[existingIdx] = {
              ...cur,
              ...vchRecord,
              updatedAt: now
            };
          }
          summary.updated++;
        } else {
          if (!dryRun) {
            updatedReceipts.push(vchRecord);
            vchLookup.set(lookupKey, updatedReceipts.length - 1);
            vchLookup.set(altKey, updatedReceipts.length - 1);
          }
          summary.created++;
        }
      } catch (err) {
        summary.failed++;
        summary.errors.push(`خطأ في معالجة سند: ${err.message}`);
      }
    }

    if (!dryRun) {
      writeJson(RECEIPTS_FILE, updatedReceipts);

      const vchMeta = {
        lastSyncAt: now,
        mode: syncMode,
        itemsReceived: items.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        failed: summary.failed,
        totalVouchers: updatedReceipts.length,
        editorName
      };
      writeJson(SYNC_VOUCHERS_META_FILE, vchMeta);

      if (supabase) {
        // تشغيل حفظ Supabase في الخلفية لعدم إبطاء استجابة الدفعة
        Promise.resolve().then(async () => {
          try {
            await supabase.from('settings').upsert({ id: 'sync_vouchers_meta', data: vchMeta });
            // حفظ نسخة snapshot كاملة في جدول settings لضمان استرجاع السندات بعد إعادة تشغيل الخادم
            // جدولة حفظ نسخة snapshot كاملة بـ debounce لتجنب تكرار رفع السندات مع كل دفعة متتالية
            if (debounceReceiptsSnapshotTimer) clearTimeout(debounceReceiptsSnapshotTimer);
            debounceReceiptsSnapshotTimer = setTimeout(async () => {
              try {
                const latestReceipts = readJson(RECEIPTS_FILE, []);
                await supabase.from('settings').upsert({ id: 'receipts', data: latestReceipts });
              } catch (snErr) {
                console.warn('⚠️ تنبيه أثناء حفظ لقطة السندات الكاملة في Supabase:', snErr.message);
              }
            }, 8000);

            const currentBatchIds = new Set(items.map(it => 'shamel-vch-' + (it.shamelId || it.voucherNumber || it.id)));
            const sbVouchers = updatedReceipts.filter(v => currentBatchIds.has(v.id)).map(v => ({
              id: String(v.id),
              receiptNumber: parseInt(String(v.receiptNumber || v.voucherNumber || v.shamelNo || '').replace(/\D/g, '')) || 0,
              createdAt: v.createdAt,
              employeeName: v.employeeName,
              customerName: v.customerName,
              customerPhone: v.customerPhone,
              amount: v.amount,
              description: v.description,
              notes: v.notes,
              paymentMethod: v.paymentMethod
            }));
            if (sbVouchers.length > 0) {
              const { error: sbErr } = await supabase.from('receipts').upsert(sbVouchers, { onConflict: 'id' });
              if (sbErr) {
                console.warn('⚠️ تنبيه أثناء حفظ السندات في جدول receipts بـ Supabase:', sbErr.message);
              }
            }
          } catch (sbEx) {
            console.warn('⚠️ استثناء أثناء حفظ السندات في Supabase:', sbEx.message);
          }
        });
      }
    }

    return {
      success: summary.failed === 0 || (summary.created + summary.updated + summary.unchanged) > 0,
      dryRun,
      summary,
      totalVouchers: updatedReceipts.length,
      timestamp: now
    };
  },

  // ---------------------------------------------------------------
  // استعادة وتحقق شامل من قاعدة بيانات الإنتاج الدائمة (Supabase)
  // يضمن بقاء كافة التعديلات والفواتير والزبائن والموردين والمنتجات
  // حتى بعد إعادة تشغيل الخادم أو إعادة نشره على Render
  // ---------------------------------------------------------------
  async initFromSupabase() {
    if (!supabase) {
      console.log('⚠️ Supabase غير متصل - سيتم استخدام البيانات المحلية المخزنة في الملفات فقط');
      return;
    }

    console.log('🔄 جاري بدء الاستعادة والتحقق الشامل من قاعدة بيانات Supabase الدائمة...');

    // 1. الإعدادات العامة
    try {
      const { data: stRow } = await supabase.from('settings').select('data').eq('id', 'general').maybeSingle();
      if (stRow && stRow.data && typeof stRow.data === 'object' && Object.keys(stRow.data).length > 0) {
        writeJson(SETTINGS_FILE, stRow.data);
      }
    } catch (e) {
      console.warn('⚠️ تعذر استعادة الإعدادات العامة من Supabase:', e.message);
    }

    // 2. الفواتير — استعادة كاملة ومضمونة عبر snapshot وجدول invoices المقسم على صفحات
    try {
      let restoredInvoices = [];
      const { data: invSnap } = await supabase.from('settings').select('data').eq('id', 'invoices').maybeSingle();
      if (invSnap && Array.isArray(invSnap.data) && invSnap.data.length > 0) {
        restoredInvoices = invSnap.data;
        console.log(`✅ تم استعادة ${restoredInvoices.length} فاتورة من snapshot في Supabase settings`);
      }

      // جلب جدول invoices بالتقسيم على صفحات لجلب جميع السجلات دون التقيد بالحد الأقصى (1000)
      let invPage = 0;
      const invPageSize = 500;
      let hasMoreInvoices = true;
      let allSbInvoices = [];

      while (hasMoreInvoices) {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .range(invPage * invPageSize, (invPage + 1) * invPageSize - 1);

        if (error) break;

        if (data && data.length > 0) {
          allSbInvoices = allSbInvoices.concat(data);
          invPage++;
          hasMoreInvoices = data.length === invPageSize;
        } else {
          hasMoreInvoices = false;
        }
      }

      if (allSbInvoices.length > 0) {
        const invMap = new Map();
        restoredInvoices.forEach(inv => invMap.set(String(inv.id), inv));
        allSbInvoices.forEach(inv => invMap.set(String(inv.id), { ...invMap.get(String(inv.id)), ...inv }));
        const finalInvoices = Array.from(invMap.values());
        writeJson(INVOICES_FILE, finalInvoices);
        console.log(`✅ تم استعادة ودمج ${finalInvoices.length} فاتورة من Supabase`);
      } else if (restoredInvoices.length > 0) {
        writeJson(INVOICES_FILE, restoredInvoices);
      } else {
        const local = readJson(INVOICES_FILE, []);
        console.log(`ℹ️ Supabase لم يرجع فواتير - تم الحفاظ على ${local.length} فاتورة من الملف المحلي`);
      }
    } catch (e) {
      console.warn('⚠️ تعذر استعادة الفواتير من Supabase:', e.message);
    }

    // 3. سندات القبض والصرف — استعادة كاملة عبر snapshot وجدول receipts المقسم على صفحات
    try {
      let restoredReceipts = [];
      const { data: rcpSnap } = await supabase.from('settings').select('data').eq('id', 'receipts').maybeSingle();
      if (rcpSnap && Array.isArray(rcpSnap.data) && rcpSnap.data.length > 0) {
        restoredReceipts = rcpSnap.data;
        console.log(`✅ تم استعادة ${restoredReceipts.length} سند من snapshot في Supabase settings`);
      }

      let rcpPage = 0;
      const rcpPageSize = 500;
      let hasMoreReceipts = true;
      let allSbReceipts = [];

      while (hasMoreReceipts) {
        const { data, error } = await supabase
          .from('receipts')
          .select('*')
          .range(rcpPage * rcpPageSize, (rcpPage + 1) * rcpPageSize - 1);

        if (error) break;

        if (data && data.length > 0) {
          allSbReceipts = allSbReceipts.concat(data);
          rcpPage++;
          hasMoreReceipts = data.length === rcpPageSize;
        } else {
          hasMoreReceipts = false;
        }
      }

      if (allSbReceipts.length > 0) {
        const rcpMap = new Map();
        restoredReceipts.forEach(r => rcpMap.set(String(r.id), r));
        allSbReceipts.forEach(r => rcpMap.set(String(r.id), { ...rcpMap.get(String(r.id)), ...r }));
        const finalReceipts = Array.from(rcpMap.values());
        writeJson(RECEIPTS_FILE, finalReceipts);
        console.log(`✅ تم استعادة ودمج ${finalReceipts.length} سند من Supabase`);
      } else if (restoredReceipts.length > 0) {
        writeJson(RECEIPTS_FILE, restoredReceipts);
      } else {
        const local = readJson(RECEIPTS_FILE, []);
        console.log(`ℹ️ Supabase لم يرجع سندات - تم الحفاظ على ${local.length} سند من الملف المحلي`);
      }
    } catch (e) {
      console.warn('⚠️ تعذر استعادة سندات القبض من Supabase:', e.message);
    }

    // 4. الكفالات والضمانات
    try {
      const { data: warRows, error: warErr } = await supabase.from('warranties').select('*').order('warrantyNumber', { ascending: false });
      if (!warErr && Array.isArray(warRows) && warRows.length > 0) {
        writeJson(WARRANTIES_FILE, warRows);
        console.log(`✅ تم استعادة ${warRows.length} كفالة وضمان من جدول warranties في Supabase`);
      } else {
        // فحص لقطة الكفالات في settings كنسخة احتياطية بديلة
        const { data: warSnap } = await supabase.from('settings').select('data').eq('id', 'warranties').maybeSingle();
        if (warSnap && Array.isArray(warSnap.data) && warSnap.data.length > 0) {
          writeJson(WARRANTIES_FILE, warSnap.data);
          console.log(`✅ تم استعادة ${warSnap.data.length} كفالة من snapshot الكفالات في Supabase`);
        }
      }
    } catch (e) {
      console.warn('⚠️ تعذر استعادة الكفالات من Supabase:', e.message);
    }

    // 5. استعادة المنتجات وحمايتها من الضياع
    try {
      // أ) أولاً فحص snapshot المنتجات الكامل من جدول settings (يحفظ الصور المخصصة والماركات والتصنيفات)
      const { data: snapRow } = await supabase.from('settings').select('data').eq('id', 'products_snapshot').maybeSingle();
      if (snapRow && Array.isArray(snapRow.data) && snapRow.data.length > 0) {
        writeJson(PRODUCTS_FILE, snapRow.data);
        _productsCache = snapRow.data;
        _productsCacheTime = Date.now();
        console.log(`✅ تم استعادة ${snapRow.data.length} صنف بكامل تفاصيلها من snapshot في Supabase`);
      }

      // ب) ثم جلب جدول products وتحديث أي أسعار أو كميات تم تعديلها
      let page = 0;
      const pageSize = 500;
      let hasMore = true;
      let allSbProducts = [];

      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
          console.error('❌ خطأ في جلب جدول products من Supabase:', error.message);
          break;
        }

        if (data && data.length > 0) {
          allSbProducts = allSbProducts.concat(data);
          page++;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      if (allSbProducts.length > 0) {
        const currentLocal = readJson(PRODUCTS_FILE, []);
        const localMap = new Map();
        currentLocal.forEach(p => {
          if (p.code) localMap.set(String(p.code).toUpperCase(), p);
          if (p.id) localMap.set(String(p.id), p);
        });

        // دمج آمن: تحديث الأسعار والمخزون مع الحفاظ الصارم على الصور، الماركات، والأوصاف
        const merged = allSbProducts.map(p => {
          const loc = localMap.get(String(p.code || '').toUpperCase()) || localMap.get(String(p.id));
          const finalImage = (loc && loc.image && !loc.image.includes('placeholder')) ? loc.image : (p.image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80');
          const finalBrand = (loc && loc.brand && loc.brand !== 'أخرى') ? loc.brand : (p.brand || 'أخرى');
          const finalBrandAr = (loc && loc.brandAr && loc.brandAr !== 'أخرى / عام') ? loc.brandAr : (p.brandAr || 'أخرى / عام');
          const finalDesc = (loc && loc.description) ? loc.description : (p.description || '');
          const finalMainCat = (loc && loc.mainCategory) ? loc.mainCategory : (p.category || 'أجهزة كهربائية كبيرة');
          const finalSubCat = (loc && loc.category) ? loc.category : (p.subcategory || p.category || 'عام');

          return {
            id: p.id,
            code: p.code || '',
            name: p.name || '',
            mainCategory: finalMainCat,
            category: finalSubCat,
            costPrice: Number(p.costPrice) || 0,
            sellPrice: Number(p.sellPrice) || 0,
            stock: parseInt(p.stock) || 0,
            unit: p.unit || 'قطعة',
            image: finalImage,
            description: finalDesc,
            barcode: (loc && loc.barcode) ? loc.barcode : (p.barcode || ''),
            isSuspended: loc ? Boolean(loc.isSuspended) : Boolean(p.isSuspended),
            brand: finalBrand,
            brandAr: finalBrandAr,
            images: Array.isArray(p.images) && p.images.length > 0 ? p.images : (loc && Array.isArray(loc.images) ? loc.images : []),
            lastStockUpdate: p.lastStockUpdate || (loc ? loc.lastStockUpdate : null),
            lastStockEditor: p.lastStockEditor || (loc ? loc.lastStockEditor : null),
            createdAt: p.createdAt || (loc ? loc.createdAt : new Date().toISOString()),
            updatedAt: p.updatedAt || (loc ? loc.updatedAt : null),
            lastSyncAt: p.lastSyncAt || (loc ? loc.lastSyncAt : null)
          };
        });

        writeJson(PRODUCTS_FILE, merged);
        _productsCache = merged;
        _productsCacheTime = Date.now();
        console.log(`✅ تم دمج وتحديث ${merged.length} صنف من Supabase مع الحفاظ على التخصيصات`);
      } else if (!snapRow || !snapRow.data || snapRow.data.length === 0) {
        // حماية البيانات: إذا كانت الجداول السحابية فارغة، لا تمسح الملف المحلي
        const local = readJson(PRODUCTS_FILE, []);
        _productsCache = Array.isArray(local) ? local : [];
        _productsCacheTime = Date.now();
        console.log(`ℹ️ جدول Supabase السحابي فارغ - تم الحفاظ على ${_productsCache.length} صنف من النسخة المحلية المتزامنة`);
      }
    } catch (pErr) {
      console.error('❌ خطأ في استعادة المنتجات:', pErr.message);
    }

    // 6. استعادة الزبائن — settings.customers أولاً (snapshot المزامنة الكامل مع تاريخ الفروقات) ثم جدول customers المباشر
    try {
      let custData = null;
      const { data: cRow } = await supabase.from('settings').select('data').eq('id', 'customers').maybeSingle();
      if (cRow && Array.isArray(cRow.data) && cRow.data.length > 0) {
        custData = cRow.data;
        console.log(`✅ تم استعادة ${custData.length} زبون بأرصدتهم وتواريخ حركاتهم الدائمة من settings`);
      } else {
        const { data: cTable, error: cErr } = await supabase.from('customers').select('*').order('name');
        if (!cErr && Array.isArray(cTable) && cTable.length > 0) {
          custData = cTable;
          console.log(`✅ تم استعادة ${custData.length} زبون من جدول customers الأساسي في Supabase`);
        }
      }
      if (custData && custData.length > 0) {
        writeJson(CUSTOMERS_FILE, custData);
      }
    } catch (cErr) {
      console.warn('⚠️ تعذر استعادة الزبائن من Supabase:', cErr.message);
    }

        // 7. استعادة الموردين — settings.suppliers أولاً (يُحدَّث عند كل مزامنة) ثم جدول suppliers
    try {
      const EXCLUDED_SUPPLIER_CODES = ['S00000003'];
      let suppData = null;

      // المصدر الأول: settings.suppliers — يُحدَّث تلقائياً عند كل مزامنة من ShamelSyncPro
      const { data: sRow } = await supabase.from('settings').select('data').eq('id', 'suppliers').maybeSingle();
      if (sRow && Array.isArray(sRow.data) && sRow.data.length > 0) {
        suppData = sRow.data;
        console.log('✅ تم استعادة ' + suppData.length + ' مورد بأرصدتهم الحديثة من settings (snapshot مزامنة الشامل)');
      } else {
        // المصدر الثاني: جدول suppliers المباشر (fallback)
        const { data: sTable, error: sErr } = await supabase.from('suppliers').select('*').order('name');
        if (!sErr && Array.isArray(sTable) && sTable.length > 0) {
          suppData = sTable;
          console.log('✅ تم استعادة ' + suppData.length + ' مورد من جدول suppliers الأساسي في Supabase');
        }
      }

      if (suppData && suppData.length > 0) {
        const cleanSuppliers = suppData.filter(function(s) {
          const code = String(s.shamelCode || '').toUpperCase();
          const name = String(s.name || '');
          return !EXCLUDED_SUPPLIER_CODES.includes(code) && !name.includes('بضاعة قديمة');
        });
        writeJson(SUPPLIERS_FILE, cleanSuppliers);
      }
    } catch (sErr) {
      console.warn('⚠️ تعذر استعادة الموردين من Supabase:', sErr.message);
    }

    // 8. استعادة بيانات المزامنة الأخيرة (sync_meta)
    try {
      const { data: mRow } = await supabase.from('settings').select('data').eq('id', 'sync_meta').maybeSingle();
      if (mRow && mRow.data) {
        writeJson(path.join(DATA_DIR, 'sync_meta.json'), mRow.data);
      }
      const { data: mcRow } = await supabase.from('settings').select('data').eq('id', 'sync_customers_meta').maybeSingle();
      if (mcRow && mcRow.data) {
        writeJson(path.join(DATA_DIR, 'sync_customers_meta.json'), mcRow.data);
      }
      const { data: msRow } = await supabase.from('settings').select('data').eq('id', 'sync_suppliers_meta').maybeSingle();
      if (msRow && msRow.data) {
        writeJson(path.join(DATA_DIR, 'sync_suppliers_meta.json'), msRow.data);
      }
    } catch (mErr) {
      console.warn('⚠️ تعذر استعادة بيانات المزامنة الوصفية:', mErr.message);
    }

    // 9. استعادة إعدادات المتجر (store_config) من Supabase
    try {
      const { data: scRow } = await supabase.from('settings').select('data').eq('id', 'store_config').maybeSingle();
      if (scRow && scRow.data && typeof scRow.data === 'object' && Object.keys(scRow.data).length > 0) {
        writeJson(STORE_CONFIG_FILE, scRow.data);
        console.log('✅ تم استعادة إعدادات المتجر (store_config) من Supabase');
      }
    } catch (scErr) {
      console.warn('⚠️ تعذر استعادة إعدادات المتجر من Supabase:', scErr.message);
    }
  },

  /**
   * تحديث ماركات الأصناف بشكل مجمع وحفظها في Supabase والملف المحلي
   */
  async bulkUpdateBrands(updates, editorName = 'مدير النظام') {
    const products = this.getProducts();
    const updateMap = new Map();
    (updates || []).forEach(u => {
      if (u.code) updateMap.set(String(u.code).toUpperCase(), u);
      if (u.id) updateMap.set(String(u.id), u);
    });

    let modifiedCount = 0;
    const modifiedProducts = [];
    const now = new Date().toISOString();

    products.forEach(p => {
      const u = (p.code && updateMap.get(String(p.code).toUpperCase())) || (p.id && updateMap.get(String(p.id)));
      if (u && (p.brand !== u.brand || p.brandAr !== u.brandAr)) {
        p.brand = u.brand;
        p.brandAr = u.brandAr;
        p.updatedAt = now;
        modifiedCount++;
        modifiedProducts.push(p);
      }
    });

    if (modifiedCount > 0) {
      writeJson(PRODUCTS_FILE, products);
      _productsCache = products;
      _productsCacheTime = Date.now();

      if (supabase) {
        try {
          await supabase.from('settings').upsert({
            id: 'products_snapshot',
            data: products
          });

          const chunkSize = 50;
          for (let i = 0; i < modifiedProducts.length; i += chunkSize) {
            const chunk = modifiedProducts.slice(i, i + chunkSize);
            const upsertRows = chunk.map(p => ({
              id: String(p.id),
              code: String(p.code || '').trim(),
              name: String(p.name || '').trim(),
              category: String(p.mainCategory || p.category || 'أجهزة كهربائية كبيرة'),
              subcategory: String(p.category || 'عام'),
              costPrice: Number(p.costPrice) || 0,
              sellPrice: Number(p.sellPrice) || 0,
              stock: parseInt(p.stock) || 0,
              unit: String(p.unit || 'قطعة'),
              image: String(p.image || ''),
              description: String(p.description || ''),
              barcode: String(p.barcode || ''),
              isSuspended: Boolean(p.isSuspended),
              brand: String(p.brand || 'أخرى'),
              brandAr: String(p.brandAr || 'أخرى / عام'),
              images: Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []),
              updatedAt: p.updatedAt || now
            }));
            await supabase.from('products').upsert(upsertRows, { onConflict: 'id' });
          }
          console.log(`✅ تم حفظ تحديث ماركات ${modifiedCount} صنف في قاعدة بيانات Supabase الدائمة بنجاح.`);
        } catch (err) {
          console.warn('⚠️ خطأ أثناء تحديث الماركات في Supabase:', err.message);
        }
      }
    }

    return { success: true, updatedCount: modifiedCount };
  },


  // ================================================================
  // إدارة إعدادات وتخصيص المتجر الإلكتروني العام (Store Config)
  // ================================================================
  getStoreConfig() {
    const defaultConfig = {
      storeSettings: {
        heroTitle: 'كل ما يحتاجه بيتك، في مكان واحد.',
        heroSubtitle: 'معرض الأجهزة الكهربائية والمنزلية المعتمد • أفضل الموديلات والأسعار المكفولة مع إمكانية الطلب المباشر والتوصيل لكافة المناطق',
        heroBadge: '🌟 المعرض المعتمد 2026',
        announcementText: '🚚 توصيل سريع لكافة المناطق والدفع عند الاستلام • 🛡️ بضاعة أصلية ومكفولة بالكامل • 💬 خدمة عملاء مباشرة',
        announcementActive: true,
        phone: '0599000000',
        whatsapp: '0599000000',
        address: 'جنين / يعبد - الشارع الرئيسي',
        workHours: 'يومياً من 8:00 صباحاً حتى 9:00 مساءً',
        currency: 'شيكل',
        showOnlyInStock: true
      },
      categories: [],
      brands: [],
      offers: [],
      popupOffer: {
        enabled: true,
        title: '🎉 مرحباً بكم في المعرض والمتجر الرسمي!',
        subtitle: 'تصفح أحدث الأجهزة المنزلية والكهربائية المتوفرة بالمستودع بأسعار معتمدة ومكفولة.',
        badge: 'عرض خاص',
        image: '',
        buttonText: 'تصفّح المعرض الآن',
        buttonLink: '#categoriesSection'
      },
      customProductNames: {},
      manuallyShownOutOfStock: []
    };
    return readJson(STORE_CONFIG_FILE, defaultConfig);
  },

  saveStoreConfig(newConfig) {
    const current = this.getStoreConfig();
    const updated = {
      ...current,
      ...newConfig,
      storeSettings: {
        ...(current.storeSettings || {}),
        ...(newConfig.storeSettings || {})
      },
      popupOffer: {
        ...(current.popupOffer || {}),
        ...(newConfig.popupOffer || {})
      }
    };
    writeJson(STORE_CONFIG_FILE, updated);
    // مزامنة إعدادات المتجر مع Supabase لمشاركتها مع السيرفرات الأخرى
    syncStoreConfigToSupabase(updated).catch(err => {
      console.warn('⚠️ تعذر مزامنة إعدادات المتجر مع Supabase:', err.message);
    });
    notifyStoreServers();
    return updated;
  },

  updateCustomProductName(productId, customName) {
    const config = this.getStoreConfig();
    if (!config.customProductNames) config.customProductNames = {};
    if (customName && customName.trim()) {
      config.customProductNames[String(productId)] = customName.trim();
    } else {
      delete config.customProductNames[String(productId)];
    }
    writeJson(STORE_CONFIG_FILE, config);
    syncStoreConfigToSupabase(config).catch(() => {});
    notifyStoreServers();
    return config;
  },

  toggleManualOutOfStock(productId, forceShow) {
    const config = this.getStoreConfig();
    if (!Array.isArray(config.manuallyShownOutOfStock)) config.manuallyShownOutOfStock = [];
    const pId = String(productId);
    const idx = config.manuallyShownOutOfStock.indexOf(pId);
    if (forceShow && idx === -1) {
      config.manuallyShownOutOfStock.push(pId);
    } else if (!forceShow && idx !== -1) {
      config.manuallyShownOutOfStock.splice(idx, 1);
    }
    writeJson(STORE_CONFIG_FILE, config);
    syncStoreConfigToSupabase(config).catch(() => {});
    notifyStoreServers();
    return config;
  },

  // ================================================================
  // إدارة الطلبات الإلكترونية القادمة من المتجر (Web Store Orders)
  // ================================================================
  getOrders() {
    const orders = readJson(ORDERS_FILE, []);
    return orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  },

  getOrderById(id) {
    const orders = this.getOrders();
    return orders.find(o => String(o.id) === String(id));
  },

  createOrder(orderData) {
    const orders = this.getOrders();
    const currentYear = new Date().getFullYear();
    const prefix = 'ORD-' + currentYear + '-';
    
    // Find next order number
    let maxNum = 0;
    orders.forEach(o => {
      if (o.id && String(o.id).startsWith(prefix)) {
        const numPart = parseInt(String(o.id).replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    const nextNum = maxNum + 1;
    const orderId = prefix + String(nextNum).padStart(4, '0');

    // Calculate items
    let totalAmount = 0;
    const sanitizedItems = (orderData.items || []).map(it => {
      const price = Math.round(parseFloat(it.price) || 0);
      const qty = Math.max(1, parseInt(it.qty) || 1);
      const lineTotal = price * qty;
      totalAmount += lineTotal;
      return {
        id: String(it.id),
        name: String(it.name || '').trim(),
        code: String(it.code || '').trim(),
        brand: String(it.brand || '').trim(),
        price: price,
        qty: qty,
        total: lineTotal,
        image: it.image || ''
      };
    });

    const newOrder = {
      id: orderId,
      customer: {
        name: String(orderData.customer?.name || 'زبون المتجر').trim(),
        phone: String(orderData.customer?.phone || '').trim(),
        address: String(orderData.customer?.address || '').trim(),
        notes: String(orderData.customer?.notes || '').trim()
      },
      items: sanitizedItems,
      totalAmount: Math.round(totalAmount),
      status: 'pending', // 'pending' | 'approved' | 'cancelled'
      createdAt: new Date().toISOString(),
      approvedAt: null,
      approvedBy: null,
      telegramSent: false,
      telegramError: null,
      source: 'web_store'
    };

    orders.unshift(newOrder);
    writeJson(ORDERS_FILE, orders);
    return newOrder;
  },

  updateOrderTelegramStatus(orderId, sent, error = null) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => String(o.id) === String(orderId));
    if (idx !== -1) {
      orders[idx].telegramSent = Boolean(sent);
      orders[idx].telegramError = error ? String(error) : null;
      writeJson(ORDERS_FILE, orders);
      return orders[idx];
    }
    return null;
  },

  approveOrder(orderId, approvedBy = 'الإدارة') {
    const orders = this.getOrders();
    const orderIdx = orders.findIndex(o => String(o.id) === String(orderId));
    if (orderIdx === -1) {
      throw new Error('الطلب غير موجود في النظام: ' + orderId);
    }
    const order = orders[orderIdx];
    if (order.status === 'approved') {
      throw new Error('تم اعتماد هذا الطلب وخصم كمياته من المخزون مسبقاً.');
    }

    // Deduct stock for each item in products.json
    const products = this.getProducts();
    const updatedProductsList = [];
    const nowIso = new Date().toISOString();

    for (const item of (order.items || [])) {
      const pIdx = products.findIndex(p => String(p.id) === String(item.id));
      if (pIdx !== -1) {
        const prod = products[pIdx];
        const prevStock = parseInt(prod.stock) || 0;
        const deductQty = parseInt(item.qty) || 1;
        prod.stock = Math.max(0, prevStock - deductQty);
        prod.lastStockUpdate = nowIso;
        prod.lastStockEditor = 'اعتماد طلب متجر #' + order.id + ' (' + (approvedBy || 'الإدارة') + ')';
        prod.updatedAt = nowIso;
        updatedProductsList.push(prod);

        // Sync to Supabase in background
        syncProductToSupabase(prod).catch(err => {
          console.warn('⚠️ Supabase sync after order approval:', err.message);
        });
      }
    }

    // Save updated products
    writeJson(PRODUCTS_FILE, products);

    // Update order status
    order.status = 'approved';
    order.approvedAt = nowIso;
    order.approvedBy = approvedBy || 'الإدارة';
    orders[orderIdx] = order;
    writeJson(ORDERS_FILE, orders);

    console.log(`✅ تم اعتماد الطلب #${order.id} بنجاح وخصم المخزون لـ ${updatedProductsList.length} صنف.`);
    return { success: true, order, updatedProductsCount: updatedProductsList.length };
  },

  cancelOrder(orderId, reason = '', cancelledBy = 'الإدارة') {
    const orders = this.getOrders();
    const orderIdx = orders.findIndex(o => String(o.id) === String(orderId));
    if (orderIdx === -1) {
      throw new Error('الطلب غير موجود في النظام: ' + orderId);
    }
    const order = orders[orderIdx];
    order.status = 'cancelled';
    order.cancelledAt = new Date().toISOString();
    order.cancelledBy = cancelledBy || 'الإدارة';
    order.cancelReason = reason || 'تم الإلغاء بواسطة الإدارة';
    orders[orderIdx] = order;
    writeJson(ORDERS_FILE, orders);
    return { success: true, order };
  },

  // تحديث دوري ذكي من سيرفر الأدمن المباشر ومن Supabase
  async refreshFromCloud() {
    const results = { updated: [] };
    const adminUrl = process.env.ADMIN_URL || 'https://aboramez1-admin.onrender.com';
    const currentHost = (process.env.RENDER_EXTERNAL_HOSTNAME || '').toLowerCase();
    const isStoreOnly = (process.env.APP_MODE || '').toLowerCase() === 'store_only' || currentHost.includes('aboramez1.') || currentHost.includes('aboramez.store');

    const withTimeout = (promise, ms = 6000) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout after ' + ms + 'ms')), ms))
    ]);

    // 1. إذا كان هذا السيرفر هو متجر الزبائن، اسحب فوراً أحدث الإعدادات والمنتجات من سيرفر الأدمن الحي
    if (isStoreOnly && adminUrl && !currentHost.includes('admin')) {
      try {
        const fetchMod = adminUrl.startsWith('https') ? require('https') : require('http');
        const adminConfig = await new Promise((resolve, reject) => {
          const req = fetchMod.get(adminUrl + '/api/admin/store-config', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
          });
          req.on('error', reject);
          req.setTimeout(5000, () => { req.destroy(); reject(new Error('Admin store-config timeout')); });
        });

        if (adminConfig && adminConfig.config) {
          writeJson(STORE_CONFIG_FILE, adminConfig.config);
          results.updated.push('store_config_from_admin');
        }
      } catch (adminErr) {
        console.warn('⚠️ تعذر السحب المباشر من سيرفر الأدمن:', adminErr.message);
      }
    }

    // 2. مزامنة قاعدة بيانات Supabase (مع مهلة أمان لمنع التعليق عند انقطاع السحابة)
    if (supabase) {
      try {
        // أ) تحديث إعدادات المتجر من Supabase إذا لم تُسحب من الأدمن
        if (!results.updated.includes('store_config_from_admin')) {
          try {
            const scRes = await withTimeout(supabase.from('settings').select('data').eq('id', 'store_config').maybeSingle(), 5000);
            if (scRes && scRes.data && scRes.data.data && typeof scRes.data.data === 'object' && Object.keys(scRes.data.data).length > 0) {
              writeJson(STORE_CONFIG_FILE, scRes.data.data);
              results.updated.push('store_config_from_supabase');
            }
          } catch (e) {
            console.warn('⚠️ Supabase store_config check timed out / failed:', e.message);
          }
        }

        // ب) تحديث المنتجات من جدول products
        try {
          let allSbProducts = [];
          let page = 0;
          const pageSize = 500;
          let hasMore = true;
          while (hasMore) {
            const { data, error } = await withTimeout(
              supabase.from('products').select('*').range(page * pageSize, (page + 1) * pageSize - 1),
              8000
            );
            if (error) break;
            if (data && data.length > 0) {
              allSbProducts = allSbProducts.concat(data);
              page++;
              hasMore = data.length === pageSize;
            } else {
              hasMore = false;
            }
          }

          if (allSbProducts.length > 0) {
            const currentLocal = readJson(PRODUCTS_FILE, []);
            const localMap = new Map();
            currentLocal.forEach(p => {
              if (p.code) localMap.set(String(p.code).toUpperCase(), p);
              if (p.id) localMap.set(String(p.id), p);
            });
            const merged = allSbProducts.map(p => {
              const loc = localMap.get(String(p.code || '').toUpperCase()) || localMap.get(String(p.id));
              return {
                id: p.id,
                code: p.code || '',
                name: p.name || '',
                mainCategory: (loc && loc.mainCategory) ? loc.mainCategory : (p.category || 'أجهزة كهربائية كبيرة'),
                category: (loc && loc.category) ? loc.category : (p.subcategory || p.category || 'عام'),
                costPrice: Number(p.costPrice) || 0,
                sellPrice: Number(p.sellPrice) || 0,
                stock: parseInt(p.stock) || 0,
                unit: p.unit || 'قطعة',
                image: (loc && loc.image && !loc.image.includes('placeholder')) ? loc.image : (p.image || ''),
                description: (loc && loc.description) ? loc.description : (p.description || ''),
                barcode: (loc && loc.barcode) ? loc.barcode : (p.barcode || ''),
                isSuspended: loc ? Boolean(loc.isSuspended) : Boolean(p.isSuspended),
                brand: (loc && loc.brand && loc.brand !== 'أخرى') ? loc.brand : (p.brand || 'أخرى'),
                brandAr: (loc && loc.brandAr && loc.brandAr !== 'أخرى / عام') ? loc.brandAr : (p.brandAr || 'أخرى / عام'),
                images: Array.isArray(p.images) && p.images.length > 0 ? p.images : (loc && Array.isArray(loc.images) ? loc.images : []),
                lastStockUpdate: p.lastStockUpdate || (loc ? loc.lastStockUpdate : null),
                lastStockEditor: p.lastStockEditor || (loc ? loc.lastStockEditor : null),
                createdAt: p.createdAt || (loc ? loc.createdAt : new Date().toISOString()),
                updatedAt: p.updatedAt || (loc ? loc.updatedAt : null),
                lastSyncAt: p.lastSyncAt || (loc ? loc.lastSyncAt : null)
              };
            });
            writeJson(PRODUCTS_FILE, merged);
            _productsCache = merged;
            _productsCacheTime = Date.now();
            results.updated.push('products:' + merged.length);
          }
        } catch (pErr) {
          console.warn('⚠️ Supabase products refresh timed out / failed:', pErr.message);
        }

        // ج) تحديث الإعدادات العامة
        try {
          const stRes = await withTimeout(supabase.from('settings').select('data').eq('id', 'general').maybeSingle(), 5000);
          if (stRes && stRes.data && stRes.data.data && typeof stRes.data.data === 'object' && Object.keys(stRes.data.data).length > 0) {
            writeJson(SETTINGS_FILE, stRes.data.data);
            results.updated.push('settings');
          }
        } catch (e) {}

      } catch (err) {
        console.warn('⚠️ خطأ في التحديث الدوري من السحابة:', err.message);
      }
    }

    results.success = true;
    if (results.updated.length > 0) {
      console.log('✅ تحديث دوري ناجح: ' + results.updated.join(', '));
    }
    return results;
  },

};

module.exports = dataStore;
