/**
 * brandsAudit.js
 * نظام مراجعة وتصنيف الماركات وتوزيع الأصناف
 * معرض أبو رامز للأجهزة الكهربائية
 */

(function() {
  window.brandAuditState = {
    items: [],
    summary: {},
    duplicateBrands: [],
    brandStats: {},
    proposedBrandStats: {},
    filtered: [],
    currentPage: 1,
    pageSize: 30,
    selectedCodes: new Set(),
    filterStatus: 'candidate_change',
    filterCurrentBrand: 'all',
    filterProposedBrand: 'all',
    filterConfidence: 'all',
    searchTerm: '',
    isLoading: false,
    dictionary: [],
    quickEditItem: null
  };

  document.addEventListener('DOMContentLoaded', () => {
    // تحديث الشارة الأولية لعدد الأصناف المرشحة للتصحيح
    fetchBrandAuditSummaryOnly();
  });

  async function fetchBrandAuditSummaryOnly() {
    try {
      const res = await fetch('/api/brands-classification/audit');
      const data = await res.json();
      if (data.success && data.summary) {
        updateAuditBadge(data.summary.candidateChangeCount);
      }
    } catch (e) {
      console.warn('Initial brand audit summary check failed:', e);
    }
  }

  function updateAuditBadge(count) {
    const badge = document.getElementById('brandsAuditBadge');
    if (badge) {
      if (count > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = count;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  window.runBrandAudit = async function(force = false) {
    const s = window.brandAuditState;
    if (s.isLoading) return;
    s.isLoading = true;

    const indicator = document.getElementById('brandAuditStatusIndicator');
    if (indicator) indicator.style.display = 'inline-flex';

    try {
      const res = await fetch('/api/brands-classification/audit');
      const data = await res.json();
      if (!data.success) {
        showToast('⚠️ فشل تحليل وتدقيق الماركات: ' + (data.error || 'خطأ غير معروف'), 'error');
        return;
      }

      s.items = data.items || [];
      s.summary = data.summary || {};
      s.duplicateBrands = data.duplicateBrands || [];
      s.brandStats = data.brandStats || {};
      s.proposedBrandStats = data.proposedBrandStats || {};

      updateAuditBadge(s.summary.candidateChangeCount);
      renderKPIs();
      populateDropdownFilters();
      handleBrandAuditFilterChange();

      if (force) {
        showToast('✅ تم إعادة فحص وتدقيق الماركات بنجاح', 'success');
      }
    } catch (err) {
      console.error('runBrandAudit error:', err);
      showToast('❌ تعذر الاتصال بخادم فحص الماركات', 'error');
    } finally {
      s.isLoading = false;
      if (indicator) indicator.style.display = 'none';
    }
  };

  function renderKPIs() {
    const s = window.brandAuditState;
    const sm = s.summary;

    const elTotal = document.getElementById('kpiBrandTotalCount');
    const elCorrect = document.getElementById('kpiBrandCorrectCount');
    const elCand = document.getElementById('kpiBrandCandidateCount');
    const elRev = document.getElementById('kpiBrandReviewCount');
    const elOther = document.getElementById('kpiBrandOtherCount');
    const elDup = document.getElementById('kpiBrandDuplicateCount');

    if (elTotal) elTotal.textContent = (sm.totalProducts || 0).toLocaleString('en-US');
    if (elCorrect) elCorrect.textContent = (sm.correctCount || 0).toLocaleString('en-US');
    if (elCand) elCand.textContent = (sm.candidateChangeCount || 0).toLocaleString('en-US');
    if (elRev) elRev.textContent = (sm.needsReviewCount || 0).toLocaleString('en-US');
    if (elOther) elOther.textContent = (sm.otherUnassignedCount || 0).toLocaleString('en-US');
    if (elDup) elDup.textContent = (sm.duplicateBrandsCount || 0).toLocaleString('en-US');

    // تنبيه الماركات المكررة
    const dupAlert = document.getElementById('duplicateBrandsAlertArea');
    const dupText = document.getElementById('duplicateBrandsAlertText');
    if (dupAlert && dupText) {
      if (s.duplicateBrands.length > 0) {
        dupAlert.style.display = 'block';
        dupText.textContent = s.duplicateBrands.map(d => `${d.brand1} ↔ ${d.brand2}`).join(' ، ');
      } else {
        dupAlert.style.display = 'none';
      }
    }
  }

  function populateDropdownFilters() {
    const s = window.brandAuditState;
    const currSelect = document.getElementById('brandAuditCurrentBrandFilter');
    const propSelect = document.getElementById('brandAuditProposedBrandFilter');

    if (currSelect) {
      const currentSelected = currSelect.value || 'all';
      let html = '<option value="all">كل الماركات الحالية</option>';
      const sortedCurr = Object.keys(s.brandStats).sort();
      sortedCurr.forEach(b => {
        html += `<option value="${escapeHtml(b)}">${escapeHtml(b)} (${s.brandStats[b]})</option>`;
      });
      currSelect.innerHTML = html;
      currSelect.value = currentSelected;
    }

    if (propSelect) {
      const currentSelected = propSelect.value || 'all';
      let html = '<option value="all">كل الماركات المقترحة</option>';
      const sortedProp = Object.keys(s.proposedBrandStats).sort();
      sortedProp.forEach(b => {
        html += `<option value="${escapeHtml(b)}">${escapeHtml(b)} (${s.proposedBrandStats[b]})</option>`;
      });
      propSelect.innerHTML = html;
      propSelect.value = currentSelected;
    }
  }

  window.handleBrandAuditFilterChange = function() {
    const s = window.brandAuditState;
    const searchInput = document.getElementById('brandAuditSearchInput');
    const statusSelect = document.getElementById('brandAuditStatusFilter');
    const currSelect = document.getElementById('brandAuditCurrentBrandFilter');
    const propSelect = document.getElementById('brandAuditProposedBrandFilter');
    const confSelect = document.getElementById('brandAuditConfidenceFilter');

    s.searchTerm = (searchInput ? searchInput.value : '').trim().toLowerCase();
    s.filterStatus = statusSelect ? statusSelect.value : 'all';
    s.filterCurrentBrand = currSelect ? currSelect.value : 'all';
    s.filterProposedBrand = propSelect ? propSelect.value : 'all';
    s.filterConfidence = confSelect ? confSelect.value : 'all';

    s.filtered = s.items.filter(item => {
      // فلتر الحالة
      if (s.filterStatus !== 'all' && item.status !== s.filterStatus) {
        return false;
      }
      // فلتر الماركة الحالية
      if (s.filterCurrentBrand !== 'all' && (item.currentBrand || 'أخرى') !== s.filterCurrentBrand) {
        return false;
      }
      // فلتر الماركة المقترحة
      if (s.filterProposedBrand !== 'all' && (item.proposedBrand || 'أخرى') !== s.filterProposedBrand) {
        return false;
      }
      // فلتر مستوى الثقة
      if (s.filterConfidence !== 'all' && item.confidence !== s.filterConfidence) {
        return false;
      }
      // البحث النصي
      if (s.searchTerm) {
        const text = `${item.code} ${item.name} ${item.currentBrand} ${item.currentBrandAr} ${item.proposedBrand} ${item.proposedBrandAr} ${item.reason}`.toLowerCase();
        if (!text.includes(s.searchTerm)) {
          return false;
        }
      }
      return true;
    });

    s.currentPage = 1;
    renderBrandAuditTable();
  };

  function renderBrandAuditTable() {
    const s = window.brandAuditState;
    const tbody = document.getElementById('brandAuditTableBody');
    if (!tbody) return;

    if (s.filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
            <div style="font-size: 1rem; font-weight: 700;">لا توجد أصناف مطابقة للفلاتر المحددة</div>
            <div style="font-size: 0.85rem; margin-top: 0.25rem;">جرب تغيير فلتر الحالة أو مسح عبارة البحث</div>
          </td>
        </tr>
      `;
      updatePaginationControls(0, 0, 0);
      return;
    }

    const totalPages = Math.ceil(s.filtered.length / s.pageSize);
    if (s.currentPage > totalPages) s.currentPage = totalPages;
    const startIdx = (s.currentPage - 1) * s.pageSize;
    const pageItems = s.filtered.slice(startIdx, startIdx + s.pageSize);

    let html = '';
    pageItems.forEach(item => {
      const isSelected = s.selectedCodes.has(item.code);
      const isChange = item.status === 'candidate_change';
      const isReview = item.status === 'needs_review' || item.status === 'other_unassigned';

      let statusBadge = '';
      if (item.status === 'correct') {
        statusBadge = '<span class="badge" style="background: rgba(16,185,129,0.15); color: #10b981; font-weight: 700;">✅ صحيحة</span>';
      } else if (item.status === 'candidate_change') {
        statusBadge = '<span class="badge" style="background: rgba(59,130,246,0.15); color: #3b82f6; font-weight: 700;">⚡ مرشحة للتصحيح</span>';
      } else if (item.status === 'needs_review') {
        statusBadge = '<span class="badge" style="background: rgba(245,158,11,0.15); color: #f59e0b; font-weight: 700;">⚠️ مراجعة بشرية</span>';
      } else {
        statusBadge = '<span class="badge" style="background: rgba(148,163,184,0.15); color: var(--text-muted); font-weight: 700;">📦 ضمن أخرى</span>';
      }

      let confBadge = '';
      if (item.confidence === 'high') {
        confBadge = '<span style="color: #10b981; font-weight: 800; font-size: 0.8rem;">● عالية</span>';
      } else if (item.confidence === 'medium') {
        confBadge = '<span style="color: #f59e0b; font-weight: 800; font-size: 0.8rem;">▲ متوسطة</span>';
      } else {
        confBadge = '<span style="color: #ef4444; font-weight: 800; font-size: 0.8rem;">■ يدوية</span>';
      }

      let actionText = '';
      if (item.action === 'change') {
        actionText = '<span style="color: #2563eb; font-weight: 700;">تغيير الماركة</span>';
      } else if (item.action === 'keep') {
        actionText = '<span style="color: #10b981; font-weight: 700;">إبقاء الحالية</span>';
      } else {
        actionText = '<span style="color: #d97706; font-weight: 700;">مراجعة يدوية</span>';
      }

      const currDisplay = item.currentBrand === 'أخرى'
        ? '<span style="color: var(--text-muted); font-style: italic;">أخرى / غير محدد</span>'
        : `<strong>${escapeHtml(item.currentBrand)}</strong> <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.currentBrandAr || '')}</div>`;

      const propDisplay = item.proposedBrand === item.currentBrand
        ? '<span style="color: var(--text-muted); font-size: 0.85rem;">مطابقة للحالية</span>'
        : `<strong style="color: #15803d; font-size: 0.95rem;">${escapeHtml(item.proposedBrand)}</strong> <div style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">${escapeHtml(item.proposedBrandAr || '')}</div>`;

      html += `
        <tr style="border-bottom: 1px solid var(--border-color); ${isSelected ? 'background: rgba(59,130,246,0.06);' : ''}">
          <td style="text-align: center;">
            <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleBrandAuditSelect('${item.code}', this.checked)">
          </td>
          <td style="text-align: center; font-family: monospace; font-weight: 700; color: var(--primary-color);">
            ${escapeHtml(item.code)}
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.92rem;">${escapeHtml(item.name)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; gap: 0.5rem; align-items: center; margin-top: 2px;">
              <span>📁 ${escapeHtml(item.category || 'عام')}</span>
              ${item.distributorTag ? `<span class="badge" style="background: rgba(245,158,11,0.12); color: #d97706; font-size: 0.7rem;">موزع: ${escapeHtml(item.distributorTag)}</span>` : ''}
            </div>
          </td>
          <td style="text-align: center;">
            ${currDisplay}
          </td>
          <td style="text-align: center;">
            ${propDisplay}
          </td>
          <td style="font-size: 0.85rem; color: #374151; line-height: 1.4;">
            ${escapeHtml(item.reason)}
          </td>
          <td style="text-align: center;">
            ${confBadge}
          </td>
          <td style="text-align: center;">
            ${actionText}
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-xs btn-secondary" onclick="openBrandQuickEditModal('${item.code}')" title="تعديل الماركة يدوياً لهذا الصنف">
              ✏️ تعديل
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    updatePaginationControls(startIdx + 1, Math.min(startIdx + s.pageSize, s.filtered.length), s.filtered.length);
    updateSelectedCountBadge();
  }

  function updatePaginationControls(start, end, total) {
    const s = window.brandAuditState;
    const textEl = document.getElementById('brandAuditShowingCountText');
    const indEl = document.getElementById('brandAuditPageIndicator');
    const btnPrev = document.getElementById('btnBrandAuditPrevPage');
    const btnNext = document.getElementById('btnBrandAuditNextPage');

    if (textEl) {
      textEl.textContent = total > 0 ? `عرض ${start} - ${end} من أصل ${total} صنف` : 'لا توجد نتائج';
    }

    const totalPages = Math.max(1, Math.ceil(total / s.pageSize));
    if (indEl) indEl.textContent = `${s.currentPage} / ${totalPages}`;
    if (btnPrev) btnPrev.disabled = s.currentPage <= 1;
    if (btnNext) btnNext.disabled = s.currentPage >= totalPages;
  }

  window.changeBrandAuditPage = function(delta) {
    const s = window.brandAuditState;
    const totalPages = Math.ceil(s.filtered.length / s.pageSize);
    const target = s.currentPage + delta;
    if (target >= 1 && target <= totalPages) {
      s.currentPage = target;
      renderBrandAuditTable();
    }
  };

  window.toggleBrandAuditSelect = function(code, checked) {
    const s = window.brandAuditState;
    if (checked) {
      s.selectedCodes.add(code);
    } else {
      s.selectedCodes.delete(code);
    }
    updateSelectedCountBadge();
  };

  window.toggleBrandAuditSelectAll = function(checked) {
    const s = window.brandAuditState;
    s.filtered.forEach(i => {
      if (checked) s.selectedCodes.add(i.code);
      else s.selectedCodes.delete(i.code);
    });
    renderBrandAuditTable();
  };

  window.selectAllFilteredBrandAudit = function(selectAll) {
    const s = window.brandAuditState;
    s.filtered.forEach(i => {
      if (selectAll) s.selectedCodes.add(i.code);
      else s.selectedCodes.delete(i.code);
    });
    renderBrandAuditTable();
  };

  function updateSelectedCountBadge() {
    const s = window.brandAuditState;
    const badge = document.getElementById('selectedBrandsCountBadge');
    const btn = document.getElementById('btnApplySelectedBrands');
    const count = s.selectedCodes.size;

    if (badge) badge.textContent = count;
    if (btn) btn.disabled = count === 0;
  }

  // تطبيق التعديلات على الأصناف المحددة
  window.applySelectedBrandChanges = async function() {
    const s = window.brandAuditState;
    if (s.selectedCodes.size === 0) {
      showToast('⚠️ يرجى تحديد أصناف أولاً لتطبيق التغييرات عليها', 'warning');
      return;
    }

    const itemsToUpdate = [];
    s.selectedCodes.forEach(code => {
      const match = s.items.find(i => i.code === code);
      if (match && match.proposedBrand) {
        itemsToUpdate.push({
          code: match.code,
          proposedBrand: match.proposedBrand,
          proposedBrandAr: match.proposedBrandAr,
          reason: match.reason
        });
      }
    });

    if (itemsToUpdate.length === 0) {
      showToast('⚠️ لا توجد تعديلات صالحة للأصناف المحددة', 'warning');
      return;
    }

    const confirmMsg = `هل أنت متأكد من تطبيق تصحيح الماركة على (${itemsToUpdate.length}) صنف محدد؟\nسيتم حفظ نسخة احتياطية تلقائياً قبل التعديل.`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/brands-classification/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToUpdate, editorName: 'مدير النظام' })
      });
      const data = await res.json();
      if (!data.success) {
        showToast('❌ فشل التطبيق: ' + (data.error || 'خطأ غير معروف'), 'error');
        return;
      }

      showToast(`✅ تم بنجاح تصحيح ماركات ${data.updatedCount} صنف وحفظ نسخة احتياطية`, 'success');
      s.selectedCodes.clear();

      // إعادة تحميل الأصناف في الواجهة والمتجر
      if (typeof loadProducts === 'function') {
        await loadProducts();
        if (typeof renderBrandsRibbon === 'function') renderBrandsRibbon('catalog');
        if (typeof renderCatalog === 'function') renderCatalog();
      }

      // إعادة فحص التدقيق
      await runBrandAudit(false);
    } catch (err) {
      console.error('applySelectedBrandChanges error:', err);
      showToast('❌ تعذر إرسال طلب تصحيح الماركات', 'error');
    }
  };

  // تطبيق جميع التعديلات المؤكدة عالية الثقة
  window.applyAllHighConfidenceBrands = async function() {
    const s = window.brandAuditState;
    const highCount = s.items.filter(i => i.status === 'candidate_change' && i.confidence === 'high').length;

    if (highCount === 0) {
      showToast('ℹ️ لا توجد أصناف مرشحة عالية الثقة حالياً', 'info');
      return;
    }

    const confirmMsg = `هل تريد اعتماد وتطبيق تصحيح الماركات لجميع الأصناف المؤكدة عالية الثقة (${highCount} صنف)؟\n\n- سيتم تحديث علاقة كل صنف بماركته الفعلية الصحيحة.\n- سيتم إنشاء نسخة احتياطية كاملة وتوثيق التغييرات في سجل التدقيق.\n- يمكنك التراجع في أي وقت بنقرة زر.`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/brands-classification/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allHighConfidence: true, editorName: 'مدير النظام' })
      });
      const data = await res.json();
      if (!data.success) {
        showToast('❌ فشل التطبيق: ' + (data.error || 'خطأ غير معروف'), 'error');
        return;
      }

      showToast(`🎉 ممتاز! تم تصحيح ${data.updatedCount} صنف بنجاح تام وفق الماركات الصحيحة`, 'success');
      s.selectedCodes.clear();

      // إعادة تحميل المنتجات
      if (typeof loadProducts === 'function') {
        await loadProducts();
        if (typeof renderBrandsRibbon === 'function') renderBrandsRibbon('catalog');
        if (typeof renderCatalog === 'function') renderCatalog();
      }

      await runBrandAudit(false);
    } catch (err) {
      console.error('applyAllHighConfidenceBrands error:', err);
      showToast('❌ تعذر تطبيق التعديلات المؤكدة', 'error');
    }
  };

  // التراجع عن آخر تعديل
  window.rollbackLastBrandChange = async function() {
    if (!confirm('⚠️ هل أنت متأكد من التراجع عن آخر عملية تعديل واستعادة النسخة الاحتياطية السابقة؟')) {
      return;
    }

    try {
      const res = await fetch('/api/brands-classification/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!data.success) {
        showToast('❌ فشل التراجع: ' + (data.error || 'خطأ غير معروف'), 'error');
        return;
      }

      showToast(`⏪ ${data.message}`, 'success');

      if (typeof loadProducts === 'function') {
        await loadProducts();
        if (typeof renderBrandsRibbon === 'function') renderBrandsRibbon('catalog');
        if (typeof renderCatalog === 'function') renderCatalog();
      }

      await runBrandAudit(false);
    } catch (err) {
      console.error('rollbackLastBrandChange error:', err);
      showToast('❌ تعذر إرسال طلب التراجع', 'error');
    }
  };

  // تعديل ماركة الصنف يدوياً
  window.openBrandQuickEditModal = function(code) {
    const s = window.brandAuditState;
    const item = s.items.find(i => i.code === code);
    if (!item) return;
    s.quickEditItem = item;

    const modal = document.getElementById('brandQuickEditModal');
    const nameEl = document.getElementById('brandQuickEditItemName');
    const codeEl = document.getElementById('brandQuickEditItemCode');
    const currEl = document.getElementById('brandQuickEditCurrentBrand');
    const selectEl = document.getElementById('brandQuickEditNewBrandSelect');

    if (nameEl) nameEl.textContent = item.name;
    if (codeEl) codeEl.textContent = item.code;
    if (currEl) currEl.textContent = `${item.currentBrand} (${item.currentBrandAr || ''})`;

    if (selectEl) {
      let html = '<option value="">-- اختر ماركة من القائمة --</option>';
      const allDict = s.dictionary && s.dictionary.length > 0 ? s.dictionary : (typeof BRAND_DEFS !== 'undefined' ? BRAND_DEFS : []);
      allDict.forEach(b => {
        const isSelected = (item.proposedBrand && item.proposedBrand === (b.key || b.brand));
        html += `<option value="${escapeHtml(b.key || b.brand)}" data-ar="${escapeHtml(b.nameAr || b.brandAr)}" ${isSelected ? 'selected' : ''}>${escapeHtml(b.key || b.brand)} - ${escapeHtml(b.nameAr || b.brandAr)}</option>`;
      });
      html += '<option value="أخرى" data-ar="أخرى / عام">أخرى / عام</option>';
      selectEl.innerHTML = html;
    }

    if (modal) modal.style.display = 'flex';
  };

  window.closeBrandQuickEditModal = function() {
    const modal = document.getElementById('brandQuickEditModal');
    if (modal) modal.style.display = 'none';
    window.brandAuditState.quickEditItem = null;
  };

  window.saveBrandQuickEdit = async function() {
    const s = window.brandAuditState;
    const item = s.quickEditItem;
    if (!item) return;

    const selectEl = document.getElementById('brandQuickEditNewBrandSelect');
    if (!selectEl || !selectEl.value) {
      showToast('⚠️ يرجى اختيار ماركة للحفظ', 'warning');
      return;
    }

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const newBrand = selectEl.value;
    const newBrandAr = selectedOption ? selectedOption.getAttribute('data-ar') || newBrand : newBrand;

    try {
      const res = await fetch('/api/brands-classification/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            code: item.code,
            proposedBrand: newBrand,
            proposedBrandAr: newBrandAr,
            reason: 'تعديل يدوي من قِبل المسؤول'
          }],
          editorName: 'تعديل يدوي'
        })
      });
      const data = await res.json();
      if (!data.success) {
        showToast('❌ فشل تعديل الماركة: ' + data.error, 'error');
        return;
      }

      showToast(`✅ تم تعديل ماركة الصنف [${item.code}] إلى "${newBrand}" بنجاح`, 'success');
      closeBrandQuickEditModal();

      if (typeof loadProducts === 'function') {
        await loadProducts();
        if (typeof renderBrandsRibbon === 'function') renderBrandsRibbon('catalog');
        if (typeof renderCatalog === 'function') renderCatalog();
      }

      await runBrandAudit(false);
    } catch (err) {
      showToast('❌ تعذر حفظ الماركة', 'error');
    }
  };

  // إدارة قاموس الماركات
  window.openBrandsDictionaryModal = async function() {
    const modal = document.getElementById('brandsDictionaryModal');
    if (modal) modal.style.display = 'flex';

    try {
      const res = await fetch('/api/brands-classification/dictionary');
      const data = await res.json();
      if (data.success && Array.isArray(data.dictionary)) {
        window.brandAuditState.dictionary = data.dictionary;
        renderDictionaryTable(data.dictionary);
      }
    } catch (e) {
      console.error('Failed to load dictionary:', e);
    }
  };

  window.closeBrandsDictionaryModal = function() {
    const modal = document.getElementById('brandsDictionaryModal');
    if (modal) modal.style.display = 'none';
  };

  function renderDictionaryTable(dict) {
    const tbody = document.getElementById('brandsDictionaryTableBody');
    if (!tbody) return;

    let html = '';
    dict.forEach((b, idx) => {
      html += `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="font-weight: 800; color: var(--primary-color);">${b.icon || '🏷️'} ${escapeHtml(b.key)}</td>
          <td style="font-weight: 700;">${escapeHtml(b.nameAr)}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml((b.aliases || []).join(' ، '))}</td>
          <td style="font-size: 0.8rem; font-family: monospace;">${escapeHtml((b.modelPrefixes || []).join(' ، '))}</td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-xs btn-danger" onclick="removeBrandFromDictionary(${idx})" title="حذف من القاموس">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  window.addNewBrandToDictionary = async function() {
    const key = (document.getElementById('dictNewKey') ? document.getElementById('dictNewKey').value : '').trim();
    const nameAr = (document.getElementById('dictNewNameAr') ? document.getElementById('dictNewNameAr').value : '').trim();
    const aliasesRaw = (document.getElementById('dictNewAliases') ? document.getElementById('dictNewAliases').value : '').trim();
    const prefixesRaw = (document.getElementById('dictNewPrefixes') ? document.getElementById('dictNewPrefixes').value : '').trim();

    if (!key || !nameAr) {
      showToast('⚠️ يرجى إدخال اسم الماركة بالإنجليزية والعربية', 'warning');
      return;
    }

    const aliases = aliasesRaw ? aliasesRaw.split(',').map(s => s.trim()).filter(Boolean) : [key, nameAr];
    const modelPrefixes = prefixesRaw ? prefixesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const s = window.brandAuditState;
    s.dictionary.push({
      key,
      nameAr,
      aliases,
      modelPrefixes,
      icon: '🏷️'
    });

    try {
      const res = await fetch('/api/brands-classification/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dictionary: s.dictionary })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ تم إضافة ماركة "${key}" إلى القاموس بنجاح`, 'success');
        renderDictionaryTable(s.dictionary);
        // مسح الحقول
        document.getElementById('dictNewKey').value = '';
        document.getElementById('dictNewNameAr').value = '';
        document.getElementById('dictNewAliases').value = '';
        document.getElementById('dictNewPrefixes').value = '';
      }
    } catch (e) {
      showToast('❌ تعذر حفظ الماركة بالقاموس', 'error');
    }
  };

  window.removeBrandFromDictionary = async function(idx) {
    const s = window.brandAuditState;
    if (idx < 0 || idx >= s.dictionary.length) return;
    const item = s.dictionary[idx];
    if (!confirm(`هل تريد بالتأكيد إزالة ماركة "${item.key}" من القاموس؟`)) return;

    s.dictionary.splice(idx, 1);
    try {
      await fetch('/api/brands-classification/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dictionary: s.dictionary })
      });
      showToast(`تم إزالة "${item.key}" من القاموس`, 'info');
      renderDictionaryTable(s.dictionary);
    } catch (e) {
      showToast('فشل حفظ القاموس', 'error');
    }
  };

  // سجل التدقيق والتاريخ
  window.openBrandAuditLogsModal = async function() {
    const modal = document.getElementById('brandAuditLogsModal');
    if (modal) modal.style.display = 'flex';

    const tbody = document.getElementById('brandAuditLogsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1.5rem;">جاري جلب السجل...</td></tr>';

    try {
      const res = await fetch('/api/brands-classification/logs');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        renderAuditLogsTable(data.logs);
      }
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">فشل جلب السجل</td></tr>';
    }
  };

  window.closeBrandAuditLogsModal = function() {
    const modal = document.getElementById('brandAuditLogsModal');
    if (modal) modal.style.display = 'none';
  };

  function renderAuditLogsTable(logs) {
    const tbody = document.getElementById('brandAuditLogsTableBody');
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">لا توجد تعديلات مسجلة بعد</td></tr>';
      return;
    }

    let html = '';
    logs.forEach(log => {
      const timeStr = log.changedAt || log.timestamp || '';
      const formattedTime = timeStr ? new Date(timeStr).toLocaleString('ar-EG') : '';

      html += `
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
          <td style="color: var(--text-muted); font-size: 0.78rem;">${formattedTime}</td>
          <td style="font-weight: 700; font-family: monospace;">${escapeHtml(log.code || '-')}</td>
          <td>${escapeHtml(log.name || (log.action === 'rollback' ? 'عملية تراجع عن التعديل' : '-'))}</td>
          <td style="color: #ef4444; font-weight: 700;">${escapeHtml(log.prevBrand || '-')}</td>
          <td style="color: #10b981; font-weight: 800;">${escapeHtml(log.newBrand || (log.restoredFrom || '-'))}</td>
          <td style="color: var(--text-muted);">${escapeHtml(log.reason || log.changedBy || '-')}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  // تصدير التقرير
  window.exportBrandAuditReport = function() {
    const s = window.brandAuditState;
    if (!s.filtered || s.filtered.length === 0) {
      showToast('⚠️ لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = ['كود الصنف', 'اسم الصنف', 'الماركة الحالية', 'الماركة المقترحة', 'مستوى الثقة', 'الإجراء المقترح', 'سبب الاقتراح'];
    const rows = s.filtered.map(i => [
      `"${i.code}"`,
      `"${(i.name || '').replace(/"/g, '""')}"`,
      `"${i.currentBrand}"`,
      `"${i.proposedBrand}"`,
      `"${i.confidence}"`,
      `"${i.action}"`,
      `"${(i.reason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_تصنيف_الماركات_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 تم تحميل تقرير الماركات بتنسيق CSV بنجاح', 'success');
  };

  // فحص التعارض المباشر عند إضافة أو تعديل منتج
  window.checkProductBrandRealtimeConflict = async function(nameInputId, brandSelectId, alertBoxId) {
    const nameEl = document.getElementById(nameInputId);
    const brandEl = document.getElementById(brandSelectId);
    const alertEl = document.getElementById(alertBoxId);

    if (!nameEl || !brandEl || !alertEl) return;

    const name = nameEl.value.trim();
    const brand = brandEl.value.trim();

    if (!name || name.length < 3 || !brand || brand === 'أخرى') {
      alertEl.style.display = 'none';
      return;
    }

    try {
      const res = await fetch('/api/brands-classification/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, brand })
      });
      const data = await res.json();
      if (data.success && data.hasConflict) {
        alertEl.style.display = 'flex';
        alertEl.innerHTML = `
          <span>⚠️ <strong>تنبيه توافق الماركة:</strong> يبدو أن اسم الصنف ينتمي لماركة <strong>"${escapeHtml(data.proposedBrand)}" (${escapeHtml(data.proposedBrandAr)})</strong> بينما الماركة المحددة حالياً هي "${escapeHtml(data.currentBrand)}".</span>
          <button type="button" class="btn btn-xs btn-primary" onclick="document.getElementById('${brandSelectId}').value='${escapeHtml(data.proposedBrand)}'; document.getElementById('${alertBoxId}').style.display='none';">تصحيح للماركة المقترحة</button>
        `;
      } else {
        alertEl.style.display = 'none';
      }
    } catch (e) {
      alertEl.style.display = 'none';
    }
  };

})();
