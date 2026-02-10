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

async function setupBusinessHub() {
  try {
    console.log('🚀 Setting up Business Hub...')

    // Create initial businesses for the user
    const userId = 'user_38CZmoswsMI45GDQjhDfbiacB8f' // Your user ID

    // Insert businesses
    const businesses = [
      {
        user_id: userId,
        name: 'Church Track',
        description: 'Church marketing and community outreach campaigns',
        type: 'church'
      },
      {
        user_id: userId,
        name: 'Real Estate',
        description: 'Real estate property marketing and lead generation',
        type: 'real_estate'
      },
      {
        user_id: userId,
        name: 'Marketing Agency',
        description: 'Comprehensive marketing campaigns across all platforms',
        type: 'marketing'
      }
    ]

    console.log('📝 Creating businesses...')
    for (const business of businesses) {
      const { data, error } = await supabase
        .from('businesses')
        .insert(business)
        .select()
        .single()

      if (error) {
        console.error(`❌ Error creating business ${business.name}:`, error)
      } else {
        console.log(`✅ Created business: ${business.name} (${data.id})`)
        // Update the business reference for campaigns
        business.id = data.id
      }
    }

    // Create sample campaigns for each business
    const churchBusiness = businesses.find(b => b.type === 'church')
    const realEstateBusiness = businesses.find(b => b.type === 'real_estate')
    const marketingBusiness = businesses.find(b => b.type === 'marketing')

    const campaigns = [
      // Church Track campaigns
      {
        business_id: churchBusiness.id,
        user_id: userId,
        name: 'Sunday Service Promotion',
        status: 'active',
        platform: 'ghl',
        budget: 2500.00,
        spent: 1850.00,
        impressions: 45230,
        clicks: 1234,
        conversions: 89
      },
      {
        business_id: churchBusiness.id,
        user_id: userId,
        name: 'Community Outreach',
        status: 'active',
        platform: 'ghl',
        budget: 1800.00,
        spent: 1200.00,
        impressions: 32150,
        clicks: 890,
        conversions: 45
      },
      {
        business_id: churchBusiness.id,
        user_id: userId,
        name: 'Youth Program Campaign',
        status: 'paused',
        platform: 'manual',
        budget: 1200.00,
        spent: 450.00,
        impressions: 18900,
        clicks: 567,
        conversions: 23
      },

      // Real Estate campaigns
      {
        business_id: realEstateBusiness.id,
        user_id: userId,
        name: 'Property Listings Ads',
        status: 'active',
        platform: 'facebook',
        budget: 5000.00,
        spent: 3200.00,
        impressions: 125450,
        clicks: 3456,
        conversions: 156
      },
      {
        business_id: realEstateBusiness.id,
        user_id: userId,
        name: 'Lead Generation Campaign',
        status: 'active',
        platform: 'google',
        budget: 4500.00,
        spent: 2800.00,
        impressions: 98230,
        clicks: 2890,
        conversions: 134
      },
      {
        business_id: realEstateBusiness.id,
        user_id: userId,
        name: 'Brand Awareness',
        status: 'active',
        platform: 'linkedin',
        budget: 3000.00,
        spent: 1950.00,
        impressions: 156780,
        clicks: 4123,
        conversions: 78
      },

      // Marketing Agency campaigns (mix of GHL and custom)
      {
        business_id: marketingBusiness.id,
        user_id: userId,
        name: 'Email Marketing Campaign',
        status: 'active',
        platform: 'ghl',
        budget: 800.00,
        spent: 520.00,
        impressions: 0, // Email doesn't have impressions
        clicks: 245,
        conversions: 67
      },
      {
        business_id: marketingBusiness.id,
        user_id: userId,
        name: 'Social Media Boost',
        status: 'active',
        platform: 'facebook',
        budget: 1200.00,
        spent: 890.00,
        impressions: 45600,
        clicks: 1234,
        conversions: 89
      },
      {
        business_id: marketingBusiness.id,
        user_id: userId,
        name: 'SEO Optimization',
        status: 'active',
        platform: 'manual',
        budget: 2500.00,
        spent: 1800.00,
        impressions: 0, // SEO doesn't have traditional impressions
        clicks: 0,
        conversions: 45
      }
    ]

    console.log('📝 Creating campaigns...')
    for (const campaign of campaigns) {
      // Calculate ROAS and other metrics
      const roas = campaign.spent > 0 ? (campaign.conversions * 100) / campaign.spent : 0
      const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0
      const cpc = campaign.clicks > 0 ? campaign.spent / campaign.clicks : 0
      const cpa = campaign.conversions > 0 ? campaign.spent / campaign.conversions : 0

      const campaignData = {
        ...campaign,
        roas: Math.round(roas * 100) / 100,
        ctr: Math.round(ctr * 10000) / 10000,
        cpc: Math.round(cpc * 10000) / 10000,
        cpa: Math.round(cpa * 10000) / 10000
      }

      const { error } = await supabase
        .from('campaigns')
        .insert(campaignData)

      if (error) {
        console.error(`❌ Error creating campaign ${campaign.name}:`, error)
      } else {
        console.log(`✅ Created campaign: ${campaign.name} (${campaign.platform})`)
      }
    }

    console.log('🎉 Business Hub setup complete!')
    console.log('📊 Created 3 businesses with sample campaigns')

  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

setupBusinessHub()