const fs = require('fs');
const path = require('path');

const now = new Date().toISOString();

// 1. Rebuild suppliers.json
const shamelSuppliers = JSON.parse(fs.readFileSync('C:/Users/NTC/.gemini/antigravity-ide/scratch/shamel_real_suppliers.json', 'utf8').replace(/^\uFEFF/, ''));
const suppliersFile = path.join(__dirname, '..', 'data', 'suppliers.json');

const rebuiltSuppliers = shamelSuppliers.map(s => {
  const code = String(s.code).trim();
  return {
    id: 'supp-shamel-' + code + '-' + Date.now(),
    shamelCode: code,
    name: String(s.name).trim(),
    phone: String(s.phone || s.mobile || '').trim(),
    mobile: String(s.mobile || s.phone || '').trim(),
    email: String(s.email || '').trim(),
    address: String(s.address || '').trim(),
    notes: String(s.notes || '').trim(),
    isStopped: Boolean(s.isStopped),
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
    syncedBy: 'مزامنة الشامل لايت (ShamelRealData)',
    source: 'shamel_sync'
  };
});

fs.writeFileSync(suppliersFile, JSON.stringify(rebuiltSuppliers, null, 2), 'utf8');
console.log(`✅ suppliers.json rebuilt successfully with ${rebuiltSuppliers.length} suppliers.`);

// Update sync_suppliers_meta.json
const suppMetaFile = path.join(__dirname, '..', 'data', 'sync_suppliers_meta.json');
fs.writeFileSync(suppMetaFile, JSON.stringify({
  lastSyncAt: now,
  mode: 'full_clean_rebuild',
  itemsReceived: rebuiltSuppliers.length,
  created: rebuiltSuppliers.length,
  updated: 0,
  unchanged: 0,
  failed: 0
}, null, 2), 'utf8');

// 2. Rebuild/Update customers.json
const shamelCustomers = JSON.parse(fs.readFileSync('C:/Users/NTC/.gemini/antigravity-ide/scratch/shamel_real_customers.json', 'utf8').replace(/^\uFEFF/, ''));
const customersFile = path.join(__dirname, '..', 'data', 'customers.json');
let existingCustomers = [];
try {
  existingCustomers = JSON.parse(fs.readFileSync(customersFile, 'utf8').replace(/^\uFEFF/, ''));
} catch (_) {}

const custMap = new Map();
existingCustomers.forEach(c => {
  const key = (c.systemNumber || c.shamelCode || '').trim().toUpperCase();
  if (key) custMap.set(key, c);
});

const rebuiltCustomers = shamelCustomers.map(c => {
  const code = String(c.code).trim();
  const key = code.toUpperCase();
  const existing = custMap.get(key);

  return {
    id: existing ? existing.id : 'cust-shamel-' + code + '-' + Date.now(),
    systemNumber: code,
    shamelCode: code,
    name: String(c.name).trim(),
    phone: String(c.phone || c.mobile || (existing ? existing.phone : '') || '').trim(),
    mobile: String(c.mobile || c.phone || (existing ? existing.mobile : '') || '').trim(),
    email: String(c.email || (existing ? existing.email : '') || '').trim(),
    address: String(c.address || (existing ? existing.address : '') || '').trim(),
    notes: String(c.notes || (existing ? existing.notes : '') || '').trim(),
    isStopped: Boolean(c.isStopped),
    balance: existing && existing.balance !== undefined ? existing.balance : 0,
    createdAt: existing && existing.createdAt ? existing.createdAt : now,
    updatedAt: now,
    syncedAt: now,
    syncedBy: 'مزامنة الشامل لايت (ShamelRealData)',
    source: 'shamel_sync'
  };
});

fs.writeFileSync(customersFile, JSON.stringify(rebuiltCustomers, null, 2), 'utf8');
console.log(`✅ customers.json rebuilt successfully with ${rebuiltCustomers.length} customers.`);

// Update sync_customers_meta.json
const custMetaFile = path.join(__dirname, '..', 'data', 'sync_customers_meta.json');
fs.writeFileSync(custMetaFile, JSON.stringify({
  lastSyncAt: now,
  mode: 'full_clean_rebuild',
  itemsReceived: rebuiltCustomers.length,
  created: rebuiltCustomers.length,
  updated: 0,
  unchanged: 0,
  failed: 0
}, null, 2), 'utf8');
