const fs = require('fs');
const path = require('path');
const { supabase } = require('../supabaseClient');

const custPath = path.join(__dirname, '../data/customers.json');
const suppPath = path.join(__dirname, '../data/suppliers.json');
const liveCustPath = path.join(__dirname, '../data/live_shamel_customers.json');
const liveSuppPath = path.join(__dirname, '../data/live_shamel_suppliers.json');

const customers = JSON.parse(fs.readFileSync(custPath, 'utf8'));
const suppliers = JSON.parse(fs.readFileSync(suppPath, 'utf8'));
const liveCusts = JSON.parse(fs.readFileSync(liveCustPath, 'utf8').replace(/^\uFEFF/,''));
const liveSupps = JSON.parse(fs.readFileSync(liveSuppPath, 'utf8').replace(/^\uFEFF/,''));

const liveCustMap = new Map();
liveCusts.forEach(c => liveCustMap.set(String(c.code).trim().toUpperCase(), parseFloat(c.balance) || 0));

const liveSuppMap = new Map();
liveSupps.forEach(s => liveSuppMap.set(String(s.code).trim().toUpperCase(), parseFloat(s.balance) || 0));

const now = new Date().toISOString();
let custDiffCount = 0;

// تحديث الزبائن
customers.forEach(c => {
  const code = String(c.systemNumber || c.shamelCode || '').trim().toUpperCase();
  const shamelBal = liveCustMap.has(code) ? liveCustMap.get(code) : (parseFloat(c.balance) || 0);
  const curBal = parseFloat(c.balance) || 0;

  // إذا كان هناك فرق مسجل أو تم تعديل الرصيد اليوم
  if (!c.lastBalanceDiffDate) {
    if (c.updatedAt && c.updatedAt.startsWith('2026-10-30')) {
      c.lastBalanceDiffDate = c.updatedAt;
      c.lastBalanceChangeDate = c.updatedAt;
      c.previousBalance = 0;
      c.balanceDifference = curBal;
      c.balanceHistory = [{
        date: c.updatedAt,
        oldBalance: 0,
        newBalance: curBal,
        difference: curBal,
        source: 'shamel_sync'
      }];
      custDiffCount++;
    } else if (curBal !== 0) {
      // رصيد مسجل سابقاً - نستخدم تاريخ التحديث أو المزامنة السابق
      const movementDate = c.syncedAt || c.updatedAt || c.createdAt || '2026-10-19T16:23:21.984Z';
      c.lastBalanceDiffDate = movementDate;
      c.lastBalanceChangeDate = movementDate;
      c.previousBalance = 0;
      c.balanceDifference = curBal;
      c.balanceHistory = [{
        date: movementDate,
        oldBalance: 0,
        newBalance: curBal,
        difference: curBal,
        source: 'initial_balance'
      }];
      custDiffCount++;
    }
  }
});

// تحديث الموردين
let suppDiffCount = 0;
suppliers.forEach(s => {
  const code = String(s.shamelCode || '').trim().toUpperCase();
  const curBal = parseFloat(s.balance) || 0;
  if (!s.lastBalanceDiffDate && curBal !== 0) {
    const movementDate = s.syncedAt || s.updatedAt || s.createdAt || now;
    s.lastBalanceDiffDate = movementDate;
    s.lastBalanceChangeDate = movementDate;
    s.previousBalance = 0;
    s.balanceDifference = curBal;
    s.balanceHistory = [{
      date: movementDate,
      oldBalance: 0,
      newBalance: curBal,
      difference: curBal,
      source: 'initial_balance'
    }];
    suppDiffCount++;
  }
});

fs.writeFileSync(custPath, JSON.stringify(customers, null, 2), 'utf8');
fs.writeFileSync(suppPath, JSON.stringify(suppliers, null, 2), 'utf8');
console.log(`✅ تم تحديث تواريخ تعديل الأرصدة: ${custDiffCount} زبون | ${suppDiffCount} مورد`);

async function syncToSupabaseSettings() {
  if (supabase) {
    console.log('🔄 جاري حفظ التحديثات في Supabase settings...');
    await supabase.from('settings').upsert({ id: 'customers', data: customers });
    await supabase.from('settings').upsert({ id: 'suppliers', data: suppliers });
    console.log('✅ تم حفظ settings.customers و settings.suppliers في Supabase بنجاح');
  }
  process.exit(0);
}

syncToSupabaseSettings().catch(err => {
  console.error('❌ خطأ في الحفظ:', err.message);
  process.exit(1);
});
