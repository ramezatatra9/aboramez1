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

// المفتاح العام للقراءة العامة فقط (anon key — يظهر في github workflow ولا يُعدّ سراً)
// يُستخدم فقط للقراءة العامة (SELECT على products) إذا لم يُعيَّن مفتاح الخدمة
const PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Y3R2ZWtpcWd2Z3B3ZXJ6emV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDIzMDUsImV4cCI6MjEwNTU3ODMwNX0.g8RGA0_xVv4Gkzv6QRQ5ccH9gcaMQzeBmVpN1Dc5v2U';

const SUPABASE_URL = (process.env.SUPABASE_URL || KNOWN_PROJECT_URL).trim();

// ===================================================================
// اختيار المفتاح النشط بترتيب صارم وآمن:
//
// الأولوية 1: SUPABASE_SERVICE_ROLE_KEY (مفتاح الخادم الخلفي)
//   → مطلوب للكتابة. يقبل أي صيغة (JWT أو sb_secret_ أو sbp_)
//   → لا يُشارَك مع المتصفح أبداً
//
// الأولوية 2: SUPABASE_KEY (مفتاح بديل من البيئة، قد يكون anon أو service)
//   → يُستخدم فقط إذا غاب SUPABASE_SERVICE_ROLE_KEY
//
// الأولوية 3: PUBLIC_ANON_KEY (مفتاح القراءة العام المضمّن)
//   → آخر ملجأ؛ صلاحيات الكتابة ستكون مرفوضة بـ RLS
//   → لا يُستخدم كبديل صامت عند وجود مفتاح خدمة خاطئ
// ===================================================================

let activeKey = '';
let keySource = '';

const envServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const envAnonKey    = (process.env.SUPABASE_KEY || '').trim();

if (envServiceKey) {
  // مفتاح الخدمة موجود في البيئة — الأولوية القصوى
  activeKey = envServiceKey;
  keySource = 'SUPABASE_SERVICE_ROLE_KEY';
} else if (envAnonKey) {
  // مفتاح بيئة آخر موجود (anon أو service_role بديل)
  activeKey = envAnonKey;
  keySource = 'SUPABASE_KEY';
} else {
  // لا يوجد مفتاح في البيئة — استخدام المفتاح العام للقراءة فقط
  activeKey = PUBLIC_ANON_KEY;
  keySource = 'PUBLIC_ANON_KEY (قراءة عامة فقط)';
}

// تسجيل آمن: المصدر فقط بدون عرض أي قيمة للمفتاح
const keyHint = activeKey.length > 8
  ? activeKey.slice(0, 4) + '...' + activeKey.slice(-4)
  : '(قصير جداً)';
console.log(`🔑 مفتاح Supabase النشط: مصدر=[${keySource}] إشارة=[${keyHint}]`);

// تحذير واضح إذا كانت الصلاحيات ستكون محدودة للقراءة فقط
if (keySource === 'PUBLIC_ANON_KEY (قراءة عامة فقط)') {
  console.warn('⚠️ تحذير: لم يُعيَّن SUPABASE_SERVICE_ROLE_KEY في البيئة.');
  console.warn('   عمليات الكتابة (INSERT/UPDATE/DELETE) ستُرفض من RLS.');
  console.warn('   لتفعيل الكتابة: أضف SUPABASE_SERVICE_ROLE_KEY إلى ملف .env أو متغيرات Render.');
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

// دالة اختبار الاتصال وفحص صلاحيات القراءة والكتابة
// ملاحظة: لا تعيد قيمة المفتاح في أي حال، فقط الحالة والعنوان
async function testSupabaseConnection() {
  if (!supabase) {
    return { ok: false, readOk: false, writeOk: false, keySource, error: 'العميل غير مهيأ' };
  }
  let readOk = false;
  let writeOk = false;
  let rlsNotice = null;

  // فحص القراءة
  try {
    const { error } = await supabase.from('products').select('count', { count: 'exact', head: true });
    if (!error) {
      readOk = true;
    } else {
      console.warn('⚠️ Supabase read check notice:', error.message);
    }
  } catch (e) {
    console.warn('⚠️ Supabase read exception:', e.message);
  }

  // فحص الكتابة بسجل مؤقت آمن
  try {
    const testId = '_conn_test_' + Date.now();
    const { error: wErr } = await supabase.from('settings').upsert({
      id: testId,
      data: { test: true, timestamp: new Date().toISOString() }
    });
    if (!wErr) {
      writeOk = true;
      // تنظيف سجل الاختبار فوراً
      await supabase.from('settings').delete().eq('id', testId);
    } else {
      rlsNotice = wErr.message;
      // تحذير صريح عند فشل الكتابة — لا يُستبدل بمفتاح آخر صامتاً
      if (!writeOk && keySource === 'PUBLIC_ANON_KEY (قراءة عامة فقط)') {
        console.warn('⚠️ RLS تحجب الكتابة مع المفتاح العام. هذا متوقع حتى يُعيَّن SUPABASE_SERVICE_ROLE_KEY.');
      } else if (!writeOk) {
        console.warn(`⚠️ الكتابة مرفوضة بالرغم من استخدام [${keySource}]. تحقق من صلاحيات المفتاح في Supabase.`);
      }
    }
  } catch (wEx) {
    rlsNotice = wEx.message;
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
