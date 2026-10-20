const fs = require('fs');
const path = require('path');
const { detectBrand } = require('../categoryHelper');

const productsFile = path.join(__dirname, '..', 'data', 'products.json');
const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));

let updatedCount = 0;
const brandCounts = {};

products.forEach(p => {
  // If brand is 'أخرى' or empty, detect it from name
  if (!p.brand || p.brand === 'أخرى') {
    const detected = detectBrand(p.name);
    p.brand = detected.brand;
    p.brandAr = detected.brandAr;
    if (detected.brand !== 'أخرى') {
      updatedCount++;
    }
  }
  brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
});

// Create backup first
const backupFile = path.join(__dirname, '..', 'backups', 'products_before_brand_fix.json');
fs.writeFileSync(backupFile, JSON.stringify(products, null, 2), 'utf8');

// Save updated products
fs.writeFileSync(productsFile, JSON.stringify(products, null, 2), 'utf8');

console.log(`Successfully updated ${updatedCount} products with real brands!`);
console.log('Brand breakdown:', Object.entries(brandCounts).sort((a,b) => b[1] - a[1]));
