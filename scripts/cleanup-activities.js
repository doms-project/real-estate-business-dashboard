#!/usr/bin/env node

/**
 * Daily cleanup script for activities
 * Run this daily to remove activities older than 1 day
 */

const { createClient } = require('@supabase/supabase-js')

// You'll need to set these environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanupOldActivities() {
  try {
    console.log('🧹 Starting daily activity cleanup...')

    // Delete activities older than 1 day
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { data, error } = await supabase
      .from('activities')
      .delete()
      .lt('created_at', oneDayAgo.toISOString())
      .select('id')

    if (error) {
      console.error('❌ Error cleaning up activities:', error)
      process.exit(1)
    }

    console.log(`✅ Successfully cleaned up ${data?.length || 0} old activities`)

  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  }
}

// Run the cleanup
cleanupOldActivities()