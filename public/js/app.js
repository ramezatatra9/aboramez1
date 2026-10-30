/**
 * ØªØ·Ø¨ÙŠÙ‚ Ù†Ø¸Ø§Ù… Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ¥ØµØ¯Ø§Ø± Ø§Ù„ÙÙˆØ§ØªÙŠØ±
 * Front-end Application Logic
 */

// Ø¯Ø§Ù„Ø© Ø­Ù…Ø§ÙŠØ© Ø§Ù„Ù†ØµÙˆØµ ÙˆØªÙ†Ø³ÙŠÙ‚ HTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// Ø·Ø¨Ø§Ø¹Ø© Ù…Ø¶Ù…ÙˆÙ†Ø© Ø¹Ù„Ù‰ ØµÙØ­Ø© ÙˆØ§Ø­Ø¯Ø© â€” Auto-Scale Single Page Print
// ØªØ­Ø³Ø¨ Ø§Ø±ØªÙØ§Ø¹ Ø§Ù„Ù…Ø­ØªÙˆÙ‰ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ ÙˆØªØ·Ø¨Ù‚ zoom Ù…Ù†Ø§Ø³Ø¨ Ù‚Ø¨Ù„ Ø§Ù„Ø·Ø¨Ø§Ø¹Ø©
// ============================================================
function printSinglePage(preferredAreaId) {
  // ØªØ­Ø¯ÙŠØ¯ Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø·Ø¨Ø§Ø¹Ø© Ø§Ù„Ù†Ø´Ø·Ø©
  var areaIds = preferredAreaId
    ? [preferredAreaId]
    : ['printableArea', 'printableReceiptArea', 'printableInventoryReportArea', 'printableCustomerStatementArea'];

  var printEl = null;
  for (var i = 0; i < areaIds.length; i++) {
    var el = document.getElementById(areaIds[i]);
    if (el && el.innerHTML.trim().length > 20) { printEl = el; break; }
  }

  // A4 portrait: 297mm Ã— 96dpi/25.4 â‰ˆ 1123px | Ù‡ÙˆØ§Ù…Ø´ 8mm Ã— 2 = 61px | ØµØ§ÙÙŠ â‰ˆ 1060px
  var A4_H = 1060;
  var scaleStyleEl = null;

  if (printEl) {
    var contentH = printEl.scrollHeight;
    if (contentH > A4_H) {
      var scale = A4_H / contentH;
      scale = Math.max(0.38, Math.min(1, scale)); // Ø¨ÙŠÙ† 38% Ùˆ 100%
      scaleStyleEl = document.createElement('style');
      scaleStyleEl.id = '_singlepage_zoom';
      // zoom: ÙŠØ¹Ù…Ù„ Ø¨Ø´ÙƒÙ„ Ù…Ø«Ø§Ù„ÙŠ ÙÙŠ Chrome/Edge
      // transform: scale() Ø§Ø­ØªÙŠØ§Ø·ÙŠ Ù„Ù„Ù…ØªØµÙØ­Ø§Øª Ø§Ù„Ø£Ø®Ø±Ù‰
      scaleStyleEl.textContent = [
        '@media print {',
        '  #' + printEl.id + ' {',
        '    zoom: ' + scale.toFixed(4) + ' !important;',
        '    -webkit-print-color-adjust: exact !important;',
        '    print-color-adjust: exact !important;',
        '  }',
        '}'
      ].join('\n');
      document.head.appendChild(scaleStyleEl);
    }
  }

  window.print();

  // ØªÙ†Ø¸ÙŠÙ style Ø§Ù„Ù…Ø¤Ù‚Øª Ø¨Ø¹Ø¯ Ø¥ØªÙ…Ø§Ù… Ø§Ù„Ø·Ø¨Ø§Ø¹Ø©
  setTimeout(function() {
    var old = document.getElementById('_singlepage_zoom');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }, 2500);
}

// ØªÙ†Ø³ÙŠÙ‚ Ø§Ù„ØªÙˆØ§Ø±ÙŠØ® Ø¨Ø§Ù„ØµÙŠØºØ© Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø© ØªÙ…Ø§Ù…Ø§Ù‹ Ø¨Ø£Ø±Ù‚Ø§Ù… Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©: 21-9-2026 Ø§Ù„Ø³Ø§Ø¹Ø© 7:10 Ù…Ø³Ø§Ø¦Ø§Ù‹
function formatAppDateTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'Ù…Ø³Ø§Ø¦Ø§Ù‹' : 'ØµØ¨Ø§Ø­Ø§Ù‹';

  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${day}-${month}-${year} Ø§Ù„Ø³Ø§Ø¹Ø© ${hours}:${minutes} ${period}`;
}

// -------------------------------------------------------------
// Ù†Ø§ÙØ°Ø© ØªØ£ÙƒÙŠØ¯ Ø¢Ù…Ù†Ø© ÙˆØ¹ØµØ±ÙŠØ© Ø¯Ø§Ø®Ù„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ (ØªØªÙˆØ§ÙÙ‚ 100% Ù…Ø¹ Ø¨ÙŠØ¦Ø© Ø§Ù„Ù€ iFrame)
// -------------------------------------------------------------
function showConfirmDialog({ title, message, icon = 'âš ï¸', confirmText = 'ØªØ£ÙƒÙŠØ¯', cancelText = 'Ø¥Ù„ØºØ§Ø¡', isDanger = true, onConfirm }) {
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
  if (titleEl) titleEl.textContent = title || 'ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡';
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
// Ù…Ø­Ø±Ùƒ ØªÙˆÙ„ÙŠØ¯ Ù…Ù„ÙØ§Øª PDF Ø±Ø³Ù…ÙŠ ÙˆÙ…ÙˆØ­Ø¯ Ù…Ø¹ Ø¥Ø±Ø³Ø§Ù„ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
// -------------------------------------------------------------
async function generatePdfBlobFromHtml(htmlContent, fileName = 'document.pdf', options = {}) {
  if (typeof html2pdf === 'undefined') {
    throw new Error('Ù…ÙƒØªØ¨Ø© ØªØµØ¯ÙŠØ± Ø§Ù„Ù€ PDF (html2pdf.js) ØºÙŠØ± Ù…Ø­Ù…Ù„Ø© ÙÙŠ Ø§Ù„Ù…ØªØµÙØ­');
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
    throw new Error('Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ Ø§Ù„Ù…Ø±Ø§Ø¯ ØªØµØ¯ÙŠØ±Ù‡ ÙØ§Ø±Øº');
  }

  const isLandscape = options.orientation === 'landscape';
  const targetWidthPx = isLandscape ? 1120 : 794;

  // Ø¨Ù†Ø§Ø¡ Ø­Ø§ÙˆÙŠØ© Ù…Ø­ØªÙˆÙ‰ Ù†Ø¸ÙŠÙØ© ÙˆÙ…Ø³ØªÙ‚Ù„Ø© Ø¨Ø¯ÙˆÙ† Ø£ÙŠ ØªÙ…ÙˆØ¶Ø¹ Ø´Ø§Ø° (-10000px) Ù„Ù…Ù†Ø¹ Ø§Ù„Ø´Ø§Ø´Ø§Øª Ø§Ù„Ø¨ÙŠØ¶Ø§Ø¡ Ø£Ùˆ Ù‚Ø·Ø¹ Ø§Ù„Ù…Ø­ØªÙˆÙ‰
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

  // Ø¥Ø¸Ù‡Ø§Ø± ÙˆØªØ¬Ù‡ÙŠØ² Ø§Ù„Ø¹Ù†Ø§ØµØ± Ø§Ù„Ù…Ø®Ø¨Ø£Ø© ÙÙŠ Ø§Ù„Ù†ÙˆØ§ÙØ° Ø§Ù„Ù…Ù†Ø¨Ø«Ù‚Ø© (Modals/Popups)
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

  // Ø¥Ø²Ø§Ù„Ø© Ø§Ù„Ø¹Ù†Ø§ØµØ± ØºÙŠØ± Ø§Ù„Ù…Ø±Ø§Ø¯ Ø·Ø¨Ø§Ø¹ØªÙ‡Ø§ Ù…Ø«Ù„ Ø£Ø²Ø±Ø§Ø± Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª
  wrapper.querySelectorAll('.no-print').forEach(el => el.remove());

  try {
    // 1. Ø§Ù†ØªØ¸Ø§Ø± Ø§ÙƒØªÙ…Ø§Ù„ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø®Ø·ÙˆØ· Ù„Ø¶Ù…Ø§Ù† Ø¯Ù‚Ø© Ø§Ù„Ø±Ø³Ù…
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {}
    }

    // 2. Ø§Ù†ØªØ¸Ø§Ø± Ø§ÙƒØªÙ…Ø§Ù„ ØªØ­Ù…ÙŠÙ„ Ø£ÙŠ ØµÙˆØ± Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯
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

    // 3. ØªØ£Ø®ÙŠØ± Ø²Ù…Ù†ÙŠ Ø¨Ø³ÙŠØ· (setTimeout) Ù‚Ø¨Ù„ Ø§Ù„ØªØ­ÙˆÙŠÙ„ Ù„Ù„Ø³Ù…Ø§Ø­ Ù„Ù„Ù…ØªØµÙØ­ Ø¨Ø±Ø³Ù… Ø¹Ù†Ø§ØµØ± Ø§Ù„Ù€ DOM Ø¨Ø§Ù„ÙƒØ§Ù…Ù„ ÙˆØ­Ø³Ø§Ø¨ Ø§Ù„Ø£Ø¨Ø¹Ø§Ø¯ Ø¨Ø¯Ù‚Ø©
    await new Promise(resolve => setTimeout(resolve, options.delay || 300));

    // Ø§Ù„Ù‡Ø§Ù…Ø´ Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ 0 Ù„Ø¥Ø²Ø§Ù„Ø© Ø£ÙŠ ÙØ±Ø§Øº Ø¹Ù„ÙˆÙŠ ØºÙŠØ± Ù…Ø±ØºÙˆØ¨ ÙÙŠÙ‡ Ù„Ø£Ù† Ù‚ÙˆØ§Ù„Ø¨ Ø§Ù„Ù†Ø¸Ø§Ù… ØªØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ù…Ø³Ø§ÙØ§Øª padding ÙƒØ§ÙÙŠØ©
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
          // Ø§Ù„ØªØ£ÙƒØ¯ Ù…Ù† Ø£Ù† Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø­Ø§ÙˆÙŠØ§Øª ÙÙŠ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ Ø§Ù„Ù…Ø³ØªÙ†Ø³Ø® Ø¸Ø§Ù‡Ø±Ø© Ø¨Ø¯Ù‚Ø© ÙˆØ¨Ø¯ÙˆÙ† Ø£ÙŠ ÙØ±Ø§Øº Ø¹Ù„ÙˆÙŠ
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

    // Ø¶Ù…Ø§Ù† Ø§Ù„Ø®ØµØ§Ø¦Øµ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø© Ø¯Ø§Ø¦Ù…Ø§Ù‹
    opt.image = { type: 'jpeg', quality: 0.98 };
    opt.html2canvas.scale = 2;
    opt.html2canvas.scrollX = 0;
    opt.html2canvas.scrollY = 0;

    // ØªÙˆÙ„ÙŠØ¯ Ù…Ù„Ù PDF ÙˆØ§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„Ù€ Blob Ø§Ù„Ù…Ø¹ØªÙ…Ø¯
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
      throw new Error('Ø§Ù„Ù…Ù„Ù Ø§Ù„Ù…ØªÙˆÙ„Ø¯ ÙØ§Ø±ØºØŒ ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø¬Ø¯Ø¯Ø§Ù‹');
    }

    return blob;
  } finally {
    // Ø§Ù„ØªÙ†Ø¸ÙŠÙ
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }
}

// Ø¯Ø§Ù„Ø© Ù„ØªÙ†Ø²ÙŠÙ„ ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø¬Ø±Ø¯ Ù…Ø¨Ø§Ø´Ø±Ø© ÙƒÙ…Ù„Ù PDF
async function downloadInventoryPdfDirectly() {
  const modal = document.getElementById('inventoryReportModal');
  const printableArea = document.getElementById('printableInventoryReportArea');
  if (!modal || !modal.classList.contains('active')) {
    openInventoryReportModal();
  }

  showToast('Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² ÙˆØªØ­Ù…ÙŠÙ„ Ù…Ù„Ù PDF Ù„Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†...', 'info');

  try {
    const html = printableArea ? printableArea.innerHTML : '';
    if (!html) {
      showToast('ØªØ¹Ø°Ø± Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªÙ‚Ø±ÙŠØ±', 'error');
      return;
    }
    const fileName = `ØªÙ‚Ø±ÙŠØ±_Ø¬Ø±Ø¯_${Date.now()}.pdf`;
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
    showToast('ðŸŽ‰ ØªÙ… ØªØ­Ù…ÙŠÙ„ Ù…Ù„Ù ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ø¬Ø±Ø¯ PDF Ø¨Ù†Ø¬Ø§Ø­!', 'success');
  } catch (err) {
    showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ ØªØ­Ù…ÙŠÙ„ Ù…Ù„Ù Ø§Ù„Ø¬Ø±Ø¯ PDF: ' + err.message, 'error');
  }
}

async function downloadCurrentInvoicePdf() {
  if (!state.currentViewingInvoice) return;
  const inv = state.currentViewingInvoice;
  const fileName = `ÙØ§ØªÙˆØ±Ø©_${inv.invoiceNumber || inv.id}.pdf`;
  showToast('Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² ÙˆØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø¨ØµÙŠØºØ© PDF...', 'info');
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
    showToast('ðŸŽ‰ ØªÙ… ØªØ­Ù…ÙŠÙ„ Ù…Ù„Ù Ø§Ù„ÙØ§ØªÙˆØ±Ø© PDF Ø¨Ù†Ø¬Ø§Ø­!', 'success');
  } catch (err) {
    showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ ØªØ­Ù…ÙŠÙ„ Ù…Ù„Ù Ø§Ù„ÙØ§ØªÙˆØ±Ø© PDF: ' + err.message, 'error');
  }
}

async function downloadCurrentReceiptPdf() {
  if (!state.currentViewingReceipt) return;
  const r = state.currentViewingReceipt;
  const fileName = `Ø³Ù†Ø¯_Ù‚Ø¨Ø¶_${r.receiptNumber}.pdf`;
  showToast('Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² ÙˆØªØ­Ù…ÙŠÙ„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ø¨ØµÙŠØºØ© PDF...', 'info');
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
    showToast('ðŸŽ‰ ØªÙ… ØªØ­Ù…ÙŠÙ„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ PDF Ø¨Ù†Ø¬Ø§Ø­!', 'success');
  } catch (err) {
    showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ ØªØ­Ù…ÙŠÙ„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ PDF: ' + err.message, 'error');
  }
}

async function sendPdfDocumentToTelegram(pdfBlob, fileName, caption) {
  try {
    if (!pdfBlob || !(pdfBlob instanceof Blob) || pdfBlob.size < 500) {
      throw new Error('Ù…Ù„Ù Ø§Ù„Ù€ PDF ØºÙŠØ± ØµØ§Ù„Ø­ Ø£Ùˆ ÙØ§Ø±Øº Ø§Ù„Ø­Ø¬Ù…');
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

// Ø¨Ù†Ø§Ø¡ ÙƒØ´Ù Ø±Ø³Ù…ÙŠ Ù„ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª Ø£Ùˆ Ù…Ø´ØªØ±ÙŠØ§Øª Ø¨ØµÙŠØºØ© PDF Ù…Ø¹ØªÙ…Ø¯ ÙˆÙ…ØªÙˆØ§ÙÙ‚ 100% Ù…Ø¹ ÙƒØ§ÙØ© Ø§Ù„Ù…Ø­Ø±ÙƒØ§Øª
function buildPrintableInvoiceHtml(inv) {
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const isPurchase = inv.invoiceType === 'purchase';
  const typeTitle = isPurchase ? 'ÙØ§ØªÙˆØ±Ø© Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØªÙˆØ±ÙŠØ¯ Ù…Ø®Ø²ÙˆÙ†' : 'ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª Ø¶Ø±ÙŠØ¨ÙŠØ©';
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
          ${item.code ? `<div style="font-size: 12px; color: #64748b; font-family: monospace;">ÙƒÙˆØ¯: ${escapeHtml(item.code)}</div>` : ''}
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
            <strong style="color: #b45309; display: block; margin-bottom: 6px;">â³ ØªÙØ§ØµÙŠÙ„ Ù†Ø¸Ø§Ù… Ø§Ù„Ø£Ù‚Ø³Ø§Ø· Ø§Ù„Ù…Ø¬Ø¯ÙˆÙ„Ø©:</strong>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 3px 0;">â€¢ Ø§Ù„Ø¯ÙØ¹Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰ Ø§Ù„Ù…Ø³Ø¯Ø¯Ø©: <strong>${(inst.downPayment || 0).toLocaleString('en-US')} ${cur}</strong></td>
                <td style="padding: 3px 0;">â€¢ Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ø§Ù„Ù…Ø³ØªØ­Ù‚: <strong style="color: #dc2626;">${(inst.remainingAmount || 0).toLocaleString('en-US')} ${cur}</strong></td>
                <td style="padding: 3px 0;">â€¢ Ù…Ø¯Ø© Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø§Ù„Ù…ØªÙÙ‚ Ø¹Ù„ÙŠÙ‡Ø§: <strong>${escapeHtml(inst.duration || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯')}</strong></td>
              </tr>
            </table>
            ${inst.scheduleNotes ? `<div style="margin-top: 4px;">â€¢ Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ù„Ø£Ù‚Ø³Ø§Ø·: ${escapeHtml(inst.scheduleNotes)}</div>` : ''}
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
                <td style="font-size: 36px; vertical-align: middle; padding-left: 12px; width: 45px;">ðŸ’¼</td>
                <td style="vertical-align: middle;">
                  <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h1>
                  <div style="font-size: 13px; color: #475569; margin-top: 3px;">
                    ${escapeHtml(state.settings.companyAddress || 'Ø§Ù„Ù…Ø±ÙƒØ² Ø§Ù„ØªØ¬Ø§Ø±ÙŠ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ')} | Ù‡Ø§ØªÙ: ${escapeHtml(state.settings.companyPhone || '')}
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
              <span style="color: #64748b;">${isPurchase ? 'Ø§Ù„Ù…ÙˆØ±Ø¯ / Ø§Ù„ØªÙˆØ±ÙŠØ¯:' : 'Ø§Ù„Ø²Ø¨ÙˆÙ† / Ø§Ù„Ø³ÙŠØ¯:'}</span> 
              <strong style="font-size: 15px; color: #0f172a;">${escapeHtml(inv.customerName)}</strong>
            </div>
            ${inv.customerPhone ? `<div style="margin-bottom: 4px;"><span style="color: #64748b;">Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ:</span> <strong style="direction: ltr; display: inline-block;">${escapeHtml(inv.customerPhone)}</strong></div>` : ''}
            ${inv.customerSystemNumber ? `<div><span style="color: #64748b;">Ø±Ù‚Ù… Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…:</span> <strong>#${escapeHtml(inv.customerSystemNumber)}</strong></div>` : ''}
          </td>
          <td style="width: 50%; vertical-align: top; padding: 12px 14px;">
            <div style="margin-bottom: 6px;"><span style="color: #64748b;">Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ù…Ø­Ø±Ø±:</span> <strong>${escapeHtml(inv.employeeName || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯')}</strong></div>
            <div><span style="color: #64748b;">Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹:</span> <strong>${isPurchase ? 'Ù†Ù‚Ø¯Ø§Ù‹ (Ù…Ø´ØªØ±ÙŠØ§Øª)' : (inv.paymentMethod === 'installments' ? 'Ø£Ù‚Ø³Ø§Ø· Ù…Ø¬Ø¯ÙˆÙ„Ø©' : 'Ù†Ù‚Ø¯Ø§Ù‹ (ÙƒØ§Ø´)')}</strong></div>
          </td>
        </tr>
      </table>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; margin-bottom: 18px;">
        <thead>
          <tr style="background: #e2e8f0; color: #0f172a;">
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 40px; text-align: center;">#</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; text-align: right;">Ø§Ù„ØµÙ†Ù / Ø§Ù„Ù…Ù†ØªØ¬</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 80px; text-align: center;">Ø§Ù„ÙƒÙ…ÙŠØ©</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 110px; text-align: left;">Ø§Ù„Ø³Ø¹Ø±</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 130px; text-align: left;">Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ</th>
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
              <div style="color: #047857; font-weight: 700;">Ø§Ù„Ù…Ø¨Ù„Øº ÙƒØªØ§Ø¨Ø©Ù‹:</div>
              <div style="font-weight: 800; font-size: 14.5px; margin-top: 3px;">${words}</div>
              ${inv.notes ? `<div style="margin-top: 6px; color: #475569; font-size: 12.5px;"><strong>Ù…Ù„Ø§Ø­Ø¸Ø§Øª:</strong> ${escapeHtml(inv.notes)}</div>` : ''}
            </div>
          </td>
          <td style="vertical-align: top; width: 42%;">
            <table style="width: 100%; border-collapse: collapse; background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 8px;">
              <tr>
                <td style="padding: 8px 12px; font-weight: 700; font-size: 13px; border-bottom: 1px solid #cbd5e1;">Ø¹Ø¯Ø¯ Ø§Ù„Ù‚Ø·Ø¹ Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ:</td>
                <td style="padding: 8px 12px; text-align: left; font-weight: 800; font-size: 13.5px; border-bottom: 1px solid #cbd5e1;">${(inv.summary?.totalQuantity || 0)} Ù‚Ø·Ø¹Ø©</td>
              </tr>
              <tr style="background: #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: 900; font-size: 15px; color: #047857;">Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ:</td>
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
          <td style="padding-top: 10px; width: 33.33%;">ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ù…Ø³ØªÙ„Ù…: _________________</td>
          <td style="padding-top: 10px; text-align: center; width: 33.33%;">Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ù…Ø­Ù„ / Ø§Ù„Ø´Ø±ÙƒØ©: _________________</td>
          <td style="padding-top: 10px; text-align: left; width: 33.33%;">${escapeHtml(state.settings.invoiceFooterText || 'Ø¨Ø¶Ø§Ø¹Ø© Ø§Ù„Ø´Ø±ÙƒØ© Ù…ÙƒÙÙˆÙ„Ø©')}</td>
        </tr>
      </table>
    </div>
  `;
}

// Ø¨Ù†Ø§Ø¡ ÙƒØ´Ù Ø±Ø³Ù…ÙŠ Ù„Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ù…Ø§Ù„ÙŠ Ø¨ØµÙŠØºØ© PDF Ù…Ø¹ØªÙ…Ø¯ ÙˆÙ…ØªÙˆØ§ÙÙ‚ 100%
function buildPrintableReceiptHtml(receipt) {
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const words = tafqeetArabic(receipt.amount, cur);
  const dateStr = formatAppDateTime(receipt.createdAt);
  const methodLabel = {
    cash: 'Ù†Ù‚Ø¯Ø§Ù‹ (Cash)',
    transfer: 'ØªØ­ÙˆÙŠÙ„ Ø¨Ù†ÙƒÙŠ (Bank Transfer)',
    check: 'Ø´ÙŠÙƒ Ù…ØµØ±ÙÙŠ (Bank Cheque)'
  }[receipt.paymentMethod] || 'Ù†Ù‚Ø¯Ø§Ù‹';

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
                <td style="font-size: 38px; vertical-align: middle; padding-left: 12px; width: 45px;">ðŸ’¼</td>
                <td style="vertical-align: middle;">
                  <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h1>
                  <div style="font-size: 13px; color: #475569; margin-top: 3px;">
                    ${escapeHtml(state.settings.companyAddress || 'Ø§Ù„Ù…Ø±ÙƒØ² Ø§Ù„ØªØ¬Ø§Ø±ÙŠ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ')} | Ù‡Ø§ØªÙ: ${escapeHtml(state.settings.companyPhone || '')}
                  </div>
                </td>
              </tr>
            </table>
          </td>
          <td style="vertical-align: middle; text-align: left; width: 40%;">
            <div style="display: inline-block; background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; padding: 5px 14px; border-radius: 6px; font-weight: 800; font-size: 14.5px;">
              Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ù…Ø§Ù„ÙŠ Ù…Ø¹ØªÙ…Ø¯
            </div>
            <div style="margin-top: 5px; font-weight: 900; font-family: monospace; font-size: 19px; color: #0f172a;">
              Ø±Ù‚Ù… Ø§Ù„Ø³Ù†Ø¯: #${receipt.receiptNumber}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Ø§Ù„ØªØ§Ø±ÙŠØ®: ${dateStr}</div>
          </td>
        </tr>
      </table>

      <!-- Big Amount Banner -->
      <table style="width: 100%; border-collapse: collapse; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; margin-bottom: 18px;">
        <tr>
          <td style="padding: 12px 18px; font-size: 15px; font-weight: 700; color: #166534; text-align: right;">Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ù‚Ø¨ÙˆØ¶:</td>
          <td style="padding: 12px 18px; font-size: 22px; font-weight: 900; color: #15803d; text-align: left;">${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</td>
        </tr>
      </table>

      <!-- Receipt Details Table -->
      <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 18px; font-size: 14px;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; width: 170px; color: #64748b; font-weight: 700;">ÙˆØµÙ„Ù†Ø§ Ù…Ù† Ø§Ù„Ø³ÙŠØ¯ / Ø§Ù„Ø³Ø§Ø¯Ø©:</td>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; font-weight: 800; color: #0f172a;">${escapeHtml(receipt.customerName)} ${receipt.customerSystemNumber ? `[Ø±Ù‚Ù… Ø§Ù„Ø­Ø³Ø§Ø¨: #${escapeHtml(receipt.customerSystemNumber)}]` : ''} ${receipt.customerPhone ? `(Ù‡Ø§ØªÙ: ${escapeHtml(receipt.customerPhone)})` : ''}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; width: 170px; color: #64748b; font-weight: 700;">Ù…Ø¨Ù„Øº ÙˆÙ‚Ø¯Ø±Ù‡ Ø¨Ø§Ù„Ø£Ø­Ø±Ù:</td>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; font-weight: 800; color: #047857;">${words || `${receipt.amount} ${cur}`}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; width: 170px; color: #64748b; font-weight: 700;">Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹:</td>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; font-weight: 800;">${methodLabel}</td>
        </tr>
        ${receipt.description ? `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; width: 170px; color: #64748b; font-weight: 700;">ÙˆØ°Ù„Ùƒ Ù„Ù‚Ø§Ø¡ (Ø§Ù„Ø¨ÙŠØ§Ù†):</td>
          <td style="padding: 10px 14px; border-bottom: 1px dashed #cbd5e1; font-weight: 700; color: #0f172a;">${escapeHtml(receipt.description)}</td>
        </tr>` : ''}
        ${(prevBal > 0 || remBal >= 0) ? `
        <tr style="background: #f8fafc;">
          <td colspan="2" style="padding: 10px 14px; font-size: 13.5px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td>Ø§Ù„Ø¯ÙŠÙ† Ø§Ù„Ø³Ø§Ø¨Ù‚ Ù‚Ø¨Ù„ Ø§Ù„Ø³Ù†Ø¯: <strong>${prevBal.toLocaleString('en-US')} ${cur}</strong></td>
                <td style="text-align: center;">Ø§Ù„Ù…Ø³Ø¯Ø¯ Ø§Ù„Ø¢Ù†: <strong style="color: #047857;">-${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</strong></td>
                <td style="text-align: left;">Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ø¨Ø°Ù…ØªÙ‡: <strong style="color: ${remBal > 0 ? '#dc2626' : '#059669'}; font-size: 14.5px;">${remBal.toLocaleString('en-US')} ${cur}</strong></td>
              </tr>
            </table>
          </td>
        </tr>` : ''}
        ${receipt.notes ? `
        <tr>
          <td style="padding: 10px 14px; width: 170px; color: #64748b; font-weight: 700;">Ù…Ù„Ø§Ø­Ø¸Ø§Øª:</td>
          <td style="padding: 10px 14px; font-size: 13px; color: #475569;">${escapeHtml(receipt.notes)}</td>
        </tr>` : ''}
      </table>

      <!-- Signatures Table -->
      <table style="width: 100%; border-collapse: collapse; border-top: 1.5px solid #cbd5e1; margin-top: 26px; padding-top: 16px; text-align: center; font-size: 13px; color: #475569;">
        <tr>
          <td style="width: 33.33%; padding: 10px; vertical-align: top;">
            <div>Ø§Ø³Ù… ÙˆØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ù…Ø³ØªÙ„Ù…</div>
            <div style="margin-top: 20px; font-weight: 800; color: #0f172a;">${escapeHtml(receipt.employeeName || 'Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„')}</div>
          </td>
          <td style="width: 33.33%; padding: 10px; vertical-align: top;">
            <div>ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ø²Ø¨ÙˆÙ† / Ø§Ù„Ù…ÙˆØ¯Ø¹</div>
            <div style="margin-top: 20px;">_________________</div>
          </td>
          <td style="width: 33.33%; padding: 10px; vertical-align: top;">
            <div>Ø®ØªÙ… ÙˆØ§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ø´Ø±ÙƒØ©</div>
            <div style="margin-top: 20px;">_________________</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

// Ø¨Ù†Ø§Ø¡ Ù…Ø­Ø¶Ø± Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ ÙˆØªØ¹Ø¯ÙŠÙ„ Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ø¨ØµÙŠØºØ© PDF
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
          <h1 style="font-size: 1.6rem; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h1>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">Ù…Ø­Ø¶Ø± ØªÙˆØ«ÙŠÙ‚ ÙˆØªØ¹Ø¯ÙŠÙ„ Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ</div>
        </div>
        <div style="text-align: left;">
          <div style="background: #f0fdf4; color: #166534; border: 1.5px solid #86efac; padding: 0.35rem 0.85rem; border-radius: 6px; font-weight: 800;">
            Ù…Ø­Ø¶Ø± Ø¬Ø±Ø¯ Ù…Ø¹ØªÙ…Ø¯
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.3rem;">Ø§Ù„ØªØ§Ø±ÙŠØ®: ${nowStr}</div>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.92rem; display: flex; justify-content: space-between;">
        <div>Ø§Ù„Ù‚Ø§Ø¦Ù… Ø¨Ø§Ù„Ø¬Ø±Ø¯ ÙˆØ§Ù„ØªÙˆØ«ÙŠÙ‚: <strong style="font-size: 1rem; color: #065f46;">${escapeHtml(editorName)}</strong></div>
        <div>Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ù…Ø¹Ø¯Ù„Ø©: <strong>${modifiedItems.length} ØµÙ†Ù</strong></div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-bottom: 1.5rem;">
        <thead>
          <tr style="background: #e2e8f0; color: #0f172a;">
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 40px; text-align: center;">#</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 110px; text-align: center;">ÙƒÙˆØ¯ Ø§Ù„ØµÙ†Ù</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; text-align: right;">Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 90px; text-align: center;">Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 100px; text-align: center;">Ø§Ù„ÙƒÙ…ÙŠØ© Ø¨Ø¹Ø¯ Ø§Ù„Ø¬Ø±Ø¯</th>
            <th style="border: 1px solid #94a3b8; padding: 8px; width: 90px; text-align: center;">ÙØ§Ø±Ù‚ Ø§Ù„Ø¬Ø±Ø¯</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="margin-top: 2.5rem; border-top: 1px solid #cbd5e1; padding-top: 1rem; display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569;">
        <div>ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ù‚Ø§Ø¦Ù… Ø¨Ø§Ù„Ø¬Ø±Ø¯: <strong>${escapeHtml(editorName)}</strong></div>
        <div>Ø§Ø¹ØªÙ…Ø§Ø¯ Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªÙˆØ¯Ø¹: _________________</div>
        <div>Ù†Ø¸Ø§Ù… Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª</div>
      </div>
    </div>
  `;
}

// Ø¨Ù†Ø§Ø¡ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ ÙˆØ§Ù„Ø£Ø±Ø¨Ø§Ø­ Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠ Ø¨ØµÙŠØºØ© PDF
function buildFinancialReportHtml(stats, periodTitle) {
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const nowStr = formatAppDateTime(new Date());

  return `
    <div style="padding: 2rem; font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif; direction: rtl; color: #0f172a; line-height: 1.6;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 1.25rem; margin-bottom: 1.5rem;">
        <div>
          <h1 style="font-size: 1.6rem; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h1>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠ Ø§Ù„Ø´Ø§Ù…Ù„ ÙˆØ­Ø³Ø§Ø¨ Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ ÙˆØ§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª</div>
        </div>
        <div style="text-align: left;">
          <div style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; padding: 0.35rem 0.9rem; border-radius: 6px; font-weight: 800; font-size: 0.95rem;">
            ÙØªØ±Ø© Ø§Ù„ØªÙ‚Ø±ÙŠØ±: ${escapeHtml(periodTitle || 'ÙƒÙ„ Ø§Ù„Ø£ÙˆÙ‚Ø§Øª')}
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.3rem;">ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø³ØªØ®Ø±Ø§Ø¬: ${nowStr}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem;">
          <span style="font-size: 0.85rem; color: #64748b; font-weight: 700; display: block;">ðŸ’µ Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª Ø§Ù„Ù…Ø­Ù‚Ù‚Ø©</span>
          <strong style="font-size: 1.45rem; color: #0f172a; display: block; margin-top: 0.25rem;">${(stats.totalSales || 0).toLocaleString('en-US')} ${cur}</strong>
          <small style="color: #64748b;">Ù…Ù† Ø¥Ø¬Ù…Ø§Ù„ÙŠ ${stats.totalInvoicesCount || 0} ÙØ§ØªÙˆØ±Ø© ØµØ§Ø¯Ø±Ø©</small>
        </div>

        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem;">
          <span style="font-size: 0.85rem; color: #64748b; font-weight: 700; display: block;">ðŸ“‰ ØªÙƒÙ„ÙØ© Ø§Ù„Ø¨Ø¶Ø§Ø¹Ø© Ø§Ù„Ù…Ø¨Ø§Ø¹Ø© (Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„)</span>
          <strong style="font-size: 1.45rem; color: #475569; display: block; margin-top: 0.25rem;">${(stats.totalCost || 0).toLocaleString('en-US')} ${cur}</strong>
          <small style="color: #64748b;">Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ Ø§Ù„Ù…Ø³ØªØ±Ø¯ Ù…Ù† Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª</small>
        </div>

        <div style="background: #ecfdf5; border: 1.5px solid #86efac; border-radius: 8px; padding: 1rem;">
          <span style="font-size: 0.85rem; color: #065f46; font-weight: 700; display: block;">ðŸ“ˆ ØµØ§ÙÙŠ Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ Ø§Ù„Ù…Ø­Ù‚Ù‚Ø©</span>
          <strong style="font-size: 1.45rem; color: #047857; display: block; margin-top: 0.25rem;">+${(stats.totalProfit || 0).toLocaleString('en-US')} ${cur}</strong>
          <small style="color: #059669; font-weight: 700;">Ù‡Ø§Ù…Ø´ Ø±Ø¨Ø­: ${stats.profitMarginPercentage || 0}%</small>
        </div>
      </div>

      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">ðŸ’³ ØªÙØ§ØµÙŠÙ„ Ø§Ù„ØªØ­ØµÙŠÙ„ ÙˆØ·Ø±Ù‚ Ø§Ù„Ø¯ÙØ¹:</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.92rem;">
          <div style="background: #f8fafc; padding: 0.85rem; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div>â€¢ Ù…Ø¨ÙŠØ¹Ø§Øª Ù†Ù‚Ø¯ÙŠØ© ÙÙˆØ±ÙŠØ© (ÙƒØ§Ø´): <strong>${(stats.cashSales || 0).toLocaleString('en-US')} ${cur}</strong></div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">ØªÙ… Ø§Ø³ØªÙ„Ø§Ù…Ù‡Ø§ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„ Ø¯ÙˆÙ† Ø¯ÙŠÙˆÙ†</div>
          </div>
          <div style="background: #fffbeb; padding: 0.85rem; border-radius: 6px; border: 1px solid #fde68a;">
            <div>â€¢ Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ù…Ø¨ÙŠØ¹Ø§Øª Ø§Ù„Ø£Ù‚Ø³Ø§Ø·: <strong>${(stats.installmentsTotal || 0).toLocaleString('en-US')} ${cur}</strong></div>
            <div style="margin-top: 0.25rem;">  - Ø§Ù„Ø¯ÙØ¹Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰ Ø§Ù„Ù…Ø­ØµÙ„Ø©: <strong>${(stats.installmentsDownPayments || 0).toLocaleString('en-US')} ${cur}</strong></div>
            <div style="color: #dc2626; font-weight: 700;">  - Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ù„Ù„ØªØ­ØµÙŠÙ„ Ø¨Ø°Ù…Ø© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†: <strong>${(stats.installmentsRemaining || 0).toLocaleString('en-US')} ${cur}</strong></div>
          </div>
        </div>
      </div>

      <div style="background: #f0fdfa; border: 1.5px solid #99f6e4; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 0.75rem 0; font-size: 1.05rem; font-weight: 800; color: #115e59;">ðŸ¬ ØªÙ‚ÙŠÙŠÙ… Ø±Ø£Ø³ Ù…Ø§Ù„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„Ø­Ø§Ù„ÙŠ Ø¨Ø§Ù„Ù…Ø³ØªÙˆØ¯Ø¹:</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.92rem;">
          <div>â€¢ Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ Ø§Ù„Ù…Ø®Ø²Ù†: <strong style="color: #0f766e;">${(stats.totalInventoryCapital || 0).toLocaleString('en-US')} ${cur}</strong></div>
          <div>â€¢ Ø¹Ø¯Ø¯ Ø§Ù„Ù‚Ø·Ø¹ Ø§Ù„Ù…ØªÙˆÙØ±Ø©: <strong>${(stats.totalStockUnits || 0).toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</strong></div>
          <div>â€¢ Ø§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ø¨ÙŠØ¹ÙŠØ© Ø§Ù„Ù…ØªÙˆÙ‚Ø¹Ø©: <strong>${(stats.totalInventoryRetail || 0).toLocaleString('en-US')} ${cur}</strong></div>
        </div>
      </div>

      <div style="margin-top: 2.5rem; border-top: 1px solid #cbd5e1; padding-top: 1rem; display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569;">
        <div>Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ Ø§Ù„Ù…Ø§Ù„ÙŠ: _________________</div>
        <div>Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ù…Ø¯ÙŠØ± Ø§Ù„Ø¹Ø§Ù…: _________________</div>
        <div>ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯: ${nowStr}</div>
      </div>
    </div>
  `;
}

// Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù PDF Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
async function sendInvoicePdfToTelegram(invoice) {
  try {
    const isPurchase = invoice.invoiceType === 'purchase';
    const html = buildPrintableInvoiceHtml(invoice);
    const invoiceNum = invoice.invoiceNumber || invoice.id;
    const fileName = `ÙØ§ØªÙˆØ±Ø©_${isPurchase ? 'Ù…Ø´ØªØ±ÙŠØ§Øª' : 'Ù…Ø¨ÙŠØ¹Ø§Øª'}_${invoiceNum}.pdf`;
    const pdfBlob = await generatePdfBlobFromHtml(html, fileName);
    const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
    const totalAmount = invoice.summary?.totalAmount || 0;
    const totalQty = invoice.summary?.totalQuantity || (invoice.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
    const itemsCount = (invoice.items || []).length;

    let profitText = '';
    if (!isPurchase && invoice.summary?.totalProfit) {
      profitText = `\nðŸ“ˆ <b>ØµØ§ÙÙŠ Ø§Ù„Ø±Ø¨Ø­:</b> ðŸŸ¢ <b>+${Number(invoice.summary.totalProfit).toLocaleString('en-US')} ${cur}</b> (${invoice.summary.profitMarginPercentage || 0}%)`;
    }

    let paymentText = '';
    if (!isPurchase) {
      paymentText = invoice.paymentMethod === 'installments'
        ? `\nðŸ’³ <b>Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø³Ø¯Ø§Ø¯:</b> â³ Ø£Ù‚Ø³Ø§Ø· (Ù…ØªØ¨Ù‚ÙŠ: ${Number(invoice.installmentDetails?.remainingAmount || 0).toLocaleString('en-US')} ${cur})`
        : `\nðŸ’³ <b>Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø³Ø¯Ø§Ø¯:</b> ðŸ’µ Ù†Ù‚Ø¯Ø§Ù‹ (ÙƒØ§Ø´ Ù…Ø³Ø¯Ø¯ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„)`;
    }

    const caption = 
`ðŸ“„ <b>ÙØ§ØªÙˆØ±Ø© ${isPurchase ? 'Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØªÙˆØ±ÙŠØ¯' : 'Ù…Ø¨ÙŠØ¹Ø§Øª'} Ù…Ø¹ØªÙ…Ø¯Ø© #${invoiceNum} (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ)</b>
ðŸ¢ <b>${state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ‘¤ <b>${isPurchase ? 'Ø§Ù„Ù…ÙˆØ±Ø¯:' : 'Ø§Ù„Ø²Ø¨ÙˆÙ†:'}</b> <b>${invoice.customerName}</b>
ðŸ‘¨â€ðŸ’¼ <b>Ø§Ù„Ù…ÙˆØ¸Ù:</b> ${invoice.employeeName || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯'}
ðŸ’° <b>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙØ§ØªÙˆØ±Ø©:</b> <b>${totalAmount.toLocaleString('en-US')} ${cur}</b>${profitText}${paymentText}
ðŸ“¦ <b>Ø§Ù„Ø£ØµÙ†Ø§Ù:</b> ${itemsCount} ØµÙ†Ù (${totalQty} Ù‚Ø·Ø¹Ø©)
ðŸ“… <b>Ø§Ù„ØªØ§Ø±ÙŠØ®:</b> ${formatAppDateTime(invoice.createdAt)}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ø£Ø¹Ù„Ø§Ù‡ Ù…Ù„Ù Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø±Ø³Ù…ÙŠ Ø¨ØµÙŠØºØ© PDF Ù…Ø¹ØªÙ…Ø¯ ÙˆÙ‚Ø§Ø¨Ù„ Ù„Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© ÙˆØ§Ù„Ø·Ø¨Ø§Ø¹Ø© ÙˆØ§Ù„Ù…Ø´Ø§Ø±ÙƒØ©.</i>`;

    await sendPdfDocumentToTelegram(pdfBlob, fileName, caption);
  } catch (err) {
    console.warn('sendInvoicePdfToTelegram error:', err);
  }
}

// Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù PDF Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
async function sendReceiptPdfToTelegram(receipt) {
  try {
    const html = buildPrintableReceiptHtml(receipt);
    const fileName = `Ø³Ù†Ø¯_Ù‚Ø¨Ø¶_${receipt.receiptNumber}.pdf`;
    const pdfBlob = await generatePdfBlobFromHtml(html, fileName);
    const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

    const caption = 
`ðŸ“„ <b>Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ù…Ø§Ù„ÙŠ Ù…Ø¹ØªÙ…Ø¯ #${receipt.receiptNumber} (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ)</b>
ðŸ¢ <b>${state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ‘¤ <b>Ø§Ù„Ø²Ø¨ÙˆÙ†:</b> ${receipt.customerName}
ðŸ’° <b>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…Ù‚Ø¨ÙˆØ¶:</b> ðŸŸ¢ <b>${Number(receipt.amount || 0).toLocaleString('en-US')} ${cur}</b>
ðŸ“… <b>Ø§Ù„ØªØ§Ø±ÙŠØ®:</b> ${formatAppDateTime(receipt.createdAt)}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ø£Ø¹Ù„Ø§Ù‡ Ù…Ù„Ù Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ø§Ù„Ø±Ø³Ù…ÙŠ Ø§Ù„Ù…Ø¹ØªÙ…Ø¯ Ø¨ØµÙŠØºØ© PDF.</i>`;

    await sendPdfDocumentToTelegram(pdfBlob, fileName, caption);
  } catch (err) {
    console.warn('sendReceiptPdfToTelegram error:', err);
  }
}

// Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù PDF Ù…Ø­Ø¶Ø± Ø§Ù„Ø¬Ø±Ø¯ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
async function sendInventoryAuditPdfToTelegram(modifiedDetails, editorName) {
  try {
    const html = buildInventoryAuditHtml(modifiedDetails, editorName);
    const fileName = `Ù…Ø­Ø¶Ø±_Ø¬Ø±Ø¯_${Date.now()}.pdf`;
    const pdfBlob = await generatePdfBlobFromHtml(html, fileName);

    const caption = 
`ðŸ“„ <b>Ù…Ø­Ø¶Ø± Ø¬Ø±Ø¯ ÙˆØªØ­Ø¯ÙŠØ« ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ† (Ù…Ù„Ù PDF Ø±Ø³Ù…ÙŠ)</b>
ðŸ¢ <b>${state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ‘¨â€ðŸ’¼ <b>Ø§Ù„Ù‚Ø§Ø¦Ù… Ø¨Ø§Ù„Ø¬Ø±Ø¯:</b> <b>${editorName}</b>
ðŸ”¢ <b>Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ù…Ø¹Ø¯Ù„Ø©:</b> <b>${modifiedDetails.length} ØµÙ†Ù</b>
ðŸ• <b>Ø§Ù„ÙˆÙ‚Øª:</b> ${formatAppDateTime(new Date())}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ Ø£Ø¹Ù„Ø§Ù‡ ÙƒØ´Ù Ø§Ù„Ø¬Ø±Ø¯ Ø§Ù„ØªÙØµÙŠÙ„ÙŠ Ø¨Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ø³Ø§Ø¨Ù‚Ø© ÙˆØ§Ù„ÙØ¹Ù„ÙŠØ© ÙˆØ§Ù„ÙØ±ÙˆÙ‚Ø§Øª.</i>`;

    await sendPdfDocumentToTelegram(pdfBlob, fileName, caption);
  } catch (err) {
    console.warn('sendInventoryAuditPdfToTelegram error:', err);
  }
}

// -------------------------------------------------------------
// ØªÙˆØ­ÙŠØ¯ ÙˆØªØ·Ø¨ÙŠØ¹ Ø§Ù„Ù†ØµÙˆØµ Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© ÙˆØ§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ© Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª ÙˆØ§Ù„Ø¨Ø­Ø« Ø§Ù„Ø°ÙƒÙŠ
// -------------------------------------------------------------
function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Ø¥Ø²Ø§Ù„Ø© Ø§Ù„Ø­Ø±ÙƒØ§Øª ÙˆØ§Ù„ØªÙ†ÙˆÙŠÙ†
    .replace(/[Ø¥Ø£Ø¢Ø§]/g, 'Ø§')               // ØªÙˆØ­ÙŠØ¯ Ø£Ø´ÙƒØ§Ù„ Ø§Ù„Ø£Ù„Ù
    .replace(/Ø©/g, 'Ù‡')                    // ØªÙˆØ­ÙŠØ¯ Ø§Ù„ØªØ§Ø¡ Ø§Ù„Ù…Ø±Ø¨ÙˆØ·Ø©
    .replace(/Ù‰/g, 'ÙŠ')                    // ØªÙˆØ­ÙŠØ¯ Ø§Ù„ÙŠØ§Ø¡
    // ØªÙˆØ­ÙŠØ¯ Ø§Ù„Ù…Ø±Ø§Ø¯ÙØ§Øª ÙˆØ§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø© Ø¨Ø¯Ù‚Ø© ØªØ§Ù…Ø©
    .replace(/Ø³ÙŠÙ…ÙÙŠØ±/g, 'Ø³Ù…ÙÙŠØ±')
    .replace(/simfer/gi, 'Ø³Ù…ÙÙŠØ±')
    .replace(/Ù…Ø§Ù†Ø¬Ø±(\s*Ù‡ÙˆÙ…)?/g, 'Ù…Ù†Ø¬Ø± Ù‡ÙˆÙ…')
    .replace(/Ù…Ù†Ø¬Ø±(\s*Ù‡ÙˆÙ…)?/g, 'Ù…Ù†Ø¬Ø± Ù‡ÙˆÙ…')
    .replace(/manger(\s*home)?/gi, 'Ù…Ù†Ø¬Ø± Ù‡ÙˆÙ…')
    .replace(/\braf\b/gi, 'Ø±Ø§Ù')
    .replace(/Ù„ÙˆÙƒØ³ÙˆØ±/g, 'Ù„ÙˆÙƒØ³Ø±')
    .replace(/luxor/gi, 'Ù„ÙˆÙƒØ³Ø±')
    .replace(/Ø²Ø§ÙƒØ§Ø´/g, 'Ø²ÙƒØ´')
    .replace(/Ø²ÙƒØ§Ø´/g, 'Ø²ÙƒØ´')
    .replace(/zacash/gi, 'Ø²ÙƒØ´')
    .replace(/Ù„ÙˆØ±Ù†Ø³/g, 'Ù„ÙˆØ±Ù†Ø³')
    .replace(/lawrence/gi, 'Ù„ÙˆØ±Ù†Ø³')
    .replace(/ÙŠÙˆÙ†ÙŠÙØ±Ø³Ø§Ù„/g, 'ÙŠÙˆÙ†ÙŠÙØ±Ø³Ø§Ù„')
    .replace(/universal/gi, 'ÙŠÙˆÙ†ÙŠÙØ±Ø³Ø§Ù„')
    .replace(/Ø§Ù„\s*Ø¬ÙŠ/g, 'lg')
    .replace(/Ø³Ø§Ù…Ø³ÙˆÙ†Ø¬/g, 'Ø³Ø§Ù…Ø³ÙˆÙ†Ø¬')
    .replace(/samsung/gi, 'Ø³Ø§Ù…Ø³ÙˆÙ†Ø¬')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ø¯Ø§Ù„Ø© ÙØ­Øµ Ù…Ø·Ø§Ø¨Ù‚Ø© ÙƒÙ„Ù…Ø© Ù…Ø¹ Ù…Ø±Ø§Ø¹Ø§Ø© Ø­Ø¯ÙˆØ¯ Ø§Ù„ÙƒÙ„Ù…Ø§Øª Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ù„Ø¹Ø¯Ù… Ø§Ù„Ø®Ù„Ø· Ø¨ÙŠÙ† "Ø±Ø§Ù" Ùˆ "ÙƒØ±Ø§ÙÙŠØª/Ø£Ø·Ø±Ø§Ù/ÙƒØ±Ø§ÙØª"
function matchArabicTerm(target, term) {
  if (!target || !term) return false;
  if (term === 'Ø±Ø§Ù') {
    return /(?:^|[^\u0621-\u064A])Ø±Ø§Ù(?:[^\u0621-\u064A]|$)/i.test(target);
  }
  return target.includes(term);
}

// Ø­Ø§Ù„Ø© Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø¹Ø§Ù…Ø© (Global State)
const state = {
  products: [],
  cart: [],
  invoices: [],
  receipts: [],
  settings: {
    companyName: "Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©",
    companyPhone: "059-1234567",
    companyAddress: "Ø§Ù„Ù…Ø±ÙƒØ² Ø§Ù„ØªØ¬Ø§Ø±ÙŠ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ",
    currency: "Ø´ÙŠÙƒÙ„",
    telegramBotToken: "",
    telegramChatId: "",
    invoiceFooterText: "Ø´ÙƒØ±Ø§Ù‹ Ù„ØªØ¹Ø§Ù…Ù„ÙƒÙ… Ù…Ø¹Ù†Ø§"
  },
  currentPaymentMethod: 'cash',
  invoiceType: 'sales', // 'sales' | 'purchase'
  isAddingProductForInvoice: false,
  customers: [],
  customerDebtsSearch: '',
  selectedInvoiceCustomer: null,
  activeMainCategory: 'all', // 'all' | 'Ø£Ø¬Ù‡Ø²Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© ÙƒØ¨ÙŠØ±Ø©' | 'Ø£Ø¯ÙˆØ§Øª Ù…Ø·Ø¨Ø®' | 'Ø£Ø¯ÙˆØ§Øª Ù…Ù†Ø²Ù„' | 'Ø£Ø¯ÙˆØ§Øª Ø´Ø®ØµÙŠØ©' | 'Ø£Ø®Ø±Ù‰'
  activeCategory: 'all',     // Ø§Ù„ØªØµÙ†ÙŠÙ Ø§Ù„ÙØ±Ø¹ÙŠ Ø£Ùˆ 'all'
  activeBrand: 'all',        // ÙÙ„ØªØ± Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø¨Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬
  catalogBrandTabFilter: 'all', // 'all' | 'popular' | 'ar_1' | 'ar_2' | 'ar_3' | 'en'
  catalogBrandSearchTerm: '',
  catalogBrandsViewMode: 'ribbon', // 'ribbon' | 'grid'
  catalogSearch: '',
  invoicesSearch: '',
  invoicesFilter: 'all',
  currentViewingInvoice: null,
  printMode: 'customer', // 'customer' Ø£Ùˆ 'internal'
  catalogPageSize: 24,
  catalogCurrentPage: 1,

  // Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶
  currentViewingReceipt: null,
  receiptsSearch: '',

  // Ø§Ù„Ø¬Ø±Ø¯ ÙˆØ§Ù„Ù…Ø®Ø²ÙˆÙ†
  inventorySearch: '',
  inventoryCategory: 'all',
  inventoryBrand: 'all',     // ÙÙ„ØªØ± Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø¨Ø§Ù„Ø¬Ø±Ø¯
  inventoryBrandTabFilter: 'all',
  inventoryBrandSearchTerm: '',
  inventoryBrandsViewMode: 'ribbon',
  inventoryQuickFilter: 'all', // 'all' | 'modified' | 'zero' | 'low'
  inventorySort: 'code_asc',   // Ø§Ù„ØªØ±ØªÙŠØ¨: 'code_asc' | 'code_desc' | 'qty_desc' | 'qty_asc' | 'name_asc'
  inventoryPendingUpdates: new Map(), // productId -> newStock
  inventoryPageSize: 40,
  inventoryCurrentPage: 1,

  // Ø­Ù…Ø§ÙŠØ© Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø¨ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± (99199)
  settingsUnlocked: false,

  // ÙÙ„ØªØ±Ø© Ø§Ù„Ù…Ø¯Ø© Ø§Ù„Ø²Ù…Ù†ÙŠØ© Ù„Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª
  dashboardPeriod: 'all',
  dashboardStartDate: '',
  dashboardEndDate: ''
};

// ØªØ´ØºÙŠÙ„ Ø¹Ù†Ø¯ ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙØ­Ø©
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});


// â”€â”€â”€ ÙØ­Øµ Ø­Ø§Ù„Ø© Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠØ© ÙˆÙˆØ¶Ø¹ Ø§Ù„Ù†Ø¸Ø§Ù… â”€â”€â”€
let isDatabaseWriteReady = true;

async function checkDatabaseStatus() {
  const dbBadge = document.getElementById('dbHeaderBadge');
  const dbText = document.getElementById('dbStatusText');
  const dbBanner = document.getElementById('dbAlertBanner');

  try {
    const res = await fetch('/api/ready');
    const data = await res.json();
    isDatabaseWriteReady = (data.isWriteReady === true);

    if (isDatabaseWriteReady) {
      if (dbBadge) {
        dbBadge.className = 'header-info-badge badge-success';
        dbBadge.style.background = '#e6f4ea';
        dbBadge.style.color = '#137333';
      }
      if (dbText) dbText.textContent = 'Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª: Ù…ØªØµÙ„Ø© âœ…';
      if (dbBanner) dbBanner.style.display = 'none';
    } else {
      if (dbBadge) {
        dbBadge.className = 'header-info-badge badge-warning';
        dbBadge.style.background = '#fef7e0';
        dbBadge.style.color = '#b06000';
      }
      if (dbText) dbText.textContent = 'Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª: Ù‚Ø±Ø§Ø¡Ø© ÙÙ‚Ø· âš ï¸';
      if (dbBanner) dbBanner.style.display = 'flex';
    }
  } catch (e) {
    isDatabaseWriteReady = false;
    if (dbBadge) {
      dbBadge.className = 'header-info-badge badge-danger';
      dbBadge.style.background = '#fce8e6';
      dbBadge.style.color = '#c5221f';
    }
    if (dbText) dbText.textContent = 'Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª: ØºÙŠØ± Ù…ØªØµÙ„Ø© âŒ';
    if (dbBanner) dbBanner.style.display = 'flex';
  }
}

async function initApp() {
  updateDateTimeDisplay();
  setInterval(updateDateTimeDisplay, 60000);
  checkDatabaseStatus();
  setInterval(checkDatabaseStatus, 20000);

  // Ø§Ø³ØªØ±Ø¬Ø§Ø¹ Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ø£Ø®ÙŠØ± Ù…Ù† Ø§Ù„Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù…Ø­Ù„ÙŠØ© Ù„Ù„ØªØ³Ù‡ÙŠÙ„
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

  // ØªØ·Ø¨ÙŠÙ‚ Ø­Ø§Ù„Ø© Ø·ÙŠ Ø´Ø¨ÙƒØ© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø©
  applyStoredBrandCollapseStates();

  // Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„ØªÙ†Ù‚Ù„ Ø¨ÙŠÙ† Ø§Ù„ØªØ¨ÙˆÙŠØ¨Ø§Øª
  setupNavigation();

  // Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„Ø¨Ø­Ø« ÙÙŠ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ ÙˆØ§Ù„ÙÙˆØ§ØªÙŠØ±
  setupSearchListeners();

  // Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù…Ø±Ø¦ÙŠ Ø§Ù„Ø°ÙƒÙŠ Ø¹Ù† Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª
  setupLiveProductSearch();

  // ØªØ­Ø¯ÙŠØ« Ø´Ø±ÙŠØ· Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø¹Ø§Ø¦Ù…
  updateFloatingCartUI();

  // Ø¬Ù„Ø¨ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ù† Ø§Ù„Ø®Ø§Ø¯Ù…
  await loadSettings();
  await loadProducts();
  await loadInvoices();
  await loadReceipts();
  await loadCustomers();
  await loadDashboard();
}

// -------------------------------------------------------------
// Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„ØªØ¨ÙˆÙŠØ¨Ø§Øª ÙˆØ§Ù„ØªØ§Ø±ÙŠØ® Ù…Ø¹ Ø­Ù…Ø§ÙŠØ© Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª
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
    if (btn) btn.textContent = 'ðŸ‘ï¸';
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
    showToast('ØªÙ… Ø§Ù„ØªØ­Ù‚Ù‚ Ø¨Ù†Ø¬Ø§Ø­! Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨Ùƒ ÙÙŠ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ðŸ”“', 'success');
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
  showToast('ØªÙ… Ù‚ÙÙ„ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø¨Ù†Ø¬Ø§Ø­ ðŸ”’', 'info');
}

function toggleSettingsPasswordVisibility() {
  const input = document.getElementById('settingsPasswordInput');
  const btn = document.getElementById('btnToggleEye');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = 'ðŸ™ˆ';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = 'ðŸ‘ï¸';
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
  // ÙØ­Øµ ØµÙ„Ø§Ø­ÙŠØ§Øª Ø§Ù„ÙƒØ§Ø´ÙŠØ± ÙˆØ§Ù„Ù…ÙˆØ¸ÙÙŠÙ†
  if (window.currentUser && window.currentUser.role === 'cashier') {
    if (tabId === 'dashboard' || tabId === 'settings' || tabId === 'brands-audit') {
      showToast('Ø¹Ø°Ø±Ø§Ù‹ØŒ Ù‡Ø°Ø§ Ø§Ù„Ù‚Ø³Ù… Ù…ØªØ§Ø­ Ù„Ù„Ù…Ø¯ÙŠØ± Ø§Ù„Ø¹Ø§Ù… ÙÙ‚Ø· ðŸ”’', 'warning');
      return;
    }
  }
  // ÙØ­Øµ Ø­Ù…Ø§ÙŠØ© ØªØ¨ÙˆÙŠØ¨ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø¨ÙƒÙ„Ù…Ø© Ø§Ù„Ø³Ø± 99199
  if (tabId === 'settings' && !state.settingsUnlocked) {
    openSettingsPasswordModal();
    return;
  }
  actuallySwitchTab(tabId);
}

function actuallySwitchTab(tabId) {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try { window.navigator.vibrate(12); } catch (e) {}
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Ø¥Ù„ØºØ§Ø¡ ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø£Ø²Ø±Ø§Ø±
  document.querySelectorAll('.nav-tab-btn, .mob-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Ø¥Ø®ÙØ§Ø¡ ÙˆØ¥Ø¸Ù‡Ø§Ø± Ø§Ù„Ù…Ø­ØªÙˆÙ‰
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  // ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø­Ø³Ø¨ Ø§Ù„ØªØ¨ÙˆÙŠØ¨
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
    setInvoiceType(state.invoiceType || 'sales');
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
  } else if (tabId === 'settings') {
    loadBackupsList();
  } else if (tabId === 'brands-audit') {
    if (typeof runBrandAudit === 'function') {
      runBrandAudit();
    }
  } else if (tabId === 'warranties') {
    onWarrantiesTabActivated();
  }

  // Ø¥Ø¸Ù‡Ø§Ø± Ø£Ùˆ Ø¥Ø®ÙØ§Ø¡ Ø´Ø±ÙŠØ· Ø§Ù„Ø¬Ø±Ø¯ Ø§Ù„Ø¹Ø§Ø¦Ù…
  const floatingBar = document.getElementById('inventoryFloatingBar');
  if (floatingBar) {
    floatingBar.style.display = (tabId === 'inventory') ? 'flex' : 'none';
  }
}

// -------------------------------------------------------------
// Ø§Ù„ØªØ­ÙƒÙ… ÙÙŠ Ù‚Ø§Ø¦Ù…Ø© "Ø§Ù„Ù…Ø²ÙŠØ¯" Ø§Ù„Ø³ÙÙ„ÙŠØ© Ù„Ù„Ù‡ÙˆØ§ØªÙ (Mobile Bottom Sheet)
// -------------------------------------------------------------
function toggleMobileMoreSheet() {
  const backdrop = document.getElementById('mobMoreBackdrop');
  const sheet = document.getElementById('mobMoreSheet');
  if (!sheet) return;
  const isOpen = sheet.classList.contains('active');
  if (isOpen) {
    closeMobileMoreSheet();
  } else {
    sheet.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
  }
}

function closeMobileMoreSheet() {
  const backdrop = document.getElementById('mobMoreBackdrop');
  const sheet = document.getElementById('mobMoreSheet');
  if (sheet) sheet.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

function switchTabAndCloseMore(tabId) {
  closeMobileMoreSheet();
  switchTab(tabId);
}

function updateDateTimeDisplay() {
  const el = document.getElementById('currentDateDisplay');
  if (el) el.textContent = formatAppDateTime(new Date());
}

// -------------------------------------------------------------
// Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ÙˆØ§Ù„Ø±Ø¨Ø·
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
    console.error('ÙØ´Ù„ Ø¬Ù„Ø¨ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª:', err);
  }
}

function applySettingsToUI() {
  const { companyName, companyPhone, companyAddress, currency, telegramBotToken, telegramChatId, invoiceFooterText } = state.settings;

  // Ø±Ø£Ø³ Ø§Ù„ØµÙØ­Ø©
  const brandEl = document.getElementById('headerCompanyName');
  if (brandEl) brandEl.textContent = companyName;

  // Ø´Ø§Ø±Ø© ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
  const tgBadge = document.getElementById('telegramHeaderBadge');
  const tgText = document.getElementById('telegramStatusText');
  const tgBanner = document.getElementById('telegramAlertBanner');

  const isTgConfigured = !!(telegramBotToken && telegramChatId);

  if (isTgConfigured) {
    if (tgBadge) tgBadge.className = 'header-info-badge badge-telegram';
    if (tgText) tgText.textContent = 'ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…: Ù…ØªØµÙ„ ÙˆØ¬Ø§Ù‡Ø² ðŸš€';
    if (tgBanner) tgBanner.style.display = 'none';
  } else {
    if (tgBadge) tgBadge.className = 'header-info-badge badge-warning';
    if (tgText) tgText.textContent = 'ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…: ØºÙŠØ± Ù…Ù‡ÙŠØ£ âš ï¸';
    if (tgBanner) tgBanner.style.display = 'flex';
  }

  // Ø­Ù‚ÙˆÙ„ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª
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
  if (currSelect) currSelect.value = currency || 'Ø´ÙŠÙƒÙ„';
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
      showToast('ØªÙ… Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø¨Ù†Ø¬Ø§Ø­', 'success');
    } else {
      showToast(data.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø­ÙØ¸', 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…', 'error');
  }
}

async function testTelegramConnection() {
  const telegramBotToken = document.getElementById('cfgTelegramBotToken').value.trim();
  const telegramChatId = document.getElementById('cfgTelegramChatId').value.trim();
  const companyName = document.getElementById('cfgCompanyName').value.trim();

  if (!telegramBotToken || !telegramChatId) {
    showToast('ÙŠØ±Ø¬Ù‰ Ù…Ù„Ø¡ Ø±Ù…Ø² Ø§Ù„Ø¨ÙˆØª (Token) ÙˆÙ…Ø¹Ø±Ù Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© (Chat ID)', 'error');
    return;
  }

  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø± Ø¹Ø¨Ø± ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');

  try {
    const res = await fetch('/api/telegram/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken, telegramChatId, companyName })
    });
    const data = await res.json();
    if (data.success) {
      showToast('ðŸŽ‰ Ø±Ø§Ø¦Ø¹! ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø± Ù„Ù‡Ø§ØªÙÙƒ Ø¨Ù†Ø¬Ø§Ø­', 'success');
      // Ø­ÙØ¸ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¹Ù†Ø¯ Ù†Ø¬Ø§Ø­ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±
      saveCompanySettings();
    } else {
      showToast(`ÙØ´Ù„ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„ÙØ­Øµ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…', 'error');
  }
}

// -------------------------------------------------------------
// Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù†Ø³Ø® Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ ÙˆØ­Ù…Ø§ÙŠØ© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª (Backup & Restore)
// -------------------------------------------------------------

async function loadBackupsList() {
  const tableBody = document.getElementById('backupsTableBody');
  if (!tableBody) return;

  try {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1rem;">Ø¬Ø§Ø±ÙŠ Ø¬Ù„Ø¨ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù†Ø³Ø® Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©...</td></tr>';
    const res = await fetch('/api/backups');
    const data = await res.json();

    if (data.success && Array.isArray(data.backups) && data.backups.length > 0) {
      tableBody.innerHTML = data.backups.map((b, idx) => {
        const isAuto = b.isAuto || b.filename.includes('auto');
        const badge = isAuto 
          ? '<span class="badge" style="background: #e0f2fe; color: #0369a1;">ØªÙ„Ù‚Ø§Ø¦ÙŠ ðŸŒ™</span>'
          : '<span class="badge" style="background: #f1f5f9; color: #475569;">ÙŠØ¯ÙˆÙŠ ðŸ‘¤</span>';

        return `
          <tr>
            <td style="font-weight: 700;">${idx + 1}</td>
            <td>
              <div style="font-family: monospace; font-size: 0.85rem; font-weight: 600; direction: ltr; text-align: right;">${escapeHtml(b.filename)}</div>
            </td>
            <td>${formatAppDateTime(b.createdAt)}</td>
            <td><span class="badge badge-primary">${b.sizeFormatted || (b.sizeBytes + ' B')}</span></td>
            <td>${badge}</td>
            <td style="text-align: center;">
              <a href="/api/backups/download/${encodeURIComponent(b.filename)}" class="btn btn-sm btn-secondary" title="ØªØ­Ù…ÙŠÙ„ Ù…Ù„Ù Ø§Ù„Ù†Ø³Ø®Ø©" download>
                <span>ðŸ“¥</span>
                <span>ØªØ­Ù…ÙŠÙ„</span>
              </a>
              <button class="btn btn-sm btn-warning" onclick="restoreFromExistingBackup('${escapeHtml(b.filename)}')" title="Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ù‡Ø°Ù‡ Ø§Ù„Ù†Ø³Ø®Ø©" style="margin-right: 4px;">
                <span>â†©ï¸</span>
                <span>Ø§Ø³ØªØ±Ø¬Ø§Ø¹</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†Ø³Ø® Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ù…Ø­ÙÙˆØ¸Ø© Ø­Ø§Ù„ÙŠØ§Ù‹ Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø§Ø¯Ù…. Ø§Ø¶ØºØ· "Ø¥Ù†Ø´Ø§Ø¡ Ù†Ø³Ø®Ø© Ø¬Ø¯ÙŠØ¯Ø©" Ù„Ù„Ø¨Ø¯Ø¡.</td></tr>';
    }
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 1rem;">ØªØ¹Ø°Ø± Ø¬Ù„Ø¨ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù†Ø³Ø® Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©</td></tr>';
  }
}

async function createAndDownloadBackup() {
  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø§Ù„Ø´Ø§Ù…Ù„Ø©...', 'info');
  try {
    const res = await fetch('/api/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'manual_download' })
    });
    const data = await res.json();
    if (data.success && data.backup) {
      showToast('âœ… ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù†Ø³Ø®Ø© Ø¨Ù†Ø¬Ø§Ø­! Ø¬Ø§Ø±ÙŠ Ø¨Ø¯Ø¡ Ø§Ù„ØªØ­Ù…ÙŠÙ„...', 'success');
      const downloadUrl = `/api/backups/download/${encodeURIComponent(data.backup.filename)}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = data.backup.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      loadBackupsList();
    } else {
      showToast(data.error || 'ÙØ´Ù„ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©', 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©', 'error');
  }
}

async function sendBackupToTelegramNow() {
  const settings = state.settings || {};
  if (!settings.telegramBotToken || !settings.telegramChatId) {
    showToast('ÙŠØ±Ø¬Ù‰ Ø¶Ø¨Ø· Ù…Ø¹Ø±Ù ÙˆØ±Ù…Ø² Ø¨ÙˆØª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø£ÙˆÙ„Ø§Ù‹ Ù„Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©', 'error');
    return;
  }

  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù†Ø³Ø®Ø© ÙˆØ¥Ø±Ø³Ø§Ù„Ù‡Ø§ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');
  try {
    const res = await fetch('/api/backups/send-telegram', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø¨Ù†Ø¬Ø§Ø­ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…!', 'success');
      loadBackupsList();
    } else {
      showToast(`ÙØ´Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©', 'error');
  }
}

async function handleRestoreFileInput(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.json')) {
    showToast('ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ù…Ù„Ù Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© ØµØ§Ù„Ø­ Ø¨ØµÙŠØºØ© JSON (.json)', 'error');
    event.target.value = '';
    return;
  }

  showConfirmDialog({
    title: 'âš ï¸ ØªØ£ÙƒÙŠØ¯ Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©',
    message: `Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø±ØºØ¨ØªÙƒ ÙÙŠ Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ù† Ø§Ù„Ù…Ù„Ù "${file.name}"ØŸ Ø³ÙŠØªÙ… Ø§Ø³ØªØ¨Ø¯Ø§Ù„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø§Ù„ÙŠØ© (Ù…Ø¹ Ø­ÙØ¸ Ù†Ø³Ø®Ø© Ø£Ù…Ø§Ù† ØªÙ„Ù‚Ø§Ø¦ÙŠØ© Ù‚Ø¨Ù„ Ø§Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø©).`,
    confirmText: 'Ù†Ø¹Ù…ØŒ Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¢Ù†',
    cancelText: 'Ø¥Ù„ØºØ§Ø¡',
    isDanger: true,
    onConfirm: async () => {
      showToast('Ø¬Ø§Ø±ÙŠ Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø³Ù„Ø§Ù…Ø© Ø§Ù„Ù…Ù„Ù...', 'info');
      try {
        const formData = new FormData();
        formData.append('backupFile', file);

        const res = await fetch('/api/backups/restore', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          showToast(`ðŸŽ‰ ØªÙ… Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ù†Ø¬Ø§Ø­! (${data.counts.products} ØµÙ†ÙØŒ ${data.counts.invoices} ÙØ§ØªÙˆØ±Ø©ØŒ ${data.counts.customers} Ø²Ø¨ÙˆÙ†)`, 'success');
          await Promise.all([loadProducts(), loadInvoices(), loadCustomers(), loadReceipts(), loadDashboardStats()]);
          loadBackupsList();
        } else {
          showToast(data.error || 'ÙØ´Ù„Øª Ø¹Ù…Ù„ÙŠØ© Ø§Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø©', 'error');
        }
      } catch (err) {
        showToast('ØªØ¹Ø°Ø± Ø±ÙØ¹ Ù…Ù„Ù Ø§Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø¥Ù„Ù‰ Ø§Ù„Ø®Ø§Ø¯Ù…', 'error');
      } finally {
        event.target.value = '';
      }
    }
  });
}

function restoreFromExistingBackup(filename) {
  showConfirmDialog({
    title: 'âš ï¸ Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø³Ø§Ø¨Ù‚Ø©',
    message: `Ù‡Ù„ ØªØ±ÙŠØ¯ Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø³Ø¬Ù„Ø© ÙÙŠ Ù…Ù„Ù "${filename}"ØŸ Ø³ÙŠØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ§Ù„ÙÙˆØ§ØªÙŠØ± ÙˆØ§Ù„Ø²Ø¨Ø§Ø¦Ù†ØŒ Ù…Ø¹ Ø§Ù„Ø§Ø­ØªÙØ§Ø¸ Ø¨Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø§Ø­ØªØ±Ø§Ø²ÙŠØ©.`,
    confirmText: 'Ø§Ø³ØªØ±Ø¬Ø§Ø¹ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø¢Ù†',
    cancelText: 'Ø¥Ù„ØºØ§Ø¡',
    isDanger: true,
    onConfirm: async () => {
      showToast('Ø¬Ø§Ø±ÙŠ Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ù†Ø³Ø®Ø©...', 'info');
      try {
        const res = await fetch('/api/backups/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.success) {
          showToast('ðŸŽ‰ ØªÙ… Ø§Ø³ØªØ±Ø¬Ø§Ø¹ Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø¨Ù†Ø¬Ø§Ø­!', 'success');
          await Promise.all([loadProducts(), loadInvoices(), loadCustomers(), loadReceipts(), loadDashboardStats()]);
          loadBackupsList();
        } else {
          showToast(data.error || 'ÙØ´Ù„Øª Ø§Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø©', 'error');
        }
      } catch (e) {
        showToast('ØªØ¹Ø°Ø± Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠØ©', 'error');
      }
    }
  });
}

// -------------------------------------------------------------
// Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ§Ù„ÙƒØªØ§Ù„ÙˆØ¬
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
      populateSystemBrandsDatalist();
    }
  } catch (err) {
    console.error('ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª:', err);
  }
}

// -------------------------------------------------------------
// Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù… ÙˆØªÙˆÙÙŠØ±Ù‡Ø§ ÙÙˆØ±Ø§Ù‹ ÙÙŠ Ø§Ù„Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ø°ÙƒÙŠØ©
// -------------------------------------------------------------
function populateSystemBrandsDatalist() {
  const datalist = document.getElementById('systemBrandsList');
  if (!datalist) return;

  const brandsSet = new Set();

  if (Array.isArray(POPULAR_BRANDS)) {
    POPULAR_BRANDS.forEach(b => { if (b && b !== 'all') brandsSet.add(b); });
  }

  if (typeof BRAND_DETECT_RULES !== 'undefined' && Array.isArray(BRAND_DETECT_RULES)) {
    BRAND_DETECT_RULES.forEach(r => {
      if (r.brand && r.brand !== 'Ø£Ø®Ø±Ù‰') brandsSet.add(r.brand);
      if (r.brandAr && r.brandAr !== 'Ø£Ø®Ø±Ù‰ / Ø¹Ø§Ù…') brandsSet.add(r.brandAr);
    });
  }

  if (Array.isArray(state.products)) {
    state.products.forEach(p => {
      if (p.brand && p.brand !== 'Ø£Ø®Ø±Ù‰') brandsSet.add(p.brand);
      if (p.brandAr && p.brandAr !== 'Ø£Ø®Ø±Ù‰ / Ø¹Ø§Ù…') brandsSet.add(p.brandAr);
    });
  }

  const sorted = Array.from(brandsSet).sort((a, b) => a.localeCompare(b, 'ar'));
  datalist.innerHTML = sorted.map(b => `<option value="${escapeHtml(b)}"></option>`).join('');
}

// -------------------------------------------------------------
// Ø§Ù„Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø³Ø±ÙŠØ¹ Ù„ØµÙ†Ù ÙˆÙ…Ø§Ø±ÙƒØ© Ø¬Ø¯ÙŠØ¯Ø© Ø¯Ø§Ø®Ù„ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆØ§Ù„Ù…Ø®Ø²Ù†
// -------------------------------------------------------------
function handleQnpNameInput(value) {
  const brandInput = document.getElementById('qnpBrand');
  if (brandInput && !brandInput.value.trim() && typeof detectBrandFromName === 'function') {
    const detected = detectBrandFromName(value);
    if (detected) {
      brandInput.value = detected.brand;
    }
  }
}

function handleQnpCostInput(value) {
  const cost = parseFloat(value);
  const sellInput = document.getElementById('qnpSell');
  if (!isNaN(cost) && cost > 0 && sellInput && (!sellInput.value || sellInput.dataset.autoFilled)) {
    sellInput.value = Math.round(cost * 1.15);
    sellInput.dataset.autoFilled = 'true';
  }
}

async function submitQuickNewProductForInvoice() {
  const nameInput = document.getElementById('qnpName');
  const brandInput = document.getElementById('qnpBrand');
  const costInput = document.getElementById('qnpCost');
  const sellInput = document.getElementById('qnpSell');
  const qtyInput = document.getElementById('qnpQty');

  if (!nameInput || !brandInput || !costInput) return;

  const name = nameInput.value.trim();
  const brand = brandInput.value.trim() || 'Ø£Ø®Ø±Ù‰';
  const costPrice = parseFloat(costInput.value);
  let sellPrice = parseFloat(sellInput?.value);
  const qty = parseInt(qtyInput?.value) || 1;

  if (!name) {
    showToast('ÙŠØ±Ø¬Ù‰ ÙƒØªØ§Ø¨Ø© Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù Ø§Ù„Ø¬Ø¯ÙŠØ¯', 'error');
    nameInput.focus();
    return;
  }

  if (isNaN(costPrice) || costPrice < 0) {
    showToast('ÙŠØ±Ø¬Ù‰ ØªØ­Ø¯ÙŠØ¯ Ø³Ø¹Ø± Ø§Ù„ØªÙƒÙ„ÙØ© (Ø§Ù„Ø´Ø±Ø§Ø¡)', 'error');
    costInput.focus();
    return;
  }

  if (isNaN(sellPrice) || sellPrice <= 0) {
    sellPrice = costPrice > 0 ? Math.round(costPrice * 1.15) : 0;
  }

  const btn = document.getElementById('btnSubmitQuickProduct');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>â³</span> <span>Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸...</span>';
  }

  try {
    const code = 'PRD-' + Math.floor(1000 + Math.random() * 9000);
    const isPurchase = state.invoiceType === 'purchase';

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        name,
        brand,
        brandAr: brand,
        category: isPurchase ? 'Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØªÙˆØ±ÙŠØ¯' : 'Ø£Ø¬Ù‡Ø²Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© ÙˆØ£Ø¯ÙˆØ§Øª',
        costPrice,
        sellPrice,
        stock: isPurchase ? 0 : qty, // ÙÙŠ Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª ÙŠØ²ÙŠØ¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¹Ù†Ø¯ Ø­ÙØ¸ Ø§Ù„ÙØ§ØªÙˆØ±Ø©
        image: '',
        description: `ØµÙ†Ù Ù…Ø¶Ø§Ù Ø³Ø±ÙŠØ¹Ø§Ù‹ - Ù…Ø§Ø±ÙƒØ©: ${brand}`
      })
    });

    const data = await res.json();
    if (data.success && data.product) {
      const newProd = data.product;

      // 1. ØªØ­Ø¯ÙŠØ« Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ´Ø¨ÙƒØ§Øª Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª ÙÙˆØ±Ø§Ù‹
      await loadProducts();

      // 2. Ø¥Ø¯Ø±Ø§Ø¬ Ø§Ù„ØµÙ†Ù Ù…Ø¨Ø§Ø´Ø±Ø© ÙÙŠ Ø³Ù„Ø© Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ©
      const existing = state.cart.find(i => i.productId === newProd.id);
      if (existing) {
        existing.quantity += qty;
      } else {
        state.cart.push({
          productId: newProd.id,
          productName: newProd.name,
          productImage: newProd.image || '',
          costPrice: parseFloat(newProd.costPrice) || 0,
          sellPrice: parseFloat(newProd.sellPrice) || 0,
          quantity: qty
        });
      }

      updateCartUI();
      updateFloatingCartUI();

      // 3. Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø§Ù„Ø­Ù‚ÙˆÙ„ ÙˆØ¥Ø¨Ù‚Ø§Ø¡ Ø§Ù„ØªØ±ÙƒÙŠØ² Ù„Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„ØµÙ†Ù Ø§Ù„ØªØ§Ù„ÙŠ Ù…Ø¨Ø§Ø´Ø±Ø©
      nameInput.value = '';
      costInput.value = '';
      if (sellInput) {
        sellInput.value = '';
        delete sellInput.dataset.autoFilled;
      }
      if (qtyInput) qtyInput.value = '1';

      showToast(`ØªÙ… Ø­ÙØ¸ "${newProd.name}" (Ù…Ø§Ø±ÙƒØ© ${brand}) ÙˆØ¥Ø¶Ø§ÙØªÙ‡ Ù„Ù„ÙØ§ØªÙˆØ±Ø©!`, 'success');
      nameInput.focus();
    } else {
      showToast(data.error || 'ÙØ´Ù„ Ø­ÙØ¸ Ø§Ù„ØµÙ†Ù Ø§Ù„Ø¬Ø¯ÙŠØ¯', 'error');
    }
  } catch (err) {
    console.error('Error adding quick product:', err);
    showToast('Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø­ÙØ¸ Ø§Ù„ØµÙ†Ù', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>âž•</span> <span>Ø¥Ø¶Ø§ÙØ© ÙˆØ­ÙØ¸ (Enter)</span>';
    }
  }
}

// -------------------------------------------------------------
// Ø§Ù„Ø£ÙŠÙ‚ÙˆÙ†Ø§Øª Ø§Ù„Ù…Ù…ÙŠØ²Ø© Ù„Ù„Ù…Ø§Ø±ÙƒØ§Øª
// -------------------------------------------------------------
// -------------------------------------------------------------
// Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø§Ù„Ø£ÙƒØ«Ø± Ø·Ù„Ø¨Ø§Ù‹ ÙˆØ´Ù‡Ø±Ø© Ù„Ù„ÙˆØµÙˆÙ„ Ø§Ù„ÙÙˆØ±ÙŠ
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

// Ø§Ù„Ø£ÙŠÙ‚ÙˆÙ†Ø§Øª Ø§Ù„Ù…Ù…ÙŠØ²Ø© ÙˆØ§Ù„ØªØ³Ù…ÙŠØ§Øª Ø§Ù„Ù…Ø¹ØªÙ…Ø¯Ø© Ù„Ù„Ù…Ø§Ø±ÙƒØ§Øª
const BRAND_ICONS = {
  'LG': { icon: 'ðŸ”´', color: '#c41230', displayAr: 'Ø§Ù„ Ø¬ÙŠ (LG)' },
  'Samsung': { icon: 'ðŸ”·', color: '#1428a0', displayAr: 'Ø³Ø§Ù…Ø³ÙˆÙ†Ø¬' },
  'Beko': { icon: 'ðŸ”µ', color: '#0055a5', displayAr: 'Ø¨ÙŠÙƒÙˆ' },
  'Universal': { icon: 'â­', color: '#0284c7', displayAr: 'ÙŠÙˆÙ†ÙŠÙØ±Ø³Ø§Ù„' },
  'Haier': { icon: 'ðŸŒ€', color: '#0066b2', displayAr: 'Ù‡Ø§ÙŠØ±' },
  'Midea': { icon: 'â„ï¸', color: '#008ad2', displayAr: 'Ù…ÙŠØ¯ÙŠØ§' },
  'Sharp': { icon: 'âš¡', color: '#e60012', displayAr: 'Ø´Ø§Ø±Ø¨' },
  'TCL': { icon: 'ðŸ“º', color: '#e50012', displayAr: 'ØªÙŠ Ø³ÙŠ Ø§Ù„' },
  'Crest': { icon: 'ðŸ‘‘', color: '#d97706', displayAr: 'ÙƒØ±ÙŠØ³Øª' },
  'Trust': { icon: 'ðŸ›¡ï¸', color: '#4f46e5', displayAr: 'ØªØ±Ø³Øª' },
  'Lawrence': { icon: 'ðŸ“»', color: '#7c3aed', displayAr: 'Ù„ÙˆØ±Ù†Ø³' },
  'Atlantic': { icon: 'ðŸŒŠ', color: '#0891b2', displayAr: 'Ø§ØªÙ„Ø§Ù†ØªÙŠÙƒ' },
  'Samex': { icon: 'ðŸ”¥', color: '#ea580c', displayAr: 'Ø³Ø§Ù…ÙƒØ³' },
  'Molar': { icon: 'ðŸ§Š', color: '#059669', displayAr: 'Ù…ÙˆÙ„Ø§Ø±' },
  'General Lux': { icon: 'âœ¨', color: '#b45309', displayAr: 'Ø¬Ù†Ø±Ø§Ù„ Ù„ÙˆÙƒØ³' },
  'General Queen': { icon: 'ðŸ‘‘', color: '#ca8a04', displayAr: 'Ø¬Ù†Ø±Ø§Ù„ ÙƒÙˆÙŠÙ†' },
  'Bompani': { icon: 'ðŸ³', color: '#dc2626', displayAr: 'Ø¨ÙˆÙ…Ø¨Ø§Ù†ÙŠ' },
  'Simfer': { icon: 'ðŸ²', color: '#b91c1c', displayAr: 'Ø³ÙŠÙ…ÙÙŠØ± / Ø³Ù…ÙÙŠØ±' },
  'Manger Home': { icon: 'ðŸ ', color: '#475569', displayAr: 'Ù…Ù†Ø¬Ø± Ù‡ÙˆÙ… / Ù…Ø§Ù†Ø¬Ø±' },
  'Luxor': { icon: 'ðŸ’¡', color: '#f59e0b', displayAr: 'Ù„ÙˆÙƒØ³Ø±' },
  'Zacash': { icon: 'ðŸ¹', color: '#10b981', displayAr: 'Ø²ÙƒØ´ / Ø²Ø§ÙƒØ§Ø´' },
  'Candy': { icon: 'ðŸ¬', color: '#ec4899', displayAr: 'ÙƒØ§Ù†Ø¯ÙŠ' },
  'Tefal': { icon: 'ðŸ³', color: '#e11d48', displayAr: 'ØªÙŠÙØ§Ù„' },
  'Matrix': { icon: 'ðŸ–¥ï¸', color: '#6366f1', displayAr: 'Ù…Ø§ØªØ±ÙƒØ³' },
  'Prestige': { icon: 'ðŸ†', color: '#8b5cf6', displayAr: 'Ø¨Ø±Ø³ØªÙŠØ¬' },
  'KMG': { icon: 'ðŸ§Š', color: '#0284c7', displayAr: 'ÙƒÙŠ Ø§Ù… Ø¬ÙŠ' },
  'ADC': { icon: 'ðŸ”Œ', color: '#64748b', displayAr: 'ADC' },
  'iPlug': { icon: 'ðŸ”Œ', color: '#06b6d4', displayAr: 'Ø§ÙŠØ¨Ù„ÙˆØ¬' },
  'Dahua': { icon: 'ðŸ“¹', color: '#0ea5e9', displayAr: 'Ø¯Ù‡ÙˆØ§' },
  'Hisense': { icon: 'ðŸ“º', color: '#0d9488', displayAr: 'Ù‡Ø§ÙŠØ³Ù†Ø³' },
  'RAF': { icon: 'âš¡', color: '#ea580c', displayAr: 'Ø±Ø§Ù (RAF)' },
  'Mega': { icon: 'âš¡', color: '#0284c7', displayAr: 'Ù…ÙŠØ¬Ø§' },
  'Yafa': { icon: 'ðŸŠ', color: '#ea580c', displayAr: 'ÙŠØ§ÙØ§' },
  'Magic': { icon: 'ðŸª„', color: '#9333ea', displayAr: 'Ù…Ø§Ø¬ÙŠÙƒ' },
  'Vision': { icon: 'ðŸ‘ï¸', color: '#0d9488', displayAr: 'ÙÙŠØ¬ÙŠÙ†' },
  'Moulinex': { icon: 'ðŸ¥£', color: '#dc2626', displayAr: 'Ù…ÙˆÙ„ÙŠÙ†ÙƒØ³' },
  'Jennar': { icon: 'ðŸ”¥', color: '#b91c1c', displayAr: 'Ø¬ÙŠÙ†Ø§Ø±' },
  'Tiger': { icon: 'ðŸ…', color: '#d97706', displayAr: 'ØªØ§ÙŠØ¬Ø±' },
  'Infinity': { icon: 'â™¾ï¸', color: '#7c3aed', displayAr: 'Ø§Ù†ÙÙŠÙ†ÙŠØªÙŠ' },
  'Ariston': { icon: 'ðŸ”¥', color: '#e11d48', displayAr: 'Ø§Ø±ÙŠØ³ØªÙˆÙ†' },
  'Konica': { icon: 'â„ï¸', color: '#2563eb', displayAr: 'ÙƒÙˆÙ†ÙŠÙƒØ§' },
  'Cravit': { icon: 'ðŸ§Š', color: '#0891b2', displayAr: 'ÙƒØ±Ø§ÙÙŠØª' },
  'BaByliss': { icon: 'ðŸ’‡', color: '#ec4899', displayAr: 'Ø¨ÙŠØ¨ÙŠ Ù„ÙŠØ³' },
  'Philips': { icon: 'ðŸ’¡', color: '#1d4ed8', displayAr: 'ÙÙŠÙ„ÙŠØ¨Ø³' }
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
    if (iconEl) iconEl.textContent = 'â‡„';
    if (textEl) textEl.textContent = 'Ø¹Ø±Ø¶ ÙƒØ´Ø±ÙŠØ· Ø£ÙÙ‚ÙŠ';
  } else {
    displayArea.classList.remove('grid-mode');
    displayArea.classList.add('ribbon-mode');
    if (iconEl) iconEl.textContent = 'âŠž';
    if (textEl) textEl.textContent = 'Ø¹Ø±Ø¶ ÙƒØ´Ø¨ÙƒØ© ÙƒØ§Ù…Ù„Ø©';
  }
}

// -------------------------------------------------------------
// Ø²Ø± Ø·ÙŠ ÙˆØ¥Ø®ÙØ§Ø¡ Ø´Ø¨ÙƒØ© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø§Ù„Ø°ÙƒÙŠ (Ù„ØªÙˆÙÙŠØ± Ø§Ù„Ù…Ø³Ø§Ø­Ø©)
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
      if (icon) icon.textContent = 'ðŸ”½';
      if (text) text.textContent = 'Ø¥Ø¸Ù‡Ø§Ø± Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª';
      btnEl.title = 'Ø¥Ø¸Ù‡Ø§Ø± Ø´Ø¨ÙƒØ© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ù„ØªØµÙØ­Ù‡Ø§ ÙˆØ§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù…Ø§Ø±ÙƒØ©';
    }
    localStorage.setItem(`${context}_brands_collapsed`, 'true');
    showToast('ØªÙ… Ø·ÙŠ Ø´Ø¨ÙƒØ© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ù„ØªÙˆÙÙŠØ± Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø§Ø´Ø©', 'info');
  } else {
    gridEl.classList.remove('collapsed');
    if (noticeEl) noticeEl.style.display = 'none';
    if (btnEl) {
      btnEl.classList.remove('collapsed-state');
      const icon = btnEl.querySelector('.toggle-icon');
      const text = btnEl.querySelector('.toggle-text');
      if (icon) icon.textContent = 'ðŸ”¼';
      if (text) text.textContent = 'Ø¥Ø®ÙØ§Ø¡ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª';
      btnEl.title = 'Ø¥Ø®ÙØ§Ø¡ Ø´Ø¨ÙƒØ© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ù„ØªÙˆÙÙŠØ± Ù…Ø³Ø§Ø­Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø§Ø´Ø©';
    }
    localStorage.removeItem(`${context}_brands_collapsed`);
  }
}

function applyStoredBrandCollapseStates() {
  // Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª ØªØ¸Ù‡Ø± Ø¯Ø§Ø¦Ù…Ø§Ù‹ Ù…ÙØªÙˆØ­Ø© ÙˆÙ…Ø¨Ø§Ø´Ø±Ø© Ø¹Ù†Ø¯ ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙØ­Ø©
  try {
    localStorage.removeItem('catalog_brands_collapsed');
    localStorage.removeItem('inventory_brands_collapsed');
  } catch (e) {}

  ['catalog', 'inventory'].forEach(ctx => {
    const isCat = ctx === 'catalog';
    const gridEl = document.getElementById(isCat ? 'catalogBrandsGrid' : 'inventoryBrandsGrid');
    const btnEl = document.getElementById(isCat ? 'btnToggleCatalogBrands' : 'btnToggleInventoryBrands');
    const noticeEl = document.getElementById(isCat ? 'catalogBrandsCollapsedNotice' : 'inventoryBrandsCollapsedNotice');
    if (gridEl) gridEl.classList.remove('collapsed');
    if (noticeEl) noticeEl.style.display = 'none';
    if (btnEl) {
      btnEl.classList.remove('collapsed-state');
      const icon = btnEl.querySelector('.toggle-icon');
      const text = btnEl.querySelector('.toggle-text');
      if (icon) icon.textContent = 'ðŸ”¼';
      if (text) text.textContent = 'Ø¥Ø®ÙØ§Ø¡ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª';
    }
  });
}

// -------------------------------------------------------------
// Ø¥Ø¯Ø§Ø±Ø© ÙˆØªÙˆØ«ÙŠÙ‚ Ø§Ø³Ù… Ø§Ù„Ù‚Ø§Ø¦Ù… Ø¹Ù„Ù‰ Ø¹Ù…Ù„ÙŠØ© Ø§Ù„Ø¬Ø±Ø¯
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
    showToast('âš ï¸ ÙŠØ±Ø¬Ù‰ ÙƒØªØ§Ø¨Ø© Ø§Ø³Ù… Ø§Ù„Ù‚Ø§Ø¦Ù… Ø¨Ø§Ù„Ø¬Ø±Ø¯ Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©', 'error');
    if (input) input.focus();
    return;
  }
  syncAuditEmployeeName(name);
  closeAuditEmployeeModal();
  saveInventoryBulkChanges();
}

// -------------------------------------------------------------
// Ø¥Ø¯Ø§Ø±Ø© Ø´Ø¨ÙƒØ© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø§Ù„ØµØºÙŠØ±Ø© Ø§Ù„Ø°ÙƒÙŠØ© (Compact Small Brands Grid)
// -------------------------------------------------------------
function renderBrandsRibbon(context, searchTerm = '') {
  const isCatalog = context === 'catalog';
  const gridEl = document.getElementById(isCatalog ? 'catalogBrandsGrid' : 'inventoryBrandsGrid') ||
                 document.getElementById(isCatalog ? 'catalogBrandsRibbon' : 'inventoryBrandsRibbon');
  if (!gridEl) return;

  const currentActive = isCatalog ? state.activeBrand : state.inventoryBrand;
  const term = (searchTerm || '').trim();

  // Ø¬Ù…Ø¹ Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø¨Ø¯Ù‚Ø©
  const brandCounts = {};
  state.products.forEach(p => {
    const b = p.brand || 'Ø£Ø®Ø±Ù‰';
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  });

  const totalAll = state.products.length;

  // ØªØ±ØªÙŠØ¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø¨Ø­Ø³Ø¨ Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù
  let sortedBrands = Object.entries(brandCounts)
    .filter(([b]) => b !== 'Ø£Ø®Ø±Ù‰')
    .sort((a, b) => b[1] - a[1]);

  if (brandCounts['Ø£Ø®Ø±Ù‰']) {
    sortedBrands.push(['Ø£Ø®Ø±Ù‰', brandCounts['Ø£Ø®Ø±Ù‰']]);
  }

  // ØªØ­Ø¯ÙŠØ« Ø´Ø§Ø±Ø© Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª
  const countBadge = document.getElementById(isCatalog ? 'catalogBrandsTotalCountBadge' : 'inventoryBrandsTotalCountBadge');
  if (countBadge) {
    countBadge.textContent = `(${sortedBrands.length} Ù…Ø§Ø±ÙƒØ©)`;
  }

  // ØªØ­Ø¯ÙŠØ« Ø²Ø± "ÙƒÙ„ Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª"
  const allBrandsBtn = document.getElementById(isCatalog ? 'btnCatalogAllBrands' : 'btnInventoryAllBrands');
  if (allBrandsBtn) {
    allBrandsBtn.classList.toggle('active', currentActive === 'all');
  }

  // ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„ÙÙˆØ±ÙŠ Ø¥Ù† ÙˆÙØ¬Ø¯
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

  // Ø¨Ù†Ø§Ø¡ Ø´Ø¨ÙƒØ© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª Ø§Ù„ØµØºÙŠØ±Ø© Ø§Ù„Ø­Ø¬Ù… Ù„Ø³Ù‡ÙˆÙ„Ø© Ø§Ù„ÙˆØµÙˆÙ„ Ø§Ù„Ù…Ø¨Ø§Ø´Ø±
  let html = '';

  if (sortedBrands.length === 0) {
    html = `
      <div class="brand-no-results" style="padding: 0.6rem 1rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;">
        <span>ðŸ” Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ø§Ø±ÙƒØ© Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ù€ "${escapeHtml(term)}"</span>
        <button type="button" class="btn btn-xs btn-secondary" onclick="clearBrandSearchInput('${context}')">Ù…Ø³Ø­ Ø§Ù„Ø¨Ø­Ø«</button>
      </div>
    `;
  } else {
    sortedBrands.forEach(([brandName, count]) => {
      const sample = state.products.find(p => p.brand === brandName);
      const meta = BRAND_ICONS[brandName] || { icon: 'ðŸ·ï¸' };
      const isActive = currentActive === brandName;

      html += `
        <div class="brand-mini-chip ${isActive ? 'active' : ''}" onclick="selectBrandFilter('${context}', '${escapeHtml(brandName)}')" title="${escapeHtml(brandName)} (${count} ØµÙ†Ù)">
          <span class="chip-icon">${meta.icon}</span>
          <span class="chip-name">${escapeHtml(brandName)}</span>
          <span class="chip-count">${count}</span>
        </div>
      `;
    });
  }

  gridEl.innerHTML = html;

  // ØªØ­Ø¯ÙŠØ« Ø´Ø±ÙŠØ· Ø­Ø§Ù„Ø© Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù…Ø­Ø¯Ø¯Ø© (Brand Lock Banner)
  const hintEl = document.getElementById(isCatalog ? 'catalogBrandActiveHint' : 'invBrandActiveHint');
  const nameEl = document.getElementById(isCatalog ? 'catalogBrandActiveName' : 'invBrandActiveName');
  const countEl = document.getElementById(isCatalog ? 'catalogBrandActiveCount' : 'invBrandActiveCount');

  if (hintEl && nameEl) {
    if (currentActive && currentActive !== 'all') {
      const sample = state.products.find(p => p.brand === currentActive);
      const meta = BRAND_ICONS[currentActive];
      const title = meta && meta.displayAr ? `${currentActive} (${meta.displayAr})` : (sample && sample.brandAr ? `${sample.brand} (${sample.brandAr})` : currentActive);
      const brandItemCount = state.products.filter(p => (p.brand || 'Ø£Ø®Ø±Ù‰') === currentActive).length;

      hintEl.style.display = 'flex';
      nameEl.textContent = title;
      if (countEl) countEl.textContent = `${brandItemCount.toLocaleString('en-US')} ØµÙ†Ù`;
    } else {
      hintEl.style.display = 'none';
    }
  }
}

function selectBrandFilter(context, brandName) {
  if (context === 'catalog') {
    state.activeBrand = brandName;
    state.catalogCurrentPage = 1;
    // Ø¹Ù†Ø¯ Ø§Ø®ØªÙŠØ§Ø± Ù…Ø§Ø±ÙƒØ© Ù…Ø­Ø¯Ø¯Ø©ØŒ Ù†ØµÙØ± Ø£ÙŠ ÙÙ„Ø§ØªØ± ØªØµÙ†ÙŠÙØ§Øª ÙƒØ§Ù†Øª Ù†Ø´Ø·Ø© Ù„ÙƒÙŠ ØªØ¸Ù‡Ø± Ø¬Ù…ÙŠØ¹ Ø£ØµÙ†Ø§Ù Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø§Ø±ÙƒØ©
    state.activeMainCategory = 'all';
    state.activeCategory = 'all';
    renderHierarchicalCategories();

    // ØªØ­Ø¯ÙŠØ« placeholder Ø­Ù‚Ù„ Ø§Ù„Ø¨Ø­Ø« Ù„ÙŠÙˆØ¶Ø­ Ù„Ù„Ù…ÙˆØ¸Ù Ø£Ù†Ù‡ ÙŠØ¨Ø­Ø« Ø¯Ø§Ø®Ù„ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø­ØµØ±Ø§Ù‹
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) {
      if (brandName !== 'all') {
        const meta = BRAND_ICONS[brandName];
        const sample = state.products.find(p => p.brand === brandName);
        const title = meta && meta.displayAr ? `${brandName} (${meta.displayAr})` : (sample && sample.brandAr ? `${sample.brand} (${sample.brandAr})` : brandName);
        searchInput.placeholder = `ðŸ” Ø§Ø¨Ø­Ø« Ø¯Ø§Ø®Ù„ Ù…Ù†ØªØ¬Ø§Øª ${title} ÙÙ‚Ø· (Ù…Ø«Ø§Ù„: ØºØ³Ø§Ù„Ø©ØŒ ÙØ±Ù†ØŒ 50 Ø¨ÙˆØµØ©)...`;
      } else {
        searchInput.placeholder = 'Ø§Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ØŒ Ø§Ù„Ù…ÙˆØ¯ÙŠÙ„ØŒ Ø£Ùˆ Ø§Ù„ÙƒÙˆØ¯ Ù…Ø¹ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù…Ø®ØªØ§Ø±Ø©...';
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
        invSearchInput.placeholder = `ðŸ” Ø§Ø¨Ø­Ø« Ø¯Ø§Ø®Ù„ Ù…Ø®Ø²ÙˆÙ† ${title} ÙÙ‚Ø·...`;
      } else {
        invSearchInput.placeholder = 'Ø§Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„ØµÙ†ÙØŒ Ø§Ù„Ù…ÙˆØ¯ÙŠÙ„ØŒ Ø§Ù„Ù…Ø§Ø±ÙƒØ©ØŒ Ø£Ùˆ Ø§Ù„ÙƒÙˆØ¯...';
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

// Ø§Ù„Ø£ÙŠÙ‚ÙˆÙ†Ø§Øª ÙˆØ§Ù„Ø£Ù„ÙˆØ§Ù† Ù„ÙƒÙ„ ØªØµÙ†ÙŠÙ Ø±Ø¦ÙŠØ³ÙŠ
const MAIN_CATEGORY_META = {
  'all': { icon: 'ðŸ›ï¸', color: '#6366f1', label: 'Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£ØµÙ†Ø§Ù' },
  'Ø£Ø¬Ù‡Ø²Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© ÙƒØ¨ÙŠØ±Ø©': { icon: 'ðŸ ', color: '#2563eb', label: 'Ø£Ø¬Ù‡Ø²Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© ÙƒØ¨ÙŠØ±Ø©' },
  'Ø£Ø¯ÙˆØ§Øª Ù…Ø·Ø¨Ø®': { icon: 'ðŸ³', color: '#d97706', label: 'Ø£Ø¯ÙˆØ§Øª Ù…Ø·Ø¨Ø®' },
  'Ø£Ø¯ÙˆØ§Øª Ù…Ù†Ø²Ù„': { icon: 'ðŸ§¹', color: '#059669', label: 'Ø£Ø¯ÙˆØ§Øª Ù…Ù†Ø²Ù„' },
  'Ø£Ø¯ÙˆØ§Øª Ø´Ø®ØµÙŠØ©': { icon: 'ðŸ’‡', color: '#9333ea', label: 'Ø£Ø¯ÙˆØ§Øª Ø´Ø®ØµÙŠØ©' },
  'Ø£Ø®Ø±Ù‰': { icon: 'ðŸ“¦', color: '#64748b', label: 'Ø£Ø®Ø±Ù‰' }
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

  // Ø­Ø³Ø§Ø¨ Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙÙŠ ÙƒÙ„ ØªØµÙ†ÙŠÙ Ø±Ø¦ÙŠØ³ÙŠ ÙˆÙØ±Ø¹ÙŠ
  const mainCounts = { all: state.products.length };
  const subCounts = {}; // { mainCat: { subCat: count } }

  state.products.forEach(p => {
    const mc = p.mainCategory || 'Ø£Ø®Ø±Ù‰';
    const sc = p.category || 'Ø£Ø®Ø±Ù‰ Ù…ØªÙ†ÙˆØ¹Ø©';
    mainCounts[mc] = (mainCounts[mc] || 0) + 1;
    subCounts[mc] = subCounts[mc] || {};
    subCounts[mc][sc] = (subCounts[mc][sc] || 0) + 1;
  });

  // Ø±Ø³Ù… Ø§Ù„Ø£Ù‚Ø³Ø§Ù… Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© (6 Ø®Ø§Ù†Ø§Øª: ÙƒÙ„ Ø§Ù„Ø£ØµÙ†Ø§Ù + 5 Ø£Ù‚Ø³Ø§Ù…)
  const mainOrder = ['all', 'Ø£Ø¬Ù‡Ø²Ø© ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ© ÙƒØ¨ÙŠØ±Ø©', 'Ø£Ø¯ÙˆØ§Øª Ù…Ø·Ø¨Ø®', 'Ø£Ø¯ÙˆØ§Øª Ù…Ù†Ø²Ù„', 'Ø£Ø¯ÙˆØ§Øª Ø´Ø®ØµÙŠØ©', 'Ø£Ø®Ø±Ù‰'];
  mainContainer.innerHTML = mainOrder.map(mc => {
    const meta = MAIN_CATEGORY_META[mc] || { icon: 'ðŸ“¦', color: '#64748b', label: mc };
    const count = mainCounts[mc] || 0;
    const isActive = state.activeMainCategory === mc;
    return `
      <div class="main-cat-card ${isActive ? 'active' : ''}" onclick="selectMainCategory('${mc}')" 
           style="${isActive ? `border-color: ${meta.color}; background: linear-gradient(135deg, ${meta.color}10 0%, ${meta.color}20 100%);` : ''}">
        <span class="main-cat-icon">${meta.icon}</span>
        <div class="main-cat-info">
          <div class="main-cat-title" style="${isActive ? `color: ${meta.color};` : ''}">${meta.label}</div>
          <span class="main-cat-count" style="${isActive ? `background: ${meta.color}; color: white;` : ''}">${count.toLocaleString('en-US')} ØµÙ†Ù</span>
        </div>
      </div>
    `;
  }).join('');

  // Ø±Ø³Ù… Ø§Ù„ØªØµÙ†ÙŠÙØ§Øª Ø§Ù„ÙØ±Ø¹ÙŠØ© (Ø¥Ø°Ø§ ÙƒØ§Ù† Ù‡Ù†Ø§Ùƒ Ù‚Ø³Ù… Ø±Ø¦ÙŠØ³ÙŠ Ù…Ø®ØªØ§Ø±)
  if (state.activeMainCategory !== 'all' && subCounts[state.activeMainCategory]) {
    const subs = subCounts[state.activeMainCategory];
    const sortedSubs = Object.entries(subs).sort((a, b) => b[1] - a[1]);
    const meta = MAIN_CATEGORY_META[state.activeMainCategory] || { color: '#2563eb', label: state.activeMainCategory };

    if (subTitle) subTitle.textContent = `Ø£Ù‚Ø³Ø§Ù… "${meta.label}" Ø§Ù„ÙØ±Ø¹ÙŠØ©:`;

    subContainer.innerHTML = [
      // Ø²Ø± "Ø§Ù„ÙƒÙ„" Ø¶Ù…Ù† Ø§Ù„Ù‚Ø³Ù… Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ
      `<button class="sub-chip ${state.activeCategory === 'all' ? 'active' : ''}" 
              onclick="setSubCategoryFilter('all')"
              style="${state.activeCategory === 'all' ? `background: ${meta.color}; border-color: ${meta.color};` : ''}">
        Ø§Ù„ÙƒÙ„
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

// debounce helper Ù„Ù„ÙƒØªØ§Ù„ÙˆØ¬
let _renderCatalogTimer = null;
function renderCatalog() {
  if (_renderCatalogTimer) clearTimeout(_renderCatalogTimer);
  _renderCatalogTimer = setTimeout(_doRenderCatalog, 60);
}

function _doRenderCatalog() {
  const container = document.getElementById('productsGridContainer');
  if (!container) return;

  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  // ØªØµÙÙŠØ© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ù…Ø¹ Ø¯Ù…Ø¬ Ø§Ù„Ù…Ø§Ø±ÙƒØ© ÙˆØ§Ù„ØªØµÙ†ÙŠÙ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ ÙˆØ§Ù„ÙØ±Ø¹ÙŠ ÙˆØ§Ù„Ø¨Ø­Ø« Ø§Ù„Ù†ØµÙŠ Ù…Ø¹Ø§Ù‹
  let filtered = state.products.filter(p => {
    // 1. ÙÙ„ØªØ± Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù…Ø®ØªØ§Ø±Ø© (Ù…Ø­ØµÙˆØ± Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø­ØµØ±Ø§Ù‹)
    if (state.activeBrand && state.activeBrand !== 'all') {
      if ((p.brand || 'Ø£Ø®Ø±Ù‰') !== state.activeBrand) return false;
    }

    // 2. ÙÙ„ØªØ± Ø§Ù„Ù‚Ø³Ù… Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ
    if (state.activeMainCategory && state.activeMainCategory !== 'all') {
      if ((p.mainCategory || 'Ø£Ø®Ø±Ù‰') !== state.activeMainCategory) return false;
    }

    // 3. ÙÙ„ØªØ± Ø§Ù„Ù‚Ø³Ù… Ø§Ù„ÙØ±Ø¹ÙŠ
    if (state.activeCategory && state.activeCategory !== 'all') {
      if (p.category !== state.activeCategory) return false;
    }

    // 4. ÙÙ„ØªØ± Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù†ØµÙŠ (Ù…Ø¯Ù…Ø¬ ÙˆÙ…Ø­ØµÙˆØ± Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ù…Ø¹ ØªØ·Ø¨ÙŠÙ‚ ÙƒØ§Ù…Ù„ Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© ÙˆØ§Ù„Ù…Ø±Ø§Ø¯ÙØ§Øª)
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

  // ÙØ±Ø² Ø§Ù„Ø£ØµÙ†Ø§Ù: Ø¬Ø¹Ù„ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ù…ØªÙˆÙØ±Ø© Ø£ÙˆÙ„Ø§Ù‹ØŒ ÙˆØ¬Ù…ÙŠØ¹ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„ØªÙŠ ÙƒÙ…ÙŠØªÙ‡Ø§ = ØµÙØ± Ø¨Ø§Ù„Ø£Ø³ÙÙ„ ØªÙ…Ø§Ù…Ø§Ù‹
  filtered.sort((a, b) => {
    const stockA = Math.max(0, parseInt(a.stock) || 0);
    const stockB = Math.max(0, parseInt(b.stock) || 0);
    const aAvailable = stockA > 0;
    const bAvailable = stockB > 0;
    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;
    return stockB - stockA; // Ø§Ù„Ù…ØªÙˆÙØ± Ø¨ÙƒÙ…ÙŠØ§Øª Ø£ÙƒØ¨Ø± ÙŠØ¸Ù‡Ø± Ø£ÙˆÙ„Ø§Ù‹
  });

  const totalCount = filtered.length;

  if (totalCount === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">ðŸ“¦</div>
        <h3>Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø£ÙŠ Ù…Ù†ØªØ¬Ø§Øª Ù…Ø·Ø§Ø¨Ù‚Ø©</h3>
        <p>Ø¬Ø±Ø¨ ØªØºÙŠÙŠØ± Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø£Ùˆ Ø§Ù„Ù‚Ø³Ù… Ø£Ùˆ Ø§Ù„Ø¨Ø­Ø« Ø¨ÙƒÙ„Ù…Ø§Øª Ø£Ø®Ø±Ù‰</p>
      </div>
    `;
    return;
  }

  const displayedCount = state.catalogCurrentPage * state.catalogPageSize;
  const pageProducts = filtered.slice(0, displayedCount);

  // Ø­Ø³Ø§Ø¨ Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ù†Ø§ÙØ¯Ø© Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø· (performance fix)
  const zeroCount = filtered.reduce((acc, p) => acc + ((parseInt(p.stock) || 0) <= 0 ? 1 : 0), 0);

  let zeroDividerAdded = false;
  let cardsHtml = pageProducts.map(prod => {
    const cost = parseFloat(prod.costPrice) || 0;
    const sell = parseFloat(prod.sellPrice) || 0;
    const profit = sell - cost;
    const profitMargin = sell > 0 ? ((profit / sell) * 100).toFixed(0) : 0;

    // ÙØ­Øµ Ø¥Ù† ÙƒØ§Ù† Ø§Ù„Ù…Ù†ØªØ¬ Ù…ÙˆØ¬ÙˆØ¯Ø§Ù‹ Ø¨Ø§Ù„Ø³Ù„Ø©
    const cartItem = state.cart.find(item => item.productId === prod.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;

    const currentStock = Math.max(0, parseInt(prod.stock) || 0);
    const isZeroStock = currentStock === 0;
    const imageUrl = prod.image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80';

    let dividerHtml = '';
    if (isZeroStock && !zeroDividerAdded) {
      zeroDividerAdded = true;
      dividerHtml = `
        <div class="zero-stock-divider">
          <div class="zero-title">
            <span style="font-size: 1.3rem;">âš ï¸</span>
            <span>Ø£ØµÙ†Ø§Ù Ù†ÙØ¯Øª ÙƒÙ…ÙŠØªÙ‡Ø§ Ù…Ù† Ø§Ù„Ù…Ø®Ø²ÙˆÙ† (Ø§Ù„ÙƒÙ…ÙŠØ© = 0):</span>
          </div>
          <span class="zero-badge">${zeroCount} ØµÙ†Ù Ù†Ø§ÙØ¯ Ø­Ø§Ù„ÙŠØ§Ù‹</span>
        </div>
      `;
    }

    return `
      ${dividerHtml}
      <div class="product-card ${isZeroStock ? 'is-out-of-stock' : ''}">
        <div class="product-img-wrapper" onclick="openProductDetailSheet('${prod.id}')" style="cursor: pointer;" title="Ø§Ù†Ù‚Ø± Ù„Ø¹Ø±Ø¶ ØªÙØ§ØµÙŠÙ„ Ø§Ù„ØµÙ†Ù">
          <img src="${imageUrl}" alt="${prod.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'">
          ${(Array.isArray(prod.images) && prod.images.length > 1) ? `<span class="badge" style="position: absolute; top: 8px; left: 8px; background: rgba(15, 23, 42, 0.85); color: #fff; font-size: 0.72rem; padding: 2px 7px; border-radius: 6px; backdrop-filter: blur(4px); font-weight: 700; border: 1px solid rgba(255,255,255,0.2);">ðŸ“· ${prod.images.length} ØµÙˆØ±</span>` : ''}
          <span class="product-category-tag">${prod.category || 'Ø¹Ø§Ù…'}</span>
          ${prod.brand && prod.brand !== 'Ø£Ø®Ø±Ù‰' ? `<span class="product-brand-tag">ðŸ·ï¸ ${escapeHtml(prod.brand)}</span>` : ''}
          <span class="product-stock-tag ${isZeroStock ? 'zero-stock-badge' : ''}">${isZeroStock ? 'âš ï¸ ØºÙŠØ± Ù…ØªÙˆÙØ± (0)' : `Ø§Ù„Ù…ØªÙˆÙØ±: ${currentStock}`}</span>
          ${isZeroStock ? `<div class="zero-stock-overlay-badge"><span>Ù†ÙØ¯ Ù…Ù† Ø§Ù„Ù…Ø®Ø²ÙˆÙ†</span></div>` : ''}
          <div class="product-img-preview-overlay" style="position: absolute; bottom: 8px; right: 8px; background: rgba(15, 23, 42, 0.75); color: #fff; padding: 0.25rem 0.55rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; backdrop-filter: blur(4px); display: inline-flex; align-items: center; gap: 0.3rem;">
            <span>ðŸ‘ï¸</span>
            <span>Ù…Ø¹Ø§ÙŠÙ†Ø©</span>
          </div>
        </div>

        <div class="product-content">
          <div class="product-code">${prod.code || 'Ø¨Ø¯ÙˆÙ† ÙƒÙˆØ¯'}</div>
          <h3 class="product-title" title="${prod.name}" onclick="openProductDetailSheet('${prod.id}')" style="cursor: pointer;">${prod.name}</h3>

          <!-- Ù…ØµÙÙˆÙØ© Ø§Ù„Ø£Ø³Ø¹Ø§Ø± Ø§Ù„Ø´ÙØ§ÙØ© Ù„Ù„Ù…ÙˆØ¸ÙÙŠÙ† -->
          <div class="employee-pricing-box">
            <div class="price-row">
              <span class="price-label">ðŸ“¦ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ (Ø§Ù„ØªÙƒÙ„ÙØ©):</span>
              <span class="price-val cost-val">${cost.toLocaleString('en-US')} ${currency}</span>
            </div>
            <div class="price-row">
              <span class="price-label">ðŸ·ï¸ Ø³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹:</span>
              <span class="price-val sell-val">${sell.toLocaleString('en-US')} ${currency}</span>
            </div>
            <div class="price-row">
              <span class="price-label">ðŸŸ¢ Ø±Ø¨Ø­ Ø§Ù„Ù‚Ø·Ø¹Ø©:</span>
              <span class="price-val profit-val">+${profit.toLocaleString('en-US')} ${currency} (${profitMargin}%)</span>
            </div>
          </div>

          <div class="product-actions" style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${inCartQty > 0 ? `
              <div class="quantity-control" style="flex: 1; min-width: 130px; justify-content: space-between;">
                <button class="quantity-btn" onclick="updateCartQuantity('${prod.id}', ${inCartQty - 1})">-</button>
                <span class="quantity-input" style="line-height: 32px;">${inCartQty} Ø¨Ø§Ù„ÙØ§ØªÙˆØ±Ø©</span>
                <button class="quantity-btn" onclick="updateCartQuantity('${prod.id}', ${inCartQty + 1})">+</button>
              </div>
            ` : `
              <button class="btn ${isZeroStock ? 'btn-outline-danger' : 'btn-primary'}" style="flex: 1; min-width: 130px;" onclick="addToCart('${prod.id}')">
                <span>âž•</span>
                <span>${isZeroStock ? 'Ø¥Ø¶Ø§ÙØ© Ø±ØºÙ… Ø§Ù„Ù†ÙØ§Ø¯' : 'Ø¥Ø¶Ø§ÙØ© Ù„Ù„ÙØ§ØªÙˆØ±Ø©'}</span>
              </button>
            `}
            <button class="btn btn-secondary btn-sm" onclick="openEditProductModal('${prod.id}')" title="ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬">âœï¸</button>

          </div>
        </div>
      </div>
    `;
  }).join('');

  // Ø´Ø±ÙŠØ· ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ø²ÙŠØ¯ ÙˆØ§Ù„ØµÙØ­Ø§Øª
  if (displayedCount < totalCount) {
    cardsHtml += `
      <div class="catalog-pagination-box" style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 1rem; text-align: center; gap: 0.75rem;">
        <div style="font-size: 0.95rem; color: #64748b;">
          ØªÙ… Ø¹Ø±Ø¶ <strong style="color: #0f172a;">${Math.min(displayedCount, totalCount).toLocaleString('en-US')}</strong> Ù…Ù† Ø£ØµÙ„ <strong style="color: #0f172a;">${totalCount.toLocaleString('en-US')}</strong> Ù…Ù†ØªØ¬
        </div>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;">
          <button class="btn btn-primary" onclick="loadMoreCatalogProducts()">
            <span>â¬‡ï¸</span> Ø¹Ø±Ø¶ Ø§Ù„Ù…Ø²ÙŠØ¯ (24 Ù…Ù†ØªØ¬ Ø¥Ø¶Ø§ÙÙŠ)
          </button>
          <button class="btn btn-secondary" onclick="loadAllCatalogProducts()">
            <span>ðŸ‘ï¸</span> Ø¹Ø±Ø¶ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª (${totalCount.toLocaleString('en-US')})
          </button>
        </div>
      </div>
    `;
  } else if (totalCount > state.catalogPageSize) {
    cardsHtml += `
      <div style="grid-column: 1 / -1; text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.9rem;">
        âœ… ØªÙ… Ø¹Ø±Ø¶ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© (${totalCount.toLocaleString('en-US')} Ù…Ù†ØªØ¬)
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
// Ø¥Ø¯Ø§Ø±Ø© Ù†Ø§ÙØ°Ø© Ø¥Ø¶Ø§ÙØ© / ØªØ¹Ø¯ÙŠÙ„ Ù…Ù†ØªØ¬
// -------------------------------------------------------------
// ---------------------------------------------------------------
// ÙƒØ´Ù Ø§Ù„Ù…Ø§Ø±ÙƒØ© ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ù…Ù† Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬
// ---------------------------------------------------------------
const BRAND_DETECT_RULES = [
  { brand: 'LG',           brandAr: 'Ø§Ù„ Ø¬ÙŠ (LG)',           icon: 'ðŸ”´', patterns: [/\bal\s*g[ei]\b/i, /\bØ§Ù„\s*Ø¬ÙŠ\b/, /\blg\b/i] },
  { brand: 'Samsung',      brandAr: 'Ø³Ø§Ù…Ø³ÙˆÙ†Ø¬',              icon: 'ðŸ”·', patterns: [/samsung/i, /Ø³Ø§Ù…Ø³ÙˆÙ†Ø¬/, /Ø³Ø§Ù…Ø³ÙˆÙ†Øº/] },
  { brand: 'Beko',         brandAr: 'Ø¨ÙŠÙƒÙˆ',                 icon: 'ðŸ”µ', patterns: [/beko/i, /Ø¨ÙŠÙƒÙˆ/] },
  { brand: 'Simfer',       brandAr: 'Ø³ÙŠÙ…ÙÙŠØ± / Ø³Ù…ÙÙŠØ±',       icon: 'ðŸ²', patterns: [/simfer/i, /Ø³ÙŠÙ…ÙÙŠØ±/, /Ø³Ù…ÙÙŠØ±/] },
  { brand: 'Manger Home',  brandAr: 'Ù…Ù†Ø¬Ø± Ù‡ÙˆÙ… / Ù…Ø§Ù†Ø¬Ø±',    icon: 'ðŸ ', patterns: [/manger\s*home/i, /Ù…Ù†Ø¬Ø±\s*Ù‡ÙˆÙ…/, /Ù…Ø§Ù†Ø¬Ø±\s*Ù‡ÙˆÙ…/, /Ù…Ù†Ø¬Ø±\s*Ù‡ÙˆÙ…/] },
  { brand: 'RAF',          brandAr: 'Ø±Ø§Ù (RAF)',             icon: 'âš¡', patterns: [/\braf\b/i, /\bØ±Ø§Ù\b/] },
  { brand: 'Luxor',        brandAr: 'Ù„ÙˆÙƒØ³Ø±',                icon: 'ðŸ’¡', patterns: [/luxor/i, /Ù„ÙˆÙƒØ³Ø±/, /Ù„ÙˆÙƒØ³ÙˆØ±/] },
  { brand: 'Zacash',       brandAr: 'Ø²ÙƒØ´ / Ø²Ø§ÙƒØ§Ø´',          icon: 'ðŸ¹', patterns: [/zacash/i, /Ø²ÙƒØ´/, /Ø²Ø§ÙƒØ§Ø´/, /Ø²ÙƒØ§Ø´/] },
  { brand: 'Lawrence',     brandAr: 'Ù„ÙˆØ±Ù†Ø³',                icon: 'ðŸ“»', patterns: [/lawrence/i, /Ù„ÙˆØ±Ù†Ø³/] },
  { brand: 'Universal',    brandAr: 'ÙŠÙˆÙ†ÙŠÙØ±Ø³Ø§Ù„',            icon: 'â­', patterns: [/universal/i, /ÙŠÙˆÙ†ÙŠÙØ±Ø³Ø§Ù„/] },
  { brand: 'Haier',        brandAr: 'Ù‡Ø§ÙŠØ±',                 icon: 'ðŸŒ€', patterns: [/haier/i, /Ù‡Ø§ÙŠØ±/] },
  { brand: 'Midea',        brandAr: 'Ù…ÙŠØ¯ÙŠØ§',                icon: 'â„ï¸', patterns: [/midea/i, /Ù…ÙŠØ¯ÙŠØ§/] },
  { brand: 'Sharp',        brandAr: 'Ø´Ø§Ø±Ø¨',                 icon: 'âš¡', patterns: [/sharp/i, /Ø´Ø§Ø±Ø¨/] },
  { brand: 'TCL',          brandAr: 'ØªÙŠ Ø³ÙŠ Ø§Ù„',             icon: 'ðŸ“º', patterns: [/\btcl\b/i, /ØªÙŠ\s*Ø³ÙŠ\s*Ø§Ù„/] },
  { brand: 'Bompani',      brandAr: 'Ø¨ÙˆÙ…Ø¨Ø§Ù†ÙŠ',              icon: 'ðŸ³', patterns: [/bompani/i, /Ø¨ÙˆÙ…Ø¨Ø§Ù†ÙŠ/] },
  { brand: 'Crest',        brandAr: 'ÙƒØ±ÙŠØ³Øª',                icon: 'ðŸ‘‘', patterns: [/\bcrest\b/i, /ÙƒØ±ÙŠØ³Øª/] },
  { brand: 'Trust',        brandAr: 'ØªØ±Ø³Øª',                 icon: 'ðŸ›¡ï¸', patterns: [/\btrust\b/i, /ØªØ±Ø³Øª/] },
  { brand: 'Candy',        brandAr: 'ÙƒØ§Ù†Ø¯ÙŠ',                icon: 'ðŸ¬', patterns: [/\bcandy\b/i, /ÙƒØ§Ù†Ø¯ÙŠ/] },
  { brand: 'Tefal',        brandAr: 'ØªÙŠÙØ§Ù„',                icon: 'ðŸ³', patterns: [/tefal/i, /ØªÙŠÙØ§Ù„/] },
  { brand: 'Hisense',      brandAr: 'Ù‡Ø§ÙŠØ³Ù†Ø³',              icon: 'ðŸ“º', patterns: [/hisense/i, /Ù‡Ø§ÙŠØ³Ù†Ø³/] },
  { brand: 'Atlantic',     brandAr: 'Ø§ØªÙ„Ø§Ù†ØªÙŠÙƒ',            icon: 'ðŸŒŠ', patterns: [/atlantic/i, /Ø§ØªÙ„Ø§Ù†ØªÙŠÙƒ/] },
  { brand: 'Dahua',        brandAr: 'Ø¯Ù‡ÙˆØ§',                 icon: 'ðŸ“¹', patterns: [/dahua/i, /Ø¯Ù‡ÙˆØ§/] },
  { brand: 'KMG',          brandAr: 'ÙƒÙŠ Ø§Ù… Ø¬ÙŠ',            icon: 'ðŸ§Š', patterns: [/\bkmg\b/i, /ÙƒÙŠ\s*Ø§Ù…\s*Ø¬ÙŠ/] },
  { brand: 'Matrix',       brandAr: 'Ù…Ø§ØªØ±ÙƒØ³',               icon: 'ðŸ–¥ï¸', patterns: [/matrix/i, /Ù…Ø§ØªØ±ÙƒØ³/] },
  { brand: 'Prestige',     brandAr: 'Ø¨Ø±Ø³ØªÙŠØ¬',               icon: 'ðŸ†', patterns: [/prestige/i, /Ø¨Ø±Ø³ØªÙŠØ¬/] },
  { brand: 'General Lux',  brandAr: 'Ø¬Ù†Ø±Ø§Ù„ Ù„ÙˆÙƒØ³',          icon: 'âœ¨', patterns: [/general\s*lux/i, /Ø¬Ù†Ø±Ø§Ù„\s*Ù„ÙˆÙƒØ³/] },
  { brand: 'General Queen',brandAr: 'Ø¬Ù†Ø±Ø§Ù„ ÙƒÙˆÙŠÙ†',           icon: 'ðŸ‘‘', patterns: [/general\s*queen/i, /Ø¬Ù†Ø±Ø§Ù„\s*ÙƒÙˆÙŠÙ†/] },
  { brand: 'Samex',        brandAr: 'Ø³Ø§Ù…ÙƒØ³',                icon: 'ðŸ”¥', patterns: [/samex/i, /Ø³Ø§Ù…ÙƒØ³/] },
  { brand: 'Molar',        brandAr: 'Ù…ÙˆÙ„Ø§Ø±',                icon: 'ðŸ§Š', patterns: [/molar/i, /Ù…ÙˆÙ„Ø§Ø±/] },
  { brand: 'ADC',          brandAr: 'ADC',                  icon: 'ðŸ”Œ', patterns: [/\badc\b/i, /\bØ§\.Ø¯\.Ø³\b/] },
  { brand: 'iPlug',        brandAr: 'Ø§ÙŠØ¨Ù„ÙˆØ¬',               icon: 'ðŸ”Œ', patterns: [/iplug/i, /Ø¢ÙŠ\s*Ø¨Ù„ÙˆØ¬/, /Ø§ÙŠØ¨Ù„ÙˆØ¬/] },
];

function detectBrandFromName(name) {
  if (!name || name.trim().length < 2) return null;
  const lower = name.toLowerCase();
  for (const rule of BRAND_DETECT_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(name) || pat.test(lower)) {
        return rule;
      }
    }
  }
  return null;
}

function handleProductNameInput(value) {
  const badge = document.getElementById('brandDetectBadge');
  const iconEl = document.getElementById('brandDetectIcon');
  const nameEl = document.getElementById('brandDetectName');
  const brandField = document.getElementById('prodDetectedBrand');
  const brandArField = document.getElementById('prodDetectedBrandAr');
  const brandInput = document.getElementById('prodBrandInput');

  const detected = detectBrandFromName(value);
  if (detected) {
    iconEl.textContent = detected.icon;
    const currentInputBrand = (brandInput ? brandInput.value : '').trim();
    const isConflict = currentInputBrand && currentInputBrand.toLowerCase() !== 'Ø£Ø®Ø±Ù‰' && currentInputBrand.toLowerCase() !== detected.brand.toLowerCase();

    if (isConflict) {
      nameEl.innerHTML = `âš ï¸ <strong style="color:#d97706;">ØªÙ†Ø¨ÙŠÙ‡ ØªØ¹Ø§Ø±Ø¶ Ø§Ù„Ù…Ø§Ø±ÙƒØ©:</strong> Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù ÙŠØ´ÙŠØ± Ø¥Ù„Ù‰ <strong>${detected.brand} (${detected.brandAr})</strong> Ø¨ÙŠÙ†Ù…Ø§ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù…Ø­Ø¯Ø¯Ø© Ù‡ÙŠ "${currentInputBrand}". <button type="button" class="btn btn-xs btn-primary" onclick="document.getElementById('prodBrandInput').value='${detected.brand}'; handleProductNameInput(document.getElementById('prodName').value);" style="margin-right: 6px; padding: 2px 6px;">ØªØµØ­ÙŠØ­ Ù„Ù€ ${detected.brand}</button>`;
      badge.style.borderColor = '#f59e0b';
      badge.style.background = 'rgba(245, 158, 11, 0.12)';
    } else {
      nameEl.textContent = `Ø³ÙŠÙØ­ÙØ¸ ØªØ­Øª: ${detected.brand} â€” ${detected.brandAr}`;
      badge.style.borderColor = '#0ea5e9';
      badge.style.background = 'linear-gradient(135deg,#1e3a5f22,#0ea5e922)';
    }

    badge.style.display = 'flex';
    brandField.value = detected.brand;
    brandArField.value = detected.brandAr;
    if (brandInput && !brandInput.value.trim()) {
      brandInput.value = detected.brand;
    }
  } else {
    badge.style.display = 'none';
    brandField.value = '';
    brandArField.value = '';
  }
}

function clearDetectedBrand() {
  document.getElementById('brandDetectBadge').style.display = 'none';
  document.getElementById('prodDetectedBrand').value = '';
  document.getElementById('prodDetectedBrandAr').value = '';
  const brandInput = document.getElementById('prodBrandInput');
  if (brandInput) brandInput.value = '';
}

function openAddProductModal() {
  document.getElementById('productModalTitle').textContent = 'Ø¥Ø¶Ø§ÙØ© Ù…Ù†ØªØ¬ Ø¬Ø¯ÙŠØ¯ Ù„Ù„Ø´Ø±ÙƒØ©';
  document.getElementById('editProductId').value = '';
  document.getElementById('prodCode').value = 'PRD-' + Math.floor(100 + Math.random() * 900);
  document.getElementById('prodName').value = '';
  const brandInput = document.getElementById('prodBrandInput');
  if (brandInput) brandInput.value = '';
  document.getElementById('prodCategory').value = '';
  document.getElementById('prodCostPrice').value = '';
  document.getElementById('prodSellPrice').value = '';
  document.getElementById('prodCalculatedProfit').value = '';
  document.getElementById('prodStock').value = '10';
  document.getElementById('prodDescription').value = '';
  
  // Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù…ÙƒØªØ´ÙØ© ÙˆÙ…ØµÙÙˆÙØ© Ø§Ù„ØµÙˆØ±
  clearDetectedBrand();
  state.editingProductImages = [];
  renderProductModalImagesGrid();

  document.getElementById('productModal').classList.add('active');
}

function openEditProductModal(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  document.getElementById('productModalTitle').textContent = 'ØªØ¹Ø¯ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬';
  document.getElementById('editProductId').value = prod.id;
  document.getElementById('prodCode').value = prod.code || '';
  document.getElementById('prodName').value = prod.name || '';
  const brandInput = document.getElementById('prodBrandInput');
  if (brandInput) brandInput.value = prod.brand || '';
  document.getElementById('prodCategory').value = prod.category || '';
  document.getElementById('prodCostPrice').value = prod.costPrice || '';
  document.getElementById('prodSellPrice').value = prod.sellPrice || '';
  document.getElementById('prodStock').value = prod.stock ?? 10;
  document.getElementById('prodDescription').value = prod.description || '';

  // ØªØ¬Ù‡ÙŠØ² Ù…ØµÙÙˆÙØ© Ø§Ù„ØµÙˆØ± Ù„Ù„ØµÙ†Ù
  let imgs = [];
  if (Array.isArray(prod.images) && prod.images.length > 0) {
    imgs = prod.images.filter(img => typeof img === 'string' && img.trim());
  } else if (prod.image && typeof prod.image === 'string' && prod.image.trim()) {
    imgs = [prod.image.trim()];
  }
  state.editingProductImages = [...imgs];
  renderProductModalImagesGrid();

  // Ø¹Ø±Ø¶ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø© Ù…Ø³Ø¨Ù‚Ø§Ù‹ Ø£Ùˆ Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„ÙƒØ´Ù
  clearDetectedBrand();
  if (prod.brand && prod.brand !== 'Ø£Ø®Ø±Ù‰') {
    const rule = BRAND_DETECT_RULES.find(r => r.brand === prod.brand);
    const badge = document.getElementById('brandDetectBadge');
    if (rule) {
      document.getElementById('brandDetectIcon').textContent = rule.icon;
      document.getElementById('brandDetectName').textContent = `Ù…Ø­ÙÙˆØ¸Ø©: ${rule.brand} â€” ${rule.brandAr}`;
      badge.style.display = 'flex';
      document.getElementById('prodDetectedBrand').value = prod.brand;
      document.getElementById('prodDetectedBrandAr').value = prod.brandAr || rule.brandAr;
    }
  } else {
    handleProductNameInput(prod.name || '');
  }

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
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const profitMargin = sell > 0 ? ((profit / sell) * 100).toFixed(1) : 0;
  
  const el = document.getElementById('prodCalculatedProfit');
  if (el) {
    el.value = `+${profit.toLocaleString('en-US')} ${currency} (${profitMargin}%)`;
  }
}

// Ø¶ØºØ· ÙˆØªØµØºÙŠØ± Ø§Ù„ØµÙˆØ± Ø°Ø§Øª Ø§Ù„Ø¯Ù‚Ø© Ø§Ù„Ø¹Ø§Ù„ÙŠØ© (Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ø£Ù†Ø¯Ø±ÙˆÙŠØ¯ ÙˆØ§Ù„ÙƒØ§Ù…ÙŠØ±Ø§Øª) Ù‚Ø¨Ù„ Ø§Ù„Ø±ÙØ¹
function compressImageForUpload(file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width <= maxWidth && height <= maxHeight && file.size < 700 * 1024) {
          return resolve(file);
        }

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const ext = file.type === 'image/png' ? '.png' : '.jpg';
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + ext, {
              type: blob.type || 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Ø±ÙØ¹ ÙˆÙ…Ø¹Ø§Ù„Ø¬Ø© ØµÙˆØ± Ù…ØªØ¹Ø¯Ø¯Ø© Ù„Ù„ØµÙ†Ù
async function handleMultipleImagesUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const files = Array.from(input.files);
  showToast(`Ø¬Ø§Ø±ÙŠ Ù…Ø¹Ø§Ù„Ø¬Ø© ÙˆØ¶ØºØ· (${files.length}) ØµÙˆØ±Ø© Ù„Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ø°ÙƒÙŠØ© ÙˆØ§Ù„Ø£Ù†Ø¯Ø±ÙˆÙŠØ¯...`, 'info');

  let uploadedCount = 0;
  for (const rawFile of files) {
    try {
      const file = await compressImageForUpload(rawFile);
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        if (!Array.isArray(state.editingProductImages)) state.editingProductImages = [];
        state.editingProductImages.push(data.imageUrl);
        uploadedCount++;
      }
    } catch (err) {
      console.error('ÙØ´Ù„ Ø±ÙØ¹ Ø¥Ø­Ø¯Ù‰ Ø§Ù„ØµÙˆØ±:', err);
    }
  }
  input.value = '';
  renderProductModalImagesGrid();
  if (uploadedCount > 0) {
    showToast(`âœ… ØªÙ… Ø±ÙØ¹ ÙˆØ¥Ø¶Ø§ÙØ© (${uploadedCount}) ØµÙˆØ±Ø© Ø¨Ù†Ø¬Ø§Ø­!`, 'success');
  } else {
    showToast('ÙØ´Ù„ Ø±ÙØ¹ Ø§Ù„ØµÙˆØ± Ø§Ù„Ù…Ø­Ø¯Ø¯Ø©', 'error');
  }
}

// Ø¥Ø¶Ø§ÙØ© Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø© URL ÙŠØ¯ÙˆÙŠ
function addImageUrlToProductList() {
  const input = document.getElementById('prodAddImageUrlInput');
  if (!input) return;
  const url = input.value.trim();
  if (!url) {
    showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø±Ø§Ø¨Ø· ØµÙˆØ±Ø© ØµØ§Ù„Ø­', 'warning');
    return;
  }
  if (!Array.isArray(state.editingProductImages)) state.editingProductImages = [];
  state.editingProductImages.push(url);
  input.value = '';
  renderProductModalImagesGrid();
  showToast('ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø±Ø§Ø¨Ø· Ø§Ù„ØµÙˆØ±Ø© Ø¨Ù†Ø¬Ø§Ø­', 'success');
}

// Ø­Ø°Ù ØµÙˆØ±Ø© Ù…Ø­Ø¯Ø¯Ø© Ù…Ù† Ù‚Ø§Ø¦Ù…Ø© ØµÙˆØ± Ø§Ù„ØµÙ†Ù
function removeProductImage(index) {
  if (!Array.isArray(state.editingProductImages)) return;
  state.editingProductImages.splice(index, 1);
  renderProductModalImagesGrid();
}

// ØªØ¹ÙŠÙŠÙ† Ø§Ù„ØµÙˆØ±Ø© ÙƒØºÙ„Ø§Ù Ø±Ø¦ÙŠØ³ÙŠ
function setProductPrimaryImage(index) {
  if (!Array.isArray(state.editingProductImages) || index <= 0) return;
  const [chosen] = state.editingProductImages.splice(index, 1);
  state.editingProductImages.unshift(chosen);
  renderProductModalImagesGrid();
  showToast('ØªÙ… ØªØ¹ÙŠÙŠÙ† Ø§Ù„ØµÙˆØ±Ø© ÙƒØºÙ„Ø§Ù Ø±Ø¦ÙŠØ³ÙŠ Ù„Ù„ØµÙ†Ù â­', 'info');
}

// Ø±Ø³Ù… ÙˆØ¥Ø¯Ø§Ø±Ø© Ù…ØµØºØ±Ø§Øª Ø§Ù„ØµÙˆØ± ÙÙŠ Ù†Ø§ÙØ°Ø© ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬
function renderProductModalImagesGrid() {
  const container = document.getElementById('prodImagesGridContainer');
  const countBadge = document.getElementById('prodImagesCountBadge');
  const hiddenUrl = document.getElementById('prodImageUrl');
  const imgs = state.editingProductImages || [];

  if (countBadge) countBadge.textContent = `${imgs.length} ØµÙˆØ±Ø© Ù…Ø¶Ø§ÙØ©`;
  if (hiddenUrl) hiddenUrl.value = imgs[0] || '';

  if (!container) return;

  if (imgs.length === 0) {
    container.innerHTML = `
      <div id="prodImagesEmptyHint" style="font-size: 0.82rem; color: #94a3b8; text-align: center; width: 100%; padding: 0.5rem;">
        ðŸ“· Ù„Ù… ÙŠØªÙ… Ø¥Ø¶Ø§ÙØ© ØµÙˆØ± Ø¨Ø¹Ø¯. Ø§Ø¶ØºØ· "Ø§Ù„Ø§Ø³ØªÙˆØ¯ÙŠÙˆ / Ø§Ù„ØµÙˆØ±" Ù„Ø§Ø®ØªÙŠØ§Ø± ØµÙˆØ±Ø© Ø£Ùˆ Ø£ÙƒØ«Ø±ØŒ Ø£Ùˆ Ø§Ù„ØªÙ‚Ø· ØµÙˆØ±Ø© Ø¨Ø§Ù„ÙƒØ§Ù…ÙŠØ±Ø§.
      </div>
    `;
    return;
  }

  container.innerHTML = imgs.map((url, idx) => {
    const isPrimary = (idx === 0);
    return `
      <div class="prod-modal-thumb-item ${isPrimary ? 'is-primary' : ''}">
        <img src="${escapeHtml(url)}" alt="ØµÙˆØ±Ø© ${idx + 1}" onerror="this.src='https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'">
        <button type="button" class="prod-modal-thumb-del" onclick="removeProductImage(${idx})" title="Ø­Ø°Ù Ù‡Ø°Ù‡ Ø§Ù„ØµÙˆØ±Ø©">âœ•</button>
        <button type="button" class="prod-modal-thumb-star ${isPrimary ? 'active' : ''}" onclick="setProductPrimaryImage(${idx})" title="${isPrimary ? 'Ø§Ù„ØµÙˆØ±Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ø§Ù„Ø­Ø§Ù„ÙŠØ©' : 'ØªØ¹ÙŠÙŠÙ† ÙƒØµÙˆØ±Ø© Ø±Ø¦ÙŠØ³ÙŠØ©'}">
          ${isPrimary ? 'â­ Ø±Ø¦ÙŠØ³ÙŠØ©' : 'â˜† Ø±Ø¦ÙŠØ³ÙŠØ©'}
        </button>
      </div>
    `;
  }).join('');
}

// =============================================================
// Ù†Ø§ÙØ°Ø© Ù…Ø¹Ø§ÙŠÙ†Ø© ÙˆØ¹Ø±Ø¶ ØµÙˆØ± Ø§Ù„Ù…Ù†ØªØ¬ Ø§Ù„Ù†Ù‚ÙŠØ© Ø¨Ø§Ù„ÙƒØ§Ù…Ù„ Ù…Ø¹ Ø§Ù„ØªÙƒØ¨ÙŠØ± Ø§Ù„Ù…Ø¨Ø§Ø´Ø± (Pure Lightbox & Zoom)
// =============================================================
let previewGallery = {
  images: [],
  currentIndex: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  hasDragged: false,
  startX: 0,
  startY: 0
};

function openProductCustomerPreview(productId, initialIndex = 0) {
  const prod = state.products.find(p => String(p.id) === String(productId));
  if (!prod) {
    showToast('Ø§Ù„ØµÙ†Ù ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯', 'warning');
    return;
  }

  let imgs = [];
  if (Array.isArray(prod.images) && prod.images.length > 0) {
    imgs = prod.images.filter(img => typeof img === 'string' && img.trim());
  } else if (prod.image && typeof prod.image === 'string' && prod.image.trim()) {
    imgs = [prod.image.trim()];
  }

  if (imgs.length === 0) {
    imgs = ['https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'];
  }

  previewGallery = {
    images: imgs,
    currentIndex: Math.max(0, Math.min(initialIndex, imgs.length - 1)),
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    hasDragged: false,
    startX: 0,
    startY: 0
  };

  // ÙØªØ­ Ø§Ù„Ù…ÙˆØ¯Ø§Ù„ ÙÙˆØ±Ø§Ù‹ Ø¨Ù€ inline style Ø¨Ø¯ÙˆÙ† Ø§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯ Ø¹Ù„Ù‰ CSS class
  const modal = document.getElementById('customerProductPreviewModal');
  if (modal) {
    modal.style.cssText = 'display: flex; position: fixed; inset: 0; background: rgba(5, 7, 12, 0.96); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); z-index: 99999; overflow: hidden; align-items: center; justify-content: center; user-select: none; touch-action: none;';
  }

  updateCustomerPreviewUi();

  // ØªØ³Ø¬ÙŠÙ„ Ù…Ø³ØªÙ…Ø¹Ø§Øª Ù„ÙˆØ­Ø© Ø§Ù„Ù…ÙØ§ØªÙŠØ­
  document.addEventListener('keydown', handlePreviewKeyDown);
  initPreviewInteraction();
}

function updateCustomerPreviewUi() {
  const imgEl = document.getElementById('custPrevImage');
  const counterEl = document.getElementById('custPrevGalleryCounter');
  const btnPrev = document.getElementById('custPrevBtnPrev');
  const btnNext = document.getElementById('custPrevBtnNext');
  const thumbStrip = document.getElementById('custPrevThumbStrip');

  const total = previewGallery.images.length;
  const current = previewGallery.currentIndex;
  const currentUrl = previewGallery.images[current];

  if (imgEl) {
    imgEl.src = currentUrl;
  }

  // Ø¥Ø¹Ø§Ø¯Ø© Ø¶Ø¨Ø· Ø§Ù„ØªÙƒØ¨ÙŠØ± Ø¹Ù†Ø¯ ØªØ¨Ø¯ÙŠÙ„ Ø§Ù„ØµÙˆØ±Ø©
  previewGallery.zoom = 1;
  previewGallery.panX = 0;
  previewGallery.panY = 0;
  applyCustomerPreviewTransform();

  // Ø¹Ù†Ø§ØµØ± Ø§Ù„ØªØ¹Ø¯Ø¯ (ØªØ¸Ù‡Ø± ÙÙ‚Ø· Ø¥Ø°Ø§ ÙƒØ§Ù† Ù‡Ù†Ø§Ùƒ Ø£ÙƒØ«Ø± Ù…Ù† ØµÙˆØ±Ø©)
  if (total > 1) {
    if (counterEl) {
      counterEl.style.display = 'block';
      counterEl.textContent = `${current + 1} / ${total}`;
    }
    if (btnPrev) btnPrev.style.display = 'flex';
    if (btnNext) btnNext.style.display = 'flex';
    if (thumbStrip) {
      thumbStrip.style.display = 'flex';
      thumbStrip.innerHTML = previewGallery.images.map((url, i) => `
        <div class="cust-prev-mini-thumb ${i === current ? 'active' : ''}" onclick="selectCustomerPreviewImage(${i})" title="ØµÙˆØ±Ø© ${i + 1}">
          <img src="${escapeHtml(url)}" alt="ØµÙˆØ±Ø© ${i + 1}">
        </div>
      `).join('');
    }
  } else {
    if (counterEl) counterEl.style.display = 'none';
    if (btnPrev) btnPrev.style.display = 'none';
    if (btnNext) btnNext.style.display = 'none';
    if (thumbStrip) thumbStrip.style.display = 'none';
  }
}

function selectCustomerPreviewImage(index) {
  if (index < 0 || index >= previewGallery.images.length) return;
  previewGallery.currentIndex = index;
  updateCustomerPreviewUi();
}

function nextCustomerPreviewImage(e) {
  if (e) e.stopPropagation();
  if (previewGallery.images.length <= 1) return;
  previewGallery.currentIndex = (previewGallery.currentIndex + 1) % previewGallery.images.length;
  updateCustomerPreviewUi();
}

function prevCustomerPreviewImage(e) {
  if (e) e.stopPropagation();
  if (previewGallery.images.length <= 1) return;
  previewGallery.currentIndex = (previewGallery.currentIndex - 1 + previewGallery.images.length) % previewGallery.images.length;
  updateCustomerPreviewUi();
}

function closeCustomerProductPreview() {
  const modal = document.getElementById('customerProductPreviewModal');
  if (modal) {
    modal.style.display = 'none';
  }
  document.removeEventListener('keydown', handlePreviewKeyDown);
}

function handlePreviewKeyDown(e) {
  if (e.key === 'Escape') {
    closeCustomerProductPreview();
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    prevCustomerPreviewImage();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    nextCustomerPreviewImage();
  } else if (e.key === '+' || e.key === '=') {
    zoomInCustomerPreview();
  } else if (e.key === '-') {
    zoomOutCustomerPreview();
  } else if (e.key === '0') {
    resetCustomerPreviewZoom();
  }
}

function zoomInCustomerPreview(e) {
  if (e) e.stopPropagation();
  previewGallery.zoom = Math.min(6, Math.round((previewGallery.zoom + 0.35) * 100) / 100);
  applyCustomerPreviewTransform();
}

function zoomOutCustomerPreview(e) {
  if (e) e.stopPropagation();
  previewGallery.zoom = Math.max(0.7, Math.round((previewGallery.zoom - 0.35) * 100) / 100);
  if (previewGallery.zoom <= 1) {
    previewGallery.panX = 0;
    previewGallery.panY = 0;
  }
  applyCustomerPreviewTransform();
}

function resetCustomerPreviewZoom(e) {
  if (e) e.stopPropagation();
  previewGallery.zoom = 1;
  previewGallery.panX = 0;
  previewGallery.panY = 0;
  applyCustomerPreviewTransform();
}

function toggleFullscreenPreview(e) {
  if (e) e.stopPropagation();
  const modal = document.getElementById('customerProductPreviewModal');
  if (!modal) return;
  if (!document.fullscreenElement) {
    modal.requestFullscreen?.() || modal.webkitRequestFullscreen?.();
  } else {
    document.exitFullscreen?.() || document.webkitExitFullscreen?.();
  }
}

function applyCustomerPreviewTransform() {
  const img = document.getElementById('custPrevImage');
  const label = document.getElementById('custPrevZoomLabel');
  const wrapper = document.getElementById('custPrevImageWrapper');
  if (!img) return;

  img.style.transform = `translate(${previewGallery.panX}px, ${previewGallery.panY}px) scale(${previewGallery.zoom})`;

  if (label) {
    label.textContent = `${Math.round(previewGallery.zoom * 100)}%`;
  }

  if (wrapper) {
    wrapper.style.cursor = previewGallery.zoom > 1 ? (previewGallery.isDragging ? 'grabbing' : 'grab') : 'zoom-in';
  }
}

function handleImageWrapperClick(e) {
  if (e.target.id === 'custPrevImageWrapper' && !previewGallery.hasDragged) {
    closeCustomerProductPreview();
  }
}

let previewInteractionInitialized = false;
function initPreviewInteraction() {
  if (previewInteractionInitialized) return;
  previewInteractionInitialized = true;

  const wrapper = document.getElementById('custPrevImageWrapper');
  const img = document.getElementById('custPrevImage');
  if (!wrapper || !img) return;

  // ØªÙƒØ¨ÙŠØ± Ø¨Ø§Ù„Ù†Ù‚Ø± Ø§Ù„Ù…Ø²Ø¯ÙˆØ¬ Ø¹Ù„Ù‰ Ø§Ù„ØµÙˆØ±Ø©
  img.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (previewGallery.zoom > 1) {
      resetCustomerPreviewZoom();
    } else {
      previewGallery.zoom = 2.5;
      applyCustomerPreviewTransform();
    }
  });

  // ØªÙƒØ¨ÙŠØ±/ØªØµØºÙŠØ± Ø¨Ø¹Ø¬Ù„Ø© Ø§Ù„Ù…Ø§ÙˆØ³ ÙÙŠ Ù…ÙˆØ¶Ø¹ Ø§Ù„Ù…Ø¤Ø´Ø±
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomInCustomerPreview();
    } else {
      zoomOutCustomerPreview();
    }
  }, { passive: false });

  // Ø§Ù„Ø³Ø­Ø¨ Ø¨Ø§Ù„Ù…Ø§ÙˆØ³ Ù„Ù„ØªÙ†Ù‚Ù„ Ø¯Ø§Ø®Ù„ ØªÙØ§ØµÙŠÙ„ Ø§Ù„ØµÙˆØ±Ø© Ø¹Ù†Ø¯ Ø§Ù„ØªÙƒØ¨ÙŠØ±
  wrapper.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    previewGallery.isDragging = true;
    previewGallery.hasDragged = false;
    previewGallery.startX = e.clientX - previewGallery.panX;
    previewGallery.startY = e.clientY - previewGallery.panY;
    applyCustomerPreviewTransform();
  });

  window.addEventListener('mousemove', (e) => {
    if (!previewGallery.isDragging) return;
    if (previewGallery.zoom <= 1) return;
    previewGallery.hasDragged = true;
    previewGallery.panX = e.clientX - previewGallery.startX;
    previewGallery.panY = e.clientY - previewGallery.startY;
    applyCustomerPreviewTransform();
  });

  window.addEventListener('mouseup', () => {
    if (previewGallery.isDragging) {
      previewGallery.isDragging = false;
      applyCustomerPreviewTransform();
    }
  });

  // Ø§Ù„Ø³Ø­Ø¨ ÙˆØ§Ù„ØªÙƒØ¨ÙŠØ± Ø¨Ø§Ù„Ù„Ù…Ø³ Ù„Ø´Ø§Ø´Ø§Øª Ø§Ù„Ù‡ÙˆØ§ØªÙ ÙˆØ§Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ø°ÙƒÙŠØ©
  let touchStartDist = 0;
  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      previewGallery.isDragging = true;
      previewGallery.hasDragged = false;
      previewGallery.startX = e.touches[0].clientX - previewGallery.panX;
      previewGallery.startY = e.touches[0].clientY - previewGallery.panY;
    } else if (e.touches.length === 2) {
      touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && previewGallery.isDragging && previewGallery.zoom > 1) {
      previewGallery.hasDragged = true;
      previewGallery.panX = e.touches[0].clientX - previewGallery.startX;
      previewGallery.panY = e.touches[0].clientY - previewGallery.startY;
      applyCustomerPreviewTransform();
    } else if (e.touches.length === 2 && touchStartDist > 0) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = (currentDist - touchStartDist) / 150;
      previewGallery.zoom = Math.max(0.7, Math.min(6, previewGallery.zoom + diff));
      touchStartDist = currentDist;
      applyCustomerPreviewTransform();
    }
  }, { passive: true });

  wrapper.addEventListener('touchend', () => {
    previewGallery.isDragging = false;
    touchStartDist = 0;
  });
}

function openImageFullscreen(src) {
  if (!src) return;
  window.open(src, '_blank');
}

async function saveProductFromModal() {
  const id = document.getElementById('editProductId').value;
  const code = document.getElementById('prodCode').value.trim();
  const name = document.getElementById('prodName').value.trim();
  const category = document.getElementById('prodCategory').value.trim();
  const costPrice = parseFloat(document.getElementById('prodCostPrice').value);
  const sellPrice = parseFloat(document.getElementById('prodSellPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value) || 0;
  const description = document.getElementById('prodDescription').value.trim();

  // ØªØ¬Ù…ÙŠØ¹ Ù…ØµÙÙˆÙØ© Ø§Ù„ØµÙˆØ±
  const images = state.editingProductImages || [];
  const image = images.length > 0 ? images[0] : (document.getElementById('prodImageUrl')?.value?.trim() || '');

  if (!name) {
    showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬', 'error');
    return;
  }

  if (isNaN(costPrice) || isNaN(sellPrice)) {
    showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ ÙˆØ³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹ Ø¨Ø´ÙƒÙ„ ØµØ­ÙŠØ­', 'error');
    return;
  }

  // Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù…ÙƒØªÙˆØ¨Ø© Ø£Ùˆ Ø§Ù„Ù…ÙƒØªØ´ÙØ© ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹
  const brandInputVal = document.getElementById('prodBrandInput')?.value?.trim();
  const detectedBrand = document.getElementById('prodDetectedBrand')?.value?.trim();
  const detectedBrandAr = document.getElementById('prodDetectedBrandAr')?.value?.trim();
  const finalBrand = brandInputVal || detectedBrand || 'Ø£Ø®Ø±Ù‰';
  const finalBrandAr = (finalBrand === detectedBrand && detectedBrandAr) ? detectedBrandAr : finalBrand;

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id || undefined,
        code,
        name,
        category,
        brand: finalBrand,
        brandAr: finalBrandAr,
        costPrice,
        sellPrice,
        stock,
        image,
        images,
        description
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(id ? 'ØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬ Ø¨Ù†Ø¬Ø§Ø­' : 'ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ù†ØªØ¬ Ø¨Ù†Ø¬Ø§Ø­', 'success');
      closeProductModal();
      await loadProducts();
      if (state.isAddingProductForInvoice && data.product) {
        addToCart(data.product.id);
        state.isAddingProductForInvoice = false;
        switchTab('create-invoice');
      }
    } else {
      showToast(data.error || 'ÙØ´Ù„ Ø­ÙØ¸ Ø§Ù„Ù…Ù†ØªØ¬', 'error');
    }
  } catch (err) {
    showToast('Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…', 'error');
  }
}

async function confirmDeleteProduct(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  if (!confirm(`Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø­Ø°Ù Ø§Ù„Ù…Ù†ØªØ¬: "${prod.name}"ØŸ`)) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('ØªÙ… Ø­Ø°Ù Ø§Ù„Ù…Ù†ØªØ¬ Ø¨Ù†Ø¬Ø§Ø­', 'success');
      removeFromCart(id);
      await loadProducts();
    } else {
      showToast('ÙØ´Ù„ Ø­Ø°Ù Ø§Ù„Ù…Ù†ØªØ¬', 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…', 'error');
  }
}

// -------------------------------------------------------------
// Ø¥Ø¯Ø§Ø±Ø© Ø³Ù„Ø© ÙˆØ¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆØ§Ù„Ø¨Ø­Ø« Ø§Ù„Ù…Ø±Ø¦ÙŠ Ø§Ù„Ø°ÙƒÙŠ
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
  const mobCartBadge = document.getElementById('mobCartCountBadge');
  if (mobCartBadge) {
    mobCartBadge.style.display = totalItemsCount > 0 ? 'inline-flex' : 'none';
    mobCartBadge.textContent = totalItemsCount;
  }
  const totalAmount = state.cart.reduce((sum, i) => sum + (i.quantity * i.sellPrice), 0);
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

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
// Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù…Ø±Ø¦ÙŠ Ø§Ù„Ø°ÙƒÙŠ Ø¹Ù† Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª (Visual Live Search)
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
      // Ø¥Ø°Ø§ ÙƒØ§Ù† Ù‡Ù†Ø§Ùƒ Ù†ØªØ§Ø¦Ø¬ Ø¸Ø§Ù‡Ø±Ø©ØŒ Ø£Ø¶Ù Ø§Ù„Ù†ØªÙŠØ¬Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰ ÙÙˆØ±Ø§Ù‹
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

  // Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø¹Ù†Ø¯ Ø§Ù„Ù†Ù‚Ø± Ø®Ø§Ø±Ø¬ Ø§Ù„Ù…Ø±Ø¨Ø¹
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
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

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
        <span style="font-size: 1.8rem;">ðŸ”</span>
        <div>Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø£ÙŠ ØµÙ†Ù ÙŠØ·Ø§Ø¨Ù‚: "<strong>${escapeHtml(query)}</strong>"</div>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.35rem;">ØªØ£ÙƒØ¯ Ù…Ù† ÙƒØªØ§Ø¨Ø© Ø¬Ø²Ø¡ Ù…Ù† Ø§Ø³Ù… Ø§Ù„Ù…Ù†ØªØ¬ Ø£Ùˆ Ø§Ù„ÙƒÙˆØ¯ Ø£Ùˆ Ø§Ù„Ù…Ø§Ø±ÙƒØ©</div>
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
    let stockBadgeText = `Ù…ØªÙˆÙØ±: ${stock}`;
    if (stock <= 0) {
      stockBadgeClass = 'stock-out';
      stockBadgeText = 'Ù†ÙØ¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†';
    } else if (stock <= 3) {
      stockBadgeClass = 'stock-low';
      stockBadgeText = `Ù…ØªØ¨Ù‚ÙŠ: ${stock} ÙÙ‚Ø·`;
    }

    return `
      <div class="live-search-item" onclick="selectLiveSearchResult('${prod.id}')" title="Ø§Ù†Ù‚Ø± Ù„Ø¥Ø¶Ø§ÙØ© Ù‡Ø°Ø§ Ø§Ù„ØµÙ†Ù ÙÙˆØ±Ø§Ù‹ Ù„Ù„ÙØ§ØªÙˆØ±Ø©">
        <div class="live-item-thumb">
          <img src="${imageUrl}" alt="${escapeHtml(prod.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'">
        </div>
        <div class="live-item-info">
          <div class="live-item-top">
            <span class="live-item-code">[${escapeHtml(prod.code || 'ÙƒÙˆØ¯')}]</span>
            <strong class="live-item-name">${escapeHtml(prod.name)}</strong>
          </div>
          <div class="live-item-meta">
            <span class="live-item-cat">ðŸ“ ${escapeHtml(prod.category || 'Ø¹Ø§Ù…')}</span>
            <span class="live-item-stock ${stockBadgeClass}">${stockBadgeText}</span>
          </div>
        </div>
        <div class="live-item-pricing">
          <div class="live-item-price">${sell.toLocaleString('en-US')} <small>${currency}</small></div>
          <div class="live-item-profit">Ø±Ø¨Ø­: +${profit.toLocaleString('en-US')} ${currency}</div>
        </div>
        <div style="display: flex; gap: 0.35rem; align-items: center;">
          <button type="button" class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); openProductCustomerPreview('${prod.id}')" title="Ù…Ø¹Ø§ÙŠÙ†Ø© ÙˆØ¹Ø±Ø¶ ØµÙˆØ±Ø© Ø§Ù„ØµÙ†Ù Ù„Ù„Ø¹Ù…ÙŠÙ„">
            <span>ðŸ‘ï¸</span>
          </button>
          <button type="button" class="btn btn-sm btn-primary btn-live-add" onclick="event.stopPropagation(); selectLiveSearchResult('${prod.id}')" title="Ø¥Ø¶Ø§ÙØ© Ù„Ù„ÙØ§ØªÙˆØ±Ø©">
            <span>âž•</span>
            <span>Ø¥Ø¶Ø§ÙØ©</span>
          </button>
        </div>
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
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  if (datalist) {
    datalist.innerHTML = state.products.map(p => `
      <option value="${p.code} - ${p.name}">Ø³Ø¹Ø±: ${p.sellPrice.toLocaleString('en-US')} ${currency} (Ø±Ø¨Ø­: ${(p.sellPrice - p.costPrice).toLocaleString('en-US')})</option>
    `).join('');
  }

  if (select) {
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Ø£Ùˆ ØªØµÙØ­ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ÙƒØ§Ù…Ù„Ø© Ù„Ù„Ø£ØµÙ†Ø§Ù (' + state.products.length.toLocaleString('en-US') + ' ØµÙ†Ù) --</option>' +
      state.products.map(p => `
        <option value="${p.id}">[${p.code}] ${p.name} - Ø³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹: ${p.sellPrice.toLocaleString('en-US')} ${currency} (Ø±Ø¨Ø­: ${(p.sellPrice - p.costPrice).toLocaleString('en-US')})</option>
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
    showToast('Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù…Ù†ØªØ¬ ÙŠØ·Ø§Ø¨Ù‚ Ø§Ù„Ø¨Ø­Ø«', 'warning');
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
    showToast('ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ù…Ù†ØªØ¬ Ø£Ùˆ ÙƒØªØ§Ø¨Ø© Ø§Ø³Ù…Ù‡ ÙÙŠ Ø®Ø§Ù†Ø© Ø§Ù„Ø¨Ø­Ø« Ø£ÙˆÙ„Ø§Ù‹', 'info');
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
  showToast(`ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© "${prod.name}" Ù„Ù„ÙØ§ØªÙˆØ±Ø©`, 'success', 'Ø§Ù„Ø°Ù‡Ø§Ø¨ Ù„Ù„ÙØ§ØªÙˆØ±Ø© ðŸ§¾', () => jumpToInvoiceDirectly());
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
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const isPurchase = state.invoiceType === 'purchase';

  // Ø¶Ø¨Ø· Ø¸Ù‡ÙˆØ± Ø£Ø¹Ù…Ø¯Ø© Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ø¨Ø­Ø³Ø¨ Ù†ÙˆØ¹ Ø§Ù„ÙØ§ØªÙˆØ±Ø©
  const colSell = document.querySelectorAll('.col-sell-price');
  const colProfit = document.querySelectorAll('.col-profit');
  const thTotal = document.getElementById('thTotalItem');

  colSell.forEach(el => el.style.display = isPurchase ? 'none' : '');
  colProfit.forEach(el => el.style.display = isPurchase ? 'none' : '');
  if (thTotal) {
    thTotal.textContent = isPurchase ? 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø´Ø±Ø§Ø¡ (Ø§Ù„ØªÙƒÙ„ÙØ©)' : 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¨ÙŠØ¹';
  }

  const totalItemsCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);
  const mobCartBadge = document.getElementById('mobCartCountBadge');
  if (mobCartBadge) {
    mobCartBadge.style.display = totalItemsCount > 0 ? 'inline-flex' : 'none';
    mobCartBadge.textContent = totalItemsCount;
  }

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
        // ÙÙŠ ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª: ÙÙ‚Ø· Ø³Ø¹Ø± Ø§Ù„Ø´Ø±Ø§Ø¡ (Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„) ÙˆØ§Ù„ÙƒÙ…ÙŠØ© ÙˆØ§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠØŒ Ø¨Ø¯ÙˆÙ† Ø³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹ ÙˆØ¨Ø¯ÙˆÙ† Ø§Ù„Ø±Ø¨Ø­
        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <img src="${item.productImage || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'}" class="item-thumb" alt="${item.productName}">
                <div>
                  <strong style="display: block;">${item.productName}</strong>
                  <span style="font-size: 0.78rem; color: #047857; font-weight: 600;">ðŸ“¥ ØªÙˆØ±ÙŠØ¯ Ø¨Ø¶Ø§Ø¹Ø© Ù„Ù„Ù…Ø®Ø²Ù†</span>
                </div>
              </div>
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.25rem;">
                <input type="number" class="form-control" style="width: 105px; padding: 0.35rem 0.5rem; font-weight: 700; text-align: center; color: #475569;"
                       value="${item.costPrice}" min="0" step="any"
                       onchange="updateCartItemCostPrice('${item.productId}', parseFloat(this.value) || 0)"
                       title="ØªØ¹Ø¯ÙŠÙ„ Ø³Ø¹Ø± Ø§Ù„Ø´Ø±Ø§Ø¡ / Ø§Ù„ØªÙƒÙ„ÙØ© Ù„Ù„Ù‚Ø·Ø¹Ø©">
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
              <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.productId}')">âœ•</button>
            </td>
          </tr>
        `;
      }

      // ÙÙŠ ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª: ÙƒØ§Ù…Ù„ Ø§Ù„ØªÙØ§ØµÙŠÙ„ ÙˆØ³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹ ÙˆØ§Ù„Ø±Ø¨Ø­
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img src="${item.productImage || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'}" class="item-thumb" alt="${item.productName}">
              <div>
                <strong style="display: block;">${item.productName}</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted);">Ø±Ø¨Ø­ Ø§Ù„Ù‚Ø·Ø¹Ø©: +${unitProfit.toLocaleString('en-US')} ${currency}</span>
              </div>
            </div>
          </td>
          <td style="color: #475569; font-weight: 600;">${item.costPrice.toLocaleString('en-US')} ${currency}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.25rem;">
              <input type="number" class="form-control" style="width: 105px; padding: 0.35rem 0.5rem; font-weight: 700; text-align: center; color: var(--primary-dark);"
                     value="${item.sellPrice}" min="0" step="any"
                     onchange="updateCartItemSellPrice('${item.productId}', parseFloat(this.value) || 0)"
                     title="ØªØ¹Ø¯ÙŠÙ„ Ø³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹ Ø§Ù„Ù…ØªÙÙ‚ Ø¹Ù„ÙŠÙ‡ Ù…Ø¹ Ø§Ù„Ø²Ø¨ÙˆÙ†">
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
            <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.productId}')">âœ•</button>
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
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const isPurchase = state.invoiceType === 'purchase';

  let totalQty = 0;
  let totalCost = 0;
  let totalAmount = 0;

  state.cart.forEach(item => {
    totalQty += item.quantity;
    totalCost += item.costPrice * item.quantity;
    totalAmount += (isPurchase ? item.costPrice : item.sellPrice) * item.quantity;
  });

  // Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† ÙˆØ¬ÙˆØ¯ Ø³Ø¹Ø± Ù…Ø®ØµØµ ÙŠØ¯ÙˆÙŠØ§Ù‹
  const overrideInput = document.getElementById('customTotalOverride');
  const overrideVal = overrideInput ? parseFloat(overrideInput.value) : NaN;
  const effectiveTotal = (!isPurchase && !isNaN(overrideVal) && overrideVal > 0) ? overrideVal : totalAmount;

  const totalProfit = isPurchase ? 0 : (effectiveTotal - totalCost);
  const profitMargin = (!isPurchase && effectiveTotal > 0) ? ((totalProfit / effectiveTotal) * 100).toFixed(1) : 0;

  // ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¨Ø·Ø§Ù‚Ø© Ø§Ù„Ø¬Ø§Ù†Ø¨ÙŠØ©
  const elQty = document.getElementById('sumTotalQty');
  const elCost = document.getElementById('sumTotalCost');
  const elProfit = document.getElementById('sumTotalProfit');
  const elAmount = document.getElementById('sumTotalAmount');
  const rowCost = document.getElementById('rowSumCost');
  const rowProfit = document.getElementById('rowSumProfit');
  const sumLabelFinal = document.getElementById('sumLabelFinalAmount');
  const customPriceBlock = document.getElementById('customPriceBlock');

  if (elQty) elQty.textContent = `${totalQty} Ù‚Ø·Ø¹Ø©`;

  // Ø¥Ø®ÙØ§Ø¡ Ø­Ù‚Ù„ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ ÙÙŠ ÙˆØ¶Ø¹ Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª
  if (customPriceBlock) customPriceBlock.style.display = isPurchase ? 'none' : 'block';

  if (isPurchase) {
    if (rowCost) rowCost.style.display = 'none';
    if (rowProfit) rowProfit.style.display = 'none';
    if (sumLabelFinal) sumLabelFinal.textContent = 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ù‚ÙŠÙ…Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª (Ø§Ù„Ù…Ø¶Ø§ÙØ© Ù„Ù„Ù…Ø®Ø²Ù†):';
    if (elAmount) elAmount.textContent = `${totalCost.toLocaleString('en-US')} ${currency}`;
  } else {
    if (rowCost) rowCost.style.display = 'flex';
    if (rowProfit) rowProfit.style.display = 'flex';
    if (sumLabelFinal) sumLabelFinal.textContent = 'Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ Ù„Ù„ÙØ§ØªÙˆØ±Ø©:';
    if (elCost) elCost.textContent = `${totalCost.toLocaleString('en-US')} ${currency}`;
    // ØªÙ„ÙˆÙŠÙ† Ø§Ù„Ø±Ø¨Ø­ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ (Ø£Ø®Ø¶Ø± = Ø±Ø¨Ø­ØŒ Ø£Ø­Ù…Ø± = Ø®Ø³Ø§Ø±Ø©)
    if (elProfit) {
      elProfit.style.color = totalProfit >= 0 ? 'var(--success-dark)' : '#dc2626';
      elProfit.textContent = `${totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString('en-US')} ${currency} (${profitMargin}%)`;
    }
    if (elAmount) {
      elAmount.textContent = `${effectiveTotal.toLocaleString('en-US')} ${currency}`;
      // Ø¥Ø¸Ù‡Ø§Ø± ÙØ±Ù‚ Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ù…Ø¹Ø¯Ù‘Ù„ Ø¹Ù† Ø§Ù„Ù…Ø­Ø³ÙˆØ¨
      const diffEl = document.getElementById('customPriceDiff');
      if (diffEl && !isNaN(overrideVal) && overrideVal > 0) {
        const diff = overrideVal - totalAmount;
        if (Math.abs(diff) > 0.01) {
          const sign = diff > 0 ? '+' : '';
          diffEl.style.color = diff > 0 ? '#16a34a' : '#dc2626';
          diffEl.textContent = `ÙØ±Ù‚ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„: ${sign}${diff.toLocaleString('en-US')} ${currency} Ø¹Ù† Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ù…Ø­Ø³ÙˆØ¨ (${totalAmount.toLocaleString('en-US')} ${currency})`;
          diffEl.style.display = 'block';
        } else {
          diffEl.style.display = 'none';
        }
      } else if (diffEl) {
        diffEl.style.display = 'none';
      }
    }
  }

  // Ø­Ø³Ø§Ø¨ Ø§Ù„Ø£Ù‚Ø³Ø§Ø· Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ù…Ø®ØªØ§Ø±Ø©
  calculateInstallments(effectiveTotal);
}

function applyCustomTotal(val) {
  updateInvoiceSummary();
}

function clearCustomTotal() {
  const inp = document.getElementById('customTotalOverride');
  if (inp) inp.value = '';
  const diffEl = document.getElementById('customPriceDiff');
  if (diffEl) diffEl.style.display = 'none';
  updateInvoiceSummary();
}


// Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹
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
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
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

// Ø¥Ø±Ø³Ø§Ù„ ÙˆØ¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙØ§ØªÙˆØ±Ø©
async function submitInvoice(isQuotation) {
  const employeeName = document.getElementById('invEmployeeName').value.trim();
  const customerName = document.getElementById('invCustomerName').value.trim();
  const customerPhone = document.getElementById('invCustomerPhone').value.trim();
  const notes = document.getElementById('invNotes').value.trim();

  // Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ù…Ø¯Ø®Ù„Ø§Øª
  if (!employeeName) {
    showToast('ÙŠØ±Ø¬Ù‰ ÙƒØªØ§Ø¨Ø© Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ Ø£ÙˆÙ„Ø§Ù‹', 'error');
    document.getElementById('invEmployeeName').focus();
    return;
  }

  if (!customerName) {
    showToast('ÙŠØ±Ø¬Ù‰ ÙƒØªØ§Ø¨Ø© Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ†', 'error');
    document.getElementById('invCustomerName').focus();
    return;
  }

  if (state.cart.length === 0) {
    showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¶Ø§ÙØ© Ù…Ù†ØªØ¬ ÙˆØ§Ø­Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„ Ù„Ù„ÙØ§ØªÙˆØ±Ø©', 'error');
    return;
  }

  // Ø­ÙØ¸ Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù ÙÙŠ Ø§Ù„Ø°Ø§ÙƒØ±Ø© Ù„ØªØ³Ù‡ÙŠÙ„ Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©
  localStorage.setItem('last_employee_name', employeeName);

  let installmentDetails = null;
  if (state.currentPaymentMethod === 'installments') {
    const downPayment = parseFloat(document.getElementById('instDownPayment').value) || 0;
    const durationNumber = document.getElementById('instDurationNumber').value.trim();
    const durationType = document.getElementById('instDurationType').value;
    const scheduleNotes = document.getElementById('instScheduleNotes').value.trim();

    if (!durationNumber || parseInt(durationNumber) <= 0) {
      showToast('ÙŠØ±Ø¬Ù‰ ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù…Ø¯Ø© Ø§Ù„ØªÙŠ Ø³ÙŠØ¯ÙØ¹ ÙÙŠÙ‡Ø§ Ø§Ù„Ø²Ø¨ÙˆÙ† Ø¨Ø§Ù‚ÙŠ Ø§Ù„Ù…Ø¨Ù„Øº', 'error');
      document.getElementById('instDurationNumber').focus();
      return;
    }

    const durationLabel = durationType === 'months' ? 'Ø´Ù‡Ø±' : 'ÙŠÙˆÙ…';
    const duration = `${durationNumber} ${durationLabel}`;

    // Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ù…Ø¹Ø¯Ù‘Ù„ Ø¥Ù† ÙˆØ¬Ø¯
    const overrideInput = document.getElementById('customTotalOverride');
    const overrideVal = overrideInput ? parseFloat(overrideInput.value) : NaN;
    const baseTotal = state.cart.reduce((s, i) => s + (i.sellPrice * i.quantity), 0);
    const totalAmount = (!isNaN(overrideVal) && overrideVal > 0) ? overrideVal : baseTotal;
    const remainingAmount = Math.max(0, totalAmount - downPayment);

    installmentDetails = {
      downPayment,
      remainingAmount,
      duration,
      scheduleNotes
    };
  }

  const isPurchase = state.invoiceType === 'purchase';
  const isQuotationMode = !!isQuotation && !isPurchase;

  // Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ù…Ø¹Ø¯Ù‘Ù„ ÙŠØ¯ÙˆÙŠØ§Ù‹ (Ø¥Ù† ÙˆØ¬Ø¯)
  const overrideInput = document.getElementById('customTotalOverride');
  const customTotalOverride = (!isPurchase && overrideInput && parseFloat(overrideInput.value) > 0)
    ? parseFloat(overrideInput.value)
    : null;

  // Ù…Ø¯Ø© Ø§Ù„ÙƒÙØ§Ù„Ø©
  const warrantyMonthsEl = document.getElementById('warrantyMonthsSelect');
  const warrantyMonths = (warrantyMonthsEl && !isPurchase && !isQuotationMode)
    ? parseInt(warrantyMonthsEl.value) || 12
    : 0;

  const payload = {
    invoiceType: state.invoiceType || 'sales',
    isQuotation: isQuotationMode,
    warrantyMonths,
    employeeName,
    customerName,
    customerPhone,
    customerId: state.selectedInvoiceCustomer ? state.selectedInvoiceCustomer.id : undefined,
    customerSystemNumber: state.selectedInvoiceCustomer ? state.selectedInvoiceCustomer.systemNumber : undefined,
    notes,
    items: state.cart,
    paymentMethod: isPurchase ? 'cash' : state.currentPaymentMethod,
    installmentDetails: isPurchase ? null : installmentDetails,
    customTotalOverride  // Ø§Ù„Ø³Ø¹Ø± Ø§Ù„Ù…Ø¹Ø¯Ù‘Ù„ ÙŠØ¯ÙˆÙŠØ§Ù‹ (null = Ø§Ø³ØªØ®Ø¯Ù… Ø§Ù„Ù…Ø­Ø³ÙˆØ¨)
  };

  const btn = document.getElementById('btnSubmitInvoice');
  const btnQ = document.getElementById('btnSubmitQuotation');
  btn.disabled = true;
  if (btnQ) btnQ.disabled = true;
  btn.innerHTML = isPurchase
    ? '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ Ø­ÙØ¸ ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØ²ÙŠØ§Ø¯Ø© Ø§Ù„Ù…Ø®Ø²Ù† ÙˆØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...</span>'
    : isQuotationMode
      ? '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ Ø­ÙØ¸ ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø¹Ø±Ø¶...</span>'
      : '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ Ø­ÙØ¸ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆØ¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø± Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...</span>';

  try {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.invoice) {
      if (isPurchase) {
        showToast('ðŸŽ‰ ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØ²ÙŠØ§Ø¯Ø© ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ù…Ø®Ø²Ù† Ø¨Ù†Ø¬Ø§Ø­!', 'success');
      } else if (isQuotationMode) {
        showToast('ðŸ“„ ØªÙ… Ø­ÙØ¸ ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø¹Ø±Ø¶ Ù„Ù„Ø¹Ø±Ø¶ ÙÙ‚Ø· Ø¨Ù†Ø¬Ø§Ø­! (Ù„Ù… ÙŠÙØ®ØµÙŽÙ… Ù…Ù† Ø§Ù„Ù…Ø®Ø²ÙˆÙ†)', 'success');
      } else {
        showToast('ðŸŽ‰ ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª Ø¨Ù†Ø¬Ø§Ø­!', 'success');
        // Ø¥Ø´Ø¹Ø§Ø± Ø¨Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙƒÙØ§Ù„Ø©
        if (warrantyMonths > 0) {
          setTimeout(() => showToast('ðŸ›¡ï¸ ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ ÙˆØ«ÙŠÙ‚Ø© Ø§Ù„ÙƒÙØ§Ù„Ø© ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ ÙÙŠ ØªØ¨ÙˆÙŠØ¨ Ø§Ù„ÙƒÙØ§Ù„Ø§Øª', 'info'), 1500);
        }
      }

      // ÙØ­Øµ Ù†ØªÙŠØ¬Ø© ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
      if (data.telegramNotification && data.telegramNotification.ok) {
        showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ØªÙØ§ØµÙŠÙ„ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙƒØ§Ù…Ù„Ø© Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­', 'success');
      } else if (data.invoice.telegramStatus && !data.invoice.telegramStatus.sent) {
        showToast(`âš ï¸ ØªÙ†Ø¨ÙŠÙ‡ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…: ${data.invoice.telegramStatus.error || 'Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¥Ø±Ø³Ø§Ù„'}`, 'warning');
      }

      // Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ø§Ù„Ø±Ø³Ù…ÙŠ Ù„Ù„ÙØ§ØªÙˆØ±Ø© ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
      try {
        await sendInvoicePdfToTelegram(data.invoice);
      } catch (pdfErr) {
        console.warn('Auto send invoice PDF to Telegram error:', pdfErr);
      }

      // ØªÙØ±ÙŠØº Ø§Ù„Ø³Ù„Ø© ÙˆØ§Ù„Ù…Ø¯Ø®Ù„Ø§Øª Ù…Ø¹ Ø§Ù„Ø¥Ø¨Ù‚Ø§Ø¡ Ø¹Ù„Ù‰ Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù
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

      // ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø³Ø¬Ù„ ÙˆØ§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª ÙˆØ§Ù„Ø²Ø¨Ø§Ø¦Ù†
      await loadProducts();
      renderCatalog();
      loadInvoices();
      loadDashboard();
      await loadCustomers();

      // ÙØªØ­ Ù†Ø§ÙØ°Ø© Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© ÙˆØ§Ù„Ø·Ø¨Ø§Ø¹Ø© Ù…Ø¨Ø§Ø´Ø±Ø© Ù„Ù„ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©
      openInvoiceViewModal(data.invoice);

    } else {
      showToast(data.error || 'ÙØ´Ù„ Ø­ÙØ¸ Ø§Ù„ÙØ§ØªÙˆØ±Ø©', 'error');
    }
  } catch (err) {
    showToast('Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…', 'error');
  } finally {
    btn.disabled = false;
    if (btnQ) btnQ.disabled = false;
    btn.innerHTML = isPurchase
      ? '<span>ðŸš€</span><span>Ø¥Ù†Ø´Ø§Ø¡ ÙØ§ØªÙˆØ±Ø© Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØªÙˆØ±ÙŠØ¯ Ø§Ù„Ø¨Ø¶Ø§Ø¹Ø© Ù„Ù„Ù…Ø®Ø²Ù†</span>'
      : '<span>ðŸš€</span><span>Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆØ¥Ø±Ø³Ø§Ù„ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…</span>';
  }
}

// -------------------------------------------------------------
// Ø£Ø±Ø´ÙŠÙ ÙˆØ³Ø¬Ù„ Ø§Ù„ÙÙˆØ§ØªÙŠØ±
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
    console.error('ÙØ´Ù„ Ø¬Ù„Ø¨ Ø§Ù„ÙÙˆØ§ØªÙŠØ±:', err);
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
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

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

    const isQuotation = !!inv.isQuotation || inv.invoiceType === 'quotation';
    const isSales = !isQuotation && (inv.invoiceType === 'sales');
    const isPurchase = inv.invoiceType === 'purchase';

    const isInstallments = inv.paymentMethod === 'installments';
    const payBadge = isQuotation ? `
      <span class="badge" style="background:#7c3aed;color:white;font-weight:700;">ðŸ“„ Ø¹Ø±Ø¶ Ø³Ø¹Ø± (ØªÙ‚Ø¯ÙŠØ±ÙŠ)</span>
    ` : isInstallments ? `
      <span class="badge badge-warning" title="Ø§Ù„Ø¯ÙØ¹Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰: ${inv.installmentDetails?.downPayment} | Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ: ${inv.installmentDetails?.remainingAmount} (${inv.installmentDetails?.duration})">
        â³ Ø£Ù‚Ø³Ø§Ø· (${inv.installmentDetails?.duration || 'Ù…Ø¬Ø¯ÙˆÙ„Ø©'})
      </span>
    ` : `<span class="badge badge-success">ðŸ’µ ÙƒØ§Ø´</span>`;

    const tgSent = inv.telegramStatus && inv.telegramStatus.sent;
    const tgBadge = tgSent ? `
      <span class="badge badge-telegram" title="ØªÙ… Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ Ø¨Ù†Ø¬Ø§Ø­">âœˆï¸ ØªÙ… Ø§Ù„Ø¥Ø±Ø³Ø§Ù„</span>
    ` : `
      <span class="badge badge-danger" title="${inv.telegramStatus?.error || 'Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¥Ø±Ø³Ø§Ù„'}">âš ï¸ Ù„Ù… ÙŠØ±Ø³Ù„</span>
    `;

    let numBadge = '';
    if (isQuotation) numBadge = '<div style="font-size:0.72rem;color:#7c3aed;font-weight:700;">Ø¹Ø±Ø¶ Ø³Ø¹Ø±</div>';
    else if (isPurchase) numBadge = '<div style="font-size:0.72rem;color:#059669;font-weight:700;">Ù…Ø´ØªØ±ÙŠØ§Øª</div>';

    return `
      <tr style="${isQuotation ? 'background:#faf5ff;' : ''}">
        <td>
          <strong style="color: ${isQuotation ? '#7c3aed' : 'var(--primary-dark)'};">#${inv.invoiceNumber || inv.id}</strong>
          ${numBadge}
        </td>
        <td style="font-size: 0.82rem; color: var(--text-muted);">${dateStr}</td>
        <td><strong>${inv.employeeName || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯'}</strong></td>
        <td>
          <div><strong>${inv.customerName}</strong></div>
          ${inv.customerPhone ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${inv.customerPhone}</div>` : ''}
        </td>
        <td>${payBadge}</td>
        <td style="font-weight: 800;">${(inv.summary?.totalAmount || 0).toLocaleString('en-US')} ${currency}</td>
        <td style="color: ${isQuotation ? '#7c3aed' : 'var(--success-dark)'}; font-weight: 800;">${isQuotation ? '<span style="font-size:0.8rem;color:#7c3aed;">ØªÙ‚Ø¯ÙŠØ±ÙŠ</span>' : '+' + (inv.summary?.totalProfit || 0).toLocaleString('en-US') + ' ' + currency}</td>
        <td>${tgBadge}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-sm btn-primary" onclick="openInvoiceViewModalById('${inv.id}')" title="Ù…Ø¹Ø§ÙŠÙ†Ø© ÙˆØ·Ø¨Ø§Ø¹Ø©">
              ðŸ–¨ï¸ Ø¹Ø±Ø¶
            </button>
            ${isQuotation ? `
              <button class="btn btn-sm" style="background:#7c3aed;color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.78rem;font-weight:700;" onclick="convertQuotationToSales('${inv.id}')" title="ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø¹Ø±Ø¶ Ø¥Ù„Ù‰ Ù…Ø¨ÙŠØ¹Ø§Øª ÙØ¹Ù„ÙŠØ© ÙˆØ®ØµÙ… Ø§Ù„Ù…Ø®Ø²ÙˆÙ†">
                ðŸ”„ Ø§Ø¹ØªÙ…Ø§Ø¯ ÙˆÙ…Ø¨ÙŠØ¹Ø§Øª
              </button>
            ` : ''}
            ${isSales ? `
              <button class="btn btn-sm" style="background:#1d4ed8;color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.78rem;font-weight:700;" onclick="openWarrantyByInvoiceId('${inv.id}')" title="Ø¹Ø±Ø¶ ÙˆØ·Ø¨Ø§Ø¹Ø© ÙˆØ«ÙŠÙ‚Ø© Ø§Ù„ÙƒÙØ§Ù„Ø©">
                ðŸ›¡ï¸ ÙƒÙØ§Ù„Ø©
              </button>
            ` : ''}
            ${!tgSent ? `
              <button class="btn btn-sm btn-telegram" onclick="resendInvoiceTelegram('${inv.id}')" title="Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…">
                âœˆï¸
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// -------------------------------------------------------------
// Ù…Ø¹Ø§ÙŠÙ†Ø© ÙˆØ·Ø¨Ø§Ø¹Ø© Ø§Ù„ÙØ§ØªÙˆØ±Ø©
// -------------------------------------------------------------
function openInvoiceViewModalById(id) {
  const inv = state.invoices.find(i => i.id === id || i.invoiceNumber === parseInt(id));
  if (inv) openInvoiceViewModal(inv);
}

function openInvoiceViewModal(invoice) {
  state.currentViewingInvoice = invoice;
  setInvoicePrintMode('customer'); // Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ Ù†Ø³Ø®Ø© Ø§Ù„Ø²Ø¨ÙˆÙ†
  const btnWar = document.getElementById('btnModalInvoiceWarranty');
  const btnConv = document.getElementById('btnModalInvoiceConvertToSales');
  const isQuotation = !!invoice.isQuotation || invoice.invoiceType === 'quotation';
  const isSales = !isQuotation && (invoice.invoiceType === 'sales');

  if (btnWar) {
    btnWar.style.display = isSales ? 'inline-flex' : 'none';
  }
  if (btnConv) {
    btnConv.style.display = isQuotation ? 'inline-flex' : 'none';
  }
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

  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const isInternal = state.printMode === 'internal';

  const dateStr = formatAppDateTime(inv.createdAt);

  const isInstallments = inv.paymentMethod === 'installments';
  const inst = inv.installmentDetails || {};

  const isQuotation = !!inv.isQuotation || inv.invoiceType === 'quotation';

  container.innerHTML = `
    <div class="inv-header">
      <div>
        <div class="inv-company-title">${state.settings.companyName || 'Ø´Ø±ÙƒØ© Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª'}</div>
        <div class="inv-company-sub">${state.settings.companyAddress || ''} | Ù‡Ø§ØªÙ: ${state.settings.companyPhone || ''}</div>
        <div style="font-size: 0.8rem; font-weight: 700; color: ${isInternal ? 'var(--primary)' : (isQuotation ? '#7c3aed' : '#059669')}; margin-top: 0.25rem;">
          ${isInternal ? 'ðŸ”’ Ù†Ø³Ø®Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© ÙˆØ§Ù„Ù…Ø­Ø§Ø³Ø¨Ø© (ØªØªØ¶Ù…Ù† Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ ÙˆØ§Ù„Ø£Ø±Ø¨Ø§Ø­)' : (isQuotation ? 'ðŸ“„ Ø¹Ø±Ø¶ Ø³Ø¹Ø± ØªÙ‚Ø¯ÙŠØ±ÙŠ Ø±Ø³Ù…ÙŠ (Quotation) â€” Ø§Ù„Ø£ØµÙ†Ø§Ù Ù„Ù„Ø¹Ø±Ø¶ ÙÙ‚Ø· ÙˆØºÙŠØ± Ù…Ø®ØµÙˆÙ…Ø© Ù…Ù† Ø§Ù„Ù…Ø®Ø²ÙˆÙ†' : 'ðŸ“„ ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª Ø±Ø³Ù…ÙŠØ© - Ù†Ø³Ø®Ø© Ø§Ù„Ø²Ø¨ÙˆÙ†')}
        </div>
      </div>
      <div class="inv-number-badge" style="${isQuotation ? 'border-color:#c4b5fd; background:#faf5ff;' : ''}">
        <div class="inv-number-title" style="${isQuotation ? 'color:#7c3aed;' : ''}">${isQuotation ? 'Ø¹Ø±Ø¶ Ø³Ø¹Ø±' : 'ÙØ§ØªÙˆØ±Ø©'} #${inv.invoiceNumber || inv.id}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</div>
      </div>
    </div>

    <div class="inv-details-grid">
      <div>
        <strong>ðŸ‘¤ Ø§Ù„Ø¹Ù…ÙŠÙ„ / Ø§Ù„Ø²Ø¨ÙˆÙ†:</strong> ${inv.customerName}<br>
        ${inv.customerPhone ? `<strong>ðŸ“ž Ø§Ù„Ù‡Ø§ØªÙ:</strong> ${inv.customerPhone}<br>` : ''}
        ${inv.notes ? `<strong>ðŸ“ Ù…Ù„Ø§Ø­Ø¸Ø§Øª:</strong> ${inv.notes}` : ''}
      </div>
      <div>
        <strong>ðŸ‘¨â€ðŸ’¼ Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„:</strong> ${inv.employeeName || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯'}<br>
        <strong>ðŸ’³ Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹:</strong> ${isInstallments ? 'Ø£Ù‚Ø³Ø§Ø· Ù…Ø¬Ø¯ÙˆÙ„Ø©' : 'Ù†Ù‚Ø¯Ø§Ù‹ (ÙƒØ§Ø´)'}<br>
        <strong>ðŸ“… ØªØ§Ø±ÙŠØ® Ø§Ù„ÙØ§ØªÙˆØ±Ø©:</strong> ${dateStr}
      </div>
    </div>

    <!-- Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª -->
    <table class="inv-table">
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Ø§Ù„Ù…Ù†ØªØ¬ / Ø§Ù„ØµÙ†Ù</th>
          ${isInternal ? '<th>Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ (Ø§Ù„ØªÙƒÙ„ÙØ©)</th>' : ''}
          <th>Ø³Ø¹Ø± Ø§Ù„ÙˆØ­Ø¯Ø©</th>
          <th style="text-align: center;">Ø§Ù„ÙƒÙ…ÙŠØ©</th>
          <th style="text-align: left;">Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ</th>
          ${isInternal ? '<th style="text-align: left;">Ø±Ø¨Ø­ Ø§Ù„Ø¨Ù†Ø¯</th>' : ''}
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

    <!-- Ø§Ù„Ø£Ù‚Ø³Ø§Ø· Ø¥Ø°Ø§ ÙˆØ¬Ø¯Øª -->
    ${isInstallments ? `
      <div class="inv-installment-schedule">
        <h4 style="font-weight: 800; color: #92400e; margin-bottom: 0.4rem;">â³ ØªÙØ§ØµÙŠÙ„ ÙˆØ¬Ø¯ÙˆÙ„ Ø³Ø¯Ø§Ø¯ Ø§Ù„Ø£Ù‚Ø³Ø§Ø·:</h4>
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
          <div><strong>Ø§Ù„Ø¯ÙØ¹Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø©:</strong> ${(inst.downPayment || 0).toLocaleString('en-US')} ${currency}</div>
          <div><strong>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ Ù„Ù„ØªÙ‚Ø³ÙŠØ·:</strong> ${(inst.remainingAmount || 0).toLocaleString('en-US')} ${currency}</div>
          <div><strong>Ù…Ø¯Ø© Ø³Ø¯Ø§Ø¯ Ø¨Ø§Ù‚ÙŠ Ø§Ù„Ù…Ø¨Ù„Øº:</strong> ${inst.duration || 'Ø­Ø³Ø¨ Ø§Ù„Ø§ØªÙØ§Ù‚'}</div>
        </div>
        ${inst.scheduleNotes ? `<div style="margin-top: 0.4rem;"><strong>Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ù„Ø³Ø¯Ø§Ø¯:</strong> ${inst.scheduleNotes}</div>` : ''}
      </div>
    ` : ''}

    <!-- Ø§Ù„Ù…Ù„Ø®Øµ Ø§Ù„Ù…Ø§Ù„ÙŠ -->
    <div class="inv-totals-box">
      <table class="inv-totals-table">
        ${isInternal ? `
          <tr>
            <td style="color: #64748b;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ØªÙƒÙ„ÙØ© (Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„):</td>
            <td style="text-align: left; font-weight: 700; color: #64748b;">${(inv.summary?.totalCost || 0).toLocaleString('en-US')} ${currency}</td>
          </tr>
          <tr style="background: #f0fdf4;">
            <td style="color: #047857; font-weight: 800;">ØµØ§ÙÙŠ Ø£Ø±Ø¨Ø§Ø­ Ø§Ù„ÙØ§ØªÙˆØ±Ø©:</td>
            <td style="text-align: left; font-weight: 800; color: #047857;">+${(inv.summary?.totalProfit || 0).toLocaleString('en-US')} ${currency} (${inv.summary?.profitMarginPercentage || 0}%)</td>
          </tr>
        ` : ''}
        <tr class="total-row">
          <td>Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ:</td>
          <td style="text-align: left;">${(inv.summary?.totalAmount || 0).toLocaleString('en-US')} ${currency}</td>
        </tr>
      </table>
    </div>

    <div class="inv-footer">
      <p>${state.settings.invoiceFooterText || 'Ø´ÙƒØ±Ø§Ù‹ Ù„ØªØ¹Ø§Ù…Ù„ÙƒÙ… Ù…Ø¹Ù†Ø§'}</p>
    </div>
  `;
}

async function resendCurrentInvoiceTelegram() {
  if (!state.currentViewingInvoice) return;
  await resendInvoiceTelegram(state.currentViewingInvoice.id);
}

async function resendInvoiceTelegram(invoiceId) {
  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆÙ…Ù„Ù Ø§Ù„Ù€ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');
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
        showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆÙ…Ù„Ù Ø§Ù„Ù€ PDF Ø¨Ù†Ø¬Ø§Ø­ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…!', 'success');
      } else {
        showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ø¨Ù†Ø¬Ø§Ø­ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…!', 'success');
      }
    } else {
      showToast(`ÙØ´Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„: ${data.result?.error || data.error || 'Ø®Ø·Ø£ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ'}`, 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…', 'error');
  }
}

// -------------------------------------------------------------
// Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª (Dashboard) ÙˆØ¥Ø¯Ø§Ø±Ø© Ø§Ù„ÙØªØ±Ø§Øª Ø§Ù„Ø²Ù…Ù†ÙŠØ© ÙˆØ±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„
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
    let label = 'ðŸŒŸ ÙƒÙ„ Ø§Ù„Ø£ÙˆÙ‚Ø§Øª';
    if (period === 'week') label = 'ðŸ“… Ù‡Ø°Ø§ Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ (7 Ø£ÙŠØ§Ù…)';
    if (period === 'month') label = 'ðŸ—“ï¸ Ù‡Ø°Ø§ Ø§Ù„Ø´Ù‡Ø± (30 ÙŠÙˆÙ…Ø§Ù‹)';
    if (period === 'year') label = 'ðŸ“† Ù‡Ø°Ù‡ Ø§Ù„Ø³Ù†Ø©';
    badge.innerHTML = `Ø§Ù„ÙØªØ±Ø© Ø§Ù„Ù…Ø­Ø¯Ø¯Ø©: <strong>${label}</strong>`;
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
    
    // ÙˆØ¶Ø¹ ØªÙˆØ§Ø±ÙŠØ® Ø§ÙØªØ±Ø§Ø¶ÙŠØ© Ø¥Ù† Ù„Ù… ØªÙƒÙ† Ù…Ø­Ø¯Ø¯Ø©
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
    badge.innerHTML = `Ø§Ù„ÙØªØ±Ø© Ø§Ù„Ù…Ø­Ø¯Ø¯Ø©: <strong>ÙØªØ±Ø© Ù…Ø®ØµØµØ© (${startInput.value || 'Ø§Ù„Ø¨Ø¯Ø§ÙŠØ©'} Ø¥Ù„Ù‰ ${endInput.value || 'Ø§Ù„Ø¢Ù†'})</strong>`;
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
      const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

      // Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ£Ø±Ø¨Ø§Ø­ Ø§Ù„ÙØªØ±Ø© Ø§Ù„Ø²Ù…Ù†ÙŠØ© Ø§Ù„Ù…Ø­Ø¯Ø¯Ø©
      document.getElementById('kpiTotalSales').textContent = `${(stats.totalSales || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('kpiTotalProfit').textContent = `+${(stats.totalProfit || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('kpiTotalInvoices').textContent = `${stats.totalInvoicesCount || 0} ÙØ§ØªÙˆØ±Ø©`;
      document.getElementById('kpiInstallmentsRemaining').textContent = `${(stats.installmentsRemaining || 0).toLocaleString('en-US')} ${currency}`;

      // Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ ÙˆØ§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙƒÙ„ÙŠ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù… (Ø¨Ù†Ø§Ø¡Ù‹ Ø¹Ù„Ù‰ Ø§Ù„ÙƒÙ…ÙŠØ© Ã— Ø§Ù„ØªÙƒÙ„ÙØ©)
      const capEl = document.getElementById('kpiTotalInventoryCapital');
      if (capEl) capEl.textContent = `${(stats.totalInventoryCapital || 0).toLocaleString('en-US')} ${currency}`;

      const stockEl = document.getElementById('kpiTotalStockUnits');
      if (stockEl) stockEl.textContent = `${(stats.totalStockUnits || 0).toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©`;

      const retailEl = document.getElementById('kpiTotalInventoryRetail');
      if (retailEl) retailEl.textContent = `${(stats.totalInventoryRetail || 0).toLocaleString('en-US')} ${currency}`;

      const expProfitEl = document.getElementById('kpiExpectedInventoryProfit');
      if (expProfitEl) expProfitEl.textContent = `+${(stats.expectedInventoryProfit || 0).toLocaleString('en-US')} ${currency}`;

      const prodCountBadge = document.getElementById('kpiProductsTotalCountBadge');
      if (prodCountBadge) prodCountBadge.textContent = `${(stats.totalProductsCount || 0).toLocaleString('en-US')} ØµÙ†Ù Ø¨Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬`;

      // Ø§Ù„ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù…Ø§Ù„ÙŠØ©
      document.getElementById('dashCashSales').textContent = `${(stats.cashSales || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('dashInstallmentsTotal').textContent = `${(stats.installmentsTotal || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('dashInstallmentsDown').textContent = `${(stats.installmentsDownPayments || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('dashProfitMargin').textContent = `${stats.profitMarginPercentage || 0}%`;

      document.getElementById('dashProductsCount').textContent = `${stats.totalProductsCount || 0} ØµÙ†Ù`;
      document.getElementById('dashTotalCost').textContent = `${(stats.totalCost || 0).toLocaleString('en-US')} ${currency}`;
    }
  } catch (err) {
    console.error('ÙØ´Ù„ Ø¬Ù„Ø¨ Ø§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª:', err);
  }
}

// -------------------------------------------------------------
// Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ù…Ù†Ø¨Ø«Ù‚Ø© (Toast Notifications) Ù…Ø¹ Ø¯Ø¹Ù… Ø£Ø²Ø±Ø§Ø± Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª
// -------------------------------------------------------------
function showToast(message, type = 'info', actionText = null, actionCallback = null) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'â„¹ï¸';
  if (type === 'success') icon = 'âœ…';
  if (type === 'error') icon = 'âŒ';
  if (type === 'warning') icon = 'âš ï¸';

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
// ØªÙÙ‚ÙŠØ· Ø§Ù„Ø£Ø±Ù‚Ø§Ù… Ø¥Ù„Ù‰ ÙƒÙ„Ù…Ø§Øª Ø¨Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© (Arabic Tafqeet)
// =============================================================
function tafqeetArabic(number, currency = 'Ø´ÙŠÙƒÙ„') {
  const n = Math.floor(parseFloat(number) || 0);
  if (n <= 0) return '';

  const ones = ['', 'ÙˆØ§Ø­Ø¯', 'Ø§Ø«Ù†Ø§Ù†', 'Ø«Ù„Ø§Ø«Ø©', 'Ø£Ø±Ø¨Ø¹Ø©', 'Ø®Ù…Ø³Ø©', 'Ø³ØªØ©', 'Ø³Ø¨Ø¹Ø©', 'Ø«Ù…Ø§Ù†ÙŠØ©', 'ØªØ³Ø¹Ø©', 'Ø¹Ø´Ø±Ø©', 'Ø£Ø­Ø¯ Ø¹Ø´Ø±', 'Ø§Ø«Ù†Ø§ Ø¹Ø´Ø±', 'Ø«Ù„Ø§Ø«Ø© Ø¹Ø´Ø±', 'Ø£Ø±Ø¨Ø¹Ø© Ø¹Ø´Ø±', 'Ø®Ù…Ø³Ø© Ø¹Ø´Ø±', 'Ø³ØªØ© Ø¹Ø´Ø±', 'Ø³Ø¨Ø¹Ø© Ø¹Ø´Ø±', 'Ø«Ù…Ø§Ù†ÙŠØ© Ø¹Ø´Ø±', 'ØªØ³Ø¹Ø© Ø¹Ø´Ø±'];
  const tens = ['', 'Ø¹Ø´Ø±Ø©', 'Ø¹Ø´Ø±ÙˆÙ†', 'Ø«Ù„Ø§Ø«ÙˆÙ†', 'Ø£Ø±Ø¨Ø¹ÙˆÙ†', 'Ø®Ù…Ø³ÙˆÙ†', 'Ø³ØªÙˆÙ†', 'Ø³Ø¨Ø¹ÙˆÙ†', 'Ø«Ù…Ø§Ù†ÙˆÙ†', 'ØªØ³Ø¹ÙˆÙ†'];
  const hundreds = ['', 'Ù…Ø§Ø¦Ø©', 'Ù…Ø¦ØªØ§Ù†', 'Ø«Ù„Ø§Ø«Ù…Ø§Ø¦Ø©', 'Ø£Ø±Ø¨Ø¹Ù…Ø§Ø¦Ø©', 'Ø®Ù…Ø³Ù…Ø§Ø¦Ø©', 'Ø³ØªÙ…Ø§Ø¦Ø©', 'Ø³Ø¨Ø¹Ù…Ø§Ø¦Ø©', 'Ø«Ù…Ø§Ù†Ù…Ø§Ø¦Ø©', 'ØªØ³Ø¹Ù…Ø§Ø¦Ø©'];

  function convertChunk(num) {
    let res = '';
    const h = Math.floor(num / 100);
    const rem = num % 100;
    if (h > 0) {
      res += hundreds[h];
    }
    if (rem > 0) {
      if (res) res += ' Ùˆ';
      if (rem < 20) {
        res += ones[rem];
      } else {
        const o = rem % 10;
        const t = Math.floor(rem / 10);
        if (o > 0) {
          res += ones[o] + ' Ùˆ' + tens[t];
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
    if (millions === 1) parts.push('Ù…Ù„ÙŠÙˆÙ†');
    else if (millions === 2) parts.push('Ù…Ù„ÙŠÙˆÙ†Ø§Ù†');
    else if (millions >= 3 && millions <= 10) parts.push(convertChunk(millions) + ' Ù…Ù„Ø§ÙŠÙŠÙ†');
    else parts.push(convertChunk(millions) + ' Ù…Ù„ÙŠÙˆÙ†');
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('Ø£Ù„Ù');
    else if (thousands === 2) parts.push('Ø£Ù„ÙØ§Ù†');
    else if (thousands >= 3 && thousands <= 10) parts.push(convertChunk(thousands) + ' Ø¢Ù„Ø§Ù');
    else parts.push(convertChunk(thousands) + ' Ø£Ù„Ù');
  }

  if (remainder > 0) {
    parts.push(convertChunk(remainder));
  }

  const result = parts.join(' Ùˆ');
  return result ? `${result} ${currency} ÙÙ‚Ø· Ù„Ø§ ØºÙŠØ±` : '';
}

// -------------------------------------------------------------
// Ø¥Ø¯Ø§Ø±Ø© Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ (Receipt Vouchers)
// -------------------------------------------------------------
function updateReceiptTafqeet(val) {
  const box = document.getElementById('rcpTafqeetBox');
  const textEl = document.getElementById('rcpTafqeetText');
  const curBadge = document.getElementById('rcpCurrencyBadge');
  const currency = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
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
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  if (prevBalInput && remHint) {
    const prev = parseFloat(prevBalInput.value) || 0;
    const rem = Math.max(0, prev - amount);
    if (remInput) remInput.value = rem;
    remHint.innerHTML = `Ø§Ù„Ø±ØµÙŠØ¯ Ø¨Ø¹Ø¯ Ø§Ù„Ø³Ù†Ø¯: <strong style="color: ${rem === 0 ? '#059669' : '#dc2626'};">${rem.toLocaleString('en-US')} ${cur}</strong>`;
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
    showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù Ù…Ø­Ø±Ø± Ø§Ù„Ø³Ù†Ø¯', 'error');
    return;
  }
  if (!customerName) {
    showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ†', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ Ù…Ø¨Ù„Øº ØµØ­ÙŠØ­ Ø£ÙƒØ¨Ø± Ù…Ù† Ø§Ù„ØµÙØ±', 'error');
    return;
  }

  // Ø­ÙØ¸ Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ¸Ù Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù„Ø§Ø­Ù‚
  localStorage.setItem('last_employee_name', employeeName);

  const submitBtn = document.getElementById('btnSubmitReceipt');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸ ÙˆØ¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±...</span>';
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
      showToast(`ðŸŽ‰ ØªÙ… Ø¥ØµØ¯Ø§Ø± Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ø±Ù‚Ù… #${data.receipt.receiptNumber} Ø¨Ù†Ø¬Ø§Ø­`, 'success');
      state.receipts.unshift(data.receipt);
      renderReceiptsTable();

      // Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù PDF Ù„Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ø§Ù„Ù…Ø¹ØªÙ…Ø¯ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
      showToast('âœˆï¸ Ø¬Ø§Ø±ÙŠ Ø¥Ø±Ø³Ø§Ù„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ø§Ù„Ø±Ø³Ù…ÙŠ ÙƒÙ…Ù„Ù PDF Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');
      try {
        await sendReceiptPdfToTelegram(data.receipt);
      } catch (pdfErr) {
        console.warn('Auto send receipt PDF to Telegram error:', pdfErr);
      }

      resetReceiptForm();
      await loadCustomers();
      viewReceipt(data.receipt.id);
    } else {
      showToast(data.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø¥ØµØ¯Ø§Ø± Ø§Ù„Ø³Ù†Ø¯', 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø­ÙØ¸ Ø§Ù„Ø³Ù†Ø¯', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>ðŸ’¾</span><span>Ø­ÙØ¸ ÙˆØ¥ØµØ¯Ø§Ø± Ø§Ù„Ø³Ù†Ø¯</span>';
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
  showToast('Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² ÙˆØªØ­Ù…ÙŠÙ„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ PDF...', 'info');
  try {
    const html = buildPrintableReceiptHtml(r);
    const fileName = `Ø³Ù†Ø¯_Ù‚Ø¨Ø¶_${r.receiptNumber}.pdf`;
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
    showToast('ØªÙ… ØªØ­Ù…ÙŠÙ„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ PDF Ø¨Ù†Ø¬Ø§Ø­', 'success');
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ù…Ù„Ù Ø§Ù„Ù€ PDF', 'error');
  }
}

async function resendCurrentReceiptPdfTelegram() {
  if (!state.currentViewingReceipt) return;
  const r = state.currentViewingReceipt;
  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ø±Ø³Ø§Ù„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');
  try {
    await sendReceiptPdfToTelegram(r);
    showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ PDF Ø¨Ù†Ø¬Ø§Ø­ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…!', 'success');
  } catch (err) {
    showToast('ÙØ´Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ø³Ù†Ø¯ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…', 'error');
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
    console.error('ÙØ´Ù„ Ø¬Ù„Ø¨ Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶:', err);
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
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

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
  if (countBadge) countBadge.textContent = `${state.receipts.length} Ø³Ù†Ø¯`;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  const methodBadges = {
    cash: '<span class="badge badge-success">ðŸ’µ Ù†Ù‚Ø¯Ø§Ù‹</span>',
    transfer: '<span class="badge badge-primary">ðŸ¦ ØªØ­ÙˆÙŠÙ„ Ø¨Ù†ÙƒÙŠ</span>',
    check: '<span class="badge badge-warning">ðŸ“ Ø´ÙŠÙƒ</span>'
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
        <td>${methodBadges[r.paymentMethod] || 'Ù†Ù‚Ø¯Ø§Ù‹'}</td>
        <td style="font-size: 0.88rem;">${escapeHtml(r.employeeName || 'ØºÙŠØ± Ù…Ø­Ø¯Ø¯')}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-sm btn-primary" onclick="viewReceipt('${r.id}')" title="Ù…Ø¹Ø§ÙŠÙ†Ø© ÙˆØ·Ø¨Ø§Ø¹Ø©">
              <span>ðŸ–¨ï¸</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteReceipt('${r.id}')" title="Ø­Ø°Ù">
              <span>ðŸ—‘ï¸</span>
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

  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const words = tafqeetArabic(receipt.amount, cur);
  const dateStr = formatAppDateTime(receipt.createdAt);

  const methodLabel = {
    cash: 'Ù†Ù‚Ø¯Ø§Ù‹ (Cash)',
    transfer: 'ØªØ­ÙˆÙŠÙ„ Ø¨Ù†ÙƒÙŠ (Bank Transfer)',
    check: 'Ø´ÙŠÙƒ Ù…ØµØ±ÙÙŠ (Bank Cheque)'
  }[receipt.paymentMethod] || 'Ù†Ù‚Ø¯Ø§Ù‹';

  container.innerHTML = `
    <div class="receipt-header-row">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="font-size: 2.2rem;">ðŸ’¼</div>
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h2>
          <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">
            ${escapeHtml(state.settings.companyAddress || 'Ø§Ù„Ù…Ø±ÙƒØ² Ø§Ù„ØªØ¬Ø§Ø±ÙŠ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ')} | Ù‡Ø§ØªÙ: ${escapeHtml(state.settings.companyPhone || '')}
          </div>
        </div>
      </div>

      <div style="text-align: left;">
        <div class="receipt-badge-title">Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ù…Ø§Ù„ÙŠ</div>
        <div style="margin-top: 0.4rem; font-weight: 800; font-family: monospace; font-size: 1.1rem; color: #1e293b;">
          Ø±Ù‚Ù…: RCP-${receipt.receiptNumber}
        </div>
        <div style="font-size: 0.8rem; color: #64748b;">${dateStr}</div>
      </div>
    </div>

    <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
      <div class="receipt-amount-display">
        Ø§Ù„Ù…Ø¨Ù„Øº: ${(receipt.amount || 0).toLocaleString('en-US')} ${cur}
      </div>
    </div>

    <div class="receipt-details-box">
      <div class="receipt-line">
        <span class="line-title">Ø§Ø³ØªÙ„Ù…Ù†Ø§ Ù…Ù† Ø§Ù„Ø³ÙŠØ¯/Ø©:</span>
        <span class="line-content">${escapeHtml(receipt.customerName)}</span>
        ${receipt.customerPhone ? `<span style="font-size: 0.88rem; color: #64748b;">(Ù‡Ø§ØªÙ: ${receipt.customerPhone})</span>` : ''}
      </div>

      <div class="receipt-line">
        <span class="line-title">Ù…Ø¨Ù„Øº ÙˆÙ‚Ø¯Ø±Ù‡ Ø¨Ø§Ù„Ø£Ø­Ø±Ù:</span>
        <span class="line-content" style="color: #047857;">${words || `${receipt.amount} ${cur}`}</span>
      </div>

      <div class="receipt-line">
        <span class="line-title">Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹:</span>
        <span class="line-content">${methodLabel}</span>
      </div>

      ${receipt.description ? `
      <div class="receipt-line">
        <span class="line-title">ÙˆØ°Ù„Ùƒ Ù„Ù‚Ø§Ø¡ (Ø§Ù„Ø¨ÙŠØ§Ù†):</span>
        <span class="line-content">${escapeHtml(receipt.description)}</span>
      </div>` : ''}

      ${receipt.notes ? `
      <div class="receipt-line">
        <span class="line-title">Ù…Ù„Ø§Ø­Ø¸Ø§Øª:</span>
        <span class="line-content" style="font-weight: 500; font-size: 0.95rem; color: #475569;">${escapeHtml(receipt.notes)}</span>
      </div>` : ''}
    </div>

    <div class="receipt-signatures-row">
      <div class="receipt-sig-box">
        <div style="font-size: 0.85rem; color: #64748b;">Ù…Ù†Ø¸Ù… Ø§Ù„Ø³Ù†Ø¯ (Ø§Ù„Ù…ÙˆØ¸Ù)</div>
        <div class="receipt-sig-line">${escapeHtml(receipt.employeeName || 'Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„')}</div>
      </div>

      <div class="receipt-sig-box" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div style="width: 80px; height: 80px; border: 2px dashed #94a3b8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; color: #64748b; text-align: center; line-height: 1.2;">
          Ø®Ø§ØªÙ… Ø§Ù„Ø´Ø±ÙƒØ©<br>Ø§Ù„Ù…Ø¹ØªÙ…Ø¯
        </div>
      </div>

      <div class="receipt-sig-box">
        <div style="font-size: 0.85rem; color: #64748b;">Ø§Ù„Ù…Ø³ØªÙ„Ù… / Ø§Ù„Ø¯Ø§ÙØ¹</div>
        <div class="receipt-sig-line">${escapeHtml(receipt.customerName)}</div>
      </div>
    </div>

    <div style="margin-top: 1.5rem; text-align: center; font-size: 0.8rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
      ${escapeHtml(state.settings.invoiceFooterText || 'Ø´ÙƒØ±Ø§Ù‹ Ù„ØªØ¹Ø§Ù…Ù„ÙƒÙ… Ù…Ø¹Ù†Ø§')}
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
  printSinglePage('printableReceiptArea');
}

async function deleteReceipt(id) {
  if (!confirm('Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø­Ø°Ù Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ù‡Ø°Ø§ Ù†Ù‡Ø§Ø¦ÙŠØ§Ù‹ Ù…Ù† Ø§Ù„Ø³Ø¬Ù„ØŸ')) return;

  try {
    const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('ØªÙ… Ø­Ø°Ù Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶ Ø¨Ù†Ø¬Ø§Ø­', 'success');
      state.receipts = state.receipts.filter(r => r.id !== id);
      renderReceiptsTable();
    } else {
      showToast(data.error || 'ÙØ´Ù„ Ø­Ø°Ù Ø§Ù„Ø³Ù†Ø¯', 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø­Ø°Ù Ø§Ù„Ø³Ù†Ø¯', 'error');
  }
}

// =============================================================
// Ù†Ø¸Ø§Ù… Ø§Ù„Ø¬Ø±Ø¯ ÙˆØ§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ (Inventory Audit System)
// =============================================================
function formatRelativeDate(isoStr) {
  if (!isoStr) return 'Ù„Ù… ÙŠÙØ¹Ø¯Ù„ Ø¨Ø¹Ø¯ (Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø£ÙˆÙ„ÙŠØ©)';

  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return 'ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ';

  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'Ù…Ø³Ø§Ø¦Ø§Ù‹' : 'ØµØ¨Ø§Ø­Ø§Ù‹';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const timeStr = `Ø§Ù„Ø³Ø§Ø¹Ø© ${hours}:${minutes} ${period}`;

  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (diffMin < 2) return 'Ø§Ù„Ø¢Ù†';
  if (diffMin < 60) return `Ù…Ù†Ø° ${diffMin} Ø¯Ù‚ÙŠÙ‚Ø©`;
  if (isToday) return `Ø§Ù„ÙŠÙˆÙ… ${timeStr}`;
  if (isYesterday) return `Ø£Ù…Ø³ ${timeStr}`;

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

function handleInventorySortChange(val) {
  state.inventorySort = val || 'code_asc';
  state.inventoryCurrentPage = 1;
  renderInventoryList();
}

function renderInventoryList() {
  const container = document.getElementById('inventoryItemsContainer');
  if (!container) return;

  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  // Ø­Ø³Ø§Ø¨ Ø§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª Ø§Ù„Ø¹Ø§Ù…Ø©
  const totalProducts = state.products.length;
  const outOfStock = state.products.filter(p => (state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0)) === 0).length;
  const lowStock = state.products.filter(p => {
    const s = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
    return s > 0 && s <= 3;
  }).length;
  const modifiedCount = state.inventoryPendingUpdates.size;

  // ØªØ­Ø¯ÙŠØ« Ø´Ø§Ø±Ø§Øª Ø§Ù„Ù€ Toolbar
  const totalEl = document.getElementById('invTotalProductsBadge');
  const outEl = document.getElementById('invOutOfStockBadge');
  const lowEl = document.getElementById('invLowStockBadge');
  const modPill = document.getElementById('invPillModified');
  const modBadge = document.getElementById('invModifiedCountBadge');
  const navModBadge = document.getElementById('inventoryModifiedBadge');

  if (totalEl) totalEl.textContent = `${totalProducts.toLocaleString('en-US')} ØµÙ†Ù`;
  if (outEl) outEl.textContent = `${outOfStock} ØµÙ†Ù Ù†Ø§ÙØ¯`;
  if (lowEl) lowEl.textContent = `${lowStock} ÙƒÙ…ÙŠØ© Ù…Ù†Ø®ÙØ¶Ø© (â‰¤3)`;

  if (modifiedCount > 0) {
    if (modPill) modPill.style.display = 'inline-flex';
    if (modBadge) modBadge.textContent = `ØªÙ… ØªØ¹Ø¯ÙŠÙ„ ${modifiedCount} ØµÙ†Ù`;
    if (navModBadge) {
      navModBadge.style.display = 'inline-block';
      navModBadge.textContent = modifiedCount;
    }
  } else {
    if (modPill) modPill.style.display = 'none';
    if (navModBadge) navModBadge.style.display = 'none';
  }

  // ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø´Ø±ÙŠØ· Ø§Ù„Ø¹Ø§Ø¦Ù… Ù„Ø­ÙØ¸ Ø§Ù„Ø¬Ø±Ø¯
  updateInventoryFloatingBar(modifiedCount);

  // ØªØ­Ø¯ÙŠØ« Ø´Ø±ÙŠØ· Ù…Ù„Ø®Øµ Ø±Ø£Ø³ Ù…Ø§Ù„ ÙˆØ¬Ø±Ø¯ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù…Ø®ØªØ§Ø±Ø©
  const brandBanner = document.getElementById('invBrandSummaryBanner');
  if (brandBanner) {
    if (state.inventoryBrand && state.inventoryBrand !== 'all') {
      const brandProducts = state.products.filter(p => (p.brand || 'Ø£Ø®Ø±Ù‰') === state.inventoryBrand);
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
          <span style="font-size: 1.5rem;">ðŸ¢</span>
          <div>
            <div>ØªÙ‚Ø±ÙŠØ± Ø¬Ø±Ø¯ ÙˆØ±Ø£Ø³ Ù…Ø§Ù„: <strong style="color: #fef08a;">${escapeHtml(displayTitle)}</strong></div>
            <div style="font-size: 0.8rem; font-weight: 500; opacity: 0.85;">Ù…ØªØ§Ø¨Ø¹Ø© ØªÙØµÙŠÙ„ÙŠØ© ÙˆÙÙˆØ±ÙŠØ© Ù„Ù„ÙƒÙ…ÙŠØ§Øª ÙˆØ§Ù„ØªÙƒÙ„ÙØ©</div>
          </div>
        </div>
        <div class="brand-summary-stats">
          <div class="brand-summary-stat-item">
            <span class="brand-summary-stat-label">Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù</span>
            <span class="brand-summary-stat-val">${brandProducts.length} ØµÙ†Ù</span>
          </div>
          <div class="brand-summary-stat-item">
            <span class="brand-summary-stat-label">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù‚Ø·Ø¹ Ø§Ù„Ù…ØªÙˆÙØ±Ø©</span>
            <span class="brand-summary-stat-val">${bUnits.toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</span>
          </div>
          <div class="brand-summary-stat-item">
            <span class="brand-summary-stat-label">Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ Ø§Ù„Ù…Ø³ØªØ«Ù…Ø± ÙÙŠ Ø§Ù„Ù…Ø§Ø±ÙƒØ©</span>
            <span class="brand-summary-stat-val capital">${bCapital.toLocaleString('en-US')} ${cur}</span>
          </div>
          <div class="brand-summary-stat-item">
            <span class="brand-summary-stat-label">Ø£ØµÙ†Ø§Ù Ù†Ø§ÙØ¯Ø© (0)</span>
            <span class="brand-summary-stat-val" style="color: ${bZero > 0 ? '#f87171' : '#a7f3d0'};">${bZero}</span>
          </div>
        </div>
      `;
    } else {
      brandBanner.style.display = 'none';
    }
  }

  // ØªØµÙÙŠØ© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø¨Ø§Ù„Ø¬Ø±Ø¯
  let filtered = state.products.filter(p => {
    // 1. ÙÙ„ØªØ± Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø¨Ø§Ù„Ø¬Ø±Ø¯ Ø£ÙˆÙ„Ø§Ù‹ ÙˆØ¨Ø´ÙƒÙ„ Ø­Ø§Ø²Ù…
    if (state.inventoryBrand && state.inventoryBrand !== 'all') {
      const pBrand = p.brand || 'Ø£Ø®Ø±Ù‰';
      if (pBrand !== state.inventoryBrand) return false;
    }

    // 2. ÙÙ„ØªØ± Ø§Ù„Ù‚Ø³Ù… Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ
    if (state.inventoryCategory !== 'all') {
      const pMain = p.mainCategory || 'Ø£Ø®Ø±Ù‰';
      if (pMain !== state.inventoryCategory) return false;
    }

    // 3. Ø§Ù„ÙÙ„ØªØ± Ø§Ù„Ø³Ø±ÙŠØ¹ (Ù…Ø¹Ø¯Ù„Ø©ØŒ Ù†ÙØ¯ØªØŒ Ù‚Ù„ÙŠÙ„Ø©)
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

    // 4. ÙÙ„ØªØ± Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù†ØµÙŠ Ø¨Ø§Ù„Ø¬Ø±Ø¯ (Ù…Ø­ØµÙˆØ± Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ù…Ø¹ ØªØ·Ø¨ÙŠØ¹ ÙƒØ§Ù…Ù„ Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© ÙˆØ§Ù„Ù…Ø±Ø§Ø¯ÙØ§Øª)
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

  // ÙØ±Ø² ÙˆØªØ±ØªÙŠØ¨ Ø£ØµÙ†Ø§Ù Ø§Ù„Ø¬Ø±Ø¯ Ø­Ø³Ø¨ Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… (Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠ: Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù ØªØµØ§Ø¹Ø¯ÙŠØ§Ù‹)
  const sortMode = state.inventorySort || 'code_asc';
  filtered.sort((a, b) => {
    const stockA = state.inventoryPendingUpdates.has(a.id)
      ? state.inventoryPendingUpdates.get(a.id)
      : Math.max(0, parseInt(a.stock) || 0);
    const stockB = state.inventoryPendingUpdates.has(b.id)
      ? state.inventoryPendingUpdates.get(b.id)
      : Math.max(0, parseInt(b.stock) || 0);

    if (sortMode === 'code_asc') {
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortMode === 'code_desc') {
      return String(b.code || '').localeCompare(String(a.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortMode === 'qty_desc') {
      if (stockB !== stockA) return stockB - stockA;
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortMode === 'qty_asc') {
      if (stockA !== stockB) return stockA - stockB;
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortMode === 'name_asc') {
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    }
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="background: white; border-radius: var(--radius-lg); padding: 3rem; border: 1px dashed var(--border-color);">
        <div class="empty-state-icon">ðŸ”</div>
        <h3>Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£ØµÙ†Ø§Ù Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ù„Ø¨Ø­Ø« Ø£Ùˆ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø£Ùˆ Ø§Ù„ÙÙ„ØªØ± Ø§Ù„Ù…Ø­Ø¯Ø¯</h3>
        <p>Ø¬Ø±Ø¨ ØªØºÙŠÙŠØ± Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø£Ùˆ Ø§Ø®ØªÙŠØ§Ø± ØªØµÙ†ÙŠÙ Ø¢Ø®Ø±</p>
      </div>
    `;
    renderInventoryPagination(0, 1, state.inventoryPageSize);
    return;
  }

  // Ø§Ù„ØªÙ‚Ø³ÙŠÙ… Ù„ØµÙØ­Ø§Øª (Pagination) Ù„Ù„Ø­ÙØ§Ø¸ Ø¹Ù„Ù‰ Ø³Ø±Ø¹Ø© ÙØ§Ø¦Ù‚Ø© Ù…Ø¹ 1300 ØµÙ†Ù
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
            <span>âš ï¸</span>
            <span>Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„ØªØ§Ù„ÙŠØ© Ù†ÙØ¯Øª ÙˆÙƒÙ…ÙŠØªÙ‡Ø§ = ØµÙØ± (Ù…ÙØµÙˆÙ„Ø© Ø¨Ø§Ù„Ø£Ø³ÙÙ„)</span>
          </div>
          <span class="zero-badge">ØºÙŠØ± Ù…ØªÙˆÙØ± Ø¨Ø§Ù„Ù…Ø³ØªÙˆØ¯Ø¹</span>
        </div>
      `;
    }

    // ØµÙŠØ§ØºØ© Ø¬Ù…Ù„Ø© Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø© Ø¨Ø¯Ù‚Ø©:
    // Ù…Ø«Ù„Ø§Ù‹: "Ø§Ù„ÙƒÙ…ÙŠØ© 3 | Ø¢Ø®Ø± ØªØ¹Ø¯ÙŠÙ„ Ù‚Ø§Ù… Ø¨Ù‡ Ø±Ø§Ù…Ø² Ø£Ù…Ø³"
    let editorInfoHtml = '';
    if (isModified) {
      editorInfoHtml = `
        <div class="inv-meta-editor-row" style="color: #2563eb; font-weight: 700;">
          <span>âš¡ ØªØ¹Ø¯ÙŠÙ„ Ø­Ø§Ù„ÙŠ Ù…Ø¹Ù„Ù‚:</span>
          <span>ÙƒØ§Ù† (${originalStock}) ÙˆØ£ØµØ¨Ø­ (${currentStock})</span>
        </div>
      `;
    } else if (p.lastStockEditor) {
      editorInfoHtml = `
        <div class="inv-meta-editor-row">
          <span>ðŸ‘¤ Ø¢Ø®Ø± ØªØ¹Ø¯ÙŠÙ„ Ù‚Ø§Ù… Ø¨Ù‡:</span>
          <strong>${escapeHtml(p.lastStockEditor)}</strong>
          <span>â€¢</span>
          <span>${formatRelativeDate(p.lastStockUpdate)}</span>
        </div>
      `;
    } else {
      editorInfoHtml = `
        <div class="inv-meta-editor-row" style="color: #94a3b8;">
          <span>ðŸ‘¤ Ø¢Ø®Ø± ØªØ¹Ø¯ÙŠÙ„:</span>
          <em>Ù„Ù… ÙŠØªÙ… ØªØ¹Ø¯ÙŠÙ„Ù‡ Ø¨Ø¹Ø¯ (Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠØ©)</em>
        </div>
      `;
    }

    return (zeroDividerHtml || '') + `
      <div class="inventory-item-card ${isModified ? 'is-modified' : ''} ${currentStock === 0 ? 'is-zero-stock' : ''}" id="invCard-${p.id}">
        <!-- Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬ -->
        <div class="inv-prod-info">
          <div class="inv-prod-badges">
            <span class="inv-prod-code">ðŸ·ï¸ ${escapeHtml(p.code || 'PRD')}</span>
            <span class="inv-prod-category">${escapeHtml(p.mainCategory || 'Ø¹Ø§Ù…')} ${p.category && p.category !== p.mainCategory ? `> ${escapeHtml(p.category)}` : ''}</span>
            <span class="inv-prod-brand">ðŸ¢ ${escapeHtml(p.brand || 'Ø¹Ø§Ù…')}</span>
            ${isModified ? `<span class="inv-delta-badge ${delta >= 0 ? 'pos' : 'neg'}">${delta > 0 ? '+' + delta : delta}</span>` : ''}
            <!-- Ø²Ø± Ø¨Ø§Ø±ÙƒÙˆØ¯ Ø§Ù„ØµÙ†Ù ÙÙŠ Ø§Ù„Ø¬Ø±Ø¯ -->
            <button type="button" class="inv-barcode-tag-btn ${p.barcode ? 'has-barcode' : 'no-barcode'}" onclick="openAssignBarcodeModal('${p.id}')" title="${p.barcode ? 'ØªØ¹Ø¯ÙŠÙ„ Ø£Ùˆ ÙØ­Øµ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯' : 'Ø¥Ø¶Ø§ÙØ© ÙˆØ±Ø¨Ø· Ø¨Ø§Ø±ÙƒÙˆØ¯ Ù„Ù‡Ø°Ø§ Ø§Ù„ØµÙ†Ù'}">
              <span class="bc-icon">ðŸ·ï¸</span>
              <span class="bc-code">${p.barcode ? escapeHtml(p.barcode) : '+ Ø±Ø¨Ø· Ø¨Ø§Ø±ÙƒÙˆØ¯'}</span>
            </button>
          </div>
          <div class="inv-prod-name">${escapeHtml(p.name)}</div>
          <div class="inv-prod-prices">
            <span>Ø³Ø¹Ø± Ø§Ù„Ø¨ÙŠØ¹: <strong>${(p.sellPrice || 0).toLocaleString('en-US')} ${cur}</strong></span>
            <span>Ø³Ø¹Ø± Ø§Ù„ØªÙƒÙ„ÙØ©: <strong>${(p.costPrice || 0).toLocaleString('en-US')} ${cur}</strong></span>
          </div>
          <!-- Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø²Ø± Ø¹Ø±Ø¶ Ù„Ù„Ø¹Ù…ÙŠÙ„ Ù‡Ù†Ø§ - Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© ØªØªÙ… Ø¹Ø¨Ø± Ø§Ù„Ø¶ØºØ· Ø¹Ù„Ù‰ ØµÙˆØ±Ø© Ø§Ù„Ù…Ù†ØªØ¬ ÙÙŠ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ -->
        </div>

        <!-- Ø¹Ø¯Ø§Ø¯ Ø§Ù„ØªØ­ÙƒÙ… Ø¨Ø§Ù„ÙƒÙ…ÙŠØ© -->
        <div>
          <div class="inv-stepper-box">
            <button class="inv-step-btn minus" onclick="stepInventoryStock('${p.id}', -1)" title="Ø¥Ù†Ù‚Ø§Øµ Ø§Ù„ÙƒÙ…ÙŠØ© (-1)">âˆ’</button>
            <input type="number" class="inv-qty-input" min="0" value="${currentStock}" onchange="setInventoryStockDirect('${p.id}', this.value)" title="Ø§ÙƒØªØ¨ Ø§Ù„ÙƒÙ…ÙŠØ© Ù…Ø¨Ø§Ø´Ø±Ø©">
            <button class="inv-step-btn plus" onclick="stepInventoryStock('${p.id}', 1)" title="Ø²ÙŠØ§Ø¯Ø© Ø§Ù„ÙƒÙ…ÙŠØ© (+1)">+</button>
          </div>
        </div>

        <!-- Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØªÙØ§ØµÙŠÙ„ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ø£Ø®ÙŠØ±Ø© -->
        <div class="inv-meta-col">
          <div class="inv-meta-stock-row">
            <span>Ø§Ù„ÙƒÙ…ÙŠØ©: <strong style="font-size: 1.15rem; color: ${currentStock === 0 ? 'var(--danger)' : 'var(--text-main)'};">${currentStock}</strong> Ù‚Ø·Ø¹Ø©</span>
            ${currentStock === 0 ? '<span class="badge badge-danger">Ù†ÙØ¯Øª Ø§Ù„ÙƒÙ…ÙŠØ©</span>' : currentStock <= 3 ? '<span class="badge badge-warning">ÙƒÙ…ÙŠØ© Ù…Ù†Ø®ÙØ¶Ø©</span>' : '<span class="badge badge-success">Ù…ØªÙˆÙØ±</span>'}
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
    if (subtitleEl) subtitleEl.textContent = `ØªÙ… ØªØ¹Ø¯ÙŠÙ„ ÙƒÙ…ÙŠØ§Øª (${modifiedCount}) Ø£ØµÙ†Ø§Ù Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ø­ÙØ¸`;
    if (saveBtn) {
      saveBtn.innerHTML = `<span>ðŸ’¾</span><span>Ø­ÙØ¸ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª ÙÙŠ Ø§Ù„Ù…Ø®Ø²Ù† (${modifiedCount} ØµÙ†Ù)</span>`;
      saveBtn.className = 'btn btn-success btn-floating-save';
    }
  } else {
    floatingBar.classList.remove('has-changes');
    if (subtitleEl) subtitleEl.textContent = 'Ù„Ù… ÙŠØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø£ÙŠ ØµÙ†Ù ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ø¬Ù„Ø³Ø© Ø¨Ø¹Ø¯';
    if (saveBtn) {
      saveBtn.innerHTML = `<span>ðŸ’¾</span><span>Ø­ÙØ¸ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª ÙÙŠ Ø§Ù„Ù…Ø®Ø²Ù†</span>`;
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
    showToast('ÙŠØ±Ø¬Ù‰ ÙƒØªØ§Ø¨Ø© Ø§Ø³Ù…Ùƒ Ù„Ø­ÙØ¸ Ø§Ù„Ø¬Ø±Ø¯', 'error');
    return;
  }
  syncAuditEmployeeName(name);
  closeAuditorModal();
  await executeSaveInventory(name);
}

function resetInventoryChanges() {
  if (state.inventoryPendingUpdates.size === 0) {
    showToast('Ù„Ø§ ØªÙˆØ¬Ø¯ ØªØ¹Ø¯ÙŠÙ„Ø§Øª Ù…Ø¹Ù„Ù‚Ø© Ù„Ù„ØªØ±Ø§Ø¬Ø¹ Ø¹Ù†Ù‡Ø§', 'info');
    return;
  }
  showConfirmDialog({
    title: 'ØªØ¬Ø§Ù‡Ù„ ØªØ¹Ø¯ÙŠÙ„Ø§Øª Ø§Ù„Ø¬Ø±Ø¯',
    message: `Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø¥Ù„ØºØ§Ø¡ ÙˆØªØ¬Ø§Ù‡Ù„ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª Ø¹Ù„Ù‰ ${state.inventoryPendingUpdates.size} Ø£ØµÙ†Ø§Ù ÙˆØ¥Ø¹Ø§Ø¯Ø© Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©ØŸ`,
    icon: 'â†©ï¸',
    confirmText: 'Ù†Ø¹Ù…ØŒ Ø¥Ù„ØºØ§Ø¡ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª',
    cancelText: 'ØªØ±Ø§Ø¬Ø¹',
    isDanger: true,
    onConfirm: () => {
      state.inventoryPendingUpdates.clear();
      renderInventoryList();
      showToast('ØªÙ… Ø§Ù„ØªØ±Ø§Ø¬Ø¹ Ø¹Ù† Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª ÙˆØ¥Ø¹Ø§Ø¯Ø© Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ø£ØµÙ„ÙŠØ©', 'info');
    }
  });
}

async function saveInventoryBulkChanges() {
  if (state.inventoryPendingUpdates.size === 0) {
    showToast('Ù„Ù… ÙŠØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø£ÙŠ ÙƒÙ…ÙŠØ§Øª Ù„Ø­ÙØ¸Ù‡Ø§. Ù‚Ù… Ø¨Ø²ÙŠØ§Ø¯Ø© Ø£Ùˆ Ø¥Ù†Ù‚Ø§Øµ ÙƒÙ…ÙŠØ© Ø£ÙŠ ØµÙ†Ù Ø£ÙˆÙ„Ø§Ù‹.', 'warning');
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
    saveBtn.innerHTML = '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ Ø­ÙØ¸ Ø§Ù„Ø¬Ø±Ø¯...</span>';
  }
  if (floatingSaveBtn) {
    floatingSaveBtn.disabled = true;
    floatingSaveBtn.innerHTML = '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸...</span>';
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
      showToast(`ðŸŽ‰ ØªÙ… Ø­ÙØ¸ Ø¬Ø±Ø¯ ${updates.length} Ø£ØµÙ†Ø§Ù Ø¨Ù†Ø¬Ø§Ø­ ÙˆØªÙˆØ«ÙŠÙ‚ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ Ø¨Ø§Ø³Ù… (${editorName})`, 'success');

      const now = new Date().toISOString();
      updates.forEach(({ id, stock }) => {
        const prod = state.products.find(p => p.id === id);
        if (prod) {
          prod.stock = stock;
          prod.lastStockUpdate = now;
          prod.lastStockEditor = editorName;
        }
      });

      // Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù PDF Ù„Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ù…Ø¹Ø¯Ù„Ø© ÙÙŠ Ø§Ù„Ø¬Ø±Ø¯ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹
      if (data.modifiedDetails && data.modifiedDetails.length > 0) {
        showToast('âœˆï¸ Ø¬Ø§Ø±ÙŠ Ø¥Ø±Ø³Ø§Ù„ Ù…Ø­Ø¶Ø± Ø£ØµÙ†Ø§Ù Ø§Ù„Ø¬Ø±Ø¯ ÙƒÙ…Ù„Ù PDF Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');
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
      showToast(data.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø­ÙØ¸ Ø§Ù„Ø¬Ø±Ø¯', 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø­ÙØ¸ Ø§Ù„Ø¬Ø±Ø¯', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>ðŸ’¾</span><span id="btnToolbarSaveText">Ø­ÙØ¸ ØªØ¹Ø¯ÙŠÙ„Ø§Øª Ø§Ù„Ø¬Ø±Ø¯</span><span class="badge" id="btnToolbarSaveBadge" style="display:none; background: #fff; color: #047857; margin-right: 0.35rem;">0</span>';
    }
    if (floatingSaveBtn) {
      floatingSaveBtn.disabled = false;
      floatingSaveBtn.innerHTML = '<span>ðŸ’¾</span><span>Ø­ÙØ¸ Ø§Ù„ØªØ¹Ø¯ÙŠÙ„Ø§Øª</span>';
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
    html += `<button class="btn btn-sm btn-secondary" onclick="goToInventoryPage(${currentPage - 1})">â—€ Ø§Ù„Ø³Ø§Ø¨Ù‚</button>`;
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
    html += `<button class="btn btn-sm btn-secondary" onclick="goToInventoryPage(${currentPage + 1})">Ø§Ù„ØªØ§Ù„ÙŠ â–¶</button>`;
  }

  html += `<span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 0.5rem;">ØµÙØ­Ø© ${currentPage} Ù…Ù† ${totalPages} (${totalItems} ØµÙ†Ù)</span>`;
  html += `</div>`;

  container.innerHTML = html;
}

function goToInventoryPage(page) {
  state.inventoryCurrentPage = page;
  renderInventoryList();
  // Ø§Ù„ØªÙ…Ø±ÙŠØ± Ø¨Ù„Ø·Ù Ù„Ø£Ø¹Ù„Ù‰ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø¬Ø±Ø¯
  const toolbar = document.querySelector('.inventory-toolbar');
  if (toolbar) toolbar.scrollIntoView({ behavior: 'smooth' });
}



// ============================================================
// Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª
// ============================================================
async function confirmResetSalesData() {
  const input = document.getElementById('resetConfirmInput');
  const resultBox = document.getElementById('resetSalesResult');
  const btn = document.getElementById('btnResetSales');

  const phrase = (input?.value || '').trim();
  if (phrase !== 'ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø°Ù') {
    if (input) {
      input.style.borderColor = '#dc2626';
      input.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.25)';
      setTimeout(() => { input.style.borderColor = '#fca5a5'; input.style.boxShadow = ''; }, 1500);
    }
    showToast('âš ï¸ ÙŠØ¬Ø¨ ÙƒØªØ§Ø¨Ø© Ø¹Ø¨Ø§Ø±Ø© ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø°Ù Ø¨Ø§Ù„Ø¶Ø¨Ø· Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©', 'warning');
    return;
  }

  const confirmed = window.confirm('âš ï¸ ØªØ­Ø°ÙŠØ± Ù†Ù‡Ø§Ø¦ÙŠ!\n\nØ³ÙŠØªÙ… Ø­Ø°Ù Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙÙˆØ§ØªÙŠØ± ÙˆØ³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ Ø¨Ø´ÙƒÙ„ Ø¯Ø§Ø¦Ù… ÙˆÙ„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„ØªØ±Ø§Ø¬Ø¹ Ø¹Ù†Ù‡.\n\nÙ‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ ØªÙ…Ø§Ù…Ø§Ù‹ØŸ');
  if (!confirmed) return;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­Ø°Ù...</span>';
  }

  try {
    const response = await fetch('/api/reset-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmPhrase: 'ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø­Ø°Ù' })
    });
    const data = await response.json();

    if (data.success) {
      state.invoices = [];
      state.receipts = [];

      renderInvoicesTable();
      loadDashboardStats();
      renderReceiptsTable();

      const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
      ['kpiTotalSales','kpiTotalProfit','kpiInstallmentsRemaining','dashCashSales','dashInstallmentsTotal','dashInstallmentsDown','dashTotalCost']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0 ' + cur; });
      const invEl = document.getElementById('kpiTotalInvoices'); if (invEl) invEl.textContent = '0';
      const marginEl = document.getElementById('dashProfitMargin'); if (marginEl) marginEl.textContent = '0%';

      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = '#d1fae5';
        resultBox.style.color = '#065f46';
        resultBox.style.border = '1px solid #6ee7b7';
        resultBox.innerHTML = 'âœ… ØªÙ… Ø¨Ù†Ø¬Ø§Ø­! ØªÙ… Ø­Ø°Ù Ø¬Ù…ÙŠØ¹ Ø§Ù„ÙÙˆØ§ØªÙŠØ± ÙˆØ³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶. Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø³Ù„ÙŠÙ…Ø©.';
      }
      if (input) input.value = '';
      showToast('âœ… ØªÙ… Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø¬Ù…ÙŠØ¹ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª Ø¨Ù†Ø¬Ø§Ø­', 'success');
    } else {
      throw new Error(data.error || 'Ø­Ø¯Ø« Ø®Ø·Ø£ ØºÙŠØ± Ù…ØªÙˆÙ‚Ø¹');
    }
  } catch (err) {
    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.style.background = '#fee2e2';
      resultBox.style.color = '#991b1b';
      resultBox.style.border = '1px solid #fca5a5';
      resultBox.innerHTML = 'âŒ Ø®Ø·Ø£: ' + escapeHtml(err.message);
    }
    showToast('âŒ ÙØ´Ù„ Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„ØªØ¹ÙŠÙŠÙ†: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>ðŸ—‘ï¸</span><span>Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª</span>';
    }
  }
}

// ============================================================
// Ø¥Ø¯Ø§Ø±Ø© Ù†ÙˆØ¹ Ø§Ù„ÙØ§ØªÙˆØ±Ø© (Ù…Ø¨ÙŠØ¹Ø§Øª Ø£Ù… Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØªÙˆØ±ÙŠØ¯)
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
    if (partyIcon) partyIcon.textContent = 'ðŸ“¥';
    if (partyTitle) partyTitle.textContent = 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ±Ø¯ ÙˆØªÙˆØ±ÙŠØ¯ Ø§Ù„Ø¨Ø¶Ø§Ø¹Ø©';
    if (partyBadge) {
      partyBadge.textContent = 'ÙØ§ØªÙˆØ±Ø© ØªÙˆØ±ÙŠØ¯ Ø¨Ø¶Ø§Ø¹Ø© (ØªØ²ÙŠØ¯ Ø§Ù„Ù…Ø®Ø²Ù† ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹)';
      partyBadge.className = 'badge badge-success';
    }
    if (custNameLabel) custNameLabel.textContent = 'Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯ / Ø§Ù„Ù…ØµØ¯Ø±:';
    if (custPhoneLabel) custPhoneLabel.textContent = 'Ù‡Ø§ØªÙ Ø§Ù„Ù…ÙˆØ±Ø¯:';
    if (custInput) custInput.placeholder = 'Ø§Ø³Ù… Ø´Ø±ÙƒØ© Ø§Ù„ØªÙˆØ±ÙŠØ¯ / Ø§Ù„ØªØ§Ø¬Ø± Ø£Ùˆ Ø§Ù„Ù…ÙˆØ±Ø¯...';
    if (sumTitle) sumTitle.textContent = 'Ø­Ø³Ø§Ø¨ Ù‚ÙŠÙ…Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª Ø§Ù„ÙˆØ§Ø±Ø¯Ø©';
    if (sumLabelQty) sumLabelQty.textContent = 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù‚Ø·Ø¹ Ø§Ù„ÙˆØ§Ø±Ø¯Ø© Ù„Ù„Ù…Ø®Ø²Ù†:';
    if (sumLabelFinal) sumLabelFinal.textContent = 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ù‚ÙŠÙ…Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª (Ø§Ù„Ù…Ø¶Ø§ÙØ© Ù„Ù„Ù…Ø®Ø²Ù†):';
    if (rowCost) rowCost.style.display = 'none';
    if (rowProfit) rowProfit.style.display = 'none';
    if (thTotal) thTotal.textContent = 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø´Ø±Ø§Ø¡ (Ø§Ù„ØªÙƒÙ„ÙØ©)';
    if (btnSubmitText) btnSubmitText.textContent = 'Ø¥Ù†Ø´Ø§Ø¡ ÙØ§ØªÙˆØ±Ø© Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØªÙˆØ±ÙŠØ¯ Ø§Ù„Ø¨Ø¶Ø§Ø¹Ø© Ù„Ù„Ù…Ø®Ø²Ù†';
    if (btnSubmitHint) btnSubmitHint.textContent = 'âœˆï¸ Ø³ÙŠØªÙ… Ø²ÙŠØ§Ø¯Ø© ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙÙˆØ±Ø§Ù‹ Ø¨Ø§Ù„Ø¨Ø¶Ø§Ø¹Ø© Ø§Ù„Ù…Ø´ØªØ±Ø§Ø© ÙˆØ¥Ø±Ø³Ø§Ù„ Ø¥Ø´Ø¹Ø§Ø± Ø§Ù„ØªÙˆØ±ÙŠØ¯ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù….';
    if (paySelector) paySelector.style.display = 'none';
    const quickSec = document.getElementById('quickNewProductSection');
    if (quickSec) quickSec.style.display = 'block';
    const qnpTitle = document.getElementById('quickNewProductTitle');
    if (qnpTitle) qnpTitle.textContent = 'ðŸ“¥ Ø¥Ø¯Ø®Ø§Ù„ ØµÙ†Ù ÙˆÙ…Ø§Ø±ÙƒØ© Ø¬Ø¯ÙŠØ¯Ø© Ù„ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª ÙˆØ§Ù„Ù…Ø®Ø²Ù†';
  } else {
    if (btnPurchase) btnPurchase.classList.remove('active');
    if (btnSales) btnSales.classList.add('active');
    if (partyIcon) partyIcon.textContent = 'ðŸ‘¤';
    if (partyTitle) partyTitle.textContent = 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆØ§Ù„Ø²Ø¨ÙˆÙ†';
    if (partyBadge) {
      partyBadge.textContent = 'Ø¨Ø¯ÙˆÙ† ØªØ³Ø¬ÙŠÙ„ Ø¯Ø®ÙˆÙ„ - Ø§ÙƒØªØ¨ Ø§Ø³Ù…Ùƒ ÙÙ‚Ø·';
      partyBadge.className = 'badge badge-primary';
    }
    if (custNameLabel) custNameLabel.textContent = 'Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ†:';
    if (custPhoneLabel) custPhoneLabel.textContent = 'Ø±Ù‚Ù… Ù‡Ø§ØªÙ Ø§Ù„Ø²Ø¨ÙˆÙ†:';
    if (custInput) custInput.placeholder = 'Ø§Ø³Ù… Ø§Ù„Ù…Ø´ØªØ±ÙŠ / Ø§Ù„Ø²Ø¨ÙˆÙ†...';
    if (sumTitle) sumTitle.textContent = 'Ø§Ù„Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø§Ù„ÙŠ ÙˆØ§Ù„Ø£Ø±Ø¨Ø§Ø­';
    if (sumLabelQty) sumLabelQty.textContent = 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø¹Ø¯Ø¯ Ø§Ù„Ù‚Ø·Ø¹:';
    if (sumLabelFinal) sumLabelFinal.textContent = 'Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ Ù„Ù„ÙØ§ØªÙˆØ±Ø©:';
    if (rowCost) rowCost.style.display = 'flex';
    if (rowProfit) rowProfit.style.display = 'flex';
    if (thTotal) thTotal.textContent = 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¨ÙŠØ¹';
    if (btnSubmitText) btnSubmitText.textContent = 'Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙØ§ØªÙˆØ±Ø© ÙˆØ¥Ø±Ø³Ø§Ù„ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…';
    if (btnSubmitHint) btnSubmitHint.textContent = 'âœˆï¸ Ø³ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ ÙƒØ§ÙØ© ØªÙØ§ØµÙŠÙ„ Ø§Ù„ÙØ§ØªÙˆØ±Ø©ØŒ Ø§Ù„Ù…Ù†ØªØ¬Ø§ØªØŒ Ø§Ù„Ù…ÙˆØ¸ÙØŒ ÙˆØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¥Ù„Ù‰ Ø­Ø³Ø§Ø¨ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… ÙÙˆØ±Ø§Ù‹.';
    if (paySelector) paySelector.style.display = 'block';
    const quickSec = document.getElementById('quickNewProductSection');
    if (quickSec) quickSec.style.display = 'none';
    const qnpTitle = document.getElementById('quickNewProductTitle');
    if (qnpTitle) qnpTitle.textContent = 'âš¡ Ø¥Ø¯Ø®Ø§Ù„ ØµÙ†Ù ÙˆÙ…Ø§Ø±ÙƒØ© Ø¬Ø¯ÙŠØ¯Ø© Ù…Ø¨Ø§Ø´Ø±Ø© Ù„Ù„ÙØ§ØªÙˆØ±Ø© ÙˆØ§Ù„Ù…Ø®Ø²Ù† Ù…Ø¹Ø§Ù‹';
  }

  updateCartUI();
  // Ø¥Ø¸Ù‡Ø§Ø±/Ø¥Ø®ÙØ§Ø¡ Ø­Ù‚Ù„ Ø§Ù„ÙƒÙØ§Ù„Ø© ÙˆØ²Ø± Ø§Ù„Ø¹Ø±Ø¶ ÙÙ‚Ø·
  if (typeof updateInvoiceFormWarrantyUI === 'function') updateInvoiceFormWarrantyUI();
}

function openAddProductModalForInvoice() {
  state.isAddingProductForInvoice = true;
  openAddProductModal();
  document.getElementById('productModalTitle').textContent = state.invoiceType === 'purchase'
    ? 'ðŸ“¥ Ø¥Ø¶Ø§ÙØ© ØµÙ†Ù Ø¬Ø¯ÙŠØ¯ Ù„Ù„Ù…Ø®Ø²Ù† ÙˆØ¥Ø¯Ø±Ø§Ø¬Ù‡ Ø¨ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª'
    : 'âž• Ø¥Ø¶Ø§ÙØ© ØµÙ†Ù Ø¬Ø¯ÙŠØ¯ ÙˆØ¥Ø¯Ø±Ø§Ø¬Ù‡ Ø¨Ø§Ù„ÙØ§ØªÙˆØ±Ø©';
}

// ============================================================
// Ø¥Ø¯Ø§Ø±Ø© Ø¯ÙŠÙˆÙ† ÙˆØ£Ø±ØµØ¯Ø© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆØ§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† (Dedicated Customers & Suppliers System)
// ============================================================
async function loadCustomers() {
  try {
    const [resCust, resSupp] = await Promise.all([
      fetch('/api/customers'),
      fetch('/api/suppliers')
    ]);
    const dataCust = await resCust.json();
    const dataSupp = await resSupp.json();

    const customersList = (dataCust.customers || []).map(c => {
      // shamelBalance: Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„ â€” Ù„Ø§ ÙŠØªØ£Ø«Ø± Ø¨Ø§Ù„Ø³Ù†Ø¯Ø§Øª/Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ù…Ø­Ù„ÙŠØ©
      // Ø¥Ù† Ù„Ù… ÙŠÙƒÙ† Ù…ÙˆØ¬ÙˆØ¯Ø§Ù‹ (Ø³Ø¬Ù„Ø§Øª Ù‚Ø¯ÙŠÙ…Ø© Ù‚Ø¨Ù„ Ø§Ù„Ù…Ø²Ø§Ù…Ù†Ø©) Ù†Ø³ØªØ®Ø¯Ù… balance ÙƒØ¨Ø¯ÙŠÙ„ Ù…Ø¤Ù‚Øª
      const displayBal = c.shamelBalance !== undefined ? parseFloat(c.shamelBalance) || 0 : parseFloat(c.balance) || 0;
      return {
        ...c,
        balance: displayBal,
        shamelBalance: displayBal,
        accountType: 'customer',
        isSupplier: false,
        systemNumber: c.systemNumber || c.shamelCode || ''
      };
    });

    const suppliersList = (dataSupp.suppliers || []).map(s => {
      // shamelBalance: Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„ â€” Ù‡Ø°Ø§ Ù‡Ùˆ Ù…Ø§ ÙŠÙØ¹Ø±ÙŽØ¶ ÙÙŠ Ø§Ù„Ø¬Ø¯ÙˆÙ„
      const displayBal = s.shamelBalance !== undefined ? parseFloat(s.shamelBalance) || 0 : parseFloat(s.balance) || 0;
      return {
        id: s.id,
        systemNumber: s.shamelCode || s.systemNumber || '',
        shamelCode: s.shamelCode,
        name: s.name,
        phone: s.phone || s.mobile || '',
        balance: displayBal,
        shamelBalance: displayBal,
        notes: s.notes || (displayBal !== 0 ? `Ù…Ø³ØªØ­Ù‚ Ø¯Ø§Ø¦Ù† Ù„Ù„Ù…ÙˆØ±Ø¯ Ø¨Ø°Ù…Ø© Ø§Ù„Ù…Ø¹Ø±Ø¶: ${displayBal.toLocaleString('en-US')} Ø´ÙŠÙƒÙ„` : 'Ø­Ø³Ø§Ø¨ Ø®Ø§Ù„Øµ'),
        accountType: 'supplier',
        isSupplier: true,
        isStopped: Boolean(s.isStopped),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        syncedAt: s.syncedAt
      };
    });

    state.rawCustomers = customersList;
    state.rawSuppliers = suppliersList;
    // Ø¯Ù…Ø¬ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆØ§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† Ù…Ø¹Ø§Ù‹ ÙÙŠ Ø³Ø¬Ù„ Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ù…ÙˆØ­Ø¯
    state.customers = [...customersList, ...suppliersList];

    updateCustomerDebtsBadge();
    renderCustomerTab();
  } catch (err) {
    console.error('ÙØ´Ù„ Ø¬Ù„Ø¨ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆØ§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ†:', err);
  }
}

function updateCustomerDebtsBadge() {
  // Ø­Ø³Ø§Ø¨ ÙƒØ§ÙØ© Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„ØªÙŠ Ø¹Ù„ÙŠÙ‡Ø§ Ø°Ù…Ù… Ù…Ø¯ÙŠÙ†Ø©
  const indebtedCount = state.customers.filter(c => {
    const b = parseFloat(c.balance) || 0;
    return c.isSupplier ? (b < 0) : (b > 0);
  }).length;

  const badge = document.getElementById('customerDebtsBadgeNav');
  const mobCustBadge = document.getElementById('mobCustomerDebtsBadge');
  if (mobCustBadge) {
    mobCustBadge.style.display = indebtedCount > 0 ? 'inline-flex' : 'none';
    mobCustBadge.textContent = indebtedCount;
  }
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
  const isSupp = Boolean(c.isSupplier);
  const hasDebt = isSupp ? (bal < 0) : (bal > 0);
  const isCredit = isSupp ? (bal > 0) : (bal < 0);

  // ÙØ­Øµ ÙƒØ§ÙØ© Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ Ø§Ù„Ø®Ø§ØµØ© Ø¨Ø§Ù„Ø­Ø³Ø§Ø¨
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
    dateFormatted = c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : 'Ù…Ø³Ø¬Ù„ Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…';
  }

  // Ø§Ù‚ØªØ±Ø¨ Ù…Ù† 30 ÙŠÙˆÙ…Ø§Ù‹ (Ù…Ù† 25 ÙŠÙˆÙ…Ø§Ù‹ ÙØ£ÙƒØ«Ø±) Ø£Ùˆ ØªØ¬Ø§ÙˆØ²Ù‡Ø§ ÙˆÙ„Ø¯ÙŠÙ‡ Ø¯ÙŠÙ† Ù…Ø³ØªØ­Ù‚ Ø¨Ø°Ù…ØªÙ‡
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
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  if (!tbody) return;

  // Ø§Ù„Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¯Ù‚ÙŠÙ‚ Ù„Ù„Ø£Ø±ØµØ¯Ø© (Ø²Ø¨Ø§Ø¦Ù† ÙˆÙ…ÙˆØ±Ø¯ÙŠÙ†)
  let totalDebit = 0;   // Ø¯ÙŠÙˆÙ† Ø¹Ù„ÙŠÙ‡Ù… Ù„ØµØ§Ù„Ø­ Ø§Ù„Ù…Ø¹Ø±Ø¶
  let totalCredit = 0;  // Ø£Ø±ØµØ¯Ø© Ù„Ù‡Ù… ÙˆØ§Ù„ØªØ²Ø§Ù…Ø§Øª Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø¹Ø±Ø¶ (ØªØ´Ù…Ù„ Ù…Ø³ØªØ­Ù‚Ø§Øª Ø§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ†)
  let countDebtors = 0;
  let countCreditors = 0;
  let countSettled = 0;
  let countCustomers = 0;
  let countSuppliers = 0;

  state.customers.forEach(c => {
    const b = parseFloat(c.balance) || 0;
    if (c.isSupplier) {
      countSuppliers++;
      if (b > 0) {
        // Ù…Ø³ØªØ­Ù‚ Ù„Ù„Ù…ÙˆØ±Ø¯ (Ù„Ù‡ Ø±ØµÙŠØ¯ Ø¯Ø§Ø¦Ù† Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø¹Ø±Ø¶)
        totalCredit += b;
        countCreditors++;
      } else if (b < 0) {
        // Ø±ØµÙŠØ¯ Ø¹Ù„Ù‰ Ø§Ù„Ù…ÙˆØ±Ø¯ Ù„ØµØ§Ù„Ø­ Ø§Ù„Ù…Ø¹Ø±Ø¶
        totalDebit += Math.abs(b);
        countDebtors++;
      } else {
        countSettled++;
      }
    } else {
      countCustomers++;
      if (b > 0) {
        // Ø¯ÙŠÙ† Ø¹Ù„Ù‰ Ø§Ù„Ø²Ø¨ÙˆÙ†
        totalDebit += b;
        countDebtors++;
      } else if (b < 0) {
        // Ø±ØµÙŠØ¯ Ø¯Ø§Ø¦Ù† Ù„Ù„Ø²Ø¨ÙˆÙ†
        totalCredit += Math.abs(b);
        countCreditors++;
      } else {
        countSettled++;
      }
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
  if (elDebtorsSub) elDebtorsSub.textContent = `${countDebtors} Ø­Ø³Ø§Ø¨ Ù…Ø¯ÙŠÙ† (Ø¹Ù„ÙŠÙ‡Ù… Ù…Ø¨Ø§Ù„Øº)`;

  if (elCreditTotal) elCreditTotal.textContent = `${totalCredit.toLocaleString('en-US')} ${cur}`;
  if (elCreditorsSub) elCreditorsSub.textContent = `${countCreditors} Ø­Ø³Ø§Ø¨ Ø¯Ø§Ø¦Ù† (Ù„Ù‡Ù… Ù…Ø³ØªØ­Ù‚Ø§Øª ÙˆØ£Ø±ØµØ¯Ø©)`;

  if (elNetBalance) {
    elNetBalance.textContent = `${Math.abs(netBalance).toLocaleString('en-US')} ${cur}`;
  }
  if (elNetLabel) {
    elNetLabel.textContent = netBalance > 0 ? 'ØµØ§ÙÙŠ Ù…Ø·Ù„ÙˆØ¨ Ù„ØµØ§Ù„Ø­ Ø§Ù„Ù…Ø¹Ø±Ø¶ (+)' : (netBalance < 0 ? 'ØµØ§ÙÙŠ Ø§Ù„ØªØ²Ø§Ù… Ø¯Ø§Ø¦Ù† Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø¹Ø±Ø¶ (-)' : 'Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„ØµØ§ÙÙŠ Ù…ØªÙˆØ§Ø²Ù†');
  }
  if (elNetIcon) {
    elNetIcon.textContent = netBalance > 0 ? 'ðŸ“ˆ' : (netBalance < 0 ? 'ðŸ“‰' : 'âš–ï¸');
  }
  if (elNetSub) {
    if (netBalance > 0) {
      elNetSub.textContent = `ÙØ§Ø¦Ø¶ Ø°Ù…Ù… Ù…Ø¯ÙŠÙ†Ø© Ù„ØµØ§Ù„Ø­ Ø§Ù„Ù…Ø¹Ø±Ø¶ Ø¨Ù…Ù‚Ø¯Ø§Ø± +${netBalance.toLocaleString('en-US')} ${cur}`;
    } else if (netBalance < 0) {
      elNetSub.textContent = `Ù…Ø³ØªØ­Ù‚Ø§Øª Ù„Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆØ§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø¹Ø±Ø¶ Ø¨Ù…Ù‚Ø¯Ø§Ø± -${Math.abs(netBalance).toLocaleString('en-US')} ${cur}`;
    } else {
      elNetSub.textContent = 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ù…Ø§ Ø¹Ù„ÙŠÙ‡Ù… Ù…Ø³Ø§ÙˆÙ ØªÙ…Ø§Ù…Ø§Ù‹ Ù„Ù…Ø§ Ù„Ù‡Ù…';
    }
  }
  if (elNetCard) {
    elNetCard.className = netBalance >= 0 ? 'card cust-kpi-card net-positive' : 'card cust-kpi-card net-negative';
  }

  if (elTotalCount) elTotalCount.textContent = `${totalCount} Ø­Ø³Ø§Ø¨ (${countCustomers} Ø²Ø¨ÙˆÙ†ØŒ ${countSuppliers} Ù…ÙˆØ±Ø¯)`;
  if (elStatsSummary) elStatsSummary.textContent = `${countDebtors} Ù…Ø¯ÙŠÙ† | ${countCreditors} Ø¯Ø§Ø¦Ù† | ${countSettled} Ø®Ø§Ù„Øµ`;

  // ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„ÙÙ„Ø§ØªØ± Ø¨Ø¯Ù‚Ø©
  let filtered = state.customers.filter(c => {
    const bal = parseFloat(c.balance) || 0;
    const isSupp = Boolean(c.isSupplier);
    const hasDebt = isSupp ? (bal < 0) : (bal > 0);
    const hasCredit = isSupp ? (bal > 0) : (bal < 0);
    const isSettled = (bal === 0);

    if (state.customerDebtFilter === 'customers_only' && isSupp) return false;
    if (state.customerDebtFilter === 'suppliers_only' && !isSupp) return false;
    if (state.customerDebtFilter === 'with_debt' && !hasDebt) return false;
    if (state.customerDebtFilter === 'with_credit' && !hasCredit) return false;
    if (state.customerDebtFilter === 'settled' && !isSettled) return false;

    if (state.customerTabSearch) {
      const q = state.customerTabSearch;
      const matchName = c.name && c.name.toLowerCase().includes(q);
      const matchSys = c.systemNumber && String(c.systemNumber).toLowerCase().includes(q);
      const matchPhone = c.phone && c.phone.includes(q);
      const matchNotes = c.notes && c.notes.toLowerCase().includes(q);
      const matchType = (isSupp && (q.includes('Ù…ÙˆØ±Ø¯') || q.includes('supplier'))) || (!isSupp && (q.includes('Ø²Ø¨ÙˆÙ†') || q.includes('Ø¹Ù…ÙŠÙ„')));
      return matchName || matchSys || matchPhone || matchNotes || matchType;
    }
    return true;
  });

  if (elBadgeCount) elBadgeCount.textContent = `${filtered.length} Ø­Ø³Ø§Ø¨`;

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';

  // ÙØ±Ø² Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª:
  // 1. Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ Ø§Ù„Ù…Ù‚ØªØ±Ø¨ÙŠÙ† Ù…Ù† 30 ÙŠÙˆÙ…Ø§Ù‹ Ø£Ùˆ Ø§Ù„Ù…ØªØ¬Ø§ÙˆØ²ÙŠÙ† 30 ÙŠÙˆÙ…Ø§Ù‹ (Ø§Ù„Ù„ÙˆÙ† Ø§Ù„Ø£Ø­Ù…Ø±) ÙÙŠ Ø§Ù„Ù‚Ù…Ø© Ø£ÙˆÙ„Ø§Ù‹ Ø¯Ø§Ø¦Ù…Ø§Ù‹!
  // 2. Ø¨Ø§Ù‚ÙŠ Ø§Ù„Ù…Ø¯ÙŠÙ†ÙŠÙ† (Ø¹Ù„ÙŠÙ‡Ù… Ø¯ÙŠÙˆÙ†)
  // 3. Ø§Ù„Ø¯Ø§Ø¦Ù†ÙŠÙ† (Ù„Ù‡Ù… Ø£Ø±ØµØ¯Ø©)
  // 4. Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ù…Ø³Ø¯Ø¯Ø©
  filtered.sort((a, b) => {
    const timerA = getCustomerReceiptTimerData(a);
    const timerB = getCustomerReceiptTimerData(b);

    if (timerA.isUrgentRed && !timerB.isUrgentRed) return -1;
    if (!timerA.isUrgentRed && timerB.isUrgentRed) return 1;
    if (timerA.isUrgentRed && timerB.isUrgentRed) {
      if (timerB.daysSince !== timerA.daysSince) {
        return timerB.daysSince - timerA.daysSince;
      }
      return (parseFloat(b.balance) || 0) - (parseFloat(a.balance) || 0);
    }

    const balA = parseFloat(a.balance) || 0;
    const balB = parseFloat(b.balance) || 0;
    const isDebtA = a.isSupplier ? (balA < 0) : (balA > 0);
    const isDebtB = b.isSupplier ? (balB < 0) : (balB > 0);

    if (isDebtA && !isDebtB) return -1;
    if (!isDebtA && isDebtB) return 1;

    // Ø§Ù„Ù…ÙˆØ±Ø¯ÙŠÙ† Ø°ÙˆÙˆ Ø§Ù„Ù…Ø¨Ø§Ù„Øº Ø§Ù„Ø¯Ø§Ø¦Ù†Ø© Ø§Ù„ÙƒØ¨ÙŠØ±Ø©
    const effBalA = a.isSupplier ? balA : -balA;
    const effBalB = b.isSupplier ? balB : -balB;
    return effBalB - effBalA;
  });

  tbody.innerHTML = filtered.map(c => {
    const bal = parseFloat(c.balance) || 0;
    const isSupp = Boolean(c.isSupplier);
    const hasDebt = isSupp ? (bal < 0) : (bal > 0);
    const isCredit = isSupp ? (bal > 0) : (bal < 0);

    let debtBadgeHtml = '';
    if (isSupp) {
      if (bal > 0) {
        debtBadgeHtml = `<span class="bal-tag credit" style="background:#fef3c7; border-color:#fcd34d; color:#92400e; font-weight:800;">ðŸ”µ Ù„Ù‡ Ø±ØµÙŠØ¯ (Ù…ÙˆØ±Ø¯): ${bal.toLocaleString('en-US')} ${cur}</span>`;
      } else if (bal < 0) {
        debtBadgeHtml = `<span class="bal-tag debit">ðŸ”´ Ø¹Ù„ÙŠÙ‡ Ø±ØµÙŠØ¯ Ù„Ù„Ù…Ø¹Ø±Ø¶: ${Math.abs(bal).toLocaleString('en-US')} ${cur}</span>`;
      } else {
        debtBadgeHtml = `<span class="bal-tag settled">ðŸŸ¢ Ø®Ø§Ù„Øµ (0 ${cur})</span>`;
      }
    } else {
      if (hasDebt) {
        debtBadgeHtml = `<span class="bal-tag debit">ðŸ”´ Ø¹Ù„ÙŠÙ‡ Ø¯ÙŠÙ†: ${bal.toLocaleString('en-US')} ${cur}</span>`;
      } else if (isCredit) {
        debtBadgeHtml = `<span class="bal-tag credit">ðŸ”µ Ù„Ù‡ Ø±ØµÙŠØ¯ Ø¯Ø§Ø¦Ù†: ${Math.abs(bal).toLocaleString('en-US')} ${cur}</span>`;
      } else {
        debtBadgeHtml = `<span class="bal-tag settled">ðŸŸ¢ Ø®Ø§Ù„Øµ (0 ${cur})</span>`;
      }
    }

    // Ø­Ø³Ø§Ø¨ Ù…Ø¤Ù‚Øª ÙˆØªØ§Ø±ÙŠØ® Ø¢Ø®Ø± Ø­Ø±ÙƒØ©
    const timer = getCustomerReceiptTimerData(c);
    let timerHtml = '';

    if (timer.lastReceipt) {
      let statusText = '';
      if (timer.daysSince === 0) statusText = 'Ø­Ø±ÙƒØ© Ø§Ù„ÙŠÙˆÙ…';
      else if (timer.daysSince === 1) statusText = 'Ù…Ø¶Ù‰ ÙŠÙˆÙ… ÙˆØ§Ø­Ø¯ (Ø£Ù…Ø³)';
      else if (timer.daysSince === 2) statusText = 'Ù…Ø¶Ù‰ ÙŠÙˆÙ…Ø§Ù†';
      else if (timer.daysSince <= 10) statusText = `Ù…Ø¶Ù‰ ${timer.daysSince} Ø£ÙŠØ§Ù…`;
      else statusText = `Ù…Ø¶Ù‰ ${timer.daysSince} ÙŠÙˆÙ…Ø§Ù‹`;

      let badgeClass = 'timer-recent';
      let urgencyBadge = '';

      if (timer.isOver30) {
        badgeClass = 'timer-urgent-30';
        urgencyBadge = `<div style="color: #991b1b; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fee2e2; padding: 2px 6px; border-radius: 4px; border: 1px solid #f87171;">ðŸš¨ ØªØ¬Ø§ÙˆØ² 30 ÙŠÙˆÙ…Ø§Ù‹ Ø¨Ø¯ÙˆÙ† Ø³Ø¯Ø§Ø¯!</div>`;
      } else if (timer.isNear30) {
        badgeClass = 'timer-urgent-30';
        urgencyBadge = `<div style="color: #b91c1c; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fef2f2; padding: 2px 6px; border-radius: 4px; border: 1px solid #fca5a5;">âš ï¸ ÙŠÙ‚ØªØ±Ø¨ Ù…Ù† 30 ÙŠÙˆÙ…Ø§Ù‹ (${timer.daysSince} ÙŠÙˆÙ…)</div>`;
      } else if (timer.hasDebt && timer.daysSince >= 15) {
        badgeClass = 'timer-warning';
      } else if (!timer.hasDebt) {
        badgeClass = 'timer-settled';
      }

      timerHtml = `
        <div class="cust-timer-badge ${badgeClass}" style="${timer.isUrgentRed ? 'border: 2px solid #ef4444; background: #fee2e2; color: #991b1b;' : ''}">
          <div style="font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
            <span>${timer.isUrgentRed ? 'ðŸš¨' : (timer.hasDebt ? 'â±ï¸' : 'âœ…')}</span>
            <span style="font-size: 0.88rem;">${statusText}</span>
          </div>
          <div style="font-size: 0.76rem; font-family: monospace; direction: ltr; text-align: center; color: ${timer.isUrgentRed ? '#7f1d1d' : '#475569'}; margin-top: 0.15rem; font-weight: 700;">
            ðŸ“… ${timer.dateFormatted}
          </div>
          <div style="font-size: 0.72rem; opacity: 0.9; text-align: center; margin-top: 0.1rem;">
            Ø³Ù†Ø¯ #${timer.lastReceipt.receiptNumber} (${(timer.lastReceipt.amount || 0).toLocaleString('en-US')} ${cur})
          </div>
          ${urgencyBadge}
        </div>
      `;
    } else {
      let urgencyBadge = '';
      let badgeClass = timer.hasDebt ? (timer.daysSince >= 25 ? 'timer-urgent-30' : 'timer-warning') : 'timer-none';

      if (timer.isUrgentRed) {
        urgencyBadge = `<div style="color: #991b1b; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fee2e2; padding: 2px 6px; border-radius: 4px; border: 1px solid #f87171;">ðŸš¨ ${timer.daysSince >= 30 ? 'ØªØ¬Ø§ÙˆØ² 30 ÙŠÙˆÙ…Ø§Ù‹ Ø¨Ø¯ÙˆÙ† Ø£ÙŠ Ø³Ø¯Ø§Ø¯!' : `ÙŠÙ‚ØªØ±Ø¨ Ù…Ù† 30 ÙŠÙˆÙ…Ø§Ù‹ (${timer.daysSince} ÙŠÙˆÙ…)`}</div>`;
      }

      timerHtml = `
        <div class="cust-timer-badge ${badgeClass}" style="${timer.isUrgentRed ? 'border: 2px solid #ef4444; background: #fee2e2; color: #991b1b;' : ''}">
          <div style="font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
            <span>${timer.isUrgentRed ? 'ðŸš¨' : 'âš ï¸'}</span>
            <span>${isSupp ? 'Ø­Ø³Ø§Ø¨ Ù…ÙˆØ±Ø¯ Ù…Ø³Ø¬Ù„' : 'Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø³Ø¯Ø§Ø¯ Ø³Ø§Ø¨Ù‚'}</span>
          </div>
          <div style="font-size: 0.76rem; font-family: monospace; direction: ltr; text-align: center; color: #64748b; margin-top: 0.15rem; font-weight: 700;">
            ðŸ“… ${timer.dateFormatted}
          </div>
          <div style="font-size: 0.72rem; opacity: 0.9; text-align: center; margin-top: 0.1rem;">
            ${isSupp ? 'Ø±ØµÙŠØ¯ Ø¯Ø§Ø¦Ù† Ù„Ù„Ø´Ø§Ù…Ù„' : `Ù…Ø¶Ù‰ ${timer.daysSince} ÙŠÙˆÙ…Ø§Ù‹ Ø¨Ø¯ÙˆÙ† Ø³Ø¯Ø§Ø¯`}
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
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            ${timer.isUrgentRed ? '<span title="ÙŠÙ‚ØªØ±Ø¨ Ù…Ù† Ø£Ùˆ ØªØ¬Ø§ÙˆØ² 30 ÙŠÙˆÙ…Ø§Ù‹ Ø¨Ø¯ÙˆÙ† Ø³Ø¯Ø§Ø¯">ðŸš¨</span>' : ''}
            <strong style="font-size: 0.95rem; color: #0f172a;">${escapeHtml(c.name)}</strong>
            ${isSupp 
              ? '<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:0.75rem; padding:2px 7px; font-weight:800;">ðŸ¢ Ù…ÙˆØ±Ø¯</span>'
              : '<span class="badge" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:0.75rem; padding:2px 7px; font-weight:700;">ðŸ‘¤ Ø²Ø¨ÙˆÙ†</span>'
            }
          </div>
        </td>
        <td>
          ${c.phone ? `<span style="direction: ltr; display: inline-block;">ðŸ“ž ${escapeHtml(c.phone)}</span>` : '<span style="color:#94a3b8;">--</span>'}
        </td>
        <td style="text-align: center;">${debtBadgeHtml}</td>
        <td style="text-align: center;">${timerHtml}</td>
        <td style="font-size: 0.85rem; color: #64748b;">${escapeHtml(c.notes || '--')}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; justify-content: center; flex-wrap: wrap;">
            ${isSupp ? `
              <button class="btn btn-xs btn-success" onclick="quickIssueReceiptForCustomer('${c.id}')" title="Ø¥ØµØ¯Ø§Ø± Ø³Ù†Ø¯ ØµØ±Ù / Ø¯ÙØ¹ Ù„Ù„Ù…ÙˆØ±Ø¯">
                <span>ðŸ’° Ø³Ù†Ø¯ ØµØ±Ù / Ù‚Ø¨Ø¶</span>
              </button>
              <button class="btn btn-xs btn-primary" onclick="quickCreatePurchaseInvoiceForSupplier('${c.id}')" title="Ø¥Ù†Ø´Ø§Ø¡ ÙØ§ØªÙˆØ±Ø© ØªÙˆØ±ÙŠØ¯ ÙˆÙ…Ø´ØªØ±ÙŠØ§Øª Ø¨Ø§Ø³Ù… Ø§Ù„Ù…ÙˆØ±Ø¯">
                <span>ðŸ§¾ ÙØ§ØªÙˆØ±Ø© ØªÙˆØ±ÙŠØ¯</span>
              </button>
            ` : `
              <button class="btn btn-xs btn-success" onclick="quickIssueReceiptForCustomer('${c.id}')" title="Ø¥ØµØ¯Ø§Ø± Ø³Ù†Ø¯ Ù‚Ø¨Ø¶ Ù…Ø¨Ø§Ø´Ø± Ù„Ø®ØµÙ… Ø¯ÙŠÙ†Ù‡">
                <span>ðŸ’° Ø³Ù†Ø¯ Ù‚Ø¨Ø¶</span>
              </button>
              <button class="btn btn-xs btn-primary" onclick="quickCreateInvoiceForCustomer('${c.id}')" title="Ø¥Ù†Ø´Ø§Ø¡ ÙØ§ØªÙˆØ±Ø© Ø¬Ø¯ÙŠØ¯Ø© Ø¨Ø§Ø³Ù…Ù‡">
                <span>ðŸ§¾ ÙØ§ØªÙˆØ±Ø©</span>
              </button>
            `}
            <button class="btn-statement" onclick="openCustomerStatementModal('${c.id}')" title="Ø¹Ø±Ø¶ ÙˆØ·Ø¨Ø§Ø¹Ø© ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ø§Ù„ØªÙØµÙŠÙ„ÙŠ">
              <span>ðŸ“‘ ÙƒØ´Ù Ø­Ø³Ø§Ø¨</span>
            </button>
            ${!isSupp && hasDebt ? `
              <button class="btn btn-xs btn-warning btn-cust-reminder" onclick="sendCustomerDebtReminder('${c.id}')" title="Ø¥Ø±Ø³Ø§Ù„ ØªØ°ÙƒÙŠØ± Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ø¯ÙØ¹Ø© Ù…Ø§Ù„ÙŠØ© Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…">
                <span>ðŸ”” ØªØ°ÙƒÙŠØ± Ø¯ÙØ¹Ø©</span>
              </button>
            ` : ''}
            ${!isSupp ? `
              <button class="btn btn-xs btn-secondary" onclick="openAddCustomerModal('${c.id}')" title="ØªØ¹Ø¯ÙŠÙ„">
                <span>âœï¸</span>
              </button>
              <button class="btn btn-xs btn-danger" onclick="confirmDeleteCustomer('${c.id}')" title="Ø­Ø°Ù Ø§Ù„Ø²Ø¨ÙˆÙ†">
                <span>ðŸ—‘ï¸</span>
              </button>
            ` : `
              <button class="btn btn-xs btn-secondary" onclick="showToast('ØªÙ…Øª Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ù…ÙˆØ±Ø¯ Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„ Ù„Ø§ÙŠØª', 'info')" title="Ø§Ù„Ù…ÙˆØ±Ø¯ Ù…ØªØ²Ø§Ù…Ù† Ù…Ù† Ø§Ù„Ø´Ø§Ù…Ù„">
                <span>ðŸ”’ Ù…Ø²Ø§Ù…Ù†</span>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function quickCreatePurchaseInvoiceForSupplier(supplierId) {
  const s = state.customers.find(item => item.id === supplierId);
  if (!s) return;
  setInvoiceType('purchase');
  const custInput = document.getElementById('invCustomerName');
  if (custInput) {
    custInput.value = s.name;
    handleInvoiceCustomerInput(s.name);
  }
  switchTab('create-invoice');
  showToast(`ØªÙ… ÙØªØ­ ÙØ§ØªÙˆØ±Ø© ØªÙˆØ±ÙŠØ¯ ÙˆÙ…Ø´ØªØ±ÙŠØ§Øª Ø¬Ø¯ÙŠØ¯Ø© Ù„Ù„Ù…ÙˆØ±Ø¯ [${s.name}]`, 'info');
}


// -------------------------------------------------------------
// Ø§Ù„Ø¨Ø­Ø« Ø§Ù„ØªÙØ§Ø¹Ù„ÙŠ ÙˆØ§Ù„Ø¥ÙƒÙ…Ø§Ù„ Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ø²Ø¨Ø§Ø¦Ù† (Invoice & Receipt Auto-complete)
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

  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
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
          ${c.phone ? `<span class="cust-auto-phone">ðŸ“ž ${c.phone}</span>` : ''}
        </div>
        <div class="cust-auto-debt ${bal > 0 ? 'has-debt' : ''}">
          ${bal > 0 ? `Ø§Ù„Ø¯ÙŠÙ†: ${bal.toLocaleString('en-US')} ${cur}` : `Ø§Ù„Ø±ØµÙŠØ¯: 0 ${cur}`}
        </div>
      </div>
    `;
  });

  if (!exactMatch && query.length >= 2) {
    html += `
      <div class="cust-auto-item add-new-cust-item" onclick="quickCreateCustomerFromInput('invoice', '${escapeHtml(query)}')">
        <span>âž• Ø¥Ø¶Ø§ÙØ© "<strong>${escapeHtml(query)}</strong>" ÙƒØ²Ø¨ÙˆÙ† Ø¬Ø¯ÙŠØ¯ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…</span>
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
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  if (nameInput) nameInput.value = c.name;
  if (phoneInput && c.phone) phoneInput.value = c.phone;
  if (dropdown) dropdown.style.display = 'none';

  if (debtAlert && debtText) {
    const bal = parseFloat(c.balance) || 0;
    debtText.innerHTML = `Ø±ØµÙŠØ¯ Ø§Ù„Ø²Ø¨ÙˆÙ† Ø§Ù„Ø­Ø§Ù„ÙŠ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù… (Ø§Ù„Ø¯ÙŠÙ† Ø§Ù„Ù…Ø³ØªØ­Ù‚): <strong style="color:#b91c1c; font-size:1.05rem;">${bal.toLocaleString('en-US')} ${cur}</strong>`;
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

  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
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
          ${c.phone ? `<span class="cust-auto-phone">ðŸ“ž ${c.phone}</span>` : ''}
        </div>
        <div class="cust-auto-debt ${bal > 0 ? 'has-debt' : ''}">
          ${bal > 0 ? `Ø§Ù„Ø¯ÙŠÙ†: ${bal.toLocaleString('en-US')} ${cur}` : `Ø§Ù„Ø±ØµÙŠØ¯: 0 ${cur}`}
        </div>
      </div>
    `;
  });

  if (!exactMatch && query.length >= 2) {
    html += `
      <div class="cust-auto-item add-new-cust-item" onclick="quickCreateCustomerFromInput('receipt', '${escapeHtml(query)}')">
        <span>âž• Ø¥Ø¶Ø§ÙØ© "<strong>${escapeHtml(query)}</strong>" ÙƒØ²Ø¨ÙˆÙ† Ø¬Ø¯ÙŠØ¯ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…</span>
      </div>
    `;
  }

  dropdown.innerHTML = html;
  dropdown.style.display = html ? 'block' : 'none';
}

function selectReceiptCustomer(custId) {
  const c = state.customers.find(cust => cust.id === custId);
  if (!c) return;

  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
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

  // ØªØ­Ø¯ÙŠØ« Ø¨Ø·Ø§Ù‚Ø© Ø¯ÙŠÙ† Ø§Ù„Ø²Ø¨ÙˆÙ† ÙÙŠ ÙˆØ§Ø¬Ù‡Ø© Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶
  const card = document.getElementById('rcpCustomerDebtCard');
  const nameEl = document.getElementById('rcpDebtCustName');
  const numEl = document.getElementById('rcpDebtCustNum');
  const valEl = document.getElementById('rcpDebtCurrentVal');

  if (card && nameEl && valEl) {
    nameEl.textContent = c.name;
    if (numEl) numEl.textContent = c.systemNumber ? `Ø±Ù‚Ù… Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…: #${c.systemNumber}` : 'Ø²Ø¨ÙˆÙ† Ù…Ø³Ø¬Ù„';
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
    notes: 'ØªÙ…Øª Ø¥Ø¶Ø§ÙØªÙ‡ Ù…Ø¨Ø§Ø´Ø±Ø© Ù…Ù† ÙˆØ§Ø¬Ù‡Ø© ' + (context === 'invoice' ? 'Ø§Ù„ÙØ§ØªÙˆØ±Ø©' : 'Ø³Ù†Ø¯ Ø§Ù„Ù‚Ø¨Ø¶')
  };

  fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newCust)
  }).then(res => res.json()).then(data => {
    if (data.success && data.customer) {
      state.customers.push(data.customer);
      showToast(`ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ø²Ø¨ÙˆÙ† "${cleanName}" Ø¨Ù†Ø¬Ø§Ø­ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù… Ø¨Ø±Ù‚Ù… #${data.customer.systemNumber}`, 'success');
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
    showToast('Ø±ØµÙŠØ¯ Ø§Ù„Ø²Ø¨ÙˆÙ† Ø®Ø§Ù„Øµ Ø£Ùˆ ØµÙØ±', 'info');
  }
}

function updateReceiptRemainingCalculation() {
  const prevBal = parseFloat(document.getElementById('rcpPreviousBalance')?.value) || 0;
  const currentAmt = parseFloat(document.getElementById('rcpAmount')?.value) || 0;
  const remBalInput = document.getElementById('rcpRemainingBalance');
  const remHint = document.getElementById('rcpDebtRemainingHint');
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  const remaining = Math.max(0, prevBal - currentAmt);
  if (remBalInput) remBalInput.value = remaining;
  if (remHint) {
    remHint.innerHTML = `Ø§Ù„Ø±ØµÙŠØ¯ Ø¨Ø¹Ø¯ Ø§Ù„Ø³Ù†Ø¯: <strong style="color: ${remaining > 0 ? '#b45309' : '#047857'};">${remaining.toLocaleString('en-US')} ${cur}</strong>`;
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
// Ø¥Ø¯Ø§Ø±Ø© Ù†Ø§ÙØ°Ø© Ø¥Ø¶Ø§ÙØ© / ØªØ¹Ø¯ÙŠÙ„ Ø²Ø¨ÙˆÙ†
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
    if (title) title.textContent = 'ØªØ¹Ø¯ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ­Ø³Ø§Ø¨ Ø§Ù„Ø²Ø¨ÙˆÙ†';
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
    if (title) title.textContent = 'Ø¥Ø¶Ø§ÙØ© Ø²Ø¨ÙˆÙ† Ø¬Ø¯ÙŠØ¯ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…';
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
        hint.innerHTML = 'ðŸŸ¢ Ø§Ù„Ø±ØµÙŠØ¯ ØµÙØ± (Ø§Ù„Ø­Ø³Ø§Ø¨ Ø®Ø§Ù„Øµ ÙˆÙ…Ø³Ø¯Ø¯ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„)';
      } else {
        hint.style.color = '#1d4ed8';
        hint.style.background = '#eff6ff';
        hint.style.borderColor = '#bfdbfe';
        hint.innerHTML = `ðŸ”µ Ø§Ù„Ø­Ø§Ù„Ø©: Ø§Ù„Ø²Ø¨ÙˆÙ† Ù„Ù‡ Ø±ØµÙŠØ¯ Ø¯Ø§Ø¦Ù† Ø£Ùˆ Ø¯ÙØ¹Ø© Ù„ØµØ§Ù„Ø­Ù‡ Ø¨Ø°Ù…Ø© Ø§Ù„Ù…Ø¹Ø±Ø¶ (-${balVal.toLocaleString('en-US')})`;
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
        hint.innerHTML = 'ðŸŸ¢ Ø§Ù„Ø±ØµÙŠØ¯ ØµÙØ± (Ø§Ù„Ø­Ø³Ø§Ø¨ Ø®Ø§Ù„Øµ ÙˆÙ…Ø³Ø¯Ø¯ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„)';
      } else {
        hint.style.color = '#dc2626';
        hint.style.background = '#fef2f2';
        hint.style.borderColor = '#fecaca';
        hint.innerHTML = `ðŸ”´ Ø§Ù„Ø­Ø§Ù„Ø©: Ø§Ù„Ø²Ø¨ÙˆÙ† Ø¹Ù„ÙŠÙ‡ Ø¯ÙŠÙ† ÙˆÙ…Ø·Ù„ÙˆØ¨ Ù…Ù†Ù‡ Ù‡Ø°Ø§ Ø§Ù„Ù…Ø¨Ù„Øº Ù„ØµØ§Ù„Ø­ Ø§Ù„Ù…Ø¹Ø±Ø¶ (+${balVal.toLocaleString('en-US')})`;
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
    showToast('Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ† Ù…Ø·Ù„ÙˆØ¨', 'error');
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
      showToast(id ? 'ØªÙ… ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ø²Ø¨ÙˆÙ† ÙˆØ±ØµÙŠØ¯Ù‡ Ø¨Ù†Ø¬Ø§Ø­' : 'ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ø²Ø¨ÙˆÙ† Ø¨Ù†Ø¬Ø§Ø­', 'success');
      closeCustomerEditModal();
      await loadCustomers();
    } else {
      showToast(data.error || 'ÙØ´Ù„ Ø­ÙØ¸ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø²Ø¨ÙˆÙ†', 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…', 'error');
  }
}

async function confirmDeleteCustomer(id) {
  const c = state.customers.find(cust => cust.id === id);
  if (!c) return;

  showConfirmDialog({
    title: 'Ø­Ø°Ù Ø§Ù„Ø²Ø¨ÙˆÙ† Ù…Ù† Ø§Ù„Ù†Ø¸Ø§Ù…',
    message: `Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø­Ø°Ù Ø§Ù„Ø²Ø¨ÙˆÙ† "${c.name}" Ù†Ù‡Ø§Ø¦ÙŠØ§Ù‹ Ù…Ù† Ø³Ø¬Ù„Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù…ØŸ Ù„Ù† ØªØªÙ…ÙƒÙ† Ù…Ù† Ø§Ù„ØªØ±Ø§Ø¬Ø¹ Ø¹Ù† Ù‡Ø°Ù‡ Ø§Ù„Ø¹Ù…Ù„ÙŠØ©.`,
    icon: 'ðŸ—‘ï¸',
    confirmText: 'Ù†Ø¹Ù…ØŒ Ø­Ø°Ù Ø§Ù„Ø²Ø¨ÙˆÙ†',
    cancelText: 'ØªØ±Ø§Ø¬Ø¹ ÙˆØ¥Ù„ØºØ§Ø¡',
    isDanger: true,
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast(`ØªÙ… Ø­Ø°Ù Ø§Ù„Ø²Ø¨ÙˆÙ† "${c.name}" Ø¨Ù†Ø¬Ø§Ø­`, 'success');
          await loadCustomers();
        } else {
          showToast(data.error || 'ÙØ´Ù„ Ø­Ø°Ù Ø§Ù„Ø²Ø¨ÙˆÙ†', 'error');
        }
      } catch (err) {
        showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø­Ø°Ù Ø§Ù„Ø²Ø¨ÙˆÙ†', 'error');
      }
    }
  });
}

async function sendCustomerDebtReminder(id) {
  openCustomerReminderModal(id);
}

// -------------------------------------------------------------
// Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ù…Ù„Ù Ø£Ø±ØµØ¯Ø© Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† CSV
// -------------------------------------------------------------
function triggerCustomerCsvUpload() {
  const input = document.getElementById('customerCsvFileInput');
  if (input) input.click();
}

async function handleCustomerCsvUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  showToast(`Ø¬Ø§Ø±ÙŠ Ù‚Ø±Ø§Ø¡Ø© ÙˆØ§Ø³ØªÙŠØ±Ø§Ø¯ Ù…Ù„Ù Ø§Ù„Ø£Ø±ØµØ¯Ø© "${file.name}"...`, 'info');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const parsedCustomers = parseCustomerCsvText(text);

      if (parsedCustomers.length === 0) {
        showToast('Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø²Ø¨Ø§Ø¦Ù† ØµØ§Ù„Ø­ÙŠÙ† Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ù„Ù', 'warning');
        return;
      }

      const res = await fetch('/api/customers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: parsedCustomers })
      });
      const data = await res.json();

      if (data.success) {
        showToast(`ðŸŽ‰ ØªÙ… Ø¨Ù†Ø¬Ø§Ø­ Ø§Ø³ØªÙŠØ±Ø§Ø¯ ÙˆØªØ­Ø¯ÙŠØ« (${data.imported || parsedCustomers.length}) Ø²Ø¨ÙˆÙ† Ù…Ø¹ Ø£Ø±ØµØ¯ØªÙ‡Ù… Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…!`, 'success');
        await loadCustomers();
      } else {
        showToast(data.error || 'ÙØ´Ù„ Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ø§Ù„Ù…Ù„Ù', 'error');
      }
    } catch (err) {
      console.error('CSV parse error:', err);
      showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ù‚Ø±Ø§Ø¡Ø© Ù…Ù„Ù CSV: ' + err.message, 'error');
    } finally {
      input.value = '';
    }
  };

  // Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ù„Ù ÙƒÙ†Øµ (ÙŠØ¯Ø¹Ù… UTF-8)
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

  // ÙØ­Øµ Ø£ÙˆÙ„ 5 Ø£Ø³Ø·Ø± Ù„Ù…Ø¹Ø±ÙØ© ØªØ±ÙˆÙŠØ³Ø© Ø§Ù„Ø£Ø¹Ù…Ø¯Ø©
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const rawCols = splitCsvLine(lines[i]);
    const lowerCols = rawCols.map(c => c.toLowerCase());

    const hasName = lowerCols.some(c => c.includes('Ø§Ø³Ù…') || c.includes('Ø²Ø¨ÙˆÙ†') || c.includes('Ø¹Ù…ÙŠÙ„') || c.includes('name'));
    const hasBal = lowerCols.some(c => c.includes('Ø±ØµÙŠØ¯') || c.includes('balance') || c.includes('Ù…Ø¨Ù„Øº') || c.includes('Ù…Ø¯ÙŠÙ†'));

    if (hasName || hasBal) {
      headerIndex = i;
      lowerCols.forEach((col, idx) => {
        if (col.includes('Ø±Ù‚Ù…') || col.includes('Ø­Ø³Ø§Ø¨') || col.includes('Ù†Ø¸Ø§Ù…') || col.includes('code') || col.includes('id') || col.includes('acc')) {
          sysNumCol = idx;
        } else if (col.includes('Ø§Ø³Ù…') || col.includes('Ø²Ø¨ÙˆÙ†') || col.includes('Ø¹Ù…ÙŠÙ„') || col.includes('name')) {
          nameCol = idx;
        } else if (col.includes('Ø±ØµÙŠØ¯') || col.includes('balance') || col.includes('Ù…Ø¯ÙŠÙ†') || col.includes('Ù…Ø¨Ù„Øº')) {
          balanceCol = idx;
        } else if (col.includes('Ù‡Ø§ØªÙ') || col.includes('Ø¬ÙˆØ§Ù„') || col.includes('phone') || col.includes('mobile')) {
          phoneCol = idx;
        } else if (col.includes('Ù…Ù„Ø§Ø­Ø¸') || col.includes('note') || col.includes('Ø¨ÙŠØ§Ù†')) {
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
    if (!name || name === 'Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ†' || name === 'Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ') continue;

    const sysNum = String(cols[sysNumCol] || '').trim();
    const rawBal = cols[balanceCol] !== undefined ? cols[balanceCol] : (cols[2] || 0);
    const cleanBal = parseFloat(String(rawBal).replace(/,/g, '').replace(/[\sØ´ÙŠÙƒÙ„$]/g, '')) || 0;
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
  printSinglePage('printableInventoryReportArea');
}

// ============================================================
// Ù†Ø¸Ø§Ù… ØªÙ‚Ø§Ø±ÙŠØ± Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ ÙˆØ§Ù„Ø·Ø¨Ø§Ø¹Ø© PDF
// (Ù…Ø±ÙƒÙ‘Ø² Ø¨Ø¯Ù‚Ø© ØªØ§Ù…Ø© Ø¹Ù„Ù‰ Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ø­Ø§Ù„ÙŠØ©)
// ============================================================
let currentInventoryReportItems = [];
let currentInventoryReportScope = '';

function openInventoryReportModal(overrideCategory = null) {
  const modal = document.getElementById('inventoryReportModal');
  const printableArea = document.getElementById('printableInventoryReportArea');
  const scopeBadge = document.getElementById('invReportFilterScopeBadge');
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  if (!modal || !printableArea) return;

  const searchQuery = (state.inventorySearch || document.getElementById('inventorySearchInput')?.value || '').trim();
  const brandQuery = state.inventoryBrand;
  const catQuery = overrideCategory || state.inventoryCategory;

  let reportTitle = 'ØªÙ‚Ø±ÙŠØ± Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„';
  let scopeDescription = 'ÙƒØ§Ù…Ù„ Ø£ØµÙ†Ø§Ù Ø§Ù„Ù…Ø®Ø²ÙˆÙ†';

  // ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª Ø¨Ø­Ø³Ø¨ Ù†Ø·Ø§Ù‚ Ø§Ù„Ø¨Ø­Ø« ÙˆØ§Ù„ÙÙ„ØªØ±
  let itemsToReport = [...state.products];

  // 1. ÙÙ„ØªØ± Ø§Ù„Ù…Ø§Ø±ÙƒØ©
  if (brandQuery && brandQuery !== 'all') {
    itemsToReport = itemsToReport.filter(p => (p.brand || 'Ø£Ø®Ø±Ù‰') === brandQuery);
    scopeDescription = `Ù…Ø§Ø±ÙƒØ©: ${brandQuery}`;
  }

  // 2. ÙÙ„ØªØ± Ø§Ù„Ù‚Ø³Ù…
  if (catQuery && catQuery !== 'all') {
    itemsToReport = itemsToReport.filter(p => (p.mainCategory || 'Ø£Ø®Ø±Ù‰') === catQuery);
    scopeDescription = (scopeDescription === 'ÙƒØ§Ù…Ù„ Ø£ØµÙ†Ø§Ù Ø§Ù„Ù…Ø®Ø²ÙˆÙ†') ? `Ù‚Ø³Ù…: ${catQuery}` : `${scopeDescription} | Ù‚Ø³Ù…: ${catQuery}`;
  }

  // 3. Ø§Ù„ØªØ±ÙƒÙŠØ² Ø§Ù„ØµØ§Ø±Ù… Ø¹Ù„Ù‰ Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø¥Ø°Ø§ Ù‚Ø§Ù… Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø¨Ø§Ù„Ø¨Ø­Ø«
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

    reportTitle = `ØªÙ‚Ø±ÙŠØ± Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø¨Ø§Ù„Ø¬Ø±Ø¯: "${searchQuery}"`;
    scopeDescription = `Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„ÙƒÙ„Ù…Ø©: "${searchQuery}" (${itemsToReport.length} ØµÙ†Ù)`;
  }

  // ØªØ±ØªÙŠØ¨ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø¨Ø¯Ù‚Ø© Ø¹Ù„Ù‰ Ø­Ø³Ø¨ Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù (Ø§Ù„ÙƒÙˆØ¯) ÙƒÙ…Ø§ Ø·Ù„Ø¨ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…
  itemsToReport.sort((a, b) => {
    const codeA = String(a.code || '').toLowerCase();
    const codeB = String(b.code || '').toLowerCase();
    return codeA.localeCompare(codeB, 'ar-EG', { numeric: true });
  });

  currentInventoryReportItems = itemsToReport;
  currentInventoryReportScope = scopeDescription;

  if (scopeBadge) scopeBadge.textContent = scopeDescription;

  // Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¬Ø§Ù…ÙŠØ¹
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

  // Ø¨Ù†Ø§Ø¡ Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ù…Ø·Ø¨ÙˆØ¹ Ø¨ØªÙ†Ø³ÙŠÙ‚ Ø§Ø­ØªØ±Ø§ÙÙŠ
  let rowsHtml = itemsToReport.map((p, idx) => {
    const s = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
    const cost = parseFloat(p.costPrice) || 0;
    const rowCapital = s * cost;
    const isZero = s === 0;

    // ØªÙ…ÙŠÙŠØ² Ø§Ù„ØµÙ†Ù Ø§Ù„Ø°ÙŠ ÙƒÙ…ÙŠØªÙ‡ ØµÙØ± Ø¨Ø®Ù„ÙÙŠØ© Ø±Ù…Ø§Ø¯ÙŠØ© Ù„Ù„ØªÙ…ÙŠÙŠØ²
    const rowClass = isZero ? 'zero-stock-row' : '';

    return `
      <tr class="${rowClass}">
        <td style="text-align: center; font-weight: bold; width: 40px;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: 800; direction: ltr; text-align: center;">${escapeHtml(p.code || '--')}</td>
        <td>
          <div style="font-weight: 800; color: #0f172a;">${escapeHtml(p.name)}</div>
          <div style="font-size: 0.76rem; color: #64748b;">${escapeHtml(p.brand || 'Ø¹Ø§Ù…')} | ${escapeHtml(p.mainCategory || '')}</div>
        </td>
        <td style="text-align: center; font-weight: 800; font-size: 1rem; color: ${isZero ? '#dc2626' : '#0f172a'};">
          ${isZero ? '0 <span style="font-size: 0.72rem; color: #dc2626;">(Ù†Ø§ÙØ¯)</span>' : `${s} Ù‚Ø·Ø¹Ø©`}
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
          <h2 style="font-size: 1.4rem; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h2>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">ØªÙ‚Ø±ÙŠØ± Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ ÙˆÙ…Ø·Ø§Ø¨Ù‚Ø© Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ ÙˆØ§Ù„ØªÙƒÙ„ÙØ©</div>
        </div>
        <div style="text-align: left;">
          <div style="font-weight: 800; font-size: 1.05rem; color: #2563eb;">${escapeHtml(reportTitle)}</div>
          <div style="font-size: 0.8rem; color: #64748b;">ØªØ§Ø±ÙŠØ® Ø§Ù„ØªÙ‚Ø±ÙŠØ±: ${nowStr}</div>
        </div>
      </div>

      <!-- Ù…Ù„Ø®Øµ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0.85rem; margin-bottom: 1.25rem;">
        <div>
          <span style="font-size: 0.78rem; color: #64748b; display: block;">Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø¨Ø§Ù„ØªÙ‚Ø±ÙŠØ±:</span>
          <strong style="font-size: 1.15rem; color: #0f172a;">${itemsToReport.length} ØµÙ†Ù</strong>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: #64748b; display: block;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø¹Ø¯Ø¯ Ø§Ù„Ù‚Ø·Ø¹:</span>
          <strong style="font-size: 1.15rem; color: #0f172a;">${totalUnits.toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</strong>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: #64748b; display: block;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„:</span>
          <strong style="font-size: 1.15rem; color: #047857;">${totalCapital.toLocaleString('en-US')} ${cur}</strong>
        </div>
        <div>
          <span style="font-size: 0.78rem; color: #64748b; display: block;">Ø£ØµÙ†Ø§Ù ÙƒÙ…ÙŠØªÙ‡Ø§ ØµÙØ±:</span>
          <strong style="font-size: 1.15rem; color: #dc2626;">${zeroStockCount} ØµÙ†Ù Ù†Ø§ÙØ¯</strong>
        </div>
      </div>

      <div style="font-size: 0.82rem; color: #475569; margin-bottom: 0.5rem;">
        ðŸ“Œ <strong>Ù†Ø·Ø§Ù‚ Ø§Ù„ØªÙ‚Ø±ÙŠØ±:</strong> ${escapeHtml(scopeDescription)} | <em>Ù…Ù„Ø§Ø­Ø¸Ø©: Ø§Ù„ØµÙÙˆÙ Ø°Ø§Øª Ø§Ù„Ù„ÙˆÙ† Ø§Ù„Ø±Ù…Ø§Ø¯ÙŠ ØªÙˆØ¶Ø­ Ø£Ù† Ø§Ù„ØµÙ†Ù Ù†Ø§ÙØ¯ (ÙƒÙ…ÙŠØªÙ‡ ØµÙØ±)</em>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;" class="printable-report-table">
        <thead>
          <tr style="background: #e2e8f0; color: #0f172a;">
            <th style="border: 1px solid #94a3b8; padding: 7px;">#</th>
            <th style="border: 1px solid #94a3b8; padding: 7px; width: 110px;">Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù</th>
            <th style="border: 1px solid #94a3b8; padding: 7px;">Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù ÙˆØ§Ù„Ù…Ø§Ø±ÙƒØ©</th>
            <th style="border: 1px solid #94a3b8; padding: 7px; width: 95px; text-align: center;">Ø§Ù„ÙƒÙ…ÙŠØ© Ø¨Ø§Ù„Ù…Ø®Ø²Ù†</th>
            <th style="border: 1px solid #94a3b8; padding: 7px; width: 110px; text-align: left;">Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ (Ø§Ù„Ù‚Ø·Ø¹Ø©)</th>
            <th style="border: 1px solid #94a3b8; padding: 7px; width: 125px; text-align: left;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 800;">
            <td colspan="3" style="border: 1px solid #94a3b8; padding: 8px; text-align: center;">Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¹Ø§Ù…</td>
            <td style="border: 1px solid #94a3b8; padding: 8px; text-align: center;">${totalUnits.toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</td>
            <td style="border: 1px solid #94a3b8; padding: 8px;">--</td>
            <td style="border: 1px solid #94a3b8; padding: 8px; text-align: left; color: #047857; font-size: 1rem;">${totalCapital.toLocaleString('en-US')} ${cur}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top: 2rem; display: flex; justify-content: space-between; font-size: 0.82rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
        <div>Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ Ø¹Ù† Ø§Ù„Ø¬Ø±Ø¯: _________________</div>
        <div>Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: _________________</div>
        <div>Ù†Ø¸Ø§Ù… Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª</div>
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
  printSinglePage('printableInventoryReportArea');
}

// ============================================================
// Ø§Ø³ØªÙ…Ø§Ø±Ø© ÙƒØ´Ù Ø§Ù„Ø¬Ø±Ø¯ Ø§Ù„ÙØ¹Ù„ÙŠ Ù„Ù„Ù…ÙˆØ¸ÙÙŠÙ† (ØªØ¹Ø¨Ø¦Ø© ÙŠØ¯ÙˆÙŠØ© - Ø®Ø§Ù„ÙŠ Ù…Ù† Ø£ÙŠ Ù…Ø¨Ø§Ù„Øº Ù…Ø§Ù„ÙŠØ©)
// ============================================================
function openStocktakeSheetModal() {
  const modal = document.getElementById('modalStocktakeSheet');
  if (!modal) return;

  // ØªØ­Ø¯ÙŠØ« Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø§Ø±ÙƒØ§Øª ÙÙŠ Ø®ÙŠØ§Ø±Ø§Øª Ø§Ù„Ù†Ø·Ø§Ù‚
  const brandsGroup = document.getElementById('stocktakeScopeBrandsOptgroup');
  if (brandsGroup) {
    const brands = [...new Set(state.products.map(p => p.brand || 'Ø£Ø®Ø±Ù‰'))].filter(Boolean).sort();
    brandsGroup.innerHTML = brands.map(b => `<option value="brand:${escapeHtml(b)}">Ù…Ø§Ø±ÙƒØ©: ${escapeHtml(b)}</option>`).join('');
  }

  // Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„Ù†Ø·Ø§Ù‚ Ù…Ø¹ Ø­Ø§Ù„Ø© Ø§Ù„Ø¨Ø­Ø« Ø£Ùˆ Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø§Ù„Ù†Ø´Ø·Ø© Ø­Ø§Ù„ÙŠØ§Ù‹ Ø¨Ø§Ù„Ø¬Ø±Ø¯
  const invSearchInput = document.getElementById('inventorySearchInput');
  const activeSearch = (state.inventorySearch || (invSearchInput ? invSearchInput.value : '')).trim();
  const searchOpt = document.getElementById('stocktakeScopeOptionSearch');
  const scopeSelect = document.getElementById('stocktakeScopeSelect');

  if (activeSearch) {
    if (searchOpt) {
      searchOpt.style.display = 'block';
      searchOpt.textContent = `ðŸ” Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ø­Ø§Ù„ÙŠ ("${activeSearch}")`;
    }
    if (scopeSelect) scopeSelect.value = 'search_results';
  } else if (state.inventoryBrand && state.inventoryBrand !== 'all') {
    if (searchOpt) searchOpt.style.display = 'none';
    if (scopeSelect) scopeSelect.value = `brand:${state.inventoryBrand}`;
  } else if (state.inventoryCategory && state.inventoryCategory !== 'all') {
    if (searchOpt) searchOpt.style.display = 'none';
    if (scopeSelect) scopeSelect.value = `cat:${state.inventoryCategory}`;
  } else {
    if (searchOpt) searchOpt.style.display = 'none';
    if (scopeSelect) scopeSelect.value = 'all';
  }

  // Ù…Ø²Ø§Ù…Ù†Ø© Ø§Ù„ØªØ±ØªÙŠØ¨ Ù…Ø¹ Ø®ÙŠØ§Ø± Ø§Ù„Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®ØªØ§Ø±
  const sortSelect = document.getElementById('stocktakeSortSelect');
  if (sortSelect && state.inventorySort) {
    sortSelect.value = state.inventorySort;
  }

  modal.classList.add('active');
  updateStocktakeSheetPreview();
}

function closeStocktakeSheetModal() {
  const modal = document.getElementById('modalStocktakeSheet');
  if (modal) modal.classList.remove('active');
}

let currentStocktakeSheetItems = [];

function updateStocktakeSheetPreview() {
  const area = document.getElementById('printableStocktakeSheetArea');
  const scopeSelect = document.getElementById('stocktakeScopeSelect');
  const sortSelect = document.getElementById('stocktakeSortSelect');
  const hideZero = document.getElementById('stocktakeHideZeroStock')?.checked;
  const includeNotes = document.getElementById('stocktakeIncludeNotesCol')?.checked ?? true;
  const summaryEl = document.getElementById('stocktakeSheetSummaryStats');

  if (!area) return;

  const scope = scopeSelect ? scopeSelect.value : 'all';
  const sortMode = sortSelect ? sortSelect.value : 'code_asc';
  const companyName = state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©';
  const now = new Date();
  const dateStr = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;

  // ØªØµÙÙŠØ© Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª
  let products = [...state.products];
  let scopeLabel = 'ÙƒØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† (Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£ØµÙ†Ø§Ù)';

  if (scope === 'search_results') {
    const q = (state.inventorySearch || (document.getElementById('inventorySearchInput')?.value || '')).trim();
    if (q) {
      const qNorm = normalizeArabic(q);
      const searchWords = qNorm.split(/\s+/).filter(w => w.length > 0);
      products = products.filter(p => {
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
      scopeLabel = `Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« ("${q}")`;
    }
  } else if (scope.startsWith('cat:')) {
    const cat = scope.slice(4);
    products = products.filter(p => (p.mainCategory || 'Ø£Ø®Ø±Ù‰') === cat);
    scopeLabel = `Ù‚Ø³Ù…: ${cat}`;
  } else if (scope.startsWith('brand:')) {
    const brand = scope.slice(6);
    products = products.filter(p => (p.brand || 'Ø£Ø®Ø±Ù‰') === brand);
    scopeLabel = `Ù…Ø§Ø±ÙƒØ©: ${brand}`;
  }

  // Ø§Ø³ØªØ«Ù†Ø§Ø¡ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ù†Ø§ÙØ¯Ø© Ø¥Ù† ØªÙ… Ø§Ø®ØªÙŠØ§Ø±Ù‡
  if (hideZero) {
    products = products.filter(p => {
      const s = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
      return s > 0;
    });
  }

  // ØªØ±ØªÙŠØ¨ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø¨Ø¯Ù‚Ø© ØªØ§Ù…Ø©
  products.sort((a, b) => {
    const stockA = state.inventoryPendingUpdates.has(a.id) ? state.inventoryPendingUpdates.get(a.id) : (a.stock || 0);
    const stockB = state.inventoryPendingUpdates.has(b.id) ? state.inventoryPendingUpdates.get(b.id) : (b.stock || 0);

    if (sortMode === 'code_asc') {
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortMode === 'code_desc') {
      return String(b.code || '').localeCompare(String(a.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortMode === 'qty_desc') {
      if (stockB !== stockA) return stockB - stockA;
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortMode === 'qty_asc') {
      if (stockA !== stockB) return stockA - stockB;
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortMode === 'name_asc') {
      return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    } else if (sortMode === 'brand_asc') {
      const bComp = String(a.brand || '').localeCompare(String(b.brand || ''));
      if (bComp !== 0) return bComp;
      return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true, sensitivity: 'base' });
    }
    return 0;
  });

  currentStocktakeSheetItems = products;

  const totalUnits = products.reduce((acc, p) => acc + (state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0)), 0);

  if (summaryEl) {
    summaryEl.innerHTML = `Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù: <strong>${products.length.toLocaleString('en-US')} ØµÙ†Ù</strong> | Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ù…Ø³Ø¬Ù„Ø©: <strong>${totalUnits.toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</strong>`;
  }

  const sortLabelMap = {
    code_asc: 'Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù (ØªØµØ§Ø¹Ø¯ÙŠØ§Ù‹ 1 - 9)',
    code_desc: 'Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù (ØªÙ†Ø§Ø²Ù„ÙŠØ§Ù‹ 9 - 1)',
    qty_desc: 'Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø£ÙƒØ«Ø± Ø£ÙˆÙ„Ø§Ù‹ (ØªÙ†Ø§Ø²Ù„ÙŠ)',
    qty_asc: 'Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø£Ù‚Ù„ Ø£ÙˆÙ„Ø§Ù‹ (ØªØµØ§Ø¹Ø¯ÙŠ)',
    name_asc: 'Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù (Ø£Ø¨Ø¬Ø¯ÙŠØ§Ù‹)',
    brand_asc: 'Ø§Ù„Ù…Ø§Ø±ÙƒØ© Ø«Ù… Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù'
  };
  const sortLabel = sortLabelMap[sortMode] || 'Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù ØªØµØ§Ø¹Ø¯ÙŠØ§Ù‹';

  const rowsHtml = products.map((p, idx) => {
    const stock = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
    const isZero = stock === 0;

    return `
      <tr style="${isZero ? 'background-color: #f8fafc;' : ''}">
        <td style="text-align: center; font-weight: 700; width: 38px; border: 1px solid #cbd5e1; padding: 6px 4px;">${idx + 1}</td>
        <td style="text-align: center; font-weight: 800; font-family: monospace, sans-serif; font-size: 0.88rem; width: 95px; border: 1px solid #cbd5e1; padding: 6px 4px;">${escapeHtml(p.code || '-')}</td>
        <td style="font-weight: 700; border: 1px solid #cbd5e1; padding: 6px 8px; line-height: 1.35;">${escapeHtml(p.name)}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 4px; width: 85px;">${escapeHtml(p.brand || '-')}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px 4px; width: 100px; font-size: 0.78rem; color: #475569;">${escapeHtml(p.mainCategory || p.category || '-')}</td>
        <td style="text-align: center; font-weight: 800; font-size: 0.95rem; width: 85px; border: 1px solid #cbd5e1; padding: 6px 4px; color: ${isZero ? '#b91c1c' : '#0f172a'};">
          ${isZero ? '<span style="color:#dc2626;">0 (Ù†Ø§ÙØ¯)</span>' : stock}
        </td>
        <td style="text-align: center; width: 105px; border: 1.5px solid #0f172a; padding: 4px; background: #ffffff;">
          <div class="stocktake-write-box" title="Ø®Ø§Ù†Ø© ÙØ§Ø±ØºØ© Ù„ÙƒØªØ§Ø¨Ø© Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© Ø¨Ø§Ù„Ù‚Ù„Ù…"></div>
        </td>
        ${includeNotes ? '<td style="border: 1px solid #cbd5e1; padding: 4px 6px; width: 130px;"><div class="stocktake-notes-line"></div></td>' : ''}
      </tr>
    `;
  }).join('');

  area.innerHTML = `
    <div style="padding: 0.5rem 0.75rem; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #0f172a;">
      <!-- ØªØ±ÙˆÙŠØ³Ø© Ø§Ù„Ø§Ø³ØªÙ…Ø§Ø±Ø© -->
      <div class="stocktake-doc-header">
        <div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #0f172a;">${escapeHtml(companyName)}</div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">Ù†Ø¸Ø§Ù… Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªÙˆØ¯Ø¹Ø§Øª ÙˆØ§Ù„Ù…Ø®Ø²ÙˆÙ†</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 1.25rem; font-weight: 900; color: #065f46; letter-spacing: -0.2px;">Ø§Ø³ØªÙ…Ø§Ø±Ø© ÙƒØ´Ù Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ (ØªØ¹Ø¨Ø¦Ø© ÙŠØ¯ÙˆÙŠØ©)</div>
          <div style="font-size: 0.78rem; color: #4b5563; margin-top: 2px;">Ù…Ø®ØµØµØ© Ù„Ø¹Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù ÙˆØªØ¯ÙˆÙŠÙ† Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© Ø¨Ø§Ù„ÙŠØ¯ - Ø®Ø§Ù„ÙŠØ© ØªÙ…Ø§Ù…Ø§Ù‹ Ù…Ù† Ø§Ù„Ø£Ø³Ø¹Ø§Ø± ÙˆØ±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„</div>
        </div>
        <div style="text-align: left; font-size: 0.82rem; color: #475569;">
          <div>ðŸ“… ØªØ§Ø±ÙŠØ® Ø§Ù„ÙƒØ´Ù: <strong>${dateStr}</strong></div>
          <div>ðŸ”¢ Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø£ØµÙ†Ø§Ù: <strong>${products.length.toLocaleString('en-US')}</strong></div>
        </div>
      </div>

      <!-- Ø´Ø±ÙŠØ· Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø¬Ø±Ø¯ -->
      <div class="stocktake-info-badges">
        <div>ðŸ“¦ Ù†Ø·Ø§Ù‚ Ø§Ù„ÙƒØ´Ù: <strong style="color: #065f46;">${escapeHtml(scopeLabel)}</strong></div>
        <div>ðŸ”„ Ø§Ù„ØªØ±ØªÙŠØ¨: <strong>${escapeHtml(sortLabel)}</strong></div>
        <div>ðŸ“Š Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…Ø³Ø¬Ù„ Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…: <strong>${totalUnits.toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</strong></div>
        <div style="margin-right: auto;">ðŸ‘¤ Ø§Ù„Ù‚Ø§Ø¦Ù… Ø¨Ø§Ù„Ø¹Ø¯: ____________________</div>
        <div>ðŸ•µï¸ Ø§Ù„Ù…Ø´Ø±Ù: ____________________</div>
      </div>

      <!-- Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø£ØµÙ†Ø§Ù -->
      <table class="stocktake-table">
        <thead>
          <tr>
            <th style="width: 38px;">#</th>
            <th style="width: 95px;">Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù</th>
            <th>Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù ÙˆØ§Ù„Ù…ÙˆØ§ØµÙØ§Øª</th>
            <th style="width: 85px;">Ø§Ù„Ù…Ø§Ø±ÙƒØ©</th>
            <th style="width: 100px;">Ø§Ù„Ù‚Ø³Ù…</th>
            <th style="width: 85px;">Ø§Ù„ÙƒÙ…ÙŠØ© Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…</th>
            <th style="width: 105px; background: #065f46 !important; color: white;">Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„ÙØ¹Ù„ÙŠØ© (Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©) âœï¸</th>
            ${includeNotes ? '<th style="width: 130px;">Ù…Ù„Ø§Ø­Ø¸Ø§Øª / ÙØ±ÙˆÙ‚Ø§Øª</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£ÙŠ Ø£ØµÙ†Ø§Ù Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ù‡Ø°Ø§ Ø§Ù„Ù†Ø·Ø§Ù‚ Ø£Ùˆ Ø§Ù„ÙÙ„ØªØ±</td></tr>'}
        </tbody>
      </table>

      <!-- ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„ØªÙˆÙ‚ÙŠØ¹Ø§Øª ÙˆØ§Ù„ØªØ¹Ù„ÙŠÙ…Ø§Øª -->
      <div class="stocktake-signatures">
        <div>ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ù…ÙˆØ¸Ù Ø§Ù„ÙØ§Ø­Øµ: ______________________</div>
        <div>ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ù…Ø´Ø±Ù / Ø§Ù„Ù…Ø¯Ù‚Ù‚: ______________________</div>
        <div>ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯: _____ / _____ / 2026 Ù…</div>
      </div>

      <div style="margin-top: 0.75rem; text-align: center; font-size: 0.75rem; color: #64748b; border-top: 1px dotted #cbd5e1; padding-top: 0.4rem;">
        ðŸ“ ØªØ¹Ù„ÙŠÙ…Ø§Øª: ÙŠÙ‚ÙˆÙ… Ø§Ù„Ù…ÙˆØ¸Ù Ø¨Ø¹Ø¯Ù‘ Ø§Ù„Ù‚Ø·Ø¹ Ø§Ù„Ù…ØªÙˆÙØ±Ø© ÙØ¹Ù„ÙŠØ§Ù‹ ÙˆØªØ¯ÙˆÙŠÙ† Ø§Ù„Ø±Ù‚Ù… ÙÙŠ Ø®Ø§Ù†Ø© "Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„ÙØ¹Ù„ÙŠØ© (Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©)" Ø¨Ø§Ù„Ù‚Ù„Ù…ØŒ ÙˆØªØ³Ù„ÙŠÙ… Ø§Ù„ÙƒØ´Ù Ù„Ù„Ø¥Ø¯Ø§Ø±Ø© Ù„Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„ÙƒÙ…ÙŠØ§Øª Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© ÙˆØªØ­Ø¯ÙŠØ« Ø£Ø±ØµØ¯Ø© Ø§Ù„Ù†Ø¸Ø§Ù… ÙŠØ¯ÙˆÙŠØ§Ù‹.
      </div>
    </div>
  `;
}

function printStocktakeSheetDoc() {
  updateStocktakeSheetPreview();
  document.body.classList.add('printing-stocktake-active');

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-stocktake-active');
    }, 600);
  }, 200);
}

function exportStocktakeToExcel() {
  const items = currentStocktakeSheetItems.length > 0 ? currentStocktakeSheetItems : state.products;
  if (!items || items.length === 0) {
    showToast('Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£ØµÙ†Ø§Ù Ù„ØªØµØ¯ÙŠØ±Ù‡Ø§', 'warning');
    return;
  }

  // Ø¨Ù†Ø§Ø¡ Ù…Ù„Ù CSV Ù…ØªÙˆØ§ÙÙ‚ Ù…Ø¹ Excel Ø¨Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø¨ØªØ±Ù…ÙŠØ² UTF-8 Ù…Ø¹ BOM
  const headers = ['#', 'Ø±Ù‚Ù… Ø§Ù„ØµÙ†Ù (Ø§Ù„ÙƒÙˆØ¯)', 'Ø§Ø³Ù… Ø§Ù„ØµÙ†Ù', 'Ø§Ù„Ù…Ø§Ø±ÙƒØ©', 'Ø§Ù„Ù‚Ø³Ù…', 'Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø­Ø§Ù„ÙŠØ© Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…', 'Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„ÙØ¹Ù„ÙŠØ© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø© (Ù„Ù„ØªØ¹Ø¨Ø¦Ø© Ø§Ù„ÙŠØ¯ÙˆÙŠØ©)', 'Ù…Ù„Ø§Ø­Ø¸Ø§Øª'];
  const rows = items.map((p, idx) => {
    const stock = state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0);
    return [
      idx + 1,
      `"${String(p.code || '').replace(/"/g, '""')}"`,
      `"${String(p.name || '').replace(/"/g, '""')}"`,
      `"${String(p.brand || '').replace(/"/g, '""')}"`,
      `"${String(p.mainCategory || p.category || '').replace(/"/g, '""')}"`,
      stock,
      '', // Ø¹Ù…ÙˆØ¯ ÙØ§Ø±Øº Ù„Ù„ÙƒÙ…ÙŠØ© Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©
      ''  // Ø¹Ù…ÙˆØ¯ ÙØ§Ø±Øº Ù„Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  a.href = url;
  a.download = `ÙƒØ´Ù_Ø¬Ø±Ø¯_Ø§Ù„Ù…Ø®Ø²ÙˆÙ†_Ø§Ù„ÙØ¹Ù„ÙŠ_${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('ØªÙ… ØªØµØ¯ÙŠØ± ÙƒØ´Ù Ø§Ù„Ø¬Ø±Ø¯ Ù„Ù„Ø¥ÙƒØ³Ù„ Ø¨Ù†Ø¬Ø§Ø­', 'success');
}

async function sendCurrentInventoryReportTelegram() {
  const items = currentInventoryReportItems.length > 0 ? currentInventoryReportItems : state.products;
  const searchQuery = (state.inventorySearch || document.getElementById('inventorySearchInput')?.value || '').trim();
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

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
    title: searchQuery ? `ØªÙ‚Ø±ÙŠØ± Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¨Ø­Ø« Ø¨Ø§Ù„Ø¬Ø±Ø¯: "${searchQuery}"` : 'ØªÙ‚Ø±ÙŠØ± Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„',
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

  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');

  try {
    const res = await fetch('/api/inventory/send-report-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ØªÙ‚Ø±ÙŠØ± Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø¬Ø±Ø¯ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­! Ø¬Ø§Ø±ÙŠ Ø¥Ø±ÙØ§Ù‚ Ù…Ù„Ù Ø§Ù„Ù€ PDF...', 'success');
      // Ø¥Ø±ÙØ§Ù‚ Ù…Ù„Ù PDF Ù„Ù„ØªÙ‚Ø±ÙŠØ± Ø£ÙŠØ¶Ø§Ù‹ Ù„Ø¶Ù…Ø§Ù† ØªØ¶Ù…ÙŠÙ† Ø§Ù„Ù…Ù„Ù ÙÙŠ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
      try {
        await generateAndSendInventoryPdfToTelegram();
      } catch (pdfErr) {
        console.warn('Auto PDF attachment for inventory report error:', pdfErr);
      }
    } else {
      showToast(data.error || 'ÙØ´Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…', 'error');
    }
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…', 'error');
  }
}

// Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù PDF Ù„Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„ÙØ¹Ù„ÙŠ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
async function generateAndSendInventoryPdfToTelegram() {
  const modal = document.getElementById('inventoryReportModal');
  const printableArea = document.getElementById('printableInventoryReportArea');
  if (!modal || !modal.classList.contains('active')) {
    openInventoryReportModal();
  }

  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ù†Ø´Ø§Ø¡ Ù…Ù„Ù PDF Ù„Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ¥Ø±Ø³Ø§Ù„Ù‡ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');

  try {
    const html = printableArea ? printableArea.innerHTML : '';
    if (!html) {
      showToast('ØªØ¹Ø°Ø± Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªÙ‚Ø±ÙŠØ±', 'error');
      return;
    }
    const fileName = `ØªÙ‚Ø±ÙŠØ±_Ø¬Ø±Ø¯_${Date.now()}.pdf`;
    const blob = await generatePdfBlobFromHtml(html, fileName);

    const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
    const items = currentInventoryReportItems.length > 0 ? currentInventoryReportItems : state.products;
    const totalUnits = items.reduce((acc, p) => acc + (state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0)), 0);
    const totalCapital = items.reduce((acc, p) => acc + (state.inventoryPendingUpdates.has(p.id) ? state.inventoryPendingUpdates.get(p.id) : (p.stock || 0)) * (parseFloat(p.costPrice) || 0), 0);

    const caption = 
`ðŸ“„ <b>ØªÙ‚Ø±ÙŠØ± Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ (Ù…Ù„Ù PDF Ù…Ø¹ØªÙ…Ø¯)</b>
ðŸ¢ <b>${state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ” <b>Ø§Ù„Ù†Ø·Ø§Ù‚:</b> ${currentInventoryReportScope || 'ÙƒØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†'}
ðŸ“¦ <b>Ø§Ù„Ø£ØµÙ†Ø§Ù Ø¨Ø§Ù„ØªÙ‚Ø±ÙŠØ±:</b> <b>${items.length} ØµÙ†Ù</b>
ðŸ”¢ <b>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù‚Ø·Ø¹:</b> <b>${totalUnits.toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</b>
ðŸ’° <b>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„:</b> <b>${totalCapital.toLocaleString('en-US')} ${cur}</b>
ðŸ• <b>Ø§Ù„ÙˆÙ‚Øª:</b> ${formatAppDateTime(new Date())}
<i>ðŸ“Ž Ù…Ø±ÙÙ‚ ÙƒØ´Ù Ø§Ù„Ø¬Ø±Ø¯ Ø§Ù„ØªÙØµÙŠÙ„ÙŠ Ø§Ù„ÙƒØ§Ù…Ù„ Ø¨ØµÙŠØºØ© PDF Ø¬Ø§Ù‡Ø² Ù„Ù„Ø·Ø¨Ø§Ø¹Ø© ÙˆØ§Ù„ØªØ¯Ù‚ÙŠÙ‚.</i>`;

    const res = await sendPdfDocumentToTelegram(blob, fileName, caption);
    if (res.success) {
      showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ù„Ø¬Ø±Ø¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø¨Ù†Ø¬Ø§Ø­ Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…!', 'success');
    } else {
      showToast(`ØªØ¹Ø°Ø± Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…: ${res.error || 'Ø®Ø·Ø£ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ'}`, 'error');
    }
  } catch (err) {
    showToast('Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ ØªØµØ¯ÙŠØ± ÙˆØ¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù€ PDF', 'error');
  }
}

// Ø¨Ù†Ø§Ø¡ ÙƒØ´Ù Ø±Ø³Ù…ÙŠ Ù„Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ ÙˆØ­Ø³Ø§Ø¨ Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ Ø¨ØµÙŠØºØ© PDF
function buildPrintableFinancialReportHtml() {
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const periodText = document.getElementById('dashCurrentPeriodBadge')?.textContent || 'ÙƒÙ„ Ø§Ù„Ø£ÙˆÙ‚Ø§Øª';
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
          <h1 style="font-size: 1.6rem; font-weight: 900; margin: 0; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h1>
          <div style="font-size: 0.9rem; color: #475569;">ØªÙ‚Ø±ÙŠØ± Ù…Ø§Ù„ÙŠ Ø±Ø³Ù…ÙŠ Ù„Ù„Ø£Ø±Ø¨Ø§Ø­ ÙˆØ§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆÙ…Ø·Ø§Ø¨Ù‚Ø© Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„</div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 1rem; font-weight: 800; color: #2563eb;">${escapeHtml(periodText)}</div>
          <div style="font-size: 0.8rem; color: #64748b;">ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¥ØµØ¯Ø§Ø±: ${nowStr}</div>
        </div>
      </div>

      <!-- Ø¨Ø·Ø§Ù‚Ø§Øª Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ù…Ø§Ù„ÙŠØ© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem;">
          <div style="font-size: 0.82rem; color: #64748b;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª (Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª)</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #0f172a; margin-top: 0.25rem;">${totalSales.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">Ø¹Ø¯Ø¯ ÙÙˆØ§ØªÙŠØ± Ø§Ù„Ø¨ÙŠØ¹: ${salesInvoices.length}</div>
        </div>

        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem;">
          <div style="font-size: 0.82rem; color: #64748b;">ØªÙƒÙ„ÙØ© Ø§Ù„Ø¨Ø¶Ø§Ø¹Ø© Ø§Ù„Ù…Ø¨Ø§Ø¹Ø© (Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„)</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #475569; margin-top: 0.25rem;">${totalCost.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">Ø§Ù„ØªÙƒÙ„ÙØ© Ø§Ù„ÙØ¹Ù„ÙŠØ© Ù„Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ù…Ø¨Ø§Ø¹Ø©</div>
        </div>

        <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 8px; padding: 1rem;">
          <div style="font-size: 0.82rem; color: #047857;">ØµØ§ÙÙŠ Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ Ø§Ù„Ù…Ø­Ù‚Ù‚Ø©</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #059669; margin-top: 0.25rem;">${totalProfit.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.75rem; color: #047857; font-weight: 700; margin-top: 0.2rem;">Ù†Ø³Ø¨Ø© Ù‡Ø§Ù…Ø´ Ø§Ù„Ø±Ø¨Ø­: ${profitMargin}%</div>
        </div>
      </div>

      <!-- ØªÙØµÙŠÙ„ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ§Ù„Ù…Ø®Ø²ÙˆÙ† -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; background: #ffffff;">
          <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0 0 0.75rem 0; color: #0f172a;">ðŸ’³ ØªÙØµÙŠÙ„ Ø·Ø±Ù‚ Ø§Ù„ØªØ­ØµÙŠÙ„:</h3>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
            <span>ðŸ’µ Ù…Ø¨ÙŠØ¹Ø§Øª Ù†Ù‚Ø¯ÙŠØ© (ÙƒØ§Ø´ Ù…Ø¨Ø§Ø´Ø±):</span>
            <strong>${cashSales.toLocaleString('en-US')} ${cur}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
            <span>â³ Ù…Ø¨ÙŠØ¹Ø§Øª Ø£Ù‚Ø³Ø§Ø· Ù…Ø¬Ø¯ÙˆÙ„Ø©:</span>
            <strong>${installmentSales.toLocaleString('en-US')} ${cur}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0;">
            <span>ðŸ“¥ ÙÙˆØ§ØªÙŠØ± ØªÙˆØ±ÙŠØ¯ ÙˆÙ…Ø´ØªØ±ÙŠØ§Øª:</span>
            <strong>${purchaseInvoices.length} ÙØ§ØªÙˆØ±Ø©</strong>
          </div>
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; background: #ffffff;">
          <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0 0 0.75rem 0; color: #0f172a;">ðŸ“¦ Ø§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ© Ù„Ù„Ù…Ø®Ø²ÙˆÙ†:</h3>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
            <span>Ø¹Ø¯Ø¯ Ø§Ù„Ø£ØµÙ†Ø§Ù Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ:</span>
            <strong>${state.products.length} ØµÙ†Ù</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9;">
            <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù‚Ø·Ø¹ Ø§Ù„Ù…ØªÙˆÙØ±Ø©:</span>
            <strong>${totalStockUnits.toLocaleString('en-US')} Ù‚Ø·Ø¹Ø©</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.4rem 0; font-weight: 800; color: #047857;">
            <span>Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„ Ø¨Ø§Ù„Ù…Ø®Ø²Ù†:</span>
            <strong>${totalStockCapital.toLocaleString('en-US')} ${cur}</strong>
          </div>
        </div>
      </div>

      <div style="margin-top: 2rem; border-top: 1.5px solid #0f172a; padding-top: 1rem; display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569;">
        <div>ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ù…Ø¯ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ: _________________</div>
        <div>Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: _________________</div>
        <div>Ù†Ø¸Ø§Ù… Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ§Ù„Ù…Ø®Ø²ÙˆÙ†</div>
      </div>
    </div>
  `;
}

// ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ PDF
async function downloadFinancialReportPdf() {
  showToast('Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ Ø¨ØµÙŠØºØ© PDF...', 'info');
  try {
    const html = buildPrintableFinancialReportHtml();
    const fileName = `Ø§Ù„ØªÙ‚Ø±ÙŠØ±_Ø§Ù„Ù…Ø§Ù„ÙŠ_${Date.now()}.pdf`;
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
    showToast('ØªÙ… ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ PDF Ø¨Ù†Ø¬Ø§Ø­', 'success');
  } catch (err) {
    showToast('ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ PDF', 'error');
  }
}

// Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
async function generateAndSendFinancialPdfToTelegram() {
  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ PDF ÙˆØ¥Ø±Ø³Ø§Ù„Ù‡ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');
  try {
    const html = buildPrintableFinancialReportHtml();
    const fileName = `Ø§Ù„ØªÙ‚Ø±ÙŠØ±_Ø§Ù„Ù…Ø§Ù„ÙŠ_${Date.now()}.pdf`;
    const blob = await generatePdfBlobFromHtml(html, fileName);

    const periodText = document.getElementById('dashCurrentPeriodBadge')?.textContent || 'ÙƒÙ„ Ø§Ù„Ø£ÙˆÙ‚Ø§Øª';

    const caption = 
`ðŸ“Š <b>Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ ÙˆØ­Ø³Ø§Ø¨ Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ (Ù…Ù„Ù PDF Ù…Ø¹ØªÙ…Ø¯)</b>
ðŸ¢ <b>${state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©'}</b>
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
â±ï¸ <b>Ø§Ù„ÙØªØ±Ø©:</b> ${escapeHtml(periodText)}
ðŸ“… <b>Ø§Ù„ØªØ§Ø±ÙŠØ®:</b> ${formatAppDateTime(new Date())}
<i>ðŸ“Ž ØªØ¬Ø¯ÙˆÙ† Ø£Ø¹Ù„Ø§Ù‡ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ø§Ù„Ø´Ø§Ù…Ù„ Ù„Ù„Ø£Ø±Ø¨Ø§Ø­ ÙˆØ§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ±Ø£Ø³ Ø§Ù„Ù…Ø§Ù„.</i>`;

    const res = await sendPdfDocumentToTelegram(blob, fileName, caption);
    if (res.success) {
      showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ PDF Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!', 'success');
    } else {
      showToast(`ØªØ¹Ø°Ø± Ø§Ù„Ø¥Ø±Ø³Ø§Ù„: ${res.error || 'Ø®Ø·Ø£ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ'}`, 'error');
    }
  } catch (err) {
    showToast('Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø§Ù„ÙŠ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…', 'error');
  }
}

// Ø¥Ø±Ø³Ø§Ù„ ØªÙ‚Ø±ÙŠØ± Ø§Ù„Ù…Ø®Ø²ÙˆÙ† Ø§Ù„Ø´Ø§Ù…Ù„ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
async function generateAndSendStockReportPdfToTelegram() {
  await generateAndSendInventoryPdfToTelegram();
}

// =============================================================
// Ø¥Ø¯Ø§Ø±Ø© Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ù…Ù„ÙØ§Øª Excel Ùˆ CSV Ù„Ù„Ø²Ø¨Ø§Ø¦Ù† Ù…Ø¹ Ø§Ù„Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„Ø°ÙƒÙŠØ©
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
  if (sizeEl) sizeEl.textContent = `(${(file.size / 1024).toFixed(1)} ÙƒÙŠÙ„ÙˆØ¨Ø§ÙŠØª)`;
  if (banner) banner.style.display = 'flex';

  showToast(`Ø¬Ø§Ø±ÙŠ Ù‚Ø±Ø§Ø¡Ø© ÙˆØªØ­Ù„ÙŠÙ„ Ù…Ù„Ù Ø§Ù„Ø¥ÙƒØ³Ù„ "${file.name}"...`, 'info');

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/customers/upload-excel?preview=true', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success && data.summary) {
      showToast(`ðŸŽ‰ ØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ ${data.parsedCount} Ø²Ø¨ÙˆÙ† Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ù„Ù!`, 'success');
      renderExcelPreview(data);
    } else {
      showToast(data.error || 'ÙØ´Ù„ ØªØ­Ù„ÙŠÙ„ Ù…Ù„Ù Ø§Ù„Ø¥ÙƒØ³Ù„', 'error');
    }
  } catch (err) {
    showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ù‚Ø±Ø§Ø¡Ø© Ù…Ù„Ù Ø§Ù„Ø¥ÙƒØ³Ù„: ' + err.message, 'error');
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
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  if (countBadge) countBadge.textContent = `${data.parsedCount} Ø²Ø¨ÙˆÙ† Ø¬Ø§Ù‡Ø² Ù„Ù„Ø§Ø³ØªÙŠØ±Ø§Ø¯`;
  if (debitTotal) debitTotal.textContent = `${(data.summary.totalDebit || 0).toLocaleString('en-US')} ${cur}`;
  if (debtorsCount) debtorsCount.textContent = `${data.summary.countDebtors || 0} Ø²Ø¨ÙˆÙ† Ù…Ø¯ÙŠÙ† (Ø¹Ù„ÙŠÙ‡Ù…)`;
  if (creditTotal) creditTotal.textContent = `${(data.summary.totalCredit || 0).toLocaleString('en-US')} ${cur}`;
  if (creditorsCount) creditorsCount.textContent = `${data.summary.countCreditors || 0} Ø²Ø¨ÙˆÙ† Ø¯Ø§Ø¦Ù† (Ù„Ù‡Ù…)`;
  if (netBalance) {
    const net = data.summary.netBalance || 0;
    netBalance.textContent = `${Math.abs(net).toLocaleString('en-US')} ${cur}`;
    netBalance.style.color = net >= 0 ? '#15803d' : '#2563eb';
  }
  if (settledCount) settledCount.textContent = `${data.summary.countSettled || 0} Ø²Ø¨ÙˆÙ† Ø±ØµÙŠØ¯ ØµÙØ±`;

  if (tbody && data.sample) {
    tbody.innerHTML = data.sample.map((c, i) => {
      const b = parseFloat(c.balance) || 0;
      const bText = b > 0 ? `<span style="color:#dc2626; font-weight:700;">ðŸ”´ Ø¹Ù„ÙŠÙ‡: ${b.toLocaleString('en-US')} ${cur}</span>` :
                    (b < 0 ? `<span style="color:#2563eb; font-weight:700;">ðŸ”µ Ù„Ù‡: ${Math.abs(b).toLocaleString('en-US')} ${cur}</span>` :
                    `<span style="color:#16a34a; font-weight:700;">ðŸŸ¢ Ø®Ø§Ù„Øµ</span>`);
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
    showToast('ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ù…Ù„Ù Ø§Ù„Ø¥ÙƒØ³Ù„ Ø£ÙˆÙ„Ø§Ù‹', 'warning');
    return;
  }

  const confirmBtn = document.getElementById('btnConfirmExcelImport');
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ Ø§Ø³ØªÙŠØ±Ø§Ø¯ ÙˆØ­ÙØ¸ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…...</span>';
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
      showToast(`ðŸŽ‰ ${data.message || 'ØªÙ… Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ø¨Ù†Ø¬Ø§Ø­!'}`, 'success');
      closeCustomerExcelImportModal();
      await loadCustomers();
    } else {
      showToast(data.error || 'ÙØ´Ù„ Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†', 'error');
    }
  } catch (err) {
    showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø±ÙØ¹ ÙˆØ§Ø³ØªÙŠØ±Ø§Ø¯ Ø§Ù„Ù…Ù„Ù: ' + err.message, 'error');
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>âœ…</span><span>ØªØ£ÙƒÙŠØ¯ ÙˆØ§Ø³ØªÙŠØ±Ø§Ø¯ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ø¥Ù„Ù‰ Ø§Ù„Ù†Ø¸Ø§Ù…</span>';
    }
  }
}

// =============================================================
// ÙƒØ´Ù Ø­Ø³Ø§Ø¨ ØªÙØµÙŠÙ„ÙŠ Ù„Ù„Ø²Ø¨ÙˆÙ† (Customer Statement) Ù…Ø¹ ØªØµØ¯ÙŠØ± PDF ÙˆØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
// =============================================================
let currentStatementData = null;

async function openCustomerStatementModal(customerId) {
  showToast('Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ø§Ù„ØªÙØµÙŠÙ„ÙŠ...', 'info');
  try {
    const res = await fetch(`/api/customers/${customerId}/statement`);
    const data = await res.json();
    if (!data.success || !data.statement) {
      showToast(data.error || 'ØªØ¹Ø°Ø± Ø¬Ù„Ø¨ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ù„Ù„Ø²Ø¨ÙˆÙ†', 'error');
      return;
    }

    currentStatementData = data.statement;
    renderCustomerStatementHtml(data.statement);

    const modal = document.getElementById('customerStatementModal');
    if (modal) modal.classList.add('active');
  } catch (err) {
    showToast('ÙØ´Ù„ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø¬Ù„Ø¨ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨', 'error');
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

  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
  const c = st.customer;
  const s = st.summary;
  const bal = parseFloat(c.balance) || 0;
  const hasDebt = bal > 0;
  const isCredit = bal < 0;

  const balText = hasDebt ? `Ø¯ÙŠÙ† Ø¹Ù„ÙŠÙ‡: ${bal.toLocaleString('en-US')} ${cur}` :
                  (isCredit ? `Ø±ØµÙŠØ¯ Ù„ØµØ§Ù„Ø­Ù‡: ${Math.abs(bal).toLocaleString('en-US')} ${cur}` : `Ø±ØµÙŠØ¯ Ù…Ø³Ø¯Ø¯ (Ø®Ø§Ù„Øµ)`);

  let movementsHtml = '';
  if (st.movements && st.movements.length > 0) {
    movementsHtml = st.movements.map((m, idx) => {
      const isInvoice = m.type === 'invoice';
      const typeBadge = isInvoice ? `<span style="background:#eff6ff; color:#1d4ed8; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.78rem;">ðŸ§¾ ÙØ§ØªÙˆØ±Ø© Ù…Ø¨ÙŠØ¹Ø§Øª</span>` :
                        `<span style="background:#f0fdf4; color:#15803d; padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.78rem;">ðŸ’° Ø³Ù†Ø¯ Ù‚Ø¨Ø¶</span>`;
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
          Ù„Ø§ ØªÙˆØ¬Ø¯ ÙÙˆØ§ØªÙŠØ± Ø£Ùˆ Ø³Ù†Ø¯Ø§Øª Ù…Ø³Ø¬Ù„Ø© Ø¨Ø¹Ø¯ Ù„Ù‡Ø°Ø§ Ø§Ù„Ø²Ø¨ÙˆÙ† ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…. Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø­Ø§Ù„ÙŠ: ${bal.toLocaleString('en-US')} ${cur}
        </td>
      </tr>
    `;
  }

  container.innerHTML = `
    <div style="padding: 1.5rem; font-family: 'Cairo', sans-serif; direction: rtl; color: #0f172a; line-height: 1.5;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0f172a; padding-bottom: 1rem; margin-bottom: 1.25rem;">
        <div>
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 900; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h2>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">
            ${escapeHtml(state.settings.companyAddress || 'Ø§Ù„Ù…Ø±ÙƒØ² Ø§Ù„ØªØ¬Ø§Ø±ÙŠ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ')} | Ù‡Ø§ØªÙ: ${escapeHtml(state.settings.companyPhone || '')}
          </div>
        </div>
        <div style="text-align: left;">
          <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.4rem 0.85rem; font-weight: 800; font-size: 1.05rem; color: #0f172a;">
            ÙƒØ´Ù Ø­Ø³Ø§Ø¨ Ø²Ø¨ÙˆÙ† ØªÙØµÙŠÙ„ÙŠ
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem;">ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¥ØµØ¯Ø§Ø±: ${formatAppDateTime(new Date())}</div>
        </div>
      </div>

      <!-- Customer Info Card -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div>
          <div style="font-size: 0.85rem; color: #64748b;">Ø§Ù„Ø³ÙŠØ¯ / Ø§Ù„Ø²Ø¨ÙˆÙ†:</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #0f172a;">${escapeHtml(c.name)}</div>
          ${c.phone ? `<div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ: <span style="direction: ltr; font-weight: 700;">${escapeHtml(c.phone)}</span></div>` : ''}
          ${c.notes ? `<div style="font-size: 0.82rem; color: #64748b; margin-top: 0.2rem;">Ù…Ù„Ø§Ø­Ø¸Ø§Øª: ${escapeHtml(c.notes)}</div>` : ''}
        </div>
        <div style="text-align: left;">
          <div style="font-size: 0.85rem; color: #64748b;">Ø±Ù‚Ù… Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…: <strong style="font-family: monospace; font-size: 1rem;">#${escapeHtml(c.systemNumber || '--')}</strong></div>
          <div style="margin-top: 0.4rem;">
            <span style="font-size: 0.85rem; color: #64748b;">Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…Ø§Ù„ÙŠ Ø§Ù„Ø­Ø§Ù„ÙŠ:</span>
            <div style="font-size: 1.35rem; font-weight: 900; color: ${hasDebt ? '#dc2626' : (isCredit ? '#2563eb' : '#16a34a')};">
              ${balText}
            </div>
          </div>
        </div>
      </div>

      <!-- Summary KPI Strip -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-size: 0.75rem; color: #64748b;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø´ØªØ±ÙŠØ§Øª (Ø§Ù„ÙÙˆØ§ØªÙŠØ±):</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-top: 0.2rem;">${(s.totalInvoiced || 0).toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #64748b;">${s.invoicesCount || 0} ÙØ§ØªÙˆØ±Ø©</div>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-size: 0.75rem; color: #166534;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø³Ø¯Ø¯ (Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶):</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #15803d; margin-top: 0.2rem;">${(s.totalPaid || 0).toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #166534;">${s.receiptsCount || 0} Ø³Ù†Ø¯ Ù‚Ø¨Ø¶</div>
        </div>
        <div style="background: ${hasDebt ? '#fef2f2' : '#f8fafc'}; border: 1px solid ${hasDebt ? '#fecaca' : '#cbd5e1'}; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-size: 0.75rem; color: ${hasDebt ? '#991b1b' : '#64748b'};">Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù…Ø³ØªØ­Ù‚ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ:</div>
          <div style="font-size: 1.1rem; font-weight: 900; color: ${hasDebt ? '#dc2626' : (isCredit ? '#2563eb' : '#16a34a')}; margin-top: 0.2rem;">
            ${(c.balance || 0).toLocaleString('en-US')} ${cur}
          </div>
          <div style="font-size: 0.7rem; color: #64748b;">${hasDebt ? 'Ù…Ø·Ù„ÙˆØ¨ Ø³Ø¯Ø§Ø¯Ù‡' : (isCredit ? 'Ø±ØµÙŠØ¯ Ù„ØµØ§Ù„Ø­Ù‡' : 'Ø±ØµÙŠØ¯ Ø®Ø§Ù„Øµ')}</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 0.65rem 0.85rem;">
          <div style="font-size: 0.75rem; color: #1e40af;">Ø¢Ø®Ø± Ø¯ÙØ¹Ø© Ù…Ø³Ø¯Ø¯Ø©:</div>
          <div style="font-size: 0.95rem; font-weight: 800; color: #1d4ed8; margin-top: 0.2rem;">
            ${s.lastReceiptDate ? formatAppDateTime(s.lastReceiptDate).split(' ')[0] : 'Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø³Ø¯Ø§Ø¯'}
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
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 130px;">Ø§Ù„ØªØ§Ø±ÙŠØ® ÙˆØ§Ù„ÙˆÙ‚Øª</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 140px;">Ù†ÙˆØ¹ Ø§Ù„Ø­Ø±ÙƒØ© ÙˆØ±Ù‚Ù…Ù‡Ø§</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px;">Ø§Ù„Ø¨ÙŠØ§Ù† / Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 110px; text-align: left;">Ù…Ø¯ÙŠÙ† (+)</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 110px; text-align: left;">Ø¯Ø§Ø¦Ù† (-)</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; width: 120px; text-align: left;">Ø§Ù„Ø±ØµÙŠØ¯ Ø¨Ø¹Ø¯ Ø§Ù„Ø­Ø±ÙƒØ©</th>
          </tr>
        </thead>
        <tbody>
          ${movementsHtml}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; border-top: 1.5px solid #0f172a; padding-top: 1rem; font-size: 0.85rem; color: #475569;">
        <div>ØªÙˆÙ‚ÙŠØ¹ ÙˆØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø²Ø¨ÙˆÙ†: _________________</div>
        <div>Ø§Ù„Ù…Ø­Ø§Ø³Ø¨ / Ø§Ù„Ù…Ø§Ù„ÙŠ: _________________</div>
        <div>Ø®ØªÙ… Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯: _________________</div>
      </div>
    </div>
  `;
}

function printCustomerStatement() {
  printSinglePage('printableCustomerStatementArea');
}

async function downloadCustomerStatementPdf() {
  if (!currentStatementData) return;
  const c = currentStatementData.customer;
  const fileName = `ÙƒØ´Ù_Ø­Ø³Ø§Ø¨_${c.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  showToast('Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² ÙˆØªØ­Ù…ÙŠÙ„ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¨ØµÙŠØºØ© PDF...', 'info');
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
    showToast('ØªÙ… ØªØ­Ù…ÙŠÙ„ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ PDF Ø¨Ù†Ø¬Ø§Ø­!', 'success');
  } catch (err) {
    showToast('Ø®Ø·Ø£ ÙÙŠ ØªØµØ¯ÙŠØ± ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ PDF: ' + err.message, 'error');
  }
}

async function sendCustomerStatementPdfToTelegram() {
  if (!currentStatementData) return;
  const c = currentStatementData.customer;
  const fileName = `ÙƒØ´Ù_Ø­Ø³Ø§Ø¨_${c.name.replace(/\s+/g, '_')}.pdf`;

  showToast(`Ø¬Ø§Ø±ÙŠ Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ "${c.name}" Ù…Ø¹ Ù…Ù„Ù Ø§Ù„Ù€ PDF Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...`, 'info');

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
      showToast(`âœˆï¸ ${data.message || 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ ÙˆÙ…Ù„Ù Ø§Ù„Ù€ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!'}`, 'success');
    } else {
      showToast(data.error || 'ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…', 'error');
    }
  } catch (err) {
    showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…: ' + err.message, 'error');
  }
}

// =============================================================
// Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø¯ÙŠÙˆÙ† Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ø§Ù„ÙƒØ§Ù…Ù„ ÙˆØ§Ù„Ø´Ø§Ù…Ù„ PDF Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…
// =============================================================
function buildPrintableCustomerDebtsHtml() {
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';
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
    const bText = b > 0 ? `<strong style="color: #dc2626;">ðŸ”´ Ø¹Ù„ÙŠÙ‡: ${b.toLocaleString('en-US')} ${cur}</strong>` :
                  (b < 0 ? `<strong style="color: #2563eb;">ðŸ”µ Ù„Ù‡: ${Math.abs(b).toLocaleString('en-US')} ${cur}</strong>` :
                  `<span style="color: #16a34a; font-weight: 700;">ðŸŸ¢ Ø®Ø§Ù„Øµ</span>`);

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
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 900; color: #0f172a;">${escapeHtml(state.settings.companyName || 'Ø±Ø§Ù…Ø² Ø¹Ø·Ø§Ø·Ø±Ø©')}</h2>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">ØªÙ‚Ø±ÙŠØ± Ø£Ø±ØµØ¯Ø© ÙˆØ°Ù…Ù… Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ø§Ù„Ø´Ø§Ù…Ù„ (Ø§Ù„Ø¯ÙŠÙˆÙ† Ø§Ù„ØªÙŠ Ù„Ù‡Ù… ÙˆØ§Ù„ØªÙŠ Ø¹Ù„ÙŠÙ‡Ù…)</div>
        </div>
        <div style="text-align: left;">
          <div style="font-size: 0.8rem; color: #64748b;">ØªØ§Ø±ÙŠØ® Ø§Ù„ØªÙ‚Ø±ÙŠØ±: ${formatAppDateTime(new Date())}</div>
          <div style="font-size: 0.95rem; font-weight: 800; color: #2563eb;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†: ${state.customers.length} Ø²Ø¨ÙˆÙ†</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
        <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 6px; padding: 0.75rem;">
          <div style="font-size: 0.75rem; color: #991b1b; font-weight: 700;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø¯ÙŠÙˆÙ† Ø¹Ù„ÙŠÙ‡Ù… (Ù„Ù†Ø§):</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #dc2626; margin-top: 0.2rem;">${totalDebit.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #b91c1c;">${countDebtors} Ø²Ø¨ÙˆÙ† Ù…Ø¯ÙŠÙ†</div>
        </div>
        <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 6px; padding: 0.75rem;">
          <div style="font-size: 0.75rem; color: #1e40af; font-weight: 700;">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø¯ÙŠÙˆÙ† Ù„Ù‡Ù… (Ø£Ø±ØµØ¯Ø© Ù„Ù‡Ù…):</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #2563eb; margin-top: 0.2rem;">${totalCredit.toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #1d4ed8;">${countCreditors} Ø²Ø¨ÙˆÙ† Ø¯Ø§Ø¦Ù†</div>
        </div>
        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 6px; padding: 0.75rem;">
          <div style="font-size: 0.75rem; color: #166534; font-weight: 700;">Ø§Ù„ØµØ§ÙÙŠ Ø§Ù„Ø¹Ø§Ù… Ù„Ù„Ø°Ù…Ù…:</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #15803d; margin-top: 0.2rem;">${Math.abs(netBalance).toLocaleString('en-US')} ${cur}</div>
          <div style="font-size: 0.7rem; color: #166534;">${netBalance >= 0 ? 'ÙØ§Ø¦Ø¶ Ù„ØµØ§Ù„Ø­ Ø§Ù„Ù…Ø¹Ø±Ø¶' : 'Ù…Ø³ØªØ­Ù‚Ø§Øª Ù„Ù„Ø²Ø¨Ø§Ø¦Ù†'}</div>
        </div>
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 0.75rem;">
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">Ø­Ø³Ø§Ø¨Ø§Øª Ù…Ø³Ø¯Ø¯Ø© Ø¨Ø§Ù„ÙƒØ§Ù…Ù„:</div>
          <div style="font-size: 1.2rem; font-weight: 900; color: #0f172a; margin-top: 0.2rem;">${countSettled} Ø²Ø¨ÙˆÙ†</div>
          <div style="font-size: 0.7rem; color: #64748b;">Ø±ØµÙŠØ¯ ØµÙØ± Ø®Ø§Ù„Øµ</div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
        <thead>
          <tr style="background: #f1f5f9; color: #0f172a;">
            <th style="border: 1px solid #cbd5e1; padding: 7px; width: 40px; text-align: center;">#</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px; width: 90px; text-align: center;">Ø±Ù‚Ù… Ø§Ù„Ù†Ø¸Ø§Ù…</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px;">Ø§Ø³Ù… Ø§Ù„Ø²Ø¨ÙˆÙ†</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px; width: 120px;">Ø§Ù„Ù‡Ø§ØªÙ</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px; width: 170px; text-align: center;">Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ (Ø´Ø§Ù…Ù„)</th>
            <th style="border: 1px solid #cbd5e1; padding: 7px;">Ù…Ù„Ø§Ø­Ø¸Ø§Øª</th>
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
    showToast('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø²Ø¨Ø§Ø¦Ù† Ù…Ø³Ø¬Ù„ÙŠÙ† Ø¨Ø§Ù„Ù†Ø¸Ø§Ù… Ù„Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ÙƒØ´Ù', 'warning');
    return;
  }

  showToast('Ø¬Ø§Ø±ÙŠ Ø¥Ù†Ø´Ø§Ø¡ ÙƒØ´Ù Ø¯ÙŠÙˆÙ† Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ø¨ØµÙŠØºØ© PDF ÙˆØ¥Ø±Ø³Ø§Ù„Ù‡ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…...', 'info');

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
    const fileName = `ÙƒØ´Ù_Ø¯ÙŠÙˆÙ†_Ø§Ù„Ø²Ø¨Ø§Ø¦Ù†_${Date.now()}.pdf`;
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
      showToast('âœˆï¸ ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø¯ÙŠÙˆÙ† Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† ÙˆÙ…Ù„Ù Ø§Ù„Ù€ PDF Ø¥Ù„Ù‰ ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!', 'success');
    } else {
      showToast(data.error || 'ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø§Ù„Ø¯ÙŠÙˆÙ† Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…', 'error');
    }
  } catch (err) {
    showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø¥Ø±Ø³Ø§Ù„ ÙƒØ´Ù Ø¯ÙŠÙˆÙ† Ø§Ù„Ø²Ø¨Ø§Ø¦Ù† Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…: ' + err.message, 'error');
  }
}

// =============================================================
// ØªØ°ÙƒÙŠØ± Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ø§Ù„Ø¯ÙØ¹Ø© Ù„Ù„Ø²Ø¨ÙˆÙ† Ù…Ø¹ Ø¥Ø±ÙØ§Ù‚ Ù…Ù„Ù PDF
// =============================================================
let currentReminderCustomerId = null;

function openCustomerReminderModal(customerId) {
  const c = state.customers.find(cust => cust.id === customerId);
  if (!c) return;

  const debt = parseFloat(c.balance) || 0;
  if (debt <= 0) {
    showToast('Ø§Ù„Ø²Ø¨ÙˆÙ† Ù„ÙŠØ³ Ø¹Ù„ÙŠÙ‡ Ø£ÙŠ Ø¯ÙŠÙˆÙ† Ù…Ø³ØªØ­Ù‚Ø© (Ø±ØµÙŠØ¯Ù‡ Ù…Ø³Ø¯Ø¯ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„)', 'info');
    return;
  }

  currentReminderCustomerId = customerId;
  const body = document.getElementById('customerReminderModalBody');
  const cur = state.settings.currency || 'Ø´ÙŠÙƒÙ„';

  if (body) {
    body.innerHTML = `
      <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <div style="font-weight: 800; font-size: 1.1rem; color: #991b1b; margin-bottom: 0.35rem;">ðŸ‘¤ Ø§Ù„Ø²Ø¨ÙˆÙ†: ${escapeHtml(c.name)}</div>
        <div style="font-size: 0.88rem; color: #7f1d1d;">Ø±Ù‚Ù… Ø§Ù„Ø­Ø³Ø§Ø¨ Ø¨Ø§Ù„Ù†Ø¸Ø§Ù…: #${escapeHtml(c.systemNumber || '--')} | Ù‡Ø§ØªÙ: ${escapeHtml(c.phone || 'ØºÙŠØ± Ù…Ø³Ø¬Ù„')}</div>
        <div style="margin-top: 0.5rem; font-size: 1rem; color: #991b1b;">
          Ø§Ù„Ø¯ÙŠÙ† Ø§Ù„Ù…Ø³ØªØ­Ù‚ Ø¨Ø°Ù…ØªÙ‡: <strong style="font-size: 1.25rem; color: #dc2626;">${debt.toLocaleString('en-US')} ${cur}</strong>
        </div>
      </div>
      <p style="font-size: 0.88rem; color: #475569; line-height: 1.6; margin: 0;">
        Ø³ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø¥Ø´Ø¹Ø§Ø± ØªØ°ÙƒÙŠØ± Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ø§Ù„Ø¯ÙØ¹Ø© Ù„Ù„Ø²Ø¨ÙˆÙ† Ù…Ø¨Ø§Ø´Ø±Ø© Ø¹Ø¨Ø± ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…ØŒ Ù…Ø±ÙÙ‚Ø§Ù‹ Ø¨Ù‡ ÙƒØ´Ù Ø­Ø³Ø§Ø¨ Ø±Ø³Ù…ÙŠ Ù…Ø¹ØªÙ…Ø¯ Ø¨ØµÙŠØºØ© PDF ÙŠÙˆØ¶Ø­ Ø§Ù„ÙÙˆØ§ØªÙŠØ± ÙˆØ³Ù†Ø¯Ø§Øª Ø§Ù„Ù‚Ø¨Ø¶ Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©.
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
    btn.innerHTML = '<span>â³</span><span>Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ ÙˆØ¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªØ°ÙƒÙŠØ±...</span>';
  }

  try {
    // Ø¬Ù„Ø¨ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ ÙˆØªÙˆÙ„ÙŠØ¯ Ø§Ù„Ù€ PDF
    const stRes = await fetch(`/api/customers/${customerId}/statement`);
    const stData = await stRes.json();

    let pdfBlob = null;
    const fileName = `ÙƒØ´Ù_Ø­Ø³Ø§Ø¨_${c.name.replace(/\s+/g, '_')}.pdf`;

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
      showToast(`âœˆï¸ ${data.message || 'ØªÙ… Ø¥Ø±Ø³Ø§Ù„ ØªØ°ÙƒÙŠØ± Ø§Ù„Ø¯ÙØ¹Ø© ÙˆÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù… Ø¨Ù†Ø¬Ø§Ø­!'}`, 'success');
      closeCustomerReminderModal();
    } else {
      showToast(data.error || 'ØªØ¹Ø°Ø± Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªØ°ÙƒÙŠØ± Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…', 'error');
    }
  } catch (err) {
    showToast('Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªØ°ÙƒÙŠØ±: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>âœˆï¸</span><span>Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªØ°ÙƒÙŠØ± Ù…Ø¹ ÙƒØ´Ù Ø§Ù„Ø­Ø³Ø§Ø¨ Ù„ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…</span>';
    }
  }
}

// ØªÙØ¹ÙŠÙ„ Ù…ÙŠØ²Ø© Ø§Ù„Ø³Ø­Ø¨ ÙˆØ§Ù„Ø¥ÙÙ„Ø§Øª Ù„Ù…Ù„Ù Ø§Ù„Ø¥ÙƒØ³Ù„ Ø¹Ù†Ø¯ ØªØ­Ù…ÙŠÙ„ Ø§Ù„ØµÙØ­Ø©
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



// =============================================================
// نافذة تفاصيل الصنف السريعة (Product Detail Sheet)
// =============================================================

let _pdsCurrentProductId = null;

/**
 * فتح نافذة تفاصيل الصنف السريعة عند الضغط على كرت الصنف في الكتالوج
 */
function openProductDetailSheet(productId) {
  const prod = state.products.find(p => String(p.id) === String(productId));
  if (!prod) {
    showToast('الصنف غير موجود', 'warning');
    return;
  }

  _pdsCurrentProductId = String(productId);

  const currency = state.settings?.currency || 'ل.س';
  const cost = parseFloat(prod.costPrice) || 0;
  const sell = parseFloat(prod.sellPrice) || 0;
  const profit = sell - cost;
  const profitPct = sell > 0 ? Math.round((profit / sell) * 100) : 0;

  // الصورة
  let imgSrc = 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80';
  if (Array.isArray(prod.images) && prod.images.length > 0) {
    imgSrc = prod.images[0];
  } else if (prod.image && prod.image.trim()) {
    imgSrc = prod.image.trim();
  }
  const hasMultiImg = (Array.isArray(prod.images) && prod.images.length > 1);

  // ملء البيانات
  document.getElementById('pdsProductName').textContent = prod.name || 'بدون اسم';
  document.getElementById('pdsProductCode').textContent = prod.code ? `الكود: ${prod.code}` : '';
  document.getElementById('pdsProductImg').src = imgSrc;
  document.getElementById('pdsProductImg').alt = prod.name || '';

  const imgHint = document.getElementById('pdsImgHint');
  imgHint.style.display = hasMultiImg ? 'block' : 'none';

  const catBadge = document.getElementById('pdsCategoryBadge');
  catBadge.textContent = prod.category || 'عام';
  catBadge.style.display = prod.category ? 'inline' : 'none';

  const brandBadge = document.getElementById('pdsBrandBadge');
  if (prod.brand && prod.brand !== 'أخرى') {
    brandBadge.textContent = `🏷️ ${prod.brand}`;
    brandBadge.style.display = 'inline';
  } else {
    brandBadge.style.display = 'none';
  }

  document.getElementById('pdsDescription').value = prod.description || '';
  document.getElementById('pdsCostPrice').value = cost || '';
  document.getElementById('pdsSellPrice').value = sell || '';
  pdsCalcProfit();

  // إخفاء رسالة الحفظ
  const msgEl = document.getElementById('pdsSaveMsg');
  msgEl.style.display = 'none';

  // إظهار النافذة
  const sheet = document.getElementById('productDetailSheet');
  sheet.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

/**
 * حساب الربح تلقائياً عند تغيير الأسعار
 */
function pdsCalcProfit() {
  const cost = parseFloat(document.getElementById('pdsCostPrice').value) || 0;
  const sell = parseFloat(document.getElementById('pdsSellPrice').value) || 0;
  const profit = sell - cost;
  const profitPct = sell > 0 ? Math.round((profit / sell) * 100) : 0;
  const currency = state.settings?.currency || 'ل.س';

  const display = document.getElementById('pdsProfitDisplay');
  if (display) {
    if (sell === 0 && cost === 0) {
      display.textContent = '—';
    } else {
      const sign = profit >= 0 ? '+' : '';
      display.textContent = `${sign}${profit.toLocaleString('en-US')} ${currency} (${profitPct}%)`;
      display.style.color = profit >= 0 ? '#4338ca' : '#dc2626';
    }
  }

  const box = document.getElementById('pdsProfitBox');
  if (box) {
    box.style.background = profit < 0 ? '#fff1f2' : '#eef2ff';
    box.style.borderColor = profit < 0 ? '#fca5a5' : '#a5b4fc';
  }
}

/**
 * حفظ التعديلات من نافذة التفاصيل السريعة
 */
async function pdsSave() {
  if (!_pdsCurrentProductId) return;

  const prod = state.products.find(p => String(p.id) === _pdsCurrentProductId);
  if (!prod) return;

  const description = document.getElementById('pdsDescription').value.trim();
  const costPrice = parseFloat(document.getElementById('pdsCostPrice').value) || 0;
  const sellPrice = parseFloat(document.getElementById('pdsSellPrice').value) || 0;

  const msgEl = document.getElementById('pdsSaveMsg');
  msgEl.style.display = 'none';

  try {
    const res = await fetch(`/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: prod.id,
        code: prod.code,
        name: prod.name,
        brand: prod.brand,
        brandAr: prod.brandAr,
        mainCategory: prod.mainCategory,
        category: prod.category,
        stock: prod.stock,
        image: prod.image,
        images: prod.images,
        barcode: prod.barcode,
        barcodes: prod.barcodes,
        description,
        costPrice,
        sellPrice
      })
    });

    const data = await res.json();

    if (data.success || data.id || res.ok) {
      // تحديث الحالة المحلية
      const idx = state.products.findIndex(p => String(p.id) === _pdsCurrentProductId);
      if (idx !== -1) {
        state.products[idx] = { ...state.products[idx], description, costPrice, sellPrice };
      }
      msgEl.style.cssText = 'display:block;background:#f0fdf4;color:#166534;border:1px solid #86efac;border-radius:8px;padding:0.5rem;';
      msgEl.textContent = '✅ تم حفظ التعديلات بنجاح';
      showToast('✅ تم حفظ تفاصيل الصنف', 'success');
      // تحديث عرض الكتالوج في الخلفية
      setTimeout(() => { if (typeof renderCatalog === 'function') renderCatalog(); }, 500);
    } else {
      throw new Error(data.error || 'فشل الحفظ');
    }
  } catch (err) {
    msgEl.style.cssText = 'display:block;background:#fff1f2;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;padding:0.5rem;';
    msgEl.textContent = `❌ ${err.message}`;
    showToast(`خطأ في الحفظ: ${err.message}`, 'error');
  }
}

/**
 * فتح نافذة التعديل الكاملة من داخل النافذة السريعة
 */
function pdsOpenFullEdit() {
  if (!_pdsCurrentProductId) return;
  closeProductDetailSheet();
  openEditProductModal(_pdsCurrentProductId);
}

/**
 * فتح معرض الصور من نافذة التفاصيل
 */
function pdsOpenImageGallery() {
  if (!_pdsCurrentProductId) return;
  openProductCustomerPreview(_pdsCurrentProductId, 0);
}

/**
 * إغلاق نافذة تفاصيل الصنف
 */
function closeProductDetailSheet() {
  const sheet = document.getElementById('productDetailSheet');
  if (sheet) sheet.style.display = 'none';
  document.body.style.overflow = '';
  _pdsCurrentProductId = null;
}
