/* =========================================================
   pin-barcode.js
   ─ قفل الموقع برمز PIN
   ─ مسح الباركود بكاميرا الهاتف
   ========================================================= */

'use strict';

// ─────────────────────────────────────────────
//  الثوابت
// ─────────────────────────────────────────────
const PIN_STORAGE_KEY   = 'aboramez_pin_hash';
const PIN_UNLOCKED_KEY  = 'aboramez_pin_unlocked';
const PIN_UNLOCK_TTL    = 30 * 60 * 1000;   // 30 دقيقة بالمللي ثانية

// ─────────────────────────────────────────────
//  مساعد: تشفير بسيط (XOR + base64)
// ─────────────────────────────────────────────
function simpleHash(pin) {
  const salt = 'aboramez2025';
  let result = '';
  for (let i = 0; i < pin.length; i++) {
    result += String.fromCharCode(pin.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
  }
  return btoa(result);
}

// ─────────────────────────────────────────────
//  تهيئة PIN عند فتح الصفحة
// ─────────────────────────────────────────────
(function initPinLock() {
  const storedPin = localStorage.getItem(PIN_STORAGE_KEY);
  if (!storedPin) return; // لا يوجد PIN → دخول مباشر

  // هل تم الفتح مؤخراً؟
  const unlockedAt = parseInt(localStorage.getItem(PIN_UNLOCKED_KEY) || '0');
  if (Date.now() - unlockedAt < PIN_UNLOCK_TTL) return; // لا يزال مفتوحاً

  // أظهر شاشة القفل
  showPinLockScreen();
})();

function showPinLockScreen() {
  const screen = document.getElementById('pinLockScreen');
  if (!screen) return;
  screen.style.display = 'flex';
  // أخفِ كل محتوى الصفحة خلف الشاشة
  document.body.style.overflow = 'hidden';
  resetPinDots();
}

function hidePinLockScreen() {
  const screen = document.getElementById('pinLockScreen');
  if (!screen) return;
  screen.style.display = 'none';
  document.body.style.overflow = '';
  localStorage.setItem(PIN_UNLOCKED_KEY, Date.now().toString());
}

// ─────────────────────────────────────────────
//  لوحة الأرقام
// ─────────────────────────────────────────────
let pinBuffer = '';

function resetPinDots() {
  pinBuffer = '';
  updatePinDots();
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pinDot' + i);
    if (!dot) continue;
    dot.classList.toggle('pin-dot-filled', i < pinBuffer.length);
  }
}

function pinKeyPress(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();

  // اهتزاز خفيف (Haptic)
  if (navigator.vibrate) navigator.vibrate(30);

  if (pinBuffer.length === 4) {
    setTimeout(checkPin, 120);
  }
}

function pinKeyDelete() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
}

function checkPin() {
  const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
  if (!storedHash) { hidePinLockScreen(); return; }

  if (simpleHash(pinBuffer) === storedHash) {
    // PIN صحيح ✅
    const screen = document.getElementById('pinLockScreen');
    if (screen) {
      screen.style.transition = 'opacity 0.35s ease';
      screen.style.opacity = '0';
      setTimeout(hidePinLockScreen, 350);
    }
    if (navigator.vibrate) navigator.vibrate([30, 30, 60]);
  } else {
    // PIN خطأ ❌
    shakePin();
    if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
    setTimeout(resetPinDots, 600);
  }
}

function shakePin() {
  const keypad = document.getElementById('pinKeypad');
  const dots   = document.getElementById('pinDots');
  // لون أحمر على النقاط
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pinDot' + i);
    if (dot) dot.classList.add('pin-dot-error');
  }
  if (keypad) keypad.classList.add('pin-shake');
  setTimeout(() => {
    if (keypad) keypad.classList.remove('pin-shake');
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById('pinDot' + i);
      if (dot) dot.classList.remove('pin-dot-error');
    }
  }, 600);
}

