"use client"

import { useEffect } from 'react'
import { initializeRealtimeUpdates } from '@/lib/realtime-updates'
import { initializeAlertSystem } from '@/lib/alert-system'
import { initializeDataProcessing } from '@/lib/data-processing-engine'

// Global flag to prevent multiple initializations
let systemsInitialized = false

export function SystemInitializer() {
  useEffect(() => {
    // Only initialize once
    if (!systemsInitialized) {
      console.log('🚀 Initializing agency health monitoring systems...')

      try {
        // Initialize all critical systems
        initializeRealtimeUpdates()
        initializeAlertSystem()
        initializeDataProcessing()

        systemsInitialized = true
        console.log('✅ All systems initialized successfully!')
      } catch (error) {
        console.error('❌ Failed to initialize systems:', error)
      }
    }
  }, [])

  // This component doesn't render anything
  return null
}