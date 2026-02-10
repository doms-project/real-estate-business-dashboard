import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { activityTracker, ActivityType, VALID_ACTIVITY_TYPES } from '@/lib/activity-tracker'
import { getUserWorkspaceRole } from '@/lib/workspace-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30')
    const workspaceId = searchParams.get('workspaceId')

    let activities

    if (workspaceId) {
      // If workspace ID is provided, get activities for that specific workspace
      const userRole = await getUserWorkspaceRole(userId, workspaceId)
      activities = await activityTracker.getWorkspaceActivities(userId, workspaceId, userRole, limit)
    } else {
      // Otherwise, get activities for user's current workspace
      activities = await activityTracker.getRecentActivities(userId, limit)
    }

    return NextResponse.json({
      activities: activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        timestamp: activity.timestamp,
        metadata: activity.metadata
      }))
    })

  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

// POST endpoint for logging activities (internal use)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, title, description, metadata, workspaceId } = await request.json()

    if (!type || !title || !description) {
      return NextResponse.json({ error: 'Missing required fields: type, title, description' }, { status: 400 })
    }

    // Validate activity type
    if (!VALID_ACTIVITY_TYPES.includes(type as ActivityType)) {
      return NextResponse.json({
        error: 'Invalid activity type',
        validTypes: VALID_ACTIVITY_TYPES
      }, { status: 400 })
    }

    // Validate workspace access if workspaceId is provided
    if (workspaceId) {
      try {
        const userRole = await getUserWorkspaceRole(userId, workspaceId)
        if (!userRole) {
          return NextResponse.json({ error: 'No access to specified workspace' }, { status: 403 })
        }
      } catch (workspaceError) {
        return NextResponse.json({ error: 'Invalid workspace' }, { status: 400 })
      }
    }

    await activityTracker.logActivity(userId, type, title, description, workspaceId, metadata)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error logging activity:', error)
    return NextResponse.json(
      { error: 'Failed to log activity' },
      { status: 500 }
    )
  }
}