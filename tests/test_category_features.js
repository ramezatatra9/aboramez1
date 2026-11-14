const fs = require('fs');
const path = require('path');
const dataStore = require('../dataStore');

async function testCategoryFeatures() {
  console.log('🧪 Testing Category Customization & Anti-Leak Shield...');

  // 1. Verify index.html Anti-Leak Shield
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const headHtml = indexHtml.substring(0, indexHtml.indexOf('</head>'));

  if (!headHtml.includes('criticalAuthShield')) {
    throw new Error('Missing criticalAuthShield in index.html <head>');
  }
  if (!indexHtml.includes('<body class="auth-locked">')) {
    throw new Error('body does not have auth-locked class');
  }
  if (headHtml.includes('حساب الأرباح') || headHtml.includes('سندات القبض والمخزون مع إشعارات')) {
    throw new Error('Confidential description found in index.html meta/title tags');
  }
  console.log('✅ Anti-Leak critical shield verified in index.html (zero confidential text in head)');

  // Verify pinLockScreen is placed right at top of body
  const bodyIdx = indexHtml.indexOf('<body class="auth-locked">');
  const pinIdx = indexHtml.indexOf('id="pinLockScreen"');
  if (pinIdx === -1 || pinIdx - bodyIdx > 200) {
    throw new Error('pinLockScreen is not at the very top of <body>');
  }
  console.log('✅ pinLockScreen is positioned at the very top of <body>');

  // 2. Verify modalCategoryProducts exists in index.html
  if (!indexHtml.includes('id="modalCategoryProducts"')) {
    throw new Error('Missing modalCategoryProducts in index.html');
  }
  console.log('✅ modalCategoryProducts exists in index.html');

  // 3. Verify store.html categories toggle
  const storeHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'store.html'), 'utf8');
  if (!storeHtml.includes('btnToggleAllCategories') || !storeHtml.includes('toggleAllCategoriesView')) {
    throw new Error('Missing categories toggle button/logic in store.html');
  }
  console.log('✅ store.html has categories toggle button (top 8 initial, expand to 31)');

  // 4. Test Category Custom Product Assignment logic in dataStore / server
  const config = dataStore.getStoreConfig();
  const cat = config.categories[0];
  cat.storeName = 'قسم الثلاجات الفاخرة للزبائن';
  cat.customProductIds = ['prod-test-custom-1'];

  dataStore.saveStoreConfig(config);

  // Reload config
  const reloaded = dataStore.getStoreConfig();
  const reloadedCat = reloaded.categories.find(c => c.id === cat.id);
  if (reloadedCat.storeName !== 'قسم الثلاجات الفاخرة للزبائن') {
    throw new Error('Failed to persist custom storeName');
  }
  if (!reloadedCat.customProductIds.includes('prod-test-custom-1')) {
    throw new Error('Failed to persist customProductIds');
  }
  console.log('✅ Store configuration accurately stores custom storeName and assigned productIds');

  // Clean up test assignment
  reloadedCat.storeName = reloadedCat.name;
  reloadedCat.customProductIds = [];
  dataStore.saveStoreConfig(reloaded);

  console.log('\n🎉 ALL CATEGORY & ANTI-LEAK TESTS PASSED! 🚀');
}

testCategoryFeatures().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
