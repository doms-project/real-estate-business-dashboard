"use client"

import { useProfileSync } from '@/hooks/use-profile-sync'

// Component that syncs user profile to database when they log in
export function ProfileSync() {
  useProfileSync()

  // This component doesn't render anything
  return null
}