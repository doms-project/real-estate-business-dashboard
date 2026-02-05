"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface FlexboardSettings {
  snapToGrid: boolean
  boardBackground: 'grid' | 'dots' | 'plain'
  gridSize: number // pixels
}

interface FlexboardContextType {
  settings: FlexboardSettings
  updateSettings: (settings: Partial<FlexboardSettings>) => void
}

const defaultSettings: FlexboardSettings = {
  snapToGrid: false,
  boardBackground: 'grid',
  gridSize: 20
}

const FlexboardContext = createContext<FlexboardContextType | undefined>(undefined)

export function FlexboardProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FlexboardSettings>(defaultSettings)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('flexboardSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
      } catch (error) {
        console.error('Error parsing flexboard settings:', error)
      }
    }
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('flexboardSettings', JSON.stringify(settings))
  }, [settings])

  const updateSettings = (newSettings: Partial<FlexboardSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }

  const value: FlexboardContextType = {
    settings,
    updateSettings
  }

  return (
    <FlexboardContext.Provider value={value}>
      {children}
    </FlexboardContext.Provider>
  )
}

export function useFlexboard() {
  const context = useContext(FlexboardContext)
  if (context === undefined) {
    throw new Error('useFlexboard must be used within a FlexboardProvider')
  }
  return context
}