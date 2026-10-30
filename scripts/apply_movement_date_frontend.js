const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../public/js/app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. استبدال دالة getCustomerReceiptTimerData
const oldTimerFunc = `function getCustomerReceiptTimerData(c) {
  const bal = parseFloat(c.balance) || 0;
  const isSupp = Boolean(c.isSupplier);
  const hasDebt = isSupp ? (bal < 0) : (bal > 0);
  const isCredit = isSupp ? (bal > 0) : (bal < 0);

  // فحص كافة سندات القبض الخاصة بالحساب
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
    dateFormatted = c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : 'مسجل بالنظام';
  }

  // اقترب من 30 يوماً (من 25 يوماً فأكثر) أو تجاوزها ولديه دين مستحق بذمته
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
}`;

const newTimerFunc = `function getCustomerReceiptTimerData(c) {
  const bal = parseFloat(c.balance) || 0;
  const isSupp = Boolean(c.isSupplier);
  const hasDebt = isSupp ? (bal < 0) : (bal > 0);
  const isCredit = isSupp ? (bal > 0) : (bal < 0);
  const cur = state.settings ? (state.settings.currency || '₪') : '₪';

  // 1. فحص سندات القبض والصرف
  const custReceipts = (state.receipts || []).filter(r =>
    (c.id && r.customerId === c.id) ||
    (c.systemNumber && String(r.customerSystemNumber) === String(c.systemNumber)) ||
    (r.customerName && r.customerName.trim().toLowerCase() === c.name.trim().toLowerCase())
  );
  custReceipts.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  const lastReceipt = custReceipts[0] || null;

  // 2. فحص الفواتير
  const custInvoices = (state.invoices || []).filter(inv =>
    (c.id && inv.customerId === c.id) ||
    (c.systemNumber && String(inv.customerSystemNumber) === String(c.systemNumber)) ||
    (inv.customerName && inv.customerName.trim().toLowerCase() === c.name.trim().toLowerCase())
  );
  custInvoices.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  const lastInvoice = custInvoices[0] || null;

  // 3. تاريخ تعديل الرصيد عن الرصيد السابق داخل الموقع
  let balanceDiffDateStr = c.lastBalanceDiffDate || c.lastBalanceChangeDate || null;
  if (!balanceDiffDateStr && Array.isArray(c.balanceHistory) && c.balanceHistory.length > 0) {
    balanceDiffDateStr = c.balanceHistory[0].date;
  }

  // تحديد أحدث حركة أثرت على الرصيد لتعديل التاريخ بدقة
  let movementDate = null;
  let movementType = 'none';
  let movementLabel = '';
  let movementSubText = '';
  let latestMs = 0;

  // فحص تاريخ تعديل الرصيد عن السابق (المزامنة من الشامل أو التعديل المالي)
  if (balanceDiffDateStr) {
    const bMs = new Date(balanceDiffDateStr).getTime();
    if (!isNaN(bMs) && bMs > latestMs) {
      latestMs = bMs;
      movementDate = new Date(bMs);
      movementType = 'balance_diff';
      const diffVal = c.balanceDifference !== undefined ? c.balanceDifference : (
        Array.isArray(c.balanceHistory) && c.balanceHistory.length > 0 ? c.balanceHistory[0].difference : null
      );
      const prevBal = c.previousBalance !== undefined ? c.previousBalance : null;
      if (diffVal !== null && diffVal !== undefined) {
        movementLabel = diffVal > 0 ? '🔺 تعديل رصيد بالزيادة' : '🔻 تعديل رصيد بالنقصان';
        movementSubText = \`الفرق: \${diffVal > 0 ? '+' : ''}\${diffVal.toLocaleString('en-US')} \${cur}\${prevBal !== null ? \` (السابق: \${prevBal.toLocaleString('en-US')})\` : ''}\`;
      } else {
        movementLabel = 'تعديل رصيد الحساب';
        movementSubText = \`الرصيد: \${bal.toLocaleString('en-US')} \${cur}\`;
      }
    }
  }

  // فحص آخر سند
  if (lastReceipt) {
    const rMs = new Date(lastReceipt.createdAt || lastReceipt.date).getTime();
    if (!isNaN(rMs) && rMs >= latestMs) {
      latestMs = rMs;
      movementDate = new Date(rMs);
      movementType = isSupp ? 'supplier_receipt' : 'customer_receipt';
      movementLabel = isSupp ? \`سند صرف #\${lastReceipt.receiptNumber || ''}\` : \`سند قبض #\${lastReceipt.receiptNumber || ''}\`;
      movementSubText = \`مبلغ: \${(lastReceipt.amount || 0).toLocaleString('en-US')} \${cur}\`;
    }
  }

  // فحص آخر فاتورة
  if (lastInvoice) {
    const iMs = new Date(lastInvoice.createdAt || lastInvoice.date).getTime();
    if (!isNaN(iMs) && iMs >= latestMs) {
      latestMs = iMs;
      movementDate = new Date(iMs);
      movementType = 'invoice';
      movementLabel = \`فاتورة #\${lastInvoice.invoiceNumber || ''}\`;
      movementSubText = \`إجمالي: \${(lastInvoice.total || 0).toLocaleString('en-US')} \${cur}\`;
    }
  }

  // إذا لم تسجل حركة سابقة، نستخدم تاريخ تحديث أو مزامنة الرصيد داخل الموقع
  if (!movementDate) {
    const fallbackDateStr = c.updatedAt || c.syncedAt || c.createdAt;
    if (fallbackDateStr) {
      const fMs = new Date(fallbackDateStr).getTime();
      if (!isNaN(fMs)) {
        latestMs = fMs;
        movementDate = new Date(fMs);
        movementType = 'sync_update';
        movementLabel = hasDebt ? 'تاريخ تثبيت الرصيد' : (bal === 0 ? 'حساب مطابق وخالص' : 'رصيد دائن');
        movementSubText = \`الرصيد: \${bal.toLocaleString('en-US')} \${cur}\`;
      }
    }
  }

  let daysSince = 0;
  let dateFormatted = '--';
  let timeFormatted = '';

  if (movementDate) {
    daysSince = Math.max(0, Math.floor((Date.now() - movementDate.getTime()) / (1000 * 60 * 60 * 24)));
    dateFormatted = movementDate.toISOString().split('T')[0];
    try {
      timeFormatted = movementDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch (_) {}
  }

  // حساب حالات التحذير والمهل (فقط إذا كان عليه دين فعلي)
  const isNear30 = hasDebt && (daysSince >= 25 && daysSince < 30);
  const isOver30 = hasDebt && (daysSince >= 30);
  const isUrgentRed = isNear30 || isOver30;

  return {
    lastReceipt,
    lastInvoice,
    movementDate,
    movementType,
    movementLabel,
    movementSubText,
    daysSince,
    dateFormatted,
    timeFormatted,
    hasDebt,
    isCredit,
    isNear30,
    isOver30,
    isUrgentRed
  };
}`;

