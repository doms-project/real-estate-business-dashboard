import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"
import { supabaseAdmin } from "@/lib/supabase"
import { runSupabaseQuery } from "@/lib/database"
import { getDatabaseSchema } from "@/lib/database-schema"
import { getCachedResponse, setCachedResponse } from "@/lib/ai-coach/cache"
import { globalAIState } from "@/lib/ai-coach/global-ai-state"
import { getUserWorkspaceRole } from "@/lib/workspace-helpers"
import { ConversationManager } from "@/lib/ai-conversation-manager"
import { buildDashboardContext, buildAgencyContext, buildBusinessContext } from "@/lib/ai-coach/context-builder"

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
  console.log(`🔍 Intent Detection: Analyzing message: "${message}" -> "${lowerMessage}"`)

  // Greetings
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'sup', 'yo']
  const greetingMatch = greetings.find(greeting => lowerMessage === greeting || lowerMessage.startsWith(greeting + ' '))
  if (greetingMatch) {
    console.log(`🔍 Intent Detection: MATCHED GREETING: "${greetingMatch}"`)
    return 'greeting'
  }

  // Thanks
  const thanks = ['thanks', 'thank you', 'thx', 'ty', 'appreciate it', 'grateful']
  const thanksMatch = thanks.find(thank => lowerMessage.includes(thank))
  if (thanksMatch) {
    console.log(`🔍 Intent Detection: MATCHED THANKS: "${thanksMatch}" in "${lowerMessage}"`)
    return 'thanks'
  }

  // Business queries (analysis, suggestions, optimization, etc.)
  const businessKeywords = [
    'analyze', 'analysis', 'suggest', 'suggestion', 'optimize', 'optimization',
    'improve', 'improvement', 'strategy', 'strategic', 'revenue', 'profit',
    'growth', 'performance', 'metrics', 'kpi', 'dashboard', 'report',
    'campaign', 'marketing', 'client', 'customer', 'location', 'property',
    'website', 'maintenance', 'cost', 'budget', 'roi', 'return', 'investment',
    'opportunity', 'count', 'number', 'how many', 'total'
  ]

  const businessMatch = businessKeywords.find(keyword => lowerMessage.includes(keyword))
  if (businessMatch) {
    console.log(`🔍 Intent Detection: MATCHED BUSINESS: "${businessMatch}" in "${lowerMessage}"`)
    return 'business'
  }

  console.log(`🔍 Intent Detection: NO MATCH - CLASSIFIED AS 'other'`)
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

// Dynamic system prompt based on page context
function getSystemPrompt(pageContext?: string): string {
  // For agency/marketing pages (GHL clients, campaigns, etc.)
  if (pageContext === 'agency') {
    return `CRITICAL: You are a MARKETING AGENCY AI advisor. This business manages MARKETING CLIENTS using GoHighLevel (GHL) CRM software. DO NOT mention properties, rentals, real estate, property management, or housing terms.

BUSINESS TYPE: Marketing Agency specializing in GHL client management and digital marketing services.

Analyze marketing agency data: marketing clients, campaigns, leads, conversions, and marketing revenue.

Focus on MARKETING METRICS:
- Marketing client acquisition and retention
- Campaign performance and ROI analysis
- Lead generation and conversion optimization
- Marketing service revenue growth
- Client relationship management for marketing clients
- Marketing technology and automation efficiency

FORBIDDEN TERMS: Never use "properties", "rentals", "tenants", "property managers", "real estate", "housing", "apartments", "leases", "landlords", or similar real estate terms.

Use MARKETING TERMINOLOGY: "marketing clients", "campaigns", "leads", "conversions", "marketing services", "digital marketing", "CRM clients".

Benchmarks: Lead conversion rates 2-5%, client retention 75-90%, campaign ROI 3-5x, marketing service revenue growth 20-50% annually.

Provide 3-5 strategic insights with specific numbers and actionable marketing recommendations.`
  }

  // For properties/real estate pages
  if (pageContext === 'properties') {
    return `You are an expert real estate business intelligence AI advisor. Analyze comprehensive business data across properties, clients, locations, marketing, operations, and revenue streams.

Provide strategic insights with specific numbers and actionable recommendations. Focus on:
- Property portfolio optimization
- Rental income maximization
- Property management efficiency
- Real estate market analysis
- Investment opportunities

Be data-driven, specific with numbers, and provide 3-5 key insights with actionable next steps. Compare to real estate benchmarks where relevant (e.g., occupancy rates 90-95%, rental yields 4-8%, property appreciation 2-5% annually).`
  }

  // Default/general business context
  return `You are an expert business intelligence AI advisor. Analyze comprehensive business data across clients, operations, marketing, and revenue streams.

Provide strategic insights with specific numbers and actionable recommendations. Focus on:
- Growth opportunities and optimization strategies
- Performance comparisons and benchmarks
- Revenue maximization and cost reduction
- Operational efficiency improvements
- Risk mitigation and business development

Be data-driven, specific with numbers, and provide 3-5 key insights with actionable next steps. Adapt your analysis to the specific business context and industry benchmarks.`
}

