/**
 * Migration script to move GHL locations from JSON file to database
 * Run this script to migrate existing locations to the new database table
 */

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function migrateLocations() {
  try {
    console.log('🚀 Starting GHL locations migration...');

    // Read the JSON file
    const locationsPath = path.join(process.cwd(), 'lib', 'ghl-locations.json');
    console.log('📁 Reading locations from:', locationsPath);

    const jsonData = await fs.readFile(locationsPath, 'utf8');
    const locations = JSON.parse(jsonData);

    console.log(`📊 Found ${locations.length} locations in JSON file`);

    // Transform and insert data
    const transformedLocations = locations.map(location => ({
      id: location.id,
      name: location.name,
      city: location.city || '',
      state: location.state || '',
      country: location.country || 'US',
      address: location.address || '',
      pit_token: location.pitToken, // Note: JSON uses pitToken, DB uses pit_token
      description: location.description || location.name,
      is_active: true
    }));

    console.log('🔄 Inserting locations into database...');

    // Insert in batches to avoid overwhelming the database
    const batchSize = 10;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < transformedLocations.length; i += batchSize) {
      const batch = transformedLocations.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(transformedLocations.length/batchSize)}`);

      const { data, error } = await supabase
        .from('ghl_locations')
        .upsert(batch, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('❌ Error inserting batch:', error);
        throw error;
      }

      console.log(`✅ Batch inserted/updated ${data.length} locations`);
      inserted += data.length;
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`📈 Total locations processed: ${locations.length}`);
    console.log(`✅ Successfully migrated to database`);

    // Verify the migration
    const { data: verifyData, error: verifyError } = await supabase
      .from('ghl_locations')
      .select('id, name')
      .eq('is_active', true);

    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
    } else {
      console.log(`🔍 Verification: ${verifyData.length} active locations in database`);
      console.log('📋 Location names:', verifyData.map(l => l.name).join(', '));
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateLocations();