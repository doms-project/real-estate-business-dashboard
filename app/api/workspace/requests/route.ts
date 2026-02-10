import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'
import {
  getPendingWorkspaceRequests,
  getUserWorkspaceRequests,
  submitWorkspaceCreationRequest
} from '@/lib/workspace-helpers'
import { notifySubscribers } from '@/lib/realtime-updates'

/**
 * GET /api/workspace/requests - Get workspace creation requests
 * For admins/owners: get all pending requests
 * For regular users: get their own requests
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'pending' for admins, 'my' for users

    if (type === 'my') {
      // Get user's own requests
      const requests = await getUserWorkspaceRequests(userId)
      return NextResponse.json({ requests })
    } else {
      // Get pending requests (for admins/owners)
      const requests = await getPendingWorkspaceRequests(userId)
      return NextResponse.json({ requests })
    }
  } catch (error: any) {
    console.error('Error in GET /api/workspace/requests:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workspace/requests - Submit a workspace creation request
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

    const body = await request.json()
    const { workspaceName, reason, workspaceContext } = body

    if (!workspaceName || typeof workspaceName !== 'string' || workspaceName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      )
    }

    const requestResult = await submitWorkspaceCreationRequest(userId, workspaceName, reason, workspaceContext)

    // Notify real-time subscribers about the new request
    notifySubscribers('workspace_requests', {
      type: 'request_created',
      data: requestResult
    })

    return NextResponse.json({
      success: true,
      request: requestResult,
      message: 'Workspace creation request submitted successfully'
    })
  } catch (error: any) {
    console.error('Error in POST /api/workspace/requests:', error)

    if (error.message.includes('already have a pending request')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    if (error.message.includes('permission to create workspaces directly')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}