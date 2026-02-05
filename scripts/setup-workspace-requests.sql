-- ============================================
-- WORKSPACE CREATION REQUESTS SETUP
-- ============================================
-- Run this SQL in your Supabase SQL Editor to add workspace creation request functionality

-- ============================================
-- WORKSPACE CREATION REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace_creation_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by TEXT NOT NULL, -- Clerk user ID
  workspace_name TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')) DEFAULT 'pending',
  approved_by TEXT, -- Clerk user ID of who approved
  approved_at TIMESTAMP,
  rejected_by TEXT, -- Clerk user ID of who rejected
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE(requested_by, workspace_name, status) -- Prevent duplicate pending requests
);

-- ============================================
-- INDEXES FOR WORKSPACE REQUESTS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_workspace_requests_requested_by ON workspace_creation_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_workspace_requests_status ON workspace_creation_requests(status);
CREATE INDEX IF NOT EXISTS idx_workspace_requests_created_at ON workspace_creation_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_requests_expires_at ON workspace_creation_requests(expires_at);

-- ============================================
-- RLS POLICIES FOR WORKSPACE REQUESTS
-- ============================================
ALTER TABLE workspace_creation_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own requests" ON workspace_creation_requests;
DROP POLICY IF EXISTS "Users can create their own requests" ON workspace_creation_requests;
DROP POLICY IF EXISTS "Users can update their pending requests" ON workspace_creation_requests;
DROP POLICY IF EXISTS "Admins and owners can view all requests" ON workspace_creation_requests;
DROP POLICY IF EXISTS "Admins and owners can update request status" ON workspace_creation_requests;

-- Users can view their own requests
CREATE POLICY "Users can view their own requests"
  ON workspace_creation_requests FOR SELECT
  USING (requested_by = current_setting('app.user_id', true));

-- Users can create their own requests
CREATE POLICY "Users can create their own requests"
  ON workspace_creation_requests FOR INSERT
  WITH CHECK (requested_by = current_setting('app.user_id', true));

-- Users can update their own pending requests (to cancel them)
CREATE POLICY "Users can update their pending requests"
  ON workspace_creation_requests FOR UPDATE
  USING (
    requested_by = current_setting('app.user_id', true) AND
    status = 'pending'
  );

-- Admins and owners can view all requests in their workspaces
CREATE POLICY "Admins and owners can view all requests"
  ON workspace_creation_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = current_setting('app.user_id', true)
      AND wm.role IN ('owner', 'admin')
    ) OR
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.owner_id = current_setting('app.user_id', true)
    )
  );

-- Admins and owners can update request status
CREATE POLICY "Admins and owners can update request status"
  ON workspace_creation_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = current_setting('app.user_id', true)
      AND wm.role IN ('owner', 'admin')
    ) OR
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.owner_id = current_setting('app.user_id', true)
    )
  );

-- ============================================
-- FUNCTION TO CHECK IF USER CAN CREATE WORKSPACE
-- ============================================
CREATE OR REPLACE FUNCTION can_create_workspace_directly(p_user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Check if user owns any workspace
  IF EXISTS (SELECT 1 FROM workspaces WHERE owner_id = p_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Check if user is admin in any workspace
  IF EXISTS (
    SELECT 1 FROM workspace_members
    WHERE user_id = p_user_id AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Otherwise, they need approval
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION TO CLEANUP EXPIRED REQUESTS
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_workspace_requests()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE workspace_creation_requests
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;