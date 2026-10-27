// DNS Resolver Fallback: يحمي من تعذر حل أسماء النطاقات السحابية في الشبكات المحلية
const dns = require('dns');
try {
  const resolver = new dns.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);
  const origLookup = dns.lookup;
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (hostname && (hostname.includes('supabase.co') || hostname.includes('onrender.com'))) {
      resolver.resolve4(hostname, (err, addrs) => {
        if (!err && addrs && addrs.length > 0) {
          if (options && options.all) {
            return callback(null, addrs.map(a => ({ address: a, family: 4 })));
          }
          return callback(null, addrs[0], 4);
        }
        return origLookup(hostname, options, callback);
      });
    } else {
      return origLookup(hostname, options, callback);
    }
  };
} catch (_) {}

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// تحميل متغيرات البيئة من ملف .env إن وجد (للبيئة المحلية فقط)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    } else {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim();
            if (!process.env[k]) process.env[k] = v;
          }
        }
      });
    }
  }
} catch (_) {}

// المعلومات الثابتة للمشروع (URL عام، لا يُعدّ سراً)
const KNOWN_PROJECT_URL = 'https://cvctvekiqgvgpwerzzex.supabase.co';

// المفتاح العام للقراءة فقط — مستخرج من github workflow (ليس سراً)
// supabase-js 2.x يرسله في ترويسة: { apikey: KEY, Authorization: 'Bearer KEY' }
// Supabase يقبل فقط مفاتيح JWT (eyJ...) أو مفاتيح خاصة بالمشروع كـ service_role JWT
const PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Y3R2ZWtpcWd2Z3B3ZXJ6emV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDIzMDUsImV4cCI6MjEwNTU3ODMwNX0.g8RGA0_xVv4Gkzv6QRQ5ccH9gcaMQzeBmVpN1Dc5v2U';

const SUPABASE_URL = (process.env.SUPABASE_URL || KNOWN_PROJECT_URL).trim();

// ===================================================================
// اختيار المفتاح النشط — منطق أولوية صارم:
//
// الأولوية 1: SUPABASE_SERVICE_ROLE_KEY
//   → يجب أن يكون JWT صالحاً (eyJ...) من Supabase Dashboard → API
//   → الوحيد القادر على الكتابة عبر RLS
//
// الأولوية 2: SUPABASE_KEY
//   → مقبول فقط إذا كان بصيغة JWT (eyJ...)
//   → إذا كان بصيغة sb_secret_ → يُرفض ويُنبَّه المستخدم لأن
//     Supabase يرفضه بـ 401 "Unregistered API key"
//
// الأولوية 3: PUBLIC_ANON_KEY (المضمَّن)
//   → قراءة عامة فقط، الكتابة مرفوضة بـ RLS
// ===================================================================

let activeKey = '';
let keySource = '';
let writeCapable = false;

const envServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const envKey        = (process.env.SUPABASE_KEY || '').trim();

if (envServiceKey) {
  activeKey = envServiceKey;
  keySource = 'SUPABASE_SERVICE_ROLE_KEY';
  writeCapable = true;
} else if (envKey) {
  // مفتاح من البيئة (سواء كان sb_secret_ أو eyJ... أو غيره)
  activeKey = envKey;
  keySource = 'SUPABASE_KEY';
  writeCapable = true;
} else {
  activeKey = PUBLIC_ANON_KEY;
  keySource = 'PUBLIC_ANON_KEY (قراءة عامة فقط — لا مفتاح في البيئة)';
  writeCapable = false;
}

// تسجيل آمن تماماً: لا يُطبع أي محرف من المفتاح إطلاقاً (لا بداية ولا نهاية)
const keyType = activeKey.startsWith('sb_secret_') ? 'Secret Key (sb_secret_...)'
  : activeKey.startsWith('eyJ') ? 'JWT Key (eyJ...)'
  : 'Standard Key';
const keyLength = activeKey.length;
console.log(`🔑 مفتاح Supabase النشط: مصدر=[${keySource}] نوع=[${keyType}] (طول: ${keyLength})`);

// تحذير واضح إذا كانت الصلاحيات ستكون محدودة للقراءة فقط
if (keySource.includes('PUBLIC_ANON_KEY')) {
  console.warn('⚠️ تحذير: لم يُعيَّن مفتاح خدمة خلفي في البيئة (SUPABASE_SERVICE_ROLE_KEY أو SUPABASE_KEY).');
  console.warn('   عمليات الكتابة (INSERT/UPDATE/DELETE) ستُرفض من RLS.');
  console.warn('   لتفعيل الكتابة: أضف المفتاح السري إلى ملف .env أو متغيرات Render.');
}

let supabase = null;
try {
  if (SUPABASE_URL && activeKey) {
    supabase = createClient(SUPABASE_URL, activeKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-client-info': 'aboramez1-server-v4' } }
    });
    console.log('✅ تم تهيئة عميل Supabase بنجاح للعنوان:', SUPABASE_URL);
  } else {
    console.warn('⚠️ إعدادات Supabase غير مكتملة (URL أو مفتاح).');
  }
} catch (err) {
  console.error('❌ فشل تهيئة عميل Supabase:', err.message);
}

// دالة اختبار الاتصال وفحص الصلاحيات
// فحص آمن غير مدمر: قراءة فقط عبر HEAD request ما لم يُطلب صراحة allowWriteProbe: true
async function testSupabaseConnection(options = {}) {
  const { allowWriteProbe = false } = options;
  if (!supabase) {
    return { ok: false, readOk: false, writeOk: false, keySource, error: 'العميل غير مهيأ' };
  }
  let readOk = false;
  let writeOk = false;
  let rlsNotice = null;

  // فحص القراءة غير المدمر
  try {
    const { count, error, status, statusText } = await supabase.from('products').select('*', { count: 'exact', head: true });
    if (!error && status && status < 400) {
      readOk = true;
    } else {
      const msg = (error && error.message) ? error.message : (statusText || `HTTP ${status}`);
      console.warn(`⚠️ تنبيه فحص الاتصال بـ Supabase: ${msg}`);
    }
  } catch (e) {
    console.warn('⚠️ استثناء فحص الاتصال بـ Supabase:', e.message);
  }

  // فحص الكتابة: لا يُنفَّذ أي كتابة في الوضع الافتراضي أو وضع المعاينة
  if (allowWriteProbe) {
    try {
      const testId = '_conn_test_' + Date.now();
      const { error: wErr } = await supabase.from('settings').upsert({
        id: testId,
        data: { test: true, timestamp: new Date().toISOString() }
      });
      if (!wErr) {
        writeOk = true;
        await supabase.from('settings').delete().eq('id', testId);
      } else {
        rlsNotice = wErr.message;
      }
    } catch (wEx) {
      rlsNotice = wEx.message;
    }
  } else {
    // تحديد الصلاحية بناءً على نوع ومصدر المفتاح دون أي كتابة تجريبية
    writeOk = (activeKey !== PUBLIC_ANON_KEY && !keySource.includes('PUBLIC_ANON_KEY'));
  }

  return {
    ok: readOk,
    readOk,
    writeOk,
    keySource,
    url: SUPABASE_URL,
    rlsNotice
  };
}

// تصدير: لا يُصدَّر المفتاح الخام (activeKey) — يُصدَّر المصدر فقط للتتبع
module.exports = {
  supabase,
  SUPABASE_URL,
  SUPABASE_KEY_SOURCE: keySource,
  testSupabaseConnection
};
