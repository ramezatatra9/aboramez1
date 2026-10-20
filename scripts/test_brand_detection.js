const fs = require('fs');
const path = require('path');

const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));

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

module.exports = {
  detectBrand,
  BRAND_DEFS
};

if (require.main === module) {
  const counts = {};
  products.forEach(p => {
    const res = detectBrand(p.name);
    counts[res.brand] = (counts[res.brand] || 0) + 1;
  });

  console.log('Results with makeBoundary:');
  console.log(Object.entries(counts).sort((a,b) => b[1] - a[1]));
}
