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

// Ø¥Ø¹Ø¯Ø§Ø¯ Ù…Ø¬Ù„Ø¯ Ø§Ù„Ø±ÙØ¹
const UPLOADS_DIR = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create UPLOADS_DIR:', e.message);
}

// Ø¥Ø¹Ø¯Ø§Ø¯ Multer Ù„ØªØ®Ø²ÙŠÙ† ØµÙˆØ± Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª
function formatServerDateTime(dateInput) {
  const d = new Date(dateInput || Date.now());
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'Ù…Ø³Ø§Ø¦Ø§Ù‹' : 'ØµØ¨Ø§Ø­Ø§Ù‹';
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} Ø§Ù„Ø³Ø§Ø¹Ø© ${hours}:${minutes} ${period}`;
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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ø£Ù†Ø¯Ø±ÙˆÙŠØ¯ ÙˆØ§Ù„ÙƒØ§Ù…ÙŠØ±Ø§Øª Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ø¯Ù‚Ø©
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|svg|bmp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype.startsWith('image/');
    if (ext || mime) {
      return cb(null, true);
    }
    cb(new Error('Ø§Ù„Ù…Ù„Ù Ø§Ù„Ù…Ø±ÙÙˆØ¹ ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† ØµÙˆØ±Ø©'));
  }
});

// Ø¥Ø¹Ø¯Ø§Ø¯ Multer Ù„ØªØ®Ø²ÙŠÙ† Ù…Ù„ÙØ§Øª Ø§Ù„Ù€ PDF Ø§Ù„Ù…Ø¤Ù‚ØªØ© ÙÙŠ Ø§Ù„Ø°Ø§ÙƒØ±Ø© Ù„Ù„Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…Ø¨Ø§Ø´Ø± Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Middlewares
app.use(compression({ threshold: 1024 }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ø«Ø§Ø¨ØªØ©
app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: '2h', etag: true }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d', etag: true }));

// â”€â”€â”€ ÙØ­Øµ Ø¬Ø§Ù‡Ø²ÙŠØ© Supabase Ù‚Ø¨Ù„ ÙƒÙ„ Ø¹Ù…Ù„ÙŠØ© ÙƒØªØ§Ø¨Ø© (Read-Only Degraded Mode) â”€â”€â”€

// تهيئة أولية لبيئات Vercel Serverless لضمان تفعيل وضع القراءة والكتابة وجلب أحدث البيانات
let serverlessInitStarted = false;
app.use((req, res, next) => {
  if (process.env.VERCEL && !serverlessInitStarted) {
    serverlessInitStarted = true;
    systemMode.verifyReadiness({ quiet: true }).then(async (r) => {
      if (r && r.ok && supabase) {
        try {
          const { data: existingSc } = await supabase.from('settings').select('id').eq('id', 'store_config').maybeSingle();
          if (!existingSc) {
            const initialSc = dataStore.getStoreConfig();
            await supabase.from('settings').upsert({ id: 'store_config', data: initialSc });
          }
          const { data: existingGen } = await supabase.from('settings').select('id').eq('id', 'general').maybeSingle();
          if (!existingGen) {
            const initialGen = dataStore.getSettings();
            await supabase.from('settings').upsert({ id: 'general', data: initialGen });
          }
        } catch (_) {}
        await dataStore.refreshFromCloud().catch(() => {});
      }
    }).catch(() => {});
  }
  next();
});

app.use(systemMode.requireWritePermission);

// â”€â”€â”€ endpoints Ù„Ù„ØµØ­Ø© ÙˆØ§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© â”€â”€â”€
const { getSafeKeyMetadata } = require('./supabaseClient');

app.get('/api/health', async (req, res) => {
  if (systemMode.getStatus().mode !== 'read-write') {
    try {
      await systemMode.verifyReadiness({ quiet: true });
    } catch (_) {}
  }
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
// APIs: Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª (Products)
// -------------------------------------------------------------

// Ù†Ù‚Ø·Ø© ÙˆØµÙˆÙ„ Ø¹Ø§Ù…Ø© Ù„Ù…ØªØ¬Ø± Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† (Public Store API) - Ø¨ÙŠØ§Ù†Ø§Øª Ø¢Ù…Ù†Ø© 100% Ø¨Ø­Ø¬Ø¨ ÙƒØ§Ù…Ù„ Ù„Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ØªÙƒÙ„ÙØ© ÙˆØ§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ†

// ================================================================
// Ù†Ù‚Ø·Ø© ÙˆØµÙˆÙ„ Ù…ØªØ¬Ø± Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ø§Ù„Ø¹Ø§Ù… (Public Store API - Almnar Style)
// Ø¨ÙŠØ§Ù†Ø§Øª Ø¢Ù…Ù†Ø© 100% Ø¨Ø­Ø¬Ø¨ ÙƒØ§Ù…Ù„ Ù„Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ØªÙƒÙ„ÙØ© ÙˆØ§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† + Ø¯Ø¹Ù… Ø§Ù„Ø£Ù‚Ø³Ø§Ù… ÙˆØ§Ù„Ù…Ø§Ø±ÙƒØ§Øª ÙˆØ§Ù„Ø¹Ø±ÙˆØ¶
// ================================================================
app.get('/api/public/store-data', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  try {
    const [products, storeConfig, settings] = await Promise.all([
      typeof dataStore.getProductsAsync === 'function' ? dataStore.getProductsAsync() : Promise.resolve(dataStore.getProducts() || []),
      typeof dataStore.getStoreConfigAsync === 'function' ? dataStore.getStoreConfigAsync() : Promise.resolve(dataStore.getStoreConfig() || {}),
      typeof dataStore.getSettingsAsync === 'function' ? dataStore.getSettingsAsync() : Promise.resolve(dataStore.getSettings() || {})
    ]);
    const manualShowSet = new Set((storeConfig.manuallyShownOutOfStock || []).map(String));
    const customNames = storeConfig.customProductNames || {};
    const customCategories = storeConfig.customProductCategories || {};

    // 1. Ø¬Ù„Ø¨ Ø§Ù„Ø£Ù‚Ø³Ø§Ù… ÙˆØ§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø§Ù„ÙØ¹Ø§Ù„Ø© Ø£ÙˆÙ„Ø§Ù‹ Ù„ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ø£Ù‚Ø³Ø§Ù… Ø§Ù„Ù…Ø®ØµØµØ© Ù„Ù„Ø£ØµÙ†Ø§Ù
    const activeCategories = (storeConfig.categories || [])
      .filter(c => c.isVisible !== false)
      .map(c => ({
        id: c.id,
        name: c.storeName || c.name,
        originalName: c.name,
        storeName: c.storeName || c.name,
        image: c.image || '',
        sortOrder: parseInt(c.sortOrder) || 99,
        customProductIds: Array.isArray(c.customProductIds) ? c.customProductIds.map(String) : []
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const activeBrands = (storeConfig.brands || [])
      .filter(b => b.isVisible !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const activeOffers = (storeConfig.offers || [])
      .filter(o => o.isVisible !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // 2. ÙÙ„ØªØ±Ø© Ø§Ù„Ø£ØµÙ†Ø§Ù: Ø¹Ø±Ø¶ Ø§Ù„Ù…ØªÙˆÙØ± Ø¨Ø§Ù„Ù…Ø³ØªÙˆØ¯Ø¹ ÙÙ‚Ø· (stock > 0) + Ù…Ø§ Ø­Ø¯Ø¯ØªÙ‡ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© ÙŠØ¯ÙˆÙŠØ§Ù‹
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

        // ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù‚Ø³Ù… Ø§Ù„Ø°ÙŠ ÙŠÙ†ØªÙ…ÙŠ Ù„Ù‡ Ø§Ù„ØµÙ†Ù ÙÙŠ Ù…ØªØ¬Ø± Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† (Ø£ÙˆÙ„ÙˆÙŠØ© Ù…Ø·Ù„Ù‚Ø© Ù„Ù„Ù‚Ø³Ù… Ø§Ù„Ù…Ø®ØµØµ Ù„Ù…Ù†Ø¹ Ø§Ù„ØªÙƒØ±Ø§Ø±)
        let prodStoreCategory = null;
        const pIdStr = String(p.id);
        if (customCategories[pIdStr]) {
          prodStoreCategory = customCategories[pIdStr];
        } else {
          for (const c of activeCategories) {
            if (Array.isArray(c.customProductIds) && c.customProductIds.includes(pIdStr)) {
              prodStoreCategory = c.name;
              break;
            }
          }
        }
        if (!prodStoreCategory) {
          const matched = activeCategories.find(c => c.originalName === p.category || c.name === p.category || c.id === p.category);
          prodStoreCategory = matched ? matched.name : (p.category || 'Ø¹Ø§Ù…');
        }

        return {
          id: p.id,
          name: displayName,
          originalName: p.name,
          brand: p.brand || 'Ø¹Ø§Ù…',
          code: p.code || '',
          category: prodStoreCategory,
          sellPrice: sellPrice,
          image: p.image || (Array.isArray(p.images) && p.images[0]) || '',
          images: Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image ? [p.image] : []),
          description: p.description || '',
          stock: stock,
          isAvailable: stock > 0,
          isManualShow: isManual
        };
      });

    res.json({
      success: true,
      products: publicProducts,
      categories: activeCategories,
      brands: activeBrands,
      offers: activeOffers,
      popupOffer: storeConfig.popupOffer || { enabled: false },
      storeSettings: storeConfig.storeSettings || {},
      company: {
        name: settings.companyName || 'Ø´Ø±ÙƒØ© Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©',
        phone: (storeConfig.storeSettings && storeConfig.storeSettings.phone) || settings.companyPhone || '',
        whatsapp: (storeConfig.storeSettings && storeConfig.storeSettings.whatsapp) || settings.companyPhone || '',
        address: (storeConfig.storeSettings && storeConfig.storeSettings.address) || settings.companyAddress || '',
        currency: (storeConfig.storeSettings && storeConfig.storeSettings.currency) || settings.currency || 'Ø´ÙŠÙƒÙ„',
        logo: (storeConfig.storeSettings && storeConfig.storeSettings.companyLogo) || settings.companyLogo || ''
      }
    });
  } catch (err) {
    console.error('Error in /api/public/store-data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================================================================
// Ø¥Ø±Ø³Ø§Ù„ ÙˆØªØ£ÙƒÙŠØ¯ Ø·Ù„Ø¨ Ø´Ø±Ø§Ø¡ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ Ø¬Ø¯ÙŠØ¯ Ù…Ù† Ù…ØªØ¬Ø± Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†
// Ù…Ø¹ Ø¥Ø´Ø¹Ø§Ø± ÙÙˆØ±ÙŠ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… ÙˆØ­ÙØ¸ Ø§Ù„Ø·Ù„Ø¨ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…
// ================================================================

// ================================================================
// Ù†Ù‚Ø·Ø© Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ© Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø© Ø¨ÙŠÙ† Ø³ÙŠØ±ÙØ± Ø§Ù„Ù…ØªØ¬Ø± ÙˆØ³ÙŠØ±ÙØ± Ø§Ù„Ø£Ø¯Ù…Ù†
// ================================================================
app.post('/api/internal/orders/receive', (req, res) => {
  try {
    const order = req.body && req.body.order;
    if (!order || !order.id) {
      return res.status(400).json({ success: false, error: 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± ØµØ§Ù„Ø­Ø©' });
    }
    const orders = dataStore.getOrders();
    const existingIdx = orders.findIndex(o => String(o.id) === String(order.id));
    if (existingIdx !== -1) {
      orders[existingIdx] = { ...orders[existingIdx], ...order };
    } else {
      orders.unshift(order);
    }
    const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
    console.log(`ðŸ“¡ [Admin/Store Sync] ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… ÙˆØ­ÙØ¸ Ø§Ù„Ø·Ù„Ø¨ #${order.id} Ø¨Ù†Ø¬Ø§Ø­ Ù…Ù† Ø§Ù„Ø³ÙŠØ±ÙØ± Ø§Ù„Ø´Ù‚ÙŠÙ‚`);
    res.json({ success: true, message: 'ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø·Ù„Ø¨ Ø¨Ù†Ø¬Ø§Ø­' });
  } catch (err) {
    console.error('Error receiving internal order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/public/orders', async (req, res) => {
  try {
    const { customer, items } = req.body;
    if (!customer || !customer.name || !customer.name.trim()) {
      return res.status(400).json({ success: false, error: 'ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ±ÙŠÙ….' });
    }
    if (!customer.phone || !customer.phone.trim()) {
      return res.status(400).json({ success: false, error: 'ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ Ù„Ù„ØªÙˆØ§ØµÙ„.' });
    }
    if (!customer.address || !customer.address.trim()) {
      return res.status(400).json({ success: false, error: 'ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø¨Ø§Ù„ØªÙØµÙŠÙ„ Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„Ø·Ù„Ø¨.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Ø³Ù„Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª ÙØ§Ø±ØºØ©!' });
    }

    // Ø­ÙØ¸ Ø§Ù„Ø·Ù„Ø¨ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…
    const newOrder = dataStore.createOrder({ customer, items });

    // Ø¥Ø±Ø³Ø§Ù„ Ø¥Ø´Ø¹Ø§Ø± ÙÙˆØ±ÙŠ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
    const settings = dataStore.getSettings() || {};
    const telegramBotToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '8764055418:AAFJG3MY6LZFR8q5rgodajcJl448LdYOEgI';
    const telegramChatId = settings.telegramChatId || process.env.TELEGRAM_CHAT_ID || '-5562183330';
    let telegramResult = { ok: false, error: 'ØºÙŠØ± Ù…Ù‡ÙŠØ£' };
    if (telegramBotToken && telegramChatId) {
      try {
        telegramResult = await telegramService.sendStoreOrderNotification(newOrder, { ...settings, telegramBotToken, telegramChatId });
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
      message: 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø·Ù„Ø¨Ùƒ Ø¨Ù†Ø¬Ø§Ø­! Ø±Ù‚Ù… Ø·Ù„Ø¨Ùƒ Ù‡Ùˆ: #' + newOrder.id + '. Ø³ÙŠØªÙ… Ø§Ù„ØªÙˆØ§ØµÙ„ Ù…Ø¹Ùƒ Ù‡Ø§ØªÙÙŠØ§Ù‹ Ù„ØªØ£ÙƒÙŠØ¯ Ù…ÙˆØ¹Ø¯ Ø§Ù„ØªÙˆØµÙŠÙ„.'
    });
  } catch (err) {
    console.error('Error creating store order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================================================================
// Ù„ÙˆØ­Ø© ØªØ­ÙƒÙ… Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ØªØ¬Ø± Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ (Admin Store Management APIs)
// ================================================================

// 1. Ø¬Ù„Ø¨ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙˆØªØ®ØµÙŠØµ Ø§Ù„Ù…ØªØ¬Ø± Ø§Ù„ÙƒØ§Ù…Ù„Ø©
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

// 2. ØªØ­Ø¯ÙŠØ« ÙˆØªØ®ØµÙŠØµ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ØªØ¬Ø± Ø§Ù„ÙƒØ§Ù…Ù„Ø©
app.post(['/api/admin/store-config', '/api/store-config'], async (req, res) => {
  try {
    const updated = await dataStore.saveStoreConfig(req.body);
    res.json({ success: true, config: updated, message: 'ØªÙ… Ø­ÙØ¸ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ØªØ¬Ø± Ø¨Ù†Ø¬Ø§Ø­.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ù† Supabase ÙŠØ¯ÙˆÙŠØ§Ù‹ (Ù„Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª Ø¨ÙŠÙ† Ø§Ù„Ø³ÙŠØ±ÙØ±Ø§Øª)
app.get('/api/refresh-from-cloud', async (req, res) => {
  try {
    const result = await dataStore.refreshFromCloud();
    res.json({ success: true, message: 'ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ù† Supabase Ø¨Ù†Ø¬Ø§Ø­', result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Ø¬Ù„Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ©
app.get('/api/admin/orders', async (req, res) => {
  try {
    let orders = dataStore.getOrders();
    // Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© ÙØ§Ø±ØºØ© Ø¹Ù„Ù‰ Ø³ÙŠØ±ÙØ± Ø§Ù„Ø£Ø¯Ù…Ù†ØŒ Ø­Ø§ÙˆÙ„ Ø§Ù„Ø³Ø­Ø¨ Ø§Ù„ÙÙˆØ±ÙŠ Ù…Ù† Supabase
    if (orders.length === 0 && supabase) {
      try {
        const { data: ordRow } = await Promise.race([supabase.from('settings').select('data').eq('id', 'orders').maybeSingle(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3500))]);
        if (ordRow && Array.isArray(ordRow.data) && ordRow.data.length > 0) {
          const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
          fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordRow.data, null, 2), 'utf-8');
          orders = ordRow.data;
        }
      } catch (_) {}
    }
    res.json({ success: true, orders: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Ø§Ø¹ØªÙ…Ø§Ø¯ Ø·Ù„Ø¨ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ ÙˆØ®ØµÙ… Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
app.post('/api/admin/orders/:id/approve', (req, res) => {
  try {
    const orderId = req.params.id;
    const approvedBy = req.body.approvedBy || 'Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©';
    const result = dataStore.approveOrder(orderId, approvedBy);
    res.json({
      success: true,
      order: result.order,
      message: 'ØªÙ… Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ø·Ù„Ø¨ Ø¨Ù†Ø¬Ø§Ø­ ÙˆØ®ØµÙ… ÙƒÙ…ÙŠØ§ØªÙ‡ Ù…Ù† Ø§Ù„Ù…Ø®Ø²ÙˆÙ† (' + result.updatedProductsCount + ' ØµÙ†Ù).'
    });
  } catch (err) {
    console.error('Error approving order:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Ø¥Ù„ØºØ§Ø¡ Ø·Ù„Ø¨ Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ
app.post('/api/admin/orders/:id/cancel', (req, res) => {
  try {
    const orderId = req.params.id;
    const reason = req.body.reason || 'ØªÙ… Ø§Ù„Ø¥Ù„ØºØ§Ø¡ Ø¨ÙˆØ§Ø³Ø·Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©';
    const result = dataStore.cancelOrder(orderId, reason);
    res.json({ success: true, order: result.order, message: 'ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø·Ù„Ø¨.' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6. ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ø§Ø³Ù… Ø§Ù„Ù…Ø®ØµØµ Ù„ØµÙ†Ù Ù„Ù„Ø¸Ù‡ÙˆØ± ÙÙŠ Ø§Ù„Ù…ØªØ¬Ø±

// ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù‚Ø³Ù… Ø§Ù„Ù…Ø®ØµØµ Ù„ØµÙ†Ù ÙÙŠ Ù…ØªØ¬Ø± Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ù…Ø¹ Ù…Ù†Ø¹ Ø§Ù„ØªÙƒØ±Ø§Ø±
app.post('/api/admin/store/custom-category', async (req, res) => {
  try {
    const { productId, category } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'Ù…Ø¹Ø±Ù Ø§Ù„ØµÙ†Ù Ù…Ø·Ù„ÙˆØ¨' });
    const config = await dataStore.updateCustomProductCategory(productId, category);
    res.json({ success: true, customProductCategories: config.customProductCategories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/store/custom-name', async (req, res) => {
  try {
    const { productId, customName } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'Ù…Ø¹Ø±Ù Ø§Ù„ØµÙ†Ù Ù…Ø·Ù„ÙˆØ¨' });
    const config = await dataStore.updateCustomProductName(productId, customName);
    res.json({ success: true, customProductNames: config.customProductNames });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. ØªÙØ¹ÙŠÙ„/ØªØ¹Ø·ÙŠÙ„ Ø¥Ø¸Ù‡Ø§Ø± ØµÙ†Ù ØºÙŠØ± Ù…ØªÙˆÙØ± Ø¨Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙŠØ¯ÙˆÙŠØ§Ù‹
app.post('/api/admin/store/toggle-manual-show', async (req, res) => {
  try {
    const { productId, forceShow } = req.body;
    if (!productId) return res.status(400).json({ success: false, error: 'Ù…Ø¹Ø±Ù Ø§Ù„ØµÙ†Ù Ù…Ø·Ù„ÙˆØ¨' });
    const config = await dataStore.toggleManualOutOfStock(productId, Boolean(forceShow));
    res.json({ success: true, manuallyShownOutOfStock: config.manuallyShownOutOfStock });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Ø¬Ù„Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª
app.get('/api/products', (req, res) => {
  try {
    const products = dataStore.getProducts();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø¶Ø§ÙØ© Ø£Ùˆ ØªØ¹Ø¯ÙŠÙ„ Ù…Ù†ØªØ¬
app.post('/api/products', async (req, res) => {
  try {
    const { id, code, barcode, name, brand, brandAr, mainCategory, category, costPrice, sellPrice, stock, image, images, description } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ Ù…Ø·Ù„ÙˆØ¨' });
    }

    const saved = await dataStore.saveProduct({
      id,
      code,
      barcode: barcode ? String(barcode).trim() : undefined,
      name: name.trim(),
      brand: (brand && brand.trim()) || 'Ø£Ø®Ø±Ù‰',
      brandAr: (brandAr && brandAr.trim()) || (brand && brand.trim()) || 'Ø£Ø®Ø±Ù‰ / Ø¹Ø§Ù…',
      mainCategory: mainCategory || 'Ø£Ø¬Ù‡Ø²Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© ÙƒØ¨ÙŠØ±Ø©',
      category: category || 'Ø¹Ø§Ù…',
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

// ØªØ¹ÙŠÙŠÙ† Ø¨Ø§Ø±ÙƒÙˆØ¯ Ù„ØµÙ†Ù Ù…Ø¹ ÙØ­Øµ ÙˆÙ…Ù†Ø¹ Ø§Ù„ØªÙƒØ±Ø§Ø±
app.post('/api/products/:id/barcode', async (req, res) => {
  try {
    const { id } = req.params;
    const { barcode } = req.body;
    const cleanBarcode = (barcode || '').trim();

    if (!cleanBarcode) {
      return res.status(400).json({ success: false, error: 'Ø±Ù…Ø² Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ù…Ø·Ù„ÙˆØ¨' });
    }

    const products = dataStore.getProducts();
    // ÙØ­Øµ Ù‡Ù„ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ù…Ø³ØªØ®Ø¯Ù… Ù„ØµÙ†Ù Ø¢Ø®Ø±ØŸ
    const duplicate = products.find(p => 
      p.barcode && 
      p.barcode.trim().toLowerCase() === cleanBarcode.toLowerCase() && 
      p.id !== id
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'duplicate',
        message: 'ØªÙ… ØªØ¹Ø±ÙŠÙ Ù‡Ø°Ø§ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ù…Ø³Ø¨Ù‚Ø§Ù‹ Ù„ØµÙ†Ù Ø¢Ø®Ø±',
        existingProduct: {
          id: duplicate.id,
          code: duplicate.code || 'Ø¨Ø¯ÙˆÙ† ÙƒÙˆØ¯',
          name: duplicate.name || 'Ø¨Ø¯ÙˆÙ† Ø§Ø³Ù…',
          brand: duplicate.brand || 'Ø¹Ø§Ù…',
          category: duplicate.category || 'Ø¹Ø§Ù…',
          barcode: duplicate.barcode
        }
      });
    }

    // Ø§Ù„ØµÙ†Ù Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù
    const target = products.find(p => p.id === id);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„ØµÙ†Ù Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    }

    // ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯
    target.barcode = cleanBarcode;
    target.updatedAt = new Date().toISOString();

    const saved = await dataStore.saveProduct(target);
    res.json({ 
      success: true, 
      product: saved,
      message: `ØªÙ… Ø±Ø¨Ø· Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ (${cleanBarcode}) Ø¨Ø§Ù„ØµÙ†Ù Ø¨Ù†Ø¬Ø§Ø­`
    });
  } catch (err) {
    console.error('Barcode assignment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† Ù…Ù†ØªØ¬ Ø¨ÙˆØ§Ø³Ø·Ø© Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯
app.get('/api/barcodes/lookup', (req, res) => {
  try {
    const rawBarcode = req.query.barcode || req.query.code || '';
    const cleanBarcode = String(rawBarcode).trim();

    if (!cleanBarcode) {
      return res.status(400).json({ success: false, error: 'Ø±Ù…Ø² Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ù…Ø·Ù„ÙˆØ¨' });
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
          code: matched.code || 'Ø¨Ø¯ÙˆÙ† ÙƒÙˆØ¯',
          name: matched.name || 'Ø¨Ø¯ÙˆÙ† Ø§Ø³Ù…',
          brand: matched.brand || 'Ø¹Ø§Ù…',
          brandAr: matched.brandAr || 'Ø¹Ø§Ù…',
          category: matched.category || 'Ø¹Ø§Ù…',
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
      message: 'Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ ØºÙŠØ± Ù…Ø³Ø¬Ù„ Ù…Ø³Ø¨Ù‚Ø§Ù‹'
    });
  } catch (err) {
    console.error('Barcode lookup error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ø³Ø±ÙŠØ¹ ÙÙŠ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø¨Ø§Ù„Ø§Ø³Ù… Ø£Ùˆ Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù Ù„Ø±Ø¨Ø· Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯
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
        brand: p.brand || 'Ø¹Ø§Ù…',
        category: p.category || 'Ø¹Ø§Ù…',
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

// Ø¬Ù„Ø¨ Ø¨Ø§Ø±ÙƒÙˆØ¯Ø§Øª Ù…Ù†ØªØ¬ Ù…Ø­Ø¯Ø¯
app.get('/api/products/:id/barcodes', (req, res) => {
  try {
    const { id } = req.params;
    const products = dataStore.getProducts();
    const product = products.find(p => p.id === id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
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

// Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø£Ùˆ Ù†Ù‚Ù„ Ø¨Ø§Ø±ÙƒÙˆØ¯ Ù…Ù† ØµÙ†Ù Ø¥Ù„Ù‰ ØµÙ†Ù Ø¢Ø®Ø± Ø¨ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±ÙŠØ© ØµØ±ÙŠØ­Ø©
app.post('/api/barcodes/reassign', async (req, res) => {
  try {
    const { barcode, targetProductId, note } = req.body;
    const cleanBarcode = String(barcode || '').trim();

    if (!cleanBarcode || !targetProductId) {
      return res.status(400).json({ success: false, error: 'Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ ÙˆÙ…Ø¹Ø±Ù Ø§Ù„ØµÙ†Ù Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù Ù…Ø·Ù„ÙˆØ¨Ø§Ù†' });
    }

    const products = dataStore.getProducts();
    const targetProduct = products.find(p => p.id === targetProductId);
    if (!targetProduct) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„ØµÙ†Ù Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    }

    // Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† Ø§Ù„ØµÙ†Ù Ø§Ù„Ù…Ø±ØªØ¨Ø· Ø­Ø§Ù„ÙŠØ§Ù‹ Ø¨Ù‡Ø°Ø§ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ø¥Ù† ÙˆØ¬Ø¯
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

    // Ø±Ø¨Ø· Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ø¨Ø§Ù„ØµÙ†Ù Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù
    targetProduct.barcode = cleanBarcode;
    targetProduct.updatedAt = new Date().toISOString();
    const saved = await dataStore.saveProduct(targetProduct);

    console.log(`[Barcode Reassign] Barcode '${cleanBarcode}' reassigned to '${targetProduct.name}' (${targetProduct.id}) from '${previousOwnerInfo ? previousOwnerInfo.name : 'none'}'`);

    res.json({
      success: true,
      message: `ØªÙ… Ù†Ù‚Ù„ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ (${cleanBarcode}) Ø¥Ù„Ù‰ Ø§Ù„ØµÙ†Ù "${targetProduct.name}" Ø¨Ù†Ø¬Ø§Ø­`,
      product: saved,
      previousOwner: previousOwnerInfo
    });
  } catch (err) {
    console.error('Barcode reassign error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø²Ø§Ù„Ø© Ø¨Ø§Ø±ÙƒÙˆØ¯ Ù…Ù† ØµÙ†Ù
app.delete('/api/products/:id/barcode', async (req, res) => {
  try {
    const { id } = req.params;
    const products = dataStore.getProducts();
    const target = products.find(p => p.id === id);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„ØµÙ†Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    }

    const oldBarcode = target.barcode;
    target.barcode = '';
    target.updatedAt = new Date().toISOString();
    const saved = await dataStore.saveProduct(target);

    res.json({
      success: true,
      message: `ØªÙ… Ø­Ø°Ù Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ (${oldBarcode}) Ù…Ù† Ø§Ù„ØµÙ†Ù Ø¨Ù†Ø¬Ø§Ø­`,
      product: saved
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø­Ø°Ù Ù…Ù†ØªØ¬
app.delete('/api/products/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteProduct(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø±ÙØ¹ ØµÙˆØ±Ø© Ù„Ù„Ù…Ù†ØªØ¬ (Ù…Ø¹ Ø¯Ø¹Ù… Ø§Ù„ØªØ®Ø²ÙŠÙ† Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠ Ø§Ù„Ø¯Ø§Ø¦Ù… ÙÙŠ Supabase ÙˆØ§Ù„Ø£Ù†Ø¯Ø±ÙˆÙŠØ¯)
let _bucketChecked = false;
async function ensureProductImageBucket() {
  if (!supabase || _bucketChecked) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets && !buckets.some(b => b.name === 'product-images')) {
      await supabase.storage.createBucket('product-images', { public: true });
      console.log('✅ تم إنشاء bucket التخزين product-images في Supabase');
    }
    _bucketChecked = true;
  } catch (err) {
    console.warn('⚠️ فحص/إنشاء bucket التخزين:', err.message);
  }
}

// رفع صورة للمنتج (مع دعم التخزين السحابي الدائم في Supabase وبديل Base64 الآمن)
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'لم يتم اختيار أي صورة' });
    }
    const localUrl = `/uploads/${req.file.filename}`;
    let finalUrl = localUrl;
    let uploadedToCloud = false;

    // رفع دائم إلى Supabase Storage
    if (supabase) {
      try {
        await ensureProductImageBucket();
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
            uploadedToCloud = true;
          }
        } else {
          console.warn('⚠️ تنبيه رفع الصورة إلى Supabase Storage:', upError ? upError.message : 'Unknown');
        }
      } catch (sbErr) {
        console.warn('⚠️ استثناء رفع الصورة لـ Supabase Storage:', sbErr.message);
      }
    }

    // إذا لم ينجح الرفع السحابي وكنا في بيئة Vercel أو بدون سيرفر محلي دائم، نحفظ الصورة كـ base64 لضمان عدم ضياعها أبداً
    if (!uploadedToCloud && (process.env.VERCEL || !supabase)) {
      try {
        const fileContent = fs.readFileSync(req.file.path);
        const mime = req.file.mimetype || 'image/jpeg';
        finalUrl = `data:${mime};base64,${fileContent.toString('base64')}`;
      } catch (b64Err) {
        console.warn('⚠️ تعذر تحويل الصورة إلى base64:', b64Err.message);
      }
    }

    res.json({ success: true, imageUrl: finalUrl, localUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: Ù…Ø²Ø§Ù…Ù†Ø© Ø¨Ø±Ù†Ø§Ù…Ø¬ Ø§Ù„Ø´Ø§Ù…Ù„ Ù„Ø§ÙŠØª (Al-Shamel Lite Sync API)
// -------------------------------------------------------------

// ÙˆØ³ÙŠØ· Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ù…ÙØªØ§Ø­ Ø§Ù„Ø£Ù…Ø§Ù† (API Key Middleware)
const SYNC_API_KEY = process.env.SYNC_API_KEY || 'shamel_sync_secret_key_2026';

function requireSyncAuth(req, res, next) {
  const providedKey = req.headers['x-api-key'] || 
                     (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, '')) ||
                     req.query.apiKey;

  if (!providedKey || providedKey !== SYNC_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'ØºÙŠØ± Ù…ØµØ±Ø­: Ù…ÙØªØ§Ø­ Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø© (API Key) ØºÙŠØ± ØµØ§Ù„Ø­ Ø£Ùˆ Ù…ÙÙ‚ÙˆØ¯'
    });
  }
  next();
}

// 1. ÙØ­Øµ ØµØ­Ø© Ø§Ù„Ø§ØªØµØ§Ù„ ÙˆØ­Ø§Ù„Ø© Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø©
app.get('/api/sync/status', requireSyncAuth, (req, res) => {
  try {
    const meta = dataStore.getLastSyncMeta();
    const products = dataStore.getProducts();
    const availableCount = products.filter(p => !p.isSuspended).length;
    const suspendedCount = products.filter(p => p.isSuspended).length;

    res.json({
      success: true,
      status: 'online',
      message: 'Ø®Ø§Ø¯Ù… Ù…ÙˆÙ‚Ø¹ Ø£Ø¨Ùˆ Ø±Ø§Ù…Ø² Ù…ØªØµÙ„ ÙˆØ¬Ø§Ù‡Ø² Ù„Ù„Ù…Ø²Ø§Ù…Ù†Ø©',
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

// 2. Ø¥Ø±Ø³Ø§Ù„ Ø¯ÙØ¹Ø© Ø£ØµÙ†Ø§Ù Ù„Ù„Ù…Ø²Ø§Ù…Ù†Ø© (Upsert)
app.post('/api/sync/batch', requireSyncAuth, async (req, res) => {
  try {
    const items = req.body.items || req.body.products;
    const mode = req.body.mode || 'full';
    const dryRun = req.body.dryRun || false;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ÙŠØ¬Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ù…ØµÙÙˆÙØ© Ø£ØµÙ†Ø§Ù ØµØ§Ù„Ø­Ø© ÙÙŠ Ø§Ù„Ø­Ù‚Ù„ items Ø£Ùˆ products'
      });
    }

    if (items.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù„Ø¯ÙØ¹Ø© Ø§Ù„ÙˆØ§Ø­Ø¯Ø© Ù‡Ùˆ 500 ØµÙ†Ù Ù„Ø¶Ù…Ø§Ù† Ø³Ø±Ø¹Ø© ÙˆØ§Ø³ØªÙ‚Ø±Ø§Ø± Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø©'
      });
    }

    const result = await dataStore.syncBatchProducts(items, {
      mode,
      dryRun: Boolean(dryRun),
      editorName: 'Ø¨Ø±Ù†Ø§Ù…Ø¬ Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ø´Ø§Ù…Ù„'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø¹Ø§Ø¯Ø© Ø¶Ø¨Ø· ÙˆØ§Ø³ØªØ¨Ø¯Ø§Ù„ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø¨Ø§Ù„ÙƒØ§Ù…Ù„ Ø¨Ù†Ø¸Ø§ÙØ© ØªØ§Ù…Ø© Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„
app.post('/api/sync/reset-products', requireSyncAuth, async (req, res) => {
  try {
    const { items, dryRun = false } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø£ØµÙ†Ø§Ù ÙØ§Ø±ØºØ©' });
    }
    const result = await dataStore.resetAllProducts(items, {
      dryRun: Boolean(dryRun),
      editorName: 'Ø¥Ø¹Ø§Ø¯Ø© Ø¨Ù†Ø§Ø¡ Ù†Ø¸ÙŠÙØ© Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Ø§Ù„Ø§Ø³ØªØ¹Ù„Ø§Ù… Ø¹Ù† Ø­Ø§Ù„Ø© ØµÙ†Ù Ù…Ø¹ÙŠÙ† ÙÙŠ Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø¨Ø§Ù„ÙƒÙˆØ¯
app.get('/api/sync/product/:code', requireSyncAuth, (req, res) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const products = dataStore.getProducts();
    const product = products.find(p => p.code && String(p.code).trim().toUpperCase() === code);

    if (!product) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„ØµÙ†Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ Ø§Ù„Ù…ÙˆÙ‚Ø¹' });
    }

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. ÙØ­Øµ Ø­Ø§Ù„Ø© Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆØ§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ†
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

// 5. Ù…Ø²Ø§Ù…Ù†Ø© Ø¯ÙØ¹Ø© Ø²Ø¨Ø§Ø¦Ù† Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„
app.post('/api/sync/customers', requireSyncAuth, async (req, res) => {
  try {
    const items = req.body.items || req.body.customers;
    const dryRun = req.body.dryRun || false;
    const syncMode = req.body.syncMode || 'upsert';

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'ÙŠØ¬Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ù…ØµÙÙˆÙØ© Ø²Ø¨Ø§Ø¦Ù† ØµØ§Ù„Ø­Ø© ÙÙŠ Ø§Ù„Ø­Ù‚Ù„ items Ø£Ùˆ customers' });
    }
    if (items.length > 1000) {
      return res.status(400).json({ success: false, error: 'Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù„Ø¯ÙØ¹Ø© Ù‡Ùˆ 1000 Ø²Ø¨ÙˆÙ†' });
    }

    const validModes = ['upsert', 'new_only', 'update_only'];
    if (!validModes.includes(syncMode)) {
      return res.status(400).json({ success: false, error: 'Ù‚ÙŠÙ…Ø© syncMode ØºÙŠØ± ØµØ§Ù„Ø­Ø©' });
    }

    const result = await dataStore.syncBatchCustomers(items, {
      dryRun: Boolean(dryRun),
      syncMode,
      editorName: 'Ø¨Ø±Ù†Ø§Ù…Ø¬ Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ø´Ø§Ù…Ù„'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Ù…Ø²Ø§Ù…Ù†Ø© Ø¯ÙØ¹Ø© Ù…ÙˆØ±Ø¯ÙŠÙ† Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„
app.post('/api/sync/suppliers', requireSyncAuth, async (req, res) => {
  try {
    const items = req.body.items || req.body.suppliers;
    const dryRun = req.body.dryRun || false;
    const syncMode = req.body.syncMode || 'upsert';

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'ÙŠØ¬Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ù…ØµÙÙˆÙØ© Ù…ÙˆØ±Ø¯ÙŠÙ† ØµØ§Ù„Ø­Ø© ÙÙŠ Ø§Ù„Ø­Ù‚Ù„ items Ø£Ùˆ suppliers' });
    }
    if (items.length > 500) {
      return res.status(400).json({ success: false, error: 'Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù„Ø¯ÙØ¹Ø© Ù‡Ùˆ 500 Ù…ÙˆØ±Ø¯' });
    }

    const validModes = ['upsert', 'new_only', 'update_only'];
    if (!validModes.includes(syncMode)) {
      return res.status(400).json({ success: false, error: 'Ù‚ÙŠÙ…Ø© syncMode ØºÙŠØ± ØµØ§Ù„Ø­Ø©' });
    }

    const result = await dataStore.syncBatchSuppliers(items, {
      dryRun: Boolean(dryRun),
      syncMode,
      editorName: 'Ø¨Ø±Ù†Ø§Ù…Ø¬ Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ø´Ø§Ù…Ù„'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Ø§Ù„Ø§Ø³ØªØ¹Ù„Ø§Ù… Ø¹Ù† Ø²Ø¨ÙˆÙ† Ø¨ÙƒÙˆØ¯Ù‡ Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„
app.get('/api/sync/customer/:code', requireSyncAuth, (req, res) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const customers = dataStore.getCustomers();
    const customer = customers.find(c =>
      (c.shamelCode && String(c.shamelCode).toUpperCase() === code) ||
      (c.systemNumber && String(c.systemNumber).toUpperCase() === code)
    );
    if (!customer) return res.status(404).json({ success: false, error: 'Ø§Ù„Ø²Ø¨ÙˆÙ† ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Ø§Ù„Ø§Ø³ØªØ¹Ù„Ø§Ù… Ø¹Ù† Ù…ÙˆØ±Ø¯ Ø¨ÙƒÙˆØ¯Ù‡ Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„
app.get('/api/sync/supplier/:code', requireSyncAuth, (req, res) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const suppliers = dataStore.getSuppliers();
    const supplier = suppliers.find(s =>
      s.shamelCode && String(s.shamelCode).toUpperCase() === code
    );
    if (!supplier) return res.status(404).json({ success: false, error: 'Ø§Ù„Ù…ÙˆØ±Ø¯ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    res.json({ success: true, supplier });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. ÙØ­Øµ Ø­Ø§Ù„Ø© Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„ÙÙˆØ§ØªÙŠØ±
app.get('/api/sync/invoices/status', requireSyncAuth, (req, res) => {
  try {
    const invoices = dataStore.getInvoices();
    const meta = dataStore.getLastInvoicesSyncMeta();
    const salesCount = invoices.filter(i => i.invoiceType === 'sales' || i.typeCode === 'I').length;
    const purchaseCount = invoices.filter(i => i.invoiceType === 'purchase' || i.typeCode === 'H').length;
    const salesReturnCount = invoices.filter(i => i.invoiceType === 'sales_return' || i.typeCode === 'S').length;
    const purchaseReturnCount = invoices.filter(i => i.invoiceType === 'purchase_return' || i.typeCode === 'M').length;

    res.json({
      success: true,
      status: 'online',
      serverTime: new Date().toISOString(),
      counts: {
        total: invoices.length,
        sales: salesCount,
        purchase: purchaseCount,
        salesReturn: salesReturnCount,
        purchaseReturn: purchaseReturnCount
      },
      lastSync: meta
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Ù…Ø²Ø§Ù…Ù†Ø© Ø¯ÙØ¹Ø© ÙÙˆØ§ØªÙŠØ± Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„ Ù„Ø§ÙŠØª
app.post('/api/sync/invoices', requireSyncAuth, async (req, res) => {
  try {
    const items = req.body.items || req.body.invoices;
    const dryRun = req.body.dryRun || false;
    const syncMode = req.body.syncMode || 'upsert';
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'ÙŠØ¬Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ù…ØµÙÙˆÙØ© ÙÙˆØ§ØªÙŠØ± ØµØ§Ù„Ø­Ø© ÙÙŠ Ø§Ù„Ø­Ù‚Ù„ items Ø£Ùˆ invoices' });
    }
    if (items.length > 500) {
      return res.status(400).json({ success: false, error: 'Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù„Ø¯ÙØ¹Ø© Ù‡Ùˆ 500 ÙØ§ØªÙˆØ±Ø© Ù„Ø¶Ù…Ø§Ù† Ø³Ø±Ø¹Ø© ÙˆØ§Ø³ØªÙ‚Ø±Ø§Ø± Ø§Ù„Ø®Ø§Ø¯Ù…' });
    }

    const result = await dataStore.syncBatchInvoices(items, {
      dryRun: Boolean(dryRun),
      syncMode,
      editorName: 'Ø¨Ø±Ù†Ø§Ù…Ø¬ Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ø´Ø§Ù…Ù„'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. ÙØ­Øµ Ø­Ø§Ù„Ø© Ù…Ø²Ø§Ù…Ù†Ø© Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ ÙˆØ§Ù„ØµØ±Ù
app.get('/api/sync/vouchers/status', requireSyncAuth, (req, res) => {
  try {
    const receipts = dataStore.getReceipts();
    const meta = dataStore.getLastVouchersSyncMeta();
    const qabdCount = receipts.filter(r => r.voucherType !== 'payment' && r.typeCode !== 'P').length;
    const sarfCount = receipts.filter(r => r.voucherType === 'payment' || r.typeCode === 'P').length;

    res.json({
      success: true,
      status: 'online',
      serverTime: new Date().toISOString(),
      counts: {
        total: receipts.length,
        receipts: qabdCount,
        payments: sarfCount
      },
      lastSync: meta
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Ù…Ø²Ø§Ù…Ù†Ø© Ø¯ÙØ¹Ø© Ø³Ù†Ø¯Ø§Øª Ù‚Ø¨Ø¶ ÙˆØµØ±Ù Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„ Ù„Ø§ÙŠØª
app.post('/api/sync/vouchers', requireSyncAuth, async (req, res) => {
  try {
    const items = req.body.items || req.body.vouchers || req.body.receipts;
    const dryRun = req.body.dryRun || false;
    const syncMode = req.body.syncMode || 'upsert';
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'ÙŠØ¬Ø¨ Ø¥Ø±Ø³Ø§Ù„ Ù…ØµÙÙˆÙØ© Ø³Ù†Ø¯Ø§Øª ØµØ§Ù„Ø­Ø© ÙÙŠ Ø§Ù„Ø­Ù‚Ù„ items Ø£Ùˆ vouchers Ø£Ùˆ receipts' });
    }
    if (items.length > 500) {
      return res.status(400).json({ success: false, error: 'Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù„Ø¯ÙØ¹Ø© Ù‡Ùˆ 500 Ø³Ù†Ø¯' });
    }

    const result = await dataStore.syncBatchVouchers(items, {
      dryRun: Boolean(dryRun),
      syncMode,
      editorName: 'Ø¨Ø±Ù†Ø§Ù…Ø¬ Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ø´Ø§Ù…Ù„'
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Ù…Ø±Ø§Ø¯Ù Ù„Ø¬Ù„Ø¨ Ø§Ù„Ø³Ù†Ø¯Ø§Øª Ù…Ø¹ ØªØµÙÙŠØ© Ù†ÙˆØ¹ Ø§Ù„Ø³Ù†Ø¯
app.get('/api/vouchers', (req, res) => {
  try {
    const { type } = req.query;
    let receipts = dataStore.getReceipts();
    if (type === 'receipt' || type === 'R') {
      receipts = receipts.filter(r => r.voucherType !== 'payment' && r.typeCode !== 'P');
    } else if (type === 'payment' || type === 'P') {
      receipts = receipts.filter(r => r.voucherType === 'payment' || r.typeCode === 'P');
    }
    res.json({ success: true, vouchers: receipts, receipts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: Ø§Ù„ÙÙˆØ§ØªÙŠØ± (Invoices)
// -------------------------------------------------------------

// Ø¬Ù„Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙÙˆØ§ØªÙŠØ±
app.get('/api/invoices', (req, res) => {
  try {
    const invoices = dataStore.getInvoices();
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¬Ù„Ø¨ ØªÙØ§ØµÙŠÙ„ ÙØ§ØªÙˆØ±Ø© ÙˆØ§Ø­Ø¯Ø©
app.get('/api/invoices/:id', (req, res) => {
  try {
    const invoice = dataStore.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„ÙØ§ØªÙˆØ±Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©' });
    }
    res.json({ success: true, invoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ù†Ø´Ø§Ø¡ ÙØ§ØªÙˆØ±Ø© Ø¬Ø¯ÙŠØ¯Ø© (Ù…Ø¨ÙŠØ¹Ø§Øª Ø£Ùˆ Ù…Ø´ØªØ±ÙŠØ§Øª)
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
      customTotalOverride  // Ø³Ø¹Ø± Ù…Ø¹Ø¯Ù‘Ù„ ÙŠØ¯ÙˆÙŠØ§Ù‹ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)
    } = req.body;

    const isQuotationMode = (isQuotation === true || invoiceType === 'quotation');
    const isPurchase = !isQuotationMode && invoiceType === 'purchase';

    if (!customerName || customerName.trim() === '') {
      return res.status(400).json({ success: false, error: isPurchase ? 'Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯ Ù…Ø·Ù„ÙˆØ¨' : 'Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ† Ù…Ø·Ù„ÙˆØ¨' });
    }

    if (!employeeName || employeeName.trim() === '') {
      return res.status(400).json({ success: false, error: 'ÙŠØ±Ø¬Ù‰ ÙƒØªØ§Ø¨Ø© Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'ÙŠØ¬Ø¨ Ø§Ø®ØªÙŠØ§Ø± Ù…Ù†ØªØ¬ ÙˆØ§Ø­Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„ ÙÙŠ Ø§Ù„ÙØ§ØªÙˆØ±Ø©' });
    }

    // Ø­Ø³Ø§Ø¨ Ø§Ù„ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù…Ø§Ù„ÙŠØ© Ø¨Ø¯Ù‚Ø©
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

    // ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ù…Ø¹Ø¯Ù‘Ù„ ÙŠØ¯ÙˆÙŠØ§Ù‹ (Ø¥Ù† ÙˆØ¬Ø¯) Ø¹Ù„Ù‰ Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙØ§ØªÙˆØ±Ø©
    const effectiveTotalAmount = (!isPurchase && customTotalOverride && parseFloat(customTotalOverride) > 0)
      ? parseFloat(customTotalOverride)
      : totalAmount;

    const totalProfit = isPurchase ? 0 : (effectiveTotalAmount - totalCost);
    const profitMarginPercentage = (!isPurchase && effectiveTotalAmount > 0)
      ? parseFloat(((totalProfit / effectiveTotalAmount) * 100).toFixed(1))
      : 0;

    // Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø£Ù‚Ø³Ø§Ø· (Ù„ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª Ø§Ù„ÙØ¹Ù„ÙŠØ© ÙÙ‚Ø·)
    let validatedInstallments = null;
    if (!isPurchase && !isQuotationMode && paymentMethod === 'installments') {
      const downPayment = parseFloat(installmentDetails?.downPayment) || 0;
      const remainingAmount = Math.max(0, effectiveTotalAmount - downPayment);
      validatedInstallments = {
        downPayment,
        remainingAmount,
        duration: installmentDetails?.duration || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯',
        scheduleNotes: installmentDetails?.scheduleNotes || ''
      };
    }

    // â”€â”€â”€ ÙØ­Øµ ØªÙƒØ±Ø§Ø± Ø§Ù„Ø·Ù„Ø¨ (Idempotency) â”€â”€â”€
    const invoiceFingerprint = generateInvoiceFingerprint(req.body);
    const idemCheck = checkIdempotency(invoiceFingerprint);
    if (idemCheck.isDuplicate) {
      if (idemCheck.status === 'completed') return res.json(idemCheck.response);
      return res.status(429).json({ success: false, error: 'Ø·Ù„Ø¨ Ù…Ù…Ø§Ø«Ù„ Ù‚ÙŠØ¯ Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø© Ø­Ø§Ù„ÙŠØ§Ù‹ØŒ ÙŠØ±Ø¬Ù‰ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± Ù„Ø­Ø¸Ø© Ø«Ù… Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø·' });
    }

    // Ø­ÙØ¸ Ø§Ù„ÙØ§ØªÙˆØ±Ø©
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

    // ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ø®Ø²ÙˆÙ†:
    // Ø¥Ø°Ø§ ÙƒØ§Ù†Øª ÙØ§ØªÙˆØ±Ø© Ù…Ø´ØªØ±ÙŠØ§Øª -> Ø²ÙŠØ§Ø¯Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
    // Ø¥Ø°Ø§ ÙƒØ§Ù†Øª ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª ÙØ¹Ù„ÙŠØ© -> Ø®ØµÙ… Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
    // Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø¹Ø±Ø¶ Ø³Ø¹Ø± (ÙØ§ØªÙˆØ±Ø© ØªÙ‚Ø¯ÙŠØ±ÙŠØ©/ÙˆÙ‡Ù…ÙŠØ©) -> Ù„Ø§ ÙŠØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ù…Ø·Ù„Ù‚Ø§Ù‹!
    let updatedStockProducts = [];
    if (isQuotationMode) {
      updatedStockProducts = [];
    } else if (isPurchase) {
      updatedStockProducts = await dataStore.addStockForPurchaseInvoice(validatedItems, employeeName);
    } else {
      updatedStockProducts = await dataStore.deductStockForInvoice(validatedItems, employeeName);
    }

    // Ø¥Ø±Ø³Ø§Ù„ Ø¥Ø´Ø¹Ø§Ø± ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… ÙÙˆØ±Ø§Ù‹ (Ù„ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ§Ù„ØªÙˆØ±ÙŠØ¯ Ø§Ù„ÙØ¹Ù„ÙŠØ© ÙÙ‚Ø·)
    const settings = dataStore.getSettings();
    let telegramResult = { ok: false, error: 'ØºÙŠØ± Ù…Ù‡ÙŠØ£' };

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
        error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… (Bot Token Ùˆ Chat ID)'
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

// Ø¥Ø¹Ø§Ø¯Ø© Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… ÙŠØ¯ÙˆÙŠØ§Ù‹ Ø¥Ø°Ø§ Ø±ØºØ¨ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…
app.post('/api/invoices/:id/resend-telegram', async (req, res) => {
  try {
    const invoice = dataStore.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„ÙØ§ØªÙˆØ±Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©' });
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

// ØªØ­ÙˆÙŠÙ„ ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø¹Ø±Ø¶ Ø¥Ù„Ù‰ ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª ÙØ¹Ù„ÙŠØ©
app.post('/api/invoices/:id/convert-to-sales', async (req, res) => {
  try {
    const { employeeName } = req.body;
    const result = await dataStore.convertQuotationToSalesInvoice(req.params.id, employeeName || 'Ù…Ø³Ø¤ÙˆÙ„ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª');
    const { invoice, warranty } = result;

    // Ø¥Ø±Ø³Ø§Ù„ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¹Ø¯ ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø¹Ø±Ø¶ Ù„ÙØ§ØªÙˆØ±Ø© ÙØ¹Ù„ÙŠØ©
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
// APIs: Ø§Ù„ÙƒÙØ§Ù„Ø§Øª ÙˆØ§Ù„Ø¶Ù…Ø§Ù† (Warranties)
// -------------------------------------------------------------

// Ø¬Ù„Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙƒÙØ§Ù„Ø§Øª
app.get('/api/warranties', (req, res) => {
  try {
    dataStore.checkWarrantyStatuses();
    const warranties = dataStore.getWarranties();
    res.json({ success: true, warranties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¬Ù„Ø¨ ÙƒÙØ§Ù„Ø© ÙˆØ§Ø­Ø¯Ø©
app.get('/api/warranties/:id', (req, res) => {
  try {
    const warranty = dataStore.getWarrantyById(req.params.id);
    if (!warranty) return res.status(404).json({ success: false, error: 'Ø§Ù„ÙƒÙØ§Ù„Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©' });
    res.json({ success: true, warranty });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ù†Ø´Ø§Ø¡ ÙƒÙØ§Ù„Ø© ÙŠØ¯ÙˆÙŠØ§Ù‹ (Ø¨Ø¯ÙˆÙ† ÙØ§ØªÙˆØ±Ø©)
app.post('/api/warranties/manual', (req, res) => {
  try {
    const { customerName } = req.body;
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, error: 'Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ† Ù…Ø·Ù„ÙˆØ¨' });
    }
    const warranty = dataStore.createManualWarranty(req.body);
    res.json({ success: true, warranty });
  } catch (err) {
    console.error('Manual warranty error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ù†Ø´Ø§Ø¡ ÙƒÙØ§Ù„Ø© ÙŠØ¯ÙˆÙŠØ§Ù‹ Ù„ÙØ§ØªÙˆØ±Ø© Ù…ÙˆØ¬ÙˆØ¯Ø©
app.post('/api/warranties/from-invoice/:invoiceId', (req, res) => {
  try {
    const invoice = dataStore.getInvoiceById(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ success: false, error: 'Ø§Ù„ÙØ§ØªÙˆØ±Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©' });
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

// ØªØ­Ø¯ÙŠØ« Ø¨ÙŠØ§Ù†Ø§Øª ÙƒÙØ§Ù„Ø© (Ù…Ø¯Ø© Ø§Ù„ÙƒÙØ§Ù„Ø©ØŒ Ø§Ù„Ø³ÙŠØ±ÙŠØ§Ù„ØŒ Ø§Ù„Ø¹Ù†ÙˆØ§Ù†)
app.patch('/api/warranties/:id', (req, res) => {
  try {
    const updated = dataStore.updateWarranty(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Ø§Ù„ÙƒÙØ§Ù„Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©' });
    res.json({ success: true, warranty: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø­Ø°Ù ÙƒÙØ§Ù„Ø©
app.delete('/api/warranties/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteWarranty(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙˆØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… (Settings & Telegram)
// -------------------------------------------------------------


// Ø¬Ù„Ø¨ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª
app.get('/api/settings', (req, res) => {
  try {
    const settings = dataStore.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª
app.post('/api/settings', async (req, res) => {
  try {
    const updated = await dataStore.saveSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ÙØ­Øµ Ø§Ù„Ø§ØªØµØ§Ù„ Ù…Ø¹ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/telegram/test', async (req, res) => {
  try {
    const { telegramBotToken, telegramChatId, companyName } = req.body;
    const result = await telegramService.testConnection(
      telegramBotToken,
      telegramChatId,
      companyName || 'Ù†Ø¸Ø§Ù… Ø§Ù„ÙÙˆØ§ØªÙŠØ±'
    );
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ… Ù…Ø¹ Ø¯Ø¹Ù… ÙÙ„Ø§ØªØ± Ø§Ù„Ù…Ø¯Ø© Ø§Ù„Ø²Ù…Ù†ÙŠØ© ÙˆØ­Ø³Ø§Ø¨ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ Ø§Ù„ÙƒÙ„ÙŠ Ù„Ù„Ù…Ø®Ø²ÙˆÙ†
app.get('/api/dashboard', (req, res) => {
  try {
    const invoices = dataStore.getInvoices();
    const products = dataStore.getProducts();

    const period = (req.query.period || 'all').toLowerCase();
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Ø­Ø³Ø§Ø¨ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ Ø§Ù„ÙƒÙ„ÙŠ Ù„Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ Ø¨Ø§Ù„Ù‚Ø·Ø¹ ÙˆØ§Ù„ØªÙƒÙ„ÙØ© ÙˆØ§Ù„Ø¨ÙŠØ¹
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

    // ÙÙ„ØªØ±Ø© Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ø¨Ø­Ø³Ø¨ Ø§Ù„Ù…Ø¯Ø© Ø§Ù„Ø²Ù…Ù†ÙŠØ© Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø©
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
        // Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª Ø±Ø£Ø³ Ù…Ø§Ù„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„Ø­Ø§Ù„ÙŠ
        totalInventoryCapital,
        totalStockUnits,
        totalInventoryRetail,
        expectedInventoryProfit,
        // Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ÙÙ„ØªØ±Ø©
        period,
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ØªØ­Ø¯ÙŠØ« ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ø¬Ø±Ø¯ Ø¯ÙØ¹Ø©Ù‹ ÙˆØ§Ø­Ø¯Ø©
app.post('/api/inventory/update', async (req, res) => {
  try {
    const { updates, editorName } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ù„Ù„ØªØ­Ø¯ÙŠØ«' });
    }
    const result = dataStore.updateInventoryBulk(updates, editorName);

    // Ø¥Ø´Ø¹Ø§Ø± ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¥Ø¬Ø±Ø§Ø¡ Ø§Ù„Ø¬Ø±Ø¯ Ù…Ø¹ ØªÙØ§ØµÙŠÙ„ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª Ø§Ù„ØªÙŠ Ø­ØµÙ„Øª Ø¨ØªÙ†Ø³ÙŠÙ‚ HTML ÙˆØ§Ø¶Ø­
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

// Ø¥Ø±Ø³Ø§Ù„ ØªÙ‚Ø±ÙŠØ± Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¬Ø±Ø¯ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/inventory/send-report-telegram', async (req, res) => {
  try {
    const { title, searchQuery, category, brand, summary, items } = req.body;
    const settings = dataStore.getSettings();

    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¹Ø¯' });
    }

    const cur = settings.currency || 'Ø´ÙŠÙƒÙ„';
    const reportTitle = title || 'ØªÙ‚Ø±ÙŠØ± Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†';

    let filterDesc = 'ÙƒØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†';
    if (searchQuery) filterDesc = `Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø¹Ù†: "${searchQuery}"`;
    else if (category && category !== 'all') filterDesc = `Ù‚Ø³Ù…: ${category}`;
    else if (brand && brand !== 'all') filterDesc = `Ù…Ø§Ø±ÙƒØ©: ${brand}`;

    let itemsText = '';
    (items || []).slice(0, 30).forEach((item, idx) => {
      const stock = parseInt(item.stock) || 0;
      const cost = parseFloat(item.costPrice) || 0;
      const totalCost = stock * cost;
      const zeroTag = stock === 0 ? ' [âš ï¸ Ù†Ø§ÙØ¯]' : '';

      itemsText += `â–«ï¸ *${idx + 1}. ${item.name}* ${item.code ? `(#${item.code})` : ''}${zeroTag}\n` +
        `   Ø§Ù„ÙƒÙ…ÙŠØ©: *${stock}* | Ø§Ù„ØªÙƒÙ„ÙØ©: ${cost.toLocaleString('en-US')} ${cur} (Ø¥Ø¬Ù…Ø§Ù„ÙŠ: *${totalCost.toLocaleString('en-US')}*)\n`;
    });

    if ((items || []).length > 30) {
      itemsText += `\n... ÙˆØ¨Ø§Ù‚ÙŠ ${items.length - 30} ØµÙ†ÙØ§Ù‹ Ø¢Ø®Ø± Ø¶Ù…Ù† Ù†ØªØ§Ø¦Ø¬ Ø§Ù„ØªÙ‚Ø±ÙŠØ±.`;
    }

    const msg =
      `ðŸ“Š *${reportTitle} - ${settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}*\n` +
      `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
      `ðŸ” Ù†Ø·Ø§Ù‚ Ø§Ù„ØªÙ‚Ø±ÙŠØ±: *${filterDesc}*\n` +
      `ðŸ“¦ Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù: *${summary?.count || (items || []).length} ØµÙ†Ù*\n` +
      `ðŸ”¢ Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù‚Ø·Ø¹: *${(summary?.totalUnits || 0).toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©*\n` +
      `ðŸ’° Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„: *${(summary?.totalCapital || 0).toLocaleString('en-US')} ${cur}*\n` +
      `âš ï¸ Ø£ØµÙ†Ø§Ù Ù†Ø§ÙØ¯Ø© (0): *${summary?.zeroCount || 0} ØµÙ†Ù*\n` +
      `ðŸ• ÙˆÙ‚Øª Ø§Ù„ØªÙ‚Ø±ÙŠØ±: ${formatServerDateTime(new Date())}\n` +
      `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
      `ðŸ“‹ *Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø£ØµÙ†Ø§Ù ÙˆØ§Ù„ØªÙƒÙ„ÙØ©:*\n` +
      itemsText;

    const telegramService = require('./telegramService');
    const result = await telegramService.sendRawMessage(settings.telegramBotToken, settings.telegramChatId, msg);

    if (result.ok) {
      res.json({ success: true, message: 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ Ø§Ø³ØªÙ…Ø§Ø±Ø© ÙƒØ´Ù Ø§Ù„Ø¬Ø±Ø¯ Ø§Ù„ÙØ¹Ù„ÙŠ Ù„Ù„Ù…ÙˆØ¸ÙÙŠÙ† (ÙŠØ¯ÙˆÙŠ) Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… ÙƒÙ…Ù„Ù Excel Ø§Ø­ØªØ±Ø§ÙÙŠ
app.post('/api/inventory/send-stocktake-excel-telegram', async (req, res) => {
  try {
    const { items, scopeLabel, sizeLabel } = req.body;
    const settings = dataStore.getSettings();

    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… (Bot Token Ø£Ùˆ Chat ID) Ø¨Ø¹Ø¯' });
    }

    const XLSX = require('xlsx');
    const telegramService = require('./telegramService');

    const productList = Array.isArray(items) && items.length > 0 ? items : dataStore.getProducts();
    const headers = [
      '#',
      'Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù (Ø§Ù„ÙƒÙˆØ¯)',
      'Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù ÙˆØ§Ù„Ù…ÙˆØ§ØµÙØ§Øª',
      'Ø§Ù„Ù…Ø§Ø±ÙƒØ©',
      'Ø§Ù„Ù‚Ø³Ù… Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ',
      'Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø­Ø§Ù„ÙŠØ© Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…',
      'Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„ÙØ¹Ù„ÙŠØ© (Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©) âœï¸',
      'Ù…Ù„Ø§Ø­Ø¸Ø§Øª / ÙØ±ÙˆÙ‚Ø§Øª'
    ];

    const rows = [headers];
    let totalStock = 0;

    productList.forEach((p, idx) => {
      const stock = parseInt(p.stock) || 0;
      totalStock += stock;
      rows.push([
        idx + 1,
        p.code || '',
        p.name || '',
        p.brand || '',
        p.mainCategory || p.category || 'Ø£Ø®Ø±Ù‰',
        stock,
        '',
        ''
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 45 },
      { wch: 15 },
      { wch: 22 },
      { wch: 18 },
      { wch: 25 },
      { wch: 25 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'ÙƒØ´Ù Ø§Ù„Ø¬Ø±Ø¯ Ø§Ù„ÙØ¹Ù„ÙŠ Ù„Ù„Ù…ÙˆØ¸ÙÙŠÙ†');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const now = new Date();
    const dateFormatted = now.getDate() + '-' + (now.getMonth() + 1) + '-' + now.getFullYear();
    const fileName = 'ÙƒØ´Ù_Ø¬Ø±Ø¯_Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ†_ÙŠØ¯ÙˆÙŠ_' + dateFormatted + '.xlsx';

    const caption = 
      'ðŸ“‹ <b>Ø§Ø³ØªÙ…Ø§Ø±Ø© ÙƒØ´Ù Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ Ù„Ù„Ù…ÙˆØ¸ÙÙŠÙ† (Ù…Ù„Ù Excel Ø¬Ø§Ù‡Ø² Ù„Ù„ØªØ¹Ø¨Ø¦Ø©)</b>\n' +
      'ðŸ¢ <b>' + (settings.companyName || 'Ù…Ø¹Ø±Ø¶ Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©') + '</b>\n' +
      'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n' +
      'ðŸ“¦ <b>Ø§Ù„Ù†Ø·Ø§Ù‚:</b> ' + (scopeLabel || 'ÙƒØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†') + '\n' +
      'ðŸ”¢ <b>Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù:</b> <b>' + productList.length.toLocaleString('en-US') + ' ØµÙ†Ù</b>\n' +
      'ðŸ“Š <b>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù‚Ø·Ø¹ Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…:</b> <b>' + totalStock.toLocaleString('en-US') + ' Ù‚Ø·Ø¹Ø©</b>\n' +
      'ðŸ“ <b>Ø­Ø¬Ù… Ø§Ù„ÙƒØ´Ù:</b> ' + (sizeLabel || 'Ù‚ÙŠØ§Ø³ÙŠ') + '\n' +
      'ðŸ• <b>Ø§Ù„ÙˆÙ‚Øª ÙˆØ§Ù„ØªØ§Ø±ÙŠØ®:</b> ' + formatServerDateTime(now) + '\n' +
      '<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ù…Ù„Ù ÙƒØ´Ù Ø§Ù„Ø¬Ø±Ø¯ Ø¨ØµÙŠØºØ© Excel ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ ÙƒØ§ÙØ© Ø§Ù„Ø£Ø¹Ù…Ø¯Ø© ÙˆØ§Ù„Ø®Ø§Ù†Ø§Øª Ø§Ù„Ù…Ø®ØµØµØ© Ù„Ù„ØªØ¹Ø¨Ø¦Ø© Ø§Ù„ÙŠØ¯ÙˆÙŠØ©.</i>';

    const result = await telegramService.sendDocument(
      settings.telegramBotToken,
      settings.telegramChatId,
      buffer,
      fileName,
      caption,
      'HTML'
    );

    if (result.ok) {
      res.json({ success: true, message: 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø§Ù„Ø¬Ø±Ø¯ Excel Ø¨Ù†Ø¬Ø§Ø­ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…Ù„Ù Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…' });
    }
  } catch (err) {
    console.error('Error in send-stocktake-excel-telegram:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù PDF Ø§Ù„ÙØ¹Ù„ÙŠ Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø¬Ø±Ø¯ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/inventory/send-pdf-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();

    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¹Ø¯' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ù…Ù„Ù Ø§Ù„Ù€ PDF' });
    }

    const { scope, totalUnits, totalCapital, zeroCount, itemCount, title } = req.body;
    const cur = settings.currency || 'Ø´ÙŠÙƒÙ„';
    const reportTitle = title || 'ØªÙ‚Ø±ÙŠØ± Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„';

    const caption = 
`ðŸ“„ <b>${reportTitle} (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ Ù…Ø±ÙÙ‚)</b>
ðŸ¢ <b>${settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ” <b>Ù†Ø·Ø§Ù‚ Ø§Ù„Ø¬Ø±Ø¯:</b> ${scope || 'Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ø­Ø§Ù„ÙŠØ©'}
ðŸ“¦ <b>Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù:</b> <b>${itemCount || 0} ØµÙ†Ù</b>
ðŸ”¢ <b>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù‚Ø·Ø¹:</b> <b>${Number(totalUnits || 0).toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</b>
ðŸ’° <b>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„:</b> <b>${Number(totalCapital || 0).toLocaleString('en-US')} ${cur}</b>
âš ï¸ <b>Ø£ØµÙ†Ø§Ù Ù†Ø§ÙØ¯Ø© (0):</b> <b>${zeroCount || 0} ØµÙ†Ù</b>
ðŸ• <b>ÙˆÙ‚Øª Ø¥ØµØ¯Ø§Ø± Ø§Ù„ØªÙ‚Ø±ÙŠØ±:</b> ${formatServerDateTime(new Date())}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
<i>ðŸ“Ž ØªØ¬Ø¯ÙˆÙ† Ø£Ø¹Ù„Ø§Ù‡ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ø§Ù„ÙƒØ§Ù…Ù„ Ù„Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†ØŒ Ø¬Ø§Ù‡Ø² Ù„Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© ÙˆØ§Ù„ØªØ­Ù…ÙŠÙ„ ÙˆØ§Ù„Ø·Ø¨Ø§Ø¹Ø©.</i>`;

    const fileName = req.file.originalname || `ØªÙ‚Ø±ÙŠØ±_Ø¬Ø±Ø¯_${Date.now()}.pdf`;
    const result = await telegramService.sendDocument(
      settings.telegramBotToken,
      settings.telegramChatId,
      req.file.buffer,
      fileName,
      caption,
      'HTML'
    );

    if (result.ok) {
      res.json({ success: true, message: 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…' });
    }
  } catch (err) {
    console.error('Error sending PDF to telegram:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ Ø£ÙŠ Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ (ÙØ§ØªÙˆØ±Ø©ØŒ Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ØŒ Ù…Ø­Ø¶Ø± Ø¬Ø±Ø¯ØŒ ØªÙ‚Ø±ÙŠØ± Ù…Ø§Ù„ÙŠØŒ ØªÙ‚Ø±ÙŠØ± Ù…Ø®Ø²ÙˆÙ†) Ù…Ø¨Ø§Ø´Ø±Ø© Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/telegram/send-pdf-document', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();

    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… (Bot Token Ø£Ùˆ Chat ID) Ø¨Ø¹Ø¯' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ù…Ù„Ù Ø§Ù„Ù€ PDF' });
    }

    const { fileName, caption } = req.body;
    const resolvedFileName = fileName || req.file.originalname || `document_${Date.now()}.pdf`;

    console.log(`[Telegram PDF API] Sending document "${resolvedFileName}", buffer size: ${req.file.buffer.length} bytes`);

    const result = await telegramService.sendDocument(
      settings.telegramBotToken,
      settings.telegramChatId,
      req.file.buffer,
      resolvedFileName,
      caption || 'ðŸ“Ž Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ Ù…Ø±ÙÙ‚ Ù…Ù† Ø§Ù„Ù†Ø¸Ø§Ù…',
      'HTML'
    );

    if (result.ok) {
      res.json({ success: true, message: 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ø§Ù„Ø±Ø³Ù…ÙŠ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…Ù„Ù Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…' });
    }
  } catch (err) {
    console.error('Error sending document to telegram:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ (Receipts)
// -------------------------------------------------------------

// Ø¬Ù„Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø³Ù†Ø¯Ø§Øª
app.get('/api/receipts', (req, res) => {
  try {
    const receipts = dataStore.getReceipts();
    res.json({ success: true, receipts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ù†Ø´Ø§Ø¡ Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ø¬Ø¯ÙŠØ¯
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
      isSupplier,
      accountType,
      amount,
      description,
      notes,
      paymentMethod
    } = req.body;

    if (!employeeName || !employeeName.trim()) {
      return res.status(400).json({ success: false, error: 'Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù Ù…Ø·Ù„ÙˆØ¨' });
    }
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ success: false, error: 'Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ† Ù…Ø·Ù„ÙˆØ¨' });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Ø§Ù„Ù…Ø¨Ù„Øº ÙŠØ¬Ø¨ Ø£Ù† ÙŠÙƒÙˆÙ† Ø£ÙƒØ¨Ø± Ù…Ù† ØµÙØ±' });
    }

    // â”€â”€â”€ ÙØ­Øµ ØªÙƒØ±Ø§Ø± Ø§Ù„Ø·Ù„Ø¨ (Idempotency) â”€â”€â”€
    const receiptFingerprint = generateReceiptFingerprint(req.body);
    const receiptIdem = checkIdempotency(receiptFingerprint);
    if (receiptIdem.isDuplicate) {
      if (receiptIdem.status === 'completed') return res.json(receiptIdem.response);
      return res.status(429).json({ success: false, error: 'Ø·Ù„Ø¨ Ù…Ù…Ø§Ø«Ù„ Ù‚ÙŠØ¯ Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø© Ø­Ø§Ù„ÙŠØ§Ù‹ØŒ ÙŠØ±Ø¬Ù‰ Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± Ù„Ø­Ø¸Ø© Ø«Ù… Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø·' });
    }
        const receipt = await dataStore.createReceipt({
      employeeName,
      customerName,
      customerPhone,
      customerId,
      customerSystemNumber,
      previousBalance,
      remainingBalance,
      isSupplier,
      accountType,
      amount,
      description,
      notes,
      paymentMethod
    });

    // Ø¥Ø´Ø¹Ø§Ø± ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ù„Ù„Ø³Ù†Ø¯ Ø¨ØªÙ†Ø³ÙŠÙ‚ ÙˆØ§Ø¶Ø­
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
// APIs: Ø¯Ù„ÙŠÙ„ Ø¯ÙŠÙˆÙ† ÙˆØ£Ø±ØµØ¯Ø© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† (Customers & Debts)
// -------------------------------------------------------------

// Ø¬Ù„Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆØ§Ù„Ø£Ø±ØµØ¯Ø© (Ù…Ø¹ Ø¥Ù…ÙƒØ§Ù†ÙŠØ© ØªØ¶Ù…ÙŠÙ† Ø§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† ÙƒØ­Ø³Ø§Ø¨Ø§Øª)
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
          notes: s.notes || (rawBal !== 0 ? `Ù…Ø³ØªØ­Ù‚ Ø¯Ø§Ø¦Ù† Ù„Ù„Ù…ÙˆØ±Ø¯: ${rawBal.toLocaleString('en-US')} Ø´ÙŠÙƒÙ„` : ''),
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

// Ø¬Ù„Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† ÙˆØ§Ù„Ø£Ø±ØµØ¯Ø©
app.get('/api/suppliers', (req, res) => {
  try {
    // Ù†ÙØ±Ø¬Ø¹ Ø§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† Ù…Ø¹ shamelBalance ÙƒØ±ØµÙŠØ¯ Ø§Ù„Ø¹Ø±Ø¶ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„
    const suppliers = dataStore.getSuppliers().map(function(s) {
      var displayBal = s.shamelBalance !== undefined ? s.shamelBalance : (parseFloat(s.balance) || 0);
      return Object.assign({}, s, { balance: displayBal });
    });
    res.json({ success: true, suppliers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø¶Ø§ÙØ© Ø£Ùˆ ØªØ¹Ø¯ÙŠÙ„ Ø²Ø¨ÙˆÙ†
app.post('/api/customers', async (req, res) => {
  try {
    const { id, systemNumber, name, phone, balance, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ† Ù…Ø·Ù„ÙˆØ¨' });
    }
    const saved = await dataStore.saveCustomer({ id, systemNumber, name, phone, balance, notes });
    res.json({ success: true, customer: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ø¬Ù…Ø§Ø¹ÙŠ Ù…Ù† CSV
app.post('/api/customers/bulk', (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ success: false, error: 'Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙØ§Ø±ØºØ©' });
    }
    const result = dataStore.importCustomersBulk(customers);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ù…Ù„Ù Excel Ø£Ùˆ CSV Ù„Ù„Ø²Ø¨Ø§Ø¦Ù†
app.post('/api/customers/upload-excel', pdfUpload.single('file'), (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø£ÙŠ Ù…Ù„Ù' });
    }

    const parsed = excelParser.parseCustomerExcel(req.file.buffer);
    if (!parsed || !parsed.customers || parsed.customers.length === 0) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø£ÙŠ Ø²Ø¨Ø§Ø¦Ù† ØµØ§Ù„Ø­ÙŠÙ† Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ù„Ù' });
    }

    if (req.query.preview === 'true' || req.body.preview === 'true') {
      return res.json({
        success: true,
        isPreview: true,
        parsedCount: parsed.count,
        summary: parsed.summary,
        sample: parsed.customers.slice(0, 10),
        message: `ØªÙ… ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ù„Ù Ø¨Ù†Ø¬Ø§Ø­! ØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ ${parsed.count} Ø²Ø¨ÙˆÙ†.`
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
      message: `ØªÙ… Ø¨Ù†Ø¬Ø§Ø­ Ø§Ø³ØªÙŠØ±Ø§Ø¯ ÙˆØªØ­Ø¯ÙŠØ« ${parsed.count} Ø²Ø¨ÙˆÙ† Ù…Ø¹ Ø£Ø±ØµØ¯ØªÙ‡Ù… Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…!`
    });
  } catch (err) {
    console.error('Excel upload error:', err);
    res.status(400).json({ success: false, error: 'Ø®Ø·Ø£ ÙÙŠ Ù…Ø¹Ø§Ù„Ø¬Ø© Ù…Ù„Ù Ø§Ù„Ø¥ÙƒØ³Ù„: ' + err.message });
  }
});

// ØªØ­Ù…ÙŠÙ„ Ù†Ù…ÙˆØ°Ø¬ Excel ÙØ§Ø±Øº Ø§Ø³ØªØ±Ø´Ø§Ø¯ÙŠ Ù„ØªØ¹Ø¨Ø¦Ø© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†
app.get('/api/customers/download-template', (req, res) => {
  try {
    const buffer = excelParser.generateCustomerTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const safeName = encodeURIComponent('Ù†Ù…ÙˆØ°Ø¬_Ø§Ø³ØªÙŠØ±Ø§Ø¯_Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†.xlsx');
    res.setHeader('Content-Disposition', `attachment; filename="customers_template.xlsx"; filename*=UTF-8''${safeName}`);
    res.send(buffer);
  } catch (err) {
    console.error('Template download error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¬Ù„Ø¨ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ Ø²Ø¨ÙˆÙ† ØªÙØµÙŠÙ„ÙŠ
app.get('/api/customers/:id/statement', (req, res) => {
  try {
    const fromDate = req.query.from || null;
    const toDate = req.query.to || null;
    const sortOrder = req.query.sort || 'desc'; // 'asc' or 'desc'
    const filterType = req.query.type || 'all'; // 'all','invoices','vouchers','receipts','payments'
    const statement = dataStore.getCustomerStatement(req.params.id, { fromDate, toDate, sortOrder, filterType });
    if (!statement) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„Ø²Ø¨ÙˆÙ† ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    }
    res.json({ success: true, statement });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ Ø§Ù„Ø²Ø¨ÙˆÙ† Ø§Ù„Ø±Ø³Ù…ÙŠ Ù…Ø¹ Ù…Ù„Ù PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/customers/:id/send-statement-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¹Ø¯' });
    }

    const statement = dataStore.getCustomerStatement(req.params.id);
    if (!statement) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„Ø²Ø¨ÙˆÙ† ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    }

    // 1. Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ù†ØµÙŠØ©
    await telegramService.sendCustomerStatementNotification(statement.customer, statement.summary, settings);

    // 2. Ø¥Ø±ÙØ§Ù‚ Ù…Ù„Ù PDF
    if (req.file && req.file.buffer) {
      const fileName = req.file.originalname || `ÙƒØ´Ù_Ø­Ø³Ø§Ø¨_${statement.customer.name.replace(/\s+/g, '_')}.pdf`;
      const cur = settings.currency || 'Ø´ÙŠÙƒÙ„';
      const bal = parseFloat(statement.customer.balance) || 0;
      const balText = bal > 0 ? `Ø¯ÙŠÙ† Ø¹Ù„ÙŠÙ‡: ${bal.toLocaleString('en-US')} ${cur}` : (bal < 0 ? `Ø±ØµÙŠØ¯ Ù„Ù‡: ${Math.abs(bal).toLocaleString('en-US')} ${cur}` : `Ø±ØµÙŠØ¯ Ø®Ø§Ù„Øµ`);

      const caption = 
`ðŸ“„ <b>ÙƒØ´Ù Ø­Ø³Ø§Ø¨ ØªÙØµÙŠÙ„ÙŠ Ù…Ø¹ØªÙ…Ø¯ (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ)</b>
ðŸ¢ <b>${settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ‘¤ <b>Ø§Ù„Ø²Ø¨ÙˆÙ†:</b> ${statement.customer.name} (Ø­Ø³Ø§Ø¨ #${statement.customer.systemNumber || '--'})
ðŸ’° <b>Ø§Ù„Ø±ØµÙŠØ¯:</b> <b>${balText}</b>
ðŸ“… <b>Ø§Ù„ØªØ§Ø±ÙŠØ®:</b> ${formatServerDateTime(new Date())}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ø£Ø¹Ù„Ø§Ù‡ Ù…Ù„Ù ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ø§Ù„Ø±Ø³Ù…ÙŠ Ø§Ù„Ù…Ø¹ØªÙ…Ø¯ Ø¬Ø§Ù‡Ø² Ù„Ù„Ø·Ø¨Ø§Ø¹Ø© ÙˆØ§Ù„ØªØ¯Ù‚ÙŠÙ‚.</i>`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({ success: true, message: `ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ "${statement.customer.name}" Ù…Ø¹ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!` });
  } catch (err) {
    console.error('Send statement error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø´Ø§Ù…Ù„ Ù„Ø¯ÙŠÙˆÙ† ÙˆØ£Ø±ØµØ¯Ø© ÙƒØ§ÙØ© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ù…Ø¹ Ù…Ù„Ù PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/customers/send-debts-report-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¹Ø¯' });
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

    // 1. Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ù†ØµÙŠØ©
    await telegramService.sendCustomerDebtsReportNotification(reportData, settings);

    // 2. Ø¥Ø±ÙØ§Ù‚ Ù…Ù„Ù PDF
    if (req.file && req.file.buffer) {
      const cur = settings.currency || 'Ø´ÙŠÙƒÙ„';
      const fileName = req.file.originalname || `ÙƒØ´Ù_Ø¯ÙŠÙˆÙ†_Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†_${Date.now()}.pdf`;
      const caption = 
`ðŸ“„ <b>ØªÙ‚Ø±ÙŠØ± Ø¯ÙŠÙˆÙ† ÙˆØ£Ø±ØµØ¯Ø© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ ÙƒØ§Ù…Ù„)</b>
ðŸ¢ <b>${settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ‘¥ <b>Ø¹Ø¯Ø¯ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†:</b> <b>${reportData.totalCount} Ø²Ø¨ÙˆÙ†</b>
ðŸ”´ <b>Ø§Ù„Ø¯ÙŠÙˆÙ† Ø§Ù„ØªÙŠ Ø¹Ù„ÙŠÙ‡Ù…:</b> <b>${reportData.totalDebit.toLocaleString('en-US')} ${cur}</b>
ðŸ”µ <b>Ø§Ù„Ø¯ÙŠÙˆÙ† Ø§Ù„ØªÙŠ Ù„Ù‡Ù…:</b> <b>${reportData.totalCredit.toLocaleString('en-US')} ${cur}</b>
ðŸ“… <b>Ø§Ù„ÙˆÙ‚Øª:</b> ${formatServerDateTime(new Date())}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ø£Ø¹Ù„Ø§Ù‡ Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ø§Ù„ÙƒØ§Ù…Ù„ Ù„ÙƒØ§ÙØ© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆØ£Ø±ØµØ¯ØªÙ‡Ù….</i>`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({ success: true, message: 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø¯ÙŠÙˆÙ† Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆÙ…Ù„Ù Ø§Ù„Ù€ PDF Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!' });
  } catch (err) {
    console.error('Send debts report error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ ÙˆØ§Ù„Ø£Ø±Ø¨Ø§Ø­ ÙƒÙ…Ù„Ù PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/financial-report/send-pdf-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¹Ø¯' });
    }

    const { periodTitle, totalSales, totalCost, totalProfit, profitMargin, invoiceCount } = req.body;

    const reportData = {
      periodTitle: periodTitle || 'ÙƒØ§Ù…Ù„ Ø§Ù„ÙØªØ±Ø©',
      totalSales: parseFloat(totalSales) || 0,
      totalCost: parseFloat(totalCost) || 0,
      totalProfit: parseFloat(totalProfit) || 0,
      profitMargin: profitMargin || '0',
      invoiceCount: parseInt(invoiceCount) || 0
    };

    // 1. Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ù†ØµÙŠØ© Ø§Ù„ØªÙ„Ø®ÙŠØµÙŠØ©
    await telegramService.sendFinancialReportNotification(reportData, settings);

    // 2. Ø¥Ø±ÙØ§Ù‚ Ù…Ù„Ù PDF
    if (req.file && req.file.buffer) {
      const fileName = req.file.originalname || `ØªÙ‚Ø±ÙŠØ±_Ù…Ø§Ù„ÙŠ_${Date.now()}.pdf`;
      const cur = settings.currency || 'Ø´ÙŠÙƒÙ„';
      const caption = 
`ðŸ“„ <b>Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ ÙˆØ§Ù„Ø£Ø±Ø¨Ø§Ø­ Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠ (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ)</b>
ðŸ¢ <b>${settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
â±ï¸ <b>Ø§Ù„ÙØªØ±Ø©:</b> <b>${reportData.periodTitle}</b>
ðŸ’µ <b>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª:</b> <b>${reportData.totalSales.toLocaleString('en-US')} ${cur}</b>
ðŸ“ˆ <b>ØµØ§ÙÙŠ Ø§Ù„Ø±Ø¨Ø­:</b> ðŸŸ¢ <b>+${reportData.totalProfit.toLocaleString('en-US')} ${cur}</b> (${reportData.profitMargin}%)
ðŸ“… <b>ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¥ØµØ¯Ø§Ø±:</b> ${formatServerDateTime(new Date())}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ Ø§Ù„Ø±Ø³Ù…ÙŠ Ø§Ù„Ø´Ø§Ù…Ù„ Ø¨ØµÙŠØºØ© PDF.</i>`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({ success: true, message: 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ ÙˆÙ…Ù„Ù Ø§Ù„Ù€ PDF Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!' });
  } catch (err) {
    console.error('Financial report send error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ù…Ø¹ Ù…Ù„Ù PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/receipts/:id/send-pdf-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¹Ø¯' });
    }

    const receipts = dataStore.getReceipts();
    const receipt = receipts.find(r => r.id === req.params.id || String(r.receiptNumber) === String(req.params.id));
    if (!receipt) {
      return res.status(404).json({ success: false, error: 'Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    }

    // 1. Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ù†ØµÙŠØ© Ù„Ù„Ø³Ù†Ø¯
    await telegramService.sendReceiptNotification(receipt, settings);

    // 2. Ø¥Ø±ÙØ§Ù‚ Ù…Ù„Ù PDF
    if (req.file && req.file.buffer) {
      const cur = settings.currency || 'Ø´ÙŠÙƒÙ„';
      const isSupp = Boolean(receipt.isSupplier || receipt.accountType === 'supplier');
      const remBal = parseFloat(receipt.remainingBalance) || 0;
      let remText = '';
      if (isSupp) {
        if (remBal > 0) remText = `â³ <b>Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ù„Ù‡ Ø¨Ø°Ù…ØªÙ†Ø§:</b> <b>${Number(remBal).toLocaleString('en-US')} ${cur}</b>`;
        else if (remBal < 0) remText = `â³ <b>Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ø¹Ù„ÙŠÙ‡ Ù„Ù†Ø§:</b> <b>${Number(Math.abs(remBal)).toLocaleString('en-US')} ${cur}</b>`;
        else remText = `â³ <b>Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ:</b> <b>0 ${cur} (ØªÙ… ØªØ³Ø¯ÙŠØ¯ ÙƒØ§Ù…Ù„ Ø§Ù„Ø­Ø³Ø§Ø¨)</b>`;
      } else {
        if (remBal > 0) remText = `â³ <b>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ø¹Ù„ÙŠÙ‡:</b> <b>${Number(remBal).toLocaleString('en-US')} ${cur}</b>`;
        else if (remBal < 0) remText = `â³ <b>Ø±ØµÙŠØ¯ Ø¯Ø§Ø¦Ù† Ù„Ù„Ø²Ø¨ÙˆÙ†:</b> <b>${Number(Math.abs(remBal)).toLocaleString('en-US')} ${cur}</b>`;
        else remText = `â³ <b>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ:</b> <b>0 ${cur} (ØªÙ… Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„)</b>`;
      }

      const fileName = req.file.originalname || (isSupp ? `Ø³Ù†Ø¯_ØµØ±Ù_${receipt.receiptNumber}.pdf` : `Ø³Ù†Ø¯_Ù‚Ø¨Ø¶_${receipt.receiptNumber}.pdf`);
      const caption = isSupp ?
`ðŸ“„ <b>Ø³Ù†Ø¯ ØµØ±Ù Ù„Ù…ÙˆØ±Ø¯ Ù…Ø¹ØªÙ…Ø¯ #${receipt.receiptNumber} (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ)</b>
ðŸ¢ <b>${settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ¢ <b>Ø§Ù„Ù…ÙˆØ±Ø¯:</b> ${receipt.customerName}
ðŸ’µ <b>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…ØµØ±ÙˆÙ:</b> ðŸ”´ <b>${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</b>
${remText}
ðŸ“… <b>Ø§Ù„ØªØ§Ø±ÙŠØ®:</b> ${formatServerDateTime(receipt.createdAt)}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ø£Ø¹Ù„Ø§Ù‡ Ù…Ù„Ù Ø³Ù†Ø¯ Ø§Ù„ØµØ±Ù Ø§Ù„Ø±Ø³Ù…ÙŠ Ø§Ù„Ù…Ø¹ØªÙ…Ø¯ Ø¨ØµÙŠØºØ© PDF.</i>`
:
`ðŸ“„ <b>Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ù…Ø§Ù„ÙŠ Ù…Ø¹ØªÙ…Ø¯ #${receipt.receiptNumber} (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ)</b>
ðŸ¢ <b>${settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ‘¤ <b>Ø§Ù„Ø²Ø¨ÙˆÙ†:</b> ${receipt.customerName}
ðŸ’° <b>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ù‚Ø¨ÙˆØ¶:</b> ðŸŸ¢ <b>${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</b>
${remText}
ðŸ“… <b>Ø§Ù„ØªØ§Ø±ÙŠØ®:</b> ${formatServerDateTime(receipt.createdAt)}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ø£Ø¹Ù„Ø§Ù‡ Ù…Ù„Ù Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ø§Ù„Ø±Ø³Ù…ÙŠ Ø§Ù„Ù…Ø¹ØªÙ…Ø¯ Ø¨ØµÙŠØºØ© PDF.</i>`;

      await telegramService.sendDocument(
        settings.telegramBotToken,
        settings.telegramChatId,
        req.file.buffer,
        fileName,
        caption,
        'HTML'
      );
    }

    res.json({ success: true, message: `ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ #${receipt.receiptNumber} ÙˆÙ…Ù„Ù Ø§Ù„Ù€ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!` });
  } catch (err) {
    console.error('Receipt send error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø­Ø°Ù Ø²Ø¨ÙˆÙ†
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteCustomer(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ ØªØ°ÙƒÙŠØ± Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ø¯ÙØ¹Ø© Ù…Ø§Ù„ÙŠØ© Ù„Ø²Ø¨ÙˆÙ† Ø¹Ø¨Ø± ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ù…Ø¹ Ù…Ø±ÙÙ‚ PDF Ø§Ø®ØªÙŠØ§Ø±ÙŠ
app.post('/api/customers/:id/send-reminder-telegram', pdfUpload.single('pdfFile'), async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… (Bot Token Ø£Ùˆ Chat ID) Ø¨Ø¹Ø¯' });
    }

    const customers = dataStore.getCustomers();
    const strId = String(req.params.id || '').trim();
    const customer = customers.find(c => String(c.id).trim() === strId || String(c.systemNumber || '').trim() === strId);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Ø§Ù„Ø²Ø¨ÙˆÙ† ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…' });
    }

    const debt = parseFloat(customer.balance) || 0;
    if (debt <= 0) {
      return res.status(400).json({ success: false, error: 'Ø§Ù„Ø²Ø¨ÙˆÙ† Ù„ÙŠØ³ Ø¹Ù„ÙŠÙ‡ Ø£ÙŠ Ø¯ÙŠÙˆÙ† Ù…Ø³ØªØ­Ù‚Ø© (Ø±ØµÙŠØ¯Ù‡ Ù…Ø³Ø¯Ø¯ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„)' });
    }

    // Ø¬Ù„Ø¨ Ø¢Ø®Ø± Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ù…Ø³Ø¬Ù„ Ù„Ù„Ø²Ø¨ÙˆÙ†
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

    // 1. Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ù†ØµÙŠØ© Ø§Ù„ØªÙˆØ¶ÙŠØ­ÙŠØ©
    const textResult = await telegramService.sendCustomerReminderNotification({
      customer,
      debt,
      lastReceipt,
      daysSinceLastReceipt,
      settings
    });

    // 2. Ø¥Ø°Ø§ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù PDF Ù„ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ØŒ ÙŠØªÙ… Ø¥Ø±ÙØ§Ù‚Ù‡
    if (req.file && req.file.buffer) {
      const fileName = req.file.originalname || `ÙƒØ´Ù_Ø­Ø³Ø§Ø¨_${customer.name.replace(/\s+/g, '_')}.pdf`;
      const cur = settings.currency || 'Ø´ÙŠÙƒÙ„';
      const caption = 
`ðŸ“„ <b>ÙƒØ´Ù Ø­Ø³Ø§Ø¨ ÙˆØ¥Ø´Ø¹Ø§Ø± Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ø¯ÙØ¹Ø© (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ)</b>
ðŸ‘¤ <b>Ø§Ù„Ø²Ø¨ÙˆÙ†:</b> ${customer.name} (Ø­Ø³Ø§Ø¨ #${customer.systemNumber || '--'})
ðŸ’° <b>Ø§Ù„Ø¯ÙŠÙ† Ø§Ù„Ù…Ø³ØªØ­Ù‚:</b> ${debt.toLocaleString('en-US')} ${cur}
â³ <b>Ø¢Ø®Ø± Ø¯ÙØ¹Ø©:</b> ${lastReceipt ? `Ù…Ù†Ø° ${daysSinceLastReceipt} ÙŠÙˆÙ…Ø§Ù‹` : 'Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø³Ø¯Ø§Ø¯ Ø³Ø§Ø¨Ù‚'}`;

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
      message: `ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ØªØ°ÙƒÙŠØ± Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ø§Ù„Ø¯ÙØ¹Ø© Ù„Ù„Ø²Ø¨ÙˆÙ† "${customer.name}" Ø¹Ø¨Ø± ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!`
    });
  } catch (err) {
    console.error('Error sending customer reminder:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Ø­Ø°Ù Ø³Ù†Ø¯ Ù‚Ø¨Ø¶
app.delete('/api/receipts/:id', async (req, res) => {
  try {
    const deleted = await dataStore.deleteReceipt(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª
// -------------------------------------------------------------

// Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙÙˆØ§ØªÙŠØ± ÙˆØ³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ (Ù…Ø¹ Ø§Ù„Ø§Ø­ØªÙØ§Ø¸ Ø¨Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª)
app.post('/api/reset-sales', (req, res) => {
  try {
    const { confirmPhrase } = req.body;

    // ÙƒÙ„Ù…Ø© ØªØ£ÙƒÙŠØ¯ Ø¥Ø¶Ø§ÙÙŠØ© Ù„Ù„Ø­Ù…Ø§ÙŠØ©
    if (confirmPhrase !== 'ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø°Ù') {
      return res.status(400).json({ success: false, error: 'Ø¹Ø¨Ø§Ø±Ø© Ø§Ù„ØªØ£ÙƒÙŠØ¯ ØºÙŠØ± ØµØ­ÙŠØ­Ø©' });
    }

    const INVOICES_FILE = path.join(__dirname, 'data', 'invoices.json');
    const RECEIPTS_FILE = path.join(__dirname, 'data', 'receipts.json');

    // Ù…Ø³Ø­ Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙÙˆØ§ØªÙŠØ±
    fs.writeFileSync(INVOICES_FILE, JSON.stringify([], null, 2), 'utf-8');
    // Ù…Ø³Ø­ Ø¬Ù…ÙŠØ¹ Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶
    fs.writeFileSync(RECEIPTS_FILE, JSON.stringify([], null, 2), 'utf-8');

    // Ù…Ø³Ø­ Ù…Ù† Supabase Ø£ÙŠØ¶Ø§Ù‹ ÙÙŠ Ø§Ù„Ø³Ø­Ø§Ø¨Ø©
    const { supabase } = require('./supabaseClient');
    if (supabase) {
      supabase.from('invoices').delete().neq('id', '___non_existent___').then(() => {});
      supabase.from('receipts').delete().neq('id', '___non_existent___').then(() => {});
    }

    console.log(`âš ï¸ ØªÙ… Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø¬Ù…ÙŠØ¹ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª ÙÙŠ: ${formatServerDateTime(new Date())}`);

    res.json({ success: true, message: 'ØªÙ… Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø¬Ù…ÙŠØ¹ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ Ø¨Ù†Ø¬Ø§Ø­. Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ù…Ø­ÙÙˆØ¸Ø©.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// APIs: Ø§Ù„Ù†Ø³Ø® Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ ÙˆØ­Ù…Ø§ÙŠØ© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª (Backup & Restore)
// -------------------------------------------------------------

// Ø¬Ù„Ø¨ Ù‚Ø§Ø¦Ù…Ø© Ù…Ù„ÙØ§Øª Ø§Ù„Ù†Ø³Ø® Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ
app.get('/api/backups', (req, res) => {
  try {
    const list = dataStore.getBackupList();
    res.json({ success: true, backups: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ù†Ø´Ø§Ø¡ Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø¬Ø¯ÙŠØ¯Ø©
app.post('/api/backups/create', (req, res) => {
  try {
    const label = req.body?.label || req.query?.label || 'manual';
    const result = dataStore.createBackup(label);
    res.json({ success: true, backup: result, message: 'ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø¨Ù†Ø¬Ø§Ø­!' });
  } catch (err) {
    console.error('Backup create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ØªØ­Ù…ÙŠÙ„ Ù…Ù„Ù Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©
app.get('/api/backups/download/:filename', (req, res) => {
  try {
    const filePath = dataStore.getBackupFilePath(req.params.filename);
    if (!filePath) {
      return res.status(404).json({ success: false, error: 'Ù…Ù„Ù Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
    }
    res.download(filePath, req.params.filename);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© ÙÙˆØ±Ø§Ù‹ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
app.post('/api/backups/send-telegram', async (req, res) => {
  try {
    const settings = dataStore.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… Ø¶Ø¨Ø· Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ø¹Ø¯' });
    }

    const backup = dataStore.createBackup('telegram_cloud');
    const buffer = fs.readFileSync(backup.filePath);

    const caption = 
`ðŸ“¦ <b>Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø´Ø§Ù…Ù„Ø© Ù„Ù„Ù†Ø¸Ø§Ù… (Cloud Backup)</b>
ðŸ¢ <b>${settings.companyName || 'Ø´Ø±ÙƒØ© Ø£Ø¨Ùˆ Ø±Ø§Ù…Ø²'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ“… <b>Ø§Ù„ÙˆÙ‚Øª:</b> ${formatServerDateTime(new Date())}
ðŸ“¦ <b>Ø§Ù„Ø£ØµÙ†Ø§Ù:</b> <b>${backup.counts.products} ØµÙ†Ù</b>
ðŸ§¾ <b>Ø§Ù„ÙÙˆØ§ØªÙŠØ±:</b> <b>${backup.counts.invoices} ÙØ§ØªÙˆØ±Ø©</b>
ðŸ‘¥ <b>Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†:</b> <b>${backup.counts.customers} Ø²Ø¨ÙˆÙ†</b>
ðŸ’° <b>Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶:</b> <b>${backup.counts.receipts} Ø³Ù†Ø¯</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
<i>ðŸ”’ Ø§Ø­ØªÙØ¸ Ø¨Ù‡Ø°Ø§ Ø§Ù„Ù…Ù„Ù Ø¨Ø£Ù…Ø§Ù†ØŒ ÙŠØªÙŠØ­ Ù„Ùƒ Ø§Ø³ØªØ±Ø¬Ø§Ø¹ ÙƒØ§Ù…Ù„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ØªØ¬Ø± ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª Ø¨Ù†Ù‚Ø±Ø© Ø²Ø±.</i>`;

    const result = await telegramService.sendDocument(
      settings.telegramBotToken,
      settings.telegramChatId,
      buffer,
      backup.filename,
      caption,
      'HTML'
    );

    if (result.ok) {
      res.json({ success: true, message: 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!' });
    } else {
      res.status(500).json({ success: false, error: result.error || 'ØªØ¹Ø°Ø± Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…' });
    }
  } catch (err) {
    console.error('Send backup to telegram error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©
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
        return res.status(404).json({ success: false, error: 'Ø§Ù„Ù…Ù„Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' });
      }
      payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    if (!payload || !payload.data) {
      return res.status(400).json({ success: false, error: 'Ù…Ù„Ù Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© ØºÙŠØ± ØµØ§Ù„Ø­ Ø£Ùˆ ØªØ§Ù„Ù' });
    }

    const restoreResult = dataStore.restoreBackup(payload);
    console.log(`âœ… ØªÙ… Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø¨Ù†Ø¬Ø§Ø­ ÙÙŠ: ${formatServerDateTime(new Date())}`);

    res.json({
      success: true,
      message: 'ØªÙ… Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø¨Ù†Ø¬Ø§Ø­!',
      counts: restoreResult.counts
    });
  } catch (err) {
    console.error('Restore backup error:', err);
    res.status(400).json({ success: false, error: 'ÙØ´Ù„ Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ù†Ø³Ø®Ø©: ' + err.message });
  }
});

// -------------------------------------------------------------
// APIs: Ø¥Ø¯Ø§Ø±Ø© ÙˆØªØµÙ†ÙŠÙ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø§Ù„Ø°ÙƒÙŠ (Smart Brand Classification)
// -------------------------------------------------------------
const brandClassifier = require('./brandClassifier');

// Ø¬Ù„Ø¨ Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚ Ø§Ù„ÙƒØ§Ù…Ù„ Ù„Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£ØµÙ†Ø§Ù ÙˆØ§Ù„Ù…Ø§Ø±ÙƒØ§Øª
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

// ÙØ­Øµ ØªØ¹Ø§Ø±Ø¶ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø¹Ù†Ø¯ Ø¥Ø¶Ø§ÙØ© Ø£Ùˆ ØªØ¹Ø¯ÙŠÙ„ Ù…Ù†ØªØ¬ (Real-time conflict detection)
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

// ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„ØªØºÙŠÙŠØ±Ø§Øª Ø§Ù„Ù…Ø¹ØªÙ…Ø¯Ø© Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª
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
      return res.status(400).json({ success: false, error: 'Ù„Ù… ÙŠØªÙ… ØªØ­Ø¯ÙŠØ¯ Ø£ÙŠ Ø£ØµÙ†Ø§Ù Ù„Ù„ØªØ­Ø¯ÙŠØ«' });
    }

    if (itemsToUpdate.length === 0) {
      return res.json({ success: true, updatedCount: 0, message: 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£ØµÙ†Ø§Ù Ù…Ø¤Ù‡Ù„Ø© Ù„Ù„ØªØ­Ø¯ÙŠØ«' });
    }

    const result = brandClassifier.applyBrandChanges(productsPath, itemsToUpdate, editorName || 'Ù…Ø¯ÙŠØ± Ø§Ù„Ù†Ø¸Ø§Ù…');

    // Ø­ÙØ¸ Ø³Ø­Ø§Ø¨ÙŠ Ø¯Ø§Ø¦Ù… ÙˆÙ…Ø¨Ø§Ø´Ø± ÙÙŠ Supabase Ø¹Ø¨Ø± dataStore
    const brandUpdates = itemsToUpdate.map(u => ({
      code: u.code,
      brand: u.proposedBrand,
      brandAr: u.proposedBrandAr
    }));
    await dataStore.bulkUpdateBrands(brandUpdates, editorName || 'Ù…Ø¯ÙŠØ± Ø§Ù„Ù†Ø¸Ø§Ù…');

    res.json({
      success: true,
      ...result,
      message: `ØªÙ… Ø¨Ù†Ø¬Ø§Ø­ ØªØ­Ø¯ÙŠØ« Ù…Ø§Ø±ÙƒØ§Øª ${result.updatedCount} ØµÙ†Ù ÙˆØ­ÙØ¸Ù‡Ø§ ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø¨ÙŠØ§Ù†Ø§Øª Supabase Ø¨Ø´ÙƒÙ„ Ø¯Ø§Ø¦Ù….`
    });
  } catch (err) {
    console.error('Apply brand changes error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø§Ù„ØªØ±Ø§Ø¬Ø¹ Ø¹Ù† Ø¢Ø®Ø± Ø¹Ù…Ù„ÙŠØ© ØªØ¹Ø¯ÙŠÙ„ Ù„Ù„Ù…Ø§Ø±ÙƒØ§Øª
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

// Ø¬Ù„Ø¨ Ù‚Ø§Ù…ÙˆØ³ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª
app.get('/api/brands-classification/dictionary', (req, res) => {
  try {
    const dict = brandClassifier.loadDictionary();
    res.json({ success: true, dictionary: dict });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø­ÙØ¸ / ØªØ¹Ø¯ÙŠÙ„ Ù‚Ø§Ù…ÙˆØ³ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª
app.post('/api/brands-classification/dictionary', (req, res) => {
  try {
    const { dictionary } = req.body;
    if (!Array.isArray(dictionary)) {
      return res.status(400).json({ success: false, error: 'ØµÙŠØºØ© Ø§Ù„Ù‚Ø§Ù…ÙˆØ³ ØºÙŠØ± ØµØ§Ù„Ø­Ø©' });
    }
    const saved = brandClassifier.saveDictionary(dictionary);
    res.json({ success: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¬Ù„Ø¨ Ø³Ø¬Ù„ Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚ ÙˆØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª
app.get('/api/brands-classification/logs', (req, res) => {
  try {
    const logFile = path.join(__dirname, 'data', 'brand_changes_log.json');
    const logs = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Ø¬Ø¯ÙˆÙ„Ø© Ø§Ù„Ù†Ø³Ø® Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ø§Ù„ÙŠÙˆÙ…ÙŠ (ÙƒÙ„ 24 Ø³Ø§Ø¹Ø©)
function startAutoBackupSchedule() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('â° Ø¨Ø¯Ø¡ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠØ© Ø§Ù„ÙŠÙˆÙ…ÙŠØ©...');
      const backup = dataStore.createBackup('auto_daily');
      console.log(`âœ… ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠØ©: ${backup.filename}`);

      // Ø¥Ø±Ø³Ø§Ù„ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ø¨ÙˆØª Ù…Ù‡ÙŠØ£
      const settings = dataStore.getSettings();
      if (settings.telegramBotToken && settings.telegramChatId) {
        const buffer = fs.readFileSync(backup.filePath);
        const caption = 
`ðŸŒ™ <b>Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠØ© Ø§Ù„ÙŠÙˆÙ…ÙŠØ© (Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„ÙŠÙˆÙ…)</b>
ðŸ¢ <b>${settings.companyName || 'Ø´Ø±ÙƒØ© Ø£Ø¨Ùˆ Ø±Ø§Ù…Ø²'}</b>
ðŸ“… <b>Ø§Ù„ØªØ§Ø±ÙŠØ®:</b> ${formatServerDateTime(new Date())}
ðŸ“¦ Ø§Ù„Ø£ØµÙ†Ø§Ù: <b>${backup.counts.products}</b> | ðŸ§¾ Ø§Ù„ÙÙˆØ§ØªÙŠØ±: <b>${backup.counts.invoices}</b> | ðŸ‘¥ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†: <b>${backup.counts.customers}</b>`;

        await telegramService.sendDocument(
          settings.telegramBotToken,
          settings.telegramChatId,
          buffer,
          backup.filename,
          caption,
          'HTML'
        );
        console.log('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø§Ù„ÙŠÙˆÙ…ÙŠØ© Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­');
      }
    } catch (e) {
      console.error('Auto backup schedule error:', e.message);
    }
  }, TWENTY_FOUR_HOURS);
}

// ================================================================
// Ø¯Ø¹Ù… Ù…Ø³Ø§Ø±Ø§Øª Ø§Ù„ÙˆØ§Ø¬Ù‡Ø§Øª ÙˆØ§Ù„ØµÙØ­Ø§Øª Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø© (Multi-page SPA Routing)
// ÙŠØªÙŠØ­ ÙØªØ­ Ø±ÙˆØ§Ø¨Ø· Ø§Ù„Ø£Ù‚Ø³Ø§Ù… Ù…Ø¨Ø§Ø´Ø±Ø© ÙˆØ§Ù„ØªÙ†Ù‚Ù„ Ø§Ù„Ø³Ù„Ø³ Ù…Ø«Ù„:
// /home, /customers, /settings, /invoices, /pos, /receipts ...
// ================================================================
// ================================================================
// Ù…ÙˆØ¯ÙŠÙˆÙ„ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„Ù…Ø³ØªÙ‚Ù„Ø© 100% Ù„Ù„Ø²Ø¨Ø§Ø¦Ù† (Isolated Standalone Previews)
// Ù…Ø¹Ø²ÙˆÙ„Ø© ØªÙ…Ø§Ù…Ø§Ù‹ Ø¹Ù† Ù†Ø¸Ø§Ù… Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© ÙˆØ§Ù„ÙƒØ§Ø´ÙŠØ± Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠ Ù„Ø­Ù…Ø§ÙŠØ© Ø§Ù„Ø®ØµÙˆØµÙŠØ© ÙˆØ§Ù„Ø£Ù…Ø§Ù† Ø§Ù„ØªØ§Ù…
// ØªØ¯Ø¹Ù… Ø¨Ø·Ø§Ù‚Ø§Øª ÙˆØ§ØªØ³Ø§Ø¨ ÙˆØ´Ø¨ÙƒØ§Øª Ø§Ù„ØªÙˆØ§ØµÙ„ØŒ ÙˆØªÙ…Ù†Ø¹ ÙˆØµÙˆÙ„ Ø§Ù„Ø²Ø¨ÙˆÙ† Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù…
// ================================================================
const {
  renderProductPreviewHtml,
  renderInvoicePreviewHtml,
  renderStatementPreviewHtml,
  renderReceiptPreviewHtml,
  renderPreviewBlockedHtml,
  renderPublicCatalogHtml
} = require('./standaloneViews');

// Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù…Ø§ Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ø·Ù„Ø¨ Ù‚Ø§Ø¯Ù…Ø§Ù‹ Ø¹Ø¨Ø± Ù†Ø·Ø§Ù‚ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„Ù…Ø³ØªÙ‚Ù„ Ø¹Ù„Ù‰ Render
function isPreviewHost(req) {
  if (process.env.PREVIEW_ONLY === 'true' || process.env.APP_MODE === 'preview') {
    return true;
  }
  const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toLowerCase();
  return host.includes('preview') || host.startsWith('view-');
}

// Ø­Ø¸Ø± ØµÙØ­Ø§Øª ÙˆØ¹Ù…Ù„ÙŠØ§Øª Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ø¹Ù†Ø¯ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ù…Ù† Ù†Ø·Ø§Ù‚ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø©
app.use((req, res, next) => {
  if (!isPreviewHost(req)) return next();

  // Ø§Ù„Ø³Ù…Ø§Ø­ Ø¨Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ø«Ø§Ø¨ØªØ© ÙˆØ§Ù„ØµÙˆØ± ÙˆØ±ÙˆØ§Ø¨Ø· Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„Ø¹Ø§Ù…Ø©
  if (
    req.path.startsWith('/uploads') ||
    req.path.startsWith('/icons') ||
    req.path.startsWith('/css') ||
    req.path.startsWith('/js') ||
    req.path.startsWith('/p/') ||
    req.path.startsWith('/v/') ||
    req.path.startsWith('/product/') ||
    req.path.startsWith('/invoice/') ||
    req.path.startsWith('/receipt/') ||
    req.path.startsWith('/voucher/') ||
    req.path.startsWith('/statement/') ||
    req.path === '/favicon.ico' ||
    req.path === '/manifest.json'
  ) {
    return next();
  }

  // Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© ÙÙŠ Ù†Ø·Ø§Ù‚ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© ØªØ¹Ø±Ø¶ Ù…Ø¹Ø±Ø¶ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ø¹Ø§Ù… Ù„Ù„Ø²Ø¨Ø§Ø¦Ù†
  if (req.path === '/' || req.path === '/catalog' || req.path === '/products') {
    const prods = dataStore.getProducts();
    const settings = dataStore.getSettings() || {};
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderPublicCatalogHtml(prods, settings, req));
  }

  // Ø­Ø¸Ø± Ø£ÙŠ Ø¹Ù…Ù„ÙŠØ§Øª ÙƒØªØ§Ø¨Ø© Ø£Ùˆ ØªØ¹Ø¯ÙŠÙ„ API ÙÙŠ Ù†Ø·Ø§Ù‚ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø©
  if (req.path.startsWith('/api/') && req.method !== 'GET') {
    return res.status(403).json({
      success: false,
      error: 'Ù†Ø·Ø§Ù‚ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© Ù…Ø®ØµØµ Ù„Ø¹Ø±Ø¶ Ø¨Ø·Ø§Ù‚Ø§Øª Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙÙ‚Ø· ÙˆÙ„Ø§ ÙŠØ³Ù…Ø­ Ø¨Ø¥Ø¬Ø±Ø§Ø¡ Ø£ÙŠ Ø¹Ù…Ù„ÙŠØ§Øª Ø¥Ø¯Ø§Ø±ÙŠØ©'
    });
  }

  // Ø­Ø¸Ø± ØµÙØ­Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù… Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠØ© (POSØŒ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§ØªØŒ Ø§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ†ØŒ Ø§Ù„ÙƒØ§Ø´ÙŠØ±) ÙÙŠ Ù†Ø·Ø§Ù‚ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø©
  const settings = dataStore.getSettings() || {};
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(403).send(renderPreviewBlockedHtml(settings));
});

// 1. Ù…Ø³Ø§Ø±Ø§Øª Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ù…Ø³ØªÙ‚Ù„Ø© (Product Standalone Previews)
app.get(['/p/:id', '/product/:id', '/products/:id', '/view/product/:id', '/preview/product/:id'], (req, res, next) => {
  const id = req.params.id;
  if (!id || id === 'all') return next();
  if (req.query.admin === '1') return next();

  const prods = dataStore.getProducts();
  const p = prods.find(x => 
    String(x.id).toLowerCase() === String(id).toLowerCase() ||
    String(x.code || '').toLowerCase() === String(id).toLowerCase() ||
    String(x.barcode || '').toLowerCase() === String(id).toLowerCase()
  );
  const settings = dataStore.getSettings() || {};

  if (p) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderProductPreviewHtml(p, settings, req));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(`
    <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Ø§Ù„ØµÙ†Ù ØºÙŠØ± Ù…ØªÙˆÙØ±</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700&display=swap" rel="stylesheet">
    <body style="font-family:'Cairo',sans-serif; text-align:center; padding:3rem; background:#f8fafc; color:#0f172a;">
    <h2>âš ï¸ Ø¹Ø°Ø±Ø§Ù‹ØŒ Ù‡Ø°Ø§ Ø§Ù„ØµÙ†Ù ØºÙŠØ± Ù…ØªÙˆÙØ± Ø£Ùˆ ØªÙ… Ø­Ø°ÙÙ‡ Ù…Ù† Ø§Ù„Ù†Ø¸Ø§Ù….</h2>
    <p style="margin-top:1rem;"><a href="/" style="color:#2563eb; text-decoration:none; font-weight:bold;">Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</a></p>
    </body></html>
  `);
});

// 2. Ù…Ø³Ø§Ø±Ø§Øª Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø³ØªÙ‚Ù„Ø© (Invoice Standalone Previews)
app.get(['/v/invoice/:id', '/view/invoice/:id', '/preview/invoice/:id', '/invoice/:id', '/invoices/:id'], (req, res, next) => {
  const id = req.params.id;
  if (!id || id === 'new' || id === 'list') return next();
  if (req.query.admin === '1') return next();

  const invoices = dataStore.getInvoices();
  const inv = invoices.find(x => 
    String(x.id).toLowerCase() === String(id).toLowerCase() ||
    String(x.invoiceNumber).toLowerCase() === String(id).toLowerCase() ||
    String(x.shamelNo || '').toLowerCase() === String(id).toLowerCase()
  );
  const settings = dataStore.getSettings() || {};

  if (inv) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderInvoicePreviewHtml(inv, settings, req));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(`
    <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Ø§Ù„ÙØ§ØªÙˆØ±Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700&display=swap" rel="stylesheet">
    <body style="font-family:'Cairo',sans-serif; text-align:center; padding:3rem; background:#f8fafc; color:#0f172a;">
    <h2>âš ï¸ Ø¹Ø°Ø±Ø§Ù‹ØŒ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø© Ø£Ùˆ ØªÙ… Ø­Ø°ÙÙ‡Ø§.</h2>
    <p style="margin-top:1rem;"><a href="/" style="color:#2563eb; text-decoration:none; font-weight:bold;">Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</a></p>
    </body></html>
  `);
});

// 3. Ù…Ø³Ø§Ø±Ø§Øª Ù…Ø¹Ø§ÙŠÙ†Ø© Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ ÙˆØ§Ù„ØµØ±Ù Ø§Ù„Ù…Ø³ØªÙ‚Ù„Ø© (Receipt Voucher Standalone Previews)
app.get(['/v/receipt/:id', '/view/receipt/:id', '/preview/receipt/:id', '/receipt/:id', '/receipts/:id', '/voucher/:id', '/vouchers/:id', '/v/voucher/:id'], (req, res, next) => {
  const id = req.params.id;
  if (!id || id === 'new' || id === 'list') return next();
  if (req.query.admin === '1') return next();

  const receipts = dataStore.getReceipts();
  const rcp = receipts.find(x => 
    String(x.id).toLowerCase() === String(id).toLowerCase() ||
    String(x.receiptNumber).toLowerCase() === String(id).toLowerCase() ||
    String(x.voucherNumber || '').toLowerCase() === String(id).toLowerCase()
  );
  const settings = dataStore.getSettings() || {};

  if (rcp) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderReceiptPreviewHtml(rcp, settings, req));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(`
    <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Ø§Ù„Ø³Ù†Ø¯ Ø§Ù„Ù…Ø§Ù„ÙŠ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700&display=swap" rel="stylesheet">
    <body style="font-family:'Cairo',sans-serif; text-align:center; padding:3rem; background:#f8fafc; color:#0f172a;">
    <h2>âš ï¸ Ø¹Ø°Ø±Ø§Ù‹ØŒ Ø§Ù„Ø³Ù†Ø¯ Ø§Ù„Ù…Ø§Ù„ÙŠ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ Ø£Ùˆ ØªÙ… Ø­Ø°ÙÙ‡.</h2>
    <p style="margin-top:1rem;"><a href="/" style="color:#2563eb; text-decoration:none; font-weight:bold;">Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</a></p>
    </body></html>
  `);
});

// 4. Ù…Ø³Ø§Ø±Ø§Øª Ù…Ø¹Ø§ÙŠÙ†Ø© ÙƒØ´Ù Ø­Ø³Ø§Ø¨ Ø§Ù„Ø²Ø¨ÙˆÙ† Ø§Ù„Ù…Ø³ØªÙ‚Ù„Ø© (Customer Statement Standalone Previews)
app.get(['/v/statement/:id', '/view/statement/:id', '/preview/statement/:id', '/statement/:id', '/statements/:id', '/customer/:id', '/customers/:id'], (req, res, next) => {
  const id = req.params.id;
  if (!id || id === 'all' || id === 'new') return next();
  if (req.query.admin === '1') return next();

  const statementData = dataStore.getCustomerStatement(id);
  const settings = dataStore.getSettings() || {};

  if (statementData && statementData.customer) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderStatementPreviewHtml(statementData, settings, req));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(404).send(`
    <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@700&display=swap" rel="stylesheet">
    <body style="font-family:'Cairo',sans-serif; text-align:center; padding:3rem; background:#f8fafc; color:#0f172a;">
    <h2>âš ï¸ Ø¹Ø°Ø±Ø§Ù‹ØŒ Ø­Ø³Ø§Ø¨ Ø§Ù„Ø²Ø¨ÙˆÙ† ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ Ø£Ùˆ Ù„Ø§ ÙŠØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ Ù…Ø³Ø¬Ù„.</h2>
    <p style="margin-top:1rem;"><a href="/" style="color:#2563eb; text-decoration:none; font-weight:bold;">Ø§Ù„Ø¹ÙˆØ¯Ø© Ù„Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©</a></p>
    </body></html>
  `);
});

// 5. ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ù…ØªØ¬Ø± ÙˆØ§Ù„Ù…Ø¹Ø±Ø¶ Ø§Ù„Ø¹Ø§Ù… Ù„Ù„Ø²Ø¨Ø§Ø¦Ù† (Public Customer Storefront - Bloom Style)

// ================================================================
// Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„ØªÙˆØ¬ÙŠÙ‡ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ù…Ø³Ø§Ø±Ø§Øª Ø§Ù„Ø¥Ø¯Ø§Ø±ÙŠØ© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© Ø¥Ù„Ù‰ /admin/...
// Ù„Ù…Ù†Ø¹ Ø§Ù„ÙˆØµÙˆÙ„ Ø§Ù„Ù…Ø¨Ø§Ø´Ø± Ù…Ù† Ø§Ù„Ù†Ø·Ø§Ù‚ Ø§Ù„Ø¹Ø§Ù… ÙˆØ¥Ù„Ø²Ø§Ù… Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø¨Ø§Ø¯Ø¦Ø© /admin/
// ================================================================
const ADMIN_LEGACY_REDIRECT_MAP = {
  '/create-invoice': '/admin/create-invoice',
  '/new-invoice': '/admin/create-invoice',
  '/pos': '/admin/pos',
  '/home': '/admin/home',
  '/catalog': '/admin/home',
  '/customers': '/admin/customers',
  '/suppliers': '/admin/customers',
  '/invoices': '/admin/invoices',
  '/invoices-list': '/admin/invoices',
  '/receipts': '/admin/receipts',
  '/vouchers': '/admin/receipts',
  '/inventory': '/admin/inventory',
  '/stocktake': '/admin/inventory',
  '/warranties': '/admin/warranties',
  '/dashboard': '/admin/dashboard',
  '/settings': '/admin/settings',
  '/brands-audit': '/admin/brands-audit',
  '/store-manager': '/admin/store-manager',
  '/store': '/admin/store-manager'
};

app.use((req, res, next) => {
  const cleanPath = req.path.toLowerCase().replace(/\/+$/, '');
  
  if (cleanPath === '/store-manager' || cleanPath === '/store') {
    return res.redirect(302, '/admin/store-manager');
  }
  if (cleanPath.startsWith('/store-manager/')) {
    return res.redirect(302, '/admin' + cleanPath);
  }

  const targetAdminRoute = ADMIN_LEGACY_REDIRECT_MAP[cleanPath];
  if (targetAdminRoute) {
    return res.redirect(302, targetAdminRoute);
  }
  next();
});

function isAdminHost(req) {
  const host = (req.hostname || req.headers.host || '').toLowerCase();
  return host.startsWith('admin.') || host.includes('-admin.');
}

const APP_MODE = (process.env.APP_MODE || 'full').toLowerCase(); // 'full' | 'admin_only' | 'store_only'

app.get(['/', '/store', '/shop'], (req, res) => {
  if (APP_MODE === 'admin_only' || isAdminHost(req)) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'store.html'));
});

// 6. ÙˆØ§Ø¬Ù‡Ø© Ù†Ø¸Ø§Ù… Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© ÙˆØ§Ù„ÙƒØ§Ø´ÙŠØ± Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠ Ø§Ù„Ù…Ø­Ù…ÙŠ (Protected Admin System)
// Ù…Ø³Ø§Ø±Ø§Øª Ù†Ø¸Ø§Ù… Ø§Ù„Ø£Ø¯Ù…Ù† - ÙƒÙ„ Ø´ÙŠØ¡ ØªØ­Øª /admin
app.get('/admin', (req, res) => {
  if (APP_MODE === 'store_only') {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'store.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/admin/*', (req, res, next) => {
  if (APP_MODE === 'store_only') {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'store.html'));
  }
  // Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ø·Ù„Ø¨ Ù„Ù…Ù„Ù Ø«Ø§Ø¨Øª (Ù…Ø«Ù„ /admin/js/... Ø£Ùˆ /admin/css/...) ÙŠØªÙ… ØªÙ‚Ø¯ÙŠÙ…Ù‡ Ù…Ù† Ù…Ø¬Ù„Ø¯ public Ø¨Ø¯Ù„Ø§Ù‹ Ù…Ù† Ø¥Ø¹Ø§Ø¯Ø© index.html
  if (req.path.includes('.')) {
    const relativeAsset = req.path.replace(/^\/admin\//, '');
    const assetPath = path.join(__dirname, 'public', relativeAsset);
    if (fs.existsSync(assetPath)) {
      return res.sendFile(assetPath);
    }
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ù…Ø³Ø§Ø± Ø´Ø§Ù…Ù„ Ù„Ø£ÙŠ Ù…Ø³Ø§Ø± ÙØ±Ø¹ÙŠ Ù„ØµÙØ­Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù… (SPA Fallback) Ø¯ÙˆÙ† Ø§Ù„ØªØ£Ø«ÙŠØ± Ø¹Ù„Ù‰ /api Ø£Ùˆ /uploads Ø£Ùˆ Ø§Ù„Ù…Ù„ÙØ§Øª
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.includes('.')) {
    return next();
  }
  if (APP_MODE === 'admin_only' || isAdminHost(req)) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  if (req.path.startsWith('/admin')) {
    if (APP_MODE === 'store_only') return res.status(404).sendFile(path.join(__dirname, 'public', 'store.html'));
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'store.html'));
});

// ØªØ´ØºÙŠÙ„ Ø§Ù„Ø®Ø§Ø¯Ù…

// ================================================================
// Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø£Ø®Ø·Ø§Ø¡ Ø§Ù„Ø­Ø±Ø¬Ø© ØºÙŠØ± Ø§Ù„Ù…ØªÙˆÙ‚Ø¹Ø© â€” Ø¥Ø´Ø¹Ø§Ø± ÙÙˆØ±ÙŠ Ø¹Ø¨Ø± Telegram
// ================================================================ â€” Ø¥Ø´Ø¹Ø§Ø± ÙÙˆØ±ÙŠ Ø¹Ø¨Ø± Telegram
// ================================================================
process.on('uncaughtException', function(err) {
  console.error('ðŸ’¥ uncaughtException:', err.message);
  telegramService.sendSystemAlert('server_crash', {
    errorType: 'UncaughtException',
    error: err.message + (err.stack ? '\n' + err.stack.slice(0, 200) : '')
  }).catch(function() {}).finally(function() { process.exit(1); });
});

process.on('unhandledRejection', function(reason) {
  var msg = reason instanceof Error ? reason.message : String(reason);
  console.error('ðŸ’¥ unhandledRejection:', msg);
  telegramService.sendSystemAlert('server_crash', {
    errorType: 'UnhandledRejection',
    error: msg
  }).catch(function() {});
});

module.exports = app;

if (!process.env.VERCEL) {
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`=======================================================`);
  console.log(`ðŸš€ Ù†Ø¸Ø§Ù… Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ¥ØµØ¯Ø§Ø± Ø§Ù„ÙÙˆØ§ØªÙŠØ± ÙŠØ¹Ù…Ù„ Ø¨Ù†Ø¬Ø§Ø­ Ø¹Ù„Ù‰:`);
  console.log(`ðŸ”— Ø§Ù„Ø±Ø§Ø¨Ø· Ø§Ù„Ù…Ø­Ù„ÙŠ: http://localhost:${PORT}`);
  console.log(`=======================================================`);

  // Ø¨Ø¯Ø¡ Ø¬Ø¯ÙˆÙ„Ø© Ø§Ù„Ù†Ø³Ø® Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ
  startAutoBackupSchedule();

  // â”€â”€â”€ ÙØ­Øµ Ø¬Ø§Ù‡Ø²ÙŠØ© Supabase Ù‚Ø¨Ù„ Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ Ø£ÙŠ Ø·Ù„Ø¨Ø§Øª ÙƒØªØ§Ø¨Ø© â”€â”€â”€
  const readiness = await systemMode.verifyReadiness();
  if (readiness.ok) {
    console.log(`âœ… ÙˆØ¶Ø¹ Ø§Ù„Ù†Ø¸Ø§Ù…: Ù‚Ø±Ø§Ø¡Ø© ÙˆÙƒØªØ§Ø¨Ø© (Read-Write Mode) â€” Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø¹Ù…Ù„ÙŠØ§Øª Ù…ÙØ¹Ù‘Ù„Ø©`);
    // ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø¥Ø±Ø³Ø§Ù„ Ø¥Ø´Ø¹Ø§Ø± Ø§Ù„Ù†Ø¬Ø§Ø­ â€” ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„ÙØ´Ù„ ÙÙ‚Ø·
  } else {
    console.warn(`âš ï¸ ÙˆØ¶Ø¹ Ø§Ù„Ù†Ø¸Ø§Ù…: Ù‚Ø±Ø§Ø¡Ø© ÙÙ‚Ø· (Read-Only Degraded Mode) â€” Ø³Ø¨Ø¨: ${readiness.error || 'ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ù€ Supabase'}`);
    console.warn(`   Ø³ØªÙØ±ÙØ¶ Ø¬Ù…ÙŠØ¹ Ø¹Ù…Ù„ÙŠØ§Øª Ø§Ù„Ø­ÙØ¸ ÙˆØ§Ù„ØªØ¹Ø¯ÙŠÙ„ ÙˆØ§Ù„Ø­Ø°Ù Ø­ØªÙ‰ ÙŠØ¹ÙˆØ¯ Ø§Ù„Ø§ØªØµØ§Ù„.`);
    telegramService.sendSystemAlert('startup', { mode: 'read-only', error: readiness.error }).catch(() => {});
  }

  // ÙØ­Øµ Ø¯ÙˆØ±ÙŠ ÙƒÙ„ 30 Ø«Ø§Ù†ÙŠØ© Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø© ÙˆØ¶Ø¹ Ø§Ù„ÙƒØªØ§Ø¨Ø© Ø¹Ù†Ø¯ Ø¹ÙˆØ¯Ø© Ø§Ù„Ø§ØªØµØ§Ù„
  systemMode.startPeriodicHealthCheck(30000, async () => {
    await dataStore.initFromSupabase();
  });

  // Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ù† Supabase
  await dataStore.initFromSupabase();

  // ØªØ­Ø¯ÙŠØ« Ø¯ÙˆØ±ÙŠ ÙƒÙ„ 3 Ø¯Ù‚Ø§Ø¦Ù‚ Ù„Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¨ÙŠÙ† Ø§Ù„Ø³ÙŠØ±ÙØ±Ø§Øª
  const CLOUD_REFRESH_INTERVAL = 3 * 60 * 1000; // 3 Ø¯Ù‚Ø§Ø¦Ù‚
  setInterval(async () => {
    try {
      await dataStore.refreshFromCloud();
    } catch (err) {
      console.warn('âš ï¸ Ø®Ø·Ø£ ÙÙŠ Ø§Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¯ÙˆØ±ÙŠ Ù…Ù† Supabase:', err.message);
    }
  }, CLOUD_REFRESH_INTERVAL);
  console.log('âœ… ØªÙ… ØªÙØ¹ÙŠÙ„ Ø§Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¯ÙˆØ±ÙŠ Ù…Ù† Supabase ÙƒÙ„ 3 Ø¯Ù‚Ø§Ø¦Ù‚');
});
}
