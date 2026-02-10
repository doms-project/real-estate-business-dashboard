import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"
import { runSupabaseQuery } from "@/lib/database"
import { getDatabaseSchema } from "@/lib/database-schema"
import { getCachedResponse, setCachedResponse } from "@/lib/ai-coach/cache"
import { globalAIState } from "@/lib/ai-coach/global-ai-state"
import { getUserWorkspaceRole } from "@/lib/workspace-helpers"

// OpenRouter API types
interface OpenRouterMessage {
  role: "user" | "assistant" | "system"
  content: string
}

interface OpenRouterRequest {
  model: string
  messages: OpenRouterMessage[]
  temperature?: number
  max_tokens?: number
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Intent detection for conversational vs business queries
function detectIntent(message: string): 'greeting' | 'thanks' | 'business' | 'other' {
  const lowerMessage = message.toLowerCase().trim()

  // Greetings
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'sup', 'yo']
  if (greetings.some(greeting => lowerMessage === greeting || lowerMessage.startsWith(greeting + ' '))) {
    return 'greeting'
  }

  // Thanks
  const thanks = ['thanks', 'thank you', 'thx', 'ty', 'appreciate it', 'grateful']
  if (thanks.some(thank => lowerMessage.includes(thank))) {
    return 'thanks'
  }

  // Business queries (analysis, suggestions, optimization, etc.)
  const businessKeywords = [
    'analyze', 'analysis', 'suggest', 'suggestion', 'optimize', 'optimization',
    'improve', 'improvement', 'strategy', 'strategic', 'revenue', 'profit',
    'growth', 'performance', 'metrics', 'kpi', 'dashboard', 'report',
    'campaign', 'marketing', 'client', 'customer', 'location', 'property',
    'website', 'maintenance', 'cost', 'budget', 'roi', 'return', 'investment'
  ]

  if (businessKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'business'
  }

  return 'other'
}

function checkRateLimit(identifier: string, maxRequests: number = 50, windowMs: number = 60000): boolean {
  const now = Date.now()
  const key = `rate_limit_${identifier}`
  const current = rateLimitStore.get(key)

  if (!current || now > current.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false // Rate limit exceeded
  }

  current.count++
  return true
}

function getRateLimitInfo(identifier: string): { remaining: number; resetTime: number } {
  const key = `rate_limit_${identifier}`
  const current = rateLimitStore.get(key)
  const now = Date.now()

  if (!current || now > current.resetTime) {
    return { remaining: 50, resetTime: now + 60000 }
  }

  return {
    remaining: Math.max(0, 50 - current.count),
    resetTime: current.resetTime
  }
}

const AI_COACH_SYSTEM_PROMPT = `You are an expert real estate business intelligence AI advisor. Analyze comprehensive business data across properties, clients, locations, marketing, operations, and revenue streams.

Provide strategic insights with specific numbers and actionable recommendations. Focus on:
- Growth opportunities and optimization strategies
- Performance comparisons and benchmarks
- Revenue maximization and cost reduction
- Operational efficiency improvements
- Risk mitigation and business development

Be data-driven, specific with numbers, and provide 3-5 key insights with actionable next steps. Compare to industry benchmarks where relevant (e.g., real estate conversion rates typically 1-3%, client retention 70-85%).`

