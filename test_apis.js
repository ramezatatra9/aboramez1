const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  const custs = await get('http://localhost:3000/api/customers');
  const supps = await get('http://localhost:3000/api/suppliers');
  const audit = await get('http://localhost:3000/api/brands-classification/audit');

  console.log('--- CUSTOMERS CHECK ---');
  console.log('Total customers:', custs.customers.length);
  const withBal = custs.customers.filter(c => c.balance !== 0);
  console.log('Customers with non-zero balance:', withBal.length);
  console.log('Sample customer:', withBal[0].name, 'Balance:', withBal[0].balance);

  console.log('\n--- SUPPLIERS CHECK ---');
  console.log('Total suppliers:', supps.suppliers.length);
  console.log('Suppliers balances:');
  supps.suppliers.forEach(s => console.log(`  - ${s.name}: ${s.balance} NIS`));
  const hasOldGoods = supps.suppliers.some(s => s.name.includes('بضاعة قديمة') || s.shamelCode === 'S00000003');
  console.log('Has old goods supplier?:', hasOldGoods ? 'YES (ERROR)' : 'NO (CORRECT: EXCLUDED)');

  console.log('\n--- BRAND AUDIT CHECK ---');
  console.log('Audit Summary:', JSON.stringify(audit.summary, null, 2));
  const sampleCand = audit.items.find(i => i.status === 'candidate_change');
  console.log('Sample candidate for change:');
  console.log(`  Code: ${sampleCand.code}\n  Name: ${sampleCand.name}\n  Current: ${sampleCand.currentBrand} (${sampleCand.currentBrandAr})\n  Proposed: ${sampleCand.proposedBrand} (${sampleCand.proposedBrandAr})\n  Reason: ${sampleCand.reason}`);
}

test().catch(console.error);
