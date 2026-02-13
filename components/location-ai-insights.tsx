"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Brain, TrendingUp, Target, AlertTriangle, Lightbulb, Loader2, RefreshCw, Send, MessageCircle, User } from "lucide-react"
import { useAICoordinator } from "@/hooks/use-ai-coordinator"
import { useWorkspace } from "@/components/workspace-context"

interface LocationAIInsightsProps {
  locationId: string
  locationName: string
  analytics: any
  pageData: any
}

interface AIInsight {
  type: 'performance' | 'opportunity' | 'warning' | 'recommendation'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  metrics?: string[]
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isTyping?: boolean
}

export function LocationAIInsights({ locationId, locationName, analytics, pageData }: LocationAIInsightsProps) {
  console.log('🎯 LocationAIInsights component rendered for:', locationName, locationId)
  console.log('📊 Component props:', {
    locationId,
    locationName,
    hasAnalytics: !!analytics,
    hasPageData: !!pageData,
    contacts: pageData?.contacts,
    opportunities: pageData?.opportunities,
    healthScore: pageData?.healthScore
  })

  // Use workspace context for AI coach authorization
  const { currentWorkspace } = useWorkspace()

  // Legacy insights (kept for backward compatibility)
  const [insights, setInsights] = useState<AIInsight[]>([])

  // Chat interface state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // UI state
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [isUsingCustomPrompt, setIsUsingCustomPrompt] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('openrouter-free')

  // Use AI coordinator for rate limiting
  const { makeAIRequest, isLoading } = useAICoordinator(`LocationAIInsights-${locationId}`)
  console.log('🤖 AI Coordinator initialized:', { isLoading, hasMakeAIRequest: !!makeAIRequest })

  // Enhanced AI service with retry logic
  const callAIWithRetry = useCallback(async (prompt: string, maxRetries = 2): Promise<{ response: Response, responseText: string }> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🤖 AI attempt ${attempt}/${maxRetries}`)

        const response = await makeAIRequest(() => {
          console.log('🌐 Executing fetch to /api/ai/coach')
          return fetch('/api/ai/coach', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: prompt,
              pageContext: 'location-compact',
              useStreaming: false,
              model: selectedModel === 'auto' ? null : selectedModel,
              workspaceId: currentWorkspace?.id || null, // Use current workspace for AI coach authorization
              pageData: {
                locationId,
                locationName,
                analytics,
                contacts: pageData.contacts,
                opportunities: pageData.opportunities,
                conversations: pageData.conversations,
                healthScore: pageData.healthScore,
                leadSources: pageData.leadSources,
                // Include rich analytics data
                pipelineAnalysis: analytics?.pipelineAnalysis,
                revenueMetrics: analytics?.revenueMetrics,
                conversationMetrics: analytics?.conversationMetrics,
                workflows: analytics?.workflows,
                formsData: analytics?.formsData,
                socialAnalytics: analytics?.socialAnalytics
              }
            })
          })
        })

        // Read response text immediately to avoid stream issues
        const responseText = await response.text()
        console.log(`📄 Response received, length: ${responseText.length}`)

        if (response.ok) {
          console.log(`✅ AI attempt ${attempt} successful`)
          return { response, responseText }
        }

        console.warn(`⚠️ AI attempt ${attempt} failed:`, {
          status: response.status,
          statusText: response.statusText,
          error: responseText.substring(0, 200)
        })

        // Don't retry on client errors (4xx) - throw error immediately
        if (response.status >= 400 && response.status < 500) {
          console.log('🚫 Client error - not retrying')
          const errorMessage = responseText && responseText !== 'null'
            ? responseText
            : `HTTP ${response.status}: ${response.statusText}`
          throw new Error(`AI service error: ${errorMessage}`)
        }

        // Retry on server errors (5xx) or network issues
        if (attempt < maxRetries) {
          const backoffDelay = 1000 * attempt // Exponential backoff
          console.log(`⏳ Retrying in ${backoffDelay}ms...`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
        }

      } catch (error) {
        console.error(`❌ AI attempt ${attempt} error:`, error)

        if (attempt === maxRetries) {
          throw error
        }

        // Wait before retry
        const backoffDelay = 1000 * attempt
        console.log(`⏳ Retrying after error in ${backoffDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
      }
    }

    throw new Error(`All ${maxRetries} AI service attempts failed`)
  }, [locationId, locationName, pageData, analytics, selectedModel, makeAIRequest])

  // Handle sending chat messages
  const handleSendMessage = useCallback(async () => {
    if (!currentMessage.trim()) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    }

    // Add user message
    setMessages(prev => [...prev, userMessage])
    setCurrentMessage('')
    setIsTyping(true)
    setError(null)

    try {
      console.log('💬 Processing chat message:', userMessage.content)

      // Generate AI response for the location-specific question
      const aiResponse = await generateChatResponse(userMessage.content)

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      setLastUpdated(new Date())

    } catch (err) {
      console.error('❌ Chat response error:', err)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setError(err instanceof Error ? err.message : 'Chat response failed')
    } finally {
      setIsTyping(false)
    }
  }, [currentMessage])

  // Generate conversational AI response for location questions
  const generateChatResponse = useCallback(async (question: string): Promise<string> => {
    console.log('🤖 Generating chat response for question:', question)

    const conversationContext = messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')

    const chatPrompt = `
You are an expert location business analyst for ${locationName}. Answer questions conversationally using ONLY the location's current data.

LOCATION DATA (${locationName}):
- Contacts: ${pageData.contacts || 0}
- Opportunities: ${pageData.opportunities || 0}
- Conversations: ${pageData.conversations || 0}
- Health Score: ${pageData.healthScore || 0}%
- Conversion Rate: ${pageData.contacts && pageData.opportunities ? ((pageData.opportunities / pageData.contacts) * 100).toFixed(1) : 0}%
- Top Lead Source: ${pageData.leadSources?.sources?.[0]?.source || 'None'} (${pageData.leadSources?.sources?.[0]?.percentage || 0}%)

BUSINESS METRICS:
- Revenue: $${analytics?.revenueMetrics?.totalRevenue || 0}
- Win Rate: ${analytics?.pipelineAnalysis?.winRate || 0}%
- Avg Response Time: ${analytics?.conversationMetrics?.avgResponseTime || 0} minutes
- Active Workflows: ${analytics?.workflows?.length || 0}
- Marketing Forms: ${analytics?.formsData?.totalForms || 0}

RECENT CONVERSATION:
${conversationContext}

USER QUESTION: ${question}

INSTRUCTIONS:
- Answer as a conversational business advisor
- Use specific numbers from the location data above
- Focus ONLY on this location's performance - no external comparisons
- Provide actionable insights based on the actual metrics
- Keep responses helpful and focused on ${locationName}
- If data is missing, acknowledge it and work with available information

RESPONSE:`

    console.log('📝 Chat prompt prepared, calling AI service')

    const { response, responseText } = await callAIWithRetry(chatPrompt, 2)

    // Check if responseText is valid
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('AI service returned empty response')
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('❌ JSON parse error in chat response:', parseError)
      throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`)
    }

    // Check if data is valid and has expected structure
    if (data === null || data === undefined || typeof data !== 'object') {
      console.error('❌ Invalid data structure in chat response:', data, 'Type:', typeof data)
      throw new Error('AI service returned invalid data structure')
    }

    // Check if this is an API error response
    if (data.error) {
      console.error('❌ API Error Response in chat:', data.error, data.message)
      throw new Error(data.message || data.error || 'AI coach API error')
    }

    const aiResponse = data.reply || data.response || ''

    if (!aiResponse.trim()) {
      throw new Error('AI returned empty response')
    }

    console.log('✅ Chat response generated:', aiResponse.substring(0, 100) + '...')
    return aiResponse
  }, [locationName, pageData, analytics, messages, callAIWithRetry])

  // Handle keyboard shortcuts
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  // Generate smart fallback insights based on actual data analysis
  const generateSmartFallback = useCallback((): AIInsight[] => {
    const insights: AIInsight[] = []
    console.log('🎯 Generating smart fallback insights for:', locationName)

    // Lead source concentration analysis
    if (pageData.leadSources?.sources?.[0]?.percentage > 80) {
      insights.push({
        type: 'warning',
        title: 'Lead Source Concentration Risk',
        description: `${pageData.leadSources.sources[0].percentage}% of leads from single source '${pageData.leadSources.sources[0].source}' creates vulnerability. Diversify lead channels immediately.`,
        priority: 'high',
        metrics: ['lead_sources', 'diversification', 'risk_management']
      })
    }

    // Conversion rate analysis
    const contacts = pageData.contacts || 0
    const opportunities = pageData.opportunities || 0
    if (contacts > 0) {
      const conversionRate = (opportunities / contacts) * 100
      if (conversionRate < 3) {
        insights.push({
          type: 'opportunity',
          title: 'Low Conversion Optimization',
          description: `Only ${conversionRate.toFixed(1)}% contact-to-opportunity conversion (${opportunities}/${contacts}). Implement lead scoring and qualification process.`,
          priority: 'high',
          metrics: ['conversion_rate', 'lead_qualification', 'sales_process']
        })
      }
    }

    // Health score insights
    const healthScore = pageData.healthScore || 0
    if (healthScore < 50) {
      insights.push({
        type: 'performance',
        title: 'Health Score Improvement Required',
        description: `${healthScore}% health score indicates operational issues. Focus on response times (${analytics?.conversationMetrics?.avgResponseTime || 'unknown'}min) and engagement metrics.`,
        priority: 'high',
        metrics: ['health_score', 'response_time', 'engagement']
      })
    }

    // Opportunity pipeline analysis
    if (analytics?.pipelineAnalysis) {
      const pipeline = analytics.pipelineAnalysis
      if (pipeline.totalOpportunities > 0 && pipeline.winRate !== undefined) {
        if (pipeline.winRate < 20) {
          insights.push({
            type: 'warning',
            title: 'Pipeline Conversion Issues',
            description: `${pipeline.winRate}% win rate on ${pipeline.totalOpportunities} opportunities is below target. Review sales process and pricing strategy.`,
            priority: 'medium',
            metrics: ['win_rate', 'pipeline', 'sales_performance']
          })
        }
      }
    }

    // Workflow automation analysis
    const workflowCount = analytics?.workflows?.length || 0
    if (workflowCount === 0 && contacts > 100) {
      insights.push({
        type: 'recommendation',
        title: 'Automation Opportunity',
        description: `No automated workflows with ${contacts} contacts. Implement lead nurturing sequences and follow-up automation.`,
        priority: 'medium',
        metrics: ['automation', 'workflows', 'efficiency']
      })
    }

    // Return smart insights or basic fallback
    return insights.length > 0 ? insights.slice(0, 3) : [{
      type: 'performance' as const,
      title: 'Current Performance Overview',
      description: `${locationName}: ${contacts} contacts, ${opportunities} opportunities, ${healthScore}% health score. AI analysis temporarily unavailable.`,
      priority: 'medium' as const,
      metrics: ['contacts', 'opportunities', 'health_score']
    }]
  }, [locationName, pageData, analytics])

  // Generate enhanced prompt with rich business context
  const generateEnhancedPrompt = useCallback(() => {
    console.log('📊 Generating enhanced AI prompt with rich context')

    const metrics = {
      contacts: pageData.contacts || 0,
      opportunities: pageData.opportunities || 0,
      conversations: pageData.conversations || 0,
      healthScore: pageData.healthScore || 0,
      topSource: pageData.leadSources?.sources?.[0]?.source || 'None',
      topSourcePct: pageData.leadSources?.sources?.[0]?.percentage || 0
    }

    // Calculate derived metrics
    const conversionRate = metrics.contacts > 0 ? (metrics.opportunities / metrics.contacts * 100) : 0

    // Build comprehensive business context
    const businessContext = []

    // Core performance
    businessContext.push(`CORE METRICS:
- Contacts: ${metrics.contacts}
- Opportunities: ${metrics.opportunities}
- Conversations: ${metrics.conversations}
- Health Score: ${metrics.healthScore}%
- Conversion Rate: ${conversionRate.toFixed(1)}%
- Top Lead Source: ${metrics.topSource} (${metrics.topSourcePct}% of leads)`)

    // Revenue context
    if (analytics?.revenueMetrics) {
      const rev = analytics.revenueMetrics
      businessContext.push(`REVENUE PERFORMANCE:
- Total Revenue: $${rev.totalRevenue || 0}
- Win Rate: ${rev.winRate || 0}%
- Average Deal Size: $${rev.avgDealSize || 0}`)
    }

    // Operational context
    if (analytics?.conversationMetrics) {
      const conv = analytics.conversationMetrics
      businessContext.push(`COMMUNICATION METRICS:
- Response Time: ${conv.avgResponseTime || 0} minutes
- Response Rate: ${conv.responseRate || 0}%
- Active Conversations: ${conv.activeConversations || 0}`)
    }

    // Automation context
    const workflowCount = analytics?.workflows?.length || 0
    const formCount = analytics?.formsData?.totalForms || 0
    businessContext.push(`AUTOMATION & TOOLS:
- Active Workflows: ${workflowCount}
- Marketing Forms: ${formCount}
- Social Media Accounts: ${analytics?.socialAnalytics?.summary?.totalAccounts || 0}`)

    // Special case for zero activity
    if (metrics.contacts === 0 && metrics.opportunities === 0 && metrics.conversations === 0) {
      return `Location ${locationName} has ZERO client activity: 0 contacts, 0 opportunities, 0 conversations, ${metrics.healthScore}% health score.

This location is completely dormant and needs immediate activation. Provide 3 specific, actionable recommendations for a ${locationName} location:

1. LOCAL LEAD GENERATION: Deploy location-specific landing pages and contact forms
2. TARGETED MARKETING: Launch geo-targeted campaigns (Google Local, Facebook Local)
3. COMMUNITY NETWORKING: Build partnerships with local businesses for referrals

Format as JSON array with practical, implementable actions for location activation.`
    }

    // Standard analysis prompt
    return `ANALYZE ${locationName} BUSINESS PERFORMANCE:

${businessContext.join('\n\n')}

PROVIDE 2-3 SPECIFIC INSIGHTS about performance, opportunities, warnings, or recommendations. Focus on:
- Lead generation effectiveness and diversification
- Conversion rate optimization opportunities
- Operational efficiency improvements
- Revenue growth strategies
- Risk mitigation

Format as JSON array with actionable business intelligence:
[{"type":"performance/opportunity/warning/recommendation","title":"Brief title","description":"1 sentence with specific numbers and actionable advice","priority":"high/medium/low","metrics":["key","metrics"]}]`
  }, [locationName, pageData, analytics])

  const parseAIResponse = useCallback((response: string): AIInsight[] => {
    // Ultra-efficient parsing for free model limits
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 3).map(item => ({
            type: ['performance', 'opportunity', 'warning', 'recommendation'].includes(item.type)
              ? item.type as AIInsight['type'] : 'performance',
            title: (item.title || 'Analysis').substring(0, 40),
            description: (item.description || 'Data available').substring(0, 120),
            priority: ['high', 'medium', 'low'].includes(item.priority)
              ? item.priority as AIInsight['priority'] : 'medium',
            metrics: Array.isArray(item.metrics) ? item.metrics.slice(0, 3) : []
          }))
        }
      }
    } catch (e) {
      console.warn('Compact parsing failed:', e instanceof Error ? e.message : String(e))
    }

    // Enhanced fallback for zero-activity locations
    const hasZeroActivity = (pageData.contacts || 0) === 0 &&
                           (pageData.opportunities || 0) === 0 &&
                           (pageData.conversations || 0) === 0

    if (hasZeroActivity) {
      return [
        {
          type: 'opportunity' as const,
          title: 'Location Activation Required',
          description: `${locationName} has zero client activity. Immediate lead generation setup needed.`,
          priority: 'high' as const,
          metrics: ['contacts', 'opportunities', 'conversations']
        },
        {
          type: 'recommendation' as const,
          title: 'Lead Capture Setup',
          description: 'Deploy landing page with contact form and automated follow-up sequence.',
          priority: 'high' as const,
          metrics: ['landing_page', 'contact_form', 'automation']
        },
        {
          type: 'warning' as const,
          title: 'Marketing Campaign Needed',
          description: 'Launch local advertising campaign to drive traffic to lead capture assets.',
          priority: 'medium' as const,
          metrics: ['local_ads', 'social_media', 'email_marketing']
        }
      ]
    }

    // Minimal fallback for locations with some activity
    return [{
      type: 'performance' as const,
      title: 'Performance Summary',
      description: `${locationName}: ${pageData.contacts || 0} contacts, ${pageData.healthScore || 0}% health.`,
      priority: 'medium' as const,
      metrics: ['contacts', 'healthScore']
    }]
  }, [locationName, pageData.contacts, pageData.opportunities, pageData.conversations, pageData.healthScore])

  const generateInsights = useCallback(async (useCustomPrompt = false) => {
    console.log('🚀 GENERATE INSIGHTS FUNCTION CALLED')
    console.log('🔍 AI Debug - Starting insight generation')
    console.log('📊 Input context:', {
      locationId,
      locationName,
      contacts: pageData.contacts,
      opportunities: pageData.opportunities,
      conversations: pageData.conversations,
      healthScore: pageData.healthScore,
      hasLeadSources: !!pageData.leadSources,
      useCustomPrompt,
      selectedModel
    })

    // Clear existing insights to show we're working
    setInsights([])
    setError(null)
    console.log('🧹 Cleared existing insights')

    try {
      console.log('🎯 Entered try block - checking prerequisites')
      console.log('🔧 Prerequisites check:', {
        hasLocationId: !!locationId,
        hasContacts: pageData.contacts > 0,
        hasOpportunities: pageData.opportunities >= 0,
        makeAIRequestAvailable: !!makeAIRequest
      })

      // Check if we have basic data
      if (!pageData.contacts && !pageData.opportunities) {
        console.warn('⚠️ No contact/opportunity data available')
        setInsights(generateSmartFallback())
        return
      }

      // Rate limiting for free model - don't call AI more than once per 10 minutes per location
      const rateLimitKey = `ai_rate_limit_${locationId}`
      console.log('🔑 Checking rate limit for key:', rateLimitKey)

      let lastCall
      try {
        lastCall = localStorage.getItem(rateLimitKey)
        console.log('💾 Rate limit timestamp:', lastCall)
      } catch (storageError) {
        console.error('❌ localStorage error:', storageError)
        lastCall = null
      }

      if (lastCall) {
        const timeSinceLastCall = Date.now() - parseInt(lastCall)
        const rateLimitWindow = 10 * 60 * 1000 // 10 minutes
        const isRateLimited = timeSinceLastCall < rateLimitWindow

        console.log('⏱️ Rate limit check:', {
          timeSinceLastCall: Math.round(timeSinceLastCall / 1000),
          limitSeconds: rateLimitWindow / 1000,
          isLimited: isRateLimited,
          lastCallTimestamp: new Date(parseInt(lastCall)).toISOString()
        })

        if (isRateLimited) {
          console.log('🚫 RATE LIMITED - will use cache or fallback')
          // Check cache directly
          const cacheKey = `ai_insights_${locationId}`
          const cached = localStorage.getItem(cacheKey)
          const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`)

          console.log('💾 Cache check:', { hasCache: !!cached, hasTimestamp: !!cacheTimestamp })

          if (cached && cacheTimestamp) {
            const cacheAge = Date.now() - parseInt(cacheTimestamp)
            const maxAge = 2 * 60 * 60 * 1000 // 2 hours
            const isCacheFresh = cacheAge < maxAge

            console.log('📅 Cache age check:', {
              cacheAgeMinutes: Math.round(cacheAge / (1000 * 60)),
              maxAgeHours: maxAge / (1000 * 60 * 60),
              isFresh: isCacheFresh
            })

            if (isCacheFresh) {
              console.log('📋 USING CACHED INSIGHTS - rate limited')
              try {
                const parsedInsights = JSON.parse(cached)
                if (Array.isArray(parsedInsights) && parsedInsights.length > 0) {
                  setInsights(parsedInsights)
                  setLastUpdated(new Date(parseInt(cacheTimestamp)))
                  console.log('✅ Successfully loaded cached insights (rate limited):', parsedInsights.length, 'insights')
                  console.log('📊 Cached insights preview:', parsedInsights.slice(0, 2))
                  return
                } else {
                  console.log('⚠️ Cached insights array is empty or invalid')
                }
              } catch (error) {
                console.error('❌ Error parsing cached insights:', error)
              }
            } else {
              console.log('⏰ Cache expired, will use fallback')
            }
          } else {
            console.log('📭 No cache available')
          }

          // No valid cache, use smart fallback
          console.log('🎯 USING SMART FALLBACK - no valid cache available')
          const fallbackInsights = generateSmartFallback()
          setInsights(fallbackInsights)
          console.log('📊 Generated fallback insights:', fallbackInsights.length)
          return
        }
      } else {
        console.log('✅ No previous calls - not rate limited, proceeding with AI generation')
      }

      // Check cache first - reuse the same logic as loadCachedInsights
      const cacheKey = `ai_insights_${locationId}`
      const cached = localStorage.getItem(cacheKey)
      const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`)

      console.log('💾 Cache check in generateInsights:', { hasCache: !!cached, hasTimestamp: !!cacheTimestamp })

      // Use cache if it's less than 2 hours old (free model - conserve API calls)
      if (cached && cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp)
        const maxAge = 2 * 60 * 60 * 1000 // 2 hours
        console.log('📅 Cache age check:', { cacheAge: Math.round(cacheAge / 1000 / 60), maxAge: Math.round(maxAge / 1000 / 60), isFresh: cacheAge < maxAge })

        if (cacheAge < maxAge) {
          console.log('📋 Using cached insights - no API call needed')
          try {
            const parsedInsights = JSON.parse(cached)
            if (Array.isArray(parsedInsights) && parsedInsights.length > 0) {
              setInsights(parsedInsights)
              setLastUpdated(new Date(parseInt(cacheTimestamp)))
              console.log('✅ Successfully loaded cached insights from button click:', parsedInsights.length, 'insights')
              return
            } else {
              console.log('⚠️ Cached insights are empty, will generate new ones')
            }
          } catch (error) {
            console.error('❌ Error parsing cached insights:', error)
            // Clear corrupted cache
            localStorage.removeItem(cacheKey)
            localStorage.removeItem(`${cacheKey}_timestamp`)
          }
        } else {
          console.log('⏰ Cache expired - will make API call')
        }
      } else {
        console.log('📭 No cache found - will make API call')
      }

      // PASSED RATE LIMITING - proceeding with AI generation
      console.log('✅ PASSED all checks - proceeding with AI insight generation')

      // Generate comprehensive prompt with rich context
      const prompt = useCustomPrompt && customPrompt.trim()
        ? customPrompt.trim()
        : generateEnhancedPrompt()

      console.log('📝 Generated prompt:', prompt ? `Length: ${prompt.length}, Preview: "${prompt.substring(0, 150)}..."` : 'EMPTY PROMPT')

      if (!prompt || prompt.length === 0) {
        throw new Error('No prompt generated - cannot make AI request')
      }

      // Validate prompt has minimum content
      if (prompt.length < 50) {
        throw new Error(`Prompt too short (${prompt.length} chars) - insufficient context for AI`)
      }

      console.log('🚀 Making AI API request with config:', {
        endpoint: '/api/ai/coach',
        model: selectedModel,
        promptLength: prompt.length,
        workspaceId: null, // Locations are global, no workspace context needed
        hasAnalyticsData: !!analytics,
        useCustomPrompt
      })

      const { response, responseText } = await callAIWithRetry(prompt)

      console.log('📡 AI API call completed, processing response')
      console.log('📄 Raw response received, length:', responseText?.length || 0)

      // Check if responseText is valid
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('AI service returned empty response')
      }

      let data
      try {
        data = JSON.parse(responseText)
        console.log('✅ Successfully parsed JSON response')
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError)
        console.error('❌ Raw response text (first 500 chars):', responseText.substring(0, 500))
        throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`)
      }

      // Check if data is valid and has expected structure
      if (data === null || data === undefined || typeof data !== 'object') {
        console.error('❌ Invalid data structure:', data, 'Type:', typeof data)
        throw new Error('AI service returned invalid data structure')
      }

      // Check if this is an API error response
      if (data.error) {
        console.error('❌ API Error Response:', data.error, data.message)
        throw new Error(data.message || data.error || 'AI coach API error')
      }

      console.log('📊 Response data structure:', {
        hasReply: !!data.reply,
        hasResponse: !!data.response,
        hasError: !!data.error,
        keys: Object.keys(data)
      })

      const aiResponse = data.reply || data.response || ''
      console.log('🤖 AI response text:', aiResponse ? `Length: ${aiResponse.length}, Preview: "${aiResponse.substring(0, 200)}..."` : 'EMPTY')

      if (!aiResponse || aiResponse.trim().length === 0) {
        console.warn('⚠️ AI returned empty response')
        throw new Error('AI service returned empty response')
      }

      const aiInsights = parseAIResponse(aiResponse)
      console.log('🧠 Successfully parsed AI insights:', {
        count: aiInsights.length,
        types: aiInsights.map(i => i.type),
        titles: aiInsights.map(i => i.title)
      })

      if (aiInsights.length === 0) {
        console.warn('⚠️ AI response parsed but no valid insights generated')
        throw new Error('AI response parsing resulted in no insights')
      }

      localStorage.setItem(cacheKey, JSON.stringify(aiInsights))
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
      localStorage.setItem(`ai_rate_limit_${locationId}`, Date.now().toString())

      console.log('💾 Cached insights and updated rate limit')
      setInsights(aiInsights)
      setLastUpdated(new Date())
      console.log('✅ Successfully updated UI with AI insights')

    } catch (err) {
      console.error('💥 AI Generation failed:', err)
      console.error('💥 Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : 'No stack trace',
        type: err?.constructor?.name || 'Unknown',
        timestamp: new Date().toISOString()
      })

      // Generate smart fallback insights instead of empty array
      const fallbackInsights = generateSmartFallback()
      console.log('🎯 Using smart fallback insights:', fallbackInsights.length, 'insights')

      setInsights(fallbackInsights)
      setError(err instanceof Error ? err.message : 'AI service temporarily unavailable')
      setLastUpdated(null) // Don't show stale timestamp for fallback
    }
  }, [locationId, locationName, pageData, analytics, selectedModel, customPrompt, isUsingCustomPrompt, generateEnhancedPrompt, parseAIResponse, callAIWithRetry, generateSmartFallback])

  // Load cached insights on component mount
  const loadCachedInsights = useCallback((): boolean => {
    try {
      const cacheKey = `ai_insights_${locationId}`
      const cached = localStorage.getItem(cacheKey)
      const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`)

      if (cached && cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours

        if (cacheAge < maxAge) {
          const parsedInsights = JSON.parse(cached)
          if (Array.isArray(parsedInsights) && parsedInsights.length > 0) {
            setInsights(parsedInsights)
            setLastUpdated(new Date(parseInt(cacheTimestamp)))
            console.log('✅ Loaded cached insights on mount:', parsedInsights.length, 'insights')
            return true
          }
        }
      }
    } catch (error) {
      console.error('Error loading cached insights:', error)
    }
    return false
  }, [locationId])

  // Initialize welcome message
  useEffect(() => {
    if (locationId && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm your AI location analyst for ${locationName}. I can help you understand your business performance with ${pageData.contacts || 0} contacts, ${pageData.opportunities || 0} opportunities, and ${pageData.healthScore || 0}% health score.

Ask me questions like:
• "How is our lead generation performing?"
• "What are our biggest opportunities?"
• "Why is the health score ${pageData.healthScore}%?"
• "How can we improve conversion rates?"

All my insights are based only on ${locationName}'s data.`,
        timestamp: new Date()
      }
      setMessages([welcomeMessage])
      console.log('💬 Welcome message initialized for:', locationName)
    }
  }, [locationId, locationName, messages.length, pageData.contacts, pageData.opportunities, pageData.healthScore])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Legacy cache loading (kept for backward compatibility)
  useEffect(() => {
    if (locationId && insights.length === 0) {
      const cacheLoaded = loadCachedInsights()
      console.log('💾 Legacy cache load result:', cacheLoaded)
    }
  }, [locationId, insights.length, loadCachedInsights])

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'performance':
        return <TrendingUp className="h-4 w-4" />
      case 'opportunity':
        return <Target className="h-4 w-4" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />
      case 'recommendation':
        return <Lightbulb className="h-4 w-4" />
      default:
        return <Brain className="h-4 w-4" />
    }
  }

  const getInsightColor = (type: AIInsight['type'], priority: AIInsight['priority']) => {
    const baseColors = {
      performance: 'blue',
      opportunity: 'green',
      warning: 'red',
      recommendation: 'purple'
    }

    const color = baseColors[type] || 'gray'

    if (priority === 'high') {
      return `border-${color}-500 bg-${color}-50`
    } else if (priority === 'medium') {
      return `border-${color}-300 bg-${color}-25`
    } else {
      return `border-${color}-200 bg-${color}-10`
    }
  }

  const getPriorityBadge = (priority: AIInsight['priority']) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    }

    return (
      <Badge variant="secondary" className={`text-xs ${colors[priority]}`}>
        {priority.toUpperCase()}
      </Badge>
    )
  }

  console.log('🔄 LocationAIInsights render:', {
    isLoading,
    insightsCount: insights.length,
    hasError: !!error,
    lastUpdated: lastUpdated?.toISOString()
  })

  if (isLoading) {
    console.log('⏳ Showing loading state')
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500 animate-pulse" />
            AI-Powered Location Insights
          </CardTitle>
          <CardDescription>
            Analyzing {locationName} data with AI to provide actionable insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
              <span className="text-sm text-muted-foreground">
                Generating AI insights for {locationName}...
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertTriangle className="h-5 w-5" />
            AI Insights Unavailable
          </CardTitle>
          <CardDescription className="text-red-700">
            Unable to generate AI insights for {locationName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              onClick={() => generateInsights(isUsingCustomPrompt)}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  console.log('📄 Rendering normal component state')
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-purple-500" />
              AI Location Assistant - {locationName}
            </CardTitle>
            <CardDescription>
              Chat with AI about {locationName}'s performance: {pageData.contacts || 0} contacts, {pageData.opportunities || 0} opportunities, {pageData.healthScore || 0}% health score
              {(pageData.contacts || 0) === 0 && (pageData.opportunities || 0) === 0 && (pageData.conversations || 0) === 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                  ⚠️ Zero Activity - Action Required
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lastUpdated && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Updated {lastUpdated.toLocaleTimeString()}</span>
                {insights.some(insight => insight.title !== 'Current Performance Overview' && insight.title !== 'Ready for AI Analysis') && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800">
                    AI Generated
                  </span>
                )}
              </div>
            )}
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="Select AI Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🤖 Auto (Recommended - Gemini → Claude fallback)</SelectItem>
                <SelectItem value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Free)</SelectItem>
                <SelectItem value="gemini-1.5-flash">🚀 Gemini 1.5 Flash (Free)</SelectItem>
                <SelectItem value="gemini-2.0-flash-lite">💡 Gemini 2.0 Flash-Lite (Free)</SelectItem>
                <SelectItem value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Paid)</SelectItem>
                <SelectItem value="gemini-2.5-flash">⭐ Gemini 2.5 Flash (Paid)</SelectItem>
                <div className="border-t my-1"></div>
                <SelectItem value="claude-3.5-sonnet">🧠 Claude 3.5 Sonnet (OpenRouter)</SelectItem>
                <SelectItem value="claude-3-haiku">⚡ Claude 3 Haiku (OpenRouter)</SelectItem>
                <SelectItem value="openrouter-free">🔄 OpenRouter Auto (Free Models)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              variant="outline"
              size="sm"
            >
              {showPromptEditor ? 'Hide' : 'Show'} Prompt
            </Button>
            <Button
              onClick={() => {
                console.log('🗑️ Clear chat button clicked')
                // Reset conversation to welcome message
                const welcomeMessage: ChatMessage = {
                  id: 'welcome-' + Date.now(),
                  role: 'assistant',
                  content: `Hello! I'm your AI location analyst for ${locationName}. I can help you understand your business performance with ${pageData.contacts || 0} contacts, ${pageData.opportunities || 0} opportunities, and ${pageData.healthScore || 0}% health score.

Ask me questions like:
• "How is our lead generation performing?"
• "What are our biggest opportunities?"
• "Why is the health score ${pageData.healthScore}%?"
• "How can we improve conversion rates?"

All my insights are based only on ${locationName}'s data.`,
                  timestamp: new Date()
                }
                setMessages([welcomeMessage])
                setError(null)
              }}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              New Conversation
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Prompt Editor */}
      {showPromptEditor && (
        <div className="px-6 pb-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <label className="text-sm font-medium">AI Analysis Prompt</label>
              <Badge variant="secondary" className="text-xs">
                {isUsingCustomPrompt ? 'Custom' : 'Auto-Generated'}
              </Badge>
            </div>

            <textarea
              value={customPrompt || generateEnhancedPrompt()}
              onChange={(e) => {
                setCustomPrompt(e.target.value)
                setIsUsingCustomPrompt(e.target.value !== generateEnhancedPrompt())
              }}
              placeholder="Enter your custom analysis prompt..."
              className="w-full h-32 p-3 text-sm border rounded-md resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isLoading}
            />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>• Use specific metrics from {locationName}&apos;s data</span>
              <span>• Ask for JSON-formatted insights</span>
              <span>• Include actionable recommendations</span>
            </div>

            {customPrompt !== generateEnhancedPrompt() && customPrompt.trim() && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setCustomPrompt('')
                    setIsUsingCustomPrompt(false)
                  }}
                  variant="outline"
                  size="sm"
                >
                  Reset to Default
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      <CardContent className="p-0">
        <div className="flex flex-col h-96">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : message.role === 'assistant'
                      ? 'bg-gray-100 text-gray-900 border'
                      : 'bg-yellow-100 text-yellow-900 border border-yellow-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'user' ? (
                      <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Brain className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={`Ask about ${locationName}'s performance...`}
                className="flex-1 min-h-[60px] resize-none"
                disabled={isTyping}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isTyping}
                className="px-4"
              >
                {isTyping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <div className="flex items-center gap-2">
                <span>{locationName} • {pageData.contacts || 0} contacts</span>
                <Badge variant="outline" className="text-xs">
                  {pageData.healthScore || 0}% health
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}