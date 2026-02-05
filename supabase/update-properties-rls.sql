-- Update Properties RLS Policies for Workspace-Based Access
-- Run this in Supabase SQL Editor

-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON properties;

-- Create secure workspace-based policies
CREATE POLICY "Workspace members can view properties" ON properties
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text
    ) OR workspace_id IS NULL -- Allow legacy properties without workspace
  );

CREATE POLICY "Workspace members can insert properties" ON properties
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Workspace members can update properties" ON properties
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "Workspace members can delete properties" ON properties
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()::text
    )
  );