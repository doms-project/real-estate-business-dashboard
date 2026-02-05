import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrCreateUserWorkspace, getUserWorkspaces } from '@/lib/workspace-helpers'
import { activityTracker } from '@/lib/activity-tracker'

/**
 * GET /api/websites - Fetch workspace websites
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

    // Get user's workspaces (handle case where workspace tables don't exist yet)
    let workspaceIds: string[] = []
    try {
      const workspaces = await getUserWorkspaces(userId)
      workspaceIds = workspaces.map(w => w.id)
    } catch (workspaceError: any) {
      // If workspace tables don't exist, fall back to user_id filtering
      console.warn('Could not fetch workspaces, falling back to user_id filter:', workspaceError.message)
    }

    // Build query - always filter by user_id to ensure we get all user's websites
    // This ensures websites are found even if workspace system has issues
    const { data, error } = await supabaseAdmin
      .from('websites')
      .select('*')
      .eq('user_id', userId) // Always filter by user_id - this is the primary filter
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching websites:', error)
      return NextResponse.json(
        { error: 'Failed to fetch websites', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ websites: data || [] })
  } catch (error: any) {
    console.error('Error in GET /api/websites:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/websites - Save websites (replace all)
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
    const { websites, workspaceId } = body

    if (!Array.isArray(websites)) {
      return NextResponse.json(
        { error: 'Invalid request: websites must be an array' },
        { status: 400 }
      )
    }

    // Get or create workspace (handle case where workspace tables don't exist yet)
    let targetWorkspaceId = workspaceId
    try {
      if (!targetWorkspaceId) {
        const workspace = await getOrCreateUserWorkspace(userId)
        targetWorkspaceId = workspace.id
      }
    } catch (workspaceError: any) {
      // If workspace tables don't exist, use a default workspace ID or null
      console.warn('Could not get/create workspace, using null workspace_id:', workspaceError.message)
      targetWorkspaceId = null
    }

    // Delete existing websites for this workspace (or all user's websites if no workspace)
    let deleteQuery = supabaseAdmin
      .from('websites')
      .delete()
      .eq('user_id', userId)

    if (targetWorkspaceId) {
      deleteQuery = deleteQuery.eq('workspace_id', targetWorkspaceId)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error('Error deleting existing websites:', deleteError)
      // Continue anyway - might be first time saving
    }

    // Prepare websites for upsert
    const websitesToInsert = websites.map((site: any) => ({
      id: site.id, // Include the frontend ID to preserve existing records
      user_id: userId,
      workspace_id: targetWorkspaceId,
      url: site.url,
      name: site.name,
      tech_stack: site.tech_stack || site.techStack || {},
      linked_blops: site.linked_blops || site.linkedBlops || null,
      subscription_ids: site.subscription_ids || site.subscriptionIds || null,
    })).filter(site => {
      // Validate required fields and UUID format
      if (!site.id || !site.url || !site.name) return false

      // Check if ID is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      return uuidRegex.test(site.id)
    })

    // Check which websites already exist before upsert
    const existenceChecks = await Promise.all(
      websitesToInsert.map(async (site: any) => {
        // If website has an ID, check if it exists
        if (site.id && supabaseAdmin) {
          try {
            const { data } = await supabaseAdmin
              .from('websites')
              .select('id')
              .eq('id', site.id)
              .eq('user_id', userId)
              .single()
            return { id: site.id, existed: !!data }
          } catch {
            return { id: site.id, existed: false }
          }
        } else {
          // No ID or no supabase means it's definitely new
          return { id: site.id, existed: false }
        }
      })
    )

    const existenceMap = new Map(existenceChecks.map(check => [check.id, check.existed]))

    const { data, error: insertError } = await supabaseAdmin
      .from('websites')
      .upsert(websitesToInsert, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()

    if (insertError) {
      console.error('Error upserting websites:', insertError)
      return NextResponse.json(
        { error: 'Failed to save websites', details: insertError.message },
        { status: 500 }
      )
    }

    // Log activity for saved websites (non-blocking)
    data.forEach(async (website: any) => {
      try {
        // Check if this website existed before the save operation
        const existedBefore = existenceMap.get(website.id) || false

        if (!existedBefore) {
          await activityTracker.logWebsiteAdded(userId, website.name || website.url, targetWorkspaceId)
        } else {
          await activityTracker.logWebsiteUpdated(userId, website.name || website.url, targetWorkspaceId)
        }
      } catch (activityError) {
        console.error('Failed to log website activity:', activityError)
        // Don't fail the main operation if activity logging fails
      }
    })

    return NextResponse.json({
      success: true,
      websites: data,
      message: `Saved ${data.length} websites`
    })
  } catch (error: any) {
    console.error('Error in POST /api/websites:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/websites?id=website_id - Delete a specific website
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
    const websiteId = searchParams.get('id')

    if (!websiteId) {
      return NextResponse.json(
        { error: 'Website ID is required' },
        { status: 400 }
      )
    }

    // Get user's workspaces (handle case where workspace tables don't exist yet)
    let workspaceIds: string[] = []
    try {
      const workspaces = await getUserWorkspaces(userId)
      workspaceIds = workspaces.map(w => w.id)
    } catch (workspaceError: any) {
      // If workspace tables don't exist, fall back to user_id filtering
      console.warn('Could not fetch workspaces, falling back to user_id filter:', workspaceError.message)
    }

    // Delete the specific website if it belongs to user (and optionally workspace)
    // We need to handle both websites with workspace_id = null and websites with specific workspace_ids
    let deleteQuery = supabaseAdmin
      .from('websites')
      .delete()
      .eq('id', websiteId)
      .eq('user_id', userId) // Always check user ownership

    if (workspaceIds.length > 0) {
      // Allow deletion of websites that either:
      // 1. Belong to one of the user's workspaces, OR
      // 2. Have workspace_id = null (legacy websites saved before workspace system)
      deleteQuery = deleteQuery.or(`workspace_id.in.(${workspaceIds.join(',')}),workspace_id.is.null`)
    }

    console.log('DELETE website:', { websiteId, userId, workspaceIds })

    const { data, error } = await deleteQuery.select()

    console.log('DELETE result:', { data, error })

    if (error) {
      console.error('Error deleting website:', error)
      return NextResponse.json(
        { error: 'Failed to delete website', details: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.log('No website found to delete - checking if website exists at all...')
      // Check if the website exists but user doesn't have access
      const { data: existsCheck, error: existsError } = await supabaseAdmin
        .from('websites')
        .select('id, user_id, workspace_id')
        .eq('id', websiteId)
        .single()

      console.log('Website existence check:', { existsCheck, existsError })

      return NextResponse.json(
        { error: 'Website not found or access denied' },
        { status: 404 }
      )
    }

    // Log website deletion activity
    try {
      await activityTracker.logWebsiteDeleted(userId, data[0].name || data[0].url, data[0].workspace_id)
    } catch (activityError) {
      console.error('Failed to log website deletion activity:', activityError)
      // Don't fail the main operation if activity logging fails
    }

    // Notify other pages that websites have been updated
    return NextResponse.json({
      success: true,
      message: 'Website deleted successfully',
      deletedWebsite: data[0]
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/websites:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

