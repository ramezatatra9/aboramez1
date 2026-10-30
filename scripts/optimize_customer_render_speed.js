const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../public/js/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// استبدال الجزء البطيء في renderCustomerTab
const oldSortBlock = `  // فرز الحسابات:
  // 1. العملاء المقتربين من 30 يوماً أو المتجاوزين 30 يوماً (اللون الأحمر) في القمة أولاً دائماً!
  // 2. باقي المدينين (عليهم ديون)
  // 3. الدائنين (لهم أرصدة)
  // 4. الحسابات المسددة
  filtered.sort((a, b) => {
    const timerA = getCustomerReceiptTimerData(a);
    const timerB = getCustomerReceiptTimerData(b);

    if (timerA.isUrgentRed && !timerB.isUrgentRed) return -1;
    if (!timerA.isUrgentRed && timerB.isUrgentRed) return 1;
    if (timerA.isUrgentRed && timerB.isUrgentRed) {
      if (timerB.daysSince !== timerA.daysSince) {
        return timerB.daysSince - timerA.daysSince;
      }
      return (parseFloat(b.balance) || 0) - (parseFloat(a.balance) || 0);
    }

    const balA = parseFloat(a.balance) || 0;
    const balB = parseFloat(b.balance) || 0;
    const isDebtA = a.isSupplier ? (balA < 0) : (balA > 0);
    const isDebtB = b.isSupplier ? (balB < 0) : (balB > 0);

    if (isDebtA && !isDebtB) return -1;
    if (!isDebtA && isDebtB) return 1;

    // الموردين ذوو المبالغ الدائنة الكبيرة
    const effBalA = a.isSupplier ? balA : -balA;
    const effBalB = b.isSupplier ? balB : -balB;
    return effBalB - effBalA;
  });

  tbody.innerHTML = filtered.map(c => {
    const bal = parseFloat(c.balance) || 0;
    const isSupp = Boolean(c.isSupplier);
    const hasDebt = isSupp ? (bal < 0) : (bal > 0);
    const isCredit = isSupp ? (bal > 0) : (bal < 0);
    const isSettled = (bal === 0);

    let debtBadgeHtml = '';
    if (isSupp) {
      if (isCredit) {
        debtBadgeHtml = \`<span class="bal-tag credit">🏢 مستحق له: \${bal.toLocaleString('en-US')} \${cur}</span>\`;
      } else if (isDebtA) {`;

const newSortBlock = `  // تسريع فائق: احتساب مؤقتات الحركات مسبقاً مرة واحدة لكل حساب وتخزينها في Map
  // لتجنب استدعاء دالة الفحص آلاف المرات داخل دالة الفرز sort
  const timerCache = new Map();
  for (let i = 0; i < filtered.length; i++) {
    const c = filtered[i];
    const key = c.id || c.systemNumber || ('item_' + i);
    timerCache.set(key, getCustomerReceiptTimerData(c));
  }

  // فرز الحسابات:
  // 1. العملاء المقتربين من 30 يوماً أو المتجاوزين 30 يوماً (اللون الأحمر) في القمة أولاً دائماً!
  // 2. باقي المدينين (عليهم ديون)
  // 3. الدائنين (لهم أرصدة)
  // 4. الحسابات المسددة
  filtered.sort((a, b) => {
    const keyA = a.id || a.systemNumber;
    const keyB = b.id || b.systemNumber;
    const timerA = timerCache.get(keyA) || getCustomerReceiptTimerData(a);
    const timerB = timerCache.get(keyB) || getCustomerReceiptTimerData(b);

    if (timerA.isUrgentRed && !timerB.isUrgentRed) return -1;
    if (!timerA.isUrgentRed && timerB.isUrgentRed) return 1;
    if (timerA.isUrgentRed && timerB.isUrgentRed) {
      if (timerB.daysSince !== timerA.daysSince) {
        return timerB.daysSince - timerA.daysSince;
      }
      return (parseFloat(b.balance) || 0) - (parseFloat(a.balance) || 0);
    }

    const balA = parseFloat(a.balance) || 0;
    const balB = parseFloat(b.balance) || 0;
    const isDebtA = a.isSupplier ? (balA < 0) : (balA > 0);
    const isDebtB = b.isSupplier ? (balB < 0) : (balB > 0);

    if (isDebtA && !isDebtB) return -1;
    if (!isDebtA && isDebtB) return 1;

    // الموردين ذوو المبالغ الدائنة الكبيرة
    const effBalA = a.isSupplier ? balA : -balA;
    const effBalB = b.isSupplier ? balB : -balB;
    return effBalB - effBalA;
  });

  tbody.innerHTML = filtered.map(c => {
    const bal = parseFloat(c.balance) || 0;
    const isSupp = Boolean(c.isSupplier);
    const hasDebt = isSupp ? (bal < 0) : (bal > 0);
    const isCredit = isSupp ? (bal > 0) : (bal < 0);
    const isSettled = (bal === 0);

    let debtBadgeHtml = '';
    if (isSupp) {
      if (isCredit) {
        debtBadgeHtml = \`<span class="bal-tag credit">🏢 مستحق له: \${bal.toLocaleString('en-US')} \${cur}</span>\`;
      } else if (hasDebt) {`;

const normalize = s => s.replace(/\r\n/g, '\n');

if (normalize(content).includes(normalize(oldSortBlock))) {
  const isCRLF = content.includes('\r\n');
  content = content.replace(
    isCRLF ? oldSortBlock.replace(/\n/g, '\r\n') : oldSortBlock,
    isCRLF ? newSortBlock.replace(/\n/g, '\r\n') : newSortBlock
  );
  console.log('✅ تم تسريع فرز الحسابات والزبائن بنجاح');
} else {
  console.log('⚠️ لم يتم العثور على oldSortBlock القديم');
}

// وأيضاً داخل map: نستخدم timerCache مباشرة بدلاً من استدعاء getCustomerReceiptTimerData مرة أخرى
const oldMapTimerCall = `    // حساب مؤقت وتاريخ آخر حركة وتعديل الرصيد
    const timer = getCustomerReceiptTimerData(c);`;

const newMapTimerCall = `    // جلب المؤقت المحسوب مسبقاً بسرعة فائقة O(1)
    const key = c.id || c.systemNumber;
    const timer = timerCache.get(key) || getCustomerReceiptTimerData(c);`;

if (normalize(content).includes(normalize(oldMapTimerCall))) {
  const isCRLF = content.includes('\r\n');
  content = content.replace(
    isCRLF ? oldMapTimerCall.replace(/\n/g, '\r\n') : oldMapTimerCall,
    isCRLF ? newMapTimerCall.replace(/\n/g, '\r\n') : newMapTimerCall
  );
  console.log('✅ تم ربط timerCache داخل tbody.innerHTML map');
}

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('💾 تم الحفظ بنجاح');
