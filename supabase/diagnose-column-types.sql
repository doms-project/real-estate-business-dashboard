-- Diagnose column types to fix the type casting error
-- Run this in Supabase SQL Editor

-- Check the data types of user_id columns
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('properties', 'workspace_members', 'workspaces')
  AND column_name = 'user_id'
ORDER BY table_name, column_name;

-- Also check what auth.uid() returns
-- SELECT auth.uid(), pg_typeof(auth.uid());