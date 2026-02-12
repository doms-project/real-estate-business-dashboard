"use client"

import { SignIn, useUser } from "@clerk/nextjs"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function SignInPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationToken = searchParams?.get('invitation_token')

  useEffect(() => {
    // If user is signed in and we have an invitation token, redirect to invitation page
    if (isLoaded && user && invitationToken) {
      console.log('✅ User signed in with invitation token, redirecting to:', `/invite/${invitationToken}`)
      router.push(`/invite/${invitationToken}`)
    }
  }, [isLoaded, user, invitationToken, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}


