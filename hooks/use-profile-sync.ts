import { useUser } from '@clerk/nextjs'
import { useEffect } from 'react'

export function useProfileSync() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (isLoaded && user) {
      // Sync profile to database when user loads
      fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl
        })
      }).catch(error => {
        console.error('Failed to sync user profile:', error)
        // Don't show error to user, this is background sync
      })
    }
  }, [user, isLoaded])
}