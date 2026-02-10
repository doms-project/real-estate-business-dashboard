-- Fix RLS policies for GHL location metrics table
-- This table contains internal system data and should be managed by service role only

-- Disable RLS for ghl_location_metrics (internal system table)
ALTER TABLE ghl_location_metrics DISABLE ROW LEVEL SECURITY;

-- Disable RLS for ghl_locations (internal system table)
ALTER TABLE ghl_locations DISABLE ROW LEVEL SECURITY;

-- Verify the tables exist and show their RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('ghl_location_metrics', 'ghl_locations')
  AND schemaname = 'public';