import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { activityTracker } from '@/lib/activity-tracker'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/blops/[id] - Update a single blop
 */
export async function PUT(
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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const blopId = params.id
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('blops')
      .update({
        x: body.x,
        y: body.y,
        shape: body.shape,
        color: body.color,
        title: body.title,
        content: body.content,
        type: body.type,
        tags: body.tags,
        connections: body.connections,
      })
      .eq('id', blopId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating blop:', error)
      return NextResponse.json(
        { error: 'Failed to update blop', details: error.message },
        { status: 500 }
      )
    }

    // Log blop update activity
    try {
      await activityTracker.logBlopUpdated(userId, data.content, data.workspace_id)
    } catch (activityError) {
      console.error('Failed to log blop update activity:', activityError)
      // Don't fail the main operation if activity logging fails
    }

    return NextResponse.json({ success: true, blop: data })
  } catch (error: any) {
    console.error('Error in PUT /api/blops/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/blops/[id] - Delete a blop
 */
export async function DELETE(
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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const blopId = params.id

    // Get blop content and workspace before deleting
    const { data: blopData, error: fetchError } = await supabaseAdmin
      .from('blops')
      .select('content, workspace_id')
      .eq('id', blopId)
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching blop:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch blop', details: fetchError.message },
        { status: 500 }
      )
    }

    // If blop was found, use workspace_id for deletion
    // If blop was not found (PGRST116), it might have been deleted already
    if (fetchError?.code === 'PGRST116') {
      console.log('Blop not found, may have been deleted already')
      return NextResponse.json({ success: true, message: 'Blop not found, possibly already deleted' })
    }

    // Delete the blop - use workspace_id if available, otherwise try without it
    let deleteQuery = supabaseAdmin
      .from('blops')
      .delete()
      .eq('id', blopId)
      .eq('user_id', userId)

    if (blopData?.workspace_id) {
      deleteQuery = deleteQuery.eq('workspace_id', blopData.workspace_id)
    }

    const { error } = await deleteQuery

    console.log('Delete operation result:', error)
    if (error) {
      console.error('Error deleting blop:', error)
      return NextResponse.json(
        { error: 'Failed to delete blop', details: error.message },
        { status: 500 }
      )
    }

    // Log blop deletion activity
    if (blopData?.content) {
      try {
        await activityTracker.logBlopDeleted(userId, blopData.content, blopData.workspace_id)
      } catch (activityError) {
        console.error('Failed to log blop deletion activity:', activityError)
        // Don't fail the main operation if activity logging fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/blops/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

