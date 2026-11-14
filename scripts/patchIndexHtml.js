const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Add nav button before settings button
const navTarget = '<button class="nav-tab-btn" data-tab="settings" id="tabBtnSettings">';
const navButton = `
        <button class="nav-tab-btn" data-tab="store-manager" id="tabBtnStoreManager">
          <span>🛍️</span>
          <span>إدارة المتجر والطلبات</span>
          <span class="badge" id="adminPendingOrdersBadge" style="display:none; background:#ef4444; color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:10px; margin-right:4px;">0</span>
        </button>
        `;

if (!html.includes('data-tab="store-manager"')) {
  if (html.includes(navTarget)) {
    html = html.replace(navTarget, navButton + '\n        ' + navTarget);
    console.log('✅ Added store-manager button to navbar');
  } else {
    console.error('❌ Could not find navTarget in index.html');
  }
} else {
  console.log('ℹ️ Navbar already contains store-manager');
}

// 2. Add #tab-store-manager before #tab-settings
const tabTarget = '<section id="tab-settings" class="tab-content">';
const tabStoreManagerHtml = `
    <!-- ======================================================= -->
    <!-- TAB: إدارة المتجر الإلكتروني والطلبات (Store Manager) -->
    <!-- ======================================================= -->
    <section id="tab-store-manager" class="tab-content">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color:#ffffff; padding:1.5rem 1.75rem; border-radius:16px; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
        <div>
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <span style="font-size:1.8rem;">🛍️</span>
            <h2 style="font-size:1.45rem; font-weight:900; margin:0;">إدارة المتجر الإلكتروني ومعرض الزبائن</h2>
          </div>
          <p style="color:#94a3b8; font-size:0.9rem; margin-top:0.35rem; margin-bottom:0;">
            تحكّم بالكامل في كل ما يراه الزبون: الأقسام والصور، الماركات، العروض، أسماء الأصناف، واعتماد الطلبات الإلكترونية.
          </p>
        </div>

        <div style="display:flex; align-items:center; gap:0.75rem;">
          <a href="/" target="_blank" style="background:#2563eb; color:#ffffff; text-decoration:none; padding:0.65rem 1.25rem; border-radius:10px; font-weight:800; font-size:0.9rem; display:inline-flex; align-items:center; gap:0.5rem; box-shadow:0 4px 12px rgba(37,99,235,0.4);">
            <span>🌐</span>
            <span>معاينة متجر الزبائن مباشرة</span>
          </a>
          <button type="button" onclick="loadAdminStoreManager()" style="background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.25); padding:0.65rem 1rem; border-radius:10px; font-weight:700; cursor:pointer;">
            🔄 تحديث
          </button>
        </div>
      </div>

      <!-- Store Sub-navigation -->
      <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem; overflow-x:auto; padding-bottom:0.5rem; border-bottom:1.5px solid var(--border);">
        <button type="button" class="btn store-subtab-btn active" id="subBtnOrders" onclick="switchStoreSubtab('orders')" style="padding:0.65rem 1.25rem; border-radius:10px; font-weight:800; font-size:0.92rem; border:1.5px solid #2563eb; background:#2563eb; color:#ffffff; cursor:pointer;">
          📦 الطلبات الإلكترونية الواردة <span id="storeSubOrdersCount" style="background:#ef4444; color:#fff; font-size:0.75rem; padding:2px 7px; border-radius:10px; margin-right:4px;">0</span>
        </button>
        <button type="button" class="btn store-subtab-btn" id="subBtnCategories" onclick="switchStoreSubtab('categories')" style="padding:0.65rem 1.25rem; border-radius:10px; font-weight:800; font-size:0.92rem; border:1.5px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">
          🏷️ أقسام المعرض والصور
        </button>
        <button type="button" class="btn store-subtab-btn" id="subBtnBrands" onclick="switchStoreSubtab('brands')" style="padding:0.65rem 1.25rem; border-radius:10px; font-weight:800; font-size:0.92rem; border:1.5px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">
          ⭐ العلامات التجارية (الماركات)
        </button>
        <button type="button" class="btn store-subtab-btn" id="subBtnOffers" onclick="switchStoreSubtab('offers')" style="padding:0.65rem 1.25rem; border-radius:10px; font-weight:800; font-size:0.92rem; border:1.5px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">
          🎁 العروض والنافذة المنبثقة (Popup)
        </button>
        <button type="button" class="btn store-subtab-btn" id="subBtnProducts" onclick="switchStoreSubtab('products')" style="padding:0.65rem 1.25rem; border-radius:10px; font-weight:800; font-size:0.92rem; border:1.5px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">
          📝 أسماء الأصناف والظهور بالمتجر
        </button>
        <button type="button" class="btn store-subtab-btn" id="subBtnSettings" onclick="switchStoreSubtab('settings')" style="padding:0.65rem 1.25rem; border-radius:10px; font-weight:800; font-size:0.92rem; border:1.5px solid #cbd5e1; background:#ffffff; color:#334155; cursor:pointer;">
          ⚙️ نصوص وبيانات المتجر
        </button>
      </div>

      <!-- 1. SUB-TAB: الطلبات الإلكترونية -->
      <div id="storePane-orders" class="store-pane">
        <div class="card" style="margin-bottom:1.5rem; padding:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <h3 style="margin:0; font-weight:800; color:#0f172a;">سجل طلبات الشراء الإلكترونية القادمة من المتجر</h3>
            <div style="display:flex; gap:0.5rem;">
              <select id="ordersStatusFilter" onchange="filterAdminOrdersTable()" style="padding:0.4rem 0.8rem; border-radius:8px; border:1px solid #cbd5e1; font-weight:700;">
                <option value="all">جميع الطلبات</option>
                <option value="pending" selected>قيد المراجعة فقط ⏳</option>
                <option value="approved">المعتمدة (تم خصم المخزون) ✅</option>
                <option value="cancelled">الملغية ✕</option>
              </select>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table" style="width:100%; text-align:right;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th>رقم الطلب</th>
                  <th>التاريخ والوقت</th>
                  <th>اسم المشتري</th>
                  <th>رقم الهاتف</th>
                  <th>المدينة / العنوان</th>
                  <th>عدد الأصناف</th>
                  <th>المجموع الكلي</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody id="adminOrdersTableBody">
                <tr><td colspan="9" style="text-align:center; padding:2rem; color:#64748b;">جاري تحميل الطلبات...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 2. SUB-TAB: أقسام المعرض -->
      <div id="storePane-categories" class="store-pane" style="display:none;">
        <div class="card" style="margin-bottom:1.5rem; padding:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 style="margin:0; font-weight:800; color:#0f172a;">أقسام المعرض الرئيسية وصورها</h3>
              <p style="color:#64748b; font-size:0.85rem; margin-top:2px; margin-bottom:0;">يمكنك تغيير صورة أي قسم، تفعيله أو إخفاؤه من المتجر العام.</p>
            </div>
            <button type="button" class="btn btn-primary" onclick="openAddCategoryModal()" style="font-weight:800;">
              ➕ إضافة قسم جديد
            </button>
          </div>

          <div id="adminCategoriesGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.25rem;">
            <!-- ديناميكي -->
          </div>
        </div>
      </div>

      <!-- 3. SUB-TAB: الماركات والعلامات التجارية -->
      <div id="storePane-brands" class="store-pane" style="display:none;">
        <div class="card" style="margin-bottom:1.5rem; padding:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 style="margin:0; font-weight:800; color:#0f172a;">العلامات التجارية المعتمدة في المتجر</h3>
              <p style="color:#64748b; font-size:0.85rem; margin-top:2px; margin-bottom:0;">تخصيص شعارات الماركات وتفعيل ظهورها في شريط الماركات.</p>
            </div>
            <button type="button" class="btn btn-primary" onclick="openAddBrandModal()" style="font-weight:800;">
              ➕ إضافة ماركة جديدة
            </button>
          </div>

          <div id="adminBrandsGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:1rem;">
            <!-- ديناميكي -->
          </div>
        </div>
      </div>

      <!-- 4. SUB-TAB: العروض والنافذة المنبثقة (Popup) -->
      <div id="storePane-offers" class="store-pane" style="display:none;">
        <!-- Popup Settings Card -->
        <div class="card" style="margin-bottom:1.5rem; padding:1.5rem;">
          <h3 style="margin-top:0; margin-bottom:1rem; font-weight:800; color:#0f172a; display:flex; align-items:center; gap:0.5rem;">
            <span>✨</span>
            <span>النافذة الترويجية المنبثقة للزوار (Popup Modal)</span>
          </h3>
          <p style="color:#64748b; font-size:0.88rem; margin-bottom:1.25rem;">
            تظهر هذه النافذة للزبائن عند فتح الموقع لتقديم عروض مميزة أو تنبيهات مهمة.
          </p>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
            <div>
              <label style="display:flex; align-items:center; gap:0.6rem; font-weight:800; cursor:pointer; margin-bottom:1rem;">
                <input type="checkbox" id="adminPopupEnabled" style="width:20px; height:20px;">
                <span>تفعيل النافذة المنبثقة الترويجية في المتجر ✅</span>
              </label>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700; font-size:0.85rem;">عنوان العرض الرئيسي:</label>
                <input type="text" id="adminPopupTitle" class="form-control" placeholder="مثال: 🎉 مرحباً بكم في المعرض والمتجر الرسمي!">
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700; font-size:0.85rem;">النص التوضيحي للعرض:</label>
                <textarea id="adminPopupSubtitle" class="form-control" rows="2" placeholder="تصفح أحدث الأجهزة والعروض الحصرية..."></textarea>
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700; font-size:0.85rem;">شارة العرض (Badge):</label>
                <input type="text" id="adminPopupBadge" class="form-control" placeholder="مثال: عرض خاص ومحدود">
              </div>
            </div>

            <div>
              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700; font-size:0.85rem;">رابط صورة العرض المنبثق:</label>
                <input type="text" id="adminPopupImage" class="form-control" placeholder="https://... أو /uploads/...">
                <div style="margin-top:0.5rem;">
                  <input type="file" id="popupImageFileInput" accept="image/*" style="display:none;" onchange="uploadStoreImage(this, 'adminPopupImage')">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('popupImageFileInput').click()">
                    📁 رفع صورة من الجهاز
                  </button>
                </div>
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700; font-size:0.85rem;">نص زر الإجراء:</label>
                <input type="text" id="adminPopupButtonText" class="form-control" placeholder="مثال: تصفّح أقسام المعرض الآن">
              </div>

              <div style="margin-top:1.5rem;">
                <button type="button" class="btn btn-success" onclick="saveAdminPopupSettings()" style="font-weight:800; padding:0.75rem 1.5rem;">
                  💾 حفظ إعدادات النافذة المنبثقة
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Offers Cards List -->
        <div class="card" style="margin-bottom:1.5rem; padding:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; font-weight:800; color:#0f172a;">بطاقات العروض الترويجية في الصفحة الرئيسية</h3>
            <button type="button" class="btn btn-primary" onclick="openAddOfferModal()" style="font-weight:800;">
              ➕ إضافة بطاقة عرض جديدة
            </button>
          </div>
          <div id="adminOffersListWrap" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
            <!-- ديناميكي -->
          </div>
        </div>
      </div>

      <!-- 5. SUB-TAB: أسماء الأصناف والظهور بالمتجر -->
      <div id="storePane-products" class="store-pane" style="display:none;">
        <div class="card" style="margin-bottom:1.5rem; padding:1.25rem;">
          <h3 style="margin-top:0; font-weight:800; color:#0f172a;">تخصيص أسماء الأصناف للزبائن وإدارة الظهور</h3>
          <p style="color:#64748b; font-size:0.88rem; margin-bottom:1rem;">
            • يمكنك كتابة اسم مخصص يظهر للزبون بالمتجر بدلاً من الاسم المحاسبي.<br>
            • يمكنك إظهار صنف نفد مخزونه يدويّاً إذا كنت ترغب في استقبال طلبات عليه.
          </p>

          <div style="display:flex; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
            <input type="text" id="storeProductSearchInput" placeholder="ابحث باسم الصنف، الكود، أو الماركة..." class="form-control" style="max-width:400px;" oninput="searchStoreProductsTable()">
            <label style="display:flex; align-items:center; gap:0.5rem; font-weight:700; cursor:pointer;">
              <input type="checkbox" id="filterOnlyOutOfStock" onchange="searchStoreProductsTable()">
              <span>عرض الأصناف غير المتوفرة فقط (مخزونها 0)</span>
            </label>
          </div>

          <div class="table-responsive" style="max-height:600px; overflow-y:auto;">
            <table class="data-table" style="width:100%; text-align:right;">
              <thead>
                <tr style="background:#f8fafc; position:sticky; top:0; z-index:2;">
                  <th>كود الصنف</th>
                  <th>الاسم المحاسبي الداخلي</th>
                  <th>الاسم المخصص للزبائن بالمتجر</th>
                  <th>الماركة</th>
                  <th>القسم</th>
                  <th>السعر</th>
                  <th>المخزون الحالي</th>
                  <th>إظهار حتى لو نفد المخزون</th>
                  <th>حفظ</th>
                </tr>
              </thead>
              <tbody id="storeProductsTableBody">
                <tr><td colspan="9" style="text-align:center; padding:2rem; color:#64748b;">جاري تحميل الأصناف...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 6. SUB-TAB: نصوص وبيانات المتجر العامة -->
      <div id="storePane-settings" class="store-pane" style="display:none;">
        <div class="card" style="margin-bottom:1.5rem; padding:1.5rem;">
          <h3 style="margin-top:0; margin-bottom:1.25rem; font-weight:800; color:#0f172a;">نصوص ومعلومات المتجر الرئيسي</h3>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
            <div>
              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">العنوان الرئيسي للهيرو (Hero Title):</label>
                <input type="text" id="adminHeroTitle" class="form-control" placeholder="كل ما يحتاجه بيتك، في مكان واحد.">
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">النص الفرعي للهيرو (Hero Subtitle):</label>
                <textarea id="adminHeroSubtitle" class="form-control" rows="3" placeholder="أفضل الأجهزة الكهربائية بأسعار معتمدة ومكفولة..."></textarea>
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">شارة الهيرو (Hero Badge):</label>
                <input type="text" id="adminHeroBadge" class="form-control" placeholder="🌟 المعرض التجاري المعتمد 2026">
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">نص شريط الإعلانات العلوي:</label>
                <input type="text" id="adminAnnouncementText" class="form-control" placeholder="🚚 توصيل سريع • 🛡️ بضاعة أصلية...">
              </div>
            </div>

            <div>
              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">رقم هاتف الاتصال المباشر:</label>
                <input type="text" id="adminStorePhone" class="form-control" placeholder="0599000000">
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">رقم واتساب المعتمد للطلبات:</label>
                <input type="text" id="adminStoreWa" class="form-control" placeholder="0599000000">
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">عنوان المعرض والمستودع:</label>
                <input type="text" id="adminStoreAddress" class="form-control" placeholder="جنين / يعبد - الشارع الرئيسي">
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">أوقات العمل وساعات الدوام:</label>
                <input type="text" id="adminStoreWorkHours" class="form-control" placeholder="يومياً من 8:00 صباحاً حتى 9:00 مساءً">
              </div>

              <div class="form-group" style="margin-bottom:0.85rem;">
                <label style="font-weight:700;">نبذة عن المعرض (في الفوتر):</label>
                <textarea id="adminStoreAboutText" class="form-control" rows="3" placeholder="المعرض المعتمد لتوفير كافة الأجهزة الكهربائية..."></textarea>
              </div>
            </div>
          </div>

          <div style="margin-top:1.5rem; border-top:1px solid #e2e8f0; padding-top:1.25rem;">
            <button type="button" class="btn btn-success" onclick="saveAdminGeneralStoreSettings()" style="font-weight:900; font-size:1rem; padding:0.85rem 2rem;">
              💾 حفظ ونشر كافة التعديلات في المتجر فوراً
            </button>
          </div>
        </div>
      </div>

    </section>

    <!-- Modal: View Order Details -->
    <div id="adminOrderDetailsModal" class="modal" style="display:none; align-items:center; justify-content:center;">
      <div class="modal-content" style="max-width:650px; width:90%; max-height:90vh; overflow-y:auto; border-radius:16px;">
        <div class="modal-header" style="background:#0f172a; color:#fff; border-radius:14px 14px 0 0; padding:1rem 1.25rem;">
          <h3 id="orderModalTitle" style="margin:0; font-size:1.2rem; font-weight:800;">تفاصيل الطلب الإلكتروني</h3>
          <button type="button" class="close-btn" onclick="closeAdminOrderModal()" style="color:#fff;">✕</button>
        </div>
        <div class="modal-body" id="orderModalBody" style="padding:1.5rem;">
          <!-- ديناميكي -->
        </div>
        <div class="modal-footer" id="orderModalFooter" style="padding:1rem 1.5rem; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
          <!-- ديناميكي -->
        </div>
      </div>
    </div>
`;

if (!html.includes('id="tab-store-manager"')) {
  if (html.includes(tabTarget)) {
    html = html.replace(tabTarget, tabStoreManagerHtml + '\n    ' + tabTarget);
    console.log('✅ Injected tab-store-manager into index.html');
  } else {
    console.error('❌ Could not find tabTarget in index.html');
  }
} else {
  console.log('ℹ️ tab-store-manager already in index.html');
}

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log('✅ index.html updated successfully');
