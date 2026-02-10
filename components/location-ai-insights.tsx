"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Brain, TrendingUp, Target, AlertTriangle, Lightbulb, Loader2, RefreshCw } from "lucide-react"
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

export function LocationAIInsights({ locationId, locationName, analytics, pageData }: LocationAIInsightsProps) {
  console.log('🎯 LocationAIInsights component rendered for:', locationName, locationId)

  const { currentWorkspace } = useWorkspace()

  const [insights, setInsights] = useState<AIInsight[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [isUsingCustomPrompt, setIsUsingCustomPrompt] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('openrouter-free')

  // Use AI coordinator for rate limiting
  const { makeAIRequest, isLoading } = useAICoordinator(`LocationAIInsights-${locationId}`)
  console.log('🤖 AI Coordinator initialized:', { isLoading, hasMakeAIRequest: !!makeAIRequest })

  // Generate the default prompt based on location data
  const generateDefaultPrompt = useCallback(() => {
    console.log('📊 generateDefaultPrompt called with pageData:', {
      contacts: pageData.contacts,
      opportunities: pageData.opportunities,
      conversations: pageData.conversations,
      healthScore: pageData.healthScore,
      leadSources: pageData.leadSources
    })

    const keyMetrics = {
      contacts: pageData.contacts || 0,
      opportunities: pageData.opportunities || 0,
      conversations: pageData.conversations || 0,
      healthScore: pageData.healthScore || 0,
      topSource: pageData.leadSources?.sources?.[0]?.source || 'None',
      topSourcePct: pageData.leadSources?.sources?.[0]?.percentage || 0
    }

    return `Analyze ${locationName}: ${keyMetrics.contacts} contacts, ${keyMetrics.opportunities} opps, ${keyMetrics.healthScore}% health, top source: ${keyMetrics.topSource} (${keyMetrics.topSourcePct}%).

Return 2-3 insights as JSON array:
[{"type":"performance/opportunity/warning/recommendation","title":"Brief title","description":"1 sentence with numbers","priority":"high/medium/low","metrics":["key","metrics"]}]`
  }, [locationName, pageData.contacts, pageData.opportunities, pageData.conversations, pageData.healthScore, pageData.leadSources])

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

    // Minimal fallback for free model limits
    return [{
      type: 'performance' as const,
      title: 'Performance Summary',
      description: `${locationName}: ${pageData.contacts || 0} contacts, ${pageData.healthScore || 0}% health.`,
      priority: 'medium' as const,
      metrics: ['contacts', 'healthScore']
    }]
  }, [locationName, pageData.contacts, pageData.healthScore])

  const generateInsights = useCallback(async (useCustomPrompt = false) => {
    console.log('🔍 LocationAIInsights: generateInsights called with useCustomPrompt:', useCustomPrompt)
    setError(null)

    try {
      console.log('🎯 Entered try block - about to check rate limiting')

      // Rate limiting for free model - don't call AI more than once per 10 minutes per location
      const rateLimitKey = `ai_rate_limit_${locationId}`
      console.log('🔑 Checking localStorage for rate limit key:', rateLimitKey)

      let lastCall
      try {
        lastCall = localStorage.getItem(rateLimitKey)
        console.log('💾 localStorage access successful, lastCall:', lastCall)
      } catch (storageError) {
        console.error('❌ localStorage error:', storageError)
        lastCall = null
      }
      if (lastCall) {
        const timeSinceLastCall = Date.now() - parseInt(lastCall)
        console.log('⏱️ Rate limit check:', { timeSinceLastCall, limit: 10 * 60 * 1000, isLimited: timeSinceLastCall < (10 * 60 * 1000) })
        if (timeSinceLastCall < (10 * 60 * 1000)) { // 10 minutes
          console.log('🚫 Rate limited - using cache or fallback')
          // Use cache or fallback without AI call
        }
      } else {
        console.log('✅ No previous calls - not rate limited')
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

      // Use custom prompt if provided, otherwise generate default
      const prompt = useCustomPrompt && customPrompt.trim()
        ? customPrompt.trim()
        : generateDefaultPrompt()

      console.log('📝 Generated prompt:', prompt ? prompt.substring(0, 100) + '...' : 'EMPTY PROMPT')
      console.log('🚀 LocationAIInsights: About to make API request to /api/ai/coach')
      console.log('📝 Prompt length:', prompt.length, 'Model:', selectedModel)
      console.log('🔑 Making actual API call now...')

      if (!prompt || prompt.length === 0) {
        throw new Error('No prompt generated - cannot make AI request')
      }

      console.log('🔧 Calling makeAIRequest function...')
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
            workspaceId: currentWorkspace?.id || null,
            pageData: {
              locationId,
              locationName,
              analytics,
              contacts: pageData.contacts,
              opportunities: pageData.opportunities,
              conversations: pageData.conversations,
              healthScore: pageData.healthScore,
              leadSources: pageData.leadSources
            }
          })
        })
      })

      console.log('📡 Received response from AI API')

      if (!response.ok) {
        console.error('❌ AI API response not ok:', response.status, response.statusText)
        throw new Error('Failed to generate AI insights')
      }

      console.log('✅ AI API response OK, parsing JSON...')
      const data = await response.json()
      console.log('📄 Parsed AI response data')

      const aiInsights = parseAIResponse(data.reply || data.response || '')
      console.log('🧠 Parsed AI insights:', aiInsights.length, 'insights')

      localStorage.setItem(cacheKey, JSON.stringify(aiInsights))
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
      localStorage.setItem(`ai_rate_limit_${locationId}`, Date.now().toString())

      console.log('💾 Cached insights and updated rate limit')
      setInsights(aiInsights)
      setLastUpdated(new Date())
      console.log('✅ Successfully updated UI with AI insights')

    } catch (err) {
      console.error('Error generating AI insights:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate insights')
      // Simplified fallback for now
      setInsights([])
    }
  }, [locationId, customPrompt, generateDefaultPrompt, parseAIResponse, pageData.contacts, pageData.opportunities, pageData.healthScore, pageData.leadSources.sources, locationName, makeAIRequest])

  // Load cached insights on component mount
  const loadCachedInsights = useCallback(() => {
    try {
      const cacheKey = `ai_insights_${locationId}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsedCache = JSON.parse(cached)
        if (parsedCache.timestamp && Date.now() - parsedCache.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
          setInsights(parsedCache.insights)
        }
      }
    } catch (error) {
      console.error('Error loading cached insights:', error)
    }
  }, [locationId])

  useEffect(() => {
    if (locationId && insights.length === 0) {
      loadCachedInsights()
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

  if (isLoading) {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI-Powered Location Insights
            </CardTitle>
            <CardDescription>
              Intelligent analysis of {locationName} performance and opportunities
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
                console.log('🖱️ Generate AI Insights button clicked')
                generateInsights(isUsingCustomPrompt)
              }}
              variant="default"
              size="sm"
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Brain className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
              {isLoading ? 'Generating AI Insights...' : lastUpdated ? 'Refresh AI Insights' : 'Generate AI Insights'}
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
              value={customPrompt || generateDefaultPrompt()}
              onChange={(e) => {
                setCustomPrompt(e.target.value)
                setIsUsingCustomPrompt(e.target.value !== generateDefaultPrompt())
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

            {customPrompt !== generateDefaultPrompt() && customPrompt.trim() && (
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
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getInsightColor(insight.type, insight.priority)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getInsightIcon(insight.type)}
                  <h4 className="font-medium text-sm">{insight.title}</h4>
                </div>
                {getPriorityBadge(insight.priority)}
              </div>
              <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
              {insight.metrics && insight.metrics.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {insight.metrics.map((metric, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {metric}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}

          {insights.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No AI insights available yet.</p>
              <p className="text-sm">Try refreshing to generate new insights.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}