-- ============================================
-- GHL OAUTH TOKENS TABLES
-- ============================================

-- Agency-level OAuth tokens
CREATE TABLE ghl_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL, -- GHL company/agency ID
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  user_type TEXT NOT NULL, -- 'Company' for agency, 'Location' for sub-account
  scopes TEXT[], -- Array of granted scopes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id)
);

-- Sub-account (location) specific tokens
CREATE TABLE ghl_location_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL, -- GHL location/sub-account ID
  company_id TEXT NOT NULL, -- Parent agency ID
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  scopes TEXT[], -- Array of granted scopes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id)
);

-- ============================================
-- INDEXES FOR OAUTH TOKENS
-- ============================================

CREATE INDEX idx_ghl_oauth_tokens_company_id ON ghl_oauth_tokens(company_id);
CREATE INDEX idx_ghl_oauth_tokens_expires_at ON ghl_oauth_tokens(expires_at);

CREATE INDEX idx_ghl_location_tokens_location_id ON ghl_location_tokens(location_id);
CREATE INDEX idx_ghl_location_tokens_company_id ON ghl_location_tokens(company_id);
CREATE INDEX idx_ghl_location_tokens_expires_at ON ghl_location_tokens(expires_at);

-- ============================================
-- ROW LEVEL SECURITY FOR OAUTH TOKENS
-- ============================================

ALTER TABLE ghl_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_location_tokens ENABLE ROW LEVEL SECURITY;

-- For now, allow service role access (since these are sensitive tokens)
-- In production, you might want more restrictive policies
CREATE POLICY "Service role can manage OAuth tokens"
  ON ghl_oauth_tokens FOR ALL
  USING (true);

CREATE POLICY "Service role can manage location tokens"
  ON ghl_location_tokens FOR ALL
  USING (true);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_ghl_oauth_tokens_updated_at
  BEFORE UPDATE ON ghl_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ghl_location_tokens_updated_at
  BEFORE UPDATE ON ghl_location_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();