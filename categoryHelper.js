// categoryHelper.js
// تصنيف هرمي تلقائي للمنتجات الجديدة القادمة من الشامل

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

function categorizeProduct(name) {
  if (!name) return { main: 'أخرى', sub: 'أخرى متنوعة' };
  const n = String(name).toLowerCase();

  // 1. أجهزة كهربائية كبيرة
  if (n.includes('غسالة')) return { main: 'أجهزة كهربائية كبيرة', sub: 'غسالات' };
  if (n.includes('نشافة')) return { main: 'أجهزة كهربائية كبيرة', sub: 'نشافات' };
  if (n.includes('ثلاجة') || n.includes('براد')) return { main: 'أجهزة كهربائية كبيرة', sub: 'ثلاجات' };
  if (n.includes('فريزر')) return { main: 'أجهزة كهربائية كبيرة', sub: 'فريزرات' };
  if (n.includes('جلاية')) return { main: 'أجهزة كهربائية كبيرة', sub: 'جلايات' };
  if (n.includes('شاشة') || n.includes('تلفزيون') || n.includes('تلفاز') || n.includes('رسيفر') || n.includes('بروجكتر')) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'شاشات وتلفزيونات' };
  }
  if (n.includes('غاز') || n.includes('طباخ') || (n.includes('فرن') && (n.includes('بلد ان') || n.includes('90') || n.includes('60')))) {
    return { main: 'أجهزة كهربائية كبيرة', sub: 'غازات وطباخات' };
  }
  if (n.includes('شفاط') || n.includes('مدخنة')) return { main: 'أجهزة كهربائية كبيرة', sub: 'شفاطات' };
  if (n.includes('مكيف') || n.includes('انفرتر')) return { main: 'أجهزة كهربائية كبيرة', sub: 'مكيفات' };

  // 2. أدوات مطبخ
  if (n.includes('عجانة') || n.includes('عجان')) return { main: 'أدوات مطبخ', sub: 'عجانات' };
  if (n.includes('مقلى') || n.includes('قلاية') || n.includes('مقلاة') || n.includes('شواية') || n.includes('وافل')) {
    return { main: 'أدوات مطبخ', sub: 'مقالي وشوايات' };
  }
  if (n.includes('كولر')) return { main: 'أدوات مطبخ', sub: 'كولرات مياه' };
  if (n.includes('عصارة') || n.includes('عصير')) return { main: 'أدوات مطبخ', sub: 'عصارات' };
  if (n.includes('قهوة') || n.includes('سبرسو') || n.includes('اسبريسو') || n.includes('مطحنة') || n.includes('موكا')) {
    return { main: 'أدوات مطبخ', sub: 'مستلزمات القهوة' };
  }
  if (n.includes('بلندر') || n.includes('خلاط') || n.includes('خفاق')) return { main: 'أدوات مطبخ', sub: 'بلندرات وخلاطات' };
  if (n.includes('فرامة') || n.includes('فود بروسيسر') || n.includes('محضر طعام')) return { main: 'أدوات مطبخ', sub: 'فرامات' };
  if (n.includes('ميكرويف') || n.includes('مايكرويف') || n.includes('فرن')) return { main: 'أدوات مطبخ', sub: 'أفران وميكرويف' };
  if (n.includes('توست') || n.includes('ساندويش')) return { main: 'أدوات مطبخ', sub: 'توست وساندويش' };
  if (n.includes('غلاية') || n.includes('كمكم') || n.includes('ابريق')) return { main: 'أدوات مطبخ', sub: 'غلايات' };
  if (n.includes('طنجرة') || n.includes('طناجر')) return { main: 'أدوات مطبخ', sub: 'أواني وطناجر' };

  // 3. أدوات منزل
  if (n.includes('مكنسة') || n.includes('تنظيف')) return { main: 'أدوات منزل', sub: 'مكانس كهربائية' };
  if (n.includes('مكوى') || n.includes('مكواة') || n.includes('كواية')) return { main: 'أدوات منزل', sub: 'مكاوي' };
  if (n.includes('مروحة') || n.includes('مراوح')) return { main: 'أدوات منزل', sub: 'مراوح' };
  if (n.includes('صوبة') || n.includes('مدفأة') || n.includes('دفاية') || n.includes('رديتر')) return { main: 'أدوات منزل', sub: 'صوبات وتدفئة' };
  if (n.includes('قاتل حشرات') || n.includes('لمبة') || n.includes('كشاف')) return { main: 'أدوات منزل', sub: 'إضاءة وأجهزة منزلية' };

  // 4. أدوات شخصية
  if (n.includes('سشوار') || n.includes('استشوار') || n.includes('مجفف شعر')) return { main: 'أدوات شخصية', sub: 'سشوارات' };
  if (n.includes('ستريتر') || n.includes('تمليس') || n.includes('فرشاة شعر') || n.includes('كيرلي')) return { main: 'أدوات شخصية', sub: 'ستريترات وتمليس' };
  if (n.includes('ماكنة حلاقة') || n.includes('حلاقة') || n.includes('تشذيب')) return { main: 'أدوات شخصية', sub: 'ماكينات حلاقة' };

  // 5. أخرى
  if (n.includes('سماعة') || n.includes('سبيكر') || n.includes('صب اوفر')) return { main: 'أخرى', sub: 'سماعات' };
  if (n.includes('كاميرا') || n.includes('راوتر') || n.includes('سلك') || n.includes('شاحن') || n.includes('بطارية')) {
    return { main: 'أخرى', sub: 'إلكترونيات ومُلحقات' };
  }

  return { main: 'أخرى', sub: 'أخرى متنوعة' };
}

