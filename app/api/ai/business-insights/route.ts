import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ai/business-insights - Get aggregated business insights for AI context
 * Returns structured business data from all available tables
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get user's workspace
    const { data: workspaces } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('user_id', userId)
      .single()

    const workspaceId = workspaces?.id

    // Parallel data fetching for better performance
    const [
      websitesData,
      subscriptionsData,
      propertiesData,
      blopsData,
      agencyClientsData
    ] = await Promise.all([
      // Websites with tech stack analysis
      supabaseAdmin
        .from('websites')
        .select('*, tech_stack')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      // Subscriptions with cost analysis
      supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('renewal_date', { ascending: true }),

      // Properties with financial analysis
      supabaseAdmin
        .from('properties')
        .select('*')
        .eq('user_id', userId),

      // Flexboard activity (blops count)
      supabaseAdmin
        .from('blops')
        .select('id')
        .eq('user_id', userId),

      // Agency clients (if any)
      supabaseAdmin
        .from('agency_clients')
        .select('*')
        .eq('user_id', userId)
    ])

    // Process websites data
    const websites = websitesData.data || []
    const liveSites = websites.length
    const techStackStats = analyzeTechStack(websites)

    // Process subscriptions data
    const subscriptions = subscriptionsData.data || []
    const subscriptionStats = analyzeSubscriptions(subscriptions)

    // Process properties data
    const properties = propertiesData.data || []
    const propertyStats = analyzeProperties(properties)

    // Process blops data
    const totalBlops = blopsData.data?.length || 0

    // Process agency clients
    const agencyClients = agencyClientsData.data || []

    // Generate business insights and recommendations
    const insights = generateBusinessInsights({
      websites,
      subscriptions,
      properties,
      blops: totalBlops,
      agencyClients
    })

    // Structure the response for AI consumption
    const businessInsights = {
      // Core business metrics
      overview: {
        liveWebsites: liveSites,
        activeSubscriptions: subscriptions.length,
        totalProperties: properties.length,
        totalBlops: totalBlops,
        agencyClients: agencyClients.length
      },

      // Financial metrics
      financial: {
        monthlySubscriptionSpend: subscriptionStats.monthlyTotal,
        annualSubscriptionSpend: subscriptionStats.monthlyTotal * 12,
        propertyValue: propertyStats.totalValue,
        propertyIncome: propertyStats.monthlyIncome,
        currency: 'USD' // Default, could be made configurable
      },

      // Technology portfolio
      technology: {
        techStack: techStackStats,
        paymentMethods: techStackStats.paymentMethods,
        hostingProviders: techStackStats.hostingProviders,
        analyticsTools: techStackStats.analyticsTools
      },

      // Subscription insights
      subscriptions: {
        breakdown: subscriptionStats.categoryBreakdown,
        upcomingRenewals: subscriptionStats.upcomingRenewals,
        monthlyTotal: subscriptionStats.monthlyTotal,
        costEfficiency: subscriptionStats.costEfficiency
      },

      // Property insights
      realEstate: {
        portfolio: propertyStats.portfolio,
        occupancyRate: propertyStats.occupancyRate,
        maintenanceStatus: propertyStats.maintenanceStatus,
        investmentPerformance: propertyStats.investmentPerformance
      },

      // Activity and productivity
      productivity: {
        blopsActivity: totalBlops > 0 ? 'Active' : 'Low',
        websiteUpdates: websites.filter(w => {
          const updated = new Date(w.updated_at || w.created_at)
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          return updated > weekAgo
        }).length,
        recentActivity: insights.recentActivity
      },

      // AI-generated insights and recommendations
      insights: {
        strengths: insights.strengths,
        opportunities: insights.opportunities,
        recommendations: insights.recommendations,
        risks: insights.risks
      },

      // Raw data for detailed analysis (if needed)
      rawData: {
        websites: websites.slice(0, 5), // Limit for token efficiency
        subscriptions: subscriptions.slice(0, 5),
        properties: properties.slice(0, 3),
        lastUpdated: new Date().toISOString()
      }
    }

    return NextResponse.json(businessInsights)

  } catch (error: any) {
    console.error('Error in GET /api/ai/business-insights:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Helper functions for data analysis

function analyzeTechStack(websites: any[]) {
  const techStats = {
    frontend: {} as Record<string, number>,
    backend: {} as Record<string, number>,
    hosting: {} as Record<string, number>,
    analytics: {} as Record<string, number>,
    paymentMethods: [] as string[],
    hostingProviders: [] as string[],
    analyticsTools: [] as string[]
  }

  websites.forEach(website => {
    const stack = website.tech_stack || {}

    // Count technologies
    if (stack.frontend) techStats.frontend[stack.frontend] = (techStats.frontend[stack.frontend] || 0) + 1
    if (stack.backend) techStats.backend[stack.backend] = (techStats.backend[stack.backend] || 0) + 1
    if (stack.hosting) techStats.hosting[stack.hosting] = (techStats.hosting[stack.hosting] || 0) + 1
    if (stack.analytics) techStats.analytics[stack.analytics] = (techStats.analytics[stack.analytics] || 0) + 1

    // Collect unique lists
    if (stack.paymentMethod && !techStats.paymentMethods.includes(stack.paymentMethod)) {
      techStats.paymentMethods.push(stack.paymentMethod)
    }
    if (stack.hosting && !techStats.hostingProviders.includes(stack.hosting)) {
      techStats.hostingProviders.push(stack.hosting)
    }
    if (stack.analytics && !techStats.analyticsTools.includes(stack.analytics)) {
      techStats.analyticsTools.push(stack.analytics)
    }
  })

  return techStats
}

function analyzeSubscriptions(subscriptions: any[]) {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const stats = {
    monthlyTotal: 0,
    categoryBreakdown: {} as Record<string, number>,
    upcomingRenewals: [] as any[],
    costEfficiency: 'Unknown'
  }

  subscriptions.forEach(sub => {
    stats.monthlyTotal += parseFloat(sub.cost) || 0

    // Category breakdown
    stats.categoryBreakdown[sub.category] = (stats.categoryBreakdown[sub.category] || 0) + 1

    // Upcoming renewals (next 30 days)
    const renewalDate = new Date(sub.renewal_date)
    if (renewalDate >= now && renewalDate <= nextMonth) {
      stats.upcomingRenewals.push({
        name: sub.name,
        cost: sub.cost,
        renewalDate: sub.renewal_date,
        category: sub.category
      })
    }
  })

  // Cost efficiency analysis
  if (stats.monthlyTotal > 1000) {
    stats.costEfficiency = 'High'
  } else if (stats.monthlyTotal > 500) {
    stats.costEfficiency = 'Moderate'
  } else {
    stats.costEfficiency = 'Low'
  }

  return stats
}

function analyzeProperties(properties: any[]) {
  const stats = {
    totalValue: 0,
    monthlyIncome: 0,
    portfolio: {
      residential: 0,
      commercial: 0,
      vacant: 0,
      occupied: 0
    },
    occupancyRate: 0,
    maintenanceStatus: 'Unknown',
    investmentPerformance: 'Unknown'
  }

  properties.forEach(property => {
    stats.totalValue += parseFloat(property.purchase_price || 0)

    if (property.property_type === 'Residential') stats.portfolio.residential++
    if (property.property_type === 'Commercial') stats.portfolio.commercial++
    if (property.status === 'Vacant') stats.portfolio.vacant++
    if (property.status === 'Occupied') stats.portfolio.occupied++
  })

  // Calculate occupancy rate
  const totalProperties = properties.length
  if (totalProperties > 0) {
    stats.occupancyRate = Math.round((stats.portfolio.occupied / totalProperties) * 100)
  }

  // Maintenance status (simplified)
  if (stats.portfolio.vacant > stats.portfolio.occupied) {
    stats.maintenanceStatus = 'Needs Attention'
  } else {
    stats.maintenanceStatus = 'Good'
  }

  return stats
}

function generateBusinessInsights(data: {
  websites: any[],
  subscriptions: any[],
  properties: any[],
  blops: number,
  agencyClients: any[]
}) {
  const insights = {
    strengths: [] as string[],
    opportunities: [] as string[],
    recommendations: [] as string[],
    risks: [] as string[],
    recentActivity: [] as string[]
  }

  // Analyze strengths
  if (data.websites.length >= 3) {
    insights.strengths.push('Strong online presence with multiple websites')
  }
  if (data.properties.length > 0) {
    insights.strengths.push('Real estate portfolio established')
  }
  if (data.blops > 10) {
    insights.strengths.push('Active workflow management in Flexboard')
  }

  // Analyze opportunities
  if (data.websites.length === 0) {
    insights.opportunities.push('Consider building a professional website')
  }
  if (data.subscriptions.length > 5) {
    insights.opportunities.push('Review subscription costs for optimization')
  }

  // Generate recommendations
  if (data.properties.length > data.websites.length) {
    insights.recommendations.push('Consider creating dedicated websites for properties')
  }
  if (data.subscriptions.length > 0 && data.websites.length > 0) {
    insights.recommendations.push('Link subscription management to website portfolio')
  }

  // Identify risks
  const highCostSubscriptions = data.subscriptions.filter(s => parseFloat(s.cost) > 100)
  if (highCostSubscriptions.length > 0) {
    insights.risks.push('High-cost subscriptions may impact cash flow')
  }

  // Recent activity
  const recentWebsites = data.websites.filter(w => {
    const created = new Date(w.created_at)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return created > weekAgo
  })
  if (recentWebsites.length > 0) {
    insights.recentActivity.push(`Added ${recentWebsites.length} new website(s)`)
  }

  return insights
}