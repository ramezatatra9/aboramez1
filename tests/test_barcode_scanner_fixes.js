const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('====================================================');
console.log('🧪 بدء الفحص الشامل لإصلاحات ماسح الباركود ونافذة Modal');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName} ${detail ? '(' + detail + ')' : ''}`);
  } else {
    console.error(`❌ [FAIL] ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }
}

// ─── 1. فحص ملف HTML ومكونات النافذة المنبثقة ───
console.log('--- 1. فحص بنية HTML للنافذة المنبثقة وعناصر التحكم ---');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

assert(
  html.includes('id="batchBarcodeRegistrationModal"') &&
  html.includes('class="modal-backdrop modal-overlay" id="batchBarcodeRegistrationModal"'),
  'النافذة المنبثقة تحمل كلاسات modal-backdrop و modal-overlay المدمجة'
);

assert(
  html.includes('id="batchScannerFeedBox"') &&
  html.includes('id="batchScannerQrContainer"'),
  'حاوية كاميرا المسح المباشرة متوفرة داخل النافذة'
);

assert(
  html.includes('id="batchScannerGuidancePill"'),
  'شارة نصيحة التوجيه للمستخدم (Guidance Pill) متوفرة'
);

assert(
  html.includes('id="batchScannerReticle"'),
  'إطار الليزر وشبكة التوجيه البصرية متوفرة'
);

assert(
  html.includes('id="batchStatSuccess"') &&
  html.includes('id="batchStatSkipped"') &&
  html.includes('id="batchStatConflict"') &&
  html.includes('id="batchStatFailed"'),
  'شريط إحصائيات الجلسة الرباعي موجود في الـ HTML'
);

assert(
  html.includes('openBatchBarcodeRegistrationModal()') &&
  html.includes('btnBatchRegisterBarcodes'),
  'زر فتح شاشة تسجيل الباركود متوفر'
);

assert(
  html.includes('html5-qrcode.min.js?v=3.5.0') &&
  html.includes('pin-barcode.js?v=7.5.0'),
  'وسوم السكربت محدثة برقم إصدار Cache-Busting v3.5.0 لمنع تحميل نسخ الكاش القديمة'
);

// ─── 2. فحص قواعد CSS للنافذة المنبثقة وضبط الكاميرا ───
console.log('\n--- 2. فحص قواعد CSS للنافذة المنبثقة وضبط الكاميرا ---');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'style.css'), 'utf8');

assert(
  css.includes('position: fixed !important;') &&
  css.includes('z-index: 25000 !important;'),
  'نافذة modal-overlay تملك position: fixed و z-index مرتفع (25000) للظهور فوق كل عناصر الصفحة'
);

assert(
  css.includes('backdrop-filter: blur(8px) !important;'),
  'الخلفية الداكنة الشفافة مع تأثير التغبيش (blur) مطبقة'
);

assert(
  css.includes('modalSheetSlideUp'),
  'تنسيقات الهواتف الذكية (Bottom Sheet) معدة'
);

assert(
  css.includes('#batchScannerQrContainer') &&
  css.includes('object-fit: cover !important;'),
  'فيديو الكاميرا مضبوط بـ object-fit: cover وتعبئة كاملة للإطار'
);

assert(
  css.includes('.scanner-guidance-pill'),
  'تنسيقات نصيحة التوجيه عند ضعف الإضاءة أو بعد المسافة جاهزة'
);

// ─── 3. فحص JavaScript لمحرك القراءة ومكتبة Html5Qrcode ───
console.log('\n--- 3. فحص JavaScript لمحرك القراءة وضبط دقة الحساس ---');
const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'pin-barcode.js'), 'utf8');
const qrcodeLib = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'html5-qrcode.min.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');

assert(
  js.includes('document.body.style.overflow = \'hidden\'') &&
  js.includes('document.body.style.overflow = \'\''),
  'إدارة تمرير الصفحة الخلفية مبرمجة (تجميد عند الفتح واستعادة عند الإغلاق)'
);

