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
  activeMainCategory: 'all', // 'all' | 'أجهزة كهربائية كبيرة' | 'أدوات مطبخ' | 'أدوات منزل' | 'أدوات شخصية' | 'أخرى'
  activeCategory: 'all',     // التصنيف الفرعي أو 'all'
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
  inventoryQuickFilter: 'all', // 'all' | 'modified' | 'zero' | 'low'
  inventoryPendingUpdates: new Map(), // productId -> newStock
  inventoryPageSize: 40,
  inventoryCurrentPage: 1
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
  }

  // إعداد التنقل بين التبويبات
  setupNavigation();

  // إعداد البحث
  setupSearchListeners();

  // جلب البيانات من الخادم
  await loadSettings();
  await loadProducts();
  await loadInvoices();
  await loadReceipts();
  await loadDashboard();
}

// -------------------------------------------------------------
// إدارة التبويبات والتاريخ
// -------------------------------------------------------------
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
    loadProducts().then(() => renderCatalog());
  } else if (tabId === 'create-invoice') {
    updateInvoiceDropdown();
  } else if (tabId === 'receipts') {
    loadReceipts();
    const lastEmp = localStorage.getItem('last_employee_name');
    const rcpEmp = document.getElementById('rcpEmployeeName');
    if (lastEmp && rcpEmp && !rcpEmp.value) rcpEmp.value = lastEmp;
  } else if (tabId === 'inventory') {
    loadProducts().then(() => renderInventoryList());
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
      renderCatalog();
      updateCategoryChips();
      updateInvoiceDropdown();
    }
  } catch (err) {
    console.error('فشل تحميل المنتجات:', err);
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

  // تصفية المنتجات بالتصنيف الرئيسي أولاً
  let filtered = state.products;

  if (state.activeMainCategory && state.activeMainCategory !== 'all') {
    filtered = filtered.filter(p => (p.mainCategory || 'أخرى') === state.activeMainCategory);
  }

  // ثم بالتصنيف الفرعي
  if (state.activeCategory && state.activeCategory !== 'all') {
    filtered = filtered.filter(p => p.category === state.activeCategory);
  }

  if (state.catalogSearch) {
    // عند البحث: نبحث في كل المنتجات بدون فلتر التصنيف
    filtered = state.products.filter(p => 
      (p.name && p.name.toLowerCase().includes(state.catalogSearch)) ||
      (p.code && p.code.toLowerCase().includes(state.catalogSearch)) ||
      (p.category && p.category.toLowerCase().includes(state.catalogSearch)) ||
      (p.mainCategory && p.mainCategory.toLowerCase().includes(state.catalogSearch))
    );
  }

  const totalCount = filtered.length;

  if (totalCount === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📦</div>
        <h3>لم يتم العثور على أي منتجات مطابقة</h3>
        <p>جرب البحث بكلمات أخرى أو أضف منتجاً جديداً للكتالوج</p>
      </div>
    `;
    return;
  }

  const displayedCount = state.catalogCurrentPage * state.catalogPageSize;
  const pageProducts = filtered.slice(0, displayedCount);

  let cardsHtml = pageProducts.map(prod => {
    const cost = parseFloat(prod.costPrice) || 0;
    const sell = parseFloat(prod.sellPrice) || 0;
    const profit = sell - cost;
    const profitMargin = sell > 0 ? ((profit / sell) * 100).toFixed(0) : 0;

    // فحص إن كان المنتج موجوداً بالسلة
    const cartItem = state.cart.find(item => item.productId === prod.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;

    const imageUrl = prod.image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80';

    return `
      <div class="product-card">
        <div class="product-img-wrapper">
          <img src="${imageUrl}" alt="${prod.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'">
          <span class="product-category-tag">${prod.category || 'عام'}</span>
          <span class="product-stock-tag">المتوفر: ${prod.stock ?? 0}</span>
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
              <button class="btn btn-primary btn-block" onclick="addToCart('${prod.id}')">
                <span>➕</span>
                <span>إضافة للفاتورة</span>
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
// إدارة سلة وإنشاء الفاتورة
// -------------------------------------------------------------
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
    select.innerHTML = '<option value="">-- أو اختر من قائمة المنتجات (' + state.products.length.toLocaleString('en-US') + ' صنف) --</option>' +
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
  // البحث بالكود أو الاسم أو جزء منهما
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
  renderCatalog();
  showToast(`تمت إضافة "${prod.name}" للفاتورة`, 'info');
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
  renderCatalog();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.productId !== productId);
  updateCartUI();
  renderCatalog();
}

