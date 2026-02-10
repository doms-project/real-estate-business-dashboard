// Activity tracking system for dashboard recent activity
// Tracks real user actions across the application

import { supabaseAdmin } from './supabase'
import { getOrCreateUserWorkspace, getUserWorkspaceRole } from './workspace-helpers'

export interface Activity {
  id: string
  userId: string
  type: ActivityType
  title: string
  description: string
  timestamp: Date
  metadata?: Record<string, any>
}

export type ActivityType =
  | 'website_added'
  | 'website_updated'
  | 'website_deleted'
  | 'subscription_updated'
  | 'blop_created'
  | 'blop_updated'
  | 'blop_deleted'
  | 'property_added'
  | 'property_updated'
  | 'property_deleted'
  | 'maintenance_request_added'
  | 'maintenance_request_updated'
  | 'maintenance_request_deleted'
  | 'location_added'
  | 'location_updated'
  | 'client_added'
  | 'client_updated'
  | 'ghl_sync'
  | 'ghl_location_changed'
  | 'ghl_contact_added'
  | 'ghl_opportunity_created'
  | 'settings_updated'
  | 'team_member_added'
  | 'team_member_role_updated'
  | 'photos_uploaded'
  | 'document_uploaded'
  | 'ghl_location_added'
  | 'ghl_campaigns_fetched'
  | 'ghl_metrics_accessed'
  | 'ghl_metrics_refreshed'
  | 'ghl_api_error'

export const VALID_ACTIVITY_TYPES: ActivityType[] = [
  'website_added',
  'website_updated',
  'website_deleted',
  'subscription_updated',
  'blop_created',
  'blop_updated',
  'blop_deleted',
  'property_added',
  'property_updated',
  'property_deleted',
  'maintenance_request_added',
  'maintenance_request_updated',
  'maintenance_request_deleted',
  'location_added',
  'location_updated',
  'client_added',
  'client_updated',
  'ghl_sync',
  'ghl_location_changed',
  'ghl_contact_added',
  'ghl_opportunity_created',
  'settings_updated',
  'team_member_added',
  'team_member_role_updated',
  'photos_uploaded',
  'document_uploaded',
  'ghl_location_added',
  'ghl_campaigns_fetched',
  'ghl_metrics_accessed',
  'ghl_metrics_refreshed',
  'ghl_api_error'
]

// In-memory storage (in production, this would be a database)
const activities: Activity[] = []
const MAX_ACTIVITIES = 100 // Keep only the most recent 100 activities

