import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrCreateUserWorkspace, getUserWorkspaces } from '@/lib/workspace-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/subscriptions - Fetch workspace subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    // Get user's workspaces
    const workspaces = await getUserWorkspaces(userId)
    const workspaceIds = workspaces.map(w => w.id)

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .in('workspace_id', workspaceIds)
      .order('renewal_date', { ascending: true })

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ subscriptions: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/subscriptions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/subscriptions - Save subscriptions (replace all)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { subscriptions, workspaceId } = body

    if (!Array.isArray(subscriptions)) {
      return NextResponse.json(
        { error: 'Invalid request: subscriptions must be an array' },
        { status: 400 }
      )
    }

    // Get or create workspace
    const workspace = await getOrCreateUserWorkspace(userId)
    const targetWorkspaceId = workspaceId || workspace.id

    // Delete existing subscriptions for this workspace
    const { error: deleteError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('workspace_id', targetWorkspaceId)

    if (deleteError) {
      console.error('Error deleting existing subscriptions:', deleteError)
      // Continue anyway - might be first time saving
    }

    // Insert new subscriptions
    const subscriptionsToInsert = subscriptions.map((sub: any) => ({
      id: sub.id, // Include the frontend ID to preserve existing records
      user_id: userId,
      workspace_id: targetWorkspaceId,
      name: sub.name,
      cost: sub.cost || 0,
      period: sub.period,
      renewal_date: sub.renewal_date || sub.renewalDate,
      category: sub.category,
      website_id: sub.website_id || sub.websiteId || null,
    }))

    const { data, error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert(subscriptionsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting subscriptions:', insertError)
      return NextResponse.json(
        { error: 'Failed to save subscriptions', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      subscriptions: data,
      message: `Saved ${data.length} subscriptions`
    })
  } catch (error: any) {
    console.error('Error in POST /api/subscriptions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/subscriptions?id=subscription_id - Delete a specific subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('id')

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      )
    }

    // Get user's workspaces
    const workspaces = await getUserWorkspaces(userId)
    const workspaceIds = workspaces.map(w => w.id)

    // Delete the specific subscription if it belongs to user's workspace
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('id', subscriptionId)
      .in('workspace_id', workspaceIds)
      .select()

    if (error) {
      console.error('Error deleting subscription:', error)
      return NextResponse.json(
        { error: 'Failed to delete subscription', details: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Subscription not found or access denied' },
        { status: 404 }
      )
    }

    // Notify other pages that subscriptions have been updated
    return NextResponse.json({
      success: true,
      message: 'Subscription deleted successfully',
      deletedSubscription: data[0]
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/subscriptions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

