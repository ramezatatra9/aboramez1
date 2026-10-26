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

// تحميل متغيرات البيئة من ملف .env إن وجد (للبيئة المحلية)
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

// المفتاح الافتراضي المؤكد لمشروع cvctvekiqgvgpwerzzex
const KNOWN_PROJECT_URL = 'https://cvctvekiqgvgpwerzzex.supabase.co';
const KNOWN_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Y3R2ZWtpcWd2Z3B3ZXJ6emV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDIzMDUsImV4cCI6MjEwNTU3ODMwNX0.g8RGA0_xVv4Gkzv6QRQ5ccH9gcaMQzeBmVpN1Dc5v2U';

const SUPABASE_URL = process.env.SUPABASE_URL || KNOWN_PROJECT_URL;

// التحقق من مفاتيح الخدمة أولاً (service_role) ثم المفتاح العام (anon)
let activeKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

// إذا كان المفتاح غير معرف أو مفتاحاً تجريبياً تالفاً لا يعمل، نعتمد مفتاح المشروع المعتمد
if (!activeKey || activeKey.startsWith('sb_secret_')) {
  activeKey = KNOWN_ANON_KEY;
}

let supabase = null;
try {
  if (SUPABASE_URL && activeKey) {
    supabase = createClient(SUPABASE_URL, activeKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-client-info': 'aboramez1-server-v3' } }
    });
    console.log('✅ تم تهيئة عميل Supabase بنجاح للعنوان:', SUPABASE_URL);
  } else {
    console.warn('⚠️ إعدادات Supabase غير مكتملة.');
  }
} catch (err) {
  console.error('❌ فشل تهيئة عميل Supabase:', err.message);
}

// دالة اختبار الاتصال وفحص صلاحيات القراءة والكتابة
async function testSupabaseConnection() {
  if (!supabase) {
    return { ok: false, readOk: false, writeOk: false, error: 'العميل غير مهيأ' };
  }
  let readOk = false;
  let writeOk = false;
  let rlsNotice = null;

  try {
    const { data, error } = await supabase.from('products').select('count', { count: 'exact', head: true });
    if (!error) {
      readOk = true;
    } else {
      console.warn('⚠️ Supabase read check notice:', error.message);
    }
  } catch (e) {
    console.warn('⚠️ Supabase read exception:', e.message);
  }

  try {
    const testId = '_conn_test_' + Date.now();
    const { error: wErr } = await supabase.from('settings').upsert({
      id: testId,
      data: { test: true, timestamp: new Date().toISOString() }
    });
    if (!wErr) {
      writeOk = true;
      // تنظيف سجل الفحص
      await supabase.from('settings').delete().eq('id', testId);
    } else {
      rlsNotice = wErr.message;
    }
  } catch (wEx) {
    rlsNotice = wEx.message;
  }

  return {
    ok: readOk,
    readOk,
    writeOk,
    url: SUPABASE_URL,
    rlsNotice
  };
}

module.exports = {
  supabase,
  SUPABASE_URL,
  SUPABASE_KEY: activeKey,
  testSupabaseConnection
};
