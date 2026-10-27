/**
 * brandClassifier.js
 * نظام التصنيف الذكي للماركات - معرض أبو رامز للأجهزة الكهربائية
 * 
 * الميزات:
 * 1. قاموس شامل للماركات العالمية والمحلية بتهجئاتها العربية والإنجليزية
 * 2. كشف ذكي يعتمد على الكلمات الصريحة بحدود كاملة (word boundaries) لتفادي المطابقات الجزئية الخاطئة
 * 3. استبعاد أسماء الموزعين/الموردين (مثل / يافا) لمنع تصنيف الموزع كماركة للمنتج
 * 4. كشف عائلات الموديلات وأكواد الشركات المصنعة
 * 5. مستويات ثقة دقيقة (عالية - متوسطة - مراجعة يدوية)
 * 6. كشف الماركات المكررة والمتشابهة
 * 7. سجل تاريخ التعديلات (Audit Log) والنسخ الاحتياطي التلقائي مع دعم التراجع (Rollback)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(__dirname, 'backups');
const DICTIONARY_FILE = path.join(DATA_DIR, 'brands_dictionary.json');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'brand_changes_log.json');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// -------------------------------------------------------------
// الماركات الافتراضية الشاملة وقاموس الموديلات والتهجئات
// -------------------------------------------------------------
const DEFAULT_BRANDS_DICTIONARY = [
  {
    key: 'LG',
    nameAr: 'ال جي (LG)',
    aliases: ['LG', 'ال جي', 'الجي', 'lg electronics'],
    modelPrefixes: ['LG-GR', 'LG-GC', 'LG V3', 'LG V4', 'LG V5', 'F4V', 'WT-'],
    icon: '🔴',
    categoryHint: ['غسالات', 'ثلاجات', 'شاشات وتلفزيونات', 'مكيفات', 'جلايات']
  },
  {
    key: 'Samsung',
    nameAr: 'سامسونج',
    aliases: ['Samsung', 'سامسونج', 'سامسونغ'],
    modelPrefixes: ['WW90', 'WW80', 'RT50', 'RT60', 'RB34', 'RS65', 'QA55', 'QA65', 'UE50'],
    icon: '🔷',
    categoryHint: ['شاشات وتلفزيونات', 'ثلاجات', 'غسالات', 'مكيفات']
  },
  {
    key: 'Haier',
    nameAr: 'هاير / هير',
    aliases: ['Haier', 'هاير', 'هير', 'haier'],
    modelPrefixes: ['HW100', 'HW120', 'HW80', 'HW70', 'HRF-', 'HWD-', 'HCE-'],
    icon: '❄️',
    categoryHint: ['غسالات', 'ثلاجات', 'فريزرات', 'مكيفات']
  },
  {
    key: 'Beko',
    nameAr: 'بيكو',
    aliases: ['Beko', 'بيكو'],
    modelPrefixes: ['BDFN', 'BIE2', 'BCHA', 'RDNE', 'WTV8', 'DIS2'],
    icon: '🔵',
    categoryHint: ['غسالات', 'جلايات', 'غازات وطباخات', 'ثلاجات']
  },
  {
    key: 'Tornado',
    nameAr: 'تورنادو',
    aliases: ['Tornado', 'تورنادو'],
    modelPrefixes: ['RF580', 'TORNADO'],
    icon: '🌪️',
    categoryHint: ['ثلاجات', 'شاشات وتلفزيونات', 'مراوح', 'شفاطات']
  },
  {
    key: 'Fresh',
    nameAr: 'فريش',
    aliases: ['Fresh', 'فريش'],
    modelPrefixes: ['FR-'],
    icon: '🌿',
    categoryHint: ['غسالات', 'غازات وطباخات', 'مراوح']
  },
  {
    key: 'Bosch',
    nameAr: 'بوش',
    aliases: ['Bosch', 'بوش'],
    modelPrefixes: ['WAN', 'WAJ', 'SMV', 'SMS', 'KGN'],
    icon: '🇩🇪',
    categoryHint: ['غسالات', 'جلايات', 'ثلاجات', 'أدوات مطبخ']
  },
  {
    key: 'Hoover',
    nameAr: 'هوفر',
    aliases: ['Hoover', 'هوفر'],
    modelPrefixes: ['H-DRY', 'H-WASH'],
    icon: '🌀',
    categoryHint: ['نشافات', 'غسالات', 'مكانس كهربائية']
  },
  {
    key: 'Hitachi',
    nameAr: 'هيتاشي',
    aliases: ['Hitachi', 'هيتاشي'],
    modelPrefixes: ['CV-950', 'CV-945', 'R-VG'],
    icon: '🧹',
    categoryHint: ['مكانس كهربائية', 'ثلاجات']
  },
  {
    key: 'Aiwa',
    nameAr: 'ايوا',
    aliases: ['Aiwa', 'ايوا', 'آيوا'],
    modelPrefixes: ['AW-'],
    icon: '📻',
    categoryHint: ['شاشات وتلفزيونات', 'سماعات']
  },
  {
    key: 'Tesla',
    nameAr: 'تيسلا',
    aliases: ['Tesla', 'تيسلا'],
    modelPrefixes: ['TSL-'],
    icon: '⚡',
    categoryHint: ['شاشات وتلفزيونات', 'مكيفات']
  },
  {
    key: 'Omega',
    nameAr: 'اوميجا',
    aliases: ['Omega', 'اوميجا', 'أوميجا'],
    modelPrefixes: ['OMG-'],
    icon: 'Ω',
    categoryHint: ['صوبات وتدفئة', 'مراوح']
  },
  {
    key: 'Skyworth',
    nameAr: 'سكاي ورث / سكاي',
    aliases: ['Skyworth', 'Sky', 'سكاي ورث', 'سكايورث', 'سكاي'],
    modelPrefixes: ['SKY-'],
    icon: '☁️',
    categoryHint: ['شاشات وتلفزيونات', 'رسيفر']
  },
  {
    key: 'Falcon',
    nameAr: 'فالكون',
    aliases: ['Falcon', 'فالكون'],
    modelPrefixes: ['FAL-'],
    icon: '🦅',
    categoryHint: ['أجهزة منزلية']
  },
  {
    key: 'Royal',
    nameAr: 'رويال',
    aliases: ['Royal', 'رويال'],
    modelPrefixes: ['RYL-'],
    icon: '👑',
    categoryHint: ['أدوات مطبخ', 'أواني وطناجر']
  },
  {
    key: 'Shark',
    nameAr: 'شارك',
    aliases: ['Shark', 'شارك'],
    modelPrefixes: ['SHK-'],
    icon: '🦈',
    categoryHint: ['مكانس كهربائية', 'أجهزة منزلية']
  },
  {
    key: 'Sharp',
    nameAr: 'شارب',
    aliases: ['Sharp', 'شارب'],
    modelPrefixes: ['SJ-', 'ES-', 'LC-', '4T-'],
    icon: '🔴',
    categoryHint: ['ثلاجات', 'شاشات وتلفزيونات', 'ميكرويف']
  },
  {
    key: 'TCL',
    nameAr: 'تي سي ال',
    aliases: ['TCL', 'تي سي ال', 'تي سي إل'],
    modelPrefixes: ['TCL-', 'C645', 'C745', 'P635', 'P735'],
    icon: '📺',
    categoryHint: ['شاشات وتلفزيونات', 'مكيفات', 'غسالات']
  },
  {
    key: 'Molar',
    nameAr: 'مولار',
    aliases: ['Molar', 'مولار', 'مولر'],
    modelPrefixes: ['ML-', 'MOL-'],
    icon: '⭐',
    categoryHint: ['شاشات وتلفزيونات', 'ثلاجات', 'فريزرات']
  },
  {
    key: 'General Lux',
    nameAr: 'جنرال لوكس',
    aliases: ['General Lux', 'جنرال لوكس', 'جينرال لوكس', 'جنراللوكس'],
    modelPrefixes: ['GLX-682', 'GLX-'],
    icon: '👑',
    categoryHint: ['غسالات', 'أفران وميكرويف', 'غازات وطباخات']
  },
  {
    key: 'General Queen',
    nameAr: 'جنرال كوين',
    aliases: ['General Queen', 'جنرال كوين', 'جينرال كوين', 'جنرالكوين'],
    modelPrefixes: ['GQ-', 'GQC'],
    icon: '👑',
    categoryHint: ['غازات وطباخات', 'أفران']
  },
  {
    key: 'Universal',
    nameAr: 'يونيفرسال',
    aliases: ['Universal', 'يونيفرسال', 'يونفرسال'],
    modelPrefixes: ['UNI-'],
    icon: '🌐',
    categoryHint: ['عجانات', 'غازات وطباخات', 'أدوات مطبخ']
  },
  {
    key: 'Crest',
    nameAr: 'كريست',
    aliases: ['Crest', 'كريست', 'كرست'],
    modelPrefixes: ['CR-5020', 'CR5007'],
    icon: '💎',
    categoryHint: ['مكانس كهربائية', 'أدوات منزل']
  },
  {
    key: 'Trust',
    nameAr: 'ترست',
    aliases: ['Trust', 'ترست', 'تراست'],
    modelPrefixes: ['TR-'],
    icon: '🛡️',
    categoryHint: ['مكانس كهربائية', 'مراوح', 'أدوات منزل']
  },
  {
    key: 'Lawrence',
    nameAr: 'لورنس',
    aliases: ['Lawrence', 'لورنس', 'لورانس'],
    modelPrefixes: ['LT-', 'LT'],
    icon: '📻',
    categoryHint: ['شاشات وتلفزيونات', 'رسيفر']
  },
  {
    key: 'ADC',
    nameAr: 'ADC',
    aliases: ['ADC', 'اي دي سي', 'إي دي سي'],
    modelPrefixes: ['ADC-'],
    icon: '⚡',
    categoryHint: ['إلكترونيات ومُلحقات']
  },
  {
    key: 'Atlantic',
    nameAr: 'اتلانتيك',
    aliases: ['Atlantic', 'اتلانتيك', 'أتلانتيك'],
    modelPrefixes: ['ATL606', 'ATL-'],
    icon: '🌊',
    categoryHint: ['غازات وطباخات', 'أفران']
  },
  {
    key: 'Samex',
    nameAr: 'سامكس',
    aliases: ['Samex', 'سامكس', 'ساميكس'],
    modelPrefixes: ['SMX-'],
    icon: '🔌',
    categoryHint: ['أدوات مطبخ', 'أدوات منزل']
  },
  {
    key: 'Simfer',
    nameAr: 'سيمفير',
    aliases: ['Simfer', 'سيمفير', 'سيمفر', 'سمفير'],
    modelPrefixes: ['SMF-'],
    icon: '🍳',
    categoryHint: ['غازات وطباخات', 'أفران']
  },
  {
    key: 'Midea',
    nameAr: 'ميديا',
    aliases: ['Midea', 'ميديا', 'ميدياا'],
    modelPrefixes: ['MDR', 'MF'],
    icon: '❄️',
    categoryHint: ['مكيفات', 'غسالات', 'كولرات مياه']
  },
  {
    key: 'Mega',
    nameAr: 'ميجا',
    aliases: ['Mega', 'ميجا'],
    modelPrefixes: ['MG-'],
    icon: '⚡',
    categoryHint: ['صوبات وتدفئة', 'أجهزة منزلية']
  },
  {
    key: 'KMG',
    nameAr: 'كي ام جي',
    aliases: ['KMG', 'كي ام جي', 'كي إم جي'],
    modelPrefixes: ['KMG-'],
    icon: '🔧',
    categoryHint: ['أدوات منزلية']
  },
  {
    key: 'Manger Home',
    nameAr: 'منجر هوم',
    aliases: ['Manger Home', 'منجر هوم', 'مانجر هوم', 'منجر'],
    modelPrefixes: ['MH-'],
    icon: '🏠',
    categoryHint: ['غسالات', 'جلايات']
  },
  {
    key: 'iPlug',
    nameAr: 'ايبلوج',
    aliases: ['iPlug', 'ايبلوج', 'آي بلوج', 'اي بلوج'],
    modelPrefixes: ['IPG-'],
    icon: '🔌',
    categoryHint: ['إلكترونيات ومُلحقات']
  },
  {
    key: 'Bompani',
    nameAr: 'بومباني',
    aliases: ['Bompani', 'بومباني'],
    modelPrefixes: ['BO-'],
    icon: '🔥',
    categoryHint: ['غازات وطباخات', 'أفران']
  },
  {
    key: 'RAF',
    nameAr: 'راف (RAF)',
    aliases: ['RAF', 'راف'],
    modelPrefixes: ['R.7', 'R.8', 'R.9'],
    icon: '⚙️',
    categoryHint: ['أدوات مطبخ', 'أدوات شخصية']
  },
  {
    key: 'Magic',
    nameAr: 'ماجيك',
    aliases: ['Magic', 'ماجيك'],
    modelPrefixes: ['MG-'],
    icon: '✨',
    categoryHint: ['أدوات منزل']
  },
  {
    key: 'Prestige',
    nameAr: 'برستيج',
    aliases: ['Prestige', 'برستيج'],
    modelPrefixes: ['PR241', 'PR3'],
    icon: '🎖️',
    categoryHint: ['فريزرات', 'ثلاجات']
  },
  {
    key: 'Konica',
    nameAr: 'كونيكا',
    aliases: ['Konica', 'كونيكا'],
    modelPrefixes: ['KN-'],
    icon: '❄️',
    categoryHint: ['فريزرات', 'ثلاجات']
  },
  {
    key: 'Cravit',
    nameAr: 'كرافيت',
    aliases: ['Cravit', 'كرافيت'],
    modelPrefixes: ['CR-458'],
    icon: '🚪',
    categoryHint: ['ثلاجات']
  },
  {
    key: 'Fresh',
    nameAr: 'فريش',
    aliases: ['Fresh', 'فريش'],
    modelPrefixes: ['FR-'],
    icon: '🌿',
    categoryHint: ['غسالات', 'غازات وطباخات', 'مراوح']
  },
  {
    key: 'Hoover',
    nameAr: 'هوفر',
    aliases: ['Hoover', 'هوفر'],
    modelPrefixes: ['HV-'],
    icon: '🌀',
    categoryHint: ['نشافات', 'غسالات', 'مكانس كهربائية']
  },
  {
    key: 'Candy',
    nameAr: 'كاندي',
    aliases: ['Candy', 'كاندي'],
    modelPrefixes: ['CD-'],
    icon: '🍬',
    categoryHint: ['غسالات', 'نشافات', 'جلايات']
  },
  {
    key: 'Xiaomi',
    nameAr: 'شاومي',
    aliases: ['Xiaomi', 'شاومي', 'Redmi', 'ريدمي', 'Poco', 'بوكو'],
    modelPrefixes: ['MI-', 'REDMI'],
    icon: '📱',
    categoryHint: ['مكانس كهربائية', 'إلكترونيات ومُلحقات']
  },
  {
    key: 'Hitachi',
    nameAr: 'هيتاشي',
    aliases: ['Hitachi', 'هيتاشي'],
    modelPrefixes: ['CV-'],
    icon: '🧹',
    categoryHint: ['مكانس كهربائية', 'ثلاجات']
  },
  {
    key: 'Panasonic',
    nameAr: 'باناسونيك',
    aliases: ['Panasonic', 'باناسونيك'],
    modelPrefixes: ['KX-'],
    icon: '📞',
    categoryHint: ['إلكترونيات ومُلحقات']
  },
  {
    key: 'Philips',
    nameAr: 'فيليبس',
    aliases: ['Philips', 'فيليبس', 'فيلبس'],
    modelPrefixes: ['HD', 'HP', 'HR'],
    icon: '💡',
    categoryHint: ['مقالي وشوايات', 'سشوارات', 'ماكينات حلاقة']
  },
  {
    key: 'Braun',
    nameAr: 'براون',
    aliases: ['Braun', 'براون'],
    modelPrefixes: ['MQ', 'BR-'],
    icon: '🪒',
    categoryHint: ['ماكينات حلاقة', 'خلاطات']
  },
  {
    key: 'Moulinex',
    nameAr: 'مولينكس',
    aliases: ['Moulinex', 'مولينكس', 'مولينيكس'],
    modelPrefixes: ['FP', 'AT'],
    icon: '🥣',
    categoryHint: ['فرامات', 'بلندرات وخلاطات']
  },
  {
    key: 'Tefal',
    nameAr: 'تيفال',
    aliases: ['Tefal', 'تيفال'],
    modelPrefixes: ['FV', 'EY'],
    icon: '🍳',
    categoryHint: ['مقالي وشوايات', 'مكاوي']
  },
  {
    key: 'Luma Bella',
    nameAr: 'لوما بيلا',
    aliases: ['Luma Bella', 'لوما بيلا', 'لوما', 'Luma'],
    modelPrefixes: ['LB-'],
    icon: '💇',
    categoryHint: ['سشوارات', 'ستريترات وتمليس']
  },
  {
    key: 'Star',
    nameAr: 'ستار',
    aliases: ['Star', 'ستار سات', 'فايف ستار', 'ستار'],
    modelPrefixes: ['SR-'],
    icon: '⭐',
    categoryHint: ['رسيفر', 'غسالات']
  },
  {
    key: 'Hikvision',
    nameAr: 'هيك فيجين',
    aliases: ['Hikvision', 'هيك فيجين', 'هيكفيجن', 'هيك فيجن'],
    modelPrefixes: ['DS-', 'HK-'],
    icon: '📹',
    categoryHint: ['إلكترونيات ومُلحقات']
  },
  {
    key: 'Dahua',
    nameAr: 'دهوا',
    aliases: ['Dahua', 'دهوا', 'داهوا'],
    modelPrefixes: ['DH-', 'XVR'],
    icon: '📹',
    categoryHint: ['إلكترونيات ومُلحقات']
  },
  {
    key: 'Matrix',
    nameAr: 'ماتركس',
    aliases: ['Matrix', 'ماتركس', 'ماتريكس'],
    modelPrefixes: ['MX-'],
    icon: '📟',
    categoryHint: ['رسيفر']
  },
  {
    key: 'Hisense',
    nameAr: 'هايسنس',
    aliases: ['Hisense', 'هايسنس', 'هاي سينس'],
    modelPrefixes: ['HS-'],
    icon: '📺',
    categoryHint: ['شاشات وتلفزيونات', 'مكيفات']
  },
  {
    key: 'Ariston',
    nameAr: 'اريستون',
    aliases: ['Ariston', 'اريستون', 'ارستون'],
    modelPrefixes: ['AR-'],
    icon: '🔥',
    categoryHint: ['غازات وطباخات', 'غسالات']
  },
  {
    key: 'BaByliss',
    nameAr: 'بيبي ليس',
    aliases: ['BaByliss', 'بيبي ليس', 'بيبيليس'],
    modelPrefixes: ['BAB'],
    icon: '💇',
    categoryHint: ['سشوارات', 'ستريترات وتمليس']
  },
  {
    key: 'Apple',
    nameAr: 'آبل',
    aliases: ['Apple', 'iPhone', 'iPad', 'آبل', 'ابل', 'ايفون'],
    modelPrefixes: ['A2', 'ML'],
    icon: '🍏',
    categoryHint: ['إلكترونيات ومُلحقات']
  },
  {
    key: 'Sony',
    nameAr: 'سوني',
    aliases: ['Sony', 'سوني'],
    modelPrefixes: ['KD-', 'XR-'],
    icon: '🎮',
    categoryHint: ['شاشات وتلفزيونات']
  },
  {
    key: 'Sanford',
    nameAr: 'سانفورد',
    aliases: ['Sanford', 'سانفورد'],
    modelPrefixes: ['SF-'],
    icon: '🔌',
    categoryHint: ['أدوات مطبخ', 'أدوات منزل']
  },
  {
    key: 'Sonashi',
    nameAr: 'سوناشي',
    aliases: ['Sonashi', 'سوناشي'],
    modelPrefixes: ['SON-'],
    icon: '🔌',
    categoryHint: ['أدوات مطبخ']
  },
  {
    key: 'Kenwood',
    nameAr: 'كينوود',
    aliases: ['Kenwood', 'كينوود', 'كنوود'],
    modelPrefixes: ['KMM', 'KM'],
    icon: '🧑‍🍳',
    categoryHint: ['عجانات', 'محضر طعام']
  },
  {
    key: 'Gree',
    nameAr: 'جري',
    aliases: ['Gree', 'جري'],
    modelPrefixes: ['GWH'],
    icon: '❄️',
    categoryHint: ['مكيفات']
  },
  {
    key: 'Glem Gas',
    nameAr: 'جليم غاز',
    aliases: ['Glem Gas', 'جليم غاز', 'جليم'],
    modelPrefixes: ['GLM'],
    icon: '🔥',
    categoryHint: ['غازات وطباخات']
  },
  {
    key: 'Alba',
    nameAr: 'البا',
    aliases: ['Alba', 'البا'],
    modelPrefixes: ['ALB'],
    icon: '🍳',
    categoryHint: ['غازات وطباخات']
  },
  {
    key: 'Zacash',
    nameAr: 'زكش / زاكاش',
    aliases: ['Zacash', 'زكش', 'زاكاش'],
    modelPrefixes: ['ZAC'],
    icon: '🏷️',
    categoryHint: ['أدوات منزلية']
  },
  {
    key: 'Vision',
    nameAr: 'فيجين',
    aliases: ['Vision', 'فيجين', 'فيجن'],
    modelPrefixes: ['VIS'],
    icon: '👁️',
    categoryHint: ['شاشات وتلفزيونات']
  },
  {
    key: 'Infinity',
    nameAr: 'انفينيتي',
    aliases: ['Infinity', 'انفينيتي', 'انفنتي'],
    modelPrefixes: ['INF'],
    icon: '♾️',
    categoryHint: ['شاشات وتلفزيونات']
  },
  {
    key: 'Tiger',
    nameAr: 'تايجر',
    aliases: ['Tiger', 'تايجر'],
    modelPrefixes: ['TIG'],
    icon: '🐯',
    categoryHint: ['رسيفر']
  },
  {
    key: 'Jennar',
    nameAr: 'جينار',
    aliases: ['Jennar', 'جينار'],
    modelPrefixes: ['JEN'],
    icon: '🏷️',
    categoryHint: ['أدوات منزلية']
  },
  {
    key: 'Luxor',
    nameAr: 'لوكسر',
    aliases: ['Luxor', 'لوكسر', 'لوكسور'],
    modelPrefixes: ['LUX'],
    icon: '✨',
    categoryHint: ['شاشات وتلفزيونات']
  }
];

// الكلمات التي تدل على المورد أو الموزع ولا تعتبر اسم ماركة للمنتج
const DISTRIBUTOR_TAGS = [
  'يافا', 'يافا نابلس', 'ابو صالح', 'المنار', 'سائد', 'فاخر', 
  'احمد عطاري', 'رامي السايغ', 'عواد عرقاوي', 'فادي شخشير', 
  'مورد بضاعة قديمة', 'ابو عنان', 'سائد ابو عصبة', 'مالك مخيم'
];

// كلمات عامة لا يجوز اعتبارها ماركة
const GENERIC_DEVICE_WORDS = [
  'غسالة', 'نشافة', 'ثلاجة', 'براد', 'فريزر', 'جلاية', 'غاز', 'طباخ', 'فرن', 
  'شاشة', 'تلفزيون', 'تلفاز', 'رسيفر', 'شفاط', 'مدخنة', 'مكيف', 'انفرتر', 
  'عجانة', 'مقلى', 'قلاية', 'كولر', 'عصارة', 'خلاط', 'بلندر', 'فرامة', 
  'ميكرويف', 'توست', 'غلاية', 'طنجرة', 'مكنسة', 'مكوى', 'مروحة', 'صوبة', 
  'مدفأة', 'سشوار', 'ستريتر', 'ماكنة حلاقة', 'سماعة', 'كاميرا', 'راوتر', 'سلك', 'كابل'
];

// تهيئة القاموس إذا لم يكن موجوداً
function loadDictionary() {
  try {
    if (fs.existsSync(DICTIONARY_FILE)) {
      const data = JSON.parse(fs.readFileSync(DICTIONARY_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.error('Error reading brands dictionary:', err);
  }
  // حفظ القاموس الافتراضي
  saveDictionary(DEFAULT_BRANDS_DICTIONARY);
  return DEFAULT_BRANDS_DICTIONARY;
}

function saveDictionary(dict) {
  try {
    fs.writeFileSync(DICTIONARY_FILE, JSON.stringify(dict, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving brands dictionary:', err);
    return false;
  }
}

// بناء regex بحدود حروف يونيكود
function buildBoundaryRegex(term) {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?:^|[^\\p{L}\\p{N}])' + escaped + '(?:$|[^\\p{L}\\p{N}])', 'iu');
}

/**
 * تنظيف اسم المنتج من إضافات الموزعين والموردين مثل "/ يافا" أو "(ADM)"
 */
