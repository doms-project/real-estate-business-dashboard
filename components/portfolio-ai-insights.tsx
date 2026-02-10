"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Brain, AlertTriangle, Lightbulb, Loader2, RefreshCw, Sparkles, Building2 } from "lucide-react"
import { Property } from "@/types"
import { useAICoordinator } from "@/hooks/use-ai-coordinator"

interface PortfolioAIInsightsProps {
  properties: Property[]
  portfolioMetrics: {
    totalProperties: number
    totalEstValue: number
    totalMonthlyCashflow: number
    avgROI: number
  }
}

interface AIInsight {
  insights: string
  source: 'ai' | 'fallback' | 'error'
  cached: boolean
  timestamp: number
  error?: string
  details?: string
  provider?: string
  model?: string
}

export function PortfolioAIInsights({ properties, portfolioMetrics }: PortfolioAIInsightsProps) {
  const [portfolioInsights, setPortfolioInsights] = useState<AIInsight | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [insightStyle, setInsightStyle] = useState<'conservative' | 'balanced' | 'aggressive' | 'cashflow' | 'growth'>('balanced')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Use AI coordinator for rate limiting
  const { makeAIRequest, isLoading } = useAICoordinator('PortfolioAIInsights')

  const fetchPortfolioAIInsights = useCallback(async (forceRefresh: boolean = false) => {
    if (properties.length === 0) {
      setPortfolioInsights({
        insights: "Add some properties to get AI-powered insights!",
        source: 'fallback',
        cached: false,
        timestamp: Date.now()
      })
      return
    }

    setError(null)

    try {
      const response = await makeAIRequest(() => fetch('/api/properties/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: properties.map(p => ({
            id: p.id,
            address: p.address,
            type: p.type || 'Unknown',
            status: p.status || 'Unknown',
            purchasePrice: p.purchasePrice || 0,
            currentEstValue: p.currentEstValue || 0,
            monthlyMortgagePayment: p.monthlyMortgagePayment || 0,
            monthlyInsurance: p.monthlyInsurance || 0,
            monthlyPropertyTax: p.monthlyPropertyTax || 0,
            monthlyOtherCosts: p.monthlyOtherCosts || 0,
            monthlyGrossRent: p.monthlyGrossRent || 0
          })),
          portfolioMetrics,
          forceRefresh,
          style: insightStyle
        }),
      }))

      const data = await response.json()

      if (response.ok) {
        setPortfolioInsights(data)
        setLastUpdated(new Date(data.timestamp))
      } else {
        setError(data.details || data.error || 'Failed to generate insights')
        setPortfolioInsights({
          insights: "Unable to generate AI insights at this time.",
          source: 'error',
          cached: false,
          timestamp: Date.now(),
          error: data.error,
          details: data.details
        })
      }
    } catch (err) {
      console.error('Error fetching AI insights:', err)
      setError('Network error occurred while fetching insights')
      setPortfolioInsights({
        insights: "Unable to connect to AI service. Please check your internet connection.",
        source: 'error',
        cached: false,
        timestamp: Date.now()
      })
    }
  }, [properties, portfolioMetrics, insightStyle, makeAIRequest])


  // Initialize with basic portfolio summary instead of automatic AI calls
  useEffect(() => {
    if (properties.length > 0 && !portfolioInsights) {
      // Show basic portfolio stats without AI
      const totalValue = portfolioMetrics.totalEstValue || 0
      const totalCashflow = portfolioMetrics.totalMonthlyCashflow || 0
      const avgROI = portfolioMetrics.avgROI || 0

      setPortfolioInsights({
        insights: `**Portfolio Overview:**\n\n• ${properties.length} properties in portfolio\n• Total estimated value: $${totalValue.toLocaleString()}\n• Monthly cash flow: $${totalCashflow.toLocaleString()}\n• Average ROI: ${avgROI.toFixed(1)}%\n\nClick "Analyze Portfolio" to get AI-powered insights and recommendations.`,
        source: 'fallback',
        cached: false,
        timestamp: Date.now()
      })
      setLastUpdated(new Date())
    }
  }, [properties.length, portfolioMetrics, portfolioInsights])

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai':
        return <Sparkles className="h-4 w-4 text-purple-500" />
      case 'fallback':
        return <Lightbulb className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <Brain className="h-4 w-4 text-gray-500" />
    }
  }

  const getSourceLabel = (source: string, cached: boolean) => {
    if (source === 'ai') {
      return cached ? 'AI (Cached)' : 'AI Generated'
    }
    if (source === 'fallback') return 'Basic Insights'
    if (source === 'error') return 'Error'
    return 'Unknown'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <CardTitle>AI Portfolio Insights</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={insightStyle} onValueChange={(value: any) => setInsightStyle(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservative</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
                <SelectItem value="cashflow">Cash Flow</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="default"
              size="sm"
              onClick={() => fetchPortfolioAIInsights(true)}
              disabled={isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze Portfolio
                </>
              )}
            </Button>
          </div>
        </div>
        <CardDescription>
          AI-powered analysis and recommendations for your real estate portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {portfolioInsights && (
            <div className="flex items-center gap-2 mb-4">
              {getSourceIcon(portfolioInsights.source)}
              <Badge variant={portfolioInsights.source === 'ai' ? 'default' : 'secondary'}>
                {getSourceLabel(portfolioInsights.source, portfolioInsights.cached)}
              </Badge>
              {portfolioInsights.provider && (
                <Badge variant="outline" className="text-xs">
                  {portfolioInsights.provider === 'openrouter' ? '🧠 Claude/OpenRouter' : '⚡ Gemini'}
                </Badge>
              )}
              {lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" />
                <p className="text-sm text-muted-foreground">
                  Analyzing your portfolio...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-900 dark:text-red-100">AI Insights Unavailable</span>
              </div>
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              {portfolioInsights?.details && (
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">{portfolioInsights.details}</p>
              )}
            </div>
          ) : portfolioInsights ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {portfolioInsights.insights}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Portfolio insights will appear here</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}