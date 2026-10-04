/**
 * warranties.js - نظام الكفالات والضمان وإدارة عروض الأسعار
 * شركة أبو رامز للأجهزة الكهربائية
 */

var _warrantiesAll = [];
var _currentWarranty = null;

// ================================================
// تحميل الكفالات
// ================================================
async function loadWarranties() {
  try {
    var res = await fetch('/api/warranties');
    var data = await res.json();
    if (!data.success) throw new Error(data.error || 'فشل التحميل');
    _warrantiesAll = data.warranties || [];
    renderWarrantiesTable(_warrantiesAll);
    updateWarrantyStats(_warrantiesAll);
  } catch (e) {
    console.error('loadWarranties:', e);
    if (typeof showToast === 'function') showToast('خطأ في تحميل الكفالات: ' + e.message, 'error');
  }
}

// ================================================
// عرض جدول الكفالات
// ================================================
function renderWarrantiesTable(warranties) {
  var tbody = document.getElementById('warrantiesTableBody');
  var emptyMsg = document.getElementById('emptyWarrantiesMessage');
  var badge = document.getElementById('warrantiesCountBadge');
  if (!tbody) return;

  if (badge) badge.textContent = (warranties ? warranties.length : 0) + ' كفالة';

  if (!warranties || warranties.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2.5rem;color:#94a3b8;font-size:0.95rem;">لا توجد كفالات مطابقة للبحث</td></tr>';
    if (emptyMsg) emptyMsg.style.display = '';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';

  var now = new Date();
  var thirtyDays = 30 * 24 * 60 * 60 * 1000;

  var rows = '';
  for (var i = 0; i < warranties.length; i++) {
    var w = warranties[i];
    var expiry = new Date(w.expiryDate);
    var diff = expiry - now;
    var expiringSoon = w.status === 'active' && diff < thirtyDays && diff > 0;

    var badge2 = '';
    if (w.status === 'active') {
      badge2 = expiringSoon
        ? '<span style="background:#f59e0b;color:#fff;padding:3px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">⚠️ تنتهي قريباً</span>'
        : '<span style="background:#16a34a;color:#fff;padding:3px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">✅ نشطة</span>';
    } else if (w.status === 'expired') {
      badge2 = '<span style="background:#dc2626;color:#fff;padding:3px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">❌ منتهية</span>';
    } else {
      badge2 = '<span style="background:#94a3b8;color:#fff;padding:3px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">ملغاة</span>';
    }

    var items = (w.items || []).map(function(it) {
      return (it.productName || '') + (it.serialNumber ? ' [S/N: ' + it.serialNumber + ']' : '');
    }).filter(Boolean).join(' | ') || '—';

    var purchaseStr = w.purchaseDate ? new Date(w.purchaseDate).toLocaleDateString('ar-EG') : '—';
    var expiryStr = w.expiryDate ? new Date(w.expiryDate).toLocaleDateString('ar-EG') : '—';
    var rowBg = expiringSoon ? 'background:#fffbeb;' : (w.status === 'expired' ? 'background:#fff1f2;' : '');

    rows += '<tr style="' + rowBg + '">';
    rows += '<td><strong style="color:#1e40af;">#' + (w.warrantyNumber || w.id) + '</strong>';
    if (w.manual) rows += ' <span style="font-size:0.7rem;background:#ede9fe;color:#6d28d9;padding:1px 5px;border-radius:4px;font-weight:700;">يدوية</span>';
    rows += '</td>';
    rows += '<td><div style="font-weight:700;">' + (w.customerName || '—') + '</div>';
    if (w.customerSystemNumber) rows += '<div style="font-size:0.75rem;color:#64748b;">' + w.customerSystemNumber + '</div>';
    rows += '</td>';
    rows += '<td>' + (w.customerPhone || '—') + '</td>';
    rows += '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + items + '">' + items + '</td>';
    rows += '<td>' + purchaseStr + '</td>';
    rows += '<td><strong style="color:#15803d;">' + (w.durationText || (w.durationMonths + ' شهر')) + '</strong></td>';
    rows += '<td>' + expiryStr + '</td>';
    rows += '<td>' + badge2 + '</td>';
    rows += '<td><div style="display:flex;gap:4px;">';
    rows += '<button type="button" class="btn btn-sm btn-primary" onclick="openWarrantyById(\'' + w.id + '\')" title="عرض وطباعة الكفالة">🛡️ عرض</button>';
    rows += '<button type="button" class="btn btn-sm" style="background:#f59e0b;color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8rem;font-weight:700;" onclick="openWarrantyById(\'' + w.id + '\', true)" title="تعديل مدة وبيانات الكفالة">✏️ تعديل</button>';
    rows += '<button type="button" class="btn btn-sm" style="background:#ef4444;color:white;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:0.8rem;" onclick="deleteWarrantyById(\'' + w.id + '\')" title="حذف الكفالة">🗑️</button>';
    rows += '</div></td>';
    rows += '</tr>';
  }
  tbody.innerHTML = rows;
}

// ================================================
// إحصائيات الكفالات
// ================================================
function updateWarrantyStats(warranties) {
  var now = new Date();
  var thirtyDays = 30 * 24 * 60 * 60 * 1000;
  var active = 0, expired = 0, soon = 0;
  for (var i = 0; i < warranties.length; i++) {
    var w = warranties[i];
    if (w.status === 'active') {
      active++;
      var diff = new Date(w.expiryDate) - now;
      if (diff < thirtyDays && diff > 0) soon++;
    } else if (w.status === 'expired') {
      expired++;
    }
  }
  var s = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
  s('warStatActive', active);
  s('warStatExpiringSoon', soon);
  s('warStatExpired', expired);
  s('warStatTotal', warranties.length);

  var nb = document.getElementById('activeWarrantiesBadge');
  if (nb) {
    nb.style.display = soon > 0 ? 'inline' : 'none';
    if (soon > 0) nb.textContent = soon;
  }
}

// ================================================
// فلتر وبحث
// ================================================
function filterWarranties(q) {
  var statusEl = document.getElementById('warrantiesStatusFilter');
  var status = statusEl ? statusEl.value : 'all';
  q = (q || '').trim().toLowerCase();
  var filtered = _warrantiesAll.filter(function(w) {
    var okStatus = status === 'all' || w.status === status;
    var okSearch = !q
      || (w.customerName || '').toLowerCase().indexOf(q) >= 0
      || String(w.warrantyNumber).indexOf(q) >= 0
      || (w.customerPhone || '').indexOf(q) >= 0
      || (w.invoiceNumber ? String(w.invoiceNumber).indexOf(q) >= 0 : false)
      || (w.items || []).some(function(it) {
          return (it.productName || '').toLowerCase().indexOf(q) >= 0
            || (it.serialNumber || '').toLowerCase().indexOf(q) >= 0;
        });
    return okStatus && okSearch;
  });
  renderWarrantiesTable(filtered);
}

// ================================================
// فتح كفالة بالـ ID أو رقم الكفالة
// ================================================
async function openWarrantyById(warrantyId, editMode) {
  if (!warrantyId) return;
  // البحث في الذاكرة المحلية أولاً
  var found = null;
  for (var i = 0; i < _warrantiesAll.length; i++) {
    if (_warrantiesAll[i].id === warrantyId || String(_warrantiesAll[i].warrantyNumber) === String(warrantyId)) {
      found = _warrantiesAll[i];
      break;
    }
  }
  if (found) {
    _currentWarranty = found;
    openWarrantyModal(_currentWarranty, editMode);
    return;
  }

  // إذا لم نجدها محلياً، نجلبها من الخادم
  try {
    var res = await fetch('/api/warranties/' + encodeURIComponent(warrantyId));
    var data = await res.json();
    if (!data.success || !data.warranty) throw new Error(data.error || 'لم يتم العثور على وثيقة الكفالة');
    _currentWarranty = data.warranty;
    openWarrantyModal(_currentWarranty, editMode);
  } catch (e) {
    if (typeof showToast === 'function') showToast('خطأ: ' + e.message, 'error');
  }
}

// ================================================
// فتح كفالة الفاتورة (أو إنشاؤها إن لم تكن موجودة)
// ================================================
async function openWarrantyByInvoiceId(invoiceId) {
  if (!invoiceId) return;
  var found = _warrantiesAll.find(function(w) {
    return w.invoiceId === invoiceId || String(w.invoiceNumber) === String(invoiceId);
  });
  if (found) {
    openWarrantyModal(found, false);
    return;
  }

  try {
    var res = await fetch('/api/warranties');
    var data = await res.json();
    if (data.success && data.warranties) {
      _warrantiesAll = data.warranties;
      var match = _warrantiesAll.find(function(w) {
        return w.invoiceId === invoiceId || String(w.invoiceNumber) === String(invoiceId);
      });
      if (match) {
        openWarrantyModal(match, false);
        return;
      }
    }

    // توليد كفالة للفاتورة
    var createRes = await fetch('/api/warranties/from-invoice/' + encodeURIComponent(invoiceId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMonths: 12 })
    });
    var createData = await createRes.json();
    if (createData.success && createData.warranty) {
      _warrantiesAll.unshift(createData.warranty);
      renderWarrantiesTable(_warrantiesAll);
      updateWarrantyStats(_warrantiesAll);
      openWarrantyModal(createData.warranty, false);
      if (typeof showToast === 'function') showToast('🛡️ تم فتح وثيقة الكفالة الخاصة بالفاتورة', 'success');
    } else {
      throw new Error(createData.error || 'تعذر إصدار كفالة لهذه الفاتورة');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('خطأ: ' + e.message, 'error');
  }
}