function updateCartUI() {
  const tbody = document.getElementById('selectedItemsTableBody');
  const emptyMsg = document.getElementById('emptyCartMessage');
  const badge = document.getElementById('cartCountBadge');
  const currency = state.settings.currency || 'شيكل';

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
      const unitProfit = item.sellPrice - item.costPrice;
      const lineSell = item.sellPrice * item.quantity;
      const lineProfit = unitProfit * item.quantity;

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

function updateCartItemSellPrice(productId, newPrice) {
  const item = state.cart.find(i => i.productId === productId);
  if (!item) return;
  item.sellPrice = Math.max(0, newPrice);
  updateCartUI();
}

function updateInvoiceSummary() {
  const currency = state.settings.currency || 'شيكل';

  let totalQty = 0;
  let totalCost = 0;
  let totalAmount = 0;

  state.cart.forEach(item => {
    totalQty += item.quantity;
    totalCost += item.costPrice * item.quantity;
    totalAmount += item.sellPrice * item.quantity;
  });

  const totalProfit = totalAmount - totalCost;
  const profitMargin = totalAmount > 0 ? ((totalProfit / totalAmount) * 100).toFixed(1) : 0;

  // تحديث البطاقة الجانبية
  const elQty = document.getElementById('sumTotalQty');
  const elCost = document.getElementById('sumTotalCost');
  const elProfit = document.getElementById('sumTotalProfit');
  const elAmount = document.getElementById('sumTotalAmount');

  if (elQty) elQty.textContent = `${totalQty} قطعة`;
  if (elCost) elCost.textContent = `${totalCost.toLocaleString('en-US')} ${currency}`;
  if (elProfit) elProfit.textContent = `+${totalProfit.toLocaleString('en-US')} ${currency} (${profitMargin}%)`;
  if (elAmount) elAmount.textContent = `${totalAmount.toLocaleString('en-US')} ${currency}`;

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

  const payload = {
    employeeName,
    customerName,
    customerPhone,
    notes,
    items: state.cart,
    paymentMethod: state.currentPaymentMethod,
    installmentDetails
  };

  const btn = document.getElementById('btnSubmitInvoice');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span><span>جاري حفظ الفاتورة وإرسال الإشعار لتيليجرام...</span>';

  try {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.invoice) {
      showToast('🎉 تم إنشاء الفاتورة بنجاح!', 'success');

      // فحص نتيجة تيليجرام
      if (data.telegramNotification && data.telegramNotification.ok) {
        showToast('✈️ تم إرسال تفاصيل الفاتورة كاملة إلى تيليجرام بنجاح', 'success');
      } else if (data.invoice.telegramStatus && !data.invoice.telegramStatus.sent) {
        showToast(`⚠️ تنبيه تيليجرام: ${data.invoice.telegramStatus.error || 'لم يتم الإرسال'}`, 'warning');
      }

      // تفريغ السلة والمدخلات مع الإبقاء على اسم الموظف
      state.cart = [];
      updateCartUI();
      renderCatalog();
      document.getElementById('invCustomerName').value = '';
      document.getElementById('invCustomerPhone').value = '';
      document.getElementById('invNotes').value = '';
      if (document.getElementById('instDurationNumber')) document.getElementById('instDurationNumber').value = '';
      if (document.getElementById('instScheduleNotes')) document.getElementById('instScheduleNotes').value = '';
      if (document.getElementById('instDownPayment')) document.getElementById('instDownPayment').value = '0';
      selectPaymentMethod('cash');

      // تحديث السجل والمنتجات والمخزون والإحصائيات
      await loadProducts();
      renderCatalog();
      loadInvoices();
      loadDashboard();

      // فتح نافذة المعاينة والطباعة مباشرة للفاتورة الجديدة
      openInvoiceViewModal(data.invoice);

    } else {
      showToast(data.error || 'فشل حفظ الفاتورة', 'error');
    }
  } catch (err) {
    showToast('حدث خطأ أثناء الاتصال بالخادم', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🚀</span><span>إنشاء الفاتورة وإرسال لتيليجرام</span>';
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
  showToast('جاري إعادة إرسال الفاتورة لتيليجرام...', 'info');
  try {
    const res = await fetch(`/api/invoices/${invoiceId}/resend-telegram`, { method: 'POST' });
    const data = await res.json();
    if (data.success && data.result && data.result.ok) {
      showToast('✈️ تم إرسال الفاتورة بنجاح لتيليجرام!', 'success');
      await loadInvoices();
      const updated = state.invoices.find(i => i.id === invoiceId);
      if (updated && state.currentViewingInvoice && state.currentViewingInvoice.id === invoiceId) {
        state.currentViewingInvoice = updated;
      }
    } else {
      showToast(`فشل الإرسال: ${data.result?.error || data.error || 'خطأ غير معروف'}`, 'error');
    }
  } catch (err) {
    showToast('تعذر الاتصال بالخادم', 'error');
  }
}

// -------------------------------------------------------------
// لوحة الإحصائيات (Dashboard)
// -------------------------------------------------------------
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    if (data.success && data.stats) {
      const stats = data.stats;
      const currency = state.settings.currency || 'شيكل';

      document.getElementById('kpiTotalSales').textContent = `${(stats.totalSales || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('kpiTotalProfit').textContent = `+${(stats.totalProfit || 0).toLocaleString('en-US')} ${currency}`;
      document.getElementById('kpiTotalInvoices').textContent = `${stats.totalInvoicesCount || 0} فاتورة`;
      document.getElementById('kpiInstallmentsRemaining').textContent = `${(stats.installmentsRemaining || 0).toLocaleString('en-US')} ${currency}`;

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
// التنبيهات المنبثقة (Toast Notifications)
// -------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
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
      showToast(`تم إصدار سند القبض رقم #${data.receipt.receiptNumber} بنجاح`, 'success');
      state.receipts.unshift(data.receipt);
      renderReceiptsTable();
      resetReceiptForm();
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
  const lastEmp = localStorage.getItem('last_employee_name');
  if (lastEmp) {
    const empInput = document.getElementById('rcpEmployeeName');
    if (empInput) empInput.value = lastEmp;
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

  // تصفية المنتجات
  let filtered = state.products.filter(p => {
    // 1. فلتر البحث
    if (state.inventorySearch) {
      const q = state.inventorySearch;
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchCode = (p.code || '').toLowerCase().includes(q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      const matchMain = (p.mainCategory || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchCat && !matchMain) return false;
    }

    // 2. فلتر القسم الرئيسي
    if (state.inventoryCategory !== 'all') {
      const pMain = p.mainCategory || 'أخرى';
      if (pMain !== state.inventoryCategory) return false;
    }

    // 3. الفلتر السريع
    const currentStock = state.inventoryPendingUpdates.has(p.id)
      ? state.inventoryPendingUpdates.get(p.id)
      : (p.stock || 0);

    if (state.inventoryQuickFilter === 'modified') {
      return state.inventoryPendingUpdates.has(p.id);
    } else if (state.inventoryQuickFilter === 'zero') {
      return currentStock === 0;
    } else if (state.inventoryQuickFilter === 'low') {
      return currentStock > 0 && currentStock <= 3;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="background: white; border-radius: var(--radius-lg); padding: 3rem; border: 1px dashed var(--border-color);">
        <div class="empty-state-icon">🔍</div>
        <h3>لا توجد أصناف مطابقة للبحث أو الفلتر المحدد</h3>
        <p>جرب تغيير كلمات البحث أو اختيار تصنيف آخر</p>
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

  container.innerHTML = pageItems.map(p => {
    const isModified = state.inventoryPendingUpdates.has(p.id);
    const originalStock = p.stock || 0;
    const currentStock = isModified ? state.inventoryPendingUpdates.get(p.id) : originalStock;
    const delta = currentStock - originalStock;

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

    return `
      <div class="inventory-item-card ${isModified ? 'is-modified' : ''}" id="invCard-${p.id}">
        <!-- معلومات المنتج -->
        <div class="inv-prod-info">
          <div class="inv-prod-badges">
            <span class="inv-prod-code">🏷️ ${escapeHtml(p.code || 'PRD')}</span>
            <span class="inv-prod-category">${escapeHtml(p.mainCategory || 'عام')} ${p.category && p.category !== p.mainCategory ? `> ${escapeHtml(p.category)}` : ''}</span>
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

function resetInventoryChanges() {
  if (state.inventoryPendingUpdates.size === 0) {
    showToast('لا توجد تعديلات معلقة للتراجع عنها', 'info');
    return;
  }
  if (confirm(`هل أنت متأكد من إلغاء وتجاهل التعديلات على ${state.inventoryPendingUpdates.size} أصناف؟`)) {
    state.inventoryPendingUpdates.clear();
    renderInventoryList();
    showToast('تم التراجع عن التعديلات وإعادة الكميات الأصلية', 'info');
  }
}

async function saveInventoryBulkChanges() {
  if (state.inventoryPendingUpdates.size === 0) {
    showToast('لم يتم تعديل أي كميات لحفظها. قم بزيادة أو إنقاص كمية أي صنف أولاً.', 'warning');
    return;
  }

  const auditEmpInput = document.getElementById('invAuditEmployeeName');
  const editorName = (auditEmpInput ? auditEmpInput.value : '').trim();

  if (!editorName) {
    showToast('⚠️ يرجى إدخال اسم الموظف القائم بالجرد أولاً في الشريط الثابت لحفظ التعديلات وتوثيق العملية', 'error');
    if (auditEmpInput) auditEmpInput.focus();
    return;
  }

  // حفظ اسم الموظف في الذاكرة المحلية
  localStorage.setItem('last_employee_name', editorName);

  const saveBtn = document.getElementById('btnSaveInventory');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>⏳</span><span>جاري حفظ تعديلات الجرد في الخادم...</span>';
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
      updateInventoryFloatingBar(state.inventoryPendingUpdates.size);
    }
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
