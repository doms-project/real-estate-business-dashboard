"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Edit, Save, X, Trash2 } from "lucide-react"
import { useWorkspace } from "@/components/workspace-context"
import { subscribeToUpdates } from "@/lib/realtime-updates"
import { useUser } from "@clerk/nextjs"

export function WorkspaceSettings() {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace()
  const { user } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [newName, setNewName] = useState("")
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmationStep, setDeleteConfirmationStep] = useState<'initial' | 'confirm'>('initial')
  const [workspaceNameConfirmation, setWorkspaceNameConfirmation] = useState('')
  const { toast } = useToast()

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id || !currentWorkspace?.id) {
        setRoleLoading(false)
        return
      }

      try {
        // Call the API endpoint to get user role
        const response = await fetch(`/api/user/permissions?workspaceId=${currentWorkspace.id}`)
        if (response.ok) {
          const data = await response.json()
          setUserRole(data.role)
        } else {
          console.error('Failed to fetch user role:', await response.text())
          setUserRole(null)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
        setUserRole(null)
      } finally {
        setRoleLoading(false)
      }
    }

    fetchUserRole()
  }, [user?.id, currentWorkspace?.id])

  // Subscribe to real-time workspace updates
  useEffect(() => {
    const unsubscribe = subscribeToUpdates('workspaces', (update) => {
      console.log('🏢 Real-time workspace update received:', update)
      if (update.type === 'workspace_updated' && update.data.id === currentWorkspace?.id) {
        // Refresh workspace context to get latest data
        refreshWorkspaces()
        // If we're currently editing, update the input field with the new name
        if (isEditing) {
          setNewName(update.data.name)
        }
        toast({
          title: "Workspace updated",
          description: `Workspace name changed to "${update.data.name}"`
        })
      }
    })

    return unsubscribe
  }, [currentWorkspace?.id, refreshWorkspaces, isEditing, toast])

  const handleEdit = () => {
    setNewName(currentWorkspace?.name || "")
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!newName.trim() || !currentWorkspace) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          name: newName.trim()
        })
      })

      if (response.ok) {
        toast({
          title: "Workspace updated",
          description: `Renamed to "${newName.trim()}"`
        })
        setIsEditing(false)
        // Note: Real-time updates will handle refreshing the workspace context
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to update workspace",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update workspace",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setNewName("")
    setIsEditing(false)
  }

  const handleDeleteWorkspace = () => {
    setShowDeleteDialog(true)
    setDeleteConfirmationStep('initial')
  }

  const proceedToConfirmation = () => {
    setDeleteConfirmationStep('confirm')
    setWorkspaceNameConfirmation('')
  }

  const confirmDeleteWorkspace = async () => {
    if (!currentWorkspace) return

    setLoading(true)
    try {
      const response = await fetch(`/api/workspace?workspaceId=${currentWorkspace.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Workspace deleted",
          description: `"${currentWorkspace.name}" has been permanently deleted`
        })
        // Redirect to home or refresh the page
        window.location.href = '/'
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to delete workspace",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete workspace",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setShowDeleteDialog(false)
      setDeleteConfirmationStep('initial')
      setWorkspaceNameConfirmation('')
    }
  }

  if (!currentWorkspace) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No workspace selected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Settings</CardTitle>
        <CardDescription>
          Manage your workspace name and settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            {isEditing ? (
              <div className="flex gap-2 mt-1">
                <Input
                  id="workspace-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="Enter workspace name"
                />
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={loading}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-medium">{currentWorkspace.name}</span>
                {(userRole === 'owner' || userRole === 'admin') && (
                  <Button size="sm" variant="ghost" onClick={handleEdit}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Debug: Show current user role */}
        {!roleLoading && (
          <div className="text-xs text-muted-foreground mb-2">
            Your role in this workspace: <strong>{userRole || 'Unknown'}</strong>
          </div>
        )}

        {/* Danger Zone - Delete Workspace (Owner only) */}
        {userRole === 'owner' && (
          <div className="border-t pt-4 mt-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this workspace and all associated data. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteWorkspace}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open)
        if (!open) {
          setDeleteConfirmationStep('initial')
          setWorkspaceNameConfirmation('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Workspace</DialogTitle>
            {deleteConfirmationStep === 'initial' ? (
              <DialogDescription>
                Are you sure you want to delete <strong>&ldquo;{currentWorkspace?.name}&rdquo;</strong>?
                This action cannot be undone and will permanently delete:
              </DialogDescription>
            ) : (
              <DialogDescription>
                To confirm deletion, please type <strong>&ldquo;{currentWorkspace?.name}&rdquo;</strong> below:
              </DialogDescription>
            )}
          </DialogHeader>

          {deleteConfirmationStep === 'initial' ? (
            <div className="py-4">
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>All properties and rental units</li>
                <li>All websites and website analytics</li>
                <li>All team members and invitations</li>
                <li>All activity logs and maintenance requests</li>
                <li>All workspace settings and data</li>
              </ul>
            </div>
          ) : (
            <div className="py-4">
              <Label htmlFor="workspace-confirmation" className="text-sm font-medium">
                Workspace Name
              </Label>
              <Input
                id="workspace-confirmation"
                value={workspaceNameConfirmation}
                onChange={(e) => setWorkspaceNameConfirmation(e.target.value)}
                placeholder={`Type "${currentWorkspace?.name}" to confirm`}
                className="mt-1"
                onKeyDown={(e) => e.key === 'Enter' && workspaceNameConfirmation === currentWorkspace?.name && confirmDeleteWorkspace()}
              />
              {workspaceNameConfirmation && workspaceNameConfirmation !== currentWorkspace?.name && (
                <p className="text-sm text-destructive mt-1">
                  Workspace name doesn&apos;t match. Please type exactly: <strong>{currentWorkspace?.name}</strong>
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            {deleteConfirmationStep === 'initial' ? (
              <Button
                variant="destructive"
                onClick={proceedToConfirmation}
                disabled={loading}
              >
                I understand, continue
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={confirmDeleteWorkspace}
                disabled={loading || workspaceNameConfirmation !== currentWorkspace?.name}
              >
                {loading ? "Deleting..." : "Permanently Delete Workspace"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}