class ActivityTracker {
  async logActivity(
    userId: string,
    type: ActivityType,
    title: string,
    description: string,
    workspaceId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      if (!supabaseAdmin) {
        console.warn('Supabase not configured, skipping activity logging')
        return
      }

      // Use provided workspaceId or get user's default workspace
      const targetWorkspaceId = workspaceId || (await getOrCreateUserWorkspace(userId)).id

      // First, check current count of activities for this workspace
      const { count } = await supabaseAdmin
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', targetWorkspaceId)

      // If we already have 50 activities for this workspace, delete the oldest one
      if (count && count >= 50) {
        const { data: oldestActivity } = await supabaseAdmin
          .from('activities')
          .select('id')
          .eq('workspace_id', targetWorkspaceId)
          .order('created_at', { ascending: true })
          .limit(1)
          .single()

        if (oldestActivity) {
          await supabaseAdmin
            .from('activities')
            .delete()
            .eq('id', oldestActivity.id)
        }
      }

      // Insert the new activity
      const { error } = await supabaseAdmin
        .from('activities')
        .insert({
          user_id: userId,
          workspace_id: targetWorkspaceId,
          type,
          title,
          description,
          metadata: metadata || {}
        })

      if (error) {
        console.error('Error logging activity:', error)
      } else {
        console.log(`📝 Activity logged: ${title}`)
      }
    } catch (error) {
      console.error('Failed to log activity:', error)
    }
  }

  async getRecentActivities(userId: string, limit: number = 10): Promise<Activity[]> {
    try {
      if (!supabaseAdmin) {
        console.warn('Supabase not configured, returning empty activities')
        return []
      }

      // Get user's workspace and role for role-based filtering
      const workspace = await getOrCreateUserWorkspace(userId)
      const userRole = await getUserWorkspaceRole(userId, workspace.id)

      return await this.getWorkspaceActivities(userId, workspace.id, userRole, limit)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
      return []
    }
  }

  async getWorkspaceActivities(userId: string, workspaceId: string, userRole: string | null, limit: number = 10): Promise<Activity[]> {
    try {
      if (!supabaseAdmin) {
        console.warn('Supabase not configured, returning empty activities')
        return []
      }

      let query = supabaseAdmin
        .from('activities')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit)

      // Role-based filtering: owners and admins see all workspace activities, members see only their own
      if (userRole === 'member') {
        query = query.eq('user_id', userId)
      }
      // Owners and admins see all activities (no additional filtering needed)

      const { data, error } = await query

      if (error) {
        console.error('Error fetching workspace activities:', error)
        return []
      }

      return (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        type: item.type as ActivityType,
        title: item.title,
        description: item.description,
        timestamp: new Date(item.created_at),
        metadata: item.metadata || {}
      }))
    } catch (error) {
      console.error('Failed to fetch workspace activities:', error)
      return []
    }
  }

  async getAllActivities(limit: number = 50): Promise<Activity[]> {
    try {
      if (!supabaseAdmin) {
        console.warn('Supabase not configured, returning empty activities')
        return []
      }

      const { data, error } = await supabaseAdmin
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching all activities:', error)
        return []
      }

      return (data || []).map(item => ({
        id: item.id,
        userId: item.user_id,
        type: item.type as ActivityType,
        title: item.title,
        description: item.description,
        timestamp: new Date(item.created_at),
        metadata: item.metadata || {}
      }))
    } catch (error) {
      console.error('Failed to fetch all activities:', error)
      return []
    }
  }

  // Helper methods for common activity types
  async logWebsiteAdded(userId: string, websiteName: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'website_added',
      'Added new website',
      `Added website: ${websiteName}`,
      workspaceId,
      { websiteName }
    )
  }

  async logWebsiteUpdated(userId: string, websiteName: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'website_updated',
      'Updated website',
      `Updated website: ${websiteName}`,
      workspaceId,
      { websiteName }
    )
  }

  async logBlopCreated(userId: string, blopTitle: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'blop_created',
      'Created new blop',
      `Created blop: ${blopTitle}`,
      workspaceId,
      { blopTitle }
    )
  }

  async logBlopUpdated(userId: string, blopTitle: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'blop_updated',
      'Updated blop',
      `Updated blop: ${blopTitle}`,
      workspaceId,
      { blopTitle }
    )
  }

  async logSubscriptionUpdated(userId: string, subscriptionName: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'subscription_updated',
      'Updated subscription',
      `Updated subscription: ${subscriptionName}`,
      workspaceId,
      { subscriptionName }
    )
  }

  async logGHLLocationChanged(userId: string, locationName: string, action: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'ghl_location_changed',
      'GHL Location updated',
      `${action} location: ${locationName}`,
      workspaceId,
      { locationName, action }
    )
  }

  async logGHLContactAdded(userId: string, contactName: string, locationName?: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'ghl_contact_added',
      'New GHL contact',
      `Added contact: ${contactName}${locationName ? ` in ${locationName}` : ''}`,
      workspaceId,
      { contactName, locationName }
    )
  }

  async logGHLOpportunityCreated(userId: string, opportunityName: string, locationName?: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'ghl_opportunity_created',
      'New GHL opportunity',
      `Created opportunity: ${opportunityName}${locationName ? ` in ${locationName}` : ''}`,
      workspaceId,
      { opportunityName, locationName }
    )
  }

  async logPropertyAdded(userId: string, propertyAddress: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'property_added',
      'Added new property',
      `Added property: ${propertyAddress}`,
      workspaceId,
      { propertyAddress }
    )
  }

  async logPropertyUpdated(userId: string, propertyAddress: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'property_updated',
      'Updated property',
      `Updated property: ${propertyAddress}`,
      workspaceId,
      { propertyAddress }
    )
  }

  async logPropertyDeleted(userId: string, propertyAddress: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'property_deleted',
      'Deleted property',
      `Deleted property: ${propertyAddress}`,
      workspaceId,
      { propertyAddress }
    )
  }

  async logMaintenanceRequestAdded(userId: string, propertyAddress: string, description: string, cost: number, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'maintenance_request_added',
      'Maintenance request added',
      `${description} - Cost: $${cost}`,
      workspaceId,
      { propertyAddress, description, cost }
    )
  }

  async logMaintenanceRequestUpdated(userId: string, propertyAddress: string, description: string, status: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'maintenance_request_updated',
      'Maintenance request updated',
      `${description} - Status: ${status}`,
      workspaceId,
      { propertyAddress, description, status }
    )
  }

  async logMaintenanceRequestDeleted(userId: string, propertyAddress: string, description: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'maintenance_request_deleted',
      'Maintenance request deleted',
      `${description}`,
      workspaceId,
      { propertyAddress, description }
    )
  }

  async logWebsiteDeleted(userId: string, websiteName: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'website_deleted',
      'Deleted website',
      `Deleted website: ${websiteName}`,
      workspaceId,
      { websiteName }
    )
  }

  async logBlopDeleted(userId: string, blopTitle: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'blop_deleted',
      'Deleted blop',
      `Deleted blop: ${blopTitle}`,
      workspaceId,
      { blopTitle }
    )
  }

  async logSettingsUpdated(userId: string, settingName: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'settings_updated',
      'Settings updated',
      `Updated setting: ${settingName}`,
      workspaceId,
      { settingName }
    )
  }

  async logTeamMemberAdded(userId: string, memberEmail: string, role: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'team_member_added',
      'Team member added',
      `Added ${memberEmail} as ${role}`,
      workspaceId,
      { memberEmail, role }
    )
  }

  async logTeamMemberRoleUpdated(userId: string, memberEmail: string, oldRole: string, newRole: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'team_member_role_updated',
      'Team member role changed',
      `Changed ${memberEmail}'s role from ${oldRole} to ${newRole}`,
      workspaceId,
      { memberEmail, oldRole, newRole }
    )
  }

  async logPhotosUploaded(userId: string, count: number, propertyAddress?: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'photos_uploaded',
      'Photos uploaded',
      `Uploaded ${count} photo${count > 1 ? 's' : ''}${propertyAddress ? ` for ${propertyAddress}` : ''}`,
      workspaceId,
      { count, propertyAddress }
    )
  }

  async logGHLLocationAdded(userId: string, locationName: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'ghl_location_added',
      'GHL Location Added',
      `Added new GHL location: ${locationName}`,
      workspaceId,
      { locationName }
    )
  }

  async logGHLCampaignsFetched(userId: string, campaignCount: number, locationId?: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'ghl_campaigns_fetched',
      'Campaigns Fetched',
      `Fetched ${campaignCount} campaigns${locationId ? ` from location ${locationId}` : ''}`,
      workspaceId,
      { campaignCount, locationId }
    )
  }

  async logGHLApiError(userId: string, endpoint: string, error: string, locationId?: string, workspaceId?: string): Promise<void> {
    await this.logActivity(
      userId,
      'ghl_api_error',
      'GHL API Error',
      `API call failed: ${endpoint}${locationId ? ` (location: ${locationId})` : ''} - ${error}`,
      workspaceId,
      { endpoint, locationId, error }
    )
  }
}

// Singleton instance
export const activityTracker = new ActivityTracker()

// Helper function to get relative time string
export function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInMinutes < 1) return 'Just now'
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`

  return date.toLocaleDateString()
}