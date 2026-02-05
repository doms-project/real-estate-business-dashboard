// Trends Analysis API Endpoint
// Provides advanced trend analysis and pattern recognition

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/trends - Get trend analysis for locations
 * Query params: locationId, metric (revenue|leads|conversion), period (30|90|180)
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

    if (!supabaseAdmin!) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const metric = searchParams.get('metric') || 'revenue'
    const period = parseInt(searchParams.get('period') || '30')

    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId is required' },
        { status: 400 }
      )
    }

    // Try to get cached trends first
    const { data: cachedTrends } = await supabaseAdmin!
      .from('predictive_cache')
      .select('cache_data')
      .eq('location_id', locationId)
      .eq('cache_type', 'trend')
      .eq('cache_key', `${metric}_${period}`)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (cachedTrends) {
      return NextResponse.json({
        success: true,
        data: cachedTrends.cache_data,
        cached: true
      })
    }

    // Generate new trend analysis
    const trends = await analyzeTrends(locationId, metric, period)

    // Cache the result
    if (trends) {
      await supabaseAdmin!
        .from('predictive_cache')
        .upsert({
          location_id: locationId,
          cache_type: 'trend',
          cache_key: `${metric}_${period}`,
          cache_data: trends,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
        })
    }

    return NextResponse.json({
      success: true,
      data: trends,
      cached: false
    })

  } catch (error: any) {
    console.error('Error in trends API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Analyze trends for a specific metric
async function analyzeTrends(locationId: string, metric: string, period: number): Promise<any> {
  try {
    // Get historical data
    const { data: history, error } = await supabaseAdmin!
      .from('agency_health_scores')
      .select('*')
      .eq('location_id', locationId)
      .order('calculated_at', { ascending: true })
      .limit(Math.max(period, 90)) // Ensure we have enough data

    if (error || !history || history.length < 7) {
      return generateBasicTrends(metric, period)
    }

    // Extract metric values
    const metricKey = getMetricKey(metric)
    const data = history.map((h, i) => ({
      date: new Date(h.calculated_at),
      value: h[metricKey as keyof typeof h] as number || 0,
      index: i
    })).filter(d => d.value > 0)

    if (data.length < 7) {
      return generateBasicTrends(metric, period)
    }

    // Calculate various trend metrics
    const linearTrend = calculateLinearTrend(data)
    const movingAverages = calculateMovingAverages(data, [7, 14, 30])
    const volatility = calculateVolatility(data.map(d => d.value))
    const seasonality = detectSeasonality(data)
    const changePoints = detectChangePoints(data)
    const momentum = calculateMomentum(data, 7)

    // Generate trend classification
    const trendDirection = linearTrend.slope > 0.1 ? 'increasing' :
                          linearTrend.slope < -0.1 ? 'decreasing' : 'stable'

    const trendStrength = Math.abs(linearTrend.slope) * linearTrend.r2 * 100

    // Calculate performance vs expectations
    const benchmarkComparison = await calculateBenchmarkComparison(locationId, metric, data)

    return {
      trend: {
        direction: trendDirection,
        strength: Math.round(trendStrength * 100) / 100,
        slope: Math.round(linearTrend.slope * 100) / 100,
        r2: Math.round(linearTrend.r2 * 100) / 100,
        confidence: Math.round(linearTrend.confidence * 100) / 100
      },
      movingAverages,
      volatility: Math.round(volatility * 100) / 100,
      seasonality,
      changePoints,
      momentum,
      benchmarkComparison,
      period,
      metric,
      dataPoints: data.length,
      analysis: generateTrendAnalysis(trendDirection, trendStrength, volatility, seasonality, metric),
      recommendations: generateTrendRecommendations(trendDirection, changePoints, seasonality, metric)
    }

  } catch (error) {
    console.error('Error analyzing trends:', error)
    return generateBasicTrends(metric, period)
  }
}

// Get the appropriate database column for a metric
function getMetricKey(metric: string): string {
  const mappings: Record<string, string> = {
    revenue: 'current_revenue',
    leads: 'total_leads',
    conversion: 'conversion_rate',
    deals: 'total_deals',
    health: 'overall_score',
    utilization: 'agent_utilization_rate',
    satisfaction: 'customer_rating'
  }
  return mappings[metric] || 'overall_score'
}

// Calculate linear trend using least squares regression
function calculateLinearTrend(data: { index: number, value: number }[]): any {
  const n = data.length
  const sumX = data.reduce((sum, d) => sum + d.index, 0)
  const sumY = data.reduce((sum, d) => sum + d.value, 0)
  const sumXY = data.reduce((sum, d) => sum + d.index * d.value, 0)
  const sumXX = data.reduce((sum, d) => sum + d.index * d.index, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R-squared
  const yMean = sumY / n
  const ssRes = data.reduce((sum, d) => sum + Math.pow(d.value - (slope * d.index + intercept), 2), 0)
  const ssTot = data.reduce((sum, d) => sum + Math.pow(d.value - yMean, 2), 0)
  const r2 = 1 - (ssRes / ssTot)

  // Calculate confidence (simplified)
  const confidence = Math.min(1, Math.max(0, r2 * (1 - Math.abs(slope) * 0.1)))

  return { slope, intercept, r2, confidence }
}

// Calculate moving averages
function calculateMovingAverages(data: { value: number }[], periods: number[]): Record<string, number[]> {
  const result: Record<string, number[]> = {}

  periods.forEach(period => {
    const averages: number[] = []
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1)
      const average = slice.reduce((sum, d) => sum + d.value, 0) / period
      averages.push(Math.round(average * 100) / 100)
    }
    result[`ma_${period}`] = averages
  })

  return result
}

// Calculate volatility (coefficient of variation)
function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  return mean > 0 ? stdDev / mean : 0
}

