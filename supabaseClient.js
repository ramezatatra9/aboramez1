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

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

// التحقق من صحة صيغة المفتاح - يجب أن يكون JWT يبدأ بـ eyJ
const isValidJwt = SUPABASE_KEY && SUPABASE_KEY.startsWith('eyJ') && SUPABASE_KEY.split('.').length === 3;

let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY && isValidJwt) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      global: { headers: { 'x-client-info': 'aboramez1-server' } }
    });
    console.log('✅ Supabase Client initialized successfully for:', SUPABASE_URL);
  } else if (SUPABASE_URL && SUPABASE_KEY && !isValidJwt) {
    console.error('❌ SUPABASE_KEY غير صالح: يجب أن يكون JWT يبدأ بـ eyJ (anon key أو service_role key من لوحة Supabase).');
    console.error('   المفتاح الحالي لا يبدأ بـ eyJ - تأكد من نسخ المفتاح الصحيح من: Supabase Dashboard > Settings > API > anon/public key');
  } else {
    console.warn('⚠️ Supabase config missing: SUPABASE_URL present? ' + Boolean(SUPABASE_URL) + ', SUPABASE_KEY present? ' + Boolean(SUPABASE_KEY));
  }
} catch (err) {
  console.error('❌ Failed to initialize Supabase client:', err.message);
}

module.exports = { supabase, SUPABASE_URL, SUPABASE_KEY };
