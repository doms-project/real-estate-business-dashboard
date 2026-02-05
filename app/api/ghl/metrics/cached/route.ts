import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { activityTracker } from '@/lib/activity-tracker'

export async function GET() {
  try {
    console.log('🔧 Environment check:')
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...')
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
    console.log('Full URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Database not configured',
        details: 'Missing Supabase environment variables'
      }, { status: 500 })
    }

    // Create fresh Supabase client (same as refresh endpoint)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Test basic connectivity
    console.log('🧪 Testing basic Supabase connectivity...')
    try {
      const { data: testData, error: testError } = await supabase
        .from('ghl_location_metrics')
        .select('location_id')
        .limit(1)

      console.log('Basic connectivity test - data:', testData)
      console.log('Basic connectivity test - error:', testError)

      if (testError) {
        console.error('❌ Supabase connection test failed:', testError)
        return NextResponse.json({
          success: false,
          error: 'Database connection failed',
          details: testError
        }, { status: 500 })
      }
    } catch (error) {
      console.error('❌ Supabase connection error:', error)
      return NextResponse.json({
        success: false,
        error: 'Database connection error',
        details: error
      }, { status: 500 })
    }

    // Skip table existence check - assume table exists if we can query it

    // Get all cached metrics - simple direct query
    console.log('🗄️ Querying ghl_location_metrics table...')
    console.log('🗄️ Supabase client available:', !!supabase)

    // Get all metrics ordered by last_updated to ensure we get the most recent data
    // Force fresh data - create new client to avoid caching issues
    const freshSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Disable client-side caching
      global: {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      }
    })

    let { data: metrics, error } = await freshSupabase
      .from('ghl_location_metrics')
      .select('*')
      .order('last_updated', { ascending: false })
      .gte('last_updated', '2026-01-01T00:00:00.000Z')
      .limit(50)

    // Deduplicate by location_id, keeping only the most recent record for each location
    if (metrics && metrics.length > 0) {
      const deduplicated = metrics.reduce((acc, curr) => {
        if (!acc[curr.location_id] || new Date(curr.last_updated) > new Date(acc[curr.location_id].last_updated)) {
          acc[curr.location_id] = curr
        }
        return acc
      }, {} as Record<string, any>)

      metrics = Object.values(deduplicated)
      console.log('🗄️ After deduplication - records:', metrics.length)
    }

    console.log('🗄️ Query result - records found:', metrics?.length || 0)

    // Ensure ALL locations with stored data are included (comprehensive fix for cache consistency)
    if (metrics && metrics.length >= 0) { // Allow empty results too
      // Get list of all locations that SHOULD have metrics
      const { data: allLocationsWithMetrics, error: locationsError } = await supabase
        .from('ghl_location_metrics')
        .select('location_id')
        .order('last_updated', { ascending: false });

      if (!locationsError && allLocationsWithMetrics) {
        const expectedLocationIds = new Set(allLocationsWithMetrics.map(loc => loc.location_id));
        const foundLocationIds = new Set(metrics.map(m => m.location_id));

        // Find locations that have data but weren't returned by the main query
        const missingLocationIds = [...expectedLocationIds].filter(id => !foundLocationIds.has(id));

        if (missingLocationIds.length > 0) {
          console.log('⚠️ Missing locations from main query:', missingLocationIds);

          // Fetch missing locations individually
          for (const missingId of missingLocationIds) {
            const { data: missingData, error: missingError } = await supabase
              .from('ghl_location_metrics')
              .select('*')
              .eq('location_id', missingId)
              .single();

            if (missingData && !missingError) {
              metrics.push(missingData);
              console.log(`✅ Added ${missingId} (${missingData.location_name}) to cached results`);
            } else {
              console.log(`⚠️ Could not fetch data for ${missingId}:`, missingError?.message);
            }
          }

          console.log(`📊 Cache now contains ${metrics.length} locations after adding missing ones`);
        } else {
          console.log('✅ All locations with stored data found in main query');
        }
      } else {
        console.log('⚠️ Could not check for missing locations:', locationsError?.message);
      }
    }

    // If no data found, this indicates the table is empty or there's a connection issue
    if (!metrics || metrics.length === 0) {
      console.log('⚠️ No data found in ghl_location_metrics table')
      console.log('This could mean:')
      console.log('1. The refresh endpoint hasn\'t been run yet')
      console.log('2. Data is stored but not visible to this client')
      console.log('3. Table is empty')

      // Return empty result with success to avoid dashboard errors
      return NextResponse.json({
        success: true,
        data: [],
        lastUpdated: new Date().toISOString(),
        source: 'database_empty'
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    console.log('🗄️ Raw metrics data:', JSON.stringify(metrics, null, 2))

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({
        success: false,
        error: (error as any).message || 'Database error',
        details: (error as any).details || error,
        hint: (error as any).hint || 'Check database connection'
      }, {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // Check if data is stale (>30 minutes old)
    let isDataStale = metrics && metrics.length > 0 && (() => {
      const mostRecentUpdate = Math.max(...metrics.map(m => new Date(m.last_updated).getTime()))
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000)
      return mostRecentUpdate < thirtyMinutesAgo
    })()

    console.log(`🗄️ Loaded ${metrics?.length || 0} cached metrics from database`)
    if (metrics && metrics.length > 0) {
      console.log('🗄️ First metric:', JSON.stringify(metrics[0], null, 2))
      console.log('🕐 Data freshness check:', isDataStale ? 'STALE (>30min old)' : 'FRESH')
    }

    // If data is stale, trigger refresh and wait for it to complete, then return fresh data
    if (isDataStale) {
      console.log('⏰ Data is stale, triggering synchronous refresh...')

      try {
        // Trigger refresh and WAIT for it to complete (synchronous approach)
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/metrics/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true })
        })

        console.log('📡 Refresh response status:', refreshResponse.status)

        if (refreshResponse.ok) {
          console.log('✅ Refresh completed successfully')
          const refreshData = await refreshResponse.json()
          console.log('📊 Refresh updated', refreshData.data?.length || 0, 'locations')

          // Aggressive approach: Wait longer and try multiple times to get fresh data
          console.log('🔄 Waiting 3 seconds for database consistency...')
          await new Promise(resolve => setTimeout(resolve, 3000))

          interface GHLLocationMetric {
            location_id: string
            location_name: string
            contacts_count: number
            opportunities_count: number
            conversations_count: number
            health_score: number
            last_updated: string
            created_at: string
          }

          let freshMetrics: GHLLocationMetric[] | null = null
          let attempts = 0
          let lastQueryError = null
          const maxAttempts = 3

          while (!freshMetrics && attempts < maxAttempts) {
            attempts++
            console.log(`🔄 Re-querying database for fresh data (attempt ${attempts}/${maxAttempts})...`)

            // Use fresh client to avoid caching issues
            const reQueryClient = createClient(supabaseUrl, supabaseKey, {
              auth: {
                autoRefreshToken: false,
                persistSession: false,
              },
              global: {
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              }
            })

            const { data, error } = await reQueryClient
              .from('ghl_location_metrics')
              .select('*')
              .order('last_updated', { ascending: false })
              .order('location_id', { ascending: true })
              .gte('last_updated', '2026-01-01T00:00:00.000Z')
              .limit(50)

            if (error) {
              console.error(`❌ Query attempt ${attempts} failed:`, error)
              lastQueryError = error
            } else if (data && data.length > 0) {
              // Deduplicate by location_id, keeping only the most recent record for each location
              const deduplicated = data.reduce((acc, curr) => {
                if (!acc[curr.location_id] || new Date(curr.last_updated) > new Date(acc[curr.location_id].last_updated)) {
                  acc[curr.location_id] = curr
                }
                return acc
              }, {} as Record<string, GHLLocationMetric>)

              freshMetrics = Object.values(deduplicated)
              console.log(`✅ Retrieved data with ${freshMetrics.length} locations on attempt ${attempts} (deduplicated)`)
            }

            if (!freshMetrics && attempts < maxAttempts) {
              console.log(`⏳ Waiting 2 more seconds before retry...`)
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }

          if (lastQueryError) {
            console.error(`❌ Final query attempt failed:`, lastQueryError)
          } else if (freshMetrics && freshMetrics.length > 0) {
            console.log('✅ Retrieved fresh data with', freshMetrics.length, 'locations')
            console.log('🕐 Fresh data timestamp:', freshMetrics[0]?.last_updated)

            // Check if we got fresh data (most recent update should be recent)
            const mostRecentUpdate = Math.max(...freshMetrics.map(m => new Date(m.last_updated).getTime()))
            const now = Date.now()
            const timeDiff = now - mostRecentUpdate
            const isActuallyFresh = timeDiff < (30 * 60 * 1000) // Within 30 minutes (more lenient)

            console.log('🔍 Freshness check details:')
            console.log('  - Most recent update:', new Date(mostRecentUpdate).toISOString())
            console.log('  - Current time:', new Date(now).toISOString())
            console.log('  - Time difference:', Math.round(timeDiff / 1000), 'seconds')
            console.log('  - Is fresh (within 30 min):', isActuallyFresh)

            if (isActuallyFresh) {
              console.log('🎉 Fresh data confirmed! Returning updated metrics to UI')
              metrics = freshMetrics
              isDataStale = false
            } else {
              console.log('⚠️ Data still appears stale after refresh, keeping old data for now')
            }
          }
        } else {
          console.error('❌ Refresh failed with status:', refreshResponse.status)
          const errorText = await refreshResponse.text()
          console.error('❌ Refresh error:', errorText)
        }
      } catch (error) {
        console.error('❌ Refresh process failed:', error)
      }
    }

    // Use current timestamp since this is when data was retrieved
    const lastUpdated = new Date().toISOString()

    // Log metrics access activity
    try {
      const { userId } = await auth()
      if (userId && metrics && metrics.length > 0) {
        await activityTracker.logActivity(
          userId,
          'ghl_metrics_accessed',
          'Metrics Accessed',
          `Viewed cached metrics for ${metrics.length} locations`,
          undefined, // No specific workspace for GHL metrics
          { locationCount: metrics.length, source: 'cached' }
        )
      }
    } catch (activityError) {
      console.error('Failed to log metrics access activity:', activityError)
      // Don't fail the main operation if activity logging fails
    }

    return NextResponse.json({
      success: true,
      data: metrics || [],
      lastUpdated,
      source: 'database',
      isStale: isDataStale || false
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to load cached metrics'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}
