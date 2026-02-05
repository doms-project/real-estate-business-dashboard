-- Website Analytics Database Schema
-- Add this to your Supabase SQL Editor

-- ============================================
-- WEBSITE VISITORS TABLE
-- ============================================
CREATE TABLE website_visitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id TEXT NOT NULL,           -- 'youngstown-marketing'
  location_id TEXT NOT NULL,       -- GHL location ID
  session_id TEXT NOT NULL,        -- Unique session identifier
  ip_hash TEXT,                    -- Privacy-compliant hashed IP
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_type TEXT,                -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  country TEXT,                    -- Geographic data
  region TEXT,                     -- State/Province
  city TEXT,                       -- City name
  first_visit TIMESTAMP DEFAULT NOW(),
  last_visit TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id)
);

-- ============================================
-- PAGE VIEWS TABLE
-- ============================================
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL REFERENCES website_visitors(session_id),
  site_id TEXT NOT NULL,
  page_url TEXT NOT NULL,
  page_title TEXT,
  time_on_page INTEGER,            -- Seconds spent on page
  scroll_depth DECIMAL(5,2),       -- Percentage scrolled (0-100)
  viewed_at TIMESTAMP DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_site_id ON page_views(site_id);
CREATE INDEX idx_page_views_viewed_at ON page_views(viewed_at);

-- ============================================
-- VISITOR EVENTS TABLE
-- ============================================
CREATE TABLE visitor_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  event_type TEXT NOT NULL,        -- 'click', 'form_start', 'form_complete', 'phone_click'
  event_data JSONB,                -- Additional event data
  element_selector TEXT,           -- CSS selector of clicked element
  page_url TEXT,
  occurred_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for visitor events
CREATE INDEX idx_visitor_events_session_id ON visitor_events(session_id);
CREATE INDEX idx_visitor_events_site_id ON visitor_events(site_id);
CREATE INDEX idx_visitor_events_type ON visitor_events(event_type);
CREATE INDEX idx_visitor_events_occurred_at ON visitor_events(occurred_at);

-- ============================================
-- DAILY ANALYTICS SUMMARY TABLE
-- ============================================
CREATE TABLE daily_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  date DATE NOT NULL,
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  avg_session_duration DECIMAL(10,2),
  bounce_rate DECIMAL(5,2),
  top_pages JSONB,                 -- Most visited pages
  traffic_sources JSONB,           -- Source breakdown
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(site_id, date)
);

-- Create indexes for daily analytics
CREATE INDEX idx_daily_analytics_site_id ON daily_analytics(site_id);
CREATE INDEX idx_daily_analytics_date ON daily_analytics(date);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (optional, for production)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE website_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your user system)
-- For now, allow all operations (you can restrict later)
CREATE POLICY "Allow all operations on website_visitors" ON website_visitors FOR ALL USING (true);
CREATE POLICY "Allow all operations on page_views" ON page_views FOR ALL USING (true);
CREATE POLICY "Allow all operations on visitor_events" ON visitor_events FOR ALL USING (true);
CREATE POLICY "Allow all operations on daily_analytics" ON daily_analytics FOR ALL USING (true);