"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'

interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null
  availableWorkspaces: Workspace[]
  loading: boolean
  hasWorkspaceAccess: boolean
  setCurrentWorkspace: (workspace: Workspace) => void
  refreshWorkspaces: () => Promise<void>
  workspaceSwitchCount: number // Increments on workspace switches to trigger re-renders
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [hasWorkspaceAccess, setHasWorkspaceAccess] = useState(false)
  const [workspaceSwitchCount, setWorkspaceSwitchCount] = useState(0)

  // Load workspaces and set current workspace
  const refreshWorkspaces = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const response = await fetch('/api/workspace')
      const data = await response.json()

      if (response.ok) {
        const userWorkspaces = data.workspaces || []
        setAvailableWorkspaces(userWorkspaces)

        if (userWorkspaces.length === 0) {
          // User has no workspace access
          setCurrentWorkspace(null)
          setHasWorkspaceAccess(false)
          console.log('User has no workspace access')
        } else {
          setHasWorkspaceAccess(true)
          // Check if we have a saved workspace preference
          const savedWorkspaceId = localStorage.getItem(`workspace_${user.id}`)
          let workspaceToSelect = data.workspace // Default to auto-assigned

          // Prioritize the workspace with activities (467e72e9-0643-4296-ad5b-f3dd5544d26e)
          const activitiesWorkspaceId = '467e72e9-0643-4296-ad5b-f3dd5544d26e'
          const activitiesWorkspace = userWorkspaces.find((w: Workspace) => w.id === activitiesWorkspaceId)
          if (activitiesWorkspace) {
            workspaceToSelect = activitiesWorkspace
            console.log('🎯 Using workspace with activities:', activitiesWorkspaceId)
          }
          // If user has a saved preference and it's not the activities workspace, use it
          else if (savedWorkspaceId) {
            const savedWorkspace = userWorkspaces.find((w: Workspace) => w.id === savedWorkspaceId)
            if (savedWorkspace) {
              workspaceToSelect = savedWorkspace
            }
          }

          setCurrentWorkspace(workspaceToSelect)
        }
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    } finally {
      setLoading(false)
    }
  }, [user, setLoading, setAvailableWorkspaces, setCurrentWorkspace])

  // Handle workspace switching
  const handleSetCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace)
    setWorkspaceSwitchCount(prev => prev + 1) // Trigger re-renders
    // Save preference to localStorage
    if (user) {
      localStorage.setItem(`workspace_${user.id}`, workspace.id)
    }
  }

  // Load workspaces when user changes
  useEffect(() => {
    if (user) {
      refreshWorkspaces()
    } else {
      setCurrentWorkspace(null)
      setAvailableWorkspaces([])
      setHasWorkspaceAccess(false)
      setLoading(false)
    }
  }, [user, refreshWorkspaces])

  const value: WorkspaceContextType = {
    currentWorkspace,
    availableWorkspaces,
    loading,
    hasWorkspaceAccess,
    setCurrentWorkspace: handleSetCurrentWorkspace,
    refreshWorkspaces,
    workspaceSwitchCount
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}