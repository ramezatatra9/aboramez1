const fs = require('fs');
const path = require('path');

// 1. تحديث dataStore.js
const dataStorePath = path.join(__dirname, '../dataStore.js');
let dsContent = fs.readFileSync(dataStorePath, 'utf8');

// استبدال كود استعادة الزبائن في initFromSupabase ليقرأ settings.customers أولاً
const oldCustRestore = `    // 6. استعادة الزبائن الدائمين (من جدول customers مباشرة مع fallback لـ settings)
    try {
      let custData = null;
      const { data: cTable, error: cErr } = await supabase.from('customers').select('*').order('name');
      if (!cErr && Array.isArray(cTable) && cTable.length > 0) {
        custData = cTable;
        console.log(\`✅ تم استعادة \${custData.length} زبون من جدول customers الأساسي في Supabase\`);
      } else {
        const { data: cRow } = await supabase.from('settings').select('data').eq('id', 'customers').maybeSingle();
        if (cRow && Array.isArray(cRow.data) && cRow.data.length > 0) {
          custData = cRow.data;
          console.log(\`✅ تم استعادة \${custData.length} زبون بأرصدتهم الدائمة من snapshot في settings\`);
        }
      }
      if (custData && custData.length > 0) {
        writeJson(CUSTOMERS_FILE, custData);
      }
    } catch (cErr) {
      console.warn('⚠️ تعذر استعادة الزبائن من Supabase:', cErr.message);
    }`;

const newCustRestore = `    // 6. استعادة الزبائن — settings.customers أولاً (snapshot المزامنة الكامل مع تاريخ الفروقات) ثم جدول customers المباشر
    try {
      let custData = null;
      const { data: cRow } = await supabase.from('settings').select('data').eq('id', 'customers').maybeSingle();
      if (cRow && Array.isArray(cRow.data) && cRow.data.length > 0) {
        custData = cRow.data;
        console.log(\`✅ تم استعادة \${custData.length} زبون بأرصدتهم وتواريخ حركاتهم الدائمة من settings\`);
      } else {
        const { data: cTable, error: cErr } = await supabase.from('customers').select('*').order('name');
        if (!cErr && Array.isArray(cTable) && cTable.length > 0) {
          custData = cTable;
          console.log(\`✅ تم استعادة \${custData.length} زبون من جدول customers الأساسي في Supabase\`);
        }
      }
      if (custData && custData.length > 0) {
        writeJson(CUSTOMERS_FILE, custData);
      }
    } catch (cErr) {
      console.warn('⚠️ تعذر استعادة الزبائن من Supabase:', cErr.message);
    }`;

// تسوية نهايات الأسطر للبحث
const normalize = str => str.replace(/\r\n/g, '\n');

if (normalize(dsContent).includes(normalize(oldCustRestore))) {
  // استبدال مع الحفاظ على نوع السطر
  const isCRLF = dsContent.includes('\r\n');
  const targetOld = isCRLF ? oldCustRestore.replace(/\n/g, '\r\n') : oldCustRestore;
  const targetNew = isCRLF ? newCustRestore.replace(/\n/g, '\r\n') : newCustRestore;
  dsContent = dsContent.replace(targetOld, targetNew);
  console.log('✅ تم تعديل أولوية استعادة الزبائن في initFromSupabase');
} else {
  console.log('⚠️ لم يتم العثور على مقطع استعادة الزبائن القديم بدقة');
}

// تعديل adjustCustomerBalance لتوثيق تاريخ التعديل وحفظ settings.customers
const oldAdjustCust = `  async adjustCustomerBalance(idOrSysNumOrName, deltaAmount) {
    const customers = this.getCustomers();
    const query = String(idOrSysNumOrName).trim().toLowerCase();
    const idx = customers.findIndex(c =>
      c.id === idOrSysNumOrName ||
      (c.systemNumber && String(c.systemNumber).trim() === query) ||
      (c.name && c.name.trim().toLowerCase() === query)
    );

    if (idx !== -1) {
      const current = parseFloat(customers[idx].balance) || 0;
      const updated = current + parseFloat(deltaAmount);
      const updatedCustomer = {
        ...customers[idx],
        balance: parseFloat(updated.toFixed(2)),
        updatedAt: new Date().toISOString()
      };
      if (supabase) {
        const res = await syncCustomerToSupabase(updatedCustomer);
        if (!res.success) {
          throw new Error('تعذر تحديث رصيد العميل في قاعدة البيانات الدائمة (Supabase): ' + res.error);
        }
      }
      customers[idx] = updatedCustomer;
      writeJson(CUSTOMERS_FILE, customers);
      return customers[idx];
    }
    return null;
  },`;

const newAdjustCust = `  async adjustCustomerBalance(idOrSysNumOrName, deltaAmount) {
    const customers = this.getCustomers();
    const query = String(idOrSysNumOrName).trim().toLowerCase();
    const idx = customers.findIndex(c =>
      c.id === idOrSysNumOrName ||
      (c.systemNumber && String(c.systemNumber).trim() === query) ||
      (c.name && c.name.trim().toLowerCase() === query)
    );

    if (idx !== -1) {
      const current = parseFloat(customers[idx].balance) || 0;
      const delta = parseFloat(deltaAmount) || 0;
      const updated = parseFloat((current + delta).toFixed(2));
      const now = new Date().toISOString();
      const hasDiff = Math.abs(current - updated) > 0.01;

      let balanceHistory = Array.isArray(customers[idx].balanceHistory) ? [...customers[idx].balanceHistory] : [];
      if (hasDiff) {
        balanceHistory.unshift({
          date: now,
          oldBalance: current,
          newBalance: updated,
          difference: delta,
          source: 'balance_adjustment'
        });
        if (balanceHistory.length > 50) balanceHistory = balanceHistory.slice(0, 50);
      }

      const updatedCustomer = {
        ...customers[idx],
        balance: updated,
        shamelBalance: updated,
        lastBalanceDiffDate: hasDiff ? now : (customers[idx].lastBalanceDiffDate || null),
        lastBalanceChangeDate: hasDiff ? now : (customers[idx].lastBalanceChangeDate || null),
        previousBalance: hasDiff ? current : (customers[idx].previousBalance !== undefined ? customers[idx].previousBalance : current),
        balanceDifference: hasDiff ? delta : (customers[idx].balanceDifference || 0),
        balanceHistory,
        updatedAt: now
      };

      customers[idx] = updatedCustomer;
      writeJson(CUSTOMERS_FILE, customers);

      if (supabase) {
        try {
          await syncCustomerToSupabase(updatedCustomer);
          await supabase.from('settings').upsert({ id: 'customers', data: customers });
        } catch (sbErr) {
          console.warn('adjustCustomerBalance supabase warn:', sbErr.message);
        }
      }
      return customers[idx];
    }
    return null;
  },`;

if (normalize(dsContent).includes(normalize(oldAdjustCust))) {
  const isCRLF = dsContent.includes('\r\n');
  const targetOld = isCRLF ? oldAdjustCust.replace(/\n/g, '\r\n') : oldAdjustCust;
  const targetNew = isCRLF ? newAdjustCust.replace(/\n/g, '\r\n') : newAdjustCust;
  dsContent = dsContent.replace(targetOld, targetNew);
  console.log('✅ تم تعديل adjustCustomerBalance لتوثيق تاريخ تعديل الرصيد وسجل الحركات');
} else {
  console.log('⚠️ لم يتم العثور على adjustCustomerBalance القديم');
}

fs.writeFileSync(dataStorePath, dsContent, 'utf8');
console.log('💾 تم حفظ dataStore.js بنجاح');
