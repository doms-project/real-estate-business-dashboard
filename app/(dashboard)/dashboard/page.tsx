"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Building2, MapPin, Loader2 } from "lucide-react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { AiCoachSlideout } from "@/components/ai-coach/ai-coach-slideout"
import { buildDashboardContext } from "@/lib/ai-coach/context-builder"
import { GoHighLevelClient, ClientMetrics } from "@/types/gohighlevel"
import { useEffect, useState, useMemo, useCallback } from "react"
import { useGHLData, useContacts, useOpportunities, useConversations } from "@/hooks/use-ghl-data"
import { activityTracker, getRelativeTime, type Activity } from "@/lib/activity-tracker"
import { subscribeToUpdates } from "@/lib/realtime-updates"
import { useWorkspace } from "@/components/workspace-context"

// Mock data - replace with real API calls
const mockClients: GoHighLevelClient[] = [
  {
    id: "1",
    name: "Acme Marketing",
    email: "contact@acme.com",
    phone: "+1-555-0101",
    company: "Acme Marketing LLC",
    subscriptionPlan: "professional",
    affiliateUserId: "user_123",
    createdAt: "2024-01-15",
    updatedAt: "2024-11-30",
    status: "active",
  },
  {
    id: "2",
    name: "Tech Startup Inc",
    email: "hello@techstartup.com",
    phone: "+1-555-0102",
    company: "Tech Startup Inc",
    subscriptionPlan: "agency",
    affiliateUserId: "user_123",
    createdAt: "2024-02-20",
    updatedAt: "2024-11-30",
    status: "active",
  },
]

const mockMetrics: Record<string, ClientMetrics> = {
  "1": {
    clientId: "1",
    currentWeek: {
      clientId: "1",
      weekStart: "2024-11-25",
      weekEnd: "2024-12-01",
      views: 1247,
      leads: 34,
      conversions: 12,
      revenue: 3400,
    },
    lastWeek: {
      clientId: "1",
      weekStart: "2024-11-18",
      weekEnd: "2024-11-24",
      views: 1156,
      leads: 28,
      conversions: 10,
      revenue: 2800,
    },
    thisMonth: {
      views: 5234,
      leads: 142,
      conversions: 48,
      revenue: 14200,
    },
    allTime: {
      views: 45678,
      leads: 1234,
      conversions: 456,
      revenue: 123400,
    },
  },
  "2": {
    clientId: "2",
    currentWeek: {
      clientId: "2",
      weekStart: "2024-11-25",
      weekEnd: "2024-12-01",
      views: 2341,
      leads: 67,
      conversions: 23,
      revenue: 6700,
    },
    lastWeek: {
      clientId: "2",
      weekStart: "2024-11-18",
      weekEnd: "2024-11-24",
      views: 2156,
      leads: 59,
      conversions: 20,
      revenue: 5900,
    },
    thisMonth: {
      views: 9876,
      leads: 289,
      conversions: 98,
      revenue: 28900,
    },
    allTime: {
      views: 78901,
      leads: 2345,
      conversions: 789,
      revenue: 234500,
    },
  },
}

