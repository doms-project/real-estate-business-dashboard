/**
 * Workspace Helper Functions
 * 
 * Utility functions for workspace and team management
 */

import { supabaseAdmin } from './supabase'

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface Invitation {
  id: string
  workspace_id: string
  email: string
  invited_by: string
  role: 'admin' | 'member'
  token: string
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
  created_at: string
  accepted_at: string | null
  inviteLink?: string
}

export interface WorkspaceCreationRequest {
  id: string
  requested_by: string
  workspace_context?: string
  workspace_name: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  approved_by?: string
  approved_at?: string
  rejected_by?: string
  rejected_at?: string
  rejection_reason?: string
  created_at: string
  expires_at: string
}

/**
 * Get or create a default workspace for a user
 * If user doesn't have a workspace, creates one named "My Workspace"
 */
export async function getOrCreateUserWorkspace(userId: string): Promise<Workspace> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Get all workspaces user is associated with (as member or owner), ordered by most recent activity
  const { data: allWorkspaces, error: workspaceError } = await supabaseAdmin
    .from('workspace_members')
    .select(`
      workspace_id,
      joined_at,
      role,
      workspaces!inner (
        id,
        name,
        owner_id,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  if (workspaceError) {
    console.error('Error fetching user workspaces:', workspaceError)
  }

  // If user has workspace memberships, return the most recently joined one
  if (allWorkspaces && allWorkspaces.length > 0) {
    const mostRecentMembership = allWorkspaces[0] as any
    if (mostRecentMembership.workspaces) {
      return mostRecentMembership.workspaces as Workspace
    }
  }

  // Check if user owns any workspace (fallback for legacy data)
  const { data: ownedWorkspace, error: ownedError } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ownedWorkspace && !ownedError) {
    // Add user as owner member if not already (for legacy workspaces)
    const { data: existingMember } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', ownedWorkspace.id)
      .eq('user_id', userId)
      .single()

    if (!existingMember) {
      await supabaseAdmin
        .from('workspace_members')
        .insert({
          workspace_id: ownedWorkspace.id,
          user_id: userId,
          role: 'owner',
        })
    }

    return ownedWorkspace as Workspace
  }

  // User has no workspace, create one
  const { data: newWorkspace, error: createError } = await supabaseAdmin
    .from('workspaces')
    .insert({
      name: 'My Workspace',
      owner_id: userId,
    })
    .select()
    .single()

  if (createError || !newWorkspace) {
    console.error('Error creating workspace:', createError)
    throw new Error(`Failed to create workspace: ${createError?.message || 'Unknown error'}`)
  }

  // Add user as owner member
  const { error: memberInsertError } = await supabaseAdmin
    .from('workspace_members')
    .insert({
      workspace_id: newWorkspace.id,
      user_id: userId,
      role: 'owner',
    })

  if (memberInsertError) {
    console.error('Error adding user as workspace member:', memberInsertError)
    // Don't fail - workspace was created, member can be added later
  }

  return newWorkspace as Workspace
}

/**
 * Get all workspaces a user has access to
 */
export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  console.log('🔍 getUserWorkspaces called with userId:', userId)

  // First, get workspace memberships (this should work with service role)
  const { data: memberships, error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })

  console.log('📊 Memberships query result:')
  console.log('  - Error:', memberError)
  console.log('  - Memberships found:', memberships?.length || 0)

  if (memberError) {
    console.error('Error fetching memberships:', memberError)
    return []
  }

  if (!memberships || memberships.length === 0) {
    console.log('ℹ️ No memberships found for user')
    // Check for owned workspaces as fallback
    const { data: ownedWorkspaces, error: ownedError } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('owner_id', userId)

    console.log('🏢 Owned workspaces fallback:', ownedWorkspaces?.length || 0)
    return ownedWorkspaces || []
  }

  // Extract unique workspace IDs
  const workspaceIds = [...new Set(memberships.map(m => m.workspace_id))]
  console.log('🏢 Found workspace IDs:', workspaceIds)

  // Second, get workspace details separately
  const { data: workspaces, error: workspaceError } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, owner_id, created_at, updated_at')
    .in('id', workspaceIds)

  console.log('🏢 Workspaces query result:')
  console.log('  - Error:', workspaceError)
  console.log('  - Workspaces found:', workspaces?.length || 0)

  if (workspaceError) {
    console.error('Error fetching workspaces:', workspaceError)
    return []
  }

  // Check for any owned workspaces not in memberships (legacy data)
  const { data: ownedWorkspaces, error: ownedError } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)

  // Combine and deduplicate
  const allWorkspaces = [...(workspaces || []), ...(ownedWorkspaces || [])]
  const uniqueWorkspaces = allWorkspaces.filter((workspace, index, self) =>
    index === self.findIndex(w => w.id === workspace.id)
  )

  console.log('✅ Returning workspaces:', uniqueWorkspaces.length, uniqueWorkspaces.map(w => w.name))
  return uniqueWorkspaces
}

/**
 * Check if user can create workspace directly (owners and admins)
 */
export async function canCreateWorkspaceDirectly(userId: string): Promise<boolean> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Check if user owns any workspace
  const { data: ownedWorkspaces } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)

  if (ownedWorkspaces && ownedWorkspaces.length > 0) {
    return true
  }

  // Check if user is admin in any workspace
  const { data: adminMemberships } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .limit(1)

  return !!(adminMemberships && adminMemberships.length > 0)
}

/**
 * Get user's highest role across all workspaces
 */
export async function getHighestUserRole(userId: string): Promise<'owner' | 'admin' | 'member' | null> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Check if user is owner of any workspace
  const { data: ownedWorkspaces } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)

  if (ownedWorkspaces && ownedWorkspaces.length > 0) {
    return 'owner'
  }

  // Check if user is admin in any workspace
  const { data: adminMemberships } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .limit(1)

  if (adminMemberships && adminMemberships.length > 0) {
    return 'admin'
  }

  // Check if user is member in any workspace
  const { data: memberships } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (memberships && memberships.length > 0) {
    return 'member'
  }

  return null // No workspaces at all
}

/**
 * Submit a workspace creation request
 */
export async function submitWorkspaceCreationRequest(
  userId: string,
  workspaceName: string,
  reason?: string,
  workspaceContext?: string
): Promise<WorkspaceCreationRequest> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Check if user already has any active request for this workspace name
  const { data: existingRequests } = await supabaseAdmin
    .from('workspace_creation_requests')
    .select('id, status')
    .eq('requested_by', userId)
    .eq('workspace_name', workspaceName.trim())
    .in('status', ['pending', 'approved'])

  if (existingRequests && existingRequests.length > 0) {
    const pendingRequest = existingRequests.find(r => r.status === 'pending')
    const approvedRequest = existingRequests.find(r => r.status === 'approved')

    if (pendingRequest) {
      throw new Error('You already have a pending request for this workspace name')
    }

    if (approvedRequest) {
      throw new Error('You already have an approved request for this workspace name. The workspace should already exist.')
    }
  }

  // Check if user can create directly in this workspace
  let canCreateDirectly = false
  if (workspaceContext) {
    // Check role in the specific workspace
    const userRole = await getUserWorkspaceRole(userId, workspaceContext)
    canCreateDirectly = userRole === 'owner' || userRole === 'admin'
  } else {
    // Fallback to global check if no workspace context
    canCreateDirectly = await canCreateWorkspaceDirectly(userId)
  }

  if (canCreateDirectly) {
    throw new Error('You have permission to create workspaces directly')
  }

  const { data: request, error } = await supabaseAdmin
    .from('workspace_creation_requests')
    .insert({
      requested_by: userId,
      workspace_context: workspaceContext,
      workspace_name: workspaceName.trim(),
      reason: reason?.trim(),
    })
    .select()
    .single()

  if (error || !request) {
    throw new Error(`Failed to submit request: ${error?.message || 'Unknown error'}`)
  }

  return request as WorkspaceCreationRequest
}

/**
 * Get pending workspace creation requests for workspaces where user is admin/owner
 */
export async function getPendingWorkspaceRequests(userId: string): Promise<WorkspaceCreationRequest[]> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Get all workspaces where the user is owner or admin
  const { data: userWorkspaces, error: workspaceError } = await supabaseAdmin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])

  if (workspaceError) {
    throw new Error(`Failed to fetch user workspaces: ${workspaceError.message}`)
  }

  // Also check for owned workspaces not in members table
  const { data: ownedWorkspaces, error: ownedError } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)

  if (ownedError) {
    throw new Error(`Failed to fetch owned workspaces: ${ownedError.message}`)
  }

  // Combine workspace IDs
  const workspaceIds = [
    ...(userWorkspaces?.map(w => w.workspace_id) || []),
    ...(ownedWorkspaces?.map(w => w.id) || [])
  ].filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates

  if (workspaceIds.length === 0) {
    return [] // User has no admin/owner permissions
  }

  // Get requests from these workspaces only
  const { data: requests, error } = await supabaseAdmin
    .from('workspace_creation_requests')
    .select('*')
    .eq('status', 'pending')
    .in('workspace_context', workspaceIds)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch requests: ${error.message}`)
  }

  return (requests || []) as WorkspaceCreationRequest[]
}

