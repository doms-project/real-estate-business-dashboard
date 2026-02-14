-- Enable Real-Time Updates for Analytics Tables
-- Run this in Supabase SQL Editor to enable live analytics updates

-- ============================================
-- ENABLE REALTIME FOR ANALYTICS TABLES
-- ============================================

-- Enable real-time for all analytics tables
ALTER PUBLICATION supabase_realtime ADD TABLE website_visitors;
ALTER PUBLICATION supabase_realtime ADD TABLE page_views;
ALTER PUBLICATION supabase_realtime ADD TABLE visitor_events;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_analytics;

-- ============================================
-- REALTIME POLICIES (Allow all operations for analytics)
-- ============================================

-- Website Visitors - Allow all operations
DROP POLICY IF EXISTS "realtime_website_visitors" ON website_visitors;
CREATE POLICY "realtime_website_visitors" ON website_visitors
FOR ALL USING (true) WITH CHECK (true);

-- Page Views - Allow all operations
DROP POLICY IF EXISTS "realtime_page_views" ON page_views;
CREATE POLICY "realtime_page_views" ON page_views
FOR ALL USING (true) WITH CHECK (true);

-- Visitor Events - Allow all operations
DROP POLICY IF EXISTS "realtime_visitor_events" ON visitor_events;
CREATE POLICY "realtime_visitor_events" ON visitor_events
FOR ALL USING (true) WITH CHECK (true);

-- Daily Analytics - Allow all operations
DROP POLICY IF EXISTS "realtime_daily_analytics" ON daily_analytics;
CREATE POLICY "realtime_daily_analytics" ON daily_analytics
FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- VERIFY REALTIME IS ENABLED
-- ============================================

-- Check which tables are in the realtime publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('website_visitors', 'page_views', 'visitor_events', 'daily_analytics');

-- ============================================
-- USAGE EXAMPLE (in your React components)
-- ============================================

/*
-- Example: Subscribe to real-time page view updates
useEffect(() => {
  const channel = supabase
    .channel('analytics-realtime')
    .on('postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'page_views',
        filter: `site_id=eq.${siteId}`
      },
      (payload) => {
        console.log('New page view:', payload.new);
        // Update your analytics state
        refreshAnalytics();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [siteId]);
*/

-- ============================================
-- PERFORMANCE NOTES
-- ============================================

/*
Real-time subscriptions will now trigger on:
- INSERT: New page views, visitor sessions, events
- UPDATE: Visitor session updates (last_visit, etc.)
- DELETE: Rare, but supported

Benefits:
- Live analytics updates without manual refresh
- Real-time dashboard updates
- Instant feedback for tracking script installation

Considerations:
- Use filters to only subscribe to relevant site_ids
- Handle reconnections gracefully
- Consider debouncing rapid updates
*/