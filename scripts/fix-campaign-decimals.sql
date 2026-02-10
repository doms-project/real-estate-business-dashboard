-- Fix decimal precision issues in campaigns table
-- This migration updates the CTR and ROAS fields to handle larger values

-- Alter CTR column to allow higher precision (up to 999.9999%)
ALTER TABLE campaigns ALTER COLUMN ctr TYPE DECIMAL(7,4);

-- Alter ROAS column to allow higher precision
ALTER TABLE campaigns ALTER COLUMN roas TYPE DECIMAL(6,2);

-- Add default values for calculated metrics
ALTER TABLE campaigns ALTER COLUMN ctr SET DEFAULT 0;
ALTER TABLE campaigns ALTER COLUMN cpc SET DEFAULT 0;
ALTER TABLE campaigns ALTER COLUMN cpa SET DEFAULT 0;
ALTER TABLE campaigns ALTER COLUMN roas SET DEFAULT 0;

-- Recalculate metrics for existing campaigns where data exists
UPDATE campaigns
SET
  ctr = CASE WHEN impressions > 0 THEN LEAST((clicks::DECIMAL / impressions) * 100, 100) ELSE 0 END,
  cpc = CASE WHEN clicks > 0 THEN spent / clicks ELSE 0 END,
  cpa = CASE WHEN conversions > 0 THEN spent / conversions ELSE 0 END,
  roas = CASE WHEN spent > 0 THEN (conversions * 100.0) / spent ELSE 0 END
WHERE impressions IS NOT NULL OR clicks IS NOT NULL OR conversions IS NOT NULL OR spent IS NOT NULL;