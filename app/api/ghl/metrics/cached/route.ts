import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { activityTracker } from '@/lib/activity-tracker'

export const dynamic = 'force-dynamic'

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

    // Get all metrics ordered by last_checked to ensure we get the most recently verified data
    // Force fresh data - create new client to avoid caching issues
    const freshSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // Disable client-side caching
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    })

    let { data: metrics, error } = await freshSupabase
      .from('ghl_location_metrics')
      .select('*')
      .order('last_checked', { ascending: false }) // Prioritize recently checked data
      .gte('updated_at', '2026-01-01T00:00:00.000Z')
      .limit(50)

    // Deduplicate by location_id, keeping only the most recent record for each location
    if (metrics && metrics.length > 0) {
      const deduplicated = metrics.reduce((acc, curr) => {
        const currChecked = new Date(curr.last_checked || curr.updated_at)
        const accChecked = acc[curr.location_id] ? new Date(acc[curr.location_id].last_checked || acc[curr.location_id].updated_at) : new Date(0)
        if (!acc[curr.location_id] || currChecked > accChecked) {
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
        .order('updated_at', { ascending: false });

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
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000)

      // Data is fresh if EITHER:
      // 1. It actually changed recently (updated_at is recent), OR
      // 2. We verified it recently (last_checked is recent)
      const dataChangedRecently = metrics.some(m => new Date(m.updated_at).getTime() > thirtyMinutesAgo)
      const checkedRecently = metrics.some(m => {
        const lastChecked = m.last_checked || m.updated_at
        return new Date(lastChecked).getTime() > thirtyMinutesAgo
      })

      const isStale = !dataChangedRecently && !checkedRecently

      console.log('🔍 STALENESS CHECK DETAILS:')
      console.log('  - Current time:', new Date().toISOString())
      console.log('  - 30 minutes ago:', new Date(thirtyMinutesAgo).toISOString())
      console.log('  - Data changed recently:', dataChangedRecently)
      console.log('  - Checked recently:', checkedRecently)
      console.log('  - Is stale:', isStale)

      if (!isStale) {
        console.log('  ✅ Data is fresh - either recently changed or recently verified')
      } else {
        console.log('  ⚠️ Data is stale - neither recently changed nor recently verified')
      }

      return isStale
    })()

    console.log(`🗄️ Loaded ${metrics?.length || 0} cached metrics from database`)
    if (metrics && metrics.length > 0) {
      console.log('🗄️ First metric last_checked:', metrics[0]?.last_checked)
      console.log('🗄️ First metric updated_at:', metrics[0]?.updated_at)
      console.log('🕐 Data freshness check:', isDataStale ? 'STALE (>30min old)' : 'FRESH')
    }

    // If data is stale, trigger refresh and wait for it to complete, then return fresh data
    if (isDataStale) {
      console.log('⏰ Data is stale, triggering synchronous refresh...')
      console.log('🔗 Refresh URL:', `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/metrics/refresh`)

      try {
        // Trigger refresh and WAIT for it to complete (synchronous approach)
        const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/metrics/refresh?force=true`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })

        console.log('📡 Refresh response status:', refreshResponse.status)
        console.log('📡 Refresh response ok:', refreshResponse.ok)

        if (refreshResponse.ok) {
          console.log('✅ Refresh completed successfully')
          const refreshData = await refreshResponse.json()
          console.log('📊 Refresh updated', refreshData.data?.length || 0, 'locations')

          // Aggressive approach: Wait longer and try multiple times to get fresh data
          console.log('🔄 Waiting 5 seconds for database consistency and transaction commit...')
          await new Promise(resolve => setTimeout(resolve, 5000))

          interface GHLLocationMetric {
            location_id: string
            location_name: string
            contacts_count: number
            opportunities_count: number
            conversations_count: number
            health_score: number
            updated_at: string
            created_at: string
            last_checked?: string
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
                  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                  'Pragma': 'no-cache',
                  'Expires': '0',
                  'X-Cache-Bust': Date.now().toString() // Force fresh query with timestamp
                }
              }
            })

            // Query with last_checked priority and cache-busting parameter
            const { data, error } = await reQueryClient
              .from('ghl_location_metrics')
              .select('*')
              .order('last_checked', { ascending: false }) // Prioritize recently checked records
              .order('location_id', { ascending: true })
              .gte('updated_at', '2026-01-01T00:00:00.000Z')
              .limit(50)

            if (error) {
              console.error(`❌ Query attempt ${attempts} failed:`, error)
              lastQueryError = error
            } else if (data && data.length > 0) {
              // Deduplicate by location_id, keeping only the most recently checked record for each location
              const deduplicated = data.reduce((acc, curr) => {
                const currChecked = new Date(curr.last_checked || curr.updated_at)
                const accChecked = acc[curr.location_id] ? new Date(acc[curr.location_id].last_checked || acc[curr.location_id].updated_at) : new Date(0)
                if (!acc[curr.location_id] || currChecked > accChecked) {
                  acc[curr.location_id] = curr
                }
                return acc
              }, {} as Record<string, GHLLocationMetric>)

              freshMetrics = Object.values(deduplicated)
              console.log(`✅ Retrieved data with ${freshMetrics.length} locations on attempt ${attempts} (deduplicated)`)
              if (freshMetrics.length > 0) {
                const mostRecentChecked = freshMetrics[0]?.last_checked || freshMetrics[0]?.updated_at
                console.log(`🕐 Most recent last_checked: ${mostRecentChecked}`)
                console.log(`🕐 Fresh data sample:`, freshMetrics[0])
              }
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
            console.log('🕐 Fresh data last_checked:', freshMetrics[0]?.last_checked)
            console.log('🕐 Fresh data updated_at:', freshMetrics[0]?.updated_at)

            // Check if we got fresh data using improved logic
            const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000)
            const dataChangedRecently = freshMetrics.some(m => new Date(m.updated_at).getTime() > thirtyMinutesAgo)
            const checkedRecently = freshMetrics.some(m => {
              const lastChecked = m.last_checked || m.updated_at
              return new Date(lastChecked).getTime() > thirtyMinutesAgo
            })

            const isActuallyFresh = dataChangedRecently || checkedRecently

            console.log('🔍 Post-refresh freshness check details:')
            console.log('  - Current time:', new Date().toISOString())
            console.log('  - 30 minutes ago:', new Date(thirtyMinutesAgo).toISOString())
            console.log('  - Data changed recently:', dataChangedRecently)
            console.log('  - Checked recently:', checkedRecently)
            console.log('  - Is fresh (changed OR checked recently):', isActuallyFresh)

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

    // Log metrics access activity (optional - don't fail if headers unavailable)
    try {
      // Skip activity logging for static generation or when headers unavailable
      const { userId } = await auth()
      if (userId && metrics && metrics.length > 0) {
        const { getOrCreateUserWorkspace } = await import('@/lib/workspace-helpers')
        const workspace = await getOrCreateUserWorkspace(userId)
        await activityTracker.logActivity(
          userId,
          'ghl_metrics_accessed',
          'Metrics Accessed',
          `Viewed cached metrics for ${metrics.length} locations`,
          workspace.id,
          { locationCount: metrics.length, source: 'cached' }
        )
      }
    } catch (activityError) {
      // Silently skip activity logging for static generation or auth errors
      console.log('Activity logging skipped (likely static generation):', activityError instanceof Error ? activityError.message : String(activityError))
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
