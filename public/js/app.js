/**
 * تطبيق نظام المبيعات وإصدار الفواتير
 * Front-end Application Logic
 */

// دالة حماية النصوص وتنسيق HTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// تنسيق التواريخ بالصيغة المطلوبة تماماً بأرقام إنجليزية: 21-9-2026 الساعة 7:10 مسائاً
function formatAppDateTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'مسائاً' : 'صباحاً';

  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${day}-${month}-${year} الساعة ${hours}:${minutes} ${period}`;
}

// -------------------------------------------------------------
// نافذة تأكيد آمنة وعصرية داخل التطبيق (تتوافق 100% مع بيئة الـ iFrame)
// -------------------------------------------------------------
function showConfirmDialog({ title, message, icon = '⚠️', confirmText = 'تأكيد', cancelText = 'إلغاء', isDanger = true, onConfirm }) {
  const modal = document.getElementById('universalConfirmModal');
  if (!modal) {
    if (onConfirm) onConfirm();
    return;
  }
  const iconEl = document.getElementById('confirmModalIcon');
  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl = document.getElementById('confirmModalMessage');
  const actionBtn = document.getElementById('confirmModalActionBtn');
  const cancelBtn = document.getElementById('confirmModalCancelBtn');

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title || 'تأكيد الإجراء';
  if (msgEl) msgEl.textContent = message || '';

  if (actionBtn) {
    actionBtn.textContent = confirmText;
    actionBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
  }
  if (cancelBtn) {
    cancelBtn.textContent = cancelText;
  }

  const cleanup = () => {
    modal.classList.remove('active');
    if (actionBtn) actionBtn.onclick = null;
    if (cancelBtn) cancelBtn.onclick = null;
  };

  if (cancelBtn) cancelBtn.onclick = cleanup;
  if (actionBtn) {
    actionBtn.onclick = () => {
      cleanup();
      if (onConfirm) onConfirm();
    };
  }

  modal.classList.add('active');
}

// -------------------------------------------------------------
// محرك توليد ملفات PDF رسمي وموحد مع إرسال تيليجرام
// -------------------------------------------------------------
async function generatePdfBlobFromHtml(htmlContent, fileName = 'document.pdf', options = {}) {
  if (typeof html2pdf === 'undefined') {
    throw new Error('مكتبة تصدير الـ PDF (html2pdf.js) غير محملة في المتصفح');
  }

  let resolvedHtml = '';
  if (htmlContent instanceof HTMLElement) {
    resolvedHtml = htmlContent.innerHTML;
  } else if (typeof htmlContent === 'string') {
    const trimmed = htmlContent.trim();
    if ((trimmed.startsWith('#') || trimmed.startsWith('.')) && !trimmed.includes('<')) {
      const el = document.querySelector(trimmed);
      if (el) {
        resolvedHtml = el.innerHTML;
      } else {
        resolvedHtml = htmlContent;
      }
    } else {
      resolvedHtml = htmlContent;
    }
  }

  if (!resolvedHtml || !resolvedHtml.trim()) {
    throw new Error('محتوى المستند المراد تصديره فارغ');
  }

  const isLandscape = options.orientation === 'landscape';
  const targetWidthPx = isLandscape ? 1120 : 794;

  // بناء حاوية محتوى نظيفة ومستقلة بدون أي تموضع شاذ (-10000px) لمنع الشاشات البيضاء أو قطع المحتوى
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-render-root';
  wrapper.style.width = targetWidthPx + 'px';
  wrapper.style.maxWidth = targetWidthPx + 'px';
  wrapper.style.margin = '0 auto';
  wrapper.style.padding = '0';
  wrapper.style.backgroundColor = '#ffffff';
  wrapper.style.color = '#0f172a';
  wrapper.style.direction = 'rtl';
  wrapper.style.display = 'flow-root';
  wrapper.style.boxSizing = 'border-box';
  wrapper.style.position = 'relative';
  wrapper.style.fontFamily = "'Cairo', 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
  wrapper.innerHTML = resolvedHtml;

  // إظهار وتجهيز العناصر المخبأة في النوافذ المنبثقة (Modals/Popups)
  wrapper.querySelectorAll('.modal, .modal-backdrop, .modal-card, .modal-body, .modal-content').forEach(m => {
    m.style.display = 'block';
    m.style.visibility = 'visible';
    m.style.opacity = '1';
    m.style.position = 'static';
    m.style.maxHeight = 'none';
    m.style.overflow = 'visible';
    m.style.margin = '0';
    m.style.padding = '0';
  });

  wrapper.querySelectorAll('[style*="display: none"], [style*="display:none"], [hidden]').forEach(hiddenEl => {
    if (!hiddenEl.classList.contains('no-print')) {
      hiddenEl.style.display = 'block';
      hiddenEl.removeAttribute('hidden');
    }
  });

  // إزالة العناصر غير المراد طباعتها مثل أزرار الإجراءات
  wrapper.querySelectorAll('.no-print').forEach(el => el.remove());

  try {
    // 1. انتظار اكتمال تحميل الخطوط لضمان دقة الرسم
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {}
    }

    // 2. انتظار اكتمال تحميل أي صور داخل المستند
    const images = Array.from(wrapper.querySelectorAll('img'));
    if (images.length > 0) {
      await Promise.all(images.map(img => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 800);
        });
      }));
    }

    // 3. تأخير زمني بسيط (setTimeout) قبل التحويل للسماح للمتصفح برسم عناصر الـ DOM بالكامل وحساب الأبعاد بدقة
    await new Promise(resolve => setTimeout(resolve, options.delay || 300));

    // الهامش الافتراضي 0 لإزالة أي فراغ علوي غير مرغوب فيه لأن قوالب النظام تحتوي على مسافات padding كافية
    const optMargin = options.margin !== undefined ? options.margin : 0;

    const opt = {
      margin: optMargin,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        letterRendering: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        windowWidth: targetWidthPx,
        onclone: function(clonedDoc) {
          // التأكد من أن جميع الحاويات في المستند المستنسخ ظاهرة بدقة وبدون أي فراغ علوي
          const overlays = clonedDoc.querySelectorAll('.html2pdf__overlay');
          overlays.forEach(o => {
            o.style.opacity = '1';
            o.style.visibility = 'visible';
          });
          const containers = clonedDoc.querySelectorAll('.html2pdf__container');
          containers.forEach(c => {
            c.style.opacity = '1';
            c.style.visibility = 'visible';
            c.style.top = '0';
            c.style.marginTop = '0';
            c.style.paddingTop = '0';
          });
          clonedDoc.querySelectorAll('.no-print').forEach(el => el.remove());
        },
        ...(options.html2canvas || {})
      },
      jsPDF: {
        unit: 'mm',
        format: options.format || 'a4',
        orientation: isLandscape ? 'landscape' : 'portrait',
        ...(options.jsPDF || {})
      }
    };

    // ضمان الخصائص المطلوبة دائماً
    opt.image = { type: 'jpeg', quality: 0.98 };
    opt.html2canvas.scale = 2;
    opt.html2canvas.scrollX = 0;
    opt.html2canvas.scrollY = 0;

    // توليد ملف PDF واستخراج الـ Blob المعتمد
    const worker = html2pdf().set(opt).from(wrapper);
    await worker.toPdf();
    const pdf = await worker.get('pdf');

    let blob = null;
    if (pdf && typeof pdf.output === 'function') {
      blob = pdf.output('blob');
    }

    if (!blob || !(blob instanceof Blob) || blob.size < 1000) {
      try {
        blob = await worker.outputPdf('blob');
      } catch (e) {
        console.warn('outputPdf fallback error:', e);
      }
    }

    if (!blob || blob.size < 500) {
      throw new Error('الملف المتولد فارغ، يرجى المحاولة مجدداً');
    }

    return blob;
  } finally {
    // التنظيف
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }
}

// دالة لتنزيل تقرير الجرد مباشرة كملف PDF
async function downloadInventoryPdfDirectly() {
  const modal = document.getElementById('inventoryReportModal');
  const printableArea = document.getElementById('printableInventoryReportArea');
  if (!modal || !modal.classList.contains('active')) {
    openInventoryReportModal();
  }

  showToast('جاري تجهيز وتحميل ملف PDF لجرد المخزون...', 'info');

  try {
    const html = printableArea ? printableArea.innerHTML : '';
    if (!html) {
      showToast('تعذر استخراج بيانات التقرير', 'error');
      return;
    }
    const fileName = `تقرير_جرد_${Date.now()}.pdf`;
    const blob = await generatePdfBlobFromHtml(html, fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    showToast('🎉 تم تحميل ملف تقرير الجرد PDF بنجاح!', 'success');
  } catch (err) {
    showToast('خطأ أثناء تحميل ملف الجرد PDF: ' + err.message, 'error');
  }
}

async function downloadCurrentInvoicePdf() {
  if (!state.currentViewingInvoice) return;
  const inv = state.currentViewingInvoice;
  const fileName = `فاتورة_${inv.invoiceNumber || inv.id}.pdf`;
  showToast('جاري تجهيز وتحميل الفاتورة بصيغة PDF...', 'info');
  try {
    const html = buildPrintableInvoiceHtml(inv);
    const blob = await generatePdfBlobFromHtml(html, fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    showToast('🎉 تم تحميل ملف الفاتورة PDF بنجاح!', 'success');
  } catch (err) {
    showToast('خطأ أثناء تحميل ملف الفاتورة PDF: ' + err.message, 'error');
  }
}

async function downloadCurrentReceiptPdf() {
  if (!state.currentViewingReceipt) return;
  const r = state.currentViewingReceipt;
  const fileName = `سند_قبض_${r.receiptNumber}.pdf`;
  showToast('جاري تجهيز وتحميل سند القبض بصيغة PDF...', 'info');
  try {
    const html = buildPrintableReceiptHtml(r);
    const blob = await generatePdfBlobFromHtml(html, fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    showToast('🎉 تم تحميل سند القبض PDF بنجاح!', 'success');
  } catch (err) {
    showToast('خطأ أثناء تحميل سند القبض PDF: ' + err.message, 'error');
  }
}

async function sendPdfDocumentToTelegram(pdfBlob, fileName, caption) {
  try {
    if (!pdfBlob || !(pdfBlob instanceof Blob) || pdfBlob.size < 500) {
      throw new Error('ملف الـ PDF غير صالح أو فارغ الحجم');
    }

    const formData = new FormData();
    formData.append('pdfFile', pdfBlob, fileName);
    formData.append('fileName', fileName);
    formData.append('caption', caption || '');

    const res = await fetch('/api/telegram/send-pdf-document', {
      method: 'POST',
      body: formData
    });
    return await res.json();
  } catch (err) {
    console.error('sendPdfDocumentToTelegram error:', err);
    return { success: false, error: err.message };
  }
}

// بناء كشف رسمي لفاتورة مبيعات أو مشتريات بصيغة PDF معتمد ومتوافق 100% مع كافة المحركات
function buildPrintableInvoiceHtml(inv) {
  const cur = state.settings.currency || 'شيكل';
  const isPurchase = inv.invoiceType === 'purchase';
  const typeTitle = isPurchase ? 'فاتورة مشتريات وتوريد مخزون' : 'فاتورة مبيعات ضريبية';
  const dateStr = formatAppDateTime(inv.createdAt);

  const itemsHtml = (inv.items || []).map((item, idx) => {
    const qty = item.quantity || 1;
    const price = isPurchase ? (item.costPrice || 0) : (item.sellPrice || 0);
    const total = qty * price;
    return `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; font-weight: 700; width: 40px;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right;">
          <div style="font-weight: 800; color: #0f172a; font-size: 14px;">${escapeHtml(item.productName)}</div>
          ${item.code ? `<div style="font-size: 12px; color: #64748b; font-family: monospace;">كود: ${escapeHtml(item.code)}</div>` : ''}
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; font-weight: 800; font-size: 15px; width: 80px;">${qty}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-weight: 700; width: 110px;">${price.toLocaleString('en-US')} ${cur}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-weight: 800; color: #0f172a; width: 130px;">${total.toLocaleString('en-US')} ${cur}</td>
      </tr>
    `;
  }).join('');

  const totalAmount = inv.summary?.totalAmount || 0;
  const words = tafqeetArabic(totalAmount, cur);

  let paymentBlock = '';
  if (!isPurchase && inv.paymentMethod === 'installments') {
    const inst = inv.installmentDetails || {};
    paymentBlock = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 14px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 6px; font-size: 13px;">
        <tr>
          <td style="padding: 10px 14px;">
            <strong style="color: #b45309; display: block; margin-bottom: 6px;">⏳ تفاصيل نظام الأقساط المجدولة:</strong>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 3px 0;">• الدفعة الأولى المسددة: <strong>${(inst.downPayment || 0).toLocaleString('en-US')} ${cur}</strong></td>
                <td style="padding: 3px 0;">• المبلغ المتبقي المستحق: <strong style="color: #dc2626;">${(inst.remainingAmount || 0).toLocaleString('en-US')} ${cur}</strong></td>
                <td style="padding: 3px 0;">• مدة السداد المتفق عليها: <strong>${escapeHtml(inst.duration || 'غير محدد')}</strong></td>
              </tr>
            </table>
            ${inst.scheduleNotes ? `<div style="margin-top: 4px;">• ملاحظات الأقساط: ${escapeHtml(inst.scheduleNotes)}</div>` : ''}
          </td>
        </tr>
      </table>
    `;
  }

  return `
    <div style="padding: 24px; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; direction: rtl; color: #0f172a; line-height: 1.5; background: #ffffff;">
      <!-- Header -->
      <table style="width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px;">
        <tr>
          <td style="vertical-align: middle; text-align: right; width: 60%;">
            <table style="border-collapse: collapse;">
              <tr>
                <td style="font-size: 36px; vertical-align: middle; padding-left: 12px; width: 45px;">💼</td>
                <td style="vertical-align: middle;">
                  <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h1>
                  <div style="font-size: 13px; color: #475569; margin-top: 3px;">
                    ${escapeHtml(state.settings.companyAddress || 'المركز التجاري الرئيسي')} | هاتف: ${escapeHtml(state.settings.companyPhone || '')}
                  </div>
                </td>
              </tr>
            </table>
          </td>
          <td style="vertical-align: middle; text-align: left; width: 40%;">
            <div style="display: inline-block; background: ${isPurchase ? '#ecfdf5' : '#eff6ff'}; color: ${isPurchase ? '#047857' : '#1d4ed8'}; border: 1.5px solid ${isPurchase ? '#a7f3d0' : '#bfdbfe'}; font-size: 13px; font-weight: 800; padding: 4px 12px; border-radius: 6px;">
              ${typeTitle}
            </div>
            <div style="margin-top: 4px; font-weight: 900; font-family: monospace; font-size: 19px; color: #0f172a;">
              #${inv.invoiceNumber || inv.id}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${dateStr}</div>
          </td>
        </tr>
      </table>

      <!-- Customer & Invoice Info Table -->
      <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 18px; font-size: 14px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding: 12px 14px; border-left: 1px solid #e2e8f0;">
            <div style="margin-bottom: 4px;">
              <span style="color: #64748b;">${isPurchase ? 'المورد / التوريد:' : 'الزبون / السيد:'}</span> 
              <strong style="font-size: 15px; color: #0f172a;">${escapeHtml(inv.customerName)}</strong>
            </div>
            ${inv.customerPhone ? `<div style="margin-bottom: 4px;"><span style="color: #64748b;">رقم الهاتف:</span> <strong style="direction: ltr; display: inline-block;">${escapeHtml(inv.customerPhone)}</strong></div>` : ''}
            ${inv.customerSystemNumber ? `<div><span style="color: #64748b;">رقم الحساب بالنظام:</span> <strong>#${escapeHtml(inv.customerSystemNumber)}</strong></div>` : ''}
          </td>
          <td style="width: 50%; vertical-align: top; padding: 12px 14px;">
            <div style="margin-bottom: 6px;"><span style="color: #64748b;">الموظف المحرر:</span> <strong>${escapeHtml(inv.employeeName || 'غير محدد')}</strong></div>
            <div><span style="color: #64748b;">طريقة الدفع:</span> <strong>${isPurchase ? 'نقداً (مشتريات)' : (inv.paymentMethod === 'installments' ? 'أقساط مجدولة' : 'نقداً (كاش)')}</strong></div>
          </td>
        </tr>
      </table>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; margin-bottom: 18px;">
        <thead>
          <tr style="background: #e2e8f0; color: #0f172a;">
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 40px; text-align: center;">#</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; text-align: right;">الصنف / المنتج</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 80px; text-align: center;">الكمية</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 110px; text-align: left;">السعر</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 130px; text-align: left;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Total & Words Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
        <tr>
          <td style="vertical-align: top; padding-left: 14px; width: 58%;">
            <div style="padding: 12px 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13.5px;">
              <div style="color: #047857; font-weight: 700;">المبلغ كتابةً:</div>
              <div style="font-weight: 800; font-size: 14.5px; margin-top: 3px;">${words}</div>
              ${inv.notes ? `<div style="margin-top: 6px; color: #475569; font-size: 12.5px;"><strong>ملاحظات:</strong> ${escapeHtml(inv.notes)}</div>` : ''}
            </div>
          </td>
          <td style="vertical-align: top; width: 42%;">
            <table style="width: 100%; border-collapse: collapse; background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 8px;">
              <tr>
                <td style="padding: 8px 12px; font-weight: 700; font-size: 13px; border-bottom: 1px solid #cbd5e1;">عدد القطع الإجمالي:</td>
                <td style="padding: 8px 12px; text-align: left; font-weight: 800; font-size: 13.5px; border-bottom: 1px solid #cbd5e1;">${(inv.summary?.totalQuantity || 0)} قطعة</td>
              </tr>
              <tr style="background: #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: 900; font-size: 15px; color: #047857;">المجموع النهائي:</td>
                <td style="padding: 10px 12px; text-align: left; font-weight: 900; font-size: 17px; color: #047857;">${totalAmount.toLocaleString('en-US')} ${cur}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      ${paymentBlock}

      <!-- Footer Signatures -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 26px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 12.5px; color: #475569;">
        <tr>
          <td style="padding-top: 10px; width: 33.33%;">توقيع المستلم: _________________</td>
          <td style="padding-top: 10px; text-align: center; width: 33.33%;">اعتماد المحل / الشركة: _________________</td>
          <td style="padding-top: 10px; text-align: left; width: 33.33%;">${escapeHtml(state.settings.invoiceFooterText || 'بضاعة الشركة مكفولة')}</td>
        </tr>
      </table>
    </div>
  `;
}

// بناء كشف رسمي لسند قبض مالي بصيغة PDF معتمد ومتوافق 100%
function buildPrintableReceiptHtml(receipt) {
  const cur = state.settings.currency || 'شيكل';
  const words = tafqeetArabic(receipt.amount, cur);
  const dateStr = formatAppDateTime(receipt.createdAt);
  const methodLabel = {
    cash: 'نقداً (Cash)',
    transfer: 'تحويل بنكي (Bank Transfer)',
    check: 'شيك مصرفي (Bank Cheque)'
  }[receipt.paymentMethod] || 'نقداً';

  const prevBal = parseFloat(receipt.previousBalance) || 0;
  const remBal = parseFloat(receipt.remainingBalance) || 0;

  return `
    <div style="padding: 24px; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; direction: rtl; color: #0f172a; line-height: 1.6; border: 2px solid #0f172a; border-radius: 8px; background: #ffffff;">
      <!-- Header -->
      <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 18px;">
        <tr>
          <td style="vertical-align: middle; text-align: right; width: 60%;">
            <table style="border-collapse: collapse;">
              <tr>
                <td style="font-size: 38px; vertical-align: middle; padding-left: 12px; width: 45px;">💼</td>
                <td style="vertical-align: middle;">
                  <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h1>
                  <div style="font-size: 13px; color: #475569; margin-top: 3px;">
                    ${escapeHtml(state.settings.companyAddress || 'المركز التجاري الرئيسي')} | هاتف: ${escapeHtml(state.settings.companyPhone || '')}
                  </div>
                </td>
              </tr>
            </table>
          </td>
          <td style="vertical-align: middle; text-align: left; width: 40%;">
            <div style="display: inline-block; background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; padding: 5px 14px; border-radius: 6px; font-weight: 800; font-size: 14.5px;">
              سند قبض مالي معتمد
            </div>
            <div style="margin-top: 5px; font-weight: 900; font-family: monospace; font-size: 19px; color: #0f172a;">
              رقم السند: #${receipt.receiptNumber}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">التاريخ: ${dateStr}</div>
          </td>
        </tr>
      </table>

      <!-- Big Amount Banner -->
      <table style="width: 100%; border-collapse: collapse; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; margin-bottom: 18px;">
        <tr>
          <td style="padding: 12px 18px; font-size: 15px; font-weight: 700; color: #166534; text-align: right;">المبلغ المقبوض:</td>
          <td style="padding: 12px 18px; font-size: 22px; font-weight: 900; color: #15803d; text-align: left;">${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</td>
        </tr>
      </table>

      <!-- Receipt Details Table -->
      <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 18px; font-size: 14px;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; width: 170px; color: #64748b; font-weight: 700;">وصلنا من السيد / السادة:</td>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; font-weight: 800; color: #0f172a;">${escapeHtml(receipt.customerName)} ${receipt.customerSystemNumber ? `[رقم الحساب: #${escapeHtml(receipt.customerSystemNumber)}]` : ''} ${receipt.customerPhone ? `(هاتف: ${escapeHtml(receipt.customerPhone)})` : ''}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; width: 170px; color: #64748b; font-weight: 700;">مبلغ وقدره بالأحرف:</td>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; font-weight: 800; color: #047857;">${words || `${receipt.amount} ${cur}`}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; width: 170px; color: #64748b; font-weight: 700;">طريقة الدفع:</td>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; font-weight: 800;">${methodLabel}</td>
        </tr>
        ${receipt.description ? `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; width: 170px; color: #64748b; font-weight: 700;">وذلك لقاء (البيان):</td>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; font-weight: 700; color: #0f172a;">${escapeHtml(receipt.description)}</td>
        </tr>` : ''}
        ${(prevBal > 0 || remBal >= 0) ? `
        <tr style="background: #f8fafc;">
          <td colspan="2" style="padding: 10px 14px; font-size: 13.5px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td>الدين السابق قبل السند: <strong>${prevBal.toLocaleString('en-US')} ${cur}</strong></td>
                <td style="text-align: center;">المسدد الآن: <strong style="color: #047857;">-${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</strong></td>
                <td style="text-align: left;">الرصيد المتبقي بذمته: <strong style="color: ${remBal > 0 ? '#dc2626' : '#059669'}; font-size: 14.5px;">${remBal.toLocaleString('en-US')} ${cur}</strong></td>
              </tr>
            </table>
          </td>
        </tr>` : ''}
        ${receipt.notes ? `
        <tr>
          <td style="padding: 10px 14px; width: 170px; color: #64748b; font-weight: 700;">ملاحظات:</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #475569;">${escapeHtml(receipt.notes)}</td>
        </tr>` : ''}
      </table>

      <!-- Signatures Table -->
      <table style="width: 100%; border-collapse: collapse; border-top: 1.5px solid #cbd5e1; margin-top: 26px; padding-top: 16px; text-align: center; font-size: 13px; color: #475569;">
        <tr>
          <td style="width: 33.33%; padding: 10px; vertical-align: top;">
            <div>اسم وتوقيع المستلم</div>
            <div style="margin-top: 20px; font-weight: 800; color: #0f172a;">${escapeHtml(receipt.employeeName || 'الموظف المسؤول')}</div>
          </td>
          <td style="width: 33.33%; padding: 10px; vertical-align: top;">
            <div>توقيع الزبون / المودع</div>
            <div style="margin-top: 20px;">_________________</div>
          </td>
          <td style="width: 33.33%; padding: 10px; vertical-align: top;">
            <div>ختم واعتماد الشركة</div>
            <div style="margin-top: 20px;">_________________</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

// بناء محضر جرد المخزون الفعلي وتعديل الكميات بصيغة PDF
function buildInventoryAuditHtml(modifiedItems, editorName) {
  const nowStr = formatAppDateTime(new Date());

  const rows = modifiedItems.map((item, idx) => {
    const diff = item.diff;
    const diffSign = diff > 0 ? `+${diff}` : `${diff}`;
    const diffColor = diff > 0 ? '#047857' : '#dc2626';
    return `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: center; font-weight: 700;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; font-family: monospace; font-weight: 800; text-align: center;">${escapeHtml(item.code || '--')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; font-weight: 800; color: #0f172a;">${escapeHtml(item.name)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: center; font-weight: 700; color: #64748b;">${item.oldStock}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: center; font-weight: 900; font-size: 1rem; color: #0f172a;">${item.newStock}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: center; font-weight: 800; color: ${diffColor};">${diffSign}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="padding: 2rem; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; direction: rtl; color: #0f172a; line-height: 1.6;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
        <div>
          <h1 style="font-size: 1.6rem; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h1>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">محضر توثيق وتعديل جرد المخزون الفعلي</div>
        </div>
        <div style="text-align: left;">
          <div style="background: #f0fdf4; color: #166534; border: 1.5px solid #86efac; padding: 0.35rem 0.85rem; border-radius: 6px; font-weight: 800;">
            محضر جرد معتمد
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.3rem;">التاريخ: ${nowStr}</div>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.92rem; display: flex; justify-content: space-between;">
        <div>القائم بالجرد والتوثيق: <strong style="font-size: 1rem; color: #065f46;">${escapeHtml(editorName)}</strong></div>
        <div>عدد الأصناف المعدلة: <strong>${modifiedItems.length} صنف</strong></div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-bottom: 1.5rem;">
        <thead>
          <tr style="background: #e2e8f0; color: #0f172a;">
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 40px; text-align: center;">#</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 110px; text-align: center;">كود الصنف</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; text-align: right;">اسم الصنف</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 90px; text-align: center;">الكمية السابقة</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 100px; text-align: center;">الكمية بعد الجرد</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 90px; text-align: center;">فارق الجرد</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="margin-top: 2.5rem; border-top: 1px solid #cbd5e1; padding-top: 1rem; display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569;">
        <div>توقيع القائم بالجرد: <strong>${escapeHtml(editorName)}</strong></div>
        <div>اعتماد إدارة المستودع: _________________</div>
        <div>نظام إدارة المخزون والمبيعات</div>
      </div>
    </div>
  `;
}

// بناء التقرير المالي والأرباح التنفيذي بصيغة PDF
function buildFinancialReportHtml(stats, periodTitle) {
  const cur = state.settings.currency || 'شيكل';
  const nowStr = formatAppDateTime(new Date());

  return `
    <div style="padding: 2rem; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; direction: rtl; color: #0f172a; line-height: 1.6;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
        <div>
          <h1 style="font-size: 1.6rem; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h1>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">التقرير المالي التنفيذي الشامل وحساب الأرباح والمبيعات</div>
        </div>
        <div style="text-align: left;">
          <div style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; padding: 0.35rem 0.9rem; border-radius: 6px; font-weight: 800; font-size: 0.95rem;">
            فترة التقرير: ${escapeHtml(periodTitle || 'كل الأوقات')}
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.3rem;">تاريخ الاستخراج: ${nowStr}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem;">
          <span style="font-size: 0.85rem; color: #64748b; font-weight: 700; display: block;">💵 إجمالي المبيعات المحققة</span>
          <strong style="font-size: 1.45rem; color: #0f172a; display: block; margin-top: 0.25rem;">${(stats.totalSales || 0).toLocaleString('en-US')} ${cur}</strong>
          <small style="color: #64748b;">من إجمالي ${stats.totalInvoicesCount || 0} فاتورة صادرة</small>
        </div>

        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem;">
          <span style="font-size: 0.85rem; color: #64748b; font-weight: 700; display: block;">📉 تكلفة البضاعة المباعة (رأس المال)</span>
          <strong style="font-size: 1.45rem; color: #475569; display: block; margin-top: 0.25rem;">${(stats.totalCost || 0).toLocaleString('en-US')} ${cur}</strong>
          <small style="color: #64748b;">رأس المال المسترد من المبيعات</small>
        </div>

        <div style="background: #ecfdf5; border: 1.5px solid #86efac; border-radius: 8px; padding: 1rem;">
          <span style="font-size: 0.85rem; color: #065f46; font-weight: 700; display: block;">📈 صافي الأرباح المحققة</span>
          <strong style="font-size: 1.45rem; color: #047857; display: block; margin-top: 0.25rem;">+${(stats.totalProfit || 0).toLocaleString('en-US')} ${cur}</strong>
          <small style="color: #059669; font-weight: 700;">هامش ربح: ${stats.profitMarginPercentage || 0}%</small>
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">💳 تفاصيل التحصيل وطرق الدفع:</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.92rem;">
          <div style="background: #f8fafc; padding: 0.85rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div>• مبيعات نقدية فورية (كاش): <strong>${(stats.cashSales || 0).toLocaleString('en-US')} ${cur}</strong></div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">تم استلامها بالكامل دون ديون</div>
          </div>
          <div style="background: #fffbeb; padding: 0.85rem; border-radius: 6px; border: 1px solid #fde68a;">
            <div>• إجمالي مبيعات الأقساط: <strong>${(stats.installmentsTotal || 0).toLocaleString('en-US')} ${cur}</strong></div>
            <div style="margin-top: 0.25rem;">  - الدفعة الأولى المحصلة: <strong>${(stats.installmentsDownPayments || 0).toLocaleString('en-US')} ${cur}</strong></div>
            <div style="color: #dc2626; font-weight: 700;">  - المتبقي للتحصيل بذمة الزبائن: <strong>${(stats.installmentsRemaining || 0).toLocaleString('en-US')} ${cur}</strong></div>
          </div>
        </div>
      </div>

      <div style="background: #f0fdfa; border: 1.5px solid #99f6e4; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 0.75rem 0; font-size: 1.05rem; font-weight: 800; color: #115e59;">🏬 تقييم رأس مال المخزون الحالي بالمستودع:</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.92rem;">
          <div>• إجمالي رأس المال المخزن: <strong style="color: #0f766e;">${(stats.totalInventoryCapital || 0).toLocaleString('en-US')} ${cur}</strong></div>
          <div>• عدد القطع المتوفرة: <strong>${(stats.totalStockUnits || 0).toLocaleString('en-US')} قطعة</strong></div>
          <div>• القيمة البيعية المتوقعة: <strong>${(stats.totalInventoryRetail || 0).toLocaleString('en-US')} ${cur}</strong></div>
        </div>
      </div>

      <div style="margin-top: 2.5rem; border-top: 1px solid #cbd5e1; padding-top: 1rem; display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569;">
        <div>المسؤول المالي: _________________</div>
        <div>اعتماد المدير العام: _________________</div>
        <div>تاريخ الاعتماد: ${nowStr}</div>
      </div>
    </div>
  `;
}

// إرسال ملف PDF الفاتورة إلى تيليجرام
async function sendInvoicePdfToTelegram(invoice) {
  try {
    const isPurchase = invoice.invoiceType === 'purchase';
    const html = buildPrintableInvoiceHtml(invoice);
    const fileName = `فاتورة_${invoice.invoiceNumber || invoice.id}.pdf`;
    const pdfBlob = await generatePdfBlobFromHtml(html, fileName);
    const cur = state.settings.currency || 'شيكل';
    const totalAmount = invoice.summary?.totalAmount || 0;

    const caption = 
`📄 <b>فاتورة ${isPurchase ? 'مشتريات وتوريد' : 'مبيعات'} #${invoice.invoiceNumber || invoice.id} (ملف PDF رسمي)</b>
🏢 <b>${state.settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
👤 <b>${isPurchase ? 'المورد:' : 'الزبون:'}</b> ${invoice.customerName}
💰 <b>إجمالي الفاتورة:</b> <b>${totalAmount.toLocaleString('en-US')} ${cur}</b>
📅 <b>التاريخ:</b> ${formatAppDateTime(invoice.createdAt)}
<i>📎 مرفق أعلاه ملف الفاتورة الرسمي بصيغة PDF جاهز للطباعة.</i>`;

    await sendPdfDocumentToTelegram(pdfBlob, fileName, caption);
  } catch (err) {
    console.warn('sendInvoicePdfToTelegram error:', err);
  }
}

// إرسال ملف PDF سند القبض إلى تيليجرام
async function sendReceiptPdfToTelegram(receipt) {
  try {
    const html = buildPrintableReceiptHtml(receipt);
    const fileName = `سند_قبض_${receipt.receiptNumber}.pdf`;
    const pdfBlob = await generatePdfBlobFromHtml(html, fileName);
    const cur = state.settings.currency || 'شيكل';

    const caption = 
`📄 <b>سند قبض مالي معتمد #${receipt.receiptNumber} (ملف PDF رسمي)</b>
🏢 <b>${state.settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
👤 <b>الزبون:</b> ${receipt.customerName}
💰 <b>المبلغ المقبوض:</b> 🟢 <b>${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</b>
📅 <b>التاريخ:</b> ${formatAppDateTime(receipt.createdAt)}
<i>📎 مرفق أعلاه ملف سند القبض الرسمي المعتمد بصيغة PDF.</i>`;

    await sendPdfDocumentToTelegram(pdfBlob, fileName, caption);
  } catch (err) {
    console.warn('sendReceiptPdfToTelegram error:', err);
  }
}

// إرسال ملف PDF محضر الجرد إلى تيليجرام
async function sendInventoryAuditPdfToTelegram(modifiedDetails, editorName) {
  try {
    const html = buildInventoryAuditHtml(modifiedDetails, editorName);
    const fileName = `محضر_جرد_${Date.now()}.pdf`;
    const pdfBlob = await generatePdfBlobFromHtml(html, fileName);

    const caption = 
`📄 <b>محضر جرد وتحديث كميات المخزون (ملف PDF رسمي)</b>
🏢 <b>${state.settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
👨‍💼 <b>القائم بالجرد:</b> <b>${editorName}</b>
🔢 <b>الأصناف المعدلة:</b> <b>${modifiedDetails.length} صنف</b>
🕐 <b>الوقت:</b> ${formatAppDateTime(new Date())}
<i>📎 مرفق أعلاه كشف الجرد التفصيلي بالكميات السابقة والفعلية والفروقات.</i>`;

    await sendPdfDocumentToTelegram(pdfBlob, fileName, caption);
  } catch (err) {
    console.warn('sendInventoryAuditPdfToTelegram error:', err);
  }
}

// -------------------------------------------------------------
// توحيد وتطبيع النصوص العربية والإنجليزية لمطابقة الماركات والبحث الذكي
// -------------------------------------------------------------
function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة الحركات والتنوين
    .replace(/[إأآا]/g, 'ا')               // توحيد أشكال الألف
    .replace(/ة/g, 'ه')                    // توحيد التاء المربوطة
    .replace(/ى/g, 'ي')                    // توحيد الياء
    // توحيد المرادفات والماركات المطلوبة بدقة تامة
    .replace(/سيمفير/g, 'سمفير')
    .replace(/simfer/gi, 'سمفير')
    .replace(/مانجر(\s*هوم)?/g, 'منجر هوم')
    .replace(/منجر(\s*هوم)?/g, 'منجر هوم')
    .replace(/manger(\s*home)?/gi, 'منجر هوم')
    .replace(/\braf\b/gi, 'راف')
    .replace(/لوكسور/g, 'لوكسر')
    .replace(/luxor/gi, 'لوكسر')
    .replace(/زاكاش/g, 'زكش')
    .replace(/زكاش/g, 'زكش')
    .replace(/zacash/gi, 'زكش')
    .replace(/لورنس/g, 'لورنس')
    .replace(/lawrence/gi, 'لورنس')
    .replace(/يونيفرسال/g, 'يونيفرسال')
    .replace(/universal/gi, 'يونيفرسال')
    .replace(/ال\s*جي/g, 'lg')
    .replace(/سامسونج/g, 'سامسونج')
    .replace(/samsung/gi, 'سامسونج')
    .replace(/\s+/g, ' ')
    .trim();
}

// دالة فحص مطابقة كلمة مع مراعاة حدود الكلمات العربية لعدم الخلط بين "راف" و "كرافيت/أطراف/كرافت"
function matchArabicTerm(target, term) {
  if (!target || !term) return false;
  if (term === 'راف') {
    return /(?:^|[^\u0621-\u064A])راف(?:[^\u0621-\u064A]|$)/i.test(target);
  }
  return target.includes(term);
}

// حالة التطبيق العامة (Global State)
const state = {
  products: [],
  cart: [],
  invoices: [],
  receipts: [],
  settings: {
    companyName: "رامز عطاطرة",
    companyPhone: "059-1234567",
    companyAddress: "المركز التجاري الرئيسي",
    currency: "شيكل",
    telegramBotToken: "",
    telegramChatId: "",
    invoiceFooterText: "شكراً لتعاملكم معنا"
  },
  currentPaymentMethod: 'cash',
  invoiceType: 'sales', // 'sales' | 'purchase'
  isAddingProductForInvoice: false,
  customers: [],
  customerDebtsSearch: '',
  selectedInvoiceCustomer: null,
  activeMainCategory: 'all', // 'all' | 'أجهزة كهربائية كبيرة' | 'أدوات مطبخ' | 'أدوات منزل' | 'أدوات شخصية' | 'أخرى'
  activeCategory: 'all',     // التصنيف الفرعي أو 'all'
  activeBrand: 'all',        // فلتر الماركة بالكتالوج
  catalogBrandTabFilter: 'all', // 'all' | 'popular' | 'ar_1' | 'ar_2' | 'ar_3' | 'en'
  catalogBrandSearchTerm: '',
  catalogBrandsViewMode: 'ribbon', // 'ribbon' | 'grid'
  catalogSearch: '',
  invoicesSearch: '',
  invoicesFilter: 'all',
  currentViewingInvoice: null,
  printMode: 'customer', // 'customer' أو 'internal'
  catalogPageSize: 36,
  catalogCurrentPage: 1,

  // سندات القبض
  currentViewingReceipt: null,
  receiptsSearch: '',

  // الجرد والمخزون
  inventorySearch: '',
  inventoryCategory: 'all',
  inventoryBrand: 'all',     // فلتر الماركة بالجرد
  inventoryBrandTabFilter: 'all',
  inventoryBrandSearchTerm: '',
  inventoryBrandsViewMode: 'ribbon',
  inventoryQuickFilter: 'all', // 'all' | 'modified' | 'zero' | 'low'
  inventoryPendingUpdates: new Map(), // productId -> newStock
  inventoryPageSize: 40,
  inventoryCurrentPage: 1,

  // حماية الإعدادات بكلمة السر (99199)
  settingsUnlocked: false,

  // فلترة المدة الزمنية للإحصائيات
  dashboardPeriod: 'all',
  dashboardStartDate: '',
  dashboardEndDate: ''
};

// تشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  updateDateTimeDisplay();
  setInterval(updateDateTimeDisplay, 60000);

  // استرجاع اسم الموظف الأخير من الذاكرة المحلية للتسهيل
  const lastEmployee = localStorage.getItem('last_employee_name');
  if (lastEmployee) {
    const empInput = document.getElementById('invEmployeeName');
    if (empInput) empInput.value = lastEmployee;
    const rcpInput = document.getElementById('rcpEmployeeName');
    if (rcpInput) rcpInput.value = lastEmployee;
    const auditInput = document.getElementById('invAuditEmployeeName');
    if (auditInput) auditInput.value = lastEmployee;
    const floatingAuditInput = document.getElementById('floatingInvAuditEmployeeName');
    if (floatingAuditInput) floatingAuditInput.value = lastEmployee;
  }

  // تطبيق حالة طي شبكة الماركات المحفوظة
  applyStoredBrandCollapseStates();

  // إعداد التنقل بين التبويبات
  setupNavigation();

  // إعداد البحث في الكتالوج والفواتير
  setupSearchListeners();

  // إعداد البحث المرئي الذكي عن المنتجات
  setupLiveProductSearch();

  // تحديث شريط الفاتورة العائم
  updateFloatingCartUI();

  // جلب البيانات من الخادم
  await loadSettings();
  await loadProducts();
  await loadInvoices();
  await loadReceipts();
  await loadCustomers();
  await loadDashboard();
}

// -------------------------------------------------------------
// إدارة التبويبات والتاريخ مع حماية الإعدادات
// -------------------------------------------------------------
const SETTINGS_PASSWORD = '99199';

function openSettingsPasswordModal() {
  const modal = document.getElementById('settingsPasswordModal');
  const input = document.getElementById('settingsPasswordInput');
  const err = document.getElementById('settingsPasswordError');
  if (modal) modal.style.display = 'flex';
  if (err) err.style.display = 'none';
  if (input) {
    input.value = '';
    input.type = 'password';
    const btn = document.getElementById('btnToggleEye');
    if (btn) btn.textContent = '👁️';
    setTimeout(() => input.focus(), 150);
  }
}

function closeSettingsPasswordModal() {
  const modal = document.getElementById('settingsPasswordModal');
  if (modal) modal.style.display = 'none';
}

function verifySettingsPassword() {
  const input = document.getElementById('settingsPasswordInput');
  const err = document.getElementById('settingsPasswordError');
  if (!input) return;

  const entered = input.value.trim();
  if (entered === SETTINGS_PASSWORD) {
    state.settingsUnlocked = true;
    closeSettingsPasswordModal();
    actuallySwitchTab('settings');
    showToast('تم التحقق بنجاح! مرحباً بك في الإعدادات 🔓', 'success');
  } else {
    if (err) err.style.display = 'flex';
    input.classList.add('pin-shake');
    setTimeout(() => input.classList.remove('pin-shake'), 600);
    input.select();
  }
}

function lockSettings() {
  state.settingsUnlocked = false;
  switchTab('catalog');
  showToast('تم قفل الإعدادات بنجاح 🔒', 'info');
}

function toggleSettingsPasswordVisibility() {
  const input = document.getElementById('settingsPasswordInput');
  const btn = document.getElementById('btnToggleEye');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
}

function setupNavigation() {
  const tabBtns = document.querySelectorAll('.nav-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  // فحص حماية تبويب الإعدادات بكلمة السر 99199
  if (tabId === 'settings' && !state.settingsUnlocked) {
    openSettingsPasswordModal();
    return;
  }
  actuallySwitchTab(tabId);
}

function actuallySwitchTab(tabId) {
  // إلغاء تفعيل الأزرار
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // إخفاء وإظهار المحتوى
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  // تحديث البيانات بحسب التبويب
  if (tabId === 'invoices-list') {
    loadInvoices();
  } else if (tabId === 'dashboard') {
    loadDashboard();
  } else if (tabId === 'catalog') {
    loadProducts().then(() => {
      renderBrandsRibbon('catalog');
      renderCatalog();
    });
  } else if (tabId === 'create-invoice') {
    updateInvoiceDropdown();
  } else if (tabId === 'receipts') {
    loadReceipts();
    const lastEmp = localStorage.getItem('last_employee_name');
    const rcpEmp = document.getElementById('rcpEmployeeName');
    if (lastEmp && rcpEmp && !rcpEmp.value) rcpEmp.value = lastEmp;
  } else if (tabId === 'customers') {
    loadCustomers().then(() => renderCustomerTab());
  } else if (tabId === 'inventory') {
    loadProducts().then(() => {
      renderBrandsRibbon('inventory');
      renderInventoryList();
    });
    const lastEmp = localStorage.getItem('last_employee_name');
    const auditEmp = document.getElementById('invAuditEmployeeName');
    if (lastEmp && auditEmp && !auditEmp.value) auditEmp.value = lastEmp;
  }

  // إظهار أو إخفاء شريط الجرد العائم
  const floatingBar = document.getElementById('inventoryFloatingBar');
  if (floatingBar) {
    floatingBar.style.display = (tabId === 'inventory') ? 'flex' : 'none';
  }
}

function updateDateTimeDisplay() {
  const el = document.getElementById('currentDateDisplay');
  if (el) el.textContent = formatAppDateTime(new Date());
}

// -------------------------------------------------------------
// إدارة الإعدادات والربط
// -------------------------------------------------------------
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      state.settings = data.settings;
      applySettingsToUI();
    }
  } catch (err) {
    console.error('فشل جلب الإعدادات:', err);
  }
}

