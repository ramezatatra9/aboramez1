const fs = require('fs');
const path = require('path');

// 1. Update server.js
const serverPath = path.join(__dirname, '..', 'server.js');
let serverCode = fs.readFileSync(serverPath, 'utf8');

const targetServerCompany = `      company: {
        name: settings.companyName || 'شركة رامز عطاطرة',
        phone: (storeConfig.storeSettings && storeConfig.storeSettings.phone) || settings.companyPhone || '',
        whatsapp: (storeConfig.storeSettings && storeConfig.storeSettings.whatsapp) || settings.companyPhone || '',
        address: (storeConfig.storeSettings && storeConfig.storeSettings.address) || settings.companyAddress || '',
        currency: (storeConfig.storeSettings && storeConfig.storeSettings.currency) || settings.currency || 'شيكل'
      }`;

const replacementServerCompany = `      company: {
        name: settings.companyName || 'شركة رامز عطاطرة',
        phone: (storeConfig.storeSettings && storeConfig.storeSettings.phone) || settings.companyPhone || '',
        whatsapp: (storeConfig.storeSettings && storeConfig.storeSettings.whatsapp) || settings.companyPhone || '',
        address: (storeConfig.storeSettings && storeConfig.storeSettings.address) || settings.companyAddress || '',
        currency: (storeConfig.storeSettings && storeConfig.storeSettings.currency) || settings.currency || 'شيكل',
        logo: (storeConfig.storeSettings && storeConfig.storeSettings.companyLogo) || settings.companyLogo || ''
      }`;

if (serverCode.includes(targetServerCompany)) {
  serverCode = serverCode.replace(targetServerCompany, replacementServerCompany);
  fs.writeFileSync(serverPath, serverCode, 'utf8');
  console.log('✅ Updated company.logo in server.js');
}

// 2. Update store.html
const storeHtmlPath = path.join(__dirname, '..', 'public', 'store.html');
let storeHtml = fs.readFileSync(storeHtmlPath, 'utf8');

const targetStoreCompany = "document.title = `${name} | معرض ومتجر الأجهزة الكهربائية والمنزلية`;";
const replacementStoreCompany = `document.title = \`\${name} | معرض ومتجر الأجهزة الكهربائية والمنزلية\`;

      // Company Logo
      const logo = companySettings.logo || '';
      const brandIconBox = document.querySelector('.brand-icon-box');
      if (logo && brandIconBox) {
        brandIconBox.innerHTML = '<img src="' + escapeHtml(logo) + '" alt="' + escapeHtml(name) + '" style="width:100%; height:100%; object-fit:contain; border-radius:10px;">';
        brandIconBox.style.background = 'transparent';
        brandIconBox.style.boxShadow = 'none';
      }`;

if (storeHtml.includes(targetStoreCompany) && !storeHtml.includes('brandIconBox.innerHTML')) {
  storeHtml = storeHtml.replace(targetStoreCompany, replacementStoreCompany);
  fs.writeFileSync(storeHtmlPath, storeHtml, 'utf8');
  console.log('✅ Updated store.html with company logo display');
}

// 3. Update app.js for adminStoreLogo
const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const targetPopulateSettings = "if (document.getElementById('adminHeroTitle')) document.getElementById('adminHeroTitle').value = s.heroTitle || '';";
const replacementPopulateSettings = `if (document.getElementById('adminStoreLogo')) document.getElementById('adminStoreLogo').value = s.companyLogo || '';
  if (document.getElementById('adminHeroTitle')) document.getElementById('adminHeroTitle').value = s.heroTitle || '';`;

if (!appJs.includes("adminStoreLogo')) document.getElementById('adminStoreLogo').value")) {
  appJs = appJs.replace(targetPopulateSettings, replacementPopulateSettings);
  console.log('✅ Added adminStoreLogo to populateStoreSettingsForm in app.js');
}

const targetSaveStoreSettings = "_storeManagerConfig.storeSettings.heroTitle = (document.getElementById('adminHeroTitle').value || '').trim();";
const replacementSaveStoreSettings = `_storeManagerConfig.storeSettings.companyLogo = (document.getElementById('adminStoreLogo')?.value || '').trim();
  _storeManagerConfig.storeSettings.heroTitle = (document.getElementById('adminHeroTitle').value || '').trim();`;

if (!appJs.includes("_storeManagerConfig.storeSettings.companyLogo =")) {
  appJs = appJs.replace(targetSaveStoreSettings, replacementSaveStoreSettings);
  console.log('✅ Added adminStoreLogo to saveAdminGeneralStoreSettings in app.js');
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('✅ app.js saved');
