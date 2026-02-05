"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Brain, TrendingUp, Target, AlertTriangle, Lightbulb, Loader2, RefreshCw } from "lucide-react"
import { useAICoordinator } from "@/hooks/use-ai-coordinator"

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
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [isUsingCustomPrompt, setIsUsingCustomPrompt] = useState(false)

  // Use AI coordinator for rate limiting
  const { makeAIRequest, isLoading } = useAICoordinator(`LocationAIInsights-${locationId}`)

  // Generate the default prompt based on location data
  const generateDefaultPrompt = useCallback(() => {
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
  }, [locationName, pageData.contacts, pageData.opportunities, pageData.healthScore, pageData.leadSources])

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
    setError(null)

    try {
      // Rate limiting for free model - don't call AI more than once per 10 minutes per location
      const rateLimitKey = `ai_rate_limit_${locationId}`
      const lastCall = localStorage.getItem(rateLimitKey)
      if (lastCall) {
        const timeSinceLastCall = Date.now() - parseInt(lastCall)
        if (timeSinceLastCall < (10 * 60 * 1000)) { // 10 minutes
          console.log('Rate limited - using cache or fallback')
          // Use cache or fallback without AI call
        }
      }

      // Check cache first
      const cacheKey = `ai_insights_${locationId}`
      const cached = localStorage.getItem(cacheKey)
      const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`)

      // Use cache if it's less than 2 hours old (free model - conserve API calls)
      if (cached && cacheTimestamp) {
        const cacheAge = Date.now() - parseInt(cacheTimestamp)
        if (cacheAge < (2 * 60 * 60 * 1000)) { // 2 hours for free model
          const parsedInsights = JSON.parse(cached)
          setInsights(parsedInsights)
          setLastUpdated(new Date(parseInt(cacheTimestamp)))
          return
        }
      }

      // Use custom prompt if provided, otherwise generate default
      const prompt = useCustomPrompt && customPrompt.trim()
        ? customPrompt.trim()
        : generateDefaultPrompt()

      const response = await makeAIRequest(() => fetch('/api/ai/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: prompt,
          pageContext: 'location-compact', // Signal compact mode
          useStreaming: false, // Disable streaming to save tokens
          requestedModel: 'gemini-2.0-flash-lite' // Use lightest model
        })
      }))

      if (!response.ok) {
        throw new Error('Failed to generate AI insights')
      }

      const data = await response.json()

      // Parse AI response into structured insights
      const aiInsights = parseAIResponse(data.reply || data.response || '')

      // Cache the insights and update rate limit
      localStorage.setItem(cacheKey, JSON.stringify(aiInsights))
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
      localStorage.setItem(`ai_rate_limit_${locationId}`, Date.now().toString())

      setInsights(aiInsights)
      setLastUpdated(new Date())

    } catch (err) {
      console.error('Error generating AI insights:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate insights')

      // Fallback to basic insights if AI fails
      setInsights([
        {
          type: 'performance',
          title: 'Current Performance Overview',
          description: `${locationName} has ${pageData.contacts || 0} contacts, ${pageData.opportunities || 0} opportunities, and ${pageData.healthScore || 0}% health score.`,
          priority: 'medium',
          metrics: ['contacts', 'opportunities', 'healthScore']
        },
        {
          type: 'recommendation',
          title: 'Focus on Lead Quality',
          description: pageData.leadSources?.sources?.length > 0
            ? `Your top lead source is ${pageData.leadSources.sources[0]?.source} generating ${pageData.leadSources.sources[0]?.percentage}%. Consider optimizing this channel.`
            : 'Analyze your lead sources to identify the most effective marketing channels.',
          priority: 'high',
          metrics: ['leadSources']
        }
      ])
    }
  }, [locationId, customPrompt, isUsingCustomPrompt, generateDefaultPrompt, parseAIResponse])

  useEffect(() => {
    if (locationId && analytics) {
      generateInsights(false) // Don't use custom prompt on initial load
    }
  }, [locationId, analytics, generateInsights])

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
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              variant="outline"
              size="sm"
            >
              {showPromptEditor ? 'Hide' : 'Show'} Prompt
            </Button>
            <Button
              onClick={() => generateInsights(isUsingCustomPrompt)}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isUsingCustomPrompt ? 'Run Custom' : 'Analyze'}
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