const normalize = s => s.replace(/\r\n/g, '\n');

if (normalize(appJs).includes(normalize(oldTimerFunc))) {
  const isCRLF = appJs.includes('\r\n');
  appJs = appJs.replace(
    isCRLF ? oldTimerFunc.replace(/\n/g, '\r\n') : oldTimerFunc,
    isCRLF ? newTimerFunc.replace(/\n/g, '\r\n') : newTimerFunc
  );
  console.log('✅ تم تحديث دالة getCustomerReceiptTimerData لتعتمد على تاريخ تعديل الرصيد عن السابق');
} else {
  console.log('⚠️ لم يتم العثور على getCustomerReceiptTimerData القديمة');
}

// 2. تحديث جزء رسم timerHtml في renderCustomerTab
const oldTimerHtmlBlock = `    // حساب مؤقت وتاريخ آخر حركة
    const timer = getCustomerReceiptTimerData(c);
    let timerHtml = '';

    if (timer.lastReceipt) {
      let statusText = '';
      if (timer.daysSince === 0) statusText = 'حركة اليوم';
      else if (timer.daysSince === 1) statusText = 'مضى يوم واحد (أمس)';
      else if (timer.daysSince === 2) statusText = 'مضى يومان';
      else if (timer.daysSince <= 10) statusText = \`مضى \${timer.daysSince} أيام\`;
      else statusText = \`مضى \${timer.daysSince} يوماً\`;

      let badgeClass = 'timer-recent';
      let urgencyBadge = '';

      if (timer.isOver30) {
        badgeClass = 'timer-urgent-30';
        urgencyBadge = \`<div style="color: #991b1b; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fee2e2; padding: 2px 6px; border-radius: 4px; border: 1px solid #f87171;">🚨 تجاوز 30 يوماً بدون سداد!</div>\`;
      } else if (timer.isNear30) {
        badgeClass = 'timer-urgent-30';
        urgencyBadge = \`<div style="color: #b91c1c; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fef2f2; padding: 2px 6px; border-radius: 4px; border: 1px solid #fca5a5;">⚠️ يقترب من 30 يوماً (\${timer.daysSince} يوم)</div>\`;
      } else if (timer.hasDebt && timer.daysSince >= 15) {
        badgeClass = 'timer-warning';
      } else if (!timer.hasDebt) {
        badgeClass = 'timer-settled';
      }

      timerHtml = \`
        <div class="cust-timer-badge \${badgeClass}" style="\${timer.isUrgentRed ? 'border: 2px solid #ef4444; background: #fee2e2; color: #991b1b;' : ''}">
          <div style="font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
            <span>\${timer.isUrgentRed ? '🚨' : (timer.hasDebt ? '⏱️' : '✅')}</span>
            <span style="font-size: 0.88rem;">\${statusText}</span>
          </div>
          <div style="font-size: 0.76rem; font-family: monospace; direction: ltr; text-align: center; color: \${timer.isUrgentRed ? '#7f1d1d' : '#475569'}; margin-top: 0.15rem; font-weight: 700;">
            📅 \${timer.dateFormatted}
          </div>
          <div style="font-size: 0.72rem; opacity: 0.9; text-align: center; margin-top: 0.1rem;">
            سند #\${timer.lastReceipt.receiptNumber} (\${(timer.lastReceipt.amount || 0).toLocaleString('en-US')} \${cur})
          </div>
          \${urgencyBadge}
        </div>
      \`;
    } else {
      let urgencyBadge = '';
      let badgeClass = timer.hasDebt ? (timer.daysSince >= 25 ? 'timer-urgent-30' : 'timer-warning') : 'timer-none';

      if (timer.isUrgentRed) {
        urgencyBadge = \`<div style="color: #991b1b; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fee2e2; padding: 2px 6px; border-radius: 4px; border: 1px solid #f87171;">🚨 \${timer.daysSince >= 30 ? 'تجاوز 30 يوماً بدون أي سداد!' : \`يقترب من 30 يوماً (\${timer.daysSince} يوم)\`}</div>\`;
      }

      timerHtml = \`
        <div class="cust-timer-badge \${badgeClass}" style="\${timer.isUrgentRed ? 'border: 2px solid #ef4444; background: #fee2e2; color: #991b1b;' : ''}">
          <div style="font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.25rem;">
            <span>\${timer.isUrgentRed ? '🚨' : '⚠️'}</span>
            <span>\${isSupp ? 'حساب مورد مسجل' : 'لا يوجد سداد سابق'}</span>
          </div>
          <div style="font-size: 0.76rem; font-family: monospace; direction: ltr; text-align: center; color: #64748b; margin-top: 0.15rem; font-weight: 700;">
            📅 \${timer.dateFormatted}
          </div>
          <div style="font-size: 0.72rem; opacity: 0.9; text-align: center; margin-top: 0.1rem;">
            \${isSupp ? 'رصيد دائن للشامل' : \`مضى \${timer.daysSince} يوماً بدون سداد\`}
          </div>
          \${urgencyBadge}
        </div>
      \`;
    }`;