function applySettingsToUI() {
  const { companyName, companyPhone, companyAddress, currency, telegramBotToken, telegramChatId, invoiceFooterText } = state.settings;

  // رأس الصفحة
  const brandEl = document.getElementById('headerCompanyName');
  if (brandEl) brandEl.textContent = companyName;

  // شارة تيليجرام
  const tgBadge = document.getElementById('telegramHeaderBadge');
  const tgText = document.getElementById('telegramStatusText');
  const tgBanner = document.getElementById('telegramAlertBanner');

  const isTgConfigured = !!(telegramBotToken && telegramChatId);

  if (isTgConfigured) {
    if (tgBadge) tgBadge.className = 'header-info-badge badge-telegram';
    if (tgText) tgText.textContent = 'تيليجرام: متصل وجاهز 🚀';
    if (tgBanner) tgBanner.style.display = 'none';
  } else {
    if (tgBadge) tgBadge.className = 'header-info-badge badge-warning';
    if (tgText) tgText.textContent = 'تيليجرام: غير مهيأ ⚠️';
    if (tgBanner) tgBanner.style.display = 'flex';
  }

  // حقول الإعدادات
  const botInput = document.getElementById('cfgTelegramBotToken');
  const chatInput = document.getElementById('cfgTelegramChatId');
  const compInput = document.getElementById('cfgCompanyName');
  const phoneInput = document.getElementById('cfgCompanyPhone');
  const addrInput = document.getElementById('cfgCompanyAddress');
  const currSelect = document.getElementById('cfgCurrency');
  const footerInput = document.getElementById('cfgInvoiceFooter');

  if (botInput) botInput.value = telegramBotToken || '';
  if (chatInput) chatInput.value = telegramChatId || '';
  if (compInput) compInput.value = companyName || '';
  if (phoneInput) phoneInput.value = companyPhone || '';
  if (addrInput) addrInput.value = companyAddress || '';
  if (currSelect) currSelect.value = currency || 'شيكل';
  if (footerInput) footerInput.value = invoiceFooterText || '';
}

async function saveCompanySettings() {
  const companyName = document.getElementById('cfgCompanyName').value.trim();
  const companyPhone = document.getElementById('cfgCompanyPhone').value.trim();
  const companyAddress = document.getElementById('cfgCompanyAddress').value.trim();
  const currency = document.getElementById('cfgCurrency').value;
  const invoiceFooterText = document.getElementById('cfgInvoiceFooter').value.trim();
  const telegramBotToken = document.getElementById('cfgTelegramBotToken').value.trim();
  const telegramChatId = document.getElementById('cfgTelegramChatId').value.trim();

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName,
        companyPhone,
        companyAddress,
        currency,
        invoiceFooterText,
        telegramBotToken,
        telegramChatId
      })
    });
    const data = await res.json();
    if (data.success) {
      state.settings = data.settings;
      applySettingsToUI();
      renderCatalog();
      updateInvoiceSummary();
      showToast('تم حفظ الإعدادات بنجاح', 'success');
    } else {
      showToast(data.error || 'حدث خطأ أثناء الحفظ', 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم', 'error');
  }
}