// ================================================
// فتح كفالة الفاتورة المعروضة حالياً في مودال الفاتورة
// ================================================
function openWarrantyForCurrentInvoice() {
  if (typeof state !== 'undefined' && state.currentViewingInvoice) {
    openWarrantyByInvoiceId(state.currentViewingInvoice.id);
  }
}

// ================================================
// فتح المودال وملء البيانات
// ================================================
function openWarrantyModal(w, editMode) {
  if (!w) return;

  // إذا تم تمرير ID كنص أو رقم
  if (typeof w === 'string' || typeof w === 'number') {
    openWarrantyById(String(w), editMode);
    return;
  }

  _currentWarranty = w;
  var modal = document.getElementById('warrantyViewModal');
  if (!modal) {
    alert('خطأ: نافذة الكفالة غير موجودة');
    return;
  }

  var sv = function(id, v) { var el = document.getElementById(id); if (el) el.value = (v !== undefined && v !== null) ? v : ''; };
  var st = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = (v !== undefined && v !== null) ? v : ''; };

  st('warModalSubtitle', 'كفالة #' + (w.warrantyNumber || w.id) + ' — ' + (w.customerName || 'عميل'));
  sv('warEditDuration', String(w.durationMonths || 12));
  sv('warEditCustomerName', w.customerName || '');
  sv('warEditPhone', w.customerPhone || '');
  sv('warEditAddress', w.customerAddress || '');
  sv('warEditNotes', w.notes || '');

  if (w.purchaseDate) {
    var pStr = w.purchaseDate.includes('T') ? w.purchaseDate.split('T')[0] : w.purchaseDate;
    sv('warEditPurchaseDate', pStr);
  } else {
    sv('warEditPurchaseDate', new Date().toISOString().split('T')[0]);
  }

  // تعبئة حقول السيريال لكل صنف في قسم التعديل
  var serialList = document.getElementById('warItemsSerialList');
  if (serialList) {
    var html = '';
    var items = w.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px;align-items:center;background:#fff;padding:6px 10px;border-radius:8px;border:1px solid #e2e8f0;">'
        + '<div><strong style="font-size:0.86rem;color:#1e40af;">' + (it.productName || ('صنف #' + (i+1))) + '</strong>'
        + (it.brand ? '<span style="font-size:0.75rem;color:#64748b;margin-right:6px;">(' + it.brand + ')</span>' : '')
        + '</div>'
        + '<input type="text" class="form-control" data-ser="' + i + '" value="' + (it.serialNumber || '') + '" placeholder="رقم السيريال S/N...">'
        + '</div>';
    }
    if (!items.length) {
      html = '<div style="color:#94a3b8;font-size:0.85rem;padding:6px;">لا توجد أصناف مسجلة</div>';
    }
    serialList.innerHTML = html;
  }

  // ملء ورقة الكفالة للمعاينة والطباعة
  fillWarrantyDocument(w);

  // إظهار أو إخفاء قسم التعديل
  var editSection = document.getElementById('warEditSection');
  if (editSection) editSection.style.display = editMode ? '' : 'none';
  var editToggleBtn = document.getElementById('warToggleEditBtn');
  if (editToggleBtn) {
    editToggleBtn.textContent = editMode ? '👁️ إخفاء التعديل' : '✏️ تعديل مدة وبيانات الكفالة';
  }

  // فتح المودال
  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  document.body.style.overflow = 'hidden';
}

