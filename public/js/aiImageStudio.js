/**
 * محرك تحسين وتفريغ صور المنتجات بالذكاء الاصطناعي (AI Image Studio Pro)
 * شركة ابو رامز للأجهزة الكهربائية
 * الإصدار 2.0 - معالجة على الخادم (Server-Side AI) لضمان نتائج حقيقية
 *
 * - خيار 1: تحسين وتفريغ تلقائي فوري عند رفع الصور المتعددة
 * - خيار 2: استوديو تفاعلي مخصص مع معاينة حية وخيارات استوديو احترافية
 */

(function(window) {
  'use strict';

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
    const stored = localStorage.getItem('aboramez_auto_ai_enhance');
    return stored === null ? true : stored === 'true'; // الافتراضي مفعّل
  }

  function setAutoAiEnhance(val) {
    localStorage.setItem('aboramez_auto_ai_enhance', val ? 'true' : 'false');
    const chk = document.getElementById('chkAutoAiEnhance');
    if (chk) chk.checked = !!val;
  }

  function updateAiProgress(percent, text) {
    const bar = document.getElementById('aiStudioProgressBar');
    const txt = document.getElementById('aiStudioProgressText');
    if (bar) bar.style.width = Math.min(100, Math.max(5, percent)) + '%';
    if (txt) txt.textContent = text || '';
  }

  // قراءة أي مصدر صورة (Blob / URL / File / Image) وتحويله لعنصر HTMLImageElement
  function loadImageElement(source) {
    return new Promise((resolve, reject) => {
      if (source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
        return resolve(source);
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        // إذا فشل بسبب CORS، نحاول مجدداً بدون crossOrigin
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = () => reject(new Error('تعذر قراءة أو تحميل ملف الصورة'));
        if (typeof source === 'string') {
          fallbackImg.src = source;
        } else if (source instanceof Blob || source instanceof File) {
          fallbackImg.src = URL.createObjectURL(source);
        } else {
          reject(new Error('مصدر صورة غير معروف'));
        }
      };

      if (typeof source === 'string') {
        img.src = source;
      } else if (source instanceof Blob || source instanceof File) {
        img.src = URL.createObjectURL(source);
      } else {
        reject(new Error('مصدر صورة غير معروف'));
      }
    });
  }

  // تحويل أي مصدر إلى File/Blob لرفعه للخادم
  async function sourceToFile(source) {
    if (source instanceof File) return source;
    if (source instanceof Blob) return new File([source], 'image.png', { type: source.type || 'image/png' });

    if (typeof source === 'string') {
      // محاولة جلب الصورة عبر fetch
      try {
        const res = await fetch(source, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          const ext = source.split('.').pop().split('?')[0].toLowerCase();
          const mime = blob.type || (ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg'));
          return new File([blob], `image.${ext || 'jpg'}`, { type: mime });
        }
      } catch (_) {}

      // إذا فشل الجلب المباشر، نستخرج من Canvas
      const img = await loadImageElement(source);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 800;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95));
      return new File([blob], 'image.jpg', { type: 'image/jpeg' });
    }

    throw new Error('مصدر صورة غير مدعوم');
  }

  // حساب حدود المنتج الحقيقي بدون الحواف الشفافة (Auto Trim / Bounding Box)
  function getNonTransparentBounds(img) {
    try {
      const canvas = document.createElement('canvas');
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 20) {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!found || minX > maxX || minY > maxY) {
        return { x: 0, y: 0, w, h };
      }

      const padX = Math.round(w * 0.01);
      const padY = Math.round(h * 0.01);
      const realX = Math.max(0, minX - padX);
      const realY = Math.max(0, minY - padY);
      const realW = Math.min(w - realX, (maxX - minX) + padX * 2);
      const realH = Math.min(h - realY, (maxY - minY) + padY * 2);

      return { x: realX, y: realY, w: realW, h: realH };
    } catch (_) {
      return { x: 0, y: 0, w: img.width, h: img.height };
    }
  }

  // إنشاء صورة استوديو متكاملة بمقاس مربع 1:1 وخلفية إضاءة ناصعة مع ظل واقعي احترافي
  function composeStudioBackground(subjectImg, targetSize = 1000) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    // 1. خلفية استوديو نقية ناصعة مع تدرج دائري ناعم
    const bgGrad = ctx.createRadialGradient(
      targetSize / 2, targetSize * 0.45, targetSize * 0.1,
      targetSize / 2, targetSize * 0.5, targetSize * 0.72
    );
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.65, '#f8fafc');
    bgGrad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, targetSize, targetSize);

    // 2. اقتصاص الفراغات وتوسيط المنتج بنسبة 82%
    const bounds = getNonTransparentBounds(subjectImg);
    const maxDim = targetSize * 0.82;
    const ratio = Math.min(maxDim / bounds.w, maxDim / bounds.h);
    const destW = Math.round(bounds.w * ratio);
    const destH = Math.round(bounds.h * ratio);
    const destX = Math.round((targetSize - destW) / 2);
    const destY = Math.round((targetSize - destH) / 2);

    // 3. ظل أرضي ناعم واقعي
    const centerX = destX + destW / 2;
    const centerY = destY + destH - Math.round(destH * 0.015);
    const radiusX = Math.round(destW * 0.44);
    const radiusY = Math.max(12, Math.round(destH * 0.045));

    if (radiusX > 0 && radiusY > 0) {
      const shadowGrad = ctx.createRadialGradient(
        centerX, centerY, radiusY * 0.15,
        centerX, centerY, radiusX
      );
      shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.32)');
      shadowGrad.addColorStop(0.35, 'rgba(15, 23, 42, 0.14)');
      shadowGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.04)');
      shadowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.fillStyle = shadowGrad;
      ctx.fill();
      ctx.restore();
    }

    // 4. رسم المنتج المفرغ في المنتصف
    ctx.drawImage(
      subjectImg,
      bounds.x, bounds.y, bounds.w, bounds.h,
      destX, destY, destW, destH
    );

    // 5. لمسة تباين وإضاءة استوديو
    enhanceCanvasLighting(ctx, targetSize, targetSize);

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.92);
    });
  }

  // إخراج خلفية شفافة مقصوصة وموزونة بمقاس 1:1
  function composeTransparentCropped(subjectImg, targetSize = 1000) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    const bounds = getNonTransparentBounds(subjectImg);
    const maxDim = targetSize * 0.88;
    const ratio = Math.min(maxDim / bounds.w, maxDim / bounds.h);
    const destW = Math.round(bounds.w * ratio);
    const destH = Math.round(bounds.h * ratio);
    const destX = Math.round((targetSize - destW) / 2);
    const destY = Math.round((targetSize - destH) / 2);

    ctx.drawImage(
      subjectImg,
      bounds.x, bounds.y, bounds.w, bounds.h,
      destX, destY, destW, destH
    );
    enhanceCanvasLighting(ctx, targetSize, targetSize);

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  }

  // محرك استوديو الإضاءة والألوان (بدون تفريغ خلفية)
  function composeLightingEnhanceOnly(img, targetSize = 1000) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetSize, targetSize);

    const sW = img.naturalWidth || img.width;
    const sH = img.naturalHeight || img.height;
    const ratio = Math.min((targetSize * 0.88) / sW, (targetSize * 0.88) / sH);
    const destW = Math.round(sW * ratio);
    const destH = Math.round(sH * ratio);
    const destX = Math.round((targetSize - destW) / 2);
    const destY = Math.round((targetSize - destH) / 2);

    ctx.drawImage(img, destX, destY, destW, destH);
    enhanceCanvasLighting(ctx, targetSize, targetSize);

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.92);
    });
  }

  // فلتر ضبط الألوان والسطوع والحدة
  function enhanceCanvasLighting(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const contrast = 1.08;
      const brightness = 6;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        d[i] = Math.min(255, Math.max(0, factor * (d[i] - 128) + 128 + brightness));
        d[i + 1] = Math.min(255, Math.max(0, factor * (d[i + 1] - 128) + 128 + brightness));
        d[i + 2] = Math.min(255, Math.max(0, factor * (d[i + 2] - 128) + 128 + brightness));
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (_) {}
  }

  // ===================================================================
  // الدالة الرئيسية — تفريغ الخلفية بالذكاء الاصطناعي على الخادم
  // ===================================================================
  async function processImageAI(source, mode = 'studio', onProgress) {
    if (onProgress) onProgress(10, 'جاري تحضير الصورة للمعالجة...');

    const originalImg = await loadImageElement(source);

    if (mode === 'lighting') {
      // وضع الإضاءة فقط — بدون تفريغ خلفية
      if (onProgress) onProgress(60, 'جاري موازنة الإضاءة وتوضيح المعالم...');
      const blob = await composeLightingEnhanceOnly(originalImg);
      if (onProgress) onProgress(100, 'تم التحسين بنجاح!');
      return blob;
    }

    // === تفريغ الخلفية عبر الخادم (Server-Side AI) ===
    if (onProgress) onProgress(20, 'جاري رفع الصورة للخادم لمعالجتها بالذكاء الاصطناعي...');
    let transparentBlob = null;

    try {
      const imageFile = await sourceToFile(source);
      const formData = new FormData();
      formData.append('image', imageFile);

      if (onProgress) onProgress(35, 'جاري تفريغ خلفية المنتج بالذكاء الاصطناعي (قد تستغرق 15-30 ثانية)...');

      const res = await fetch('/api/ai/remove-background', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.imageUrl) {
          if (onProgress) onProgress(80, 'تم تفريغ الخلفية — جاري بناء صورة الاستوديو...');

          // جلب صورة شفافة ووضعها في الاستوديو
          const transparentRes = await fetch(data.imageUrl);
          if (transparentRes.ok) {
            transparentBlob = await transparentRes.blob();
          } else {
            // إذا كانت data URL مباشرة
            transparentBlob = data.imageUrl.startsWith('data:') ? dataUrlToBlob(data.imageUrl) : null;
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('⚠️ خطأ من خادم الذكاء الاصطناعي:', errData.error || res.status);
      }
    } catch (serverErr) {
      console.warn('⚠️ تعذر الاتصال بخادم الذكاء الاصطناعي، سيتم الانتقال للبديل:', serverErr.message);
    }

    if (transparentBlob) {
      const cutOutImg = await loadImageElement(transparentBlob);

      if (mode === 'transparent') {
        if (onProgress) onProgress(90, 'جاري ضبط أبعاد الإطار الشفاف...');
        const finalPng = await composeTransparentCropped(cutOutImg);
        if (onProgress) onProgress(100, 'تم تفريغ الخلفية بنجاح!');
        return finalPng;
      }

      if (onProgress) onProgress(90, 'جاري بناء استوديو الإضاءة الاحترافي والظل...');
      const studioBlob = await composeStudioBackground(cutOutImg);
      if (onProgress) onProgress(100, 'تم إنشاء صورة الاستوديو بنجاح!');
      return studioBlob;
    }

    // بديل سريع إذا تعذّر نموذج الذكاء الاصطناعي تماماً
    if (onProgress) onProgress(80, 'جاري تطبيق تحسين الإضاءة والإطار الاستوديوي...');
    const fallbackBlob = await composeLightingEnhanceOnly(originalImg);
    if (onProgress) onProgress(100, 'تم تحسين صورة الصنف!');
    return fallbackBlob;
  }

  // تحويل Data URL إلى Blob
  function dataUrlToBlob(dataUrl) {
    try {
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      return new Blob([u8arr], { type: mime });
    } catch (_) { return null; }
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

    // إظهار النافذة بشكل مرئي مؤكد
    modal.style.display = 'flex';
    modal.classList.add('active');

    const origImgEl = document.getElementById('aiStudioOrigImg');
    const resultImgEl = document.getElementById('aiStudioResultImg');
    const progressWrap = document.getElementById('aiStudioProgressWrap');
    const actionsWrap = document.getElementById('aiStudioActionsWrap');

    if (progressWrap) progressWrap.style.display = 'block';
    if (actionsWrap) actionsWrap.style.display = 'none';

    // تنظيف روابط سابقة
    if (_currentOriginalUrl && _currentOriginalUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(_currentOriginalUrl); } catch (_) {}
    }

    // عرض الصورة الأصلية
    if (typeof imageSource === 'string') {
      _currentOriginalUrl = imageSource;
      if (origImgEl) origImgEl.src = imageSource;
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      _currentOriginalUrl = URL.createObjectURL(imageSource);
      if (origImgEl) origImgEl.src = _currentOriginalUrl;
    }

    if (resultImgEl) {
      resultImgEl.style.opacity = '0.35';
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
    if (resultImgEl) resultImgEl.style.opacity = '0.35';

    // تحديث أزرار الأوضاع
    document.querySelectorAll('.ai-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    try {
      const source = _currentOriginalBlob || _currentOriginalUrl;
      const enhancedBlob = await processImageAI(source, mode, updateAiProgress);
      _currentEnhancedBlob = enhancedBlob;

      if (_currentEnhancedUrl && _currentEnhancedUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(_currentEnhancedUrl); } catch (_) {}
      }
      _currentEnhancedUrl = URL.createObjectURL(enhancedBlob);

      if (resultImgEl) {
        resultImgEl.src = _currentEnhancedUrl;
        resultImgEl.style.opacity = '1';
      }

      if (progressWrap) progressWrap.style.display = 'none';
      if (actionsWrap) actionsWrap.style.display = 'flex';
    } catch (err) {
      console.error('خطأ معالجة الصورة:', err);
      alert('حدث خطأ أثناء معالجة الصورة بالذكاء الاصطناعي: ' + err.message);
      if (progressWrap) progressWrap.style.display = 'none';
    }
  }

  function closeAiStudioModal() {
    const modal = document.getElementById('aiStudioModal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    if (_currentEnhancedUrl && _currentEnhancedUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(_currentEnhancedUrl); } catch (_) {}
      _currentEnhancedUrl = null;
    }
  }

  // رفع الصورة المحسّنة واعتمادها كصورة المنتج
  async function applyAiStudioResult(replace = true) {
    if (!_currentEnhancedBlob) return;

    const btn = document.getElementById('btnAiApplyResult');
    const originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ جاري رفع وحفظ الصورة...';
    }

    try {
      const formData = new FormData();
      const ext = _currentMode === 'transparent' ? 'png' : 'webp';
      const mime = _currentMode === 'transparent' ? 'image/png' : 'image/webp';
      const file = new File([_currentEnhancedBlob], `prod-ai-${Date.now()}.${ext}`, { type: mime });
      formData.append('image', file);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success && data.imageUrl) {
        if (!Array.isArray(window.state.editingProductImages)) {
          window.state.editingProductImages = [];
        }

        if (replace && _currentEditingIndex >= 0 && _currentEditingIndex < window.state.editingProductImages.length) {
          window.state.editingProductImages[_currentEditingIndex] = data.imageUrl;
          if (typeof window.showToast === 'function') {
            window.showToast('✅ تم استبدال وتحديث صورة المنتج بالذكاء الاصطناعي بنجاح!', 'success');
          }
        } else {
          window.state.editingProductImages.push(data.imageUrl);
          if (typeof window.showToast === 'function') {
            window.showToast('✅ تمت إضافة صورة الاستوديو المحسّنة للمنتج!', 'success');
          }
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
        btn.textContent = originalText;
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
