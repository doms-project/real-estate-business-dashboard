"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { InvitationCard } from "@/components/invitation-card"

interface Invitation {
  id: string
  workspace_id: string
  email: string
  role: 'admin' | 'member'
  invited_by?: string
  created_at: string
  expires_at: string
  workspaces: {
    id: string
    name: string
  } | null
}

export function InvitationPrompt() {
  const { user, isLoaded } = useUser()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(true)

  // Temporarily disabled for development
  useEffect(() => {
    if (!isLoaded || !user) {
      setLoading(false) // Set loading to false when no user
      return
    }

    const fetchPendingInvitations = async () => {
      try {
        const response = await fetch('/api/workspace/invitations/pending')
        if (response.ok) {
          const data = await response.json()
          setInvitations(data.invitations || [])
        }
      } catch (error) {
        console.error('Error fetching pending invitations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPendingInvitations()
  }, [isLoaded, user])

  const handleInvitationSuccess = (invitationId: string) => {
    // Remove accepted invitation from list
    setInvitations(prev => prev.filter(inv => inv.id !== invitationId))
  }

  const handleInvitationDecline = (invitationId: string) => {
    // Close the modal instead of declining the invitation
    // (Regular users can't decline invitations anyway)
    setIsOpen(false)
  }

  if (!isLoaded || loading || invitations.length === 0) {
    return null
  }

  // Show the first pending invitation
  const invitation = invitations[0]

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="sr-only">Workspace Invitation</DialogTitle>
          <DialogDescription className="sr-only">
            Accept or decline your workspace invitation
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <InvitationCard
            invitation={invitation}
            variant="modal"
            onSuccess={() => handleInvitationSuccess(invitation.id)}
            onDecline={() => handleInvitationDecline(invitation.id)}
          />

          {invitations.length > 1 && (
            <div className="text-sm text-muted-foreground mt-4 text-center">
              You have {invitations.length - 1} more pending invitation{invitations.length - 1 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

