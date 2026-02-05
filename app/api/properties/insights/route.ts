import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import crypto from 'crypto'
import { globalAIState } from '@/lib/ai-coach/global-ai-state'

interface Property {
  id: string
  address: string
  type: string
  status: string
  purchasePrice: number
  currentEstValue: number
  monthlyMortgagePayment: number
  monthlyInsurance: number
  monthlyPropertyTax: number
  monthlyOtherCosts: number
  monthlyGrossRent: number
}

interface PortfolioMetrics {
  totalProperties: number
  totalEstValue: number
  totalMonthlyCashflow: number
  avgROI: number
}

// Simple in-memory cache for AI insights
interface CachedInsight {
  insights: string
  timestamp: number
  source: 'ai' | 'fallback'
  dataHash: string
}

const insightsCache = new Map<string, CachedInsight>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

// Create a hash of the property data for caching
function createDataHash(properties: Property[], metrics: PortfolioMetrics): string {
  const data = { properties, metrics }
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
}

// Check if we have valid cached insights
function getCachedInsights(dataHash: string, forceRefresh: boolean = false): CachedInsight | null {
  if (forceRefresh) return null

  const cached = insightsCache.get(dataHash)
  if (!cached) return null

  const now = Date.now()
  if (now - cached.timestamp > CACHE_TTL) {
    insightsCache.delete(dataHash)
    return null
  }

  return cached
}

// Cache insights
function setCachedInsights(dataHash: string, insights: string, source: 'ai' | 'fallback') {
  insightsCache.set(dataHash, {
    insights,
    timestamp: Date.now(),
    source,
    dataHash
  })
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { properties, portfolioMetrics, forceRefresh = false, style = 'balanced' } = await request.json()

    // Check current AI request status - aggressive rate limiting for Google free tier
    const aiStatus = globalAIState.getStatus()
    console.log(`🤖 Properties Insights - AI Status: ${aiStatus.activeRequests} active, ${aiStatus.queuedRequests} queued`)

    // Aggressive rate limiting: reject if 2+ active OR 3+ queued (Google free tier is very restrictive)
    if (aiStatus.activeRequests >= 2 || aiStatus.queuedRequests >= 3) {
      const retryAfter = Math.max(5, aiStatus.queuedRequests * 2)
      console.log(`🚫 Properties Insights rejected: (${aiStatus.activeRequests} active, ${aiStatus.queuedRequests} queued) - retry after ${retryAfter}s`)

      return NextResponse.json(
        {
          error: 'AI service busy',
          details: `Please wait ${retryAfter} seconds before requesting portfolio insights.`,
          source: 'rate_limited',
          retryAfter,
          timestamp: Date.now()
        },
        {
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() }
        }
      )
    }

    // Create hash of the data for caching (include style)
    const dataHash = createDataHash(properties, portfolioMetrics) + `:${style}`

    // Check cache first (unless force refresh)
    const cached = getCachedInsights(dataHash, forceRefresh)
    if (cached && !forceRefresh) {
      console.log('📋 Using cached insights (age:', Math.round((Date.now() - cached.timestamp) / 1000), 'seconds)')
      return NextResponse.json({
        insights: cached.insights,
        source: cached.source,
        cached: true,
        timestamp: cached.timestamp
      })
    }

    // Check for Gemini API key
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      console.error('🔑 GEMINI_API_KEY not configured')
      return NextResponse.json(
        {
          error: 'AI insights unavailable',
          details: 'Gemini API key not configured. Please set GEMINI_API_KEY in your environment variables.',
          source: 'error',
          cached: false,
          timestamp: Date.now()
        },
        { status: 503 }
      )
    }

    // Generate AI insights using Gemini
    console.log('🤖 Generating fresh AI insights...', `(style: ${style})`)
    const insights = await generateAIInsights(properties, portfolioMetrics, style)
    setCachedInsights(dataHash, insights, 'ai')

    return NextResponse.json({
      insights,
      source: 'ai',
      cached: false,
      timestamp: Date.now()
    })

  } catch (error: any) {
    console.error('Error generating property insights:', error)

    // Provide specific error messages based on error type
    let errorMessage = 'AI insights unavailable'
    let errorDetails = 'An unexpected error occurred while generating insights.'

    if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
      errorMessage = 'AI service quota exceeded'
      errorDetails = 'The AI service quota has been exceeded. Please try again later or upgrade your plan.'
    } else if (error?.message?.includes('quota')) {
      errorMessage = 'AI service quota exceeded'
      errorDetails = 'The AI service has reached its usage limits. Please check your billing or try again later.'
    } else if (error?.message) {
      errorDetails = error.message
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        source: 'error',
        cached: false,
        timestamp: Date.now()
      },
      { status: 503 }
    )
  }
}

// Generate AI-powered insights using Gemini with rate limiting
async function generateAIInsights(properties: Property[], metrics: PortfolioMetrics, style: string = 'balanced'): Promise<string> {
  // Use global AI state to coordinate requests
  return await globalAIState.makeAIRequest('properties-insights', async () => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" })

    const portfolioSummary = `
Portfolio Overview:
- ${metrics.totalProperties} total properties
- Total estimated value: $${metrics.totalEstValue.toLocaleString()}
- Monthly cash flow: $${metrics.totalMonthlyCashflow.toLocaleString()}
- Average ROI: ${metrics.avgROI.toFixed(1)}%

Property Details:
${properties.map(p => `
• ${p.address} (${p.type})
  - Status: ${p.status}
  - Purchase Price: $${p.purchasePrice.toLocaleString()}
  - Monthly Rent: $${p.monthlyGrossRent.toLocaleString()}
  - Monthly Costs: $${(p.monthlyMortgagePayment + p.monthlyInsurance + p.monthlyPropertyTax + p.monthlyOtherCosts).toLocaleString()}
  - Cash Flow: $${(p.monthlyGrossRent - (p.monthlyMortgagePayment + p.monthlyInsurance + p.monthlyPropertyTax + p.monthlyOtherCosts)).toLocaleString()}/month
`).join('')}
`

    const stylePrompts = {
    conservative: `You are a conservative real estate investment advisor. Focus on risk mitigation, stable cash flow, and preserving capital. Prioritize low-risk strategies and caution against aggressive moves.`,
    balanced: `You are a balanced real estate investment advisor. Focus on steady growth, moderate risk strategies, and sustainable portfolio improvement.`,
    aggressive: `You are an aggressive real estate investment advisor. Focus on high-growth opportunities, leverage strategies, and maximizing returns even with higher risk.`,
    cashflow: `You are a cash flow specialist. Focus exclusively on improving monthly cash flow, rental income optimization, and expense reduction strategies.`,
    growth: `You are a growth-oriented advisor. Focus on property appreciation, market timing, strategic acquisitions, and long-term value creation.`
  }

  const styleContext = stylePrompts[style as keyof typeof stylePrompts] || stylePrompts.balanced

    const prompt = `${styleContext}

Analyze this property portfolio and provide 4-6 specific, actionable insights to improve profitability and portfolio performance.

${portfolioSummary}

Please provide insights in the following format:
1. **Title of Insight** - Brief description with specific numbers and actionable recommendations.

Be specific with numbers, prioritize high-impact recommendations, and make suggestions actionable. Keep insights concise but informative.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    return response.text()
  })
}