const newTimerHtmlBlock = `    // حساب مؤقت وتاريخ آخر حركة وتعديل الرصيد
    const timer = getCustomerReceiptTimerData(c);
    let timerHtml = '';

    let statusText = '';
    if (!timer.hasDebt) {
      if (bal === 0) statusText = '🟢 خالص تماماً';
      else statusText = isSupp ? '🔵 رصيد دائن للمورد' : '🔵 رصيد دائن للزبون';
    } else {
      if (timer.daysSince === 0) statusText = '⚡ حركة اليوم';
      else if (timer.daysSince === 1) statusText = 'مضى يوم واحد (أمس)';
      else if (timer.daysSince === 2) statusText = 'مضى يومان';
      else if (timer.daysSince <= 10) statusText = \`مضى \${timer.daysSince} أيام\`;
      else statusText = \`مضى \${timer.daysSince} يوماً\`;
    }

    let badgeClass = 'timer-recent';
    let urgencyBadge = '';

    if (timer.isOver30) {
      badgeClass = 'timer-urgent-30';
      urgencyBadge = \`<div style="color: #991b1b; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fee2e2; padding: 2px 6px; border-radius: 4px; border: 1px solid #f87171;">🚨 تجاوز 30 يوماً بدون سداد!</div>\`;
    } else if (timer.isNear30) {
      badgeClass = 'timer-urgent-30';
      urgencyBadge = \`<div style="color: #b91c1c; font-size: 0.72rem; font-weight: 800; margin-top: 0.2rem; background: #fef2f2; padding: 2px 6px; border-radius: 4px; border: 1px solid #fca5a5;">⚠️ يقترب من 30 يوماً (\${timer.daysSince} يوم)</div>\`;
    } else if (timer.hasDebt && timer.daysSince >= 15) {
      badgeClass = 'timer-warning';
    } else if (!timer.hasDebt) {
      badgeClass = 'timer-settled';
    }

    timerHtml = \`
      <div class="cust-timer-badge \${badgeClass}" style="\${timer.isUrgentRed ? 'border: 2px solid #ef4444; background: #fee2e2; color: #991b1b;' : ''}">
        <div style="font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
          <span>\${timer.isUrgentRed ? '🚨' : (timer.hasDebt ? '⏱️' : '✅')}</span>
          <span style="font-size: 0.88rem;">\${statusText}</span>
        </div>
        <div style="font-size: 0.76rem; font-family: monospace; direction: ltr; text-align: center; color: \${timer.isUrgentRed ? '#7f1d1d' : '#475569'}; margin-top: 0.15rem; font-weight: 700;">
          📅 \${timer.dateFormatted} \${timer.timeFormatted ? \`<span style="font-size: 0.7rem; color: #64748b;">\${timer.timeFormatted}</span>\` : ''}
        </div>
        <div style="font-size: 0.73rem; opacity: 0.95; text-align: center; margin-top: 0.15rem; font-weight: 700; color: \${timer.isUrgentRed ? '#991b1b' : '#334155'};">
          \${escapeHtml(timer.movementLabel || 'آخر حركة')}
        </div>
        \${timer.movementSubText ? \`
          <div style="font-size: 0.68rem; opacity: 0.85; text-align: center; margin-top: 0.05rem; color: #475569;">
            \${escapeHtml(timer.movementSubText)}
          </div>
        \` : ''}
        \${urgencyBadge}
      </div>
    \`;`;

if (normalize(appJs).includes(normalize(oldTimerHtmlBlock))) {
  const isCRLF = appJs.includes('\r\n');
  appJs = appJs.replace(
    isCRLF ? oldTimerHtmlBlock.replace(/\n/g, '\r\n') : oldTimerHtmlBlock,
    isCRLF ? newTimerHtmlBlock.replace(/\n/g, '\r\n') : newTimerHtmlBlock
  );
  console.log('✅ تم تحديث كود عرض شارة المؤقت والمدة المنقضية في جدول الحسابات');
} else {
  console.log('⚠️ لم يتم العثور على oldTimerHtmlBlock بدقة');
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('💾 تم حفظ public/js/app.js بنجاح');
