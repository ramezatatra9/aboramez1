const xlsx = require('xlsx');

function normalizeStr(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove arabic vowels
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function cleanNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * تحليل ملف Excel أو CSV واستخراج بيانات الزبائن وأرصدتهم
 */
function parseCustomerExcel(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('الملف لا يحتوي على أي ورقة عمل صالحة');
  }

  const sheet = workbook.Sheets[sheetName];
  // قراءة الشيت كمصفوفة ثنائية الأبعاد (rows)
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows || rows.length === 0) {
    throw new Error('ورقة العمل في الملف فارغة');
  }

  // البحث عن سطر الترويسة (Header)
  let headerRowIndex = -1;
  let nameCol = -1;
  let sysNumCol = -1;
  let phoneCol = -1;
  let balanceCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let statusCol = -1;
  let notesCol = -1;

  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let hasNameKey = false;
    let hasBalKey = false;

    row.forEach((cell, idx) => {
      const norm = normalizeStr(cell);
      if (norm.includes('اسم') || norm.includes('زبون') || norm.includes('عميل') || norm.includes('name') || norm.includes('customer')) {
        hasNameKey = true;
      }
      if (norm.includes('رصيد') || norm.includes('دين') || norm.includes('مدين') || norm.includes('دائن') || norm.includes('مبلغ') || norm.includes('balance') || norm.includes('debit')) {
        hasBalKey = true;
      }
    });

    if (hasNameKey || hasBalKey) {
      headerRowIndex = r;
      // ربط الأعمدة
      row.forEach((cell, idx) => {
        const norm = normalizeStr(cell);

        if (norm.includes('رقم الحساب') || norm.includes('رقم الزبون') || norm.includes('رقم النظام') || norm.includes('كود') || norm.includes('code') || norm.includes('acc') || norm.includes('id') || norm === 'رقم') {
          sysNumCol = idx;
        } else if (norm.includes('اسم') || norm.includes('زبون') || norm.includes('عميل') || norm.includes('name') || norm.includes('customer')) {
          nameCol = idx;
        } else if (norm.includes('هاتف') || norm.includes('جوال') || norm.includes('موبايل') || norm.includes('تلفون') || norm.includes('phone') || norm.includes('mobile')) {
          phoneCol = idx;
        } else if (norm === 'مدين' || norm.includes('عليه') || norm.includes('debit') || norm.includes('مطلوب منه')) {
          debitCol = idx;
        } else if (norm === 'دائن' || norm.includes('له') || norm.includes('credit') || norm.includes('لصالحه') || norm.includes('رصيد له')) {
          creditCol = idx;
        } else if (norm.includes('حاله') || norm.includes('نوع الرصيد') || norm.includes('status') || norm.includes('type')) {
          statusCol = idx;
        } else if (norm.includes('رصيد') || norm.includes('balance') || norm.includes('دين') || norm.includes('مبلغ')) {
          balanceCol = idx;
        } else if (norm.includes('ملاحظ') || norm.includes('بيان') || norm.includes('تفاصيل') || norm.includes('عنوان') || norm.includes('note') || norm.includes('address')) {
          notesCol = idx;
        }
      });
      break;
    }
  }

  // إذا لم يعثر على ترويسة واضحة، نفترض الأعمدة الافتراضية
  if (nameCol === -1) {
    nameCol = 1;
    sysNumCol = 0;
    balanceCol = 2;
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  const customers = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawName = row[nameCol] !== undefined ? String(row[nameCol]).trim() : '';
    if (!rawName) continue;

    // تجاهل أسطر الإجماليات أو التذييل
    const normName = normalizeStr(rawName);
    if (normName === 'المجموع' || normName === 'الاجمالي' || normName === 'total' || normName === 'grand total' || normName === 'اسم الزبون') {
      continue;
    }

    const sysNum = sysNumCol >= 0 && row[sysNumCol] !== undefined ? String(row[sysNumCol]).trim() : '';
    const phone = phoneCol >= 0 && row[phoneCol] !== undefined ? String(row[phoneCol]).trim() : '';
    const notes = notesCol >= 0 && row[notesCol] !== undefined ? String(row[notesCol]).trim() : '';

    let balance = 0;

    // حالة وجود عمودي مدين ودائن منفصلين
    if (debitCol >= 0 || creditCol >= 0) {
      const debitVal = debitCol >= 0 ? cleanNumber(row[debitCol]) : 0;
      const creditVal = creditCol >= 0 ? cleanNumber(row[creditCol]) : 0;
      balance = parseFloat((debitVal - creditVal).toFixed(2));
    } else if (balanceCol >= 0 && row[balanceCol] !== undefined) {
      let b = cleanNumber(row[balanceCol]);
      // فحص عمود الحالة (له / عليه) إن وجد
      if (statusCol >= 0 && row[statusCol] !== undefined) {
        const st = normalizeStr(row[statusCol]);
        if (st.includes('له') || st.includes('دائن') || st.includes('credit')) {
          b = -Math.abs(b);
        } else if (st.includes('عليه') || st.includes('مدين') || st.includes('debit')) {
          b = Math.abs(b);
        }
      }
      balance = parseFloat(b.toFixed(2));
    }

    customers.push({
      systemNumber: sysNum,
      name: rawName,
      phone: phone,
      balance: balance,
      notes: notes
    });
  }

  // حساب المجاميع
  let totalDebit = 0;  // ديون عليهم
  let totalCredit = 0; // ديون لهم
  let countDebtors = 0;
  let countCreditors = 0;
  let countSettled = 0;

  customers.forEach(c => {
    if (c.balance > 0) {
      totalDebit += c.balance;
      countDebtors++;
    } else if (c.balance < 0) {
      totalCredit += Math.abs(c.balance);
      countCreditors++;
    } else {
      countSettled++;
    }
  });

  const netBalance = parseFloat((totalDebit - totalCredit).toFixed(2));

  return {
    customers,
    count: customers.length,
    summary: {
      totalDebit: parseFloat(totalDebit.toFixed(2)),
      totalCredit: parseFloat(totalCredit.toFixed(2)),
      netBalance,
      countDebtors,
      countCreditors,
      countSettled
    }
  };
}

