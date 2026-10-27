// ====================================================================
// مَعْرِض أَبُو رَامِز لِلأَجْهِزَة الكَهْرَبَائِيّة
// وحدة التحكم في وضع النظام وفحص الجاهزية (System Mode & Readiness Controller)
// ====================================================================

const { supabase, testSupabaseConnection } = require('./supabaseClient');

let systemMode = 'read-only'; // يبدأ الخادم في وضع القراءة فقط كإجراء احترازي حتى تثبت الجاهزية
let isReady = false;
let lastCheckedAt = null;
let lastCheckError = null;
let healthCheckTimer = null;

// قائمة بالمسارات الآمنة التي لا تعدل الحسابات ويُسمح بها في وضع القراءة فقط
const SAFE_POST_ROUTES = [
  '/api/telegram/test',
  '/api/brands-classification/check-conflict',
  '/api/inventory/send-report-telegram',
  '/api/inventory/send-pdf-telegram',
  '/api/telegram/send-pdf-document',
  '/api/customers/send-debts-report-telegram',
  '/api/financial-report/send-pdf-telegram',
  '/api/backups/create',
  '/api/backups/send-telegram'
];

function isSafePostRoute(path) {
  if (SAFE_POST_ROUTES.includes(path)) return true;
  if (/^\/api\/invoices\/[^/]+\/resend-telegram$/.test(path)) return true;
  if (/^\/api\/customers\/[^/]+\/(send-statement-telegram|send-reminder-telegram)$/.test(path)) return true;
  if (/^\/api\/receipts\/[^/]+\/send-pdf-telegram$/.test(path)) return true;
  return false;
}

/**
 * فحص جاهزية Supabase للاتصال والكتابة دون إجراء أي كتابة مدمرة
 */
async function verifyReadiness(options = {}) {
  const { quiet = false } = options;
  lastCheckedAt = new Date().toISOString();

  if (!supabase) {
    systemMode = 'read-only';
    lastCheckError = 'عميل Supabase غير مهيأ';
    if (!quiet) console.warn('⚠️ Supabase غير مهيأ — النظام في وضع القراءة فقط لحماية البيانات');
    return { ok: false, mode: systemMode, error: lastCheckError };
  }

  try {
    const conn = await testSupabaseConnection({ allowWriteProbe: false });
    if (conn.readOk && conn.writeOk) {
      const prevMode = systemMode;
      systemMode = 'read-write';
      lastCheckError = null;
      isReady = true;
      if (prevMode === 'read-only' && !quiet) {
        console.log('✅ تم التحقق من اتصال وجاهزية Supabase: تم تفعيل وضع القراءة والكتابة (Read-Write Mode)');
      }
      return { ok: true, mode: systemMode };
    } else {
      systemMode = 'read-only';
      lastCheckError = conn.error || (!conn.writeOk ? 'مفتاح Supabase لا يملك صلاحية الكتابة' : 'فشل قراءة قاعدة البيانات');
      if (!quiet) {
        console.warn(`⚠️ تعذر التحقق من جاهزية Supabase (${lastCheckError}) — النظام في وضع القراءة فقط (Read-Only Degraded Mode)`);
      }
      return { ok: false, mode: systemMode, error: lastCheckError };
    }
  } catch (err) {
    systemMode = 'read-only';
    lastCheckError = err.message;
    if (!quiet) {
      console.warn(`⚠️ استثناء أثناء فحص جاهزية Supabase: ${err.message} — النظام في وضع القراءة فقط`);
    }
    return { ok: false, mode: systemMode, error: lastCheckError };
  }
}

/**
 * فحص دوري لاستعادة وضع الكتابة تلقائياً عند عودة الاتصال
 */
let isCheckingHealth = false;

function startPeriodicHealthCheck(intervalMs = 30000, onRecover = null) {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(async () => {
    if (isCheckingHealth) return;
    isCheckingHealth = true;
    try {
      const prevMode = systemMode;
      const res = await verifyReadiness({ quiet: true });
      if (prevMode === 'read-only' && res.ok && res.mode === 'read-write') {
        console.log('🔄 تم استعادة الاتصال بـ Supabase بنجاح — تم إعادة تفعيل وضع الكتابة والحفظ الدائم تلقائياً.');
        if (typeof onRecover === 'function') {
          try { await onRecover(); } catch (e) { console.warn('Recovery callback error:', e.message); }
        }
      } else if (prevMode === 'read-write' && !res.ok) {
        console.warn('⚠️ انقطع الاتصال بـ Supabase — تم التحويل التلقائي إلى وضع القراءة فقط لحماية البيانات المحاسبية.');
      }
    } finally {
      isCheckingHealth = false;
    }
  }, intervalMs);
}

function stopPeriodicHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

/**
 * Express Middleware: حظر أي عملية تعديل أو إضافة أو حذف عند انقطاع السحابة
 */
function requireWritePermission(req, res, next) {
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  // السماح بالمسارات الآمنة
  if (isSafePostRoute(req.path)) {
    return next();
  }

  if (systemMode !== 'read-write') {
    return res.status(503).json({
      success: false,
      error: 'قاعدة البيانات الدائمة (Supabase) غير متصلة مؤقتاً. تم إيقاف الحفظ والتعديل لحماية البيانات المحاسبية من الضياع.',
      code: 'DATABASE_READ_ONLY_MODE',
      systemMode: 'read-only',
      lastCheckedAt
    });
  }

  next();
}

module.exports = {
  getSystemMode: () => systemMode,
  setSystemMode: (m) => { systemMode = m; },
  isWriteAllowed: () => systemMode === 'read-write',
  isReady: () => isReady,
  getStatus: () => ({
    mode: systemMode,
    isWriteReady: systemMode === 'read-write',
    isReady,
    lastCheckedAt,
    lastCheckError
  }),
  verifyReadiness,
  startPeriodicHealthCheck,
  stopPeriodicHealthCheck,
  requireWritePermission
};

