const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabaseClient');
const { categorizeProduct, getDefaultImageForCategory } = require('./categoryHelper');

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

// مزامنة خلفية غير معطلة مع Supabase (Non-blocking background sync)
async function syncProductToSupabase(product) {
  if (!supabase) return;
  try {
    await supabase.from('products').upsert({
      id: String(product.id),
      code: String(product.code || ''),
      name: String(product.name || ''),
      category: String(product.mainCategory || product.category || 'عام'),
      subcategory: String(product.category || ''),
      costPrice: Number(product.costPrice) || 0,
      sellPrice: Number(product.sellPrice) || 0,
      stock: parseInt(product.stock) || 0,
      unit: String(product.unit || 'قطعة'),
      image: String(product.image || ''),
      description: String(product.description || ''),
      lastStockUpdate: product.lastStockUpdate || null,
      lastStockEditor: product.lastStockEditor || null,
      createdAt: product.createdAt || new Date().toISOString()
    });
  } catch (err) {
    console.error('Supabase product sync error:', err.message);
  }
}

async function deleteProductFromSupabase(id) {
  if (!supabase) return;
  try {
    await supabase.from('products').delete().eq('id', id);
  } catch (err) {
    console.error('Supabase product delete error:', err.message);
  }
}

async function syncInvoiceToSupabase(invoice) {
  if (!supabase) return;
  try {
    await supabase.from('invoices').upsert({
      id: String(invoice.id),
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      employeeName: invoice.employeeName,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      notes: invoice.notes,
      items: invoice.items,
      summary: invoice.summary,
      paymentMethod: invoice.paymentMethod,
      installmentDetails: invoice.installmentDetails,
      telegramStatus: invoice.telegramStatus
    });
  } catch (err) {
    console.error('Supabase invoice sync error:', err.message);
  }
}

async function syncReceiptToSupabase(receipt) {
  if (!supabase) return;
  try {
    await supabase.from('receipts').upsert({
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
    });
  } catch (err) {
    console.error('Supabase receipt sync error:', err.message);
  }
}

async function deleteReceiptFromSupabase(id) {
  if (!supabase) return;
  try {
    await supabase.from('receipts').delete().eq('id', id);
  } catch (err) {
    console.error('Supabase receipt delete error:', err.message);
  }
}

async function syncWarrantyToSupabase(warranty) {
  if (!supabase) return;
  try {
    await supabase.from('warranties').upsert({
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
      status: warranty.status
    });
  } catch (err) {
    // Non-blocking notice
  }
}

