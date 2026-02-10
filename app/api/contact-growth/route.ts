import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    if (!locationId) {
      return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
    }

    // Get current month and previous month start dates
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Fetch current and previous month metrics
    const { data: currentMonthData, error: currentError } = await supabaseAdmin
      .from('ghl_monthly_metrics')
      .select('contacts_count')
      .eq('location_id', locationId)
      .eq('month_start', currentMonthStart.toISOString().split('T')[0])
      .single()

    const { data: previousMonthData, error: previousError } = await supabaseAdmin
      .from('ghl_monthly_metrics')
      .select('contacts_count')
      .eq('location_id', locationId)
      .eq('month_start', previousMonthStart.toISOString().split('T')[0])
      .single()

    // If no historical data, return 0 (no growth data available yet)
    if (currentError || previousError) {
      console.log('No historical data yet for contact growth calculation')
      return NextResponse.json({ growth: 0 })
    }

    const currentContacts = currentMonthData?.contacts_count || 0
    const previousContacts = previousMonthData?.contacts_count || 0

    if (previousContacts === 0) {
      // If previous was 0 and current > 0, show 100% growth
      return NextResponse.json({ growth: currentContacts > 0 ? 100 : 0 })
    }

    // Calculate month-over-month growth percentage
    const growthPercent = Math.round(((currentContacts - previousContacts) / previousContacts) * 100)

    // Cap between -100% and +500% for reasonable display
    const cappedGrowth = Math.max(-100, Math.min(growthPercent, 500))

    return NextResponse.json({ growth: cappedGrowth })

  } catch (error) {
    console.error('Error calculating contact growth:', error)
    return NextResponse.json({ error: 'Internal server error', growth: 0 }, { status: 500 })
  }
}