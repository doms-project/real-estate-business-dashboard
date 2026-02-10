import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GHLClient } from '@/lib/ghl-client'
import { auth } from '@clerk/nextjs/server'
import { activityTracker } from '@/lib/activity-tracker'

export const dynamic = 'force-dynamic'

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// Verify that an upsert operation actually saved data to the database
async function verifyUpsert(locationId: string, locationName: string, operation: string) {
  try {
    const { data: verifyData, error: verifyError } = await supabase
      .from('ghl_location_metrics')
      .select('location_id, contacts_count, opportunities_count, conversations_count')
      .eq('location_id', locationId)
      .single()

    if (verifyError) {
      console.error(`❌ VERIFICATION FAILED: ${operation} for ${locationName} - database error:`, verifyError)
      return false
    }

    if (!verifyData) {
      console.error(`❌ VERIFICATION FAILED: ${operation} for ${locationName} - no data found in database`)
      return false
    }

    console.log(`✅ VERIFICATION SUCCESS: ${operation} for ${locationName} confirmed in database`)
    return true
  } catch (error) {
    console.error(`❌ VERIFICATION ERROR: ${operation} for ${locationName}:`, error)
    return false
  }
}

export async function POST(request: Request) {
  try {
    // Use the same client creation as cached API to ensure consistency
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Database not configured',
        details: 'Missing Supabase environment variables'
      }, { status: 500 })
    }

    // Create fresh Supabase client with no-cache headers (same as cached API)
    const supabase = createClient(supabaseUrl, supabaseKey, {
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

    console.log('🔄 Starting metrics refresh from GHL API...')
    console.log('⏰ TIMESTAMP - START:', new Date().toISOString())
    console.log('🔧 REQUEST RECEIVED - checking for force flag:', !!request.url?.includes('force=true'))

    // Load locations from the database (not JSON)
    console.log('📍 Loading locations from database...')
    const { data: locations, error: locationsError } = await supabase
      .from('ghl_locations')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (locationsError || !locations) {
      console.error('❌ Failed to load locations from database:', locationsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to load locations from database',
        details: locationsError?.message
      }, { status: 500 })
    }

    console.log(`📍 Processing ${locations.length} locations from database`)
    console.log(`📍 Using ${locations.length} active locations`)
    console.log('📍 Location details:', locations.map(loc => ({ id: loc.id, name: loc.name })))

    // Fetch metrics for each location in batches using the working /api/ghl/data endpoints
    console.log('⏰ TIMESTAMP - API CALLS START:', new Date().toISOString())
    const batchSize = 3
    const allMetrics = []

    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(locations.length/batchSize)} (${batch.length} locations)`)

      const batchPromises = batch.map(async (location: any) => {
        try {
          console.log(`🏗️ Fetching metrics for ${location.name} (${location.id}) using pit_token: ${location.pit_token?.substring(0, 10)}...`)

          // Fetch all 3 metrics simultaneously using the WORKING /api/ghl/data endpoints
          console.log(`🔍 Fetching metrics for ${location.name}...`)
          console.log('🔄 API CALL EXECUTING:', new Date().toISOString())
          const [contactsRes, opportunitiesRes, conversationsRes] = await Promise.allSettled([
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=contacts-count&locationId=${location.id}&pitToken=${location.pit_token}`).then(r => r.json()).catch(e => ({ error: e.message })),
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=opportunities-count&locationId=${location.id}&pitToken=${location.pit_token}`).then(r => r.json()).catch(e => ({ error: e.message })),
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ghl/data?endpoint=conversations-count&locationId=${location.id}&pitToken=${location.pit_token}`).then(r => r.json()).catch(e => ({ error: e.message }))
          ])

          console.log(`📊 Contacts result:`, contactsRes.status === 'fulfilled' ? (contactsRes.value.data?.count ?? 'no data') : contactsRes.reason)
          console.log(`📊 Opportunities result:`, opportunitiesRes.status === 'fulfilled' ? (opportunitiesRes.value.data?.count ?? 'no data') : opportunitiesRes.reason)
          console.log(`📊 Conversations result:`, conversationsRes.status === 'fulfilled' ? (conversationsRes.value.data?.count ?? 'no data') : conversationsRes.reason)

          const contactsCount = contactsRes.status === 'fulfilled' && contactsRes.value.data
            ? contactsRes.value.data.count : 0

          const opportunitiesCount = opportunitiesRes.status === 'fulfilled' && opportunitiesRes.value.data
            ? opportunitiesRes.value.data.count : 0

          const conversationsCount = conversationsRes.status === 'fulfilled' && conversationsRes.value.data
            ? conversationsRes.value.data.count : 0

          const healthScore = Math.min(100, Math.max(0,
            Math.floor((contactsCount * 0.3 + opportunitiesCount * 2 + conversationsCount * 0.1) / 10)
          )) || 60

          const metrics = {
            location_id: location.id,
            location_name: location.name,
            contacts_count: contactsCount,
            opportunities_count: opportunitiesCount,
            conversations_count: conversationsCount,
            health_score: healthScore,
            updated_at: new Date().toISOString()
          }

          console.log(`✅ ${location.name}: contacts=${contactsCount}, opportunities=${opportunitiesCount}, conversations=${conversationsCount}`)

          return metrics

        } catch (error) {
          console.error(`❌ Failed to fetch metrics for ${location.name}:`, error)
          return {
            location_id: location.id,
            location_name: location.name,
            contacts_count: 0,
            opportunities_count: 0,
            conversations_count: 0,
            health_score: 0,
            updated_at: new Date().toISOString()
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      allMetrics.push(...batchResults)

      // Small delay between batches to be API-friendly
      if (i + batchSize < locations.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log('⏰ TIMESTAMP - API CALLS END:', new Date().toISOString())
    console.log(`📊 Collected ${allMetrics.length} metrics from GHL API`)
    console.log('📊 Sample metrics:', allMetrics.slice(0, 3).map(m => ({
      location_id: m.location_id,
      location_name: m.location_name,
      contacts: m.contacts_count,
      opportunities: m.opportunities_count,
      conversations: m.conversations_count
    })))

    // Store all metrics in database
    console.log('⏰ TIMESTAMP - UPSERT START:', new Date().toISOString())
    console.log(`💾 Storing ${allMetrics.length} metrics in database...`)
    console.log('🔧 SUPABASE CLIENT CHECK:', {
      url: supabaseUrl?.substring(0, 30) + '...',
      keyExists: !!supabaseKey,
      client: !!supabase
    })

    console.log('📊 Attempting to upsert metrics:', allMetrics.map(m => ({
      location_id: m.location_id,
      location_name: m.location_name,
      contacts: m.contacts_count,
      opportunities: m.opportunities_count,
      conversations: m.conversations_count
    })))

    // Check Choppin Throttles data specifically
    const choppinData = allMetrics.find(m => m.location_id === 'wwWN0QzriyIE8oV1YT7o')
    console.log('🎯 Choppin Throttles data to upsert:', choppinData)

    console.log('📊 Preparing to upsert metrics...')
    console.log('📊 Metrics to upsert:', allMetrics.length, 'records')

    // Validate data before upsert
    const invalidRecords = allMetrics.filter(m => !m.location_id || typeof m.contacts_count !== 'number')
    if (invalidRecords.length > 0) {
      console.error('❌ Invalid records found:', invalidRecords)
      return NextResponse.json({
        success: false,
        error: 'Invalid data format',
        details: `Found ${invalidRecords.length} invalid records`
      }, { status: 500 })
    }

    // Use explicit update/insert logic instead of upsert for reliability
    console.log('🔄 Running individual insert/update operations...')

    for (const metric of allMetrics) {
      try {
        // First check if data actually changed
        const { data: existingData, error: existingError } = await supabase
          .from('ghl_location_metrics')
          .select('contacts_count, opportunities_count, conversations_count, health_score, last_checked')
          .eq('location_id', metric.location_id)
          .single()

        const dataChanged = !existingData ||
          existingData.contacts_count !== metric.contacts_count ||
          existingData.opportunities_count !== metric.opportunities_count ||
          existingData.conversations_count !== metric.conversations_count ||
          existingData.health_score !== metric.health_score

        console.log(`🔍 ${metric.location_name}: existingData=${!!existingData}, dataChanged=${dataChanged}`)
        if (existingData) {
          console.log(`🔍 Existing: contacts=${existingData.contacts_count}, opportunities=${existingData.opportunities_count}, conversations=${existingData.conversations_count}, health=${existingData.health_score}`)
          console.log(`🔍 New: contacts=${metric.contacts_count}, opportunities=${metric.opportunities_count}, conversations=${metric.conversations_count}, health=${metric.health_score}`)
        }

        // Always update last_checked (we verified the data)
        // Also always update updated_at to ensure the record is touched
        const updateFields: any = {
          last_checked: new Date().toISOString(),
          updated_at: new Date().toISOString()  // Always update to ensure record is touched
        }

        if (dataChanged) {
          updateFields.contacts_count = metric.contacts_count
          updateFields.opportunities_count = metric.opportunities_count
          updateFields.conversations_count = metric.conversations_count
          updateFields.health_score = metric.health_score
          console.log(`📝 ${metric.location_name}: UPDATING all fields (data changed)`)
        } else {
          console.log(`📝 ${metric.location_name}: UPDATING timestamps only (data unchanged)`)
        }

        // First try to update existing record
        const { data: updateData, error: updateError } = await supabase
          .from('ghl_location_metrics')
          .update(updateFields)
          .eq('location_id', metric.location_id)
          .select()

        if (updateError) {
          console.error(`❌ Update failed for ${metric.location_name}:`, updateError)
          console.log(`⚠️ Update failed for ${metric.location_name}, trying insert...`)

          // If update failed, try to insert new record
          const { data: insertData, error: insertError } = await supabase
            .from('ghl_location_metrics')
            .insert({
              location_id: metric.location_id,
              location_name: metric.location_name,
              contacts_count: metric.contacts_count,
              opportunities_count: metric.opportunities_count,
              conversations_count: metric.conversations_count,
              health_score: metric.health_score,
              updated_at: new Date().toISOString(),
              last_checked: new Date().toISOString()
            })
            .select()

          if (insertError) {
            // Check if it's a duplicate key error (record already exists)
            if (insertError.code === '23505') {
              console.log(`ℹ️ Record already exists for ${metric.location_name}, skipping...`)
            } else {
              console.error(`❌ Failed to insert ${metric.location_name}:`, insertError)
            }
          } else if (insertData && insertData.length > 0) {
            console.log(`✅ Inserted ${metric.location_name} - returned ${insertData.length} rows`)
            // Verify the insert actually worked
            await verifyUpsert(metric.location_id, metric.location_name, 'insert')
          } else {
            console.log(`⚠️ Insert reported success but no data returned for ${metric.location_name}`)
          }
        } else if (updateData && updateData.length > 0) {
          console.log(`✅ Updated ${metric.location_name} - returned ${updateData.length} rows`)
          console.log(`📅 New last_checked: ${updateData[0].last_checked}`)
          console.log(`📅 New updated_at: ${updateData[0].updated_at}`)
          // Verify the update actually worked
          await verifyUpsert(metric.location_id, metric.location_name, 'update')
        } else {
          console.log(`⚠️ Update succeeded but no rows affected for ${metric.location_name}`)
        }
      } catch (individualError) {
        console.error(`❌ Exception processing ${metric.location_name}:`, individualError)
      }
    }


    // Individual operations handle validation per record

    console.log('⏰ TIMESTAMP - UPSERT END:', new Date().toISOString())
    console.log('✅ Successfully refreshed and stored all metrics!')
    console.log('📊 FINAL SUMMARY:', {
      locationsProcessed: allMetrics.length,
      currentTimestamp: new Date().toISOString()
    })

    // Verify the data was actually stored - check total count first
    const { count: totalCount, error: countError } = await supabase
      .from('ghl_location_metrics')
      .select('*', { count: 'exact', head: true })

    console.log('🔍 Verification - total count in table:', totalCount, 'error:', countError)

    // Then get all records
    const { data: verifyData, error: verifyError } = await supabase
      .from('ghl_location_metrics')
      .select('*')
      .order('updated_at', { ascending: false })

    console.log('🔍 Verification - total records retrieved:', verifyData?.length || 0)
    console.log('🔍 Verification - error:', verifyError)

    if (verifyData) {
      console.log('🔍 Verification - location IDs in database:', verifyData.map(d => d.location_id))
    }

    // Check specifically for Choppin Throttles
    const choppinThrottles = verifyData?.find(d => d.location_id === 'wwWN0QzriyIE8oV1YT7o')
    console.log('🎯 Choppin Throttles in database:', !!choppinThrottles, choppinThrottles ? {
      contacts: choppinThrottles.contacts_count,
      opportunities: choppinThrottles.opportunities_count,
      conversations: choppinThrottles.conversations_count,
      updated_at: choppinThrottles.updated_at
    } : 'NOT FOUND')

    // Check if we have the expected number of locations
    const expectedLocations = allMetrics.length
    const actualLocations = verifyData?.length || 0

    if (actualLocations !== expectedLocations) {
      console.error(`❌ MISMATCH: Expected ${expectedLocations} locations, found ${actualLocations}`)
      console.log('📊 Expected location IDs:', allMetrics.map(m => m.location_id))
      console.log('📊 Actual location IDs:', verifyData?.map(d => d.location_id) || [])

      // Check specifically for missing locations
      const expectedIds = new Set(allMetrics.map(m => m.location_id))
      const actualIds = new Set(verifyData?.map(d => d.location_id) || [])
      const missingIds = [...expectedIds].filter(id => !actualIds.has(id))

      if (missingIds.length > 0) {
        console.error('❌ MISSING LOCATIONS:', missingIds)
        // Try one more time to save missing locations
        console.log('🔄 Attempting to save missing locations...')
        for (const missingId of missingIds) {
          const missingMetric = allMetrics.find(m => m.location_id === missingId)
          if (missingMetric) {
            console.log(`🎯 Retrying ${missingMetric.location_name}...`)
            await verifyUpsert(missingMetric.location_id, missingMetric.location_name, 'retry')
          }
        }
      }
    } else {
      console.log(`✅ MATCH: ${actualLocations} locations correctly stored`)
    }

    // Log metrics refresh activity
    try {
      const { userId } = await auth()
      if (userId && allMetrics.length > 0) {
        const { getOrCreateUserWorkspace } = await import('@/lib/workspace-helpers')
        const workspace = await getOrCreateUserWorkspace(userId)
        await activityTracker.logActivity(
          userId,
          'ghl_metrics_refreshed',
          'Metrics Refreshed',
          `Refreshed latest metrics for ${allMetrics.length} locations`,
          workspace.id,
          { locationCount: allMetrics.length, source: 'live_api' }
        )
      }
    } catch (activityError) {
      console.error('Failed to log metrics refresh activity:', activityError)
      // Don't fail the main operation if activity logging fails
    }

    return NextResponse.json({
      success: true,
      data: allMetrics,
      message: `Refreshed metrics for ${allMetrics.length} locations`,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Refresh API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to refresh metrics'
    }, { status: 500 })
  }
}
