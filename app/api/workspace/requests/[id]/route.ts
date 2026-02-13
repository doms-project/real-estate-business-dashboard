import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { approveWorkspaceRequest, rejectWorkspaceRequest } from '@/lib/workspace-helpers'
import { notifySubscribers } from '@/lib/realtime-updates'

/**
 * PATCH /api/workspace/requests/[id] - Approve or reject a workspace request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { action, rejectionReason } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be either "approve" or "reject"' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      const { request, workspace } = await approveWorkspaceRequest(id, userId)

      // Notify real-time subscribers about the approval and new workspace
      notifySubscribers('workspace_requests', {
        type: 'request_approved',
        data: { request, workspace }
      })

      return NextResponse.json({
        success: true,
        request,
        workspace,
        message: 'Workspace creation request approved and workspace created successfully'
      })
    } else {
      const result = await rejectWorkspaceRequest(id, userId, rejectionReason)

      // Notify real-time subscribers about the rejection
      notifySubscribers('workspace_requests', {
        type: 'request_rejected',
        data: result
      })

      return NextResponse.json({
        success: true,
        request: result,
        message: 'Workspace creation request rejected'
      })
    }
  } catch (error: any) {
    console.error('Error in PATCH /api/workspace/requests/[id]:', error)

    if (error.message.includes('permission')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }

    if (error.message.includes('not found or already processed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}