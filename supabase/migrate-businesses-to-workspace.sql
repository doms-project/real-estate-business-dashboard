-- Migrate Businesses to Workspace-Based Access
-- Run this in Supabase SQL Editor to apply workspace-based business restrictions

-- ============================================
-- STEP 1: Add workspace_id column to businesses table
-- ============================================

-- Add workspace_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'businesses' AND column_name = 'workspace_id') THEN
        ALTER TABLE businesses ADD COLUMN workspace_id TEXT;
        RAISE NOTICE 'Added workspace_id column to businesses table';
    ELSE
        RAISE NOTICE 'workspace_id column already exists in businesses table';
    END IF;
END $$;

-- Add index for workspace_id
CREATE INDEX IF NOT EXISTS idx_businesses_workspace_id ON businesses(workspace_id);

-- ============================================
-- STEP 2: Update RLS Policies for Businesses
-- ============================================

-- Drop existing user-based policies
DROP POLICY IF EXISTS "Users can view their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can insert their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can update their own businesses" ON businesses;
DROP POLICY IF EXISTS "Users can delete their own businesses" ON businesses;

-- Create secure workspace-based policies
-- Note: These policies depend on workspace_members table existing
-- If workspace_members table doesn't exist, these will fail

DO $$
BEGIN
    -- Check if workspace_members table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_members') THEN

        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Workspace members can view businesses" ON businesses;
        DROP POLICY IF EXISTS "Workspace members can insert businesses" ON businesses;
        DROP POLICY IF EXISTS "Workspace members can update businesses" ON businesses;
        DROP POLICY IF EXISTS "Workspace members can delete businesses" ON businesses;

        -- Create workspace-based policies
        CREATE POLICY "Workspace members can view businesses" ON businesses
          FOR SELECT USING (
            workspace_id IN (
              SELECT workspace_id FROM workspace_members
              WHERE user_id = auth.uid()::text
            ) OR workspace_id IS NULL
          );

        CREATE POLICY "Workspace members can insert businesses" ON businesses
          FOR INSERT WITH CHECK (
            workspace_id IN (
              SELECT workspace_id FROM workspace_members
              WHERE user_id = auth.uid()::text
            )
          );

        CREATE POLICY "Workspace members can update businesses" ON businesses
          FOR UPDATE USING (
            workspace_id IN (
              SELECT workspace_id FROM workspace_members
              WHERE user_id = auth.uid()::text
            )
          );

        CREATE POLICY "Workspace members can delete businesses" ON businesses
          FOR DELETE USING (
            workspace_id IN (
              SELECT workspace_id FROM workspace_members
              WHERE user_id = auth.uid()::text
            )
          );

        RAISE NOTICE 'Workspace-based business policies created successfully';

    ELSE
        -- Fallback: Keep user-based policies if workspace_members doesn't exist
        RAISE NOTICE 'workspace_members table does not exist, skipping workspace policies';

    END IF;
END $$;

-- ============================================
-- STEP 3: Assign workspace_id to existing businesses
-- ============================================

-- Assign workspace_id to businesses that don't have one
-- This assigns businesses to the owner's default workspace
UPDATE businesses
SET workspace_id = (
  SELECT w.id
  FROM workspaces w
  WHERE w.owner_id = businesses.user_id
  ORDER BY w.created_at DESC
  LIMIT 1
)
WHERE workspace_id IS NULL;

-- ============================================
-- STEP 4: Enable realtime for businesses (optional)
-- ============================================

-- Enable realtime for businesses table if you want live updates
-- ALTER PUBLICATION supabase_realtime ADD TABLE businesses;

COMMIT;