async function testTelegramConnection() {
  const telegramBotToken = document.getElementById('cfgTelegramBotToken').value.trim();
  const telegramChatId = document.getElementById('cfgTelegramChatId').value.trim();
  const companyName = document.getElementById('cfgCompanyName').value.trim();

  if (!telegramBotToken || !telegramChatId) {
    showToast('يرجى ملء رمز البوت (Token) ومعرف المحادثة (Chat ID)', 'error');
    return;
  }

  showToast('جاري إرسال رسالة الاختبار عبر تيليجرام...', 'info');

  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken, telegramChatId, companyName })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 رائع! تم إرسال رسالة الاختبار لهاتفك بنجاح', 'success');
      // حفظ الإعدادات تلقائياً عند نجاح الاختبار
      saveCompanySettings();
    } else {
      showToast(`فشل الاختبار: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم لفحص تيليجرام', 'error');
  }
}

// -------------------------------------------------------------
// إدارة المنتجات والكتالوج
// -------------------------------------------------------------
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      state.products = data.products || [];
      renderBrandsRibbon('catalog');
      renderBrandsRibbon('inventory');
      renderCatalog();
      updateCategoryChips();
      updateInvoiceDropdown();
    }
  } catch (err) {
    console.error('فشل تحميل المنتجات:', err);
  }
}

// -------------------------------------------------------------
// الأيقونات المميزة للماركات
// -------------------------------------------------------------
// -------------------------------------------------------------
// قائمة الماركات الأكثر طلباً وشهرة للوصول الفوري
// -------------------------------------------------------------
const POPULAR_BRANDS = [
  'Simfer',
  'Manger Home',
  'RAF',
  'LG',
  'Samsung',
  'Beko',
  'Lawrence',
  'Luxor',
  'Universal',
  'Haier',
  'Midea',
  'Sharp',
  'TCL',
  'Bompani',
  'Crest',
  'Trust',
  'Zacash'
];

// الأيقونات المميزة والتسميات المعتمدة للماركات
const BRAND_ICONS = {
  'LG': { icon: '🔴', color: '#c41230', displayAr: 'ال جي (LG)' },
  'Samsung': { icon: '🔷', color: '#1428a0', displayAr: 'سامسونج' },
  'Beko': { icon: '🔵', color: '#0055a5', displayAr: 'بيكو' },
  'Universal': { icon: '⭐', color: '#0284c7', displayAr: 'يونيفرسال' },
  'Haier': { icon: '🌀', color: '#0066b2', displayAr: 'هاير' },
  'Midea': { icon: '❄️', color: '#008ad2', displayAr: 'ميديا' },
  'Sharp': { icon: '⚡', color: '#e60012', displayAr: 'شارب' },
  'TCL': { icon: '📺', color: '#e50012', displayAr: 'تي سي ال' },
  'Crest': { icon: '👑', color: '#d97706', displayAr: 'كريست' },
  'Trust': { icon: '🛡️', color: '#4f46e5', displayAr: 'ترست' },
  'Lawrence': { icon: '📻', color: '#7c3aed', displayAr: 'لورنس' },
  'Atlantic': { icon: '🌊', color: '#0891b2', displayAr: 'اتلانتيك' },
  'Samex': { icon: '🔥', color: '#ea580c', displayAr: 'سامكس' },
  'Molar': { icon: '🧊', color: '#059669', displayAr: 'مولار' },
  'General Lux': { icon: '✨', color: '#b45309', displayAr: 'جنرال لوكس' },
  'General Queen': { icon: '👑', color: '#ca8a04', displayAr: 'جنرال كوين' },
  'Bompani': { icon: '🍳', color: '#dc2626', displayAr: 'بومباني' },
  'Simfer': { icon: '🍲', color: '#b91c1c', displayAr: 'سيمفير / سمفير' },
  'Manger Home': { icon: '🏠', color: '#475569', displayAr: 'منجر هوم / مانجر' },
  'Luxor': { icon: '💡', color: '#f59e0b', displayAr: 'لوكسر' },
  'Zacash': { icon: '🍹', color: '#10b981', displayAr: 'زكش / زاكاش' },
  'Candy': { icon: '🍬', color: '#ec4899', displayAr: 'كاندي' },
  'Tefal': { icon: '🍳', color: '#e11d48', displayAr: 'تيفال' },
  'Matrix': { icon: '🖥️', color: '#6366f1', displayAr: 'ماتركس' },
  'Prestige': { icon: '🏆', color: '#8b5cf6', displayAr: 'برستيج' },
  'KMG': { icon: '🧊', color: '#0284c7', displayAr: 'كي ام جي' },
  'ADC': { icon: '🔌', color: '#64748b', displayAr: 'ADC' },
  'iPlug': { icon: '🔌', color: '#06b6d4', displayAr: 'ايبلوج' },
  'Dahua': { icon: '📹', color: '#0ea5e9', displayAr: 'دهوا' },
  'Hisense': { icon: '📺', color: '#0d9488', displayAr: 'هايسنس' },
  'RAF': { icon: '⚡', color: '#ea580c', displayAr: 'راف (RAF)' }
};

function handleBrandSearchInput(context, val) {
  const term = (val || '').trim();
  if (context === 'catalog') {
    state.catalogBrandSearchTerm = term;
    const btnClear = document.getElementById('btnCatalogClearBrandSearch');
    if (btnClear) btnClear.style.display = term ? 'flex' : 'none';
    renderBrandsRibbon('catalog', term);
  } else {
    state.inventoryBrandSearchTerm = term;
    const btnClear = document.getElementById('btnInventoryClearBrandSearch');
    if (btnClear) btnClear.style.display = term ? 'flex' : 'none';
    renderBrandsRibbon('inventory', term);
  }
}

function clearBrandSearchInput(context) {
  if (context === 'catalog') {
    const input = document.getElementById('catalogBrandSearchInput');
    if (input) input.value = '';
    handleBrandSearchInput('catalog', '');
  } else {
    const input = document.getElementById('inventoryBrandSearchInput');
    if (input) input.value = '';
    handleBrandSearchInput('inventory', '');
  }
}

function setBrandTabFilter(context, tabName, btn) {
  if (context === 'catalog') {
    state.catalogBrandTabFilter = tabName;
    const parent = document.getElementById('catalogBrandTabs');
    if (parent) {
      parent.querySelectorAll('.brand-tab-btn').forEach(b => b.classList.remove('active'));
    }
  } else {
    state.inventoryBrandTabFilter = tabName;
    const parent = document.getElementById('inventoryBrandTabs');
    if (parent) {
      parent.querySelectorAll('.brand-tab-btn').forEach(b => b.classList.remove('active'));
    }
  }
  if (btn) btn.classList.add('active');
  const term = context === 'catalog' ? state.catalogBrandSearchTerm : state.inventoryBrandSearchTerm;
  renderBrandsRibbon(context, term);
}

function toggleBrandsViewMode(context) {
  const isCatalog = context === 'catalog';
  const displayArea = document.getElementById(isCatalog ? 'catalogBrandsDisplayArea' : 'inventoryBrandsDisplayArea');
  const iconEl = document.getElementById(isCatalog ? 'catalogBrandsViewIcon' : 'inventoryBrandsViewIcon');
  const textEl = document.getElementById(isCatalog ? 'catalogBrandsViewText' : 'inventoryBrandsViewText');

  if (!displayArea) return;

  const currentMode = isCatalog ? state.catalogBrandsViewMode : state.inventoryBrandsViewMode;
  const newMode = currentMode === 'ribbon' ? 'grid' : 'ribbon';

  if (isCatalog) {
    state.catalogBrandsViewMode = newMode;
  } else {
    state.inventoryBrandsViewMode = newMode;
  }

  if (newMode === 'grid') {
    displayArea.classList.remove('ribbon-mode');
    displayArea.classList.add('grid-mode');
    if (iconEl) iconEl.textContent = '⇄';
    if (textEl) textEl.textContent = 'عرض كشريط أفقي';
  } else {
    displayArea.classList.remove('grid-mode');
    displayArea.classList.add('ribbon-mode');
    if (iconEl) iconEl.textContent = '⊞';
    if (textEl) textEl.textContent = 'عرض كشبكة كاملة';
  }
}

// -------------------------------------------------------------
// زر طي وإخفاء شبكة الماركات الذكي (لتوفير المساحة)
// -------------------------------------------------------------
function toggleBrandsCollapse(context) {
  const isCatalog = context === 'catalog';
  const gridEl = document.getElementById(isCatalog ? 'catalogBrandsGrid' : 'inventoryBrandsGrid');
  const btnEl = document.getElementById(isCatalog ? 'btnToggleCatalogBrands' : 'btnToggleInventoryBrands');
  const noticeEl = document.getElementById(isCatalog ? 'catalogBrandsCollapsedNotice' : 'inventoryBrandsCollapsedNotice');

  if (!gridEl) return;

  const isCurrentlyCollapsed = gridEl.classList.contains('collapsed');
  const willCollapse = !isCurrentlyCollapsed;

  if (willCollapse) {
    gridEl.classList.add('collapsed');
    if (noticeEl) noticeEl.style.display = 'flex';
    if (btnEl) {
      btnEl.classList.add('collapsed-state');
      const icon = btnEl.querySelector('.toggle-icon');
      const text = btnEl.querySelector('.toggle-text');
      if (icon) icon.textContent = '🔽';
      if (text) text.textContent = 'إظهار الماركات';
      btnEl.title = 'إظهار شبكة الماركات لتصفحها واختيار الماركة';
    }
    localStorage.setItem(`${context}_brands_collapsed`, 'true');
    showToast('تم طي شبكة الماركات لتوفير مساحة العمل على الشاشة', 'info');
  } else {
    gridEl.classList.remove('collapsed');
    if (noticeEl) noticeEl.style.display = 'none';
    if (btnEl) {
      btnEl.classList.remove('collapsed-state');
      const icon = btnEl.querySelector('.toggle-icon');
      const text = btnEl.querySelector('.toggle-text');
      if (icon) icon.textContent = '🔼';
      if (text) text.textContent = 'إخفاء الماركات';
      btnEl.title = 'إخفاء شبكة الماركات لتوفير مساحة على الشاشة';
    }
    localStorage.removeItem(`${context}_brands_collapsed`);
  }
}

function applyStoredBrandCollapseStates() {
  if (localStorage.getItem('catalog_brands_collapsed') === 'true') {
    const gridEl = document.getElementById('catalogBrandsGrid');
    const btnEl = document.getElementById('btnToggleCatalogBrands');
    const noticeEl = document.getElementById('catalogBrandsCollapsedNotice');
    if (gridEl) gridEl.classList.add('collapsed');
    if (noticeEl) noticeEl.style.display = 'flex';
    if (btnEl) {
      btnEl.classList.add('collapsed-state');
      const icon = btnEl.querySelector('.toggle-icon');
      const text = btnEl.querySelector('.toggle-text');
      if (icon) icon.textContent = '🔽';
      if (text) text.textContent = 'إظهار الماركات';
    }
  }
  if (localStorage.getItem('inventory_brands_collapsed') === 'true') {
    const gridEl = document.getElementById('inventoryBrandsGrid');
    const btnEl = document.getElementById('btnToggleInventoryBrands');
    const noticeEl = document.getElementById('inventoryBrandsCollapsedNotice');
    if (gridEl) gridEl.classList.add('collapsed');
    if (noticeEl) noticeEl.style.display = 'flex';
    if (btnEl) {
      btnEl.classList.add('collapsed-state');
      const icon = btnEl.querySelector('.toggle-icon');
      const text = btnEl.querySelector('.toggle-text');
      if (icon) icon.textContent = '🔽';
      if (text) text.textContent = 'إظهار الماركات';
    }
  }
}

// -------------------------------------------------------------
// إدارة وتوثيق اسم القائم على عملية الجرد
// -------------------------------------------------------------
function syncAuditEmployeeName(val) {
  const clean = (val || '').trim();
  const toolbarInput = document.getElementById('invAuditEmployeeName');
  const floatingInput = document.getElementById('invAuditEmployeeNameFloating');
  const modalInput = document.getElementById('modalAuditEmployeeInput');
  if (toolbarInput && toolbarInput.value !== val) toolbarInput.value = val;
  if (floatingInput && floatingInput.value !== val) floatingInput.value = val;
  if (modalInput && modalInput.value !== val) modalInput.value = val;
  if (clean) localStorage.setItem('last_employee_name', clean);
}

function openAuditEmployeeModal() {
  const modal = document.getElementById('auditEmployeeModal');
  const input = document.getElementById('modalAuditEmployeeInput');
  const saved = localStorage.getItem('last_employee_name') || '';
  if (input) {
    input.value = saved;
    setTimeout(() => input.focus(), 150);
  }
  if (modal) modal.classList.add('active');
}

function closeAuditEmployeeModal() {
  const modal = document.getElementById('auditEmployeeModal');
  if (modal) modal.classList.remove('active');
}

function confirmAuditEmployeeAndSave() {
  const input = document.getElementById('modalAuditEmployeeInput');
  const name = (input ? input.value : '').trim();
  if (!name) {
    showToast('⚠️ يرجى كتابة اسم القائم بالجرد للمتابعة', 'error');
    if (input) input.focus();
    return;
  }
  syncAuditEmployeeName(name);
  closeAuditEmployeeModal();
  saveInventoryBulkChanges();
}

// -------------------------------------------------------------
// إدارة شبكة الماركات الصغيرة الذكية (Compact Small Brands Grid)
// -------------------------------------------------------------
function renderBrandsRibbon(context, searchTerm = '') {
  const isCatalog = context === 'catalog';
  const gridEl = document.getElementById(isCatalog ? 'catalogBrandsGrid' : 'inventoryBrandsGrid') ||
                 document.getElementById(isCatalog ? 'catalogBrandsRibbon' : 'inventoryBrandsRibbon');
  if (!gridEl) return;

  const currentActive = isCatalog ? state.activeBrand : state.inventoryBrand;
  const term = (searchTerm || '').trim();

  // جمع إحصائيات الماركات بدقة
  const brandCounts = {};
  state.products.forEach(p => {
    const b = p.brand || 'أخرى';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  });

  const totalAll = state.products.length;

  // ترتيب جميع الماركات بحسب عدد الأصناف
  let sortedBrands = Object.entries(brandCounts)
    .filter(([b]) => b !== 'أخرى')
    .sort((a, b) => b[1] - a[1]);

  if (brandCounts['أخرى']) {
    sortedBrands.push(['أخرى', brandCounts['أخرى']]);
  }

  // تحديث شارة عدد الماركات
  const countBadge = document.getElementById(isCatalog ? 'catalogBrandsTotalCountBadge' : 'inventoryBrandsTotalCountBadge');
  if (countBadge) {
    countBadge.textContent = `(${sortedBrands.length} ماركة)`;
  }

  // تحديث زر "كل الماركات"
  const allBrandsBtn = document.getElementById(isCatalog ? 'btnCatalogAllBrands' : 'btnInventoryAllBrands');
  if (allBrandsBtn) {
    allBrandsBtn.classList.toggle('active', currentActive === 'all');
  }

  // تطبيق البحث الفوري إن وُجد
  if (term) {
    const termNorm = normalizeArabic(term);
    sortedBrands = sortedBrands.filter(([brandName]) => {
      const sample = state.products.find(p => p.brand === brandName);
      const meta = BRAND_ICONS[brandName];
      const arName = (meta && meta.displayAr) || (sample ? sample.brandAr : '') || '';

      const bNorm = normalizeArabic(brandName);
      const arNorm = normalizeArabic(arName);

      return matchArabicTerm(bNorm, termNorm) || matchArabicTerm(arNorm, termNorm);
    });
  }

  // بناء شبكة الماركات الصغيرة الحجم لسهولة الوصول المباشر
  let html = '';

  if (sortedBrands.length === 0) {
    html = `
      <div class="brand-no-results" style="padding: 0.6rem 1rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;">
        <span>🔍 لا توجد ماركة مطابقة لـ "${escapeHtml(term)}"</span>
        <button type="button" class="btn btn-xs btn-secondary" onclick="clearBrandSearchInput('${context}')">مسح البحث</button>
      </div>
    `;
  } else {
    sortedBrands.forEach(([brandName, count]) => {
      const sample = state.products.find(p => p.brand === brandName);
      const meta = BRAND_ICONS[brandName] || { icon: '🏷️' };
      const isActive = currentActive === brandName;

      html += `
        <div class="brand-mini-chip ${isActive ? 'active' : ''}" onclick="selectBrandFilter('${context}', '${escapeHtml(brandName)}')" title="${escapeHtml(brandName)} (${count} صنف)">
          <span class="chip-icon">${meta.icon}</span>
          <span class="chip-name">${escapeHtml(brandName)}</span>
          <span class="chip-count">${count}</span>
        </div>
      `;
    });
  }

  gridEl.innerHTML = html;

  // تحديث شريط حالة الماركة المحددة (Brand Lock Banner)
  const hintEl = document.getElementById(isCatalog ? 'catalogBrandActiveHint' : 'invBrandActiveHint');
  const nameEl = document.getElementById(isCatalog ? 'catalogBrandActiveName' : 'invBrandActiveName');
  const countEl = document.getElementById(isCatalog ? 'catalogBrandActiveCount' : 'invBrandActiveCount');

  if (hintEl && nameEl) {
    if (currentActive && currentActive !== 'all') {
      const sample = state.products.find(p => p.brand === currentActive);
      const meta = BRAND_ICONS[currentActive];
      const title = meta && meta.displayAr ? `${currentActive} (${meta.displayAr})` : (sample && sample.brandAr ? `${sample.brand} (${sample.brandAr})` : currentActive);
      const brandItemCount = state.products.filter(p => (p.brand || 'أخرى') === currentActive).length;

      hintEl.style.display = 'flex';
      nameEl.textContent = title;
      if (countEl) countEl.textContent = `${brandItemCount.toLocaleString('en-US')} صنف`;
    } else {
      hintEl.style.display = 'none';
    }
  }
}

function selectBrandFilter(context, brandName) {
  if (context === 'catalog') {
    state.activeBrand = brandName;
    state.catalogCurrentPage = 1;
    // عند اختيار ماركة محددة، نصفر أي فلاتر تصنيفات كانت نشطة لكي تظهر جميع أصناف هذه الماركة
    state.activeMainCategory = 'all';
    state.activeCategory = 'all';
    renderHierarchicalCategories();

    // تحديث placeholder حقل البحث ليوضح للموظف أنه يبحث داخل هذه الماركة حصراً
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) {
      if (brandName !== 'all') {
        const meta = BRAND_ICONS[brandName];
        const sample = state.products.find(p => p.brand === brandName);
        const title = meta && meta.displayAr ? `${brandName} (${meta.displayAr})` : (sample && sample.brandAr ? `${sample.brand} (${sample.brandAr})` : brandName);
        searchInput.placeholder = `🔍 ابحث داخل منتجات ${title} فقط (مثال: غسالة، فرن، 50 بوصة)...`;
      } else {
        searchInput.placeholder = 'ابحث باسم المنتج، الموديل، أو الكود مع الماركة المختارة...';
      }
    }

    renderBrandsRibbon('catalog', state.catalogBrandSearchTerm);
    renderCatalog();
  } else if (context === 'inventory') {
    state.inventoryBrand = brandName;
    state.inventoryCurrentPage = 1;
    state.inventoryCategory = 'all';
    const catSelect = document.getElementById('invCategoryFilter');
    if (catSelect) catSelect.value = 'all';

    const invSearchInput = document.getElementById('inventorySearchInput');
    if (invSearchInput) {
      if (brandName !== 'all') {
        const meta = BRAND_ICONS[brandName];
        const sample = state.products.find(p => p.brand === brandName);
        const title = meta && meta.displayAr ? `${brandName} (${meta.displayAr})` : (sample && sample.brandAr ? `${sample.brand} (${sample.brandAr})` : brandName);
        invSearchInput.placeholder = `🔍 ابحث داخل مخزون ${title} فقط...`;
      } else {
        invSearchInput.placeholder = 'ابحث باسم الصنف، الموديل، الماركة، أو الكود...';
      }
    }

    renderBrandsRibbon('inventory', state.inventoryBrandSearchTerm);
    renderInventoryList();
  }
}

function scrollBrandsRibbon(context, offset) {
  const ribbon = document.getElementById(context === 'catalog' ? 'catalogBrandsRibbon' : 'inventoryBrandsRibbon');
  if (ribbon) {
    ribbon.scrollBy({ left: offset, behavior: 'smooth' });
  }
}

// الأيقونات والألوان لكل تصنيف رئيسي
const MAIN_CATEGORY_META = {
  'all': { icon: '🛍️', color: '#6366f1', label: 'جميع الأصناف' },
  'أجهزة كهربائية كبيرة': { icon: '🏠', color: '#2563eb', label: 'أجهزة كهربائية كبيرة' },
  'أدوات مطبخ': { icon: '🍳', color: '#d97706', label: 'أدوات مطبخ' },
  'أدوات منزل': { icon: '🧹', color: '#059669', label: 'أدوات منزل' },
  'أدوات شخصية': { icon: '💇', color: '#9333ea', label: 'أدوات شخصية' },
  'أخرى': { icon: '📦', color: '#64748b', label: 'أخرى' }
};

function updateCategoryChips() {
  renderHierarchicalCategories();
}

function renderHierarchicalCategories() {
  const mainContainer = document.getElementById('mainCategoriesContainer');
  const subContainer = document.getElementById('subCategoriesContainer');
  const subWrapper = document.getElementById('subCategoriesWrapper');
  const subTitle = document.getElementById('subCategorySectionTitle');

  if (!mainContainer) return;

  // حساب عدد المنتجات في كل تصنيف رئيسي وفرعي
  const mainCounts = { all: state.products.length };
  const subCounts = {}; // { mainCat: { subCat: count } }

  state.products.forEach(p => {
    const mc = p.mainCategory || 'أخرى';
    const sc = p.category || 'أخرى متنوعة';
    mainCounts[mc] = (mainCounts[mc] || 0) + 1;
    subCounts[mc] = subCounts[mc] || {};
    subCounts[mc][sc] = (subCounts[mc][sc] || 0) + 1;
  });

  // رسم الأقسام الرئيسية (6 خانات: كل الأصناف + 5 أقسام)
  const mainOrder = ['all', 'أجهزة كهربائية كبيرة', 'أدوات مطبخ', 'أدوات منزل', 'أدوات شخصية', 'أخرى'];
  mainContainer.innerHTML = mainOrder.map(mc => {
    const meta = MAIN_CATEGORY_META[mc] || { icon: '📦', color: '#64748b', label: mc };
    const count = mainCounts[mc] || 0;
    const isActive = state.activeMainCategory === mc;
    return `
      <div class="main-cat-card ${isActive ? 'active' : ''}" onclick="selectMainCategory('${mc}')" 
           style="${isActive ? `border-color: ${meta.color}; background: linear-gradient(135deg, ${meta.color}10 0%, ${meta.color}20 100%);` : ''}">
        <span class="main-cat-icon">${meta.icon}</span>
        <div class="main-cat-info">
          <div class="main-cat-title" style="${isActive ? `color: ${meta.color};` : ''}">${meta.label}</div>
          <span class="main-cat-count" style="${isActive ? `background: ${meta.color}; color: white;` : ''}">${count.toLocaleString('en-US')} صنف</span>
        </div>
      </div>
    `;
  }).join('');

  // رسم التصنيفات الفرعية (إذا كان هناك قسم رئيسي مختار)
  if (state.activeMainCategory !== 'all' && subCounts[state.activeMainCategory]) {
    const subs = subCounts[state.activeMainCategory];
    const sortedSubs = Object.entries(subs).sort((a, b) => b[1] - a[1]);
    const meta = MAIN_CATEGORY_META[state.activeMainCategory] || { color: '#2563eb', label: state.activeMainCategory };

    if (subTitle) subTitle.textContent = `أقسام "${meta.label}" الفرعية:`;

    subContainer.innerHTML = [
      // زر "الكل" ضمن القسم الرئيسي
      `<button class="sub-chip ${state.activeCategory === 'all' ? 'active' : ''}" 
              onclick="setSubCategoryFilter('all')"
              style="${state.activeCategory === 'all' ? `background: ${meta.color}; border-color: ${meta.color};` : ''}">
        الكل
        <span class="sub-chip-count">(${(mainCounts[state.activeMainCategory] || 0).toLocaleString('en-US')})</span>
      </button>`,
      ...sortedSubs.map(([sub, cnt]) => `
        <button class="sub-chip ${state.activeCategory === sub ? 'active' : ''}" 
                onclick="setSubCategoryFilter('${sub}')"
                style="${state.activeCategory === sub ? `background: ${meta.color}; border-color: ${meta.color};` : ''}">
          ${sub}
          <span class="sub-chip-count">(${cnt.toLocaleString('en-US')})</span>
        </button>
      `)
    ].join('');

    if (subWrapper) subWrapper.style.display = 'flex';
  } else {
    if (subWrapper) subWrapper.style.display = state.activeMainCategory === 'all' ? 'none' : 'flex';
    if (subContainer) subContainer.innerHTML = '';
  }
}

function selectMainCategory(mainCat) {
  state.activeMainCategory = mainCat;
  state.activeCategory = 'all';
  state.catalogCurrentPage = 1;
  renderHierarchicalCategories();
  renderCatalog();
}

function setSubCategoryFilter(subCat) {
  state.activeCategory = subCat;
  state.catalogCurrentPage = 1;
  renderHierarchicalCategories();
  renderCatalog();
}

function setCategoryFilter(category) {
  state.activeCategory = category;
  state.catalogCurrentPage = 1;
  updateCategoryChips();
  renderCatalog();
}



function setupSearchListeners() {
  const catalogSearch = document.getElementById('catalogSearchInput');
  if (catalogSearch) {
    catalogSearch.addEventListener('input', (e) => {
      state.catalogSearch = e.target.value.trim().toLowerCase();
      state.catalogCurrentPage = 1;
      renderCatalog();
    });
  }

  const invoiceSearch = document.getElementById('invoicesSearchInput');
  if (invoiceSearch) {
    invoiceSearch.addEventListener('input', (e) => {
      state.invoicesSearch = e.target.value.trim().toLowerCase();
      renderInvoicesTable();
    });
  }
}

function renderCatalog() {
  const container = document.getElementById('productsGridContainer');
  if (!container) return;

  const currency = state.settings.currency || 'شيكل';

  // تصفية المنتجات مع دمج الماركة والتصنيف الرئيسي والفرعي والبحث النصي معاً
  let filtered = state.products.filter(p => {
    // 1. فلتر الماركة المختارة (محصور داخل الماركة حصراً)
    if (state.activeBrand && state.activeBrand !== 'all') {
      if ((p.brand || 'أخرى') !== state.activeBrand) return false;
    }

    // 2. فلتر القسم الرئيسي
    if (state.activeMainCategory && state.activeMainCategory !== 'all') {
      if ((p.mainCategory || 'أخرى') !== state.activeMainCategory) return false;
    }

    // 3. فلتر القسم الفرعي
    if (state.activeCategory && state.activeCategory !== 'all') {
      if (p.category !== state.activeCategory) return false;
    }

    // 4. فلتر البحث النصي (مدمج ومحصور داخل الماركة مع تطبيع كامل للغة العربية والمرادفات)
    if (state.catalogSearch) {
      const qNorm = normalizeArabic(state.catalogSearch);
      const searchWords = qNorm.split(/\s+/).filter(w => w.length > 0);
      if (searchWords.length > 0) {
        const pNameNorm = normalizeArabic(p.name);
        const pCodeNorm = normalizeArabic(p.code);
        const pCatNorm = normalizeArabic(p.category);
        const pMainNorm = normalizeArabic(p.mainCategory);
        const pBrandNorm = normalizeArabic(p.brand);
        const pBrandArNorm = normalizeArabic(p.brandAr);

        const allWordsMatch = searchWords.every(word => {
          return matchArabicTerm(pNameNorm, word) ||
                 matchArabicTerm(pCodeNorm, word) ||
                 matchArabicTerm(pCatNorm, word) ||
                 matchArabicTerm(pMainNorm, word) ||
                 matchArabicTerm(pBrandNorm, word) ||
                 matchArabicTerm(pBrandArNorm, word);
        });

        if (!allWordsMatch) return false;
      }
    }

    return true;
  });

  // فرز الأصناف: جعل جميع الأصناف المتوفرة أولاً، وجميع الأصناف التي كميتها = صفر بالأسفل تماماً
  filtered.sort((a, b) => {
    const stockA = Math.max(0, parseInt(a.stock) || 0);
    const stockB = Math.max(0, parseInt(b.stock) || 0);
    const aAvailable = stockA > 0;
    const bAvailable = stockB > 0;
    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;
    return stockB - stockA; // المتوفر بكميات أكبر يظهر أولاً
  });

  const totalCount = filtered.length;

  if (totalCount === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📦</div>
        <h3>لم يتم العثور على أي منتجات مطابقة</h3>
        <p>جرب تغيير الماركة أو القسم أو البحث بكلمات أخرى</p>
      </div>
    `;
    return;
  }

  const displayedCount = state.catalogCurrentPage * state.catalogPageSize;
  const pageProducts = filtered.slice(0, displayedCount);

  let zeroDividerAdded = false;
  let cardsHtml = pageProducts.map(prod => {
    const cost = parseFloat(prod.costPrice) || 0;
    const sell = parseFloat(prod.sellPrice) || 0;
    const profit = sell - cost;
    const profitMargin = sell > 0 ? ((profit / sell) * 100).toFixed(0) : 0;

    // فحص إن كان المنتج موجوداً بالسلة
    const cartItem = state.cart.find(item => item.productId === prod.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;

    const currentStock = Math.max(0, parseInt(prod.stock) || 0);
    const isZeroStock = currentStock === 0;
    const imageUrl = prod.image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80';

    let dividerHtml = '';
    if (isZeroStock && !zeroDividerAdded) {
      zeroDividerAdded = true;
      const zeroCount = filtered.filter(p => (parseInt(p.stock) || 0) <= 0).length;
      dividerHtml = `
        <div class="zero-stock-divider">
          <div class="zero-title">
            <span style="font-size: 1.3rem;">⚠️</span>
            <span>أصناف نفدت كميتها من المخزون (الكمية = 0):</span>
          </div>
          <span class="zero-badge">${zeroCount} صنف نافد حالياً</span>
        </div>
      `;
    }

    return `
      ${dividerHtml}
      <div class="product-card ${isZeroStock ? 'is-out-of-stock' : ''}">
        <div class="product-img-wrapper">
          <img src="${imageUrl}" alt="${prod.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'">
          <span class="product-category-tag">${prod.category || 'عام'}</span>
          ${prod.brand && prod.brand !== 'أخرى' ? `<span class="product-brand-tag">🏷️ ${escapeHtml(prod.brand)}</span>` : ''}
          <span class="product-stock-tag ${isZeroStock ? 'zero-stock-badge' : ''}">${isZeroStock ? '⚠️ غير متوفر (0)' : `المتوفر: ${currentStock}`}</span>
          ${isZeroStock ? `<div class="zero-stock-overlay-badge"><span>نفد من المخزون</span></div>` : ''}
        </div>

        <div class="product-content">
          <div class="product-code">${prod.code || 'بدون كود'}</div>
          <h3 class="product-title" title="${prod.name}">${prod.name}</h3>

          <!-- مصفوفة الأسعار الشفافة للموظفين -->
          <div class="employee-pricing-box">
            <div class="price-row">
              <span class="price-label">📦 رأس المال (التكلفة):</span>
              <span class="price-val cost-val">${cost.toLocaleString('en-US')} ${currency}</span>
            </div>
            <div class="price-row">
              <span class="price-label">🏷️ سعر البيع:</span>
              <span class="price-val sell-val">${sell.toLocaleString('en-US')} ${currency}</span>
            </div>
            <div class="price-row">
              <span class="price-label">🟢 ربح القطعة:</span>
              <span class="price-val profit-val">+${profit.toLocaleString('en-US')} ${currency} (${profitMargin}%)</span>
            </div>
          </div>

          <div class="product-actions">
            ${inCartQty > 0 ? `
              <div class="quantity-control" style="flex: 1; justify-content: space-between;">
                <button class="quantity-btn" onclick="updateCartQuantity('${prod.id}', ${inCartQty - 1})">-</button>
                <span class="quantity-input" style="line-height: 32px;">${inCartQty} بالفاتورة</span>
                <button class="quantity-btn" onclick="updateCartQuantity('${prod.id}', ${inCartQty + 1})">+</button>
              </div>
            ` : `
              <button class="btn ${isZeroStock ? 'btn-outline-danger' : 'btn-primary'} btn-block" onclick="addToCart('${prod.id}')">
                <span>➕</span>
                <span>${isZeroStock ? 'إضافة رغم نفاد المخزون' : 'إضافة للفاتورة'}</span>
              </button>
            `}
            <button class="btn btn-secondary btn-sm" onclick="openEditProductModal('${prod.id}')" title="تعديل المنتج">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteProduct('${prod.id}')" title="حذف المنتج">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // شريط تحميل المزيد والصفحات
  if (displayedCount < totalCount) {
    cardsHtml += `
      <div class="catalog-pagination-box" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 1rem; text-align: center; gap: 0.75rem;">
        <div style="font-size: 0.95rem; color: #64748b;">
          تم عرض <strong style="color: #0f172a;">${Math.min(displayedCount, totalCount).toLocaleString('en-US')}</strong> من أصل <strong style="color: #0f172a;">${totalCount.toLocaleString('en-US')}</strong> منتج
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;">
          <button class="btn btn-primary" onclick="loadMoreCatalogProducts()">
            <span>⬇️</span> عرض المزيد (36 منتج إضافي)
          </button>
          <button class="btn btn-secondary" onclick="loadAllCatalogProducts()">
            <span>👁️</span> عرض جميع المنتجات (${totalCount.toLocaleString('en-US')})
          </button>
        </div>
      </div>
    `;
  } else if (totalCount > state.catalogPageSize) {
    cardsHtml += `
      <div style="grid-column: 1 / -1; text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.9rem;">
        ✅ تم عرض جميع المنتجات المطابقة (${totalCount.toLocaleString('en-US')} منتج)
      </div>
    `;
  }

  container.innerHTML = cardsHtml;
}

function loadMoreCatalogProducts() {
  state.catalogCurrentPage++;
  renderCatalog();
}

function loadAllCatalogProducts() {
  state.catalogCurrentPage = 999;
  renderCatalog();
}

// -------------------------------------------------------------
// إدارة نافذة إضافة / تعديل منتج
// -------------------------------------------------------------
function openAddProductModal() {
  document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد للشركة';
  document.getElementById('editProductId').value = '';
  document.getElementById('prodCode').value = 'PRD-' + Math.floor(100 + Math.random() * 900);
  document.getElementById('prodName').value = '';
  document.getElementById('prodCategory').value = '';
  document.getElementById('prodCostPrice').value = '';
  document.getElementById('prodSellPrice').value = '';
  document.getElementById('prodCalculatedProfit').value = '';
  document.getElementById('prodStock').value = '10';
  document.getElementById('prodImageUrl').value = '';
  document.getElementById('prodDescription').value = '';

  document.getElementById('productModal').classList.add('active');
}

function openEditProductModal(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  document.getElementById('productModalTitle').textContent = 'تعديل بيانات المنتج';
  document.getElementById('editProductId').value = prod.id;
  document.getElementById('prodCode').value = prod.code || '';
  document.getElementById('prodName').value = prod.name || '';
  document.getElementById('prodCategory').value = prod.category || '';
  document.getElementById('prodCostPrice').value = prod.costPrice || '';
  document.getElementById('prodSellPrice').value = prod.sellPrice || '';
  document.getElementById('prodStock').value = prod.stock ?? 10;
  document.getElementById('prodImageUrl').value = prod.image || '';
  document.getElementById('prodDescription').value = prod.description || '';

  calcProductModalProfit();
  document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
}

function calcProductModalProfit() {
  const cost = parseFloat(document.getElementById('prodCostPrice').value) || 0;
  const sell = parseFloat(document.getElementById('prodSellPrice').value) || 0;
  const profit = sell - cost;
  const currency = state.settings.currency || 'شيكل';
  const profitMargin = sell > 0 ? ((profit / sell) * 100).toFixed(1) : 0;
  
  const el = document.getElementById('prodCalculatedProfit');
  if (el) {
    el.value = `+${profit.toLocaleString('en-US')} ${currency} (${profitMargin}%)`;
  }
}

async function handleImageUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('image', file);

  showToast('جاري رفع صورة المنتج...', 'info');

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success && data.imageUrl) {
      document.getElementById('prodImageUrl').value = data.imageUrl;
      showToast('تم رفع الصورة بنجاح!', 'success');
    } else {
      showToast(data.error || 'فشل رفع الصورة', 'error');
    }
  } catch (err) {
    showToast('تعذر رفع الصورة', 'error');
  }
}

async function saveProductFromModal() {
  const id = document.getElementById('editProductId').value;
  const code = document.getElementById('prodCode').value.trim();
  const name = document.getElementById('prodName').value.trim();
  const category = document.getElementById('prodCategory').value.trim();
  const costPrice = parseFloat(document.getElementById('prodCostPrice').value);
  const sellPrice = parseFloat(document.getElementById('prodSellPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value) || 0;
  const image = document.getElementById('prodImageUrl').value.trim();
  const description = document.getElementById('prodDescription').value.trim();

  if (!name) {
    showToast('يرجى إدخال اسم المنتج', 'error');
    return;
  }

  if (isNaN(costPrice) || isNaN(sellPrice)) {
    showToast('يرجى إدخال رأس المال وسعر البيع بشكل صحيح', 'error');
    return;
  }

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id || undefined,
        code,
        name,
        category,
        costPrice,
        sellPrice,
        stock,
        image,
        description
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(id ? 'تم تعديل المنتج بنجاح' : 'تمت إضافة المنتج بنجاح', 'success');
      closeProductModal();
      await loadProducts();
      if (state.isAddingProductForInvoice && data.product) {
        addToCart(data.product.id);
        state.isAddingProductForInvoice = false;
        switchTab('create-invoice');
      }
    } else {
      showToast(data.error || 'فشل حفظ المنتج', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
  }
}

async function confirmDeleteProduct(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  if (!confirm(`هل أنت متأكد من حذف المنتج: "${prod.name}"؟`)) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف المنتج بنجاح', 'success');
      removeFromCart(id);
      await loadProducts();
    } else {
      showToast('فشل حذف المنتج', 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم', 'error');
  }
}

// -------------------------------------------------------------
// إدارة سلة وإنشاء الفاتورة والبحث المرئي الذكي
// -------------------------------------------------------------
function jumpToInvoiceDirectly() {
  switchTab('create-invoice');
  const table = document.getElementById('selectedItemsTable');
  if (table) {
    table.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateFloatingCartUI() {
  const floatingBar = document.getElementById('floatingCartBar');
  if (!floatingBar) return;

  const totalItemsCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = state.cart.reduce((sum, i) => sum + (i.quantity * i.sellPrice), 0);
  const currency = state.settings.currency || 'شيكل';

  if (totalItemsCount > 0) {
    const badge = document.getElementById('floatingCartBadge');
    if (badge) badge.textContent = totalItemsCount;
    const countEl = document.getElementById('floatingCartItemsCount');
    if (countEl) countEl.textContent = totalItemsCount;
    const totalEl = document.getElementById('floatingCartTotal');
    if (totalEl) totalEl.textContent = totalAmount.toLocaleString('en-US');
    const currEl = document.getElementById('floatingCartCurrency');
    if (currEl) currEl.textContent = currency;

    floatingBar.style.display = 'flex';
    floatingBar.classList.add('pulse-highlight');
    setTimeout(() => floatingBar.classList.remove('pulse-highlight'), 1200);
  } else {
    floatingBar.style.display = 'none';
  }
}

// -------------------------------------------------------------
// البحث المرئي الذكي عن المنتجات (Visual Live Search)
// -------------------------------------------------------------
function setupLiveProductSearch() {
  const input = document.getElementById('quickProductSearchInput');
  const dropdown = document.getElementById('liveSearchDropdown');
  const list = document.getElementById('liveSearchResultsList');
  const clearBtn = document.getElementById('btnClearQuickSearch');

  if (!input || !dropdown || !list) return;

  let debounceTimer = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim().toLowerCase();

    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(() => {
      renderLiveSearchResults(query);
    }, 100);
  });

  input.addEventListener('focus', () => {
    const query = input.value.trim().toLowerCase();
    if (query) {
      renderLiveSearchResults(query);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // إذا كان هناك نتائج ظاهرة، أضف النتيجة الأولى فوراً
      const firstBtn = list.querySelector('.btn-live-add');
      if (firstBtn) {
        firstBtn.click();
      } else {
        addQuickSelectedProductFromSearch();
      }
    } else if (e.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  });

  // إغلاق القائمة عند النقر خارج المربع
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('visualSearchWrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function renderLiveSearchResults(query) {
  const dropdown = document.getElementById('liveSearchDropdown');
  const list = document.getElementById('liveSearchResultsList');
  const countEl = document.getElementById('liveSearchCount');
  const currency = state.settings.currency || 'شيكل';

  if (!dropdown || !list) return;

  const matches = state.products.filter(p => {
    const name = (p.name || '').toLowerCase();
    const code = (p.code || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const mainCat = (p.mainCategory || '').toLowerCase();
    return name.includes(query) || code.includes(query) || cat.includes(query) || mainCat.includes(query);
  });

  if (countEl) countEl.textContent = matches.length;

  if (matches.length === 0) {
    list.innerHTML = `
      <div class="live-search-empty">
        <span style="font-size: 1.8rem;">🔍</span>
        <div>لم يتم العثور على أي صنف يطابق: "<strong>${escapeHtml(query)}</strong>"</div>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.35rem;">تأكد من كتابة جزء من اسم المنتج أو الكود أو الماركة</div>
      </div>
    `;
    dropdown.style.display = 'block';
    return;
  }

  const topMatches = matches.slice(0, 35);

  list.innerHTML = topMatches.map(prod => {
    const stock = parseInt(prod.stock) || 0;
    const cost = parseFloat(prod.costPrice) || 0;
    const sell = parseFloat(prod.sellPrice) || 0;
    const profit = sell - cost;
    const imageUrl = prod.image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80';

    let stockBadgeClass = 'stock-ok';
    let stockBadgeText = `متوفر: ${stock}`;
    if (stock <= 0) {
      stockBadgeClass = 'stock-out';
      stockBadgeText = 'نفد المخزون';
    } else if (stock <= 3) {
      stockBadgeClass = 'stock-low';
      stockBadgeText = `متبقي: ${stock} فقط`;
    }

    return `
      <div class="live-search-item" onclick="selectLiveSearchResult('${prod.id}')" title="انقر لإضافة هذا الصنف فوراً للفاتورة">
        <div class="live-item-thumb">
          <img src="${imageUrl}" alt="${escapeHtml(prod.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'">
        </div>
        <div class="live-item-info">
          <div class="live-item-top">
            <span class="live-item-code">[${escapeHtml(prod.code || 'كود')}]</span>
            <strong class="live-item-name">${escapeHtml(prod.name)}</strong>
          </div>
          <div class="live-item-meta">
            <span class="live-item-cat">📁 ${escapeHtml(prod.category || 'عام')}</span>
            <span class="live-item-stock ${stockBadgeClass}">${stockBadgeText}</span>
          </div>
        </div>
        <div class="live-item-pricing">
          <div class="live-item-price">${sell.toLocaleString('en-US')} <small>${currency}</small></div>
          <div class="live-item-profit">ربح: +${profit.toLocaleString('en-US')} ${currency}</div>
        </div>
        <button type="button" class="btn btn-sm btn-primary btn-live-add" onclick="event.stopPropagation(); selectLiveSearchResult('${prod.id}')">
          <span>➕</span>
          <span>إضافة</span>
        </button>
      </div>
    `;
  }).join('');

  dropdown.style.display = 'block';
}

function selectLiveSearchResult(productId) {
  addToCart(productId);
  const input = document.getElementById('quickProductSearchInput');
  if (input) {
    input.focus();
  }
}

function clearQuickSearch() {
  const input = document.getElementById('quickProductSearchInput');
  const dropdown = document.getElementById('liveSearchDropdown');
  const clearBtn = document.getElementById('btnClearQuickSearch');
  if (input) {
    input.value = '';
    input.focus();
  }
  if (dropdown) dropdown.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
}

function updateInvoiceDropdown() {
  const select = document.getElementById('quickProductSelect');
  const datalist = document.getElementById('productsDataList');
  const currency = state.settings.currency || 'شيكل';

  if (datalist) {
    datalist.innerHTML = state.products.map(p => `
      <option value="${p.code} - ${p.name}">سعر: ${p.sellPrice.toLocaleString('en-US')} ${currency} (ربح: ${(p.sellPrice - p.costPrice).toLocaleString('en-US')})</option>
    `).join('');
  }

  if (select) {
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- أو تصفح القائمة الكاملة للأصناف (' + state.products.length.toLocaleString('en-US') + ' صنف) --</option>' +
      state.products.map(p => `
        <option value="${p.id}">[${p.code}] ${p.name} - سعر البيع: ${p.sellPrice.toLocaleString('en-US')} ${currency} (ربح: ${(p.sellPrice - p.costPrice).toLocaleString('en-US')})</option>
      `).join('');
    select.value = currentVal;
  }
}

function addQuickSelectedProductFromSearch() {
  const input = document.getElementById('quickProductSearchInput');
  if (!input || !input.value.trim()) return;

  const val = input.value.trim().toLowerCase();
  const found = state.products.find(p => 
    val.includes(p.code.toLowerCase()) || 
    p.code.toLowerCase() === val || 
    p.name.toLowerCase() === val ||
    val.includes(p.name.toLowerCase()) ||
    p.name.toLowerCase().includes(val)
  );

  if (found) {
    addToCart(found.id);
    input.value = '';
    const dropdown = document.getElementById('liveSearchDropdown');
    if (dropdown) dropdown.style.display = 'none';
  } else {
    showToast('لم يتم العثور على منتج يطابق البحث', 'warning');
  }
}

function addQuickSelectedProduct() {
  const input = document.getElementById('quickProductSearchInput');
  if (input && input.value.trim()) {
    addQuickSelectedProductFromSearch();
    return;
  }

  const select = document.getElementById('quickProductSelect');
  if (!select || !select.value) {
    showToast('يرجى اختيار منتج أو كتابة اسمه في خانة البحث أولاً', 'info');
    return;
  }
  addToCart(select.value);
  select.value = '';
}

function addToCart(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const existing = state.cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({
      productId: prod.id,
      productName: prod.name,
      productImage: prod.image || '',
      costPrice: parseFloat(prod.costPrice) || 0,
      sellPrice: parseFloat(prod.sellPrice) || 0,
      quantity: 1
    });
  }

  updateCartUI();
  updateFloatingCartUI();
  renderCatalog();
  showToast(`تمت إضافة "${prod.name}" للفاتورة`, 'success', 'الذهاب للفاتورة 🧾', () => jumpToInvoiceDirectly());
}

function updateCartQuantity(productId, newQty) {
  const itemIndex = state.cart.findIndex(i => i.productId === productId);
  if (itemIndex === -1) return;

  if (newQty <= 0) {
    state.cart.splice(itemIndex, 1);
  } else {
    state.cart[itemIndex].quantity = newQty;
  }

  updateCartUI();
  updateFloatingCartUI();
  renderCatalog();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.productId !== productId);
  updateCartUI();
  updateFloatingCartUI();
  renderCatalog();
}

function updateCartUI() {
  const tbody = document.getElementById('selectedItemsTableBody');
  const emptyMsg = document.getElementById('emptyCartMessage');
  const badge = document.getElementById('cartCountBadge');
  const currency = state.settings.currency || 'شيكل';
  const isPurchase = state.invoiceType === 'purchase';

  // ضبط ظهور أعمدة الجدول بحسب نوع الفاتورة
  const colSell = document.querySelectorAll('.col-sell-price');
  const colProfit = document.querySelectorAll('.col-profit');
  const thTotal = document.getElementById('thTotalItem');

  colSell.forEach(el => el.style.display = isPurchase ? 'none' : '');
  colProfit.forEach(el => el.style.display = isPurchase ? 'none' : '');
  if (thTotal) {
    thTotal.textContent = isPurchase ? 'إجمالي الشراء (التكلفة)' : 'إجمالي البيع';
  }

  const totalItemsCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);

  if (badge) {
    if (totalItemsCount > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = totalItemsCount;
    } else {
      badge.style.display = 'none';
    }
  }

  if (state.cart.length === 0) {
    if (tbody) tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    updateInvoiceSummary();
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  if (tbody) {
    tbody.innerHTML = state.cart.map(item => {
      const lineCost = (item.costPrice || 0) * item.quantity;
      const unitProfit = (item.sellPrice || 0) - (item.costPrice || 0);
      const lineSell = (item.sellPrice || 0) * item.quantity;
      const lineProfit = unitProfit * item.quantity;

      if (isPurchase) {
        // في فاتورة المشتريات: فقط سعر الشراء (رأس المال) والكمية والإجمالي، بدون سعر البيع وبدون الربح
        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <img src="${item.productImage || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'}" class="item-thumb" alt="${item.productName}">
                <div>
                  <strong style="display: block;">${item.productName}</strong>
                  <span style="font-size: 0.78rem; color: #047857; font-weight: 600;">📥 توريد بضاعة للمخزن</span>
                </div>
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.25rem;">
                <input type="number" class="form-control" style="width: 105px; padding: 0.35rem 0.5rem; font-weight: 700; text-align: center; color: #475569;"
                       value="${item.costPrice}" min="0" step="any"
                       onchange="updateCartItemCostPrice('${item.productId}', parseFloat(this.value) || 0)"
                       title="تعديل سعر الشراء / التكلفة للقطعة">
                <span style="font-size: 0.8rem; color: var(--text-muted);">${currency}</span>
              </div>
            </td>
            <td>
              <div class="quantity-control">
                <button class="quantity-btn" onclick="updateCartQuantity('${item.productId}', ${item.quantity - 1})">-</button>
                <input type="number" class="quantity-input" value="${item.quantity}" min="1" onchange="updateCartQuantity('${item.productId}', parseInt(this.value) || 1)">
                <button class="quantity-btn" onclick="updateCartQuantity('${item.productId}', ${item.quantity + 1})">+</button>
              </div>
            </td>
            <td style="font-weight: 800; color: #0f172a;">${lineCost.toLocaleString('en-US')} ${currency}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.productId}')">✕</button>
            </td>
          </tr>
        `;
      }

      // في فاتورة المبيعات: كامل التفاصيل وسعر البيع والربح
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img src="${item.productImage || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'}" class="item-thumb" alt="${item.productName}">
              <div>
                <strong style="display: block;">${item.productName}</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted);">ربح القطعة: +${unitProfit.toLocaleString('en-US')} ${currency}</span>
              </div>
            </div>
          </td>
          <td style="color: #475569; font-weight: 600;">${item.costPrice.toLocaleString('en-US')} ${currency}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              <input type="number" class="form-control" style="width: 105px; padding: 0.35rem 0.5rem; font-weight: 700; text-align: center; color: var(--primary-dark);"
                     value="${item.sellPrice}" min="0" step="any"
                     onchange="updateCartItemSellPrice('${item.productId}', parseFloat(this.value) || 0)"
                     title="تعديل سعر البيع المتفق عليه مع الزبون">
              <span style="font-size: 0.8rem; color: var(--text-muted);">${currency}</span>
            </div>
          </td>
          <td>
            <div class="quantity-control">
              <button class="quantity-btn" onclick="updateCartQuantity('${item.productId}', ${item.quantity - 1})">-</button>
              <input type="number" class="quantity-input" value="${item.quantity}" min="1" onchange="updateCartQuantity('${item.productId}', parseInt(this.value) || 1)">
              <button class="quantity-btn" onclick="updateCartQuantity('${item.productId}', ${item.quantity + 1})">+</button>
            </div>
          </td>
          <td style="font-weight: 800;">${lineSell.toLocaleString('en-US')} ${currency}</td>
          <td style="color: var(--success-dark); font-weight: 800;">+${lineProfit.toLocaleString('en-US')} ${currency}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.productId}')">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  updateInvoiceSummary();
}

