-- Migration to add PIT token failures table
-- Run this in your Supabase SQL Editor

-- ============================================
-- PIT TOKEN FAILURE LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pit_token_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  failure_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  endpoint TEXT NOT NULL,
  error_message TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for PIT token failures
CREATE INDEX IF NOT EXISTS idx_pit_token_failures_location_id ON pit_token_failures(location_id);
CREATE INDEX IF NOT EXISTS idx_pit_token_failures_resolved ON pit_token_failures(resolved);
CREATE INDEX IF NOT EXISTS idx_pit_token_failures_failure_time ON pit_token_failures(failure_time DESC);