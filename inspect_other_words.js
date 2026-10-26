const fs = require('fs');

const products = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));

// Find frequently occurring words in products under "أخرى"
const wordCounts = {};
const skipWords = new Set([
  'غسالة', 'نشافة', 'ثلاجة', 'براد', 'فريزر', 'جلاية', 'غاز', 'طباخ', 'فرن', 'شاشة', 
  'تلفزيون', 'رسيفر', 'شفاط', 'مكيف', 'عجانة', 'مقلى', 'قلاية', 'كولر', 'عصارة', 
  'خلاط', 'بلندر', 'فرامة', 'ميكرويف', 'توست', 'غلاية', 'طنجرة', 'طناجر', 'مكنسة', 
  'مكوى', 'مروحة', 'صوبة', 'سشوار', 'ستريتر', 'ماكنة', 'حلاقة', 'سماعة', 'كاميرا', 
  'سلك', 'كابل', 'شاحن', 'كيلو', 'لتر', 'بوصة', 'سم', 'متر', 'اسود', 'ابيض', 'سلفر', 
  'ستانلس', 'فراشي', 'حديد', 'بني', 'احمر', 'ازرق', 'رمادي', 'شيكل', 'مع', 'من', 'في', 
  'على', 'او', 'أو', 'حوضين', 'كهرباء', 'طاقة', 'ريموت', 'كبير', 'صغير', 'وسط', 'عادي', 
  'انفيرتر', 'انفرتر', 'ديجيتال', 'سمارت', 'قواعد', 'ستاند', 'حامل', 'قاعدة', 'مدخل', 
  'مداخل', 'شفرات', 'قطع', 'قطعة', 'طقم', 'جهاز', 'مايكرويف', 'يدوي', 'ارضية', 'عمود', 
  'حائط', 'سقف', 'حبل', 'لمبة', 'ضوء', 'كشاف', 'ليزر', 'بطارية', 'مفتاح', 'ساعة', 'ميزان'
]);

products.filter(p => p.brand === 'أخرى' || !p.brand).forEach(p => {
  const words = p.name.split(/[\s,()\/+\-]+/);
  words.forEach(w => {
    const clean = w.trim();
    if (clean.length > 2 && !skipWords.has(clean) && !/^\d+$/.test(clean)) {
      wordCounts[clean] = (wordCounts[clean] || 0) + 1;
    }
  });
});

console.log('Top words in "أخرى" products:');
const sorted = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
sorted.slice(0, 60).forEach(([w, c]) => {
  console.log(`${w}: ${c}`);
});
