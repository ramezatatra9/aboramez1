const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// 1. Ensure escapeJsStr is declared near the top (after escapeHtml)
if (!code.includes('function escapeJsStr(')) {
  const target = "function escapeHtml(str) {";
  const addition = `function escapeJsStr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\\\\/g, '\\\\\\\\')
    .replace(/'/g, "\\\\'")
    .replace(/"/g, '\\\\"')
    .replace(/\\n/g, '\\\\n')
    .replace(/\\r/g, '\\\\r');
}

function escapeHtml(str) {`;
  code = code.replace(target, addition);
  console.log('✅ Added escapeJsStr near top of app.js');
}

// 2. Add dedicated initialTab === 'store-manager' in initApp()
const targetInitApp = "  } else if (initialTab === 'dashboard') {\n    actuallySwitchTab('dashboard', false);\n    await loadDashboard();\n    Promise.allSettled([loadProducts(), loadInvoices(), loadReceipts(), loadCustomers()]).catch(() => {});";

const replacementInitApp = `  } else if (initialTab === 'dashboard') {
    actuallySwitchTab('dashboard', false);
    await loadDashboard();
    Promise.allSettled([loadProducts(), loadInvoices(), loadReceipts(), loadCustomers()]).catch(() => {});
  } else if (initialTab === 'store-manager') {
    actuallySwitchTab('store-manager', false);
    await loadAdminStoreManager();
    Promise.allSettled([loadProducts(), loadInvoices(), loadReceipts(), loadCustomers()]).catch(() => {});`;

if (!code.includes("initialTab === 'store-manager'")) {
  code = code.replace(targetInitApp, replacementInitApp);
  console.log('✅ Added store-manager branch in initApp()');
}

// 3. Update applySettingsToUI to support companyLogo
const targetApplySettings = "  const brandEl = document.getElementById('headerCompanyName');\n  if (brandEl) brandEl.textContent = companyName;";

const replacementApplySettings = `  const brandEl = document.getElementById('headerCompanyName');
  if (brandEl) brandEl.textContent = companyName;

  const brandIconEl = document.getElementById('adminHeaderBrandIcon');
  if (brandIconEl) {
    if (state.settings.companyLogo) {
      brandIconEl.innerHTML = '<img src="' + escapeHtml(state.settings.companyLogo) + '" alt="" style="max-height:36px; max-width:36px; object-fit:contain; border-radius:8px;">';
    } else {
      brandIconEl.textContent = '💼';
    }
  }

  const logoInput = document.getElementById('cfgCompanyLogo');
  if (logoInput) logoInput.value = state.settings.companyLogo || '';`;

if (!code.includes('adminHeaderBrandIcon')) {
  code = code.replace(targetApplySettings, replacementApplySettings);
  console.log('✅ Updated applySettingsToUI with companyLogo');
}

// 4. Update saveCompanySettings to save companyLogo
const targetSaveSettings = "  const previewBaseUrl = previewInput ? previewInput.value.trim() : '';";

const replacementSaveSettings = `  const previewBaseUrl = previewInput ? previewInput.value.trim() : '';
  const logoInput = document.getElementById('cfgCompanyLogo');
  const companyLogo = logoInput ? logoInput.value.trim() : '';`;

const targetSaveBody = "        previewBaseUrl\n      })";
const replacementSaveBody = "        previewBaseUrl,\n        companyLogo\n      })";

if (!code.includes('companyLogo = logoInput')) {
  code = code.replace(targetSaveSettings, replacementSaveSettings);
  code = code.replace(targetSaveBody, replacementSaveBody);
  console.log('✅ Updated saveCompanySettings with companyLogo');
}

// 5. Upgrade switchStoreSubtab & window bindings in Store Manager
const oldSwitchStoreTarget = "function switchStoreSubtab(subId) {";
const newSwitchStoreImplementation = `function switchStoreSubtab(subId) {
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

  // Ensure data is loaded
  if (!_storeManagerConfig) {
    loadAdminStoreManager().then(() => {
      refreshStoreSubtabContent(subId);
    });
    return;
  }

  refreshStoreSubtabContent(subId);
}

function refreshStoreSubtabContent(subId) {
  if (!_storeManagerConfig) return;
  if (subId === 'categories') {
    renderAdminCategories(_storeManagerConfig.categories || []);
  } else if (subId === 'brands') {
    renderAdminBrands(_storeManagerConfig.brands || []);
  } else if (subId === 'offers') {
    renderAdminOffers(_storeManagerConfig.offers || []);
  } else if (subId === 'products') {
    if (_storeManagerAllProducts.length === 0) {
      loadStoreProductsForTable();
    } else {
      searchStoreProductsTable();
    }
  } else if (subId === 'settings') {
    populateStoreSettingsForm(_storeManagerConfig);
  }
}
function _old_switchStoreSubtab(subId) {`;

if (code.includes(oldSwitchStoreTarget)) {
  code = code.replace(oldSwitchStoreTarget, newSwitchStoreImplementation);
  console.log('✅ Upgraded switchStoreSubtab with auto-load & auto-refresh');
}

// 6. Append explicit window bindings at the end of app.js
const windowBindings = `
// Expose all Store Manager functions globally to window
window.switchStoreSubtab = switchStoreSubtab;
window.loadAdminStoreManager = loadAdminStoreManager;
window.filterAdminOrdersTable = filterAdminOrdersTable;
window.viewAdminOrderDetails = viewAdminOrderDetails;
window.closeAdminOrderModal = closeAdminOrderModal;
window.approveAdminOrder = approveAdminOrder;
window.cancelAdminOrder = cancelAdminOrder;
window.editCategoryImage = editCategoryImage;
window.toggleCategoryVisibility = toggleCategoryVisibility;
window.openAddCategoryModal = openAddCategoryModal;
window.editBrandLogo = editBrandLogo;
window.toggleBrandVisibility = toggleBrandVisibility;
window.openAddBrandModal = openAddBrandModal;
window.openAddOfferModal = openAddOfferModal;
window.deleteAdminOffer = deleteAdminOffer;
window.saveAdminPopupSettings = saveAdminPopupSettings;
window.searchStoreProductsTable = searchStoreProductsTable;
window.saveProductCustomName = saveProductCustomName;
window.toggleProductManualShow = toggleProductManualShow;
window.saveAdminGeneralStoreSettings = saveAdminGeneralStoreSettings;
window.uploadStoreImage = uploadStoreImage;
window.escapeJsStr = escapeJsStr;
`;

if (!code.includes('window.switchStoreSubtab = switchStoreSubtab;')) {
  code += '\n' + windowBindings;
  console.log('✅ Added window bindings to app.js');
}

fs.writeFileSync(appJsPath, code, 'utf8');
console.log('✅ app.js successfully updated');
