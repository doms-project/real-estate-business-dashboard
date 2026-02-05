-- Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to set up all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (Cached Clerk profiles for display)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Clerk user ID
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Enable RLS for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users (users can read all cached profiles for team display)
CREATE POLICY "Users can view all user profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid()::text = id);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = id);

-- ============================================
-- USER PROFILE SYNC FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION sync_user_profile(
  p_user_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO users (id, email, first_name, last_name, image_url, updated_at)
  VALUES (p_user_id, p_email, p_first_name, p_last_name, p_image_url, NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    image_url = EXCLUDED.image_url,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ============================================
-- BLOPS TABLE (Flexboard items)
-- ============================================
CREATE TABLE blops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- Clerk user ID
  workspace_id TEXT, -- Clerk organization ID (optional)
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  shape TEXT NOT NULL CHECK (shape IN ('circle', 'square', 'pill', 'diamond')),
  color TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'link', 'url', 'file', 'image', 'embed')),
  tags TEXT[], -- Array of tags
  connections TEXT[], -- Array of connected blop IDs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- WEBSITES TABLE
-- ============================================
CREATE TABLE websites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  tech_stack JSONB NOT NULL DEFAULT '{}', -- {frontend, backend, hosting, analytics, payments}
  linked_blops TEXT[], -- Array of blop IDs
  subscription_ids TEXT[], -- Array of subscription IDs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CLIENT WEBSITE MAPPING TABLE
-- ============================================
CREATE TABLE client_websites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ghl_location_id TEXT NOT NULL, -- GHL location/client ID
  site_id TEXT NOT NULL, -- Website analytics siteId
  website_name TEXT, -- Human readable name
  website_url TEXT, -- Website URL
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ghl_location_id, site_id) -- Prevent duplicate mappings
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  name TEXT NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('monthly', 'annual')),
  renewal_date DATE NOT NULL,
  category TEXT NOT NULL,
  website_id UUID REFERENCES websites(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PROPERTIES TABLE
-- ============================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  address TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('rented', 'vacant', 'under_maintenance', 'sold')),
  -- Financial fields
  mortgage_holder TEXT,
  total_mortgage_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  current_est_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  monthly_mortgage_payment DECIMAL(10, 2) NOT NULL DEFAULT 0,
  monthly_insurance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  monthly_property_tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
  monthly_other_costs DECIMAL(10, 2) NOT NULL DEFAULT 0,
  monthly_gross_rent DECIMAL(10, 2) NOT NULL DEFAULT 0,
  -- Ownership
  ownership TEXT CHECK (ownership IN ('100% ownership', '50% partner', '25% partner', '75% partner', '33% partner', '67% partner')),
  linked_websites TEXT[], -- Array of website IDs
  custom_fields JSONB, -- Custom field values stored as JSON
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- RENT ROLL UNITS TABLE (for properties)
-- ============================================
CREATE TABLE rent_roll_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  tenant_name TEXT NOT NULL,
  monthly_rent DECIMAL(10, 2) NOT NULL,
  lease_start DATE NOT NULL,
  lease_end DATE NOT NULL,
  security_deposit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- WORK REQUESTS TABLE (for properties)
-- ============================================
CREATE TABLE work_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date_logged DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'completed')) DEFAULT 'new',
  cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AGENCY CLIENTS TABLE
-- ============================================
CREATE TABLE agency_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  contacts_count INTEGER DEFAULT 0,
  websites_count INTEGER DEFAULT 0,
  tasks_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- GOHIGHLEVEL CLIENTS TABLE
-- ============================================
CREATE TABLE ghl_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- Clerk user ID (affiliate)
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  subscription_plan TEXT NOT NULL CHECK (subscription_plan IN ('starter', 'professional', 'agency', 'enterprise', 'custom')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'cancelled')) DEFAULT 'active',
  ghl_location_id TEXT,
  ghl_api_key TEXT, -- Encrypted API key (consider using Supabase Vault for encryption)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- GOHIGHLEVEL WEEKLY METRICS TABLE
-- ============================================
CREATE TABLE ghl_weekly_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES ghl_clients(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  views INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, week_start)
);

-- ============================================
-- GOHIGHLEVEL MONTHLY METRICS TABLE
-- ============================================
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

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Blops indexes
CREATE INDEX idx_blops_user_id ON blops(user_id);
CREATE INDEX idx_blops_workspace_id ON blops(workspace_id);
CREATE INDEX idx_blops_created_at ON blops(created_at DESC);

-- Websites indexes
CREATE INDEX idx_websites_user_id ON websites(user_id);
CREATE INDEX idx_websites_workspace_id ON websites(workspace_id);

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_renewal_date ON subscriptions(renewal_date);
CREATE INDEX idx_subscriptions_website_id ON subscriptions(website_id);

-- Properties indexes
CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_properties_workspace_id ON properties(workspace_id);
CREATE INDEX idx_properties_status ON properties(status);

-- Rent roll units indexes
CREATE INDEX idx_rent_roll_units_property_id ON rent_roll_units(property_id);

-- Work requests indexes
CREATE INDEX idx_work_requests_property_id ON work_requests(property_id);
CREATE INDEX idx_work_requests_status ON work_requests(status);

-- Agency clients indexes
CREATE INDEX idx_agency_clients_user_id ON agency_clients(user_id);
CREATE INDEX idx_agency_clients_workspace_id ON agency_clients(workspace_id);

