/* =========================================================
   pin-barcode.js
   نظام الصلاحيات وقفل PIN متعدد المستخدمين
   + محرك مسح الباركود بالكاميرا (حي ومحلي ومزدوج المحرك)
   + فحص ومنع تكرار الباركود في الجرد والفوترة
   ========================================================= */

'use strict';

// ─────────────────────────────────────────────
//  [1] الثوابت ونظام المستخدمين والصلاحيات
// ─────────────────────────────────────────────
const PIN_SESSION_KEY  = 'aboramez_auth_session';
const PIN_SESSION_TTL  = 45 * 60 * 1000; // 45 دقيقة

// المستخدمون الافتراضيون (الأدمن والكاشير)
const DEFAULT_SECURITY_USERS = [
  { id: 'u-admin',   name: 'المدير العام (رامز)', pin: '8802', role: 'admin' },
  { id: 'u-cashier', name: 'موظف مبيعات / كاشير',     pin: '1111', role: 'cashier' }
];

let appSecurityUsers = [...DEFAULT_SECURITY_USERS];
let isPinLockActive = true;
let hideCostsForCashier = true;

// المستخدم الحالي المسجل دخوله
window.currentUser = null;

// ─────────────────────────────────────────────
//  [2] توليد أصوات تفاعلية (Web Audio API Synth)
// ─────────────────────────────────────────────
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// صوت نقرة أرقام خفيفة
function playPinKeyTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {}
}

// صوت نجاح مميز (لحن ثنائي مبهج)
function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587.33, 880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.12, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.16);
    });
  } catch (e) {}
}

// صوت تنبيه خطأ أو تكرار باركود (نغمة تحذيرية منخفضة)
function playErrorBuzz() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(120, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch (e) {}
}

// ─────────────────────────────────────────────
//  [3] تهيئة قفل PIN وفحص الجلسة عند بدء التشغيل
// ─────────────────────────────────────────────
async function loadSecuritySettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      const s = data.settings;
      if (Array.isArray(s.securityUsers) && s.securityUsers.length > 0) {
        appSecurityUsers = s.securityUsers;
      }
      if (s.pinLockEnabled !== undefined) {
        isPinLockActive = Boolean(s.pinLockEnabled);
      }
      if (s.hideCostsFromCashier !== undefined) {
        hideCostsForCashier = Boolean(s.hideCostsFromCashier);
      }
    }
  } catch (e) {
    console.warn('Failed to fetch settings from API, using defaults:', e);
  }
}

// بدء فحص القفل
(async function initSecuritySystem() {
  await loadSecuritySettings();

  // فحص الجلسة المحفوظة مسبقاً
  try {
    const sessionRaw = localStorage.getItem(PIN_SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      const isExpired = Date.now() - (session.timestamp || 0) > PIN_SESSION_TTL;
      if (!isExpired && session.user) {
        // جلسة صالحة
        applyUserRole(session.user);
        return;
      }
    }
  } catch (e) {}

  // إذا كان القفل مفعلاً، افتح شاشة القفل فوراً
  if (isPinLockActive) {
    showPinLockScreen();
  } else {
    // إذا كان القفل معطلاً، ادخل افتراضياً كأدمن
    applyUserRole(appSecurityUsers[0] || DEFAULT_SECURITY_USERS[0]);
  }
})();

// تطبيق صلاحيات المستخدم على كامل واجهة الموقع
function applyUserRole(user) {
  window.currentUser = user;

  // حفظ الجلسة
  try {
    localStorage.setItem(PIN_SESSION_KEY, JSON.stringify({
      user,
      timestamp: Date.now()
    }));
  } catch (e) {}

  // تحديث كلاسات الـ body للتحكم بالصلاحيات
  document.body.classList.remove('role-admin', 'role-cashier');
  document.body.classList.add(`role-${user.role}`);

  // تحديث شارة الهيدر
  const userEmoji = document.getElementById('headerUserEmoji');
  const userLabel = document.getElementById('headerUserLabel');
  const userSub   = document.getElementById('headerUserSub');

  if (user.role === 'admin') {
    if (userEmoji) userEmoji.textContent = '👑';
    if (userLabel) userLabel.textContent = user.name || 'المدير العام';
    if (userSub)   userSub.textContent   = 'صلاحيات كاملة';
    // فتح جميع الأقسام المحمية
    if (typeof state !== 'undefined') state.settingsUnlocked = true;
  } else {
    if (userEmoji) userEmoji.textContent = '💼';
    if (userLabel) userLabel.textContent = user.name || 'موظف مبيعات';
    if (userSub)   userSub.textContent   = 'وضع الكاشير';
    if (typeof state !== 'undefined') state.settingsUnlocked = false;

    // تعيين اسم الموظف تلقائياً في الفاتورة وسند القبض
    const invEmp = document.getElementById('invEmployeeName');
    if (invEmp && !invEmp.value) invEmp.value = user.name || 'موظف مبيعات';
    const rcpEmp = document.getElementById('rcpEmployeeName');
    if (rcpEmp && !rcpEmp.value) rcpEmp.value = user.name || 'موظف مبيعات';
  }

  // تحديث ظهور الأقسام في القوائم
  updateRoleRestrictedNavigation(user.role);

  // إخفاء شاشة القفل
  const screen = document.getElementById('pinLockScreen');
  if (screen) {
    screen.style.opacity = '0';
    setTimeout(() => {
      screen.style.display = 'none';
      screen.style.opacity = '1';
      document.body.style.overflow = '';
    }, 280);
  }
}

// إخفاء أو إظهار التبويبات حسب الصلاحية
function updateRoleRestrictedNavigation(role) {
  const isCashier = role === 'cashier';
  const restrictedTabs = ['dashboard', 'settings', 'brands-audit'];

  restrictedTabs.forEach(tabKey => {
    // الأزرار العلوية
    const upperBtn = document.querySelector(`.nav-tab-btn[data-tab="${tabKey}"]`);
    if (upperBtn) upperBtn.style.display = isCashier ? 'none' : '';

    // عناصر القائمة السفلية "المزيد"
    const moreBtn = document.querySelector(`.sheet-item-btn[onclick*="'${tabKey}'"]`);
    if (moreBtn) moreBtn.style.display = isCashier ? 'none' : '';
  });

  // إذا كان الكاشير واقفاً على صفحة ممنوعة، تحويله فوراً للكتالوج
  if (isCashier && typeof actuallySwitchTab === 'function') {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && (activeTab.id === 'tab-dashboard' || activeTab.id === 'tab-settings' || activeTab.id === 'tab-brands-audit')) {
      actuallySwitchTab('catalog');
    }
  }
}

// ─────────────────────────────────────────────
//  [4] شاشة القفل التفاعلية (Lock Screen)
// ─────────────────────────────────────────────
let pinBuffer = '';
let targetRoleFilter = 'admin'; // 'admin' | 'cashier'

function showPinLockScreen() {
  const screen = document.getElementById('pinLockScreen');
  if (!screen) return;
  screen.style.display = 'flex';
  screen.style.opacity = '1';
  document.body.style.overflow = 'hidden';
  resetPinBuffer();
  updatePinScreenUserHints();
}

// قفل الشاشة السريع
function lockAppScreen() {
  window.currentUser = null;
  try { localStorage.removeItem(PIN_SESSION_KEY); } catch (e) {}
  showPinLockScreen();
  if (typeof showToast === 'function') {
    showToast('تم قفل الشاشة 🔒 أدخل رمز PIN للدخول', 'info');
  }
}

function selectPinTargetUser(role) {
  targetRoleFilter = role;
  document.getElementById('pillUserAdmin')?.classList.toggle('active', role === 'admin');
  document.getElementById('pillUserCashier')?.classList.toggle('active', role === 'cashier');

  const hintText = document.getElementById('pinRoleHintText');
  const hintIcon = document.getElementById('pinRoleHintIcon');
  if (hintText) {
    hintText.textContent = '';
    hintText.style.color = '';
  }
  if (hintIcon) hintIcon.textContent = '';

  resetPinBuffer();
  if (navigator.vibrate) navigator.vibrate(20);
}

