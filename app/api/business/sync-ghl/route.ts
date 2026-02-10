import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/business/sync-ghl - Sync GHL campaigns to businesses
 * Maps GHL locations to businesses and imports campaign data
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Get all businesses for this user
    const { data: businesses, error: businessError } = await supabaseAdmin!
      .from('businesses')
      .select('*')
      .eq('user_id', userId)

    if (businessError) {
      console.error('Error fetching businesses:', businessError)
      return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 })
    }

    if (!businesses || businesses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No businesses found. Please create businesses first.'
      }, { status: 400 })
    }

    // Get all locations with tokens
    const { data: locations, error: locationError } = await supabaseAdmin!
      .from('ghl_locations')
      .select('*')
      .eq('is_active', true)

    if (locationError) {
      console.error('Error fetching locations:', locationError)
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
    }

    let totalSynced = 0
    const results = []

    // For each location, try to sync campaigns to appropriate business
    for (const location of locations || []) {
      try {
        // Determine which business this location belongs to
        // This is a simple mapping - you might want to make this configurable
        let targetBusiness = null

        if (location.name.toLowerCase().includes('church') ||
            location.name.toLowerCase().includes('community') ||
            location.name.toLowerCase().includes('youth')) {
          targetBusiness = businesses.find(b => b.type === 'church')
        } else if (location.name.toLowerCase().includes('real estate') ||
                   location.name.toLowerCase().includes('property')) {
          targetBusiness = businesses.find(b => b.type === 'real_estate')
        } else {
          // Default to marketing agency for other locations
          targetBusiness = businesses.find(b => b.type === 'marketing')
        }

        if (!targetBusiness) {
          console.log(`⚠️ No matching business found for location: ${location.name}`)
          continue
        }

        // Fetch campaigns directly from GHL API (same logic as campaigns endpoint)
        const token = location.pit_token
        if (!token) {
          console.log(`⚠️ No PIT token found for ${location.name}`)
          continue
        }

        const response = await fetch(`https://services.leadconnectorhq.com/campaigns/?locationId=${location.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Version': '2021-07-28'
          }
        })

        if (!response.ok) {
          console.log(`⚠️ Failed to fetch campaigns for ${location.name}: ${response.status} ${response.statusText}`)
          continue
        }

        const data = await response.json()
        const campaigns = data.campaigns || []

        if (campaigns.length === 0) {
          console.log(`⚠️ No campaigns found for ${location.name}`)
          continue
        }

        // Get detailed metrics for each campaign
        const campaignsWithMetrics = await Promise.all(
          campaigns.map(async (campaign: any) => {
            try {
              // Try to get campaign performance metrics
              const metricsResponse = await fetch(`https://services.leadconnectorhq.com/campaigns/${campaign.id}/stats`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                  'Version': '2021-07-28'
                }
              })

              let metrics: any = {}
              if (metricsResponse.ok) {
                metrics = await metricsResponse.json()
              }

              return {
                ...campaign,
                metrics,
                performance: {
                  sent: metrics.sent || 0,
                  delivered: metrics.delivered || 0,
                  opened: metrics.opened || 0,
                  clicked: metrics.clicked || 0,
                  bounced: metrics.bounced || 0,
                  unsubscribed: metrics.unsubscribed || 0,
                  complained: metrics.complained || 0,
                  openRate: metrics.sent > 0 ? ((metrics.opened || 0) / metrics.sent * 100).toFixed(2) : 0,
                  clickRate: metrics.sent > 0 ? ((metrics.clicked || 0) / metrics.sent * 100).toFixed(2) : 0,
                  bounceRate: metrics.sent > 0 ? ((metrics.bounced || 0) / metrics.sent * 100).toFixed(2) : 0
                }
              }
            } catch (error) {
              // Return campaign with basic info if detailed fetch fails
              return {
                ...campaign,
                metrics: {},
                performance: {
                  sent: 0,
                  delivered: 0,
                  opened: 0,
                  clicked: 0,
                  bounced: 0,
                  unsubscribed: 0,
                  complained: 0,
                  openRate: 0,
                  clickRate: 0,
                  bounceRate: 0
                }
              }
            }
          })
        )

        // Import campaigns to the target business
        for (const campaign of campaignsWithMetrics) {
          const campaignData = {
            business_id: targetBusiness.id,
            user_id: userId,
            ghl_campaign_id: campaign.id,
            name: campaign.name,
            status: campaign.status === 'active' ? 'active' : 'paused',
            platform: 'ghl',

            // Use GHL metrics where available
            impressions: campaign.performance.sent || 0,
            clicks: campaign.performance.clicked || 0,
            conversions: 0, // GHL doesn't provide conversion data directly

            // Financial data - will need to be filled manually
            budget: null,
            spent: null,
            currency: 'USD',

            // Notes about the sync
            notes: `Synced from GHL location: ${location.name}`,

            // Initialize calculated metrics
            ctr: 0,
            cpc: 0,
            cpa: 0,
            roas: 0
          }

          // Calculate basic metrics
          campaignData.ctr = campaignData.impressions > 0 ?
            (campaignData.clicks / campaignData.impressions) * 100 : 0
          campaignData.cpc = 0 // Will be calculated when budget is added
          campaignData.cpa = 0 // Will be calculated when conversions are added
          campaignData.roas = 0 // Will be calculated when budget/spent are added

          // Check if campaign already exists
          const { data: existingCampaign } = await supabaseAdmin!
            .from('campaigns')
            .select('id')
            .eq('business_id', targetBusiness.id)
            .eq('ghl_campaign_id', campaign.id)
            .single()

          let syncResult
          if (existingCampaign) {
            // Update existing campaign
            syncResult = await supabaseAdmin!
              .from('campaigns')
              .update({
                ...campaignData,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingCampaign.id)
          } else {
            // Insert new campaign
            syncResult = await supabaseAdmin!
              .from('campaigns')
              .insert({
                ...campaignData,
                updated_at: new Date().toISOString()
              })
          }

          if (syncResult.error) {
            console.error(`❌ Error syncing campaign ${campaign.name}:`, syncResult.error)
          } else {
            totalSynced++
            console.log(`✅ Synced campaign: ${campaign.name} → ${targetBusiness.name}`)
          }
        }

        results.push({
          location: location.name,
          business: targetBusiness.name,
          campaignsSynced: campaignsWithMetrics.length
        })

      } catch (locationError) {
        console.error(`❌ Error syncing location ${location.name}:`, locationError)
      }
    }

    return NextResponse.json({
      success: true,
      totalSynced,
      results,
      message: `Successfully synced ${totalSynced} campaigns across ${results.length} locations`
    })

  } catch (error) {
    console.error('GHL sync error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to sync GHL campaigns'
    }, { status: 500 })
  }
}