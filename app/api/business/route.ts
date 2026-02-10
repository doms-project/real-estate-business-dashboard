import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/business - Get all businesses for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Get businesses with their campaigns
    const { data: businesses, error } = await supabaseAdmin!
      .from('businesses')
      .select(`
        *,
        campaigns (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching businesses:', error)
      return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      businesses: businesses || []
    })

  } catch (error) {
    console.error('Business API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/business - Create a new business
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const body = await request.json()
    const { name, description, type } = body

    if (!name) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    const { data: business, error } = await supabaseAdmin!
      .from('businesses')
      .insert({
        user_id: userId,
        name,
        description,
        type: type || 'marketing'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating business:', error)
      return NextResponse.json({ error: 'Failed to create business' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      business
    })

  } catch (error) {
    console.error('Business creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}