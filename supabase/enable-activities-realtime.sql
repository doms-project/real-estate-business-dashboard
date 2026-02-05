-- Enable realtime for activities table
-- Run this in your Supabase SQL Editor to enable real-time updates for activities

-- Enable realtime publication for activities table
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Verify the publication includes activities
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'activities';