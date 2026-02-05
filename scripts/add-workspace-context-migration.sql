-- Add workspace_context field to workspace_creation_requests table
-- Run this in Supabase SQL Editor to add workspace-specific request visibility

ALTER TABLE workspace_creation_requests
ADD COLUMN IF NOT EXISTS workspace_context TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_workspace_requests_workspace_context
ON workspace_creation_requests(workspace_context);

-- Add comment
COMMENT ON COLUMN workspace_creation_requests.workspace_context IS 'Workspace ID where the request was made from - requests are only visible to admins/owners of this workspace';