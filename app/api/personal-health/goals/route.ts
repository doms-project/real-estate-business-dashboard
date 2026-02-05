import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/personal-health/goals - Get user's health goals
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
    const category = searchParams.get('category')
    const completed = searchParams.get('completed')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin!
      .from('health_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq('category', category)
    }

    if (completed !== null) {
      query = query.eq('completed', completed === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching health goals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch health goals', details: error.message },
        { status: 500 }
      )
    }

    // Calculate progress for each goal
    const goalsWithProgress = data?.map((goal: any) => ({
      ...goal,
      progress_percentage: goal.target_value > 0
        ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
        : 0,
      days_remaining: goal.deadline
        ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : null
    })) || []

    return NextResponse.json({
      success: true,
      data: goalsWithProgress,
      count: goalsWithProgress.length
    })

  } catch (error: any) {
    console.error('Error in GET /api/personal-health/goals:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/personal-health/goals - Create a new health goal
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
    const {
      title,
      description,
      category,
      target_value,
      target_unit,
      deadline,
      current_value = 0
    } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    const goalData = {
      user_id: userId,
      title: title.trim(),
      description: description?.trim(),
      category,
      target_value: target_value ? Number(target_value) : null,
      target_unit: target_unit?.trim(),
      current_value: Number(current_value) || 0,
      deadline,
      completed: false
    }

    const { data, error } = await supabaseAdmin!
      .from('health_goals')
      .insert(goalData)
      .select()
      .single()

    if (error) {
      console.error('Error creating health goal:', error)
      return NextResponse.json(
        { error: 'Failed to create health goal', details: error.message },
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
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error in POST /api/personal-health/goals:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}