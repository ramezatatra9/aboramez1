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
  { id: 'u-admin',   name: 'المدير العام (أبو رامز)', pin: '1234', role: 'admin' },
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
  if (role === 'admin') {
    if (hintText) hintText.textContent = 'أدخل الرمز السري للمدير العام للدخول';
    if (hintIcon) hintIcon.textContent = '👑';
  } else {
    if (hintText) hintText.textContent = 'أدخل الرمز السري لموظف المبيعات للدخول';
    if (hintIcon) hintIcon.textContent = '💼';
  }

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
  if (hintText) hintText.style.color = '';
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
    if (hintText) {
      hintText.textContent = 'رمز PIN غير صحيح! حاول مرة أخرى';
      hintText.style.color = '#ef4444';
    }

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
    { id: 'u-admin',   name: 'المدير العام (أبو رامز)', pin: adminPin,   role: 'admin' },
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
//  [6] محرك الكاميرا ومسح الباركود الموثوق المباشر
// ─────────────────────────────────────────────
let activeStream = null;
let currentCameraFacing = 'environment';
let barcodeDetectorInstance = null;
let html5QrInstance = null;
let currentActiveScannerContext = null; // 'assign' | 'universal'

// فحص توفر BarcodeDetector المدمج
function getNativeBarcodeDetector() {
  if (!barcodeDetectorInstance && ('BarcodeDetector' in window)) {
    try {
      barcodeDetectorInstance = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']
      });
    } catch (e) {
      barcodeDetectorInstance = null;
    }
  }
  return barcodeDetectorInstance;
}

// تشغيل الكاميرا الحية فوراً بدون تأخير
async function startLiveCameraScanner(context) {
  currentActiveScannerContext = context;
  stopLiveCameraScanner();

  const qrContainerId = context === 'assign' ? 'assignScannerQrContainer' : 'universalScannerQrContainer';
  const qrContainer = document.getElementById(qrContainerId);
  if (!qrContainer) return;

  qrContainer.innerHTML = '';
  qrContainer.style.display = 'block';

  if (typeof Html5Qrcode === 'undefined') {
    showCameraPermissionNotice(context, 'جاري تحميل محرك الكاميرا...');
    return;
  }

  try {
    html5QrInstance = new Html5Qrcode(qrContainerId);

    const config = {
      fps: 15,
      qrbox: { width: 250, height: 140 },
      aspectRatio: 1.33
    };

    // 1. المحاولة الأولى: طلب الكاميرا الخلفية عبر facingMode
    try {
      await html5QrInstance.start(
        { facingMode: currentCameraFacing },
        config,
        (decodedText) => onBarcodeDecoded(decodedText, context),
        () => {}
      );
      return;
    } catch (facingErr) {
      console.warn('facingMode start failed, trying available cameras list:', facingErr);
    }

    // 2. المحاولة الثانية: جلب قائمة الكاميرات واختيار الكاميرا الخلفية يدوياً
    const cameras = await Html5Qrcode.getCameras();
    if (cameras && cameras.length > 0) {
      const backCam = cameras.find(c => {
        const lbl = (c.label || '').toLowerCase();
        return lbl.includes('back') || lbl.includes('rear') || lbl.includes('environment') || lbl.includes('خلف');
      });
      const selectedCamId = backCam ? backCam.id : cameras[cameras.length - 1].id;

      await html5QrInstance.start(
        selectedCamId,
        config,
        (decodedText) => onBarcodeDecoded(decodedText, context),
        () => {}
      );
      return;
    }
  } catch (err) {
    console.error('Camera open failed completely:', err);
    showCameraPermissionNotice(context, err.message || 'يرجى السماح بالوصول للكاميرا');
  }
}

// إيقاف الكاميرا وتفريغ الموارد
function stopLiveCameraScanner() {
  if (html5QrInstance) {
    try {
      html5QrInstance.stop().then(() => {
        try { html5QrInstance.clear(); } catch(e) {}
        html5QrInstance = null;
      }).catch(() => {
        html5QrInstance = null;
      });
    } catch (e) {
      html5QrInstance = null;
    }
  }
}

// تبديل الكاميرا (أمامية / خلفية)
function toggleScannerCameraDevice(context) {
  currentCameraFacing = currentCameraFacing === 'environment' ? 'user' : 'environment';
  startLiveCameraScanner(context);
  if (navigator.vibrate) navigator.vibrate(20);
}