function updateCartItemCostPrice(productId, newCost) {
  const item = state.cart.find(i => i.productId === productId);
  if (!item) return;
  item.costPrice = Math.max(0, newCost);
  updateCartUI();
}

function updateCartItemSellPrice(productId, newPrice) {
  const item = state.cart.find(i => i.productId === productId);
  if (!item) return;
  item.sellPrice = Math.max(0, newPrice);
  updateCartUI();
}

function updateInvoiceSummary() {
  const currency = state.settings.currency || 'شيكل';
  const isPurchase = state.invoiceType === 'purchase';

  let totalQty = 0;
  let totalCost = 0;
  let totalAmount = 0;

  state.cart.forEach(item => {
    totalQty += item.quantity;
    totalCost += item.costPrice * item.quantity;
    totalAmount += (isPurchase ? item.costPrice : item.sellPrice) * item.quantity;
  });

  const totalProfit = isPurchase ? 0 : (totalAmount - totalCost);
  const profitMargin = (!isPurchase && totalAmount > 0) ? ((totalProfit / totalAmount) * 100).toFixed(1) : 0;

  // تحديث البطاقة الجانبية
  const elQty = document.getElementById('sumTotalQty');
  const elCost = document.getElementById('sumTotalCost');
  const elProfit = document.getElementById('sumTotalProfit');
  const elAmount = document.getElementById('sumTotalAmount');
  const rowCost = document.getElementById('rowSumCost');
  const rowProfit = document.getElementById('rowSumProfit');
  const sumLabelFinal = document.getElementById('sumLabelFinalAmount');

  if (elQty) elQty.textContent = `${totalQty} قطعة`;

  if (isPurchase) {
    if (rowCost) rowCost.style.display = 'none';
    if (rowProfit) rowProfit.style.display = 'none';
    if (sumLabelFinal) sumLabelFinal.textContent = 'إجمالي قيمة المشتريات (المضافة للمخزن):';
    if (elAmount) elAmount.textContent = `${totalCost.toLocaleString('en-US')} ${currency}`;
  } else {
    if (rowCost) rowCost.style.display = 'flex';
    if (rowProfit) rowProfit.style.display = 'flex';
    if (sumLabelFinal) sumLabelFinal.textContent = 'المبلغ النهائي للفاتورة:';
    if (elCost) elCost.textContent = `${totalCost.toLocaleString('en-US')} ${currency}`;
    if (elProfit) elProfit.textContent = `+${totalProfit.toLocaleString('en-US')} ${currency} (${profitMargin}%)`;
    if (elAmount) elAmount.textContent = `${totalAmount.toLocaleString('en-US')} ${currency}`;
  }

  // حساب الأقساط إذا كانت مختارة
  calculateInstallments(totalAmount);
}

// طريقة الدفع
function selectPaymentMethod(method) {
  state.currentPaymentMethod = method;

  const cashOpt = document.getElementById('payOptCash');
  const instOpt = document.getElementById('payOptInstallments');
  const instBlock = document.getElementById('installmentsDetailsBlock');
  const sumBreakdown = document.getElementById('summaryInstallmentBreakdown');

  if (method === 'installments') {
    cashOpt.classList.remove('active');
    instOpt.classList.add('active');
    instBlock.style.display = 'block';
    sumBreakdown.style.display = 'block';
  } else {
    cashOpt.classList.add('active');
    instOpt.classList.remove('active');
    instBlock.style.display = 'none';
    sumBreakdown.style.display = 'none';
  }

  calculateInstallments();
}

function calculateInstallments(passedTotal = null) {
  const currency = state.settings.currency || 'شيكل';
  const totalAmount = passedTotal !== null ? passedTotal : state.cart.reduce((s, i) => s + (i.sellPrice * i.quantity), 0);

  const downPaymentInput = document.getElementById('instDownPayment');
  const remainingInput = document.getElementById('instRemainingAmount');
  const sumDown = document.getElementById('sumInstDownPayment');
  const sumRem = document.getElementById('sumInstRemaining');

  const downPayment = parseFloat(downPaymentInput ? downPaymentInput.value : 0) || 0;
  const remaining = Math.max(0, totalAmount - downPayment);

  if (remainingInput) remainingInput.value = `${remaining.toLocaleString('en-US')} ${currency}`;
  if (sumDown) sumDown.textContent = `${downPayment.toLocaleString('en-US')} ${currency}`;
  if (sumRem) sumRem.textContent = `${remaining.toLocaleString('en-US')} ${currency}`;
}

