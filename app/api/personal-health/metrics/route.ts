import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/personal-health/metrics - Get user's wellness metrics
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
    const metricType = searchParams.get('metricType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabaseAdmin!
      .from('wellness_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('logged_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (metricType) {
      query = query.eq('metric_type', metricType)
    }

    if (startDate) {
      query = query.gte('logged_date', startDate)
    }

    if (endDate) {
      query = query.lte('logged_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching wellness metrics:', error)
      return NextResponse.json(
        { error: 'Failed to fetch wellness metrics', details: error.message },
        { status: 500 }
      )
    }

    // Group by metric type and date for easier consumption
    const groupedData = data?.reduce((acc: any, metric: any) => {
      const key = `${metric.metric_type}_${metric.logged_date}`
      if (!acc[key]) {
        acc[key] = {
          id: metric.id,
          metric_type: metric.metric_type,
          value: metric.value,
          unit: metric.unit,
          logged_date: metric.logged_date,
          notes: metric.notes,
          created_at: metric.created_at
        }
      }
      return acc
    }, {}) || {}

    const uniqueMetrics = Object.values(groupedData)

    return NextResponse.json({
      success: true,
      data: uniqueMetrics,
      count: uniqueMetrics.length
    })

  } catch (error: any) {
    console.error('Error in GET /api/personal-health/metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/personal-health/metrics - Log a wellness metric
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
      metric_type,
      value,
      unit,
      logged_date = new Date().toISOString().split('T')[0],
      notes
    } = body

    if (!metric_type || typeof metric_type !== 'string') {
      return NextResponse.json(
        { error: 'Metric type is required' },
        { status: 400 }
      )
    }

    if (value === undefined || value === null || isNaN(Number(value))) {
      return NextResponse.json(
        { error: 'Valid numeric value is required' },
        { status: 400 }
      )
    }

    // Check if metric already exists for this date
    const { data: existingMetric } = await supabaseAdmin!
      .from('wellness_metrics')
      .select('id')
      .eq('user_id', userId)
      .eq('metric_type', metric_type)
      .eq('logged_date', logged_date)
      .single()

    let result
    if (existingMetric) {
      // Update existing metric
      const { data, error } = await supabaseAdmin!
        .from('wellness_metrics')
        .update({
          value: Number(value),
          unit: unit?.trim(),
          notes: notes?.trim()
        })
        .eq('id', existingMetric.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating wellness metric:', error)
        return NextResponse.json(
          { error: 'Failed to update wellness metric', details: error.message },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Create new metric
      const { data, error } = await supabaseAdmin!
        .from('wellness_metrics')
        .insert({
          user_id: userId,
          metric_type,
          value: Number(value),
          unit: unit?.trim(),
          logged_date,
          notes: notes?.trim()
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating wellness metric:', error)
        return NextResponse.json(
          { error: 'Failed to create wellness metric', details: error.message },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: existingMetric ? 'Wellness metric updated' : 'Wellness metric logged successfully'
    })

  } catch (error: any) {
    console.error('Error in POST /api/personal-health/metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}