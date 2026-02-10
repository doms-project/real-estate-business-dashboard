"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Users, Building2, Link as LinkIcon, Globe, Grid3x3, Rocket, CreditCard, ArrowRight, TrendingUp, Activity, Target, BarChart3, Calendar, MessageSquare, Star, AlertTriangle, Loader2 } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { AiCoachSlideout } from "@/components/ai-coach/ai-coach-slideout"
import { PitTokenManager } from "@/components/pit-token-manager"
import { buildAgencyContext } from "@/lib/ai-coach/context-builder"
import { usePageData } from "@/components/layout/page-data-context"
import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"

// Agency-wide metrics interface
interface AgencyMetrics {
  totalLocations: number
  activeClients: number
  totalContacts: number
  totalOpportunities: number
  totalConversations: number
  totalSurveyResponses: number
  activeOpportunities: number
  recentContacts: number
  avgResponseTime: number
  locationsData: any[]
  websitesData: any[]
  liveSites: number
  domains: number
  healthScore: number
  totalAssociations: number
  contactsWithOpportunities: number
  opportunitiesWithContacts: number
  associationTypes: Record<string, number>
}

export default function AgencyPage() {
  const { user } = useUser()
  const { setPageData } = usePageData()
  const [context, setContext] = useState<any>(null)
  // Load metrics from database (same as GHL clients page)
  const [locationMetrics, setLocationMetrics] = useState<Record<string, { contacts: number, opportunities: number, conversations: number, healthScore?: number }>>({})
  const [locationsData, setLocationsData] = useState<any>(null)
  const [websitesData, setWebsitesData] = useState<any>(null)
  const [healthData, setHealthData] = useState<any>(null)
  const [flexboardStats, setFlexboardStats] = useState({ boards: 1, widgets: 0 })
  const [subscriptionStats, setSubscriptionStats] = useState({ count: 0, revenue: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true)
  const [loadingFlexboard, setLoadingFlexboard] = useState(true)
  const [loadingHealth, setLoadingHealth] = useState(true)

  // Load data from database - extracted as reusable function
  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // Wait for authentication to be ready
      if (!user) {
        console.log('User not authenticated, skipping data load')
        setLoading(false)
        return
      }

      // Load locations
      const locationsResponse = await fetch('/api/ghl/locations')
      const locationsResult = await locationsResponse.json()
      setLocationsData(locationsResult)

      // Load websites data from database
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data: websites, error } = await supabase
          .from('websites')
          .select('*')
          .order('created_at', { ascending: false })

        if (!error && websites) {
          setWebsitesData({ websites, count: websites.length })
        }
      } catch (error) {
        console.error('Failed to load websites data:', error)
        setWebsitesData({ websites: [], count: 0 })
      }

      // Load metrics from database
      const metricsResponse = await fetch('/api/ghl/metrics/cached?t=' + Date.now())
      const metricsResult = await metricsResponse.json()

      if (metricsResult.success && metricsResult.data) {
        const metricsMap: Record<string, { contacts: number, opportunities: number, conversations: number, healthScore?: number }> = {}
        metricsResult.data.forEach((item: any) => {
          metricsMap[item.location_id] = {
            contacts: item.contacts_count || 0,
            opportunities: item.opportunities_count || 0,
            conversations: item.conversations_count || 0,
            healthScore: item.health_score
          }
        })
        setLocationMetrics(metricsMap)
      }

      // Load health data
      try {
        setLoadingHealth(true)
        const healthResponse = await fetch('/api/health')
        const healthResult = await healthResponse.json()
        setHealthData(healthResult)
      } catch (error) {
        console.error('Failed to load health data:', error)
      } finally {
        setLoadingHealth(false)
      }

      // Load subscription data
      try {
        setLoadingSubscriptions(true)
        const subscriptionsResponse = await fetch('/api/subscriptions')
        if (subscriptionsResponse.ok) {
          const subscriptionsData = await subscriptionsResponse.json()
          if (subscriptionsData.subscriptions) {
            const activeSubs = subscriptionsData.subscriptions.length
            const monthlyRevenue = subscriptionsData.subscriptions.reduce((sum: number, sub: any) => sum + parseFloat(sub.cost || 0), 0)
            setSubscriptionStats({
              count: activeSubs,
              revenue: monthlyRevenue
            })
          }
        }
      } catch (error) {
        console.error('Failed to load subscription data:', error)
        // Keep default values
      } finally {
        setLoadingSubscriptions(false)
      }

      // Load Flexboard stats (if user is logged in)
      if (user) {
        try {
          setLoadingFlexboard(true)
          const blopsResponse = await fetch('/api/blops')
          if (blopsResponse.ok) {
            const blopsData = await blopsResponse.json()
            setFlexboardStats({
              boards: 1, // Default workspace board
              widgets: blopsData.blops?.length || 0
            })
          }
        } catch (error) {
          console.error('Failed to load Flexboard stats:', error)
          // Keep default values
        } finally {
          setLoadingFlexboard(false)
        }
      } else {
        setLoadingFlexboard(false)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading agency data:', error)
      setLoading(false)
    }
  }, [user])

  // Load data from database on mount
  useEffect(() => {
    loadData()
  }, [loadData, user])

  // Listen for bulk refresh completion events from other pages
  useEffect(() => {
    const handleBulkRefresh = (event: CustomEvent) => {
      console.log('📡 Dashboard received bulk refresh completion event:', event.detail)
      // Reload dashboard data to show fresh metrics
      loadData()
    }

    window.addEventListener('bulkRefreshCompleted', handleBulkRefresh as EventListener)

    return () => {
      window.removeEventListener('bulkRefreshCompleted', handleBulkRefresh as EventListener)
    }
  }, [loadData])

  // Listen for subscription updates
  useEffect(() => {
    const handleSubscriptionUpdate = () => {
      // Reload subscription data when subscriptions are updated
      const loadSubscriptionData = async () => {
        try {
          setLoadingSubscriptions(true)
          const subscriptionsResponse = await fetch('/api/subscriptions')
          if (subscriptionsResponse.ok) {
            const subscriptionsData = await subscriptionsResponse.json()
            if (subscriptionsData.subscriptions) {
              const activeSubs = subscriptionsData.subscriptions.length
              const monthlyRevenue = subscriptionsData.subscriptions.reduce((sum: number, sub: any) => sum + parseFloat(sub.cost || 0), 0)
              setSubscriptionStats({
                count: activeSubs,
                revenue: monthlyRevenue
              })
            }
          }
        } catch (error) {
          console.error('Failed to reload subscription data:', error)
        } finally {
          setLoadingSubscriptions(false)
        }
      }
      loadSubscriptionData()
    }

    window.addEventListener('subscriptionUpdated', handleSubscriptionUpdate)

    return () => {
      window.removeEventListener('subscriptionUpdated', handleSubscriptionUpdate)
    }
  }, [])

  // Listen for website updates
  useEffect(() => {
    const handleWebsiteUpdate = () => {
      // Trigger a reload of all data when websites are updated
      loadData()
    }

    window.addEventListener('websitesUpdated', handleWebsiteUpdate)

    return () => {
      window.removeEventListener('websitesUpdated', handleWebsiteUpdate)
    }
  }, [loadData])

  useEffect(() => {
    if (user) {
      const ctx = buildAgencyContext(user.id, [], {})
      setContext(ctx)
    }
  }, [user])

  // Calculate agency metrics from database data
  const agencyMetrics = useMemo(() => {
    if (!locationsData || !locationMetrics) return null

    const locations = locationsData.locations || []
    const websites = websitesData?.websites || []
    const totalLocations = locations.length
    const totalContacts = Object.values(locationMetrics).reduce((sum, m) => sum + (m.contacts || 0), 0)
    const totalOpportunities = Object.values(locationMetrics).reduce((sum, m) => sum + (m.opportunities || 0), 0)
    const totalConversations = Object.values(locationMetrics).reduce((sum, m) => sum + (m.conversations || 0), 0)

    // Calculate active clients (locations with > 0 contacts)
    const activeClients = Object.values(locationMetrics).filter(m => (m.contacts || 0) > 0).length

    // Calculate live sites and domains from websites table
    const liveSites = websites.length // Assume all websites are live for now
    const domains = websites.filter((w: any) => w.url && w.url.includes('.')).length // Websites with domains

    // Calculate health score from individual location scores
    const avgHealthScore = Math.round(
      Object.values(locationMetrics).reduce((sum, m) => sum + (m.healthScore || 0), 0) /
      Math.max(Object.keys(locationMetrics).length, 1)
    )

    const metrics: AgencyMetrics = {
      totalLocations,
      activeClients,
      totalContacts,
      totalOpportunities,
      totalConversations,
      totalSurveyResponses: 0, // Not available from database
      activeOpportunities: totalOpportunities, // Assume all are active
      recentContacts: totalContacts, // Assume all are recent
      avgResponseTime: 2.5, // Mock value
      locationsData: locations,
      websitesData: websites,
      liveSites,
      domains,
      healthScore: avgHealthScore,
      totalAssociations: 0, // Not available from database
      contactsWithOpportunities: totalContacts, // Estimate
      opportunitiesWithContacts: totalOpportunities, // Estimate
      associationTypes: {} // Not available from database
    }

    return metrics
  }, [locationsData, locationMetrics, websitesData])

  // Set page data for AI coach
  useEffect(() => {
    if (agencyMetrics) {
      setPageData(agencyMetrics)
    }
  }, [agencyMetrics, setPageData])

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agency Overview</h1>
          <p className="text-muted-foreground">
            Real-time insights across all {loading ? (
              <Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              `${agencyMetrics?.totalLocations || 0}`
            )} locations
          </p>
        </div>
      </div>


      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <Link href="/agency/subscriptions">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                Subscription Management
                <ArrowRight className="h-4 w-4 ml-auto" />
              </CardTitle>
              <CardDescription>
                Manage client subscriptions and billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Active Plans</span>
                  <span className="font-medium">
                    {loadingSubscriptions ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      subscriptionStats.count
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Monthly Revenue</span>
                  <span className="font-medium text-green-600">
                    {loadingSubscriptions ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      `$${subscriptionStats.revenue.toFixed(2)}`
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agency/board">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3x3 className="h-5 w-5 text-purple-600" />
                Flexboard
                <ArrowRight className="h-4 w-4 ml-auto" />
              </CardTitle>
              <CardDescription>
                Visual command center for agency operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Active Dashboards</span>
                  <span className="font-medium">
                    {loadingFlexboard ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      flexboardStats.boards
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Status Monitors</span>
                  <span className="font-medium text-purple-600">
                    {loadingFlexboard ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      flexboardStats.widgets
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agency/websites">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                Website Portfolio
                <ArrowRight className="h-4 w-4 ml-auto" />
              </CardTitle>
              <CardDescription>
                Manage your website portfolio and technical details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Live Sites</span>
                  <span className="font-medium">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      agencyMetrics?.liveSites || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Domains</span>
                  <span className="font-medium text-blue-600">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      agencyMetrics?.domains || 0
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agency/tech-stack">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-orange-600" />
                Tech Stack
                <ArrowRight className="h-4 w-4 ml-auto" />
              </CardTitle>
              <CardDescription>
                Monitor integrations and technology
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Active Integrations</span>
                  <span className="font-medium">
                    {loadingHealth ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      healthData?.checks?.integrations ? `${healthData.checks.integrations.count} of ${healthData.checks.integrations.total}` : '2'
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>System Health</span>
                  <span className={`font-medium ${
                    healthData?.overallHealth?.status === 'healthy' ? 'text-green-600' :
                    healthData?.overallHealth?.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {loadingHealth ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      `${healthData?.overallHealth?.score || 98}%`
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/agency/gohighlevel-clients">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                GoHighLevel Clients
                <ArrowRight className="h-4 w-4 ml-auto" />
              </CardTitle>
              <CardDescription>
                Manage and monitor your GoHighLevel client accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Locations</span>
                  <span className="font-medium">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      agencyMetrics?.locationsData?.length || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Active Clients</span>
                  <span className="font-medium text-green-600">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      agencyMetrics?.activeClients || 0
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* PIT Token Manager */}
      <PitTokenManager />
    </div>
  )
}


