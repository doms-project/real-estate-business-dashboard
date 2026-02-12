import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/user/metadata - Update Clerk user metadata
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

    const body = await request.json()
    const { targetUserId, metadata } = body

    if (!targetUserId || !metadata) {
      return NextResponse.json(
        { error: 'targetUserId and metadata are required' },
        { status: 400 }
      )
    }

    // Only allow users to update their own metadata or admins to update others
    // For now, we'll allow self-updates and admin updates
    if (targetUserId !== userId) {
      // TODO: Add admin permission check if needed
      console.warn(`User ${userId} attempting to update metadata for ${targetUserId}`)
    }

    try {
      const { clerkClient } = await import('@clerk/nextjs/server')
      await clerkClient.users.updateUser(targetUserId, {
        publicMetadata: metadata
      })

      console.log(`✅ Updated metadata for user ${targetUserId}:`, metadata)
      return NextResponse.json({ success: true })
    } catch (clerkError: any) {
      console.error('Failed to update Clerk user metadata:', clerkError)
      return NextResponse.json(
        { error: 'Failed to update user metadata', details: clerkError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error in PATCH /api/user/metadata:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}