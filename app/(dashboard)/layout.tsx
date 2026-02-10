"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { InvitationPrompt } from "@/components/team/invitation-prompt"
import { EloAiButton } from "@/components/layout/elo-ai-button"
import { PageDataProvider } from "@/components/layout/page-data-context"
import { SystemInitializer } from "@/components/system-initializer"
import { WorkspaceProvider } from "@/components/workspace-context"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

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
      </WorkspaceProvider>
    </PageDataProvider>
  )
}

