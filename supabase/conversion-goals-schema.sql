-- Conversion Goals Tracking Schema
-- Run this in Supabase SQL Editor to enable goal tracking

-- ============================================
-- CONVERSION GOALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS conversion_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id TEXT NOT NULL,
  goal_name TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('page_view', 'event', 'form_complete', 'phone_click', 'email_click')),
  goal_value DECIMAL(10,2) DEFAULT 0,  -- Optional monetary value
  target_url TEXT,                     -- For page_view goals
  target_event TEXT,                   -- For event goals
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure unique goal names per site
  UNIQUE(site_id, goal_name)
);

-- ============================================
-- GOAL CONVERSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS goal_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES conversion_goals(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  converted_at TIMESTAMP DEFAULT NOW(),
  conversion_value DECIMAL(10,2) DEFAULT 0,  -- Value of this conversion
  metadata JSONB,                           -- Additional conversion data

  -- Prevent duplicate conversions for same goal + session
  UNIQUE(goal_id, session_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_conversion_goals_site_id
ON conversion_goals(site_id);

CREATE INDEX IF NOT EXISTS idx_goal_conversions_goal_id
ON goal_conversions(goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_conversions_session
ON goal_conversions(session_id);

CREATE INDEX IF NOT EXISTS idx_goal_conversions_site_date
ON goal_conversions(site_id, converted_at DESC);

-- Create partial index for active goals (run this separately if needed)
-- CREATE INDEX IF NOT EXISTS idx_conversion_goals_active
-- ON conversion_goals(site_id) WHERE is_active = true;

-- ============================================
-- ENABLE REALTIME FOR GOALS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE conversion_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE goal_conversions;

-- Realtime policies
DROP POLICY IF EXISTS "realtime_conversion_goals" ON conversion_goals;
CREATE POLICY "realtime_conversion_goals" ON conversion_goals
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "realtime_goal_conversions" ON goal_conversions;
CREATE POLICY "realtime_goal_conversions" ON goal_conversions
FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- SAMPLE GOALS (Optional - customize for your needs)
-- ============================================

-- Insert sample goals for testing
INSERT INTO conversion_goals (site_id, goal_name, goal_type, target_url, goal_value)
VALUES
  ('test-site', 'Homepage Visit', 'page_view', '/', 0),
  ('test-site', 'Contact Form', 'form_complete', null, 50),
  ('test-site', 'Phone Call', 'phone_click', null, 100),
  ('test-site', 'Newsletter Signup', 'event', 'newsletter_signup', 25)
ON CONFLICT (site_id, goal_name) DO NOTHING;

-- ============================================
-- USAGE IN ANALYTICS API
-- ============================================

/*
-- Add this to app/api/analytics/route.ts in the event handling:

// Track conversions
if (eventData?.eventType === 'page_view' && eventData?.pageUrl) {
  // Check for page view goals
  const { data: pageGoals } = await supabase
    .from('conversion_goals')
    .select('*')
    .eq('site_id', siteId)
    .eq('goal_type', 'page_view')
    .eq('target_url', eventData.pageUrl)
    .eq('is_active', true);

  for (const goal of pageGoals || []) {
    await supabase
      .from('goal_conversions')
      .insert({
        goal_id: goal.id,
        session_id: sessionId,
        site_id: siteId,
        conversion_value: goal.goal_value || 0,
        metadata: { page_url: eventData.pageUrl }
      })
      .select()
      .single()
      .then(() => console.log(`🎯 Goal converted: ${goal.goal_name}`))
      .catch(err => {
        if (!err.message?.includes('duplicate key')) {
          console.error('Goal conversion error:', err);
        }
      });
  }
}

if (eventData?.eventType === 'form_complete') {
  // Check for form completion goals
  const { data: formGoals } = await supabase
    .from('conversion_goals')
    .select('*')
    .eq('site_id', siteId)
    .eq('goal_type', 'form_complete')
    .eq('is_active', true);

  for (const goal of formGoals || []) {
    await supabase
      .from('goal_conversions')
      .insert({
        goal_id: goal.id,
        session_id: sessionId,
        site_id: siteId,
        conversion_value: goal.goal_value || 0,
        metadata: eventData
      })
      .select()
      .single()
      .then(() => console.log(`🎯 Form goal converted: ${goal.goal_name}`))
      .catch(err => {
        if (!err.message?.includes('duplicate key')) {
          console.error('Form goal conversion error:', err);
        }
      });
  }
}
*/

-- ============================================
-- DASHBOARD QUERIES
-- ============================================

/*
-- Get conversion rates for dashboard:
SELECT
  g.goal_name,
  g.goal_type,
  COUNT(c.id) as conversions,
  AVG(c.conversion_value) as avg_value,
  SUM(c.conversion_value) as total_value
FROM conversion_goals g
LEFT JOIN goal_conversions c ON g.id = c.goal_id
WHERE g.site_id = 'your-site-id'
  AND g.is_active = true
  AND c.converted_at >= '2024-01-01'
GROUP BY g.id, g.goal_name, g.goal_type
ORDER BY conversions DESC;
*/