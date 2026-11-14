const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Add id="adminHeaderBrandIcon" to brand-icon
html = html.replace('<div class="brand-icon">💼</div>', '<div class="brand-icon" id="adminHeaderBrandIcon">💼</div>');

// 2. Add cfgCompanyLogo to Settings form
const cfgNameTarget = `          <div class="form-group">
            <label class="form-label" for="cfgCompanyName">اسم الشركة أو المتجر:</label>
            <input type="text" id="cfgCompanyName" class="form-control" value="شركة الريان للأجهزة والتقنية">
          </div>`;

const cfgLogoField = `          <div class="form-group">
            <label class="form-label" for="cfgCompanyName">اسم الشركة أو المتجر:</label>
            <input type="text" id="cfgCompanyName" class="form-control" value="شركة الريان للأجهزة والتقنية">
          </div>

          <div class="form-group">
            <label class="form-label" for="cfgCompanyLogo">شعار الشركة الرسمي (يظهر في الهيدر والمتجر والفواتير):</label>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="text" id="cfgCompanyLogo" class="form-control" placeholder="https://... أو /uploads/...">
              <input type="file" id="companyLogoFileInput" accept="image/*" style="display:none;" onchange="uploadStoreImage(this, 'cfgCompanyLogo')">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('companyLogoFileInput').click()" style="white-space:nowrap; padding:0.6rem 1rem;">
                📁 رفع شعار
              </button>
            </div>
          </div>`;

if (!html.includes('id="cfgCompanyLogo"')) {
  if (html.includes(cfgNameTarget)) {
    html = html.replace(cfgNameTarget, cfgLogoField);
    console.log('✅ Added cfgCompanyLogo field to Settings in index.html');
  } else {
    console.warn('⚠️ Could not find exact cfgNameTarget in index.html');
  }
}

// 3. Add adminStoreLogo to Store Manager Settings in #storePane-settings
const storePhoneTarget = `<div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">رقم هاتف الاتصال المباشر:</label>`;

const storeLogoField = `<div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">شعار المتجر الرسمي (يظهر في هيدر وفوتر المتجر):</label>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                  <input type="text" id="adminStoreLogo" class="form-control" placeholder="https://... أو /uploads/...">
                  <input type="file" id="storeLogoFileInput" accept="image/*" style="display:none;" onchange="uploadStoreImage(this, 'adminStoreLogo')">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('storeLogoFileInput').click()" style="white-space:nowrap;">
                    📁 رفع شعار
                  </button>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">رقم هاتف الاتصال المباشر:</label>`;

if (!html.includes('id="adminStoreLogo"')) {
  if (html.includes(storePhoneTarget)) {
    html = html.replace(storePhoneTarget, storeLogoField);
    console.log('✅ Added adminStoreLogo field to Store Manager in index.html');
  }
}

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log('✅ index.html saved');