function updatePinScreenUserHints() {
  const adminUser   = appSecurityUsers.find(u => u.role === 'admin') || DEFAULT_SECURITY_USERS[0];
  const cashierUser = appSecurityUsers.find(u => u.role === 'cashier') || DEFAULT_SECURITY_USERS[1];

  const adminPill   = document.querySelector('#pillUserAdmin .user-pill-text');
  const cashierPill = document.querySelector('#pillUserCashier .user-pill-text');
  if (adminPill)   adminPill.textContent   = adminUser.name || 'المدير العام';
  if (cashierPill) cashierPill.textContent = cashierUser.name || 'موظف مبيعات';
}

function resetPinBuffer() {
  pinBuffer = '';
  updatePinDots();
  const hintText = document.getElementById('pinRoleHintText');
  const hintIcon = document.getElementById('pinRoleHintIcon');
  if (hintText) {
    hintText.textContent = '';
    hintText.style.color = '';
  }
  if (hintIcon) hintIcon.textContent = '';
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pinDot' + i);
    if (!dot) continue;
    dot.classList.toggle('pin-dot-filled', i < pinBuffer.length);
    dot.classList.remove('pin-dot-error');
  }
}

function pinKeyPress(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();

  // تأثير صوتي ولمسي
  playPinKeyTone();
  if (navigator.vibrate) navigator.vibrate(25);

  // فحص تلقائي فوري بمجرد إدخال 4 أرقام
  if (pinBuffer.length === 4) {
    setTimeout(verifyEnteredPin, 100);
  }
}

function pinKeyDelete() {
  if (pinBuffer.length > 0) {
    pinBuffer = pinBuffer.slice(0, -1);
    updatePinDots();
    playPinKeyTone();
    if (navigator.vibrate) navigator.vibrate(18);
  }
}

function quickFillPin(code) {
  resetPinBuffer();
  for (let i = 0; i < code.length; i++) {
    pinKeyPress(code[i]);
  }
}

function verifyEnteredPin() {
  // البحث عن مستخدم يطابق الرمز المدخل
  const matchedUser = appSecurityUsers.find(u => String(u.pin).trim() === pinBuffer);

  if (matchedUser) {
    // رمز صحيح ✅
    playSuccessChime();
    if (navigator.vibrate) navigator.vibrate([30, 40, 70]);

    const hintText = document.getElementById('pinRoleHintText');
    const hintIcon = document.getElementById('pinRoleHintIcon');
    if (hintText) {
      hintText.textContent = `مرحباً بك: ${matchedUser.name} ${matchedUser.role === 'admin' ? '👑' : '💼'}`;
      hintText.style.color = '#10b981';
    }
    if (hintIcon) hintIcon.textContent = '✅';

    // إضاءة خضراء على النقاط
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById('pinDot' + i);
      if (dot) dot.style.background = '#10b981';
    }

    setTimeout(() => {
      applyUserRole(matchedUser);
      if (typeof showToast === 'function') {
        showToast(`أهلاً بك، تم تسجيل الدخول بنجاح كـ (${matchedUser.name})`, 'success');
      }
    }, 320);

  } else {
    // رمز غير صحيح ❌
    playErrorBuzz();
    if (navigator.vibrate) navigator.vibrate([80, 50, 90]);

    const keypad = document.getElementById('pinKeypad');
    const hintText = document.getElementById('pinRoleHintText');
    const hintIcon = document.getElementById('pinRoleHintIcon');
    if (hintText) {
      hintText.textContent = 'رمز PIN غير صحيح! حاول مرة أخرى';
      hintText.style.color = '#ef4444';
    }
    if (hintIcon) hintIcon.textContent = '❌';

    // اهتزاز وتلوين أحمر
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById('pinDot' + i);
      if (dot) dot.classList.add('pin-dot-error');
    }
    if (keypad) keypad.classList.add('pin-shake');

    setTimeout(() => {
      if (keypad) keypad.classList.remove('pin-shake');
      resetPinBuffer();
    }, 600);
  }
}

// ─────────────────────────────────────────────
//  [5] إعدادات الأمان وإدارة الرموز من صفحة الإعدادات
// ─────────────────────────────────────────────
function initSecuritySettingsForm() {
  const adminUser   = appSecurityUsers.find(u => u.role === 'admin') || DEFAULT_SECURITY_USERS[0];
  const cashierUser = appSecurityUsers.find(u => u.role === 'cashier') || DEFAULT_SECURITY_USERS[1];

  const adminInput   = document.getElementById('adminPinInput');
  const cashierInput = document.getElementById('cashierPinInput');
  const lockCheckbox = document.getElementById('chkPinLockEnabled');
  const hideCheckbox = document.getElementById('chkHideCostsFromCashier');

  if (adminInput)   adminInput.value   = adminUser.pin   || '1234';
  if (cashierInput) cashierInput.value = cashierUser.pin || '1111';
  if (lockCheckbox) lockCheckbox.checked = isPinLockActive;
  if (hideCheckbox) hideCheckbox.checked = hideCostsForCashier;
}

async function saveUserSecuritySettings() {
  const adminPin   = document.getElementById('adminPinInput')?.value?.trim();
  const cashierPin = document.getElementById('cashierPinInput')?.value?.trim();
  const lockActive = document.getElementById('chkPinLockEnabled')?.checked ?? true;
  const hideCosts  = document.getElementById('chkHideCostsFromCashier')?.checked ?? true;
  const alertMsg   = document.getElementById('pinSettingsAlertMsg');

  function showMsg(text, isError = false) {
    if (!alertMsg) return;
    alertMsg.style.display = 'block';
    alertMsg.style.background = isError ? '#fef2f2' : '#ecfdf5';
    alertMsg.style.color      = isError ? '#dc2626' : '#059669';
    alertMsg.style.border     = `1.5px solid ${isError ? '#fca5a5' : '#86efac'}`;
    alertMsg.textContent     = text;
  }

  if (!adminPin || adminPin.length !== 4 || !/^\d{4}$/.test(adminPin)) {
    showMsg('❌ رمز المدير العام يجب أن يتكون من 4 أرقام بالضبط', true);
    return;
  }
  if (!cashierPin || cashierPin.length !== 4 || !/^\d{4}$/.test(cashierPin)) {
    showMsg('❌ رمز موظف المبيعات يجب أن يتكون من 4 أرقام بالضبط', true);
    return;
  }
  if (adminPin === cashierPin) {
    showMsg('❌ لا يمكن استخدام نفس الرمز للمدير والموظف! يرجى اختيار رمز مختلف لكل منهما', true);
    return;
  }

  const updatedUsers = [
    { id: 'u-admin',   name: 'المدير العام (رامز)', pin: adminPin,   role: 'admin' },
    { id: 'u-cashier', name: 'موظف مبيعات / كاشير',     pin: cashierPin, role: 'cashier' }
  ];

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        securityUsers: updatedUsers,
        pinLockEnabled: lockActive,
        hideCostsFromCashier: hideCosts
      })
    });
    const data = await res.json();
    if (data.success) {
      appSecurityUsers    = updatedUsers;
      isPinLockActive     = lockActive;
      hideCostsForCashier = hideCosts;
      updatePinScreenUserHints();
      showMsg('✅ تم حفظ رموز المستخدمين وإعدادات الصلاحيات بنجاح!', false);
      if (typeof showToast === 'function') {
        showToast('تم تحديث رموز الدخول بنجاح! المدير: ' + adminPin + ' | الموظف: ' + cashierPin, 'success');
      }
    } else {
      showMsg('❌ فشل الحفظ على الخادم: ' + (data.error || 'خطأ غير معروف'), true);
    }
  } catch (err) {
    showMsg('❌ حدث خطأ أثناء الاتصال بالخادم: ' + err.message, true);
  }
}

function handlePinLockToggle(enabled) {
  isPinLockActive = enabled;
  const badge = document.getElementById('pinSettingsStatusBadge');
  if (badge) {
    badge.textContent = enabled ? 'قفل PIN مفعّل' : 'قفل PIN معطّل';
    badge.style.background = enabled ? '#059669' : '#64748b';
  }
}

function toggleInputVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
}

// ─────────────────────────────────────────────
//  [6] محرك كاميرا الموقع الذكية المباشرة للتعرف التلقائي على الباركود
//  Dual-Engine: Html5Qrcode + ZXing Core مع تسريع BarcodeDetector التلقائي
// ─────────────────────────────────────────────
let isScanningActive = false;
let html5QrInstance = null;
let currentCameraFacing = 'environment'; // 'environment' (back) | 'user' (front)
let currentActiveScannerContext = null;
let scannerGuidanceTimer = null;
let isScannerTorchActive = false;
let lastDecodedBarcode = null;
let lastDecodedTimestamp = 0;

