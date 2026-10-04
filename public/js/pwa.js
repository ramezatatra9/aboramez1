/**
 * pwa.js - إدارة تثبيت وتشغيل تطبيق الويب التقدمي (PWA)
 * نظام شركة أبو رامز للمبيعات والجرد
 */

(function () {
  let deferredPrompt = null;
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  // تسجيل الـ Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('✅ [PWA] Service Worker مسجل بنجاح بنطاق:', reg.scope);

          // فحص التحديثات
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showPwaUpdateToast();
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('⚠️ [PWA] تعذر تسجيل Service Worker:', err.message);
        });
    });
  }

  // الاستماع لحدث جاهزية التثبيت (Android / Chrome / Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    // منع المتصفح من إظهار النافذة الافتراضية
    e.preventDefault();
    deferredPrompt = e;

    // إظهار زر التثبيت الأنيق في الترويسة العلوية فقط دون أي إشعار عائم على الشاشة
    const headerInstallBtn = document.getElementById('headerPwaInstallBtn');
    if (headerInstallBtn && !isInStandaloneMode) {
      headerInstallBtn.style.display = 'inline-flex';
    }
  });

  // حدث اكتمال التثبيت بنجاح
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const headerInstallBtn = document.getElementById('headerPwaInstallBtn');
    if (headerInstallBtn) headerInstallBtn.style.display = 'none';
    showPwaToast('🎉 تم تثبيت تطبيق أبو رامز بنجاح على جهازك!');
  });

  // تنفيذ عملية التثبيت عند الضغط
  window.promptPwaInstall = function () {
    if (deferredPrompt) {
      promptInstall();
    } else if (isIos && !isInStandaloneMode) {
      showIosInstallModal();
    } else {
      showPwaToast('التطبيق مثبت بالفعل أو يمكنك إضافته من قائمة المتصفح.');
    }
  };

  async function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] نتيجة اختيار المستخدم:', outcome);
    deferredPrompt = null;
    hideInstallBanner();
  }

  // نافذة إرشادية لمستخدمي iPhone و iPad
  function showIosInstallModal() {
    let modal = document.getElementById('pwaIosModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pwaIosModal';
      modal.className = 'modal-backdrop active';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 440px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">📱</div>
          <h3 style="margin-bottom: 0.5rem; font-weight: 800;">تثبيت التطبيق على iPhone / iPad</h3>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.25rem;">
            يمكنك تثبيت تطبيق شركة أبو رامز على شاشة هاتفك بسهولة عبر متصفح Safari باتباع خطوتين:
          </p>
          <div style="background: var(--bg-alt); padding: 1rem; border-radius: 12px; text-align: right; margin-bottom: 1.5rem; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.75rem;">
              <span style="background: var(--primary); color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">1</span>
              <span>اضغط على زر المشاركة <strong>(Share ⎋)</strong> أسفل الشاشة.</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: var(--primary); color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">2</span>
              <span>مرر للأسفل واختر <strong>«إضافة إلى الشاشة الرئيسية ➕»</strong>.</span>
            </div>
          </div>
          <button class="btn btn-primary" style="width: 100%;" onclick="document.getElementById('pwaIosModal').remove()">فهمت، شكراً</button>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }

  // إشعار بسيط (Toast)
  function showPwaToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'pwa-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('visible');
    }, 100);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // تنبيه عند وجود إصدار جديد
  function showPwaUpdateToast() {
    const toast = document.createElement('div');
    toast.className = 'pwa-toast pwa-toast-update';
    toast.innerHTML = `
      <span>🚀 يتوفر تحديث جديد للنظام!</span>
      <button class="btn btn-sm btn-light" style="margin-right: 8px; color: #1e40af;" onclick="window.location.reload()">تحديث الآن</button>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 100);
  }

  // دعم فتح التبويبات المباشرة من اختصارات الشاشة الرئيسية
  window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab');
    if (targetTab && typeof window.switchTab === 'function') {
      setTimeout(() => {
        window.switchTab(targetTab);
      }, 200);
    }

    // إذا كان iOS وبالمتصفح العادي، إظهار زر التثبيت في الترويسة
    if (isIos && !isInStandaloneMode) {
      const headerInstallBtn = document.getElementById('headerPwaInstallBtn');
      if (headerInstallBtn) {
        headerInstallBtn.style.display = 'inline-flex';
      }
    }
  });
})();
