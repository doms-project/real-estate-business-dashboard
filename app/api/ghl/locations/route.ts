import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GHL_LOCATIONS } from '@/lib/ghl-config' // Fallback for migration period

export async function GET(request: NextRequest) {
  try {
    console.log(`🔍 Loading locations from database...`)

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase configuration')
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check if this is a server-side request (includes pitTokens for internal use)
    const url = new URL(request.url)
    const includeTokens = url.searchParams.get('internal') === 'true'

    // Try to load from database first
    console.log('📊 Querying ghl_locations table...')
    const { data: dbLocations, error: dbError } = await supabase
      .from('ghl_locations')
      .select('*')
      .eq('is_active', true)
      .order('name')

    console.log('📊 Database query result:', { count: dbLocations?.length || 0, error: dbError })

    if (dbError) {
      console.warn('⚠️ Database query failed, falling back to JSON:', dbError)

      // Fallback to JSON file during migration period
      const locations = GHL_LOCATIONS
      let locationData
      if (includeTokens) {
        console.log('🔐 Server-side request - including pitTokens (fallback)')
        locationData = locations
      } else {
        console.log('🌐 Client-side request - stripping pitTokens (fallback)')
        locationData = locations.map(({ pitToken, description, ...location }) => ({
          ...location,
          email: `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
          phone: '',
          website: '',
          logoUrl: undefined
        }))
      }

      return NextResponse.json({
        locations: locationData,
        totalLocationsFound: locationData.length,
        source: 'json_fallback',
        includesTokens: includeTokens,
        timestamp: new Date().toISOString(),
        note: 'Using JSON fallback - run migration to use database'
      })
    }

    // Transform database records to match expected format
    let locationData
    if (includeTokens) {
      // Include pitTokens for server-side requests (internal API calls)
      console.log('🔐 Server-side request - including pitTokens from database')
      locationData = dbLocations.map(location => ({
        id: location.id,
        name: location.name,
        city: location.city,
        state: location.state,
        country: location.country,
        address: location.address,
        pitToken: location.pit_token, // Database uses pit_token, API expects pitToken
        description: location.description,
        email: `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
        phone: '',
        website: '',
        logoUrl: undefined
      }))
    } else {
      // Strip sensitive data for client-side requests
      console.log('🌐 Client-side request - stripping pitTokens from database')
      locationData = dbLocations.map(({ pit_token, description, created_at, updated_at, created_by, is_active, ...location }) => ({
        ...location,
        email: `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
        phone: '',
        website: '',
        logoUrl: undefined
      }))
    }

    console.log(`✅ Returning ${locationData.length} locations from database:`, locationData.map(l => `${l.name} (${l.id})`))

    return NextResponse.json({
      locations: locationData,
      totalLocationsFound: locationData.length,
      source: 'database',
      includesTokens: includeTokens,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('🚨 Location loading failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to load locations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