function toggleWarrantyEditSection() {
  var editSection = document.getElementById('warEditSection');
  var btn = document.getElementById('warToggleEditBtn');
  if (!editSection) return;
  var isVisible = editSection.style.display !== 'none';
  editSection.style.display = isVisible ? 'none' : '';
  if (btn) btn.textContent = isVisible ? '✏️ تعديل مدة وبيانات الكفالة' : '👁️ إخفاء التعديل';
}

function closeWarrantyModal() {
  var modal = document.getElementById('warrantyViewModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
  document.body.style.overflow = '';
  _currentWarranty = null;
}

// ================================================
// ملء ورقة الكفالة (للمعاينة والطباعة)
// ================================================
function fillWarrantyDocument(w) {
  var st = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v || ''; };
  var toD = function(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  st('warPrintCompany', w.companyName || 'شركة أبو رامز للأجهزة الكهربائية');
  st('warPrintCompanyPhone', w.companyPhone ? ('هاتف: ' + w.companyPhone) : '');
  st('warPrintNum', '#' + (w.warrantyNumber || w.id));
  st('warPrintInvoiceNum', w.invoiceNumber ? ('#' + w.invoiceNumber) : (w.manual ? 'كفالة مستقلة' : '—'));
  st('warPrintCustomer', w.customerName || '—');
  st('warPrintPhone', w.customerPhone || '—');
  st('warPrintAddress', w.customerAddress || '—');
  st('warPrintPurchaseDate', toD(w.purchaseDate));
  st('warPrintDuration', w.durationText || (w.durationMonths + ' شهراً'));
  st('warPrintExpiry', toD(w.expiryDate));

  var itemsTbody = document.getElementById('warPrintItemsBody');
  if (itemsTbody) {
    var html = '';
    var items = w.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<tr>'
        + '<td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">' + (i + 1) + '</td>'
        + '<td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:700;">' + (it.productName || '—') + '</td>'
        + '<td style="padding:6px 8px;border:1px solid #cbd5e1;">' + (it.brand || '—') + '</td>'
        + '<td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700;">' + (it.quantity || 1) + '</td>'
        + '<td style="padding:6px 8px;border:1px solid #cbd5e1;font-family:monospace;direction:ltr;text-align:right;">' + (it.serialNumber || '—') + '</td>'
        + '</tr>';
    }
    if (!html) {
      html = '<tr><td colspan="5" style="text-align:center;padding:12px;color:#94a3b8;">لا توجد أصناف مسجلة</td></tr>';
    }
    itemsTbody.innerHTML = html;
  }

  var termsList = document.getElementById('warPrintTermsList');
  if (termsList) {
    var tHtml = '';
    var terms = w.terms || [
      'الرجاء قراءة الكفالة وكتيب التعليمات قبل الاستخدام.',
      'الكفالة لا تشمل الكسر وسوء الاستخدام للمنتج.',
      'هذا الضمان لا يغطي الفساد الذي يتسبب به المنتج من خلال النقل او التركيب والتشغيل بطريقة غير مطابقة لدليل الاستعمال.',
      'يلغى الضمان في حال تم تدخل اي مصلح خارجي بالمنتج وليس من طرف شركة ابو رامز للاجهزة الكهربائية.',
      'هذا المنتج مضمون من كل عيب مصنعي.',
      'الاصلاحات التي تتم في اطار مدة الكفالة تكون مجانا.',
      'القطع واليد العاملة بدون مقابل.'
    ];
    for (var j = 0; j < terms.length; j++) {
      tHtml += '<li style="margin-bottom:4px;">' + terms[j] + '</li>';
    }
    termsList.innerHTML = tHtml;
  }
}

