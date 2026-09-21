// importProducts.js
// سكربت استيراد وتصنيف الأصناف هرمياً: 5 تصنيفات كبرى يتفرع من كل منها تصنيفات فرعية
// التصنيفات حسب تعريف صاحب المعرض

const fs = require('fs');
const path = require('path');

const CSV_PATH = 'C:/Users/NTC/Desktop/استعلام الاصناف_9_9_2026  46 21.csv';
const PRODUCTS_JSON = path.join(__dirname, 'data', 'products.json');

// صور تمثيلية لكل تصنيف فرعي
const categoryImages = {
  // أجهزة كهربائية كبيرة
  'غسالات': 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=500&auto=format&fit=crop&q=80',
  'نشافات': 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=500&auto=format&fit=crop&q=80',
  'ثلاجات': 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=500&auto=format&fit=crop&q=80',
  'فريزرات': 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=500&auto=format&fit=crop&q=80',
  'جلايات': 'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=500&auto=format&fit=crop&q=80',
  'غازات وطباخات': 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=500&auto=format&fit=crop&q=80',
  'شاشات وتلفزيونات': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=500&auto=format&fit=crop&q=80',
  'شفاطات': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=500&auto=format&fit=crop&q=80',
  'مكيفات': 'https://images.unsplash.com/photo-1614633833026-0620459c5d26?w=500&auto=format&fit=crop&q=80',

  // أدوات مطبخ
  'عجانات': 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500&auto=format&fit=crop&q=80',
  'مقالي وشوايات': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&auto=format&fit=crop&q=80',
  'كولرات مياه': 'https://images.unsplash.com/photo-1599814516280-e7543cb9ddb7?w=500&auto=format&fit=crop&q=80',
  'عصارات': 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500&auto=format&fit=crop&q=80',
  'مستلزمات القهوة': 'https://images.unsplash.com/photo-1517668808822-9ebb02ae2a0e?w=500&auto=format&fit=crop&q=80',
  'بلندرات وخلاطات': 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500&auto=format&fit=crop&q=80',
  'فرامات': 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500&auto=format&fit=crop&q=80',
  'أفران وميكرويف': 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=500&auto=format&fit=crop&q=80',
  'أواني وطناجر': 'https://images.unsplash.com/photo-1584990347449-3990d0b00516?w=500&auto=format&fit=crop&q=80',
  'توست وساندويش': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&auto=format&fit=crop&q=80',
  'غلايات': 'https://images.unsplash.com/photo-1517668808822-9ebb02ae2a0e?w=500&auto=format&fit=crop&q=80',

  // أدوات منزل
  'مكانس كهربائية': 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500&auto=format&fit=crop&q=80',
  'مكاوي': 'https://images.unsplash.com/photo-1523731407965-2430cd12f5e4?w=500&auto=format&fit=crop&q=80',
  'مراوح': 'https://images.unsplash.com/photo-1614633833026-0620459c5d26?w=500&auto=format&fit=crop&q=80',
  'صوبات وتدفئة': 'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=500&auto=format&fit=crop&q=80',
  'إضاءة وأجهزة منزلية': 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500&auto=format&fit=crop&q=80',

  // أدوات شخصية
  'سشوارات': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&auto=format&fit=crop&q=80',
  'ستريترات وتمليس': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&auto=format&fit=crop&q=80',
  'ماكينات حلاقة': 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=500&auto=format&fit=crop&q=80',

  // أخرى
  'سماعات': 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=80',
  'إلكترونيات ومُلحقات': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
  'أخرى متنوعة': 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=80'
};

/**
 * ترتيب التصنيف الهرمي الدقيق حسب تعريف صاحب المعرض:
 *
 * 1. أجهزة كهربائية كبيرة: غسالات - ثلاجات - نشافات - جلايات - شاشات - غازات - شفاطات - فريزرات (+ مكيفات)
 * 2. أدوات مطبخ:           عجانات - مقالي - كولرات - عصارات - مستلزمات القهوة - بلندرات - خلاطات - فرامات
 * 3. أدوات منزل:           مكنسة - مكوى
 * 4. أدوات شخصية:          سشوار - ستريتر - ماكنة حلاقة
 * 5. أخرى:                  الباقي
 */