// إرجاع قائمة الصيغ المدعومة الكاملة من Html5Qrcode (ZXing)
function getTargetBarcodeFormats() {
  if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
    return [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.QR_CODE
    ];
  }
  return undefined;
}

// مؤقت إظهار نصيحة التوجيه للمستخدم عند تأخر القراءة
function startScannerGuidanceTimer(context) {
  if (scannerGuidanceTimer) clearTimeout(scannerGuidanceTimer);
  const pillId = context === 'batch' ? 'batchScannerGuidancePill' : 'universalScannerGuidancePill';
  const pill = document.getElementById(pillId);
  if (pill) pill.style.display = 'none';

  scannerGuidanceTimer = setTimeout(() => {
    if (isScanningActive && pill) {
      pill.style.display = 'inline-flex';
    }
  }, 3200);
}

function hideScannerGuidanceTip(context) {
  if (scannerGuidanceTimer) {
    clearTimeout(scannerGuidanceTimer);
    scannerGuidanceTimer = null;
  }
  const pillId = context === 'batch' ? 'batchScannerGuidancePill' : 'universalScannerGuidancePill';
  const pill = document.getElementById(pillId);
  if (pill) pill.style.display = 'none';
}

// تشغيل كاميرا الموقع الحية المباشرة مع قراءة الإطارات الذكية
async function startLiveCameraScanner(context) {
  currentActiveScannerContext = context;
  await stopLiveCameraScanner();

  const isAssign = context === 'assign';
  const isBatch = context === 'batch';
  const qrId = isBatch ? 'batchScannerQrContainer' : (isAssign ? 'assignScannerQrContainer' : 'universalScannerQrContainer');
  const videoId = isBatch ? 'batchScannerVideo' : (isAssign ? 'assignScannerVideo' : 'universalScannerVideo');

  const qrContainer = document.getElementById(qrId);
  const videoEl = document.getElementById(videoId);

  if (!qrContainer) {
    console.error('[Scanner] Missing QR container element:', qrId);
    return;
  }

  // إخفاء الـ video الثابت وإظهار حاوية البث المباشر
  if (videoEl) videoEl.style.display = 'none';
  qrContainer.style.display = 'block';
  qrContainer.innerHTML = '';

  hideScannerGuidanceTip(context);

  if (typeof Html5Qrcode === 'undefined') {
    console.error('[Scanner] Html5Qrcode library not loaded.');
    showCameraPermissionNotice(context, 'تعذر تحميل مكتبة قراءة الباركود، يرجى تحديث الصفحة.');
    return;
  }

  try {
    const formats = getTargetBarcodeFormats();

    // فحص ما إذا كان المتصفح يدعم BarcodeDetector فعلياً لصيغ الباركود الخطية EAN-13
    let enableNativeBarcodeDetector = false;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window && typeof BarcodeDetector.getSupportedFormats === 'function') {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        if (Array.isArray(supported) && (supported.includes('ean_13') || supported.includes('code_128'))) {
          enableNativeBarcodeDetector = true;
          console.log('[Scanner] Native BarcodeDetector supports 1D formats:', supported);
        } else {
          console.log('[Scanner] Native BarcodeDetector lacks 1D barcode formats, defaulting to Pure ZXing High-Definition Engine.');
        }
      } catch (e) {
        enableNativeBarcodeDetector = false;
      }
    }

    html5QrInstance = new Html5Qrcode(qrId, {
      formatsToSupport: formats,
      verbose: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: enableNativeBarcodeDetector
      }
    });

    // إعدادات الكاميرا: دقة عالية (1080p أو 720p) لمنع انضغاط وتغبيش خطوط الباركود الرفيعة
    const videoConstraints = {
      facingMode: currentCameraFacing,
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 }
    };

    const scanConfig = {
      fps: 15,
      videoConstraints: videoConstraints,
      disableFlip: false,
      qrbox: function(viewfinderWidth, viewfinderHeight) {
        // مستطيل عريض يطابق إطار التوجيه البصري (Reticle Box)
        const w = Math.min(Math.floor(viewfinderWidth * 0.90), 520);
        const h = Math.min(Math.floor(viewfinderHeight * 0.65), 260);
        return { width: Math.max(w, 240), height: Math.max(h, 120) };
      }
    };

    const onScanSuccess = (decodedText) => {
      if (!isScanningActive) return;
      const cleanCode = String(decodedText || '').trim();
      if (!cleanCode) return;

      const now = performance.now();
      if (cleanCode === lastDecodedBarcode && (now - lastDecodedTimestamp < 1800)) {
        return; // منع المعالجة المتكررة لنفس الرمز
      }

      lastDecodedBarcode = cleanCode;
      lastDecodedTimestamp = now;

      console.log('[Scanner] Barcode successfully decoded [' + context + ']:', cleanCode);
      hideScannerGuidanceTip(context);

      if (context !== 'batch') {
        isScanningActive = false;
      }
      onBarcodeDecoded(cleanCode, context);
    };

    const onScanError = () => {
      // إطار بدون باركود أثناء البث الطبيعي
    };

    try {
      await html5QrInstance.start({ facingMode: currentCameraFacing }, scanConfig, onScanSuccess, onScanError);
      isScanningActive = true;
      startScannerGuidanceTimer(context);
    } catch (camErr) {
      console.warn('[Scanner] HD facingMode start failed, trying fallback to basic stream:', camErr);
      const fallbackConfig = {
        fps: 12,
        disableFlip: false,
        qrbox: scanConfig.qrbox
      };
      await html5QrInstance.start({}, fallbackConfig, onScanSuccess, onScanError);
      isScanningActive = true;
      startScannerGuidanceTimer(context);
    }

    // تفعيل التركيز التلقائي المستمر وتقريب العدسة البصري إن وُجد
    try {
      const activeVideo = qrContainer.querySelector('video');
      if (activeVideo && activeVideo.srcObject) {
        const videoTrack = activeVideo.srcObject.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities && videoTrack.applyConstraints) {
          const caps = videoTrack.getCapabilities();
          const advanced = [];

          if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            advanced.push({ focusMode: 'continuous' });
          }

          if (caps.zoom && caps.zoom.min !== undefined && caps.zoom.max !== undefined) {
            const optimalZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.25));
            if (optimalZoom > caps.zoom.min) {
              advanced.push({ zoom: optimalZoom });
            }
          }

          if (advanced.length > 0) {
            await videoTrack.applyConstraints({ advanced });
            console.log('[Scanner] Camera advanced capabilities applied:', advanced);
          }

          setTimeout(() => {
            if (activeVideo) {
              console.log(`[Scanner] Active camera resolution: ${activeVideo.videoWidth}x${activeVideo.videoHeight} (${videoTrack.label || 'Default Camera'})`);
            }
          }, 600);
        }
      }
    } catch (focusErr) {
      console.debug('[Scanner] Optional camera constraints note:', focusErr);
    }

  } catch (err) {
    console.error('[Scanner] Camera initialization failed:', err);
    showCameraPermissionNotice(context, 'يرجى السماح بالوصول للكاميرا في المتصفح لاستخدام المسح التلقائي');
  }
}

// إيقاف الكاميرا وتفريغ الموارد بأمان تام
async function stopLiveCameraScanner() {
  isScanningActive = false;
  hideScannerGuidanceTip(currentActiveScannerContext);

  if (html5QrInstance) {
    try {
      if (html5QrInstance.isScanning) {
        await html5QrInstance.stop();
      }
      try { html5QrInstance.clear(); } catch (e) {}
    } catch (e) {
      console.warn('[Scanner] Stop warning:', e);
    } finally {
      html5QrInstance = null;
    }
  }

  isScannerTorchActive = false;
}

// تبديل الكاميرا (أمامية / خلفية)
async function toggleScannerCameraDevice(context) {
  currentCameraFacing = currentCameraFacing === 'environment' ? 'user' : 'environment';
  if (navigator.vibrate) navigator.vibrate(20);
  await startLiveCameraScanner(context);
}