// Detect seasonality (simplified weekly pattern detection)
function detectSeasonality(data: { date: Date, value: number }[]): any {
  if (data.length < 14) return { detected: false }

  // Group by day of week
  const weeklyPattern: Record<number, number[]> = {}
  data.forEach(d => {
    const dayOfWeek = d.date.getDay()
    if (!weeklyPattern[dayOfWeek]) weeklyPattern[dayOfWeek] = []
    weeklyPattern[dayOfWeek].push(d.value)
  })

  // Calculate average for each day
  const dayAverages = Object.entries(weeklyPattern).map(([day, values]) => ({
    day: parseInt(day),
    average: values.reduce((sum, v) => sum + v, 0) / values.length,
    count: values.length
  }))

  const overallAverage = data.reduce((sum, d) => sum + d.value, 0) / data.length
  const maxDeviation = Math.max(...dayAverages.map(d => Math.abs(d.average - overallAverage)))

  return {
    detected: maxDeviation > overallAverage * 0.15, // 15% deviation threshold
    pattern: dayAverages.sort((a, b) => a.day - b.day),
    strength: maxDeviation / overallAverage
  }
}

// Detect significant change points
function detectChangePoints(data: { value: number }[]): any[] {
  const changes = []
  const threshold = 0.2 // 20% change threshold

  for (let i = 1; i < data.length; i++) {
    const change = (data[i].value - data[i - 1].value) / data[i - 1].value
    if (Math.abs(change) > threshold) {
      changes.push({
        index: i,
        change: Math.round(change * 10000) / 100,
        direction: change > 0 ? 'increase' : 'decrease'
      })
    }
  }

  return changes
}

// Calculate momentum (rate of change over recent period)
function calculateMomentum(data: { value: number }[], period: number): any {
  if (data.length < period * 2) return { value: 0, direction: 'stable' }

  const recent = data.slice(-period)
  const previous = data.slice(-period * 2, -period)

  const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / period
  const previousAvg = previous.reduce((sum, d) => sum + d.value, 0) / period

  const momentum = ((recentAvg - previousAvg) / previousAvg) * 100

  return {
    value: Math.round(momentum * 100) / 100,
    direction: momentum > 5 ? 'accelerating' :
               momentum < -5 ? 'decelerating' : 'stable'
  }
}

