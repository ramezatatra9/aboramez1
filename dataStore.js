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
    const { error } = await supabase.from('invoices').upsert({
      id: String(invoice.id),
      invoiceNumber: invoice.invoiceNumber,
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
    const { error } = await supabase.from('receipts').upsert({
      id: String(receipt.id),
      receiptNumber: receipt.receiptNumber,
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
    { id: 'u-admin', name: 'المدير العام (أبو رامز)', pin: '1234', role: 'admin' },
    { id: 'u-cashier', name: 'موظف مبيعات / كاشير', pin: '1111', role: 'cashier' }
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
      return Object.assign({}, c, { shamelBalance: shamelBal, balance: rawBal });
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
      const updated = current + parseFloat(deltaAmount);
      const updatedCustomer = {
        ...customers[idx],
        balance: parseFloat(updated.toFixed(2)),
        updatedAt: new Date().toISOString()
      };
      if (supabase) {
        const res = await syncCustomerToSupabase(updatedCustomer);
        if (!res.success) {
          throw new Error('تعذر تحديث رصيد العميل في قاعدة البيانات الدائمة (Supabase): ' + res.error);
        }
      }
      customers[idx] = updatedCustomer;
      writeJson(CUSTOMERS_FILE, customers);
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
  getCustomerStatement(id) {
    const customers = this.getCustomers();
    const strId = String(id || '').trim();
    let customer = customers.find(c =>
      String(c.id).trim() === strId ||
      String(c.systemNumber || '').trim() === strId ||
      c.name.trim().toLowerCase() === strId.toLowerCase()
    );

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
      }
    }

    if (!customer) return null;

    const invoices = this.getInvoices();
    const receipts = this.getReceipts();

    const custInvoices = invoices.filter(inv =>
      (inv.customerId && String(inv.customerId).trim() === String(customer.id).trim()) ||
      (inv.customerSystemNumber && String(inv.customerSystemNumber).trim() === String(customer.systemNumber).trim()) ||
      (inv.customerName && inv.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
    );

    const custReceipts = receipts.filter(rcp =>
      (rcp.customerId && String(rcp.customerId).trim() === String(customer.id).trim()) ||
      (rcp.customerSystemNumber && String(rcp.customerSystemNumber).trim() === String(customer.systemNumber).trim()) ||
      (rcp.customerName && rcp.customerName.trim().toLowerCase() === customer.name.trim().toLowerCase())
    );

    // بناء قائمة الحركات المدمجة
    const transactions = [];

    custInvoices.forEach(inv => {
      const isPurchase = inv.invoiceType === 'purchase';
      const amount = inv.summary?.totalAmount || 0;
      transactions.push({
        type: isPurchase ? 'purchase_invoice' : 'sales_invoice',
        title: isPurchase ? `فاتورة مشتريات #${inv.invoiceNumber || inv.id}` : `فاتورة مبيعات #${inv.invoiceNumber || inv.id}`,
        id: inv.id,
        refNumber: inv.invoiceNumber || inv.id,
        date: inv.createdAt,
        employeeName: inv.employeeName,
        paymentMethod: inv.paymentMethod,
        debit: !isPurchase ? amount : 0,  // مبيعات تزيد الدين على الزبون
        credit: isPurchase ? amount : 0, // مشتريات منه لصالح الزبون
        notes: inv.notes || '',
        itemsCount: (inv.items || []).length
      });
    });

    custReceipts.forEach(rcp => {
      transactions.push({
        type: 'receipt',
        title: `سند قبض مالي #${rcp.receiptNumber}`,
        id: rcp.id,
        refNumber: rcp.receiptNumber,
        date: rcp.createdAt,
        employeeName: rcp.employeeName,
        paymentMethod: rcp.paymentMethod,
        debit: 0,
        credit: rcp.amount || 0, // سند القبض ينقص دينه / يسدده
        notes: rcp.description ? `${rcp.description} ${rcp.notes ? `(${rcp.notes})` : ''}` : (rcp.notes || '')
      });
    });

    // ترتيب الحركات تصاعدياً حسب التاريخ
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalSales = custInvoices.filter(i => i.invoiceType !== 'purchase').reduce((s, i) => s + (i.summary?.totalAmount || 0), 0);
    const totalPaid = custReceipts.reduce((s, r) => s + (r.amount || 0), 0);
    const balance = parseFloat(customer.balance) || 0;

    return {
      customer,
      balance,
      summary: {
        totalSales,
        totalPaid,
        invoicesCount: custInvoices.length,
        receiptsCount: custReceipts.length,
        transactionsCount: transactions.length,
        isDebtor: balance > 0,
        isCreditor: balance < 0,
        isSettled: balance === 0
      },
      invoices: custInvoices,
      receipts: custReceipts,
      transactions
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

      // 4. مزامنة سحابية متوازية مع Supabase كقاعدة بيانات دائمة
      if (supabase) {
        try {
          if (updatedOrNewProducts.length > 0) {
            const supabaseBatch = updatedOrNewProducts.map(p => ({
              id: String(p.id),
              code: String(p.code || '').trim(),
              name: String(p.name || '').trim(),
              // category في الجدول = mainCategory في JS
              category: String(p.mainCategory || p.category || 'أجهزة كهربائية كبيرة'),
              // subcategory في الجدول = category (الفرعي) في JS
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

            // تحديث جدول products
            const { error: sbErr } = await supabase.from('products').upsert(supabaseBatch);
            if (sbErr) {
              console.error('Supabase batch upsert error:', sbErr.message);
              summary.errors.push(`Supabase sync warning: ${sbErr.message}`);
            }

            // حفظ لقطة المنتجات الكاملة في جدول settings للحفاظ على الماركات والتصنيفات بدقة
            await supabase.from('settings').upsert({
              id: 'products_snapshot',
              data: products
            });
          }

          // حفظ بيانات المزامنة الأخيرة في قاعدة بيانات الإنتاج الدائمة
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

          await supabase.from('settings').upsert({
            id: 'sync_meta',
            data: syncMetaObj
          });

          // كتابة الملف المحلي
          const syncMetaFile = path.join(DATA_DIR, 'sync_meta.json');
          writeJson(syncMetaFile, syncMetaObj);

          // 5. التحقق الحقيقي من الحفظ بقراءة عينة من قاعدة البيانات بعد الكتابة
          const verifyCodes = updatedOrNewProducts.length > 0 
            ? updatedOrNewProducts.slice(0, 3).map(p => p.code)
            : (items.slice(0, 3).map(it => it.code).filter(Boolean));

          if (verifyCodes.length > 0) {
            const { data: vRows, error: vErr } = await supabase
              .from('products')
              .select('code, name, sellPrice, stock')
              .in('code', verifyCodes);

            if (!vErr && vRows && vRows.length > 0) {
              verifiedSample = vRows;
              persisted = true;
            } else if (!vErr) {
              persisted = true;
            }
          } else {
            persisted = true;
          }

        } catch (sbEx) {
          console.error('Supabase batch exception:', sbEx.message);
          summary.errors.push(`خطأ في الكتابة لقاعدة البيانات الدائمة: ${sbEx.message}`);
        }
      } else {
        // تنبيه صارم عند عدم اتصال قاعدة البيانات الدائمة
        summary.errors.push('تنبيه: قاعدة بيانات الإنتاج الدائمة (Supabase) غير متصلة بالسيرفر! الحفظ جرى في الذاكرة المؤقتة فقط وستختفي التعديلات عند إعادة تشغيل السيرفر.');
      }
    }

    return {
      success: summary.errors.length === 0 && (persisted || dryRun),
      persisted,
      verifiedSample,
      storageType: supabase ? 'Supabase Cloud PostgreSQL' : 'Local Ephemeral Container',
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
          const hasBalDiff = itemBal !== undefined && Math.abs(curBal - itemBal) > 0.01;
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
            let previousBalance = cur.previousBalance !== undefined ? cur.previousBalance : curBal;
            let balanceDifference = cur.balanceDifference || 0;
            let balanceHistory = Array.isArray(cur.balanceHistory) ? [...cur.balanceHistory] : [];

            if (hasBalDiff) {
              lastBalanceDiffDate = now;
              previousBalance = curBal;
              balanceDifference = Math.round((itemBal - curBal) * 100) / 100;
              balanceHistory.unshift({
                date: now,
                oldBalance: curBal,
                newBalance: itemBal,
                difference: balanceDifference,
                source: 'shamel_sync'
              });
              if (balanceHistory.length > 50) balanceHistory = balanceHistory.slice(0, 50);
            }

            updatedCustomers[existingIdx] = {
              ...cur,
              name,
              phone: phone || cur.phone || '',
              mobile: mobile || cur.mobile || '',
              email: email || cur.email || '',
              address: address || cur.address || '',
              notes: notes || cur.notes || '',
              isStopped,
              shamelBalance: itemBal !== undefined ? itemBal : (parseFloat(cur.shamelBalance !== undefined ? cur.shamelBalance : cur.balance) || 0),
              balance: itemBal !== undefined ? itemBal : (parseFloat(cur.balance) || 0),
              lastBalanceDiffDate,
              lastBalanceChangeDate: lastBalanceDiffDate,
              previousBalance,
              balanceDifference,
              balanceHistory,
              shamelCode,
              systemNumber: cur.systemNumber || shamelCode,
              syncedAt: now,
              syncedBy: editorName
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

      // مزامنة مع Supabase كقاعدة بيانات إنتاج دائمة
      if (supabase) {
        try {
          // 1. حفظ سجلات الزبائن الكاملة في جدول settings للحفظ الدائم المضمون
          await supabase.from('settings').upsert({
            id: 'customers',
            data: updatedCustomers
          });

          // 2. تحديث meta المزامنة للزبائن في قاعدة البيانات الدائمة
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

          await supabase.from('settings').upsert({
            id: 'sync_customers_meta',
            data: custMeta
          });

          writeJson(path.join(DATA_DIR, 'sync_customers_meta.json'), custMeta);

          // 3. التحقق بقراءة عينة للتأكد من نجاح الحفظ
          const { data: readBack } = await supabase.from('settings').select('data').eq('id', 'customers').maybeSingle();
          if (readBack && Array.isArray(readBack.data)) {
            persisted = true;
            verifiedSample = readBack.data.slice(0, 3).map(c => ({
              code: c.systemNumber || c.shamelCode,
              name: c.name,
              balance: c.balance
            }));
          }

          // محاولة اختيارية لتحديث جدول customers إن وُجد (non-blocking)
          try {
            const sb = updatedCustomers.filter(c => c.source === 'shamel_sync' || c.shamelCode).map(c => ({
              id: String(c.id),
              systemNumber: String(c.systemNumber || c.shamelCode || ''),
              name: String(c.name || ''),
              phone: String(c.phone || ''),
              email: String(c.email || ''),
              address: String(c.address || ''),
              notes: String(c.notes || ''),
              isStopped: Boolean(c.isStopped),
              balance: parseFloat(c.balance) || 0,
              createdAt: c.createdAt || now
            }));
            if (sb.length > 0) await supabase.from('customers').upsert(sb);
          } catch (_) {}

        } catch (sbEx) {
          console.error('Supabase customers sync error:', sbEx.message);
          summary.errors.push(`خطأ في حفظ الزبائن بقاعدة البيانات الدائمة: ${sbEx.message}`);
        }
      } else {
        summary.errors.push('تنبيه: قاعدة بيانات الإنتاج الدائمة (Supabase) غير متصلة بالسيرفر! الحفظ جرى في الذاكرة المؤقتة فقط.');
      }
    }

    return {
      success: summary.failed === 0 || (summary.created + summary.updated + summary.unchanged) > 0,
      persisted,
      verifiedSample,
      storageType: supabase ? 'Supabase Cloud PostgreSQL' : 'Local Ephemeral Container',
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
        return Object.assign({}, s, { shamelBalance: shamelBal, balance: rawBal });
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
          const curBal = parseFloat(cur.balance) || 0;
          const hasBalDiff = itemBal !== undefined && Math.abs(curBal - itemBal) > 0.01;
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
            let previousBalance = cur.previousBalance !== undefined ? cur.previousBalance : curBal;
            let balanceDifference = cur.balanceDifference || 0;
            let balanceHistory = Array.isArray(cur.balanceHistory) ? [...cur.balanceHistory] : [];

            if (hasBalDiff) {
              lastBalanceDiffDate = now;
              previousBalance = curBal;
              balanceDifference = Math.round((itemBal - curBal) * 100) / 100;
              balanceHistory.unshift({
                date: now,
                oldBalance: curBal,
                newBalance: itemBal,
                difference: balanceDifference,
                source: 'shamel_sync'
              });
              if (balanceHistory.length > 50) balanceHistory = balanceHistory.slice(0, 50);
            }

            updatedSuppliers[existingIdx] = {
              ...cur,
              name,
              phone: phone || cur.phone || '',
              mobile: mobile || cur.mobile || '',
              email: email || cur.email || '',
              address: address || cur.address || '',
              notes: notes || cur.notes || '',
              isStopped,
              shamelBalance: itemBal !== undefined ? itemBal : (parseFloat(cur.shamelBalance !== undefined ? cur.shamelBalance : cur.balance) || 0),
              balance: itemBal !== undefined ? itemBal : (parseFloat(cur.balance) || 0),
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

      // مزامنة مع Supabase كقاعدة بيانات إنتاج دائمة
      if (supabase) {
        try {
          // 1. حفظ الموردين الدائمين في جدول settings
          await supabase.from('settings').upsert({
            id: 'suppliers',
            data: updatedSuppliers
          });

          // 2. تحديث meta المزامنة في قاعدة البيانات الدائمة
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

          await supabase.from('settings').upsert({
            id: 'sync_suppliers_meta',
            data: suppMeta
          });

          writeJson(path.join(DATA_DIR, 'sync_suppliers_meta.json'), suppMeta);

          // 3. التحقق بقراءة عينة
          const { data: readBack } = await supabase.from('settings').select('data').eq('id', 'suppliers').maybeSingle();
          if (readBack && Array.isArray(readBack.data)) {
            persisted = true;
            verifiedSample = readBack.data.slice(0, 3).map(s => ({ code: s.shamelCode, name: s.name, balance: s.balance }));
          }

          // محاولة اختيارية لتحديث جدول suppliers إن وجد
          try {
            const sb = updatedSuppliers.map(s => ({
              id: String(s.id),
              shamelCode: String(s.shamelCode || ''),
              name: String(s.name || ''),
              phone: String(s.phone || ''),
              email: String(s.email || ''),
              address: String(s.address || ''),
              notes: String(s.notes || ''),
              isStopped: Boolean(s.isStopped),
              balance: parseFloat(s.balance) || 0,
              createdAt: s.createdAt || now
            }));
            if (sb.length > 0) await supabase.from('suppliers').upsert(sb);
          } catch (_) {}

        } catch (sbEx) {
          console.error('Supabase suppliers sync error:', sbEx.message);
          summary.errors.push(`خطأ في حفظ الموردين بقاعدة البيانات الدائمة: ${sbEx.message}`);
        }
      } else {
        summary.errors.push('تنبيه: قاعدة بيانات الإنتاج الدائمة (Supabase) غير متصلة بالسيرفر! الحفظ جرى في الذاكرة المؤقتة فقط.');
      }
    }

    return {
      success: summary.failed === 0 || (summary.created + summary.updated + summary.unchanged) > 0,
      persisted,
      verifiedSample,
      storageType: supabase ? 'Supabase Cloud PostgreSQL' : 'Local Ephemeral Container',
      dryRun,
      summary,
      totalSuppliers: updatedSuppliers.length,
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

    // 2. الفواتير
    try {
      const { data: invRows, error: invErr } = await supabase.from('invoices').select('*').order('invoiceNumber', { ascending: false });
      if (!invErr && Array.isArray(invRows) && invRows.length > 0) {
        writeJson(INVOICES_FILE, invRows);
        console.log(`✅ تم استعادة ${invRows.length} فاتورة من Supabase`);
      }
    } catch (e) {
      console.warn('⚠️ تعذر استعادة الفواتير من Supabase:', e.message);
    }

    // 3. سندات القبض
    try {
      const { data: rcpRows, error: rcpErr } = await supabase.from('receipts').select('*').order('receiptNumber', { ascending: false });
      if (!rcpErr && Array.isArray(rcpRows) && rcpRows.length > 0) {
        writeJson(RECEIPTS_FILE, rcpRows);
        console.log(`✅ تم استعادة ${rcpRows.length} سند قبض من Supabase`);
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

    // 6. استعادة الزبائن الدائمين (من جدول customers مباشرة مع fallback لـ settings)
    try {
      let custData = null;
      const { data: cTable, error: cErr } = await supabase.from('customers').select('*').order('name');
      if (!cErr && Array.isArray(cTable) && cTable.length > 0) {
        custData = cTable;
        console.log(`✅ تم استعادة ${custData.length} زبون من جدول customers الأساسي في Supabase`);
      } else {
        const { data: cRow } = await supabase.from('settings').select('data').eq('id', 'customers').maybeSingle();
        if (cRow && Array.isArray(cRow.data) && cRow.data.length > 0) {
          custData = cRow.data;
          console.log(`✅ تم استعادة ${custData.length} زبون بأرصدتهم الدائمة من snapshot في settings`);
        }
      }
      if (custData && custData.length > 0) {
        writeJson(CUSTOMERS_FILE, custData);
      }
    } catch (cErr) {
      console.warn('⚠️ تعذر استعادة الزبائن من Supabase:', cErr.message);
    }

    // 7. استعادة الموردين (من جدول suppliers مباشرة مع fallback لـ settings واستبعاد مورد بضاعة قديمة)
    try {
      const EXCLUDED_SUPPLIER_CODES = ['S00000003'];
      let suppData = null;
      const { data: sTable, error: sErr } = await supabase.from('suppliers').select('*').order('name');
      if (!sErr && Array.isArray(sTable) && sTable.length > 0) {
        suppData = sTable;
        console.log(`✅ تم استعادة ${suppData.length} مورد من جدول suppliers الأساسي في Supabase`);
      } else {
        const { data: sRow } = await supabase.from('settings').select('data').eq('id', 'suppliers').maybeSingle();
        if (sRow && Array.isArray(sRow.data) && sRow.data.length > 0) {
          suppData = sRow.data;
          console.log(`✅ تم استعادة ${suppData.length} مورد من snapshot في settings`);
        }
      }
      if (suppData && suppData.length > 0) {
        const cleanSuppliers = suppData.filter(s => {
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

};

module.exports = dataStore;
