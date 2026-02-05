-- Migration: Add activities table for recent activity feed

-- ============================================
-- ACTIVITIES TABLE (Recent Activity Feed)
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for activities
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_id ON activities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- Enable RLS for activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activities
DROP POLICY IF EXISTS "Users can view their own activities" ON activities;
CREATE POLICY "Users can view their own activities" ON activities
  FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert their own activities" ON activities;
CREATE POLICY "Users can insert their own activities" ON activities
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Auto-cleanup function for old activities (keeps only 1 day)
CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM activities
  WHERE created_at < NOW() - INTERVAL '1 day';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Note: To enable automatic daily cleanup, install pg_cron extension and run:
-- SELECT cron.schedule('cleanup-activities-daily', '0 0 * * *', 'SELECT cleanup_old_activities();');
--
-- Alternatively, run the cleanup script manually:
-- npm run cleanup:activities