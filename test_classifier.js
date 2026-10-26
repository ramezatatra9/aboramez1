const fs = require('fs');
const classifier = require('./brandClassifier');

const products = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
const analysis = classifier.analyzeAllProducts(products);

console.log('=== SUMMARY ===');
console.log(JSON.stringify(analysis.summary, null, 2));

console.log('\n=== SAMPLE CANDIDATES FOR CORRECTION (first 15) ===');
const candidates = analysis.items.filter(i => i.status === 'candidate_change');
candidates.slice(0, 15).forEach(c => {
  console.log(`[${c.code}] "${c.name}"\n  Current: "${c.currentBrand}" (${c.currentBrandAr}) => Proposed: "${c.proposedBrand}" (${c.proposedBrandAr})\n  Reason: ${c.reason}\n  Confidence: ${c.confidence}\n`);
});

console.log('=== DUPLICATE / SIMILAR BRANDS DETECTED ===');
console.log(JSON.stringify(analysis.duplicateBrands, null, 2));
