-- Simple Conversion Goals Setup - Run One Statement at a Time

-- STEP 1: Create conversion_goals table
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

-- STEP 2: Create goal_conversions table
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

-- STEP 3: Create basic indexes
CREATE INDEX IF NOT EXISTS idx_conversion_goals_site_id ON conversion_goals(site_id);
CREATE INDEX IF NOT EXISTS idx_goal_conversions_goal_id ON goal_conversions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_conversions_session ON goal_conversions(session_id);

-- STEP 4: Test tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conversion_goals', 'goal_conversions');