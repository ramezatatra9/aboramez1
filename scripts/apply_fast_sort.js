const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/js/app.js');
let content = fs.readFileSync(filePath, 'utf8');

const isCRLF = content.includes('\r\n');
const searchMarker = isCRLF 
  ? '  // فرز الحسابات:\r\n  // 1. العملاء المقتربين'
  : '  // فرز الحسابات:\n  // 1. العملاء المقتربين';

const idx = content.indexOf(searchMarker);
if (idx === -1) {
  console.log('Marker not found!');
  process.exit(1);
}

const endMarker = 'tbody.innerHTML = filtered.map';
const endIdx = content.indexOf(endMarker, idx);
const oldSort = content.substring(idx, endIdx);

const newSort = `  // تسريع فائق O(N): احتساب مؤقتات الحركات مسبقاً وتخزينها في Cache لتسريع الفرز والعرض
  const timerCache = new Map();
  for (let i = 0; i < filtered.length; i++) {
    const c = filtered[i];
    timerCache.set(c.id || c.systemNumber || ('item_' + i), getCustomerReceiptTimerData(c));
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

  `;

content = content.replace(oldSort, isCRLF ? newSort.replace(/\n/g, '\r\n') : newSort);
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ تم دمج تسريع الفرز O(N) بنجاح!');
