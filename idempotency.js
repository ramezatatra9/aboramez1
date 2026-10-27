// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// وحدة الحماية من تكرار الطلبات (Server-side Idempotency & Deduplication)
// ====================================================================

const crypto = require('crypto');

const activeRequests = new Map(); // key -> { status: 'pending', timestamp }
const completedCache = new Map(); // key -> { response, timestamp }
const TTL_MS = 10000; // نافذة الحماية: 10 ثوانٍ

// تنظيف دوري للذاكرة المؤقتة كل دقيقة
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of completedCache.entries()) {
    if (now - val.timestamp > TTL_MS) {
      completedCache.delete(key);
    }
  }
  for (const [key, val] of activeRequests.entries()) {
    if (now - val.timestamp > 30000) { // طلبات عالقة لأكثر من 30 ثانية
      activeRequests.delete(key);
    }
  }
}, 60000);

function generateInvoiceFingerprint(body) {
  const customer = String(body.customerName || '').trim().toLowerCase();
  const employee = String(body.employeeName || '').trim().toLowerCase();
  const method = String(body.paymentMethod || 'cash');
  const items = Array.isArray(body.items)
    ? body.items.map(i => `${i.code || i.id}:${i.quantity || 1}:${i.sellPrice || 0}`).sort().join('|')
    : '';
  const raw = `${customer}#${employee}#${method}#${items}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

function generateReceiptFingerprint(body) {
  const customer = String(body.customerName || '').trim().toLowerCase();
  const employee = String(body.employeeName || '').trim().toLowerCase();
  const amount = parseFloat(body.amount) || 0;
  const raw = `${customer}#${employee}#${amount}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

function checkIdempotency(key) {
  const now = Date.now();

  // فحص إذا كان هناك طلب مماثل مكتمل حديثاً
  const cached = completedCache.get(key);
  if (cached && (now - cached.timestamp < TTL_MS)) {
    return { isDuplicate: true, status: 'completed', response: cached.response };
  }

  // فحص إذا كان هناك طلب قيد المعالجة الآن
  const active = activeRequests.get(key);
  if (active && (now - active.timestamp < 30000)) {
    return { isDuplicate: true, status: 'pending' };
  }

  // تسجيل الطلب كـ قيد المعالجة
  activeRequests.set(key, { status: 'pending', timestamp: now });
  return { isDuplicate: false };
}

function resolveIdempotency(key, response) {
  activeRequests.delete(key);
  completedCache.set(key, { response, timestamp: Date.now() });
}

function releaseIdempotency(key) {
  activeRequests.delete(key);
}

module.exports = {
  generateInvoiceFingerprint,
  generateReceiptFingerprint,
  checkIdempotency,
  resolveIdempotency,
  releaseIdempotency
};

