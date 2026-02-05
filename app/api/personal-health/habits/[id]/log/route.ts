import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/personal-health/habits/[id]/log - Log a habit completion
export async function POST(
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

    const { id: habitId } = params

    if (!habitId) {
      return NextResponse.json(
        { error: 'Habit ID is required' },
        { status: 400 }
      )
    }

    // Verify habit exists and belongs to user
    const { data: habit, error: habitError } = await supabaseAdmin!
      .from('personal_habits')
      .select('id, name, target_count, frequency')
      .eq('id', habitId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (habitError || !habit) {
      return NextResponse.json(
        { error: 'Habit not found or inactive' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      completed_date = new Date().toISOString().split('T')[0],
      count = 1,
      notes
    } = body

    // Validate count
    if (count < 1) {
      return NextResponse.json(
        { error: 'Count must be at least 1' },
        { status: 400 }
      )
    }

    // Check if already logged for this date
    const { data: existingLog } = await supabaseAdmin!
      .from('habit_logs')
      .select('id, count, notes')
      .eq('habit_id', habitId)
      .eq('user_id', userId)
      .eq('completed_date', completed_date)
      .single()

    let result
    if (existingLog) {
      // Update existing log
      const newCount = existingLog.count + count
      const { data, error } = await supabaseAdmin!
        .from('habit_logs')
        .update({
          count: newCount,
          notes: notes || existingLog.notes
        })
        .eq('id', existingLog.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating habit log:', error)
        return NextResponse.json(
          { error: 'Failed to update habit log', details: error.message },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new log
      const { data, error } = await supabaseAdmin!
        .from('habit_logs')
        .insert({
          habit_id: habitId,
          user_id: userId,
          completed_date,
          count,
          notes: notes?.trim()
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating habit log:', error)
        return NextResponse.json(
          { error: 'Failed to create habit log', details: error.message },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: existingLog ? 'Habit log updated' : 'Habit logged successfully'
    })

  } catch (error: any) {
    console.error('Error in POST /api/personal-health/habits/[id]/log:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// GET /api/personal-health/habits/[id]/log - Get habit logs
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

    const { id: habitId } = params

    if (!habitId) {
      return NextResponse.json(
        { error: 'Habit ID is required' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabaseAdmin!
      .from('habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('user_id', userId)
      .order('completed_date', { ascending: false })
      .limit(limit)

    if (startDate) {
      query = query.gte('completed_date', startDate)
    }

    if (endDate) {
      query = query.lte('completed_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching habit logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch habit logs', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error: any) {
    console.error('Error in GET /api/personal-health/habits/[id]/log:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}