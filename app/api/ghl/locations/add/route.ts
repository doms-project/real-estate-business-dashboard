import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { activityTracker } from '@/lib/activity-tracker'

// Add new GHL location to the database
export async function POST(request: NextRequest) {
  try {
    const locationData = await request.json()

    // Validate required fields
    if (!locationData.id || !locationData.pitToken || !locationData.name) {
      return NextResponse.json({
        success: false,
        error: 'Location ID, PIT Token, and Business Name are required'
      }, { status: 400 })
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Database not configured'
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Prepare location data for database
    const dbLocationData = {
      id: locationData.id,
      name: locationData.name,
      city: locationData.city || null,
      state: locationData.state || null,
      country: locationData.country || 'US',
      address: locationData.address || null,
      pit_token: locationData.pitToken,
      description: locationData.description || locationData.name,
      is_active: true
    }

    console.log('💾 Saving location to database:', dbLocationData.name)

    // Insert or update location in database
    const { data, error } = await supabase
      .from('ghl_locations')
      .upsert(dbLocationData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error saving to database:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to save location to database'
      }, { status: 500 })
    }

    console.log('✅ Location saved successfully:', data.name)

    // Log location addition activity
    try {
      const { userId } = await auth()
      if (userId) {
        await activityTracker.logGHLLocationAdded(userId, data.name)
      }
    } catch (activityError) {
      console.error('Failed to log location addition activity:', activityError)
      // Don't fail the main operation if activity logging fails
    }

    // Also update the JSON file as fallback during migration period
    try {
      const fs = require('fs').promises
      const path = require('path')
      const locationsPath = path.join(process.cwd(), 'lib', 'ghl-locations.json')

      let locations = []
      try {
        const jsonData = await fs.readFile(locationsPath, 'utf8')
        locations = JSON.parse(jsonData)
      } catch (error) {
        console.log('JSON file not found, will be created')
      }

      // Check if location already exists in JSON
      const existingIndex = locations.findIndex((loc: any) => loc.id === locationData.id)
      if (existingIndex >= 0) {
        locations[existingIndex] = {
          ...locations[existingIndex],
          ...dbLocationData,
          pitToken: dbLocationData.pit_token // JSON uses pitToken
        }
      } else {
        locations.push({
          ...dbLocationData,
          pitToken: dbLocationData.pit_token // JSON uses pitToken
        })
      }

      await fs.writeFile(locationsPath, JSON.stringify(locations, null, 2))
      console.log('📄 Also updated JSON file for compatibility')
    } catch (jsonError) {
      console.warn('⚠️ Failed to update JSON file:', jsonError)
      // Don't fail the request if JSON update fails
    }

    return NextResponse.json({
      success: true,
      message: 'Location added successfully',
      location: data,
      note: 'Location saved to database. JSON file also updated for compatibility.'
    })

  } catch (error) {
    console.error('Add location error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add location. Please try again.'
    }, { status: 500 })
  }
}