// إرسال وإنشاء الفاتورة
async function submitInvoice() {
  const employeeName = document.getElementById('invEmployeeName').value.trim();
  const customerName = document.getElementById('invCustomerName').value.trim();
  const customerPhone = document.getElementById('invCustomerPhone').value.trim();
  const notes = document.getElementById('invNotes').value.trim();

  // التحقق من المدخلات
  if (!employeeName) {
    showToast('يرجى كتابة اسم الموظف المسؤول أولاً', 'error');
    document.getElementById('invEmployeeName').focus();
    return;
  }

  if (!customerName) {
    showToast('يرجى كتابة اسم الزبون', 'error');
    document.getElementById('invCustomerName').focus();
    return;
  }

  if (state.cart.length === 0) {
    showToast('يرجى إضافة منتج واحد على الأقل للفاتورة', 'error');
    return;
  }

  // حفظ اسم الموظف في الذاكرة لتسهيل الفواتير القادمة
  localStorage.setItem('last_employee_name', employeeName);

  let installmentDetails = null;
  if (state.currentPaymentMethod === 'installments') {
    const downPayment = parseFloat(document.getElementById('instDownPayment').value) || 0;
    const durationNumber = document.getElementById('instDurationNumber').value.trim();
    const durationType = document.getElementById('instDurationType').value;
    const scheduleNotes = document.getElementById('instScheduleNotes').value.trim();

    if (!durationNumber || parseInt(durationNumber) <= 0) {
      showToast('يرجى تحديد المدة التي سيدفع فيها الزبون باقي المبلغ', 'error');
      document.getElementById('instDurationNumber').focus();
      return;
    }

    const durationLabel = durationType === 'months' ? 'شهر' : 'يوم';
    const duration = `${durationNumber} ${durationLabel}`;

    const totalAmount = state.cart.reduce((s, i) => s + (i.sellPrice * i.quantity), 0);
    const remainingAmount = Math.max(0, totalAmount - downPayment);

    installmentDetails = {
      downPayment,
      remainingAmount,
      duration,
      scheduleNotes
    };
  }

  const isPurchase = state.invoiceType === 'purchase';

  const payload = {
    invoiceType: state.invoiceType || 'sales',
    employeeName,
    customerName,
    customerPhone,
    customerId: state.selectedInvoiceCustomer ? state.selectedInvoiceCustomer.id : undefined,
    customerSystemNumber: state.selectedInvoiceCustomer ? state.selectedInvoiceCustomer.systemNumber : undefined,
    notes,
    items: state.cart,
    paymentMethod: isPurchase ? 'cash' : state.currentPaymentMethod,
    installmentDetails: isPurchase ? null : installmentDetails
  };

  const btn = document.getElementById('btnSubmitInvoice');
  btn.disabled = true;
  btn.innerHTML = isPurchase 
    ? '<span>⏳</span><span>جاري حفظ فاتورة المشتريات وزيادة المخزن وتيليجرام...</span>'
    : '<span>⏳</span><span>جاري حفظ الفاتورة وإرسال الإشعار لتيليجرام...</span>';

  try {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.invoice) {
      if (isPurchase) {
        showToast('🎉 تم إنشاء فاتورة المشتريات وزيادة كميات المخزن بنجاح!', 'success');
      } else {
        showToast('🎉 تم إنشاء فاتورة المبيعات بنجاح!', 'success');
      }

      // فحص نتيجة تيليجرام
      if (data.telegramNotification && data.telegramNotification.ok) {
        showToast('✈️ تم إرسال تفاصيل الفاتورة كاملة إلى تيليجرام بنجاح', 'success');
      } else if (data.invoice.telegramStatus && !data.invoice.telegramStatus.sent) {
        showToast(`⚠️ تنبيه تيليجرام: ${data.invoice.telegramStatus.error || 'لم يتم الإرسال'}`, 'warning');
      }

      // إرسال ملف الـ PDF الرسمي للفاتورة تلقائياً إلى تيليجرام
      try {
        await sendInvoicePdfToTelegram(data.invoice);
      } catch (pdfErr) {
        console.warn('Auto send invoice PDF to Telegram error:', pdfErr);
      }

      // تفريغ السلة والمدخلات مع الإبقاء على اسم الموظف
      state.cart = [];
      state.selectedInvoiceCustomer = null;
      const debtAlert = document.getElementById('invCustomerDebtAlert');
      if (debtAlert) debtAlert.style.display = 'none';

      updateCartUI();
      renderCatalog();
      document.getElementById('invCustomerName').value = '';
      document.getElementById('invCustomerPhone').value = '';
      document.getElementById('invNotes').value = '';
      if (document.getElementById('instDurationNumber')) document.getElementById('instDurationNumber').value = '';
      if (document.getElementById('instScheduleNotes')) document.getElementById('instScheduleNotes').value = '';
      if (document.getElementById('instDownPayment')) document.getElementById('instDownPayment').value = '0';
      selectPaymentMethod('cash');

      // تحديث السجل والمنتجات والمخزون والإحصائيات والزبائن
      await loadProducts();
      renderCatalog();
      loadInvoices();
      loadDashboard();
      await loadCustomers();

      // فتح نافذة المعاينة والطباعة مباشرة للفاتورة الجديدة
      openInvoiceViewModal(data.invoice);

    } else {
      showToast(data.error || 'فشل حفظ الفاتورة', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = isPurchase
      ? '<span>🚀</span><span>إنشاء فاتورة مشتريات وتوريد البضاعة للمخزن</span>'
      : '<span>🚀</span><span>إنشاء الفاتورة وإرسال لتيليجرام</span>';
  }
}

// -------------------------------------------------------------
// أرشيف وسجل الفواتير
// -------------------------------------------------------------
async function loadInvoices() {
  try {
    const res = await fetch('/api/invoices');
    const data = await res.json();
    if (data.success) {
      state.invoices = data.invoices || [];
      renderInvoicesTable();
    }
  } catch (err) {
    console.error('فشل جلب الفواتير:', err);
  }
}

function filterInvoicesByPayment(method, btn) {
  state.invoicesFilter = method;
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
  renderInvoicesTable();
}

function renderInvoicesTable() {
  const tbody = document.getElementById('invoicesTableBody');
  const emptyMsg = document.getElementById('emptyInvoicesMessage');
  const currency = state.settings.currency || 'شيكل';

  if (!tbody) return;

  let filtered = state.invoices;

  if (state.invoicesFilter !== 'all') {
    filtered = filtered.filter(i => i.paymentMethod === state.invoicesFilter);
  }

  if (state.invoicesSearch) {
    filtered = filtered.filter(i =>
      String(i.invoiceNumber).includes(state.invoicesSearch) ||
      (i.customerName && i.customerName.toLowerCase().includes(state.invoicesSearch)) ||
      (i.employeeName && i.employeeName.toLowerCase().includes(state.invoicesSearch)) ||
      (i.customerPhone && i.customerPhone.includes(state.invoicesSearch))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  tbody.innerHTML = filtered.map(inv => {
    const dateStr = formatAppDateTime(inv.createdAt);

    const isInstallments = inv.paymentMethod === 'installments';
    const payBadge = isInstallments ? `
      <span class="badge badge-warning" title="الدفعة الأولى: ${inv.installmentDetails?.downPayment} | المتبقي: ${inv.installmentDetails?.remainingAmount} (${inv.installmentDetails?.duration})">
        ⏳ أقساط (${inv.installmentDetails?.duration || 'مجدولة'})
      </span>
    ` : `<span class="badge badge-success">💵 كاش</span>`;

    const tgSent = inv.telegramStatus && inv.telegramStatus.sent;
    const tgBadge = tgSent ? `
      <span class="badge badge-telegram" title="تم الإرسال بنجاح">✈️ تم الإرسال</span>
    ` : `
      <span class="badge badge-danger" title="${inv.telegramStatus?.error || 'لم يتم الإرسال'}">⚠️ لم يرسل</span>
    `;

    return `
      <tr>
        <td><strong style="color: var(--primary-dark);">#${inv.invoiceNumber || inv.id}</strong></td>
        <td style="font-size: 0.82rem; color: var(--text-muted);">${dateStr}</td>
        <td><strong>${inv.employeeName || 'غير محدد'}</strong></td>
        <td>
          <div><strong>${inv.customerName}</strong></div>
          ${inv.customerPhone ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${inv.customerPhone}</div>` : ''}
        </td>
        <td>${payBadge}</td>
        <td style="font-weight: 800;">${(inv.summary?.totalAmount || 0).toLocaleString('en-US')} ${currency}</td>
        <td style="color: var(--success-dark); font-weight: 800;">+${(inv.summary?.totalProfit || 0).toLocaleString('en-US')} ${currency}</td>
        <td>${tgBadge}</td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn btn-sm btn-primary" onclick="openInvoiceViewModalById('${inv.id}')" title="معاينة وطباعة">
              🖨️ عرض
            </button>
            ${!tgSent ? `
              <button class="btn btn-sm btn-telegram" onclick="resendInvoiceTelegram('${inv.id}')" title="إعادة الإرسال لتيليجرام">
                ✈️
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------
// معاينة وطباعة الفاتورة
// -------------------------------------------------------------
function openInvoiceViewModalById(id) {
  const inv = state.invoices.find(i => i.id === id || i.invoiceNumber === parseInt(id));
  if (inv) openInvoiceViewModal(inv);
}

function openInvoiceViewModal(invoice) {
  state.currentViewingInvoice = invoice;
  setInvoicePrintMode('customer'); // الافتراضي نسخة الزبون
  document.getElementById('invoiceViewModal').classList.add('active');
}

function closeInvoiceModal() {
  document.getElementById('invoiceViewModal').classList.remove('active');
}

function setInvoicePrintMode(mode) {
  state.printMode = mode;

  const btnCustomer = document.getElementById('btnCopyCustomer');
  const btnInternal = document.getElementById('btnCopyInternal');

  if (mode === 'customer') {
    btnCustomer.className = 'btn btn-sm btn-primary';
    btnInternal.className = 'btn btn-sm btn-secondary';
  } else {
    btnCustomer.className = 'btn btn-sm btn-secondary';
    btnInternal.className = 'btn btn-sm btn-primary';
  }

  renderPrintableInvoice();
}

function renderPrintableInvoice() {
  const container = document.getElementById('printableArea');
  const inv = state.currentViewingInvoice;
  if (!container || !inv) return;

  const currency = state.settings.currency || 'شيكل';
  const isInternal = state.printMode === 'internal';

  const dateStr = formatAppDateTime(inv.createdAt);

  const isInstallments = inv.paymentMethod === 'installments';
  const inst = inv.installmentDetails || {};

  container.innerHTML = `
    <div class="inv-header">
      <div>
        <div class="inv-company-title">${state.settings.companyName || 'شركة المبيعات'}</div>
        <div class="inv-company-sub">${state.settings.companyAddress || ''} | هاتف: ${state.settings.companyPhone || ''}</div>
        <div style="font-size: 0.8rem; font-weight: 700; color: ${isInternal ? 'var(--primary)' : '#059669'}; margin-top: 0.25rem;">
          ${isInternal ? '🔒 نسخة الإدارة والمحاسبة (تتضمن رأس المال والأرباح)' : '📄 فاتورة مبيعات رسمية - نسخة الزبون'}
        </div>
      </div>
      <div class="inv-number-badge">
        <div class="inv-number-title">فاتورة #${inv.invoiceNumber || inv.id}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</div>
      </div>
    </div>

    <div class="inv-details-grid">
      <div>
        <strong>👤 العميل / الزبون:</strong> ${inv.customerName}<br>
        ${inv.customerPhone ? `<strong>📞 الهاتف:</strong> ${inv.customerPhone}<br>` : ''}
        ${inv.notes ? `<strong>📝 ملاحظات:</strong> ${inv.notes}` : ''}
      </div>
      <div>
        <strong>👨‍💼 الموظف المسؤول:</strong> ${inv.employeeName || 'غير محدد'}<br>
        <strong>💳 طريقة الدفع:</strong> ${isInstallments ? 'أقساط مجدولة' : 'نقداً (كاش)'}<br>
        <strong>📅 تاريخ الفاتورة:</strong> ${dateStr}
      </div>
    </div>

    <!-- جدول المنتجات -->
    <table class="inv-table">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>المنتج / الصنف</th>
          ${isInternal ? '<th>رأس المال (التكلفة)</th>' : ''}
          <th>سعر الوحدة</th>
          <th style="text-align: center;">الكمية</th>
          <th style="text-align: left;">الإجمالي</th>
          ${isInternal ? '<th style="text-align: left;">ربح البند</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${(inv.items || []).map((item, idx) => {
          const totalSell = (item.sellPrice || 0) * (item.quantity || 1);
          const unitProfit = (item.sellPrice || 0) - (item.costPrice || 0);
          const totalItemProfit = unitProfit * (item.quantity || 1);

          return `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${item.productName}</strong></td>
              ${isInternal ? `<td style="color: #64748b;">${(item.costPrice || 0).toLocaleString('en-US')} ${currency}</td>` : ''}
              <td>${(item.sellPrice || 0).toLocaleString('en-US')} ${currency}</td>
              <td style="text-align: center; font-weight: 700;">${item.quantity || 1}</td>
              <td style="text-align: left; font-weight: 700;">${totalSell.toLocaleString('en-US')} ${currency}</td>
              ${isInternal ? `<td style="text-align: left; color: #047857; font-weight: 800;">+${totalItemProfit.toLocaleString('en-US')} ${currency}</td>` : ''}
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- الأقساط إذا وجدت -->
    ${isInstallments ? `
      <div class="inv-installment-schedule">
        <h4 style="font-weight: 800; color: #92400e; margin-bottom: 0.4rem;">⏳ تفاصيل وجدول سداد الأقساط:</h4>
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
          <div><strong>الدفعة الأولى المدفوعة:</strong> ${(inst.downPayment || 0).toLocaleString('en-US')} ${currency}</div>
          <div><strong>المبلغ المتبقي للتقسيط:</strong> ${(inst.remainingAmount || 0).toLocaleString('en-US')} ${currency}</div>
          <div><strong>مدة سداد باقي المبلغ:</strong> ${inst.duration || 'حسب الاتفاق'}</div>
        </div>
        ${inst.scheduleNotes ? `<div style="margin-top: 0.4rem;"><strong>ملاحظات السداد:</strong> ${inst.scheduleNotes}</div>` : ''}
      </div>
    ` : ''}

    <!-- الملخص المالي -->
    <div class="inv-totals-box">
      <table class="inv-totals-table">
        ${isInternal ? `
          <tr>
            <td style="color: #64748b;">إجمالي التكلفة (رأس المال):</td>
            <td style="text-align: left; font-weight: 700; color: #64748b;">${(inv.summary?.totalCost || 0).toLocaleString('en-US')} ${currency}</td>
          </tr>
          <tr style="background: #f0fdf4;">
            <td style="color: #047857; font-weight: 800;">صافي أرباح الفاتورة:</td>
            <td style="text-align: left; font-weight: 800; color: #047857;">+${(inv.summary?.totalProfit || 0).toLocaleString('en-US')} ${currency} (${inv.summary?.profitMarginPercentage || 0}%)</td>
          </tr>
        ` : ''}
        <tr class="total-row">
          <td>المبلغ الإجمالي النهائي:</td>
          <td style="text-align: left;">${(inv.summary?.totalAmount || 0).toLocaleString('en-US')} ${currency}</td>
        </tr>
      </table>
    </div>

    <div class="inv-footer">
      <p>${state.settings.invoiceFooterText || 'شكراً لتعاملكم معنا'}</p>
    </div>
  `;
}

async function resendCurrentInvoiceTelegram() {
  if (!state.currentViewingInvoice) return;
  await resendInvoiceTelegram(state.currentViewingInvoice.id);
}

async function resendInvoiceTelegram(invoiceId) {
  showToast('جاري إرسال الفاتورة وملف الـ PDF لتيليجرام...', 'info');
  try {
    const res = await fetch(`/api/invoices/${invoiceId}/resend-telegram`, { method: 'POST' });
    const data = await res.json();
    if (data.success && data.result && data.result.ok) {
      await loadInvoices();
      const updated = state.invoices.find(i => i.id === invoiceId);
      if (updated) {
        if (state.currentViewingInvoice && state.currentViewingInvoice.id === invoiceId) {
          state.currentViewingInvoice = updated;
        }
        await sendInvoicePdfToTelegram(updated);
        showToast('✈️ تم إرسال الفاتورة وملف الـ PDF بنجاح لتيليجرام!', 'success');
      } else {
        showToast('✈️ تم إرسال الفاتورة بنجاح لتيليجرام!', 'success');
      }
    } else {
      showToast(`فشل الإرسال: ${data.result?.error || data.error || 'خطأ غير معروف'}`, 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم', 'error');
  }
}

// -------------------------------------------------------------
// لوحة الإحصائيات (Dashboard) وإدارة الفترات الزمنية ورأس المال
// -------------------------------------------------------------
function selectDashboardPeriod(period, btn) {
  state.dashboardPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const customForm = document.getElementById('customPeriodForm');
  if (customForm && period !== 'custom') {
    customForm.style.display = 'none';
  }

  const badge = document.getElementById('dashCurrentPeriodBadge');
  if (badge) {
    let label = '🌟 كل الأوقات';
    if (period === 'week') label = '📅 هذا الأسبوع (7 أيام)';
    if (period === 'month') label = '🗓️ هذا الشهر (30 يوماً)';
    if (period === 'year') label = '📆 هذه السنة';
    badge.innerHTML = `الفترة المحددة: <strong>${label}</strong>`;
  }

  loadDashboard();
}

function toggleCustomPeriodForm(btn) {
  const form = document.getElementById('customPeriodForm');
  if (!form) return;
  const isHidden = form.style.display === 'none' || !form.style.display;
  form.style.display = isHidden ? 'flex' : 'none';

  if (isHidden) {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    state.dashboardPeriod = 'custom';
    
    // وضع تواريخ افتراضية إن لم تكن محددة
    const startInput = document.getElementById('dashStartDate');
    const endInput = document.getElementById('dashEndDate');
    if (startInput && !startInput.value) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startInput.value = d.toISOString().split('T')[0];
    }
    if (endInput && !endInput.value) {
      endInput.value = new Date().toISOString().split('T')[0];
    }
  }
}

function applyCustomDateFilter() {
  const startInput = document.getElementById('dashStartDate');
  const endInput = document.getElementById('dashEndDate');
  if (!startInput || !endInput) return;

  state.dashboardPeriod = 'custom';
  state.dashboardStartDate = startInput.value;
  state.dashboardEndDate = endInput.value;

  const badge = document.getElementById('dashCurrentPeriodBadge');
  if (badge) {
    badge.innerHTML = `الفترة المحددة: <strong>فترة مخصصة (${startInput.value || 'البداية'} إلى ${endInput.value || 'الآن'})</strong>`;
  }

  loadDashboard();
}

async function loadDashboard() {
  try {
    let url = `/api/dashboard?period=${encodeURIComponent(state.dashboardPeriod || 'all')}`;
    if (state.dashboardPeriod === 'custom') {
      if (state.dashboardStartDate) url += `&startDate=${encodeURIComponent(state.dashboardStartDate)}`;
      if (state.dashboardEndDate) url += `&endDate=${encodeURIComponent(state.dashboardEndDate)}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.stats) {
      const stats = data.stats;
      const currency = state.settings.currency || 'شيكل';

      // مبيعات وأرباح الفترة الزمنية المحددة
      document.getElementById('kpiTotalSales').textContent = `${(stats.totalSales || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('kpiTotalProfit').textContent = `+${(stats.totalProfit || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('kpiTotalInvoices').textContent = `${stats.totalInvoicesCount || 0} فاتورة`;
      document.getElementById('kpiInstallmentsRemaining').textContent = `${(stats.installmentsRemaining || 0).toLocaleString('en-US')} ${currency}`;

      // رأس المال والمخزون الكلي في النظام (بناءً على الكمية × التكلفة)
      const capEl = document.getElementById('kpiTotalInventoryCapital');
      if (capEl) capEl.textContent = `${(stats.totalInventoryCapital || 0).toLocaleString('en-US')} ${currency}`;

      const stockEl = document.getElementById('kpiTotalStockUnits');
      if (stockEl) stockEl.textContent = `${(stats.totalStockUnits || 0).toLocaleString('en-US')} قطعة`;

      const retailEl = document.getElementById('kpiTotalInventoryRetail');
      if (retailEl) retailEl.textContent = `${(stats.totalInventoryRetail || 0).toLocaleString('en-US')} ${currency}`;

      const expProfitEl = document.getElementById('kpiExpectedInventoryProfit');
      if (expProfitEl) expProfitEl.textContent = `+${(stats.expectedInventoryProfit || 0).toLocaleString('en-US')} ${currency}`;

      const prodCountBadge = document.getElementById('kpiProductsTotalCountBadge');
      if (prodCountBadge) prodCountBadge.textContent = `${(stats.totalProductsCount || 0).toLocaleString('en-US')} صنف بالكتالوج`;

      // التفاصيل المالية
      document.getElementById('dashCashSales').textContent = `${(stats.cashSales || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('dashInstallmentsTotal').textContent = `${(stats.installmentsTotal || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('dashInstallmentsDown').textContent = `${(stats.installmentsDownPayments || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('dashProfitMargin').textContent = `${stats.profitMarginPercentage || 0}%`;

      document.getElementById('dashProductsCount').textContent = `${stats.totalProductsCount || 0} صنف`;
      document.getElementById('dashTotalCost').textContent = `${(stats.totalCost || 0).toLocaleString('en-US')} ${currency}`;
    }
  } catch (err) {
    console.error('فشل جلب الإحصائيات:', err);
  }
}

// -------------------------------------------------------------
// التنبيهات المنبثقة (Toast Notifications) مع دعم أزرار الإجراءات
// -------------------------------------------------------------
function showToast(message, type = 'info', actionText = null, actionCallback = null) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
      <span>${icon}</span>
      <span>${message}</span>
    </div>
    ${actionText ? `<button class="toast-action-btn" type="button">${actionText}</button>` : ''}
  `;

  if (actionText && actionCallback) {
    const btn = toast.querySelector('.toast-action-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        actionCallback();
        toast.remove();
      });
    }
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, actionText ? 5500 : 4000);
}

// =============================================================
// تفقيط الأرقام إلى كلمات باللغة العربية (Arabic Tafqeet)
// =============================================================
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
    if (h > 0) {
      res += hundreds[h];
    }
    if (rem > 0) {
      if (res) res += ' و';
      if (rem < 20) {
        res += ones[rem];
      } else {
        const o = rem % 10;
        const t = Math.floor(rem / 10);
        if (o > 0) {
          res += ones[o] + ' و' + tens[t];
        } else {
          res += tens[t];
        }
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

// -------------------------------------------------------------
// إدارة سندات القبض (Receipt Vouchers)
// -------------------------------------------------------------
function updateReceiptTafqeet(val) {
  const box = document.getElementById('rcpTafqeetBox');
  const textEl = document.getElementById('rcpTafqeetText');
  const curBadge = document.getElementById('rcpCurrencyBadge');
  const currency = state.settings.currency || 'شيكل';
  if (curBadge) curBadge.textContent = currency;

  if (!val || parseFloat(val) <= 0) {
    if (box) box.style.display = 'none';
    return;
  }

  const words = tafqeetArabic(val, currency);
  if (textEl) textEl.textContent = words;
  if (box) box.style.display = 'flex';
}

function addReceiptAmountPreset(amt) {
  const input = document.getElementById('rcpAmount');
  if (!input) return;
  const current = parseFloat(input.value) || 0;
  const updated = current + amt;
  input.value = updated;
  handleReceiptAmountChange(updated);
}

function handleReceiptAmountChange(val) {
  updateReceiptTafqeet(val);
  const amount = parseFloat(val) || 0;
  const prevBalInput = document.getElementById('rcpPreviousBalance');
  const remHint = document.getElementById('rcpDebtRemainingHint');
  const remInput = document.getElementById('rcpRemainingBalance');
  const cur = state.settings.currency || 'شيكل';

  if (prevBalInput && remHint) {
    const prev = parseFloat(prevBalInput.value) || 0;
    const rem = Math.max(0, prev - amount);
    if (remInput) remInput.value = rem;
    remHint.innerHTML = `الرصيد بعد السند: <strong style="color: ${rem === 0 ? '#059669' : '#dc2626'};">${rem.toLocaleString('en-US')} ${cur}</strong>`;
  }
}

async function handleReceiptSubmit(event) {
  event.preventDefault();

  const employeeName = document.getElementById('rcpEmployeeName').value.trim();
  const customerName = document.getElementById('rcpCustomerName').value.trim();
  const customerPhone = document.getElementById('rcpCustomerPhone').value.trim();
  const amount = parseFloat(document.getElementById('rcpAmount').value);
  const paymentMethod = document.getElementById('rcpPaymentMethod').value;
  const description = document.getElementById('rcpDescription').value.trim();
  const notes = document.getElementById('rcpNotes').value.trim();

  if (!employeeName) {
    showToast('يرجى إدخال اسم الموظف محرر السند', 'error');
    return;
  }
  if (!customerName) {
    showToast('يرجى إدخال اسم الزبون', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
    return;
  }

  // حفظ اسم الموظف للاستخدام اللاحق
  localStorage.setItem('last_employee_name', employeeName);

  const submitBtn = document.getElementById('btnSubmitReceipt');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳</span><span>جاري الحفظ وإرسال الإشعار...</span>';
  }

  try {
    const res = await fetch('/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeName,
        customerName,
        customerPhone,
        amount,
        paymentMethod,
        description,
        notes
      })
    });

    const data = await res.json();
    if (data.success && data.receipt) {
      showToast(`🎉 تم إصدار سند القبض رقم #${data.receipt.receiptNumber} بنجاح`, 'success');
      state.receipts.unshift(data.receipt);
      renderReceiptsTable();

      // إرسال ملف PDF لسند القبض المعتمد تلقائياً إلى تيليجرام
      showToast('✈️ جاري إرسال سند القبض الرسمي كملف PDF إلى تيليجرام...', 'info');
      try {
        await sendReceiptPdfToTelegram(data.receipt);
      } catch (pdfErr) {
        console.warn('Auto send receipt PDF to Telegram error:', pdfErr);
      }

      resetReceiptForm();
      await loadCustomers();
      viewReceipt(data.receipt.id);
    } else {
      showToast(data.error || 'حدث خطأ أثناء إصدار السند', 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم لحفظ السند', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>💾</span><span>حفظ وإصدار السند</span>';
    }
  }
}

function resetReceiptForm() {
  const form = document.getElementById('receiptForm');
  if (form) form.reset();
  const tafqeetBox = document.getElementById('rcpTafqeetBox');
  if (tafqeetBox) tafqeetBox.style.display = 'none';
  const debtCard = document.getElementById('rcpCustomerDebtCard');
  if (debtCard) debtCard.style.display = 'none';
  const lastEmp = localStorage.getItem('last_employee_name');
  if (lastEmp) {
    const empInput = document.getElementById('rcpEmployeeName');
    if (empInput) empInput.value = lastEmp;
  }
}

async function downloadCurrentReceiptPdf() {
  if (!state.currentViewingReceipt) return;
  const r = state.currentViewingReceipt;
  showToast('جاري تجهيز وتحميل سند القبض PDF...', 'info');
  try {
    const html = buildPrintableReceiptHtml(r);
    const fileName = `سند_قبض_${r.receiptNumber}.pdf`;
    const blob = await generatePdfBlobFromHtml(html, fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    showToast('تم تحميل سند القبض PDF بنجاح', 'success');
  } catch (err) {
    showToast('تعذر تحميل ملف الـ PDF', 'error');
  }
}

async function resendCurrentReceiptPdfTelegram() {
  if (!state.currentViewingReceipt) return;
  const r = state.currentViewingReceipt;
  showToast('جاري إرسال سند القبض PDF لتيليجرام...', 'info');
  try {
    await sendReceiptPdfToTelegram(r);
    showToast('✈️ تم إرسال سند القبض PDF بنجاح إلى تيليجرام!', 'success');
  } catch (err) {
    showToast('فشل إرسال السند لتيليجرام', 'error');
  }
}

async function loadReceipts() {
  try {
    const res = await fetch('/api/receipts');
    const data = await res.json();
    if (data.success) {
      state.receipts = data.receipts || [];
      renderReceiptsTable();
    }
  } catch (err) {
    console.error('فشل جلب سندات القبض:', err);
  }
}

function handleReceiptsSearch(val) {
  state.receiptsSearch = (val || '').trim().toLowerCase();
  renderReceiptsTable();
}

function renderReceiptsTable() {
  const tbody = document.getElementById('receiptsTableBody');
  const emptyMsg = document.getElementById('emptyReceiptsMessage');
  const totalAmountEl = document.getElementById('receiptsTotalAmount');
  const totalCountEl = document.getElementById('receiptsTotalCount');
  const countBadge = document.getElementById('receiptsCountBadge');
  const cur = state.settings.currency || 'شيكل';

  if (!tbody) return;

  const filtered = state.receipts.filter(r => {
    if (!state.receiptsSearch) return true;
    const s = state.receiptsSearch;
    return (
      (r.receiptNumber && String(r.receiptNumber).includes(s)) ||
      (r.customerName && r.customerName.toLowerCase().includes(s)) ||
      (r.employeeName && r.employeeName.toLowerCase().includes(s)) ||
      (r.customerPhone && r.customerPhone.includes(s)) ||
      (r.description && r.description.toLowerCase().includes(s))
    );
  });

  const totalSum = state.receipts.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
  if (totalAmountEl) totalAmountEl.textContent = `${totalSum.toLocaleString('en-US')} ${cur}`;
  if (totalCountEl) totalCountEl.textContent = state.receipts.length;
  if (countBadge) countBadge.textContent = `${state.receipts.length} سند`;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  const methodBadges = {
    cash: '<span class="badge badge-success">💵 نقداً</span>',
    transfer: '<span class="badge badge-primary">🏦 تحويل بنكي</span>',
    check: '<span class="badge badge-warning">📝 شيك</span>'
  };

  tbody.innerHTML = filtered.map(r => {
    const dateStr = formatAppDateTime(r.createdAt);

    return `
      <tr>
        <td style="font-weight: 800; font-family: monospace;">#${r.receiptNumber}</td>
        <td style="font-size: 0.85rem;">
          <div>${dateStr}</div>
        </td>
        <td>
          <strong>${escapeHtml(r.customerName)}</strong>
          ${r.customerPhone ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${r.customerPhone}</div>` : ''}
        </td>
        <td style="font-weight: 800; color: var(--success-dark); font-size: 1.05rem;">
          ${(r.amount || 0).toLocaleString('en-US')} ${cur}
        </td>
        <td>${methodBadges[r.paymentMethod] || 'نقداً'}</td>
        <td style="font-size: 0.88rem;">${escapeHtml(r.employeeName || 'غير محدد')}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-sm btn-primary" onclick="viewReceipt('${r.id}')" title="معاينة وطباعة">
              <span>🖨️</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteReceipt('${r.id}')" title="حذف">
              <span>🗑️</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function viewReceipt(id) {
  const receipt = state.receipts.find(r => r.id === id);
  if (!receipt) return;

  state.currentViewingReceipt = receipt;
  const container = document.getElementById('printableReceiptArea');
  if (!container) return;

  const cur = state.settings.currency || 'شيكل';
  const words = tafqeetArabic(receipt.amount, cur);
  const dateStr = formatAppDateTime(receipt.createdAt);

  const methodLabel = {
    cash: 'نقداً (Cash)',
    transfer: 'تحويل بنكي (Bank Transfer)',
    check: 'شيك مصرفي (Bank Cheque)'
  }[receipt.paymentMethod] || 'نقداً';

  container.innerHTML = `
    <div class="receipt-header-row">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="font-size: 2.2rem;">💼</div>
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h2>
          <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">
            ${escapeHtml(state.settings.companyAddress || 'المركز التجاري الرئيسي')} | هاتف: ${escapeHtml(state.settings.companyPhone || '')}
          </div>
        </div>
      </div>

      <div style="text-align: left;">
        <div class="receipt-badge-title">سند قبض مالي</div>
        <div style="margin-top: 0.4rem; font-weight: 800; font-family: monospace; font-size: 1.1rem; color: #1e293b;">
          رقم: RCP-${receipt.receiptNumber}
        </div>
        <div style="font-size: 0.8rem; color: #64748b;">${dateStr}</div>
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
      <div class="receipt-amount-display">
        المبلغ: ${(receipt.amount || 0).toLocaleString('en-US')} ${cur}
      </div>
    </div>

    <div class="receipt-details-box">
      <div class="receipt-line">
        <span class="line-title">استلمنا من السيد/ة:</span>
        <span class="line-content">${escapeHtml(receipt.customerName)}</span>
        ${receipt.customerPhone ? `<span style="font-size: 0.88rem; color: #64748b;">(هاتف: ${receipt.customerPhone})</span>` : ''}
      </div>

      <div class="receipt-line">
        <span class="line-title">مبلغ وقدره بالأحرف:</span>
        <span class="line-content" style="color: #047857;">${words || `${receipt.amount} ${cur}`}</span>
      </div>

      <div class="receipt-line">
        <span class="line-title">طريقة الدفع:</span>
        <span class="line-content">${methodLabel}</span>
      </div>

      ${receipt.description ? `
      <div class="receipt-line">
        <span class="line-title">وذلك لقاء (البيان):</span>
        <span class="line-content">${escapeHtml(receipt.description)}</span>
      </div>` : ''}

      ${receipt.notes ? `
      <div class="receipt-line">
        <span class="line-title">ملاحظات:</span>
        <span class="line-content" style="font-weight: 500; font-size: 0.95rem; color: #475569;">${escapeHtml(receipt.notes)}</span>
      </div>` : ''}
    </div>

    <div class="receipt-signatures-row">
      <div class="receipt-sig-box">
        <div style="font-size: 0.85rem; color: #64748b;">منظم السند (الموظف)</div>
        <div class="receipt-sig-line">${escapeHtml(receipt.employeeName || 'الموظف المسؤول')}</div>
      </div>

      <div class="receipt-sig-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div style="width: 80px; height: 80px; border: 2px dashed #94a3b8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; color: #64748b; text-align: center; line-height: 1.2;">
          خاتم الشركة<br>المعتمد
        </div>
      </div>

      <div class="receipt-sig-box">
        <div style="font-size: 0.85rem; color: #64748b;">المستلم / الدافع</div>
        <div class="receipt-sig-line">${escapeHtml(receipt.customerName)}</div>
      </div>
    </div>

    <div style="margin-top: 1.5rem; text-align: center; font-size: 0.8rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
      ${escapeHtml(state.settings.invoiceFooterText || 'شكراً لتعاملكم معنا')}
    </div>
  `;

  const modal = document.getElementById('receiptViewModal');
  if (modal) modal.classList.add('active');
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptViewModal');
  if (modal) modal.classList.remove('active');
}

function printReceiptVoucher() {
  window.print();
}

async function deleteReceipt(id) {
  if (!confirm('هل أنت متأكد من حذف سند القبض هذا نهائياً من السجل؟')) return;

  try {
    const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('تم حذف سند القبض بنجاح', 'success');
      state.receipts = state.receipts.filter(r => r.id !== id);
      renderReceiptsTable();
    } else {
      showToast(data.error || 'فشل حذف السند', 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم لحذف السند', 'error');
  }
}

// =============================================================
// نظام الجرد والمخزون الفعلي (Inventory Audit System)
// =============================================================
function formatRelativeDate(isoStr) {
  if (!isoStr) return 'لم يُعدل بعد (الكمية الأولية)';

  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return 'غير معروف';

  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'مسائاً' : 'صباحاً';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = `الساعة ${hours}:${minutes} ${period}`;

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (diffMin < 2) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (isToday) return `اليوم ${timeStr}`;
  if (isYesterday) return `أمس ${timeStr}`;

  return `${day}-${month}-${year} ${timeStr}`;
}

function handleInventorySearch(val) {
  state.inventorySearch = (val || '').trim().toLowerCase();
  state.inventoryCurrentPage = 1;
  renderInventoryList();
}

function handleInventoryCategoryFilter(val) {
  state.inventoryCategory = val || 'all';
  state.inventoryCurrentPage = 1;
  renderInventoryList();
}

function setInventoryQuickFilter(type, btn) {
  state.inventoryQuickFilter = type;
  state.inventoryCurrentPage = 1;

  document.querySelectorAll('.category-chips .chip').forEach(b => {
    if (b.id && b.id.startsWith('invFilterBtn')) {
      b.classList.remove('active');
    }
  });
  if (btn) btn.classList.add('active');

  renderInventoryList();
}

function renderInventoryList() {
  const container = document.getElementById('inventoryItemsContainer');
  if (!container) return;

  const cur = state.settings.currency || 'شيكل';

  // حساب الإحصائيات العامة
  const totalProducts = state.products.length;
  const outOfStock = state.products.filter(p => (state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0)) === 0).length;
  const lowStock = state.products.filter(p => {
    const s = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
    return s > 0 && s <= 3;
  }).length;
  const modifiedCount = state.inventoryPendingUpdates.size;

  // تحديث شارات الـ Toolbar
  const totalEl = document.getElementById('invTotalProductsBadge');
  const outEl = document.getElementById('invOutOfStockBadge');
  const lowEl = document.getElementById('invLowStockBadge');
  const modPill = document.getElementById('invPillModified');
  const modBadge = document.getElementById('invModifiedCountBadge');
  const navModBadge = document.getElementById('inventoryModifiedBadge');

  if (totalEl) totalEl.textContent = `${totalProducts.toLocaleString('en-US')} صنف`;
  if (outEl) outEl.textContent = `${outOfStock} صنف نافد`;
  if (lowEl) lowEl.textContent = `${lowStock} كمية منخفضة (≤3)`;

  if (modifiedCount > 0) {
    if (modPill) modPill.style.display = 'inline-flex';
    if (modBadge) modBadge.textContent = `تم تعديل ${modifiedCount} صنف`;
    if (navModBadge) {
      navModBadge.style.display = 'inline-block';
      navModBadge.textContent = modifiedCount;
    }
  } else {
    if (modPill) modPill.style.display = 'none';
    if (navModBadge) navModBadge.style.display = 'none';
  }

  // تحديث الشريط العائم لحفظ الجرد
  updateInventoryFloatingBar(modifiedCount);

  // تحديث شريط ملخص رأس مال وجرد الماركة المختارة
  const brandBanner = document.getElementById('invBrandSummaryBanner');
  if (brandBanner) {
    if (state.inventoryBrand && state.inventoryBrand !== 'all') {
      const brandProducts = state.products.filter(p => (p.brand || 'أخرى') === state.inventoryBrand);
      let bUnits = 0;
      let bCapital = 0;
      let bZero = 0;

      brandProducts.forEach(p => {
        const s = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
        bUnits += s;
        bCapital += s * (parseFloat(p.costPrice) || 0);
        if (s === 0) bZero++;
      });

      const sample = brandProducts[0];
      const displayTitle = sample && sample.brandAr && sample.brandAr !== sample.brand 
        ? `${sample.brand} (${sample.brandAr})` 
        : state.inventoryBrand;

      brandBanner.style.display = 'flex';
      brandBanner.innerHTML = `
        <div class="brand-summary-title">
          <span style="font-size: 1.5rem;">🏢</span>
          <div>
            <div>تقرير جرد ورأس مال: <strong style="color: #fef08a;">${escapeHtml(displayTitle)}</strong></div>
            <div style="font-size: 0.8rem; font-weight: 500; opacity: 0.85;">متابعة تفصيلية وفورية للكميات والتكلفة</div>
          </div>
        </div>
        <div class="brand-summary-stats">
          <div class="brand-summary-stat-item">
            <span class="brand-summary-stat-label">عدد الأصناف</span>
            <span class="brand-summary-stat-val">${brandProducts.length} صنف</span>
          </div>
          <div class="brand-summary-stat-item">
            <span class="brand-summary-stat-label">إجمالي القطع المتوفرة</span>
            <span class="brand-summary-stat-val">${bUnits.toLocaleString('en-US')} قطعة</span>
          </div>
          <div class="brand-summary-stat-item">
            <span class="brand-summary-stat-label">رأس المال المستثمر في الماركة</span>
            <span class="brand-summary-stat-val capital">${bCapital.toLocaleString('en-US')} ${cur}</span>
          </div>
          <div class="brand-summary-stat-item">
            <span class="brand-summary-stat-label">أصناف نافدة (0)</span>
            <span class="brand-summary-stat-val" style="color: ${bZero > 0 ? '#f87171' : '#a7f3d0'};">${bZero}</span>
          </div>
        </div>
      `;
    } else {
      brandBanner.style.display = 'none';
    }
  }

  // تصفية المنتجات بالجرد
  let filtered = state.products.filter(p => {
    // 1. فلتر الماركة بالجرد أولاً وبشكل حازم
    if (state.inventoryBrand && state.inventoryBrand !== 'all') {
      const pBrand = p.brand || 'أخرى';
      if (pBrand !== state.inventoryBrand) return false;
    }

    // 2. فلتر القسم الرئيسي
    if (state.inventoryCategory !== 'all') {
      const pMain = p.mainCategory || 'أخرى';
      if (pMain !== state.inventoryCategory) return false;
    }

    // 3. الفلتر السريع (معدلة، نفدت، قليلة)
    const currentStock = state.inventoryPendingUpdates.has(p.id)
      ? state.inventoryPendingUpdates.get(p.id)
      : (p.stock || 0);

    if (state.inventoryQuickFilter === 'modified') {
      if (!state.inventoryPendingUpdates.has(p.id)) return false;
    } else if (state.inventoryQuickFilter === 'zero') {
      if (currentStock > 0) return false;
    } else if (state.inventoryQuickFilter === 'low') {
      if (currentStock === 0 || currentStock > 3) return false;
    }

    // 4. فلتر البحث النصي بالجرد (محصور داخل الماركة مع تطبيع كامل للغة العربية والمرادفات)
    if (state.inventorySearch) {
      const qNorm = normalizeArabic(state.inventorySearch);
      const searchWords = qNorm.split(/\s+/).filter(w => w.length > 0);
      if (searchWords.length > 0) {
        const pNameNorm = normalizeArabic(p.name);
        const pCodeNorm = normalizeArabic(p.code);
        const pCatNorm = normalizeArabic(p.category);
        const pMainNorm = normalizeArabic(p.mainCategory);
        const pBrandNorm = normalizeArabic(p.brand);
        const pBrandArNorm = normalizeArabic(p.brandAr);

        const allWordsMatch = searchWords.every(word => {
          return matchArabicTerm(pNameNorm, word) ||
                 matchArabicTerm(pCodeNorm, word) ||
                 matchArabicTerm(pCatNorm, word) ||
                 matchArabicTerm(pMainNorm, word) ||
                 matchArabicTerm(pBrandNorm, word) ||
                 matchArabicTerm(pBrandArNorm, word);
        });

        if (!allWordsMatch) return false;
      }
    }

    return true;
  });

  // فرز أصناف الجرد: جعل جميع الأصناف المتوفرة أولاً، وجميع الأصناف التي كميتها = صفر بالأسفل تماماً
  filtered.sort((a, b) => {
    const stockA = state.inventoryPendingUpdates.has(a.id)
      ? state.inventoryPendingUpdates.get(a.id)
      : Math.max(0, parseInt(a.stock) || 0);
    const stockB = state.inventoryPendingUpdates.has(b.id)
      ? state.inventoryPendingUpdates.get(b.id)
      : Math.max(0, parseInt(b.stock) || 0);

    const aAvail = stockA > 0;
    const bAvail = stockB > 0;
    if (aAvail && !bAvail) return -1;
    if (!aAvail && bAvail) return 1;
    if (aAvail && bAvail) return stockB - stockA; // الأكثر توفراً أولاً
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="background: white; border-radius: var(--radius-lg); padding: 3rem; border: 1px dashed var(--border-color);">
        <div class="empty-state-icon">🔍</div>
        <h3>لا توجد أصناف مطابقة للبحث أو الماركة أو الفلتر المحدد</h3>
        <p>جرب تغيير الماركة أو اختيار تصنيف آخر</p>
      </div>
    `;
    renderInventoryPagination(0, 1, state.inventoryPageSize);
    return;
  }

  // التقسيم لصفحات (Pagination) للحفاظ على سرعة فائقة مع 1300 صنف
  const pageSize = state.inventoryPageSize || 40;
  const totalPages = Math.ceil(filtered.length / pageSize);
  if (state.inventoryCurrentPage > totalPages) state.inventoryCurrentPage = 1;
  const startIndex = (state.inventoryCurrentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  let zeroDividerAdded = false;
  container.innerHTML = pageItems.map(p => {
    const isModified = state.inventoryPendingUpdates.has(p.id);
    const originalStock = p.stock || 0;
    const currentStock = isModified ? state.inventoryPendingUpdates.get(p.id) : originalStock;
    const delta = currentStock - originalStock;

    let zeroDividerHtml = '';
    if (currentStock === 0 && !zeroDividerAdded) {
      zeroDividerAdded = true;
      zeroDividerHtml = `
        <div class="zero-stock-divider" style="grid-column: 1 / -1; margin: 1rem 0;">
          <div class="zero-title">
            <span>⚠️</span>
            <span>الأصناف التالية نفدت وكميتها = صفر (مفصولة بالأسفل)</span>
          </div>
          <span class="zero-badge">غير متوفر بالمستودع</span>
        </div>
      `;
    }

    // صياغة جملة التعديل المطلوبة بدقة:
    // مثلاً: "الكمية 3 | آخر تعديل قام به رامز أمس"
    let editorInfoHtml = '';
    if (isModified) {
      editorInfoHtml = `
        <div class="inv-meta-editor-row" style="color: #2563eb; font-weight: 700;">
          <span>⚡ تعديل حالي معلق:</span>
          <span>كان (${originalStock}) وأصبح (${currentStock})</span>
        </div>
      `;
    } else if (p.lastStockEditor) {
      editorInfoHtml = `
        <div class="inv-meta-editor-row">
          <span>👤 آخر تعديل قام به:</span>
          <strong>${escapeHtml(p.lastStockEditor)}</strong>
          <span>•</span>
          <span>${formatRelativeDate(p.lastStockUpdate)}</span>
        </div>
      `;
    } else {
      editorInfoHtml = `
        <div class="inv-meta-editor-row" style="color: #94a3b8;">
          <span>👤 آخر تعديل:</span>
          <em>لم يتم تعديله بعد (الكمية الافتراضية)</em>
        </div>
      `;
    }

    return (zeroDividerHtml || '') + `
      <div class="inventory-item-card ${isModified ? 'is-modified' : ''} ${currentStock === 0 ? 'is-zero-stock' : ''}" id="invCard-${p.id}">
        <!-- معلومات المنتج -->
        <div class="inv-prod-info">
          <div class="inv-prod-badges">
            <span class="inv-prod-code">🏷️ ${escapeHtml(p.code || 'PRD')}</span>
            <span class="inv-prod-category">${escapeHtml(p.mainCategory || 'عام')} ${p.category && p.category !== p.mainCategory ? `> ${escapeHtml(p.category)}` : ''}</span>
            <span class="inv-prod-brand">🏢 ${escapeHtml(p.brand || 'عام')}</span>
            ${isModified ? `<span class="inv-delta-badge ${delta >= 0 ? 'pos' : 'neg'}">${delta > 0 ? '+' + delta : delta}</span>` : ''}
          </div>
          <div class="inv-prod-name">${escapeHtml(p.name)}</div>
          <div class="inv-prod-prices">
            <span>سعر البيع: <strong>${(p.sellPrice || 0).toLocaleString('en-US')} ${cur}</strong></span>
            <span>سعر التكلفة: <strong>${(p.costPrice || 0).toLocaleString('en-US')} ${cur}</strong></span>
          </div>
        </div>

        <!-- عداد التحكم بالكمية -->
        <div>
          <div class="inv-stepper-box">
            <button class="inv-step-btn minus" onclick="stepInventoryStock('${p.id}', -1)" title="إنقاص الكمية (-1)">−</button>
            <input type="number" class="inv-qty-input" min="0" value="${currentStock}" onchange="setInventoryStockDirect('${p.id}', this.value)" title="اكتب الكمية مباشرة">
            <button class="inv-step-btn plus" onclick="stepInventoryStock('${p.id}', 1)" title="زيادة الكمية (+1)">+</button>
          </div>
        </div>

        <!-- بيانات المخزون وتفاصيل التعديل الأخيرة -->
        <div class="inv-meta-col">
          <div class="inv-meta-stock-row">
            <span>الكمية: <strong style="font-size: 1.15rem; color: ${currentStock === 0 ? 'var(--danger)' : 'var(--text-main)'};">${currentStock}</strong> قطعة</span>
            ${currentStock === 0 ? '<span class="badge badge-danger">نفدت الكمية</span>' : currentStock <= 3 ? '<span class="badge badge-warning">كمية منخفضة</span>' : '<span class="badge badge-success">متوفر</span>'}
          </div>
          ${editorInfoHtml}
        </div>
      </div>
    `;
  }).join('');

  renderInventoryPagination(filtered.length, state.inventoryCurrentPage, pageSize);
}

function updateInventoryFloatingBar(modifiedCount) {
  const floatingBar = document.getElementById('inventoryFloatingBar');
  const subtitleEl = document.getElementById('inventoryModifiedCountText');
  const saveBtn = document.getElementById('btnSaveInventory');

  if (!floatingBar) return;

  if (modifiedCount > 0) {
    floatingBar.classList.add('has-changes');
    if (subtitleEl) subtitleEl.textContent = `تم تعديل كميات (${modifiedCount}) أصناف بانتظار الحفظ`;
    if (saveBtn) {
      saveBtn.innerHTML = `<span>💾</span><span>حفظ التعديلات في المخزن (${modifiedCount} صنف)</span>`;
      saveBtn.className = 'btn btn-success btn-floating-save';
    }
  } else {
    floatingBar.classList.remove('has-changes');
    if (subtitleEl) subtitleEl.textContent = 'لم يتم تعديل أي صنف في هذه الجلسة بعد';
    if (saveBtn) {
      saveBtn.innerHTML = `<span>💾</span><span>حفظ التعديلات في المخزن</span>`;
      saveBtn.className = 'btn btn-secondary btn-floating-save';
    }
  }
}

function stepInventoryStock(id, step) {
  const p = state.products.find(prod => prod.id === id);
  if (!p) return;

  const originalStock = p.stock || 0;
  const currentVal = state.inventoryPendingUpdates.has(id)
    ? state.inventoryPendingUpdates.get(id)
    : originalStock;

  const newVal = Math.max(0, currentVal + step);

  if (newVal === originalStock) {
    state.inventoryPendingUpdates.delete(id);
  } else {
    state.inventoryPendingUpdates.set(id, newVal);
  }

  renderInventoryList();
}

function setInventoryStockDirect(id, val) {
  const p = state.products.find(prod => prod.id === id);
  if (!p) return;

  const originalStock = p.stock || 0;
  let parsed = parseInt(val);
  if (isNaN(parsed) || parsed < 0) parsed = 0;

  if (parsed === originalStock) {
    state.inventoryPendingUpdates.delete(id);
  } else {
    state.inventoryPendingUpdates.set(id, parsed);
  }

  renderInventoryList();
}

function syncAuditEmployeeName(val) {
  const clean = val || '';
  const topInput = document.getElementById('invAuditEmployeeName');
  const floatingInput = document.getElementById('floatingInvAuditEmployeeName');
  const modalInput = document.getElementById('modalAuditEmployeeName');
  if (topInput && topInput.value !== clean) topInput.value = clean;
  if (floatingInput && floatingInput.value !== clean) floatingInput.value = clean;
  if (modalInput && modalInput.value !== clean) modalInput.value = clean;
  if (clean.trim()) {
    localStorage.setItem('last_employee_name', clean.trim());
  }
}

function openAuditorModal() {
  const modal = document.getElementById('inventoryAuditorModal');
  const modalInput = document.getElementById('modalAuditEmployeeName');
  const saved = localStorage.getItem('last_employee_name') || '';
  if (modalInput) modalInput.value = saved;
  if (modal) modal.classList.add('active');
  setTimeout(() => {
    if (modalInput) modalInput.focus();
  }, 100);
}

function closeAuditorModal() {
  const modal = document.getElementById('inventoryAuditorModal');
  if (modal) modal.classList.remove('active');
}

async function handleAuditorModalSubmit(event) {
  if (event) event.preventDefault();
  const modalInput = document.getElementById('modalAuditEmployeeName');
  const name = modalInput ? modalInput.value.trim() : '';
  if (!name) {
    showToast('يرجى كتابة اسمك لحفظ الجرد', 'error');
    return;
  }
  syncAuditEmployeeName(name);
  closeAuditorModal();
  await executeSaveInventory(name);
}

function resetInventoryChanges() {
  if (state.inventoryPendingUpdates.size === 0) {
    showToast('لا توجد تعديلات معلقة للتراجع عنها', 'info');
    return;
  }
  showConfirmDialog({
    title: 'تجاهل تعديلات الجرد',
    message: `هل أنت متأكد من إلغاء وتجاهل التعديلات على ${state.inventoryPendingUpdates.size} أصناف وإعادة الكميات السابقة؟`,
    icon: '↩️',
    confirmText: 'نعم، إلغاء التعديلات',
    cancelText: 'تراجع',
    isDanger: true,
    onConfirm: () => {
      state.inventoryPendingUpdates.clear();
      renderInventoryList();
      showToast('تم التراجع عن التعديلات وإعادة الكميات الأصلية', 'info');
    }
  });
}

async function saveInventoryBulkChanges() {
  if (state.inventoryPendingUpdates.size === 0) {
    showToast('لم يتم تعديل أي كميات لحفظها. قم بزيادة أو إنقاص كمية أي صنف أولاً.', 'warning');
    return;
  }

  const auditEmpInput = document.getElementById('invAuditEmployeeName');
  const floatingEmpInput = document.getElementById('floatingInvAuditEmployeeName');
  let editorName = (auditEmpInput?.value || floatingEmpInput?.value || localStorage.getItem('last_employee_name') || '').trim();

  if (!editorName) {
    openAuditorModal();
    return;
  }

  await executeSaveInventory(editorName);
}

async function executeSaveInventory(editorName) {
  localStorage.setItem('last_employee_name', editorName);
  syncAuditEmployeeName(editorName);

  const saveBtn = document.getElementById('btnToolbarSaveInventory');
  const floatingSaveBtn = document.getElementById('btnFloatingPillSave');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>⏳</span><span>جاري حفظ الجرد...</span>';
  }
  if (floatingSaveBtn) {
    floatingSaveBtn.disabled = true;
    floatingSaveBtn.innerHTML = '<span>⏳</span><span>جاري الحفظ...</span>';
  }

  const updates = Array.from(state.inventoryPendingUpdates.entries()).map(([id, stock]) => ({
    id,
    stock
  }));

  try {
    const res = await fetch('/api/inventory/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, editorName })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`🎉 تم حفظ جرد ${updates.length} أصناف بنجاح وتوثيق التعديل باسم (${editorName})`, 'success');

      const now = new Date().toISOString();
      updates.forEach(({ id, stock }) => {
        const prod = state.products.find(p => p.id === id);
        if (prod) {
          prod.stock = stock;
          prod.lastStockUpdate = now;
          prod.lastStockEditor = editorName;
        }
      });

      // إرسال كشف PDF للأصناف المعدلة في الجرد لتيليجرام تلقائياً
      if (data.modifiedDetails && data.modifiedDetails.length > 0) {
        showToast('✈️ جاري إرسال محضر أصناف الجرد كملف PDF إلى تيليجرام...', 'info');
        try {
          await sendInventoryAuditPdfToTelegram(data.modifiedDetails, editorName);
        } catch (pdfErr) {
          console.warn('Auto send inventory audit PDF to Telegram error:', pdfErr);
        }
      }

      state.inventoryPendingUpdates.clear();
      renderInventoryList();
      renderCatalog();
      updateInvoiceDropdown();
    } else {
      showToast(data.error || 'حدث خطأ أثناء حفظ الجرد', 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم لحفظ الجرد', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>💾</span><span id="btnToolbarSaveText">حفظ تعديلات الجرد</span><span class="badge" id="btnToolbarSaveBadge" style="display:none; background: #fff; color: #047857; margin-right: 0.35rem;">0</span>';
    }
    if (floatingSaveBtn) {
      floatingSaveBtn.disabled = false;
      floatingSaveBtn.innerHTML = '<span>💾</span><span>حفظ التعديلات</span>';
    }
    updateInventoryFloatingBar(state.inventoryPendingUpdates.size);
  }
}

function renderInventoryPagination(totalItems, currentPage, pageSize) {
  const container = document.getElementById('inventoryPagination');
  if (!container) return;

  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<div style="display: flex; gap: 0.4rem; justify-content: center; align-items: center; flex-wrap: wrap;">`;

  if (currentPage > 1) {
    html += `<button class="btn btn-sm btn-secondary" onclick="goToInventoryPage(${currentPage - 1})">◀ السابق</button>`;
  }

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    html += `<button class="btn btn-sm btn-secondary" onclick="goToInventoryPage(1)">1</button>`;
    if (startPage > 2) html += `<span>...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    html += `<button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}" onclick="goToInventoryPage(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span>...</span>`;
    html += `<button class="btn btn-sm btn-secondary" onclick="goToInventoryPage(${totalPages})">${totalPages}</button>`;
  }

  if (currentPage < totalPages) {
    html += `<button class="btn btn-sm btn-secondary" onclick="goToInventoryPage(${currentPage + 1})">التالي ▶</button>`;
  }

  html += `<span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 0.5rem;">صفحة ${currentPage} من ${totalPages} (${totalItems} صنف)</span>`;
  html += `</div>`;

  container.innerHTML = html;
}

function goToInventoryPage(page) {
  state.inventoryCurrentPage = page;
  renderInventoryList();
  // التمرير بلطف لأعلى قائمة الجرد
  const toolbar = document.querySelector('.inventory-toolbar');
  if (toolbar) toolbar.scrollIntoView({ behavior: 'smooth' });
}



// ============================================================
// إعادة تعيين بيانات المبيعات والإحصائيات
// ============================================================
async function confirmResetSalesData() {
  const input = document.getElementById('resetConfirmInput');
  const resultBox = document.getElementById('resetSalesResult');
  const btn = document.getElementById('btnResetSales');

  const phrase = (input?.value || '').trim();
  if (phrase !== 'تأكيد الحذف') {
    if (input) {
      input.style.borderColor = '#dc2626';
      input.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.25)';
      setTimeout(() => { input.style.borderColor = '#fca5a5'; input.style.boxShadow = ''; }, 1500);
    }
    showToast('⚠️ يجب كتابة عبارة تأكيد الحذف بالضبط للمتابعة', 'warning');
    return;
  }

  const confirmed = window.confirm('⚠️ تحذير نهائي!\n\nسيتم حذف جميع الفواتير وسندات القبض بشكل دائم ولا يمكن التراجع عنه.\n\nهل أنت متأكد تماماً؟');
  if (!confirmed) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>جاري الحذف...</span>';
  }

  try {
    const response = await fetch('/api/reset-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmPhrase: 'تأكيد الحذف' })
    });
    const data = await response.json();

    if (data.success) {
      state.invoices = [];
      state.receipts = [];

      renderInvoicesTable();
      loadDashboardStats();
      renderReceiptsTable();

      const cur = state.settings.currency || 'شيكل';
      ['kpiTotalSales','kpiTotalProfit','kpiInstallmentsRemaining','dashCashSales','dashInstallmentsTotal','dashInstallmentsDown','dashTotalCost']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0 ' + cur; });
      const invEl = document.getElementById('kpiTotalInvoices'); if (invEl) invEl.textContent = '0';
      const marginEl = document.getElementById('dashProfitMargin'); if (marginEl) marginEl.textContent = '0%';

      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = '#d1fae5';
        resultBox.style.color = '#065f46';
        resultBox.style.border = '1px solid #6ee7b7';
        resultBox.innerHTML = '✅ تم بنجاح! تم حذف جميع الفواتير وسندات القبض. المنتجات والإعدادات سليمة.';
      }
      if (input) input.value = '';
      showToast('✅ تم إعادة تعيين جميع بيانات المبيعات بنجاح', 'success');
    } else {
      throw new Error(data.error || 'حدث خطأ غير متوقع');
    }
  } catch (err) {
    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.style.background = '#fee2e2';
      resultBox.style.color = '#991b1b';
      resultBox.style.border = '1px solid #fca5a5';
      resultBox.innerHTML = '❌ خطأ: ' + escapeHtml(err.message);
    }
    showToast('❌ فشل إعادة التعيين: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🗑️</span><span>إعادة تعيين المبيعات والإحصائيات</span>';
    }
  }
}

// ============================================================
// إدارة نوع الفاتورة (مبيعات أم مشتريات وتوريد)
// ============================================================
function setInvoiceType(type) {
  state.invoiceType = type;
  const btnSales = document.getElementById('btnTypeSales');
  const btnPurchase = document.getElementById('btnTypePurchase');
  const partyIcon = document.getElementById('invPartyIcon');
  const partyTitle = document.getElementById('invPartyTitle');
  const partyBadge = document.getElementById('invPartyBadge');
  const custNameLabel = document.getElementById('invCustomerNameLabel');
  const custPhoneLabel = document.getElementById('invCustomerPhoneLabel');
  const custInput = document.getElementById('invCustomerName');
  const sumTitle = document.getElementById('sumCardTitle');
  const sumLabelQty = document.getElementById('sumLabelTotalQty');
  const sumLabelFinal = document.getElementById('sumLabelFinalAmount');
  const rowCost = document.getElementById('rowSumCost');
  const rowProfit = document.getElementById('rowSumProfit');
  const thTotal = document.getElementById('thTotalItem');
  const btnSubmitText = document.getElementById('btnSubmitInvoiceText');
  const btnSubmitHint = document.getElementById('btnSubmitInvoiceHint');
  const paySelector = document.querySelector('.payment-selector')?.parentElement;

  if (type === 'purchase') {
    if (btnSales) btnSales.classList.remove('active');
    if (btnPurchase) btnPurchase.classList.add('active');
    if (partyIcon) partyIcon.textContent = '📥';
    if (partyTitle) partyTitle.textContent = 'بيانات المورد وتوريد البضاعة';
    if (partyBadge) {
      partyBadge.textContent = 'فاتورة توريد بضاعة (تزيد المخزن تلقائياً)';
      partyBadge.className = 'badge badge-success';
    }
    if (custNameLabel) custNameLabel.textContent = 'اسم المورد / المصدر:';
    if (custPhoneLabel) custPhoneLabel.textContent = 'هاتف المورد:';
    if (custInput) custInput.placeholder = 'اسم شركة التوريد / التاجر أو المورد...';
    if (sumTitle) sumTitle.textContent = 'حساب قيمة المشتريات الواردة';
    if (sumLabelQty) sumLabelQty.textContent = 'إجمالي القطع الواردة للمخزن:';
    if (sumLabelFinal) sumLabelFinal.textContent = 'إجمالي قيمة المشتريات (المضافة للمخزن):';
    if (rowCost) rowCost.style.display = 'none';
    if (rowProfit) rowProfit.style.display = 'none';
    if (thTotal) thTotal.textContent = 'إجمالي الشراء (التكلفة)';
    if (btnSubmitText) btnSubmitText.textContent = 'إنشاء فاتورة مشتريات وتوريد البضاعة للمخزن';
    if (btnSubmitHint) btnSubmitHint.textContent = '✈️ سيتم زيادة كميات المخزون فوراً بالبضاعة المشتراة وإرسال إشعار التوريد لتيليجرام.';
    if (paySelector) paySelector.style.display = 'none';
  } else {
    if (btnPurchase) btnPurchase.classList.remove('active');
    if (btnSales) btnSales.classList.add('active');
    if (partyIcon) partyIcon.textContent = '👤';
    if (partyTitle) partyTitle.textContent = 'بيانات الفاتورة والزبون';
    if (partyBadge) {
      partyBadge.textContent = 'بدون تسجيل دخول - اكتب اسمك فقط';
      partyBadge.className = 'badge badge-primary';
    }
    if (custNameLabel) custNameLabel.textContent = 'اسم الزبون:';
    if (custPhoneLabel) custPhoneLabel.textContent = 'رقم هاتف الزبون:';
    if (custInput) custInput.placeholder = 'اسم المشتري / الزبون...';
    if (sumTitle) sumTitle.textContent = 'الحساب المالي والأرباح';
    if (sumLabelQty) sumLabelQty.textContent = 'إجمالي عدد القطع:';
    if (sumLabelFinal) sumLabelFinal.textContent = 'المبلغ النهائي للفاتورة:';
    if (rowCost) rowCost.style.display = 'flex';
    if (rowProfit) rowProfit.style.display = 'flex';
    if (thTotal) thTotal.textContent = 'إجمالي البيع';
    if (btnSubmitText) btnSubmitText.textContent = 'إنشاء الفاتورة وإرسال لتيليجرام';
    if (btnSubmitHint) btnSubmitHint.textContent = '✈️ سيتم إرسال كافة تفاصيل الفاتورة، المنتجات، الموظف، وتفاصيل الحساب إلى حساب تيليجرام فوراً.';
    if (paySelector) paySelector.style.display = 'block';
  }

  updateCartUI();
}

function openAddProductModalForInvoice() {
  state.isAddingProductForInvoice = true;
  openAddProductModal();
  document.getElementById('productModalTitle').textContent = state.invoiceType === 'purchase'
    ? '📥 إضافة صنف جديد للمخزن وإدراجه بفاتورة المشتريات'
    : '➕ إضافة صنف جديد وإدراجه بالفاتورة';
}

// ============================================================
// إدارة ديون وأرصدة الزبائن (Dedicated Customers & Debts System)
// ============================================================
async function loadCustomers() {
  try {
    const res = await fetch('/api/customers');
    const data = await res.json();
    if (data.success) {
      state.customers = data.customers || [];
      updateCustomerDebtsBadge();
      renderCustomerTab();
    }
  } catch (err) {
    console.error('فشل جلب الزبائن:', err);
  }
}

function updateCustomerDebtsBadge() {
  const indebtedCount = state.customers.filter(c => (parseFloat(c.balance) || 0) > 0).length;
  const badge = document.getElementById('customerDebtsBadgeNav');
  if (badge) {
    if (indebtedCount > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = indebtedCount;
    } else {
      badge.style.display = 'none';
    }
  }
}

function setCustomerDebtFilter(filter, btn) {
  state.customerDebtFilter = filter;
  document.querySelectorAll('#tab-customers .category-chips .chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCustomerTab();
}

function handleCustomerTabSearch(val) {
  state.customerTabSearch = (val || '').trim().toLowerCase();
  const btnClear = document.getElementById('btnCustClearSearch');
  if (btnClear) btnClear.style.display = state.customerTabSearch ? 'block' : 'none';
  renderCustomerTab();
}

function clearCustomerTabSearch() {
  const input = document.getElementById('custTabSearchInput');
  if (input) input.value = '';
  handleCustomerTabSearch('');
}

function getCustomerReceiptTimerData(c) {
  const bal = parseFloat(c.balance) || 0;
  const hasDebt = bal > 0;
  const isCredit = bal < 0;

  // فحص كافة سندات القبض الخاصة بالزبون
  const custReceipts = state.receipts.filter(r =>
    (c.id && r.customerId === c.id) ||
    (c.systemNumber && String(r.customerSystemNumber) === String(c.systemNumber)) ||
    (r.customerName && r.customerName.trim().toLowerCase() === c.name.trim().toLowerCase())
  );
  custReceipts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastReceipt = custReceipts[0] || null;

  let daysSince = 0;
  let dateFormatted = '';

  if (lastReceipt) {
    const rDate = new Date(lastReceipt.createdAt);
    daysSince = Math.max(0, Math.floor((Date.now() - rDate.getTime()) / (1000 * 60 * 60 * 24)));
    dateFormatted = rDate.toISOString().split('T')[0];
  } else {
    const custCreatedMs = c.createdAt ? new Date(c.createdAt).getTime() : (c.updatedAt ? new Date(c.updatedAt).getTime() : Date.now());
    daysSince = Math.max(0, Math.floor((Date.now() - custCreatedMs) / (1000 * 60 * 60 * 24)));
    dateFormatted = c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : 'لا يوجد سداد';
  }

  // اقترب من 30 يوماً (من 25 يوماً فأكثر) أو تجاوزها ولديه دين مستحق بذمته
  const isNear30 = hasDebt && (daysSince >= 25 && daysSince < 30);
  const isOver30 = hasDebt && (daysSince >= 30);
  const isUrgentRed = isNear30 || isOver30;

  return {
    lastReceipt,
    daysSince,
    dateFormatted,
    hasDebt,
    isCredit,
    isNear30,
    isOver30,
    isUrgentRed
  };
}

function renderCustomerTab() {
  const tbody = document.getElementById('customersMainTableBody');
  const emptyMsg = document.getElementById('emptyCustomersMessage');
  const cur = state.settings.currency || 'شيكل';

  if (!tbody) return;

  // الحساب المالي الدقيق والمطور للأرصدة (عليهم vs لهم والصافي الكلي)
  let totalDebit = 0;   // ديون عليهم (balance > 0)
  let totalCredit = 0;  // ديون لهم (balance < 0)
  let countDebtors = 0;
  let countCreditors = 0;
  let countSettled = 0;

  state.customers.forEach(c => {
    const b = parseFloat(c.balance) || 0;
    if (b > 0) {
      totalDebit += b;
      countDebtors++;
    } else if (b < 0) {
      totalCredit += Math.abs(b);
      countCreditors++;
    } else {
      countSettled++;
    }
  });

  const netBalance = parseFloat((totalDebit - totalCredit).toFixed(2));
  const totalCount = state.customers.length;

  const elTotalDebts = document.getElementById('custTabTotalDebts');
  const elDebtorsSub = document.getElementById('custTabDebtorsSub');
  const elCreditTotal = document.getElementById('custTabCreditTotal');
  const elCreditorsSub = document.getElementById('custTabCreditorsSub');
  const elNetBalance = document.getElementById('custTabNetBalance');
  const elNetLabel = document.getElementById('custTabNetLabel');
  const elNetIcon = document.getElementById('custTabNetIcon');
  const elNetSub = document.getElementById('custTabNetSub');
  const elNetCard = document.getElementById('custTabNetCard');
  const elTotalCount = document.getElementById('custTabTotalCount');
  const elStatsSummary = document.getElementById('custTabStatsSummary');
  const elBadgeCount = document.getElementById('custTableCountBadge');

  if (elTotalDebts) elTotalDebts.textContent = `${totalDebit.toLocaleString('en-US')} ${cur}`;
  if (elDebtorsSub) elDebtorsSub.textContent = `${countDebtors} زبون مدين بذمته مبالغ`;

  if (elCreditTotal) elCreditTotal.textContent = `${totalCredit.toLocaleString('en-US')} ${cur}`;
  if (elCreditorsSub) elCreditorsSub.textContent = `${countCreditors} زبون له رصيد دائن أو فائض`;

  if (elNetBalance) {
    elNetBalance.textContent = `${Math.abs(netBalance).toLocaleString('en-US')} ${cur}`;
  }
  if (elNetLabel) {
    elNetLabel.textContent = netBalance > 0 ? 'صافي مطلوب لصالح المعرض (+)' : (netBalance < 0 ? 'صافي التزام للزبائن (-)' : 'الرصيد الصافي متوازن');
  }
  if (elNetIcon) {
    elNetIcon.textContent = netBalance > 0 ? '📈' : (netBalance < 0 ? '📉' : '⚖️');
  }
  if (elNetSub) {
    if (netBalance > 0) {
      elNetSub.textContent = `فائض ذمم مدينة لصالح المعرض بمقدار +${netBalance.toLocaleString('en-US')} ${cur}`;
    } else if (netBalance < 0) {
      elNetSub.textContent = `مستحقات للزبائن على المعرض بمقدار -${Math.abs(netBalance).toLocaleString('en-US')} ${cur}`;
    } else {
      elNetSub.textContent = 'إجمالي ما عليهم مساوٍ تماماً لما لهم';
    }
  }
  if (elNetCard) {
    elNetCard.className = netBalance >= 0 ? 'card cust-kpi-card net-positive' : 'card cust-kpi-card net-negative';
  }

  if (elTotalCount) elTotalCount.textContent = `${totalCount} زبون`;
  if (elStatsSummary) elStatsSummary.textContent = `${countDebtors} مدين | ${countCreditors} دائن | ${countSettled} خالص`;

  // تطبيق الفلاتر بدقة
  let filtered = state.customers.filter(c => {
    const bal = parseFloat(c.balance) || 0;
    if (state.customerDebtFilter === 'with_debt' && bal <= 0) return false;
    if (state.customerDebtFilter === 'with_credit' && bal >= 0) return false;
    if (state.customerDebtFilter === 'settled' && bal !== 0) return false;

    if (state.customerTabSearch) {
      const q = state.customerTabSearch;
      const matchName = c.name && c.name.toLowerCase().includes(q);
      const matchSys = c.systemNumber && String(c.systemNumber).toLowerCase().includes(q);
      const matchPhone = c.phone && c.phone.includes(q);
      const matchNotes = c.notes && c.notes.toLowerCase().includes(q);
      return matchName || matchSys || matchPhone || matchNotes;
    }
    return true;
  });

  if (elBadgeCount) elBadgeCount.textContent = `${filtered.length} زبون`;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  // فرز الزبائن:
  // 1. العملاء المقتربين من 30 يوماً أو المتجاوزين 30 يوماً (اللون الأحمر) في القمة أولاً دائماً!
  // 2. باقي المدينين (عليهم ديون)
  // 3. الدائنين (لهم أرصدة)
  // 4. الحسابات المسددة
  filtered.sort((a, b) => {
    const timerA = getCustomerReceiptTimerData(a);
    const timerB = getCustomerReceiptTimerData(b);

    // الأولوية القصوى: العملاء ذوي اللون الأحمر (اقترب أو تجاوز 30 يوماً بدون سداد ولديه دين)
    if (timerA.isUrgentRed && !timerB.isUrgentRed) return -1;
    if (!timerA.isUrgentRed && timerB.isUrgentRed) return 1;
    if (timerA.isUrgentRed && timerB.isUrgentRed) {
      // الأطول مدة والأكثر تأخراً بدون سداد أولاً
      if (timerB.daysSince !== timerA.daysSince) {
        return timerB.daysSince - timerA.daysSince;
      }
      return (parseFloat(b.balance) || 0) - (parseFloat(a.balance) || 0);
    }

    // باقي المدينين
    const balA = parseFloat(a.balance) || 0;
    const balB = parseFloat(b.balance) || 0;
    if (balA > 0 && balB <= 0) return -1;
    if (balA <= 0 && balB > 0) return 1;
    if (balA > 0 && balB > 0) return balB - balA; // الأكبر ديناً أولاً

    // الدائنين
    if (balA < 0 && balB >= 0) return -1;
    if (balA >= 0 && balB < 0) return 1;
    if (balA < 0 && balB < 0) return balA - balB; // الأكبر رصيداً له أولاً

    return 0;
  });

  tbody.innerHTML = filtered.map(c => {
    const bal = parseFloat(c.balance) || 0;
    const hasDebt = bal > 0;
    const isCredit = bal < 0;

    let debtBadgeHtml = '';
    if (hasDebt) {
      debtBadgeHtml = `<span class="bal-tag debit">🔴 عليه: ${bal.toLocaleString('en-US')} ${cur}</span>`;
    } else if (isCredit) {
      debtBadgeHtml = `<span class="bal-tag credit">🔵 له: ${Math.abs(bal).toLocaleString('en-US')} ${cur}</span>`;
    } else {
      debtBadgeHtml = `<span class="bal-tag settled">🟢 خالص (0 ${cur})</span>`;
    }

    // حساب مؤقت وتاريخ آخر سند قبض للزبون
    const timer = getCustomerReceiptTimerData(c);
    let timerHtml = '';

    if (timer.lastReceipt) {
      let statusText = '';
      if (timer.daysSince === 0) statusText = 'سدد اليوم';
      else if (timer.daysSince === 1) statusText = 'مضى يوم واحد (أمس)';
      else if (timer.daysSince === 2) statusText = 'مضى يومان';
      else if (timer.daysSince <= 10) statusText = `مضى ${timer.daysSince} أيام`;
      else statusText = `مضى ${timer.daysSince} يوماً`;

      let badgeClass = 'timer-recent';
      let urgencyBadge = '';

      if (timer.isOver30) {
        badgeClass = 'timer-urgent-30';
        urgencyBadge = `<div style="color: #991b1b; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fee2e2; padding: 2px 6px; border-radius: 4px; border: 1px solid #f87171;">🚨 تجاوز 30 يوماً بدون سداد!</div>`;
      } else if (timer.isNear30) {
        badgeClass = 'timer-urgent-30';
        urgencyBadge = `<div style="color: #b91c1c; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fef2f2; padding: 2px 6px; border-radius: 4px; border: 1px solid #fca5a5;">⚠️ يقترب من 30 يوماً (${timer.daysSince} يوم)</div>`;
      } else if (timer.hasDebt && timer.daysSince >= 15) {
        badgeClass = 'timer-warning';
      } else if (!timer.hasDebt) {
        badgeClass = 'timer-settled';
      }

      timerHtml = `
        <div class="cust-timer-badge ${badgeClass}" style="${timer.isUrgentRed ? 'border: 2px solid #ef4444; background: #fee2e2; color: #991b1b;' : ''}">
          <div style="font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
            <span>${timer.isUrgentRed ? '🚨' : (timer.hasDebt ? '⏱️' : '✅')}</span>
            <span style="font-size: 0.88rem;">${statusText}</span>
          </div>
          <div style="font-size: 0.76rem; font-family: monospace; direction: ltr; text-align: center; color: ${timer.isUrgentRed ? '#7f1d1d' : '#475569'}; margin-top: 0.15rem; font-weight: 700;">
            📅 ${timer.dateFormatted}
          </div>
          <div style="font-size: 0.72rem; opacity: 0.9; text-align: center; margin-top: 0.1rem;">
            سند #${timer.lastReceipt.receiptNumber} (${(timer.lastReceipt.amount || 0).toLocaleString('en-US')} ${cur})
          </div>
          ${urgencyBadge}
        </div>
      `;
    } else {
      let urgencyBadge = '';
      let badgeClass = timer.hasDebt ? (timer.daysSince >= 25 ? 'timer-urgent-30' : 'timer-warning') : 'timer-none';

      if (timer.isUrgentRed) {
        urgencyBadge = `<div style="color: #991b1b; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fee2e2; padding: 2px 6px; border-radius: 4px; border: 1px solid #f87171;">🚨 ${timer.daysSince >= 30 ? 'تجاوز 30 يوماً بدون أي سداد!' : `يقترب من 30 يوماً (${timer.daysSince} يوم)`}</div>`;
      }

      timerHtml = `
        <div class="cust-timer-badge ${badgeClass}" style="${timer.isUrgentRed ? 'border: 2px solid #ef4444; background: #fee2e2; color: #991b1b;' : ''}">
          <div style="font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
            <span>${timer.isUrgentRed ? '🚨' : '⚠️'}</span>
            <span>لا يوجد سداد سابق</span>
          </div>
          <div style="font-size: 0.76rem; font-family: monospace; direction: ltr; text-align: center; color: #64748b; margin-top: 0.15rem; font-weight: 700;">
            📅 مسجل: ${timer.dateFormatted}
          </div>
          <div style="font-size: 0.72rem; opacity: 0.9; text-align: center; margin-top: 0.1rem;">
            مضى ${timer.daysSince} يوماً بدون سداد
          </div>
          ${urgencyBadge}
        </div>
      `;
    }

    const rowClass = timer.isUrgentRed ? 'urgent-debt-row' : '';

    return `
      <tr class="${rowClass}">
        <td style="font-family: monospace; font-weight: 700; color: #475569; text-align: center;">#${escapeHtml(c.systemNumber || '--')}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            ${timer.isUrgentRed ? '<span title="يقترب من أو تجاوز 30 يوماً بدون سداد">🚨</span>' : ''}
            <strong style="font-size: 0.95rem; color: #0f172a;">${escapeHtml(c.name)}</strong>
          </div>
        </td>
        <td>
          ${c.phone ? `<span style="direction: ltr; display: inline-block;">📞 ${escapeHtml(c.phone)}</span>` : '<span style="color:#94a3b8;">--</span>'}
        </td>
        <td style="text-align: center;">${debtBadgeHtml}</td>
        <td style="text-align: center;">${timerHtml}</td>
        <td style="font-size: 0.85rem; color: #64748b;">${escapeHtml(c.notes || '--')}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-xs btn-success" onclick="quickIssueReceiptForCustomer('${c.id}')" title="إصدار سند قبض مباشر لخصم دينه">
              <span>💰 سند قبض</span>
            </button>
            <button class="btn btn-xs btn-primary" onclick="quickCreateInvoiceForCustomer('${c.id}')" title="إنشاء فاتورة جديدة باسمه">
              <span>🧾 فاتورة</span>
            </button>
            <button class="btn-statement" onclick="openCustomerStatementModal('${c.id}')" title="عرض وطباعة كشف الحساب التفصيلي">
              <span>📑 كشف حساب</span>
            </button>
            ${hasDebt ? `
              <button class="btn btn-xs btn-warning btn-cust-reminder" onclick="sendCustomerDebtReminder('${c.id}')" title="إرسال تذكير استحقاق دفعة مالية لتيليجرام">
                <span>🔔 تذكير دفعة</span>
              </button>
            ` : ''}
            <button class="btn btn-xs btn-secondary" onclick="openAddCustomerModal('${c.id}')" title="تعديل">
              <span>✏️</span>
            </button>
            <button class="btn btn-xs btn-danger" onclick="confirmDeleteCustomer('${c.id}')" title="حذف الزبون">
              <span>🗑️</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}


// -------------------------------------------------------------
// البحث التفاعلي والإكمال التلقائي للزبائن (Invoice & Receipt Auto-complete)
// -------------------------------------------------------------
function handleInvoiceCustomerInput(val) {
  const query = (val || '').trim().toLowerCase();
  const dropdown = document.getElementById('invCustomerDropdown');
  if (!dropdown) return;

  if (!query) {
    dropdown.style.display = 'none';
    state.selectedInvoiceCustomer = null;
    const debtAlert = document.getElementById('invCustomerDebtAlert');
    if (debtAlert) debtAlert.style.display = 'none';
    return;
  }

  const cur = state.settings.currency || 'شيكل';
  const matches = state.customers.filter(c =>
    (c.name && c.name.toLowerCase().includes(query)) ||
    (c.systemNumber && String(c.systemNumber).toLowerCase().includes(query)) ||
    (c.phone && c.phone.includes(query))
  ).slice(0, 10);

  const exactMatch = state.customers.find(c => c.name && c.name.trim().toLowerCase() === query);

  let html = '';
  matches.forEach(c => {
    const bal = parseFloat(c.balance) || 0;
    html += `
      <div class="cust-auto-item" onclick="selectInvoiceCustomer('${c.id}')">
        <div class="cust-auto-main">
          <strong>${escapeHtml(c.name)}</strong>
          ${c.systemNumber ? `<span class="cust-auto-sysnum">#${c.systemNumber}</span>` : ''}
          ${c.phone ? `<span class="cust-auto-phone">📞 ${c.phone}</span>` : ''}
        </div>
        <div class="cust-auto-debt ${bal > 0 ? 'has-debt' : ''}">
          ${bal > 0 ? `الدين: ${bal.toLocaleString('en-US')} ${cur}` : `الرصيد: 0 ${cur}`}
        </div>
      </div>
    `;
  });

  if (!exactMatch && query.length >= 2) {
    html += `
      <div class="cust-auto-item add-new-cust-item" onclick="quickCreateCustomerFromInput('invoice', '${escapeHtml(query)}')">
        <span>➕ إضافة "<strong>${escapeHtml(query)}</strong>" كزبون جديد في النظام</span>
      </div>
    `;
  }

  dropdown.innerHTML = html;
  dropdown.style.display = html ? 'block' : 'none';
}

function selectInvoiceCustomer(custId) {
  const c = state.customers.find(cust => cust.id === custId);
  if (!c) return;

  state.selectedInvoiceCustomer = c;
  const nameInput = document.getElementById('invCustomerName');
  const phoneInput = document.getElementById('invCustomerPhone');
  const dropdown = document.getElementById('invCustomerDropdown');
  const debtAlert = document.getElementById('invCustomerDebtAlert');
  const debtText = document.getElementById('invCustomerDebtText');
  const cur = state.settings.currency || 'شيكل';

  if (nameInput) nameInput.value = c.name;
  if (phoneInput && c.phone) phoneInput.value = c.phone;
  if (dropdown) dropdown.style.display = 'none';

  if (debtAlert && debtText) {
    const bal = parseFloat(c.balance) || 0;
    debtText.innerHTML = `رصيد الزبون الحالي في النظام (الدين المستحق): <strong style="color:#b91c1c; font-size:1.05rem;">${bal.toLocaleString('en-US')} ${cur}</strong>`;
    debtAlert.style.display = 'flex';
  }
}

function handleReceiptCustomerInput(val) {
  const query = (val || '').trim().toLowerCase();
  const dropdown = document.getElementById('rcpCustomerDropdown');
  if (!dropdown) return;

  if (!query) {
    dropdown.style.display = 'none';
    const card = document.getElementById('rcpCustomerDebtCard');
    if (card) card.style.display = 'none';
    return;
  }

  const cur = state.settings.currency || 'شيكل';
  const matches = state.customers.filter(c =>
    (c.name && c.name.toLowerCase().includes(query)) ||
    (c.systemNumber && String(c.systemNumber).toLowerCase().includes(query)) ||
    (c.phone && c.phone.includes(query))
  ).slice(0, 10);

  const exactMatch = state.customers.find(c => c.name && c.name.trim().toLowerCase() === query);

  let html = '';
  matches.forEach(c => {
    const bal = parseFloat(c.balance) || 0;
    html += `
      <div class="cust-auto-item" onclick="selectReceiptCustomer('${c.id}')">
        <div class="cust-auto-main">
          <strong>${escapeHtml(c.name)}</strong>
          ${c.systemNumber ? `<span class="cust-auto-sysnum">#${c.systemNumber}</span>` : ''}
          ${c.phone ? `<span class="cust-auto-phone">📞 ${c.phone}</span>` : ''}
        </div>
        <div class="cust-auto-debt ${bal > 0 ? 'has-debt' : ''}">
          ${bal > 0 ? `الدين: ${bal.toLocaleString('en-US')} ${cur}` : `الرصيد: 0 ${cur}`}
        </div>
      </div>
    `;
  });

  if (!exactMatch && query.length >= 2) {
    html += `
      <div class="cust-auto-item add-new-cust-item" onclick="quickCreateCustomerFromInput('receipt', '${escapeHtml(query)}')">
        <span>➕ إضافة "<strong>${escapeHtml(query)}</strong>" كزبون جديد في النظام</span>
      </div>
    `;
  }

  dropdown.innerHTML = html;
  dropdown.style.display = html ? 'block' : 'none';
}

function selectReceiptCustomer(custId) {
  const c = state.customers.find(cust => cust.id === custId);
  if (!c) return;

  const cur = state.settings.currency || 'شيكل';
  const nameInput = document.getElementById('rcpCustomerName');
  const phoneInput = document.getElementById('rcpCustomerPhone');
  const idInput = document.getElementById('rcpCustomerId');
  const sysNumInput = document.getElementById('rcpCustomerSystemNumber');
  const prevBalInput = document.getElementById('rcpPreviousBalance');
  const dropdown = document.getElementById('rcpCustomerDropdown');

  if (nameInput) nameInput.value = c.name;
  if (phoneInput && c.phone) phoneInput.value = c.phone;
  if (idInput) idInput.value = c.id;
  if (sysNumInput) sysNumInput.value = c.systemNumber || '';
  if (prevBalInput) prevBalInput.value = c.balance || 0;
  if (dropdown) dropdown.style.display = 'none';

  // تحديث بطاقة دين الزبون في واجهة سند القبض
  const card = document.getElementById('rcpCustomerDebtCard');
  const nameEl = document.getElementById('rcpDebtCustName');
  const numEl = document.getElementById('rcpDebtCustNum');
  const valEl = document.getElementById('rcpDebtCurrentVal');

  if (card && nameEl && valEl) {
    nameEl.textContent = c.name;
    if (numEl) numEl.textContent = c.systemNumber ? `رقم الحساب بالنظام: #${c.systemNumber}` : 'زبون مسجل';
    valEl.textContent = `${(c.balance || 0).toLocaleString('en-US')} ${cur}`;
    card.style.display = 'block';
  }

  updateReceiptRemainingCalculation();
}

function quickCreateCustomerFromInput(context, name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return;

  const newCust = {
    id: 'cust-' + Date.now(),
    systemNumber: String(Math.floor(1000 + Math.random() * 9000)),
    name: cleanName,
    phone: '',
    balance: 0,
    notes: 'تمت إضافته مباشرة من واجهة ' + (context === 'invoice' ? 'الفاتورة' : 'سند القبض')
  };

  fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newCust)
  }).then(res => res.json()).then(data => {
    if (data.success && data.customer) {
      state.customers.push(data.customer);
      showToast(`تمت إضافة الزبون "${cleanName}" بنجاح في النظام برقم #${data.customer.systemNumber}`, 'success');
      if (context === 'invoice') {
        selectInvoiceCustomer(data.customer.id);
      } else {
        selectReceiptCustomer(data.customer.id);
      }
      updateCustomerDebtsBadge();
    }
  });
}

function fillReceiptFullBalance() {
  const prevBal = parseFloat(document.getElementById('rcpPreviousBalance')?.value) || 0;
  const amountInput = document.getElementById('rcpAmount');
  if (amountInput && prevBal > 0) {
    amountInput.value = prevBal;
    updateReceiptTafqeet(prevBal);
    updateReceiptRemainingCalculation();
  } else {
    showToast('رصيد الزبون خالص أو صفر', 'info');
  }
}

function updateReceiptRemainingCalculation() {
  const prevBal = parseFloat(document.getElementById('rcpPreviousBalance')?.value) || 0;
  const currentAmt = parseFloat(document.getElementById('rcpAmount')?.value) || 0;
  const remBalInput = document.getElementById('rcpRemainingBalance');
  const remHint = document.getElementById('rcpDebtRemainingHint');
  const cur = state.settings.currency || 'شيكل';

  const remaining = Math.max(0, prevBal - currentAmt);
  if (remBalInput) remBalInput.value = remaining;
  if (remHint) {
    remHint.innerHTML = `الرصيد بعد السند: <strong style="color: ${remaining > 0 ? '#b45309' : '#047857'};">${remaining.toLocaleString('en-US')} ${cur}</strong>`;
  }
}

function quickIssueReceiptForCustomer(custId) {
  switchTab('receipts');
  selectReceiptCustomer(custId);
  const amtInput = document.getElementById('rcpAmount');
  if (amtInput) amtInput.focus();
}

function quickCreateInvoiceForCustomer(custId) {
  switchTab('create-invoice');
  selectInvoiceCustomer(custId);
}

// -------------------------------------------------------------
// إدارة نافذة إضافة / تعديل زبون
// -------------------------------------------------------------
function openCustomerDebtsModal() {
  switchTab('customers');
}

function closeCustomerDebtsModal() {
  const modal = document.getElementById('customerDebtsModal');
  if (modal) modal.classList.remove('active');
}

function openAddCustomerModal(customerId = null) {
  const title = document.getElementById('custEditModalTitle');
  const idInput = document.getElementById('custEditId');
  const sysInput = document.getElementById('custEditSysNum');
  const nameInput = document.getElementById('custEditName');
  const phoneInput = document.getElementById('custEditPhone');
  const balInput = document.getElementById('custEditBalance');
  const notesInput = document.getElementById('custEditNotes');

  if (customerId) {
    const c = state.customers.find(cust => cust.id === customerId);
    if (!c) return;
    if (title) title.textContent = 'تعديل بيانات وحساب الزبون';
    if (idInput) idInput.value = c.id;
    if (sysInput) sysInput.value = c.systemNumber || '';
    if (nameInput) nameInput.value = c.name || '';
    if (phoneInput) phoneInput.value = c.phone || '';
    if (notesInput) notesInput.value = c.notes || '';

    const bal = parseFloat(c.balance) || 0;
    if (bal < 0) {
      handleCustomerBalTypeChange('credit');
      if (balInput) balInput.value = Math.abs(bal);
    } else {
      handleCustomerBalTypeChange('debit');
      if (balInput) balInput.value = bal;
    }
  } else {
    if (title) title.textContent = 'إضافة زبون جديد في النظام';
    if (idInput) idInput.value = '';
    if (sysInput) sysInput.value = String(Math.floor(1000 + Math.random() * 9000));
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (balInput) balInput.value = '0';
    if (notesInput) notesInput.value = '';
    handleCustomerBalTypeChange('debit');
  }

  const modal = document.getElementById('customerEditModal');
  if (modal) modal.classList.add('active');
}

function handleCustomerBalTypeChange(type) {
  const radDebit = document.getElementById('custBalTypeDebit');
  const radCredit = document.getElementById('custBalTypeCredit');
  const lblDebit = document.getElementById('lblBalTypeDebit');
  const lblCredit = document.getElementById('lblBalTypeCredit');
  const hint = document.getElementById('custEditBalanceHint');
  const balVal = Math.abs(parseFloat(document.getElementById('custEditBalance')?.value) || 0);

  if (type === 'credit') {
    if (radCredit) radCredit.checked = true;
    if (lblCredit) {
      lblCredit.style.borderColor = '#2563eb';
      lblCredit.style.background = '#eff6ff';
      lblCredit.style.color = '#1d4ed8';
    }
    if (lblDebit) {
      lblDebit.style.borderColor = '#cbd5e1';
      lblDebit.style.background = '#ffffff';
      lblDebit.style.color = '#475569';
    }
    if (hint) {
      if (balVal === 0) {
        hint.style.color = '#15803d';
        hint.style.background = '#f0fdf4';
        hint.style.borderColor = '#bbf7d0';
        hint.innerHTML = '🟢 الرصيد صفر (الحساب خالص ومسدد بالكامل)';
      } else {
        hint.style.color = '#1d4ed8';
        hint.style.background = '#eff6ff';
        hint.style.borderColor = '#bfdbfe';
        hint.innerHTML = `🔵 الحالة: الزبون له رصيد دائن أو دفعة لصالحه بذمة المعرض (-${balVal.toLocaleString('en-US')})`;
      }
    }
  } else {
    if (radDebit) radDebit.checked = true;
    if (lblDebit) {
      lblDebit.style.borderColor = '#ef4444';
      lblDebit.style.background = '#fef2f2';
      lblDebit.style.color = '#b91c1c';
    }
    if (lblCredit) {
      lblCredit.style.borderColor = '#cbd5e1';
      lblCredit.style.background = '#ffffff';
      lblCredit.style.color = '#475569';
    }
    if (hint) {
      if (balVal === 0) {
        hint.style.color = '#15803d';
        hint.style.background = '#f0fdf4';
        hint.style.borderColor = '#bbf7d0';
        hint.innerHTML = '🟢 الرصيد صفر (الحساب خالص ومسدد بالكامل)';
      } else {
        hint.style.color = '#dc2626';
        hint.style.background = '#fef2f2';
        hint.style.borderColor = '#fecaca';
        hint.innerHTML = `🔴 الحالة: الزبون عليه دين ومطلوب منه هذا المبلغ لصالح المعرض (+${balVal.toLocaleString('en-US')})`;
      }
    }
  }
}

function handleCustomerBalanceInput(val) {
  const isCredit = document.getElementById('custBalTypeCredit')?.checked;
  handleCustomerBalTypeChange(isCredit ? 'credit' : 'debit');
}

function closeCustomerEditModal() {
  const modal = document.getElementById('customerEditModal');
  if (modal) modal.classList.remove('active');
}

async function handleCustomerSaveSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('custEditId').value;
  const systemNumber = document.getElementById('custEditSysNum').value.trim();
  const name = document.getElementById('custEditName').value.trim();
  const phone = document.getElementById('custEditPhone').value.trim();
  const rawBal = Math.abs(parseFloat(document.getElementById('custEditBalance').value) || 0);
  const isCredit = document.getElementById('custBalTypeCredit')?.checked;
  const balance = (rawBal === 0) ? 0 : (isCredit ? -rawBal : rawBal);
  const notes = document.getElementById('custEditNotes').value.trim();

  if (!name) {
    showToast('اسم الزبون مطلوب', 'error');
    return;
  }

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id || undefined, systemNumber, name, phone, balance, notes })
    });
    const data = await res.json();
    if (data.success) {
      showToast(id ? 'تم تعديل الزبون ورصيده بنجاح' : 'تمت إضافة الزبون بنجاح', 'success');
      closeCustomerEditModal();
      await loadCustomers();
    } else {
      showToast(data.error || 'فشل حفظ بيانات الزبون', 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم', 'error');
  }
}

async function confirmDeleteCustomer(id) {
  const c = state.customers.find(cust => cust.id === id);
  if (!c) return;

  showConfirmDialog({
    title: 'حذف الزبون من النظام',
    message: `هل أنت متأكد من حذف الزبون "${c.name}" نهائياً من سجلات النظام؟ لن تتمكن من التراجع عن هذه العملية.`,
    icon: '🗑️',
    confirmText: 'نعم، حذف الزبون',
    cancelText: 'تراجع وإلغاء',
    isDanger: true,
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast(`تم حذف الزبون "${c.name}" بنجاح`, 'success');
          await loadCustomers();
        } else {
          showToast(data.error || 'فشل حذف الزبون', 'error');
        }
      } catch (err) {
        showToast('تعذر الاتصال بالخادم لحذف الزبون', 'error');
      }
    }
  });
}

async function sendCustomerDebtReminder(id) {
  openCustomerReminderModal(id);
}

// -------------------------------------------------------------
// استيراد ملف أرصدة الزبائن CSV
// -------------------------------------------------------------
function triggerCustomerCsvUpload() {
  const input = document.getElementById('customerCsvFileInput');
  if (input) input.click();
}

async function handleCustomerCsvUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  showToast(`جاري قراءة واستيراد ملف الأرصدة "${file.name}"...`, 'info');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const parsedCustomers = parseCustomerCsvText(text);

      if (parsedCustomers.length === 0) {
        showToast('لم يتم العثور على زبائن صالحين داخل الملف', 'warning');
        return;
      }

      const res = await fetch('/api/customers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: parsedCustomers })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`🎉 تم بنجاح استيراد وتحديث (${data.imported || parsedCustomers.length}) زبون مع أرصدتهم بالنظام!`, 'success');
        await loadCustomers();
      } else {
        showToast(data.error || 'فشل استيراد الملف', 'error');
      }
    } catch (err) {
      console.error('CSV parse error:', err);
      showToast('خطأ أثناء قراءة ملف CSV: ' + err.message, 'error');
    } finally {
      input.value = '';
    }
  };

  // قراءة الملف كنص (يدعم UTF-8)
  reader.readAsText(file);
}

