// Real-time Updates System for Flexboard
// Handles live data updates, caching, and performance optimization

import { supabaseAdmin, supabaseAdminFallback, supabase } from '@/lib/supabase'
import { getCache, setCache } from '@/lib/data-processing-engine'

// Real-time update configuration
const UPDATE_CONFIG = {
  healthScoreInterval: 5 * 60 * 1000, // 5 minutes
  alertCheckInterval: 2 * 60 * 1000,   // 2 minutes
  cacheCleanupInterval: 30 * 60 * 1000, // 30 minutes
  maxCacheAge: 60 * 60 * 1000, // 1 hour
  realtimeEnabled: true,
  locationMetricsRealtimeEnabled: true, // Enable real-time updates for location metrics
  blopsRealtimeEnabled: true // Enable real-time updates for blops
}

// Active subscriptions and timers
let updateTimers: Map<string, NodeJS.Timeout> = new Map()
let subscribers: Map<string, Set<(data: any) => void>> = new Map()
let isInitialized = false

// Initialize real-time update system
export function initializeRealtimeUpdates() {
  if (isInitialized) return

  console.log('Initializing real-time update system...')

  // Start background update cycles
  startHealthScoreUpdates()
  startAlertMonitoring()
  startCacheMaintenance()

  // Set up real-time subscriptions for critical data
  setupRealtimeSubscriptions()

  isInitialized = true
  console.log('Real-time update system initialized')
}

// Subscribe to real-time updates for specific data types
export function subscribeToUpdates(
  dataType: 'health_scores' | 'alerts' | 'forecasts' | 'trends' | 'location_metrics' | 'activities' | 'workspaces' | 'workspace_requests' | 'blops',
  callback: (data: any) => void
): () => void {
  if (!subscribers.has(dataType)) {
    subscribers.set(dataType, new Set())
  }

  subscribers.get(dataType)!.add(callback)

  // Return unsubscribe function
  return () => {
    const subs = subscribers.get(dataType)
    if (subs) {
      subs.delete(callback)
      if (subs.size === 0) {
        subscribers.delete(dataType)
      }
    }
  }
}

