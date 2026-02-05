import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/personal-health/goals/[id] - Get a specific health goal
export async function GET(
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

    if (!id) {
      return NextResponse.json(
        { error: 'Goal ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin!
      .from('health_goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Health goal not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching health goal:', error)
      return NextResponse.json(
        { error: 'Failed to fetch health goal', details: error.message },
        { status: 500 }
      )
    }

    const goalWithProgress = {
      ...data,
      progress_percentage: data.target_value > 0
        ? Math.min(100, Math.round((data.current_value / data.target_value) * 100))
        : 0,
      days_remaining: data.deadline
        ? Math.max(0, Math.ceil((new Date(data.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : null
    }

    return NextResponse.json({
      success: true,
      data: goalWithProgress
    })

  } catch (error: any) {
    console.error('Error in GET /api/personal-health/goals/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/personal-health/goals/[id] - Update a health goal
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

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Goal ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      category,
      target_value,
      target_unit,
      current_value,
      deadline,
      completed
    } = body

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title must be a non-empty string' },
          { status: 400 }
        )
      }
      updateData.title = title.trim()
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    if (category !== undefined) {
      updateData.category = category
    }

    if (target_value !== undefined) {
      updateData.target_value = target_value ? Number(target_value) : null
    }

    if (target_unit !== undefined) {
      updateData.target_unit = target_unit?.trim()
    }

    if (current_value !== undefined) {
      updateData.current_value = Number(current_value) || 0
    }

    if (deadline !== undefined) {
      updateData.deadline = deadline
    }

    if (completed !== undefined) {
      updateData.completed = Boolean(completed)
    }

    const { data, error } = await supabaseAdmin!
      .from('health_goals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Health goal not found' },
          { status: 404 }
        )
      }
      console.error('Error updating health goal:', error)
      return NextResponse.json(
        { error: 'Failed to update health goal', details: error.message },
        { status: 500 }
      )
    }

    const goalWithProgress = {
      ...data,
      progress_percentage: data.target_value > 0
        ? Math.min(100, Math.round((data.current_value / data.target_value) * 100))
        : 0,
      days_remaining: data.deadline
        ? Math.max(0, Math.ceil((new Date(data.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : null
    }

    return NextResponse.json({
      success: true,
      data: goalWithProgress
    })

  } catch (error: any) {
    console.error('Error in PUT /api/personal-health/goals/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/personal-health/goals/[id] - Delete a health goal
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

    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Goal ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin!
      .from('health_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting health goal:', error)
      return NextResponse.json(
        { error: 'Failed to delete health goal', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Health goal deleted successfully'
    })

  } catch (error: any) {
    console.error('Error in DELETE /api/personal-health/goals/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}