// تشغيل فلاش الكاميرا (Torch) إن وجد
async function toggleScannerTorch(context) {
  const isAssign = context === 'assign';
  const isBatch = context === 'batch';
  const qrId = isBatch ? 'batchScannerQrContainer' : (isAssign ? 'assignScannerQrContainer' : 'universalScannerQrContainer');
  const qrContainer = document.getElementById(qrId);

  const videoTrack = qrContainer?.querySelector('video')?.srcObject?.getVideoTracks()?.[0];
  if (!videoTrack || !videoTrack.applyConstraints) {
    if (typeof showToast === 'function') showToast('الفلاش غير مدعوم على هذه الكاميرا', 'warning');
    return;
  }

  const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
  if (!caps.torch) {
    if (typeof showToast === 'function') showToast('الفلاش غير متوفر على هذا الجهاز', 'warning');
    return;
  }

  try {
    isScannerTorchActive = !isScannerTorchActive;
    await videoTrack.applyConstraints({
      advanced: [{ torch: isScannerTorchActive }]
    });
    if (typeof showToast === 'function') {
      showToast(isScannerTorchActive ? 'تم تشغيل فلاش الكاميرا 🔦' : 'تم إيقاف الفلاش', 'info');
    }
    const btnTorch = document.getElementById('btnBatchTorch');
    if (btnTorch) {
      btnTorch.classList.toggle('active', isScannerTorchActive);
    }
  } catch (e) {
    console.warn('[Scanner] Torch apply error:', e);
    if (typeof showToast === 'function') showToast('تعذر تغيير وضع الفلاش', 'error');
  }
}

function showCameraPermissionNotice(context, errMsg) {
  const isAssign = context === 'assign';
  const isBatch = context === 'batch';
  const qrContainerId = isBatch ? 'batchScannerQrContainer' : (isAssign ? 'assignScannerQrContainer' : 'universalScannerQrContainer');
  const qrContainer = document.getElementById(qrContainerId);

  if (qrContainer) {
    qrContainer.style.display = 'block';
    qrContainer.innerHTML = [
      '<div style="padding:1.5rem 1rem; text-align:center; color:#ffffff; background:#0f172a; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;">',
      '  <span style="font-size:2.5rem; margin-bottom:0.4rem;">📷</span>',
      '  <strong style="font-size:0.98rem; margin-bottom:0.35rem; color:#f87171;">الكاميرا بحاجة لإذن المتصفح</strong>',
      '  <p style="font-size:0.8rem; color:#94a3b8; margin-bottom:1rem; max-width:260px; line-height:1.4;">',
      '    ' + escapeHtml(errMsg || 'يرجى الضغط على علامة القفل 🔒 بجانب عنوان الموقع وتفعيل خيار (الكاميرا Camera)'),
      '  </p>',
      '  <button type="button" class="btn btn-sm btn-primary" onclick="startLiveCameraScanner(\'' + context + '\')" style="font-weight:700;">',
      '    <span>🔄</span>',
      '    <span>إعادة محاولة تشغيل الكاميرا</span>',
      '  </button>',
      '</div>'
    ].join('\n');
  }
}

// ─────────────────────────────────────────────//  [8] نافذة تعريف باركود لصنف بالجرد (مع فحص ومنع التكرار الصارم)
// ─────────────────────────────────────────────
let assignTargetProduct = null;

function openAssignBarcodeModal(productId) {
  const products = (typeof state !== 'undefined' && state.products) ? state.products : [];
  assignTargetProduct = products.find(p => p.id === productId);
  if (!assignTargetProduct) {
    if (typeof showToast === 'function') showToast('لم يتم العثور على الصنف المحدد', 'error');
    return;
  }

  const modal = document.getElementById('assignBarcodeModal');
  if (!modal) return;

  // تعبئة بيانات الصنف المستهدف
  const imgEl   = document.getElementById('assignProdImg');
  const nameEl  = document.getElementById('assignProdName');
  const codeEl  = document.getElementById('assignProdCodeBadge');
  const metaEl  = document.getElementById('assignProdMeta');
  const bcTagEl = document.getElementById('assignProdCurrentBarcodeText');
  const idEl    = document.getElementById('assignTargetProdId');
  const manualInp = document.getElementById('assignManualBarcodeInput');

  if (imgEl)   imgEl.src = assignTargetProduct.image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80';
  if (nameEl)  nameEl.textContent = assignTargetProduct.name || 'بدون اسم';
  if (codeEl)  codeEl.textContent = `كود: [${assignTargetProduct.code || 'PRD'}]`;
  if (metaEl)  metaEl.textContent = `الماركة: ${assignTargetProduct.brand || 'عام'} • القسم: ${assignTargetProduct.category || 'عام'}`;
  if (idEl)    idEl.value = assignTargetProduct.id;
  if (manualInp) manualInp.value = assignTargetProduct.barcode || '';

  if (bcTagEl) {
    if (assignTargetProduct.barcode) {
      bcTagEl.textContent = assignTargetProduct.barcode;
      bcTagEl.className = 'current-bc-tag has-val';
    } else {
      bcTagEl.textContent = 'غير معرّف بعد';
      bcTagEl.className = 'current-bc-tag';
    }
  }

  // إخفاء التنبيهات
  document.getElementById('barcodeDuplicateAlertBox').style.display = 'none';
  document.getElementById('barcodeSuccessAlertBox').style.display = 'none';
  document.getElementById('assignScannerLiveWrapper').style.display = 'block';

  document.body.style.overflow = 'hidden';
  modal.style.display = 'flex';
  modal.classList.add('active');
  setTimeout(() => startLiveCameraScanner('assign'), 80);
}

