const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const INVOICES_FILE = path.join(DATA_DIR, 'invoices.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const RECEIPTS_FILE = path.join(DATA_DIR, 'receipts.json');

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
    return product;
  },

  deleteProduct(id) {
    const products = this.getProducts();
    const filtered = products.filter(p => p.id !== id);
    writeJson(PRODUCTS_FILE, filtered);
    return filtered.length !== products.length;
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
      createdAt: new Date().toISOString(),
      employeeName: invoiceData.employeeName?.trim() || "غير محدد",
      customerName: invoiceData.customerName?.trim() || "زبون نقدي",
      customerPhone: invoiceData.customerPhone?.trim() || "",
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
      return invoices[index];
    }
    return null;
  },

  // تحديث الكميات دفعةً واحدة (الجرد)
  updateInventoryBulk(updates, editorName) {
    const products = this.getProducts();
    const now = new Date().toISOString();
    let changedCount = 0;

    updates.forEach(({ id, stock }) => {
      const index = products.findIndex(p => p.id === id);
      if (index !== -1) {
        const newStock = parseInt(stock);
        if (!isNaN(newStock) && newStock !== products[index].stock) {
          products[index].stock = Math.max(0, newStock);
          products[index].lastStockUpdate = now;
          products[index].lastStockEditor = editorName || 'غير محدد';
          changedCount++;
        }
      }
    });

    writeJson(PRODUCTS_FILE, products);
    return { changedCount };
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
      amount: parseFloat(data.amount) || 0,
      description: (data.description || '').trim(),
      notes: (data.notes || '').trim(),
      paymentMethod: data.paymentMethod || 'cash'  // cash | transfer | check
    };

    receipts.unshift(receipt);
    writeJson(RECEIPTS_FILE, receipts);
    return receipt;
  },

  deleteReceipt(id) {
    const receipts = this.getReceipts();
    const filtered = receipts.filter(r => r.id !== id);
    writeJson(RECEIPTS_FILE, filtered);
    return filtered.length !== receipts.length;
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
    return updated;
  }
};

module.exports = dataStore;
