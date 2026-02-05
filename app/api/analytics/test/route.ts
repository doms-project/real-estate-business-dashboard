import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Comprehensive analytics validation test
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { siteId, action, eventType = 'page_view' } = body

    if (!siteId) {
      return NextResponse.json(
        { error: 'siteId is required' },
        { status: 400 }
      )
    }

    if (action === 'validate_calculations') {
      return await validateAnalyticsCalculations(siteId, request)
    }

    if (action === 'simulate_scenario') {
      return await simulateTestScenario(siteId, request)
    }

    // Default: send test event

    const testEvent = {
      siteId,
      sessionId: `test-session-${Date.now()}`,
      eventType,
      pageUrl: 'https://test.com',
      userAgent: 'Test User Agent',
      referrer: '',
      utmParams: {},
      deviceInfo: { type: 'desktop', browser: 'test', os: 'test' },
      eventData: {
        title: 'Test Page',
        locationId: 'test-location',
        url: 'https://test.com',
        timestamp: Date.now()
      }
    }

    const analyticsResponse = await fetch(`${request.nextUrl.origin}/api/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEvent)
    })

    if (!analyticsResponse.ok) {
      throw new Error('Failed to send analytics event')
    }

    return NextResponse.json({
      success: true,
      message: `Test ${eventType} event sent for site: ${siteId}`,
      event: testEvent
    })

  } catch (error) {
    console.error('Test analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to execute test' },
      { status: 500 }
    )
  }
}

// Validate analytics calculations are working correctly
async function validateAnalyticsCalculations(siteId: string, request: NextRequest) {
  const days = 7 // Test with 7 days

  // Get analytics data
  const analyticsResponse = await fetch(`${request.nextUrl.origin}/api/analytics?siteId=${siteId}&days=${days}`)
  if (!analyticsResponse.ok) {
    throw new Error('Failed to fetch analytics data')
  }

  const analytics = await analyticsResponse.json()

  // Perform manual calculations to verify
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Get raw data
  const { data: pageViews } = await supabase
    .from('page_views')
    .select('*')
    .eq('site_id', siteId)
    .gte('viewed_at', startDate)

  const { data: events } = await supabase
    .from('visitor_events')
    .select('*')
    .eq('site_id', siteId)
    .gte('occurred_at', startDate)

  // Calculate active session IDs
  const activeSessionIds = new Set([
    ...(pageViews?.map(pv => pv.session_id) || []),
    ...(events?.map(e => e.session_id) || [])
  ])

  const { data: visitors } = await supabase
    .from('website_visitors')
    .select('*')
    .eq('site_id', siteId)
    .in('session_id', Array.from(activeSessionIds))

  // Manual calculations
  const manualUniqueVisitors = new Set(visitors?.map(v => v.session_id) || []).size
  const manualTotalPageViews = pageViews?.length || 0
  const manualSessions = visitors?.length || 0

  // Bounce rate calculation
  const sessionPageCounts: Record<string, number> = {}
  pageViews?.forEach(pv => {
    sessionPageCounts[pv.session_id] = (sessionPageCounts[pv.session_id] || 0) + 1
  })
  const manualBouncedSessions = Object.values(sessionPageCounts).filter(count => count === 1).length
  const manualBounceRate = manualSessions > 0 ? Math.round((manualBouncedSessions / manualSessions) * 100) : 0

  // Session duration calculation
  const sessionActivities: Record<string, { earliest: number; latest: number }> = {}

  pageViews?.forEach(pv => {
    const timestamp = new Date(pv.viewed_at).getTime()
    if (!sessionActivities[pv.session_id]) {
      sessionActivities[pv.session_id] = { earliest: timestamp, latest: timestamp }
    } else {
      sessionActivities[pv.session_id].earliest = Math.min(sessionActivities[pv.session_id].earliest, timestamp)
      sessionActivities[pv.session_id].latest = Math.max(sessionActivities[pv.session_id].latest, timestamp)
    }
  })

  events?.forEach(event => {
    const timestamp = new Date(event.occurred_at).getTime()
    if (!sessionActivities[event.session_id]) {
      sessionActivities[event.session_id] = { earliest: timestamp, latest: timestamp }
    } else {
      sessionActivities[event.session_id].earliest = Math.min(sessionActivities[event.session_id].earliest, timestamp)
      sessionActivities[event.session_id].latest = Math.max(sessionActivities[event.session_id].latest, timestamp)
    }
  })

  let manualTotalDuration = 0
  let manualValidSessions = 0
  Object.values(sessionActivities).forEach(activity => {
    const duration = (activity.latest - activity.earliest) / 1000
    if (duration >= 0 && duration < 28800 && !isNaN(duration)) {
      manualTotalDuration += duration
      manualValidSessions++
    }
  })
  const manualAvgSessionDuration = manualValidSessions > 0 ? manualTotalDuration / manualValidSessions : 0

  // Compare calculations
  const validationResults = {
    siteId,
    dateRange: `${startDate} to now`,
    rawDataCounts: {
      pageViews: pageViews?.length || 0,
      events: events?.length || 0,
      activeSessions: activeSessionIds.size,
      visitors: visitors?.length || 0
    },
    apiResults: {
      pageViews: analytics.pageViews,
      uniqueVisitors: analytics.uniqueVisitors,
      sessions: analytics.sessions,
      bounceRate: analytics.bounceRate,
      avgSessionDuration: analytics.avgSessionDuration
    },
    manualCalculations: {
      pageViews: manualTotalPageViews,
      uniqueVisitors: manualUniqueVisitors,
      sessions: manualSessions,
      bounceRate: manualBounceRate,
      avgSessionDuration: Math.round(manualAvgSessionDuration)
    },
    validation: {
      pageViewsMatch: analytics.pageViews === manualTotalPageViews,
      uniqueVisitorsMatch: analytics.uniqueVisitors === manualUniqueVisitors,
      sessionsMatch: analytics.sessions === manualSessions,
      bounceRateMatch: analytics.bounceRate === manualBounceRate,
      avgSessionDurationMatch: analytics.avgSessionDuration === Math.round(manualAvgSessionDuration)
    },
    allValid: (
      analytics.pageViews === manualTotalPageViews &&
      analytics.uniqueVisitors === manualUniqueVisitors &&
      analytics.sessions === manualSessions &&
      analytics.bounceRate === manualBounceRate &&
      analytics.avgSessionDuration === Math.round(manualAvgSessionDuration)
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Analytics validation completed',
    validation: validationResults
  })
}

// Simulate test scenarios to validate edge cases
async function simulateTestScenario(siteId: string, request: NextRequest) {
  const testSiteId = `${siteId}-test-${Date.now()}`

  // Simulate various scenarios
  const scenarios = [
    {
      name: 'Single page bounce',
      events: [
        { sessionId: 'bounce-session-1', pageUrl: '/home', timestamp: Date.now() - 3600000 }
      ]
    },
    {
      name: 'Multi-page session',
      events: [
        { sessionId: 'multi-session-1', pageUrl: '/home', timestamp: Date.now() - 3600000 },
        { sessionId: 'multi-session-1', pageUrl: '/about', timestamp: Date.now() - 3500000 },
        { sessionId: 'multi-session-1', pageUrl: '/contact', timestamp: Date.now() - 3400000 }
      ]
    },
    {
      name: 'Session spanning date ranges',
      events: [
        { sessionId: 'span-session-1', pageUrl: '/home', timestamp: Date.now() - 8 * 24 * 3600000 }, // 8 days ago
        { sessionId: 'span-session-1', pageUrl: '/about', timestamp: Date.now() - 1 * 24 * 3600000 }  // 1 day ago
      ]
    }
  ]

  const results = []

  for (const scenario of scenarios) {
    // Send test events
    for (const event of scenario.events) {
      const testEvent = {
        siteId: testSiteId,
        sessionId: event.sessionId,
        eventType: 'page_view',
        pageUrl: event.pageUrl,
        userAgent: 'Test User Agent',
        referrer: '',
        utmParams: {},
        deviceInfo: { type: 'desktop', browser: 'chrome', os: 'windows' },
        eventData: {
          title: `Test Page - ${event.pageUrl}`,
          locationId: 'test-location',
          url: event.pageUrl,
          timestamp: event.timestamp
        }
      }

      await fetch(`${request.nextUrl.origin}/api/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testEvent)
      })
    }

    // Get analytics for last 7 days
    const analyticsResponse = await fetch(`${request.nextUrl.origin}/api/analytics?siteId=${testSiteId}&days=7`)
    const analytics = await analyticsResponse.json()

    results.push({
      scenario: scenario.name,
      expectedPages: scenario.events.length,
      actualPages: analytics.pageViews,
      sessions: analytics.sessions,
      bounceRate: analytics.bounceRate
    })
  }

  return NextResponse.json({
    success: true,
    message: 'Test scenarios completed',
    testSiteId,
    results
  })
}