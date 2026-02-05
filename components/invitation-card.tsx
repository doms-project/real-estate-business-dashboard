"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Mail, Check, X, Loader2, Users } from "lucide-react"

interface Invitation {
  id: string
  workspace_id: string
  email: string
  role: 'admin' | 'member'
  invited_by?: string
  created_at: string
  expires_at: string
  workspaces?: {
    id: string
    name: string
  } | null
}

interface InvitationCardProps {
  invitation: Invitation
  variant?: 'page' | 'modal'
  onSuccess?: () => void
  onDecline?: () => void
  showToast?: boolean
}

export function InvitationCard({
  invitation,
  variant = 'page',
  onSuccess,
  onDecline,
  showToast = true
}: InvitationCardProps) {
  const router = useRouter()
  const { user } = useUser()
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  const handleAccept = async () => {
    // Check if user is authenticated
    if (!user) {
      // Redirect to sign-in with current URL as redirect
      const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
      router.push(`/sign-in?redirect_url=${encodeURIComponent(currentUrl)}`)
      return
    }

    setProcessing(true)
    try {
      const acceptResponse = await fetch('/api/workspace/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitationId: invitation.id }),
      })

      const acceptData = await acceptResponse.json()

      if (!acceptResponse.ok) {
        throw new Error(acceptData.error || 'Failed to accept invitation')
      }

      if (showToast) {
        toast({
          title: "Success!",
          description: `You've joined ${invitation.workspaces?.name}!`,
        })
      }

      // Handle success based on variant
      if (onSuccess) {
        onSuccess()
      } else if (variant === 'page') {
        // Redirect to dashboard after a short delay for page variant
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } else {
        // Reload page for modal variant
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } catch (err: any) {
      console.error('Error accepting invitation:', err)
      if (showToast) {
        toast({
          title: "Error",
          description: err.message || "Failed to accept invitation",
          variant: "destructive",
        })
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleDecline = async () => {
    setProcessing(true)
    try {
      const declineResponse = await fetch(
        `/api/workspace/invitations?invitationId=${invitation.id}`,
        {
          method: 'DELETE',
        }
      )

      const declineData = await declineResponse.json()

      if (!declineResponse.ok) {
        throw new Error(declineData.error || 'Failed to decline invitation')
      }

      if (showToast) {
        toast({
          title: "Invitation Declined",
          description: "The invitation has been declined",
        })
      }

      // Handle decline based on variant
      if (onDecline) {
        onDecline()
      } else if (variant === 'page') {
        // Redirect to home page for page variant
        router.push('/')
      }
      // For modal variant, the parent component should handle removal
    } catch (err: any) {
      console.error('Error declining invitation:', err)
      if (showToast) {
        toast({
          title: "Error",
          description: err.message || "Failed to decline invitation",
          variant: "destructive",
        })
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-full">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <CardTitle>Workspace Invitation</CardTitle>
        </div>
        <CardDescription>
          You&apos;ve been invited to join <strong>{invitation.workspaces?.name || 'a workspace'}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Workspace:</span>
            <Badge variant="outline">{invitation.workspaces?.name}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Role:</span>
            <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'}>
              {invitation.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Invited by:</span>
            <span className="text-sm text-muted-foreground">{invitation.invited_by}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Expires:</span>
            <span className="text-sm text-muted-foreground">
              {new Date(invitation.expires_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Accept to join the workspace with full access</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={processing}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Decline
          </Button>
          <Button
            onClick={handleAccept}
            disabled={processing}
            className="flex-1"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Accept Invitation
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}