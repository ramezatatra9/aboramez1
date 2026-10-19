const fs = require('fs');
const path = require('path');

// 1. Load category helper
const { categorizeProduct, getDefaultImageForCategory } = require('../categoryHelper');

// 2. Brand detection patterns (matching app.js)
const KNOWN_BRANDS = [
  { brand: 'LG',           brandAr: 'ال جي (LG)',           patterns: [/\bal\s*g[ei]\b/i, /\bال\s*جي\b/, /\blg\b/i] },
  { brand: 'Samsung',      brandAr: 'سامسونج',              patterns: [/samsung/i, /سامسونج/, /سامسونغ/] },
  { brand: 'Beko',         brandAr: 'بيكو',                 patterns: [/beko/i, /بيكو/] },
  { brand: 'Simfer',       brandAr: 'سيمفير / سمفير',       patterns: [/simfer/i, /سيمفير/, /سمفير/] },
  { brand: 'Manger Home',  brandAr: 'منجر هوم / مانجر',    patterns: [/manger\s*home/i, /منجر\s*هوم/, /مانجر\s*هوم/] },
  { brand: 'RAF',          brandAr: 'راف (RAF)',             patterns: [/\braf\b/i, /\bراف\b/] },
  { brand: 'Luxor',        brandAr: 'لوكسر',                patterns: [/luxor/i, /لوكسر/, /لوكسور/] },
  { brand: 'Zacash',       brandAr: 'زكش / زاكاش',          patterns: [/zacash/i, /زكش/, /زاكاش/] },
  { brand: 'Lawrence',     brandAr: 'لورنس',                patterns: [/lawrence/i, /لورنس/] },
  { brand: 'Universal',    brandAr: 'يونيفرسال',            patterns: [/universal/i, /يونيفرسال/] },
  { brand: 'Haier',        brandAr: 'هاير',                 patterns: [/haier/i, /هاير/] },
  { brand: 'Midea',        brandAr: 'ميديا',                patterns: [/midea/i, /ميديا/] },
  { brand: 'Sharp',        brandAr: 'شارب',                 patterns: [/sharp/i, /شارب/] },
  { brand: 'TCL',          brandAr: 'تي سي ال',             patterns: [/\btcl\b/i, /تي\s*سي\s*ال/] },
  { brand: 'Bompani',      brandAr: 'بومباني',              patterns: [/bompani/i, /بومباني/] },
  { brand: 'Crest',        brandAr: 'كريست',                patterns: [/\bcrest\b/i, /\bكريست\b/] },
  { brand: 'Trust',        brandAr: 'ترست',                 patterns: [/\btrust\b/i, /\bترست\b/] },
  { brand: 'Candy',        brandAr: 'كاندي',                patterns: [/\bcandy\b/i, /\bكاندي\b/] },
  { brand: 'Tefal',        brandAr: 'تيفال',                patterns: [/tefal/i, /تيفال/] },
  { brand: 'Hisense',      brandAr: 'هايسنس',              patterns: [/hisense/i, /هايسنس/] },
  { brand: 'Atlantic',     brandAr: 'اتلانتيك',            patterns: [/atlantic/i, /اتلانتيك/] },
  { brand: 'Dahua',        brandAr: 'دهوا',                 patterns: [/dahua/i, /دهوا/] },
  { brand: 'KMG',          brandAr: 'كي ام جي',            patterns: [/\bkmg\b/i, /كي\s*ام\s*جي/] },
  { brand: 'Matrix',       brandAr: 'ماتركس',               patterns: [/matrix/i, /ماتركس/] },
  { brand: 'Prestige',     brandAr: 'برستيج',               patterns: [/prestige/i, /برستيج/] },
  { brand: 'General Lux',  brandAr: 'جنرال لوكس',          patterns: [/general\s*lux/i, /جنرال\s*لوكس/] },
  { brand: 'General Queen',brandAr: 'جنرال كوين',           patterns: [/general\s*queen/i, /جنرال\s*كوين/] },
  { brand: 'Samex',        brandAr: 'سامكس',                patterns: [/samex/i, /سامكس/] },
  { brand: 'Molar',        brandAr: 'مولار',                patterns: [/molar/i, /مولار/] },
  { brand: 'ADC',          brandAr: 'ADC',                  patterns: [/\badc\b/i] },
  { brand: 'iPlug',        brandAr: 'ايبلوج',               patterns: [/iplug/i, /آي\s*بلوج/, /ايبلوج/] }
];