/**
 * Get user's own workspace creation requests
 */
export async function getUserWorkspaceRequests(userId: string): Promise<WorkspaceCreationRequest[]> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  const { data: requests, error } = await supabaseAdmin
    .from('workspace_creation_requests')
    .select('*')
    .eq('requested_by', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch requests: ${error.message}`)
  }

  return (requests || []) as WorkspaceCreationRequest[]
}

/**
 * Approve a workspace creation request and create the workspace
 */
export async function approveWorkspaceRequest(
  requestId: string,
  approverUserId: string
): Promise<{request: WorkspaceCreationRequest, workspace: Workspace}> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Check if approver has permission
  const approverRole = await getHighestUserRole(approverUserId)
  if (approverRole !== 'owner' && approverRole !== 'admin') {
    throw new Error('You do not have permission to approve workspace requests')
  }

  // Get the request first to get the workspace name and requester
  const { data: existingRequest, error: fetchError } = await supabaseAdmin
    .from('workspace_creation_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !existingRequest) {
    throw new Error(`Request not found or already processed: ${fetchError?.message || 'Unknown error'}`)
  }

  // Update the request status
  const { data: request, error } = await supabaseAdmin
    .from('workspace_creation_requests')
    .update({
      status: 'approved',
      approved_by: approverUserId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !request) {
    throw new Error(`Failed to approve request: ${error?.message || 'Request not found or already processed'}`)
  }

  // Create the actual workspace
  const { data: newWorkspace, error: createError } = await supabaseAdmin
    .from('workspaces')
    .insert({
      name: existingRequest.workspace_name,
      owner_id: existingRequest.requested_by,
    })
    .select()
    .single()

  if (createError || !newWorkspace) {
    console.error('Failed to create workspace:', createError)
    throw new Error(`Failed to create workspace: ${createError?.message || 'Unknown error'}`)
  }

  // Add the requester as owner member
  const { error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .insert({
      workspace_id: newWorkspace.id,
      user_id: existingRequest.requested_by,
      role: 'owner',
    })

  if (memberError) {
    console.error('Failed to add workspace member:', memberError)
    // Don't fail the entire operation, but log the error
  }

  return {
    request: request as WorkspaceCreationRequest,
    workspace: newWorkspace as Workspace
  }
}

/**
 * Reject a workspace creation request
 */
export async function rejectWorkspaceRequest(
  requestId: string,
  rejectorUserId: string,
  rejectionReason?: string
): Promise<WorkspaceCreationRequest> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Check if rejector has permission
  const rejectorRole = await getHighestUserRole(rejectorUserId)
  if (rejectorRole !== 'owner' && rejectorRole !== 'admin') {
    throw new Error('You do not have permission to reject workspace requests')
  }

  // Update the request
  const { data: request, error } = await supabaseAdmin
    .from('workspace_creation_requests')
    .update({
      status: 'rejected',
      rejected_by: rejectorUserId,
      rejected_at: new Date().toISOString(),
      rejection_reason: rejectionReason?.trim(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !request) {
    throw new Error(`Failed to reject request: ${error?.message || 'Request not found or already processed'}`)
  }

  return request as WorkspaceCreationRequest
}

/**
 * Check if user has an approved request for a specific workspace name
 */
export async function hasApprovedRequest(userId: string, workspaceName: string): Promise<boolean> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  const { data: request } = await supabaseAdmin
    .from('workspace_creation_requests')
    .select('id')
    .eq('requested_by', userId)
    .eq('workspace_name', workspaceName.trim())
    .eq('status', 'approved')
    .single()

  return !!request
}

/**
 * Get workspace members
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  const { data, error } = await supabaseAdmin
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch workspace members: ${error.message}`)
  }

  return (data || []) as WorkspaceMember[]
}

