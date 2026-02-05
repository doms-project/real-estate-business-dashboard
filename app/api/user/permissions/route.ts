import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserWorkspaceRole, getHighestUserRole } from '@/lib/workspace-helpers'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId parameter is required' },
        { status: 400 }
      )
    }

    let role: 'owner' | 'admin' | 'member' | null

    if (workspaceId === 'global') {
      // For workspace creation permissions, check global highest role
      role = await getHighestUserRole(userId)
    } else {
      // For workspace-specific permissions, check role in that workspace
      role = await getUserWorkspaceRole(userId, workspaceId)
    }

    const canCreateWorkspaceDirectly = role === 'owner' || role === 'admin'

    return NextResponse.json({
      role,
      canCreateWorkspaceDirectly,
      permissions: {
        canManageWorkspaceRequests: role === 'owner' || role === 'admin',
        canApproveRequests: role === 'owner' || role === 'admin',
        canCreateWorkspacesDirectly: canCreateWorkspaceDirectly
      }
    })
  } catch (error: any) {
    console.error('Error in GET /api/user/permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}