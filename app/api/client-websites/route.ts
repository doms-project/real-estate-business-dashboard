import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/client-websites?ghlLocationId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ghlLocationId = searchParams.get('ghlLocationId')

    if (!ghlLocationId) {
      return NextResponse.json({ error: 'ghlLocationId parameter required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('client_websites')
      .select('*')
      .eq('ghl_location_id', ghlLocationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching client websites:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return just the siteIds for easy consumption
    const siteIds = data.map(row => row.site_id)
    const websites = data

    return NextResponse.json({
      ghlLocationId,
      websites,
      siteIds,
      total: siteIds.length
    })

  } catch (error) {
    console.error('Error in GET /api/client-websites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/client-websites - Add a website mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ghlLocationId, siteId, websiteName, websiteUrl } = body

    if (!ghlLocationId || !siteId) {
      return NextResponse.json({
        error: 'ghlLocationId and siteId are required'
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('client_websites')
      .upsert({
        ghl_location_id: ghlLocationId,
        site_id: siteId,
        website_name: websiteName,
        website_url: websiteUrl,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'ghl_location_id,site_id'
      })
      .select()

    if (error) {
      console.error('Error creating client website mapping:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mapping: data[0]
    })

  } catch (error) {
    console.error('Error in POST /api/client-websites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/client-websites?ghlLocationId=...&siteId=...
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ghlLocationId = searchParams.get('ghlLocationId')
    const siteId = searchParams.get('siteId')

    if (!ghlLocationId || !siteId) {
      return NextResponse.json({
        error: 'ghlLocationId and siteId parameters required'
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('client_websites')
      .delete()
      .eq('ghl_location_id', ghlLocationId)
      .eq('site_id', siteId)

    if (error) {
      console.error('Error deleting client website mapping:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE /api/client-websites:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}