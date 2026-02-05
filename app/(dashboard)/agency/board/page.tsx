"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, ZoomIn, ZoomOut, Grid, Save, Loader2, Edit, Trash2, ExternalLink, AlertTriangle, CheckCircle, XCircle, Clock, DollarSign, Users, Globe, Target, Zap, Building2, TrendingUp, TrendingDown, BarChart3, Activity, RefreshCw, Download, Settings, Eye, EyeOff } from "lucide-react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
} from "@dnd-kit/core"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { LocationDetailModal } from "@/components/flexboard/location-detail-modal"
import { initializeRealtimeUpdates, subscribeToUpdates, refreshData } from "@/lib/realtime-updates"
import { useFlexboard } from "@/lib/flexboard-context"

// Enhanced Agency Blop types with comprehensive health data
interface HealthMetrics {
  overall_score: number
  health_status: 'healthy' | 'warning' | 'critical'
  component_scores: {
    financial: number
    operational: number
    team: number
    customer: number
    market: number
    technology: number
  }
  confidence_level: number
  benchmark_percentile: number
  score_change?: number
  score_change_velocity?: number
  current_revenue: number
  revenue_target: number
  revenue_achievement_rate: number
  total_deals: number
  deal_target: number
  total_leads: number
  lead_change_percentage: number
  conversion_rate: number
  pipeline_value: number
  active_agents: number
  total_agents: number
  customer_rating: number
  primary_issue?: string
  secondary_issues: string[]
  critical_flags: string[]
  risk_assessment_score: number
  growth_opportunity_index: number
  revenue_trend_30d: number[]
  lead_trend_30d: number[]
  conversion_trend_30d: number[]
  data_freshness_score: number
  last_data_refresh: string
}

interface AgencyBlop {
  id: string
  x: number
  y: number
  shape: "circle" | "square" | "pill" | "diamond"
  color: string
  title: string
  content: string
  type: "client-status" | "website-status" | "campaign-tracker" | "integration-health" | "subscription-alert" | "task-reminder" | "location-status"
  status: "healthy" | "warning" | "critical" | "info"
  data?: any // Additional data specific to blop type
  lastUpdated?: string
  healthData?: HealthMetrics // Enhanced health metrics
  trendData?: {
    revenue: number[]
    leads: number[]
    conversion: number[]
    dates: string[]
  }
  position?: { x: number; y: number } // Optional position for layout
  size?: { width: number; height: number } // Optional size for layout
}

interface BlopComponentProps {
  blop: AgencyBlop
  onEdit: (blop: AgencyBlop) => void
  onOpenDetail: (locationId: string, healthData?: any) => void
  onDelete: (blopId: string) => void
}

const initialBlops: AgencyBlop[] = [
  {
    id: "welcome",
    x: 100,
    y: 100,
    shape: "circle",
    color: "bg-blue-500",
    title: "Agency Command Center",
    content: "Welcome to your agency management dashboard",
    type: "task-reminder",
    status: "info",
  },
]

