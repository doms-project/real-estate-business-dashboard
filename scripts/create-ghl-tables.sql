-- Create GHL tables for metrics and locations
-- Run this in your Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- GHL Location Metrics Table
CREATE TABLE IF NOT EXISTS ghl_location_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL UNIQUE,
  location_name TEXT NOT NULL,
  contacts_count INTEGER DEFAULT 0,
  opportunities_count INTEGER DEFAULT 0,
  conversations_count INTEGER DEFAULT 0,
  health_score DECIMAL(5,2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for GHL location metrics
CREATE INDEX IF NOT EXISTS idx_ghl_location_metrics_location_id ON ghl_location_metrics(location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_location_metrics_updated_at ON ghl_location_metrics(updated_at DESC);

-- GHL Locations Table
CREATE TABLE IF NOT EXISTS ghl_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for GHL locations
CREATE INDEX IF NOT EXISTS idx_ghl_locations_is_active ON ghl_locations(is_active);

-- Insert some sample locations (you can modify these based on your actual GHL locations)
INSERT INTO ghl_locations (id, name) VALUES
  ('1yRAByUvJdxJQHjrxKqL', 'Rent A Scooter Tulum'),
  ('7Cy0DMyQtZncgY3hOarV', 'Beth Buys Homes'),
  ('agOqs57EjbySX8vgOgAB', 'Alternabiz LLC'),
  ('be4yGETqzGQ4sknbwXb3', 'Youngstown Marketing Company'),
  ('FCX448dRtUj0VWMzPWT0', 'Blake Buys Homes'),
  ('fl6qZvSghEoV572mIyOM', 'Bernies Power & Soft'),
  ('ikoKs7PXleHTNsAYtajZ', 'ATV''S Tulum'),
  ('LmFMkp4XCICQyJxZ2NmP', 'The Mahoning Home Buyer'),
  ('qlkgwbwhyFnZJseaznt5', 'ARS CONTRACTING'),
  ('QmT69Y7kvxxol1tU8f7z', 'Amazing GraceHomeCare'),
  ('wwWN0QzriyIE8oV1YT7o', 'Choppin Throttles'),
  ('zsoH6zAUB6YKSWCiUDjN', 'Bloom Wealth Partners')
ON CONFLICT (id) DO NOTHING;