// Notify subscribers of data updates
export function notifySubscribers(dataType: string, data: any) {
  const subs = subscribers.get(dataType)
  if (subs) {
    subs.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in ${dataType} subscriber callback:`, error)
      }
    })
  }
}

// Start periodic health score updates
function startHealthScoreUpdates() {
  const updateHealthScores = async () => {
    try {
      console.log('Running periodic health score updates...')

      // Get all locations that need updates
      const { data: locations, error } = await supabaseAdminFallback
        .from('agency_health_scores')
        .select('location_id, calculated_at')
        .order('calculated_at', { ascending: false })

      if (error) throw error

      const uniqueLocations = [...new Set(locations?.map(l => l.location_id) || [])]
      const locationsNeedingUpdate = []

      // Check which locations haven't been updated recently
      for (const locationId of uniqueLocations) {
        const lastUpdate = locations?.find(l => l.location_id === locationId)?.calculated_at
        if (!lastUpdate || Date.now() - new Date(lastUpdate).getTime() > UPDATE_CONFIG.healthScoreInterval) {
          locationsNeedingUpdate.push(locationId)
        }
      }

      if (locationsNeedingUpdate.length > 0) {
        console.log(`Updating health scores for ${locationsNeedingUpdate.length} locations`)

        // Queue background updates
        const { queueProcessingTask } = await import('./data-processing-engine')

        for (const locationId of locationsNeedingUpdate) {
          await queueProcessingTask({
            type: 'health_calculation',
            locationId,
            priority: 'low'
          })
        }

        // Notify subscribers
        notifySubscribers('health_scores', {
          type: 'batch_update',
          locations: locationsNeedingUpdate,
          timestamp: new Date().toISOString()
        })
      }

    } catch (error) {
      console.error('Error in periodic health score updates:', error)
    }
  }

  // Initial update
  updateHealthScores()

  // Set up recurring updates
  const timer = setInterval(updateHealthScores, UPDATE_CONFIG.healthScoreInterval)
  updateTimers.set('health_scores', timer)
}

// Start alert monitoring
function startAlertMonitoring() {
  const checkAlerts = async () => {
    try {
      const { checkAndGenerateAlerts } = await import('./alert-system')
      await checkAndGenerateAlerts()

      // Check for new alerts and notify subscribers
      const { data: recentAlerts, error } = await supabaseAdminFallback
        .from('health_alerts')
        .select('*')
        .eq('status', 'active')
        .gte('created_at', new Date(Date.now() - UPDATE_CONFIG.alertCheckInterval).toISOString())

      if (!error && recentAlerts && recentAlerts.length > 0) {
        notifySubscribers('alerts', {
          type: 'new_alerts',
          alerts: recentAlerts,
          timestamp: new Date().toISOString()
        })
      }

    } catch (error) {
      console.error('Error in alert monitoring:', error)
    }
  }

  // Initial check
  checkAlerts()

  // Set up recurring checks
  const timer = setInterval(checkAlerts, UPDATE_CONFIG.alertCheckInterval)
  updateTimers.set('alerts', timer)
}

// Start cache maintenance
function startCacheMaintenance() {
  const cleanupCache = () => {
    try {
      console.log('Running cache maintenance...')

      // Clear expired cache entries
      const now = Date.now()
      const cacheKeysToDelete = []

      // Note: In a real implementation, you'd iterate through your cache store
      // For now, this is a placeholder for cache cleanup logic

      console.log('Cache maintenance completed')
    } catch (error) {
      console.error('Error in cache maintenance:', error)
    }
  }

  const timer = setInterval(cleanupCache, UPDATE_CONFIG.cacheCleanupInterval)
  updateTimers.set('cache', timer)
}

// Set up real-time database subscriptions
function setupRealtimeSubscriptions() {
  if (!UPDATE_CONFIG.realtimeEnabled) return

  console.log('🔄 Setting up real-time database subscriptions...')

  // Subscribe to health score changes
  supabaseAdminFallback
    .channel('health_scores_realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'agency_health_scores'
    }, (payload) => {
      notifySubscribers('health_scores', {
        type: 'new_score',
        data: payload.new,
        timestamp: new Date().toISOString()
      })
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'agency_health_scores'
    }, (payload) => {
      notifySubscribers('health_scores', {
        type: 'updated_score',
        data: payload.new,
        timestamp: new Date().toISOString()
      })
    })
    .subscribe()

  // Subscribe to alert changes
  supabaseAdminFallback
    .channel('alerts_realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'health_alerts'
    }, (payload) => {
      notifySubscribers('alerts', {
        type: 'new_alert',
        data: payload.new,
        timestamp: new Date().toISOString()
      })
    })
    .subscribe()

  // Subscribe to location metrics changes (ghl_location_metrics table)
  if (UPDATE_CONFIG.locationMetricsRealtimeEnabled) {
    console.log('📊 Setting up location metrics real-time subscription...')

    try {
      const channel = supabase
        .channel('location_metrics_realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'ghl_location_metrics'
        }, (payload) => {
          console.log('📊 New location metrics added:', payload.new)
          notifySubscribers('location_metrics', {
            type: 'metrics_inserted',
            data: payload.new,
            timestamp: new Date().toISOString()
          })
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'ghl_location_metrics'
        }, (payload) => {
          console.log('📊 Location metrics updated:', payload.new)
          console.log('📡 Broadcasting real-time update to subscribers...')
          notifySubscribers('location_metrics', {
            type: 'metrics_updated',
            data: payload.new,
            timestamp: new Date().toISOString()
          })
        })
        .subscribe((status, err) => {
          console.log('📡 Location metrics subscription status:', status)
          if (err) {
            console.error('❌ Location metrics subscription error:', err)
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to location metrics real-time updates')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Location metrics subscription failed - check Supabase RLS policies')
          } else if (status === 'TIMED_OUT') {
            console.error('❌ Location metrics subscription timed out')
          }
        })
  } catch (error) {
    console.error('❌ Failed to set up location metrics real-time subscription:', error)
  }

  // Subscribe to activities changes for real-time activity feed updates
  console.log('📝 Setting up activities real-time subscription...')

  try {
    supabase
      .channel('activities_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activities'
      }, (payload) => {
        console.log('📝 New activity logged:', payload.new)
        notifySubscribers('activities', {
          type: 'activity_added',
          data: payload.new,
          timestamp: new Date().toISOString()
        })
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'activities'
      }, (payload) => {
        console.log('📝 Activity deleted:', payload.old)
        notifySubscribers('activities', {
          type: 'activity_deleted',
          data: payload.old,
          timestamp: new Date().toISOString()
        })
      })
      .subscribe((status, err) => {
        console.log('📝 Activities subscription status:', status)
        if (err) {
          console.error('❌ Activities subscription error:', err)
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to activities real-time updates')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Activities subscription failed - check Supabase RLS policies')
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Activities subscription timed out')
        }
      })
  } catch (error) {
    console.error('❌ Failed to set up activities real-time subscription:', error)
  }

  // Subscribe to workspace changes for real-time workspace updates
  console.log('🏢 Setting up workspaces real-time subscription...')

  try {
    supabase
      .channel('workspaces_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'workspaces'
      }, (payload) => {
        console.log('🏢 Workspace updated:', payload.new)
        notifySubscribers('workspaces', {
          type: 'workspace_updated',
          data: payload.new,
          timestamp: new Date().toISOString()
        })
      })
      .subscribe((status, err) => {
        console.log('🏢 Workspaces subscription status:', status)
        if (err) {
          console.error('❌ Workspaces subscription error:', err)
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to workspaces real-time updates')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Workspaces subscription failed - check Supabase RLS policies')
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Workspaces subscription timed out')
        }
      })
  } catch (error) {
    console.error('❌ Failed to set up workspaces real-time subscription:', error)
  }

  // Subscribe to blops changes for real-time blop updates
  if (UPDATE_CONFIG.blopsRealtimeEnabled) {
    console.log('📌 Setting up blops real-time subscription...')

    try {
      supabase
        .channel('blops_realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'blops'
        }, (payload) => {
          console.log('📌 New blop added:', payload.new)
          notifySubscribers('blops', {
            type: 'blop_created',
            data: payload.new,
            timestamp: new Date().toISOString()
          })
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'blops'
        }, (payload) => {
          console.log('📌 Blop updated:', payload.new)
          notifySubscribers('blops', {
            type: 'blop_updated',
            data: payload.new,
            timestamp: new Date().toISOString()
          })
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'blops'
        }, (payload) => {
          console.log('📌 Blop deleted:', payload.old)
          notifySubscribers('blops', {
            type: 'blop_deleted',
            data: payload.old,
            timestamp: new Date().toISOString()
          })
        })
        .subscribe((status, err) => {
          console.log('📌 Blops subscription status:', status)
          if (err) {
            console.error('❌ Blops subscription error:', err)
          }
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to blops real-time updates')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Blops subscription failed - check Supabase RLS policies')
          } else if (status === 'TIMED_OUT') {
            console.error('❌ Blops subscription timed out')
          }
        })
    } catch (error) {
      console.error('❌ Failed to set up blops real-time subscription:', error)
    }
  }
}
}

// Get optimized data with caching
export async function getOptimizedHealthData(locationIds?: string[]): Promise<{
  data: any[]
  cached: boolean
  freshness: number
}> {
  const cacheKey = `health_data_${locationIds?.sort().join('_') || 'all'}`

  // Try cache first
  const cached = getCache(cacheKey)
  if (cached) {
    return {
      data: cached.data,
      cached: true,
      freshness: (Date.now() - cached.timestamp) / 1000 // seconds ago
    }
  }

  // Fetch fresh data
  let query = supabaseAdminFallback
    .from('agency_health_scores')
    .select('*')
    .order('calculated_at', { ascending: false })

  if (locationIds && locationIds.length > 0) {
    query = query.in('location_id', locationIds)
  }

  const { data, error } = await query.limit(locationIds ? locationIds.length : 50)

  if (error) throw error

  // Group by location (latest per location)
  const latestData = new Map()
  data?.forEach(item => {
    if (!latestData.has(item.location_id)) {
      latestData.set(item.location_id, item)
    }
  })

  const result = Array.from(latestData.values())

  // Cache the result
  setCache(cacheKey, result, UPDATE_CONFIG.maxCacheAge)

  return {
    data: result,
    cached: false,
    freshness: 0
  }
}

// Force refresh data for specific locations
export async function refreshData(locationIds: string[], dataTypes: string[] = ['health_scores']): Promise<void> {
  for (const locationId of locationIds) {
    // Clear relevant caches
    const cacheKeys = [
      `health_data_${locationId}`,
      `health_score_${locationId}`,
      `trends_${locationId}`,
      `forecast_${locationId}`
    ]

    // Invalidate caches (implementation depends on your cache system)

    // Trigger immediate updates
    if (dataTypes.includes('health_scores')) {
      const { queueProcessingTask } = await import('./data-processing-engine')
      await queueProcessingTask({
        type: 'health_calculation',
        locationId,
        priority: 'high'
      })
    }

    if (dataTypes.includes('trends')) {
      const { queueProcessingTask } = await import('./data-processing-engine')
      await queueProcessingTask({
        type: 'trend_analysis',
        locationId,
        priority: 'medium'
      })
    }

    if (dataTypes.includes('forecasts')) {
      const { queueProcessingTask } = await import('./data-processing-engine')
      await queueProcessingTask({
        type: 'forecast_update',
        locationId,
        priority: 'medium'
      })
    }
  }

  // Notify subscribers of refresh
  notifySubscribers('health_scores', {
    type: 'refresh_triggered',
    locations: locationIds,
    dataTypes,
    timestamp: new Date().toISOString()
  })
}

// Get system performance metrics
export function getSystemPerformanceMetrics(): {
  uptime: number
  activeTimers: number
  activeSubscribers: number
  cacheSize: number
  lastHealthUpdate?: Date
  lastAlertCheck?: Date
} {
  return {
    uptime: Date.now() - (global as any).systemStartTime || 0,
    activeTimers: updateTimers.size,
    activeSubscribers: Array.from(subscribers.values()).reduce((sum, subs) => sum + subs.size, 0),
    cacheSize: 0, // Would need to implement cache size tracking
  }
}

// Cleanup function for graceful shutdown
export function cleanupRealtimeUpdates() {
  console.log('Cleaning up real-time update system...')

  // Clear all timers
  updateTimers.forEach(timer => clearInterval(timer))
  updateTimers.clear()

  // Clear subscribers
  subscribers.clear()

  // Close database subscriptions (if any)
  supabaseAdminFallback.removeAllChannels()

  isInitialized = false
  console.log('Real-time update system cleaned up')
}

// Global system start time
;(global as any).systemStartTime = Date.now()