// ================================================
// حفظ تعديلات الكفالة (المدة، البيانات، السيريال)
// ================================================
async function saveWarrantyEdits() {
  if (!_currentWarranty) return;
  var btn = document.getElementById('warSaveEditBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الحفظ...'; }

  try {
    var duration = parseInt(document.getElementById('warEditDuration').value) || 12;
    var customerName = (document.getElementById('warEditCustomerName')?.value || '').trim();
    var phone = (document.getElementById('warEditPhone')?.value || '').trim();
    var purchaseDateVal = document.getElementById('warEditPurchaseDate')?.value;
    var address = (document.getElementById('warEditAddress')?.value || '').trim();
    var notes = (document.getElementById('warEditNotes')?.value || '').trim();

    var serInputs = document.querySelectorAll('#warItemsSerialList input[data-ser]');
    var itemsUpd = [];
    serInputs.forEach(function(inp) {
      itemsUpd.push({ serialNumber: inp.value.trim() });
    });

    var payload = {
      durationMonths: duration,
      customerPhone: phone,
      customerAddress: address,
      notes: notes,
      items: itemsUpd
    };
    if (customerName) payload.customerName = customerName;
    if (purchaseDateVal) payload.purchaseDate = purchaseDateVal;

    var res = await fetch('/api/warranties/' + encodeURIComponent(_currentWarranty.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!data.success) throw new Error(data.error || 'فشل حفظ التعديلات');

    _currentWarranty = data.warranty;
    // تحديث القائمة المحلية
    for (var i = 0; i < _warrantiesAll.length; i++) {
      if (_warrantiesAll[i].id === _currentWarranty.id) {
        _warrantiesAll[i] = _currentWarranty;
        break;
      }
    }

    fillWarrantyDocument(_currentWarranty);
    renderWarrantiesTable(_warrantiesAll);
    updateWarrantyStats(_warrantiesAll);
    toggleWarrantyEditSection();

    if (typeof showToast === 'function') {
      showToast('✅ تم تعديل مدة وبيانات الكفالة بنجاح (المدة: ' + _currentWarranty.durationText + ')', 'success');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('خطأ: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ التعديلات الآن'; }
  }
}

// ================================================
// طباعة وثيقة الكفالة A4
// ================================================
function printWarranty() {
  var area = document.getElementById('warrantyPrintArea');
  if (!area || !_currentWarranty) return;
  var pw = window.open('', '_blank', 'width=850,height=750,scrollbars=yes');
  pw.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">');
  pw.document.write('<title>كفالة #' + (_currentWarranty.warrantyNumber || _currentWarranty.id) + ' - ' + (_currentWarranty.customerName || '') + '</title>');
  pw.document.write('<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">');
  pw.document.write('<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Cairo,sans-serif;direction:rtl;padding:0;margin:0;background:#fff;color:#1e293b;}@page{size:A4 portrait;margin:6mm 8mm;}@media print{html,body{height:auto!important;overflow:visible!important;}body{font-size:10px!important;line-height:1.3!important;}table{width:100%;border-collapse:collapse;font-size:10px!important;}th,td{border:1px solid #cbd5e1;padding:3px 5px!important;text-align:right;font-size:10px!important;}th{background:#eff6ff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}h1{font-size:16px!important;} h2{font-size:13px!important;} h3{font-size:12px!important;} h4{font-size:11px!important;}.war-header{padding:8px!important;margin-bottom:8px!important;}.war-terms-list li{font-size:9.5px!important;margin-bottom:2px!important;}.war-items-table td,.war-items-table th{padding:3px 5px!important;}button{display:none!important;}.no-print{display:none!important;}}</style>');

  pw.document.write('</head><body>');
  pw.document.write(area.outerHTML);
  pw.document.write('<script>setTimeout(function(){window.print();},600);<\/script>');
  pw.document.write('</body></html>');
  pw.document.close();
}

// ================================================
// حذف كفالة
// ================================================
async function deleteWarrantyById(warrantyId) {
  var w = null;
  for (var i = 0; i < _warrantiesAll.length; i++) {
    if (_warrantiesAll[i].id === warrantyId) { w = _warrantiesAll[i]; break; }
  }
  var label = w ? ('كفالة #' + (w.warrantyNumber || w.id) + ' — ' + w.customerName) : warrantyId;
  if (!confirm('هل أنت متأكد من حذف ' + label + ' نهائياً؟')) return;
  try {
    var res = await fetch('/api/warranties/' + encodeURIComponent(warrantyId), { method: 'DELETE' });
    var data = await res.json();
    if (!data.success) throw new Error(data.error || 'فشل الحذف');
    _warrantiesAll = _warrantiesAll.filter(function(x) { return x.id !== warrantyId; });
    renderWarrantiesTable(_warrantiesAll);
    updateWarrantyStats(_warrantiesAll);
    if (typeof showToast === 'function') showToast('🗑️ تم حذف الكفالة بنجاح', 'success');
    closeWarrantyModal();
  } catch (e) {
    if (typeof showToast === 'function') showToast('خطأ: ' + e.message, 'error');
  }
}

// ================================================
// إنشاء كفالة يدوياً (بدون فاتورة)
// ================================================
function openCreateWarrantyModal() {
  var modal = document.getElementById('createWarrantyModal');
  if (!modal) { alert('نافذة إنشاء الكفالة غير موجودة'); return; }

  // إعادة ضبط وتصفير الحقول
  var fields = ['cwCustomerName', 'cwCustomerPhone', 'cwCustomerAddress', 'cwDuration', 'cwPurchaseDate', 'cwNotes'];
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'SELECT') el.value = '12';
      else if (id === 'cwPurchaseDate') el.value = new Date().toISOString().split('T')[0];
      else el.value = '';
    }
  });

  // تصفير قائمة الأصناف وإضافة بند فارغ
  document.getElementById('cwItemsList').innerHTML = '';
  _cwItemCount = 0;
  addWarrantyItem();

  modal.classList.add('active');
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  document.body.style.overflow = 'hidden';

  setTimeout(function() {
    var inp = document.getElementById('cwCustomerName');
    if (inp) inp.focus();
  }, 100);
}

