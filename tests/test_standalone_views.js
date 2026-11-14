const {
  renderProductPreviewHtml,
  renderInvoicePreviewHtml,
  renderStatementPreviewHtml,
  renderReceiptPreviewHtml,
  renderPreviewBlockedHtml,
  renderPublicCatalogHtml,
  tafqeetArabic
} = require('../standaloneViews');

const dataStore = require('../dataStore');

console.log('--- Testing Standalone Views ---');

const settings = {
  companyName: 'رامز عطاطرة للتجارة',
  companyPhone: '0599123456',
  companyAddress: 'يعبد - جنين',
  currency: 'شيكل'
};

const fakeReq = {
  protocol: 'https',
  headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'aboramez1.onrender.com' },
  get: () => 'aboramez1.onrender.com',
  originalUrl: '/p/prod-1'
};

// 1. Test Product Preview
const sampleProduct = {
  id: 'prod-test-1',
  name: 'شاشة سامسونج 55 بوصة Smart 4K',
  brand: 'Samsung',
  code: 'SAM-55',
  sellPrice: 2200,
  costPrice: 1700,
  stock: 12,
  description: 'مواصفات الشاشة: دقة 4K UHD فائقة الوضوح مع ضمان سنة كاملة.',
  image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1'
};

const prodHtml = renderProductPreviewHtml(sampleProduct, settings, fakeReq);
if (prodHtml.includes('app.js')) throw new Error('Product HTML leaks app.js!');
if (prodHtml.includes('1700')) throw new Error('Product HTML leaks costPrice!');
if (!prodHtml.includes('2,200') && !prodHtml.includes('2200')) throw new Error('Missing sell price');
if (!prodHtml.includes('اطلب هذا الصنف الآن عبر واتساب')) throw new Error('Missing WhatsApp button');
console.log('✅ Product preview HTML passed (No cost leaks, pure standalone HTML).');

// 2. Test Invoice Preview
const sampleInvoice = {
  id: 'INV-1005',
  invoiceNumber: 1005,
  customerName: 'محمد أحمد خليل',
  paymentMethod: 'cash',
  totalAmount: 4400,
  createdAt: new Date().toISOString(),
  items: [
    { productName: 'شاشة سامسونج 55 بوصة', quantity: 2, unitPrice: 2200, totalPrice: 4400, costPrice: 1700 }
  ]
};

const invHtml = renderInvoicePreviewHtml(sampleInvoice, settings, fakeReq);
if (invHtml.includes('app.js')) throw new Error('Invoice HTML leaks app.js!');
if (invHtml.includes('1700')) throw new Error('Invoice HTML leaks cost price!');
if (!invHtml.includes('محمد أحمد خليل')) throw new Error('Missing customer name');
if (!invHtml.includes('4,400') && !invHtml.includes('4400')) throw new Error('Missing invoice total');
console.log('✅ Invoice preview HTML passed (Zero cost leaks, luxury customer view).');

// 3. Test Receipt Preview
const sampleReceipt = {
  id: 'RCP-501',
  receiptNumber: 501,
  customerName: 'خالد مصطفى',
  amount: 1500,
  createdAt: new Date().toISOString(),
  paymentMethod: 'cash',
  description: 'دفعة من الحساب نقداً'
};

const rcpHtml = renderReceiptPreviewHtml(sampleReceipt, settings, fakeReq);
if (rcpHtml.includes('app.js')) throw new Error('Receipt HTML leaks app.js!');
if (!rcpHtml.includes('خالد مصطفى')) throw new Error('Missing customer name');
if (!rcpHtml.includes('1,500') && !rcpHtml.includes('1500')) throw new Error('Missing amount');
if (!rcpHtml.includes('ألف وخمسمائة')) throw new Error('Tafqeet failed: ' + tafqeetArabic(1500));
console.log('✅ Receipt preview HTML passed (Tafqeet verified, standalone luxury voucher).');

// 4. Test Statement Preview
const sampleStatement = {
  customer: { id: 'cust-1', name: 'أحمد سعيد', balance: 3500 },
  movements: [
    { date: new Date().toISOString(), number: '1001', type: 'invoice', typeTitle: 'فاتورة مبيعات', notes: 'أجهزة كهربائية', debit: 5000, credit: 0, balanceAfter: 5000 },
    { date: new Date().toISOString(), number: '501', type: 'receipt', typeTitle: 'سند قبض', notes: 'دفعة نقدية', debit: 0, credit: 1500, balanceAfter: 3500 }
  ]
};

const stmtHtml = renderStatementPreviewHtml(sampleStatement, settings, fakeReq);
if (stmtHtml.includes('app.js')) throw new Error('Statement HTML leaks app.js!');
if (!stmtHtml.includes('أحمد سعيد')) throw new Error('Missing customer name');
if (!stmtHtml.includes('3,500')) throw new Error('Missing balance');
console.log('✅ Customer statement preview HTML passed.');

// 5. Test Blocked and Catalog Views
const blockedHtml = renderPreviewBlockedHtml(settings);
if (!blockedHtml.includes('بوابة المعاينة الرسمية للزبائن')) throw new Error('Blocked page invalid');

const catalogHtml = renderPublicCatalogHtml([sampleProduct], settings, fakeReq);
if (!catalogHtml.includes('معرض الأصناف والمنتجات')) throw new Error('Catalog page invalid');
if (catalogHtml.includes('1700')) throw new Error('Catalog leaks cost price!');
console.log('✅ Blocked page & Public Catalog passed.');

console.log('🎉 ALL STANDALONE VIEW TESTS PASSED SUCCESSFULLY!');
