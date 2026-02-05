// GHL Configuration - Dynamic Location Management
export interface GHLLocationConfig {
  id: string
  name: string
  city: string
  state: string
  country: string
  address: string
  pitToken: string
  description?: string
}

// Load locations from JSON file for dynamic management
function loadLocationsFromFile(): GHLLocationConfig[] {
  try {
    const fs = require('fs');
    const path = require('path');
    const locationsPath = path.join(process.cwd(), 'lib', 'ghl-locations.json');

    if (fs.existsSync(locationsPath)) {
      const data = fs.readFileSync(locationsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Could not load locations from JSON, using empty array');
  }

  return [];
}

// Export the dynamically loaded locations
export const GHL_LOCATIONS: GHLLocationConfig[] = loadLocationsFromFile();

export const LOCATION_CACHE_TTL = 60 * 60 * 1000 // 1 hour in milliseconds
export const METRICS_BATCH_SIZE = 5 // Process 5 locations at a time to respect rate limits
