"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Check, X, Clock, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { subscribeToUpdates } from "@/lib/realtime-updates"
import { useWorkspace } from "@/components/workspace-context"

interface WorkspaceRequest {
  id: string
  requested_by: string
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

export function WorkspaceRequestsPanel() {
  const [requests, setRequests] = useState<WorkspaceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const { toast } = useToast()
  const { refreshWorkspaces, setApprovalInProgress } = useWorkspace()

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/workspace/requests')
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()

    // Subscribe to real-time updates for workspace requests
    const unsubscribe = subscribeToUpdates('workspace_requests', (update) => {
      console.log('🏢 Real-time workspace request update received:', update)
      // Refresh requests when any change occurs
      fetchRequests()
    })

    return unsubscribe
  }, [])

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId)
    setApprovalInProgress(true)
    try {
      const response = await fetch(`/api/workspace/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Request approved",
          description: `Workspace "${data.request.workspace_name}" creation request has been approved.`
        })
        await fetchRequests()
        // Refresh workspace context to show the newly created workspace
        await refreshWorkspaces()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to approve request",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive"
      })
    } finally {
      setProcessing(null)
      setApprovalInProgress(false)
    }
  }

  const handleReject = async (requestId: string) => {
    const reason = prompt('Optional rejection reason:')
    setProcessing(requestId)

    try {
      const response = await fetch(`/api/workspace/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: reason || undefined
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Request rejected",
          description: `Workspace "${data.request.workspace_name}" creation request has been rejected.`
        })
        await fetchRequests()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to reject request",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive"
      })
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'approved':
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
          <CardTitle>Workspace Requests</CardTitle>
          <CardDescription>Loading requests...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace Creation Requests</CardTitle>
        <CardDescription>
          Review and manage workspace creation requests from team members
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No pending workspace requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{request.workspace_name}</h4>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </p>
                    {request.reason && (
                      <p className="text-sm mt-2">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </p>
                    )}
                    {request.status === 'rejected' && request.rejection_reason && (
                      <p className="text-sm mt-2 text-red-600">
                        <span className="font-medium">Rejection reason:</span> {request.rejection_reason}
                      </p>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(request.id)}
                        disabled={processing === request.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        disabled={processing === request.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}