function closeAssignBarcodeModal() {
  stopLiveCameraScanner();
  const modal = document.getElementById('assignBarcodeModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  document.body.style.overflow = '';
  assignTargetProduct = null;
}

// إعادة تشغيل الكاميرا لمسح كود آخر بعد ظهور التنبيه
function resetAssignScannerForRetry() {
  document.getElementById('barcodeDuplicateAlertBox').style.display = 'none';
  document.getElementById('assignScannerLiveWrapper').style.display = 'block';
  const manualInp = document.getElementById('assignManualBarcodeInput');
  if (manualInp) manualInp.value = '';
  startLiveCameraScanner('assign');
}

// حفظ الباركود المدخل يدوياً
function saveManualAssignedBarcode() {
  const manualInp = document.getElementById('assignManualBarcodeInput');
  if (!manualInp) return;
  const val = manualInp.value.trim();
  if (!val) {
    if (typeof showToast === 'function') showToast('يرجى كتابة رقم الباركود أولاً', 'warning');
    return;
  }
  processBarcodeAssignment(val);
}

// المعالجة المركزية لربط الباركود وفحص منع التكرار
async function processBarcodeAssignment(scannedBarcode) {
  if (!assignTargetProduct) return;
  const cleanBarcode = scannedBarcode.trim();

  // فحص هل الباركود مطابق للباركود الحالي لنفس هذا الصنف؟
  if (assignTargetProduct.barcode && assignTargetProduct.barcode.trim().toLowerCase() === cleanBarcode.toLowerCase()) {
    playSuccessChime();
    if (typeof showToast === 'function') {
      showToast('هذا الباركود معرّف بالفعل لهذا الصنف مسبقاً ✅', 'info');
    }
    return;
  }

  // 1. فحص التكرار محلياً في قاعدة الأصناف state.products
  const products = (typeof state !== 'undefined' && state.products) ? state.products : [];
  const duplicate = products.find(p => 
    p.barcode && 
    p.barcode.trim().toLowerCase() === cleanBarcode.toLowerCase() && 
    p.id !== assignTargetProduct.id
  );

  // ⛔ في حال وجود تكرار: الرفض الصارم وإظهار كارت التنبيه الأحمر بالأرقام والأسماء
  if (duplicate) {
    stopLiveCameraScanner();
    playErrorBuzz();
    if (navigator.vibrate) navigator.vibrate([100, 60, 120]);

    // تعبئة تفاصيل الصنف المكرر
    const dupBox    = document.getElementById('barcodeDuplicateAlertBox');
    const dupCodeEl = document.getElementById('dupItemCode');
    const dupNameEl = document.getElementById('dupItemName');
    const dupBrandEl = document.getElementById('dupItemBrand');
    const dupBcEl   = document.getElementById('dupBarcodeVal');
    const goToBtn   = document.getElementById('btnGoToDupItem');

    if (dupCodeEl)  dupCodeEl.textContent  = `[${duplicate.code || 'بدون كود'}] (رقم المعرّف: ${duplicate.id})`;
    if (dupNameEl)  dupNameEl.textContent  = duplicate.name || 'بدون اسم';
    if (dupBrandEl) dupBrandEl.textContent = `${duplicate.brand || 'عام'} - ${duplicate.category || 'عام'}`;
    if (dupBcEl)    dupBcEl.textContent    = cleanBarcode;

    if (goToBtn) {
      goToBtn._dupProductId = duplicate.id;
      goToBtn.onclick = () => locateProductInInventory(duplicate.id);
    }

    // إخفاء الكاميرا وإظهار رسالة التكرار
    document.getElementById('assignScannerLiveWrapper').style.display = 'none';
    if (dupBox) dupBox.style.display = 'block';

    if (typeof showToast === 'function') {
      showToast(`⛔ مرفوض! هذا الباركود معرف مسبقاً للصنف: "${duplicate.name}"`, 'error');
    }
    return;
  }

  // 2. إذا لم يكن هناك تكرار: إرسال الطلب وحفظه في السيرفر وSupabase
  stopLiveCameraScanner();
  const successBox = document.getElementById('barcodeSuccessAlertBox');
  const successMsg = document.getElementById('barcodeSuccessMsgText');

  try {
    const res = await fetch(`/api/products/${assignTargetProduct.id}/barcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: cleanBarcode })
    });
    const data = await res.json();

    if (data.success) {
      // حفظ ناجح ✅
      playSuccessChime();
      if (navigator.vibrate) navigator.vibrate([40, 40, 80]);

      // تحديث الصنف محلياً في الـ state
      assignTargetProduct.barcode = cleanBarcode;
      const localProd = products.find(p => p.id === assignTargetProduct.id);
      if (localProd) localProd.barcode = cleanBarcode;

      // تحديث شارة الصنف بالنافذة
      const bcTagEl = document.getElementById('assignProdCurrentBarcodeText');
      if (bcTagEl) {
        bcTagEl.textContent = cleanBarcode;
        bcTagEl.className = 'current-bc-tag has-val';
      }

      // إظهار رسالة النجاح
      if (successMsg) {
        successMsg.innerHTML = `تم ربط الباركود <strong>(${escapeHtml(cleanBarcode)})</strong> بنجاح بالصنف: <br><strong>${escapeHtml(assignTargetProduct.name)}</strong>`;
      }
      if (successBox) successBox.style.display = 'flex';
      document.getElementById('assignScannerLiveWrapper').style.display = 'none';

      // تحديث قائمة الجرد إن كانت مفتوحة
      if (typeof renderInventoryList === 'function') {
        renderInventoryList();
      }

      if (typeof showToast === 'function') {
        showToast(`✅ تم ربط الباركود (${cleanBarcode}) بنجاح`, 'success');
      }

      // إغلاق النافذة تلقائياً بعد 1.8 ثانية
      setTimeout(closeAssignBarcodeModal, 1800);

    } else if (data.error === 'duplicate' && data.existingProduct) {
      // رفض من السيرفر بسبب التكرار
      playErrorBuzz();
      const dup = data.existingProduct;
      document.getElementById('dupItemCode').textContent  = `[${dup.code}] (معرّف: ${dup.id})`;
      document.getElementById('dupItemName').textContent  = dup.name;
      document.getElementById('dupItemBrand').textContent = `${dup.brand} - ${dup.category}`;
      document.getElementById('dupBarcodeVal').textContent= cleanBarcode;
      document.getElementById('assignScannerLiveWrapper').style.display = 'none';
      document.getElementById('barcodeDuplicateAlertBox').style.display = 'block';
    } else {
      playErrorBuzz();
      if (typeof showToast === 'function') {
        showToast(data.error || 'فشل حفظ الباركود', 'error');
      }
    }
  } catch (err) {
    playErrorBuzz();
    if (typeof showToast === 'function') {
      showToast('حدث خطأ أثناء الاتصال بالخادم لحفظ الباركود', 'error');
    }
  }
}

// الانتقال للصنف المكرر بالجرد
// ─────────────────────────────────────────────
// دالة مساعدة: الانتقال للصنف المكرر (تُستدعى من HTML بدون معامل)
// ─────────────────────────────────────────────
function locateDuplicateItemInInventory() {
  const btn = document.getElementById('btnGoToDupItem');
  if (btn && btn._dupProductId) {
    locateProductInInventory(btn._dupProductId);
    return;
  }
  // احتياطي: البحث عن الصنف بالباركود المكتوب
  const manualInp = document.getElementById('assignManualBarcodeInput');
  const scannedCode = (manualInp ? manualInp.value : '').trim();
  if (scannedCode && typeof state !== 'undefined' && state.products) {
    const dup = state.products.find(function(p) {
      return p.barcode && p.barcode.trim().toLowerCase() === scannedCode.toLowerCase() &&
        (!assignTargetProduct || p.id !== assignTargetProduct.id);
    });
    if (dup) { locateProductInInventory(dup.id); return; }
  }
  closeAssignBarcodeModal();
  if (typeof switchTab === 'function') switchTab('inventory');
}
function locateProductInInventory(productId) {
  closeAssignBarcodeModal();
  if (typeof switchTab === 'function') {
    switchTab('inventory');
  }

  setTimeout(() => {
    // تصفير البحث والفلتر
    if (typeof setInventoryQuickFilter === 'function') setInventoryQuickFilter('all');
    const searchInp = document.getElementById('inventorySearchInput');
    const targetProd = (typeof state !== 'undefined' && state.products) ? state.products.find(p => p.id === productId) : null;

    if (searchInp && targetProd) {
      searchInp.value = targetProd.code || targetProd.name;
      if (typeof handleInventorySearch === 'function') handleInventorySearch(searchInp.value);
    }

    // التمرير والتركيز بالوميض الذهبي
    setTimeout(() => {
      const card = document.getElementById(`invCard-${productId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('flash-highlight');
        setTimeout(() => card.classList.remove('flash-highlight'), 2500);
      }
    }, 350);
  }, 200);
}

// ─────────────────────────────────────────────
//  [9] النافذة العامة لمسح الباركود (للفاتورة والجرد)
// ─────────────────────────────────────────────
let universalScannerMode = 'invoice'; // 'invoice' | 'inventory'

function openUniversalBarcodeScanner(mode = 'invoice') {
  universalScannerMode = mode;
  const modal = document.getElementById('appBarcodeScannerModal');
  if (!modal) return;

  const titleEl = document.getElementById('universalScannerTitle');
  const subEl   = document.getElementById('universalScannerSubtitle');
  const resBox  = document.getElementById('universalScanResultBox');
  const inpEl   = document.getElementById('universalManualBarcodeInput');

  if (resBox) resBox.style.display = 'none';
  if (inpEl) inpEl.value = '';

  if (mode === 'inventory') {
    if (titleEl) titleEl.textContent = '🔍 مسح باركود للبحث السريع في الجرد';
    if (subEl)   subEl.textContent   = 'وجّه الكاميرا نحو باركود الصنف للوصول إليه مباشرة في المخزن';
  } else {
    if (titleEl) titleEl.textContent = '📷 مسح الباركود لإضافته للفاتورة';
    if (subEl)   subEl.textContent   = 'وجّه الكاميرا نحو باركود الصنف وسيُضاف تلقائياً للفاتورة الحالية';
  }

  document.body.style.overflow = 'hidden';
  modal.style.display = 'flex';
  modal.classList.add('active');
  setTimeout(() => startLiveCameraScanner('universal'), 80);
}

function openInventoryBarcodeSearchModal() {
  openUniversalBarcodeScanner('inventory');
}