// Helper functions for conversation manager
async function fetchBusinessDataForPage(userId: string, workspaceId: string, pageContext?: string) {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured in AI coach')
    return {
      properties: [],
      clients: [],
      locations: [],
      locationMetrics: [],
      websites: [],
      subscriptions: [],
      workRequests: []
    }
  }

  try {
    console.log('🤖 AI Coach: Fetching real business data for workspace:', workspaceId)

    // Fetch real business data from database
    const [propertiesResult, locationsResult, metricsResult] = await Promise.all([
      supabaseAdmin
        .from('properties')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('ghl_locations')
        .select('*')
        .eq('is_active', true)
        .order('name'),

      supabaseAdmin
        .from('ghl_location_metrics')
        .select('*')
        .order('calculated_at', { ascending: false })
    ])

    // Handle potential errors
    const properties = propertiesResult.error ? [] : (propertiesResult.data || [])
    const locations = locationsResult.error ? [] : (locationsResult.data || [])
    const locationMetrics = metricsResult.error ? [] : (metricsResult.data || [])

    // Convert locations to client format for AI analysis
    const clients = locations.map((location: any) => ({
      id: location.id,
      name: location.name,
      plan: 'professional',
      status: 'active',
      metrics: [] // Will be populated from metrics data
    }))

    console.log('🤖 AI Coach: Fetched real data:', {
      propertiesCount: properties.length,
      locationsCount: locations.length,
      metricsCount: locationMetrics.length,
      clientsCount: clients.length,
      workspaceId
    })

    return {
      properties,
      clients,
      locations,
      locationMetrics,
      websites: [], // TODO: Add website queries when table is implemented
      subscriptions: [], // TODO: Add subscription queries when table is implemented
      workRequests: [] // TODO: Add work request queries when table is implemented
    }
  } catch (error) {
    console.error('❌ AI Coach: Failed to fetch business data:', error)
    return {
      properties: [],
      clients: [],
      locations: [],
      locationMetrics: [],
      websites: [],
      subscriptions: [],
      workRequests: []
    }
  }
}

function buildContextForPage(userId: string, workspaceId: string, businessData: any, pageContext?: string) {
  const context = {
    userId,
    workspaceId,
    pageContext: pageContext || 'dashboard',
    timestamp: new Date().toISOString(),

    // Aggregate metrics
    summary: {
      totalProperties: businessData.properties?.length || 0,
      totalClients: businessData.clients?.length || 0,
      totalLocations: businessData.locations?.length || 0,
      liveWebsites: businessData.websites?.filter((w: any) => w.live_site_url)?.length || 0,
      activeSubscriptions: businessData.subscriptions?.length || 0,
      activeCampaigns: businessData.campaigns?.filter((c: any) => c.status === 'active')?.length || 0
    },

    // Financial metrics
    financial: {
      monthlyRentIncome: businessData.properties?.reduce((sum: number, p: any) => sum + (p.monthly_gross_rent || 0), 0) || 0,
      portfolioValue: businessData.properties?.reduce((sum: number, p: any) => sum + (p.current_est_value || 0), 0) || 0,
      subscriptionRevenue: businessData.subscriptions?.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) || 0,
      campaignSpend: businessData.campaigns?.reduce((sum: number, c: any) => sum + (c.spent || 0), 0) || 0
    },

    // Performance metrics
    performance: {
      totalContacts: businessData.locationMetrics?.reduce((sum: number, m: any) => sum + (m.contacts_count || 0), 0) || 0,
      totalOpportunities: businessData.locationMetrics?.reduce((sum: number, m: any) => sum + (m.opportunities_count || 0), 0) || 0,
      totalConversations: businessData.locationMetrics?.reduce((sum: number, m: any) => sum + (m.conversations_count || 0), 0) || 0,
      avgHealthScore: businessData.locationMetrics?.length ?
        businessData.locationMetrics.reduce((sum: number, m: any) => sum + (m.health_score || 0), 0) / businessData.locationMetrics.length : 0
    },

    // Detailed data based on page context
    details: businessData
  }

  return context
}

