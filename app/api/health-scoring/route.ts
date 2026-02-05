// Health Scoring API Endpoint
// Calculates and stores health scores for agency locations

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateHealthScore, generateTrendData, calculateBenchmarkPercentile } from '@/lib/health-scoring-engine'

/**
 * POST /api/health-scoring - Calculate health scores for locations
 * Body: { locationIds?: string[], forceRecalculate?: boolean }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { locationIds, forceRecalculate = false } = body

    // Get user's locations
    const locationsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ghl/locations`)
    if (!locationsResponse.ok) {
      throw new Error('Failed to fetch locations')
    }

    const locationsData = await locationsResponse.json()
    const allLocations = locationsData.locations || []

    // Filter locations if specific IDs provided
    const targetLocations = locationIds
      ? allLocations.filter((loc: any) => locationIds.includes(loc.id))
      : allLocations

    const results: any[] = []
    const errors: any[] = []

    console.log(`Health scoring: Starting calculation for ${targetLocations.length} locations:`, targetLocations.map((l: any) => l.id))

    // Process each location in parallel for performance
    const calculationPromises = targetLocations.map(async (location: any) => {
      try {
        // Check if we need to recalculate (or if it's the first time)
        if (!forceRecalculate) {
          const { data: existing } = await supabaseAdmin!
            .from('agency_health_scores')
            .select('id, calculated_at')
            .eq('location_id', location.id)
            .gte('calculated_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // Within 4 hours
            .single()

          if (existing) {
            return { locationId: location.id, skipped: true, existingId: existing.id }
          }
        }

        // Fetch raw metrics for this location
        const rawMetrics = await fetchLocationMetrics(location.id)

        if (!rawMetrics) {
          throw new Error(`No metrics available for location ${location.id}`)
        }

        // Calculate health score
        const healthResult = await calculateHealthScore(location.id, rawMetrics)

        // Generate trend data
        const trendData = await generateTrendData(location.id, 30)

        // Calculate benchmark percentile
        const benchmarkPercentile = await calculateBenchmarkPercentile(location.id, healthResult.overallScore)

        // Get previous score for change calculation
        const { data: previousScore } = await supabaseAdmin!
          .from('agency_health_scores')
          .select('overall_score, calculated_at')
          .eq('location_id', location.id)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single()

        const scoreChange = previousScore
          ? ((healthResult.overallScore - previousScore.overall_score) / previousScore.overall_score) * 100
          : 0

        // Calculate score change velocity (points per day)
        const scoreChangeVelocity = previousScore
          ? scoreChange / Math.max(1, (Date.now() - new Date(previousScore.calculated_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0

        // Prepare health score record
        const healthScoreRecord = {
          location_id: location.id,
          overall_score: healthResult.overallScore,
          health_status: healthResult.healthStatus,
          previous_score: previousScore?.overall_score || null,
          score_change: Math.round(scoreChange * 100) / 100,
          score_change_velocity: Math.round(scoreChangeVelocity * 100) / 100,
          confidence_level: healthResult.confidence,
          benchmark_percentile: benchmarkPercentile,

          // Component scores
          financial_score: healthResult.componentScores.financial,
          operational_score: healthResult.componentScores.operational,
          team_score: healthResult.componentScores.team,
          customer_score: healthResult.componentScores.customer,
          market_score: healthResult.componentScores.market,
          technology_score: healthResult.componentScores.technology,

          // Key metrics for display
          current_revenue: rawMetrics.current_revenue || 0,
          revenue_target: rawMetrics.revenue_target || 0,
          revenue_achievement_rate: rawMetrics.revenue_achievement_rate || 0,
          total_deals: rawMetrics.total_deals || 0,
          deal_target: rawMetrics.deal_target || 0,
          total_leads: rawMetrics.total_leads || 0,
          lead_change_percentage: rawMetrics.lead_change_percentage || 0,
          conversion_rate: rawMetrics.conversion_rate || 0,
          pipeline_value: rawMetrics.pipeline_value || 0,
          active_agents: rawMetrics.active_agents || 0,
          total_agents: rawMetrics.total_agents || 0,
          customer_rating: rawMetrics.customer_rating || 0,

          // Issue intelligence
          primary_issue: healthResult.primaryIssue,
          secondary_issues: healthResult.issues.slice(1), // All except primary
          critical_flags: healthResult.issues.filter(issue => {
            const score = parseFloat(issue.split(': ')[1])
            return score < 30
          }),
          risk_assessment_score: healthResult.riskAssessment,
          growth_opportunity_index: healthResult.growthOpportunityIndex,

          // Trend data for charts
          revenue_trend_30d: trendData.revenue,
          lead_trend_30d: trendData.leads,
          conversion_trend_30d: trendData.conversion,

          // Metadata
          data_freshness_score: calculateDataFreshness(rawMetrics),
          last_data_refresh: new Date().toISOString(),
          calculation_duration_ms: healthResult.calculationTime,
          calculation_version: '2.0'
        }

        // Save to database
        const { data, error: insertError } = await supabaseAdmin!
          .from('agency_health_scores')
          .upsert(healthScoreRecord, {
            onConflict: 'location_id,calculated_at',
            ignoreDuplicates: false
          })
          .select()
          .single()

        if (insertError) {
          throw new Error(`Failed to save health score: ${insertError.message}`)
        }

        return {
          locationId: location.id,
          success: true,
          healthScore: healthResult.overallScore,
          healthStatus: healthResult.healthStatus,
          scoreChange: healthScoreRecord.score_change,
          confidence: healthResult.confidence,
          primaryIssue: healthResult.primaryIssue,
          dataId: data.id
        }

      } catch (error: any) {
        console.error(`Error calculating health score for location ${location.id}:`, error)
        return {
          locationId: location.id,
          error: error.message,
          success: false
        }
      }
    })

    // Wait for all calculations to complete
    const calculationResults = await Promise.allSettled(calculationPromises)

    // Process results
    calculationResults.forEach((result: any) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        errors.push(result.reason)
      }
    })

    const successful = results.filter(r => r.success !== false)
    const skipped = results.filter(r => r.skipped)

    return NextResponse.json({
      success: true,
      summary: {
        total: targetLocations.length,
        successful: successful.length,
        skipped: skipped.length,
        errors: errors.length
      },
      results: successful,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('Error in health scoring API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/health-scoring - Get health scores for locations
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
    const locationIds = searchParams.get('locationIds')?.split(',') || []
    const limit = parseInt(searchParams.get('limit') || '50')
    const includeTrends = searchParams.get('includeTrends') === 'true'

    let query = supabaseAdmin!
      .from('agency_health_scores')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(limit)

    if (locationIds.length > 0) {
      query = query.in('location_id', locationIds)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching health scores:', error)
      return NextResponse.json(
        { error: 'Failed to fetch health scores', details: error.message },
        { status: 500 }
      )
    }

    // Group by location (latest record per location)
    const latestScores = new Map()
    data.forEach((record: any) => {
      const existing = latestScores.get(record.location_id)
      if (!existing || new Date(record.calculated_at) > new Date(existing.calculated_at)) {
        latestScores.set(record.location_id, record)
      }
    })

    const scores = Array.from(latestScores.values())

    return NextResponse.json({
      success: true,
      data: scores,
      count: scores.length
    })

  } catch (error: any) {
    console.error('Error in GET health scoring API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to fetch raw metrics for a location
async function fetchLocationMetrics(locationId: string): Promise<Record<string, any> | null> {
  try {
    // Query database directly instead of unreliable cached endpoint
    const { data: locationMetrics, error } = await supabaseAdmin!
      .from('ghl_location_metrics')
      .select('*')
      .eq('location_id', locationId)
      .order('last_updated', { ascending: false })
      .limit(1)
      .single()

    if (error || !locationMetrics) {
      console.log(`No metrics found for location ${locationId}, using defaults`)
      return null
    }

    console.log(`Found metrics for ${locationId}: contacts=${locationMetrics.contacts_count}, opportunities=${locationMetrics.opportunities_count}`)
    console.log(`Health scoring: Processing location ${locationId} with metrics:`, {
      contacts: locationMetrics.contacts_count,
      opportunities: locationMetrics.opportunities_count,
      hasMetrics: !!locationMetrics
    })

    // Transform raw metrics into health scoring format
    return {
      // Financial metrics
      current_revenue: locationMetrics.total_revenue || 0,
      revenue_target: (locationMetrics.total_revenue || 0) * 1.1, // Assume 10% growth target
      revenue_achievement_rate: ((locationMetrics.total_revenue || 0) / ((locationMetrics.total_revenue || 0) * 1.1)) * 100,
      profit_margin_health: 18.5, // Mock - would come from accounting system
      commission_velocity_days: 45, // Mock - days to realize commission

      // Operational metrics
      total_leads: locationMetrics.contacts_count || 0,
      total_deals: locationMetrics.opportunities_count || 0,
      conversion_rate: locationMetrics.contacts_count > 0 ? (locationMetrics.opportunities_count / locationMetrics.contacts_count) * 100 : 0,
      lead_to_deal_conversion: locationMetrics.contacts_count > 0 ? (locationMetrics.opportunities_count / locationMetrics.contacts_count) * 100 : 0,
      response_time_performance: 95, // Mock - minutes to respond
      appointment_show_rate: 72, // Mock - percentage
      pipeline_value: (locationMetrics.total_opportunities || 0) * 15000, // Mock avg deal value
      pipeline_health_score: 65, // Mock
      follow_up_completion_rate: 78, // Mock

      // Team metrics
      active_agents: 6, // Mock
      total_agents: 8, // Mock
      agent_utilization_rate: 75, // Mock
      agent_productivity_index: 4200, // Mock - revenue per active hour
      training_completion_rate: 85, // Mock
      team_collaboration_score: 78, // Mock
      performance_consistency: 82, // Mock

      // Customer metrics
      customer_rating: 4.2, // Mock
      client_satisfaction_score: 4.2,
      net_promoter_score: 28,
      client_retention_rate: 78,
      communication_quality: 85,

      // Market metrics
      market_absorption_rate: 3.2, // Mock - months
      days_on_market_avg: 42, // Mock
      inventory_health_score: 68,
      competitive_position: 72,

      // Technology metrics
      system_adoption_rate: 82,
      data_quality_score: 91,
      integration_health_score: 88,
      automation_effectiveness: 76,

      // Additional metrics for health scoring
      total_conversations: locationMetrics.conversations_count || 0,
      last_updated: locationMetrics.last_updated,
      health_score: locationMetrics.health_score || 60,
      data_age_hours: locationMetrics.data_age_hours || 0
    }
  } catch (error) {
    console.error(`Error fetching metrics for location ${locationId}:`, error)
    return null
  }
}

// Calculate data freshness score (0-100)
function calculateDataFreshness(metrics: Record<string, any>): number {
  const dataAgeHours = metrics.data_age_hours || 0

  // Freshness decreases over time
  if (dataAgeHours <= 1) return 100
  if (dataAgeHours <= 4) return 90 - (dataAgeHours - 1) * 5
  if (dataAgeHours <= 24) return 80 - (dataAgeHours - 4) * 2
  if (dataAgeHours <= 72) return 50 - (dataAgeHours - 24) * 0.5

  return Math.max(0, 25 - (dataAgeHours - 72) * 0.1)
}