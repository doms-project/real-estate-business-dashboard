import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getWorkspaceMembers, getUserWorkspaceRole, userHasWorkspaceAccess } from '@/lib/workspace-helpers'
import { activityTracker } from '@/lib/activity-tracker'

export const dynamic = 'force-dynamic'

/**
 * GET /api/workspace/members - Get workspace members
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

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      )
    }

    // Check if user has access to this workspace
    const hasAccess = await userHasWorkspaceAccess(userId, workspaceId)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this workspace' },
        { status: 403 }
      )
    }

    const members = await getWorkspaceMembers(workspaceId)

    // Also get the current user's role
    const userRole = await getUserWorkspaceRole(userId, workspaceId)

    return NextResponse.json({ members, userRole })
  } catch (error: any) {
    console.error('Error in GET /api/workspace/members:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workspace/members - Update a member's role in workspace
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

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const memberUserId = searchParams.get('userId')
    const { role: newRole } = await request.json()

    if (!workspaceId || !memberUserId || !newRole) {
      return NextResponse.json(
        { error: 'workspaceId, userId, and role are required' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['admin', 'member'].includes(newRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin or member' },
        { status: 400 }
      )
    }

    // Check if requester has admin/owner role
    const requesterRole = await getUserWorkspaceRole(userId, workspaceId)
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have permission to update member roles' },
        { status: 403 }
      )
    }

    // Cannot change the owner's role
    const memberRole = await getUserWorkspaceRole(memberUserId, workspaceId)
    if (memberRole === 'owner') {
      return NextResponse.json(
        { error: 'Cannot change workspace owner role' },
        { status: 400 }
      )
    }

    // Cannot change your own role if you're an admin (only owner can change admin roles)
    if (memberUserId === userId && requesterRole !== 'owner') {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      )
    }

    // Get current member info for activity logging
    const currentMember = await getWorkspaceMembers(workspaceId).then(members =>
      members.find(m => m.user_id === memberUserId)
    )

    if (!currentMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    const oldRole = currentMember.role

    // Update member role
    const { error: updateError } = await supabaseAdmin
      .from('workspace_members')
      .update({ role: newRole })
      .eq('workspace_id', workspaceId)
      .eq('user_id', memberUserId)

    if (updateError) {
      console.error('Error updating member role:', updateError)
      return NextResponse.json(
        { error: 'Failed to update member role', details: updateError.message },
        { status: 500 }
      )
    }

    // Log the role change activity
    try {
      await activityTracker.logTeamMemberRoleUpdated(
        userId,
        `user_${memberUserId.slice(-8)}`, // Use truncated user ID as email placeholder
        oldRole,
        newRole,
        workspaceId
      )
    } catch (logError) {
      console.error('Error logging role change activity:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Member role updated successfully'
    })
  } catch (error: any) {
    console.error('Error in PATCH /api/workspace/members:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workspace/members - Remove a member from workspace
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('DELETE /api/workspace/members - Starting request')
    const { userId } = await auth()

    if (!userId) {
      console.log('DELETE /api/workspace/members - No userId from auth')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('DELETE /api/workspace/members - User authenticated:', userId)

    if (!supabaseAdmin) {
      console.log('DELETE /api/workspace/members - No supabaseAdmin configured')
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const memberUserId = searchParams.get('userId')

    console.log('DELETE /api/workspace/members - Params:', { workspaceId, memberUserId })

    if (!workspaceId || !memberUserId) {
      console.log('DELETE /api/workspace/members - Missing required params')
      return NextResponse.json(
        { error: 'workspaceId and userId are required' },
        { status: 400 }
      )
    }

    // Check if requester has admin/owner role
    console.log('DELETE /api/workspace/members - Checking permissions for user:', userId, 'in workspace:', workspaceId)
    const requesterRole = await getUserWorkspaceRole(userId, workspaceId)
    console.log('DELETE /api/workspace/members - Requester role:', requesterRole)

    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      console.log('DELETE /api/workspace/members - Insufficient permissions')
      return NextResponse.json(
        { error: 'You do not have permission to remove members' },
        { status: 403 }
      )
    }

    // Cannot remove the owner
    const memberRole = await getUserWorkspaceRole(memberUserId, workspaceId)
    console.log('DELETE /api/workspace/members - Member role:', memberRole)

    if (memberRole === 'owner') {
      console.log('DELETE /api/workspace/members - Cannot remove owner')
      return NextResponse.json(
        { error: 'Cannot remove workspace owner' },
        { status: 400 }
      )
    }

    // Cannot remove yourself if you're an admin (only owner can remove themselves)
    if (memberUserId === userId && requesterRole !== 'owner') {
      console.log('DELETE /api/workspace/members - Cannot remove self as admin')
      return NextResponse.json(
        { error: 'You cannot remove yourself' },
        { status: 400 }
      )
    }

    console.log('DELETE /api/workspace/members - Proceeding with deletion')

    // Remove member
    const { error: deleteError, data } = await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', memberUserId)
      .select()

    console.log('DELETE /api/workspace/members - Delete result:', { data, error: deleteError })

    if (deleteError) {
      console.error('Error removing member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove member', details: deleteError.message },
        { status: 500 }
      )
    }

    console.log('DELETE /api/workspace/members - Member removed successfully')
    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/workspace/members:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}









