"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Clock, Check, X, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { subscribeToUpdates } from "@/lib/realtime-updates"
import { useWorkspace } from "@/components/workspace-context"

interface WorkspaceRequest {
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
  workspaceCreated?: boolean
  createdWorkspace?: any
}

export function MyWorkspaceRequests() {
  const [requests, setRequests] = useState<WorkspaceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { refreshWorkspaces } = useWorkspace()

  const fetchMyRequests = async () => {
    try {
      const response = await fetch('/api/workspace/requests?type=my')
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Failed to fetch my requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyRequests()

    // Subscribe to real-time updates for workspace requests
    const unsubscribe = subscribeToUpdates('workspace_requests', (update) => {
      console.log('🏢 Real-time workspace request update received:', update)

      if (update.type === 'request_approved' && update.workspaceCreated) {
        // Show success notification
        toast({
          title: "Workspace Created!",
          description: `"${update.data?.workspace_name}" is now ready to use.`,
        })

        // Update the specific request to show workspace was created
        setRequests(prevRequests =>
          prevRequests.map(req =>
            req.id === update.data?.id
              ? { ...req, workspaceCreated: true, createdWorkspace: update.createdWorkspace }
              : req
          )
        )

        // Refresh workspace context to show the new workspace in dropdown
        refreshWorkspaces()
      } else {
        // For other updates, refresh all requests
        fetchMyRequests()
      }
    })

    return unsubscribe
  }, [])

  const getStatusBadge = (status: string, workspaceCreated?: boolean) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Approval</Badge>
      case 'approved':
        if (workspaceCreated) {
          return <Badge variant="default" className="bg-blue-600"><Check className="h-3 w-3 mr-1" />Completed</Badge>
        }
        return <Badge variant="default"><Check className="h-3 w-3 mr-1" />Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejected</Badge>
      case 'expired':
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Workspace Requests</CardTitle>
          <CardDescription>Loading your requests...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Workspace Requests</CardTitle>
        <CardDescription>
          Track the status of your workspace creation requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>You haven't submitted any workspace requests yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{request.workspace_name}</h4>
                      {getStatusBadge(request.status, request.workspaceCreated)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Submitted {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </p>
                    {request.reason && (
                      <p className="text-sm mt-2">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </p>
                    )}
                    {request.status === 'rejected' && request.rejection_reason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-sm text-red-800">
                          <span className="font-medium">Rejection reason:</span> {request.rejection_reason}
                        </p>
                      </div>
                    )}
                    {request.status === 'approved' && request.workspaceCreated && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          ✅ <span className="font-medium">Workspace Created!</span> "{request.workspace_name}" is now ready to use.
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          You can access it from your workspace list.
                        </p>
                      </div>
                    )}
                    {request.status === 'approved' && !request.workspaceCreated && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-sm text-green-800">
                          🎉 <span className="font-medium">Approved!</span> Your workspace is being created...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}