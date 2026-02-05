// Test Auto-Mapping for Youngstown Client
// Run these commands in your browser console when on your dashboard

console.log('🚀 Testing Auto-Mapping for Youngstown Client');
console.log('GHL Location ID: be4yGETqzGQ4sknbwXb3');
console.log('Expected result: 62 total weekly views');
console.log('');

// Test 1: Main Site (youngstown-marketing - 34 views)
fetch('/api/analytics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    siteId: 'youngstown-marketing',
    sessionId: 'test-session-1',
    eventType: 'page_view',
    pageUrl: 'https://youngstown-marketing.com',
    eventData: {
      locationId: 'be4yGETqzGQ4sknbwXb3',
      timestamp: new Date().toISOString()
    }
  })
}).then(r => r.json()).then(d => {
  console.log('✅ Main Site mapping result:', d);
  console.log('📊 Auto-mapping should be created for: be4yGETqzGQ4sknbwXb3 → youngstown-marketing');
}).catch(e => console.error('❌ Main Site error:', e));

// Test 2: Funnel (funnel-vRwWeI3XuXffOFsLo7YT - 26 views)
setTimeout(() => {
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteId: 'funnel-vRwWeI3XuXffOFsLo7YT',
      sessionId: 'test-session-2',
      eventType: 'page_view',
      pageUrl: 'https://youngstown-marketing.com/funnel',
      eventData: {
        locationId: 'be4yGETqzGQ4sknbwXb3',
        timestamp: new Date().toISOString()
      }
    })
  }).then(r => r.json()).then(d => {
    console.log('✅ Funnel mapping result:', d);
    console.log('📊 Auto-mapping should be created for: be4yGETqzGQ4sknbwXb3 → funnel-vRwWeI3XuXffOFsLo7YT');
  }).catch(e => console.error('❌ Funnel error:', e));
}, 1000);

// Test 3: Landing Page (funnel-XoUDtEB4l3SLvruh04BG - 2 views)
setTimeout(() => {
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteId: 'funnel-XoUDtEB4l3SLvruh04BG',
      sessionId: 'test-session-3',
      eventType: 'page_view',
      pageUrl: 'https://youngstown-marketing.com/landing',
      eventData: {
        locationId: 'be4yGETqzGQ4sknbwXb3',
        timestamp: new Date().toISOString()
      }
    })
  }).then(r => r.json()).then(d => {
    console.log('✅ Landing Page mapping result:', d);
    console.log('📊 Auto-mapping should be created for: be4yGETqzGQ4sknbwXb3 → funnel-XoUDtEB4l3SLvruh04BG');
  }).catch(e => console.error('❌ Landing Page error:', e));
}, 2000);

console.log('');
console.log('Next steps after running these tests:');
console.log('1. Check browser console for "Auto-mapping created successfully" messages');
console.log('2. Verify mappings in database: GET /api/client-websites?ghlLocationId=be4yGETqzGQ4sknbwXb3');
console.log('3. Refresh GHL clients page - Weekly Views should show 62 instead of 0!');
console.log('4. 🎉 Your agency dashboard now shows real digital marketing scale!');