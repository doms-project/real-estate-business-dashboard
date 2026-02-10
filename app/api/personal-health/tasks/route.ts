import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/personal-health/tasks - Get user's tasks
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
    const completed = searchParams.get('completed')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin!
      .from('personal_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (completed !== null) {
      query = query.eq('completed', completed === 'true')
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching tasks:', error)
      return NextResponse.json(
        { error: 'Failed to fetch tasks', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error: any) {
    console.error('Error in GET /api/personal-health/tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/personal-health/tasks - Create a new task
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
      priority = 'medium',
      due_date,
      category = 'general'
    } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const taskData = {
      user_id: userId,
      title: title.trim(),
      description: description?.trim(),
      priority,
      due_date,
      category,
      completed: false
    }

    const { data, error } = await supabaseAdmin!
      .from('personal_tasks')
      .insert(taskData)
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      return NextResponse.json(
        { error: 'Failed to create task', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error in POST /api/personal-health/tasks:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}