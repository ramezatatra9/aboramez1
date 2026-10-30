const fs = require('fs');
let content = fs.readFileSync('dataStore.js', 'utf8');

const searchStr = '// 7. استعادة الموردين';
const idx = content.indexOf(searchStr);
if (idx === -1) { console.log('NOT FOUND'); process.exit(1); }

// نجد نهاية catch block
const catchWarningStr = "console.warn('⚠️ تعذر استعادة الموردين من Supabase:'";
const catchIdx = content.indexOf(catchWarningStr, idx);
// نجد } بعد الـ catch
let blockEnd = content.indexOf('\n    }', catchIdx) + 7; // بعد '    }'

const oldBlock = content.substring(idx, blockEnd);
console.log('Old block length:', oldBlock.length);

const newBlock = `    // 7. استعادة الموردين — settings.suppliers أولاً (يُحدَّث عند كل مزامنة) ثم جدول suppliers
    try {
      const EXCLUDED_SUPPLIER_CODES = ['S00000003'];
      let suppData = null;

      // المصدر الأول: settings.suppliers — يُحدَّث تلقائياً عند كل مزامنة من ShamelSyncPro
      const { data: sRow } = await supabase.from('settings').select('data').eq('id', 'suppliers').maybeSingle();
      if (sRow && Array.isArray(sRow.data) && sRow.data.length > 0) {
        suppData = sRow.data;
        console.log('✅ تم استعادة ' + suppData.length + ' مورد بأرصدتهم الحديثة من settings (snapshot مزامنة الشامل)');
      } else {
        // المصدر الثاني: جدول suppliers المباشر (fallback)
        const { data: sTable, error: sErr } = await supabase.from('suppliers').select('*').order('name');
        if (!sErr && Array.isArray(sTable) && sTable.length > 0) {
          suppData = sTable;
          console.log('✅ تم استعادة ' + suppData.length + ' مورد من جدول suppliers الأساسي في Supabase');
        }
      }

      if (suppData && suppData.length > 0) {
        const cleanSuppliers = suppData.filter(function(s) {
          const code = String(s.shamelCode || '').toUpperCase();
          const name = String(s.name || '');
          return !EXCLUDED_SUPPLIER_CODES.includes(code) && !name.includes('بضاعة قديمة');
        });
        writeJson(SUPPLIERS_FILE, cleanSuppliers);
      }
    } catch (sErr) {
      console.warn('⚠️ تعذر استعادة الموردين من Supabase:', sErr.message);
    }`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('dataStore.js', content, 'utf8');
console.log('Done - replaced block');

