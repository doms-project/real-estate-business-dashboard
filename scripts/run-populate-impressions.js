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

async function populateImpressions() {
  try {
    console.log('📊 Populating campaign impressions...')

    // Update each campaign with impression, clicks, and conversion values
    const updates = [
      { name: 'Sunday Service Promotion', impressions: 45230, clicks: 1234, conversions: 89 },
      { name: 'Community Outreach', impressions: 32150, clicks: 890, conversions: 45 },
      { name: 'Youth Program Campaign', impressions: 18900, clicks: 567, conversions: 23 },
      { name: 'Property Listings Ads', impressions: 125450, clicks: 3456, conversions: 156 },
      { name: 'Lead Generation Campaign', impressions: 98230, clicks: 2890, conversions: 134 },
      { name: 'Brand Awareness', impressions: 156780, clicks: 4123, conversions: 78 },
      { name: 'Social Media Boost', impressions: 45600, clicks: 1234, conversions: 89 },
      { name: 'Email Marketing Campaign', impressions: 0, clicks: 245, conversions: 67 },
      { name: 'SEO Optimization', impressions: 10, clicks: 0, conversions: 45 },
    ]

    for (const update of updates) {
      console.log(`Updating ${update.name} with ${update.impressions} impressions, ${update.clicks} clicks, ${update.conversions} conversions...`)

      const { error } = await supabase
        .from('campaigns')
        .update({
          impressions: update.impressions,
          clicks: update.clicks,
          conversions: update.conversions
        })
        .eq('name', update.name)

      if (error) {
        console.error(`❌ Error updating ${update.name}:`, error.message)
      } else {
        console.log(`✅ Updated ${update.name}`)
      }
    }

    // Verify the updates
    const { data: campaigns, error: selectError } = await supabase
      .from('campaigns')
      .select('name, impressions, clicks, conversions')
      .order('created_at', { ascending: false })

    if (selectError) {
      console.error('❌ Error verifying updates:', selectError.message)
    } else {
      console.log('📊 Verification - Updated campaigns:')
      campaigns.forEach(campaign => {
        console.log(`  ${campaign.name}: ${campaign.impressions} impressions, ${campaign.clicks} clicks, ${campaign.conversions} conversions`)
      })

      const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0)
      console.log(`\n📈 Total Impressions: ${totalImpressions.toLocaleString()}`)
    }

    console.log('✅ Impression population completed!')

  } catch (error) {
    console.error('❌ Population failed:', error)
    process.exit(1)
  }
}

populateImpressions()