// Calculate benchmark comparison
async function calculateBenchmarkComparison(
  locationId: string,
  metric: string,
  data: { value: number }[]
): Promise<any> {
  try {
    // Get all locations' recent performance for this metric
    const metricKey = getMetricKey(metric)
    const { data: benchmarks, error } = await supabaseAdmin!
      .from('agency_health_scores')
      .select(`${metricKey}, location_id`)
      .order('calculated_at', { ascending: false })
      .limit(1000) // Recent records

    if (error || !benchmarks) return { available: false }

    // Group by location and get latest value
    const locationLatest: Record<string, number> = {}
    benchmarks.forEach((b: any) => {
      const locationId = b.location_id
      const value = b[metricKey]
      if (typeof value === 'number' && (!locationLatest[locationId] || value > locationLatest[locationId])) {
        locationLatest[locationId] = value
      }
    })

    const values = Object.values(locationLatest).filter(v => v > 0).sort((a, b) => a - b)
    const currentValue = data[data.length - 1]?.value || 0

    if (values.length === 0) return { available: false }

    // Calculate percentile
    let rank = 0
    for (const value of values) {
      if (currentValue >= value) rank++
      else break
    }

    const percentile = Math.round((rank / values.length) * 100)
    const median = values[Math.floor(values.length / 2)]

    return {
      available: true,
      percentile,
      median,
      totalLocations: values.length,
      rank: rank,
      status: percentile >= 75 ? 'above_average' :
              percentile >= 50 ? 'average' :
              percentile >= 25 ? 'below_average' : 'needs_improvement'
    }
  } catch (error) {
    return { available: false }
  }
}

// Generate trend analysis insights
function generateTrendAnalysis(
  direction: string,
  strength: number,
  volatility: number,
  seasonality: any,
  metric: string
): string[] {
  const insights = []

  // Direction analysis
  if (direction === 'increasing') {
    insights.push(`Positive trend detected with ${strength.toFixed(1)}% trend strength`)
  } else if (direction === 'decreasing') {
    insights.push(`Negative trend detected with ${strength.toFixed(1)}% trend strength`)
  } else {
    insights.push('Stable performance with minimal directional change')
  }

  // Volatility analysis
  if (volatility > 0.3) {
    insights.push(`High volatility (${(volatility * 100).toFixed(1)}%) indicates inconsistent performance`)
  } else if (volatility > 0.15) {
    insights.push(`Moderate volatility (${(volatility * 100).toFixed(1)}%) suggests some variability`)
  } else {
    insights.push(`Low volatility (${(volatility * 100).toFixed(1)}%) indicates stable performance`)
  }

  // Seasonality analysis
  if (seasonality.detected) {
    insights.push(`Seasonal patterns detected with ${(seasonality.strength * 100).toFixed(1)}% weekly variation`)
  }

  return insights
}

// Generate trend-based recommendations
function generateTrendRecommendations(
  direction: string,
  changePoints: any[],
  seasonality: any,
  metric: string
): string[] {
  const recommendations = []

  if (direction === 'decreasing' && changePoints.length > 0) {
    recommendations.push('Immediate action needed to reverse declining trend')
  }

  if (changePoints.length > 2) {
    recommendations.push('Multiple significant changes detected - investigate root causes')
  }

  if (seasonality.detected) {
    recommendations.push('Consider seasonal adjustments to marketing and operations')
  }

  // Metric-specific recommendations
  switch (metric) {
    case 'revenue':
      if (direction === 'decreasing') {
        recommendations.push('Implement lead generation campaigns and pipeline building activities')
      }
      break
    case 'leads':
      if (direction === 'decreasing') {
        recommendations.push('Review and optimize lead sources and marketing channels')
      }
      break
    case 'conversion':
      if (direction === 'decreasing') {
        recommendations.push('Focus on sales training and follow-up processes')
      }
      break
  }

  return recommendations
}

// Generate basic trends when insufficient data
function generateBasicTrends(metric: string, period: number): any {
  return {
    trend: {
      direction: 'insufficient_data',
      strength: 0,
      slope: 0,
      r2: 0,
      confidence: 0
    },
    movingAverages: {},
    volatility: 0,
    seasonality: { detected: false },
    changePoints: [],
    momentum: { value: 0, direction: 'stable' },
    benchmarkComparison: { available: false },
    period,
    metric,
    dataPoints: 0,
    analysis: [`Insufficient data for ${metric} trend analysis`],
    recommendations: ['Continue collecting performance data for trend analysis']
  }
}