function parseCustomerCsvText(csvText) {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  const results = [];
  let headerIndex = -1;
  let nameCol = 1;
  let sysNumCol = 0;
  let balanceCol = 2;
  let phoneCol = -1;
  let notesCol = -1;

  // فحص أول 5 أسطر لمعرفة ترويسة الأعمدة
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const rawCols = splitCsvLine(lines[i]);
    const lowerCols = rawCols.map(c => c.toLowerCase());

    const hasName = lowerCols.some(c => c.includes('اسم') || c.includes('زبون') || c.includes('عميل') || c.includes('name'));
    const hasBal = lowerCols.some(c => c.includes('رصيد') || c.includes('balance') || c.includes('مبلغ') || c.includes('مدين'));

    if (hasName || hasBal) {
      headerIndex = i;
      lowerCols.forEach((col, idx) => {
        if (col.includes('رقم') || col.includes('حساب') || col.includes('نظام') || col.includes('code') || col.includes('id') || col.includes('acc')) {
          sysNumCol = idx;
        } else if (col.includes('اسم') || col.includes('زبون') || col.includes('عميل') || col.includes('name')) {
          nameCol = idx;
        } else if (col.includes('رصيد') || col.includes('balance') || col.includes('مدين') || col.includes('مبلغ')) {
          balanceCol = idx;
        } else if (col.includes('هاتف') || col.includes('جوال') || col.includes('phone') || col.includes('mobile')) {
          phoneCol = idx;
        } else if (col.includes('ملاحظ') || col.includes('note') || col.includes('بيان')) {
          notesCol = idx;
        }
      });
      break;
    }
  }

  const startLine = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = startLine; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 2) continue;

    const name = String(cols[nameCol] || cols[0] || '').trim();
    if (!name || name === 'اسم الزبون' || name === 'الإجمالي') continue;

    const sysNum = String(cols[sysNumCol] || '').trim();
    const rawBal = cols[balanceCol] !== undefined ? cols[balanceCol] : (cols[2] || 0);
    const cleanBal = parseFloat(String(rawBal).replace(/,/g, '').replace(/[\sشيكل$]/g, '')) || 0;
    const phone = phoneCol >= 0 ? String(cols[phoneCol] || '').trim() : '';
    const notes = notesCol >= 0 ? String(cols[notesCol] || '').trim() : '';

    results.push({
      systemNumber: sysNum,
      name,
      phone,
      balance: cleanBal,
      notes
    });
  }

  return results;
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  const sep = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === sep && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function printCustomerDebtsReport() {
  window.print();
}

