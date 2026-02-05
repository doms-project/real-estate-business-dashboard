-- Add Monthly Metrics Table for Growth Calculations
-- Run this in Supabase SQL Editor to add monthly metrics tracking

-- Create the monthly metrics table
CREATE TABLE IF NOT EXISTS ghl_monthly_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL, -- GHL location ID
  month_start DATE NOT NULL, -- First day of the month
  contacts_count INTEGER DEFAULT 0,
  conversations_count INTEGER DEFAULT 0,
  opportunities_count INTEGER DEFAULT 0,
  opportunities_value DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id, month_start)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghl_monthly_metrics_location_id ON ghl_monthly_metrics(location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_monthly_metrics_month ON ghl_monthly_metrics(month_start);

-- Enable RLS
ALTER TABLE ghl_monthly_metrics ENABLE ROW LEVEL SECURITY;

-- Add policies (adjust based on your auth setup)
CREATE POLICY "Users can view monthly metrics" ON ghl_monthly_metrics
  FOR SELECT USING (true);

CREATE POLICY "Users can manage monthly metrics" ON ghl_monthly_metrics
  FOR ALL USING (true);