function cleanProductName(name) {
  if (!name) return { cleaned: '', distributor: null };
  let cleaned = name;
  let detectedDistributor = null;

  // فحص الموزعين بعد سلاش أو أقواس
  for (const tag of DISTRIBUTOR_TAGS) {
    const slashRegex = new RegExp(`[/\\-–]\\s*${tag}\\b`, 'iu');
    if (slashRegex.test(cleaned)) {
      detectedDistributor = tag;
      cleaned = cleaned.replace(slashRegex, ' ');
    }
  }

  // تنظيف المسافات الزائدة
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return { cleaned, distributor: detectedDistributor };
}

/**
 * فحص وتصنيف صنف محدد استناداً إلى القاموس والأدلة
 */
function analyzeProductBrand(product, dictionary) {
  const dict = dictionary || loadDictionary();
  const rawName = String(product.name || '').trim();
  const desc = String(product.description || '').trim();
  const currentBrand = String(product.brand || 'أخرى').trim();
  const currentBrandAr = String(product.brandAr || 'أخرى / عام').trim();
  const isCurrentlyOther = !currentBrand || currentBrand === 'أخرى' || currentBrand.toLowerCase() === 'other';

  const { cleaned, distributor } = cleanProductName(rawName);

  // جمع الأدلة المحتملة
  const candidateScores = new Map(); // brandKey -> { score, reasons: [] }

  function addCandidate(brandKey, score, reason) {
    const entry = candidateScores.get(brandKey) || { score: 0, reasons: [] };
    entry.score += score;
    entry.reasons.push(reason);
    candidateScores.set(brandKey, entry);
  }

  // 1. فحص الاسم المنظف مقابل أسماء الماركات ومرادفاتها
  for (const b of dict) {
    for (const alias of b.aliases) {
      const rx = buildBoundaryRegex(alias);
      if (rx.test(cleaned)) {
        // إذا كان الاسم يطابق مباشرة
        addCandidate(b.key, 50 + (alias.length || 0), `ظهور اسم الماركة الصريح "${alias}" في اسم الصنف`);
        break;
      }
    }

    // 2. فحص بادئات وأرقام الموديلات
    if (Array.isArray(b.modelPrefixes)) {
      for (const prefix of b.modelPrefixes) {
        const prefixRx = new RegExp(`(?:^|[^\\p{L}\\p{N}])${prefix}[A-Za-z0-9\\-]+(?:$|[^\\p{L}\\p{N}])`, 'iu');
        if (prefixRx.test(rawName) || prefixRx.test(desc)) {
          addCandidate(b.key, 40, `تطابق كود الموديل المصنعي التابع لـ ${b.key} (بادئة: ${prefix})`);
          break;
        }
      }
    }
  }

  // استبعاد الكلمات العامة من احتسابها كماركة
  for (const genWord of GENERIC_DEVICE_WORDS) {
    if (candidateScores.has(genWord)) {
      candidateScores.delete(genWord);
    }
  }

  // تحديد أفضل ماركة مرشحة
  let bestCandidateKey = null;
  let bestCandidateScore = 0;
  let bestCandidateReasons = [];

  for (const [key, data] of candidateScores.entries()) {
    if (data.score > bestCandidateScore) {
      bestCandidateScore = data.score;
      bestCandidateKey = key;
      bestCandidateReasons = data.reasons;
    }
  }

  const bestBrandObj = bestCandidateKey ? dict.find(b => b.key === bestCandidateKey) : null;
  const currentBrandObj = dict.find(b => b.key.toLowerCase() === currentBrand.toLowerCase());

  // تحديد الموقف والإجراء ومستوى الثقة
  let proposedBrand = currentBrand;
  let proposedBrandAr = currentBrandAr;
  let confidence = 'high'; // 'high' | 'medium' | 'manual_review'
  let action = 'keep';     // 'keep' | 'change' | 'review'
  let reason = '';
  let status = 'correct';  // 'correct' | 'candidate_change' | 'needs_review' | 'other_unassigned'

  if (bestCandidateKey) {
    const isMatchingCurrent = currentBrand.toLowerCase() === bestCandidateKey.toLowerCase();

    if (isMatchingCurrent) {
      // الماركة الحالية صحيحة تماماً ومتطابقة مع الأدلة
      status = 'correct';
      confidence = 'high';
      action = 'keep';
      proposedBrand = bestBrandObj ? bestBrandObj.key : currentBrand;
      proposedBrandAr = bestBrandObj ? bestBrandObj.nameAr : currentBrandAr;
      reason = `الماركة الحالية متوافقة مع الأدلة: ${bestCandidateReasons.join(' + ')}`;
    } else if (isCurrentlyOther) {
      // الصنف مسجل تحت "أخرى" ولديه أدلة واضحة على ماركته الحقيقية
      status = 'candidate_change';
      confidence = bestCandidateScore >= 40 ? 'high' : 'medium';
      action = 'change';
      proposedBrand = bestBrandObj.key;
      proposedBrandAr = bestBrandObj.nameAr;
      reason = `الصنف ضمن "أخرى" وتوجد أدلة قاطعة على ماركته: ${bestCandidateReasons.join(' + ')}`;
    } else {
      // تعارض بين الماركة الحالية والأدلة المكتشفة
      // تحقق هل الماركة الحالية هي اسم الموزع؟
      const isDistributorConflict = distributor && currentBrand.toLowerCase().includes(distributor.toLowerCase());

      status = 'candidate_change';
      confidence = 'high';
      action = 'change';
      proposedBrand = bestBrandObj.key;
      proposedBrandAr = bestBrandObj.nameAr;
      if (isDistributorConflict) {
        reason = `تم تصنيف الموزع "${distributor}" خطأً كماركة، بينما الماركة المصنعية الفعلية هي "${bestBrandObj.nameAr}" (${bestCandidateReasons.join(' + ')})`;
      } else {
        reason = `تعارض: الماركة الحالية "${currentBrand}" لا تتطابق مع أدلة الصنف (${bestCandidateReasons.join(' + ')})`;
      }
    }
  } else {
    // لم يتم العثور على ماركة صريحة بالاسم أو الموديل
    if (isCurrentlyOther) {
      status = 'other_unassigned';
      confidence = 'manual_review';
      action = 'review';
      reason = 'الصنف مسجل ضمن "أخرى" ولا يحتوي اسمه أو موديله على دليل قاطع لاسم ماركة مسجلة (يحتاج مراجعة بشرية)';
    } else {
      // يحتفظ بماركته الحالية ولكن مع ملاحظة للمراجعة للتأكد
      status = 'needs_review';
      confidence = 'medium';
      action = 'keep';
      reason = `الصنف يحمل ماركة "${currentBrand}" ولكن لا توجد كلمات صريحة باسم الماركة داخل النص (يُرجى المراجعة للتأكد)`;
    }
  }

  return {
    code: product.code,
    name: rawName,
    currentBrand,
    currentBrandAr,
    proposedBrand,
    proposedBrandAr,
    confidence,
    action,
    reason,
    status,
    distributorTag: distributor,
    category: product.category || product.mainCategory || ''
  };
}