// OpenRouter API client
async function callOpenRouter(model: string, messages: OpenRouterMessage[]): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (!openRouterKey) {
    throw new Error('OpenRouter API key not configured')
  }

  const request: OpenRouterRequest = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 1000
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Real Estate AI Coach'
    },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`)
  }

  const data: OpenRouterResponse = await response.json()
  return data.choices[0]?.message?.content || 'No response generated'
}

export async function POST(request: NextRequest) {
  try {
    let userId: string | null = null

    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch (authError) {
      console.error('Authentication error:', authError)
      return NextResponse.json({
        error: 'Authentication failed',
        message: 'Please log in again to continue.'
      }, { status: 401 })
    }

    if (!userId) {
      console.log('No userId found in auth result')
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Please log in to access AI coach features.'
      }, { status: 401 })
    }

    const body = await request.json()
    const { message, pageContext, pageData, model: requestedModel, workspaceId } = body

    // Validate workspace access
    if (!workspaceId) {
      console.log('No workspaceId provided in request')
      return NextResponse.json({
        error: 'Workspace required',
        message: 'Please specify a workspace to access AI coach features.'
      }, { status: 400 })
    }

    // Check if user has access to the workspace
    try {
      const userRole = await getUserWorkspaceRole(userId, workspaceId)
      if (!userRole) {
        console.log(`User ${userId} does not have access to workspace ${workspaceId}`)
        return NextResponse.json({
          error: 'Workspace access denied',
          message: 'You do not have access to this workspace.'
        }, { status: 403 })
      }
    } catch (workspaceError) {
      console.error('Workspace validation error:', workspaceError)
      return NextResponse.json({
        error: 'Workspace validation failed',
        message: 'Unable to verify workspace access.'
      }, { status: 500 })
    }

    console.log(`🤖 AI Coach Request: "${message?.substring(0, 50)}${message && message.length > 50 ? '...' : ''}" | User: ${userId} | Workspace: ${workspaceId} | Page: ${pageContext || 'unknown'} | Model: ${requestedModel || 'openrouter-free (default)'}`)

    if (!message || message.trim() === '') {
      return NextResponse.json({
        error: "Message required",
        message: "Please provide a message for the AI coach."
      }, { status: 400 })
    }

    // Check current AI request status - aggressive rate limiting for Google free tier
    const aiStatus = globalAIState.getStatus()
    console.log(`🤖 AI Status: ${aiStatus.activeRequests} active, ${aiStatus.queuedRequests} queued, circuit breaker: ${aiStatus.circuitBreaker.isOpen ? 'OPEN' : 'CLOSED'} (${aiStatus.circuitBreaker.failures} failures)`)

    // Rate limiting: reject if 3+ active OR 5+ queued (Google free tier is restrictive)
    if (aiStatus.activeRequests >= 3 || aiStatus.queuedRequests >= 5) {
      const retryAfter = Math.max(5, aiStatus.queuedRequests * 2)
      console.log(`🚫 AI Request rejected: ${pageContext} (${aiStatus.activeRequests} active, ${aiStatus.queuedRequests} queued) - retry after ${retryAfter}s`)

      return NextResponse.json({
        error: "AI service busy",
        message: `Please wait ${retryAfter} seconds before making another AI request.`,
        activeRequests: aiStatus.activeRequests,
        queuedRequests: aiStatus.queuedRequests,
        retryAfter
      }, {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString()
        }
      })
    }

    console.log(`🚀 Processing AI request for: ${pageContext}`)

    // Check cache first
    const cacheKey = `${workspaceId}:${pageContext || 'general'}:${message}`
    const cached = getCachedResponse(userId, cacheKey)
    if (cached) {
      return NextResponse.json({
        reply: cached.response,
        cached: true
      })
    }

    // Initialize business data variable (moved up to avoid hoisting issues)
    let businessData: BusinessData = {}

    // Build comprehensive business intelligence context (after data is fetched)
    let businessContext = ""

    // Get comprehensive business data from database using Supabase client
    interface BusinessData {
      // Properties data
      properties?: number
      totalIncome?: number
      avgRent?: number

      // Client data
      clients?: number
      activeClients?: number
      totalClientRevenue?: number
      avgClientRevenue?: number

      // Location data
      locations?: number
      activeLocations?: number
      totalContacts?: number
      totalOpportunities?: number
      totalConversations?: number

      // Website data
      websites?: number
      liveWebsites?: number

      // Subscription data
      subscriptions?: number
      subscriptionRevenue?: number

      // Operations data
      pendingWorkRequests?: number
      maintenanceCost?: number

      // Performance metrics
      avgConversionRate?: number
      clientRetentionRate?: number

      // Detailed breakdowns
      clientBreakdown?: any[]
      locationBreakdown?: any[]
      revenueBreakdown?: { properties?: number; clients?: number; subscriptions?: number; total?: number }

      // Enhanced location data for GHL Clients page
      allLocations?: any[]
      totalLocations?: number
      currentLocationMetrics?: any[]
      weeklyMetrics?: any[]

      note?: string
    }

    // Initialize Supabase client with service role for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    try {
      // Comprehensive business intelligence queries with proper JOIN relationships
      // Context-aware: prioritize different tables based on current page
      const isGHLClientsPage = pageContext?.toLowerCase().includes('client') || pageContext?.toLowerCase().includes('ghl');

      const [
        propertiesResult,
        clientsResult,
        locationsResult,
        locationMetricsResult,
        monthlyMetricsResult,
        websitesResult,
        subscriptionsResult,
        workRequestsResult,
        weeklyMetricsResult
      ] = await Promise.allSettled([
        // Properties data
        supabase
          .from('properties')
          .select('monthly_gross_rent, purchase_price, current_est_value, status')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId),

        // Client data with performance metrics
        supabase
          .from('ghl_clients')
          .select(`
            id, name, subscription_plan, status,
            ghl_weekly_metrics(revenue, leads, conversions, week_start)
          `)
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),

        // All locations with names (for GHL Clients page) - using same logic as /api/ghl/locations
        (async () => {
          try {
            const { data: dbLocations, error: dbError } = await supabase
              .from('ghl_locations')
              .select('*')
              .eq('user_id', userId)
              .eq('workspace_id', workspaceId)
              .eq('is_active', true)
              .order('name')

            if (dbError || !dbLocations || dbLocations.length === 0) {
              console.log('📍 AI Coach: Database locations empty, using JSON fallback')
              // Import the same fallback as the API endpoint
              const { GHL_LOCATIONS } = await import('@/lib/ghl-config')
              return {
                locations: GHL_LOCATIONS.map(location => ({
                  id: location.id,
                  name: location.name,
                  city: location.city,
                  state: location.state,
                  country: location.country,
                  address: location.address,
                  pitToken: location.pitToken,
                  description: location.description,
                  email: `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
                  phone: '',
                  website: '',
                  logoUrl: undefined
                })),
                source: 'json_fallback',
                totalLocationsFound: GHL_LOCATIONS.length
              }
            }

            // Transform database records to match API format
            return {
              locations: dbLocations.map(location => ({
                id: location.id,
                name: location.name,
                city: location.city,
                state: location.state,
                country: location.country,
                address: location.address,
                pitToken: location.pit_token,
                description: location.description,
                email: `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
                phone: '',
                website: '',
                logoUrl: undefined
              })),
              source: 'database',
              totalLocationsFound: dbLocations.length
            }
          } catch (error) {
            console.error('📍 AI Coach: Error loading locations:', error)
            const { GHL_LOCATIONS } = await import('@/lib/ghl-config')
            return {
              locations: GHL_LOCATIONS.map(location => ({
                id: location.id,
                name: location.name,
                city: location.city,
                state: location.state,
                country: location.country,
                address: location.address,
                pitToken: location.pitToken,
                description: location.description,
                email: `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
                phone: '',
                website: '',
                logoUrl: undefined
              })),
              source: 'json_fallback_error',
              totalLocationsFound: GHL_LOCATIONS.length
            }
          }
        })(),

        // Current location metrics (primary for GHL Clients page) - using same logic as /api/ghl/metrics/cached
        (async () => {
          try {
            const { data: metricsData, error: metricsError } = await supabase
              .from('ghl_location_metrics')
              .select('*')
              .eq('user_id', userId)
              .eq('workspace_id', workspaceId)
              .order('updated_at', { ascending: false })

            if (metricsError) {
              console.log('📊 AI Coach: Location metrics query failed, returning empty array')
              return { success: false, data: [], source: 'error', error: metricsError }
            }

            return {
              success: true,
              data: metricsData || [],
              source: 'database',
              isStale: false,
              lastUpdated: new Date().toISOString()
            }
          } catch (error) {
            console.error('📊 AI Coach: Error loading location metrics:', error)
            return { success: false, data: [], source: 'error', error: String(error) }
          }
        })(),

        // Historical monthly metrics (comprehensive view)
        supabase
          .from('ghl_monthly_metrics')
          .select('*')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .gte('month_start', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 3 months
          .order('month_start', { ascending: false }),

        // Website portfolio
        supabase
          .from('websites')
          .select('name, status, live_site_url')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId),

        // Subscription revenue
        supabase
          .from('subscriptions')
          .select('amount, status, plan_type')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),

        // Maintenance and operations
        supabase
          .from('work_requests')
          .select('status, cost_estimate, priority')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .neq('status', 'completed'),

        // Weekly metrics for detailed analysis
        supabase
          .from('ghl_weekly_metrics')
          .select('*')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .gte('week_start', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Last 3 months
          .order('week_start', { ascending: false })
      ])

      // Process properties data
      let propertiesData = { count: 0, totalIncome: 0, avgRent: 0, portfolioValue: 0 }
      if (propertiesResult.status === 'fulfilled' && propertiesResult.value.data) {
        const props = propertiesResult.value.data
        propertiesData = {
          count: props.length,
          totalIncome: props.reduce((sum, p) => sum + (p.monthly_gross_rent || 0), 0),
          avgRent: props.length > 0 ? props.reduce((sum, p) => sum + (p.monthly_gross_rent || 0), 0) / props.length : 0,
          portfolioValue: props.reduce((sum, p) => sum + (p.current_est_value || 0), 0)
        }
      }

      // Process client data
      let clientData: { count: number; activeCount: number; totalRevenue: number; avgRevenue: number; breakdown: any[] } = { count: 0, activeCount: 0, totalRevenue: 0, avgRevenue: 0, breakdown: [] }
      let clientBreakdown: any[] = []
      if (clientsResult.status === 'fulfilled' && clientsResult.value.data) {
        const clients = clientsResult.value.data
        const activeClients = clients.filter(c => c.status === 'active')

        // Calculate revenue from weekly metrics (last 4 weeks)
        let totalRevenue = 0
        clientBreakdown = clients.map(client => {
          const recentMetrics = client.ghl_weekly_metrics?.slice(0, 4) || []
          const clientRevenue = recentMetrics.reduce((sum, m) => sum + (m.revenue || 0), 0)
          totalRevenue += clientRevenue

          return {
            name: client.name,
            plan: client.subscription_plan,
            monthlyRevenue: clientRevenue / 4, // Average over 4 weeks
            leads: recentMetrics.reduce((sum, m) => sum + (m.leads || 0), 0),
            conversions: recentMetrics.reduce((sum, m) => sum + (m.conversions || 0), 0)
          }
        })

        clientData = {
          count: clients.length,
          activeCount: activeClients.length,
          totalRevenue: totalRevenue / 4, // Monthly average
          avgRevenue: clients.length > 0 ? (totalRevenue / 4) / clients.length : 0,
          breakdown: clientBreakdown
        }
      }

      // Process location data (from monthly metrics)
      let locationData: { count: number; totalContacts: number; totalOpportunities: number; totalConversations: number; avgConversionRate: number; breakdown: any[] } = { count: 0, totalContacts: 0, totalOpportunities: 0, totalConversations: 0, avgConversionRate: 0, breakdown: [] }
      if (monthlyMetricsResult.status === 'fulfilled' && monthlyMetricsResult.value) {
        const monthlyData = monthlyMetricsResult.value
        if (monthlyData && Array.isArray(monthlyData)) {
          const metrics = monthlyData

          // Group by location and calculate totals
          const locationMap = new Map()
          metrics.forEach(m => {
            if (!locationMap.has(m.location_id)) {
              locationMap.set(m.location_id, {
                location_id: m.location_id,
                contacts: 0,
                opportunities: 0,
                conversations: 0,
                months: 0
              })
            }
            const loc = locationMap.get(m.location_id)
            loc.contacts += m.contacts_count || 0
            loc.opportunities += m.opportunities_count || 0
            loc.conversations += m.conversations_count || 0
            loc.months += 1
          })

          const locationBreakdown = Array.from(locationMap.values()).map(loc => ({
            location_id: loc.location_id,
            avgContacts: Math.round(loc.contacts / loc.months),
            avgOpportunities: Math.round(loc.opportunities / loc.months),
            avgConversations: Math.round(loc.conversations / loc.months),
            conversionRate: loc.contacts > 0 ? Math.round((loc.opportunities / loc.contacts) * 100) : 0
          }))

          const totalContacts = locationBreakdown.reduce((sum, l) => sum + l.avgContacts, 0)
          const totalOpportunities = locationBreakdown.reduce((sum, l) => sum + l.avgOpportunities, 0)
          const totalConversations = locationBreakdown.reduce((sum, l) => sum + l.avgConversations, 0)

          locationData = {
            count: locationMap.size,
            totalContacts,
            totalOpportunities,
            totalConversations,
            avgConversionRate: totalContacts > 0 ? Math.round((totalOpportunities / totalContacts) * 100) : 0,
            breakdown: locationBreakdown
          }
        }
      }

      // Process GHL locations (all locations with names) - matches API response format
      let allLocations: any[] = []
      if (locationsResult.status === 'fulfilled' && locationsResult.value) {
        const locationData = locationsResult.value
        if (locationData && locationData.locations) {
          allLocations = locationData.locations
          console.log(`📍 AI Coach: Loaded ${allLocations.length} locations from ${locationData.source}`)
        }
      }

      // Process current location metrics (primary for GHL Clients page) - matches API response format
      let currentLocationMetrics: any[] = []
      if (locationMetricsResult.status === 'fulfilled' && locationMetricsResult.value) {
        const metricsData = locationMetricsResult.value
        if (metricsData && metricsData.success && metricsData.data) {
          currentLocationMetrics = metricsData.data
          console.log(`📊 AI Coach: Loaded ${currentLocationMetrics.length} location metrics from ${metricsData.source}`)
        }
      }

      // Process weekly metrics for detailed analysis
      let weeklyMetricsData: any[] = []
      if (weeklyMetricsResult.status === 'fulfilled' && weeklyMetricsResult.value.data) {
        weeklyMetricsData = weeklyMetricsResult.value.data
      }

      // For GHL Clients page, enrich location data with names and current metrics
      if (isGHLClientsPage && allLocations.length > 0) {
        const enrichedLocations = allLocations.map(location => {
          const currentMetrics = currentLocationMetrics.find(m => m.location_id === location.id)
          return {
            ...location,
            currentMetrics: currentMetrics || {
              contacts_count: 0,
              opportunities_count: 0,
              conversations_count: 0,
              health_score: 0
            }
          }
        })

        // Update businessData with enriched location information
        businessData.allLocations = enrichedLocations
        businessData.totalLocations = enrichedLocations.length

        console.log(`📍 GHL Clients Page: Found ${enrichedLocations.length} locations with current metrics`)
      }

      // Process website data
      let websiteData = { count: 0, liveCount: 0 }
      if (websitesResult.status === 'fulfilled' && websitesResult.value.data) {
        const websites = websitesResult.value.data
        websiteData = {
          count: websites.length,
          liveCount: websites.filter(w => w.live_site_url).length
        }
      }

      // Process subscription data
      let subscriptionData = { count: 0, totalRevenue: 0 }
      if (subscriptionsResult.status === 'fulfilled' && subscriptionsResult.value.data) {
        const subscriptions = subscriptionsResult.value.data
        subscriptionData = {
          count: subscriptions.length,
          totalRevenue: subscriptions.reduce((sum, s) => sum + (s.amount || 0), 0)
        }
      }

      // Process work requests
      let operationsData = { pendingRequests: 0, estimatedCost: 0 }
      if (workRequestsResult.status === 'fulfilled' && workRequestsResult.value.data) {
        const requests = workRequestsResult.value.data
        operationsData = {
          pendingRequests: requests.length,
          estimatedCost: requests.reduce((sum, r) => sum + (r.cost_estimate || 0), 0)
        }
      }

      // Combine all business intelligence
      businessData = {
        // Properties
        properties: propertiesData.count,
        totalIncome: propertiesData.totalIncome,
        avgRent: propertiesData.avgRent,

        // Clients
        clients: clientData.count,
        activeClients: clientData.activeCount,
        totalClientRevenue: clientData.totalRevenue,
        avgClientRevenue: clientData.avgRevenue,

        // Locations
        locations: locationData.count,
        totalContacts: locationData.totalContacts,
        totalOpportunities: locationData.totalOpportunities,
        totalConversations: locationData.totalConversations,
        avgConversionRate: locationData.avgConversionRate,

        // Websites
        websites: websiteData.count,
        liveWebsites: websiteData.liveCount,

        // Subscriptions
        subscriptions: subscriptionData.count,
        subscriptionRevenue: subscriptionData.totalRevenue,

        // Operations
        pendingWorkRequests: operationsData.pendingRequests,
        maintenanceCost: operationsData.estimatedCost,

        // Detailed breakdowns for AI analysis
        clientBreakdown: clientData.breakdown,
        locationBreakdown: locationData.breakdown,

        // All locations with current metrics (for GHL Clients page)
        allLocations: businessData.allLocations || [],
        totalLocations: businessData.totalLocations || locationData.count,

        // Current location metrics (real-time data)
        currentLocationMetrics: currentLocationMetrics,

        // Weekly metrics for detailed analysis
        weeklyMetrics: weeklyMetricsData,

        // Revenue breakdown
        revenueBreakdown: {
          properties: propertiesData.totalIncome,
          clients: clientData.totalRevenue,
          subscriptions: subscriptionData.totalRevenue,
          total: propertiesData.totalIncome + clientData.totalRevenue + subscriptionData.totalRevenue
        }
      }

      console.log(`📊 Comprehensive business intelligence loaded:`)
      console.log(`   • ${propertiesData.count} properties ($${propertiesData.totalIncome.toLocaleString()}/month)`)
      console.log(`   • ${clientData.activeCount} active clients ($${clientData.totalRevenue.toLocaleString()}/month)`)
      console.log(`   • ${locationData.count} locations (${locationData.totalContacts} contacts, ${locationData.avgConversionRate}% conversion)`)
      console.log(`   • ${websiteData.liveCount}/${websiteData.count} live websites`)
      console.log(`   • ${operationsData.pendingRequests} pending maintenance requests ($${operationsData.estimatedCost.toLocaleString()} estimated cost)`)

      // Now build the business context with populated data
      const contextParts = [
        "**BUSINESS INTELLIGENCE OVERVIEW:**",
        "",
        "**🏠 PROPERTIES PORTFOLIO:**",
        `• ${businessData.properties || 0} total properties`,
        `• Monthly rental income: $${(businessData.totalIncome || 0).toLocaleString()}`,
        `• Average rent: $${(businessData.avgRent || 0).toFixed(0)}`,
        `• Portfolio value: $${(businessData.revenueBreakdown?.properties || 0).toLocaleString()}`,
        "",
        "**👥 CLIENT RELATIONSHIPS:**",
        `• ${businessData.clients || 0} total clients (${businessData.activeClients || 0} active)`,
        `• Client revenue: $${(businessData.totalClientRevenue || 0).toLocaleString()}/month`,
        `• Average client value: $${(businessData.avgClientRevenue || 0).toFixed(0)}/month`,
        `• Top clients by revenue: ${businessData.clientBreakdown?.slice(0, 3).map(c => `${c.name} ($${c.monthlyRevenue?.toFixed(0)}/mo)`).join(', ') || 'N/A'}`,
        "",
        "**📍 LOCATION PERFORMANCE:**",
        `• ${businessData.totalLocations || businessData.locations || 0} total locations (${businessData.allLocations?.length || 0} with current metrics)`,
        `• ${businessData.totalContacts || 0} contacts managed`,
        `• ${businessData.totalOpportunities || 0} opportunities generated`,
        `• ${businessData.totalConversations || 0} conversations handled`,
        `• Average conversion rate: ${businessData.avgConversionRate || 0}%`,
        `• Top locations: ${businessData.allLocations?.slice(0, 3).map((loc: any) => `${loc.name} (${loc.city}, ${loc.state})`).join(' | ') || businessData.locationBreakdown?.slice(0, 3).map(l => `Location ${l.location_id}: ${l.conversionRate}% conversion`).join(' | ') || 'N/A'}`,
        "",
        "**🌐 DIGITAL PRESENCE:**",
        `• ${businessData.websites || 0} websites (${businessData.liveWebsites || 0} live)`,
        `• Website portfolio health: ${businessData.liveWebsites && businessData.websites ? Math.round((businessData.liveWebsites / businessData.websites) * 100) : 0}% live rate`,
        "",
        "**💰 REVENUE STREAMS:**",
        `• Property rentals: $${(businessData.revenueBreakdown?.properties || 0).toLocaleString()}/month`,
        `• Client services: $${(businessData.revenueBreakdown?.clients || 0).toLocaleString()}/month`,
        `• Subscriptions: $${(businessData.subscriptionRevenue || 0).toLocaleString()}/month`,
        `• Total revenue: $${(businessData.revenueBreakdown?.total || 0).toLocaleString()}/month`,
        `• Revenue diversification: ${businessData.revenueBreakdown?.total ? Math.round(((businessData.revenueBreakdown.properties || 0) / businessData.revenueBreakdown.total) * 100) : 0}% from properties`,
        "",
        "**🔧 OPERATIONS & MAINTENANCE:**",
        `• ${businessData.pendingWorkRequests || 0} pending maintenance requests`,
        `• Estimated maintenance cost: $${(businessData.maintenanceCost || 0).toLocaleString()}`,
        `• Operational efficiency: ${businessData.pendingWorkRequests ? 'Needs attention' : 'Well maintained'}`,
        "",
        "**📊 KEY METRICS:**",
        `• Client acquisition cost: ${businessData.totalClientRevenue && businessData.totalContacts ? `$${(businessData.totalClientRevenue / businessData.totalContacts * 12).toFixed(0)}/year per contact` : 'N/A'}`,
        `• Conversion efficiency: ${businessData.avgConversionRate ? `${businessData.avgConversionRate}% (Industry avg: 1-3%)` : 'N/A'}`,
        `• Revenue per location: ${businessData.locations && businessData.revenueBreakdown?.total ? `$${(businessData.revenueBreakdown.total / businessData.locations).toFixed(0)}/month` : 'N/A'}`
      ]

      businessContext = contextParts.join('\n')

      // Add page-specific context
      if (pageContext) {
        businessContext += `\n**CURRENT PAGE CONTEXT: ${pageContext.toUpperCase()}**`

        switch (pageContext.toLowerCase()) {
          case "dashboard":
            businessContext += "\n• Comprehensive business overview and strategic planning"
            break
          case "agency":
            businessContext += "\n• Client management, location performance, team metrics"
            businessContext += "\n• Focus: Client acquisition, retention, location optimization"
            break
          case "gohighlevel-clients":
          case "ghl-clients":
          case "clients":
            businessContext += "\n• GoHighLevel client management and location performance monitoring"
            businessContext += "\n• Focus: Location health scores, contact management, opportunity conversion, client metrics"
            businessContext += `\n• Current data: ${businessData.totalLocations || 0} locations with real-time metrics`
            if (businessData.allLocations && businessData.allLocations.length > 0) {
              businessContext += `\n• Locations include: ${businessData.allLocations.slice(0, 3).map((loc: any) => loc.name).join(', ')}${businessData.allLocations.length > 3 ? ` and ${businessData.allLocations.length - 3} more` : ''}`
            }
            break
          case "properties":
            businessContext += "\n• Property portfolio management and financial performance"
            businessContext += "\n• Focus: Rental optimization, property value growth, maintenance"
            break
          case "business":
            businessContext += "\n• Overall business operations and strategic growth"
            businessContext += "\n• Focus: Revenue diversification, operational efficiency, market expansion"
            break
        }
      }

    } catch (dbError) {
      console.warn('Database query failed, using Supabase client:', dbError)
      // Provide fallback data with clear indication of database issues
      businessData = {
        properties: 0, // Start with 0 to encourage adding properties
        totalIncome: 0,
        avgRent: 0,
        note: 'Database temporarily unavailable - add properties to get AI insights'
      }
    }

    // Check for API keys first
    const geminiApiKey = process.env.GEMINI_API_KEY
    const openRouterApiKey = process.env.OPENROUTER_API_KEY
    let reply = "I'm having trouble connecting to my AI services right now. Please try again."

    // Determine which AI provider to use based on requested model
    // Default to OpenRouter free model instead of Gemini
    let useGemini = false
    let useOpenRouter = true
    let openRouterModel = 'openrouter/free' // Default to free model

    if (requestedModel) {
      if (requestedModel.startsWith('claude') || requestedModel.includes('openrouter')) {
        // Use specified OpenRouter model
        if (requestedModel === 'claude-3.5-sonnet') {
          openRouterModel = 'anthropic/claude-3.5-sonnet'
        } else if (requestedModel === 'claude-3-haiku') {
          openRouterModel = 'anthropic/claude-3-haiku'
        } else if (requestedModel === 'openrouter-free') {
          openRouterModel = 'openrouter/free'
        } else if (requestedModel === 'openrouter-auto') {
          openRouterModel = 'openrouter/auto'
        }
      } else if (requestedModel === 'gemini') {
        // Explicitly request Gemini
        useGemini = true
        useOpenRouter = false
      } else if (requestedModel === 'auto') {
        // Auto mode: try OpenRouter first, fallback to Gemini if available
        useOpenRouter = true
        useGemini = !!geminiApiKey // Only use Gemini if API key is available
      }
    }

    if (!openRouterApiKey || openRouterApiKey.trim() === '') {
      console.log('🔑 No OPENROUTER_API_KEY configured - trying Gemini fallback')
      useOpenRouter = false
      useGemini = !!geminiApiKey // Only use Gemini if API key is available
    }

    // Declare variables at function scope for proper access
    let providerUsed = 'unknown'
    let modelUsed = requestedModel || 'auto'

    if (!useGemini && !useOpenRouter) {
      console.log('❌ No AI providers available - using fallback responses')
      // No API keys - provide helpful fallback with business insights
      const responses = {
        dashboard: `Welcome to your dashboard! You have ${businessData.properties || 12} properties generating $${businessData.totalIncome || 45000} monthly. Your average rent is $${businessData.avgRent || 3750}. To enable full AI analysis, please set up your GEMINI_API_KEY or OPENROUTER_API_KEY in your environment variables.`,
        agency: `On your agency page, I can see you're managing client relationships. With ${businessData.properties || 12} properties in your portfolio, focus on converting leads into long-term clients. Set up GEMINI_API_KEY for personalized growth strategies!`,
        properties: `Your property portfolio shows ${businessData.properties || 12} units with $${businessData.totalIncome || 45000} monthly income. Consider optimizing maintenance schedules and rent pricing. Add GEMINI_API_KEY for detailed property analysis!`,
        default: `I can see you're asking about "${message}" on the ${pageContext || 'main'} page. Your portfolio includes ${businessData.properties || 12} properties generating $${businessData.totalIncome || 45000} monthly. To unlock full AI insights, please configure your GEMINI_API_KEY environment variable.`
      };

      reply = responses[pageContext as keyof typeof responses] || responses.default;
    } else {
      // Check intent before AI processing
      const intent = detectIntent(message)
      console.log(`🎯 Detected intent: ${intent} for message: "${message}"`)

      // Handle conversational intents with simple responses
      if (intent === 'greeting') {
        reply = `Hello! 👋 I'm your AI business advisor for real estate. I can help you analyze your properties, clients, campaigns, and growth opportunities. What would you like to know about your business today?`
        return NextResponse.json({
          success: true,
          reply,
          provider: 'intent-detection',
          model: 'conversational'
        })
      }

      if (intent === 'thanks') {
        reply = `You're welcome! 😊 I'm here whenever you need insights about your real estate business. Feel free to ask about properties, clients, marketing campaigns, or growth strategies.`
        return NextResponse.json({
          success: true,
          reply,
          provider: 'intent-detection',
          model: 'conversational'
        })
      }

      // AI processing with multi-model support (OpenRouter first, Gemini fallback)
      try {
        const aiResponse = await globalAIState.makeAIRequest(pageContext || 'general', async () => {
          // Try OpenRouter first (default behavior)
          if (useOpenRouter && openRouterApiKey) {
            try {
              console.log(`🤖 Trying OpenRouter (${openRouterModel})...`);
              const messages: OpenRouterMessage[] = [
                {
                  role: "system",
                  content: `${AI_COACH_SYSTEM_PROMPT}\n\n${businessContext}`
                },
                {
                  role: "user",
                  content: `${message}\n\n**INSTRUCTIONS:**\nThis is a business analysis query. Provide 3-5 strategic insights specific to the user's question. Use their actual business data above to give concrete, actionable advice with specific numbers. Focus on their current metrics and opportunities for growth. Compare to industry benchmarks where relevant.`
                }
              ];

              const openRouterRequest: OpenRouterRequest = {
                model: openRouterModel,
                messages,
                temperature: 0.7,
                max_tokens: 2000
              };

              const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openRouterApiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                  'X-Title': 'Real Estate Business Dashboard'
                },
                body: JSON.stringify(openRouterRequest)
              });

              if (!openRouterResponse.ok) {
                const errorData = await openRouterResponse.text();
                console.log(`❌ OpenRouter API error: ${openRouterResponse.status} - ${errorData}`);
                throw new Error(`OpenRouter API error: ${openRouterResponse.status}`);
              }

              const openRouterData: OpenRouterResponse = await openRouterResponse.json();
              console.log(`✅ OpenRouter response received from ${openRouterModel}`);

              if (openRouterData.choices && openRouterData.choices[0]) {
                providerUsed = 'openrouter';
                modelUsed = openRouterModel;
                return openRouterData.choices[0].message.content;
              } else {
                throw new Error('Invalid OpenRouter response format');
              }

            } catch (openRouterError: unknown) {
              const errorMessage = openRouterError instanceof Error ? openRouterError.message : String(openRouterError);
              console.log(`❌ OpenRouter failed: ${errorMessage}`);
              providerUsed = 'openrouter-failed';
              modelUsed = openRouterModel;
              throw openRouterError; // Re-throw to try Gemini fallback
            }
          }

          // Try Gemini as fallback (if available and OpenRouter failed)
          if (useGemini && geminiApiKey) {
            try {
              console.log(`🤖 Trying Gemini fallback (${requestedModel || "gemini-2.0-flash-lite"})...`);
              const genAI = new GoogleGenerativeAI(geminiApiKey);
              const model = genAI.getGenerativeModel({ model: requestedModel || "gemini-2.0-flash-lite" });

              const analysisPrompt = `${AI_COACH_SYSTEM_PROMPT}\n\n${businessContext}\n\n**USER QUERY:** ${message}\n\n**INSTRUCTIONS:**\nThis is a business analysis query. Provide 3-5 strategic insights specific to the user's question. Use their actual business data above to give concrete, actionable advice with specific numbers. Focus on their current metrics and opportunities for growth. Compare to industry benchmarks where relevant.`;

              const result = await model.generateContent(analysisPrompt);
              const response = await result.response;
              providerUsed = 'gemini';
              modelUsed = requestedModel || "gemini-2.0-flash-lite";
              return response.text();
            } catch (geminiError: unknown) {
              const errorMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
              console.log(`⚠️ Gemini fallback also failed: ${errorMessage}`);
              throw geminiError;
            }
          }
          throw new Error('No AI providers available');
        });

        reply = aiResponse;
        setCachedResponse(userId, cacheKey, reply);

      } catch (aiError: unknown) {
        console.error('AI generation failed:', aiError);
        const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
        const isQuotaError = errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit');

        if (isQuotaError) {
          // Provide intelligent fallback insights based on businessData
          const fallbackInsights = [
            `You have ${businessData.properties || 0} properties generating $${businessData.totalIncome?.toLocaleString() || '0'}/month`,
            `Your ${businessData.locations || 0} locations have ${businessData.totalContacts || 0} contacts with ${Math.round(businessData.avgConversionRate || 0)}% conversion rate`,
            `Consider focusing on your top-performing locations to maximize growth`
          ];
          const intent = detectIntent(message)
          if (intent === 'greeting') {
            reply = `Hello! 👋 AI services are currently at capacity, but I'm here to help with your real estate business once they resume in 30-60 seconds.`
          } else if (intent === 'thanks') {
            reply = `You're welcome! 😊 The AI analysis will be back online shortly.`
          } else {
            reply = `Thanks for your question about "${message}"! While AI services are at capacity, here's what I can tell you from your business data:\n\n${fallbackInsights.map(i => `📊 ${i}`).join('\n')}\n\n🔄 Full AI analysis will resume in 30-60 seconds!`;
          }
        } else {
          const intent = detectIntent(message)
          if (intent === 'greeting') {
            reply = `Hi there! 👋 I'm your AI business assistant. While I'm still setting up, I can see you have a real estate business with properties and client data. Configure your API keys to unlock full AI analysis and strategic insights!`
          } else if (intent === 'thanks') {
            reply = `You're welcome! Happy to help with your real estate business. Set up API keys to get personalized growth strategies and performance insights.`
          } else {
            const dataSummary = [
              `${businessData.properties || 0} properties`,
              `${businessData.activeClients || 0} active clients`,
              `${businessData.locations || 0} locations`
            ].filter(item => !item.startsWith('0 '));
            reply = `I can see you're asking about "${message}". Your business currently has ${dataSummary.join(', ') || 'some data'}. Configure API keys for detailed AI analysis and strategic recommendations!`;
          }
        }
      }

      console.log(`📤 AI Coach Response: Page=${pageContext} | Provider=${providerUsed} | Model=${modelUsed} | Reply length: ${reply.length} | Cached: false`);
    }

    return NextResponse.json({
      reply,
      cached: false,
      pageContext: pageContext || null,
      provider: 'system',
      model: 'business-data-summary'
    })
  } catch (error) {
    console.error("AI Coach API error:", error)
    return NextResponse.json({
      error: "Internal server error",
      reply: "Sorry, I'm experiencing technical difficulties. Please try again."
    }, {
      status: 500
    })
  }
}