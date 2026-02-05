// Quick debug script to check location IDs
// Run this in browser console on the locations page

// Get all location cards
const locationCards = document.querySelectorAll('[data-location-id]');
console.log('Location cards found:', locationCards.length);

// Get location IDs from the page
const locationIds = Array.from(document.querySelectorAll('button[onclick*="gohighlevel-clients"]'))
  .map(btn => {
    const onclick = btn.getAttribute('onclick');
    const match = onclick?.match(/gohighlevel-clients\/([^'"]+)/);
    return match ? match[1] : null;
  })
  .filter(id => id);

console.log('Location IDs found on page:', locationIds);

// Also check the API response
fetch('/api/ghl/locations')
  .then(r => r.json())
  .then(data => {
    console.log('API Locations:', data.locations?.map(l => `${l.name} (${l.id})`));
    console.log('Total locations from API:', data.locations?.length || 0);
  });