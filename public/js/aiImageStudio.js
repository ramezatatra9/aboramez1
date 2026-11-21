/**
 * محرك تحسين وتفريغ صور المنتجات بالذكاء الاصطناعي (AI Image Studio)
 * شركة ابو رامز للأجهزة الكهربائية
 * 
 * - خيار 1: تحسين وتفريغ تلقائي فوري عند رفع الصور
 * - خيار 2: زر تحسين يدوي مخصص مع نافذة مقارنة وخيارات استوديو احترافية
 */

(function(window) {
  'use strict';

  let _imglyModule = null;
  let _currentOriginalBlob = null;
  let _currentOriginalUrl = null;
  let _currentEnhancedBlob = null;
  let _currentEnhancedUrl = null;
  let _currentEditingIndex = -1;
  let _currentMode = 'studio'; // 'studio' | 'transparent' | 'lighting'

  // فحص هل التفعيل التلقائي مفعّل في المتصفح
  function isAutoAiEnhanceActive() {
    const chk = document.getElementById('chkAutoAiEnhance');
    if (chk) return chk.checked;
    return localStorage.getItem('aboramez_auto_ai_enhance') === 'true';
  }

  function setAutoAiEnhance(val) {
    localStorage.setItem('aboramez_auto_ai_enhance', val ? 'true' : 'false');
    const chk = document.getElementById('chkAutoAiEnhance');
    if (chk) chk.checked = !!val;
  }

  // تحميل مكتبة الذكاء الاصطناعي عند أول استخدام لتوفير استهلاك البيانات
  async function loadAiModel() {
    if (_imglyModule) return _imglyModule;
    try {
      updateAiProgress(10, 'جاري تهيئة نموذج الذكاء الاصطناعي...');
      const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/index.mjs');
      _imglyModule = mod;
      return mod;
    } catch (err) {
      console.warn('تعذر تحميل نموذج @imgly، سيتم استخدام محرك الاستوديو الذكي البديل:', err.message);
      return null;
    }
  }

  function updateAiProgress(percent, text) {
    const bar = document.getElementById('aiStudioProgressBar');
    const txt = document.getElementById('aiStudioProgressText');
    if (bar) bar.style.width = Math.min(100, Math.max(5, percent)) + '%';
    if (txt) txt.textContent = text || '';
  }

  // تحويل ملف أو مسار أو عنصر إلى عنصر Image
  function loadImageElement(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('فشل قراءة الصورة'));
      if (typeof source === 'string') {
        img.src = source;
      } else if (source instanceof Blob || source instanceof File) {
        img.src = URL.createObjectURL(source);
      } else {
        reject(new Error('مصدر صورة غير معروف'));
      }
    });
  }

  // إنشاء خلفية استوديو بيضاء فاخرة مع ظل واقعي متناسق مع مقاس المتجر 1:1
  function composeStudioBackground(subjectImg, targetSize = 1000) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    // 1. خلفية استوديو متدرجة نقية وناعمة
    const bgGrad = ctx.createRadialGradient(
      targetSize / 2, targetSize * 0.45, targetSize * 0.1,
      targetSize / 2, targetSize * 0.5, targetSize * 0.75
    );
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.7, '#f8fafc');
    bgGrad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, targetSize, targetSize);

    // 2. حساب مقاس وتوسيط المنتج مع هامش أمان (Padding) 10%
    const maxDimension = targetSize * 0.82;
    let sWidth = subjectImg.width;
    let sHeight = subjectImg.height;
    const ratio = Math.min(maxDimension / sWidth, maxDimension / sHeight);
    const destW = Math.round(sWidth * ratio);
    const destH = Math.round(sHeight * ratio);
    const destX = Math.round((targetSize - destW) / 2);
    const destY = Math.round((targetSize - destH) / 2);

    // 3. ظل واقعي ناعم تحت قاعدة الجهاز (Soft Realistic Floor Shadow)
    const shadowY = destY + destH - Math.round(destH * 0.03);
    const shadowW = Math.round(destW * 0.82);
    const shadowH = Math.max(14, Math.round(destH * 0.07));
    const shadowX = destX + Math.round((destW - shadowW) / 2);

    const shadowGrad = ctx.createRadialGradient(
      shadowX + shadowW / 2, shadowY, shadowH * 0.15,
      shadowX + shadowW / 2, shadowY, shadowW / 2
    );
    shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    shadowGrad.addColorStop(0.4, 'rgba(15, 23, 42, 0.12)');
    shadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

    ctx.save();
    ctx.scale(1, shadowH / (shadowW / 2));
    ctx.beginPath();
    ctx.arc(
      shadowX + shadowW / 2,
      shadowY / (shadowH / (shadowW / 2)),
      shadowW / 2,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = shadowGrad;
    ctx.fill();
    ctx.restore();

    // 4. رسم المنتج المحسّن في المنتصف
    ctx.drawImage(subjectImg, destX, destY, destW, destH);

    // 5. تحسين طفيف للحدة والإضاءة
    enhanceCanvasLighting(ctx, targetSize, targetSize);

    return new Promise((resolve) => {
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.92);
    });
  }

  // محرك بديل خفيف: تحسين الألوان وتوسيط الاستوديو بدون تفريغ إذا كان النموذج غير متاح
  function composeLightingEnhanceOnly(img, targetSize = 1000) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    // خلفية نظيفة
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetSize, targetSize);

    // توسيط
    const ratio = Math.min((targetSize * 0.9) / img.width, (targetSize * 0.9) / img.height);
    const destW = Math.round(img.width * ratio);
    const destH = Math.round(img.height * ratio);
    const destX = Math.round((targetSize - destW) / 2);
    const destY = Math.round((targetSize - destH) / 2);

    ctx.drawImage(img, destX, destY, destW, destH);
    enhanceCanvasLighting(ctx, targetSize, targetSize);

    return new Promise((resolve) => {
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.92);
    });
  }

  // فلتر تحسين إضاءة وألوان وتباين احترافي للمنتجات
  function enhanceCanvasLighting(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const contrast = 1.08; // زيادة خفيفة للتباين
      const brightness = 6;  // رفع طفيف للسطوع
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        // Red
        d[i] = Math.min(255, Math.max(0, factor * (d[i] - 128) + 128 + brightness));
        // Green
        d[i + 1] = Math.min(255, Math.max(0, factor * (d[i + 1] - 128) + 128 + brightness));
        // Blue
        d[i + 2] = Math.min(255, Math.max(0, factor * (d[i + 2] - 128) + 128 + brightness));
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (_) {}
  }

  // الدالة الرئيسية لمعالجة الصورة بالذكاء الاصطناعي
  async function processImageAI(source, mode = 'studio', onProgress) {
    if (onProgress) onProgress(15, 'جاري تحليل الصورة...');
    const originalImg = await loadImageElement(source);

    if (mode === 'lighting') {
      if (onProgress) onProgress(60, 'جاري موازنة الإضاءة وتوضيح المعالم...');
      const blob = await composeLightingEnhanceOnly(originalImg);
      if (onProgress) onProgress(100, 'تم التحسين بنجاح!');
      return blob;
    }

    // تفريغ الخلفية بالذكاء الاصطناعي
    const mod = await loadAiModel();
    if (mod && typeof mod.removeBackground === 'function') {
      if (onProgress) onProgress(35, 'جاري عزل وتفريغ خلفية المنتج بالذكاء الاصطناعي...');
      try {
        const transparentBlob = await mod.removeBackground(source, {
          progress: (key, current, total) => {
            if (total > 0 && onProgress) {
              const p = Math.round(35 + (current / total) * 45);
              onProgress(p, 'جاري معالجة تفاصيل المنتج (' + Math.round((current / total) * 100) + '%)...');
            }
          }
        });

        if (mode === 'transparent') {
          if (onProgress) onProgress(100, 'تم تفريغ الخلفية بنجاح!');
          return transparentBlob;
        }

        // وضع خلفية الاستوديو والظل
        if (onProgress) onProgress(85, 'جاري بناء استوديو الإضاءة الاحترافي والظل...');
        const cutOutImg = await loadImageElement(transparentBlob);
        const studioBlob = await composeStudioBackground(cutOutImg);
        if (onProgress) onProgress(100, 'تم إنشاء صورة الاستوديو بنجاح!');
        return studioBlob;
      } catch (aiErr) {
        console.warn('خطأ أثناء تشغيل إزالة الخلفية بالذكاء الاصطناعي، الانتقال للتحسين الاحترافي:', aiErr);
      }
    }

    // بديل إذا لم يتوفر الموديل
    if (onProgress) onProgress(70, 'جاري ضبط ألوان المنتج وتوسيط الإطار...');
    const fallbackBlob = await composeLightingEnhanceOnly(originalImg);
    if (onProgress) onProgress(100, 'تم تحسين الصورة بنجاح!');
    return fallbackBlob;
  }

  // -------------------------------------------------------------------
  // نافذة المعاينة والمقارنة التفاعلية (AI Studio Modal)
  // -------------------------------------------------------------------
  async function openAiStudioModal(imageSource, editingIndex = -1) {
    _currentEditingIndex = editingIndex;
    _currentMode = 'studio';
    _currentOriginalBlob = imageSource instanceof Blob ? imageSource : null;

    const modal = document.getElementById('aiStudioModal');
    if (!modal) return;

    modal.classList.add('active');

    const origImgEl = document.getElementById('aiStudioOrigImg');
    const resultImgEl = document.getElementById('aiStudioResultImg');
    const progressWrap = document.getElementById('aiStudioProgressWrap');
    const actionsWrap = document.getElementById('aiStudioActionsWrap');

    if (progressWrap) progressWrap.style.display = 'block';
    if (actionsWrap) actionsWrap.style.display = 'none';

    // عرض الصورة الأصلية
    if (typeof imageSource === 'string') {
      _currentOriginalUrl = imageSource;
      if (origImgEl) origImgEl.src = imageSource;
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      _currentOriginalUrl = URL.createObjectURL(imageSource);
      if (origImgEl) origImgEl.src = _currentOriginalUrl;
    }

    if (resultImgEl) {
      resultImgEl.style.opacity = '0.3';
      resultImgEl.src = origImgEl ? origImgEl.src : '';
    }

    await rerunAiStudioGeneration('studio');
  }

  async function rerunAiStudioGeneration(mode = 'studio') {
    _currentMode = mode;
    const progressWrap = document.getElementById('aiStudioProgressWrap');
    const actionsWrap = document.getElementById('aiStudioActionsWrap');
    const resultImgEl = document.getElementById('aiStudioResultImg');

    if (progressWrap) progressWrap.style.display = 'block';
    if (actionsWrap) actionsWrap.style.display = 'none';
    if (resultImgEl) resultImgEl.style.opacity = '0.4';

    // تحديث أزرار الأوضاع
    document.querySelectorAll('.ai-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    try {
      const source = _currentOriginalBlob || _currentOriginalUrl;
      const enhancedBlob = await processImageAI(source, mode, updateAiProgress);
      _currentEnhancedBlob = enhancedBlob;
      _currentEnhancedUrl = URL.createObjectURL(enhancedBlob);

      if (resultImgEl) {
        resultImgEl.src = _currentEnhancedUrl;
        resultImgEl.style.opacity = '1';
      }

      if (progressWrap) progressWrap.style.display = 'none';
      if (actionsWrap) actionsWrap.style.display = 'flex';
    } catch (err) {
      alert('حدث خطأ أثناء معالجة الصورة: ' + err.message);
      if (progressWrap) progressWrap.style.display = 'none';
    }
  }

  function closeAiStudioModal() {
    const modal = document.getElementById('aiStudioModal');
    if (modal) modal.classList.remove('active');
  }

  // رفع الصورة المحسّنة واعتمادها
  async function applyAiStudioResult(replace = true) {
    if (!_currentEnhancedBlob) return;

    const btn = document.getElementById('btnAiApplyResult');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'جاري رفع وحفظ الصورة...';
    }

    try {
      const formData = new FormData();
      const ext = _currentMode === 'transparent' ? 'png' : 'webp';
      const file = new File([_currentEnhancedBlob], `prod-ai-${Date.now()}.${ext}`, { type: _currentEnhancedBlob.type });
      formData.append('image', file);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success && data.imageUrl) {
        if (!Array.isArray(window.state.editingProductImages)) {
          window.state.editingProductImages = [];
        }

        if (replace && _currentEditingIndex >= 0 && _currentEditingIndex < window.state.editingProductImages.length) {
          window.state.editingProductImages[_currentEditingIndex] = data.imageUrl;
          window.showToast('✅ تم استبدال وتحديث صورة المنتج بالذكاء الاصطناعي بنجاح!', 'success');
        } else {
          window.state.editingProductImages.push(data.imageUrl);
          window.showToast('✅ تمت إضافة صورة الاستوديو المحسّنة للمنتج!', 'success');
        }

        if (typeof window.renderProductModalImagesGrid === 'function') {
          window.renderProductModalImagesGrid();
        }
        closeAiStudioModal();
      } else {
        alert('تعذر حفظ الصورة المحسنة على الخادم: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      alert('خطأ أثناء حفظ الصورة: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✅ اعتماد واستبدال الصورة الحالية';
      }
    }
  }

  // تصدير الواجهة العامة
  window.aiImageStudio = {
    isAutoAiEnhanceActive,
    setAutoAiEnhance,
    processImageAI,
    openAiStudioModal,
    rerunAiStudioGeneration,
    closeAiStudioModal,
    applyAiStudioResult
  };

})(window);
