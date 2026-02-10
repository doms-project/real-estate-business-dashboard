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

async function removeDuplicateCampaigns() {
  try {
    console.log('🧹 Removing duplicate campaigns...')

    // Get all campaigns
    const { data: allCampaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select('id, name, created_at')
      .order('name, created_at')

    if (fetchError) {
      console.error('❌ Error fetching campaigns:', fetchError.message)
      return
    }

    console.log(`📊 Found ${allCampaigns.length} total campaigns`)

    // Group by name and identify duplicates
    const campaignsByName = {}
    allCampaigns.forEach(campaign => {
      if (!campaignsByName[campaign.name]) {
        campaignsByName[campaign.name] = []
      }
      campaignsByName[campaign.name].push(campaign)
    })

    // Find campaigns with duplicates
    const duplicatesToRemove = []
    Object.entries(campaignsByName).forEach(([name, campaigns]) => {
      if (campaigns.length > 1) {
        // Keep the first one (oldest), remove the rest
        const toKeep = campaigns[0]
        const toRemove = campaigns.slice(1)
        duplicatesToRemove.push(...toRemove)

        console.log(`📋 ${name}: keeping 1, removing ${toRemove.length}`)
      }
    })

    if (duplicatesToRemove.length === 0) {
      console.log('✅ No duplicates found!')
      return
    }

    console.log(`🗑️  Will remove ${duplicatesToRemove.length} duplicate campaigns`)

    // Remove duplicates
    for (const campaign of duplicatesToRemove) {
      console.log(`Deleting duplicate: ${campaign.name} (ID: ${campaign.id})`)

      const { error: deleteError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaign.id)

      if (deleteError) {
        console.error(`❌ Error deleting ${campaign.name}:`, deleteError.message)
      } else {
        console.log(`✅ Deleted ${campaign.name}`)
      }
    }

    // Verify the cleanup
    const { data: remainingCampaigns, error: verifyError } = await supabase
      .from('campaigns')
      .select('name, conversions, status')

    if (verifyError) {
      console.error('❌ Error verifying cleanup:', verifyError.message)
      return
    }

    console.log(`\n📊 After cleanup: ${remainingCampaigns.length} campaigns remain`)

    const activeConversions = remainingCampaigns
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.conversions || 0), 0)

    console.log(`💰 Active conversions: ${activeConversions}`)
    console.log(`💵 Correct revenue: ${activeConversions} × $2500 = $${(activeConversions * 2500).toLocaleString()}`)

  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  }
}

removeDuplicateCampaigns()