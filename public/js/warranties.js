/**
 * warranties.js
 * إدارة نظام الكفالات والضمان - شركة أبو رامز للأجهزة الكهربائية
 */

let _warrantiesAll = [];
let _currentWarranty = null;

async function loadWarranties() {
  try {
    const res = await fetch('/api/warranties');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    _warrantiesAll = data.warranties || [];
    renderWarrantiesTable(_warrantiesAll);
    updateWarrantyStats(_warrantiesAll);
  } catch (e) {
    console.error('loadWarranties error:', e);
    showToast('خطأ في تحميل الكفالات: ' + e.message, 'error');
  }
}

function renderWarrantiesTable(warranties) {
  const tbody = document.getElementById('warrantiesTableBody');
  const emptyMsg = document.getElementById('emptyWarrantiesMessage');
  const badge = document.getElementById('warrantiesCountBadge');
  if (!tbody) return;
  if (badge) badge.textContent = warranties.length + ' كفالة';
  if (!warranties.length) {
    tbody.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = '';
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';
  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  tbody.innerHTML = warranties.map(function(w) {
    const expiryDate = new Date(w.expiryDate);
    const expiringSoon = w.status === 'active' && (expiryDate - now) < thirtyDaysMs && (expiryDate - now) > 0;
    const statusBadge = w.status === 'active'
      ? (expiringSoon ? '<span class="badge" style="background:#f59e0b;color:#fff;">تنتهي قريباً</span>' : '<span class="badge badge-success">نشطة</span>')
      : w.status === 'expired' ? '<span class="badge badge-danger">منتهية</span>'
      : '<span class="badge" style="background:#94a3b8;color:#fff;">ملغاة</span>';
    const itemsSummary = (w.items || []).map(function(i) { return i.productName; }).join(' | ') || '-';
    const purchaseStr = w.purchaseDate ? new Date(w.purchaseDate).toLocaleDateString('ar-PS') : '-';
    const expiryStr = w.expiryDate ? new Date(w.expiryDate).toLocaleDateString('ar-PS') : '-';
    const rowStyle = expiringSoon ? 'background:#fffbeb;' : (w.status === 'expired' ? 'background:#fff1f2;opacity:0.85;' : '');
    return '<tr style="' + rowStyle + '"><td><strong style="color:#1e40af;">#' + w.warrantyNumber + '</strong></td>' +
      '<td><div style="font-weight:700;">' + (w.customerName || '-') + '</div>' +
      (w.customerSystemNumber ? '<div style="font-size:0.75rem;color:#64748b;">رقم: ' + w.customerSystemNumber + '</div>' : '') + '</td>' +
      '<td style="direction:ltr;">' + (w.customerPhone || '-') + '</td>' +
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + itemsSummary + '">' + itemsSummary + '</td>' +
      '<td>' + purchaseStr + '</td><td>' + (w.durationText || w.durationMonths + ' شهراً') + '</td>' +
      '<td>' + expiryStr + '</td><td>' + statusBadge + '</td>' +
      '<td><div style="display:flex;gap:5px;">' +
      '<button class="btn btn-sm btn-primary" onclick="openWarrantyModal(\'' + w.id + '\')">عرض</button>' +
      '<button class="btn btn-sm" style="background:#ef4444;color:white;" onclick="deleteWarrantyConfirm(\'' + w.id + '\')">حذف</button>' +
      '</div></td></tr>';
  }).join('');
}

function updateWarrantyStats(warranties) {
  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const active = warranties.filter(function(w) { return w.status === 'active'; }).length;
  const expired = warranties.filter(function(w) { return w.status === 'expired'; }).length;
  const expiringSoon = warranties.filter(function(w) {
    const exp = new Date(w.expiryDate);
    return w.status === 'active' && (exp - now) < thirtyDaysMs && (exp - now) > 0;
  }).length;
  var s = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  s('warStatActive', active); s('warStatExpiringSoon', expiringSoon);
  s('warStatExpired', expired); s('warStatTotal', warranties.length);
  var nb = document.getElementById('activeWarrantiesBadge');
  if (nb) { if (expiringSoon > 0) { nb.style.display = 'inline'; nb.textContent = expiringSoon; } else { nb.style.display = 'none'; } }
}

function filterWarranties(searchTerm) {
  const statusFilter = document.getElementById('warrantiesStatusFilter');
  const status = statusFilter ? statusFilter.value : 'all';
  const q = (searchTerm || '').trim().toLowerCase();
  const filtered = _warrantiesAll.filter(function(w) {
    const matchStatus = status === 'all' || w.status === status;
    const matchSearch = !q ||
      (w.customerName || '').toLowerCase().includes(q) ||
      String(w.warrantyNumber).includes(q) ||
      (w.customerPhone || '').includes(q) ||
      (w.invoiceNumber || '').toLowerCase().includes(q) ||
      (w.items || []).some(function(i) { return (i.productName || '').toLowerCase().includes(q); });
    return matchStatus && matchSearch;
  });
  renderWarrantiesTable(filtered);
}

async function openWarrantyModal(warrantyId) {
  try {
    const res = await fetch('/api/warranties/' + warrantyId);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    _currentWarranty = data.warranty;
    populateWarrantyModal(_currentWarranty);
    document.getElementById('warrantyViewModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } catch (e) {
    showToast('خطأ في تحميل الكفالة: ' + e.message, 'error');
  }
}

function closeWarrantyModal() {
  document.getElementById('warrantyViewModal').style.display = 'none';
  document.body.style.overflow = '';
  _currentWarranty = null;
}

function populateWarrantyModal(w) {
  var s = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  var sv = function(id, v) { var e = document.getElementById(id); if (e) e.value = v; };
  s('warModalSubtitle', 'رقم الكفالة: #' + w.warrantyNumber + ' | ' + (w.customerName || ''));
  sv('warEditDuration', String(w.durationMonths));
  sv('warEditPhone', w.customerPhone || '');
  sv('warEditAddress', w.customerAddress || '');
  sv('warEditNotes', w.notes || '');
  var serialList = document.getElementById('warItemsSerialList');
  if (serialList) {
    serialList.innerHTML = (w.items || []).map(function(item, idx) {
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<span style="font-size:0.82rem;font-weight:600;min-width:160px;color:#374151;">' + (item.productName || ('صنف ' + (idx+1))) + '</span>' +
        '<input type="text" class="form-control" data-serial-idx="' + idx + '" value="' + (item.serialNumber || '') + '" placeholder="رقم السيريال...">' +
        '</div>';
    }).join('');
  }
  s('warPrintCompany', w.companyName || 'شركة أبو رامز للأجهزة الكهربائية');
  s('warPrintCompanyPhone', w.companyPhone ? w.companyPhone : '');
  s('warPrintNum', '#' + w.warrantyNumber);
  s('warPrintInvoiceNum', w.invoiceNumber || '-');
  s('warPrintCustomer', w.customerName || '-');
  s('warPrintPhone', w.customerPhone || '-');
  s('warPrintAddress', w.customerAddress || '-');
  var toDate = function(d) { return d ? new Date(d).toLocaleDateString('ar-PS', {year:'numeric',month:'long',day:'numeric'}) : '-'; };
  s('warPrintPurchaseDate', toDate(w.purchaseDate));
  s('warPrintDuration', w.durationText || w.durationMonths + ' شهراً');
  s('warPrintExpiry', toDate(w.expiryDate));
  var itemsTbody = document.getElementById('warPrintItemsBody');
  if (itemsTbody) {
    itemsTbody.innerHTML = (w.items || []).map(function(item, idx) {
      return '<tr>' +
        '<td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;">' + (idx+1) + '</td>' +
        '<td style="padding:5px 8px;border:1px solid #cbd5e1;">' + (item.productName||'-') + '</td>' +
        '<td style="padding:5px 8px;border:1px solid #cbd5e1;">' + (item.brand||'-') + '</td>' +
        '<td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;">' + (item.quantity||1) + '</td>' +
        '<td style="padding:5px 8px;border:1px solid #cbd5e1;direction:ltr;">' + (item.serialNumber||'-') + '</td></tr>';
    }).join('');
  }
  var termsList = document.getElementById('warPrintTermsList');
  if (termsList) {
    termsList.innerHTML = (w.terms || []).map(function(t) { return '<li>' + t + '</li>'; }).join('');
  }
}

async function saveWarrantyEdits() {
  if (!_currentWarranty) return;
  try {
    const durationMonths = parseInt(document.getElementById('warEditDuration').value);
    const customerPhone = document.getElementById('warEditPhone').value.trim();
    const customerAddress = document.getElementById('warEditAddress').value.trim();
    const notes = document.getElementById('warEditNotes').value.trim();
    const serialInputs = document.querySelectorAll('#warItemsSerialList input[data-serial-idx]');
    const itemsUpdate = [];
    serialInputs.forEach(function(input) { itemsUpdate.push({ serialNumber: input.value.trim() }); });
    const res = await fetch('/api/warranties/' + _currentWarranty.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMonths, customerPhone, customerAddress, notes, items: itemsUpdate })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    _currentWarranty = data.warranty;
    var idx = _warrantiesAll.findIndex(function(w) { return w.id === _currentWarranty.id; });
    if (idx !== -1) _warrantiesAll[idx] = _currentWarranty;
    populateWarrantyModal(_currentWarranty);
    renderWarrantiesTable(_warrantiesAll);
    showToast('تم حفظ تعديلات الكفالة بنجاح', 'success');
  } catch (e) {
    showToast('خطأ في الحفظ: ' + e.message, 'error');
  }
}

function printWarranty() {
  var printArea = document.getElementById('warrantyPrintArea');
  if (!printArea || !_currentWarranty) return;
  var pw = window.open('', 'WARRANTY_PRINT', 'width=800,height=700');
  pw.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>كفالة #' + _currentWarranty.warrantyNumber + '</title>');
  pw.document.write('<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">');
  pw.document.write('<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Cairo,sans-serif;direction:rtl;padding:20px;background:white;color:#1e293b;}@page{size:A4;margin:10mm;}table{border-collapse:collapse;}th,td{border:1px solid #cbd5e1;padding:6px 8px;}</style></head><body>');
  pw.document.write(printArea.innerHTML);
  pw.document.write('</body></html>');
  pw.document.close();
  setTimeout(function() { pw.print(); }, 700);
}

async function deleteWarrantyConfirm(warrantyId) {
  var w = _warrantiesAll.find(function(x) { return x.id === warrantyId; });
  var label = w ? ('كفالة #' + w.warrantyNumber + ' - ' + w.customerName) : warrantyId;
  if (!confirm('هل أنت متأكد من حذف ' + label + '؟')) return;
  try {
    var res = await fetch('/api/warranties/' + warrantyId, { method: 'DELETE' });
    var data = await res.json();
    if (!data.success) throw new Error(data.error);
    _warrantiesAll = _warrantiesAll.filter(function(x) { return x.id !== warrantyId; });
    renderWarrantiesTable(_warrantiesAll);
    updateWarrantyStats(_warrantiesAll);
    showToast('تم حذف الكفالة', 'success');
  } catch (e) {
    showToast('خطأ في الحذف: ' + e.message, 'error');
  }
}

function updateInvoiceFormWarrantyUI() {
  var typeEl = document.getElementById('invoiceType');
  var isSales = typeEl && typeEl.value === 'sales';
  var wb = document.getElementById('warrantyDurationBlock');
  var qb = document.getElementById('btnSubmitQuotation');
  var qh = document.getElementById('quotationHintText');
  if (wb) wb.style.display = isSales ? '' : 'none';
  if (qb) qb.style.display = isSales ? '' : 'none';
  if (qh) qh.style.display = isSales ? '' : 'none';
}

async function convertQuotationToSales(invoiceId) {
  if (!confirm('هل تريد تحويل هذا العرض إلى فاتورة مبيعات فعلية؟\nسيتم خصم الكميات من المخزون وتسجيل الدين.')) return;
  try {
    var res = await fetch('/api/invoices/' + invoiceId + '/convert-to-sales', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
    });
    var data = await res.json();
    if (!data.success) throw new Error(data.error);
    showToast('تم تحويل العرض إلى فاتورة مبيعات رقم ' + data.invoice.invoiceNumber, 'success');
    if (typeof loadInvoices === 'function') loadInvoices();
    loadWarranties();
    if (typeof closeInvoiceViewModal === 'function') closeInvoiceViewModal();
  } catch (e) {
    showToast('خطأ في التحويل: ' + e.message, 'error');
  }
}

function onWarrantiesTabActivated() { loadWarranties(); }