function detectBrand(name) {
  if (!name) return { brand: 'أخرى', brandAr: 'أخرى / عام' };
  for (const b of KNOWN_BRANDS) {
    for (const pat of b.patterns) {
      if (pat.test(name)) {
        return { brand: b.brand, brandAr: b.brandAr };
      }
    }
  }
  return { brand: 'أخرى', brandAr: 'أخرى / عام' };
}

// 3. Load ShamelRealData items
const shamelFile = 'C:/Users/NTC/.gemini/antigravity-ide/scratch/shamel_real_products.json';
const shamelItems = JSON.parse(fs.readFileSync(shamelFile, 'utf8').replace(/^\uFEFF/, ''));

// 4. Load existing products.json to preserve images, categories and existing IDs
const currentProductsFile = path.join(__dirname, '..', 'data', 'products.json');
const currentProducts = JSON.parse(fs.readFileSync(currentProductsFile, 'utf8').replace(/^\uFEFF/, ''));
const currentMap = new Map();
currentProducts.forEach(p => {
  if (p.code) currentMap.set(p.code.trim().toUpperCase(), p);
});

// Backup current products.json
const backupDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, 'products_pre_rebuild_backup.json'), JSON.stringify(currentProducts, null, 2), 'utf8');
console.log('✅ Backed up current products.json');

const now = new Date().toISOString();
const rebuiltProducts = [];

for (const sh of shamelItems) {
  const code = String(sh.code).trim();
  const codeKey = code.toUpperCase();
  const existing = currentMap.get(codeKey);

  // Exact names and prices from ShamelRealData
  const name = String(sh.name).trim();
  const costPrice = Math.max(0, Math.round(Number(sh.costPrice) * 100) / 100);
  const sellPrice = Math.max(0, Math.round(Number(sh.sellPrice) * 100) / 100);
  const stock = Math.max(0, parseInt(sh.stock) || 0);
  const barcode = String(sh.barcode || '').trim();
  const isSuspended = Boolean(sh.isSuspended);

  // Determine Category
  let mainCategory, category, image;
  if (existing && existing.category && existing.category !== 'عام') {
    mainCategory = existing.mainCategory || 'أجهزة كهربائية كبيرة';
    category = existing.category;
    image = existing.image;
  } else {
    const catRes = categorizeProduct(name);
    mainCategory = catRes.main;
    category = catRes.sub;
    image = (existing && existing.image) ? existing.image : getDefaultImageForCategory(catRes.sub);
  }

  // Determine Brand
  let brand = 'أخرى';
  let brandAr = 'أخرى / عام';
  if (existing && existing.brand && existing.brand !== 'أخرى') {
    brand = existing.brand;
    brandAr = existing.brandAr || existing.brand;
  } else {
    const bRes = detectBrand(name);
    brand = bRes.brand;
    brandAr = bRes.brandAr;
  }

  const id = existing ? existing.id : 'prod-' + code.toLowerCase().replace(/[^a-z0-9]/g, '');

  const productObj = {
    id: id,
    code: code,
    name: name,
    brand: brand,
    brandAr: brandAr,
    mainCategory: mainCategory,
    category: category,
    costPrice: costPrice,
    sellPrice: sellPrice,
    stock: stock,
    image: image || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80',
    description: (existing && existing.description) ? existing.description : `${name} (كود: ${code})`,
    barcode: barcode,
    unit: 'قطعة',
    isSuspended: isSuspended,
    createdAt: existing && existing.createdAt ? existing.createdAt : now,
    updatedAt: now,
    lastSyncAt: now,
    lastStockUpdate: now,
    lastStockEditor: 'إعادة بناء نظيفة من الشامل (ShamelRealData)'
  };

  rebuiltProducts.push(productObj);
}

console.log(`Rebuilt total products: ${rebuiltProducts.length} (Expected from Shamel: ${shamelItems.length})`);

// Write rebuilt products.json
fs.writeFileSync(currentProductsFile, JSON.stringify(rebuiltProducts, null, 2), 'utf8');
console.log('✅ products.json updated successfully!');

// Update sync_meta.json
const syncMetaFile = path.join(__dirname, '..', 'data', 'sync_meta.json');
fs.writeFileSync(syncMetaFile, JSON.stringify({
  lastSyncAt: now,
  mode: 'full_clean_rebuild',
  itemsReceived: rebuiltProducts.length,
  created: rebuiltProducts.length,
  updated: 0,
  unchanged: 0
}, null, 2), 'utf8');
console.log('✅ sync_meta.json updated successfully!');