// تشغيل فلاش الكاميرا (Torch) إن وجد
async function toggleScannerTorch(context) {
  if (html5QrInstance) {
    try {
      await html5QrInstance.applyVideoConstraints({
        advanced: [{ torch: true }]
      });
    } catch (e) {}
  }
}

// ─────────────────────────────────────────────
//  [7] المنقذ الموثوق 100%: التقاط صورة بالباركود بكاميرا الهاتف الأصلية
// ─────────────────────────────────────────────
async function handleNativeBarcodePhoto(inputEl, context) {
  if (!inputEl || !inputEl.files || inputEl.files.length === 0) return;
  const file = inputEl.files[0];

  if (typeof showToast === 'function') {
    showToast('جاري قراءة الباركود من الصورة الملتقطة...', 'info');
  }

  // 1. تجربة BarcodeDetector المدمج فائق السرعة
  const detector = getNativeBarcodeDetector();
  if (detector && window.createImageBitmap) {
    try {
      const bitmap = await createImageBitmap(file);
      const barcodes = await detector.detect(bitmap);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        onBarcodeDecoded(barcodes[0].rawValue.trim(), context);
        inputEl.value = '';
        return;
      }
    } catch (e) {
      console.warn('Native photo detect failed:', e);
    }
  }

  // 2. تجربة Html5Qrcode.scanFile
  if (typeof Html5Qrcode !== 'undefined') {
    try {
      const qrContainerId = context === 'assign' ? 'assignScannerQrContainer' : 'universalScannerQrContainer';
      let scanInstance = html5QrInstance || new Html5Qrcode(qrContainerId);
      const text = await scanInstance.scanFile(file, true);
      if (text && text.trim()) {
        onBarcodeDecoded(text.trim(), context);
        inputEl.value = '';
        return;
      }
    } catch (e) {
      console.warn('Html5Qrcode scanFile failed:', e);
    }
  }

  // إذا لم يتم العثور على باركود في الصورة
  playErrorBuzz();
  if (typeof showToast === 'function') {
    showToast('لم يتم العثور على باركود واضح في الصورة، يرجى إعادة التصوير بوضوح أو إدخال الرقم يدوياً', 'warning');
  }
  inputEl.value = '';
}

function showCameraPermissionNotice(context, errMsg) {
  const containerId = context === 'assign' ? 'assignScannerQrContainer' : 'universalScannerQrContainer';
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div style="padding:1.5rem 1rem; text-align:center; color:#ffffff; background:#0f172a; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <span style="font-size:2.5rem; margin-bottom:0.4rem;">📷</span>
        <strong style="font-size:0.98rem; margin-bottom:0.35rem; color:#f87171;">الكاميرا بحاجة لإذن المتصفح</strong>
        <p style="font-size:0.8rem; color:#94a3b8; margin-bottom:1rem; max-width:250px; line-height:1.4;">
          تأكد من السماح بصلاحية الكاميرا في Chrome أو اضغط زر "تصوير الباركود" الأصفر أدناه
        </p>
        <button type="button" class="btn btn-sm btn-primary" onclick="startLiveCameraScanner('${context}')" style="font-weight:700;">
          <span>🔄</span>
          <span>إعادة محاولة تشغيل الكاميرا</span>
        </button>
      </div>
    `;
  }
}

// ─────────────────────────────────────────────
//  [8] نافذة تعريف باركود لصنف بالجرد (مع فحص ومنع التكرار الصارم)
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

  modal.style.display = 'flex';

  // تشغيل الكاميرا فوراً في نفس سياق النقر
  startLiveCameraScanner('assign');
}

function closeAssignBarcodeModal() {
  stopLiveCameraScanner();
  const modal = document.getElementById('assignBarcodeModal');
  if (modal) modal.style.display = 'none';
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

  modal.style.display = 'flex';

  // تشغيل الكاميرا فوراً في نفس سياق النقر
  startLiveCameraScanner('universal');
}

function openInventoryBarcodeSearchModal() {
  openUniversalBarcodeScanner('inventory');
}

function closeUniversalBarcodeScanner() {
  stopLiveCameraScanner();
  const modal = document.getElementById('appBarcodeScannerModal');
  if (modal) modal.style.display = 'none';
}

function executeUniversalBarcodeScan(barcode) {
  if (!barcode || !barcode.trim()) return;
  onBarcodeDecoded(barcode.trim(), 'universal');
}

// عند نجاح أي مسح باركود (من الكاميرا الحية أو تصوير الصورة أو الإدخال)
function onBarcodeDecoded(decodedText, context) {
  const code = (decodedText || '').trim();
  if (!code) return;

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
