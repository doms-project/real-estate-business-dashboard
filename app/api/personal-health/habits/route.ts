import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/personal-health/habits - Get user's habits
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
    const active = searchParams.get('active')
    const frequency = searchParams.get('frequency')
    const includeStats = searchParams.get('includeStats') === 'true'

    let query = supabaseAdmin!
      .from('personal_habits')
      .select(`
        *,
        ${includeStats ? `
          habit_logs(count, completed_date),
          current_streak:habit_logs!inner(count)
        ` : ''}
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (active !== null) {
      query = query.eq('is_active', active === 'true')
    }

    if (frequency) {
      query = query.eq('frequency', frequency)
    }

    const { data: habits, error } = await query

    if (error) {
      console.error('Error fetching habits:', error)
      return NextResponse.json(
        { error: 'Failed to fetch habits', details: error.message },
        { status: 500 }
      )
    }

    // Calculate streak stats if requested
    let enrichedHabits = habits
    if (includeStats && habits) {
      enrichedHabits = await Promise.all(
        habits.map(async (habit: any) => {
          const streakData = await calculateHabitStats(habit.id, userId)
          return {
            ...habit,
            ...streakData
          }
        })
      )
    }

    return NextResponse.json({
      success: true,
      data: enrichedHabits || [],
      count: enrichedHabits?.length || 0
    })

  } catch (error: any) {
    console.error('Error in GET /api/personal-health/habits:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/personal-health/habits - Create a new habit
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
      name,
      description,
      frequency = 'daily',
      target_count = 1,
      color = '#3b82f6'
    } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const habitData = {
      user_id: userId,
      name: name.trim(),
      description: description?.trim(),
      frequency,
      target_count,
      color,
      is_active: true
    }

    const { data, error } = await supabaseAdmin!
      .from('personal_habits')
      .insert(habitData)
      .select()
      .single()

    if (error) {
      console.error('Error creating habit:', error)
      return NextResponse.json(
        { error: 'Failed to create habit', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
        completion_rate: 0
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error in POST /api/personal-health/habits:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to calculate habit statistics
async function calculateHabitStats(habitId: string, userId: string) {
  try {
    // Get all habit logs for the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: logs, error } = await supabaseAdmin!
      .from('habit_logs')
      .select('completed_date, count')
      .eq('habit_id', habitId)
      .eq('user_id', userId)
      .gte('completed_date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('completed_date', { ascending: false })

    if (error || !logs) {
      return {
        current_streak: 0,
        longest_streak: 0,
        total_completions: 0,
        completion_rate: 0
      }
    }

    // Calculate current streak
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    const today = new Date().toISOString().split('T')[0]
    let lastDate = today

    // Sort logs by date (most recent first)
    const sortedLogs = logs.sort((a, b) =>
      new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime()
    )

    // Calculate streaks
    for (const log of sortedLogs) {
      const logDate = new Date(log.completed_date).toISOString().split('T')[0]

      if (logDate === lastDate) {
        tempStreak += log.count
      } else {
        // Check if this is consecutive day
        const expectedDate = new Date(lastDate)
        expectedDate.setDate(expectedDate.getDate() - 1)
        const expectedDateStr = expectedDate.toISOString().split('T')[0]

        if (logDate === expectedDateStr) {
          tempStreak = log.count
        } else {
          // Streak broken
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = log.count
        }
      }

      lastDate = logDate
    }

    longestStreak = Math.max(longestStreak, tempStreak)

    // Current streak is from today backwards
    currentStreak = 0
    const dateMap = new Map()
    sortedLogs.forEach(log => {
      dateMap.set(log.completed_date, (dateMap.get(log.completed_date) || 0) + log.count)
    })

    let checkDate = new Date(today)
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0]
      const count = dateMap.get(dateStr) || 0

      if (count === 0) break

      currentStreak += count
      checkDate.setDate(checkDate.getDate() - 1)
    }

    // Calculate completion rate (last 30 days)
    const totalCompletions = logs.reduce((sum, log) => sum + log.count, 0)
    const completionRate = Math.round((totalCompletions / 30) * 100) / 100

    return {
      current_streak: currentStreak,
      longest_streak: longestStreak,
      total_completions: totalCompletions,
      completion_rate: completionRate
    }

  } catch (error) {
    console.error('Error calculating habit stats:', error)
    return {
      current_streak: 0,
      longest_streak: 0,
      total_completions: 0,
      completion_rate: 0
    }
  }
}