function closeUniversalBarcodeScanner() {
  stopLiveCameraScanner();
  const modal = document.getElementById('appBarcodeScannerModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  document.body.style.overflow = '';
}

function executeUniversalBarcodeScan(barcode) {
  if (!barcode || !barcode.trim()) return;
  onBarcodeDecoded(barcode.trim(), 'universal');
}

// عند نجاح أي مسح باركود (من الكاميرا الحية المباشرة أو الإدخال اليدوي)
function onBarcodeDecoded(decodedText, context) {
  const code = (decodedText || '').trim();
  if (!code) return;

  if (context === 'batch') {
    handleBatchDetectedBarcode(code);
    return;
  }

  if (context === 'assign') {
    processBarcodeAssignment(code);
    return;
  }

  // Universal Scanner (فاتورة أو جرد)
  stopLiveCameraScanner();
  playSuccessChime();
  if (navigator.vibrate) navigator.vibrate([40, 30, 80]);

  const products = (typeof state !== 'undefined' && state.products) ? state.products : [];
  // البحث بالكود أو الباركود المسجل
  const found = products.find(p => 
    (p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()) ||
    (p.code && p.code.trim().toLowerCase() === code.toLowerCase())
  );

  const resBox  = document.getElementById('universalScanResultBox');
  const resCode = document.getElementById('universalScanResultCode');
  const resProd = document.getElementById('universalScanResultProduct');

  if (found) {
    if (resBox) {
      resBox.style.display = 'block';
      resBox.style.background = '#ecfdf5';
      resBox.style.border = '1.5px solid #86efac';
    }
    if (resCode) resCode.textContent = `[${code}]`;
    if (resProd) resProd.textContent = `✅ عثر على: ${found.name}`;

    if (universalScannerMode === 'invoice') {
      // إضافة للفاتورة
      if (typeof addToCart === 'function') {
        addToCart(found.id);
      }
      if (typeof showToast === 'function') {
        showToast(`✅ تمت إضافة "${found.name}" للفاتورة بنجاح`, 'success');
      }
      setTimeout(closeUniversalBarcodeScanner, 1400);

    } else if (universalScannerMode === 'inventory') {
      // الانتقال للصنف بالجرد
      closeUniversalBarcodeScanner();
      locateProductInInventory(found.id);
      if (typeof showToast === 'function') {
        showToast(`🔍 تم العثور على الصنف: ${found.name}`, 'info');
      }
    }

  } else {
    // لم يتم العثور على صنف
    playErrorBuzz();
    if (resBox) {
      resBox.style.display = 'block';
      resBox.style.background = '#fef2f2';
      resBox.style.border = '1.5px solid #fca5a5';
    }
    if (resCode) resCode.textContent = `[${code}]`;
    if (resProd) {
      resProd.innerHTML = `
        <span style="color:#dc2626;">❌ هذا الباركود غير مسجل لأي صنف في النظام</span>
        <div style="font-size:0.78rem; color:#64748b; margin-top:0.35rem;">
          يمكنك تعريفه بسهولة بالذهاب للجرد والضغط على "إضافة باركود" بجانب الصنف
        </div>
      `;
    }

    // إعادة فتح الكاميرا بعد ثانيتين
    setTimeout(() => {
      startLiveCameraScanner('universal');
    }, 2200);
  }
}

// ─────────────────────────────────────────────
//  [10] مستمعي الأحداث العامة
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSecuritySettingsForm();
});

// إيقاف الكاميرا تلقائياً عند مغادرة الصفحة أو إخفائها (تحرير الموارد وعدم تشغيل الكاميرا في الخلفية)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && isScanningActive) {
    stopLiveCameraScanner();
  }
});

window.addEventListener('beforeunload', () => {
  if (liveScannerStream) {
    try { liveScannerStream.getTracks().forEach(t => t.stop()); } catch(e) {}
  }
});

window.addEventListener('pagehide', () => {
  stopLiveCameraScanner();
});

// دعم لوحة المفاتيح لشاشة القفل
document.addEventListener('keydown', (e) => {
  const screen = document.getElementById('pinLockScreen');
  if (!screen || screen.style.display === 'none') return;

  if (e.key >= '0' && e.key <= '9') {
    pinKeyPress(e.key);
  } else if (e.key === 'Backspace') {
    pinKeyDelete();
  } else if (e.key === 'Enter') {
    if (pinBuffer.length === 4) verifyEnteredPin();
  }
});

// ─────────────────────────────────────────────
//  [11] نظام تسجيل باركود المنتجات الذكي والشامل (Batch Registration)
// ─────────────────────────────────────────────
let batchSessionStats = {
  success: 0,
  skipped: 0,
  conflict: 0,
  failed: 0
};
let batchCurrentDetectedBarcode = null;
let batchSelectedProduct = null;
let batchLastProcessedBarcode = null;
let batchLastScanTimestamp = 0;
let isBatchScannerPaused = false;
let batchSearchDebounceTimer = null;

function updateBatchStatsUI() {
  const sEl = document.getElementById('batchStatSuccess');
  const kEl = document.getElementById('batchStatSkipped');
  const cEl = document.getElementById('batchStatConflict');
  const fEl = document.getElementById('batchStatFailed');
  if (sEl) sEl.textContent = batchSessionStats.success;
  if (kEl) kEl.textContent = batchSessionStats.skipped;
  if (cEl) cEl.textContent = batchSessionStats.conflict;
  if (fEl) fEl.textContent = batchSessionStats.failed;
}

function resetBatchSessionStats() {
  batchSessionStats = { success: 0, skipped: 0, conflict: 0, failed: 0 };
  updateBatchStatsUI();
  if (typeof showToast === 'function') {
    showToast('تم تصفير إحصائيات الجلسة 🔄', 'info');
  }
}

function openBatchBarcodeRegistrationModal() {
  const modal = document.getElementById('batchBarcodeRegistrationModal');
  if (!modal) return;

  clearBatchItemState();
  updateBatchStatsUI();

  // تجميد تمرير الصفحة الخلفية فوراً لمنع تحرك المحتوى
  document.body.style.overflow = 'hidden';

  modal.style.display = 'flex';
  modal.classList.add('active');
  isBatchScannerPaused = false;

  const iconEl = document.getElementById('btnBatchToggleCameraIcon');
  const textEl = document.getElementById('btnBatchToggleCameraText');
  const badgeEl = document.getElementById('batchScannerBadge');
  const badgeText = document.getElementById('batchScannerBadgeText');
  if (iconEl) iconEl.textContent = '⏸️';
  if (textEl) textEl.textContent = 'إيقاف الكاميرا';
  if (badgeEl) badgeEl.style.opacity = '1';
  if (badgeText) badgeText.textContent = 'ماسح ذكي نشط';

  // بدء تشغيل كاميرا الموقع الحية المباشرة
  setTimeout(() => startLiveCameraScanner('batch'), 80);
}