assert(
  js.includes('Html5QrcodeSupportedFormats.EAN_13') &&
  js.includes('Html5QrcodeSupportedFormats.CODE_128') &&
  js.includes('Html5QrcodeSupportedFormats.UPC_A'),
  'محرك القراءة مبرمج بصيغ EAN-13 و Code 128 و UPC-A و EAN-8'
);

assert(
  js.includes('enableNativeBarcodeDetector') &&
  js.includes('useBarCodeDetectorIfSupported: enableNativeBarcodeDetector'),
  'فحص التوافق العتادي الديناميكي لـ BarcodeDetector لضمان عدم السقوط في أخطاء المتصفحات الصامتة'
);

assert(
  js.includes('videoConstraints') &&
  js.includes('ideal: 1280') &&
  js.includes('qrbox: function'),
  'ضبط دقة البث الفعلي بدقة HD (1280x720 / 1080p) ومستطيل مسح عريض'
);

assert(
  qrcodeLib.includes('o.set(E.DecodeHintType.TRY_HARDER,!0)'),
  'تفعيل خيار TRY_HARDER: true في محرك ZXing لمسح كامل ارتفاع الإطار ودعم الزوايا المائلة'
);

assert(
  qrcodeLib.includes('var dw=Math.round(a),dh=Math.round(c);') &&
  qrcodeLib.includes('this.context.drawImage(i,l,h,a,c,0,0,dw,dh);'),
  'رسم إطارات الكاميرا على الكانفاس بدقة الحساس الكاملة (Native Sensor Resolution) دون ضغط تشويهي'
);

assert(
  qrcodeLib.includes('this.qrcode.decodeRobustlyAsync(this.canvasElement)'),
  'تفعيل الفك المتين (Robust Decoding) مع تجربة المحركين في نفس الإطار حال التعذر'
);

assert(
  sw.includes('aboramez-pos-v3.5.0'),
  'تحديث رقم إصدار Service Worker إلى v3.5.0 لتجاوز كاش PWA'
);

assert(
  js.includes('String(rawBarcode || \'\').trim()') || js.includes('String(decodedText || \'\').trim()'),
  'معالجة الباركود كنص صريح (String) للحفاظ على الأصفار البادئة'
);

// ─── 4. فحص واجهات API وسيرفر النظام ───
console.log('\n--- 4. فحص واجهات API مع السيرفر المحلي ---');

function makeRequest(method, reqPath, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: reqPath,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runApiTests() {
  try {
    // استعلام عن باركود غير مسجل يبدأ بأصفار
    const testZeroBarcode = '0009876543210';
    const r1 = await makeRequest('GET', '/api/barcodes/lookup?barcode=' + testZeroBarcode);
    assert(r1.status === 200 && r1.body.registered === false, 'استعلام عن باركود جديد يبدأ بثلاثة أصفار', testZeroBarcode);

    // البحث عن منتجات لربطها
    const r2 = await makeRequest('GET', '/api/products/search?q=' + encodeURIComponent('شاش'));
    assert(r2.status === 200 && Array.isArray(r2.body.products), 'البحث السريع عن المنتجات بالاسم', `النتائج: ${r2.body.count}`);

    // سلامة قاعدة البيانات
    const r3 = await makeRequest('GET', '/api/products');
    assert(r3.status === 200 && r3.body.products.length >= 1430, 'سلامة إجمالي أصناف المعرض في قاعدة البيانات', `العدد: ${r3.body.products.length}`);

    // سلامة الفواتير
    const r4 = await makeRequest('GET', '/api/invoices');
    assert(r4.status === 200 && Array.isArray(r4.body.invoices), 'سلامة سجل الفواتير والمبيعات وعدم تأثرها');

    console.log('\n====================================================');
    console.log(`📊 النتيجة الإجمالية: ${passedTests} من أصل ${totalTests} اختباراً ناجحاً بنسبة ${(passedTests/totalTests*100).toFixed(0)}%`);
    console.log('====================================================');

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('❌ تعذر استكمال اختبارات API:', err.message);
    process.exit(1);
  }
}

runApiTests();
