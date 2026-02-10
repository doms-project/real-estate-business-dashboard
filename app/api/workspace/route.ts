import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrCreateUserWorkspace, getUserWorkspaces, getUserWorkspaceRole, canCreateWorkspaceDirectly, hasApprovedRequest } from '@/lib/workspace-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/workspace - Get user's current workspace
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

    const workspace = await getOrCreateUserWorkspace(userId)
    const workspaces = await getUserWorkspaces(userId)

    return NextResponse.json({ 
      workspace,
      workspaces 
    })
  } catch (error: any) {
    console.error('Error in GET /api/workspace:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workspace - Create a new workspace
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
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      )
    }

    // Check if user can create workspace directly (owners and admins)
    const canCreateDirectly = await canCreateWorkspaceDirectly(userId)

    if (!canCreateDirectly) {
      // For members, check if they have an approved request
      const hasApproval = await hasApprovedRequest(userId, name.trim())

      if (!hasApproval) {
        return NextResponse.json(
          { error: 'You need approval from an admin or owner to create a workspace. Please submit a workspace creation request first.' },
          { status: 403 }
        )
      }
    }

    // Create workspace
    const { data: workspace, error: createError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name: name.trim(),
        owner_id: userId,
      })
      .select()
      .single()

    if (createError || !workspace) {
      console.error('Error creating workspace:', createError)

      // Check for duplicate workspace name error
      if (createError?.message?.includes('unique_workspace_name_per_owner') ||
          createError?.code === '23505') { // PostgreSQL unique constraint violation
        return NextResponse.json(
          { error: 'You already have a workspace with this name. Please choose a different name.' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create workspace', details: createError?.message },
        { status: 500 }
      )
    }

    // Add user as owner member
    await supabaseAdmin
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner',
      })

    return NextResponse.json({ 
      success: true,
      workspace 
    })
  } catch (error: any) {
    console.error('Error in POST /api/workspace:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workspace - Update workspace name
 */
export async function PATCH(request: NextRequest) {
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
    const { workspaceId, name } = body

    if (!workspaceId || !name?.trim()) {
      return NextResponse.json(
        { error: 'Workspace ID and name are required' },
        { status: 400 }
      )
    }

    // Verify user has permission (owner or admin)
    const userRole = await getUserWorkspaceRole(userId, workspaceId)

    if (!userRole || (userRole !== 'owner' && userRole !== 'admin')) {
      return NextResponse.json(
        { error: 'Workspace not found or you do not have permission to update it' },
        { status: 403 }
      )
    }

    // Verify workspace exists
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .single()

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Update workspace name
    const { error: updateError } = await supabaseAdmin
      .from('workspaces')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update workspace name', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Workspace name updated successfully'
    })
  } catch (error: any) {
    console.error('Error updating workspace:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workspace - Delete a workspace
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
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    // Verify user has owner permission
    const userRole = await getUserWorkspaceRole(userId, workspaceId)

    if (userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Only workspace owners can delete workspaces' },
        { status: 403 }
      )
    }

    // Get workspace name for confirmation
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Delete all related data in the correct order to avoid foreign key constraints
    // 1. Delete activities (references properties, websites, etc.)
    await supabaseAdmin
      .from('activities')
      .delete()
      .eq('workspace_id', workspaceId)

    // 2. Delete properties
    await supabaseAdmin
      .from('properties')
      .delete()
      .eq('workspace_id', workspaceId)

    // 3. Delete websites
    await supabaseAdmin
      .from('websites')
      .delete()
      .eq('workspace_id', workspaceId)

    // 4. Delete blops
    await supabaseAdmin
      .from('blops')
      .delete()
      .eq('workspace_id', workspaceId)

    // 5. Delete maintenance requests
    await supabaseAdmin
      .from('work_requests')
      .delete()
      .eq('workspace_id', workspaceId)

    // 6. Delete agency clients
    await supabaseAdmin
      .from('agency_clients')
      .delete()
      .eq('workspace_id', workspaceId)

    // 7. Delete invitations
    await supabaseAdmin
      .from('invitations')
      .delete()
      .eq('workspace_id', workspaceId)

    // 8. Delete workspace members
    await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)

    // 9. Finally delete the workspace itself
    const { error: deleteError } = await supabaseAdmin
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)

    if (deleteError) {
      console.error('Error deleting workspace:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete workspace', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Workspace "${workspace.name}" has been permanently deleted`
    })
  } catch (error: any) {
    console.error('Error deleting workspace:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}