/**
 * Check if user has access to a workspace
 */
export async function userHasWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Check if user owns the workspace
  const { data: owned, error: ownedError } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .single()

  if (owned && !ownedError) {
    return true
  }

  // Check if user is a member
  const { data: member, error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  return !!(member && !memberError)
}

/**
 * Get user's role in a workspace
 */
export async function getUserWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<'owner' | 'admin' | 'member' | null> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Check if user owns the workspace
  const { data: owned } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .single()

  if (owned) {
    return 'owner'
  }

  // Check membership
  const { data: member } = await supabaseAdmin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  return (member?.role as 'admin' | 'member') || null
}

/**
 * Get websites visible to a user based on their workspace roles
 * - Owners/Admins: see all websites in their workspaces
 * - Members: see only their own websites in workspaces
 * - Also includes legacy websites (workspace_id = null) created by the user
 */
export async function getUserVisibleWebsites(userId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Get all workspaces the user has access to
  const userWorkspaces = await getUserWorkspaces(userId)
  const workspaceIds = userWorkspaces.map(w => w.id)

  if (workspaceIds.length === 0) {
    // No workspaces - fall back to user_id filtering only (legacy behavior)
    const { data, error } = await supabaseAdmin
      .from('websites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch websites: ${error.message}`)
    }

    return data || []
  }

  // Build role-based filtering
  const adminWorkspaceIds: string[] = []
  const memberWorkspaceIds: string[] = []

  // Check roles for each workspace
  for (const workspaceId of workspaceIds) {
    const role = await getUserWorkspaceRole(userId, workspaceId)
    if (role === 'owner' || role === 'admin') {
      adminWorkspaceIds.push(workspaceId)
    } else if (role === 'member') {
      memberWorkspaceIds.push(workspaceId)
    }
  }

  // Build the query conditions
  const orConditions = []

  // 1. Websites in workspaces where user is owner/admin (see all)
  if (adminWorkspaceIds.length > 0) {
    orConditions.push(`workspace_id.in.(${adminWorkspaceIds.join(',')})`)
  }

  // 2. Websites created by user in workspaces where user is member (see only own)
  if (memberWorkspaceIds.length > 0) {
    orConditions.push(`and(workspace_id.in.(${memberWorkspaceIds.join(',')}),user_id.eq.${userId})`)
  }

  // 3. Legacy websites with no workspace (always see own)
  orConditions.push(`and(workspace_id.is.null,user_id.eq.${userId})`)

  // Execute the query
  const { data, error } = await supabaseAdmin
    .from('websites')
    .select('*')
    .or(orConditions.join(','))
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch websites: ${error.message}`)
  }

  return data || []
}

/**
 * Get businesses visible to a user based on their workspace roles
 * - Owners/Admins: see all businesses in their workspaces
 * - Members: see only their own businesses in workspaces
 * - Also includes legacy businesses (workspace_id = null) created by the user
 */
export async function getUserVisibleBusinesses(userId: string) {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Get all workspaces the user has access to
  const userWorkspaces = await getUserWorkspaces(userId)
  const workspaceIds = userWorkspaces.map(w => w.id)

  if (workspaceIds.length === 0) {
    // No workspaces - fall back to user_id filtering only (legacy behavior)
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch businesses: ${error.message}`)
    }

    return data || []
  }

  // Build role-based filtering
  const adminWorkspaceIds: string[] = []
  const memberWorkspaceIds: string[] = []

  // Check roles for each workspace
  for (const workspaceId of workspaceIds) {
    const role = await getUserWorkspaceRole(userId, workspaceId)
    if (role === 'owner' || role === 'admin') {
      adminWorkspaceIds.push(workspaceId)
    } else if (role === 'member') {
      memberWorkspaceIds.push(workspaceId)
    }
  }

  // Build the query conditions
  const orConditions = []

  // 1. Businesses in workspaces where user is owner/admin (see all)
  if (adminWorkspaceIds.length > 0) {
    orConditions.push(`workspace_id.in.(${adminWorkspaceIds.join(',')})`)
  }

  // 2. Businesses created by user in workspaces where user is member (see only own)
  if (memberWorkspaceIds.length > 0) {
    orConditions.push(`and(workspace_id.in.(${memberWorkspaceIds.join(',')}),user_id.eq.${userId})`)
  }

  // 3. Legacy businesses with no workspace (always see own)
  orConditions.push(`and(workspace_id.is.null,user_id.eq.${userId})`)

  // Execute the query
  const { data, error } = await supabaseAdmin
    .from('businesses')
    .select('*')
    .or(orConditions.join(','))
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch businesses: ${error.message}`)
  }

  return data || []
}

/**
 * Update a member's role in a workspace
 */
export async function updateMemberRole(
  workspaceId: string,
  memberUserId: string,
  newRole: 'admin' | 'member',
  requesterUserId: string
): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('Supabase not configured')
  }

  // Check if requester has permission
  const requesterRole = await getUserWorkspaceRole(requesterUserId, workspaceId)
  if (requesterRole !== 'owner' && requesterRole !== 'admin') {
    throw new Error('You do not have permission to update member roles')
  }

  // Cannot change the owner's role
  const memberRole = await getUserWorkspaceRole(memberUserId, workspaceId)
  if (memberRole === 'owner') {
    throw new Error('Cannot change workspace owner role')
  }

  // Cannot change your own role if you're an admin (only owner can change admin roles)
  if (memberUserId === requesterUserId && requesterRole !== 'owner') {
    throw new Error('You cannot change your own role')
  }

  // Validate role
  if (!['admin', 'member'].includes(newRole)) {
    throw new Error('Invalid role. Must be admin or member')
  }

  // Update the role
  const { error } = await supabaseAdmin
    .from('workspace_members')
    .update({ role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', memberUserId)

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`)
  }
}