-- GoHighLevel indexes
CREATE INDEX idx_ghl_clients_user_id ON ghl_clients(user_id);
CREATE INDEX idx_ghl_metrics_client_id ON ghl_weekly_metrics(client_id);
CREATE INDEX idx_ghl_metrics_week ON ghl_weekly_metrics(week_start);
CREATE INDEX idx_ghl_monthly_metrics_location_id ON ghl_monthly_metrics(location_id);
CREATE INDEX idx_ghl_monthly_metrics_month ON ghl_monthly_metrics(month_start);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE blops ENABLE ROW LEVEL SECURITY;
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_roll_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_weekly_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
-- Note: These policies use auth.uid() which requires Supabase Auth
-- Since you're using Clerk, you'll need to create a function to map Clerk user_id
-- or use a different approach with service_role key for server-side operations

-- For now, we'll create policies that check user_id directly
-- You may need to adjust these based on your authentication setup

-- Blops policies
CREATE POLICY "Users can view their own blops"
  ON blops FOR SELECT
  USING (true); -- Adjust based on your auth setup

CREATE POLICY "Users can insert their own blops"
  ON blops FOR INSERT
  WITH CHECK (true); -- Adjust based on your auth setup

CREATE POLICY "Users can update their own blops"
  ON blops FOR UPDATE
  USING (true); -- Adjust based on your auth setup

CREATE POLICY "Users can delete their own blops"
  ON blops FOR DELETE
  USING (true); -- Adjust based on your auth setup

-- Websites policies
CREATE POLICY "Users can view their own websites"
  ON websites FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own websites"
  ON websites FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own websites"
  ON websites FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own websites"
  ON websites FOR DELETE
  USING (true);

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own subscriptions"
  ON subscriptions FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own subscriptions"
  ON subscriptions FOR DELETE
  USING (true);

-- Properties policies (Workspace-based access)
CREATE POLICY "Workspace members can view properties"
  ON properties FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text
    ) OR workspace_id IS NULL -- Allow legacy properties without workspace
  );

CREATE POLICY "Workspace members can insert properties"
  ON properties FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Workspace members can update properties"
  ON properties FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Workspace members can delete properties"
  ON properties FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text
    )
  );

-- Rent roll units policies (inherit from property)
CREATE POLICY "Users can view rent roll units for their properties"
  ON rent_roll_units FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rent_roll_units.property_id
    )
  );

CREATE POLICY "Users can manage rent roll units for their properties"
  ON rent_roll_units FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = rent_roll_units.property_id
    )
  );

-- Work requests policies (inherit from property)

CREATE POLICY "Users can view work requests for their properties"
  ON work_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = work_requests.property_id
    )
  );

CREATE POLICY "Users can manage work requests for their properties"
  ON work_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = work_requests.property_id
    )
  );

-- Agency clients policies
CREATE POLICY "Users can view their own agency clients"
  ON agency_clients FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own agency clients"
  ON agency_clients FOR ALL
  USING (true);

-- GoHighLevel clients policies
CREATE POLICY "Users can view their own GHL clients"
  ON ghl_clients FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own GHL clients"
  ON ghl_clients FOR ALL
  USING (true);

-- GoHighLevel metrics policies (inherit from client)
CREATE POLICY "Users can view metrics for their GHL clients"
  ON ghl_weekly_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ghl_clients
      WHERE ghl_clients.id = ghl_weekly_metrics.client_id
    )
  );

CREATE POLICY "Users can manage metrics for their GHL clients"
  ON ghl_weekly_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ghl_clients
      WHERE ghl_clients.id = ghl_weekly_metrics.client_id
    )
  );

-- Enable RLS for monthly metrics
ALTER TABLE ghl_monthly_metrics ENABLE ROW LEVEL SECURITY;

-- Monthly metrics policies (allow all operations for now - adjust based on your auth setup)
CREATE POLICY "Users can view monthly metrics"
  ON ghl_monthly_metrics FOR SELECT
  USING (true);

CREATE POLICY "Users can manage monthly metrics"
  ON ghl_monthly_metrics FOR ALL
  USING (true);

-- ============================================
-- FUNCTIONS FOR UPDATED_AT TIMESTAMP
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_blops_updated_at BEFORE UPDATE ON blops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_websites_updated_at BEFORE UPDATE ON websites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rent_roll_units_updated_at BEFORE UPDATE ON rent_roll_units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_requests_updated_at BEFORE UPDATE ON work_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_clients_updated_at BEFORE UPDATE ON agency_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ghl_clients_updated_at BEFORE UPDATE ON ghl_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ACTIVITIES TABLE (Recent Activity Feed)
-- ============================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for activities
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_workspace_id ON activities(workspace_id);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);

-- Enable RLS for activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activities
CREATE POLICY "Users can view their own activities" ON activities
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own activities" ON activities
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Enable realtime for activities table
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Enable realtime for workspaces table
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;-- Auto-cleanup function for old activities (keeps only 2 days / 48 hours)
CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM activities
  WHERE created_at < NOW() - INTERVAL '2 days';  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN QUERY SELECT deleted_count;
END;
$$ LANGUAGE plpgsql;-- Note: To enable automatic daily cleanup, install pg_cron extension and run:
-- SELECT cron.schedule('cleanup-activities-daily', '0 0 * * *', 'SELECT cleanup_old_activities();');
--
-- Alternatively, run the cleanup script manually:
-- npm run cleanup:activities
