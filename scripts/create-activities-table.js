#!/usr/bin/env node

// Script to create the activities table in Supabase
// Run with: node scripts/create-activities-table.js

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

async function createActivitiesTable() {
  console.log('🏗️ Setting up activities table...')

  try {
    // Check if table already exists
    const { error: checkError } = await supabase
      .from('activities')
      .select('count', { count: 'exact', head: true })

    let tableExists = !checkError

    if (tableExists) {
      console.log('✅ Activities table already exists - updating configuration...')
    } else {
      console.log('📝 Creating activities table...')
    }

    // Create/update activities table and configuration
    const { error: setupError } = await supabase.rpc('exec_sql', {
      sql: `
        -- ============================================
        -- ACTIVITIES TABLE (Recent Activity Feed)
        -- ============================================
        CREATE TABLE IF NOT EXISTS activities (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id TEXT NOT NULL,
          workspace_id TEXT,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Indexes for activities
        CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
        CREATE INDEX IF NOT EXISTS idx_activities_workspace_id ON activities(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
        CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

        -- Enable RLS for activities
        ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

        -- RLS Policies for activities (drop first to avoid conflicts)
        DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
        DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;

        CREATE POLICY "Users can view their own activities" ON activities
          FOR SELECT USING (auth.uid()::text = user_id);

        CREATE POLICY "Users can insert their own activities" ON activities
          FOR INSERT WITH CHECK (auth.uid()::text = user_id);

        -- Enable realtime for activities table
        ALTER PUBLICATION supabase_realtime ADD TABLE activities;

        -- Auto-cleanup function for old activities (keeps only 2 days / 48 hours)
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

    if (setupError) {
      console.error('❌ Error setting up activities table:', setupError)
      return false
    }

    console.log(tableExists ? '✅ Activities table updated successfully!' : '✅ Activities table created successfully!')

    // Test the table
    const { data, error: testError } = await supabase
      .from('activities')
      .select('count', { count: 'exact', head: true })

    if (testError) {
      console.error('❌ Error testing activities table:', testError)
      return false
    }

    console.log(`✅ Activities table is working! Current count: ${data || 0}`)
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

// Run the migration
createActivitiesTable().then(success => {
  if (success) {
    console.log('🎉 Migration completed successfully!')
    process.exit(0)
  } else {
    console.log('💥 Migration failed!')
    process.exit(1)
  }
})