function closeCreateWarrantyModal() {
  var modal = document.getElementById('createWarrantyModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
  document.body.style.overflow = '';
}

var _cwItemCount = 0;
function addWarrantyItem() {
  var list = document.getElementById('cwItemsList');
  if (!list) return;
  var idx = _cwItemCount++;
  var div = document.createElement('div');
  div.id = 'cwItem_' + idx;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:6px;margin-bottom:8px;align-items:center;';
  div.innerHTML = '<input type="text" class="form-control" data-cw-name="' + idx + '" placeholder="اسم الصنف (مطلوب) *">'
    + '<input type="text" class="form-control" data-cw-brand="' + idx + '" placeholder="الماركة">'
    + '<input type="text" class="form-control" data-cw-serial="' + idx + '" placeholder="رقم السيريال S/N">'
    + '<button type="button" onclick="removeCwItem(' + idx + ')" style="background:#ef4444;color:white;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:0.85rem;" title="حذف الصنف">✕</button>';
  list.appendChild(div);
}

function removeCwItem(idx) {
  var el = document.getElementById('cwItem_' + idx);
  if (el) el.remove();
}

async function submitCreateWarranty() {
  var btn = document.getElementById('cwSubmitBtn');
  var customerName = (document.getElementById('cwCustomerName').value || '').trim();
  var customerPhone = (document.getElementById('cwCustomerPhone').value || '').trim();
  var customerAddress = (document.getElementById('cwCustomerAddress').value || '').trim();
  var durationMonths = parseInt(document.getElementById('cwDuration').value) || 12;
  var purchaseDateVal = document.getElementById('cwPurchaseDate').value;
  var notes = (document.getElementById('cwNotes').value || '').trim();

  if (!customerName) {
    if (typeof showToast === 'function') showToast('يرجى إدخال اسم الزبون', 'error');
    document.getElementById('cwCustomerName').focus();
    return;
  }

  // جمع الأصناف
  var items = [];
  var nameInputs = document.querySelectorAll('#cwItemsList [data-cw-name]');
  nameInputs.forEach(function(inp) {
    var idx = inp.getAttribute('data-cw-name');
    var name = inp.value.trim();
    if (!name) return;
    var brand = (document.querySelector('[data-cw-brand="' + idx + '"]') || {}).value || '';
    var serial = (document.querySelector('[data-cw-serial="' + idx + '"]') || {}).value || '';
    items.push({ productName: name, brand: brand.trim(), serialNumber: serial.trim(), quantity: 1 });
  });

  if (items.length === 0) {
    if (typeof showToast === 'function') showToast('يرجى إضافة صنف واحد على الأقل مشمول بالكفالة', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'جاري الإنشاء والحفظ...'; }

  try {
    var payload = {
      customerName: customerName,
      customerPhone: customerPhone,
      customerAddress: customerAddress,
      durationMonths: durationMonths,
      purchaseDate: purchaseDateVal ? new Date(purchaseDateVal).toISOString() : new Date().toISOString(),
      items: items,
      notes: notes
    };

    var res = await fetch('/api/warranties/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!data.success) throw new Error(data.error || 'فشل حفظ الكفالة');

    _warrantiesAll.unshift(data.warranty);
    renderWarrantiesTable(_warrantiesAll);
    updateWarrantyStats(_warrantiesAll);
    closeCreateWarrantyModal();

    if (typeof showToast === 'function') {
      showToast('✅ تم إنشاء الكفالة رقم #' + (data.warranty.warrantyNumber || data.warranty.id) + ' بنجاح', 'success');
    }

    // فتح الكفالة المنشأة مباشرة للمعاينة والطباعة
    openWarrantyModal(data.warranty, false);
  } catch (e) {
    if (typeof showToast === 'function') showToast('خطأ: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ وإنشاء الكفالة'; }
  }
}

// ================================================
// تحديث واجهة الكفالة وزر عرض السعر في نموذج الفاتورة
// ================================================
function updateInvoiceFormWarrantyUI() {
  var isSales = typeof state !== 'undefined' ? (state.invoiceType === 'sales') : true;
  var wb = document.getElementById('warrantyDurationBlock');
  var qb = document.getElementById('btnSubmitQuotation');
  var qh = document.getElementById('quotationHintText');
  if (wb) wb.style.display = isSales ? '' : 'none';
  if (qb) qb.style.display = isSales ? '' : 'none';
  if (qh) qh.style.display = isSales ? '' : 'none';
}

// ================================================
// تحويل عرض السعر إلى فاتورة مبيعات فعلية
// ================================================
async function convertQuotationToSales(invoiceId) {
  if (!invoiceId) return;
  if (!confirm('هل تريد تحويل هذا العرض إلى فاتورة مبيعات فعلية؟\n\n- سيتم خصم الكميات من المخزون\n- تسجيل الدين في حساب الزبون (إن وجد)\n- إصدار وثيقة كفالة رسمية للأصناف')) {
    return;
  }

  try {
    var res = await fetch('/api/invoices/' + encodeURIComponent(invoiceId) + '/convert-to-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.success) throw new Error(data.error || 'فشل التحويل');

    if (typeof showToast === 'function') {
      showToast('🎉 تم اعتماد العرض وتحويله لفاتورة مبيعات فعلية #' + data.invoice.invoiceNumber + ' وخصم المخزون بنجاح!', 'success');
    }

    if (typeof loadInvoices === 'function') await loadInvoices();
    if (typeof loadProducts === 'function') await loadProducts();
    await loadWarranties();

    if (typeof closeInvoiceModal === 'function') closeInvoiceModal();

    // إذا تم توليد كفالة، نسأل المستخدم إن كان يريد عرضها
    if (data.warranty) {
      setTimeout(function() {
        openWarrantyModal(data.warranty, false);
      }, 500);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast('خطأ في التحويل: ' + e.message, 'error');
  }
}

function onWarrantiesTabActivated() {
  loadWarranties();
}

// تهيئة أولية
document.addEventListener('DOMContentLoaded', function() {
  updateInvoiceFormWarrantyUI();
});