function closeBatchBarcodeModal() {
  stopLiveCameraScanner();
  const modal = document.getElementById('batchBarcodeRegistrationModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
  // استعادة التمرير الطبيعي للصفحة
  document.body.style.overflow = '';
  clearBatchItemState();
}

function clearBatchItemState() {
  batchCurrentDetectedBarcode = null;
  batchSelectedProduct = null;
  batchLastProcessedBarcode = null;

  const codeEl = document.getElementById('batchDetectedCodeVal');
  const badgeEl = document.getElementById('batchDetectedStatusBadge');
  const hintEl = document.getElementById('batchDetectedHint');
  const copyBtn = document.getElementById('btnBatchCopyCode');
  const alertBox = document.getElementById('batchAlertBox');
  const searchInp = document.getElementById('batchSearchInput');
  const resultsDiv = document.getElementById('batchSearchResults');
  const selCard = document.getElementById('batchSelectedProduct');
  const saveBtn = document.getElementById('btnBatchConfirmSave');

  if (codeEl) codeEl.textContent = 'لم يتم مسح أي باركود بعد';
  if (badgeEl) {
    badgeEl.textContent = 'بانتظار توجيه الكاميرا...';
    badgeEl.className = 'detected-status-badge status-waiting';
  }
  if (hintEl) hintEl.textContent = 'وجّه الكاميرا نحو باركود الصنف ليتم التعرف عليه تلقائياً ومباشرة';
  if (copyBtn) copyBtn.style.display = 'none';
  if (alertBox) {
    alertBox.style.display = 'none';
    alertBox.innerHTML = '';
  }
  if (searchInp) searchInp.value = '';
  if (resultsDiv) {
    resultsDiv.style.display = 'none';
    resultsDiv.innerHTML = '';
  }
  if (selCard) selCard.style.display = 'none';
  if (saveBtn) saveBtn.disabled = true;
}

// معالجة الباركود المكتشف من كاميرا الـ Batch
async function handleBatchDetectedBarcode(rawBarcode) {
  const barcode = String(rawBarcode || '').trim();
  if (!barcode) return;

  const now = performance.now();
  // منع المعالجة المتكررة لنفس الكود خلال 2.5 ثانية إذا كان لا يزال أمام الكاميرا
  if (barcode === batchLastProcessedBarcode && (now - batchLastScanTimestamp < 2500)) {
    return;
  }

  batchLastProcessedBarcode = barcode;
  batchLastScanTimestamp = now;
  batchCurrentDetectedBarcode = barcode;

  playSuccessChime();
  if (navigator.vibrate) navigator.vibrate([35, 45]);

  // تحديث كارت الباركود المكتشف
  const codeEl = document.getElementById('batchDetectedCodeVal');
  const badgeEl = document.getElementById('batchDetectedStatusBadge');
  const copyBtn = document.getElementById('btnBatchCopyCode');
  const alertBox = document.getElementById('batchAlertBox');
  const hintEl = document.getElementById('batchDetectedHint');
  const saveBtn = document.getElementById('btnBatchConfirmSave');

  if (codeEl) codeEl.textContent = barcode;
  if (copyBtn) copyBtn.style.display = 'inline-flex';

  // البحث عن الباركود في قاعدة بيانات المنتجات
  const products = (typeof state !== 'undefined' && state.products) ? state.products : [];
  const existingOwner = products.find(p => 
    p.barcode && String(p.barcode).trim().toLowerCase() === barcode.toLowerCase()
  );

  if (existingOwner) {
    // الحالة الأولى: الباركود مسجل مسبقاً في الموقع
    if (badgeEl) {
      badgeEl.textContent = '✅ مسجل مسبقاً';
      badgeEl.className = 'detected-status-badge status-registered';
    }
    if (hintEl) {
      hintEl.textContent = `هذا الباركود معرف مسبقاً للصنف: ${existingOwner.name}`;
    }

    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.innerHTML = `
        <div style="background:#eff6ff; border:1.5px solid #3b82f6; border-radius:12px; padding:0.85rem; color:#1e3a8a;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <strong style="font-size:0.92rem;">ℹ️ الباركود مسجل مسبقاً لهذا الصنف:</strong>
            <span class="badge badge-code">[${existingOwner.code || 'PRD'}]</span>
          </div>
          <div style="font-size:0.95rem; font-weight:800; margin-bottom:0.25rem;">${escapeHtml(existingOwner.name)}</div>
          <div style="font-size:0.78rem; color:#475569; margin-bottom:0.6rem;">
            الماركة: ${escapeHtml(existingOwner.brand || 'عام')} • القسم: ${escapeHtml(existingOwner.category || 'عام')}
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="locateProductInInventory('${existingOwner.id}'); closeBatchBarcodeModal();">
              <span>🔍</span>
              <span>عرض في المخزون</span>
            </button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="skipCurrentBatchBarcode()">
              <span>⏭️</span>
              <span>تخطي والانتقال للتالي</span>
            </button>
          </div>
        </div>
      `;
    }

    if (saveBtn) saveBtn.disabled = true;

  } else {
    // الحالة الثانية: الباركود جديد وغير مسجل
    if (badgeEl) {
      badgeEl.textContent = '🆕 باركود جديد';
      badgeEl.className = 'detected-status-badge status-new';
    }
    if (hintEl) {
      hintEl.textContent = 'باركود جديد غير مسجل. اختر الصنف المناسب من الأسفل لتأكيد ربطه به.';
    }

    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.innerHTML = `
        <div style="background:#ecfdf5; border:1.5px solid #10b981; border-radius:12px; padding:0.65rem 0.85rem; color:#065f46; font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
          <span style="font-size:1.15rem;">✨</span>
          <span>باركود جديد جاهز للربط! ابحث عن الصنف بالأسفل واضغط تأكيد الحفظ</span>
        </div>
      `;
    }

    const searchInp = document.getElementById('batchSearchInput');
    if (searchInp) searchInp.focus();

    if (batchSelectedProduct) {
      if (saveBtn) saveBtn.disabled = false;
    } else {
      if (saveBtn) saveBtn.disabled = true;
    }
  }

  // الحفاظ على استمرار عمل الماسح
  isScanningActive = true;
  const videoEl = document.getElementById('batchScannerVideo');
  if (videoEl && liveScannerStream) {
    startBarcodeDetectionLoop(videoEl, 'batch');
  }
}

// البحث الفوري في المنتجات لربطها بالباركود
function handleBatchProductSearchInput(rawQuery) {
  const query = (rawQuery || '').trim().toLowerCase();
  const resultsContainer = document.getElementById('batchSearchResults');
  const spinner = document.getElementById('batchSearchSpinner');
  if (!resultsContainer) return;

  if (batchSearchDebounceTimer) clearTimeout(batchSearchDebounceTimer);

  if (!query) {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
    return;
  }

  if (spinner) spinner.style.display = 'inline-block';

  batchSearchDebounceTimer = setTimeout(() => {
    if (spinner) spinner.style.display = 'none';
    const products = (typeof state !== 'undefined' && state.products) ? state.products : [];

    const matches = products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const code = (p.code || '').toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(query) || code.includes(query) || brand.includes(query) || barcode.includes(query);
    }).slice(0, 15);

    if (matches.length === 0) {
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = `
        <div style="padding:0.75rem; text-align:center; color:#94a3b8; font-size:0.82rem;">
          لم يتم العثور على أي صنف يطابق "${escapeHtml(query)}"
        </div>
      `;
      return;
    }

    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = matches.map(p => `
      <div class="search-res-item" onclick="selectBatchProductForLink('${p.id}')">
        <div class="search-res-info">
          <span class="search-res-name">${escapeHtml(p.name)}</span>
          <span class="search-res-meta">
            كود: [${escapeHtml(p.code || 'PRD')}] • ماركة: ${escapeHtml(p.brand || 'عام')}
            ${p.barcode ? `• باركود: <b style="color:#059669;">${escapeHtml(p.barcode)}</b>` : '• <span style="color:#f59e0b;">(بدون باركود)</span>'}
          </span>
        </div>
        <button type="button" class="btn btn-xs btn-outline-primary" style="font-weight:700;">اختيار</button>
      </div>
    `).join('');
  }, 120);
}

function selectBatchProductForLink(productId) {
  const products = (typeof state !== 'undefined' && state.products) ? state.products : [];
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  batchSelectedProduct = prod;

  const resultsContainer = document.getElementById('batchSearchResults');
  if (resultsContainer) resultsContainer.style.display = 'none';

  const selCard = document.getElementById('batchSelectedProduct');
  const imgEl   = document.getElementById('batchSelProdImg');
  const nameEl  = document.getElementById('batchSelProdName');
  const codeEl  = document.getElementById('batchSelProdCode');
  const metaEl  = document.getElementById('batchSelProdMeta');
  const bcTagEl = document.getElementById('batchSelProdBcTag');

  if (imgEl)   imgEl.src = prod.image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80';
  if (nameEl)  nameEl.textContent = prod.name || 'بدون اسم';
  if (codeEl)  codeEl.textContent = prod.code || 'PRD';
  if (metaEl)  metaEl.textContent = `${prod.brand || 'عام'} • ${prod.category || 'عام'}`;
  if (bcTagEl) {
    if (prod.barcode) {
      bcTagEl.textContent = prod.barcode;
      bcTagEl.style.color = '#059669';
    } else {
      bcTagEl.textContent = 'لا يوجد';
      bcTagEl.style.color = '#d97706';
    }
  }

  if (selCard) selCard.style.display = 'block';

  // التحقق من تعارض محتمل إذا كان الباركود مسجلاً لصنف آخر
  if (batchCurrentDetectedBarcode) {
    const existingOwner = products.find(p => 
      p.barcode && String(p.barcode).trim().toLowerCase() === batchCurrentDetectedBarcode.toLowerCase()
    );

    if (existingOwner && existingOwner.id !== prod.id) {
      batchSessionStats.conflict++;
      updateBatchStatsUI();
      playErrorBuzz();

      const alertBox = document.getElementById('batchAlertBox');
      const badgeEl = document.getElementById('batchDetectedStatusBadge');
      if (badgeEl) {
        badgeEl.textContent = '⛔ باركود متعارض';
        badgeEl.className = 'detected-status-badge status-conflict';
      }

      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = `
          <div style="background:#fef2f2; border:2px solid #ef4444; border-radius:12px; padding:0.85rem; color:#991b1b;">
            <div style="font-weight:800; font-size:0.95rem; margin-bottom:0.35rem;">⛔ تحذير تعارض في الباركود!</div>
            <p style="font-size:0.82rem; margin:0 0 0.6rem 0; line-height:1.4;">
              هذا الباركود <strong>(${escapeHtml(batchCurrentDetectedBarcode)})</strong> مرتبط حالياً بالصنف: 
              <br><strong>[${escapeHtml(existingOwner.code || 'PRD')}] ${escapeHtml(existingOwner.name)}</strong>
              <br>ولا يمكن ربطه بالصنف الجديد بصمت دون موافقة صريحة.
            </p>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-sm btn-danger" onclick="executeBatchBarcodeReassign('${existingOwner.id}', '${prod.id}', '${escapeHtml(batchCurrentDetectedBarcode)}')" style="font-weight:700;">
                <span>⚠️</span>
                <span>نقل وتصحيح الباركود للصنف المختار</span>
              </button>
              <button type="button" class="btn btn-sm btn-secondary" onclick="skipCurrentBatchBarcode()">
                <span>⏭️</span>
                <span>تخطي وعدم التغيير</span>
              </button>
            </div>
          </div>
        `;
      }

      const saveBtn = document.getElementById('btnBatchConfirmSave');
      if (saveBtn) saveBtn.disabled = true;
      return;
    }
  }

  const saveBtn = document.getElementById('btnBatchConfirmSave');
  if (saveBtn && batchCurrentDetectedBarcode) {
    saveBtn.disabled = false;
  }
}

