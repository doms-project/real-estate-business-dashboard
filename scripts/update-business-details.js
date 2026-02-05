#!/usr/bin/env node

/**
 * Utility script to automatically fetch and update business details for GoHighLevel clients
 * This script reads the ghl-config.ts file, finds clients with placeholder addresses,
 * fetches real business details from the GoHighLevel API, and updates the configuration.
 */

const fs = require('fs');
const path = require('path');

// Read the config file
function readConfigFile() {
  const configPath = path.join(__dirname, '..', 'lib', 'ghl-config.ts');
  const content = fs.readFileSync(configPath, 'utf8');

  // Extract the GHL_LOCATIONS array using regex
  const arrayMatch = content.match(/export const GHL_LOCATIONS: GHLLocationConfig\[\] = \[([\s\S]*?)\]/);
  if (!arrayMatch) {
    throw new Error('Could not find GHL_LOCATIONS array in config file');
  }

  return {
    fullContent: content,
    arrayContent: arrayMatch[1],
    configPath
  };
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

// Check if a location needs updating (has placeholder values)
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
    console.error(`Failed to fetch details for ${locationId}:`, error.message);
    return null;
  }
}

// Update the config file with new business details
function updateConfigFile(locations, configPath, fullContent) {
  let updatedArrayContent = '';

  locations.forEach((location, index) => {
    updatedArrayContent += `  {
    id: '${location.id}',
    name: '${location.name}',
    city: '${location.city}',
    state: '${location.state}',
    country: '${location.country}',
    address: '${location.address.replace(/'/g, "\\'")}',
    pitToken: '${location.pitToken}',
    description: '${location.description}'
  }`;

    if (index < locations.length - 1) {
      updatedArrayContent += ',';
    }
    updatedArrayContent += '\n';
  });

  const updatedContent = fullContent.replace(
    /export const GHL_LOCATIONS: GHLLocationConfig\[\] = \[([\s\S]*?)\]/,
    `export const GHL_LOCATIONS: GHLLocationConfig[] = [
${updatedArrayContent}]`
  );

  fs.writeFileSync(configPath, updatedContent, 'utf8');
  console.log('✅ Config file updated successfully');
}

// Main execution
async function main() {
  try {
    console.log('🔄 Starting automatic business details update...');

    // Read and parse config
    const { configPath, fullContent, arrayContent } = readConfigFile();
    const locations = parseLocationsArray(arrayContent);

    console.log(`📋 Found ${locations.length} locations in config`);

    // Find locations that need updating
    const locationsToUpdate = locations.filter(needsUpdate);
    console.log(`🎯 Found ${locationsToUpdate.length} locations needing updates`);

    if (locationsToUpdate.length === 0) {
      console.log('✅ All locations already have complete business details');
      return;
    }

    // Update each location
    for (const location of locationsToUpdate) {
      console.log(`🔍 Fetching details for ${location.name} (${location.id})...`);

      const details = await fetchBusinessDetails(location.id, location.pitToken);

      if (details) {
        location.city = details.city;
        location.state = details.state;
        location.address = details.address;
        location.country = details.country;

        console.log(`✅ Updated ${location.name}: ${location.city}, ${location.state} - ${location.address}`);
      } else {
        console.log(`❌ Failed to update ${location.name} - keeping placeholders`);
      }

      // Small delay to be API-friendly
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save updated config
    updateConfigFile(locations, configPath, fullContent);

    console.log('🎉 Business details update completed!');
    console.log('💡 Your dashboard will now show real business addresses instead of placeholders');

  } catch (error) {
    console.error('❌ Error updating business details:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
