import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

// Simple hash function for IP privacy
function hashString(str: string): string {
  let hash = 0;
  if (!str) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}

export async function OPTIONS(request: NextRequest) {
  console.log('OPTIONS request received for analytics API')
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  })
}

export async function POST(request: NextRequest) {
  try {
    console.log('Analytics POST request received:', request.method, request.url)

    const data = await request.json()
    console.log('Analytics data received:', {
      siteId: data.siteId,
      eventType: data.eventType,
      rawTimestamp: data.eventData?.timestamp,
      parsedTimestamp: data.eventData?.timestamp ? new Date(data.eventData.timestamp).toISOString() : 'none',
      currentServerTime: new Date().toISOString()
    })

    const {
      siteId,
      sessionId,
      eventType,
      pageUrl,
      userAgent,
      referrer,
      utmParams,
      deviceInfo,
      eventData
    } = data

    // Validate required fields
    if (!siteId || !sessionId || !eventType) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, sessionId, eventType' },
        { status: 400 }
      )
    }

    // Auto-create client-website mapping if analytics data has locationId
    if (eventData?.locationId) {
      try {
        // Skip auto-mapping for localhost/staging environments
        const isProductionSite = !pageUrl || (
          !pageUrl.includes('localhost') &&
          !pageUrl.includes('127.0.0.1') &&
          !pageUrl.includes('staging') &&
          !pageUrl.includes('dev.')
        );

        if (isProductionSite) {
          const { data: existingMapping } = await supabase
            .from('client_websites')
            .select('id')
            .eq('ghl_location_id', eventData.locationId)
            .eq('site_id', siteId)
            .single()

          if (!existingMapping) {
            console.log(`📊 Auto-creating mapping: ${eventData.locationId} → ${siteId}`)
            const { error: mappingError } = await supabase
              .from('client_websites')
              .insert({
                ghl_location_id: eventData.locationId,
                site_id: siteId,
                website_name: `${siteId.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} (Auto-mapped)`,
                website_url: pageUrl ? new URL(pageUrl).origin : null,
                is_active: true
              })

            if (mappingError) {
              console.warn('Failed to auto-create mapping:', mappingError)
            } else {
              console.log('✅ Auto-mapping created successfully')
            }
          }
        }
      } catch (mappingCheckError) {
        console.warn('Error checking auto-mapping:', mappingCheckError)
      }
    }

    // Get client IP and geolocation data
    let clientIP = null;
    let hashedIP = null;
    let geoData = null;

    // Extract IP from request headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const remoteAddr = request.headers.get('remote-addr');

    clientIP = forwardedFor?.split(',')[0]?.trim() ||
               realIP ||
               remoteAddr ||
               null;

    // Allow geolocation for external IPs OR development/local IPs for testing
    const isDevelopment = process.env.NODE_ENV === 'development';
    const shouldProcessGeolocation = clientIP && (
      // Always process external/public IPs
      (clientIP !== '::1' && clientIP !== '127.0.0.1' &&
       !clientIP.startsWith('192.168.') && !clientIP.startsWith('10.')) ||
      // In development, also process local IPs for testing
      (isDevelopment && (clientIP === '::1' || clientIP === '127.0.0.1' ||
                        clientIP.startsWith('192.168.') || clientIP.startsWith('10.')))
    );

    if (shouldProcessGeolocation) {
      // Hash the IP for privacy compliance
      hashedIP = hashString(clientIP!);

      try {
        // Use IPinfo.io for geolocation (free tier: unlimited requests)
        const geoResponse = await fetch(`https://ipinfo.io/${clientIP}/json?token=${process.env.IPINFO_API_TOKEN}`, {
          headers: {
            'User-Agent': 'Real-Estate-Analytics/1.0'
          }
        });

        if (geoResponse.ok) {
          const rawGeoData = await geoResponse.json();
          console.log(`🌍 Geolocation for session ${sessionId}: ${rawGeoData.country || 'Unknown'} (IPinfo.io authenticated)`);

          // Check for fallback before transforming data
          const needsFallback = isDevelopment && clientIP &&
              (clientIP === '::1' || clientIP === '127.0.0.1' ||
               clientIP.startsWith('192.168.') || clientIP.startsWith('10.')) &&
              (!rawGeoData.country || rawGeoData.country === 'Unknown');

          if (needsFallback) {
            geoData = {
              country_code: 'US',
              country_name: 'United States',
              region: 'Development',
              city: 'Local Development',
              timezone: 'America/New_York'
            };
            console.log(`🏠 Development fallback for session ${sessionId}: Local Development (Unknown response)`);
          } else {
            // IPinfo.io response format (different from ipapi.co)
            geoData = {
              country_code: rawGeoData.country,
              country_name: rawGeoData.country,
              region: rawGeoData.region || 'Unknown',
              city: rawGeoData.city || 'Unknown',
              timezone: rawGeoData.timezone || 'Unknown'
            };
          }
        } else {
          console.warn(`⚠️ IPinfo.io failed (${geoResponse.status}) for session ${sessionId}`);
          // For development, provide fallback data for local IPs
          if (isDevelopment && clientIP && (clientIP === '::1' || clientIP === '127.0.0.1' ||
                                           clientIP.startsWith('192.168.') || clientIP.startsWith('10.'))) {
            geoData = {
              country_code: 'US',
              country_name: 'United States',
              region: 'Development',
              city: 'Local Development',
              timezone: 'America/New_York'
            };
            console.log(`🏠 Development geolocation for session ${sessionId}: Local Development`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Geolocation error for session ${sessionId}:`, error);
      }
    }


    switch (eventType) {
      case 'page_view':
        // FIRST: Check if visitor session exists, then update or create appropriately
        const { data: existingVisitor, error: checkError } = await supabase
          .from('website_visitors')
          .select('id, first_visit')
          .eq('session_id', sessionId)
          .single()

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
          throw checkError
        }

        let visitorError
        if (existingVisitor) {
          // UPDATE existing visitor - only update last_visit, preserve first_visit
          const { error } = await supabase
            .from('website_visitors')
            .update({
              ip_hash: hashedIP,
              user_agent: userAgent,
              referrer: referrer,
              utm_source: utmParams?.source,
              utm_medium: utmParams?.medium,
              utm_campaign: utmParams?.campaign,
              device_type: deviceInfo?.type,
              browser: deviceInfo?.browser,
              country_code: geoData?.country_code || null,
              region: geoData?.region || null,
              city: geoData?.city || null,
              last_visit: new Date(eventData.timestamp).toISOString()
            })
            .eq('session_id', sessionId)
          visitorError = error
        } else {
          // INSERT new visitor - set both first_visit and last_visit
          const { error } = await supabase
            .from('website_visitors')
            .insert({
              session_id: sessionId,
              site_id: siteId,
              location_id: eventData?.locationId || 'unknown',
              ip_hash: hashedIP,
              user_agent: userAgent,
              referrer: referrer,
              utm_source: utmParams?.source,
              utm_medium: utmParams?.medium,
              utm_campaign: utmParams?.campaign,
              device_type: deviceInfo?.type,
              browser: deviceInfo?.browser,
              country_code: geoData?.country_code || null,
              region: geoData?.region || null,
              city: geoData?.city || null,
              first_visit: new Date(eventData.timestamp).toISOString(),
              last_visit: new Date(eventData.timestamp).toISOString()
            })
          visitorError = error
        }

        if (visitorError) throw visitorError

        // THEN: Record page view (after visitor exists)
        const { error: pageViewError } = await supabase
          .from('page_views')
          .insert({
            session_id: sessionId,
            site_id: siteId,
            page_url: pageUrl,
            page_title: eventData?.title,
            utm_source: eventData?.utmSource,
            utm_medium: eventData?.utmMedium,
            utm_campaign: eventData?.utmCampaign,
            referrer: referrer,
            device_type: deviceInfo?.type,
            browser: deviceInfo?.browser,
            viewed_at: new Date(eventData.timestamp).toISOString()
          })

        if (pageViewError) throw pageViewError
        break

      case 'event':
        // Record custom event
        const { error: eventError } = await supabase
          .from('visitor_events')
          .insert({
            session_id: sessionId,
            site_id: siteId,
            event_type: eventData?.eventType,
            event_data: eventData,
            element_selector: eventData?.selector,
            page_url: pageUrl,
            occurred_at: new Date(eventData.timestamp).toISOString()
          })

        if (eventError) throw eventError
        break

      default:
        return NextResponse.json(
          { error: 'Unknown event type' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders })

  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// Utility endpoint to fix corrupted visitor data
export async function PUT(request: NextRequest) {
  try {
    const { siteId, action } = await request.json()

    if (!siteId) {
      return NextResponse.json({ error: 'siteId required' }, { status: 400 })
    }

    if (action === 'fix_visitor_timestamps') {
      console.log(`🔧 Fixing corrupted visitor timestamps for site: ${siteId}`)

      // Get all visitors for this site
      const { data: visitors, error: fetchError } = await supabase
        .from('website_visitors')
        .select('*')
        .eq('site_id', siteId)

      if (fetchError) throw fetchError

      let fixed = 0
      let errors = 0

      for (const visitor of visitors || []) {
        const firstVisit = new Date(visitor.first_visit)
        const lastVisit = new Date(visitor.last_visit)

        // If first_visit is invalid or after last_visit, fix it
        if (isNaN(firstVisit.getTime()) || firstVisit > lastVisit) {
          // Find the earliest page view for this session as the first_visit
          const { data: pageViews } = await supabase
            .from('page_views')
            .select('viewed_at')
            .eq('session_id', visitor.session_id)
            .eq('site_id', siteId)
            .order('viewed_at', { ascending: true })
            .limit(1)

          if (pageViews && pageViews.length > 0) {
            const correctedFirstVisit = pageViews[0].viewed_at

            const { error: updateError } = await supabase
              .from('website_visitors')
              .update({ first_visit: correctedFirstVisit })
              .eq('session_id', visitor.session_id)

            if (updateError) {
              console.error(`Failed to fix visitor ${visitor.session_id}:`, updateError)
              errors++
            } else {
              fixed++
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Fixed ${fixed} visitor records, ${errors} errors`,
        totalVisitors: visitors?.length || 0
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error) {
    console.error('Analytics PUT error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

// GET endpoint for analytics data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get('siteId')
    const days = parseInt(searchParams.get('days') || '30')

    console.log(`📊 Analytics GET request: siteId=${siteId}, days=${days}`)
    console.log(`📊 Analytics GET: Querying database for site_id = '${siteId}'`)

    if (!siteId) {
      console.log(`❌ Analytics GET: Missing siteId parameter`)
      return NextResponse.json(
        { error: 'siteId parameter required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Get page views within date range
    const { data: pageViews, error: pvError } = await supabase
      .from('page_views')
      .select('*')
      .eq('site_id', siteId)
      .gte('viewed_at', startDate)
      .order('viewed_at', { ascending: false })

    if (pvError) {
      console.error(`❌ Analytics GET: Database error fetching page views:`, pvError)
      throw pvError
    }

    // Get visitor events within date range
    const { data: events, error: eError } = await supabase
      .from('visitor_events')
      .select('*')
      .eq('site_id', siteId)
      .gte('occurred_at', startDate)
      .order('occurred_at', { ascending: false })

    if (eError) throw eError

    // Get all active session IDs that have activity within the date range
    const activeSessionIds = new Set([
      ...(pageViews?.map(pv => pv.session_id) || []),
      ...(events?.map(e => e.session_id) || [])
    ])

    // Get visitors for active sessions only (not just by first_visit date)
    const { data: visitors, error: vError } = await supabase
      .from('website_visitors')
      .select('*')
      .eq('site_id', siteId)
      .in('session_id', Array.from(activeSessionIds))

    if (vError) throw vError

    console.log(`📊 Analytics GET: Found ${pageViews?.length || 0} page views, ${events?.length || 0} events, ${visitors?.length || 0} active visitors for site_id '${siteId}'`)
    console.log(`📊 Analytics GET: Date range: ${startDate} to now`)
    console.log(`📊 Analytics GET: Active session IDs: ${activeSessionIds.size}`)

    if (pageViews && pageViews.length > 0) {
      console.log(`📊 Sample page views:`, pageViews.slice(0, 3).map(pv => ({
        id: pv.id,
        session_id: pv.session_id,
        page_url: pv.page_url,
        viewed_at: pv.viewed_at
      })))
    }

    // Data integrity checks
    const dataIntegrityIssues = []

    // Check for page views without visitor records
    const pageViewSessionIds = new Set(pageViews?.map(pv => pv.session_id) || [])
    const visitorSessionIds = new Set(visitors?.map(v => v.session_id) || [])
    const orphanedPageViews = Array.from(pageViewSessionIds).filter(id => !visitorSessionIds.has(id))

    if (orphanedPageViews.length > 0) {
      dataIntegrityIssues.push({
        type: 'orphaned_page_views',
        count: orphanedPageViews.length,
        sessions: orphanedPageViews.slice(0, 5), // Show first 5
        message: `${orphanedPageViews.length} page views have no corresponding visitor records`
      })
      console.warn(`⚠️ Data integrity issue: ${orphanedPageViews.length} orphaned page views found`)
    }

    // Check for events without visitor records
    const eventSessionIds = new Set(events?.map(e => e.session_id) || [])
    const orphanedEvents = Array.from(eventSessionIds).filter(id => !visitorSessionIds.has(id))

    if (orphanedEvents.length > 0) {
      dataIntegrityIssues.push({
        type: 'orphaned_events',
        count: orphanedEvents.length,
        sessions: orphanedEvents.slice(0, 5), // Show first 5
        message: `${orphanedEvents.length} events have no corresponding visitor records`
      })
      console.warn(`⚠️ Data integrity issue: ${orphanedEvents.length} orphaned events found`)
    }

    // Check for sessions with no activity (shouldn't happen with new logic)
    const inactiveSessions = visitors?.filter(v => !activeSessionIds.has(v.session_id)) || []
    if (inactiveSessions.length > 0) {
      dataIntegrityIssues.push({
        type: 'inactive_sessions_included',
        count: inactiveSessions.length,
        message: `${inactiveSessions.length} sessions included but have no activity in date range`
      })
      console.warn(`⚠️ Data integrity issue: ${inactiveSessions.length} inactive sessions included`)
    }

    if (dataIntegrityIssues.length > 0) {
      console.error(`🚨 Data integrity issues found:`, dataIntegrityIssues)
    } else {
      console.log(`✅ Data integrity check passed - all records have proper relationships`)
    }

    // Calculate metrics
    const uniqueVisitors = new Set(visitors?.map(v => v.session_id) || []).size
    const totalPageViews = pageViews?.length || 0
    const sessions = visitors?.length || 0

    // Calculate bounce rate: sessions with only 1 page view / total sessions
    const sessionPageCounts: Record<string, number> = {}
    pageViews?.forEach(pv => {
      sessionPageCounts[pv.session_id] = (sessionPageCounts[pv.session_id] || 0) + 1
    })

    const bouncedSessions = Object.values(sessionPageCounts).filter(count => count === 1).length
    const bounceRate = sessions > 0 ? Math.round((bouncedSessions / sessions) * 100) : 0

    // Calculate average session duration based on actual activity within date range
    let totalValidDuration = 0
    let validSessionCount = 0

    // Create a map of session activities (both page views and events)
    const sessionActivities: Record<string, { earliest: number; latest: number }> = {}

    // Collect page view activities
    pageViews?.forEach(pv => {
      const timestamp = new Date(pv.viewed_at).getTime()
      if (!sessionActivities[pv.session_id]) {
        sessionActivities[pv.session_id] = { earliest: timestamp, latest: timestamp }
      } else {
        sessionActivities[pv.session_id].earliest = Math.min(sessionActivities[pv.session_id].earliest, timestamp)
        sessionActivities[pv.session_id].latest = Math.max(sessionActivities[pv.session_id].latest, timestamp)
      }
    })

    // Collect event activities
    events?.forEach(event => {
      const timestamp = new Date(event.occurred_at).getTime()
      if (!sessionActivities[event.session_id]) {
        sessionActivities[event.session_id] = { earliest: timestamp, latest: timestamp }
      } else {
        sessionActivities[event.session_id].earliest = Math.min(sessionActivities[event.session_id].earliest, timestamp)
        sessionActivities[event.session_id].latest = Math.max(sessionActivities[event.session_id].latest, timestamp)
      }
    })

    // Calculate duration for each ACTIVE session only (same sessions used in main analytics)
    Object.entries(sessionActivities).forEach(([sessionId, activity]) => {
      // Only calculate duration for sessions that are actually included in our analytics
      if (!activeSessionIds.has(sessionId)) {
        return // Skip sessions not in our active set
      }

      const duration = (activity.latest - activity.earliest) / 1000 // in seconds

      // Validate duration (must be positive and reasonable - max 8 hours = 28800 seconds for analysis period)
      if (duration >= 0 && duration < 28800 && !isNaN(duration)) {
        totalValidDuration += duration
        validSessionCount++
      } else {
        console.log(`⚠️ Invalid session duration:`, {
          sessionId: sessionId.substring(0, 8),
          earliest: new Date(activity.earliest).toISOString(),
          latest: new Date(activity.latest).toISOString(),
          calculatedDuration: duration
        })
      }
    })

    const avgSessionDuration = validSessionCount > 0 ? totalValidDuration / validSessionCount : 0

    // Fetch yesterday's data for percentage calculations
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    let yesterdayData = null
    try {
      const { data: yesterdayResult, error: yesterdayError } = await supabase
        .from('daily_analytics')
        .select('*')
        .eq('site_id', siteId)
        .eq('date', yesterday)
        .single()

      if (!yesterdayError && yesterdayResult) {
        yesterdayData = yesterdayResult
        console.log(`📊 Found yesterday's data for ${siteId}:`, yesterdayResult)
      }
    } catch (yesterdayError) {
      console.log(`⚠️ No yesterday's data found for ${siteId}`)
    }

    // Calculate percentage changes
    const calculatePercentageChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0
      return Math.round(((current - previous) / previous) * 100)
    }

    const percentageChanges = {
      pageViews: yesterdayData ? calculatePercentageChange(totalPageViews, yesterdayData.page_views) : null,
      uniqueVisitors: yesterdayData ? calculatePercentageChange(uniqueVisitors, yesterdayData.unique_visitors) : null,
      sessions: yesterdayData ? calculatePercentageChange(sessions, yesterdayData.sessions) : null,
      avgSessionDuration: yesterdayData ? calculatePercentageChange(Math.round(avgSessionDuration), yesterdayData.avg_session_duration) : null,
      bounceRate: yesterdayData ? calculatePercentageChange(bounceRate, yesterdayData.bounce_rate) : null
    }

    console.log(`📈 Percentage changes for ${siteId}:`, percentageChanges)

    // Calculate top pages
    const pageStats: Record<string, number> = {}
    pageViews?.forEach(pv => {
      pageStats[pv.page_url] = (pageStats[pv.page_url] || 0) + 1
    })
    const topPages = Object.entries(pageStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([page, views]) => ({ page, views }))

    // Calculate traffic sources (per page view attribution)
    const sourceStats: Record<string, number> = {}

    // Use page view level attribution for better accuracy
    pageViews?.forEach(pageView => {
      // Get source from page view data, fallback to visitor data
      const source = pageView.utm_source ||
                    (pageView.referrer ? 'referrer' : 'direct')
      sourceStats[source] = (sourceStats[source] || 0) + 1
    })

    // If no page views have source data, fall back to visitor level data
    if (Object.keys(sourceStats).length === 0) {
      visitors?.forEach(visitor => {
        const source = visitor.utm_source || (visitor.referrer ? 'referrer' : 'direct')
        sourceStats[source] = (sourceStats[source] || 0) + 1
      })
    }

    // Calculate geographic data (country breakdown)
    const geoStats: Record<string, number> = {}
    visitors?.forEach(visitor => {
      if (visitor.country_code) {
        geoStats[visitor.country_code] = (geoStats[visitor.country_code] || 0) + 1
      }
    })

    // Sort by visitor count and get top countries
    const topCountries = Object.entries(geoStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([country, visitors]) => ({ country, visitors }))

    // Get historical totals (all-time, not filtered)
    const { count: totalHistoricalPageViews } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)

    const { count: totalHistoricalEvents } = await supabase
      .from('visitor_events')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)

    const { count: totalHistoricalVisitors } = await supabase
      .from('website_visitors')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)

    // Check if site has ever been tracked
    const hasEverBeenTracked = (totalHistoricalPageViews || 0) > 0 ||
                               (totalHistoricalEvents || 0) > 0 ||
                               (totalHistoricalVisitors || 0) > 0

    // Store daily analytics snapshot
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    try {
      await supabase
        .from('daily_analytics')
        .upsert({
          site_id: siteId,
          date: today,
          page_views: totalPageViews,
          unique_visitors: uniqueVisitors,
          sessions: sessions,
          avg_session_duration: Math.round(avgSessionDuration),
          bounce_rate: bounceRate,
          events_count: events?.length || 0
        }, {
          onConflict: 'site_id,date'
        })

      console.log(`✅ Stored daily analytics snapshot for ${siteId} on ${today}`)
    } catch (storageError) {
      console.error(`❌ Failed to store daily analytics for ${siteId}:`, storageError)
      // Don't fail the entire request if storage fails
    }

    const responseData = {
      siteId,
      pageViews: totalPageViews,
      uniqueVisitors,
      sessions,
      avgSessionDuration: Math.round(avgSessionDuration),
      bounceRate,
      eventsCount: events?.length || 0,
      totalEventsInDB: events?.length || 0, // Filtered count (for compatibility)
      totalPageViewsInDB: pageViews?.length || 0, // Filtered count (for compatibility)
      totalVisitorsInDB: visitors?.length || 0, // Filtered count (for compatibility)
      totalHistoricalPageViews: totalHistoricalPageViews || 0, // Actual historical total
      totalHistoricalEvents: totalHistoricalEvents || 0, // Actual historical total
      totalHistoricalVisitors: totalHistoricalVisitors || 0, // Actual historical total
      hasEverBeenTracked, // New flag
      topPages,
      trafficSources: sourceStats,
      percentageChanges,
      recentPageViews: pageViews?.slice(0, 50) || [],
      recentEvents: events?.slice(0, 50) || [],
      visitors: visitors?.slice(0, 50) || [],
      geographicData: topCountries,
      lastUpdated: new Date().toISOString()
    }

    console.log(`✅ Analytics GET response:`, {
      siteId,
      pageViews: totalPageViews,
      uniqueVisitors,
      sessions,
      bounceRate: `${bounceRate}%`,
      avgSessionDuration: Math.round(avgSessionDuration),
      eventsCount: events?.length || 0,
      totalEventsInDB: events?.length || 0,
      totalPageViewsInDB: pageViews?.length || 0,
      totalVisitorsInDB: visitors?.length || 0,
      sessionDurationDetails: {
        validSessions: validSessionCount,
        totalDurationSeconds: Math.round(totalValidDuration),
        avgMinutes: Math.round(avgSessionDuration / 60),
        avgSeconds: Math.round(avgSessionDuration % 60)
      },
      bounceRateDetails: {
        bouncedSessions,
        totalSessions: sessions,
        bounceRatePercentage: bounceRate
      }
    })

    // Debug: Show sample visitor durations
    if (visitors && visitors.length > 0) {
      console.log(`🔍 Sample visitor session durations:`,
        visitors.slice(0, 3).map(v => ({
          sessionId: v.session_id?.substring(0, 8),
          firstVisit: v.first_visit,
          lastVisit: v.last_visit,
          durationMinutes: Math.round((new Date(v.last_visit).getTime() - new Date(v.first_visit).getTime()) / 1000 / 60)
        }))
      )
    }

    return NextResponse.json(responseData, { headers: corsHeaders })

  } catch (error) {
    console.error('Analytics GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500, headers: corsHeaders }
    )
  }
}