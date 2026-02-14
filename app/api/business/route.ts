import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrCreateUserWorkspace, getUserVisibleBusinesses } from '@/lib/workspace-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/business - Fetch workspace businesses with role-based access control
 * - Owners/Admins: see all businesses in their workspaces
 * - Members: see only their own businesses in workspaces
 * - Also includes legacy businesses (workspace_id = null) created by the user
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

    // Get workspace filter from query params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Get businesses visible to user based on their workspace roles
    let businesses
    try {
      if (workspaceId) {
        // Filter by specific workspace
        businesses = await getUserVisibleBusinesses(userId)
        businesses = businesses?.filter(b => b.workspace_id === workspaceId) || []
        console.log('🏢 BUSINESSES FILTERED BY WORKSPACE:', workspaceId, 'Found:', businesses?.length || 0)
      } else {
        // Show all accessible businesses (original behavior)
        businesses = await getUserVisibleBusinesses(userId)
        console.log('🏢 BUSINESSES FROM getUserVisibleBusinesses:', businesses?.length || 0)
      }
      businesses?.forEach(b => console.log(`  - ${b.name} (${b.id})`))
    } catch (error: any) {
      // If workspace system fails, fall back to legacy user_id filtering
      console.warn('Could not fetch businesses with role-based filtering, falling back to user_id filter:', error.message)

      const { data, error: fallbackError } = await supabaseAdmin
        .from('businesses')
        .select(`
          *,
          campaigns (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fallbackError) {
        console.error('Error in fallback business fetch:', fallbackError)
        return NextResponse.json(
          { error: 'Failed to fetch businesses', details: fallbackError.message },
          { status: 500 }
        )
      }

      businesses = data || []
    }

    // Get campaigns for visible businesses
    if (businesses && businesses.length > 0) {
      const businessIds = businesses.map(b => b.id)
      console.log('🔍 BUSINESS IDS for campaign query:', businessIds)

      const { data: campaigns, error: campaignsError } = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .in('business_id', businessIds)
        .order('created_at', { ascending: false })

      console.log('📊 CAMPAIGNS FETCHED:', campaigns?.length || 0, 'campaigns')
      console.log('📊 CAMPAIGNS ERROR:', campaignsError)

      if (!campaignsError && campaigns) {
        // Group campaigns by business_id
        const campaignsByBusiness = campaigns.reduce((acc, campaign) => {
          if (!acc[campaign.business_id]) {
            acc[campaign.business_id] = []
          }
          acc[campaign.business_id].push(campaign)
          return acc
        }, {} as Record<string, any[]>)

        console.log('📊 CAMPAIGNS GROUPED BY BUSINESS:', Object.keys(campaignsByBusiness))

        // Add campaigns to businesses
        businesses = businesses.map(business => ({
          ...business,
          campaigns: campaignsByBusiness[business.id] || []
        }))

        console.log('📊 BUSINESSES WITH CAMPAIGNS ATTACHED:')
        businesses.forEach(b => {
          console.log(`  ${b.name}: ${b.campaigns?.length || 0} campaigns`)
        })
      }
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
 * PUT /api/business - Update an existing business
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const body = await request.json()
    const { id, name, description, type, workspaceId } = body

    if (!id) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    // Verify the business belongs to the user and workspace
    const { data: existingBusiness, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existingBusiness) {
      return NextResponse.json({ error: 'Business not found or access denied' }, { status: 404 })
    }

    // If workspaceId is provided, verify it matches (allow updating null workspace_id to a valid workspace)
    if (workspaceId && existingBusiness.workspace_id && existingBusiness.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Update the business - only update fields that are provided
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type

    const { data: updatedBusiness, error: updateError } = await supabaseAdmin
      .from('businesses')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating business:', updateError)
      return NextResponse.json({ error: 'Failed to update business' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      business: updatedBusiness
    })

  } catch (error) {
    console.error('Business update error:', error)
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
    const { name, description, type, workspaceId } = body

    if (!name) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
    }

    // Get or create workspace (handle case where workspace tables don't exist yet)
    let targetWorkspaceId = workspaceId
    try {
      if (!targetWorkspaceId) {
        const workspace = await getOrCreateUserWorkspace(userId)
        targetWorkspaceId = workspace.id
      }
    } catch (workspaceError: any) {
      // If workspace tables don't exist, use null workspace_id (legacy behavior)
      console.warn('Could not get/create workspace, using null workspace_id:', workspaceError.message)
      targetWorkspaceId = null
    }

    const { data: business, error } = await supabaseAdmin!
      .from('businesses')
      .insert({
        user_id: userId,
        workspace_id: targetWorkspaceId,
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
