-- Analytics Performance Indexes
-- Run this in Supabase SQL Editor to improve query performance

-- ============================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================

-- Index for site + date queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_page_views_site_date
ON page_views(site_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_visitor_events_site_date
ON visitor_events(site_id, occurred_at DESC);

-- Session lookup optimization
CREATE INDEX IF NOT EXISTS idx_website_visitors_site_session
ON website_visitors(site_id, session_id);

-- Geographic analytics queries
CREATE INDEX IF NOT EXISTS idx_website_visitors_country_code
ON website_visitors(country_code)
WHERE country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_website_visitors_region
ON website_visitors(region)
WHERE region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_website_visitors_city
ON website_visitors(city)
WHERE city IS NOT NULL;

-- Device/browser analytics
CREATE INDEX IF NOT EXISTS idx_page_views_device_type
ON page_views(device_type)
WHERE device_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_page_views_browser
ON page_views(browser)
WHERE browser IS NOT NULL;

-- Daily analytics lookups
CREATE INDEX IF NOT EXISTS idx_daily_analytics_site_date
ON daily_analytics(site_id, date DESC);

-- ============================================
-- VERIFY INDEXES CREATED
-- ============================================

-- Check all analytics indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('website_visitors', 'page_views', 'visitor_events', 'daily_analytics')
ORDER BY tablename, indexname;

-- ============================================
-- PERFORMANCE IMPACT
-- ============================================

/*
These indexes will improve performance for:

1. Analytics API queries - faster filtering by site_id + date
2. Dashboard loads - quicker data retrieval
3. Geographic reports - faster country/region/city queries
4. Device reports - faster device/browser breakdowns
5. Historical data - better daily analytics lookups

Expected improvements:
- Query time: 10-100x faster for large datasets
- Memory usage: Reduced due to better query planning
- Scalability: Better performance with more websites/data
*/