export default function FlexboardPage() {
  const { user } = useUser()
  const router = useRouter()
  const { settings: flexboardSettings } = useFlexboard()
  const [blops, setBlops] = useState<AgencyBlop[]>([])
  const [editingBlop, setEditingBlop] = useState<AgencyBlop | null>(null)
  const [agencyData, setAgencyData] = useState<any>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calculatingHealth, setCalculatingHealth] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [lastHealthUpdate, setLastHealthUpdate] = useState<Date | null>(null)
  const [recentSaveFailures, setRecentSaveFailures] = useState(0)
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview')
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ id: string, healthData?: any } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingBlop, setIsDraggingBlop] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const lastTouchDistance = useRef<number | null>(null)
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // More responsive, less accidental drags
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Faster touch response
        tolerance: 8, // More tolerance for natural touch movement
      },
    }),
    useSensor(KeyboardSensor)
  )

  // Load agency data, health scores, and blops - OPTIMIZED VERSION
  const loadData = async () => {
      console.log('Flexboard: Loading data, user:', user)
      if (!user) {
        console.log('Flexboard: No user found, skipping data load')
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Load locations FIRST (fast, no API calls to individual locations)
        console.log('Flexboard: Loading locations...')
        const locationsResponse = await fetch('/api/ghl/locations')
        const locationsData = locationsResponse.ok ? await locationsResponse.json() : { locations: [] }
        const locations = locationsData.locations || []
        console.log('Flexboard: Locations loaded:', locations.length)

        // Load system health (fast)
        console.log('Flexboard: Loading system health...')
        const healthResponse = await fetch('/api/health')
        const healthData = healthResponse.ok ? await healthResponse.json() : null
        console.log('Flexboard: System health loaded:', !!healthData)

        // Set initial agency data WITHOUT health scores
        setAgencyData({
          locations: locations,
          health: healthData,
          healthScores: [] // Empty initially, will load in background
        })

        // Create basic blops WITHOUT health scores (fast)
        console.log('Flexboard: Creating basic blops without health scores...')
        const basicBlops = locations.map((location: any, index: number): AgencyBlop => ({
          id: `location-${location.id}`,
          x: (index % 4) * 350 + 50,
          y: Math.floor(index / 4) * 250 + 50,
          shape: "square",
          type: "location-status",
          status: "info", // Default status - will be updated with health data
          color: "bg-blue-500", // Default color - will be updated with health data
          title: location.name,
          content: `${location.city || 'Unknown City'}, ${location.state || 'Unknown State'}\n\n⏳ Loading health data...`,
          position: { x: (index % 4) * 350 + 50, y: Math.floor(index / 4) * 250 + 50 },
          size: { width: 300, height: 180 },
          data: {
            locationId: location.id,
            locationData: location,
            loadingHealth: true // Indicate health is loading
          }
        }))
        setBlops(basicBlops)

        // Load saved custom blops (fast)
        const blopsResponse = await fetch('/api/blops')
        if (blopsResponse.ok) {
          const data = await blopsResponse.json()
          if (data.blops && data.blops.length > 0) {
            // Convert and set saved blops
            let loadedBlops: AgencyBlop[] = data.blops.map((b: any) => ({
              id: b.id,
              x: b.x,
              y: b.y,
              shape: b.shape || "circle",
              color: b.color || "bg-blue-500",
              title: b.title || b.content || "Untitled",
              content: b.content || "",
              type: b.type || "task-reminder",
              status: b.status || "info",
              data: b.data,
              lastUpdated: b.updated_at
            }))

            // Filter out duplicate location blops - keep enhanced 'client-' blops over basic 'location-' blops
            const filteredBlops = loadedBlops.filter(blop => {
              // If this is a location blop, check if we have an enhanced version
              if (blop.id.startsWith('location-')) {
                const locationId = blop.id.replace('location-', '')
                const enhancedVersion = loadedBlops.find(b => b.id === `client-${locationId}`)
                // Keep basic version only if no enhanced version exists
                return !enhancedVersion
              }
              // Keep all non-location blops
              return true
            })

            console.log(`Flexboard: Loaded ${loadedBlops.length} blops, filtered to ${filteredBlops.length} (removed duplicates)`)
            setBlops(filteredBlops)
          } else {
            // No saved blops, show initial welcome blop
            setBlops(initialBlops)
          }
        } else {
          // Error loading blops, show initial welcome blop
          setBlops(initialBlops)
        }

        console.log('Flexboard: Basic data loading complete, health scores will load on-demand or after delay...')

        // Load health scores after a longer delay to prevent immediate API spam
        // This gives users time to navigate away if they don't need health scores
        console.log('Flexboard: Scheduling health score loading in 5 seconds...')
        setTimeout(() => {
          console.log('Flexboard: Now loading health scores...')
          loadHealthScoresInBackground(locations, healthData)
        }, 5000) // Wait 5 seconds before loading health scores

      } catch (error) {
        console.error('Flexboard: Error loading basic data:', error)
      } finally {
        setLoading(false)
      }
    }

  // Background loading of health scores (non-blocking and rate-limited)
  const loadHealthScoresInBackground = async (locations: any[], healthData: any) => {
    try {
      console.log('Flexboard: Loading health scores in background...')

      // Check cache first - use longer cache time to reduce API calls
      const cachedHealthScores = localStorage.getItem('agency-health-scores')
      const cachedTimestamp = localStorage.getItem('agency-health-scores-timestamp')
      const cacheAge = cachedTimestamp ? Date.now() - parseInt(cachedTimestamp) : Infinity

      // Use cached data if less than 10 minutes old
      if (cachedHealthScores && cacheAge < 10 * 60 * 1000) {
        console.log('Flexboard: Using cached health scores (age:', Math.round(cacheAge / 1000 / 60), 'minutes)')
        const healthScoresData = JSON.parse(cachedHealthScores)
        await updateBlopsWithHealthScores(locations, healthScoresData, healthData)
        setAgencyData((prev: any) => prev ? { ...prev, healthScores: healthScoresData } : null)
        return
      }

      console.log('Flexboard: Cache expired or missing, loading fresh health scores...')

      // Load fresh health scores with error handling
      console.log('Flexboard: Calling health scoring API...')
      const healthScoresResponse = await fetch('/api/health-scoring')
      console.log('Flexboard: Health scoring API response status:', healthScoresResponse.status)
      if (!healthScoresResponse.ok) {
        console.warn('Flexboard: Health scores API failed in background:', healthScoresResponse.status)
        const errorText = await healthScoresResponse.text()
        console.error('Flexboard: Health scores API error:', errorText)
        // Don't update blops if we can't get health scores
        return
      }

      const healthScoresData = await healthScoresResponse.json()
      const healthScores = healthScoresData.data || []

      console.log('Flexboard: Health scores loaded in background:', healthScores.length, 'scores:', healthScores.map((s: any) => ({ id: s.location_id, score: s.overall_score })))

      // Cache the results with longer expiry
      localStorage.setItem('agency-health-scores', JSON.stringify(healthScores))
      localStorage.setItem('agency-health-scores-timestamp', Date.now().toString())

      // Update agency data and blops
      setAgencyData((prev: any) => prev ? { ...prev, healthScores } : null)
      await updateBlopsWithHealthScores(locations, healthScores, healthData)

    } catch (error) {
      console.error('Flexboard: Error loading health scores in background:', error)
      // Don't show error to user, just log it - health scores are nice-to-have
    }
  }

  // Update existing blops with health score data
  const updateBlopsWithHealthScores = async (locations: any[], healthScores: any[], healthData: any) => {
    console.log('Flexboard: Updating blops with health scores...')

    const updatedBlops = await createEnhancedHealthBlops(locations, healthScores, healthData)

    setBlops(prev => {
      console.log(`Flexboard: Merging ${updatedBlops.length} enhanced blops with ${prev.length} existing blops`)

      // Create a map of existing static blops (not dynamically generated location blops)
      const staticBlops = new Map()
      prev.forEach(blop => {
        // Exclude dynamically generated location blops (both basic 'location-' and enhanced 'client-' prefixes)
        // These will be replaced by the updated enhanced blops
        if (!blop.id.startsWith('client-') && !blop.id.startsWith('location-') && !blop.id.startsWith('integration-')) {
          staticBlops.set(blop.id, blop)
        }
      })

      // Add/update dynamic location blops (this will overwrite any existing ones with same IDs)
      updatedBlops.forEach(blop => {
        staticBlops.set(blop.id, blop)
      })

      const finalBlops = Array.from(staticBlops.values())
      console.log(`Flexboard: Final merged result: ${finalBlops.length} blops (${staticBlops.size} static + ${updatedBlops.length} dynamic)`)
      return finalBlops
    })

    setLastHealthUpdate(new Date())
    console.log('Flexboard: Blops updated with health scores')
  }

  // Cleanup duplicate blops
  const cleanupDuplicateBlops = async () => {
    console.log('🧹 Cleanup function called - START')

    // First, identify duplicates without modifying state yet
    const currentBlops = blops
    console.log('🧹 Processing', currentBlops.length, 'blops')

    // Group by location ID to find true duplicates (extract base location ID)
    const groupedByLocation = new Map()

    currentBlops.forEach((blop, index) => {
      // Extract the base location ID by removing prefixes
      const locationId = blop.id.replace(/^(location-|client-)/, '')
      console.log(`🧹 Blop ${index}: ID=${blop.id}, Location=${locationId}, Type=${blop.type}`)

      if (!groupedByLocation.has(locationId)) {
        groupedByLocation.set(locationId, [])
      }
      groupedByLocation.get(locationId).push(blop)
    })

    // Identify blops to keep and blops to delete
    const cleaned: AgencyBlop[] = []
    const blopsToDelete: AgencyBlop[] = []
    let totalDuplicates = 0

    groupedByLocation.forEach((blops, locationId) => {
      if (blops.length === 1) {
        cleaned.push(blops[0])
      } else {
        // Prefer enhanced blops (client- prefix) over basic ones (location- prefix)
        const enhancedBlop = blops.find((b: AgencyBlop) => b.id.startsWith('client-'))
        const basicBlop = blops.find((b: AgencyBlop) => b.id.startsWith('location-'))

        if (enhancedBlop) {
          cleaned.push(enhancedBlop)
          // Mark other blops for deletion
          blopsToDelete.push(...blops.filter((b: AgencyBlop) => b.id !== enhancedBlop.id))
          totalDuplicates += blops.length - 1
          console.log(`🧹 Kept enhanced blop for location ${locationId}, will delete ${blops.length - 1} duplicates`)
        } else if (basicBlop) {
          cleaned.push(basicBlop)
          // Mark other blops for deletion
          blopsToDelete.push(...blops.filter((b: AgencyBlop) => b.id !== basicBlop.id))
          totalDuplicates += blops.length - 1
          console.log(`🧹 Kept basic blop for location ${locationId}, will delete ${blops.length - 1} duplicates`)
        } else {
          cleaned.push(blops[0]) // Fallback
          // Mark other blops for deletion
          blopsToDelete.push(...blops.slice(1))
          totalDuplicates += blops.length - 1
        }
      }
    })

    console.log(`🧹 Identified ${totalDuplicates} duplicate blops to delete`)

    if (totalDuplicates === 0) {
      alert('No duplicates found!')
      return
    }

    // Delete duplicates from database
    let deletedCount = 0
    const deletePromises = blopsToDelete.map(async (blop) => {
      try {
        const response = await fetch(`/api/blops/${blop.id}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          deletedCount++
          console.log(`🗑️ Deleted duplicate blop from database: ${blop.id}`)
        } else {
          console.error(`Failed to delete blop ${blop.id}:`, await response.text())
        }
      } catch (error) {
        console.error(`Error deleting blop ${blop.id}:`, error)
      }
    })

    try {
      await Promise.all(deletePromises)
      console.log(`🧹 Successfully deleted ${deletedCount} duplicate blops from database`)

      // Update local state
      setBlops(cleaned)
      console.log('🧹 Updated local state - Before:', currentBlops.length, 'After:', cleaned.length)

      alert(`Cleaned up ${totalDuplicates} duplicate blops from database!`)
    } catch (error) {
      console.error('Error during duplicate cleanup:', error)
      alert('Error occurred during cleanup. Some duplicates may not have been removed.')
    }
  }

  // Load agency data, health scores, and blops
  useEffect(() => {
    loadData()

    // Initialize real-time updates
    initializeRealtimeUpdates()

    // Subscribe to real-time updates (less aggressive to prevent API spam)
    const unsubscribeHealth = subscribeToUpdates('health_scores', (update) => {
      console.log('Real-time health score update:', update)

      // Only refresh cache, don't immediately reload
      if (update.type === 'new_score' || update.type === 'updated_score') {
        // Clear cache so next load gets fresh data, but don't trigger immediate API calls
        localStorage.removeItem('agency-health-scores')
        localStorage.removeItem('agency-health-scores-timestamp')
        console.log('Cache cleared - health scores will refresh on next load')
      }
    })

    const unsubscribeAlerts = subscribeToUpdates('alerts', (update) => {
      console.log('Real-time alert update:', update)

      // Handle new alerts
      if (update.type === 'new_alert') {
        // Could show a toast notification or update the UI
        console.log('New alert received:', update.alerts)
      }
    })

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeHealth()
      unsubscribeAlerts()
    }
  }, [user])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event
    setBlops((blops) =>
      blops.map((blop) => {
        if (blop.id !== active.id) return blop

        let newX = blop.x + delta.x / zoom
        let newY = blop.y + delta.y / zoom

        // Snap to grid if enabled
        if (flexboardSettings.snapToGrid) {
          const gridSize = flexboardSettings.gridSize
          newX = Math.round(newX / gridSize) * gridSize
          newY = Math.round(newY / gridSize) * gridSize
        }

        return { ...blop, x: newX, y: newY }
      })
    )
    // Auto-save will trigger via useEffect
  }

  // Delete a specific blop
  const handleDeleteBlop = async (blopId: string) => {
    if (confirm('Are you sure you want to delete this blop?')) {
      try {
        const response = await fetch(`/api/blops/${blopId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          setBlops(prev => prev.filter(blop => blop.id !== blopId))
          console.log(`🗑️ Deleted blop from database: ${blopId}`)
        } else {
          const error = await response.json()
          alert(`Failed to delete blop: ${error.error || 'Unknown error'}`)
          console.error('Delete blop error:', error)
        }
      } catch (error) {
        console.error('Error deleting blop:', error)
        alert('Failed to delete blop. Please try again.')
      }
    }
  }

  // Export dashboard data
  const exportDashboardData = async (type: string, format: string) => {
    try {
      const exportData = {
        type,
        format,
        locationIds: agencyData?.locations?.map((l: any) => l.id) || [],
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
          end: new Date().toISOString()
        },
        includeCharts: true,
        includeForecasts: type === 'trend_analysis'
      }

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      })

      if (response.ok) {
        // Trigger download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `agency-${type}-${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        alert(`Export completed successfully!`)
      } else {
        const error = await response.json()
        alert(`Export failed: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  // Calculate health scores for all locations - OPTIMIZED VERSION
  const calculateHealthScores = async (forceRecalculate = false) => {
    console.log('Flexboard: Calculating health scores, user:', user)
    if (!user) {
      console.log('Flexboard: No user, cannot calculate health scores')
      alert('Please sign in to calculate health scores')
      return
    }

    setCalculatingHealth(true)
    try {
      console.log('Flexboard: Sending health scoring request...')
      const response = await fetch('/api/health-scoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceRecalculate
        }),
      })

      console.log('Flexboard: Health scoring response:', response.status)
      if (response.ok) {
        const result = await response.json()
        console.log('Flexboard: Health scoring result:', result)

        // Clear cache to force fresh data load
        localStorage.removeItem('agency-health-scores')
        localStorage.removeItem('agency-health-scores-timestamp')

        // Load fresh health scores in background instead of full reload
        if (agencyData?.locations) {
          await loadHealthScoresInBackground(agencyData.locations, agencyData.health)
        }

        setLastHealthUpdate(new Date())
        alert(`Health scores refreshed for ${result.summary?.successful || 0} locations successfully!`)
      } else {
        let errorMessage = 'Unknown error'
        try {
          const error = await response.json()
          errorMessage = error.error || `HTTP ${response.status}`
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        console.error('Flexboard: Health scoring failed:', errorMessage)
        alert(`Failed to calculate health scores: ${errorMessage}`)
      }
    } catch (error) {
      console.error('Error calculating health scores:', error)
      alert('Failed to calculate health scores. Please try again.')
    } finally {
      setCalculatingHealth(false)
    }
  }

  const saveBlops = async (showAlert = false) => {
    if (!user) {
      if (showAlert) alert('Please sign in to save')
      return
    }

    // Prevent concurrent saves
    if (saving) {
      console.log('Save already in progress, skipping...')
      return
    }

    setSaving(true)
    try {
      // Filter out duplicate location blops before saving - keep enhanced 'client-' blops over basic 'location-' blops
      const filteredBlops = blops.filter(blop => {
        // If this is a location blop, check if we have an enhanced version
        if (blop.id.startsWith('location-')) {
          const locationId = blop.id.replace('location-', '')
          const enhancedVersion = blops.find(b => b.id === `client-${locationId}`)
          // Keep basic version only if no enhanced version exists
          return !enhancedVersion
        }
        // Keep all non-location blops
        return true
      })

      console.log(`Flexboard: Saving ${filteredBlops.length} blops (filtered from ${blops.length})`)

      // Convert agency blops to database format
      const dbBlops = filteredBlops.map(blop => ({
        id: blop.id,
        x: blop.x,
        y: blop.y,
        shape: blop.shape,
        color: blop.color,
        title: blop.title,
        content: blop.content,
        type: blop.type,
        status: blop.status,
        data: blop.data,
      }))

      const response = await fetch('/api/blops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blops: dbBlops,
          workspaceId: null, // You can get this from Clerk organization if needed
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setLastSaved(new Date())
        setRecentSaveFailures(0) // Reset failure count on success
        if (showAlert) {
          alert(`Saved ${data.blops?.length || blops.length} blops successfully!`)
        }
      } else {
        const error = await response.json()
        setRecentSaveFailures(prev => prev + 1) // Increment failure count
        if (showAlert) {
          if (error.code === 'DELETE_FAILED') {
            alert(`Save failed: Database cleanup error. This prevents data duplication. Please try again in a moment.`)
          } else {
            alert(`Failed to save: ${error.error || 'Unknown error'}`)
          }
        }
        console.error('Save error:', error)
      }
    } catch (error) {
      console.error('Error saving blops:', error)
      if (showAlert) {
        alert('Failed to save blops. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  // Auto-save after changes (debounced)
  useEffect(() => {
    if (!user || loading || isDraggingBlop) return

    // Skip auto-save if there have been recent failures (prevents infinite loops)
    if (recentSaveFailures > 2) {
      console.log('Skipping auto-save due to recent failures:', recentSaveFailures)
      return
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveBlops(false) // Auto-save without alert
    }, 3000) // Wait 3 seconds after last change

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blops, user, loading, recentSaveFailures, isDraggingBlop])

  // Create enhanced health status blops with comprehensive data
  const createEnhancedHealthBlops = async (locations: any[], healthScores: any[], healthData: any): Promise<AgencyBlop[]> => {
    const statusBlops: AgencyBlop[] = []

    // Create enhanced blops for each location with health data
    for (const [index, location] of locations.entries()) {
      const healthScore = healthScores.find((hs: any) => hs.location_id === location.id)

      // Determine status and color based on health score
      let status: "healthy" | "warning" | "critical" | "info" = "info"
      let color = "bg-blue-500"
      let healthData: HealthMetrics | undefined

      if (healthScore) {
        healthData = {
          overall_score: healthScore.overall_score,
          health_status: healthScore.health_status,
          component_scores: {
            financial: healthScore.financial_score,
            operational: healthScore.operational_score,
            team: healthScore.team_score,
            customer: healthScore.customer_score,
            market: healthScore.market_score,
            technology: healthScore.technology_score
          },
          confidence_level: healthScore.confidence_level,
          benchmark_percentile: healthScore.benchmark_percentile,
          score_change: healthScore.score_change,
          score_change_velocity: healthScore.score_change_velocity,
          current_revenue: healthScore.current_revenue,
          revenue_target: healthScore.revenue_target,
          revenue_achievement_rate: healthScore.revenue_achievement_rate,
          total_deals: healthScore.total_deals,
          deal_target: healthScore.deal_target,
          total_leads: healthScore.total_leads,
          lead_change_percentage: healthScore.lead_change_percentage,
          conversion_rate: healthScore.conversion_rate,
          pipeline_value: healthScore.pipeline_value,
          active_agents: healthScore.active_agents,
          total_agents: healthScore.total_agents,
          customer_rating: healthScore.customer_rating,
          primary_issue: healthScore.primary_issue,
          secondary_issues: healthScore.secondary_issues || [],
          critical_flags: healthScore.critical_flags || [],
          risk_assessment_score: healthScore.risk_assessment_score,
          growth_opportunity_index: healthScore.growth_opportunity_index,
          revenue_trend_30d: healthScore.revenue_trend_30d || [],
          lead_trend_30d: healthScore.lead_trend_30d || [],
          conversion_trend_30d: healthScore.conversion_trend_30d || [],
          data_freshness_score: healthScore.data_freshness_score,
          last_data_refresh: healthScore.last_data_refresh
        }

        status = healthScore.health_status
        color = status === "healthy" ? "bg-green-500" :
                status === "warning" ? "bg-yellow-500" :
                status === "critical" ? "bg-red-500" : "bg-blue-500"
      } else {
        // Fallback for locations without health scores
        status = "info"
        color = "bg-blue-500"
      }

      // Create trend data for mini-charts
      const trendData = healthData ? {
        revenue: healthData.revenue_trend_30d.slice(-7), // Last 7 days for mini chart
        leads: healthData.lead_trend_30d.slice(-7),
        conversion: healthData.conversion_trend_30d.slice(-7),
        dates: [] // Simplified for mini charts
      } : undefined

      statusBlops.push({
        id: `client-${location.id}`,
        x: 200 + (index * 280),
        y: 200,
        shape: "square", // Larger square for data-rich display
        color,
        title: location.name,
        content: healthData
          ? `${healthData.total_leads || 0} leads, ${healthData.total_deals || 0} deals\n$${healthData.current_revenue?.toLocaleString() || '0'}/$${healthData.revenue_target?.toLocaleString() || '0'} target`
          : `${location.name} - Health data not available`,
        type: "client-status",
        status,
        data: { location, healthScore },
        healthData,
        trendData,
        lastUpdated: healthData?.last_data_refresh || new Date().toISOString()
      })
    }

    // Create integration health blops
    if (healthData?.checks) {
      const checks = healthData.checks
      let yOffset = 500

      if (checks.database) {
        statusBlops.push({
          id: "integration-database",
          x: 300,
          y: yOffset,
          shape: "square",
          color: checks.database.status === "healthy" ? "bg-green-500" : "bg-red-500",
          title: "Database",
          content: `Status: ${checks.database.status}\nResponse: ${checks.database.response_time || 'N/A'}ms`,
          type: "integration-health",
          status: checks.database.status === "healthy" ? "healthy" : "critical",
          data: checks.database,
          lastUpdated: new Date().toISOString()
        })
        yOffset += 150
      }

      if (checks.ghl_api) {
        statusBlops.push({
          id: "integration-ghl",
          x: 300,
          y: yOffset,
          shape: "square",
          color: checks.ghl_api.status === "healthy" ? "bg-green-500" : checks.ghl_api.status === "warning" ? "bg-yellow-500" : "bg-red-500",
          title: "GHL API",
          content: `Status: ${checks.ghl_api.status}\nRate Limit: ${checks.ghl_api.rate_limit_remaining || 'N/A'}`,
          type: "integration-health",
          status: checks.ghl_api.status === "healthy" ? "healthy" : checks.ghl_api.status === "warning" ? "warning" : "critical",
          data: checks.ghl_api,
          lastUpdated: new Date().toISOString()
        })
      }
    }

    return statusBlops
  }

  const addBlop = () => {
    const newBlop: AgencyBlop = {
      id: Date.now().toString(),
      x: Math.random() * 400 + 200,
      y: Math.random() * 400 + 200,
      shape: "circle",
      color: "bg-blue-500",
      title: "New Task",
      content: "Click to edit this task",
      type: "task-reminder",
      status: "info",
    }
    setBlops([...blops, newBlop])
    // Auto-save will trigger via useEffect
  }

  // Enhanced Blop component with comprehensive health data display
  function BlopComponent({ blop, onEdit, onOpenDetail, onDelete }: BlopComponentProps) {
    const openDetailModal = () => {
      if (blop.type === 'client-status' && blop.data?.location) {
        onOpenDetail(blop.data.location.id, blop.healthData)
      }
    }
    const router = useRouter()
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging,
    } = useDraggable({
      id: blop.id,
    })

    const style = useMemo(() => ({
      position: "absolute" as const,
      left: blop.x,
      top: blop.y,
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      opacity: isDragging ? 0.5 : 1,
      transition: isDragging ? 'none' : 'transform 0.2s ease-out',
      willChange: isDragging ? 'transform' : undefined,
      backfaceVisibility: 'hidden' as const,
      perspective: 1000,
    }), [blop.x, blop.y, transform, isDragging])

    const shapeClasses = {
      circle: "rounded-full",
      square: "rounded-lg",
      pill: "rounded-full px-8",
      diamond: "rotate-45",
    }

    // Status icons
    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'healthy':
          return <CheckCircle className="h-3 w-3 text-green-600" />
        case 'warning':
          return <AlertTriangle className="h-3 w-3 text-yellow-600" />
        case 'critical':
          return <XCircle className="h-3 w-3 text-red-600" />
        default:
          return <Clock className="h-3 w-3 text-blue-600" />
      }
    }

    // Get type icon
    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'client-status':
          return <Building2 className="h-4 w-4" />
        case 'website-status':
          return <Globe className="h-4 w-4" />
        case 'campaign-tracker':
          return <Target className="h-4 w-4" />
        case 'integration-health':
          return <Zap className="h-4 w-4" />
        case 'subscription-alert':
          return <DollarSign className="h-4 w-4" />
        default:
          return <Users className="h-4 w-4" />
      }
    }

    // Mini chart component for trends
    const MiniChart = ({ data, color = "white" }: { data: number[], color?: string }) => {
      if (!data || data.length < 2) return null

      const max = Math.max(...data)
      const min = Math.min(...data)
      const range = max - min || 1

      const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 100
        const y = 100 - ((value - min) / range) * 100
        return `${x},${y}`
      }).join(' ')

      return (
        <svg width="60" height="20" className="opacity-70">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            points={points}
          />
        </svg>
      )
    }

    // Handle blop click for actions
    const handleBlopClick = (e: React.MouseEvent) => {
      e.stopPropagation()

      // Different actions based on blop type
      switch (blop.type) {
        case 'client-status':
          // Open detailed modal instead of navigating
          openDetailModal()
          break
        case 'website-status':
          router.push('/agency/websites')
          break
        case 'campaign-tracker':
          router.push('/agency/campaigns')
          break
        case 'integration-health':
          router.push('/agency/tech-stack')
          break
        case 'subscription-alert':
          router.push('/agency/subscriptions')
          break
        default:
          // For task reminders, could open edit dialog
          break
      }
    }

    // Enhanced blop display for client status with health data
    if (blop.type === 'client-status') {
      const health = blop.healthData || {
        overall_score: 0,
        health_status: 'info' as const,
        component_scores: { financial: 0, operational: 0, team: 0, customer: 0, market: 0, technology: 0 },
        confidence_level: 0,
        benchmark_percentile: 0,
        score_change: undefined,
        score_change_velocity: undefined,
        current_revenue: 0,
        revenue_target: 0,
        revenue_achievement_rate: 0,
        total_deals: 0,
        deal_target: 0,
        total_leads: 0,
        lead_change_percentage: 0,
        conversion_rate: 0,
        pipeline_value: 0,
        active_agents: 0,
        total_agents: 0,
        customer_rating: 0,
        primary_issue: null,
        secondary_issues: [],
        critical_flags: [],
        risk_assessment_score: 0,
        growth_opportunity_index: 0,
        revenue_trend_30d: [],
        lead_trend_30d: [],
        conversion_trend_30d: [],
        data_freshness_score: 0,
        last_data_refresh: new Date().toISOString()
      }
      const isExpanded = blop.shape === 'square' // Use larger square for data-rich display

    return (
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleBlopClick}
        onTouchStart={(e) => handleTouchStartLongPress(e, blop.id)}
        onTouchEnd={handleTouchEndLongPress}
        onDoubleClick={handleDoubleClick}
        data-blop={blop.id} // For touch detection
        className={`${blop.color} border-0 text-white cursor-move shadow-lg hover:shadow-xl relative group w-full max-w-xs sm:w-72 md:w-80 h-auto min-h-[180px] sm:min-h-[200px] p-3 sm:p-4 touch-manipulation`}
      >
          {/* Status indicator */}
          <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md">
            {getStatusIcon(blop.status)}
          </div>

          {/* Alert indicator */}
          {health.critical_flags && health.critical_flags.length > 0 && (
            <div className="absolute -top-2 -left-2 bg-red-500 rounded-full p-1 shadow-md animate-pulse">
              <AlertTriangle className="h-3 w-3 text-white" />
            </div>
          )}

          {/* Issues indicator */}
          {health.primary_issue && (
            <div className="absolute top-1 right-1 bg-yellow-500 rounded-full p-1 shadow-md">
              <AlertTriangle className="h-2 w-2 text-white" />
            </div>
          )}

          {/* Delete button - always visible but subtle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onDelete(blop.id)
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            onTouchStart={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
            data-no-dnd="true"
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-70 hover:opacity-100 transition-opacity duration-200 shadow-md z-10"
            title="Delete this blop"
          >
            <XCircle className="h-3 w-3" />
          </button>

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 opacity-80" />
              <h3 className="font-semibold text-sm">{blop.title}</h3>
            </div>
            <Badge variant="secondary" className="text-xs">
              {health.overall_score.toFixed(0)}%
            </Badge>
          </div>

          {/* Health Score & Trend */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Health Score</span>
              <span className="flex items-center gap-1">
                {health.score_change ? (
                  health.score_change > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-300" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-300" />
                  )
                ) : null}
                {health.score_change ? `${health.score_change > 0 ? '+' : ''}${health.score_change.toFixed(1)}%` : 'New'}
              </span>
            </div>
            <Progress value={health.overall_score} className="h-2" />
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div>
              <div className="opacity-80">Revenue</div>
              <div className="font-semibold">${(health.current_revenue / 1000).toFixed(0)}K</div>
              <div className="text-xs opacity-70">Target: ${(health.revenue_target / 1000).toFixed(0)}K</div>
            </div>
            <div>
              <div className="opacity-80">Leads</div>
              <div className="font-semibold">{health.total_leads}</div>
              <div className="text-xs opacity-70">
                {health.lead_change_percentage > 0 ? '+' : ''}{health.lead_change_percentage.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="opacity-80">Deals</div>
              <div className="font-semibold">{health.total_deals}</div>
              <div className="text-xs opacity-70">Target: {health.deal_target}</div>
            </div>
            <div>
              <div className="opacity-80">Conversion</div>
              <div className="font-semibold">{(health.conversion_rate * 100).toFixed(1)}%</div>
              <div className="text-xs opacity-70">Rate</div>
            </div>
          </div>

          {/* Mini Charts */}
          {health.revenue_trend_30d && health.revenue_trend_30d.length > 0 && (
            <div className="mb-3">
              <div className="text-xs opacity-80 mb-1">7-Day Trends</div>
              <div className="flex justify-between items-center">
                <div className="flex flex-col items-center">
                  <MiniChart data={health.revenue_trend_30d.slice(-7)} />
                  <span className="text-xs opacity-70 mt-1">Revenue</span>
                </div>
                <div className="flex flex-col items-center">
                  <MiniChart data={health.lead_trend_30d?.slice(-7) || []} />
                  <span className="text-xs opacity-70 mt-1">Leads</span>
                </div>
                <div className="flex flex-col items-center">
                  <MiniChart data={health.conversion_trend_30d?.slice(-7).map(v => v * 100) || []} />
                  <span className="text-xs opacity-70 mt-1">Conv</span>
                </div>
              </div>
            </div>
          )}

          {/* Issues & Alerts */}
          {health.primary_issue && (
            <div className="mb-2 p-2 bg-black/20 rounded text-xs">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3 text-yellow-300" />
                <span className="font-medium">Issue</span>
              </div>
              <div className="opacity-90">{health.primary_issue}</div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs opacity-70 pt-2 border-t border-white/20">
            <span>Updated {new Date(health.last_data_refresh).toLocaleDateString()}</span>
            <span>{health.confidence_level.toFixed(0)}% confidence</span>
          </div>

          {/* Edit button on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditingBlop(blop)
              setEditDialogOpen(true)
            }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/50 rounded-full p-1 transition-opacity hover:bg-black/70"
          >
            <Edit className="h-3 w-3" />
          </button>
        </Card>
      )
    }

    // Default blop display for other types
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleBlopClick}
        className={`${blop.color} ${shapeClasses[blop.shape]} w-32 h-32 flex flex-col items-center justify-center text-white cursor-move shadow-lg hover:shadow-xl relative group`}
      >
        {/* Status indicator */}
        <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md">
          {getStatusIcon(blop.status)}
        </div>

        {/* Type icon */}
        <div className="mb-1 opacity-80">
          {getTypeIcon(blop.type)}
        </div>

        {/* Title */}
        <div className="text-xs font-semibold text-center leading-tight mb-1 px-2">
          {blop.title}
        </div>

        {/* Content preview */}
        <div className="text-xs text-center opacity-90 leading-tight px-2 line-clamp-2">
          {blop.content.length > 30 ? `${blop.content.substring(0, 30)}...` : blop.content}
        </div>

        {/* Edit button on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setEditingBlop(blop)
            setEditDialogOpen(true)
          }}
          className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 bg-black/50 rounded-full p-1 transition-opacity hover:bg-black/70"
        >
          <Edit className="h-3 w-3" />
        </button>

        {/* Delete button for small blops */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onDelete(blop.id)
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onTouchStart={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          data-no-dnd="true"
          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-70 hover:opacity-100 transition-opacity duration-200 shadow-md z-10"
          title="Delete this blop"
        >
          <XCircle className="h-3 w-3" />
        </button>
      </div>
    )
  }

  // Enhanced touch gesture handlers for mobile - Improved responsiveness
  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent default to avoid scrolling on touch
    if (e.touches.length > 1) {
      e.preventDefault()
    }

    if (e.touches.length === 2) {
      // Pinch gesture for zoom - More responsive
      e.preventDefault() // Always prevent for pinch
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      lastTouchDistance.current = distance
    } else if (e.touches.length === 1) {
      // Single touch for pan - Only set if not on a blop
      const target = e.target as HTMLElement
      if (!target.closest('[data-blop]')) {
        lastPanPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Don't prevent default if a blop is being dragged
    if (!isDraggingBlop) {
      e.preventDefault()
    }

    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Enhanced pinch to zoom with better sensitivity
      e.preventDefault() // Always prevent for pinch gestures
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )

      const scale = distance / lastTouchDistance.current
      setZoom((prevZoom) => {
        const newZoom = Math.max(0.3, Math.min(5, prevZoom * scale))
        return Math.round(newZoom * 100) / 100 // Round to 2 decimal places
      })
      lastTouchDistance.current = distance
    } else if (e.touches.length === 1 && lastPanPoint.current && !isDraggingBlop) {
      // Enhanced pan with better responsiveness
      const deltaX = e.touches[0].clientX - lastPanPoint.current.x
      const deltaY = e.touches[0].clientY - lastPanPoint.current.y

      setPan((prevPan) => {
        const newPan = {
          x: prevPan.x + deltaX * (1 / zoom), // Adjust for zoom level
          y: prevPan.y + deltaY * (1 / zoom),
        }

        // Add bounds to prevent excessive panning that breaks layout
        const maxPan = 1000 // Maximum pan distance
        return {
          x: Math.max(-maxPan, Math.min(maxPan, newPan.x)),
          y: Math.max(-maxPan, Math.min(maxPan, newPan.y))
        }
      })

      lastPanPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  const handleTouchEnd = () => {
    lastTouchDistance.current = null
    lastPanPoint.current = null
  }

  // Mouse pan/zoom handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dragStart) {
      const newPan = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }

      // Add bounds to prevent excessive panning that breaks layout
      const maxPan = 1000 // Maximum pan distance
      const boundedPan = {
        x: Math.max(-maxPan, Math.min(maxPan, newPan.x)),
        y: Math.max(-maxPan, Math.min(maxPan, newPan.y))
      }

      setPan(boundedPan)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  const handleWheel = (e: React.WheelEvent) => {
    // Only prevent default if Ctrl key is pressed (zoom) or if we can safely prevent it
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(prevZoom => Math.max(0.3, Math.min(5, prevZoom * zoomFactor)))
    }
    // Allow normal scrolling when not zooming
  }

  // Double tap to reset zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (window.innerWidth <= 768) { // Mobile/tablet only
      e.preventDefault()
      resetView()
    }
  }

  // Mobile-specific gesture for quick actions
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null)
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)

  const handleTouchStartLongPress = (e: React.TouchEvent, blopId: string) => {
    // Clear existing timer
    if (longPressTimer) {
      clearTimeout(longPressTimer)
    }

    const startTime = Date.now()
    setTouchStartTime(startTime)

    // Only set timer if not already dragging a blop
    if (!isDraggingBlop) {
      const timer = setTimeout(() => {
        // Trigger quick action menu for mobile
        showMobileQuickActions(blopId, e.touches[0].clientX, e.touches[0].clientY)
      }, 500)
      setLongPressTimer(timer)
    }
  }

  const handleTouchEndLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
    setTouchStartTime(null)
  }

  // Mobile quick actions menu
  const [mobileMenu, setMobileMenu] = useState<{
    visible: boolean
    x: number
    y: number
    blopId: string
  } | null>(null)

  const showMobileQuickActions = (blopId: string, x: number, y: number) => {
    setMobileMenu({ visible: true, x, y, blopId })
  }

  const hideMobileMenu = () => {
    setMobileMenu(null)
  }

  // Reset pan and zoom
  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    // Also reset any drag state
    setIsDragging(false)
    setIsDraggingBlop(false)
    setDragStart(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced Responsive Toolbar */}
      <div className="border-b p-2 sm:p-4 flex flex-col gap-3 sm:gap-2">
        {/* Header Section - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">Agency Command Center</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              AI-powered health monitoring across {agencyData?.locations?.length || 0} locations
            </p>
          </div>
        </div>

        {/* Controls Section - Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap gap-1 sm:gap-2">
          {/* View Mode Toggle - Mobile Optimized */}
          <div className="col-span-2 sm:col-span-1 flex gap-1">
            <Button
              variant={viewMode === 'overview' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('overview')}
              className="h-8 flex-1 sm:flex-none text-xs px-2"
            >
              <Eye className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Overview</span>
            </Button>
            <Button
              variant={viewMode === 'detailed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('detailed')}
              className="h-8 flex-1 sm:flex-none text-xs px-2"
            >
              <BarChart3 className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Detailed</span>
            </Button>
          </div>

          {/* Health Actions - Mobile Friendly */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => agencyData?.locations && loadHealthScoresInBackground(agencyData.locations, agencyData.health)}
              disabled={!agencyData?.locations || !user}
              className="h-8 text-xs px-2 flex-1 sm:flex-none"
              title="Load health scores for all locations"
            >
              <Activity className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Load Health</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => calculateHealthScores(true)}
              disabled={calculatingHealth || !user}
              className="h-8 text-xs px-2"
              title="Force recalculate health scores (ignore cache)"
            >
              {calculatingHealth ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              <span className="hidden sm:inline">Force Recalc</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cleanupDuplicateBlops}
              className="h-8 text-xs px-2 bg-red-50 hover:bg-red-100 border-red-200"
              title="Remove duplicate blops"
            >
              🧹
            </Button>
          </div>


          {/* Canvas Controls - Touch Friendly */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled
              className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation opacity-50"
              title={`Background: ${flexboardSettings.boardBackground} (controlled from settings)`}
            >
              <Grid className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>

            {/* Zoom Controls Grouped */}
            <div className="flex gap-0.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.min(zoom + 0.1, 3))}
                className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
                title="Zoom in"
              >
                <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
                className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
                title="Zoom out"
              >
                <ZoomOut className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={resetView}
                className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
                title="Reset view"
              >
                <span className="text-xs sm:text-sm">1:1</span>
              </Button>
            </div>
          </div>

          {/* Action Buttons - Mobile Optimized */}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => saveBlops(true)}
              disabled={saving || !user}
              className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
              title={!user ? "Sign in to save" : lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : "Save blops to database"}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Save className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => exportDashboardData('health_report', 'excel')}
              className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
              title="Export health report"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => {/* TODO: Open settings */}}
              className="h-9 w-9 sm:h-10 sm:w-10 touch-manipulation"
              title="Dashboard settings"
            >
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>

          {/* Add Blop - Prominent on Mobile */}
          <Button
            onClick={addBlop}
            className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 bg-primary text-primary-foreground hover:bg-primary/90 touch-manipulation"
          >
            <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Add Widget</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Status Bar - Mobile Responsive */}
      <div className="border-b px-2 sm:px-4 py-2 bg-muted/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 text-xs">
          {/* Status Info - Stacked on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <span className="truncate">
              Last health: {lastHealthUpdate ? lastHealthUpdate.toLocaleTimeString() : 'Never'}
            </span>
            <span className="hidden sm:inline">
              {agencyData?.healthScores?.length || 0} locations monitored
            </span>
            {lastSaved && (
              <span className="truncate">
                Saved: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Health Status - Always visible */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <RefreshCw
              className={`h-3 w-3 ${calculatingHealth ? 'animate-spin' : ''}`}
            />
            <span className="truncate">
              Health: {calculatingHealth ? 'Calculating...' : lastHealthUpdate ? `Updated ${lastHealthUpdate.toLocaleTimeString()}` : 'Loading...'}
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Canvas with Mobile Optimization */}
      <div
        ref={canvasRef}
        className={`flex-1 overflow-hidden relative bg-muted/30 select-none ${isDraggingBlop ? 'touch-none' : 'touch-pan-y'}`}
        onTouchStart={!isDraggingBlop ? handleTouchStart : undefined}
        onTouchMove={!isDraggingBlop ? handleTouchMove : undefined}
        onTouchEnd={!isDraggingBlop ? handleTouchEnd : undefined}
        onDoubleClick={handleDoubleClick}
        style={{
          // Prevent text selection on mobile
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          KhtmlUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          userSelect: 'none',
          // Ensure minimum touch target on mobile
          minHeight: 'calc(100vh - 200px)',
          // Contain the layout to prevent overflow affecting parent elements
          contain: 'layout style paint',
          // Ensure proper positioning context
          position: 'relative',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={() => setIsDraggingBlop(true)}
            onDragEnd={(event) => {
              setIsDraggingBlop(false)
              handleDragEnd(event)
            }}
          >
            {/* Canvas Viewport - handles pan/zoom transforms */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                // Apply pan/zoom transform to this viewport div
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
                cursor: isDraggingBlop ? 'grabbing' : (isDragging ? 'grabbing' : 'grab'),
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              {/* Canvas Content - fixed positioning for blops */}
              <div
                className="relative w-full h-full min-h-[800px] sm:min-h-[1000px] lg:min-h-[1200px]"
                style={{
                  backgroundImage: flexboardSettings.boardBackground === 'grid'
                    ? "radial-gradient(circle, #e5e7eb 1px, transparent 1px)"
                    : flexboardSettings.boardBackground === 'dots'
                    ? "radial-gradient(circle, #e5e7eb 1px, transparent 1px)"
                    : "none",
                  backgroundSize: flexboardSettings.boardBackground === 'dots'
                    ? `${Math.max(8, 12 / zoom)}px ${Math.max(8, 12 / zoom)}px`
                    : `${Math.max(12, 20 / zoom)}px ${Math.max(12, 20 / zoom)}px`,
                  // Better touch handling for mobile
                  WebkitOverflowScrolling: 'touch',
                  touchAction: "pan-x pan-y pinch-zoom",
                }}
              >
                {blops.map((blop) => (
                  <BlopComponent
                    key={blop.id}
                    blop={blop}
                    onEdit={(blop) => {
                      setEditingBlop(blop)
                      setEditDialogOpen(true)
                    }}
                    onOpenDetail={(locationId, healthData) => {
                      setSelectedLocation({ id: locationId, healthData })
                      setDetailModalOpen(true)
                    }}
                    onDelete={handleDeleteBlop}
                  />
                ))}
              </div>
            </div>
          </DndContext>
        )}
      </div>

      {/* Mobile Quick Actions Menu */}
      {mobileMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border p-2 min-w-[120px]"
          style={{
            left: mobileMenu.x,
            top: mobileMenu.y,
            transform: 'translate(-50%, -100%)', // Position above touch point
          }}
        >
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                const blop = blops.find(b => b.id === mobileMenu.blopId)
                if (blop) {
                  setEditingBlop(blop)
                  setEditDialogOpen(true)
                }
                hideMobileMenu()
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 rounded"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => {
                handleDeleteBlop(mobileMenu.blopId)
                hideMobileMenu()
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
            >
              <XCircle className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Mobile Overlay for Menu Dismissal */}
      {mobileMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={hideMobileMenu}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingBlop?.title}</DialogTitle>
          </DialogHeader>
          {editingBlop && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editingBlop.title}
                  onChange={(e) => setEditingBlop({...editingBlop, title: e.target.value})}
                  placeholder="Enter title"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Content</label>
                <Input
                  value={editingBlop.content}
                  onChange={(e) => setEditingBlop({...editingBlop, content: e.target.value})}
                  placeholder="Enter content"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={editingBlop.type}
                    onValueChange={(value: any) => setEditingBlop({...editingBlop, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client-status">Client Status</SelectItem>
                      <SelectItem value="website-status">Website Status</SelectItem>
                      <SelectItem value="campaign-tracker">Campaign Tracker</SelectItem>
                      <SelectItem value="integration-health">Integration Health</SelectItem>
                      <SelectItem value="subscription-alert">Subscription Alert</SelectItem>
                      <SelectItem value="task-reminder">Task Reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={editingBlop.status}
                    onValueChange={(value: any) => setEditingBlop({...editingBlop, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="healthy">Healthy</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={async () => {
                    // Delete blop from database
                    try {
                      const response = await fetch(`/api/blops/${editingBlop.id}`, {
                        method: 'DELETE',
                      })

                      if (response.ok) {
                        setBlops(blops.filter(b => b.id !== editingBlop.id))
                        setEditDialogOpen(false)
                        setEditingBlop(null)
                        console.log(`🗑️ Deleted blop from database via edit dialog: ${editingBlop.id}`)
                      } else {
                        const error = await response.json()
                        alert(`Failed to delete blop: ${error.error || 'Unknown error'}`)
                        console.error('Delete blop error:', error)
                      }
                    } catch (error) {
                      console.error('Error deleting blop:', error)
                      alert('Failed to delete blop. Please try again.')
                    }
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      // Save changes
                      setBlops(blops.map(b => b.id === editingBlop.id ? editingBlop : b))
                      setEditDialogOpen(false)
                      setEditingBlop(null)
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Location Detail Modal */}
      {selectedLocation && (
        <LocationDetailModal
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false)
            setSelectedLocation(null)
          }}
          locationId={selectedLocation.id}
          healthData={selectedLocation.healthData}
        />
      )}

      {/* Mobile Quick Actions Menu */}
      {mobileMenu?.visible && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={hideMobileMenu}
        >
          <div
            className="absolute bg-white rounded-lg shadow-lg border p-2 min-w-[150px]"
            style={{
              left: Math.min(mobileMenu.x, window.innerWidth - 160),
              top: Math.min(mobileMenu.y, window.innerHeight - 120),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  const blop = blops.find(b => b.id === mobileMenu.blopId)
                  if (blop?.data?.location) {
                    setSelectedLocation({
                      id: blop.data.location.id,
                      healthData: blop.healthData
                    })
                    setDetailModalOpen(true)
                  }
                  hideMobileMenu()
                }}
              >
                📊 View Details
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  // Quick health check
                  calculateHealthScores(true)
                  hideMobileMenu()
                }}
              >
                🔄 Refresh Health
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  // Toggle view mode
                  setViewMode(viewMode === 'overview' ? 'detailed' : 'overview')
                  hideMobileMenu()
                }}
              >
                👁️ Toggle View
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


