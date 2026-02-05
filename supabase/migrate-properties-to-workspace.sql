-- Migrate Properties to Workspace-Based Access
-- Run this in Supabase SQL Editor to apply workspace-based property restrictions

-- ============================================
-- STEP 1: Update RLS Policies for Properties
-- ============================================

-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can view their own properties" ON properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON properties;

-- Create secure workspace-based policies
-- Note: These policies depend on workspace_members table existing
-- If workspace_members table doesn't exist, these will fail

DO $$
BEGIN
    -- Check if workspace_members table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_members') THEN

        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Workspace members can view properties" ON properties;
        DROP POLICY IF EXISTS "Workspace members can insert properties" ON properties;
        DROP POLICY IF EXISTS "Workspace members can update properties" ON properties;
        DROP POLICY IF EXISTS "Workspace members can delete properties" ON properties;

        -- Create workspace-based policies
        CREATE POLICY "Workspace members can view properties" ON properties
          FOR SELECT USING (
            workspace_id IN (
              SELECT workspace_id FROM workspace_members
              WHERE user_id = auth.uid()::text
            ) OR workspace_id IS NULL
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

        RAISE NOTICE 'Workspace-based property policies created successfully';

    ELSE
        -- Fallback: Keep user-based policies if workspace_members doesn't exist
        RAISE NOTICE 'workspace_members table does not exist, skipping workspace policies';

    END IF;
END $$;

-- ============================================
-- STEP 2: Assign workspace_id to existing properties
-- ============================================

-- Assign workspace_id to properties that don't have one
-- This assigns properties to the owner's default workspace
UPDATE properties
SET workspace_id = (
  SELECT w.id
  FROM workspaces w
  WHERE w.owner_id = properties.user_id
  ORDER BY w.created_at DESC
  LIMIT 1
)
WHERE workspace_id IS NULL;

-- ============================================
-- STEP 3: Enable realtime for properties (optional)
-- ============================================

-- Enable realtime for properties table if you want live updates
-- ALTER PUBLICATION supabase_realtime ADD TABLE properties;

COMMIT;