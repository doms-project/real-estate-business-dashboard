-- Conversion Goals Setup - Run in Supabase SQL Editor
-- Step-by-step setup to avoid any ordering issues

-- ============================================
-- STEP 1: Create Tables
-- ============================================

CREATE TABLE IF NOT EXISTS conversion_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id TEXT NOT NULL,
  goal_name TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('page_view', 'event', 'form_complete', 'phone_click', 'email_click')),
  goal_value DECIMAL(10,2) DEFAULT 0,
  target_url TEXT,
  target_event TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(site_id, goal_name)
);

CREATE TABLE IF NOT EXISTS goal_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES conversion_goals(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  converted_at TIMESTAMP DEFAULT NOW(),
  conversion_value DECIMAL(10,2) DEFAULT 0,
  metadata JSONB,
  UNIQUE(goal_id, session_id)
);

-- ============================================
-- STEP 2: Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_conversion_goals_site_id
ON conversion_goals(site_id);

CREATE INDEX IF NOT EXISTS idx_goal_conversions_goal_id
ON goal_conversions(goal_id);

CREATE INDEX IF NOT EXISTS idx_goal_conversions_session
ON goal_conversions(session_id);

CREATE INDEX IF NOT EXISTS idx_goal_conversions_site_date
ON goal_conversions(site_id, converted_at DESC);

-- ============================================
-- STEP 3: Enable Real-time (Optional)
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE conversion_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE goal_conversions;

DROP POLICY IF EXISTS "realtime_conversion_goals" ON conversion_goals;
CREATE POLICY "realtime_conversion_goals" ON conversion_goals
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "realtime_goal_conversions" ON goal_conversions;
CREATE POLICY "realtime_goal_conversions" ON goal_conversions
FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- STEP 4: Sample Data (Optional)
-- ============================================

INSERT INTO conversion_goals (site_id, goal_name, goal_type, target_url, goal_value)
VALUES
  ('test-site', 'Homepage Visit', 'page_view', '/', 0),
  ('test-site', 'Contact Form', 'form_complete', null, 50),
  ('test-site', 'Phone Call', 'phone_click', null, 100)
ON CONFLICT (site_id, goal_name) DO NOTHING;