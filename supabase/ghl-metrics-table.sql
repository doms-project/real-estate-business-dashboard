-- GHL Location Metrics Table
-- Stores cached metrics data from GoHighLevel API

CREATE TABLE IF NOT EXISTS ghl_location_metrics (
  location_id TEXT PRIMARY KEY,
  location_name TEXT NOT NULL,
  contacts_count INTEGER DEFAULT 0,
  opportunities_count INTEGER DEFAULT 0,
  conversations_count INTEGER DEFAULT 0,
  health_score DECIMAL(5,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghl_metrics_location_name ON ghl_location_metrics(location_name);
CREATE INDEX IF NOT EXISTS idx_ghl_metrics_last_updated ON ghl_location_metrics(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_ghl_metrics_health_score ON ghl_location_metrics(health_score DESC);

-- Update trigger for last_updated
CREATE OR REPLACE FUNCTION update_ghl_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ghl_metrics_updated_at
  BEFORE UPDATE ON ghl_location_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_ghl_metrics_updated_at();

-- ROW LEVEL SECURITY
ALTER TABLE ghl_location_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role full access to metrics data
CREATE POLICY "Service role can manage location metrics"
  ON ghl_location_metrics FOR ALL
  USING (true);

-- Allow authenticated users to read location metrics (for real-time subscriptions)
CREATE POLICY "Authenticated users can read location metrics"
  ON ghl_location_metrics FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow anon key to read location metrics (for real-time subscriptions)
CREATE POLICY "Anon users can read location metrics"
  ON ghl_location_metrics FOR SELECT
  USING (true);

-- Comments
COMMENT ON TABLE ghl_location_metrics IS 'Cached GHL location metrics to reduce API calls';
COMMENT ON COLUMN ghl_location_metrics.location_id IS 'GoHighLevel location ID';
COMMENT ON COLUMN ghl_location_metrics.contacts_count IS 'Total contacts in this location';
COMMENT ON COLUMN ghl_location_metrics.opportunities_count IS 'Total opportunities across all pipelines';
COMMENT ON COLUMN ghl_location_metrics.conversations_count IS 'Total conversations in this location';
COMMENT ON COLUMN ghl_location_metrics.health_score IS 'Calculated health score (0-100)';
COMMENT ON COLUMN ghl_location_metrics.last_updated IS 'When data was last refreshed from GHL API';
