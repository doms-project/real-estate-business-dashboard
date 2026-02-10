import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { activityTracker } from '@/lib/activity-tracker'

export const dynamic = 'force-dynamic'

// Get campaigns for a specific location
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const pitToken = searchParams.get('pitToken')

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'locationId parameter is required'
      }, { status: 400 })
    }

    if (!pitToken) {
      return NextResponse.json({
        success: false,
        error: 'pitToken parameter is required'
      }, { status: 400 })
    }

    // Use the pitToken from query parameters
    const token = pitToken

    // Fetch campaigns from GHL API
    const response = await fetch(`https://services.leadconnectorhq.com/campaigns/?locationId=${locationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Version': '2021-07-28'
      }
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `GHL API error: ${response.status} ${response.statusText}`
      }, { status: response.status })
    }

    const data = await response.json()

    // Try to get detailed metrics for each campaign
    const campaignsWithMetrics = await Promise.all(
      (data.campaigns || []).map(async (campaign: any) => {
        try {
          // Try to get campaign performance metrics
          const metricsResponse = await fetch(`https://services.leadconnectorhq.com/campaigns/${campaign.id}/stats`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Version': '2021-07-28'
            }
          })

          let metrics: any = {}
          if (metricsResponse.ok) {
            metrics = await metricsResponse.json()
          }

          // Try to get campaign details
          const detailsResponse = await fetch(`https://services.leadconnectorhq.com/campaigns/${campaign.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Version': '2021-07-28'
            }
          })

          let details = {}
          if (detailsResponse.ok) {
            details = await detailsResponse.json()
          }

          return {
            ...campaign,
            metrics,
            details,
            // Calculate additional metrics
            performance: {
              sent: metrics.sent || 0,
              delivered: metrics.delivered || 0,
              opened: metrics.opened || 0,
              clicked: metrics.clicked || 0,
              bounced: metrics.bounced || 0,
              unsubscribed: metrics.unsubscribed || 0,
              complained: metrics.complained || 0,
              openRate: metrics.sent > 0 ? ((metrics.opened || 0) / metrics.sent * 100).toFixed(2) : 0,
              clickRate: metrics.sent > 0 ? ((metrics.clicked || 0) / metrics.sent * 100).toFixed(2) : 0,
              bounceRate: metrics.sent > 0 ? ((metrics.bounced || 0) / metrics.sent * 100).toFixed(2) : 0
            }
          }
        } catch (error) {
          // Return campaign with basic info if detailed fetch fails
          return {
            ...campaign,
            metrics: {},
            details: {},
            performance: {
              sent: 0,
              delivered: 0,
              opened: 0,
              clicked: 0,
              bounced: 0,
              unsubscribed: 0,
              complained: 0,
              openRate: 0,
              clickRate: 0,
              bounceRate: 0
            }
          }
        }
      })
    )

    // Log campaign fetch activity
    try {
      const { userId } = await auth()
      if (userId && campaignsWithMetrics.length > 0) {
        const { getOrCreateUserWorkspace } = await import('@/lib/workspace-helpers')
        const workspace = await getOrCreateUserWorkspace(userId)
        await activityTracker.logGHLCampaignsFetched(userId, campaignsWithMetrics.length, locationId, workspace.id)
      }
    } catch (activityError) {
      console.error('Failed to log campaigns fetch activity:', activityError)
      // Don't fail the main operation if activity logging fails
    }

    return NextResponse.json({
      success: true,
      locationId,
      campaigns: campaignsWithMetrics,
      totalCampaigns: campaignsWithMetrics.length,
      source: 'ghl_api'
    })

  } catch (error) {
    console.error('Campaigns API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch campaigns'
    }, { status: 500 })
  }
}
