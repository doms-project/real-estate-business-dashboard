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

// Simulate the KPI calculation logic
async function debugKPICalculation() {
  try {
    console.log('🐛 Debugging KPI calculation...')

    // Get user ID (using the same logic as the API)
    const userId = 'user_38CZmoswsMI45GDQjhDfbiacB8f' // From your previous logs

    // Fetch businesses with campaigns (same as KPI API)
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        type,
        campaigns (
          id,
          name,
          budget,
          spent,
          impressions,
          clicks,
          conversions,
          status,
          platform,
          created_at
        )
      `)
      .eq('user_id', userId)

    if (businessError) {
      console.error('❌ Error fetching businesses:', businessError.message)
      return
    }

    console.log(`📊 Found ${businesses?.length || 0} businesses`)

    // Simulate the KPI calculation
    let totalImpressions = 0
    let totalClicks = 0
    let totalConversions = 0
    let totalCampaigns = 0
    let activeCampaigns = 0

    businesses?.forEach(business => {
      console.log(`🏢 Business: ${business.name} (${business.campaigns?.length || 0} campaigns)`)
      business.campaigns?.forEach(campaign => {
        const impressions = campaign.impressions || 0
        const clicks = campaign.clicks || 0
        const conversions = campaign.conversions || 0

        totalImpressions += impressions
        totalClicks += clicks
        totalConversions += conversions
        totalCampaigns++

        if (campaign.status === 'active') {
          activeCampaigns++
        }

        console.log(`  📊 ${campaign.name}: ${impressions} impressions, ${clicks} clicks, ${conversions} conversions (${campaign.status})`)
      })
    })

    // Calculate customer count (audience reach)
    let customerCount = 0
    customerCount = totalImpressions

    // Try to get GHL clients as backup
    const { data: ghlClients, error: clientsError } = await supabase
      .from('ghl_clients')
      .select('id')
      .eq('user_id', userId)

    const ghlClientCount = ghlClients?.length || 0
    customerCount = Math.max(customerCount, ghlClientCount)

    console.log(`\n📈 Calculation Results:`)
    console.log(`  Total Campaigns: ${totalCampaigns}`)
    console.log(`  Active Campaigns: ${activeCampaigns}`)
    console.log(`  Total Impressions: ${totalImpressions}`)
    console.log(`  Total Clicks: ${totalClicks}`)
    console.log(`  Total Conversions: ${totalConversions}`)
    console.log(`  GHL Clients: ${ghlClientCount}`)
    console.log(`  Customer Count (Audience Reach): ${customerCount}`)
    console.log(`  Expected Audience Reach KPI: ${customerCount.toLocaleString()}`)

    if (totalImpressions === 0) {
      console.log('\n❌ ISSUE: totalImpressions is 0!')
      console.log('This means campaigns have null/undefined impressions values')
    }

  } catch (error) {
    console.error('❌ Debug failed:', error)
    process.exit(1)
  }
}

debugKPICalculation()