/**
 * تحليل شامل لجميع الأصناف والماركات في قاعدة البيانات
 */
function analyzeAllProducts(products, dictionary) {
  const dict = dictionary || loadDictionary();
  const results = [];
  const brandStats = {};
  const proposedBrandStats = {};

  let countCorrect = 0;
  let countCandidateChange = 0;
  let countNeedsReview = 0;
  let countOtherUnassigned = 0;

  products.forEach(p => {
    const analysis = analyzeProductBrand(p, dict);
    results.push(analysis);

    const cb = analysis.currentBrand || 'أخرى';
    brandStats[cb] = (brandStats[cb] || 0) + 1;

    const pb = analysis.proposedBrand || 'أخرى';
    proposedBrandStats[pb] = (proposedBrandStats[pb] || 0) + 1;

    if (analysis.status === 'correct') countCorrect++;
    else if (analysis.status === 'candidate_change') countCandidateChange++;
    else if (analysis.status === 'needs_review') countNeedsReview++;
    else if (analysis.status === 'other_unassigned') countOtherUnassigned++;
  });

  // كشف الماركات المكررة أو المتشابهة في التهجئة
  const duplicateBrands = findDuplicateBrands(Object.keys(brandStats));

  return {
    summary: {
      totalProducts: products.length,
      correctCount: countCorrect,
      candidateChangeCount: countCandidateChange,
      needsReviewCount: countNeedsReview,
      otherUnassignedCount: countOtherUnassigned,
      totalBrandsCount: Object.keys(brandStats).length,
      duplicateBrandsCount: duplicateBrands.length
    },
    duplicateBrands,
    brandStats,
    proposedBrandStats,
    items: results
  };
}

