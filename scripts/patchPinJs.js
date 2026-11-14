const fs = require('fs');
const path = require('path');

const pinJsPath = path.join(__dirname, '..', 'public', 'js', 'pin-barcode.js');
let code = fs.readFileSync(pinJsPath, 'utf8');

// Replace initSecuritySystem
const oldInitTarget = "(async function initSecuritySystem() {";
const oldInitEnd = "showPinLockScreen();\n  } else {\n    // إذا كان القفل معطلاً، ادخل افتراضياً كأدمن\n    applyUserRole(appSecurityUsers[0] || DEFAULT_SECURITY_USERS[0]);\n  }\n})();";

const newInitSystem = `(async function initSecuritySystem() {
  await loadSecuritySettings();

  // إلزام تسجيل الدخول وطلب رمز PIN في كل زيارة بدون تخطي تلقائي
  showPinLockScreen();
})();`;

// Find and replace the initSecuritySystem block
const startIdx = code.indexOf(oldInitTarget);
if (startIdx !== -1) {
  const endIdx = code.indexOf('})();', startIdx);
  if (endIdx !== -1) {
    code = code.slice(0, startIdx) + newInitSystem + code.slice(endIdx + 5);
    console.log('✅ Replaced initSecuritySystem to ALWAYS show lock screen on visit');
  } else {
    console.error('❌ Could not find end of initSecuritySystem');
  }
} else {
  console.log('ℹ️ initSecuritySystem already updated');
}

// Update verifyEnteredPin to match across all users and master PIN
const oldVerifyTarget = "function verifyEnteredPin() {\n  // البحث عن مستخدم يطابق الرمز المدخل\n  const matchedUser = appSecurityUsers.find(u => String(u.pin).trim() === pinBuffer);";

const newVerifyLogic = `function verifyEnteredPin() {
  // البحث المباشر في كافة المستخدمين (أدمن أو كاشير) دون الحاجة للاختيار المسبق
  let matchedUser = appSecurityUsers.find(u => String(u.pin).trim() === pinBuffer);
  
  // دعم الرمز الإداري الرئيسي الشامل (8802 أو 99199)
  if (!matchedUser && (pinBuffer === '8802' || pinBuffer === '99199')) {
    matchedUser = appSecurityUsers.find(u => u.role === 'admin') || DEFAULT_SECURITY_USERS[0];
  }`;

if (code.includes(oldVerifyTarget)) {
  code = code.replace(oldVerifyTarget, newVerifyLogic);
  console.log('✅ Updated verifyEnteredPin for direct role detection and master PIN');
} else {
  console.log('ℹ️ verifyEnteredPin target not matched directly, checking partial');
  const fallbackTarget = "const matchedUser = appSecurityUsers.find(u => String(u.pin).trim() === pinBuffer);";
  if (code.includes(fallbackTarget)) {
    code = code.replace(fallbackTarget, `let matchedUser = appSecurityUsers.find(u => String(u.pin).trim() === pinBuffer);\n  if (!matchedUser && (pinBuffer === '8802' || pinBuffer === '99199')) {\n    matchedUser = appSecurityUsers.find(u => u.role === 'admin') || DEFAULT_SECURITY_USERS[0];\n  }`);
    console.log('✅ Applied fallback replacement in verifyEnteredPin');
  }
}

fs.writeFileSync(pinJsPath, code, 'utf8');
console.log('✅ pin-barcode.js saved');
