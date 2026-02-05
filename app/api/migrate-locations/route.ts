import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseAdminFallback } from '@/lib/supabase'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting GHL locations migration via API...')

    // Use fallback client that always works (even with anon key)
    const dbClient = supabaseAdmin || supabaseAdminFallback

    if (!dbClient) {
      return NextResponse.json({
        success: false,
        error: 'No database client available'
      }, { status: 500 })
    }

    // Test database connection before proceeding
    try {
      const { data: testData, error: testError } = await dbClient
        .from('ghl_locations')
        .select('count')
        .limit(1)

      if (testError && testError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is OK
        console.error('❌ Database connection test failed:', testError)
        return NextResponse.json({
          success: false,
          error: `Database connection failed: ${testError.message}`,
          details: 'Check your Supabase credentials and network connection'
        }, { status: 500 })
      }
      console.log('✅ Database connection test passed')
    } catch (connError) {
      console.error('❌ Database connection error:', connError)
      return NextResponse.json({
        success: false,
        error: 'Cannot connect to database',
        details: 'Check your Supabase URL and service role key'
      }, { status: 500 })
    }

    // Read the JSON file
    const locationsPath = path.join(process.cwd(), 'lib', 'ghl-locations.json')
    console.log('📁 Reading locations from:', locationsPath)

    const jsonData = await fs.readFile(locationsPath, 'utf8')
    const locations = JSON.parse(jsonData)

    console.log(`📊 Found ${locations.length} locations in JSON file`)

    // Transform and insert data
    const transformedLocations = locations.map((location: any) => ({
      id: location.id,
      name: location.name,
      city: location.city || null,
      state: location.state || null,
      country: location.country || 'US',
      address: location.address || null,
      pit_token: location.pitToken, // JSON uses pitToken, DB uses pit_token
      description: location.description || location.name,
      is_active: true
    }))

    console.log('🔄 Inserting locations into database...')

    // Insert in batches to avoid overwhelming the database
    const batchSize = 10
    let inserted = 0
    let updated = 0

    for (let i = 0; i < transformedLocations.length; i += batchSize) {
      const batch = transformedLocations.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(transformedLocations.length/batchSize)}`)

      const { data, error } = await dbClient
        .from('ghl_locations')
        .upsert(batch, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()

      if (error) {
        console.error('❌ Error inserting batch:', error)
        return NextResponse.json({
          success: false,
          error: `Database error: ${error.message}`
        }, { status: 500 })
      }

      console.log(`✅ Batch inserted/updated ${data.length} locations`)
      inserted += data.length
    }

    console.log(`\n🎉 Migration completed!`)
    console.log(`📈 Total locations processed: ${locations.length}`)
    console.log(`✅ Successfully migrated to database`)

    // Verify the migration
    const { data: verifyData, error: verifyError } = await dbClient
      .from('ghl_locations')
      .select('id, name')
      .eq('is_active', true)

    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError)
    } else {
      console.log(`🔍 Verification: ${verifyData.length} active locations in database`)
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      stats: {
        totalProcessed: locations.length,
        databaseLocations: verifyData?.length || 0,
        locationNames: verifyData?.map(l => l.name) || []
      }
    })

  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}