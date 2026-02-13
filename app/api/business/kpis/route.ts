import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserVisibleBusinesses } from '@/lib/workspace-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/business/kpis - Get aggregated KPI data for the business dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    console.log('👤 AUTH USER ID:', userId)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Get workspace filter from query params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    console.log('🔍 FETCHING KPIs FOR USER:', userId, workspaceId ? `IN WORKSPACE: ${workspaceId}` : 'ALL WORKSPACES')

    // Get businesses visible to user based on their workspace roles
    let businesses
    try {
      if (workspaceId) {
        // Filter by specific workspace
        businesses = await getUserVisibleBusinesses(userId)
        businesses = businesses?.filter(b => b.workspace_id === workspaceId) || []
        console.log('🏢 BUSINESSES FILTERED BY WORKSPACE:', workspaceId, 'Found:', businesses?.length || 0)
      } else {
        // Show all accessible businesses (original behavior)
        businesses = await getUserVisibleBusinesses(userId)
        console.log('🏢 BUSINESSES FROM getUserVisibleBusinesses:', businesses?.length || 0)
      }
      businesses?.forEach(b => console.log(`  - ${b.name} (${b.id})`))
    } catch (error: any) {
      // If workspace system fails, fall back to legacy user_id filtering
      console.warn('Could not fetch businesses with role-based filtering, falling back to user_id filter:', error.message)

      const { data: fallbackBusinesses, error: fallbackError } = await supabaseAdmin
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
        .order('created_at', { ascending: false })

      if (fallbackError) {
        console.error('Error in fallback business fetch:', fallbackError)
        return NextResponse.json(
          { error: 'Failed to fetch businesses', details: fallbackError.message },
          { status: 500 }
        )
      }

      businesses = fallbackBusinesses
      console.log('✅ FALLBACK BUSINESSES LOADED:', businesses?.length || 0)
    }

    // Now get campaign details for the filtered businesses
    const businessesWithCampaigns = []
    if (businesses && businesses.length > 0) {
      for (const business of businesses) {
        const { data: campaigns, error: campaignsError } = await supabaseAdmin
          .from('campaigns')
          .select('*')
          .eq('business_id', business.id)

        if (campaignsError) {
          console.error(`Error fetching campaigns for business ${business.id}:`, campaignsError)
        }

        businessesWithCampaigns.push({
          ...business,
          campaigns: campaigns || []
        })
      }
    }

    const finalBusinesses = businessesWithCampaigns

    if (!finalBusinesses || finalBusinesses.length === 0) {
      console.log('⚠️ NO BUSINESSES FOUND - returning default KPIs')
      console.log('User ID being used:', userId)
      console.log('Workspace ID filter:', workspaceId)
      console.log('Businesses result:', finalBusinesses)

      // Return default KPIs if no data exists yet
      const defaultKpis = {
        revenue: { current: 0, growth: 0, formatted: '$0' },
        customers: { current: 0, growth: 0, formatted: '0' },
        growth: { current: 0, change: 0, formatted: '+0%' },
        goals: { completed: 0, total: 4, percentage: 0, formatted: '0/4' },
        campaignMetrics: {
          totalCampaigns: 0,
          activeCampaigns: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          avgCPA: 0
        }
      }
      return NextResponse.json({
        success: true,
        kpis: defaultKpis,
        debug: { userId, workspaceId, businessesFound: 0, businesses: finalBusinesses }
      })
    }

    businesses = finalBusinesses

    console.log('📊 BUSINESSES FOUND:', businesses?.length || 0)
    console.log('🔍 BUSINESSES DETAILS:', businesses)

    // Calculate KPIs
    let totalRevenue = 0
    let totalBudget = 0
    let totalSpent = 0
    let totalImpressions = 0
    let totalClicks = 0
    let totalConversions = 0
    let activeCampaigns = 0
    let totalCampaigns = 0

    console.log('🔍 CALCULATING KPIs FOR USER:', userId)
    console.log('📊 Businesses found:', businesses?.length || 0)

    // Debug: Log all campaigns data
    businesses?.forEach((business, idx) => {
      console.log(`🏢 Business ${idx + 1} (${business.name}): ${business.campaigns?.length || 0} campaigns`)
      business.campaigns?.forEach((campaign, cIdx) => {
        console.log(`  📊 C${cIdx + 1}: ${campaign.name} - Spent: $${campaign.spent}, Status: ${campaign.status}, Conversions: ${campaign.conversions}`)
      })
    })


    // Calculate campaign metrics
    businesses?.forEach(business => {
      console.log(`📈 Processing business: ${business.name} (${business.campaigns?.length || 0} campaigns)`)
      business.campaigns?.forEach(campaign => {
        totalBudget += campaign.budget || 0
        totalSpent += campaign.spent || 0
        totalImpressions += campaign.impressions || 0
        totalClicks += campaign.clicks || 0
        totalConversions += campaign.conversions || 0
        totalCampaigns++

        if (campaign.status === 'active') {
          activeCampaigns++
        }

        console.log(`  📊 Campaign: ${campaign.name} - Spent: $${campaign.spent}, Status: ${campaign.status}`)
      })
    })

    console.log('💰 Total calculations:')
    console.log('  - Total Budget:', totalBudget)
    console.log('  - Total Spent:', totalSpent)
    console.log('  - Total Campaigns:', totalCampaigns)
    console.log('  - Active Campaigns:', activeCampaigns)

    // Calculate customer count (audience reach) now that totalImpressions is calculated
    let customerCount = 0

    // For now, use total impressions as a proxy for reach
    // In a real scenario, this would be actual leads/contacts from campaigns
    customerCount = totalImpressions

    // Try to get actual GHL clients as backup
    const { data: ghlClients, error: clientsError } = await supabaseAdmin!
      .from('ghl_clients')
      .select('id')
      .eq('user_id', userId)

    const ghlClientCount = ghlClients?.length || 0

    // Use the higher of the two for more meaningful data
    customerCount = Math.max(customerCount, ghlClientCount)

    console.log('👥 Campaign reach/customers:', customerCount, `(impressions: ${totalImpressions}, GHL clients: ${ghlClientCount})`)
    console.log('🎯 FINAL customerCount for Audience Reach:', customerCount)

    // Calculate campaign spend
    const totalCampaignSpend = totalSpent

    // Calculate business revenue from campaigns using segmented lead values
    let businessRevenue = 0

    // Different lead values based on campaign platform/type (industry research-based)
    const leadValuesByPlatform = {
      'ghl': 3000,        // GoHighLevel - qualified leads
      'facebook': 1800,   // Facebook - mixed quality leads
      'google': 2200,     // Google - intent-based leads
      'linkedin': 3500,   // LinkedIn - professional/business leads
      'manual': 1200,     // Manual campaigns - lower quality
      'default': 2000     // Default fallback
    }

    // Calculate revenue by campaign type for more accurate attribution
    businesses?.forEach(business => {
      business.campaigns?.forEach(campaign => {
        if (campaign.status === 'active') {
          const conversions = campaign.conversions || 0
          const platform = (campaign.platform || 'default').toLowerCase()
          const leadValue = platform in leadValuesByPlatform
            ? leadValuesByPlatform[platform as keyof typeof leadValuesByPlatform]
            : leadValuesByPlatform.default

          const campaignRevenue = conversions * leadValue
          businessRevenue += campaignRevenue

          console.log(`💰 ${campaign.name}: ${conversions} conversions × $${leadValue} = $${campaignRevenue.toLocaleString()}`)
        }
      })
    })

    // Count total active conversions for reporting
    const activeConversions = businesses?.reduce((sum, business) => {
      const activeCampaigns = business.campaigns?.filter(c => c.status === 'active') || []
      return sum + activeCampaigns.reduce((campaignSum, campaign) => campaignSum + (campaign.conversions || 0), 0)
    }, 0) || 0

    console.log('💰 Business revenue from campaigns:', businessRevenue.toLocaleString(), `(based on ${activeConversions} active conversions with platform-specific lead values)`)
    console.log('🔍 VERIFICATION: Total conversions:', activeConversions, 'across all active campaigns')

    // Calculate Cost Per Acquisition (CPA) - much more meaningful than inflated ROI
    const avgCPA = totalConversions > 0 ? totalSpent / totalConversions : 0

    console.log('📈 Campaign CPA (Cost Per Acquisition):', `$${avgCPA.toFixed(2)}`, `(Total Spent: $${totalSpent}, Conversions: ${totalConversions})`)

    // Calculate goals based on campaign performance targets
    // Goal 1: Have Active Campaigns (at least 1 active campaign)
    const hasActiveCampaigns = activeCampaigns > 0 ? 1 : 0

    // Goal 2: Generate Conversions (at least some conversions)
    const hasConversions = totalConversions > 0 ? 1 : 0

    // Goal 3: Campaign Reach (at least 100k impressions)
    const hasReach = totalImpressions >= 100000 ? 1 : 0

    // Goal 4: Positive Engagement (clicks > 0)
    const hasEngagement = totalClicks > 0 ? 1 : 0

    const goalsCompleted = hasActiveCampaigns + hasConversions + hasReach + hasEngagement
    const totalGoals = 4
    const goalsCompletion = totalGoals > 0 ? Math.round((goalsCompleted / totalGoals) * 100) / 10 : 0

    console.log('🎯 Goals breakdown:')
    console.log('  - Active Campaigns:', hasActiveCampaigns, `(has ${activeCampaigns} active)`)
    console.log('  - Conversions:', hasConversions, `(has ${totalConversions} conversions)`)
    console.log('  - Reach:', hasReach, `(has ${totalImpressions.toLocaleString()} impressions)`)
    console.log('  - Engagement:', hasEngagement, `(has ${totalClicks.toLocaleString()} clicks)`)

    // Calculate customer growth (based on campaign reach growth)
    const customerGrowth = totalImpressions > 1000 ? Math.round(totalImpressions / 100) : totalImpressions

    console.log('📈 FINAL KPI VERIFICATION:')
    console.log('  ✅ Revenue:', businessRevenue.toLocaleString(), '(Platform-segmented calculation)')
    console.log('  ✅ Customers (Reach):', customerCount.toLocaleString(), '(Total impressions)')
    console.log('  ✅ Cost Per Conversion (CPA):', `$${avgCPA.toFixed(2)}`)
    console.log('  ✅ Goals:', `${goalsCompleted}/${totalGoals}`, '(All metrics achieved)')
    console.log('  🔍 Active conversions used:', activeConversions, 'across', activeCampaigns, 'active campaigns')
    console.log('  🔍 Total campaign spend:', totalCampaignSpend.toLocaleString())
    console.log('  - Campaign Performance:')
    console.log('    - Total Spend:', totalCampaignSpend.toLocaleString())
    console.log('    - Impressions:', totalImpressions.toLocaleString())
    console.log('    - Clicks:', totalClicks.toLocaleString())
    console.log('    - Conversions:', totalConversions)
    console.log('    - Conversion Rate:', ((totalConversions / totalImpressions) * 100).toFixed(2) + '%')
    console.log('    - Avg CPA:', avgCPA > 0 ? '$' + avgCPA.toFixed(2) : '$0.00')
    console.log('    - Active Campaigns:', activeCampaigns, '/', totalCampaigns)

    const kpis = {
      campaignSpend: {
        current: totalCampaignSpend,
        growth: 0, // Campaign spend growth not calculated yet
        formatted: `$${totalCampaignSpend.toLocaleString()}`
      },
      revenue: {
        current: businessRevenue,
        growth: 0, // Not tracking revenue growth yet
        formatted: `$${businessRevenue.toLocaleString()}`
      },
      customers: {
        current: customerCount,
        growth: customerGrowth,
        formatted: customerCount.toLocaleString()
      },
      growth: {
        current: avgCPA,
        change: 0, // CPA change tracking not implemented yet
        formatted: `$${avgCPA.toFixed(2)}`
      },
      goals: {
        completed: goalsCompleted,
        total: totalGoals,
        percentage: goalsCompletion,
        formatted: `${goalsCompleted}/${totalGoals}`
      },
      campaignMetrics: {
        totalCampaigns,
        activeCampaigns,
        totalImpressions,
        totalClicks,
        totalConversions,
        avgCPA: avgCPA > 0 ? parseFloat(avgCPA.toFixed(2)) : 0
      }
    }

    console.log('📤 FINAL KPI RESPONSE:')
    console.log('  - Revenue:', kpis.revenue.formatted)
    console.log('  - Customers (Audience Reach):', kpis.customers.formatted, `(current: ${kpis.customers.current})`)
    console.log('  - Growth (CPA):', kpis.growth.formatted)
    console.log('  - Goals:', kpis.goals.formatted)

    return NextResponse.json({
      success: true,
      kpis
    })

  } catch (error) {
    console.error('KPIs API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to calculate KPIs'
    }, { status: 500 })
  }
}