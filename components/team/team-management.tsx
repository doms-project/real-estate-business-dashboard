"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, X, Mail, Crown, Shield, User, Copy, Check, Edit, Save, X as XIcon } from "lucide-react"
import { activityTracker } from "@/lib/activity-tracker"
import { useUser } from "@clerk/nextjs"
import { supabase } from '@/lib/supabase'

interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

interface Invitation {
  id: string
  workspace_id: string
  email: string
  invited_by: string
  role: 'admin' | 'member'
  token: string
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
  created_at: string
}

interface TeamManagementProps {
  workspaceId?: string // Optional since we want full system access
}

export function TeamManagement({ workspaceId }: TeamManagementProps = {}) {
  const { user } = useUser()
  const userId = user?.id
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'admin' | 'member' | null>(null)
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [userProfiles, setUserProfiles] = useState<Map<string, any>>(new Map())
  const [editingRole, setEditingRole] = useState<'admin' | 'member'>('member')
  const [updatingRole, setUpdatingRole] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const { toast, toasts } = useToast()

  // Load user profiles for display names
  const loadUserProfiles = async (members: WorkspaceMember[]) => {
    const userIds = [...new Set(members.map(m => m.user_id))]

    const { data: profiles, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', userIds)

    if (!error && profiles) {
      const profileMap = new Map()
      profiles.forEach(profile => {
        profileMap.set(profile.id, profile)
      })
      setUserProfiles(profileMap)
    }
  }

  // Get user display name from profile or fallback to user ID
  const getUserDisplayName = (userId: string): string => {
    const profile = userProfiles.get(userId)
    if (profile) {
      if (profile.first_name && profile.last_name) {
        return `${profile.first_name} ${profile.last_name}`
      }
      if (profile.email) {
        return profile.email
      }
    }
    return `Team Member (${userId.slice(0, 8)}...)`
  }

  // Get user email from profile
  const getUserEmail = (userId: string): string | null => {
    const profile = userProfiles.get(userId)
    return profile?.email || null
  }

  const fetchMembers = async () => {
    try {
      // Get team members for the current workspace
      const response = await fetch(`/api/workspace/members?workspaceId=${workspaceId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch members')
      }
      const data = await response.json()
      const fetchedMembers = data.members || []
      setMembers(fetchedMembers)
      // Load user profiles for display names
      if (fetchedMembers.length > 0) {
        loadUserProfiles(fetchedMembers)
      }
      // Set the current user's role from the API response
      setCurrentUserRole(data.userRole)
    } catch (error: any) {
      console.error('Error fetching members:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load team members",
        variant: "destructive",
      })
    }
  }

  const fetchInvitations = async () => {
    try {
      // Get pending invitations for the current workspace
      const response = await fetch(`/api/workspace/invitations?workspaceId=${workspaceId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch invitations')
      }
      const data = await response.json()
      setInvitations(data.invitations || [])
    } catch (error: any) {
      console.error('Error fetching invitations:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      if (!userId) return

      setLoading(true)

      try {
        // Load team data (user role will be set by fetchMembers)
        await Promise.all([fetchMembers(), fetchInvitations()])
      } catch (error) {
        console.error('Failed to load team data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, userId])

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    setInviting(true)
    try {
      const response = await fetch('/api/workspace/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: workspaceId,
          email: inviteEmail,
          role: inviteRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      const inviteLink = data.invitation?.inviteLink

      // Log team member invitation activity
      if (userId) {
        try {
          await activityTracker.logTeamMemberAdded(userId, inviteEmail, inviteRole, workspaceId)
        } catch (activityError) {
          console.error('Failed to log team member invitation activity:', activityError)
          // Don't fail the main operation if activity logging fails
        }
      }

      toast({
        title: "Invitation Sent",
        description: inviteLink
          ? `Invitation sent to ${inviteEmail}. Share the link: ${inviteLink}`
          : `Invitation sent to ${inviteEmail}. They'll be prompted to join when they sign up.`,
      })

      setInviteEmail("")
      setInviteRole('member')
      await fetchInvitations()
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      })
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberUserId: string) => {
    console.log('handleRemoveMember called with:', memberUserId, 'workspaceId:', workspaceId)

    if (!confirm('Are you sure you want to remove this member?')) {
      console.log('User cancelled member removal')
      return
    }

    console.log('User confirmed removal, proceeding...')
    setRemovingMemberId(memberUserId)
    try {
      console.log('Making DELETE request to:', `/api/workspace/members?workspaceId=${workspaceId}&userId=${memberUserId}`)

      const response = await fetch(
        `/api/workspace/members?workspaceId=${workspaceId}&userId=${memberUserId}`,
        {
          method: 'DELETE',
        }
      )

      console.log('DELETE response status:', response.status)
      const data = await response.json()
      console.log('DELETE response data:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member')
      }

      console.log('Member removal successful, showing toast and refreshing members')
      toast({
        title: "Member Removed",
        description: "Member has been removed from the workspace",
      })

      await fetchMembers()
      console.log('Members refreshed after removal')
    } catch (error: any) {
      console.error('Error removing member:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      })
    } finally {
      setRemovingMemberId(null)
    }
  }

  const handleCopyInviteLink = async (invitation: Invitation) => {
    const inviteLink = `${window.location.origin}/invite/${invitation.token}`
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopiedInviteId(invitation.id)
      toast({
        title: "Link Copied",
        description: "Invitation link copied to clipboard",
      })
      setTimeout(() => setCopiedInviteId(null), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      })
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(
        `/api/workspace/invitations?invitationId=${invitationId}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel invitation')
      }

      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled",
      })

      await fetchInvitations()
    } catch (error: any) {
      console.error('Error cancelling invitation:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to cancel invitation",
        variant: "destructive",
      })
    }
  }

  const handleEditRole = (memberId: string, currentRole: 'admin' | 'member') => {
    setEditingMemberId(memberId)
    setEditingRole(currentRole)
  }

  const handleCancelEdit = () => {
    setEditingMemberId(null)
    setEditingRole('member')
  }

  const handleSaveRole = async (memberUserId: string) => {
    setUpdatingRole(true)
    try {
      const response = await fetch(
        `/api/workspace/members?workspaceId=${workspaceId}&userId=${memberUserId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: editingRole }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update role')
      }

      toast({
        title: "Success",
        description: "Member role updated successfully",
      })

      // Refresh data
      await fetchMembers()
      setEditingMemberId(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update member role",
        variant: "destructive",
      })
    } finally {
      setUpdatingRole(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />
      default:
        return <User className="h-4 w-4 text-gray-500" />
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Owner</Badge>
      case 'admin':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Admin</Badge>
      default:
        return <Badge variant="outline">Member</Badge>
    }
  }

  if (loading) {
    return <div className="p-8">Loading team members...</div>
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-4 rounded-lg shadow-lg border ${
              t.variant === 'destructive'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-green-50 border-green-200 text-green-800'
            }`}
          >
            {t.title && <div className="font-semibold">{t.title}</div>}
            <div className="text-sm">{t.description}</div>
          </div>
        ))}
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">How Team Invitations Work</h3>
              <p className="text-sm text-blue-800 mb-2">
                Team members get <strong>full access</strong> to all your business data, properties, websites, clients, and analytics for seamless collaboration.
              </p>
              <p className="text-sm text-blue-800">
                Enter your teammate&apos;s email address below. They&apos;ll receive an invitation and get immediate full system access once they accept.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invite New Member - Owners and admins can send invitations */}
      {currentUserRole === 'owner' || currentUserRole === 'admin' ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite Team Member</CardTitle>
            <CardDescription>
              Send an invitation to grant full system access for complete collaboration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="w-32 space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(value: 'admin' | 'member') => setInviteRole(value)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {inviting ? 'Sending...' : 'Invite'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Team Invitations</CardTitle>
            <CardDescription>
              Only workspace owners can send team invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">
                Contact the workspace owner to invite new team members
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? 'member' : 'members'} in this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getRoleIcon(member.role)}
                  <div>
                    <div className="font-medium">
                      {member.user_id === userId ? (
                        <span className="flex items-center gap-2">
                          {(() => {
                            const displayName = getUserDisplayName(userId);
                            return displayName !== `Team Member (${userId.slice(0, 8)}...)` ?
                              `${displayName} (${currentUserRole === 'owner' ? 'Owner' : currentUserRole === 'admin' ? 'Admin' : 'Member'})` :
                              `You (${currentUserRole === 'owner' ? 'Owner' : currentUserRole === 'admin' ? 'Admin' : 'Member'})`;
                          })()}
                          <Badge variant="outline" className="text-xs">
                            {currentUserRole === 'owner' ? 'Owner' :
                             currentUserRole === 'admin' ? 'Admin' : 'Member'}
                          </Badge>
                        </span>
                      ) : (
                        getUserDisplayName(member.user_id)
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                    {(() => {
                      const userEmail = getUserEmail(member.user_id);
                      const displayName = getUserDisplayName(member.user_id);
                      const isEmailAsDisplay = userEmail === displayName;

                      return userEmail && !isEmailAsDisplay ? (
                        <div className="text-xs text-muted-foreground">
                          {userEmail}
                        </div>
                      ) : null;
                    })()}
                    <div className="text-xs text-muted-foreground font-mono break-all">
                      {member.user_id}
                    </div>
                    {member.user_id === userId ? (
                      <div className="text-xs text-primary font-medium">
                        {currentUserRole === 'owner' ? 'Workspace owner - full control' : 'Team member - full system access'}
                      </div>
                    ) : (
                      <div className="text-xs text-primary font-medium">
                        Full system access granted
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {editingMemberId === member.id ? (
                    // Editing mode
                    <>
                      <Select
                        value={editingRole}
                        onValueChange={(value: 'admin' | 'member') => setEditingRole(value)}
                        disabled={updatingRole}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSaveRole(member.user_id)}
                        disabled={updatingRole}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        disabled={updatingRole}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    // Normal mode
                    <>
                      {getRoleBadge(member.role)}
                      {(currentUserRole === 'owner' || currentUserRole === 'admin') && member.role !== 'owner' && member.user_id !== userId && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRole(member.id, member.role as 'admin' | 'member')}
                            title="Edit role"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="text-destructive hover:text-destructive"
                            title="Remove member"
                            disabled={removingMemberId === member.user_id}
                          >
                            {removingMemberId === member.user_id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No team members yet</p>
                <p className="text-sm mb-4">Invite your first team member below</p>
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg max-w-md mx-auto">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    💡 <strong>Full System Access:</strong> Team members will get complete access to all your business data,
                    properties, websites, clients, and analytics for seamless collaboration.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              {invitations.filter(i => i.status === 'pending').length} pending invitation{invitations.filter(i => i.status === 'pending').length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations
                .filter(inv => inv.status === 'pending')
                .map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{invitation.email}</div>
                        <div className="text-sm text-muted-foreground">
                          Invited {new Date(invitation.created_at).toLocaleDateString()} • 
                          Expires {new Date(invitation.expires_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRoleBadge(invitation.role)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyInviteLink(invitation)}
                        title="Copy invitation link"
                      >
                        {copiedInviteId === invitation.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        title="Cancel invitation"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

