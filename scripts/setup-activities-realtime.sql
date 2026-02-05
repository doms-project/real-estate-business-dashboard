-- Setup Activities Table Realtime (Run in Supabase SQL Editor)
-- This script enables realtime for the activities table and sets up 48-hour cleanup

-- Enable realtime for activities table
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Update cleanup function to 48 hours (2 days)
CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM activities
  WHERE created_at < NOW() - INTERVAL '2 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Test the setup
SELECT 'Activities realtime setup complete!' as status;