function buildAIContextString(aiContext: any): string {
  const { businessData, conversationHistory, userPreferences, proactiveInsights, pageContext } = aiContext

  // Determine business type based on page context
  const businessType = pageContext === 'agency'
    ? "MARKETING AGENCY specializing in GoHighLevel (GHL) client management"
    : pageContext === 'properties'
    ? "REAL ESTATE business managing rental properties"
    : "BUSINESS with multiple operational areas"

  const contextParts = [
    "**ELO BUSINESS INTELLIGENCE CONTEXT:**",
    `**BUSINESS TYPE: ${businessType}**`,
    "",
    "**CURRENT BUSINESS STATE:**",
    pageContext === 'agency' ? [
      `• ${businessData.summary.totalClients} marketing clients across ${businessData.summary.totalLocations} locations`,
      `• ${businessData.performance.totalContacts} leads/contacts, ${businessData.performance.totalOpportunities} opportunities`,
      `• ${businessData.performance.totalConversations} client conversations`,
      `• ${businessData.summary.liveWebsites}/${businessData.summary.totalWebsites || 0} active client websites`
    ] : [
      `• ${businessData.summary.totalProperties} properties generating $${businessData.financial.monthlyRentIncome.toLocaleString()}/month`,
      `• ${businessData.summary.totalClients} clients across ${businessData.summary.totalLocations} locations`,
      `• ${businessData.performance.totalContacts} contacts, ${businessData.performance.totalOpportunities} opportunities`,
      `• ${businessData.performance.totalConversations} conversations with ${Math.round(businessData.performance.avgHealthScore)}% avg health score`,
      `• ${businessData.summary.liveWebsites}/${businessData.summary.totalWebsites || 0} live websites`
    ].flat(),
    "",
    "**FINANCIAL OVERVIEW:**",
    pageContext === 'agency' ? [
      `• Monthly marketing service revenue: $${(businessData.financial.monthlyRentIncome + businessData.financial.subscriptionRevenue).toLocaleString()}`,
      `• Client portfolio value: $${businessData.financial.portfolioValue.toLocaleString()}`,
      `• Marketing technology investments: $${businessData.financial.campaignSpend.toLocaleString()}`
    ] : [
      `• Total revenue: $${(businessData.financial.monthlyRentIncome + businessData.financial.subscriptionRevenue).toLocaleString()}/month`,
      `• Portfolio value: $${businessData.financial.portfolioValue.toLocaleString()}`,
      `• Marketing spend: $${businessData.financial.campaignSpend.toLocaleString()}`
    ].flat(),
    "",
    "**USER PREFERENCES:**",
    `• Expertise level: ${userPreferences.expertiseLevel}`,
    `• Communication style: ${userPreferences.communicationStyle}`,
    `• Proactive insights: ${userPreferences.proactiveInsights ? 'Enabled' : 'Disabled'}`,
    `• Key metrics focus: ${userPreferences.keyMetrics.join(', ')}`,
    "",
    "**CONVERSATION CONTEXT:**",
    conversationHistory.length > 0 ?
      `• Previous discussions: ${conversationHistory.map((msg: any) => msg.role === 'user' ? `"${msg.content.substring(0, 50)}..."` : 'AI response').join(' → ')}` :
      "• New conversation - no previous context",
    "",
    "**PROACTIVE INSIGHTS READY:**",
    proactiveInsights.length > 0 ?
      proactiveInsights.map((insight: any) => `• ${insight.title}: ${insight.description}`).join('\n') :
      "• No immediate alerts or opportunities detected",
    "",
    "**PAGE CONTEXT:**",
    `• Current page: ${businessData.pageContext}`,
    `• Timestamp: ${businessData.timestamp}`,
    "",
    "**AVAILABLE DATA DETAILS:**",
    `• Properties: ${JSON.stringify(businessData.details.properties?.slice(0, 2) || [], null, 0)}`,
    `• Locations: ${JSON.stringify(businessData.details.locations?.slice(0, 2) || [], null, 0)}`,
    `• Clients: ${JSON.stringify(businessData.details.clients?.slice(0, 2) || [], null, 0)}`
  ]

  return contextParts.join('\n')
}

