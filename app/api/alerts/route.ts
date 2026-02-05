// Alerts API Endpoint
// Get alerts for locations

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getActiveAlerts } from '@/lib/alert-system'

export const dynamic = 'force-dynamic'

/**
 * GET /api/alerts - Get alerts for locations
 * Query params: locationId, status, limit
 */
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
    const locationId = searchParams.get('locationId')
    const status = searchParams.get('status') || 'active'
    const limit = parseInt(searchParams.get('limit') || '50')

    const alerts = await getActiveAlerts(locationId || undefined)

    // Filter by status if specified
    let filteredAlerts = alerts
    if (status && status !== 'all') {
      filteredAlerts = alerts.filter(alert => alert.status === status)
    }

    // Apply limit
    filteredAlerts = filteredAlerts.slice(0, limit)

    return NextResponse.json({
      success: true,
      data: filteredAlerts,
      count: filteredAlerts.length
    })

  } catch (error: any) {
    console.error('Error in alerts API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}