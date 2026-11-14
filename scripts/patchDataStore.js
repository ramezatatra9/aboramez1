const fs = require('fs');
const path = require('path');

const dataStorePath = path.join(__dirname, '..', 'dataStore.js');
let code = fs.readFileSync(dataStorePath, 'utf8');

// 1. Add file constants at the top if not present
if (!code.includes('STORE_CONFIG_FILE')) {
  const target = "const SYNC_VOUCHERS_META_FILE = path.join(DATA_DIR, 'sync_vouchers_meta.json');";
  const addition = `const SYNC_VOUCHERS_META_FILE = path.join(DATA_DIR, 'sync_vouchers_meta.json');
const STORE_CONFIG_FILE = path.join(DATA_DIR, 'store_config.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');`;
  
  if (code.includes(target)) {
    code = code.replace(target, addition);
    console.log('✅ Added STORE_CONFIG_FILE and ORDERS_FILE constants at top');
  } else {
    console.warn('⚠️ Could not find target line for constants');
  }
}

// 2. Add methods before the last "}; module.exports = dataStore;"
const methodsCode = `
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

    console.log(\`✅ تم اعتماد الطلب #\${order.id} بنجاح وخصم المخزون لـ \${updatedProductsList.length} صنف.\`);
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
`;

if (!code.includes('getStoreConfig()')) {
  // Find the last "};" before "module.exports = dataStore;"
  const lastExportsIdx = code.lastIndexOf('module.exports = dataStore;');
  if (lastExportsIdx !== -1) {
    const lastBraceIdx = code.lastIndexOf('};', lastExportsIdx);
    if (lastBraceIdx !== -1) {
      code = code.slice(0, lastBraceIdx) + methodsCode + '\n' + code.slice(lastBraceIdx);
      console.log('✅ Injected store & order methods into dataStore object');
    } else {
      console.error('❌ Could not find closing brace before module.exports');
    }
  } else {
    console.error('❌ Could not find module.exports in dataStore.js');
  }
} else {
  console.log('ℹ️ dataStore already contains getStoreConfig()');
}

fs.writeFileSync(dataStorePath, code, 'utf8');
console.log('✅ dataStore.js updated successfully');
