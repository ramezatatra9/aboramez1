const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabaseClient');

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const RECEIPTS_FILE = path.join(DATA_DIR, 'receipts.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');

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

    const invoice = {
      id: "INV-" + nextNumber,
      invoiceNumber: nextNumber,
      invoiceType: invoiceData.invoiceType === 'purchase' ? 'purchase' : 'sales', // 'sales' or 'purchase'
      createdAt: new Date().toISOString(),
      employeeName: invoiceData.employeeName?.trim() || "غير محدد",
      customerName: invoiceData.customerName?.trim() || (invoiceData.invoiceType === 'purchase' ? "مورد بضاعة" : "زبون نقدي"),
      customerPhone: invoiceData.customerPhone?.trim() || "",
      customerId: invoiceData.customerId || null,
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
      telegramStatus: {
        sent: false,
        sentAt: null,
        error: null
      }
    };

    invoices.unshift(invoice);
    writeJson(INVOICES_FILE, invoices);
    syncInvoiceToSupabase(invoice);

    // إذا كانت فاتورة مبيعات وزبون: يتم ربطه إذا وجد أو إضافته كزبون جديد تلقائياً
    if (invoice.invoiceType === 'sales' && invoice.customerName && invoice.customerName !== 'زبون نقدي') {
      const customers = this.getCustomers();
      const existing = customers.find(c => 
        (invoice.customerId && c.id === invoice.customerId) ||
        (c.name && c.name.trim().toLowerCase() === invoice.customerName.trim().toLowerCase())
      );
      const remainingToAdd = (invoice.paymentMethod === 'installments' && invoice.installmentDetails?.remainingAmount) ? invoice.installmentDetails.remainingAmount : 0;
      if (existing) {
        if (remainingToAdd > 0) {
          this.adjustCustomerBalance(existing.id, remainingToAdd);
        }
        invoice.customerId = existing.id;
        invoice.customerSystemNumber = existing.systemNumber;
      } else {
        const newCust = this.saveCustomer({
          name: invoice.customerName,
          phone: invoice.customerPhone || '',
          balance: remainingToAdd,
          notes: 'أضيف تلقائياً من فاتورة مبيعات #' + invoice.invoiceNumber
        });
        invoice.customerId = newCust.id;
        invoice.customerSystemNumber = newCust.systemNumber;
      }
    }

    return invoice;
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
  }
};

module.exports = dataStore;
