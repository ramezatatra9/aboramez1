const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// 1. Update ROUTE_MAP
const oldRouteTarget = "'brands-audit': 'brands-audit'\n};";
const newRouteMap = `'brands-audit': 'brands-audit',
  'store': 'store-manager',
  'store-manager': 'store-manager',
  'orders': 'store-manager'
};`;

if (!code.includes("'store-manager': 'store-manager'")) {
  code = code.replace(oldRouteTarget, newRouteMap);
  console.log('✅ Updated ROUTE_MAP in app.js');
}

// 2. Update TAB_TO_ROUTE
const oldTabTarget = "'brands-audit': '/admin/brands-audit'\n};";
const newTabToRoute = `'brands-audit': '/admin/brands-audit',
  'store-manager': '/admin/store'
};`;

if (!code.includes("'store-manager': '/admin/store'")) {
  code = code.replace(oldTabTarget, newTabToRoute);
  console.log('✅ Updated TAB_TO_ROUTE in app.js');
}

// 3. Update PAGE_TITLES
const oldTitleTarget = "'brands-audit': 'تدقيق الماركات | رامز عطاطرة'\n};";
const newPageTitles = `'brands-audit': 'تدقيق الماركات | رامز عطاطرة',
  'store-manager': 'إدارة المتجر والطلبات | رامز عطاطرة'
};`;

if (!code.includes("'store-manager': 'إدارة المتجر والطلبات | رامز عطاطرة'")) {
  code = code.replace(oldTitleTarget, newPageTitles);
  console.log('✅ Updated PAGE_TITLES in app.js');
}

// 4. Update actuallySwitchTab
const oldSwitchTarget = "if (tabId === 'invoices-list') {";
const newSwitchCode = `if (tabId === 'store-manager') {
    loadAdminStoreManager();
  } else if (tabId === 'invoices-list') {`;

if (!code.includes("if (tabId === 'store-manager')")) {
  code = code.replace(oldSwitchTarget, newSwitchCode);
  console.log('✅ Updated actuallySwitchTab in app.js');
}

