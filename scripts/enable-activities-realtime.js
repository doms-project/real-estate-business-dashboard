#!/usr/bin/env node

// Script to enable realtime for the activities table
// Run with: node scripts/enable-activities-realtime.js

const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function enableRealtime() {
  console.log('🔄 Enabling realtime for activities table...')

  try {
    // Check if activities table exists
    const { error: checkError } = await supabase
      .from('activities')
      .select('count', { count: 'exact', head: true })

    if (checkError) {
      console.error('❌ Activities table does not exist. Please create it first.')
      console.log('💡 Run: node scripts/create-activities-table.js')
      return false
    }

    console.log('✅ Activities table exists')

    // Enable realtime for activities table
    const { error: realtimeError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER PUBLICATION supabase_realtime ADD TABLE activities;'
    })

    if (realtimeError) {
      console.error('❌ Error enabling realtime:', realtimeError)
      return false
    }

    console.log('✅ Realtime enabled for activities table!')

    // Update cleanup function to 48 hours
    const { error: cleanupError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION cleanup_old_activities()
        RETURNS TABLE(deleted_count bigint) AS $$
        DECLARE
          deleted_count bigint;
        BEGIN
          DELETE FROM activities
          WHERE created_at < NOW() - INTERVAL '2 days';

          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          RETURN QUERY SELECT deleted_count;
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (cleanupError) {
      console.error('❌ Error updating cleanup function:', cleanupError)
      return false
    }

    console.log('✅ Cleanup function updated to 48 hours')

    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

// Run the script
enableRealtime().then(success => {
  if (success) {
    console.log('🎉 Activities realtime enabled successfully!')
    console.log('📝 Your Recent Activity feed should now work!')
    process.exit(0)
  } else {
    console.log('💥 Failed to enable activities realtime!')
    process.exit(1)
  }
})