// Test the KPI API to see what it returns
const fetch = require('node-fetch');

async function testKPIAPI() {
  try {
    console.log('🔍 Testing KPI API...');

    const response = await fetch('http://localhost:3000/api/business/kpis');
    const data = await response.json();

    console.log('📊 KPI API Response:');
    console.log('Status:', response.status);
    console.log('Customers (Audience Reach):', data.customers);
    console.log('Revenue:', data.revenue);
    console.log('Growth (CPA):', data.growth);
    console.log('Goals:', data.goals);

    if (data.customers && data.customers.formatted) {
      console.log('✅ Audience Reach formatted value:', data.customers.formatted);
    } else {
      console.log('❌ Audience Reach data missing or malformed');
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('Make sure the dev server is running on http://localhost:3000');
  }
}

testKPIAPI();