// 5. Add all Store Manager client logic to the end of app.js
const storeManagerClientCode = `
// ================================================================
// لوحة تحكم إدارة المتجر الإلكتروني العام والطلبات (Store Manager Client)
// ================================================================
let _storeManagerConfig = null;
let _storeManagerOrders = [];
let _storeManagerAllProducts = [];

function switchStoreSubtab(subId) {
  document.querySelectorAll('.store-pane').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.store-subtab-btn').forEach(b => {
    b.style.background = '#ffffff';
    b.style.color = '#334155';
    b.style.borderColor = '#cbd5e1';
  });

  const pane = document.getElementById('storePane-' + subId);
  const btn = document.getElementById('subBtn' + subId.charAt(0).toUpperCase() + subId.slice(1));
  if (pane) pane.style.display = 'block';
  if (btn) {
    btn.style.background = '#2563eb';
    btn.style.color = '#ffffff';
    btn.style.borderColor = '#2563eb';
  }

  if (subId === 'products' && _storeManagerAllProducts.length === 0) {
    loadStoreProductsForTable();
  }
}

async function loadAdminStoreManager() {
  try {
    const [configRes, ordersRes] = await Promise.all([
      fetch('/api/admin/store-config').then(r => r.json()),
      fetch('/api/admin/orders').then(r => r.json())
    ]);

    if (configRes.success) {
      _storeManagerConfig = configRes.config || {};
      populateStoreSettingsForm(_storeManagerConfig);
      renderAdminCategories(_storeManagerConfig.categories || []);
      renderAdminBrands(_storeManagerConfig.brands || []);
      renderAdminOffers(_storeManagerConfig.offers || []);
    }

    if (ordersRes.success) {
      _storeManagerOrders = ordersRes.orders || [];
      renderAdminOrdersTable(_storeManagerOrders);
      updatePendingOrdersBadges();
    }
  } catch (err) {
    console.error('Error loading store manager data:', err);
    showToast('حدث خطأ أثناء تحميل بيانات المتجر', 'error');
  }
}

function updatePendingOrdersBadges() {
  const pendingCount = _storeManagerOrders.filter(o => o.status === 'pending').length;
  const navBadge = document.getElementById('adminPendingOrdersBadge');
  const subBadge = document.getElementById('storeSubOrdersCount');
  
  if (navBadge) {
    navBadge.textContent = pendingCount;
    navBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
  if (subBadge) {
    subBadge.textContent = pendingCount;
  }
}

function filterAdminOrdersTable() {
  const filter = document.getElementById('ordersStatusFilter').value;
  let filtered = _storeManagerOrders;
  if (filter !== 'all') {
    filtered = _storeManagerOrders.filter(o => o.status === filter);
  }
  renderAdminOrdersTable(filtered);
}

function renderAdminOrdersTable(orders) {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2.5rem; color:#64748b; font-weight:700;">لا توجد طلبات تطابق الفلتر المحدد</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => {
    let statusBadge = '<span class="badge badge-warning" style="background:#fef3c7; color:#b45309; padding:4px 8px; border-radius:6px; font-weight:800;">⏳ قيد المراجعة</span>';
    if (o.status === 'approved') {
      statusBadge = '<span class="badge badge-success" style="background:#dcfce7; color:#15803d; padding:4px 8px; border-radius:6px; font-weight:800;">✅ معتمد وتم خصم المخزون</span>';
    } else if (o.status === 'cancelled') {
      statusBadge = '<span class="badge badge-danger" style="background:#fee2e2; color:#b91c1c; padding:4px 8px; border-radius:6px; font-weight:800;">✕ ملغي</span>';
    }

    const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '--';
    const total = (o.totalAmount || 0).toLocaleString('en-US');
    const itemsCount = (o.items || []).length;
    const cust = o.customer || {};

    return \`
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="font-weight:900; font-family:var(--font-num, monospace); color:#1d4ed8;">#\${escapeHtml(o.id)}</td>
        <td style="font-size:0.85rem; color:#64748b;">\${dateStr}</td>
        <td style="font-weight:800; color:#0f172a;">\${escapeHtml(cust.name || '--')}</td>
        <td style="font-family:var(--font-num, monospace);">
          <a href="tel:\${escapeHtml(cust.phone || '')}" style="color:#2563eb; text-decoration:none; font-weight:700;">
            \${escapeHtml(cust.phone || '--')}
          </a>
        </td>
        <td style="font-size:0.88rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${escapeHtml(cust.address || '--')}</td>
        <td style="font-weight:800;">\${itemsCount} صنف</td>
        <td style="font-weight:900; color:#0f172a; font-size:1.05rem;">\${total} شيكل</td>
        <td>\${statusBadge}</td>
        <td>
          <button type="button" class="btn btn-sm btn-primary" onclick="viewAdminOrderDetails('\${escapeJsStr(o.id)}')" style="font-weight:700; padding:0.35rem 0.75rem;">
            👁️ معاينة وتفاصيل
          </button>
        </td>
      </tr>
    \`;
  }).join('');
}

function viewAdminOrderDetails(orderId) {
  const order = _storeManagerOrders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const modal = document.getElementById('adminOrderDetailsModal');
  const title = document.getElementById('orderModalTitle');
  const body = document.getElementById('orderModalBody');
  const footer = document.getElementById('orderModalFooter');

  title.textContent = 'تفاصيل الطلب الإلكتروني #' + order.id;

  const cust = order.customer || {};
  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' }) : '--';
  const total = (order.totalAmount || 0).toLocaleString('en-US');

  let itemsHtml = (order.items || []).map((it, idx) => {
    const lineTotal = (it.total || (it.price * it.qty) || 0).toLocaleString('en-US');
    return \`
      <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid #f1f5f9;">
        <div>
          <div style="font-weight:800; color:#0f172a; font-size:0.95rem;">\${idx + 1}. \${escapeHtml(it.name)}</div>
          <div style="font-size:0.8rem; color:#64748b;">
            كود: \${escapeHtml(it.code || '--')} • ماركة: \${escapeHtml(it.brand || '--')}
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-weight:900; color:#2563eb;">\${lineTotal} شيكل</div>
          <div style="font-size:0.8rem; color:#64748b;">(\${it.qty} × \${(it.price || 0).toLocaleString('en-US')})</div>
        </div>
      </div>
    \`;
  }).join('');

  body.innerHTML = \`
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.15rem; margin-bottom:1.25rem;">
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:0.75rem; font-size:0.9rem;">
        <div>👤 <strong>المشتري:</strong> \${escapeHtml(cust.name || '--')}</div>
        <div>📞 <strong>الهاتف:</strong> <a href="tel:\${escapeHtml(cust.phone || '')}" style="color:#2563eb; font-weight:800;">\${escapeHtml(cust.phone || '--')}</a></div>
        <div style="grid-column:1 / -1;">📍 <strong>العنوان:</strong> \${escapeHtml(cust.address || '--')}</div>
        \${cust.notes ? \`<div style="grid-column:1 / -1; color:#b45309;">📝 <strong>ملاحظات الزبون:</strong> \${escapeHtml(cust.notes)}</div>\` : ''}
        <div style="grid-column:1 / -1; font-size:0.82rem; color:#64748b;">🕒 <strong>تاريخ ووقت الطلب:</strong> \${dateStr}</div>
      </div>
    </div>

    <h4 style="font-weight:800; margin-bottom:0.75rem; color:#0f172a;">الأصناف المطلوبة:</h4>
    <div style="max-height:220px; overflow-y:auto; margin-bottom:1rem; border:1px solid #e2e8f0; border-radius:10px; padding:0.5rem 1rem;">
      \${itemsHtml}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; background:#eff6ff; padding:1rem; border-radius:10px; border:1.5px solid #bfdbfe;">
      <span style="font-weight:800; font-size:1.1rem; color:#1e40af;">المجموع الكلي المطلوب:</span>
      <span style="font-weight:900; font-size:1.4rem; color:#1d4ed8;">\${total} شيكل</span>
    </div>
  \`;

  let actionButtons = '';
  if (order.status === 'pending') {
    actionButtons = \`
      <button type="button" class="btn btn-success" onclick="approveAdminOrder('\${escapeJsStr(order.id)}')" style="font-weight:900; padding:0.6rem 1.25rem;">
        ✅ اعتماد الطلب وخصم المخزون فوراً
      </button>
      <button type="button" class="btn btn-danger" onclick="cancelAdminOrder('\${escapeJsStr(order.id)}')" style="font-weight:700;">
        ✕ إلغاء الطلب
      </button>
    \`;
  } else if (order.status === 'approved') {
    actionButtons = \`
      <span style="color:#15803d; font-weight:800;">✓ تم اعتماد هذا الطلب وخصم كمياته من المخزون</span>
      <button type="button" class="btn btn-secondary" onclick="cancelAdminOrder('\${escapeJsStr(order.id)}')">إلغاء الطلب</button>
    \`;
  } else {
    actionButtons = \`<span style="color:#b91c1c; font-weight:800;">هذا الطلب ملغي</span>\`;
  }

  footer.innerHTML = \`
    <div>\${actionButtons}</div>
    <button type="button" class="btn btn-secondary" onclick="closeAdminOrderModal()">إغلاق</button>
  \`;

  modal.style.display = 'flex';
}

function closeAdminOrderModal() {
  document.getElementById('adminOrderDetailsModal').style.display = 'none';
}

async function approveAdminOrder(orderId) {
  if (!confirm('هل أنت متأكد من رغبتك في اعتماد الطلب #' + orderId + '؟\\nسيتم خصم كميات الأصناف المطلوبة من مخزون النظام فوراً وبشكل دائم.')) {
    return;
  }

  try {
    const res = await fetch(\`/api/admin/orders/\${encodeURIComponent(orderId)}/approve\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedBy: (window.currentUser && window.currentUser.name) || 'الإدارة' })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'تم اعتماد الطلب وخصم المخزون بنجاح!', 'success');
      closeAdminOrderModal();
      loadAdminStoreManager();
      if (typeof loadProducts === 'function') loadProducts(); // reload admin products
    } else {
      showToast('خطأ: ' + (data.error || 'تعذر اعتماد الطلب'), 'error');
    }
  } catch (err) {
    showToast('خطأ بالاتصال: ' + err.message, 'error');
  }
}

async function cancelAdminOrder(orderId) {
  const reason = prompt('يرجى كتابة سبب إلغاء الطلب (اختياري):');
  if (reason === null) return;

  try {
    const res = await fetch(\`/api/admin/orders/\${encodeURIComponent(orderId)}/cancel\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'ملغي من الإدارة' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم إلغاء الطلب بنجاح', 'info');
      closeAdminOrderModal();
      loadAdminStoreManager();
    } else {
      showToast('خطأ: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('خطأ بالاتصال: ' + err.message, 'error');
  }
}

// ----------------------------------------------------------------
// Categories Management
// ----------------------------------------------------------------
function renderAdminCategories(categories) {
  const container = document.getElementById('adminCategoriesGrid');
  if (!container) return;

  container.innerHTML = categories.map(cat => {
    const img = cat.image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=300';
    const isVisible = cat.isVisible !== false;

    return \`
      <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:12px; padding:1rem; display:flex; flex-direction:column; justify-content:space-between; gap:0.75rem;">
        <div style="display:flex; align-items:center; gap:0.85rem;">
          <img src="\${escapeHtml(img)}" alt="" style="width:64px; height:64px; border-radius:10px; object-fit:cover; border:1px solid #cbd5e1;">
          <div>
            <h4 style="margin:0; font-weight:800; color:#0f172a; font-size:1rem;">\${escapeHtml(cat.name)}</h4>
            <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
              الحالة: \${isVisible ? '<span style=\"color:#15803d; font-weight:700;\">معروض بالمتجر ✓</span>' : '<span style=\"color:#b91c1c; font-weight:700;\">مخفي ✕</span>'}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; border-top:1px solid #f1f5f9; padding-top:0.75rem;">
          <button type="button" class="btn btn-sm btn-secondary" onclick="editCategoryImage('\${escapeJsStr(cat.id)}')">
            🖼️ تغيير الصورة
          </button>
          <button type="button" class="btn btn-sm \${isVisible ? 'btn-warning' : 'btn-success'}" onclick="toggleCategoryVisibility('\${escapeJsStr(cat.id)}', \${!isVisible})">
            \${isVisible ? 'إخفاء من المتجر' : 'تفعيل العرض'}
          </button>
        </div>
      </div>
    \`;
  }).join('');
}

async function editCategoryImage(catId) {
  const cat = (_storeManagerConfig.categories || []).find(c => String(c.id) === String(catId));
  if (!cat) return;

  const newUrl = prompt('أدخل رابط الصورة الجديد للقسم (' + cat.name + '):\\nيمكنك لصق رابط صورة مباشرة أو مسار /uploads/...', cat.image || '');
  if (newUrl === null) return;

  cat.image = newUrl.trim();
  await saveStoreConfigToServer(_storeManagerConfig);
  renderAdminCategories(_storeManagerConfig.categories);
  showToast('تم تحديث صورة القسم بنجاح!', 'success');
}

async function toggleCategoryVisibility(catId, isVisible) {
  const cat = (_storeManagerConfig.categories || []).find(c => String(c.id) === String(catId));
  if (!cat) return;
  cat.isVisible = Boolean(isVisible);
  await saveStoreConfigToServer(_storeManagerConfig);
  renderAdminCategories(_storeManagerConfig.categories);
  showToast('تم تحديث حالة عرض القسم', 'info');
}

async function openAddCategoryModal() {
  const name = prompt('أدخل اسم القسم الجديد:');
  if (!name || !name.trim()) return;
  const image = prompt('أدخل رابط صورة القسم (اختياري):', 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500');

  const newCat = {
    id: 'cat_' + Date.now(),
    name: name.trim(),
    image: image ? image.trim() : '',
    isVisible: true,
    sortOrder: (_storeManagerConfig.categories || []).length + 1
  };

  if (!_storeManagerConfig.categories) _storeManagerConfig.categories = [];
  _storeManagerConfig.categories.push(newCat);
  await saveStoreConfigToServer(_storeManagerConfig);
  renderAdminCategories(_storeManagerConfig.categories);
  showToast('تمت إضافة القسم الجديد بنجاح!', 'success');
}

// ----------------------------------------------------------------
// Brands Management
// ----------------------------------------------------------------
function renderAdminBrands(brands) {
  const container = document.getElementById('adminBrandsGrid');
  if (!container) return;

  container.innerHTML = brands.map(b => {
    const isVisible = b.isVisible !== false;
    const logoImg = b.logo ? \`<img src="\${escapeHtml(b.logo)}" alt="" style="width:36px; height:36px; object-fit:contain; border-radius:6px;">\` : '🏷️';

    return \`
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem; display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
        <div style="display:flex; align-items:center; gap:0.65rem;">
          \${logoImg}
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:#0f172a;">\${escapeHtml(b.name)}</div>
            <div style="font-size:0.75rem; color:\${isVisible ? '#15803d' : '#b91c1c'}; font-weight:700;">
              \${isVisible ? 'معروضة ✓' : 'مخفية ✕'}
            </div>
          </div>
        </div>

        <div style="display:flex; gap:0.35rem;">
          <button type="button" class="btn btn-sm btn-secondary" onclick="editBrandLogo('\${escapeJsStr(b.id)}')" title="تغيير الشعار">🖼️</button>
          <button type="button" class="btn btn-sm \${isVisible ? 'btn-warning' : 'btn-success'}" onclick="toggleBrandVisibility('\${escapeJsStr(b.id)}', \${!isVisible})">
            \${isVisible ? 'إخفاء' : 'إظهار'}
          </button>
        </div>
      </div>
    \`;
  }).join('');
}

async function editBrandLogo(brandId) {
  const b = (_storeManagerConfig.brands || []).find(x => String(x.id) === String(brandId));
  if (!b) return;

  const newLogo = prompt('أدخل رابط شعار الماركة (' + b.name + '):', b.logo || '');
  if (newLogo === null) return;
  b.logo = newLogo.trim();
  await saveStoreConfigToServer(_storeManagerConfig);
  renderAdminBrands(_storeManagerConfig.brands);
  showToast('تم تحديث شعار الماركة بنجاح!', 'success');
}

async function toggleBrandVisibility(brandId, isVisible) {
  const b = (_storeManagerConfig.brands || []).find(x => String(x.id) === String(brandId));
  if (!b) return;
  b.isVisible = Boolean(isVisible);
  await saveStoreConfigToServer(_storeManagerConfig);
  renderAdminBrands(_storeManagerConfig.brands);
  showToast('تم تحديث حالة الماركة', 'info');
}

async function openAddBrandModal() {
  const name = prompt('أدخل اسم الماركة الجديدة:');
  if (!name || !name.trim()) return;
  const logo = prompt('أدخل رابط شعار الماركة (اختياري):', '');

  const newBrand = {
    id: 'brand_' + Date.now(),
    name: name.trim(),
    logo: logo ? logo.trim() : '',
    isVisible: true,
    sortOrder: (_storeManagerConfig.brands || []).length + 1
  };

  if (!_storeManagerConfig.brands) _storeManagerConfig.brands = [];
  _storeManagerConfig.brands.push(newBrand);
  await saveStoreConfigToServer(_storeManagerConfig);
  renderAdminBrands(_storeManagerConfig.brands);
  showToast('تمت إضافة الماركة بنجاح!', 'success');
}

// ----------------------------------------------------------------
// Offers & Popup Settings
// ----------------------------------------------------------------
function renderAdminOffers(offers) {
  const container = document.getElementById('adminOffersListWrap');
  if (!container) return;

  container.innerHTML = offers.map(o => {
    const img = o.image || 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=500';
    return \`
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; display:flex; flex-direction:column;">
        <img src="\${escapeHtml(img)}" alt="" style="width:100%; height:130px; object-fit:cover;">
        <div style="padding:1rem; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <span style="background:#fef2f2; color:#dc2626; font-size:0.75rem; font-weight:800; padding:2px 7px; border-radius:4px;">\${escapeHtml(o.badge || 'عرض خاص')}</span>
            <h4 style="margin:0.5rem 0 0.25rem; font-weight:800; color:#0f172a;">\${escapeHtml(o.title)}</h4>
            <p style="font-size:0.85rem; color:#64748b; margin:0 0 0.5rem;">\${escapeHtml(o.subtitle || '')}</p>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:0.5rem;">
            <span style="font-size:0.8rem; color:#2563eb; font-weight:700;">قسم: \${escapeHtml(o.linkCategory || 'عام')}</span>
            <button type="button" class="btn btn-sm btn-danger" onclick="deleteAdminOffer('\${escapeJsStr(o.id)}')">🗑️ حذف</button>
          </div>
        </div>
      </div>
    \`;
  }).join('');
}

async function openAddOfferModal() {
  const title = prompt('أدخل عنوان العرض الترويجي:');
  if (!title || !title.trim()) return;
  const subtitle = prompt('أدخل النص التوضيحي للعرض:', 'حسومات وعروض حصرية');
  const image = prompt('أدخل رابط صورة العرض:', 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=800');
  const badge = prompt('أدخل شارة العرض (Badge):', '🔥 عرض مميز');
  const linkCategory = prompt('أدخل اسم القسم المرتبط بالعرض (اختياري):', 'غسالات');

  const newOffer = {
    id: 'offer_' + Date.now(),
    title: title.trim(),
    subtitle: subtitle ? subtitle.trim() : '',
    image: image ? image.trim() : '',
    badge: badge ? badge.trim() : 'عرض خاص',
    linkCategory: linkCategory ? linkCategory.trim() : '',
    isVisible: true,
    sortOrder: (_storeManagerConfig.offers || []).length + 1
  };

  if (!_storeManagerConfig.offers) _storeManagerConfig.offers = [];
  _storeManagerConfig.offers.push(newOffer);
  await saveStoreConfigToServer(_storeManagerConfig);
  renderAdminOffers(_storeManagerConfig.offers);
  showToast('تمت إضافة بطاقة العرض بنجاح!', 'success');
}

async function deleteAdminOffer(offerId) {
  if (!confirm('هل تريد حذف بطاقة العرض هذه؟')) return;
  _storeManagerConfig.offers = (_storeManagerConfig.offers || []).filter(o => String(o.id) !== String(offerId));
  await saveStoreConfigToServer(_storeManagerConfig);
  renderAdminOffers(_storeManagerConfig.offers);
  showToast('تم حذف بطاقة العرض', 'info');
}

async function saveAdminPopupSettings() {
  if (!_storeManagerConfig) _storeManagerConfig = {};
  _storeManagerConfig.popupOffer = {
    enabled: document.getElementById('adminPopupEnabled').checked,
    title: (document.getElementById('adminPopupTitle').value || '').trim(),
    subtitle: (document.getElementById('adminPopupSubtitle').value || '').trim(),
    badge: (document.getElementById('adminPopupBadge').value || '').trim(),
    image: (document.getElementById('adminPopupImage').value || '').trim(),
    buttonText: (document.getElementById('adminPopupButtonText').value || '').trim(),
    buttonLink: '#categoriesSection'
  };

  await saveStoreConfigToServer(_storeManagerConfig);
  showToast('تم حفظ ونشر إعدادات النافذة المنبثقة بنجاح!', 'success');
}

// ----------------------------------------------------------------
// Product Names & Out-of-Stock Manual Overrides
// ----------------------------------------------------------------
async function loadStoreProductsForTable() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      _storeManagerAllProducts = data.products || [];
      searchStoreProductsTable();
    }
  } catch (err) {
    console.error('Error loading products for store table:', err);
  }
}

function searchStoreProductsTable() {
  const tbody = document.getElementById('storeProductsTableBody');
  if (!tbody) return;

  const q = (document.getElementById('storeProductSearchInput')?.value || '').trim().toLowerCase();
  const onlyOut = document.getElementById('filterOnlyOutOfStock')?.checked;

  const customNames = (_storeManagerConfig && _storeManagerConfig.customProductNames) || {};
  const manualShown = new Set(((_storeManagerConfig && _storeManagerConfig.manuallyShownOutOfStock) || []).map(String));

  let filtered = _storeManagerAllProducts;

  if (onlyOut) {
    filtered = filtered.filter(p => (parseInt(p.stock) || 0) <= 0);
  }

  if (q) {
    filtered = filtered.filter(p => {
      const hay = \`\${p.name || ''} \${p.code || ''} \${p.brand || ''} \${p.category || ''}\`.toLowerCase();
      return hay.includes(q);
    });
  }

  // Display top 80 products for great performance
  const displaySlice = filtered.slice(0, 80);

  if (displaySlice.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#64748b;">لا توجد أصناف تطابق البحث</td></tr>';
    return;
  }

  tbody.innerHTML = displaySlice.map(p => {
    const pId = String(p.id);
    const customName = customNames[pId] || '';
    const stock = parseInt(p.stock) || 0;
    const isManualShow = manualShown.has(pId);
    const stockBadge = stock > 0 
      ? \`<span style="color:#15803d; font-weight:800;">\${stock} (متوفر)</span>\`
      : \`<span style="color:#b91c1c; font-weight:800;">0 (نفد المخزون)</span>\`;

    return \`
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="font-family:var(--font-num, monospace); font-weight:700;">\${escapeHtml(p.code || '--')}</td>
        <td style="font-size:0.85rem; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="\${escapeHtml(p.name)}">
          \${escapeHtml(p.name)}
        </td>
        <td>
          <input type="text" id="custNameInput_\${pId}" class="form-control form-control-sm" value="\${escapeHtml(customName)}" placeholder="الاسم الذي يظهر للزبون..." style="width:200px; font-weight:700;">
        </td>
        <td>\${escapeHtml(p.brand || '--')}</td>
        <td style="font-size:0.85rem;">\${escapeHtml(p.category || '--')}</td>
        <td style="font-weight:800;">\${(parseFloat(p.sellPrice) || 0).toLocaleString('en-US')} ₪</td>
        <td>\${stockBadge}</td>
        <td style="text-align:center;">
          <input type="checkbox" id="chkManualShow_\${pId}" \${isManualShow ? 'checked' : ''} onchange="toggleProductManualShow('\${pId}', this)" style="width:18px; height:18px; cursor:pointer;" title="إظهار هذا الصنف بالمتجر حتى لو نفد المخزون">
        </td>
        <td>
          <button type="button" class="btn btn-sm btn-primary" onclick="saveProductCustomName('\${pId}')" style="font-weight:700; padding:0.25rem 0.6rem;">
            💾 حفظ
          </button>
        </td>
      </tr>
    \`;
  }).join('');
}

async function saveProductCustomName(productId) {
  const input = document.getElementById('custNameInput_' + productId);
  if (!input) return;
  const customName = input.value.trim();

  try {
    const res = await fetch('/api/admin/store/custom-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, customName })
    });
    const data = await res.json();
    if (data.success) {
      if (!_storeManagerConfig.customProductNames) _storeManagerConfig.customProductNames = {};
      _storeManagerConfig.customProductNames = data.customProductNames;
      showToast('تم حفظ الاسم المخصص للصنف بنجاح!', 'success');
    }
  } catch (err) {
    showToast('خطأ: ' + err.message, 'error');
  }
}

async function toggleProductManualShow(productId, checkbox) {
  const forceShow = checkbox.checked;
  try {
    const res = await fetch('/api/admin/store/toggle-manual-show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, forceShow })
    });
    const data = await res.json();
    if (data.success) {
      _storeManagerConfig.manuallyShownOutOfStock = data.manuallyShownOutOfStock;
      showToast(forceShow ? 'تم تفعيل ظهور الصنف بالمتجر' : 'تم إلغاء الظهور اليدوي للصنف', 'info');
    }
  } catch (err) {
    showToast('خطأ: ' + err.message, 'error');
  }
}

// ----------------------------------------------------------------
// General Store Settings (Hero, Contact, Ticker)
// ----------------------------------------------------------------
function populateStoreSettingsForm(config) {
  const s = config.storeSettings || {};
  const p = config.popupOffer || {};

  // Settings
  if (document.getElementById('adminHeroTitle')) document.getElementById('adminHeroTitle').value = s.heroTitle || '';
  if (document.getElementById('adminHeroSubtitle')) document.getElementById('adminHeroSubtitle').value = s.heroSubtitle || '';
  if (document.getElementById('adminHeroBadge')) document.getElementById('adminHeroBadge').value = s.heroBadge || '';
  if (document.getElementById('adminAnnouncementText')) document.getElementById('adminAnnouncementText').value = s.announcementText || '';
  if (document.getElementById('adminStorePhone')) document.getElementById('adminStorePhone').value = s.phone || '';
  if (document.getElementById('adminStoreWa')) document.getElementById('adminStoreWa').value = s.whatsapp || '';
  if (document.getElementById('adminStoreAddress')) document.getElementById('adminStoreAddress').value = s.address || '';
  if (document.getElementById('adminStoreWorkHours')) document.getElementById('adminStoreWorkHours').value = s.workHours || '';
  if (document.getElementById('adminStoreAboutText')) document.getElementById('adminStoreAboutText').value = s.aboutText || '';

  // Popup
  if (document.getElementById('adminPopupEnabled')) document.getElementById('adminPopupEnabled').checked = Boolean(p.enabled);
  if (document.getElementById('adminPopupTitle')) document.getElementById('adminPopupTitle').value = p.title || '';
  if (document.getElementById('adminPopupSubtitle')) document.getElementById('adminPopupSubtitle').value = p.subtitle || '';
  if (document.getElementById('adminPopupBadge')) document.getElementById('adminPopupBadge').value = p.badge || '';
  if (document.getElementById('adminPopupImage')) document.getElementById('adminPopupImage').value = p.image || '';
  if (document.getElementById('adminPopupButtonText')) document.getElementById('adminPopupButtonText').value = p.buttonText || '';
}

async function saveAdminGeneralStoreSettings() {
  if (!_storeManagerConfig) _storeManagerConfig = {};
  if (!_storeManagerConfig.storeSettings) _storeManagerConfig.storeSettings = {};

  _storeManagerConfig.storeSettings.heroTitle = (document.getElementById('adminHeroTitle').value || '').trim();
  _storeManagerConfig.storeSettings.heroSubtitle = (document.getElementById('adminHeroSubtitle').value || '').trim();
  _storeManagerConfig.storeSettings.heroBadge = (document.getElementById('adminHeroBadge').value || '').trim();
  _storeManagerConfig.storeSettings.announcementText = (document.getElementById('adminAnnouncementText').value || '').trim();
  _storeManagerConfig.storeSettings.phone = (document.getElementById('adminStorePhone').value || '').trim();
  _storeManagerConfig.storeSettings.whatsapp = (document.getElementById('adminStoreWa').value || '').trim();
  _storeManagerConfig.storeSettings.address = (document.getElementById('adminStoreAddress').value || '').trim();
  _storeManagerConfig.storeSettings.workHours = (document.getElementById('adminStoreWorkHours').value || '').trim();
  _storeManagerConfig.storeSettings.aboutText = (document.getElementById('adminStoreAboutText').value || '').trim();

  await saveStoreConfigToServer(_storeManagerConfig);
  showToast('تم حفظ ونشر إعدادات ونصوص المتجر بنجاح!', 'success');
}

async function saveStoreConfigToServer(config) {
  try {
    const res = await fetch('/api/admin/store-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (data.success) {
      _storeManagerConfig = data.config;
      return data.config;
    } else {
      throw new Error(data.error || 'فشل الحفظ');
    }
  } catch (err) {
    showToast('خطأ أثناء حفظ الإعدادات: ' + err.message, 'error');
    throw err;
  }
}

async function uploadStoreImage(inputEl, targetFieldId) {
  if (!inputEl.files || inputEl.files.length === 0) return;
  const file = inputEl.files[0];
  const formData = new FormData();
  formData.append('image', file);

  showToast('جاري رفع الصورة...', 'info');

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success && data.imageUrl) {
      const target = document.getElementById(targetFieldId);
      if (target) target.value = data.imageUrl;
      showToast('تم رفع الصورة بنجاح!', 'success');
    } else {
      showToast('فشل رفع الصورة: ' + (data.error || 'خطأ غير معروف'), 'error');
    }
  } catch (err) {
    showToast('خطأ أثناء رفع الصورة: ' + err.message, 'error');
  }
}
`;

if (!code.includes('function loadAdminStoreManager()')) {
  code += '\n\n' + storeManagerClientCode;
  console.log('✅ Injected Store Manager client code into app.js');
} else {
  console.log('ℹ️ app.js already contains Store Manager logic');
}

fs.writeFileSync(appJsPath, code, 'utf8');
console.log('✅ app.js patched successfully');
