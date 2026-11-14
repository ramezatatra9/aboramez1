const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let code = fs.readFileSync(serverPath, 'utf8');

// Replacement for /api/public/store-data and addition of new routes
const oldStoreDataTarget = "app.get('/api/public/store-data', (req, res) => {";

const newRoutesCode = `
// ================================================================
// نقطة وصول متجر الزبائن العام (Public Store API - Almnar Style)
// بيانات آمنة 100% بحجب كامل لأسعار التكلفة والموردين + دعم الأقسام والماركات والعروض
// ================================================================
app.get('/api/public/store-data', (req, res) => {
  try {
    const products = dataStore.getProducts() || [];
    const settings = dataStore.getSettings() || {};
    const storeConfig = dataStore.getStoreConfig() || {};
    const manualShowSet = new Set((storeConfig.manuallyShownOutOfStock || []).map(String));
    const customNames = storeConfig.customProductNames || {};

    // فلترة الأصناف: عرض المتوفر بالمستودع فقط (stock > 0) + ما حددته الإدارة يدوياً
    const publicProducts = products
      .filter(p => {
        if (!p || !p.name) return false;
        if (p.isSuspended) return false;
        const stock = parseInt(p.stock) || 0;
        const isManual = manualShowSet.has(String(p.id));
        if (stock <= 0 && !isManual) {
          return false;
        }
        return true;
      })
      .map(p => {
        const stock = parseInt(p.stock) || 0;
        const isManual = manualShowSet.has(String(p.id)) && stock <= 0;
        const displayName = customNames[String(p.id)] || p.name;
        const sellPrice = Math.round(parseFloat(p.sellPrice) || 0);

        return {
          id: p.id,
          name: displayName,
          originalName: p.name,
          brand: p.brand || 'عام',
          code: p.code || '',
          category: p.category || p.classification || 'عام',
          sellPrice: sellPrice,
          image: p.image || (Array.isArray(p.images) && p.images[0]) || '',
          images: Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image ? [p.image] : []),
          description: p.description || '',
          stock: stock,
          isAvailable: stock > 0,
          isManualShow: isManual
        };
      });

    // جلب الأقسام والماركات الفعالة
    const activeCategories = (storeConfig.categories || [])
      .filter(c => c.isVisible !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const activeBrands = (storeConfig.brands || [])
      .filter(b => b.isVisible !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const activeOffers = (storeConfig.offers || [])
      .filter(o => o.isVisible !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    res.json({
      success: true,
      products: publicProducts,
      categories: activeCategories,
      brands: activeBrands,
      offers: activeOffers,
      popupOffer: storeConfig.popupOffer || { enabled: false },
      storeSettings: storeConfig.storeSettings || {},
      company: {
        name: settings.companyName || 'شركة رامز عطاطرة',
        phone: (storeConfig.storeSettings && storeConfig.storeSettings.phone) || settings.companyPhone || '',
        whatsapp: (storeConfig.storeSettings && storeConfig.storeSettings.whatsapp) || settings.companyPhone || '',
        address: (storeConfig.storeSettings && storeConfig.storeSettings.address) || settings.companyAddress || '',
        currency: (storeConfig.storeSettings && storeConfig.storeSettings.currency) || settings.currency || 'شيكل'
      }
    });
  } catch (err) {
    console.error('Error in /api/public/store-data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================================================================
// إرسال وتأكيد طلب شراء إلكتروني جديد من متجر الزبائن
// مع إشعار فوري لتيليجرام وحفظ الطلب في النظام
// ================================================================
app.post('/api/public/orders', async (req, res) => {
  try {
    const { customer, items } = req.body;
    if (!customer || !customer.name || !customer.name.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال الاسم الكريم.' });
    }
    if (!customer.phone || !customer.phone.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال رقم الهاتف للتواصل.' });
    }
    if (!customer.address || !customer.address.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال العنوان بالتفصيل لتسليم الطلب.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'سلة المشتريات فارغة!' });
    }

    // حفظ الطلب في النظام
    const newOrder = dataStore.createOrder({ customer, items });

    // إرسال إشعار فوري لتيليجرام
    const settings = dataStore.getSettings() || {};
    let telegramResult = { ok: false, error: 'غير مهيأ' };
    if (settings.telegramBotToken && settings.telegramChatId) {
      try {
        telegramResult = await telegramService.sendStoreOrderNotification(newOrder, settings);
        dataStore.updateOrderTelegramStatus(newOrder.id, telegramResult.ok, telegramResult.error);
      } catch (telErr) {
        console.error('Telegram notification on store order error:', telErr.message);
        dataStore.updateOrderTelegramStatus(newOrder.id, false, telErr.message);
      }
    }

    res.json({
      success: true,
      orderId: newOrder.id,
      totalAmount: newOrder.totalAmount,
      createdAt: newOrder.createdAt,
      message: 'تم إرسال طلبك بنجاح! رقم طلبك هو: #' + newOrder.id + '. سيتم التواصل معك هاتفياً لتأكيد موعد التوصيل.'
    });
  } catch (err) {
    console.error('Error creating store order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================================================================
// لوحة تحكم إدارة المتجر الإلكتروني (Admin Store Management APIs)
// ================================================================

// 1. جلب إعدادات وتخصيص المتجر الكاملة
app.get('/api/admin/store-config', (req, res) => {
  try {
    const config = dataStore.getStoreConfig();
    const orders = dataStore.getOrders();
    const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
    res.json({
      success: true,
      config: config,
      stats: {
        totalOrders: orders.length,
        pendingOrders: pendingOrdersCount,
        approvedOrders: orders.filter(o => o.status === 'approved').length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. تحديث وتخصيص إعدادات المتجر الكاملة
app.post('/api/admin/store-config', (req, res) => {
  try {
    const updated = dataStore.saveStoreConfig(req.body);
    res.json({ success: true, config: updated, message: 'تم حفظ إعدادات المتجر بنجاح.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. جلب جميع الطلبات الإلكترونية
app.get('/api/admin/orders', (req, res) => {
  try {
    const orders = dataStore.getOrders();
    res.json({ success: true, orders: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. اعتماد طلب إلكتروني وخصم المخزون
app.post('/api/admin/orders/:id/approve', (req, res) => {
  try {
    const orderId = req.params.id;
    const approvedBy = req.body.approvedBy || 'الإدارة';
    const result = dataStore.approveOrder(orderId, approvedBy);
    res.json({
      success: true,
      order: result.order,
      message: 'تم اعتماد الطلب بنجاح وخصم كمياته من المخزون (' + result.updatedProductsCount + ' صنف).'
    });
  } catch (err) {
    console.error('Error approving order:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. إلغاء طلب إلكتروني
app.post('/api/admin/orders/:id/cancel', (req, res) => {
  try {
    const orderId = req.params.id;
    const reason = req.body.reason || 'تم الإلغاء بواسطة الإدارة';
    const result = dataStore.cancelOrder(orderId, reason);
    res.json({ success: true, order: result.order, message: 'تم إلغاء الطلب.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6. تعديل الاسم المخصص لصنف للظهور في المتجر
app.post('/api/admin/store/custom-name', (req, res) => {
  try {
    const { productId, customName } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'معرف الصنف مطلوب' });
    const config = dataStore.updateCustomProductName(productId, customName);
    res.json({ success: true, customProductNames: config.customProductNames });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. تفعيل/تعطيل إظهار صنف غير متوفر بالمخزون يدوياً
app.post('/api/admin/store/toggle-manual-show', (req, res) => {
  try {
    const { productId, forceShow } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'معرف الصنف مطلوب' });
    const config = dataStore.toggleManualOutOfStock(productId, Boolean(forceShow));
    res.json({ success: true, manuallyShownOutOfStock: config.manuallyShownOutOfStock });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
`;

// Locate the existing app.get('/api/public/store-data' block
const startIdx = code.indexOf(oldStoreDataTarget);
if (startIdx === -1) {
  console.error('❌ Could not find old /api/public/store-data in server.js');
  process.exit(1);
}

// Find the end of that handler: look for "res.json({" and then "});"
const endMatch = code.slice(startIdx).indexOf('});\n');
if (endMatch === -1) {
  console.error('❌ Could not find end of /api/public/store-data handler');
  process.exit(1);
}

const endIdx = startIdx + endMatch + 4; // include });\n

// Replace the old handler with the newRoutesCode
code = code.slice(0, startIdx) + newRoutesCode + '\n' + code.slice(endIdx);

fs.writeFileSync(serverPath, code, 'utf8');
console.log('✅ server.js updated with new store and orders APIs');