// Generate AI response using conversation context
async function generateAIResponse(
  message: string,
  businessContext: string,
  pageContext: string | undefined,
  requestedModel: string | undefined,
  userId: string,
  workspaceId: string,
  businessData: any
): Promise<string> {
  // Check for API keys first
  const geminiApiKey = process.env.GEMINI_API_KEY
  const openRouterApiKey = process.env.OPENROUTER_API_KEY

  // Determine which AI provider to use based on requested model
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

  if (!useGemini && !useOpenRouter) {
    return "I'm having trouble connecting to my AI services right now. Please check your API configuration."
  }

    // Check intent before AI processing
    const intent = detectIntent(message)
    console.log(`🎯 Detected intent: ${intent} for message: "${message}"`)

    // Handle conversational intents with simple responses
    if (intent === 'greeting') {
      console.log(`🎯 Returning greeting response`)
      return `Hello! 👋 I'm your AI business advisor for real estate. I can help you analyze your properties, clients, campaigns, and growth opportunities. What would you like to know about your business today?`
    }

    // Extra safety check for thanks detection - prevent false positives
    if (intent === 'thanks' && !message.toLowerCase().includes('thank') && !message.toLowerCase().includes('appreciate')) {
      console.log(`🎯 Thanks intent detected but no thanks keywords found - reclassifying as business`)
      // Reclassify as business if it was incorrectly detected as thanks
    } else if (intent === 'thanks') {
      console.log(`🎯 Returning thanks response`)
      return `You're welcome! 😊 I'm here whenever you need insights about your real estate business. Feel free to ask about properties, clients, marketing campaigns, or growth strategies.`
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
              content: `${getSystemPrompt(pageContext)}\n\n${businessContext}`
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
            return openRouterData.choices[0].message.content;
          } else {
            throw new Error('Invalid OpenRouter response format');
          }

        } catch (openRouterError: unknown) {
          const errorMessage = openRouterError instanceof Error ? openRouterError.message : String(openRouterError);
          console.log(`❌ OpenRouter failed: ${errorMessage}`);
          throw openRouterError; // Re-throw to try Gemini fallback
        }
      }

      // Try Gemini as fallback (if available and OpenRouter failed)
      if (useGemini && geminiApiKey) {
        try {
          console.log(`🤖 Trying Gemini fallback (${requestedModel || "gemini-2.0-flash-lite"})...`);
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ model: requestedModel || "gemini-2.0-flash-lite" });

              const analysisPrompt = `${getSystemPrompt(pageContext)}\n\n${businessContext}\n\n**USER QUERY:** ${message}\n\n**INSTRUCTIONS:**\nThis is a business analysis query. Provide 3-5 strategic insights specific to the user's question. Use their actual business data above to give concrete, actionable advice with specific numbers. Focus on their current metrics and opportunities for growth. Compare to industry benchmarks where relevant.`;

          const result = await model.generateContent(analysisPrompt);
          const response = await result.response;
          return response.text();
        } catch (geminiError: unknown) {
          const errorMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
          console.log(`⚠️ Gemini fallback also failed: ${errorMessage}`);
          throw geminiError;
        }
      }
      throw new Error('No AI providers available');
    });

    return aiResponse;
  } catch (aiError: unknown) {
    console.error('AI generation failed:', aiError);
    const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
    const isQuotaError = errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('rate limit');

    if (isQuotaError) {
      return `Thanks for your question about "${message}"! My AI services are currently at capacity, but I can still provide insights based on your business data. Full AI analysis will resume in 30-60 seconds!`
    } else {
      return `I encountered an issue processing your request. Please try again in a moment.`
    }
  }
}

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
    const { message, pageContext, pageData, model: requestedModel, workspaceId, conversationId } = body

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

    // Check cache first (include version to invalidate old cached responses after fixes)
    const CACHE_VERSION = 'v3' // Updated for marketing agency context fixes
    const cacheKey = `${CACHE_VERSION}:${workspaceId}:${pageContext || 'general'}:${message}`
    console.log(`🔍 Cache Check: Key="${cacheKey}", User="${userId}"`)
    const cached = getCachedResponse(userId, cacheKey)
    if (cached) {
      console.log(`🔍 Cache HIT: Returning cached response: "${cached.response.substring(0, 50)}..."`)
      return NextResponse.json({
        reply: cached.response,
        cached: true,
        conversationId: cached.conversationId
      })
    }
    console.log(`🔍 Cache MISS: Processing new request`)

    // Initialize conversation manager
    const conversationManager = new ConversationManager()

    // Get or create conversation
    const conversationState = await conversationManager.initializeConversation(
      userId,
      workspaceId,
      conversationId
    )

    // Build current business context based on page
    let currentBusinessContext: any = {}

    try {
      console.log(`🔍 Fetching business data: userId=${userId}, workspaceId=${workspaceId}, pageContext=${pageContext}`)
      // Get business data based on page context
      const businessData = await fetchBusinessDataForPage(userId, workspaceId, pageContext)
      console.log(`🔍 Business data fetched:`, {
        properties: businessData.properties?.length || 0,
        clients: businessData.clients?.length || 0,
        locations: businessData.locations?.length || 0,
        hasMetrics: !!businessData.locationMetrics?.length
      })
      currentBusinessContext = buildContextForPage(userId, workspaceId, businessData, pageContext)
      console.log(`🔍 Business context built:`, currentBusinessContext)
    } catch (error) {
      console.error('❌ Error fetching business data:', error)
      currentBusinessContext = { error: 'Unable to fetch current business data' }
    }

    console.log(`🔍 Processing message with conversation manager: "${message}"`)
    // Process message with conversation manager
    const {
      enrichedContext,
      relevantHistory,
      userPreferences,
      proactiveInsights
    } = await conversationManager.processMessage(
      conversationState.conversationId,
      message,
      currentBusinessContext
    )
    console.log(`🔍 Conversation manager processed:`, {
      enrichedContextKeys: Object.keys(enrichedContext),
      relevantHistoryCount: relevantHistory.length,
      proactiveInsightsCount: proactiveInsights.length
    })

    // Build comprehensive context for AI
    const aiContext = {
      businessData: enrichedContext,
      conversationHistory: relevantHistory,
      userPreferences,
      proactiveInsights,
      pageContext,
      timestamp: new Date().toISOString()
    }

    // Format context for AI prompt
    const businessContext = buildAIContextString(aiContext)

    // Save user message to conversation
    await conversationManager.saveMessage(
      conversationState.conversationId,
      'user',
      message,
      {
        pageContext,
        businessData: enrichedContext.summary,
        proactiveInsightsCount: proactiveInsights.length
      }
    )



    // Generate AI response using conversation manager
    let reply = await generateAIResponse(
      message,
      businessContext,
      pageContext,
      requestedModel,
      userId,
      workspaceId,
      enrichedContext
    )

    // Get intent for logging (since it's detected inside generateAIResponse)
    const detectedIntent = detectIntent(message)

    // Save AI response to conversation
    await conversationManager.saveMessage(
      conversationState.conversationId,
      'assistant',
      reply,
      {
        pageContext,
        businessData: enrichedContext.summary,
        proactiveInsightsCount: proactiveInsights.length
      }
    )

    console.log(`📤 AI Coach Final Response: intent=${detectedIntent}, provider='ai-coach', replyLength=${reply.length}`)

    return NextResponse.json({
      reply,
      cached: false,
      conversationId: conversationState.conversationId,
      pageContext: pageContext || null,
      provider: 'ai-coach',
      model: requestedModel || 'auto',
      proactiveInsights: proactiveInsights.slice(0, 3), // Top 3 insights
      conversationSummary: conversationState.summary,
      // Debug info
      debug: {
        intent: detectedIntent,
        originalMessage: message,
        businessDataCount: {
          properties: currentBusinessContext.properties?.length || 0,
          clients: currentBusinessContext.clients?.length || 0,
          locations: currentBusinessContext.locations?.length || 0
        }
      }
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