function makeBoundary(str) {
  const escaped = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?:^|[^\\p{L}\\p{N}])' + escaped + '(?:$|[^\\p{L}\\p{N}])', 'iu');
}

const BRAND_DEFS = [
  { brand: 'Universal',     brandAr: 'يونيفرسال',          patterns: [makeBoundary('يونيفرسال'), makeBoundary('universal')] },
  { brand: 'Crest',         brandAr: 'كريست',              patterns: [makeBoundary('كريست'), makeBoundary('crest')] },
  { brand: 'LG',            brandAr: 'ال جي (LG)',         patterns: [makeBoundary('ال جي'), makeBoundary('الجي'), makeBoundary('lg')] },
  { brand: 'Trust',         brandAr: 'ترست',               patterns: [makeBoundary('ترست'), makeBoundary('trust')] },
  { brand: 'Lawrence',      brandAr: 'لورنس',              patterns: [makeBoundary('لورنس'), makeBoundary('lawrence')] },
  { brand: 'ADC',           brandAr: 'ADC',                patterns: [makeBoundary('adc'), makeBoundary('اي دي سي')] },
  { brand: 'Haier',         brandAr: 'هاير / هير',         patterns: [makeBoundary('هاير'), makeBoundary('هير'), makeBoundary('haier')] },
  { brand: 'Mega',          brandAr: 'ميجا',               patterns: [makeBoundary('ميجا'), makeBoundary('mega')] },
  { brand: 'Midea',         brandAr: 'ميديا',              patterns: [makeBoundary('ميديا'), makeBoundary('midea')] },
  { brand: 'KMG',           brandAr: 'كي ام جي',          patterns: [makeBoundary('كي ام جي'), makeBoundary('kmg')] },
  { brand: 'Yafa',          brandAr: 'يافا',               patterns: [makeBoundary('يافا'), makeBoundary('yafa')] },
  { brand: 'Atlantic',      brandAr: 'اتلانتيك',          patterns: [makeBoundary('اتلانتيك'), makeBoundary('atlantic')] },
  { brand: 'Samex',         brandAr: 'سامكس',              patterns: [makeBoundary('سامكس'), makeBoundary('ساميكس'), makeBoundary('samex')] },
  { brand: 'Samsung',       brandAr: 'سامسونج',            patterns: [makeBoundary('سامسونج'), makeBoundary('سامسونغ'), makeBoundary('samsung')] },
  { brand: 'TCL',           brandAr: 'تي سي ال',           patterns: [makeBoundary('تي سي ال'), makeBoundary('tcl')] },
  { brand: 'Simfer',        brandAr: 'سيمفير',             patterns: [makeBoundary('سيمفير'), makeBoundary('سمفير'), makeBoundary('simfer')] },
  { brand: 'Molar',         brandAr: 'مولار',              patterns: [makeBoundary('مولار'), makeBoundary('molar')] },
  { brand: 'General Lux',   brandAr: 'جنرال لوكس',        patterns: [makeBoundary('جنرال لوكس'), makeBoundary('جينرال لوكس'), makeBoundary('general lux')] },
  { brand: 'General Queen', brandAr: 'جنرال كوين',         patterns: [makeBoundary('جنرال كوين'), makeBoundary('جينرال كوين'), makeBoundary('general queen')] },
  { brand: 'Manger Home',   brandAr: 'منجر هوم',           patterns: [makeBoundary('منجر هوم'), makeBoundary('مانجر هوم'), makeBoundary('منجر'), makeBoundary('مانجر'), makeBoundary('manger')] },
  { brand: 'iPlug',         brandAr: 'ايبلوج',             patterns: [makeBoundary('ايبلوج'), makeBoundary('آي بلوج'), makeBoundary('iplug')] },
  { brand: 'Beko',          brandAr: 'بيكو',               patterns: [makeBoundary('بيكو'), makeBoundary('beko')] },
  { brand: 'Bompani',       brandAr: 'بومباني',            patterns: [makeBoundary('بومباني'), makeBoundary('bompani')] },
  { brand: 'RAF',           brandAr: 'راف (RAF)',           patterns: [makeBoundary('راف'), makeBoundary('raf')] },
  { brand: 'Magic',         brandAr: 'ماجيك',              patterns: [makeBoundary('ماجيك'), makeBoundary('magic')] },
  { brand: 'Dahua',         brandAr: 'دهوا',               patterns: [makeBoundary('دهوا'), makeBoundary('dahua')] },
  { brand: 'Luxor',         brandAr: 'لوكسر',              patterns: [makeBoundary('لوكسر'), makeBoundary('لوكسور'), makeBoundary('luxor')] },
  { brand: 'Sharp',         brandAr: 'شارب',               patterns: [makeBoundary('شارب'), makeBoundary('sharp')] },
  { brand: 'Tefal',         brandAr: 'تيفال',              patterns: [makeBoundary('تيفال'), makeBoundary('tefal')] },
  { brand: 'Candy',         brandAr: 'كاندي',              patterns: [makeBoundary('كاندي'), makeBoundary('candy')] },
  { brand: 'Vision',        brandAr: 'فيجين',              patterns: [makeBoundary('فيجين'), makeBoundary('vision')] },
  { brand: 'Matrix',        brandAr: 'ماتركس',             patterns: [makeBoundary('ماتركس'), makeBoundary('ماتريكس'), makeBoundary('matrix')] },
  { brand: 'Moulinex',      brandAr: 'مولينكس',            patterns: [makeBoundary('مولينكس'), makeBoundary('مولينيكس'), makeBoundary('moulinex')] },
  { brand: 'Jennar',        brandAr: 'جينار',              patterns: [makeBoundary('جينار'), makeBoundary('jennar')] },
  { brand: 'Tiger',         brandAr: 'تايجر',              patterns: [makeBoundary('تايجر'), makeBoundary('tiger')] },
  { brand: 'Prestige',      brandAr: 'برستيج',             patterns: [makeBoundary('برستيج'), makeBoundary('prestige')] },
  { brand: 'Infinity',      brandAr: 'انفينيتي',           patterns: [makeBoundary('انفينيتي'), makeBoundary('انفنتي'), makeBoundary('infinity')] },
  { brand: 'Ariston',       brandAr: 'اريستون',            patterns: [makeBoundary('اريستون'), makeBoundary('ariston')] },
  { brand: 'Konica',        brandAr: 'كونيكا',             patterns: [makeBoundary('كونيكا'), makeBoundary('konica')] },
  { brand: 'Cravit',        brandAr: 'كرافيت',             patterns: [makeBoundary('كرافيت'), makeBoundary('cravit')] },
  { brand: 'Zacash',        brandAr: 'زكش / زاكاش',        patterns: [makeBoundary('زكش'), makeBoundary('زاكاش'), makeBoundary('zacash')] },
  { brand: 'Hisense',       brandAr: 'هايسنس',            patterns: [makeBoundary('هايسنس'), makeBoundary('hisense')] },
  { brand: 'BaByliss',      brandAr: 'بيبي ليس',           patterns: [makeBoundary('بيبي ليس'), makeBoundary('babyliss')] },
  { brand: 'Philips',       brandAr: 'فيليبس',             patterns: [makeBoundary('فيليبس'), makeBoundary('philips')] }
];

function detectBrand(name) {
  try {
    const brandClassifier = require('./brandClassifier');
    const result = brandClassifier.analyzeProductBrand({ name });
    if (result && result.proposedBrand && result.proposedBrand !== 'أخرى') {
      return { brand: result.proposedBrand, brandAr: result.proposedBrandAr };
    }
  } catch (e) {
    // fallback
  }
  if (!name) return { brand: 'أخرى', brandAr: 'أخرى / عام' };
  for (const b of BRAND_DEFS) {
    for (const pat of b.patterns) {
      if (pat.test(name)) {
        return { brand: b.brand, brandAr: b.brandAr };
      }
    }
  }
  return { brand: 'أخرى', brandAr: 'أخرى / عام' };
}

function getDefaultImageForCategory(subCategory) {
  return categoryImages[subCategory] || categoryImages['أخرى متنوعة'];
}

module.exports = {
  categorizeProduct,
  getDefaultImageForCategory,
  categoryImages,
  detectBrand,
  BRAND_DEFS
};
