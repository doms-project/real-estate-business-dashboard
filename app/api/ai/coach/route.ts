import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@supabase/supabase-js"
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

// Helper functions for conversation manager
async function fetchBusinessDataForPage(userId: string, workspaceId: string, pageContext?: string) {
  // For now, return a basic structure that will be enhanced by the conversation manager
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
  const { businessData, conversationHistory, userPreferences, proactiveInsights } = aiContext

  const contextParts = [
    "**ELO BUSINESS INTELLIGENCE CONTEXT:**",
    "",
    "**CURRENT BUSINESS STATE:**",
    `• ${businessData.summary.totalProperties} properties generating $${businessData.financial.monthlyRentIncome.toLocaleString()}/month`,
    `• ${businessData.summary.totalClients} clients across ${businessData.summary.totalLocations} locations`,
    `• ${businessData.performance.totalContacts} contacts, ${businessData.performance.totalOpportunities} opportunities`,
    `• ${businessData.performance.totalConversations} conversations with ${Math.round(businessData.performance.avgHealthScore)}% avg health score`,
    `• ${businessData.summary.liveWebsites}/${businessData.summary.totalWebsites || 0} live websites`,
    "",
    "**FINANCIAL OVERVIEW:**",
    `• Total revenue: $${(businessData.financial.monthlyRentIncome + businessData.financial.subscriptionRevenue).toLocaleString()}/month`,
    `• Portfolio value: $${businessData.financial.portfolioValue.toLocaleString()}`,
    `• Marketing spend: $${businessData.financial.campaignSpend.toLocaleString()}`,
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
    return `Hello! 👋 I'm your AI business advisor for real estate. I can help you analyze your properties, clients, campaigns, and growth opportunities. What would you like to know about your business today?`
  }

  if (intent === 'thanks') {
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

          const analysisPrompt = `${AI_COACH_SYSTEM_PROMPT}\n\n${businessContext}\n\n**USER QUERY:** ${message}\n\n**INSTRUCTIONS:**\nThis is a business analysis query. Provide 3-5 strategic insights specific to the user's question. Use their actual business data above to give concrete, actionable advice with specific numbers. Focus on their current metrics and opportunities for growth. Compare to industry benchmarks where relevant.`;

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

    // Check cache first
    const cacheKey = `${workspaceId}:${pageContext || 'general'}:${message}`
    const cached = getCachedResponse(userId, cacheKey)
    if (cached) {
      return NextResponse.json({
        reply: cached.response,
        cached: true,
        conversationId: cached.conversationId
      })
    }

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
      // Get business data based on page context
      const businessData = await fetchBusinessDataForPage(userId, workspaceId, pageContext)
      currentBusinessContext = buildContextForPage(userId, workspaceId, businessData, pageContext)
    } catch (error) {
      console.error('Error fetching business data:', error)
      currentBusinessContext = { error: 'Unable to fetch current business data' }
    }

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

    console.log(`📤 AI Coach Response: Page=${pageContext} | Reply length: ${reply.length} | Cached: false`);

    return NextResponse.json({
      reply,
      cached: false,
      conversationId: conversationState.conversationId,
      pageContext: pageContext || null,
      provider: 'ai-coach',
      model: requestedModel || 'auto',
      proactiveInsights: proactiveInsights.slice(0, 3), // Top 3 insights
      conversationSummary: conversationState.summary
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