function clearBatchSelectedProduct() {
  batchSelectedProduct = null;
  const selCard = document.getElementById('batchSelectedProduct');
  if (selCard) selCard.style.display = 'none';

  const saveBtn = document.getElementById('btnBatchConfirmSave');
  if (saveBtn) saveBtn.disabled = true;
}

// تأكيد وحفظ الباركود للصنف المختار
async function confirmBatchBarcodeAssignment() {
  if (!batchCurrentDetectedBarcode) {
    if (typeof showToast === 'function') showToast('يرجى مسح باركود أولاً', 'warning');
    return;
  }
  if (!batchSelectedProduct) {
    if (typeof showToast === 'function') showToast('يرجى اختيار الصنف المراد ربطه بالباركود', 'warning');
    return;
  }

  const barcodeToSave = String(batchCurrentDetectedBarcode).trim();
  const targetProdId = batchSelectedProduct.id;
  const targetProdName = batchSelectedProduct.name;

  const saveBtn = document.getElementById('btnBatchConfirmSave');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>⏳</span><span>جاري الحفظ والربط...</span>';
  }

  try {
    const res = await fetch(`/api/products/${targetProdId}/barcode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode: barcodeToSave })
    });
    const data = await res.json();

    if (data.success) {
      batchSessionStats.success++;
      updateBatchStatsUI();
      playSuccessChime();
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);

      // تحديث الصنف محلياً في الـ state
      const products = (typeof state !== 'undefined' && state.products) ? state.products : [];
      const localProd = products.find(p => p.id === targetProdId);
      if (localProd) localProd.barcode = barcodeToSave;

      if (typeof renderInventoryList === 'function') {
        renderInventoryList();
      }

      if (typeof showToast === 'function') {
        showToast(`✅ تم ربط الباركود (${barcodeToSave}) بالصنف: "${targetProdName}" بنجاح`, 'success');
      }

      clearBatchItemState();

      const alertBox = document.getElementById('batchAlertBox');
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.innerHTML = `
          <div style="background:#ecfdf5; border:1.5px solid #10b981; border-radius:12px; padding:0.75rem; color:#065f46; font-size:0.86rem; font-weight:700;">
            ✅ تم حفظ وربط الباركود (${escapeHtml(barcodeToSave)}) بنجاح!
            <div style="font-size:0.78rem; color:#047857; margin-top:2px;">الماسح نشط وتلقائي — وجّه الكاميرا للصنف التالي فوراً</div>
          </div>
        `;
      }

      resumeBatchScannerLoop();

    } else if (data.error === 'duplicate') {
      batchSessionStats.conflict++;
      updateBatchStatsUI();
      playErrorBuzz();
      if (typeof showToast === 'function') {
        showToast(`⛔ تعارض: الباركود مسجل مسبقاً لصنف آخر`, 'error');
      }
    } else {
      batchSessionStats.failed++;
      updateBatchStatsUI();
      playErrorBuzz();
      if (typeof showToast === 'function') {
        showToast(data.error || 'فشل حفظ الباركود', 'error');
      }
    }
  } catch (err) {
    batchSessionStats.failed++;
    updateBatchStatsUI();
    playErrorBuzz();
    console.error('Batch confirm error:', err);
    if (typeof showToast === 'function') {
      showToast('تعذر الاتصال بالخادم لحفظ الباركود', 'error');
    }
  } finally {
    if (saveBtn) {
      saveBtn.innerHTML = '<span>💾</span><span>تأكيد وحفظ الباركود</span>';
    }
  }
}

// تنفيذ نقل وتصحيح الباركود للصنف المختار (حالة التعارض)
async function executeBatchBarcodeReassign(oldOwnerId, newOwnerId, barcode) {
  try {
    const res = await fetch('/api/barcodes/reassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barcode: barcode,
        targetProductId: newOwnerId
      })
    });
    const data = await res.json();

    if (data.success) {
      batchSessionStats.success++;
      updateBatchStatsUI();
      playSuccessChime();

      const products = (typeof state !== 'undefined' && state.products) ? state.products : [];
      const oldP = products.find(p => p.id === oldOwnerId);
      if (oldP) oldP.barcode = '';
      const newP = products.find(p => p.id === newOwnerId);
      if (newP) newP.barcode = barcode;

      if (typeof renderInventoryList === 'function') renderInventoryList();

      if (typeof showToast === 'function') {
        showToast(`✅ تم نقل وتصحيح الباركود بنجاح`, 'success');
      }

      clearBatchItemState();
      resumeBatchScannerLoop();

    } else {
      playErrorBuzz();
      if (typeof showToast === 'function') {
        showToast(data.error || 'فشل نقل الباركود', 'error');
      }
    }
  } catch (e) {
    playErrorBuzz();
    console.error('Reassign error:', e);
  }
}

// تخطي الباركود الحالي والانتقال للصنف التالي
function skipCurrentBatchBarcode() {
  batchSessionStats.skipped++;
  updateBatchStatsUI();

  clearBatchItemState();

  if (typeof showToast === 'function') {
    showToast('تم التخطي ⏭️ وجّه الكاميرا للصنف التالي', 'info');
  }

  resumeBatchScannerLoop();
}

function resumeBatchScannerLoop() {
  isScanningActive = true;
  batchCurrentDetectedBarcode = null;
  startScannerGuidanceTimer('batch');
}

// تبديل إيقاف / استئناف المسح
function toggleBatchScannerActive() {
  isBatchScannerPaused = !isBatchScannerPaused;
  const iconEl = document.getElementById('btnBatchToggleCameraIcon');
  const textEl = document.getElementById('btnBatchToggleCameraText');
  const badgeEl = document.getElementById('batchScannerBadge');
  const badgeText = document.getElementById('batchScannerBadgeText');

  if (isBatchScannerPaused) {
    stopLiveCameraScanner();
    if (iconEl) iconEl.textContent = '▶️';
    if (textEl) textEl.textContent = 'تشغيل الكاميرا';
    if (badgeEl) badgeEl.style.opacity = '0.5';
    if (badgeText) badgeText.textContent = 'الكاميرا متوقفة مؤقتاً';
  } else {
    startLiveCameraScanner('batch');
    if (iconEl) iconEl.textContent = '⏸️';
    if (textEl) textEl.textContent = 'إيقاف الكاميرا';
    if (badgeEl) badgeEl.style.opacity = '1';
    if (badgeText) badgeText.textContent = 'ماسح ذكي نشط';
  }
}

function copyBatchDetectedBarcode() {
  if (!batchCurrentDetectedBarcode) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(batchCurrentDetectedBarcode).then(() => {
      if (typeof showToast === 'function') showToast(`تم نسخ الباركود: ${batchCurrentDetectedBarcode}`, 'info');
    });
  }
}