// ============================================================
// نظام تقارير جرد المخزون ورأس المال والطباعة PDF
// (مركّز بدقة تامة على نتائج البحث الحالية)
// ============================================================
let currentInventoryReportItems = [];
let currentInventoryReportScope = '';

function openInventoryReportModal(overrideCategory = null) {
  const modal = document.getElementById('inventoryReportModal');
  const printableArea = document.getElementById('printableInventoryReportArea');
  const scopeBadge = document.getElementById('invReportFilterScopeBadge');
  const cur = state.settings.currency || 'شيكل';

  if (!modal || !printableArea) return;

  const searchQuery = (state.inventorySearch || document.getElementById('inventorySearchInput')?.value || '').trim();
  const brandQuery = state.inventoryBrand;
  const catQuery = overrideCategory || state.inventoryCategory;

  let reportTitle = 'تقرير جرد المخزون ورأس المال';
  let scopeDescription = 'كامل أصناف المخزون';

  // تحديد المنتجات بحسب نطاق البحث والفلتر
  let itemsToReport = [...state.products];

  // 1. فلتر الماركة
  if (brandQuery && brandQuery !== 'all') {
    itemsToReport = itemsToReport.filter(p => (p.brand || 'أخرى') === brandQuery);
    scopeDescription = `ماركة: ${brandQuery}`;
  }

  // 2. فلتر القسم
  if (catQuery && catQuery !== 'all') {
    itemsToReport = itemsToReport.filter(p => (p.mainCategory || 'أخرى') === catQuery);
    scopeDescription = (scopeDescription === 'كامل أصناف المخزون') ? `قسم: ${catQuery}` : `${scopeDescription} | قسم: ${catQuery}`;
  }

  // 3. التركيز الصارم على نتائج البحث إذا قام المستخدم بالبحث
  if (searchQuery) {
    const qNorm = normalizeArabic(searchQuery);
    const searchWords = qNorm.split(/\s+/).filter(w => w.length > 0);

    itemsToReport = itemsToReport.filter(p => {
      const pNameNorm = normalizeArabic(p.name);
      const pCodeNorm = normalizeArabic(p.code);
      const pCatNorm = normalizeArabic(p.category);
      const pMainNorm = normalizeArabic(p.mainCategory);
      const pBrandNorm = normalizeArabic(p.brand);
      const pBrandArNorm = normalizeArabic(p.brandAr);

      return searchWords.every(word =>
        matchArabicTerm(pNameNorm, word) ||
        matchArabicTerm(pCodeNorm, word) ||
        matchArabicTerm(pCatNorm, word) ||
        matchArabicTerm(pMainNorm, word) ||
        matchArabicTerm(pBrandNorm, word) ||
        matchArabicTerm(pBrandArNorm, word)
      );
    });

    reportTitle = `تقرير نتائج البحث بالجرد: "${searchQuery}"`;
    scopeDescription = `نتائج البحث المطابقة لكلمة: "${searchQuery}" (${itemsToReport.length} صنف)`;
  }

  // ترتيب الأصناف بدقة على حسب رقم الصنف (الكود) كما طلب المستخدم
  itemsToReport.sort((a, b) => {
    const codeA = String(a.code || '').toLowerCase();
    const codeB = String(b.code || '').toLowerCase();
    return codeA.localeCompare(codeB, 'ar-EG', { numeric: true });
  });

  currentInventoryReportItems = itemsToReport;
  currentInventoryReportScope = scopeDescription;

  if (scopeBadge) scopeBadge.textContent = scopeDescription;

  // حساب المجاميع
  let totalUnits = 0;
  let totalCapital = 0;
  let zeroStockCount = 0;

  itemsToReport.forEach(p => {
    const s = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
    const cost = parseFloat(p.costPrice) || 0;
    totalUnits += s;
    totalCapital += s * cost;
    if (s === 0) zeroStockCount++;
  });

  const nowStr = formatAppDateTime(new Date());

  // بناء الجدول المطبوع بتنسيق احترافي
  let rowsHtml = itemsToReport.map((p, idx) => {
    const s = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
    const cost = parseFloat(p.costPrice) || 0;
    const rowCapital = s * cost;
    const isZero = s === 0;

    // تمييز الصنف الذي كميته صفر بخلفية رمادية للتمييز
    const rowClass = isZero ? 'zero-stock-row' : '';

    return `
      <tr class="${rowClass}">
        <td style="text-align: center; font-weight: bold; width: 40px;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: 800; direction: ltr; text-align: center;">${escapeHtml(p.code || '--')}</td>
        <td>
          <div style="font-weight: 800; color: #0f172a;">${escapeHtml(p.name)}</div>
          <div style="font-size: 0.76rem; color: #64748b;">${escapeHtml(p.brand || 'عام')} | ${escapeHtml(p.mainCategory || '')}</div>
        </td>
        <td style="text-align: center; font-weight: 800; font-size: 1rem; color: ${isZero ? '#dc2626' : '#0f172a'};">
          ${isZero ? '0 <span style="font-size: 0.72rem; color: #dc2626;">(نافد)</span>' : `${s} قطعة`}
        </td>
        <td style="text-align: left; font-weight: 700;">${cost.toLocaleString('en-US')} ${cur}</td>
        <td style="text-align: left; font-weight: 800; color: #0f172a;">${rowCapital.toLocaleString('en-US')} ${cur}</td>
      </tr>
    `;
  }).join('');

  printableArea.innerHTML = `
    <div style="padding: 1.5rem; font-family: inherit;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 1rem; margin-bottom: 1rem;">
        <div>
          <h2 style="font-size: 1.4rem; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h2>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">تقرير جرد المخزون الفعلي ومطابقة رأس المال والتكلفة</div>
        </div>
        <div style="text-align: left;">
          <div style="font-weight: 800; font-size: 1.05rem; color: #2563eb;">${escapeHtml(reportTitle)}</div>
          <div style="font-size: 0.8rem; color: #64748b;">تاريخ التقرير: ${nowStr}</div>
        </div>
      </div>

      <!-- ملخص التقرير المالي -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; margin-bottom: 1.25rem;">
        <div>
          <span style="font-size: 0.78rem; color: #64748b; display: block;">عدد الأصناف بالتقرير:</span>
          <strong style="font-size: 1.15rem; color: #0f172a;">${itemsToReport.length} صنف</strong>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: #64748b; display: block;">إجمالي عدد القطع:</span>
          <strong style="font-size: 1.15rem; color: #0f172a;">${totalUnits.toLocaleString('en-US')} قطعة</strong>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: #64748b; display: block;">إجمالي رأس المال:</span>
          <strong style="font-size: 1.15rem; color: #047857;">${totalCapital.toLocaleString('en-US')} ${cur}</strong>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: #64748b; display: block;">أصناف كميتها صفر:</span>
          <strong style="font-size: 1.15rem; color: #dc2626;">${zeroStockCount} صنف نافد</strong>
        </div>
      </div>

      <div style="font-size: 0.82rem; color: #475569; margin-bottom: 0.5rem;">
        📌 <strong>نطاق التقرير:</strong> ${escapeHtml(scopeDescription)} | <em>ملاحظة: الصفوف ذات اللون الرمادي توضح أن الصنف نافد (كميته صفر)</em>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;" class="printable-report-table">
        <thead>
          <tr style="background: #e2e8f0; color: #0f172a;">
            <th style="border: 1px solid #94a3b8; padding: 7px;">#</th>
            <th style="border: 1px solid #94a3b8; padding: 7px; width: 110px;">رقم الصنف</th>
            <th style="border: 1px solid #94a3b8; padding: 7px;">اسم الصنف والماركة</th>
            <th style="border: 1px solid #94a3b8; padding: 7px; width: 95px; text-align: center;">الكمية بالمخزن</th>
            <th style="border: 1px solid #94a3b8; padding: 7px; width: 110px; text-align: left;">رأس المال (القطعة)</th>
            <th style="border: 1px solid #94a3b8; padding: 7px; width: 125px; text-align: left;">إجمالي رأس المال</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800;">
            <td colspan="3" style="border: 1px solid #94a3b8; padding: 8px; text-align: center;">الإجمالي العام</td>
            <td style="border: 1px solid #94a3b8; padding: 8px; text-align: center;">${totalUnits.toLocaleString('en-US')} قطعة</td>
            <td style="border: 1px solid #94a3b8; padding: 8px;">--</td>
            <td style="border: 1px solid #94a3b8; padding: 8px; text-align: left; color: #047857; font-size: 1rem;">${totalCapital.toLocaleString('en-US')} ${cur}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top: 2rem; display: flex; justify-content: space-between; font-size: 0.82rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
        <div>المسؤول عن الجرد: _________________</div>
        <div>اعتماد الإدارة: _________________</div>
        <div>نظام إدارة المخزون والمبيعات</div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeInventoryReportModal() {
  const modal = document.getElementById('inventoryReportModal');
  if (modal) modal.classList.remove('active');
}

function printInventoryReport() {
  window.print();
}

async function sendCurrentInventoryReportTelegram() {
  const items = currentInventoryReportItems.length > 0 ? currentInventoryReportItems : state.products;
  const searchQuery = (state.inventorySearch || document.getElementById('inventorySearchInput')?.value || '').trim();
  const cur = state.settings.currency || 'شيكل';

  let totalUnits = 0;
  let totalCapital = 0;
  let zeroCount = 0;

  items.forEach(p => {
    const s = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
    const cost = parseFloat(p.costPrice) || 0;
    totalUnits += s;
    totalCapital += s * cost;
    if (s === 0) zeroCount++;
  });

  const payload = {
    title: searchQuery ? `تقرير نتائج البحث بالجرد: "${searchQuery}"` : 'تقرير جرد المخزون ورأس المال',
    searchQuery: searchQuery || null,
    category: state.inventoryCategory,
    brand: state.inventoryBrand,
    summary: {
      count: items.length,
      totalUnits,
      totalCapital,
      zeroCount
    },
    items: items.map(p => ({
      code: p.code,
      name: p.name,
      stock: state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0),
      costPrice: p.costPrice
    }))
  };

  showToast('جاري إرسال التقرير لتيليجرام...', 'info');

  try {
    const res = await fetch('/api/inventory/send-report-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('✈️ تم إرسال تقرير نتائج الجرد لتيليجرام بنجاح! جاري إرفاق ملف الـ PDF...', 'success');
      // إرفاق ملف PDF للتقرير أيضاً لضمان تضمين الملف في تيليجرام
      try {
        await generateAndSendInventoryPdfToTelegram();
      } catch (pdfErr) {
        console.warn('Auto PDF attachment for inventory report error:', pdfErr);
      }
    } else {
      showToast(data.error || 'فشل إرسال التقرير لتيليجرام', 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم لإرسال التقرير لتيليجرام', 'error');
  }
}

// إرسال ملف PDF لجرد المخزون الفعلي إلى تيليجرام
async function generateAndSendInventoryPdfToTelegram() {
  const modal = document.getElementById('inventoryReportModal');
  const printableArea = document.getElementById('printableInventoryReportArea');
  if (!modal || !modal.classList.contains('active')) {
    openInventoryReportModal();
  }

  showToast('جاري إنشاء ملف PDF لجرد المخزون وإرساله لتيليجرام...', 'info');

  try {
    const html = printableArea ? printableArea.innerHTML : '';
    if (!html) {
      showToast('تعذر استخراج بيانات التقرير', 'error');
      return;
    }
    const fileName = `تقرير_جرد_${Date.now()}.pdf`;
    const blob = await generatePdfBlobFromHtml(html, fileName);

    const cur = state.settings.currency || 'شيكل';
    const items = currentInventoryReportItems.length > 0 ? currentInventoryReportItems : state.products;
    const totalUnits = items.reduce((acc, p) => acc + (state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0)), 0);
    const totalCapital = items.reduce((acc, p) => acc + (state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0)) * (parseFloat(p.costPrice) || 0), 0);

    const caption = 
`📄 <b>تقرير جرد المخزون ورأس المال (ملف PDF معتمد)</b>
🏢 <b>${state.settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
🔍 <b>النطاق:</b> ${currentInventoryReportScope || 'كامل المخزون'}
📦 <b>الأصناف بالتقرير:</b> <b>${items.length} صنف</b>
🔢 <b>إجمالي القطع:</b> <b>${totalUnits.toLocaleString('en-US')} قطعة</b>
💰 <b>إجمالي رأس المال:</b> <b>${totalCapital.toLocaleString('en-US')} ${cur}</b>
🕐 <b>الوقت:</b> ${formatAppDateTime(new Date())}
<i>📎 مرفق كشف الجرد التفصيلي الكامل بصيغة PDF جاهز للطباعة والتدقيق.</i>`;

    const res = await sendPdfDocumentToTelegram(blob, fileName, caption);
    if (res.success) {
      showToast('✈️ تم إرسال ملف الـ PDF لجرد المخزون بنجاح إلى تيليجرام!', 'success');
    } else {
      showToast(`تعذر الإرسال لتيليجرام: ${res.error || 'خطأ غير معروف'}`, 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء تصدير وإرسال الـ PDF', 'error');
  }
}

// بناء كشف رسمي للتقرير المالي وحساب الأرباح بصيغة PDF
function buildPrintableFinancialReportHtml() {
  const cur = state.settings.currency || 'شيكل';
  const periodText = document.getElementById('dashCurrentPeriodBadge')?.textContent || 'كل الأوقات';
  const nowStr = formatAppDateTime(new Date());

  const invoices = state.invoices || [];
  const salesInvoices = invoices.filter(i => (i.invoiceType || 'sales') === 'sales');
  const purchaseInvoices = invoices.filter(i => i.invoiceType === 'purchase');

  let totalSales = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let cashSales = 0;
  let installmentSales = 0;

  salesInvoices.forEach(i => {
    const amount = i.summary?.totalAmount || 0;
    const cost = i.summary?.totalCost || 0;
    const profit = i.summary?.totalProfit || 0;
    totalSales += amount;
    totalCost += cost;
    totalProfit += profit;
    if (i.paymentMethod === 'installments') {
      installmentSales += amount;
    } else {
      cashSales += amount;
    }
  });

  const profitMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0;

  let totalStockCapital = 0;
  let totalStockUnits = 0;
  state.products.forEach(p => {
    const s = parseInt(p.stock) || 0;
    totalStockUnits += s;
    totalStockCapital += s * (parseFloat(p.costPrice) || 0);
  });

  return `
    <div style="padding: 2rem; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; direction: rtl; color: #0f172a; line-height: 1.6; border: 2px solid #0f172a; border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h1 style="font-size: 1.6rem; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h1>
          <div style="font-size: 0.9rem; color: #475569;">تقرير مالي رسمي للأرباح والمبيعات ومطابقة رأس المال</div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 1rem; font-weight: 800; color: #2563eb;">${escapeHtml(periodText)}</div>
          <div style="font-size: 0.8rem; color: #64748b;">تاريخ الإصدار: ${nowStr}</div>
        </div>
      </div>

      <!-- بطاقات المؤشرات المالية الرئيسية -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem;">
          <div style="font-size: 0.82rem; color: #64748b;">إجمالي المبيعات (الإيرادات)</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #0f172a; margin-top: 0.25rem;">${totalSales.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">عدد فواتير البيع: ${salesInvoices.length}</div>
        </div>

        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem;">
          <div style="font-size: 0.82rem; color: #64748b;">تكلفة البضاعة المباعة (رأس المال)</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #475569; margin-top: 0.25rem;">${totalCost.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">التكلفة الفعلية للأصناف المباعة</div>
        </div>

        <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 8px; padding: 1rem;">
          <div style="font-size: 0.82rem; color: #047857;">صافي الأرباح المحققة</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #059669; margin-top: 0.25rem;">${totalProfit.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.75rem; color: #047857; font-weight: 700; margin-top: 0.2rem;">نسبة هامش الربح: ${profitMargin}%</div>
        </div>
      </div>

      <!-- تفصيل المبيعات والمخزون -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; background: #ffffff;">
          <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0 0 0.75rem 0; color: #0f172a;">💳 تفصيل طرق التحصيل:</h3>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
            <span>💵 مبيعات نقدية (كاش مباشر):</span>
            <strong>${cashSales.toLocaleString('en-US')} ${cur}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
            <span>⏳ مبيعات أقساط مجدولة:</span>
            <strong>${installmentSales.toLocaleString('en-US')} ${cur}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0;">
            <span>📥 فواتير توريد ومشتريات:</span>
            <strong>${purchaseInvoices.length} فاتورة</strong>
          </div>
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; background: #ffffff;">
          <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0 0 0.75rem 0; color: #0f172a;">📦 القيمة الحالية للمخزون:</h3>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
            <span>عدد الأصناف الإجمالي:</span>
            <strong>${state.products.length} صنف</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
            <span>إجمالي القطع المتوفرة:</span>
            <strong>${totalStockUnits.toLocaleString('en-US')} قطعة</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; font-weight: 800; color: #047857;">
            <span>إجمالي رأس المال بالمخزن:</span>
            <strong>${totalStockCapital.toLocaleString('en-US')} ${cur}</strong>
          </div>
        </div>
      </div>

      <div style="margin-top: 2rem; border-top: 1.5px solid #0f172a; padding-top: 1rem; display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569;">
        <div>توقيع المدير المالي: _________________</div>
        <div>اعتماد الإدارة: _________________</div>
        <div>نظام إدارة المبيعات والمخزون</div>
      </div>
    </div>
  `;
}

// تحميل التقرير المالي PDF
async function downloadFinancialReportPdf() {
  showToast('جاري تجهيز التقرير المالي بصيغة PDF...', 'info');
  try {
    const html = buildPrintableFinancialReportHtml();
    const fileName = `التقرير_المالي_${Date.now()}.pdf`;
    const blob = await generatePdfBlobFromHtml(html, fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    showToast('تم تحميل التقرير المالي PDF بنجاح', 'success');
  } catch (err) {
    showToast('تعذر تحميل التقرير المالي PDF', 'error');
  }
}

// إرسال التقرير المالي PDF لتيليجرام
async function generateAndSendFinancialPdfToTelegram() {
  showToast('جاري إنشاء التقرير المالي PDF وإرساله لتيليجرام...', 'info');
  try {
    const html = buildPrintableFinancialReportHtml();
    const fileName = `التقرير_المالي_${Date.now()}.pdf`;
    const blob = await generatePdfBlobFromHtml(html, fileName);

    const periodText = document.getElementById('dashCurrentPeriodBadge')?.textContent || 'كل الأوقات';

    const caption = 
`📊 <b>التقرير المالي وحساب الأرباح (ملف PDF معتمد)</b>
🏢 <b>${state.settings.companyName || 'رامز عطاطرة'}</b>
━━━━━━━━━━━━━━━━━━
⏱️ <b>الفترة:</b> ${escapeHtml(periodText)}
📅 <b>التاريخ:</b> ${formatAppDateTime(new Date())}
<i>📎 تجدون أعلاه ملف الـ PDF الشامل للأرباح والمبيعات ورأس المال.</i>`;

    const res = await sendPdfDocumentToTelegram(blob, fileName, caption);
    if (res.success) {
      showToast('✈️ تم إرسال التقرير المالي PDF إلى تيليجرام بنجاح!', 'success');
    } else {
      showToast(`تعذر الإرسال: ${res.error || 'خطأ غير معروف'}`, 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء إرسال التقرير المالي لتيليجرام', 'error');
  }
}

// إرسال تقرير المخزون الشامل PDF لتيليجرام
async function generateAndSendStockReportPdfToTelegram() {
  await generateAndSendInventoryPdfToTelegram();
}

// =============================================================
// إدارة استيراد ملفات Excel و CSV للزبائن مع المعاينة الذكية
// =============================================================
let selectedExcelFile = null;

function openCustomerExcelImportModal() {
  const modal = document.getElementById('customerExcelImportModal');
  if (modal) {
    clearSelectedExcelFile();
    modal.classList.add('active');
  }
}

function closeCustomerExcelImportModal() {
  const modal = document.getElementById('customerExcelImportModal');
  if (modal) modal.classList.remove('active');
  clearSelectedExcelFile();
}

function triggerExcelFileInput() {
  const input = document.getElementById('excelFileInput');
  if (input) input.click();
}

function clearSelectedExcelFile() {
  selectedExcelFile = null;
  const input = document.getElementById('excelFileInput');
  if (input) input.value = '';
  const banner = document.getElementById('excelSelectedFileBanner');
  if (banner) banner.style.display = 'none';
  const preview = document.getElementById('excelPreviewSection');
  if (preview) preview.style.display = 'none';
  const confirmBtn = document.getElementById('btnConfirmExcelImport');
  if (confirmBtn) confirmBtn.style.display = 'none';
}

async function handleExcelFileSelected(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  selectedExcelFile = file;

  const nameEl = document.getElementById('excelFileName');
  const sizeEl = document.getElementById('excelFileSize');
  const banner = document.getElementById('excelSelectedFileBanner');
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `(${(file.size / 1024).toFixed(1)} كيلوبايت)`;
  if (banner) banner.style.display = 'flex';

  showToast(`جاري قراءة وتحليل ملف الإكسل "${file.name}"...`, 'info');

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/customers/upload-excel?preview=true', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success && data.summary) {
      showToast(`🎉 تم العثور على ${data.parsedCount} زبون داخل الملف!`, 'success');
      renderExcelPreview(data);
    } else {
      showToast(data.error || 'فشل تحليل ملف الإكسل', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء قراءة ملف الإكسل: ' + err.message, 'error');
  }
}

function renderExcelPreview(data) {
  const previewSec = document.getElementById('excelPreviewSection');
  const countBadge = document.getElementById('excelPreviewCountBadge');
  const debitTotal = document.getElementById('previewDebitTotal');
  const debtorsCount = document.getElementById('previewDebtorsCount');
  const creditTotal = document.getElementById('previewCreditTotal');
  const creditorsCount = document.getElementById('previewCreditorsCount');
  const netBalance = document.getElementById('previewNetBalance');
  const settledCount = document.getElementById('previewSettledCount');
  const tbody = document.getElementById('excelPreviewTableBody');
  const confirmBtn = document.getElementById('btnConfirmExcelImport');
  const cur = state.settings.currency || 'شيكل';

  if (countBadge) countBadge.textContent = `${data.parsedCount} زبون جاهز للاستيراد`;
  if (debitTotal) debitTotal.textContent = `${(data.summary.totalDebit || 0).toLocaleString('en-US')} ${cur}`;
  if (debtorsCount) debtorsCount.textContent = `${data.summary.countDebtors || 0} زبون مدين (عليهم)`;
  if (creditTotal) creditTotal.textContent = `${(data.summary.totalCredit || 0).toLocaleString('en-US')} ${cur}`;
  if (creditorsCount) creditorsCount.textContent = `${data.summary.countCreditors || 0} زبون دائن (لهم)`;
  if (netBalance) {
    const net = data.summary.netBalance || 0;
    netBalance.textContent = `${Math.abs(net).toLocaleString('en-US')} ${cur}`;
    netBalance.style.color = net >= 0 ? '#15803d' : '#2563eb';
  }
  if (settledCount) settledCount.textContent = `${data.summary.countSettled || 0} زبون رصيد صفر`;

  if (tbody && data.sample) {
    tbody.innerHTML = data.sample.map((c, i) => {
      const b = parseFloat(c.balance) || 0;
      const bText = b > 0 ? `<span style="color:#dc2626; font-weight:700;">🔴 عليه: ${b.toLocaleString('en-US')} ${cur}</span>` :
                    (b < 0 ? `<span style="color:#2563eb; font-weight:700;">🔵 له: ${Math.abs(b).toLocaleString('en-US')} ${cur}</span>` :
                    `<span style="color:#16a34a; font-weight:700;">🟢 خالص</span>`);
      return `
        <tr>
          <td>${i + 1}</td>
          <td style="font-family: monospace;">#${escapeHtml(c.systemNumber || '--')}</td>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td style="direction: ltr; text-align: right;">${escapeHtml(c.phone || '--')}</td>
          <td>${bText}</td>
          <td style="color: #64748b; font-size: 0.78rem;">${escapeHtml(c.notes || '--')}</td>
        </tr>
      `;
    }).join('');
  }

  if (previewSec) previewSec.style.display = 'block';
  if (confirmBtn) confirmBtn.style.display = 'inline-flex';
}

async function executeConfirmedExcelImport() {
  if (!selectedExcelFile) {
    showToast('يرجى اختيار ملف الإكسل أولاً', 'warning');
    return;
  }

  const confirmBtn = document.getElementById('btnConfirmExcelImport');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>⏳</span><span>جاري استيراد وحفظ الزبائن بالنظام...</span>';
  }

  try {
    const formData = new FormData();
    formData.append('file', selectedExcelFile);

    const res = await fetch('/api/customers/upload-excel', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      showToast(`🎉 ${data.message || 'تم استيراد الزبائن بنجاح!'}`, 'success');
      closeCustomerExcelImportModal();
      await loadCustomers();
    } else {
      showToast(data.error || 'فشل استيراد الزبائن', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء رفع واستيراد الملف: ' + err.message, 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>✅</span><span>تأكيد واستيراد الزبائن إلى النظام</span>';
    }
  }
}

// =============================================================
// كشف حساب تفصيلي للزبون (Customer Statement) مع تصدير PDF وتيليجرام
// =============================================================
let currentStatementData = null;

async function openCustomerStatementModal(customerId) {
  showToast('جاري تحميل كشف الحساب التفصيلي...', 'info');
  try {
    const res = await fetch(`/api/customers/${customerId}/statement`);
    const data = await res.json();
    if (!data.success || !data.statement) {
      showToast(data.error || 'تعذر جلب كشف الحساب للزبون', 'error');
      return;
    }

    currentStatementData = data.statement;
    renderCustomerStatementHtml(data.statement);

    const modal = document.getElementById('customerStatementModal');
    if (modal) modal.classList.add('active');
  } catch (err) {
    showToast('فشل الاتصال بالخادم لجلب كشف الحساب', 'error');
  }
}

function closeCustomerStatementModal() {
  const modal = document.getElementById('customerStatementModal');
  if (modal) modal.classList.remove('active');
  currentStatementData = null;
}

function renderCustomerStatementHtml(st) {
  const container = document.getElementById('printableCustomerStatementArea');
  if (!container) return;

  const cur = state.settings.currency || 'شيكل';
  const c = st.customer;
  const s = st.summary;
  const bal = parseFloat(c.balance) || 0;
  const hasDebt = bal > 0;
  const isCredit = bal < 0;

  const balText = hasDebt ? `دين عليه: ${bal.toLocaleString('en-US')} ${cur}` :
                  (isCredit ? `رصيد لصالحه: ${Math.abs(bal).toLocaleString('en-US')} ${cur}` : `رصيد مسدد (خالص)`);

  let movementsHtml = '';
  if (st.movements && st.movements.length > 0) {
    movementsHtml = st.movements.map((m, idx) => {
      const isInvoice = m.type === 'invoice';
      const typeBadge = isInvoice ? `<span style="background:#eff6ff; color:#1d4ed8; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.78rem;">🧾 فاتورة مبيعات</span>` :
                        `<span style="background:#f0fdf4; color:#15803d; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.78rem;">💰 سند قبض</span>`;
      return `
        <tr>
          <td style="text-align: center; border: 1px solid #cbd5e1; padding: 7px; font-weight: 700;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 7px; font-size: 0.8rem; color: #475569;">${formatAppDateTime(m.date)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 7px;">${typeBadge} <strong>#${escapeHtml(String(m.number))}</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 7px; font-size: 0.82rem;">${escapeHtml(m.notes || '--')}</td>
          <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: left; font-weight: 700; color: ${m.debit > 0 ? '#dc2626' : '#94a3b8'};">
            ${m.debit > 0 ? `${m.debit.toLocaleString('en-US')} ${cur}` : '--'}
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: left; font-weight: 700; color: ${m.credit > 0 ? '#16a34a' : '#94a3b8'};">
            ${m.credit > 0 ? `${m.credit.toLocaleString('en-US')} ${cur}` : '--'}
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 7px; text-align: left; font-weight: 800; color: #0f172a;">
            ${(m.balanceAfter || 0).toLocaleString('en-US')} ${cur}
          </td>
        </tr>
      `;
    }).join('');
  } else {
    movementsHtml = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 1.5rem; color: #64748b; border: 1px solid #cbd5e1;">
          لا توجد فواتير أو سندات مسجلة بعد لهذا الزبون في النظام. الرصيد الحالي: ${bal.toLocaleString('en-US')} ${cur}
        </td>
      </tr>
    `;
  }

  container.innerHTML = `
    <div style="padding: 1.5rem; font-family: 'Cairo', sans-serif; direction: rtl; color: #0f172a; line-height: 1.5;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 1rem; margin-bottom: 1.25rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 900; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h2>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">
            ${escapeHtml(state.settings.companyAddress || 'المركز التجاري الرئيسي')} | هاتف: ${escapeHtml(state.settings.companyPhone || '')}
          </div>
        </div>
        <div style="text-align: left;">
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.4rem 0.85rem; font-weight: 800; font-size: 1.05rem; color: #0f172a;">
            كشف حساب زبون تفصيلي
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">تاريخ الإصدار: ${formatAppDateTime(new Date())}</div>
        </div>
      </div>

      <!-- Customer Info Card -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div>
          <div style="font-size: 0.85rem; color: #64748b;">السيد / الزبون:</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #0f172a;">${escapeHtml(c.name)}</div>
          ${c.phone ? `<div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">رقم الهاتف: <span style="direction: ltr; font-weight: 700;">${escapeHtml(c.phone)}</span></div>` : ''}
          ${c.notes ? `<div style="font-size: 0.82rem; color: #64748b; margin-top: 0.2rem;">ملاحظات: ${escapeHtml(c.notes)}</div>` : ''}
        </div>
        <div style="text-align: left;">
          <div style="font-size: 0.85rem; color: #64748b;">رقم الحساب بالنظام: <strong style="font-family: monospace; font-size: 1rem;">#${escapeHtml(c.systemNumber || '--')}</strong></div>
          <div style="margin-top: 0.4rem;">
            <span style="font-size: 0.85rem; color: #64748b;">الرصيد المالي الحالي:</span>
            <div style="font-size: 1.35rem; font-weight: 900; color: ${hasDebt ? '#dc2626' : (isCredit ? '#2563eb' : '#16a34a')};">
              ${balText}
            </div>
          </div>
        </div>
      </div>

      <!-- Summary KPI Strip -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-size: 0.75rem; color: #64748b;">إجمالي المشتريات (الفواتير):</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-top: 0.2rem;">${(s.totalInvoiced || 0).toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #64748b;">${s.invoicesCount || 0} فاتورة</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-size: 0.75rem; color: #166534;">إجمالي المسدد (سندات القبض):</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #15803d; margin-top: 0.2rem;">${(s.totalPaid || 0).toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #166534;">${s.receiptsCount || 0} سند قبض</div>
        </div>
        <div style="background: ${hasDebt ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${hasDebt ? '#fecaca' : '#cbd5e1'}; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-size: 0.75rem; color: ${hasDebt ? '#991b1b' : '#64748b'};">الرصيد المستحق النهائي:</div>
          <div style="font-size: 1.1rem; font-weight: 900; color: ${hasDebt ? '#dc2626' : (isCredit ? '#2563eb' : '#16a34a')}; margin-top: 0.2rem;">
            ${(c.balance || 0).toLocaleString('en-US')} ${cur}
          </div>
          <div style="font-size: 0.7rem; color: #64748b;">${hasDebt ? 'مطلوب سداده' : (isCredit ? 'رصيد لصالحه' : 'رصيد خالص')}</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-size: 0.75rem; color: #1e40af;">آخر دفعة مسددة:</div>
          <div style="font-size: 0.95rem; font-weight: 800; color: #1d4ed8; margin-top: 0.2rem;">
            ${s.lastReceiptDate ? formatAppDateTime(s.lastReceiptDate).split(' ')[0] : 'لا يوجد سداد'}
          </div>
          <div style="font-size: 0.7rem; color: #1e40af;">
            ${s.lastReceiptAmount ? `${s.lastReceiptAmount.toLocaleString('en-US')} ${cur}` : '--'}
          </div>
        </div>
      </div>

      <!-- Movements Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 0.84rem; margin-bottom: 1.5rem;">
        <thead>
          <tr style="background: #f1f5f9; color: #0f172a;">
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 40px; text-align: center;">#</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 130px;">التاريخ والوقت</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 140px;">نوع الحركة ورقمها</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px;">البيان / الملاحظات</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 110px; text-align: left;">مدين (+)</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 110px; text-align: left;">دائن (-)</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 120px; text-align: left;">الرصيد بعد الحركة</th>
          </tr>
        </thead>
        <tbody>
          ${movementsHtml}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; border-top: 1.5px solid #0f172a; padding-top: 1rem; font-size: 0.85rem; color: #475569;">
        <div>توقيع وتأكيد الزبون: _________________</div>
        <div>المحاسب / المالي: _________________</div>
        <div>ختم الشركة والاعتماد: _________________</div>
      </div>
    </div>
  `;
}

function printCustomerStatement() {
  window.print();
}

async function downloadCustomerStatementPdf() {
  if (!currentStatementData) return;
  const c = currentStatementData.customer;
  const fileName = `كشف_حساب_${c.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  showToast('جاري تجهيز وتحميل كشف الحساب بصيغة PDF...', 'info');
  try {
    const el = document.getElementById('printableCustomerStatementArea');
    const blob = await generatePdfBlobFromHtml(el.innerHTML, fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    showToast('تم تحميل كشف الحساب PDF بنجاح!', 'success');
  } catch (err) {
    showToast('خطأ في تصدير كشف الحساب PDF: ' + err.message, 'error');
  }
}

async function sendCustomerStatementPdfToTelegram() {
  if (!currentStatementData) return;
  const c = currentStatementData.customer;
  const fileName = `كشف_حساب_${c.name.replace(/\s+/g, '_')}.pdf`;

  showToast(`جاري إرسال كشف حساب "${c.name}" مع ملف الـ PDF إلى تيليجرام...`, 'info');

  try {
    const el = document.getElementById('printableCustomerStatementArea');
    const blob = await generatePdfBlobFromHtml(el.innerHTML, fileName);

    const formData = new FormData();
    formData.append('pdfFile', blob, fileName);

    const res = await fetch(`/api/customers/${c.id}/send-statement-telegram`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      showToast(`✈️ ${data.message || 'تم إرسال كشف الحساب وملف الـ PDF لتيليجرام بنجاح!'}`, 'success');
    } else {
      showToast(data.error || 'تعذر إرسال كشف الحساب لتيليجرام', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء إرسال كشف الحساب لتيليجرام: ' + err.message, 'error');
  }
}

// =============================================================
// إرسال كشف ديون الزبائن الكامل والشامل PDF لتيليجرام
// =============================================================
function buildPrintableCustomerDebtsHtml() {
  const cur = state.settings.currency || 'شيكل';
  let totalDebit = 0;
  let totalCredit = 0;
  let countDebtors = 0;
  let countCreditors = 0;
  let countSettled = 0;

  state.customers.forEach(c => {
    const b = parseFloat(c.balance) || 0;
    if (b > 0) {
      totalDebit += b;
      countDebtors++;
    } else if (b < 0) {
      totalCredit += Math.abs(b);
      countCreditors++;
    } else {
      countSettled++;
    }
  });

  const netBalance = parseFloat((totalDebit - totalCredit).toFixed(2));
  const sorted = [...state.customers].sort((a, b) => {
    const bA = parseFloat(a.balance) || 0;
    const bB = parseFloat(b.balance) || 0;
    return bB - bA;
  });

  const rows = sorted.map((c, idx) => {
    const b = parseFloat(c.balance) || 0;
    const bText = b > 0 ? `<strong style="color: #dc2626;">🔴 عليه: ${b.toLocaleString('en-US')} ${cur}</strong>` :
                  (b < 0 ? `<strong style="color: #2563eb;">🔵 له: ${Math.abs(b).toLocaleString('en-US')} ${cur}</strong>` :
                  `<span style="color: #16a34a; font-weight: 700;">🟢 خالص</span>`);

    return `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
        <td style="font-family: monospace; border: 1px solid #cbd5e1; padding: 6px; text-align: center;">#${escapeHtml(c.systemNumber || '--')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 800;">${escapeHtml(c.name)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; direction: ltr; text-align: right;">${escapeHtml(c.phone || '--')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${bText}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 0.78rem; color: #64748b;">${escapeHtml(c.notes || '--')}</td>
      </tr>
    `;
  }).join('');

  return `
    <div style="padding: 1.75rem; font-family: 'Cairo', sans-serif; direction: rtl; color: #0f172a; line-height: 1.5;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 1rem; margin-bottom: 1.25rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 900; color: #0f172a;">${escapeHtml(state.settings.companyName || 'رامز عطاطرة')}</h2>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">تقرير أرصدة وذمم الزبائن الشامل (الديون التي لهم والتي عليهم)</div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 0.8rem; color: #64748b;">تاريخ التقرير: ${formatAppDateTime(new Date())}</div>
          <div style="font-size: 0.95rem; font-weight: 800; color: #2563eb;">إجمالي الزبائن: ${state.customers.length} زبون</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
        <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 6px; padding: 0.75rem;">
          <div style="font-size: 0.75rem; color: #991b1b; font-weight: 700;">إجمالي ديون عليهم (لنا):</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #dc2626; margin-top: 0.2rem;">${totalDebit.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #b91c1c;">${countDebtors} زبون مدين</div>
        </div>
        <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 6px; padding: 0.75rem;">
          <div style="font-size: 0.75rem; color: #1e40af; font-weight: 700;">إجمالي ديون لهم (أرصدة لهم):</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #2563eb; margin-top: 0.2rem;">${totalCredit.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #1d4ed8;">${countCreditors} زبون دائن</div>
        </div>
        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 6px; padding: 0.75rem;">
          <div style="font-size: 0.75rem; color: #166534; font-weight: 700;">الصافي العام للذمم:</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #15803d; margin-top: 0.2rem;">${Math.abs(netBalance).toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #166534;">${netBalance >= 0 ? 'فائض لصالح المعرض' : 'مستحقات للزبائن'}</div>
        </div>
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 0.75rem;">
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">حسابات مسددة بالكامل:</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #0f172a; margin-top: 0.2rem;">${countSettled} زبون</div>
          <div style="font-size: 0.7rem; color: #64748b;">رصيد صفر خالص</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
        <thead>
          <tr style="background: #f1f5f9; color: #0f172a;">
            <th style="border: 1px solid #cbd5e1; padding: 7px; width: 40px; text-align: center;">#</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px; width: 90px; text-align: center;">رقم النظام</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px;">اسم الزبون</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px; width: 120px;">الهاتف</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px; width: 170px; text-align: center;">الرصيد المالي الحالي</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px;">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

async function sendAllCustomersDebtsPdfToTelegram() {
  if (state.customers.length === 0) {
    showToast('لا يوجد زبائن مسجلين بالنظام لإرسال الكشف', 'warning');
    return;
  }

  showToast('جاري إنشاء كشف ديون الزبائن بصيغة PDF وإرساله لتيليجرام...', 'info');

  try {
    let totalDebit = 0;
    let totalCredit = 0;
    let countDebtors = 0;
    let countCreditors = 0;
    let countSettled = 0;

    state.customers.forEach(c => {
      const b = parseFloat(c.balance) || 0;
      if (b > 0) { totalDebit += b; countDebtors++; }
      else if (b < 0) { totalCredit += Math.abs(b); countCreditors++; }
      else { countSettled++; }
    });

    const netBalance = parseFloat((totalDebit - totalCredit).toFixed(2));
    const html = buildPrintableCustomerDebtsHtml();
    const fileName = `كشف_ديون_الزبائن_${Date.now()}.pdf`;
    const pdfBlob = await generatePdfBlobFromHtml(html, fileName);

    const formData = new FormData();
    formData.append('pdfFile', pdfBlob, fileName);
    formData.append('totalDebit', totalDebit);
    formData.append('totalCredit', totalCredit);
    formData.append('netBalance', netBalance);
    formData.append('countDebtors', countDebtors);
    formData.append('countCreditors', countCreditors);
    formData.append('countSettled', countSettled);
    formData.append('totalCount', state.customers.length);

    const res = await fetch('/api/customers/send-debts-report-telegram', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      showToast('✈️ تم إرسال كشف ديون الزبائن وملف الـ PDF إلى تيليجرام بنجاح!', 'success');
    } else {
      showToast(data.error || 'تعذر إرسال كشف الديون لتيليجرام', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء إرسال كشف ديون الزبائن لتيليجرام: ' + err.message, 'error');
  }
}

// =============================================================
// تذكير استحقاق الدفعة للزبون مع إرفاق ملف PDF
// =============================================================
let currentReminderCustomerId = null;

function openCustomerReminderModal(customerId) {
  const c = state.customers.find(cust => cust.id === customerId);
  if (!c) return;

  const debt = parseFloat(c.balance) || 0;
  if (debt <= 0) {
    showToast('الزبون ليس عليه أي ديون مستحقة (رصيده مسدد بالكامل)', 'info');
    return;
  }

  currentReminderCustomerId = customerId;
  const body = document.getElementById('customerReminderModalBody');
  const cur = state.settings.currency || 'شيكل';

  if (body) {
    body.innerHTML = `
      <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <div style="font-weight: 800; font-size: 1.1rem; color: #991b1b; margin-bottom: 0.35rem;">👤 الزبون: ${escapeHtml(c.name)}</div>
        <div style="font-size: 0.88rem; color: #7f1d1d;">رقم الحساب بالنظام: #${escapeHtml(c.systemNumber || '--')} | هاتف: ${escapeHtml(c.phone || 'غير مسجل')}</div>
        <div style="margin-top: 0.5rem; font-size: 1rem; color: #991b1b;">
          الدين المستحق بذمته: <strong style="font-size: 1.25rem; color: #dc2626;">${debt.toLocaleString('en-US')} ${cur}</strong>
        </div>
      </div>
      <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0;">
        سيتم إرسال إشعار تذكير استحقاق الدفعة للزبون مباشرة عبر تيليجرام، مرفقاً به كشف حساب رسمي معتمد بصيغة PDF يوضح الفواتير وسندات القبض السابقة.
      </p>
    `;
  }

  const modal = document.getElementById('customerReminderModal');
  if (modal) modal.classList.add('active');
}

function closeCustomerReminderModal() {
  const modal = document.getElementById('customerReminderModal');
  if (modal) modal.classList.remove('active');
  currentReminderCustomerId = null;
}

async function executeSendCustomerReminderTelegram() {
  if (!currentReminderCustomerId) return;
  const customerId = currentReminderCustomerId;
  const c = state.customers.find(cust => cust.id === customerId);
  if (!c) return;

  const btn = document.getElementById('btnConfirmSendCustomerReminder');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>جاري تجهيز كشف الحساب وإرسال التذكير...</span>';
  }

  try {
    // جلب كشف الحساب وتوليد الـ PDF
    const stRes = await fetch(`/api/customers/${customerId}/statement`);
    const stData = await stRes.json();

    let pdfBlob = null;
    const fileName = `كشف_حساب_${c.name.replace(/\s+/g, '_')}.pdf`;

    if (stData.success && stData.statement) {
      renderCustomerStatementHtml(stData.statement);
      const el = document.getElementById('printableCustomerStatementArea');
      pdfBlob = await generatePdfBlobFromHtml(el.innerHTML, fileName);
    }

    const formData = new FormData();
    if (pdfBlob) {
      formData.append('pdfFile', pdfBlob, fileName);
    }

    const res = await fetch(`/api/customers/${customerId}/send-reminder-telegram`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      showToast(`✈️ ${data.message || 'تم إرسال تذكير الدفعة وكشف الحساب لتيليجرام بنجاح!'}`, 'success');
      closeCustomerReminderModal();
    } else {
      showToast(data.error || 'تعذر إرسال التذكير لتيليجرام', 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء إرسال التذكير: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>✈️</span><span>إرسال التذكير مع كشف الحساب لتيليجرام</span>';
    }
  }
}

// تفعيل ميزة السحب والإفلات لملف الإكسل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('excelDropZone');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        const input = document.getElementById('excelFileInput');
        if (input) {
          input.files = files;
          handleExcelFileSelected(input);
        }
      }
    }, false);
  }
});


