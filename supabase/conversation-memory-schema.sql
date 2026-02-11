-- ============================================
-- CONVERSATION MEMORY & BUSINESS INTELLIGENCE SCHEMA
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONVERSATION HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  conversation_id TEXT NOT NULL, -- Groups messages by conversation thread
  message_id TEXT NOT NULL UNIQUE, -- Unique identifier for each message
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Store analysis results, insights, referenced data, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_workspace ON ai_conversations(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_conversation_id ON ai_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_role ON ai_conversations(role);

-- Row Level Security
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Users can only access their own conversations
CREATE POLICY "Users can access their own conversations"
  ON ai_conversations FOR ALL
  USING (auth.uid()::text = user_id);

-- ============================================
-- CONVERSATION SUMMARIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_summaries (
  conversation_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  summary TEXT NOT NULL, -- AI-generated summary of the conversation
  key_topics TEXT[] DEFAULT '{}', -- Array of main topics discussed
  key_insights TEXT[] DEFAULT '{}', -- Array of important insights generated
  action_items TEXT[] DEFAULT '{}', -- Array of action items suggested
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_workspace ON conversation_summaries(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_last_message ON conversation_summaries(last_message_at DESC);

-- Row Level Security
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own conversation summaries"
  ON conversation_summaries FOR ALL
  USING (auth.uid()::text = user_id);

-- ============================================
-- USER BUSINESS CONTEXT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_user_context (
  user_id TEXT PRIMARY KEY,
  workspace_id TEXT,

  -- Business preferences
  business_goals TEXT[] DEFAULT '{}',
  preferred_analysis_types TEXT[] DEFAULT '{}',
  communication_style TEXT DEFAULT 'professional',
  expertise_level TEXT DEFAULT 'intermediate',

  -- AI behavior preferences
  proactive_insights BOOLEAN DEFAULT true,
  external_knowledge_enabled BOOLEAN DEFAULT true,
  real_time_alerts BOOLEAN DEFAULT true,

  -- Business intelligence settings
  industry_focus TEXT[] DEFAULT '{}',
  key_metrics TEXT[] DEFAULT '{}',
  risk_tolerance TEXT DEFAULT 'moderate',

  -- Conversation memory
  conversation_memory_days INTEGER DEFAULT 30,
  max_conversation_history INTEGER DEFAULT 100,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_user_context_workspace ON ai_user_context(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_context_last_active ON ai_user_context(last_active DESC);

-- Row Level Security
ALTER TABLE ai_user_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own context"
  ON ai_user_context FOR ALL
  USING (auth.uid()::text = user_id);

-- ============================================
-- BUSINESS INSIGHTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS business_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  insight_type TEXT NOT NULL, -- 'opportunity', 'risk', 'trend', 'recommendation', 'alert'
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data_references JSONB DEFAULT '{}', -- Which data points this insight is based on
  recommendations TEXT[] DEFAULT '{}', -- Suggested actions
  impact_estimate TEXT, -- Expected impact (revenue, efficiency, etc.)
  confidence_score DECIMAL(3,2) DEFAULT 0.8, -- AI confidence in this insight (0-1)
  status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'dismissed', 'implemented'
  expires_at TIMESTAMP WITH TIME ZONE, -- When this insight becomes stale
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_insights_user_workspace ON business_insights(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_insights_type ON business_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_business_insights_severity ON business_insights(severity);
CREATE INDEX IF NOT EXISTS idx_business_insights_status ON business_insights(status);
CREATE INDEX IF NOT EXISTS idx_business_insights_expires_at ON business_insights(expires_at);

-- Row Level Security
ALTER TABLE business_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own business insights"
  ON business_insights FOR ALL
  USING (auth.uid()::text = user_id);

-- ============================================
-- EXTERNAL KNOWLEDGE CACHE
-- ============================================
CREATE TABLE IF NOT EXISTS external_knowledge_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_type TEXT NOT NULL, -- 'competitor', 'industry_benchmark', 'market_trend', 'economic_data'
  query_hash TEXT NOT NULL UNIQUE, -- Hash of the query for caching
  query_params JSONB DEFAULT '{}', -- Original query parameters
  data JSONB NOT NULL, -- Cached knowledge data
  source TEXT, -- API or source of the data
  confidence_score DECIMAL(3,2) DEFAULT 0.8,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Cache expiration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_external_knowledge_type ON external_knowledge_cache(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_external_knowledge_query_hash ON external_knowledge_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_external_knowledge_expires_at ON external_knowledge_cache(expires_at);

-- Row Level Security (global knowledge can be shared)
ALTER TABLE external_knowledge_cache DISABLE ROW LEVEL SECURITY;

-- ============================================
-- BUSINESS METRICS CACHE
-- ============================================
CREATE TABLE IF NOT EXISTS business_metrics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  metric_type TEXT NOT NULL, -- 'financial', 'operational', 'marketing', 'growth'
  metric_key TEXT NOT NULL, -- Specific metric identifier
  value JSONB NOT NULL, -- Metric value (can be number, object, array)
  calculation_method TEXT, -- How this metric was calculated
  data_sources TEXT[] DEFAULT '{}', -- Which tables/data sources were used
  time_period TEXT, -- 'current', 'last_7_days', 'last_30_days', 'last_90_days', etc.
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, workspace_id, metric_type, metric_key, time_period)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_metrics_user_workspace ON business_metrics_cache(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_business_metrics_type ON business_metrics_cache(metric_type);
CREATE INDEX IF NOT EXISTS idx_business_metrics_expires_at ON business_metrics_cache(expires_at);

-- Row Level Security
ALTER TABLE business_metrics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own business metrics"
  ON business_metrics_cache FOR ALL
  USING (auth.uid()::text = user_id);

-- ============================================
-- AI ACTION TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS ai_action_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  workspace_id TEXT,
  conversation_id TEXT,
  action_type TEXT NOT NULL, -- 'insight_generated', 'recommendation_made', 'alert_sent', 'analysis_performed'
  action_details JSONB DEFAULT '{}', -- Specific details about the action
  user_response TEXT, -- How user responded (if applicable)
  outcome TEXT, -- 'acknowledged', 'implemented', 'dismissed', 'ignored'
  impact_measured JSONB DEFAULT '{}', -- Any measured business impact
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_action_tracking_user_workspace ON ai_action_tracking(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_tracking_conversation ON ai_action_tracking(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_tracking_type ON ai_action_tracking(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_action_tracking_created_at ON ai_action_tracking(created_at DESC);

-- Row Level Security
ALTER TABLE ai_action_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own action tracking"
  ON ai_action_tracking FOR ALL
  USING (auth.uid()::text = user_id);

-- ============================================
-- FUNCTIONS FOR CONVERSATION MANAGEMENT
-- ============================================

-- Function to get conversation history
CREATE OR REPLACE FUNCTION get_conversation_history(
  p_conversation_id TEXT,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.role,
    ac.content,
    ac.metadata,
    ac.created_at
  FROM ai_conversations ac
  WHERE ac.conversation_id = p_conversation_id
    AND ac.user_id = auth.uid()::text
  ORDER BY ac.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to summarize conversation
CREATE OR REPLACE FUNCTION summarize_conversation(
  p_conversation_id TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  summary TEXT;
BEGIN
  -- This would be called by the AI to generate summaries
  -- For now, return a placeholder
  SELECT 'Conversation summary for ' || p_conversation_id INTO summary;
  RETURN summary;
END;
$$;

-- Function to get user business context
CREATE OR REPLACE FUNCTION get_user_business_context(
  p_user_id TEXT DEFAULT NULL
) RETURNS TABLE (
  business_goals TEXT[],
  preferred_analysis_types TEXT[],
  communication_style TEXT,
  expertise_level TEXT,
  proactive_insights BOOLEAN,
  external_knowledge_enabled BOOLEAN,
  real_time_alerts BOOLEAN,
  industry_focus TEXT[],
  key_metrics TEXT[],
  risk_tolerance TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    auc.business_goals,
    auc.preferred_analysis_types,
    auc.communication_style,
    auc.expertise_level,
    auc.proactive_insights,
    auc.external_knowledge_enabled,
    auc.real_time_alerts,
    auc.industry_focus,
    auc.key_metrics,
    auc.risk_tolerance
  FROM ai_user_context auc
  WHERE auc.user_id = COALESCE(p_user_id, auth.uid()::text)
  LIMIT 1;
END;
$$;

-- Function to get active business insights
CREATE OR REPLACE FUNCTION get_active_business_insights(
  p_user_id TEXT,
  p_workspace_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  insight_type TEXT,
  severity TEXT,
  title TEXT,
  description TEXT,
  recommendations TEXT[],
  impact_estimate TEXT,
  confidence_score DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.id,
    bi.insight_type,
    bi.severity,
    bi.title,
    bi.description,
    bi.recommendations,
    bi.impact_estimate,
    bi.confidence_score,
    bi.created_at
  FROM business_insights bi
  WHERE bi.user_id = p_user_id
    AND (p_workspace_id IS NULL OR bi.workspace_id = p_workspace_id)
    AND bi.status = 'active'
    AND (bi.expires_at IS NULL OR bi.expires_at > NOW())
  ORDER BY
    CASE bi.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    bi.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_summaries_updated_at
  BEFORE UPDATE ON conversation_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_user_context_updated_at
  BEFORE UPDATE ON ai_user_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_insights_updated_at
  BEFORE UPDATE ON business_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_external_knowledge_cache_updated_at
  BEFORE UPDATE ON external_knowledge_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_metrics_cache_updated_at
  BEFORE UPDATE ON business_metrics_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_action_tracking_updated_at
  BEFORE UPDATE ON ai_action_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

-- Function to clean up expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Clean up expired business insights
  DELETE FROM business_insights
  WHERE expires_at IS NOT NULL AND expires_at < NOW();

  -- Clean up expired external knowledge
  DELETE FROM external_knowledge_cache
  WHERE expires_at < NOW();

  -- Clean up expired business metrics
  DELETE FROM business_metrics_cache
  WHERE expires_at < NOW();

  -- Clean up old conversations (keep last 90 days)
  DELETE FROM ai_conversations
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Clean up old conversation summaries (keep last 6 months)
  DELETE FROM conversation_summaries
  WHERE last_message_at < NOW() - INTERVAL '6 months';
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE ai_conversations IS 'Stores conversation history for AI chat memory';
COMMENT ON TABLE conversation_summaries IS 'AI-generated summaries of conversations for quick context';
COMMENT ON TABLE ai_user_context IS 'User preferences and business context for personalized AI responses';
COMMENT ON TABLE business_insights IS 'Proactive business insights generated by AI';
COMMENT ON TABLE external_knowledge_cache IS 'Cached external business knowledge and market data';
COMMENT ON TABLE business_metrics_cache IS 'Cached calculated business metrics for performance';
COMMENT ON TABLE ai_action_tracking IS 'Tracks AI actions and user responses for learning';

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default user context for existing users (this would be done via migration)
-- This is handled by the application when users first interact with AI

COMMIT;