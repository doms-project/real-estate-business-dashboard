-- Populate campaign data with actual values from the UI
-- Update each campaign with impressions, clicks, and conversions

-- Church Track campaigns
UPDATE campaigns
SET impressions = 45230, clicks = 1234, conversions = 89
WHERE name = 'Sunday Service Promotion';

UPDATE campaigns
SET impressions = 32150, clicks = 890, conversions = 45
WHERE name = 'Community Outreach';

UPDATE campaigns
SET impressions = 18900, clicks = 567, conversions = 23
WHERE name = 'Youth Program Campaign';

-- Real Estate campaigns
UPDATE campaigns
SET impressions = 125450, clicks = 3456, conversions = 156
WHERE name = 'Property Listings Ads';

UPDATE campaigns
SET impressions = 98230, clicks = 2890, conversions = 134
WHERE name = 'Lead Generation Campaign';

UPDATE campaigns
SET impressions = 156780, clicks = 4123, conversions = 78
WHERE name = 'Brand Awareness';

-- Marketing Agency campaigns
UPDATE campaigns
SET impressions = 45600, clicks = 1234, conversions = 89
WHERE name = 'Social Media Boost';

UPDATE campaigns
SET impressions = 0, clicks = 245, conversions = 67
WHERE name = 'Email Marketing Campaign';

UPDATE campaigns
SET impressions = 10, clicks = 0, conversions = 45
WHERE name = 'SEO Optimization';

-- Verify the updates
SELECT name, impressions, clicks, conversions
FROM campaigns
ORDER BY created_at DESC;