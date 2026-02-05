-- Migration to add client_websites table
-- Run this in Supabase SQL Editor

-- Create the client_websites table
CREATE TABLE IF NOT EXISTS client_websites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ghl_location_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  website_name TEXT,
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ghl_location_id, site_id)
);

-- Add some sample data for testing
-- Replace these with your actual GHL location IDs and website siteIds
INSERT INTO client_websites (ghl_location_id, site_id, website_name, website_url)
VALUES
  ('be4yGETqzGQ4sknbwXb3', 'funnel-vRwWeI3XuXffOFsLo7YT', 'Youngstown Marketing Main Site', 'https://youngstown-marketing.com'),
  ('be4yGETqzGQ4sknbwXb3', 'test-site-123', 'Youngstown Landing Page', 'https://youngstown-marketing.com/landing')
ON CONFLICT (ghl_location_id, site_id) DO NOTHING;

-- You can add more mappings as needed:
-- ('your-ghl-location-id', 'your-website-site-id', 'Website Name', 'https://example.com')