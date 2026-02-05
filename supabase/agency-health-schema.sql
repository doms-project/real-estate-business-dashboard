-- Enhanced Agency Health Monitoring Database Schema
-- Full implementation with 60+ metrics across all categories

-- ============================================
-- AGENCY HEALTH SCORES TABLE
-- ============================================
CREATE TABLE agency_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Core Health Metrics
  overall_score DECIMAL(5,2) NOT NULL, -- 0-100 AI-calculated
  health_status TEXT NOT NULL, -- 'green', 'yellow', 'red'
  previous_score DECIMAL(5,2),
  score_change DECIMAL(5,2), -- Percentage change
  score_change_velocity DECIMAL(5,2), -- Points per day trend
  confidence_level DECIMAL(5,2), -- Data accuracy confidence
  benchmark_percentile DECIMAL(5,2), -- Performance vs other locations

  -- Component Scores (Weighted Categories)
  financial_score DECIMAL(5,2),
  operational_score DECIMAL(5,2),
  team_score DECIMAL(5,2),
  customer_score DECIMAL(5,2),
  market_score DECIMAL(5,2), -- Real estate market intelligence
  technology_score DECIMAL(5,2), -- System adoption and efficiency

  -- Financial Intelligence Metrics
  current_revenue DECIMAL(12,2),
  revenue_target DECIMAL(12,2),
  revenue_achievement_rate DECIMAL(5,2),
  revenue_growth_momentum DECIMAL(5,2),
  profit_margin_health DECIMAL(5,2),
  commission_velocity_days DECIMAL(5,2),
  cash_flow_predictability DECIMAL(5,2),
  client_lifetime_value DECIMAL(10,2),
  seasonal_revenue_variance DECIMAL(5,2),

  -- Operational Excellence Metrics
  lead_generation_efficiency DECIMAL(8,2), -- Cost per qualified lead
  lead_to_deal_conversion DECIMAL(5,2),
  pipeline_health_score DECIMAL(5,2),
  response_time_performance DECIMAL(6,2), -- Average response time
  follow_up_completion_rate DECIMAL(5,2),
  appointment_show_rate DECIMAL(5,2),
  listing_absorption_rate DECIMAL(5,2),
  market_share_position DECIMAL(5,2),

  -- Team Performance Analytics
  agent_productivity_index DECIMAL(8,2), -- Revenue per active hour
  agent_utilization_rate DECIMAL(5,2),
  team_collaboration_score DECIMAL(5,2),
  training_completion_rate DECIMAL(5,2),
  agent_retention_rate DECIMAL(5,2),
  new_agent_ramp_up_months DECIMAL(4,1),
  performance_consistency DECIMAL(5,2),
  skill_development_tracking DECIMAL(5,2),

  -- Client Experience Metrics
  client_satisfaction_score DECIMAL(3,2),
  net_promoter_score DECIMAL(5,2),
  client_retention_rate DECIMAL(5,2),
  referral_generation_rate DECIMAL(5,2),
  communication_quality DECIMAL(5,2),
  transaction_satisfaction DECIMAL(3,2),
  brand_perception_score DECIMAL(3,2),
  service_recovery_rate DECIMAL(5,2),

  -- Real Estate Market Intelligence
  market_absorption_rate DECIMAL(5,2),
  days_on_market_avg DECIMAL(6,2),
  list_to_sale_price_ratio DECIMAL(5,2),
  inventory_health_score DECIMAL(5,2),
  price_trend_momentum DECIMAL(5,2),
  competitive_position DECIMAL(5,2),
  economic_indicators_score DECIMAL(5,2),

  -- Technology & Process Metrics
  system_adoption_rate DECIMAL(5,2),
  data_quality_score DECIMAL(5,2),
  process_compliance_rate DECIMAL(5,2),
  automation_effectiveness DECIMAL(5,2),
  integration_health_score DECIMAL(5,2),
  mobile_productivity_score DECIMAL(5,2),

  -- Key Display Metrics (for tiles)
  total_deals INTEGER,
  deal_target INTEGER,
  total_leads INTEGER,
  lead_change_percentage DECIMAL(5,2),
  conversion_rate DECIMAL(5,2),
  pipeline_value DECIMAL(12,2),
  active_agents INTEGER,
  total_agents INTEGER,
  customer_rating DECIMAL(3,2),
  monthly_growth DECIMAL(5,2),

  -- Issue Intelligence & AI Analysis
  primary_issue TEXT,
  secondary_issues TEXT[],
  critical_flags TEXT[],
  risk_assessment_score DECIMAL(5,2),
  growth_opportunity_index DECIMAL(5,2),
  early_warning_signals TEXT[],

  -- Performance Charts & Trends (JSON for visualization)
  revenue_trend_30d JSONB,
  revenue_trend_90d JSONB,
  lead_trend_30d JSONB,
  conversion_trend_30d JSONB,
  team_performance_trend JSONB,
  market_trend_data JSONB,

  -- Predictive Analytics
  revenue_forecast_30d JSONB,
  revenue_forecast_90d JSONB,
  risk_probability_score DECIMAL(5,2),
  scenario_best_case DECIMAL(12,2),
  scenario_worst_case DECIMAL(12,2),

  -- Metadata & Performance
  data_freshness_score DECIMAL(5,2),
  last_data_refresh TIMESTAMP WITH TIME ZONE,
  calculation_duration_ms INTEGER,
  cache_hit_rate DECIMAL(5,2),
  api_call_count INTEGER,
  calculation_version TEXT DEFAULT '2.0',

  -- Indexes for Performance
  UNIQUE(location_id, calculated_at)
);

