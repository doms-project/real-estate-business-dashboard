import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/business/[businessId]/campaigns - Get campaigns for a specific business
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = params.businessId

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Verify business ownership
    const { data: business, error: businessError } = await supabaseAdmin!
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('user_id', userId)
      .single()

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Get campaigns for this business
    const { data: campaigns, error } = await supabaseAdmin!
      .from('campaigns')
      .select('*')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaigns: campaigns || []
    })

  } catch (error) {
    console.error('Campaigns API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/business/[businessId]/campaigns - Create a new campaign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    console.log('📡 CAMPAIGN CREATE API called')
    console.log('📡 Business ID:', params.businessId)

    const { userId } = await auth()
    console.log('👤 User ID from auth:', userId)

    if (!userId) {
      console.log('❌ No user ID - unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = params.businessId

    if (!supabaseAdmin) {
      console.log('❌ Database connection failed')
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    console.log('🔍 Verifying business ownership...')

    // Verify business ownership
    const { data: business, error: businessError } = await supabaseAdmin!
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('user_id', userId)
      .single()

    console.log('🏢 Business lookup result:', { business, error: businessError })

    if (businessError || !business) {
      console.log('❌ Business not found or access denied')
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    console.log('📨 Parsing request body...')
    const body = await request.json()
    console.log('📊 Request body:', body)
    const {
      name,
      status = 'draft',
      platform = 'manual',
      ghl_campaign_id,
      budget,
      spent,
      currency = 'USD',
      impressions = 0,
      clicks = 0,
      conversions = 0,
      start_date,
      end_date,
      target_audience,
      notes
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })
    }

    // Calculate derived metrics
    const ctr = impressions > 0 ? Math.min((clicks / impressions) * 100, 100) : 0
    const cpc = clicks > 0 ? spent / clicks : 0
    const cpa = conversions > 0 ? spent / conversions : 0
    const roas = spent > 0 ? (conversions * 100) / spent : 0

    console.log('💾 Creating campaign in database...')

    const campaignData = {
      business_id: businessId,
      user_id: userId,
      name,
      status,
      platform,
      ghl_campaign_id,
      budget: budget ? parseFloat(budget) : null,
      spent: spent ? parseFloat(spent) : null,
      currency,
      impressions: parseInt(impressions) || 0,
      clicks: parseInt(clicks) || 0,
      conversions: parseInt(conversions) || 0,
      ctr: Math.round(ctr * 10000) / 10000,
      cpc: Math.round(cpc * 10000) / 10000,
      cpa: Math.round(cpa * 10000) / 10000,
      roas: Math.round(roas * 100) / 100,
      start_date,
      end_date,
      target_audience,
      notes
    }

    console.log('📊 Campaign data to insert:', campaignData)

    const { data: campaign, error } = await supabaseAdmin!
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single()

    console.log('📡 Database insert result:', { campaign, error })

    if (error) {
      console.error('❌ Error creating campaign:', error)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    console.log('✅ Campaign created successfully:', campaign)

    return NextResponse.json({
      success: true,
      campaign
    })

  } catch (error) {
    console.error('Campaign creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}