// ─────────────────────────────────────────────
//  إعدادات PIN (من صفحة الإعدادات)
// ─────────────────────────────────────────────
function savePinCode() {
  const newPin     = document.getElementById('newPinInput')?.value?.trim();
  const confirmPin = document.getElementById('confirmPinInput')?.value?.trim();
  const msgEl      = document.getElementById('pinSettingsMsg');

  function showMsg(text, type) {
    if (!msgEl) return;
    msgEl.style.display = 'block';
    msgEl.style.background = type === 'success' ? '#ecfdf5' : '#fef2f2';
    msgEl.style.color       = type === 'success' ? '#059669' : '#dc2626';
    msgEl.style.border      = `1px solid ${type === 'success' ? '#bbf7d0' : '#fecaca'}`;
    msgEl.textContent = text;
  }

  if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    showMsg('❌ يجب أن يكون رمز PIN 4 أرقام فقط', 'error'); return;
  }
  if (newPin !== confirmPin) {
    showMsg('❌ الرمزان غير متطابقَين، تأكد من الإدخال', 'error'); return;
  }

  localStorage.setItem(PIN_STORAGE_KEY, simpleHash(newPin));
  localStorage.setItem(PIN_UNLOCKED_KEY, Date.now().toString());

  document.getElementById('newPinInput').value     = '';
  document.getElementById('confirmPinInput').value = '';
  updatePinSettingsUI();
  showMsg('✅ تم حفظ رمز PIN بنجاح! سيُطلب منك عند الفتح التالي', 'success');
}

function disablePinCode() {
  if (!confirm('هل تريد إلغاء قفل PIN؟ لن يتم طلب رمز عند فتح الموقع.')) return;
  localStorage.removeItem(PIN_STORAGE_KEY);
  localStorage.removeItem(PIN_UNLOCKED_KEY);
  updatePinSettingsUI();
  const msgEl = document.getElementById('pinSettingsMsg');
  if (msgEl) {
    msgEl.style.display  = 'block';
    msgEl.style.background = '#fff7ed';
    msgEl.style.color      = '#d97706';
    msgEl.style.border     = '1px solid #fed7aa';
    msgEl.textContent = '🔓 تم إلغاء قفل PIN بنجاح';
  }
}

function updatePinSettingsUI() {
  const badge     = document.getElementById('pinStatusBadge');
  const disableBtn = document.getElementById('btnDisablePin');
  const hasPIN    = !!localStorage.getItem(PIN_STORAGE_KEY);

  if (badge) {
    badge.textContent        = hasPIN ? 'مفعّل ✅' : 'غير مفعّل';
    badge.style.background   = hasPIN ? '#dcfce7' : '#f1f5f9';
    badge.style.color        = hasPIN ? '#059669' : '#64748b';
  }
  if (disableBtn) disableBtn.style.display = hasPIN ? 'inline-flex' : 'none';
}

// تحديث واجهة الإعدادات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  updatePinSettingsUI();
});

// ─────────────────────────────────────────────
//  مسح الباركود بالكاميرا
// ─────────────────────────────────────────────
let html5QrScanner = null;
let scannerActive  = false;

function openBarcodeScanner() {
  const modal = document.getElementById('barcodeScannerModal');
  if (!modal) return;
  modal.style.display = 'flex';

  // إخفاء نتيجة سابقة
  const resultBox = document.getElementById('barcodeScanResult');
  if (resultBox) resultBox.style.display = 'none';

  // تأخير قصير ثم تشغيل الكاميرا
  setTimeout(startScanner, 300);
}

function closeBarcodeScanner() {
  stopScanner();
  const modal = document.getElementById('barcodeScannerModal');
  if (modal) modal.style.display = 'none';
  const input = document.getElementById('manualBarcodeInput');
  if (input) input.value = '';
}