function categorizeProduct(name) {
  const n = name.toLowerCase();

  // ===== 1. أجهزة كهربائية كبيرة =====

  // غسالات
  if (n.includes('غسالة')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'غسالات' };
  }
  // نشافات
  if (n.includes('نشافة')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'نشافات' };
  }
  // ثلاجات
  if (n.includes('ثلاجة') || n.includes('براد')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'ثلاجات' };
  }
  // فريزرات
  if (n.includes('فريزر')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'فريزرات' };
  }
  // جلايات
  if (n.includes('جلاية')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'جلايات' };
  }
  // شاشات وتلفزيونات ورسيفر
  if (n.includes('شاشة') || n.includes('تلفزيون') || n.includes('تلفاز') || n.includes('رسيفر') || n.includes('ساوند بار') || n.includes('بروجكتر')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'شاشات وتلفزيونات' };
  }
  // غازات وطباخات (بما في ذلك الأفران الكبيرة البلد إن والغاز الكبير)
  if (n.includes('غاز') || n.includes('طباخ') || (n.includes('فرن') && (n.includes('بلد ان') || n.includes('90') || n.includes('60') || n.includes('50') || n.includes('غاز') || n.includes('اتلانتيك') || n.includes('بيكو') || n.includes('ارسون') || n.includes('دلتا') || n.includes('هاير') || n.includes('سوبر') || n.includes('منار') || n.includes('لورنس')))) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'غازات وطباخات' };
  }
  // شفاطات ومداخن
  if (n.includes('شفاط') || n.includes('مدخنة') || n.includes('مداخن')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'شفاطات' };
  }
  // مكيفات
  if (n.includes('مكيف') || n.includes('انفرتر')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'مكيفات' };
  }

  // ===== 2. أدوات مطبخ =====

  // عجانات
  if (n.includes('عجانة') || n.includes('عجان')) {
    return { main: 'أدوات مطبخ', sub: 'عجانات' };
  }
  // مقالي وشوايات (كهربائية)
  if (n.includes('مقلى') || n.includes('قلاية') || n.includes('مقلاة') || n.includes('شواية') || n.includes('وافل') || n.includes('كريب') || n.includes('هوت دوج')) {
    return { main: 'أدوات مطبخ', sub: 'مقالي وشوايات' };
  }
  // كولرات مياه
  if (n.includes('كولر')) {
    return { main: 'أدوات مطبخ', sub: 'كولرات مياه' };
  }
  // عصارات
  if (n.includes('عصارة') || n.includes('عصير')) {
    return { main: 'أدوات مطبخ', sub: 'عصارات' };
  }
  // مستلزمات القهوة (ماكينات قهوة، غلايات قهوة، مطحنة قهوة، موكا)
  if (n.includes('قهوة') || n.includes('سبرسو') || n.includes('اسبريسو') || n.includes('مطحنة') || n.includes('موكا') || n.includes('كبسول')) {
    return { main: 'أدوات مطبخ', sub: 'مستلزمات القهوة' };
  }
  // بلندرات وخلاطات
  if (n.includes('بلندر') || n.includes('خلاط') || n.includes('هاند بلندر') || n.includes('خفاقة') || n.includes('خفاق')) {
    return { main: 'أدوات مطبخ', sub: 'بلندرات وخلاطات' };
  }
  // فرامات
  if (n.includes('فرامة') || n.includes('فراخ') || n.includes('فرام') || n.includes('ملوخية')) {
    return { main: 'أدوات مطبخ', sub: 'فرامات' };
  }
  // محضرات طعام (شاملة متعددة الوظائف)
  if (n.includes('محضر طعام') || n.includes('فود بروسيسر')) {
    return { main: 'أدوات مطبخ', sub: 'فرامات' };
  }
  // ميكرويف وأفران صغيرة كهربائية
  if (n.includes('ميكرويف') || n.includes('مايكرويف') || n.includes('فرن')) {
    return { main: 'أدوات مطبخ', sub: 'أفران وميكرويف' };
  }
  // توست وساندويش
  if (n.includes('توست') || n.includes('ساندويش')) {
    return { main: 'أدوات مطبخ', sub: 'توست وساندويش' };
  }
  // غلايات وكتل مياه
  if (n.includes('غلاية') || n.includes('كمكم') || n.includes('ابريق') || n.includes('ترمس')) {
    return { main: 'أدوات مطبخ', sub: 'غلايات' };
  }
  // أواني وطناجر
  if (n.includes('طنجرة') || n.includes('طناجر') || n.includes('طقم طناجر')) {
    return { main: 'أدوات مطبخ', sub: 'أواني وطناجر' };
  }

  // ===== 3. أدوات منزل =====

  // مكانس
  if (n.includes('مكنسة') || n.includes('تنظيف')) {
    return { main: 'أدوات منزل', sub: 'مكانس كهربائية' };
  }
  // مكاوي
  if (n.includes('مكوى') || n.includes('مكواة') || n.includes('كواية')) {
    return { main: 'أدوات منزل', sub: 'مكاوي' };
  }
  // مراوح
  if (n.includes('مروحة') || n.includes('مراوح') || n.includes('هواية')) {
    return { main: 'أدوات منزل', sub: 'مراوح' };
  }
  // صوبات وتدفئة
  if (n.includes('صوبة') || n.includes('مدفأة') || n.includes('دفاية') || n.includes('رديتر') || n.includes('هيتر')) {
    return { main: 'أدوات منزل', sub: 'صوبات وتدفئة' };
  }
  // إضاءة وأجهزة منزلية أخرى
  if (n.includes('قاتل حشرات') || n.includes('حشرات') || n.includes('ناموس') || n.includes('لمبة') || n.includes('كشاف') || n.includes('مضخة')) {
    return { main: 'أدوات منزل', sub: 'إضاءة وأجهزة منزلية' };
  }

  // ===== 4. أدوات شخصية =====

  // سشوارات
  if (n.includes('سشوار') || n.includes('استشوار') || n.includes('مجفف شعر')) {
    return { main: 'أدوات شخصية', sub: 'سشوارات' };
  }
  // ستريترات وتمليس
  if (n.includes('ستريتر') || n.includes('تمليس') || n.includes('فرشاة شعر') || n.includes('كيرلي') || n.includes('فردة') || n.includes('مشاطة')) {
    return { main: 'أدوات شخصية', sub: 'ستريترات وتمليس' };
  }
  // ماكينات حلاقة
  if (n.includes('ماكنة حلاقة') || n.includes('ازالة شعر') || n.includes('تشذيب') || n.includes('حلاقة') || n.includes('شعر ستاتي') || n.includes('فيليبس') && (n.includes('حلاقة') || n.includes('شعر'))) {
    return { main: 'أدوات شخصية', sub: 'ماكينات حلاقة' };
  }
  // ميزان وصحة
  if (n.includes('ميزان') || n.includes('ضغط الدم') || n.includes('سكر')) {
    return { main: 'أدوات شخصية', sub: 'أجهزة صحية' };
  }

  // ===== 5. أخرى =====

  // سماعات وصوتيات
  if (n.includes('سماعة') || n.includes('سبيكر') || n.includes('صب اوفر') || n.includes('راديو')) {
    return { main: 'أخرى', sub: 'سماعات' };
  }
  // إلكترونيات وملحقات
  if (n.includes('كاميرا') || n.includes('راوتر') || n.includes('سلك') || n.includes('شاحن') || n.includes('بطارية') || n.includes('تحويلة') || n.includes('باور بانك') || n.includes('كوابل') || n.includes('يو اس بي')) {
    return { main: 'أخرى', sub: 'إلكترونيات ومُلحقات' };
  }

  // الباقي كله في أخرى
  return { main: 'أخرى', sub: 'أخرى متنوعة' };
}