/**
 * كشف الماركات المكررة أو المتشابهة
 */
function findDuplicateBrands(brandNames) {
  const duplicates = [];
  const normalizedMap = new Map();

  function norm(str) {
    return str.toLowerCase().replace(/[\s\-_/]/g, '').trim();
  }

  for (let i = 0; i < brandNames.length; i++) {
    for (let j = i + 1; j < brandNames.length; j++) {
      const b1 = brandNames[i];
      const b2 = brandNames[j];
      if (b1 === 'أخرى' || b2 === 'أخرى') continue;

      const n1 = norm(b1);
      const n2 = norm(b2);

      // تشابه في الأحرف أو احتواء إحداهما في الأخرى
      if (n1 === n2 || (n1.length > 3 && n2.length > 3 && (n1.includes(n2) || n2.includes(n1)))) {
        duplicates.push({
          brand1: b1,
          brand2: b2,
          reason: `تشابه إملائي كبير بين "${b1}" و "${b2}"`
        });
      }
    }
  }

  return duplicates;
}

/**
 * تطبيق التغييرات المعتمدة على ملف products.json مع أخذ نسخة احتياطية وتسجيل في السجل
 */
function applyBrandChanges(productsFilePath, itemsToUpdate, editorName = 'مدير النظام') {
  const products = JSON.parse(fs.readFileSync(productsFilePath, 'utf8'));
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // 1. أخذ نسخة احتياطية كاملة قبل أي تعديل
  const backupFile = path.join(BACKUPS_DIR, `brands_backup_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(products, null, 2), 'utf8');

  // 2. تطبيق التعديلات وتسجيل التغييرات في سجل التدقيق
  const auditLogs = fs.existsSync(AUDIT_LOG_FILE) ? JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8')) : [];
  const now = new Date().toISOString();
  let updatedCount = 0;
  const changeEntries = [];

  const updateMap = new Map();
  itemsToUpdate.forEach(u => {
    updateMap.set(String(u.code).trim(), u);
  });

  products.forEach(p => {
    const code = String(p.code || '').trim();
    if (updateMap.has(code)) {
      const u = updateMap.get(code);
      const prevBrand = p.brand;
      const prevBrandAr = p.brandAr;

      if (prevBrand !== u.proposedBrand || prevBrandAr !== u.proposedBrandAr) {
        p.brand = u.proposedBrand;
        p.brandAr = u.proposedBrandAr;
        p.updatedAt = now;
        updatedCount++;

        const logEntry = {
          code: p.code,
          name: p.name,
          prevBrand,
          prevBrandAr,
          newBrand: u.proposedBrand,
          newBrandAr: u.proposedBrandAr,
          reason: u.reason || 'موافقة المسؤول على تصحيح الماركة',
          changedAt: now,
          changedBy: editorName,
          backupFile: path.basename(backupFile)
        };
        auditLogs.unshift(logEntry);
        changeEntries.push(logEntry);
      }
    }
  });

  // حفظ الملفات
  fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2), 'utf8');
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(auditLogs.slice(0, 500), null, 2), 'utf8');

  return {
    success: true,
    updatedCount,
    backupFile: path.basename(backupFile),
    changeEntries
  };
}

/**
 * التراجع عن آخر عملية تعديل باستخدام النسخة الاحتياطية
 */
function rollbackLastChange(productsFilePath) {
  const backups = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('brands_backup_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (backups.length === 0) {
    return { success: false, error: 'لا توجد نسخ احتياطية للتراجع عنها' };
  }

  const latestBackup = path.join(BACKUPS_DIR, backups[0]);
  const backupData = fs.readFileSync(latestBackup, 'utf8');
  fs.writeFileSync(productsFilePath, backupData, 'utf8');

  // تسجيل عملية التراجع
  const auditLogs = fs.existsSync(AUDIT_LOG_FILE) ? JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8')) : [];
  auditLogs.unshift({
    action: 'rollback',
    restoredFrom: backups[0],
    timestamp: new Date().toISOString()
  });
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(auditLogs.slice(0, 500), null, 2), 'utf8');

  return {
    success: true,
    restoredFrom: backups[0],
    message: `تم التراجع بنجاح واستعادة بيانات الماركات من النسخة الاحتياطية: ${backups[0]}`
  };
}


/**
 * تصنيف ذكي تلقائي لصنف محدد (بالاسم أو كائن الصنف)
 * إذا كان الصنف يمتلك ماركة أصلية محددة بالفعل فإنه يحتفظ بها
 * وإذا كان "أخرى" أو فارغاً، يتم كشف الماركة من اسمه وتصنيفه فوراً
 */
function detectBrandAuto(productOrName) {
  const p = typeof productOrName === 'string' ? { name: productOrName } : (productOrName || {});
  const currentBrand = String(p.brand || '').trim();
  if (currentBrand && currentBrand !== 'أخرى' && currentBrand.toLowerCase() !== 'other') {
    return { brand: currentBrand, brandAr: p.brandAr || currentBrand };
  }
  const result = analyzeProductBrand(p);
  if (result && result.proposedBrand && result.proposedBrand !== 'أخرى' && (result.confidence === 'high' || result.confidence === 'medium')) {
    return { brand: result.proposedBrand, brandAr: result.proposedBrandAr };
  }
  return { brand: 'أخرى', brandAr: 'أخرى / عام' };
}

module.exports = {
  detectBrandAuto,
  loadDictionary,
  saveDictionary,
  analyzeProductBrand,
  analyzeAllProducts,
  applyBrandChanges,
  rollbackLastChange,
  cleanProductName,
  findDuplicateBrands
};
