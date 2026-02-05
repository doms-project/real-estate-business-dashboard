/**
 * Simple migration runner that loads environment variables
 * Run with: node scripts/run-migration.js
 */

// Load environment variables from .env.local if it exists
require('dotenv').config({ path: '.env.local' })

// Now run the migration
require('./migrate-ghl-locations.js')