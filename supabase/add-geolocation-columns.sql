-- Add geolocation columns to website_visitors table
-- Run this in your Supabase SQL Editor to add geographic tracking

-- Add to existing website_visitors table
ALTER TABLE website_visitors
ADD COLUMN country_code TEXT,
ADD COLUMN region TEXT,
ADD COLUMN city TEXT;

-- Create index for better performance on geographic queries
CREATE INDEX IF NOT EXISTS idx_website_visitors_country_code ON website_visitors(country_code);
CREATE INDEX IF NOT EXISTS idx_website_visitors_region ON website_visitors(region);
CREATE INDEX IF NOT EXISTS idx_website_visitors_city ON website_visitors(city);