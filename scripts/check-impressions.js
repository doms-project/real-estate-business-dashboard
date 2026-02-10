const { createClient } = require('@supabase/supabase-js')
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

async function checkImpressions() {
  try {
    console.log('🔍 Checking campaign impressions...')

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('name, impressions, clicks, conversions, status')
      .order('name')

    if (error) {
      console.error('❌ Error fetching campaigns:', error.message)
      return
    }

    console.log(`📊 Found ${campaigns.length} campaigns:`)

    let totalImpressions = 0
    let totalClicks = 0
    let totalConversions = 0
    let activeImpressions = 0

    campaigns.forEach(campaign => {
      const impressions = campaign.impressions || 0
      const clicks = campaign.clicks || 0
      const conversions = campaign.conversions || 0

      totalImpressions += impressions
      totalClicks += clicks
      totalConversions += conversions

      if (campaign.status === 'active') {
        activeImpressions += impressions
      }

      console.log(`  ${campaign.name}: ${impressions.toLocaleString()} impressions, ${clicks} clicks, ${conversions} conversions (${campaign.status})`)
    })

    console.log(`\n📈 Totals:`)
    console.log(`  Total Impressions: ${totalImpressions.toLocaleString()}`)
    console.log(`  Active Campaign Impressions: ${activeImpressions.toLocaleString()}`)
    console.log(`  Total Clicks: ${totalClicks}`)
    console.log(`  Total Conversions: ${totalConversions}`)

    console.log(`\n🎯 Audience Reach should be: ${totalImpressions.toLocaleString()}`)

  } catch (error) {
    console.error('❌ Check failed:', error)
    process.exit(1)
  }
}

checkImpressions()