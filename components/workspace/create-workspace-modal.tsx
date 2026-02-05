"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Plus, Clock } from "lucide-react"
import { useWorkspace } from "@/components/workspace-context"
import { canCreateWorkspaceDirectly } from "@/lib/workspace-helpers"

export function CreateWorkspaceModal() {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [canCreateDirectly, setCanCreateDirectly] = useState<boolean | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const { currentWorkspace, refreshWorkspaces } = useWorkspace()

  // Check permissions when modal opens
  // For workspace creation, check role in current workspace (workspace-specific)
  useEffect(() => {
    const checkPermissions = async () => {
      if (!currentWorkspace) {
        setCanCreateDirectly(false)
        return
      }

      try {
        // Check user's role in the current workspace they are viewing
        const response = await fetch(`/api/user/permissions?workspaceId=${currentWorkspace.id}`)
        if (response.ok) {
          const data = await response.json()
          setCanCreateDirectly(data.canCreateWorkspaceDirectly)
        } else {
          // If we can't check permissions, default to request mode for safety
          setCanCreateDirectly(false)
        }
      } catch (error) {
        console.error('Failed to check permissions:', error)
        // Default to request mode for safety
        setCanCreateDirectly(false)
      }
    }

    if (open && canCreateDirectly === null) {
      checkPermissions()
    }
  }, [open, canCreateDirectly, currentWorkspace])

  const handleCreate = async () => {
    if (!name.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })

      if (response.ok) {
        toast({
          title: "Workspace created",
          description: `"${name}" has been created successfully.`
        })
        setOpen(false)
        setName("")
        // Refresh workspace context to show new workspace in dropdown
        await refreshWorkspaces()
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to create workspace",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create workspace",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async () => {
    if (!name.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/workspace/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceName: name.trim(),
          workspaceContext: currentWorkspace?.id
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Request submitted",
          description: `"${name}" creation request has been submitted for approval.`
        })
        setOpen(false)
        setName("")
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to submit request",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit workspace request",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {canCreateDirectly ? "New Workspace" : "Request Workspace"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {canCreateDirectly ? "Create New Workspace" : "Request New Workspace"}
          </DialogTitle>
          <DialogDescription>
            {canCreateDirectly
              ? "Create a new workspace to organize your properties and team."
              : "Submit a request for workspace creation. An admin or owner will review and approve your request."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              placeholder="My Real Estate Workspace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (canCreateDirectly ? handleCreate() : handleRequest())}
            />
          </div>

          {!canCreateDirectly && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-800">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Approval Required</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                Your request will be reviewed by workspace admins or owners before the workspace can be created.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={canCreateDirectly ? handleCreate : handleRequest}
            disabled={loading || !name.trim()}
          >
            {loading
              ? (canCreateDirectly ? "Creating..." : "Submitting...")
              : (canCreateDirectly ? "Create Workspace" : "Submit Request")
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}