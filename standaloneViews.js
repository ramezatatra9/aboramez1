/**
 * standaloneViews.js
 * موديول توليد صفحات المعاينة المستقلة 100% للزبائن
 * معزولة تماماً عن نظام الإدارة والكاشير الداخلي لحماية الخصوصية والأمان التام
 */

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateTime(d) {
  if (!d) return '--';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return String(d);
  }
}

function tafqeetArabic(number, currency = 'شيكل') {
  const n = Math.floor(parseFloat(number) || 0);
  if (n <= 0) return '';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertChunk(num) {
    let res = '';
    const h = Math.floor(num / 100);
    const rem = num % 100;
    if (h > 0) res += hundreds[h];
    if (rem > 0) {
      if (res) res += ' و';
      if (rem < 20) {
        res += ones[rem];
      } else {
        const o = rem % 10;
        const t = Math.floor(rem / 10);
        if (o > 0) res += ones[o] + ' و' + tens[t];
        else res += tens[t];
      }
    }
    return res;
  }

  let parts = [];
  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(convertChunk(millions) + ' ملايين');
    else parts.push(convertChunk(millions) + ' مليون');
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(convertChunk(thousands) + ' آلاف');
    else parts.push(convertChunk(thousands) + ' ألف');
  }

  if (remainder > 0) {
    parts.push(convertChunk(remainder));
  }

  const result = parts.join(' و');
  return result ? `${result} ${currency} فقط لا غير` : '';
}