async function deleteWarrantyFromSupabase(id) {
  if (!supabase) return;
  try {
    await supabase.from('warranties').delete().eq('id', id);
  } catch (err) {
    // Non-blocking notice
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
  if (!supabase) return;
  try {
    await supabase.from('settings').upsert({
      id: 'general',
      data: settings
    });
  } catch (err) {
    console.error('Supabase settings sync error:', err.message);
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
  invoiceFooterText: "شكراً لتعاملكم معنا - بضاعة الشركة مكفولة حسب شروط الضمان"
};

// منتجات أولية تجريبية متنوعة ذات صور حقيقية وعالية الجودة
const defaultProducts = [
  {
    id: "prod-1",
    code: "TV-SAM-55",
    name: "شاشة سامسونج 55 بوصة Smart 4K UHD",
    category: "شاشات وتلفزيونات",
    costPrice: 1350,
    sellPrice: 1850,
    stock: 14,
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80",
    description: "شاشة ذكية فائقة الوضوح مع تقنية HDR ونظام Tizen، تدعم جميع التطبيقات.",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-2",
    code: "LAP-DELL-15",
    name: "لابتوب Dell Inspiron 15 (Core i7 / 16GB / 512GB SSD)",
    category: "أجهزة كمبيوتر ولابتوب",
    costPrice: 2400,
    sellPrice: 3100,
    stock: 8,
    image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80",
    description: "لابتوب أداء عالي مناسب للأعمال والبرمجة والتصميم، شاشة مضادة للتوهج.",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-3",
    code: "PHN-IPH-15P",
    name: "هاتف iPhone 15 Pro Max سعة 256GB تيتانيوم",
    category: "هواتف ذكية",
    costPrice: 3800,
    sellPrice: 4450,
    stock: 12,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80",
    description: "معالج A17 Pro، كاميرا احترافية 48MP، هيكل من التيتانيوم القوي والخفيف.",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-4",
    code: "AIR-APL-PRO",
    name: "سماعات Apple AirPods Pro (الجيل الثاني Type-C)",
    category: "إكسسوارات وسماعات",
    costPrice: 650,
    sellPrice: 890,
    stock: 25,
    image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600&auto=format&fit=crop&q=80",
    description: "عزل ضوضاء نشط مضاعف، صوت مكاني مخصص، بطارية تدوم حتى 30 ساعة مع العلبة.",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-5",
    code: "WCH-SAM-6C",
    name: "ساعة سامسونج Galaxy Watch 6 Classic مقاس 47mm",
    category: "ساعات ذكية",
    costPrice: 750,
    sellPrice: 1050,
    stock: 10,
    image: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=600&auto=format&fit=crop&q=80",
    description: "إطار دوار كلاسيكي، تتبع نبضات القلب ونسبة الدهون ونمط النوم، شاشة كريستال الياقوت.",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-6",
    code: "TAB-IPA-AIR",
    name: "تابلت Apple iPad Air M2 شاشة 11 بوصة 128GB",
    category: "أجهزة لوحية",
    costPrice: 1950,
    sellPrice: 2500,
    stock: 9,
    image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80",
    description: "شريحة M2 القوية من آبل، شاشة Liquid Retina فائقة الجمال، دعم قلم Apple Pencil Pro.",
    createdAt: new Date().toISOString()
  }
];

const dataStore = {
  // المنتجات
  getProducts() {
    return readJson(PRODUCTS_FILE, defaultProducts);
  },

  getProductById(id) {
    const products = this.getProducts();
    return products.find(p => p.id === id);
  },

  saveProduct(productData) {
    const products = this.getProducts();
    let product;

    if (productData.id) {
      // تعديل
      const index = products.findIndex(p => p.id === productData.id);
      if (index !== -1) {
        product = {
          ...products[index],
          ...productData,
          brand: productData.brand || products[index].brand || 'أخرى',
          brandAr: productData.brandAr || products[index].brandAr || 'أخرى / عام',
          costPrice: parseFloat(productData.costPrice) || 0,
          sellPrice: parseFloat(productData.sellPrice) || 0,
          stock: parseInt(productData.stock) || 0,
          updatedAt: new Date().toISOString()
        };
        products[index] = product;
      }
    }

    if (!product) {
      // إضافة جديد
      product = {
        id: "prod-" + Date.now(),
        code: productData.code || "PRD-" + Math.floor(100 + Math.random() * 900),
        name: productData.name,
        brand: productData.brand || "أخرى",
        brandAr: productData.brandAr || "أخرى / عام",
        mainCategory: productData.mainCategory || "أجهزة كهربائية كبيرة",
        category: productData.category || "عام",
        costPrice: parseFloat(productData.costPrice) || 0,
        sellPrice: parseFloat(productData.sellPrice) || 0,
        stock: parseInt(productData.stock) || 0,
        image: productData.image || "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80",
        description: productData.description || "",
        createdAt: new Date().toISOString()
      };
      products.unshift(product);
    }

    writeJson(PRODUCTS_FILE, products);
    syncProductToSupabase(product);
    return product;
  },

  deleteProduct(id) {
    const products = this.getProducts();
    const filtered = products.filter(p => p.id !== id);
    writeJson(PRODUCTS_FILE, filtered);
    deleteProductFromSupabase(id);
    return filtered.length !== products.length;
  },

  // خصم الكميات المباعة من المخزون عند إنشاء فاتورة
  deductStockForInvoice(items, editorName) {
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
      writeJson(PRODUCTS_FILE, products);
      modifiedProducts.forEach(p => syncProductToSupabase(p));
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

  createInvoice(invoiceData) {
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

    invoices.unshift(invoice);
    writeJson(INVOICES_FILE, invoices);
    syncInvoiceToSupabase(invoice);

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
            this.adjustCustomerBalance(existing.id, remainingToAdd);
          }
          invoice.customerId = existing.id;
          invoice.customerSystemNumber = existing.systemNumber;
          invoice.currentCustomerBalance = (existing.balance || 0) + remainingToAdd;
          if (invoice.customerAddress && !existing.address) {
            this.saveCustomer({ id: existing.id, address: invoice.customerAddress });
          }
        } else {
          const newCust = this.saveCustomer({
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

  convertQuotationToSalesInvoice(invoiceId, employeeName = 'مسؤول المبيعات') {
    const invoices = this.getInvoices();
    const idx = invoices.findIndex(i => i.id === invoiceId || String(i.invoiceNumber) === String(invoiceId));
    if (idx === -1) {
      throw new Error('الفاتورة غير موجودة');
    }

    const inv = invoices[idx];
    if (!inv.isQuotation && inv.invoiceType !== 'quotation') {
      throw new Error('هذه الفاتورة معتمدة مسبقاً وليست للعرض فقط');
    }

    // 1. تحويل الحالة إلى مبيعات فعلية
    inv.isQuotation = false;
    inv.invoiceType = 'sales';
    inv.convertedAt = new Date().toISOString();
    inv.convertedBy = employeeName;

    // 2. خصم المخزون
    this.deductStockForInvoice(inv.items, employeeName || inv.employeeName);

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
    syncInvoiceToSupabase(inv);

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

  createReceipt(data) {
    const receipts = this.getReceipts();
    const nextNumber = receipts.length > 0
      ? Math.max(...receipts.map(r => r.receiptNumber || 1)) + 1
      : 1001;

    const receipt = {
      id: 'RCP-' + nextNumber,
      receiptNumber: nextNumber,
      createdAt: new Date().toISOString(),
      employeeName: (data.employeeName || '').trim(),
      customerName: (data.customerName || '').trim(),
      customerPhone: (data.customerPhone || '').trim(),
      customerId: data.customerId || null,
      customerSystemNumber: data.customerSystemNumber || '',
      previousBalance: parseFloat(data.previousBalance) || 0,
      remainingBalance: parseFloat(data.remainingBalance) || 0,
      amount: parseFloat(data.amount) || 0,
      description: (data.description || '').trim(),
      notes: (data.notes || '').trim(),
      paymentMethod: data.paymentMethod || 'cash'  // cash | transfer | check
    };

    receipts.unshift(receipt);
    writeJson(RECEIPTS_FILE, receipts);
    syncReceiptToSupabase(receipt);

    // ربط الزبون وتحديث رصيده أو إضافته كزبون جديد تلقائياً
    if (receipt.customerName && receipt.customerName !== 'زبون نقدي') {
      const customers = this.getCustomers();
      const existing = customers.find(c =>
        (receipt.customerId && c.id === receipt.customerId) ||
        (receipt.customerSystemNumber && c.systemNumber === receipt.customerSystemNumber) ||
        (c.name && c.name.trim().toLowerCase() === receipt.customerName.trim().toLowerCase())
      );
      if (existing) {
        this.adjustCustomerBalance(existing.id, -receipt.amount);
        receipt.customerId = existing.id;
        receipt.customerSystemNumber = existing.systemNumber;
      } else {
        const newCust = this.saveCustomer({
          name: receipt.customerName,
          phone: receipt.customerPhone || '',
          balance: 0,
          notes: 'أضيف تلقائياً عند إصدار سند قبض #' + receipt.receiptNumber
        });
        receipt.customerId = newCust.id;
        receipt.customerSystemNumber = newCust.systemNumber;
      }
    }

    return receipt;
  },

  deleteReceipt(id) {
    const receipts = this.getReceipts();
    const filtered = receipts.filter(r => r.id !== id);
    writeJson(RECEIPTS_FILE, filtered);
    deleteReceiptFromSupabase(id);
    return filtered.length !== receipts.length;
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

  deleteWarranty(id) {
    const warranties = this.getWarranties();
    const filtered = warranties.filter(w => w.id !== id);
    writeJson(WARRANTIES_FILE, filtered);
    deleteWarrantyFromSupabase(id);
    return filtered.length !== warranties.length;
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
    return readJson(CUSTOMERS_FILE, []);
  },

  saveCustomer(custData) {
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

    writeJson(CUSTOMERS_FILE, customers);
    return customer;
  },

  deleteCustomer(id) {
    const customers = this.getCustomers();
    const strId = String(id || '').trim();
    const filtered = customers.filter(c => {
      const matchId = String(c.id || '').trim() === strId;
      const matchSys = c.systemNumber && String(c.systemNumber).trim() === strId;
      return !matchId && !matchSys;
    });
    writeJson(CUSTOMERS_FILE, filtered);
    return filtered.length !== customers.length;
  },

  // تعديل رصيد زبون (مثلاً عند سداد سند قبض أو إضافة دين جديد)
  adjustCustomerBalance(idOrSysNumOrName, deltaAmount) {
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
      customers[idx].balance = parseFloat(updated.toFixed(2));
      customers[idx].updatedAt = new Date().toISOString();
      writeJson(CUSTOMERS_FILE, customers);
      return customers[idx];
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
        updated++;
      } else {
        customers.push({
          id: 'cust-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
          systemNumber: sysNum,
          name,
          phone,
          balance,
          notes,
          createdAt: now,
          updatedAt: now
        });
        imported++;
      }
    });

    writeJson(CUSTOMERS_FILE, customers);
    return { imported, updated, total: customers.length };
  },

  // كشف حساب تفصيلي للزبون يجمع الفواتير وسندات القبض وحركة الرصيد
  getCustomerStatement(id) {
    const customers = this.getCustomers();
    const strId = String(id || '').trim();
    const customer = customers.find(c =>
      String(c.id).trim() === strId ||
      String(c.systemNumber || '').trim() === strId ||
      c.name.trim().toLowerCase() === strId.toLowerCase()
    );

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
    return readJson(SETTINGS_FILE, defaultSettings);
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

  // مزامنة أولية عند تشغيل السيرفر
  async initFromSupabase() {
    if (!supabase) return;
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase sync timeout')), 4000));
    try {
      console.log('🔄 جاري فحص ومزامنة البيانات مع Supabase...');
      await Promise.race([
        (async () => {
          // 1. الإعدادات
          const { data: stRow } = await supabase.from('settings').select('data').eq('id', 'general').maybeSingle();
          if (stRow && stRow.data) {
            writeJson(SETTINGS_FILE, stRow.data);
          }

          // 2. الفواتير
          const { data: invRows } = await supabase.from('invoices').select('*').order('invoiceNumber', { ascending: false });
          if (invRows && invRows.length > 0) {
            writeJson(INVOICES_FILE, invRows);
          }

          // 3. سندات القبض
          const { data: rcpRows } = await supabase.from('receipts').select('*').order('receiptNumber', { ascending: false });
          if (rcpRows && rcpRows.length > 0) {
            writeJson(RECEIPTS_FILE, rcpRows);
          }

          // 4. عدد المنتجات
          const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
          console.log(`✅ تم الاتصال بـ Supabase بنجاح! عدد المنتجات في السحابة: ${count || 0}`);
        })(),
        timeout
      ]);
    } catch (err) {
      console.warn('⚠️ تنبيه: تعذر استرداد بيانات Supabase عند البدء، يتم الاعتماد على البيانات المحلية:', err.message);
    }
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
          // --- الصنف موجود مسبقاً: تحديث آمن للأسعار والمخزون مع الحفاظ الصارم على الاسم والصور والأقسام ---
          let changed = false;
          const changes = [];

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

          // 5. الباركود إذا لم يكن مسجلاً
          if (item.barcode && !existing.barcode) {
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
            brand: item.brand || 'أخرى',
            brandAr: item.brandAr || 'أخرى / عام',
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

    // إذا لم يكن الوضع تجريبياً، نقوم بالحفظ النهائي دفعة واحدة
    if (!dryRun && updatedOrNewProducts.length > 0) {
      // 1. إنشاء نسخة احتياطية سريعة قبل الكتابة
      this.createBackup('pre_sync_batch');

      // 2. كتابة ملف JSON محلياً
      writeJson(PRODUCTS_FILE, products);

      // 3. مزامنة سحابية متوازية مع Supabase إذا كان متصلاً
      if (supabase) {
        try {
          const supabaseBatch = updatedOrNewProducts.map(p => ({
            id: String(p.id),
            code: String(p.code || ''),
            name: String(p.name || ''),
            category: String(p.mainCategory || p.category || 'عام'),
            subcategory: String(p.category || ''),
            costPrice: Number(p.costPrice) || 0,
            sellPrice: Number(p.sellPrice) || 0,
            stock: parseInt(p.stock) || 0,
            unit: String(p.unit || 'قطعة'),
            image: String(p.image || ''),
            description: String(p.description || ''),
            lastStockUpdate: p.lastStockUpdate || null,
            lastStockEditor: p.lastStockEditor || null,
            createdAt: p.createdAt || now
          }));

          const { error: sbErr } = await supabase.from('products').upsert(supabaseBatch);
          if (sbErr) {
            console.error('Supabase batch upsert error:', sbErr.message);
            summary.errors.push(`Supabase sync warning: ${sbErr.message}`);
          }
        } catch (sbEx) {
          console.error('Supabase batch exception:', sbEx.message);
        }
      }

      // 4. حفظ بيانات المزامنة الأخيرة
      const syncMetaFile = path.join(DATA_DIR, 'sync_meta.json');
      writeJson(syncMetaFile, {
        lastSyncAt: now,
        mode,
        itemsReceived: items.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged
      });
    }

    return {
      success: summary.errors.length === 0,
      dryRun,
      summary,
      totalCatalogProducts: products.length,
      timestamp: now
    };
  },

  // -------------------------------------------------------------
  // مزامنة دفعة زبائن من برنامج الشامل لايت (syncBatchCustomers)
  // -------------------------------------------------------------
  async syncBatchCustomers(items, options = {}) {
    const {
      dryRun = false,
      syncMode = 'upsert',  // 'new_only' | 'update_only' | 'upsert'
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

    // خريطة سريعة بكود الزبون من الشامل (systemNumber)
    const sysNumMap = new Map();
    customers.forEach((c, idx) => {
      if (c.systemNumber) sysNumMap.set(String(c.systemNumber).trim().toUpperCase(), idx);
    });

    const summary = { totalReceived: items.length, created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] };
    const updatedCustomers = [...customers];

    for (const item of items) {
      try {
        const shamelCode = String(item.shamelCode || item.code || '').trim();
        const name = String(item.name || '').trim();
        if (!shamelCode || !name) {
          summary.failed++;
          summary.errors.push(`سجل ناقص: كود=${shamelCode} اسم=${name}`);
          continue;
        }

        const key = shamelCode.toUpperCase();
        const existingIdx = sysNumMap.get(key);
        const exists = existingIdx !== undefined;

        if (exists && syncMode === 'new_only') { summary.unchanged++; continue; }
        if (!exists && syncMode === 'update_only') { summary.unchanged++; continue; }

        // حقول مسموح بمزامنتها فقط - لا كلمات مرور ولا أرصدة تعتمد على المتجر
        const phone = String(item.phone || item.mobile || '').trim();
        const mobile = String(item.mobile || item.phone || '').trim();
        const email = String(item.email || '').trim();
        const address = String(item.address || '').trim();
        const notes = String(item.notes || '').trim();
        const isStopped = Boolean(item.isStopped);

        if (exists) {
          const cur = updatedCustomers[existingIdx];
          const changed =
            cur.name !== name ||
            (phone && cur.phone !== phone) ||
            (email && cur.email !== email) ||
            (address && cur.address !== address);

          if (!changed) { summary.unchanged++; continue; }

          if (!dryRun) {
            updatedCustomers[existingIdx] = {
              ...cur,
              name,
              phone: phone || cur.phone || '',
              mobile: mobile || cur.mobile || '',
              email: email || cur.email || '',
              address: address || cur.address || '',
              notes: notes || cur.notes || '',
              isStopped,
              shamelCode,
              syncedAt: now,
              syncedBy: editorName
            };
          }
          summary.updated++;
        } else {
          if (!dryRun) {
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
              balance: 0,
              createdAt: now,
              updatedAt: now,
              syncedAt: now,
              syncedBy: editorName,
              source: 'shamel_sync'
            };
            updatedCustomers.push(newCustomer);
            sysNumMap.set(key, updatedCustomers.length - 1);
          }
          summary.created++;
        }
      } catch (err) {
        summary.failed++;
        summary.errors.push(`خطأ في معالجة زبون: ${err.message}`);
      }
    }

    if (!dryRun) {
      writeJson(CUSTOMERS_FILE, updatedCustomers);

      // مزامنة مع Supabase إن كان متاحاً
      if (supabase) {
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
        } catch (sbEx) {
          console.error('Supabase customers sync error:', sbEx.message);
        }
      }

      // تحديث meta المزامنة للزبائن
      writeJson(path.join(DATA_DIR, 'sync_customers_meta.json'), {
        lastSyncAt: now,
        mode: syncMode,
        itemsReceived: items.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        failed: summary.failed
      });
    }

    return {
      success: summary.failed === 0 || (summary.created + summary.updated) > 0,
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
    return readJson(SUPPLIERS_FILE, []);
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

        const key = shamelCode.toUpperCase();
        const existingIdx = shamelCodeMap.get(key);
        const exists = existingIdx !== undefined;

        if (exists && syncMode === 'new_only') { summary.unchanged++; continue; }
        if (!exists && syncMode === 'update_only') { summary.unchanged++; continue; }

        const phone = String(item.phone || item.mobile || '').trim();
        const mobile = String(item.mobile || item.phone || '').trim();
        const email = String(item.email || '').trim();
        const address = String(item.address || '').trim();
        const notes = String(item.notes || '').trim();
        const isStopped = Boolean(item.isStopped);

        if (exists) {
          const cur = updatedSuppliers[existingIdx];
          const changed =
            cur.name !== name ||
            (phone && cur.phone !== phone) ||
            (email && cur.email !== email);

          if (!changed) { summary.unchanged++; continue; }

          if (!dryRun) {
            updatedSuppliers[existingIdx] = {
              ...cur,
              name,
              phone: phone || cur.phone || '',
              mobile: mobile || cur.mobile || '',
              email: email || cur.email || '',
              address: address || cur.address || '',
              notes: notes || cur.notes || '',
              isStopped,
              updatedAt: now,
              syncedAt: now,
              syncedBy: editorName
            };
          }
          summary.updated++;
        } else {
          if (!dryRun) {
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

    if (!dryRun) {
      writeJson(SUPPLIERS_FILE, updatedSuppliers);

      // مزامنة مع Supabase إن كان متاحاً
      if (supabase) {
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
            createdAt: s.createdAt || now
          }));
          if (sb.length > 0) await supabase.from('suppliers').upsert(sb);
        } catch (sbEx) {
          console.error('Supabase suppliers sync error:', sbEx.message);
        }
      }

      writeJson(path.join(DATA_DIR, 'sync_suppliers_meta.json'), {
        lastSyncAt: now,
        mode: syncMode,
        itemsReceived: items.length,
        created: summary.created,
        updated: summary.updated,
        unchanged: summary.unchanged,
        failed: summary.failed
      });
    }

    return {
      success: summary.failed === 0 || (summary.created + summary.updated) > 0,
      dryRun,
      summary,
      totalSuppliers: updatedSuppliers.length,
      timestamp: now
    };
  }
};

module.exports = dataStore;
