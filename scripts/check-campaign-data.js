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

async function checkCampaignData() {
  try {
    console.log('🔍 Checking campaign data in database...')

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('name, conversions, status, business_id')
      .order('name')

    if (error) {
      console.error('❌ Error fetching campaigns:', error.message)
      return
    }

    console.log(`📊 Found ${campaigns.length} campaigns:`)

    const activeCampaigns = campaigns.filter(c => c.status === 'active')
    const activeConversions = activeCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0)

    console.log(`\n🎯 Active campaigns: ${activeCampaigns.length}`)
    console.log(`💰 Active conversions: ${activeConversions}`)
    console.log(`💵 Revenue calculation: ${activeConversions} × $2500 = $${(activeConversions * 2500).toLocaleString()}`)

    console.log('\n📋 Campaign details:')
    campaigns.forEach(campaign => {
      console.log(`  ${campaign.name}: ${campaign.conversions} conversions (${campaign.status})`)
    })

    // Check for duplicates
    const nameCounts = {}
    campaigns.forEach(c => {
      nameCounts[c.name] = (nameCounts[c.name] || 0) + 1
    })

    const duplicates = Object.entries(nameCounts).filter(([_, count]) => count > 1)
    if (duplicates.length > 0) {
      console.log('\n⚠️  Duplicate campaigns found:')
      duplicates.forEach(([name, count]) => {
        console.log(`  ${name}: ${count} copies`)
      })
    }

  } catch (error) {
    console.error('❌ Check failed:', error)
    process.exit(1)
  }
}

checkCampaignData()