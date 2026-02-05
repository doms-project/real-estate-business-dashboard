// Test script to check PATCH method
const fetch = require('node-fetch');

async function testPatch() {
  try {
    console.log('Testing PATCH /api/workspace...');

    const response = await fetch('http://localhost:3000/api/workspace', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: 'test-id',
        name: 'Test Name'
      })
    });

    console.log('Response status:', response.status);
    const text = await response.text();
    console.log('Response body:', text);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPatch();