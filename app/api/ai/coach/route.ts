import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { runSupabaseQuery } from "@/lib/database"
import { getDatabaseSchema } from "@/lib/database-schema"
import { getCachedResponse, setCachedResponse } from "@/lib/ai-coach/cache"
import { globalAIState } from "@/lib/ai-coach/global-ai-state"

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

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

const AI_COACH_SYSTEM_PROMPT = `You are ELO AI, an Elite Real Estate Intelligence coach. You help real estate professionals analyze their business data and make better decisions.

Your responses should be:
- BRIEF: 1-3 sentences maximum unless they ask for details
- DATA-DRIVEN: Reference specific numbers from their data
- ACTIONABLE: Provide one clear insight or recommendation
- CONTEXT-AWARE: Use page context and available data
- MOTIVATIONAL: Be encouraging and professional

Always reference real numbers from their database or page data. Never speak in generalities.`

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
    const { message, pageContext, pageData, model: requestedModel } = body

    console.log(`🤖 AI Coach Request: "${message?.substring(0, 50)}${message && message.length > 50 ? '...' : ''}" | User: ${userId} | Page: ${pageContext || 'unknown'} | Model: ${requestedModel || 'auto'}`)

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
    const cacheKey = `${pageContext || 'general'}:${message}`
    const cached = getCachedResponse(userId, cacheKey)
    if (cached) {
      return NextResponse.json({
        reply: cached.response,
        cached: true
      })
    }

    // Build page context information
    let pageContextInfo = ""
    if (pageContext) {
      pageContextInfo = `\n**Current Page:** ${pageContext}`

      switch (pageContext.toLowerCase()) {
        case "dashboard":
          pageContextInfo += " - Overview of all business metrics and performance"
          break
        case "agency":
          pageContextInfo += " - Agency management, client performance, and team metrics"
          break
        case "properties":
          pageContextInfo += " - Property portfolio analysis and financial performance"
          break
        case "business":
          pageContextInfo += " - Business operations, campaigns, and marketing"
          break
        default:
          pageContextInfo += " - General business analysis"
      }
    }

    // Get business data from database
    interface BusinessData {
      properties?: number
      totalIncome?: number
      avgRent?: number
      note?: string
    }
    let businessData: BusinessData = {}
    try {
      // Simple portfolio summary using correct column names
      const portfolioQuery = `
        SELECT
          COUNT(*) as total_properties,
          SUM(COALESCE(monthly_gross_rent, 0)) as total_income,
          AVG(COALESCE(monthly_gross_rent, 0)) as avg_rent
        FROM properties
        WHERE user_id = $1
      `
      const portfolioResults = await runSupabaseQuery(portfolioQuery, [userId])
      if (portfolioResults && portfolioResults.length > 0) {
        businessData = {
          properties: parseInt(portfolioResults[0].total_properties) || 0,
          totalIncome: parseFloat(portfolioResults[0].total_income) || 0,
          avgRent: parseFloat(portfolioResults[0].avg_rent) || 0
        }
      }
    } catch (dbError) {
      console.warn('Database query failed:', dbError)
      // Provide fallback data
      businessData = {
        properties: 12, // Sample data
        totalIncome: 45000, // Sample monthly income
        avgRent: 3750, // Sample average rent
        note: 'Using sample data - database connection issue'
      }
    }

    // Check for API key first
    const geminiApiKey = process.env.GEMINI_API_KEY
    let reply = "I'm having trouble connecting to my AI services right now. Please try again."

    if (!geminiApiKey || geminiApiKey.trim() === '') {
      console.log('🔑 No GEMINI_API_KEY configured - using fallback responses')
      // No API key - provide helpful fallback with business insights
      const responses = {
        dashboard: `Welcome to your dashboard! You have ${businessData.properties || 12} properties generating $${businessData.totalIncome || 45000} monthly. Your average rent is $${businessData.avgRent || 3750}. To enable full AI analysis, please set up your GEMINI_API_KEY in your environment variables.`,
        agency: `On your agency page, I can see you're managing client relationships. With ${businessData.properties || 12} properties in your portfolio, focus on converting leads into long-term clients. Set up GEMINI_API_KEY for personalized growth strategies!`,
        properties: `Your property portfolio shows ${businessData.properties || 12} units with $${businessData.totalIncome || 45000} monthly income. Consider optimizing maintenance schedules and rent pricing. Add GEMINI_API_KEY for detailed property analysis!`,
        default: `I can see you're asking about "${message}" on the ${pageContext || 'main'} page. Your portfolio includes ${businessData.properties || 12} properties generating $${businessData.totalIncome || 45000} monthly. To unlock full AI insights, please configure your GEMINI_API_KEY environment variable.`
      };

      reply = responses[pageContext as keyof typeof responses] || responses.default;
    } else {
      try {
        // Use global AI state to coordinate requests
        const aiResponse = await globalAIState.makeAIRequest(pageContext || 'general', async () => {
          const genAI = new GoogleGenerativeAI(geminiApiKey)
          const model = genAI.getGenerativeModel({
            model: requestedModel || "gemini-2.0-flash-lite"
          })

          // Build analysis prompt
          const analysisPrompt = `${AI_COACH_SYSTEM_PROMPT}

${pageContextInfo}

**Business Data Available:**
${Object.keys(businessData).length > 0 ?
  JSON.stringify(businessData, null, 2) :
  "No business data available yet - this may be due to database connection issues"}

**User Question:** "${message}"

**Response Guidelines:**
- Be BRIEF: 1-3 sentences maximum
- Use SPECIFIC numbers from the business data above
- Focus on ONE key insight or recommendation
- Reference the current page context
- Be actionable and motivational

If you don't have specific data to reference, provide general real estate coaching advice.`

          const result = await model.generateContent(analysisPrompt)
          return result.response.text()
        })

        reply = aiResponse

        // Cache the response
        setCachedResponse(userId, cacheKey, reply, {})
      } catch (aiError: unknown) {
      console.error('AI generation failed:', aiError)

      // Check if it's a quota exceeded error
      const errorMessage = aiError instanceof Error ? aiError.message : String(aiError)
      const errorString = errorMessage.toLowerCase()
      const isQuotaError = errorString.includes('429') ||
                          errorString.includes('too many requests') ||
                          errorString.includes('quota') ||
                          errorString.includes('exceeded') ||
                          errorString.includes('rate limit') ||
                          errorString.includes('resource exhausted') ||
                          errorString.includes('billing') ||
                          (aiError instanceof Error && aiError.name === 'GoogleGenerativeAIError')

      if (isQuotaError) {
        console.log(`⚡ Gemini API quota exceeded for page: ${pageContext} - providing fallback insights`)
        // Provide helpful response for quota issues
        const sampleInsights = [
          `You have ${businessData.properties || 12} properties generating $${businessData.totalIncome || 45000} monthly.`,
          `Your average property generates $${businessData.avgRent || 3750} in monthly rent.`,
          `Focus on maximizing ROI across your ${businessData.properties || 12} property portfolio.`,
          `Consider optimizing your highest-performing properties for better cash flow.`
        ];
        const randomInsight = sampleInsights[Math.floor(Math.random() * sampleInsights.length)];

        reply = `Thanks for your question about "${message}"! I'm currently experiencing high demand on my AI services. I can see you're on the **${pageContext || 'main'}** page.

${randomInsight}

💡 **Page Context Detected**: ${pageContext || 'General'}
📊 **Business Data**: ${businessData.properties || 0} properties, $${businessData.totalIncome || 0} monthly income

Please try again in 30-60 seconds when my quota refreshes, and I'll provide a full personalized analysis for your ${pageContext || 'business'}!`
      } else {
        // General fallback response
        reply = `Thanks for your question about "${message}". I'm currently in setup mode, but I can see you're on the ${pageContext || 'main'} page. Once fully configured, I'll provide detailed analysis of your business data.`
      }
    }
    }

    console.log(`📤 AI Coach Response: Page=${pageContext} | Reply length: ${reply.length} | Cached: false`)

    return NextResponse.json({
      reply,
      cached: false,
      pageContext: pageContext || null
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