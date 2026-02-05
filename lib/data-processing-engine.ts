// Parallel Data Processing Engine for Agency Health Monitoring
// Handles background processing, caching, and real-time updates

import { supabaseAdmin, supabaseAdminFallback } from '@/lib/supabase'

// Processing queue for background tasks
interface ProcessingTask {
  id: string
  type: 'health_calculation' | 'trend_analysis' | 'forecast_update' | 'alert_check'
  locationId: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  data?: any
  createdAt: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

// Cache management
interface CacheEntry {
  key: string
  data: any
  expiresAt: Date
  lastAccessed: Date
  accessCount: number
}

// Parallel processing configuration
const PROCESSING_CONFIG = {
  maxConcurrentTasks: 5,
  healthCheckInterval: 30000, // 30 seconds
  cacheCleanupInterval: 3600000, // 1 hour
  maxCacheAge: 86400000, // 24 hours
  predictiveCacheAge: 3600000, // 1 hour for forecasts
}

// Global processing state
let processingQueue: ProcessingTask[] = []
let activeTasks = new Set<string>()
let cacheStore = new Map<string, CacheEntry>()

// Initialize background processing
export function initializeDataProcessing() {
  // Start background health checks
  setInterval(processHealthChecks, PROCESSING_CONFIG.healthCheckInterval)

  // Start cache cleanup
  setInterval(cleanupExpiredCache, PROCESSING_CONFIG.cacheCleanupInterval)

  console.log('Data processing engine initialized')
}

// Queue a processing task
export async function queueProcessingTask(task: Omit<ProcessingTask, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const fullTask: ProcessingTask = {
    ...task,
    id: taskId,
    createdAt: new Date(),
    status: 'pending'
  }

  processingQueue.push(fullTask)

  // Sort queue by priority
  processingQueue.sort((a, b) => {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })

  // Process queue
  processQueue()

  return taskId
}

// Process the task queue
async function processQueue() {
  const availableSlots = PROCESSING_CONFIG.maxConcurrentTasks - activeTasks.size

  for (let i = 0; i < availableSlots && processingQueue.length > 0; i++) {
    const task = processingQueue.shift()
    if (task) {
      activeTasks.add(task.id)
      processTask(task).finally(() => {
        activeTasks.delete(task.id)
        // Process next task in queue
        setTimeout(processQueue, 100)
      })
    }
  }
}

// Process individual task
async function processTask(task: ProcessingTask): Promise<void> {
  try {
    task.status = 'processing'

    switch (task.type) {
      case 'health_calculation':
        await processHealthCalculation(task)
        break
      case 'trend_analysis':
        await processTrendAnalysis(task)
        break
      case 'forecast_update':
        await processForecastUpdate(task)
        break
      case 'alert_check':
        await processAlertCheck(task)
        break
    }

    task.status = 'completed'
  } catch (error) {
    console.error(`Task ${task.id} failed:`, error)
    task.status = 'failed'
  }
}

// Health calculation processing
async function processHealthCalculation(task: ProcessingTask): Promise<void> {
  const { calculateHealthScore, generateTrendData, calculateBenchmarkPercentile } = await import('./health-scoring-engine')

  // Fetch raw metrics
  const rawMetrics = await fetchLocationMetrics(task.locationId)
  if (!rawMetrics) throw new Error('No metrics available')

  // Calculate health score
  const healthResult = await calculateHealthScore(task.locationId, rawMetrics)

  // Generate trend data
  const trendData = await generateTrendData(task.locationId)

  // Calculate benchmark
  const benchmarkPercentile = await calculateBenchmarkPercentile(task.locationId, healthResult.overallScore)

  // Save to database
  const healthScoreRecord = {
    location_id: task.locationId,
    overall_score: healthResult.overallScore,
    health_status: healthResult.healthStatus,
    component_scores: healthResult.componentScores,
    confidence_level: healthResult.confidence,
    benchmark_percentile: benchmarkPercentile,
    // ... other fields from healthResult
    revenue_trend_30d: trendData.revenue,
    lead_trend_30d: trendData.leads,
    conversion_trend_30d: trendData.conversion,
    data_freshness_score: calculateDataFreshness(rawMetrics),
    last_data_refresh: new Date().toISOString(),
    calculation_duration_ms: healthResult.calculationTime,
    calculation_version: '2.0'
  }

  const { error } = await supabaseAdminFallback!
    .from('agency_health_scores')
    .upsert(healthScoreRecord, {
      onConflict: 'location_id,calculated_at',
      ignoreDuplicates: false
    })

  if (error) throw error

  // Cache the result
  setCache(`health_score_${task.locationId}`, healthResult, PROCESSING_CONFIG.maxCacheAge)
}

// Trend analysis processing
async function processTrendAnalysis(task: ProcessingTask): Promise<void> {
  const locationId = task.locationId

  // Fetch historical data
  const { data: history, error } = await supabaseAdminFallback
    .from('agency_health_scores')
    .select('overall_score, calculated_at')
    .eq('location_id', locationId)
    .order('calculated_at', { ascending: true })
    .limit(90) // Last 90 days

  if (error) throw error

  // Calculate trends
  const trends = calculateTrends(history || [])

  // Cache trends
  setCache(`trends_${locationId}`, trends, PROCESSING_CONFIG.maxCacheAge)
}

// Forecast update processing
async function processForecastUpdate(task: ProcessingTask): Promise<void> {
  const locationId = task.locationId

  // Get historical revenue data
  const { data: revenueData, error } = await supabaseAdminFallback
    .from('agency_health_scores')
    .select('current_revenue, calculated_at')
    .eq('location_id', locationId)
    .order('calculated_at', { ascending: true })
    .limit(60) // Last 60 days

  if (error) throw error

  // Generate forecasts
  const forecasts = generateRevenueForecast(revenueData || [])

  // Cache forecasts
  setCache(`forecast_${locationId}`, forecasts, PROCESSING_CONFIG.predictiveCacheAge)
}

// Alert check processing
async function processAlertCheck(task: ProcessingTask): Promise<void> {
  const locationId = task.locationId

  // Get latest health score
  const { data: healthScore, error } = await supabaseAdminFallback
    .from('agency_health_scores')
    .select('*')
    .eq('location_id', locationId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !healthScore) return

  // Check for alert conditions
  const alerts = checkAlertConditions(healthScore)

  // Create alerts if any
  for (const alert of alerts) {
    await supabaseAdminFallback
      .from('health_alerts')
      .insert({
        location_id: locationId,
        alert_type: alert.type,
        severity: alert.severity,
        message: alert.message,
        trigger_metric: alert.metric,
        trigger_value: alert.value,
        threshold_value: alert.threshold
      })
  }
}

// Background health check processor
async function processHealthChecks(): Promise<void> {
  try {
    // Get all locations
    const { data: locations, error } = await supabaseAdminFallback
      .from('agency_health_scores')
      .select('location_id')
      .order('calculated_at', { ascending: false })

    if (error) return

    const uniqueLocations = [...new Set(locations?.map(l => l.location_id) || [])]

    // Queue health checks for locations that haven't been updated recently
    for (const locationId of Array.from(uniqueLocations)) {
      const shouldCheck = await shouldRunHealthCheck(locationId)
      if (shouldCheck) {
        await queueProcessingTask({
          type: 'health_calculation',
          locationId,
          priority: 'medium'
        })
      }
    }
  } catch (error) {
    console.error('Error in background health checks:', error)
  }
}

// Cache management functions
export function getCache(key: string): any | null {
  const entry = cacheStore.get(key)
  if (!entry) return null

  // Check if expired
  if (new Date() > entry.expiresAt) {
    cacheStore.delete(key)
    return null
  }

  // Update access stats
  entry.lastAccessed = new Date()
  entry.accessCount++

  return entry.data
}

export function setCache(key: string, data: any, maxAge: number): void {
  const expiresAt = new Date(Date.now() + maxAge)

  cacheStore.set(key, {
    key,
    data,
    expiresAt,
    lastAccessed: new Date(),
    accessCount: 0
  })
}

function cleanupExpiredCache(): void {
  const now = new Date()
  for (const [key, entry] of Array.from(cacheStore.entries())) {
    if (now > entry.expiresAt) {
      cacheStore.delete(key)
    }
  }
}

// Utility functions
async function fetchLocationMetrics(locationId: string): Promise<any> {
  // Reuse the logic from health-scoring route
  const metricsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ghl/metrics/cached?locationId=${locationId}`)
  if (!metricsResponse.ok) return null

  const metricsData = await metricsResponse.json()
  return metricsData.success ? metricsData.data.find((m: any) => m.location_id === locationId) : null
}

function calculateDataFreshness(metrics: any): number {
  const dataAgeHours = metrics.data_age_hours || 0
  if (dataAgeHours <= 1) return 100
  if (dataAgeHours <= 4) return 90 - (dataAgeHours - 1) * 5
  if (dataAgeHours <= 24) return 80 - (dataAgeHours - 4) * 2
  if (dataAgeHours <= 72) return 50 - (dataAgeHours - 24) * 0.5
  return Math.max(0, 25 - (dataAgeHours - 72) * 0.1)
}

function calculateTrends(history: any[]): any {
  if (history.length < 7) return { trend: 'insufficient_data' }

  const recent = history.slice(-7)
  const previous = history.slice(-14, -7)

  const recentAvg = recent.reduce((sum, h) => sum + h.overall_score, 0) / recent.length
  const previousAvg = previous.reduce((sum, h) => sum + h.overall_score, 0) / previous.length

  const change = recentAvg - previousAvg
  const trend = change > 2 ? 'improving' : change < -2 ? 'declining' : 'stable'

  return {
    trend,
    change: Math.round(change * 100) / 100,
    recentAverage: Math.round(recentAvg * 100) / 100,
    previousAverage: Math.round(previousAvg * 100) / 100,
    dataPoints: history.length
  }
}

function generateRevenueForecast(history: any[]): any {
  if (history.length < 14) return { forecast: 'insufficient_data' }

  // Simple linear regression for forecasting
  const data = history.map((h, i) => ({ x: i, y: h.current_revenue }))

  // Calculate trend line
  const n = data.length
  const sumX = data.reduce((sum, d) => sum + d.x, 0)
  const sumY = data.reduce((sum, d) => sum + d.y, 0)
  const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0)
  const sumXX = data.reduce((sum, d) => sum + d.x * d.x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Forecast next 30 days
  const forecast = []
  for (let i = 1; i <= 30; i++) {
    const predicted = slope * (n + i - 1) + intercept
    forecast.push(Math.max(0, Math.round(predicted)))
  }

  const currentAvg = data.slice(-7).reduce((sum, d) => sum + d.y, 0) / 7
  const forecastAvg = forecast.reduce((sum, f) => sum + f, 0) / 30
  const growthRate = ((forecastAvg - currentAvg) / currentAvg) * 100

  return {
    forecast,
    predictedGrowth: Math.round(growthRate * 100) / 100,
    confidence: 85, // Mock confidence level
    method: 'linear_regression'
  }
}

function checkAlertConditions(healthScore: any): any[] {
  const alerts = []

  // Revenue below target
  if (healthScore.revenue_achievement_rate < 80) {
    alerts.push({
      type: 'financial',
      severity: healthScore.revenue_achievement_rate < 60 ? 'high' : 'medium',
      message: `Revenue ${healthScore.revenue_achievement_rate.toFixed(1)}% below target`,
      metric: 'revenue_achievement_rate',
      value: healthScore.revenue_achievement_rate,
      threshold: 80
    })
  }

  // Critical health score
  if (healthScore.overall_score < 40) {
    alerts.push({
      type: 'overall',
      severity: 'critical',
      message: `Health score critically low: ${healthScore.overall_score.toFixed(1)}%`,
      metric: 'overall_score',
      value: healthScore.overall_score,
      threshold: 40
    })
  }

  // Lead generation decline
  if (healthScore.lead_change_percentage < -15) {
    alerts.push({
      type: 'operational',
      severity: 'high',
      message: `Lead generation down ${Math.abs(healthScore.lead_change_percentage).toFixed(1)}%`,
      metric: 'lead_change_percentage',
      value: healthScore.lead_change_percentage,
      threshold: -15
    })
  }

  return alerts
}

async function shouldRunHealthCheck(locationId: string): Promise<boolean> {
  // Check if location needs health update (not updated in last 2 hours)
  const { data, error } = await supabaseAdminFallback
    .from('agency_health_scores')
    .select('calculated_at')
    .eq('location_id', locationId)
    .order('calculated_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return true

  const lastUpdate = new Date(data[0].calculated_at)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

  return lastUpdate < twoHoursAgo
}

// Export processing status
export function getProcessingStatus() {
  return {
    queueLength: processingQueue.length,
    activeTasks: activeTasks.size,
    cacheSize: cacheStore.size,
    maxConcurrent: PROCESSING_CONFIG.maxConcurrentTasks
  }
}