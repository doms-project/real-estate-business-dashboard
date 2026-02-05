// Export API Endpoint
// Handles report generation and data export capabilities

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/export - Generate and export reports
 * Body: {
 *   type: 'health_report' | 'performance_summary' | 'trend_analysis' | 'alert_history',
 *   format: 'pdf' | 'excel' | 'csv' | 'json',
 *   locationIds?: string[],
 *   dateRange?: { start: string, end: string },
 *   includeCharts?: boolean,
 *   includeForecasts?: boolean
 * }
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
    const {
      type,
      format,
      locationIds = [],
      dateRange,
      includeCharts = false,
      includeForecasts = false
    } = body

    // Validate request
    if (!type || !format) {
      return NextResponse.json(
        { error: 'Type and format are required' },
        { status: 400 }
      )
    }

    // Create export log entry
    const { data: exportLog, error: logError } = await supabaseAdmin!
      .from('export_log')
      .insert({
        user_id: userId,
        export_type: format,
        location_ids: locationIds,
        date_range: dateRange,
        status: 'processing'
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating export log:', logError)
    }

    // Process export based on type
    let exportData: any
    let filename: string

    switch (type) {
      case 'health_report':
        exportData = await generateHealthReport(locationIds, dateRange, includeCharts)
        filename = `agency-health-report-${new Date().toISOString().split('T')[0]}.${format}`
        break
      case 'performance_summary':
        exportData = await generatePerformanceSummary(locationIds, dateRange)
        filename = `agency-performance-summary-${new Date().toISOString().split('T')[0]}.${format}`
        break
      case 'trend_analysis':
        exportData = await generateTrendAnalysis(locationIds, dateRange, includeForecasts)
        filename = `agency-trend-analysis-${new Date().toISOString().split('T')[0]}.${format}`
        break
      case 'alert_history':
        exportData = await generateAlertHistory(locationIds, dateRange)
        filename = `agency-alert-history-${new Date().toISOString().split('T')[0]}.${format}`
        break
      default:
        return NextResponse.json(
          { error: 'Invalid export type' },
          { status: 400 }
        )
    }

    // Generate file based on format
    const fileBuffer = await generateFile(exportData, format)

    // Update export log
    if (exportLog) {
      await supabaseAdmin!
        .from('export_log')
        .update({
          file_name: filename,
          file_size_bytes: fileBuffer.length,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', exportLog.id)
    }

    // Return file for download
    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': getContentType(format),
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error: any) {
    console.error('Error in export API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Generate comprehensive health report
async function generateHealthReport(
  locationIds: string[],
  dateRange?: { start: string, end: string },
  includeCharts = false
): Promise<any> {
  // Get health scores for specified locations and date range
  let query = supabaseAdmin!
    .from('agency_health_scores')
    .select('*')
    .order('calculated_at', { ascending: false })

  if (locationIds.length > 0) {
    query = query.in('location_id', locationIds)
  }

  if (dateRange) {
    query = query
      .gte('calculated_at', dateRange.start)
      .lte('calculated_at', dateRange.end)
  }

  const { data: healthScores, error } = await query.limit(1000)

  if (error) throw error

  // Aggregate data by location (latest score per location)
  const latestScores = new Map()
  healthScores?.forEach(score => {
    const existing = latestScores.get(score.location_id)
    if (!existing || new Date(score.calculated_at) > new Date(existing.calculated_at)) {
      latestScores.set(score.location_id, score)
    }
  })

  const scores = Array.from(latestScores.values())

  // Calculate agency-wide metrics
  const agencyMetrics = {
    totalLocations: scores.length,
    averageHealthScore: scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length,
    healthyLocations: scores.filter(s => s.health_status === 'healthy').length,
    warningLocations: scores.filter(s => s.health_status === 'warning').length,
    criticalLocations: scores.filter(s => s.health_status === 'critical').length,
    totalRevenue: scores.reduce((sum, s) => sum + s.current_revenue, 0),
    totalLeads: scores.reduce((sum, s) => sum + s.total_leads, 0),
    totalDeals: scores.reduce((sum, s) => sum + s.total_deals, 0),
  }

  return {
    reportType: 'Health Report',
    generatedAt: new Date().toISOString(),
    dateRange,
    agencyMetrics,
    locationDetails: scores.map(score => ({
      locationId: score.location_id,
      overallScore: score.overall_score,
      healthStatus: score.health_status,
      componentScores: {
        financial: score.financial_score,
        operational: score.operational_score,
        team: score.team_score,
        customer: score.customer_score,
        market: score.market_score,
        technology: score.technology_score
      },
      keyMetrics: {
        revenue: score.current_revenue,
        revenueTarget: score.revenue_target,
        revenueAchievement: score.revenue_achievement_rate,
        totalLeads: score.total_leads,
        totalDeals: score.total_deals,
        conversionRate: score.conversion_rate,
        activeAgents: score.active_agents,
        customerRating: score.customer_rating
      },
      lastCalculated: score.calculated_at,
      confidence: score.confidence_level
    })),
    charts: includeCharts ? generateChartData(scores) : null
  }
}

// Generate performance summary
async function generatePerformanceSummary(
  locationIds: string[],
  dateRange?: { start: string, end: string }
): Promise<any> {
  const report = await generateHealthReport(locationIds, dateRange, false)

  // Focus on key performance indicators
  return {
    reportType: 'Performance Summary',
    generatedAt: new Date().toISOString(),
    summary: {
      totalLocations: report.agencyMetrics.totalLocations,
      averageHealthScore: report.agencyMetrics.averageHealthScore,
      revenuePerformance: {
        total: report.agencyMetrics.totalRevenue,
        averagePerLocation: report.agencyMetrics.totalRevenue / report.agencyMetrics.totalLocations
      },
      leadGeneration: {
        total: report.agencyMetrics.totalLeads,
        averagePerLocation: report.agencyMetrics.totalLeads / report.agencyMetrics.totalLocations
      },
      dealPerformance: {
        total: report.agencyMetrics.totalDeals,
        averagePerLocation: report.agencyMetrics.totalDeals / report.agencyMetrics.totalLocations
      }
    },
    topPerformers: report.locationDetails
      .sort((a: any, b: any) => b.overallScore - a.overallScore)
      .slice(0, 5),
    needsAttention: report.locationDetails
      .filter((loc: any) => loc.healthStatus === 'critical' || loc.healthStatus === 'warning')
      .sort((a: any, b: any) => a.overallScore - b.overallScore)
      .slice(0, 5)
  }
}

// Generate trend analysis report
async function generateTrendAnalysis(
  locationIds: string[],
  dateRange?: { start: string, end: string },
  includeForecasts = false
): Promise<any> {
  const trends = []

  for (const locationId of locationIds.length > 0 ? locationIds : ['all']) {
    // Get trend data from cache or calculate
    const { data: trendData } = await supabaseAdmin!
      .from('predictive_cache')
      .select('cache_data')
      .eq('location_id', locationId)
      .eq('cache_type', 'trend')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (trendData) {
      trends.push({
        locationId,
        ...trendData.cache_data
      })
    }
  }

  return {
    reportType: 'Trend Analysis',
    generatedAt: new Date().toISOString(),
    dateRange,
    trends,
    forecasts: includeForecasts ? await getForecastData(locationIds) : null
  }
}

// Generate alert history report
async function generateAlertHistory(
  locationIds: string[],
  dateRange?: { start: string, end: string }
): Promise<any> {
  let query = supabaseAdmin!
    .from('health_alerts')
    .select('*')
    .order('created_at', { ascending: false })

  if (locationIds.length > 0) {
    query = query.in('location_id', locationIds)
  }

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)
  }

  const { data: alerts, error } = await query.limit(1000)

  if (error) throw error

  // Aggregate alert statistics
  const stats = {
    total: alerts?.length || 0,
    bySeverity: {
      critical: alerts?.filter(a => a.severity === 'critical').length || 0,
      high: alerts?.filter(a => a.severity === 'high').length || 0,
      medium: alerts?.filter(a => a.severity === 'medium').length || 0,
      low: alerts?.filter(a => a.severity === 'low').length || 0
    },
    byType: alerts?.reduce((acc, alert) => {
      acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {},
    byStatus: {
      active: alerts?.filter(a => a.status === 'active').length || 0,
      acknowledged: alerts?.filter(a => a.status === 'acknowledged').length || 0,
      resolved: alerts?.filter(a => a.status === 'resolved').length || 0
    }
  }

  return {
    reportType: 'Alert History',
    generatedAt: new Date().toISOString(),
    dateRange,
    statistics: stats,
    alerts: alerts?.map(alert => ({
      id: alert.id,
      locationId: alert.location_id,
      type: alert.alert_type,
      severity: alert.severity,
      message: alert.message,
      status: alert.status,
      createdAt: alert.created_at,
      acknowledgedAt: alert.acknowledged_at,
      resolvedAt: alert.resolved_at,
      acknowledgedBy: alert.acknowledged_by,
      resolutionNotes: alert.resolution_notes
    })) || []
  }
}

// Generate chart data for visualizations
function generateChartData(scores: any[]): any {
  return {
    healthScoreDistribution: {
      labels: ['Critical (0-39)', 'Warning (40-69)', 'Healthy (70-100)'],
      data: [
        scores.filter(s => s.overall_score < 40).length,
        scores.filter(s => s.overall_score >= 40 && s.overall_score < 70).length,
        scores.filter(s => s.overall_score >= 70).length
      ]
    },
    componentScoreAverages: {
      labels: ['Financial', 'Operational', 'Team', 'Customer', 'Market', 'Technology'],
      data: [
        scores.reduce((sum, s) => sum + s.financial_score, 0) / scores.length,
        scores.reduce((sum, s) => sum + s.operational_score, 0) / scores.length,
        scores.reduce((sum, s) => sum + s.team_score, 0) / scores.length,
        scores.reduce((sum, s) => sum + s.customer_score, 0) / scores.length,
        scores.reduce((sum, s) => sum + s.market_score, 0) / scores.length,
        scores.reduce((sum, s) => sum + s.technology_score, 0) / scores.length
      ]
    },
    revenuePerformance: scores.map(s => ({
      location: s.location_id,
      revenue: s.current_revenue,
      target: s.revenue_target,
      achievement: s.revenue_achievement_rate
    })).sort((a: any, b: any) => b.revenue - a.revenue)
  }
}

// Get forecast data for locations
async function getForecastData(locationIds: string[]): Promise<any[]> {
  const forecasts = []

  for (const locationId of locationIds) {
    const { data: forecastData } = await supabaseAdmin!
      .from('predictive_cache')
      .select('cache_data')
      .eq('location_id', locationId)
      .eq('cache_type', 'forecast')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (forecastData) {
      forecasts.push({
        locationId,
        ...forecastData.cache_data
      })
    }
  }

  return forecasts
}

// Generate file in requested format
async function generateFile(data: any, format: string): Promise<Buffer> {
  switch (format) {
    case 'json':
      return Buffer.from(JSON.stringify(data, null, 2))

    case 'csv':
      return generateCSV(data)

    case 'excel':
      return generateExcel(data)

    case 'pdf':
      return generatePDF(data)

    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

// Generate CSV format
function generateCSV(data: any): Buffer {
  // Simple CSV generation - in production, use a proper CSV library
  const csvRows = []

  // Add headers
  csvRows.push('Report Type,Generated At,Total Locations,Average Health Score')

  // Add summary data
  csvRows.push(`${data.reportType},${data.generatedAt},${data.agencyMetrics?.totalLocations || 0},${data.agencyMetrics?.averageHealthScore || 0}`)

  // Add location details
  if (data.locationDetails) {
    csvRows.push('') // Empty row
    csvRows.push('Location ID,Health Score,Status,Revenue,Leads,Deals,Conversion Rate')

    data.locationDetails.forEach((loc: any) => {
      csvRows.push(`${loc.locationId},${loc.overallScore},${loc.healthStatus},${loc.keyMetrics.revenue},${loc.keyMetrics.totalLeads},${loc.keyMetrics.totalDeals},${loc.keyMetrics.conversionRate}`)
    })
  }

  return Buffer.from(csvRows.join('\n'))
}

// Generate Excel format (simplified - in production use exceljs or similar)
function generateExcel(data: any): Buffer {
  // For now, return JSON - in production implement proper Excel generation
  return Buffer.from(JSON.stringify(data, null, 2))
}

// Generate PDF format (simplified - in production use puppeteer or pdfkit)
function generatePDF(data: any): Buffer {
  // For now, return JSON - in production implement proper PDF generation
  return Buffer.from(JSON.stringify(data, null, 2))
}

// Get content type for format
function getContentType(format: string): string {
  const types = {
    json: 'application/json',
    csv: 'text/csv',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf'
  }
  return types[format as keyof typeof types] || 'application/octet-stream'
}