-- Performance optimization indexes
CREATE INDEX idx_health_scores_location_date ON agency_health_scores(location_id, calculated_at);
CREATE INDEX idx_health_scores_status_score ON agency_health_scores(health_status, overall_score);
CREATE INDEX idx_health_scores_trend_velocity ON agency_health_scores(score_change_velocity);
CREATE INDEX idx_health_scores_freshness ON agency_health_scores(data_freshness_score);

-- Note: Unique constraint on (location_id, calculated_at) ensures one score per location per timestamp
-- For daily uniqueness, consider using application logic or triggers

-- ============================================
-- HEALTH ALERTS & NOTIFICATIONS
-- ============================================
CREATE TABLE health_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'financial', 'operational', 'team', 'customer'
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,

  acknowledged_by TEXT,
  resolution_notes TEXT,

  -- Additional metadata
  trigger_metric TEXT,
  trigger_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  escalation_level INTEGER DEFAULT 0,
  notification_channels TEXT[] -- ['email', 'sms', 'slack']
);

-- Indexes for alerts
CREATE INDEX idx_alerts_location_status ON health_alerts(location_id, status);
CREATE INDEX idx_alerts_severity_created ON health_alerts(severity, created_at);
CREATE INDEX idx_alerts_type ON health_alerts(alert_type);

-- ============================================
-- LOCATION PERFORMANCE HISTORY
-- ============================================
CREATE TABLE location_performance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Raw Metrics
  total_revenue DECIMAL(12,2),
  total_contacts INTEGER,
  total_opportunities INTEGER,
  conversion_rate DECIMAL(5,2),

  -- Calculated Metrics
  revenue_target DECIMAL(12,2),
  target_achievement DECIMAL(5,2),
  growth_rate DECIMAL(5,2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance history
CREATE INDEX idx_performance_location_period ON location_performance_history(location_id, period_start, period_end);
CREATE INDEX idx_performance_growth ON location_performance_history(growth_rate);

-- ============================================
-- AGENCY SETTINGS & THRESHOLDS
-- ============================================
CREATE TABLE agency_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_type TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB,

  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Unique constraint on setting type and key
CREATE UNIQUE INDEX idx_settings_type_key ON agency_settings(setting_type, setting_key);

-- ============================================
-- PREDICTIVE ANALYTICS CACHE
-- ============================================
CREATE TABLE predictive_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL,
  cache_type TEXT NOT NULL, -- 'forecast', 'trend', 'risk', 'benchmark'
  cache_key TEXT NOT NULL,
  cache_data JSONB,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for predictive cache
CREATE INDEX idx_predictive_cache_location_type ON predictive_cache(location_id, cache_type);
CREATE INDEX idx_predictive_cache_expires ON predictive_cache(expires_at);

-- ============================================
-- USER PREFERENCES & CUSTOMIZATIONS
-- ============================================
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  preference_type TEXT NOT NULL, -- 'dashboard', 'alerts', 'notifications'
  preference_key TEXT NOT NULL,
  preference_value JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user preferences
CREATE UNIQUE INDEX idx_user_prefs_user_type_key ON user_preferences(user_id, preference_type, preference_key);

-- ============================================
-- DATA QUALITY AUDIT LOG
-- ============================================
CREATE TABLE data_quality_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL,
  audit_type TEXT NOT NULL, -- 'validation', 'correction', 'anomaly'
  metric_name TEXT NOT NULL,
  original_value DECIMAL(15,4),
  corrected_value DECIMAL(15,4),
  validation_rule TEXT,
  severity TEXT NOT NULL, -- 'info', 'warning', 'error'

  audited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  audited_by TEXT
);

-- Indexes for data quality audit
CREATE INDEX idx_audit_location_type ON data_quality_audit(location_id, audit_type);
CREATE INDEX idx_audit_severity_audited ON data_quality_audit(severity, audited_at);

-- ============================================
-- NOTIFICATION LOG
-- ============================================
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID REFERENCES health_alerts(id),
  notification_type TEXT NOT NULL, -- 'email', 'sms', 'slack', 'push'
  recipient TEXT NOT NULL,
  status TEXT NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced'
  message_content TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notification log
CREATE INDEX idx_notifications_alert_type ON notification_log(alert_id, notification_type);
CREATE INDEX idx_notifications_status_sent ON notification_log(status, sent_at);

-- ============================================
-- EXPORT LOG & AUDIT
-- ============================================
CREATE TABLE export_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  export_type TEXT NOT NULL, -- 'pdf', 'excel', 'csv', 'json'
  location_ids TEXT[],
  date_range JSONB,
  file_name TEXT,
  file_size_bytes INTEGER,
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  download_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for export log
CREATE INDEX idx_exports_user_created ON export_log(user_id, created_at);
CREATE INDEX idx_exports_status ON export_log(status);