#!/usr/bin/env node

/**
 * Preview script to show what business details would be updated
 * This safely shows changes without modifying the config file
 */

const fs = require('fs');
const path = require('path');

// Read the config file
function readConfigFile() {
  const configPath = path.join(__dirname, '..', 'lib', 'ghl-config.ts');
  const content = fs.readFileSync(configPath, 'utf8');

  // Extract the GHL_LOCATIONS array using regex - handle multiline better
  const arrayMatch = content.match(/export const GHL_LOCATIONS: GHLLocationConfig\[\] = \[([\s\S]*?)\]/);
  if (!arrayMatch) {
    throw new Error('Could not find GHL_LOCATIONS array in config file');
  }

  return arrayMatch[1];
}

// Parse the locations array
function parseLocationsArray(arrayContent) {
  const locations = [];
  const locationRegex = /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*city:\s*['"]([^'"]+)['"],\s*state:\s*['"]([^'"]+)['"],\s*country:\s*['"]([^'"]+)['"],\s*address:\s*['"]([^'"]+)['"],\s*pitToken:\s*['"]([^'"]+)['"],\s*description:\s*['"]([^'"]*)['"]\s*}/g;

  let match;
  while ((match = locationRegex.exec(arrayContent)) !== null) {
    locations.push({
      id: match[1],
      name: match[2],
      city: match[3],
      state: match[4],
      country: match[5],
      address: match[6],
      pitToken: match[7],
      description: match[8]
    });
  }

  return locations;
}

// Check if a location needs updating
function needsUpdate(location) {
  return location.city === 'To Be Updated' ||
         location.state === 'To Be Updated' ||
         location.address === 'To Be Updated';
}

// Fetch business details from GoHighLevel API
async function fetchBusinessDetails(locationId, pitToken) {
  try {
    const response = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
      headers: {
        'Authorization': `Bearer ${pitToken}`,
        'Accept': 'application/json',
        'Version': '2021-07-28'
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.location) {
      return {
        city: data.location.city || '',
        state: data.location.state || '',
        address: data.location.address || '',
        country: data.location.country || 'US'
      };
    } else {
      throw new Error('No location data in API response');
    }
  } catch (error) {
    console.error(`❌ Failed to fetch details for ${locationId}:`, error.message);
    return null;
  }
}

// Main execution
async function main() {
  try {
    console.log('🔍 Previewing business details updates...\n');

    // Read and parse config
    const arrayContent = readConfigFile();
    const locations = parseLocationsArray(arrayContent);

    console.log(`📋 Found ${locations.length} locations in config\n`);

    // Find locations that need updating
    const locationsToUpdate = locations.filter(needsUpdate);
    console.log(`🎯 Found ${locationsToUpdate.length} locations needing updates:\n`);

    if (locationsToUpdate.length === 0) {
      console.log('✅ All locations already have complete business details');
      return;
    }

    // Preview each location update
    for (const location of locationsToUpdate) {
      console.log(`🏢 ${location.name} (${location.id})`);
      console.log(`   Current: ${location.city}, ${location.state} - ${location.address}`);

      console.log(`   Fetching real details...`);

      const details = await fetchBusinessDetails(location.id, location.pitToken);

      if (details) {
        console.log(`   ✅ Would update to: ${details.city}, ${details.state} - ${details.address}`);
      } else {
        console.log(`   ❌ Cannot fetch details - will keep current placeholders`);
      }

      console.log('');

      // Small delay to be API-friendly
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('📝 To apply these updates, run: npm run update-business-details');
    console.log('⚠️  This will modify your lib/ghl-config.ts file');

  } catch (error) {
    console.error('❌ Error previewing business details:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
