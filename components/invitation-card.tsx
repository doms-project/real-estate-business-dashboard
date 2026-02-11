"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Mail, Check, X, Loader2, Users, AlertCircle, User, LogOut, UserCheck } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  const [authError, setAuthError] = useState<string | null>(null)
  const [wrongEmail, setWrongEmail] = useState<string | null>(null)
  const { toast } = useToast()

  const handleAccept = async () => {
    setProcessing(true)
    setAuthError(null)
    setWrongEmail(null)

    try {
      const acceptResponse = await fetch('/api/workspace/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitationId: invitation.id }),
      })

      const acceptData = await acceptResponse.json()

      if (acceptResponse.status === 401) {
        // Not authenticated - redirect to login
        const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
        router.push(`/sign-in?redirect_url=${encodeURIComponent(currentUrl)}`)
        return
      }

      if (acceptResponse.status === 403) {
        // Wrong email - show specific error
        setWrongEmail(acceptData.error)
        return
      }

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
      setAuthError(err.message || "Failed to accept invitation")
    } finally {
      setProcessing(false)
    }
  }

  const handleDecline = async () => {
    setProcessing(true)
    setAuthError(null)
    setWrongEmail(null)

    try {
      const declineResponse = await fetch(
        `/api/workspace/invitations?invitationId=${invitation.id}`,
        {
          method: 'DELETE',
        }
      )

      const declineData = await declineResponse.json()

      if (declineResponse.status === 401) {
        // Not authenticated - redirect to login
        const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
        router.push(`/sign-in?redirect_url=${encodeURIComponent(currentUrl)}`)
        return
      }

      if (declineResponse.status === 403) {
        // Wrong email - show specific error
        setWrongEmail(declineData.error)
        return
      }

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
      setAuthError(err.message || "Failed to decline invitation")
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
            <span className="text-sm font-medium">Invited Email:</span>
            <span className="text-sm font-mono">{invitation.email}</span>
          </div>

          {/* Account Status Section */}
          {user ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <div>
                  <span className="text-sm font-medium text-green-800">Logged in as:</span>
                  <div className="text-sm text-green-700">{user.emailAddresses[0]?.emailAddress}</div>
                </div>
              </div>
              {user.emailAddresses[0]?.emailAddress?.toLowerCase() === invitation.email.toLowerCase() ? (
                <Badge variant="default" className="bg-green-600">✓ Correct Account</Badge>
              ) : (
                <Badge variant="destructive">✗ Wrong Account</Badge>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Not logged in</span>
              </div>
              <Badge variant="secondary">Login required</Badge>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Expires:</span>
            <span className="text-sm text-muted-foreground">
              {new Date(invitation.expires_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        {/* Error Alert */}
        {authError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}

        {/* Wrong Email Alert */}
        {wrongEmail && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div>This invitation was sent to <strong>{invitation.email}</strong></div>
                <div>You're logged in as <strong>{user?.emailAddresses[0]?.emailAddress}</strong></div>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push('/sign-in')}
                  >
                    <LogOut className="h-3 w-3 mr-1" />
                    Switch Account
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>Accept to join the workspace with full access</span>
        </div>
        {(() => {
          const currentEmail = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
          const invitedEmail = invitation.email.toLowerCase()
          const isCorrectAccount = currentEmail === invitedEmail

          if (!user) {
            // Not logged in - show login button
            return (
              <Button
                onClick={() => {
                  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
                  router.push(`/sign-in?redirect_url=${encodeURIComponent(currentUrl)}`)
                }}
                className="w-full"
              >
                <User className="h-4 w-4 mr-2" />
                Login to Accept Invitation
              </Button>
            )
          }

          if (!isCorrectAccount) {
            // Wrong account - show account switch option
            return (
              <div className="space-y-2">
                <Button
                  variant="destructive"
                  disabled
                  className="w-full"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Wrong Account - Cannot Accept
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/sign-in')}
                  className="w-full"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Switch to Correct Account
                </Button>
              </div>
            )
          }

          // Correct account - show accept/decline
          return (
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
          )
        })()}
      </CardContent>
    </Card>
  )
}