function startScanner() {
  if (scannerActive) return;
  if (typeof Html5Qrcode === 'undefined') {
    showScannerFallback();
    return;
  }

  const containerId = 'barcodeScannerInner';
  html5QrScanner = new Html5Qrcode(containerId);

  const config = {
    fps: 12,
    qrbox: { width: 200, height: 120 },
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ]
  };

  html5QrScanner.start(
    { facingMode: 'environment' },
    config,
    onBarcodeSuccess,
    () => {} // أخطاء المسح الجزئي نتجاهلها
  ).then(() => {
    scannerActive = true;
  }).catch(err => {
    console.warn('Camera error:', err);
    showScannerFallback();
  });
}

function stopScanner() {
  if (html5QrScanner && scannerActive) {
    html5QrScanner.stop().catch(() => {});
    html5QrScanner = null;
    scannerActive  = false;
  }
}

function onBarcodeSuccess(decodedText) {
  // توقف عن المسح فوراً
  stopScanner();

  if (navigator.vibrate) navigator.vibrate([40, 30, 80]);

  // ابحث عن المنتج
  searchByBarcode(decodedText, true);
}

function searchByBarcode(code, fromCamera = false) {
  code = (code || '').trim();
  if (!code) return;

  // ابحث في المنتجات بالكود (p.code) أو الاسم
  const products = (typeof state !== 'undefined' && state.products) ? state.products : [];
  const found = products.find(p =>
    (p.code || '').toLowerCase() === code.toLowerCase() ||
    (p.barcode || '').toLowerCase() === code.toLowerCase() ||
    (p.name || '').toLowerCase() === code.toLowerCase()
  );

  const resultBox     = document.getElementById('barcodeScanResult');
  const resultCode    = document.getElementById('barcodeScanResultCode');
  const resultProduct = document.getElementById('barcodeScanResultProduct');

  if (found) {
    // أضف للفاتورة
    if (typeof addToCart === 'function') addToCart(found.id);

    if (resultBox)     resultBox.style.display  = 'block';
    if (resultCode)    resultCode.textContent    = code;
    if (resultProduct) resultProduct.textContent = `✅ تمت إضافة "${found.name}" للفاتورة`;

    // أغلق النافذة بعد ثانيتين
    setTimeout(closeBarcodeScanner, 2000);

    // انتقل لتبويب الفاتورة
    if (typeof switchTab === 'function') setTimeout(() => switchTab('create-invoice'), 2100);

  } else {
    if (resultBox)     resultBox.style.display  = 'block';
    if (resultBox)     resultBox.style.background = '#fef2f2';
    if (resultBox)     resultBox.style.borderColor = '#fecaca';
    if (resultCode)    resultCode.textContent    = code;
    if (resultProduct) {
      resultProduct.textContent = '❌ لم يتم العثور على منتج بهذا الكود في قاعدة البيانات';
      resultProduct.style.color = '#dc2626';
    }
    // أعد تشغيل الكاميرا بعد 2.5 ثانية
    if (fromCamera) {
      setTimeout(() => {
        if (resultBox) { resultBox.style.display = 'none'; resultBox.style.background = ''; resultBox.style.borderColor = ''; }
        if (resultProduct) resultProduct.style.color = '';
        startScanner();
      }, 2500);
    }
  }
}

function showScannerFallback() {
  const inner = document.getElementById('barcodeScannerInner');
  if (inner) {
    inner.innerHTML = `
      <div style="padding:2rem; text-align:center; color:#94a3b8;">
        <div style="font-size:2.5rem; margin-bottom:0.75rem;">📷</div>
        <div style="font-size:0.9rem; margin-bottom:0.5rem;">تعذّر الوصول للكاميرا</div>
        <div style="font-size:0.8rem;">استخدم خانة الإدخال اليدوي أدناه</div>
      </div>`;
  }
}

// دعم لوحة المفاتيح على صفحة القفل
document.addEventListener('keydown', (e) => {
  const screen = document.getElementById('pinLockScreen');
  if (!screen || screen.style.display === 'none') return;
  if (e.key >= '0' && e.key <= '9') pinKeyPress(e.key);
  else if (e.key === 'Backspace') pinKeyDelete();
  else if (e.key === 'Enter' && pinBuffer.length === 4) checkPin();
});
