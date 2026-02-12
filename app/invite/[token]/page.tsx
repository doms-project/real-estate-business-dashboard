"use client"

import { useEffect, useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { InvitationCard } from "@/components/invitation-card"

export default function InvitePage() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const token = params?.token as string
  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)


  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link")
      setLoading(false)
      return
    }

    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/workspace/invitations/by-token?token=${token}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load invitation')
        }

        setInvitation(data.invitation)
        setLoading(false)
      } catch (err: any) {
        setError(err.message || "Failed to load invitation")
        setLoading(false)
      }
    }

    fetchInvitation()
  }, [token])

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // If user is not authenticated, redirect to sign-in with invitation token
  if (!user) {
    const signInUrl = `/sign-in?invitation_token=${encodeURIComponent(token)}`
    console.log('🔄 User not authenticated, redirecting to:', signInUrl)
    router.push(signInUrl)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {invitation && (
        <InvitationCard
          invitation={invitation}
          variant="page"
        />
      )}
    </div>
  )
}

