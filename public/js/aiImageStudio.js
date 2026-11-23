/**
 * محرك تحسين وتفريغ صور المنتجات بالذكاء الاصطناعي (AI Image Studio Pro v2.1)
 * شركة ابو رامز للأجهزة الكهربائية
 *
 * ميزات المحرك:
 * 1. تفريغ ذكاء اصطناعي حقيقي بنموذج ONNX للشبكات العصبية (Small Model 1:1)
 * 2. محرك استوديو ذكي محلي (Smart Studio Engine) مع إزالة ذكية للخلفية وظل واقعي
 * 3. 3 أنماط احترافية: استوديو متجر أبيض 1:1 مع ظل، تفريغ شفاف PNG، وتوازن إضاءة
 */

(function(window) {
  'use strict';

  let _imglyModule = null;
  let _isLoadingModel = false;
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
    return stored === null ? true : stored === 'true';
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

  // تحميل مكتبة الذكاء الاصطناعي مع المسارات المعتمدة والمستقرة 100%
  async function loadAiModel() {
    if (_imglyModule) return _imglyModule;
    if (_isLoadingModel) {
      // انتظار التحميل الجاري
      while (_isLoadingModel) {
        await new Promise(r => setTimeout(r, 100));
      }
      return _imglyModule;
    }

    _isLoadingModel = true;
    updateAiProgress(15, 'جاري تهيئة نموذج الذكاء الاصطناعي (ONNX Neural Engine)...');

    // 1. محاولة التحميل من unpkg
    try {
      const mod = await import('https://unpkg.com/@imgly/background-removal@1.4.5/dist/index.mjs');
      if (mod && (typeof mod.removeBackground === 'function' || typeof mod.default === 'function')) {
        _imglyModule = mod;
        _isLoadingModel = false;
        return mod;
      }
    } catch (e1) {
      console.warn('⚠️ تعذر التحميل من unpkg، محاولة jsdelivr...', e1.message);
    }

    // 2. محاولة بديلة من jsdelivr
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/dist/index.mjs');
      if (mod && (typeof mod.removeBackground === 'function' || typeof mod.default === 'function')) {
        _imglyModule = mod;
        _isLoadingModel = false;
        return mod;
      }
    } catch (e2) {
      console.warn('⚠️ تعذر تحميل مكتبة @imgly، سيتم تفعيل محرك الاستوديو الذكي المحلي:', e2.message);
    }

    _isLoadingModel = false;
    return null;
  }

  // تحميل عنصر الصورة مع التغلب على قيود CORS
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
          reject(new Error('مصدر صورة غير مدعوم'));
        }
      };

      if (typeof source === 'string') {
        img.src = source;
      } else if (source instanceof Blob || source instanceof File) {
        img.src = URL.createObjectURL(source);
      } else {
        reject(new Error('مصدر صورة غير مدعوم'));
      }
    });
  }

  // تحويل أي مصدر إلى Blob محلي موثوق
  async function ensureBlob(source, loadedImg) {
    if (source instanceof Blob) return source;

    if (typeof source === 'string') {
      try {
        const res = await fetch(source, { mode: 'cors' });
        if (res.ok) {
          const b = await res.blob();
          if (b && b.size > 0) return b;
        }
      } catch (_) {}
    }

    // استخراج من Canvas
    const img = loadedImg || await loadImageElement(source);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width || 800;
    canvas.height = img.naturalHeight || img.height || 800;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('فشل استخراج بيانات الصورة'));
      }, 'image/png');
    });
  }

  // حساب حدود المنتج الحقيقي بدون الحواف الشفافة (Auto Bounding Box)
  function getNonTransparentBounds(canvasOrImg) {
    try {
      let canvas, w, h;
      if (canvasOrImg instanceof HTMLCanvasElement) {
        canvas = canvasOrImg;
        w = canvas.width;
        h = canvas.height;
      } else {
        w = canvasOrImg.naturalWidth || canvasOrImg.width;
        h = canvasOrImg.naturalHeight || canvasOrImg.height;
        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(canvasOrImg, 0, 0);
      }

      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      let found = false;

      // فحص سريع بخطوة 2 بكسل
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 25) {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (!found || minX >= maxX || minY >= maxY) {
        return { x: 0, y: 0, w, h };
      }

      const padX = Math.round(w * 0.015);
      const padY = Math.round(h * 0.015);
      const realX = Math.max(0, minX - padX);
      const realY = Math.max(0, minY - padY);
      const realW = Math.min(w - realX, (maxX - minX) + padX * 2);
      const realH = Math.min(h - realY, (maxY - minY) + padY * 2);

      return { x: realX, y: realY, w: realW, h: realH };
    } catch (_) {
      return { x: 0, y: 0, w: canvasOrImg.width || 800, h: canvasOrImg.height || 800 };
    }
  }

  // محرك الاستوديو الذكي المحلي (Smart Chroma/Edge Isolator)
  // يزيل الخلفيات العادية (أرضية، جدار، ستارة، طاولة، خلفية رمادية أو بيضاء متسخة)
  function smartCanvasBackgroundRemoval(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      // 1. أخذ عينات من الحواف الأربعة للتعرف على لون الخلفية السائد
      const borderSamples = [];
      const step = Math.max(1, Math.floor(Math.min(w, h) / 30));

      for (let x = 0; x < w; x += step) {
        borderSamples.push({ r: d[(0 * w + x) * 4], g: d[(0 * w + x) * 4 + 1], b: d[(0 * w + x) * 4 + 2] });
        borderSamples.push({ r: d[((h - 1) * w + x) * 4], g: d[((h - 1) * w + x) * 4 + 1], b: d[((h - 1) * w + x) * 4 + 2] });
      }
      for (let y = 0; y < h; y += step) {
        borderSamples.push({ r: d[(y * w + 0) * 4], g: d[(y * w + 0) * 4 + 1], b: d[(y * w + 0) * 4 + 2] });
        borderSamples.push({ r: d[(y * w + (w - 1)) * 4], g: d[(y * w + (w - 1)) * 4 + 1], b: d[(y * w + (w - 1)) * 4 + 2] });
      }

      // حساب متوسط لون الحواف
      let sumR = 0, sumG = 0, sumB = 0;
      borderSamples.forEach(s => { sumR += s.r; sumG += s.g; sumB += s.b; });
      const avgR = sumR / borderSamples.length;
      const avgG = sumG / borderSamples.length;
      const avgB = sumB / borderSamples.length;

      // قياس تباين لون الحواف
      let varSum = 0;
      borderSamples.forEach(s => {
        const diff = Math.sqrt((s.r - avgR)**2 + (s.g - avgG)**2 + (s.b - avgB)**2);
        varSum += diff;
      });
      const avgDiff = varSum / borderSamples.length;

      // تساهل مرن بحسب تجانس لون الحواف
      const tolerance = Math.max(28, Math.min(65, avgDiff * 1.6));

      // خريطة لتحديد البكسلات المفرغة (Flood Fill من الأطراف)
      const visited = new Uint8Array(w * h);
      const queue = [];

      // إضافة بكسلات الأطراف المطابقة للون الخلفية إلى قائمة البداية
      function isBgColor(idx) {
        const r = d[idx], g = d[idx + 1], b = d[idx + 2];
        const dist = Math.sqrt((r - avgR)**2 + (g - avgG)**2 + (b - avgB)**2);
        return dist <= tolerance;
      }

      for (let x = 0; x < w; x++) {
        if (isBgColor((0 * w + x) * 4)) { queue.push(0 * w + x); visited[0 * w + x] = 1; }
        if (isBgColor(((h - 1) * w + x) * 4)) { queue.push((h - 1) * w + x); visited[(h - 1) * w + x] = 1; }
      }
      for (let y = 0; y < h; y++) {
        if (isBgColor((y * w + 0) * 4) && !visited[y * w + 0]) { queue.push(y * w + 0); visited[y * w + 0] = 1; }
        if (isBgColor((y * w + (w - 1)) * 4) && !visited[y * w + (w - 1)]) { queue.push(y * w + (w - 1)); visited[y * w + (w - 1)] = 1; }
      }

      // خوارزمية ملء فيضي محصورة في الخلفية فقط (BFS)
      let head = 0;
      const maxFill = w * h * 0.85; // سقف أمان لمنع مسح المنتج بالكامل
      let filledCount = 0;

      while (head < queue.length && filledCount < maxFill) {
        const cur = queue[head++];
        filledCount++;
        const cx = cur % w;
        const cy = Math.floor(cur / w);
        const pIdx = cur * 4;

        // تفريغ البكسل
        d[pIdx + 3] = 0;

        // فحص الجيران الأربعة
        const neighbors = [];
        if (cx > 0) neighbors.push(cur - 1);
        if (cx < w - 1) neighbors.push(cur + 1);
        if (cy > 0) neighbors.push(cur - w);
        if (cy < h - 1) neighbors.push(cur + w);

        for (let i = 0; i < neighbors.length; i++) {
          const n = neighbors[i];
          if (!visited[n]) {
            visited[n] = 1;
            if (isBgColor(n * 4)) {
              queue.push(n);
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      return canvas;
    } catch (_) {
      return canvas;
    }
  }

  // فلتر استوديو احترافي لضبط التباين والسطوع وتصفية الألوان
  function enhanceCanvasLighting(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const contrast = 1.12;
      const brightness = 8;
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

  // إنشاء صورة استوديو متكاملة بمقاس مربع 1:1 وخلفية إضاءة بيضاء مع ظل واقعي
  function composeStudioBackground(subjectCanvasOrImg, targetSize = 1000) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    // 1. خلفية استوديو نقية ناصعة مع تدرج شعاعي ناعم
    const bgGrad = ctx.createRadialGradient(
      targetSize / 2, targetSize * 0.44, targetSize * 0.1,
      targetSize / 2, targetSize * 0.5, targetSize * 0.72
    );
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.68, '#f8fafc');
    bgGrad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, targetSize, targetSize);

    // 2. اقتصاص الفراغات وتوسيط المنتج بنسبة 80% من مساحة الإطار
    const bounds = getNonTransparentBounds(subjectCanvasOrImg);
    const maxDim = targetSize * 0.80;
    const ratio = Math.min(maxDim / bounds.w, maxDim / bounds.h);
    const destW = Math.round(bounds.w * ratio);
    const destH = Math.round(bounds.h * ratio);
    const destX = Math.round((targetSize - destW) / 2);
    const destY = Math.round((targetSize - destH) / 2);

    // 3. ظل أرضي ناعم واقعي تحت قاعدة المنتج (Realistic Ground Contact Shadow)
    const centerX = destX + destW / 2;
    const centerY = destY + destH - Math.round(destH * 0.015);
    const radiusX = Math.round(destW * 0.42);
    const radiusY = Math.max(12, Math.round(destH * 0.045));

    if (radiusX > 0 && radiusY > 0) {
      const shadowGrad = ctx.createRadialGradient(
        centerX, centerY, radiusY * 0.12,
        centerX, centerY, radiusX
      );
      shadowGrad.addColorStop(0, 'rgba(15, 23, 42, 0.35)');
      shadowGrad.addColorStop(0.35, 'rgba(15, 23, 42, 0.16)');
      shadowGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.05)');
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
      subjectCanvasOrImg,
      bounds.x, bounds.y, bounds.w, bounds.h,
      destX, destY, destW, destH
    );

    // 5. ضبط إضاءة الاستوديو
    enhanceCanvasLighting(ctx, targetSize, targetSize);

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.94);
    });
  }

  // إخراج خلفية شفافة مقصوصة وموزونة بمقاس 1:1
  function composeTransparentCropped(subjectCanvasOrImg, targetSize = 1000) {
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    const bounds = getNonTransparentBounds(subjectCanvasOrImg);
    const maxDim = targetSize * 0.88;
    const ratio = Math.min(maxDim / bounds.w, maxDim / bounds.h);
    const destW = Math.round(bounds.w * ratio);
    const destH = Math.round(bounds.h * ratio);
    const destX = Math.round((targetSize - destW) / 2);
    const destY = Math.round((targetSize - destH) / 2);

    ctx.drawImage(
      subjectCanvasOrImg,
      bounds.x, bounds.y, bounds.w, bounds.h,
      destX, destY, destW, destH
    );
    enhanceCanvasLighting(ctx, targetSize, targetSize);

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png');
    });
  }

  // تحسين الإضاءة والألوان مع توسيط في استوديو 1:1
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
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.94);
    });
  }

  // ===================================================================
  // الدالة الرئيسية لمعالجة الصورة بالذكاء الاصطناعي
  // ===================================================================
  async function processImageAI(source, mode = 'studio', onProgress) {
    if (onProgress) onProgress(10, 'جاري قراءة وتحليل تفاصيل صورة المنتج...');
    const originalImg = await loadImageElement(source);

    if (mode === 'lighting') {
      if (onProgress) onProgress(60, 'جاري موازنة السطوع والتباين...');
      const blob = await composeLightingEnhanceOnly(originalImg);
      if (onProgress) onProgress(100, 'تم تحسين الصورة بنجاح!');
      return blob;
    }

    let cutoutElement = null;

    // 1. محاولة استخدام شبكة العزل العصبية المتقدمة (@imgly v1.4.5)
    try {
      const mod = await loadAiModel();
      const fn = mod ? (mod.removeBackground || mod.default) : null;

      if (typeof fn === 'function') {
        if (onProgress) onProgress(30, 'جاري عزل خلفية المنتج بواسطة نموذج الشبكات العصبية (ONNX AI)...');
        const inputBlob = await ensureBlob(source, originalImg);

        const transparentBlob = await fn(inputBlob, {
          publicPath: 'https://unpkg.com/@imgly/background-removal-data@1.4.5/dist/',
          model: 'small',
          debug: false,
          progress: (key, current, total) => {
            if (total > 0 && onProgress) {
              const p = Math.round(30 + (current / total) * 45);
              onProgress(p, `جاري معالجة معالم المنتج (${Math.round((current / total) * 100)}%)...`);
            }
          }
        });

        if (transparentBlob && transparentBlob.size > 100) {
          cutoutElement = await loadImageElement(transparentBlob);
        }
      }
    } catch (aiErr) {
      console.warn('ℹ️ نموذج العزل العصبي واجه استثناء، الانتقال لمحرك الاستوديو الذكي المحلي:', aiErr.message);
    }

    // 2. إذا تعذر العزل العصبي، نشغل محرك الاستوديو الذكي المحلي (Smart Chroma/Edge Isolator)
    if (!cutoutElement) {
      if (onProgress) onProgress(60, 'جاري تطبيق محرك الاستوديو الذكي وتفريغ الخلفية...');
      cutoutElement = smartCanvasBackgroundRemoval(originalImg);
    }

    // 3. بناء النتيجة بحسب النمط المختار
    if (mode === 'transparent') {
      if (onProgress) onProgress(90, 'جاري ضبط أبعاد الإطار الشفاف 1:1...');
      const finalPng = await composeTransparentCropped(cutoutElement);
      if (onProgress) onProgress(100, 'تم تفريغ الخلفية بنجاح!');
      return finalPng;
    }

    // الوضع الافتراضي والمفضل: استوديو 1:1 مع خلفية بيضاء وظل واقعي
    if (onProgress) onProgress(85, 'جاري بناء استوديو الإضاءة الناصعة وتوليد الظل الواقعي للمنتج...');
    const studioBlob = await composeStudioBackground(cutoutElement);
    if (onProgress) onProgress(100, 'تم إنشاء صورة الاستوديو الاحترافية بنجاح!');
    return studioBlob;
  }

  // -------------------------------------------------------------------
  // نافذة المعاينة التفاعلية (AI Studio Modal)
  // -------------------------------------------------------------------
  async function openAiStudioModal(imageSource, editingIndex = -1) {
    _currentEditingIndex = editingIndex;
    _currentMode = 'studio';
    _currentOriginalBlob = imageSource instanceof Blob ? imageSource : null;

    const modal = document.getElementById('aiStudioModal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.add('active');

    const origImgEl = document.getElementById('aiStudioOrigImg');
    const resultImgEl = document.getElementById('aiStudioResultImg');
    const progressWrap = document.getElementById('aiStudioProgressWrap');
    const actionsWrap = document.getElementById('aiStudioActionsWrap');

    if (progressWrap) progressWrap.style.display = 'block';
    if (actionsWrap) actionsWrap.style.display = 'none';

    if (_currentOriginalUrl && _currentOriginalUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(_currentOriginalUrl); } catch (_) {}
    }

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
      console.error('خطأ معالجة الصورة بالذكاء الاصطناعي:', err);
      alert('حدث خطأ أثناء معالجة الصورة: ' + err.message);
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

  // رفع الصورة المحسّنة واستبدالها في بيانات المنتج
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
            window.showToast('✅ تم استبدال وتحديث صورة المنتج بصورة استوديو احترافية!', 'success');
          }
        } else {
          window.state.editingProductImages.push(data.imageUrl);
          if (typeof window.showToast === 'function') {
            window.showToast('✅ تمت إضافة صورة الاستوديو للمنتج بنجاح!', 'success');
          }
        }

        if (typeof window.renderProductModalImagesGrid === 'function') {
          window.renderProductModalImagesGrid();
        }
        closeAiStudioModal();
      } else {
        alert('تعذر حفظ الصورة على الخادم: ' + (data.error || 'خطأ غير معروف'));
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
