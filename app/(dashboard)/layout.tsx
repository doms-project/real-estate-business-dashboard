"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { InvitationPrompt } from "@/components/team/invitation-prompt"
import { EloAiButton } from "@/components/layout/elo-ai-button"
import { PageDataProvider } from "@/components/layout/page-data-context"
import { SystemInitializer } from "@/components/system-initializer"
import { WorkspaceProvider, useWorkspace } from "@/components/workspace-context"
import { useUser, useClerk, useSession } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Mail, LogOut } from "lucide-react"
import { InvitationCard } from "@/components/invitation-card"

function WorkspaceAccessGuard({ children }: { children: React.ReactNode }) {
  const { hasWorkspaceAccess, loading, refreshWorkspaces } = useWorkspace()
  const { user } = useUser()
  const { signOut } = useClerk()
  const { session } = useSession()
  const router = useRouter()
  const [checkingInvitation, setCheckingInvitation] = useState(false)
  const [invitationChecked, setInvitationChecked] = useState(false)
  const [pendingInvitations, setPendingInvitations] = useState([])
  const [showInvitationAcceptance, setShowInvitationAcceptance] = useState(false)

  // Check invitation status dynamically if not in metadata
  useEffect(() => {
    if (user?.emailAddresses?.[0]?.emailAddress && !checkingInvitation && !invitationChecked) {
      const userMetadata = (user as any)?.publicMetadata || {}
      const invitationStatus = userMetadata.invitation_status

      // If we don't have invitation status in metadata, check dynamically
      if (!invitationStatus) {
        checkInvitationStatus(user.emailAddresses[0].emailAddress)
      } else {
        setInvitationChecked(true)
      }
    }
  }, [user, checkingInvitation, invitationChecked])

  const checkInvitationStatus = async (email: string) => {
    setCheckingInvitation(true)
    try {
      const response = await fetch(`/api/user/invitation-status?email=${encodeURIComponent(email)}`)
      const data = await response.json()

      if (response.ok && data.hasAcceptedInvitation) {
        console.log('🔄 User has accepted invitations, syncing workspace memberships...')

        // Sync workspace memberships with current user_id
        const syncResponse = await fetch('/api/user/sync-workspace-memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })

        if (syncResponse.ok) {
          const syncData = await syncResponse.json()
          console.log('✅ Workspace memberships synced:', syncData)

          // Refresh workspace context after syncing
          refreshWorkspaces()
        } else {
          console.error('❌ Failed to sync workspace memberships:', syncResponse.status)
        }

        // Update Clerk metadata with the result
        await updateUserMetadata(user!.id, {
          invitation_status: 'accepted',
          account_status: 'authorized',
          workspace_id: data.invitation?.workspace_id,
          invited_role: data.invitation?.role
        })

        // Reload Clerk session to ensure metadata updates are reflected
        if (session) {
          await session.reload()
          console.log('🔄 Clerk session reloaded after metadata update')
        }
      } else if (response.ok) {
        // No accepted invitations found
        await updateUserMetadata(user!.id, {
          invitation_status: 'none',
          account_status: 'unauthorized'
        })
      }
    } catch (error) {
      console.error('Failed to check invitation status:', error)
    } finally {
      setCheckingInvitation(false)
      setInvitationChecked(true)
    }
  }

  const updateUserMetadata = async (userId: string, metadata: any) => {
    try {
      await fetch('/api/user/metadata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, metadata })
      })
    } catch (error) {
      console.error('Failed to update user metadata:', error)
    }
  }

  const fetchPendingInvitations = async (email: string) => {
    try {
      const response = await fetch(`/api/user/pending-invitations?email=${encodeURIComponent(email)}`)
      const data = await response.json()
      if (response.ok && data.invitations) {
        setPendingInvitations(data.invitations)
        setShowInvitationAcceptance(true)
      } else {
        console.error('Failed to fetch pending invitations:', data.error)
      }
    } catch (error) {
      console.error('Error fetching pending invitations:', error)
    }
  }

  if (loading || checkingInvitation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {checkingInvitation ? 'Checking invitation status...' : 'Loading workspace access...'}
          </p>
        </div>
      </div>
    )
  }

  // Check Clerk user metadata for invitation status
  const userMetadata = (user as any)?.publicMetadata || {}
  const invitationStatus = userMetadata.invitation_status

  if (!hasWorkspaceAccess || invitationStatus !== 'accepted') {
    const isPending = invitationStatus === 'pending'
    const isDeclined = invitationStatus === 'declined'
    const noInvitation = !invitationStatus || invitationStatus === 'none'

    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-orange-100 rounded-full w-fit">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
            <CardTitle>
              {noInvitation ? 'Invitation Required' :
               isPending ? 'Invitation Pending' :
               isDeclined ? 'Access Denied' :
               'No Workspace Access'}
            </CardTitle>
            <CardDescription>
              {noInvitation && 'You need to be invited to a workspace to access the dashboard.'}
              {isPending && 'Your invitation is still pending approval.'}
              {isDeclined && 'Your invitation was declined.'}
              {!noInvitation && !isPending && !isDeclined && "You don't have access to any workspaces."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>
                {noInvitation && 'Only users with accepted workspace invitations can access the dashboard. Please contact a workspace administrator to invite you.'}
                {isPending && 'Your invitation is being processed. You will receive access once approved.'}
                {isDeclined && 'Your invitation request was not approved. Please contact an administrator.'}
                {!noInvitation && !isPending && !isDeclined && 'Contact your administrator for workspace access.'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {isPending && user?.emailAddresses?.[0]?.emailAddress && (
                <Button
                  onClick={() => {
                    fetchPendingInvitations(user.emailAddresses[0].emailAddress)
                  }}
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Accept Invitation
                </Button>
              )}
              {invitationStatus !== 'accepted' && !isPending && (
                <Button
                  onClick={() => {
                    // Force re-check invitation status for non-pending users
                    setInvitationChecked(false)
                    setCheckingInvitation(false)
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Refresh Status
                </Button>
              )}
              <Button
                onClick={() => {
                  // Sign out user
                  signOut()
                }}
                variant="ghost"
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            {/* Show pending invitations for acceptance */}
            {showInvitationAcceptance && pendingInvitations.length > 0 && (
              <div className="mt-4 space-y-3">
                {pendingInvitations.map((invitation: any) => (
                  <InvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    variant="modal"
                    onSuccess={async () => {
                      // Wait for session to update, then refresh component state
                      setTimeout(async () => {
                        try {
                          // Reload Clerk session to get updated metadata
                          if (session) {
                            await session.reload()
                          }
                          // Reset state to trigger re-check
                          setInvitationChecked(false)
                          setCheckingInvitation(false)
                          setShowInvitationAcceptance(false)
                          setPendingInvitations([])
                        } catch (error) {
                          console.error('Failed to refresh after invitation acceptance:', error)
                          // Fallback: reload page
                          window.location.reload()
                        }
                      }, 2000) // Wait 2 seconds for session to update
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Show timeout message if Clerk takes too long (likely misconfigured or cached session issues)
  useEffect(() => {
    // Increase timeout since cached sessions might take longer
    const timer = setTimeout(() => {
      if (!isLoaded) {
        setLoadingTimeout(true)
      }
    }, 10000) // 10 second timeout (increased from 5)

    return () => clearTimeout(timer)
  }, [isLoaded])

  // Authentication redirect - disabled in development for easier testing
  // Set DISABLE_AUTH_REDIRECT=true in .env.local to disable this check
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !process.env.DISABLE_AUTH_REDIRECT) {
      if (isLoaded && !isSignedIn) {
        router.push("/sign-in")
      }
    }
  }, [isLoaded, isSignedIn, router])

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="text-muted-foreground">
            {loadingTimeout ? (
              <div className="space-y-2">
                <p>Loading is taking longer than expected...</p>
                {process.env.NODE_ENV === 'production' || !process.env.DISABLE_AUTH_REDIRECT ? (
                  <>
                    <p className="text-sm">Make sure Clerk is configured in .env.local</p>
                    <button
                      onClick={() => router.push("/sign-in")}
                      className="text-primary hover:underline text-sm"
                    >
                      Go to Sign In →
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm">Auth redirects disabled - waiting for Clerk to load...</p>
                    <button
                      onClick={() => {
                        // Clear Clerk-related localStorage and reload
                        if (typeof window !== 'undefined') {
                          Object.keys(localStorage).forEach(key => {
                            if (key.startsWith('clerk-') || key.includes('clerk')) {
                              localStorage.removeItem(key)
                            }
                          })
                          window.location.reload()
                        }
                      }}
                      className="text-orange-600 hover:underline text-sm mt-1"
                    >
                      Clear Cached Session & Reload
                    </button>
                  </>
                )}
              </div>
            ) : (
              "Loading..."
            )}
          </div>
        </div>
      </div>
    )
  }

  // Authentication check - disabled in development for easier testing
  // Set DISABLE_AUTH_REDIRECT=true in .env.local to disable this check
  if ((process.env.NODE_ENV === 'production' || !process.env.DISABLE_AUTH_REDIRECT) && !isSignedIn) {
    return null
  }

  return (
    <PageDataProvider>
      <WorkspaceProvider>
        <WorkspaceAccessGuard>
          <SystemInitializer />
          <div className="flex h-screen relative">
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpen={() => setSidebarOpen(true)} />

            <main className="flex-1 overflow-auto w-full lg:w-auto">
              {children}
            </main>

            {/* ELO AI Button - appears on every page */}
            <EloAiButton />

            {/* Invitation Prompt - shows when user has pending invitations */}
            <InvitationPrompt />
          </div>
        </WorkspaceAccessGuard>
      </WorkspaceProvider>
    </PageDataProvider>
  )
}