function calculateSuggestedSellPrice(cost) {
  if (cost <= 0) return 0;
  let mult;
  if (cost < 100) mult = 1.25;
  else if (cost < 500) mult = 1.20;
  else if (cost < 2000) mult = 1.15;
  else mult = 1.12;

  const rawPrice = cost * mult;
  return Math.max(cost, Math.round(rawPrice / 5) * 5);
}

function importCSV() {
  console.log('Reading CSV...');
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const products = [];
  const now = new Date().toISOString();
  const counters = {};

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 3) continue;

    const code = parts[0].trim();
    const name = parts[1].trim();
    const rawCost = parts[2].replace(/,/g, '').trim();
    const costPrice = parseFloat(rawCost) || 0;
    const sellPrice = calculateSuggestedSellPrice(costPrice);
    const catResult = categorizeProduct(name);
    const image = categoryImages[catResult.sub] || categoryImages['أخرى متنوعة'];

    counters[catResult.main] = counters[catResult.main] || {};
    counters[catResult.main][catResult.sub] = (counters[catResult.main][catResult.sub] || 0) + 1;

    products.push({
      id: `prod-${code.toLowerCase()}`,
      code: code,
      name: name,
      mainCategory: catResult.main,
      category: catResult.sub,
      costPrice: costPrice,
      sellPrice: sellPrice,
      stock: 10,
      image: image,
      description: `${name} (كود: ${code})`,
      createdAt: now
    });
  }

  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(products, null, 2), 'utf8');
  console.log(`\nExported ${products.length} products to ${PRODUCTS_JSON}`);
  console.log('\nDistribution:');
  Object.entries(counters).forEach(([main, subs]) => {
    const total = Object.values(subs).reduce((a, b) => a + b, 0);
    console.log(`\n  [${main}] (${total} صنف)`);
    Object.entries(subs).sort((a,b) => b[1]-a[1]).forEach(([sub, count]) => {
      console.log(`    - ${sub}: ${count}`);
    });
  });
}

importCSV();