/**
 * إنشاء ملف إكسل نموذجي لتسهيل تعبئة بيانات الزبائن
 */
function generateCustomerTemplate() {
  const data = [
    {
      'رقم الحساب': '1001',
      'اسم الزبون': 'معرض القدس للأجهزة الكهربائية',
      'رقم الهاتف': '0599123456',
      'مدين (عليه دين)': 4500,
      'دائن (له رصيد)': 0,
      'ملاحظات': 'حساب تجاري نشط'
    },
    {
      'رقم الحساب': '1002',
      'اسم الزبون': 'أحمد إبراهيم عطاطرة',
      'رقم الهاتف': '0568112233',
      'مدين (عليه دين)': 0,
      'دائن (له رصيد)': 350,
      'ملاحظات': 'دفعة مقدمة زيادة لحساب طلبية قادمة'
    },
    {
      'رقم الحساب': '1003',
      'اسم الزبون': 'خالد محمد خليل',
      'رقم الهاتف': '0598776655',
      'مدين (عليه دين)': 0,
      'دائن (له رصيد)': 0,
      'ملاحظات': 'حساب مسدد بالكامل (خالص)'
    },
    {
      'رقم الحساب': '1004',
      'اسم الزبون': 'شركة النور للتجارة والتوزيع',
      'رقم الهاتف': '0595334455',
      'مدين (عليه دين)': 8200,
      'دائن (له رصيد)': 0,
      'ملاحظات': 'أقساط مجدولة شهرية'
    }
  ];

  const worksheet = xlsx.utils.json_to_sheet(data);

  // ضبط عرض الأعمدة لتكون مريحة وقابلة للقراءة
  worksheet['!cols'] = [
    { wch: 14 }, // رقم الحساب
    { wch: 32 }, // اسم الزبون
    { wch: 16 }, // رقم الهاتف
    { wch: 18 }, // مدين
    { wch: 18 }, // دائن
    { wch: 35 }  // ملاحظات
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'الزبائن والأرصدة');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  parseCustomerExcel,
  generateCustomerTemplate
};