// 1. صفحة معاينة الصنف المستقلة المخصصة للزبائن (Product Showcase)
function renderProductPreviewHtml(product, settings, req) {
  const companyName = settings.companyName || 'رامز عطاطرة';
  const companyPhone = settings.companyPhone || '';
  const currency = settings.currency || 'شيكل';
  const cleanPhone = companyPhone.replace(/[^\d+]/g, '');
  const waPhone = cleanPhone.startsWith('0') ? '970' + cleanPhone.slice(1) : cleanPhone;

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'aboramez1.onrender.com';
  const currentUrl = `${protocol}://${host}${req.originalUrl}`;

  let imgs = [];
  if (Array.isArray(product.images) && product.images.length > 0) {
    imgs = product.images.filter(x => typeof x === 'string' && x.trim());
  } else if (product.image && typeof product.image === 'string' && product.image.trim()) {
    imgs = [product.image.trim()];
  }
  if (imgs.length === 0) {
    imgs = ['https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'];
  }
  const mainImg = imgs[0].startsWith('http') ? imgs[0] : `${protocol}://${host}${imgs[0]}`;

  const sellPrice = parseFloat(product.sellPrice) || 0;
  const priceDisplay = sellPrice > 0 ? `${sellPrice.toLocaleString('en-US')} ${currency}` : 'سعر خاص عند الطلب';
  const stock = parseInt(product.stock) || 0;
  const isAvailable = stock > 0;

  const orderMsg = encodeURIComponent(
    `مرحباً شركة ${companyName}،\nأود الاستفسار وطلب الصنف التالي:\n📦 الصنف: ${product.name}\n🏷️ الماركة: ${product.brand || 'عام'}\n🔢 الكود: ${product.code || '--'}\n💰 السعر المعروض: ${priceDisplay}\n🔗 الرابط: ${currentUrl}`
  );
  const waOrderUrl = waPhone ? `https://wa.me/${waPhone}?text=${orderMsg}` : `https://wa.me/?text=${orderMsg}`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${escapeHtml(product.name)} | ${escapeHtml(companyName)}</title>
  
  <meta property="og:title" content="🛍️ ${escapeHtml(product.name)} | ${escapeHtml(priceDisplay)}">
  <meta property="og:description" content="الماركة: ${escapeHtml(product.brand || 'عام')} | كود: [${escapeHtml(product.code || '--')}] — ${escapeHtml(companyName)}">
  <meta property="og:image" content="${escapeHtml(mainImg)}">
  <meta property="og:image:secure_url" content="${escapeHtml(mainImg)}">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="600">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="${escapeHtml(companyName)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="🛍️ ${escapeHtml(product.name)} | ${escapeHtml(priceDisplay)}">
  <meta name="twitter:description" content="الماركة: ${escapeHtml(product.brand || 'عام')} — ${escapeHtml(companyName)}">
  <meta name="twitter:image" content="${escapeHtml(mainImg)}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.6;
      direction: rtl;
      padding-bottom: 3rem;
    }
    .header {
      background: #ffffff;
      border-bottom: 1.5px solid #e2e8f0;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 10px rgba(0,0,0,0.03);
    }
    .brand-logo { display: flex; align-items: center; gap: 0.65rem; }
    .brand-logo .icon { font-size: 1.8rem; }
    .brand-logo .name { font-size: 1.2rem; font-weight: 900; color: #0f172a; }
    .brand-logo .sub { font-size: 0.75rem; color: #64748b; }

    .header-btn {
      background: #25D366;
      color: #ffffff;
      text-decoration: none;
      padding: 0.45rem 0.95rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .container {
      max-width: 840px;
      margin: 1.5rem auto;
      padding: 0 1rem;
    }
    .card {
      background: #ffffff;
      border-radius: 18px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
    }
    .gallery-wrap {
      background: #f1f5f9;
      padding: 1.5rem 1rem;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
    }
    .main-img {
      max-width: 100%;
      max-height: 440px;
      object-fit: contain;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      background: #fff;
    }
    .thumbnails {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    .thumb {
      width: 58px;
      height: 58px;
      border-radius: 8px;
      border: 2px solid transparent;
      overflow: hidden;
      cursor: pointer;
      background: #fff;
      padding: 2px;
      transition: all 0.2s;
    }
    .thumb.active { border-color: #2563eb; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }

    .body { padding: 1.75rem; }
    .badges { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.85rem; }
    .badge { padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; }
    .badge-brand { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-code { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-family: monospace; }
    .badge-avail { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .badge-unavail { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

    .title {
      font-size: 1.55rem;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 1.25rem;
      line-height: 1.4;
    }

    .price-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
      border: 2px solid #86efac;
      border-radius: 14px;
      padding: 1.15rem 1.4rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .price-lbl { font-size: 0.95rem; color: #166534; font-weight: 700; }
    .price-val { font-size: 2rem; font-weight: 900; color: #15803d; }

    .desc-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.75rem;
    }
    .desc-box h4 { font-size: 0.95rem; font-weight: 800; color: #334155; margin-bottom: 0.5rem; }
    .desc-box p { color: #475569; font-size: 0.92rem; white-space: pre-wrap; line-height: 1.7; }

    .actions { display: flex; flex-direction: column; gap: 0.75rem; }
    .btn-wa-order {
      background: #25D366;
      color: #ffffff;
      text-decoration: none;
      padding: 1rem;
      border-radius: 12px;
      font-size: 1.15rem;
      font-weight: 800;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      box-shadow: 0 4px 15px rgba(37,211,102,0.3);
      transition: all 0.2s;
    }
    .btn-wa-order:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37,211,102,0.4); }
    .btn-call {
      background: #ffffff;
      color: #0f172a;
      border: 1.5px solid #cbd5e1;
      text-decoration: none;
      padding: 0.85rem;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 700;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
    }

    .footer { text-align: center; font-size: 0.8rem; color: #94a3b8; margin-top: 1.5rem; }
  </style>
</head>
<body>

  <header class="header">
    <div class="brand-logo">
      <span class="icon">💼</span>
      <div>
        <div class="name">${escapeHtml(companyName)}</div>
        <div class="sub">معاينة تفاصيل الصنف الرسمية</div>
      </div>
    </div>
    ${companyPhone ? `
      <a href="tel:${cleanPhone}" class="header-btn">
        <span>📞</span>
        <span>اتصال</span>
      </a>
    ` : ''}
  </header>

  <main class="container">
    <div class="card">
      <div class="gallery-wrap">
        <img id="mainImgEl" class="main-img" src="${escapeHtml(imgs[0])}" alt="${escapeHtml(product.name)}">
        ${imgs.length > 1 ? `
          <div class="thumbnails">
            ${imgs.map((src, i) => `
              <div class="thumb ${i === 0 ? 'active' : ''}" onclick="selectThumb('${escapeHtml(src)}', this)">
                <img src="${escapeHtml(src)}" alt="">
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="body">
        <div class="badges">
          ${product.brand ? `<span class="badge badge-brand">🏷️ الماركة: ${escapeHtml(product.brand)}</span>` : ''}
          ${product.code ? `<span class="badge badge-code">كود: ${escapeHtml(product.code)}</span>` : ''}
          <span class="badge ${isAvailable ? 'badge-avail' : 'badge-unavail'}">
            ${isAvailable ? '✅ متوفر بالمستودع' : '⚠️ يرجى التواصل للاستفسار'}
          </span>
        </div>

        <h1 class="title">${escapeHtml(product.name)}</h1>

        <div class="price-box">
          <span class="price-lbl">🏷️ سعر البيع الرسمي:</span>
          <span class="price-val">${escapeHtml(priceDisplay)}</span>
        </div>

        ${product.description ? `
          <div class="desc-box">
            <h4>📋 المواصفات والتفاصيل:</h4>
            <p>${escapeHtml(product.description)}</p>
          </div>
        ` : ''}

        <div class="actions">
          <a href="${waOrderUrl}" target="_blank" class="btn-wa-order">
            <span>💬</span>
            <span>اطلب هذا الصنف الآن عبر واتساب</span>
          </a>
          ${companyPhone ? `
            <a href="tel:${cleanPhone}" class="btn-call">
              <span>📞</span>
              <span>اتصال مباشر: ${escapeHtml(companyPhone)}</span>
            </a>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="footer">
      جميع الحقوق محفوظة © ${new Date().getFullYear()} ${escapeHtml(companyName)}
    </div>
  </main>

  <script>
    function selectThumb(src, el) {
      document.getElementById('mainImgEl').src = src;
      document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
    }
  </script>
</body>
</html>`;
}

// 2. صفحة معاينة الفاتورة المستقلة للزبون (Invoice Preview)
function renderInvoicePreviewHtml(invoice, settings, req) {
  const companyName = settings.companyName || 'رامز عطاطرة';
  const companyPhone = settings.companyPhone || '';
  const companyAddress = settings.companyAddress || 'المركز التجاري الرئيسي';
  const currency = settings.currency || 'شيكل';
  const cleanPhone = companyPhone.replace(/[^\d+]/g, '');
  const waPhone = cleanPhone.startsWith('0') ? '970' + cleanPhone.slice(1) : cleanPhone;

  const total = Number(invoice.totalAmount ?? invoice.summary?.totalAmount) || 0;
  const items = invoice.items || [];
  const invNumber = invoice.invoiceNumber || invoice.id;
  const dateStr = formatDateTime(invoice.createdAt);
  const custName = invoice.customerName || invoice.partyName || 'نقداً';

  let payMethodText = 'كاش نقدي';
  if (invoice.paymentMethod === 'check') payMethodText = 'شيك بنكي';
  else if (invoice.paymentMethod === 'installments' || invoice.paymentMethod === 'credit') payMethodText = 'أقساط / ذمم';
  else if (invoice.paymentMethod === 'mixed') payMethodText = 'كاش + شيك';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة مبيعات #${escapeHtml(invNumber)} | ${escapeHtml(companyName)}</title>
  
  <meta property="og:title" content="🧾 فاتورة مبيعات #${escapeHtml(invNumber)} - ${escapeHtml(companyName)}">
  <meta property="og:description" content="الزبون: ${escapeHtml(custName)} | الإجمالي: ${total.toLocaleString('en-US')} ${currency}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 1.5rem 1rem;
      direction: rtl;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 14px;
      padding: 2rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .company-title { font-size: 1.6rem; font-weight: 900; color: #0f172a; }
    .company-sub { font-size: 0.85rem; color: #475569; margin-top: 0.2rem; }
    
    .inv-badge-box { text-align: left; }
    .inv-badge {
      background: #eff6ff;
      border: 1.5px solid #bfdbfe;
      border-radius: 8px;
      padding: 0.4rem 0.9rem;
      font-weight: 800;
      font-size: 1.1rem;
      color: #1d4ed8;
      display: inline-block;
    }
    .inv-date { font-size: 0.82rem; color: #64748b; margin-top: 0.3rem; }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1rem 1.25rem;
      margin-bottom: 1.5rem;
    }
    .meta-lbl { font-size: 0.8rem; color: #64748b; font-weight: 600; }
    .meta-val { font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-top: 0.15rem; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    th {
      background: #f1f5f9;
      color: #0f172a;
      padding: 10px 8px;
      border: 1px solid #cbd5e1;
      font-size: 0.85rem;
      font-weight: 800;
    }
    td { padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 0.88rem; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }

    .total-box {
      background: #f0fdf4;
      border: 2px solid #86efac;
      border-radius: 10px;
      padding: 1.15rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .total-lbl { font-size: 1.1rem; font-weight: 800; color: #166534; }
    .total-val { font-size: 1.8rem; font-weight: 900; color: #15803d; }

    .actions { display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem; }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .btn-print { background: #2563eb; color: #fff; }
    .btn-wa { background: #25D366; color: #fff; }

    @media print {
      body { background: #fff; padding: 0; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
      .actions { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="company-title">${escapeHtml(companyName)}</div>
        <div class="company-sub">${escapeHtml(companyAddress)} | هاتف: ${escapeHtml(companyPhone)}</div>
      </div>
      <div class="inv-badge-box">
        <div class="inv-badge">فاتورة مبيعات #${escapeHtml(invNumber)}</div>
        <div class="inv-date">تاريخ الإصدار: ${escapeHtml(dateStr)}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <div class="meta-lbl">السيد / الزبون:</div>
        <div class="meta-val">${escapeHtml(custName)}</div>
      </div>
      <div style="text-align: left;">
        <div class="meta-lbl">طريقة الدفع:</div>
        <div class="meta-val">${escapeHtml(payMethodText)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 45px;" class="text-center">#</th>
          <th>اسم الصنف والبيان</th>
          <th style="width: 90px;" class="text-center">الكمية</th>
          <th style="width: 120px;" class="text-left">سعر الوحدة</th>
          <th style="width: 130px;" class="text-left">المجموع</th>
        </tr>
      </thead>
      <tbody>
        ${items.length > 0 ? items.map((it, idx) => {
          const qty = Number(it.quantity) || 1;
          const uPrice = Number(it.unitPrice ?? it.sellPrice) || 0;
          const totalLine = Number(it.totalPrice ?? (qty * uPrice)) || 0;
          return `
            <tr>
              <td class="text-center font-bold">${idx + 1}</td>
              <td><strong>${escapeHtml(it.productName || it.name || 'صنف')}</strong></td>
              <td class="text-center font-bold">${qty}</td>
              <td class="text-left">${uPrice.toLocaleString('en-US')} ${currency}</td>
              <td class="text-left font-bold">${totalLine.toLocaleString('en-US')} ${currency}</td>
            </tr>
          `;
        }).join('') : `
          <tr><td colspan="5" class="text-center" style="padding: 1.5rem; color:#64748b;">لا توجد تفاصيل أصناف مدرجة</td></tr>
        `}
      </tbody>
    </table>

    <div class="total-box">
      <span class="total-lbl">المجموع الكلي النهائي:</span>
      <span class="total-val">${total.toLocaleString('en-US')} ${currency}</span>
    </div>

    <div class="actions">
      <button onclick="window.print()" class="btn btn-print">
        <span>🖨️</span>
        <span>طباعة الفاتورة</span>
      </button>
      ${waPhone ? `
        <a href="https://wa.me/${waPhone}" target="_blank" class="btn btn-wa">
          <span>💬</span>
          <span>تواصل مع الشركة عبر واتساب</span>
        </a>
      ` : ''}
    </div>
  </div>

</body>
</html>`;
}

// 3. صفحة معاينة كشف الحساب المستقلة للزبون (Customer Statement)
function renderStatementPreviewHtml(statement, settings, req) {
  const companyName = settings.companyName || 'رامز عطاطرة';
  const companyPhone = settings.companyPhone || '';
  const currency = settings.currency || 'شيكل';
  const cleanPhone = companyPhone.replace(/[^\d+]/g, '');
  const waPhone = cleanPhone.startsWith('0') ? '970' + cleanPhone.slice(1) : cleanPhone;
  const c = statement.customer;
  const movements = statement.movements || [];

  const bal = parseFloat(c.balance) || 0;
  const balText = bal > 0 ? `دين مستحق: ${bal.toLocaleString('en-US')} ${currency}` :
                  (bal < 0 ? `رصيد لصالحه: ${Math.abs(bal).toLocaleString('en-US')} ${currency}` : `رصيد خالص (مسدد)`);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>كشف حساب | ${escapeHtml(c.name)} | ${escapeHtml(companyName)}</title>
  
  <meta property="og:title" content="📄 كشف حساب معتمد - ${escapeHtml(c.name)}">
  <meta property="og:description" content="الرصيد المالي الحالي: ${escapeHtml(balText)} — ${escapeHtml(companyName)}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif; background: #f8fafc; color: #0f172a; padding: 1.5rem 1rem; direction: rtl; }
    .card { max-width: 900px; margin: 0 auto; background: #fff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 1.25rem; margin-bottom: 1.5rem; }
    .company-title { font-size: 1.55rem; font-weight: 900; }
    .badge { background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 0.4rem 0.9rem; font-weight: 800; color: #1d4ed8; }
    
    .cust-card { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; }
    .bal-val { font-size: 1.4rem; font-weight: 900; color: ${bal > 0 ? '#dc2626' : (bal < 0 ? '#2563eb' : '#16a34a')}; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; font-weight: 800; }
    td { padding: 8px; border: 1px solid #cbd5e1; font-size: 0.84rem; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }

    .actions { display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem; }
    .btn { padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 700; cursor: pointer; text-decoration: none; border: none; }
    .btn-print { background: #2563eb; color: #fff; }

    @media print {
      body { background: #fff; padding: 0; }
      .card { border: none; box-shadow: none; padding: 0; }
      .actions { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="card">
    <div class="header">
      <div>
        <div class="company-title">${escapeHtml(companyName)}</div>
        <div style="font-size: 0.82rem; color: #64748b; margin-top: 0.2rem;">هاتف: ${escapeHtml(companyPhone)}</div>
      </div>
      <div style="text-align: left;">
        <div class="badge">كشف حساب مالي تفصيلي</div>
        <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.3rem;">تاريخ الإصدار: ${formatDateTime(new Date())}</div>
      </div>
    </div>

    <div class="cust-card">
      <div>
        <div style="font-size: 0.8rem; color: #64748b;">السيد / الزبون:</div>
        <div style="font-size: 1.25rem; font-weight: 900;">${escapeHtml(c.name)}</div>
      </div>
      <div style="text-align: left;">
        <div style="font-size: 0.8rem; color: #64748b;">الرصيد المالي الحالي:</div>
        <div class="bal-val">${escapeHtml(balText)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px;" class="text-center">#</th>
          <th style="width: 110px;">التاريخ</th>
          <th style="width: 140px;">نوع الحركة ورقمها</th>
          <th>البيان / الملاحظات</th>
          <th style="width: 100px;" class="text-left">مدين (+)</th>
          <th style="width: 100px;" class="text-left">دائن (-)</th>
          <th style="width: 110px;" class="text-left">الرصيد بعد الحركة</th>
        </tr>
      </thead>
      <tbody>
        ${movements.length > 0 ? movements.map((m, idx) => `
          <tr style="background: ${m.type === 'receipt' ? '#f0fdf4' : (idx % 2 === 0 ? '#fff' : '#fafafa')};">
            <td class="text-center font-bold">${idx + 1}</td>
            <td>${formatDateTime(m.date)}</td>
            <td><strong>#${escapeHtml(String(m.number))}</strong> (${escapeHtml(m.typeTitle || m.type)})</td>
            <td>${escapeHtml(m.notes || '--')}</td>
            <td class="text-left font-bold" style="color: ${m.debit > 0 ? '#dc2626' : '#94a3b8'};">${m.debit > 0 ? m.debit.toLocaleString('en-US') + ' ' + currency : '--'}</td>
            <td class="text-left font-bold" style="color: ${m.credit > 0 ? '#16a34a' : '#94a3b8'};">${m.credit > 0 ? m.credit.toLocaleString('en-US') + ' ' + currency : '--'}</td>
            <td class="text-left font-bold" style="color: ${(m.balanceAfter || 0) > 0 ? '#dc2626' : '#16a34a'};">${(m.balanceAfter || 0).toLocaleString('en-US')} ${currency}</td>
          </tr>
        `).join('') : `
          <tr><td colspan="7" class="text-center" style="padding: 1.5rem; color:#64748b;">لا توجد حركات مسجلة</td></tr>
        `}
      </tbody>
    </table>

    <div class="actions">
      <button onclick="window.print()" class="btn btn-print">🖨️ طباعة كشف الحساب</button>
      ${waPhone ? `<a href="https://wa.me/${waPhone}" target="_blank" class="btn" style="background:#25D366; color:#fff;">💬 تواصل مع الشركة عبر واتساب</a>` : ''}
    </div>
  </div>

</body>
</html>`;
}

// 4. صفحة معاينة سند القبض المالي المستقلة للزبون (Official Receipt Voucher)
function renderReceiptPreviewHtml(receipt, settings, req) {
  const companyName = settings.companyName || 'رامز عطاطرة';
  const companyPhone = settings.companyPhone || '';
  const companyAddress = settings.companyAddress || 'المركز التجاري الرئيسي';
  const currency = settings.currency || 'شيكل';
  const cleanPhone = companyPhone.replace(/[^\d+]/g, '');
  const waPhone = cleanPhone.startsWith('0') ? '970' + cleanPhone.slice(1) : cleanPhone;

  const isPayment = receipt.voucherType === 'payment' || receipt.typeCode === 'P';
  const voucherTitle = isPayment ? 'سند صرف مالي' : 'سند قبض مالي';
  const vNum = receipt.receiptNumber || receipt.voucherNumber || receipt.id;
  const dateStr = formatDateTime(receipt.createdAt || receipt.date);
  const amount = parseFloat(receipt.amount) || 0;
  const amountWords = tafqeetArabic(amount, currency) || `${amount.toLocaleString('en-US')} ${currency}`;
  const custName = receipt.customerName || receipt.partyName || 'السيد المحترم';

  let methodLabel = 'نقداً (Cash)';
  if (receipt.paymentMethod === 'transfer') methodLabel = 'تحويل بنكي (Bank Transfer)';
  else if (receipt.paymentMethod === 'check') methodLabel = 'شيك مصرفي (Bank Cheque)';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(voucherTitle)} #${escapeHtml(String(vNum))} | ${escapeHtml(companyName)}</title>
  
  <meta property="og:title" content="📄 ${escapeHtml(voucherTitle)} #${escapeHtml(String(vNum))} - ${escapeHtml(companyName)}">
  <meta property="og:description" content="استلمنا من: ${escapeHtml(custName)} | مبلغ: ${amount.toLocaleString('en-US')} ${currency} (${escapeHtml(amountWords)})">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(companyName)}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Cairo', sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 1.5rem 1rem;
      direction: rtl;
    }
    .card {
      max-width: 780px;
      margin: 0 auto;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 14px;
      padding: 2.2rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .company-title { font-size: 1.6rem; font-weight: 900; color: #0f172a; }
    .company-sub { font-size: 0.85rem; color: #475569; margin-top: 0.2rem; }
    .badge-box { text-align: left; }
    .badge {
      background: #eff6ff;
      border: 1.5px solid #bfdbfe;
      border-radius: 8px;
      padding: 0.4rem 0.9rem;
      font-weight: 800;
      font-size: 1.1rem;
      color: #1d4ed8;
      display: inline-block;
    }
    .date-lbl { font-size: 0.82rem; color: #64748b; margin-top: 0.3rem; }

    .amount-box {
      background: #f0fdf4;
      border: 2px solid #86efac;
      border-radius: 12px;
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .amount-lbl { font-size: 1.1rem; font-weight: 800; color: #166534; }
    .amount-val { font-size: 1.85rem; font-weight: 900; color: #15803d; }

    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.75rem;
      background: #f8fafc;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .details-table tr {
      border-bottom: 1px solid #e2e8f0;
    }
    .details-table tr:last-child {
      border-bottom: none;
    }
    .details-table td {
      padding: 12px 16px;
      font-size: 0.95rem;
    }
    .details-table .lbl {
      width: 170px;
      font-weight: 800;
      color: #475569;
      background: #f1f5f9;
    }
    .details-table .val {
      font-weight: 700;
      color: #0f172a;
    }

    .sig-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1rem;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px dashed #cbd5e1;
      text-align: center;
    }
    .sig-box {
      padding: 0.5rem;
    }
    .sig-title {
      font-size: 0.82rem;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 1rem;
    }
    .sig-line {
      font-weight: 800;
      color: #0f172a;
      border-top: 1px solid #cbd5e1;
      padding-top: 0.5rem;
      min-height: 25px;
    }
    .stamp-circle {
      width: 80px;
      height: 80px;
      margin: 0 auto;
      border: 2px dashed #94a3b8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.72rem;
      color: #64748b;
      line-height: 1.2;
    }

    .actions { display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.75rem; }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .btn-print { background: #2563eb; color: #fff; }
    .btn-wa { background: #25D366; color: #fff; }

    @media print {
      body { background: #fff; padding: 0; }
      .card { border: none; box-shadow: none; padding: 0; }
      .actions { display: none !important; }
    }
  </style>
</head>
<body>

  <div class="card">
    <div class="header">
      <div>
        <div class="company-title">${escapeHtml(companyName)}</div>
        <div class="company-sub">${escapeHtml(companyAddress)} | هاتف: ${escapeHtml(companyPhone)}</div>
      </div>
      <div class="badge-box">
        <div class="badge">${escapeHtml(voucherTitle)} #${escapeHtml(String(vNum))}</div>
        <div class="date-lbl">تاريخ الإصدار: ${escapeHtml(dateStr)}</div>
      </div>
    </div>

    <div class="amount-box">
      <span class="amount-lbl">المبلغ المدفوع:</span>
      <span class="amount-val">${amount.toLocaleString('en-US')} ${currency}</span>
    </div>

    <table class="details-table">
      <tr>
        <td class="lbl">استلمنا من السيد/ة:</td>
        <td class="val"><strong>${escapeHtml(custName)}</strong> ${receipt.customerPhone ? `<span style="font-size: 0.85rem; color: #64748b; font-weight: normal;">(هاتف: ${escapeHtml(receipt.customerPhone)})</span>` : ''}</td>
      </tr>
      <tr>
        <td class="lbl">المبلغ كتابة بالأحرف:</td>
        <td class="val" style="color: #047857;">${escapeHtml(amountWords)}</td>
      </tr>
      <tr>
        <td class="lbl">طريقة الدفع:</td>
        <td class="val">${escapeHtml(methodLabel)}</td>
      </tr>
      ${receipt.description ? `
      <tr>
        <td class="lbl">وذلك لقاء (البيان):</td>
        <td class="val">${escapeHtml(receipt.description)}</td>
      </tr>` : ''}
      ${receipt.notes ? `
      <tr>
        <td class="lbl">ملاحظات:</td>
        <td class="val">${escapeHtml(receipt.notes)}</td>
      </tr>` : ''}
      ${receipt.remainingBalance !== undefined && receipt.remainingBalance !== null ? `
      <tr>
        <td class="lbl">الرصيد المتبقي بالحساب:</td>
        <td class="val" style="color: ${receipt.remainingBalance > 0 ? '#dc2626' : '#16a34a'};">${Number(receipt.remainingBalance).toLocaleString('en-US')} ${currency}</td>
      </tr>` : ''}
    </table>

    <div class="sig-row">
      <div class="sig-box">
        <div class="sig-title">منظم السند (الموظف المسؤول)</div>
        <div class="sig-line">${escapeHtml(receipt.employeeName || 'الإدارة المالية')}</div>
      </div>
      <div class="sig-box">
        <div class="stamp-circle">خاتم الشركة<br>المعتمد</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">المستلم / الدافع</div>
        <div class="sig-line">${escapeHtml(custName)}</div>
      </div>
    </div>

    <div class="actions">
      <button onclick="window.print()" class="btn btn-print">
        <span>🖨️</span>
        <span>طباعة السند</span>
      </button>
      ${waPhone ? `
        <a href="https://wa.me/${waPhone}" target="_blank" class="btn btn-wa">
          <span>💬</span>
          <span>تواصل مع الشركة عبر واتساب</span>
        </a>
      ` : ''}
    </div>
  </div>

</body>
</html>`;
}

// 5. صفحة حجب صفحات الإدارة في نطاق المعاينة للزبائن
function renderPreviewBlockedHtml(settings) {
  const companyName = settings.companyName || 'رامز عطاطرة';
  const companyPhone = settings.companyPhone || '';
  const cleanPhone = companyPhone.replace(/[^\d+]/g, '');
  const waPhone = cleanPhone.startsWith('0') ? '970' + cleanPhone.slice(1) : cleanPhone;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>بوابة المعاينة الرسمية | ${escapeHtml(companyName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem; text-align: center; }
    .card { background: #1e293b; border: 1.5px solid #334155; border-radius: 18px; padding: 2.5rem 2rem; max-width: 520px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    .icon { font-size: 3.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.45rem; font-weight: 800; margin-bottom: 0.75rem; color: #fff; }
    p { font-size: 0.95rem; color: #94a3b8; line-height: 1.7; margin-bottom: 2rem; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; background: #25D366; color: #fff; text-decoration: none; padding: 0.9rem 1.75rem; border-radius: 12px; font-weight: 700; font-size: 1.05rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>بوابة المعاينة الرسمية للزبائن</h1>
    <p>هذا النطاق مخصص لمعاينة الأصناف، الفواتير، والسندات الرسمية المعتمدة من شركة <strong>${escapeHtml(companyName)}</strong>.<br>لا يمكن الدخول لإدارة النظام أو الكاشير من هذا الرابط لحماية سرية وأمان البيانات.</p>
    ${waPhone ? `<a href="https://wa.me/${waPhone}" target="_blank" class="btn"><span>💬</span><span>تواصل مع الشركة عبر واتساب</span></a>` : ''}
  </div>
</body>
</html>`;
}

// 6. معرض الأصناف العام للزبائن (Public Catalog)
function renderPublicCatalogHtml(products, settings, req) {
  const companyName = settings.companyName || 'رامز عطاطرة';
  const companyPhone = settings.companyPhone || '';
  const currency = settings.currency || 'شيكل';
  const cleanPhone = companyPhone.replace(/[^\d+]/g, '');

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'aboramez1.onrender.com';

  const prods = (products || []).filter(p => p && p.name && (parseFloat(p.sellPrice) > 0 || p.image));

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>معرض الأصناف والمنتجات | ${escapeHtml(companyName)}</title>
  
  <meta property="og:title" content="🛍️ معرض الأصناف والمنتجات - ${escapeHtml(companyName)}">
  <meta property="og:description" content="تصفح أحدث الأصناف والمنتجات المتاحة واطلبها مباشرة عبر واتساب — ${escapeHtml(companyName)}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif; background: #f8fafc; color: #0f172a; direction: rtl; padding-bottom: 3rem; }
    .header { background: #fff; border-bottom: 1.5px solid #e2e8f0; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
    .brand-title { font-size: 1.4rem; font-weight: 900; color: #0f172a; }
    .search-bar-wrap { max-width: 900px; margin: 1.5rem auto 1rem; padding: 0 1rem; }
    .search-input { width: 100%; padding: 0.9rem 1.25rem; font-size: 1rem; font-family: inherit; border: 2px solid #cbd5e1; border-radius: 12px; outline: none; background: #fff; transition: border 0.2s; }
    .search-input:focus { border-color: #2563eb; }
    .grid { max-width: 1200px; margin: 1rem auto; padding: 0 1rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.25rem; }
    .prod-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit; }
    .prod-card:hover { transform: translateY(-3px); box-shadow: 0 12px 25px rgba(0,0,0,0.06); border-color: #93c5fd; }
    .prod-img { width: 100%; aspect-ratio: 1; object-fit: cover; background: #f1f5f9; }
    .prod-info { padding: 1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
    .prod-name { font-size: 1rem; font-weight: 800; color: #0f172a; margin-bottom: 0.4rem; line-height: 1.4; }
    .prod-meta { font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem; }
    .prod-price { font-size: 1.2rem; font-weight: 900; color: #15803d; }
  </style>
</head>
<body>
  <header class="header">
    <div class="brand-title">💼 ${escapeHtml(companyName)}</div>
    ${companyPhone ? `<a href="https://wa.me/${cleanPhone}" target="_blank" style="text-decoration:none; color:#25D366; font-weight:800; font-size:0.95rem;">💬 تواصل واتساب</a>` : ''}
  </header>

  <div class="search-bar-wrap">
    <input type="text" id="searchInput" class="search-input" placeholder="🔍 ابحث عن صنف، ماركة، أو كود..." oninput="filterProds()">
  </div>

  <div class="grid" id="prodsGrid">
    ${prods.map(p => {
      let img = p.image || (Array.isArray(p.images) && p.images[0]) || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=400&auto=format&fit=crop&q=80';
      if (img.startsWith('/')) img = `${protocol}://${host}${img}`;
      const price = parseFloat(p.sellPrice) || 0;
      const pUrl = `/p/${encodeURIComponent(p.id)}`;
      return `
        <a href="${pUrl}" class="prod-card" data-name="${escapeHtml((p.name || '') + ' ' + (p.brand || '') + ' ' + (p.code || '')).toLowerCase()}">
          <img class="prod-img" src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy">
          <div class="prod-info">
            <div>
              <div class="prod-meta">🏷️ ${escapeHtml(p.brand || 'عام')} ${p.code ? `| كود: ${escapeHtml(p.code)}` : ''}</div>
              <div class="prod-name">${escapeHtml(p.name)}</div>
            </div>
            <div class="prod-price">${price > 0 ? price.toLocaleString('en-US') + ' ' + currency : 'سعر خاص'}</div>
          </div>
        </a>
      `;
    }).join('')}
  </div>

  <script>
    function filterProds() {
      const q = document.getElementById('searchInput').value.trim().toLowerCase();
      document.querySelectorAll('.prod-card').forEach(c => {
        const text = c.getAttribute('data-name') || '';
        c.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

module.exports = {
  renderProductPreviewHtml,
  renderInvoicePreviewHtml,
  renderStatementPreviewHtml,
  renderReceiptPreviewHtml,
  renderPreviewBlockedHtml,
  renderPublicCatalogHtml,
  tafqeetArabic
};
