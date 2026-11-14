const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_CONFIG_FILE = path.join(DATA_DIR, 'store_config.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Default high quality category images for home appliances
const DEFAULT_CATEGORY_IMAGES = {
  'غازات وطباخات': 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=600&auto=format&fit=crop&q=80',
  'غسالات': 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&auto=format&fit=crop&q=80',
  'ثلاجات': 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&auto=format&fit=crop&q=80',
  'شاشات وتلفزيونات': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop&q=80',
  'مكانس كهربائية': 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&auto=format&fit=crop&q=80',
  'صوبات وتدفئة': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600&auto=format&fit=crop&q=80',
  'أفران وميكرويف': 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=600&auto=format&fit=crop&q=80',
  'مراوح': 'https://images.unsplash.com/photo-1618941716939-553df3c6c278?w=600&auto=format&fit=crop&q=80',
  'مكيفات': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&auto=format&fit=crop&q=80',
  'بلندرات وخلاطات': 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=600&auto=format&fit=crop&q=80',
  'مقالي وشوايات': 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=80',
  'فريزرات': 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80',
  'شفاطات': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80',
  'إلكترونيات ومُلحقات': 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&auto=format&fit=crop&q=80',
  'أخرى متنوعة': 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80'
};

// Default brand logos / image representations
const DEFAULT_BRAND_LOGOS = {
  'Samsung': 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&auto=format&fit=crop&q=80',
  'LG': 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400&auto=format&fit=crop&q=80',
  'Beko': 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=400&auto=format&fit=crop&q=80',
  'Sharp': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&auto=format&fit=crop&q=80',
  'Haier': 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=400&auto=format&fit=crop&q=80',
  'Universal': 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400&auto=format&fit=crop&q=80',
  'Crest': 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=400&auto=format&fit=crop&q=80',
  'Trust': 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&auto=format&fit=crop&q=80',
  'Lawrence': 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=400&auto=format&fit=crop&q=80',
  'ADC': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&auto=format&fit=crop&q=80',
  'Mega': 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&auto=format&fit=crop&q=80',
  'KMG': 'https://images.unsplash.com/photo-1618941716939-553df3c6c278?w=400&auto=format&fit=crop&q=80',
  'Midea': 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400&auto=format&fit=crop&q=80',
  'Atlantic': 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=400&auto=format&fit=crop&q=80',
  'Simfer': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&auto=format&fit=crop&q=80'
};

// Read current products to populate actual categories and brands
let prods = [];
try {
  prods = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8'));
} catch (e) {}

const foundCats = new Map();
const foundBrands = new Map();

prods.forEach(p => {
  const c = (p.category || p.classification || 'أخرى متنوعة').trim();
  const b = (p.brand || 'أخرى').trim();
  const inStock = (parseInt(p.stock) || 0) > 0;
  if (!foundCats.has(c)) foundCats.set(c, { count: 0, inStockCount: 0 });
  foundCats.get(c).count++;
  if (inStock) foundCats.get(c).inStockCount++;

  if (!foundBrands.has(b)) foundBrands.set(b, { count: 0, inStockCount: 0 });
  foundBrands.get(b).count++;
  if (inStock) foundBrands.get(b).inStockCount++;
});

// Build categories list
const categoriesList = [];
let catIdx = 1;
for (const [name, info] of foundCats.entries()) {
  if (info.count < 3 && info.inStockCount === 0) continue; // skip tiny obsolete categories
  categoriesList.push({
    id: 'cat_' + (catIdx++),
    name: name,
    image: DEFAULT_CATEGORY_IMAGES[name] || 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&auto=format&fit=crop&q=80',
    isVisible: true,
    sortOrder: catIdx
  });
}

// Build brands list
const brandsList = [];
let bIdx = 1;
for (const [name, info] of foundBrands.entries()) {
  if (name === 'أخرى' || (info.count < 4 && info.inStockCount === 0)) continue;
  brandsList.push({
    id: 'brand_' + (bIdx++),
    name: name,
    logo: DEFAULT_BRAND_LOGOS[name] || '',
    isVisible: true,
    sortOrder: bIdx
  });
}

// Build initial store config
const storeConfig = {
  storeSettings: {
    heroTitle: 'كل ما يحتاجه بيتك، في مكان واحد.',
    heroSubtitle: 'معرض الأجهزة الكهربائية والمنزلية المعتمد • أفضل الموديلات والأسعار المكفولة مع إمكانية الطلب المباشر والتوصيل لكافة المناطق',
    heroBadge: '🌟 المعرض المعتمد 2026',
    announcementText: '🚚 توصيل سريع لكافة المناطق والدفع عند الاستلام • 🛡️ بضاعة أصلية ومكفولة بالكامل • 💬 خدمة عملاء مباشرة',
    announcementActive: true,
    phone: '0599000000',
    whatsapp: '0599000000',
    address: 'جنين / يعبد - الشارع الرئيسي',
    workHours: 'يومياً من 8:00 صباحاً حتى 9:00 مساءً',
    currency: 'شيكل',
    showOnlyInStock: true
  },
  categories: categoriesList,
  brands: brandsList,
  offers: [
    {
      id: 'offer_1',
      title: 'عروض الأجهزة الكهربائية الكبرى',
      subtitle: 'حسومات حصرية على تشكيلة الغسالات والثلاجات والغازات الأصلية',
      badge: '🔥 عرض خاص لفترة محدودة',
      image: 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=800&auto=format&fit=crop&q=80',
      discountText: 'أسعار مخفضة ومكفولة',
      linkCategory: 'غازات وطباخات',
      isVisible: true,
      sortOrder: 1
    },
    {
      id: 'offer_2',
      title: 'تجهيز البيت الجديد بالكامل',
      subtitle: 'باقات متكاملة لتجهيز المنازل بأحدث الأجهزة مع كفالة شاملة وتوصيل مجاني',
      badge: '✨ باقات التوفير',
      image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&auto=format&fit=crop&q=80',
      discountText: 'عروض خاصة للعرسان',
      linkCategory: 'ثلاجات',
      isVisible: true,
      sortOrder: 2
    }
  ],
  popupOffer: {
    enabled: true,
    title: '🎉 مرحباً بكم في المعرض والمتجر الرسمي!',
    subtitle: 'تصفح أحدث الأجهزة المنزلية والكهربائية المتوفرة بالمستودع بأسعار معتمدة ومكفولة. اختر ما يناسبك واطلب مباشرة بسهولة وأمان.',
    badge: 'عرض خاص وحصري',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80',
    buttonText: 'تصفّح أقسام المعرض الآن',
    buttonLink: '#categoriesSection'
  },
  customProductNames: {},
  manuallyShownOutOfStock: []
};

// Write store_config.json if not existing or initialize
fs.writeFileSync(STORE_CONFIG_FILE, JSON.stringify(storeConfig, null, 2), 'utf8');
console.log('✅ store_config.json initialized with', categoriesList.length, 'categories and', brandsList.length, 'brands');

// Initialize orders.json if not exists
if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf8');
  console.log('✅ orders.json initialized');
} else {
  console.log('ℹ️ orders.json already exists');
}
