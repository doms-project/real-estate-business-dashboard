// Benchmarks API Endpoint
// Get benchmark comparisons for locations

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/benchmarks - Get benchmark data for locations
 * Query params: locationId, metric, period
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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const metric = searchParams.get('metric') || 'overall_score'
    const period = searchParams.get('period') || '30d'

    if (!locationId) {
      return NextResponse.json(
        { error: 'locationId is required' },
        { status: 400 }
      )
    }

    // Get benchmark data - compare this location to others
    const benchmarks = await calculateBenchmarks(locationId, metric, period)

    return NextResponse.json({
      success: true,
      data: benchmarks,
      locationId,
      metric,
      period
    })

  } catch (error: any) {
    console.error('Error in benchmarks API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Calculate benchmark data for a location
async function calculateBenchmarks(locationId: string, metric: string, period: string): Promise<any> {
  try {
    // Get current location's data
    const { data: currentData, error: currentError } = await supabaseAdmin!
      .from('agency_health_scores')
      .select('*')
      .eq('location_id', locationId)
      .order('calculated_at', { ascending: false })
      .limit(1)

    if (currentError || !currentData || currentData.length === 0) {
      return { available: false, message: 'No data available for this location' }
    }

    const currentScore = currentData[0]

    // Get all locations' recent data for comparison
    const periodStart = new Date()
    switch (period) {
      case '7d':
        periodStart.setDate(periodStart.getDate() - 7)
        break
      case '30d':
        periodStart.setDate(periodStart.getDate() - 30)
        break
      case '90d':
        periodStart.setDate(periodStart.getDate() - 90)
        break
      default:
        periodStart.setDate(periodStart.getDate() - 30)
    }

    const { data: allData, error: allError } = await supabaseAdmin!
      .from('agency_health_scores')
      .select('location_id, overall_score, financial_score, operational_score, team_score, customer_score')
      .gte('calculated_at', periodStart.toISOString())
      .order('calculated_at', { ascending: false })

    if (allError || !allData) {
      return { available: false, message: 'Unable to fetch benchmark data' }
    }

    // Group by location and get averages
    const locationAverages: Record<string, any> = {}
    allData.forEach(record => {
      if (!locationAverages[record.location_id]) {
        locationAverages[record.location_id] = {
          location_id: record.location_id,
          overall_score: [],
          financial_score: [],
          operational_score: [],
          team_score: [],
          customer_score: []
        }
      }

      if (record.overall_score !== null) locationAverages[record.location_id].overall_score.push(record.overall_score)
      if (record.financial_score !== null) locationAverages[record.location_id].financial_score.push(record.financial_score)
      if (record.operational_score !== null) locationAverages[record.location_id].operational_score.push(record.operational_score)
      if (record.team_score !== null) locationAverages[record.location_id].team_score.push(record.team_score)
      if (record.customer_score !== null) locationAverages[record.location_id].customer_score.push(record.customer_score)
    })

    // Calculate averages
    const benchmarks = Object.values(locationAverages).map((loc: any) => ({
      location_id: loc.location_id,
      overall_score: loc.overall_score.length > 0 ? loc.overall_score.reduce((a: number, b: number) => a + b, 0) / loc.overall_score.length : 0,
      financial_score: loc.financial_score.length > 0 ? loc.financial_score.reduce((a: number, b: number) => a + b, 0) / loc.financial_score.length : 0,
      operational_score: loc.operational_score.length > 0 ? loc.operational_score.reduce((a: number, b: number) => a + b, 0) / loc.operational_score.length : 0,
      team_score: loc.team_score.length > 0 ? loc.team_score.reduce((a: number, b: number) => a + b, 0) / loc.team_score.length : 0,
      customer_score: loc.customer_score.length > 0 ? loc.customer_score.reduce((a: number, b: number) => a + b, 0) / loc.customer_score.length : 0
    }))

    // Calculate percentiles and rankings
    const metricValues = benchmarks.map(b => b[metric as keyof typeof b] as number).sort((a, b) => a - b)
    const currentValue = currentScore[metric as keyof typeof currentScore] as number || 0

    let percentile = 0
    for (const value of metricValues) {
      if (currentValue >= value) percentile++
      else break
    }
    percentile = Math.round((percentile / metricValues.length) * 100)

    // Get top and bottom performers
    const sortedByMetric = benchmarks.sort((a, b) => (b[metric as keyof typeof b] as number) - (a[metric as keyof typeof a] as number))

    return {
      available: true,
      current: {
        location_id: locationId,
        value: currentValue,
        percentile
      },
      agency_average: metricValues.length > 0 ? metricValues.reduce((a, b) => a + b, 0) / metricValues.length : 0,
      top_performers: sortedByMetric.slice(0, 3).map(loc => ({
        location_id: loc.location_id,
        value: loc[metric as keyof typeof loc]
      })),
      bottom_performers: sortedByMetric.slice(-3).reverse().map(loc => ({
        location_id: loc.location_id,
        value: loc[metric as keyof typeof loc]
      })),
      total_locations: benchmarks.length,
      period,
      metric,
      status: percentile >= 75 ? 'above_average' :
              percentile >= 50 ? 'average' :
              percentile >= 25 ? 'below_average' : 'needs_improvement'
    }

  } catch (error) {
    console.error('Error calculating benchmarks:', error)
    return { available: false, message: 'Error calculating benchmarks' }
  }
}