export default function DashboardPage() {
  const { user } = useUser()
  const { currentWorkspace } = useWorkspace()
  const [context, setContext] = useState<any>(null)
  const [locationsData, setLocationsData] = useState<any>(null)
  const [metricsData, setMetricsData] = useState<any>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [teamMemberCount, setTeamMemberCount] = useState<number>(0)
  const [propertyCount, setPropertyCount] = useState<number>(0)
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(true)
  const [loadingProperties, setLoadingProperties] = useState(true)
  const [loadingLocations, setLoadingLocations] = useState(true)
  const [loadingMetrics, setLoadingMetrics] = useState(true)


  // Fetch real data from GHL
  const { data: contacts } = useContacts('')
  const { data: opportunities } = useOpportunities('')
  const { data: conversations } = useConversations('')

  // Load locations data similar to agency page
  useEffect(() => {
    const loadLocations = async () => {
      try {
        setLoadingLocations(true)
        const response = await fetch('/api/ghl/locations')
        const result = await response.json()
        setLocationsData(result)
      } catch (error) {
        console.error('Failed to load locations:', error)
      } finally {
        setLoadingLocations(false)
      }
    }

    if (user) {
      loadLocations()
    }
  }, [user])

  // Load metrics data for AI coach
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoadingMetrics(true)
        const response = await fetch('/api/ghl/metrics/cached')
        const result = await response.json()
        setMetricsData(result)
      } catch (error) {
        console.error('Failed to load metrics:', error)
        setMetricsData({ data: [] })
      } finally {
        setLoadingMetrics(false)
      }
    }

    if (user && currentWorkspace) {
      loadMetrics()
    }
  }, [user, currentWorkspace])

  // Load team member count
  useEffect(() => {
    const loadTeamMemberCount = async () => {
      if (!currentWorkspace) {
        setLoadingTeamMembers(false)
        return
      }

      try {
        setLoadingTeamMembers(true)
        const response = await fetch(`/api/workspace/members?workspaceId=${currentWorkspace.id}`)
        const result = await response.json()
        if (result.members) {
          setTeamMemberCount(result.members.length)
        }
      } catch (error) {
        console.error('Failed to load team member count:', error)
        setTeamMemberCount(0)
      } finally {
        setLoadingTeamMembers(false)
      }
    }

    loadTeamMemberCount()
  }, [currentWorkspace])

  // Load property count
  useEffect(() => {
    const loadPropertyCount = async () => {
      if (!currentWorkspace) {
        setLoadingProperties(false)
        return
      }

      try {
        setLoadingProperties(true)
        const response = await fetch(`/api/properties?workspaceId=${currentWorkspace.id}`)
        const result = await response.json()
        if (result.properties) {
          setPropertyCount(result.properties.length)
        }
      } catch (error) {
        console.error('Failed to load property count:', error)
        setPropertyCount(0)
      } finally {
        setLoadingProperties(false)
      }
    }

    loadPropertyCount()
  }, [currentWorkspace])


  // Load recent activities
  const loadActivities = useCallback(async () => {
    // Use current workspace for activities
    const workspaceToUse = currentWorkspace

    if (!user?.id || !workspaceToUse) {
      return
    }

    try {
      const response = await fetch(`/api/activities?limit=30&workspaceId=${workspaceToUse.id}`)
      const result = await response.json()

      if (result.activities) {
        setActivities(result.activities)
      } else {
        setActivities([])
      }
    } catch (error) {
      console.error('Failed to load activities:', error)
      // Set empty activities on error
      setActivities([])
    }
  }, [user?.id, currentWorkspace])

  useEffect(() => {
    loadActivities()

    // Subscribe to real-time activity updates
    const unsubscribe = subscribeToUpdates('activities', (update) => {
      if (update.type === 'activity_added') {
        console.log('📝 Real-time activity update received:', update.data)
        // Add new activity to the list if it belongs to current workspace
        if (update.data?.workspace_id === currentWorkspace?.id) {
          setActivities(prev => {
            // Avoid duplicates and keep only 30 most recent
            const filtered = prev.filter(activity => activity.id !== update.data.id)
            return [update.data, ...filtered.slice(0, 29)]
          })
        }
      } else if (update.type === 'activity_deleted') {
        console.log('📝 Real-time activity deletion received:', update.data)
        // Remove deleted activity from the list
        setActivities(prev => prev.filter(activity => activity.id !== update.data?.id))
      }
    })

    // Cleanup subscription on unmount
    return () => {
      unsubscribe()
    }
  }, [user?.id, currentWorkspace]) // Removed loadActivities from deps to prevent loops

  // Calculate agency metrics - use actual data where available
  const agencyMetrics = useMemo(() => {
    if (!locationsData?.locations) return null

    const totalLocations = locationsData.locations.length

    return {
      totalLocations
    }
  }, [locationsData])

  useEffect(() => {
    // Build AI coach context using real data instead of mock data
    if (!user?.id || !locationsData?.locations || !currentWorkspace) {
      return
    }

    try {
      // Convert real GHL locations to GoHighLevelClient format
      const realClients: GoHighLevelClient[] = (locationsData.locations || []).map((location: any) => ({
        id: location.id,
        name: location.name,
        email: location.email || `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
        phone: location.phone || '',
        company: location.name,
        subscriptionPlan: 'professional', // Default plan since we don't track this in locations
        affiliateUserId: user.id,
        createdAt: location.created_at || '2024-01-01',
        updatedAt: new Date().toISOString(),
        status: 'active',
      }))

      // Convert real metrics data to ClientMetrics format
      const realMetrics: Record<string, ClientMetrics> = {}
      const metricsArray = metricsData?.data || []

      // Build metrics map for each location
      for (const metric of metricsArray) {
        const locationId = metric.location_id
        if (locationId) {
          realMetrics[locationId] = {
            clientId: locationId,
            currentWeek: {
              clientId: locationId,
              weekStart: new Date().toISOString().slice(0, 10),
              weekEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
              views: metric.contacts_count || 0,
              leads: metric.opportunities_count || 0,
              conversions: Math.round((metric.opportunities_count || 0) * 0.1), // Estimate conversions
              revenue: 0, // Could be enhanced with real revenue data
            },
            lastWeek: {
              clientId: locationId,
              weekStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
              weekEnd: new Date().toISOString().slice(0, 10),
              views: Math.round((metric.contacts_count || 0) * 0.9),
              leads: Math.round((metric.opportunities_count || 0) * 0.9),
              conversions: Math.round((metric.opportunities_count || 0) * 0.09),
              revenue: 0,
            },
            thisMonth: {
              views: metric.contacts_count || 0,
              leads: metric.opportunities_count || 0,
              conversions: Math.round((metric.opportunities_count || 0) * 0.1),
              revenue: 0,
            },
            allTime: {
              views: metric.contacts_count || 0,
              leads: metric.opportunities_count || 0,
              conversions: Math.round((metric.opportunities_count || 0) * 0.1),
              revenue: 0,
            },
          }
        }
      }

      // Build context with real data
      const ctx = buildDashboardContext(user.id, realClients, realMetrics)

      // Add additional real business data to the context
      ctx.properties = propertyCount
      ctx.locations = locationsData.locations.length
      ctx.totalLocations = locationsData.locations.length
      ctx.allLocations = locationsData.locations
      ctx.clients = realClients.length
      ctx.activeClients = realClients.filter(c => c.status === 'active').length

      // Add basic financial data if available
      ctx.totalIncome = 0 // Could be enhanced with real revenue data
      ctx.subscriptionRevenue = 0 // Could be enhanced with real subscription data

      setContext(ctx)

      console.log('🤖 Dashboard AI Context: Built with real data', {
        clientCount: realClients.length,
        locationCount: locationsData.locations.length,
        propertyCount: propertyCount,
        userId: user.id,
        workspaceId: currentWorkspace.id
      })
    } catch (error) {
      console.error('Failed to build AI coach context:', error)
      // Fallback to empty context
      setContext(buildDashboardContext(user.id, [], {}))
    }
  }, [user?.id, locationsData?.locations, currentWorkspace, propertyCount, metricsData])
  return (
    <div className="p-6 space-y-8 bg-gray-50/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your workspace</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border shadow-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          {loadingTeamMembers ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-sm font-medium">{teamMemberCount} team member{teamMemberCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Property Management</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-1">
              {loadingProperties ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                propertyCount
              )}
            </div>
            <p className="text-xs text-muted-foreground">Properties under management</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agency Management</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <MapPin className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-1">
              {loadingLocations ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                agencyMetrics?.totalLocations || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Total locations managed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access & Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Quick Access</CardTitle>
            <CardDescription>Your most used tools and pages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/agency/board" className="block p-4 border rounded-lg hover:bg-accent hover:shadow-sm transition-all duration-200">
              <div className="font-medium">Flexboard</div>
              <div className="text-sm text-muted-foreground">View your workspace board</div>
            </Link>
            <Link href="/agency/websites" className="block p-4 border rounded-lg hover:bg-accent hover:shadow-sm transition-all duration-200">
              <div className="font-medium">Website Portfolio</div>
              <div className="text-sm text-muted-foreground">Manage your websites</div>
            </Link>
            <Link href="/agency/gohighlevel-clients" className="block p-4 border rounded-lg hover:bg-accent hover:shadow-sm transition-all duration-200">
              <div className="font-medium">GHL Clients</div>
              <div className="text-sm text-muted-foreground">Manage GoHighLevel clients</div>
            </Link>
            <Link href="/agency/subscriptions" className="block p-4 border rounded-lg hover:bg-accent hover:shadow-sm transition-all duration-200">
              <div className="font-medium">Subscriptions</div>
              <div className="text-sm text-muted-foreground">Track your subscriptions</div>
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Latest updates across your workspace</CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getRelativeTime(new Date(activity.timestamp))}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No recent activity</p>
                  <p className="text-xs">Activities will appear here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


