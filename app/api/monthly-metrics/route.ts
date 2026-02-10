import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    const { locationId, analytics } = await request.json()

    if (!locationId || !analytics) {
      return NextResponse.json({ error: 'locationId and analytics are required' }, { status: 400 })
    }

    // Get current month start date
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Prepare monthly metrics data
    const monthlyMetrics = {
      location_id: locationId,
      month_start: currentMonthStart.toISOString().split('T')[0],
      contacts_count: analytics.contacts || 0,
      opportunities_count: analytics.opportunities || 0,
      conversations_count: analytics.conversations || 0,
      health_score: analytics.healthScore || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Upsert monthly metrics (update if exists, insert if not)
    const { data, error } = await supabaseAdmin
      .from('ghl_monthly_metrics')
      .upsert(monthlyMetrics, {
        onConflict: 'location_id,month_start'
      })
      .select()

    if (error) {
      console.error('Error saving monthly metrics:', error)
      return NextResponse.json({ error: 'Failed to save monthly metrics', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Monthly metrics saved successfully',
      data
    })

  } catch (error) {
    console.error('Error in monthly-metrics API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}