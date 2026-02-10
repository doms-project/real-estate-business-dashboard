const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function runCampaignDecimalsFix() {
  try {
    console.log('🔧 Running campaign decimals fix migration...')

    // Check if we can connect to Supabase
    const { data, error: testError } = await supabase.from('campaigns').select('id').limit(1)
    if (testError) {
      console.error('❌ Cannot connect to Supabase:', testError.message)
      console.log('⚠️  Please run the SQL manually in your Supabase dashboard:')
      const sqlPath = path.join(__dirname, 'fix-campaign-decimals.sql')
      const sql = fs.readFileSync(sqlPath, 'utf8')
      console.log('\n--- SQL to run ---')
      console.log(sql)
      console.log('--- End SQL ---')
      return
    }

    console.log('✅ Connected to Supabase')

    // For now, just show the SQL that needs to be run
    console.log('⚠️  Supabase client cannot run DDL statements directly.')
    console.log('Please run the following SQL in your Supabase SQL editor:')
    const sqlPath = path.join(__dirname, 'fix-campaign-decimals.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    console.log('\n--- SQL to run ---')
    console.log(sql)
    console.log('--- End SQL ---')

    console.log('✅ Migration script completed (manual SQL execution required)')

  } catch (error) {
    console.error('❌ Migration script failed:', error)
    process.exit(1)
  }
}

runCampaignDecimalsFix()