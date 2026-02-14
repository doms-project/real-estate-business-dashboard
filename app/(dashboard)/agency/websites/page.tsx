"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, ExternalLink, Edit, Trash2, Check, X, Loader2, BarChart, Copy, CheckCircle2, RefreshCw } from "lucide-react"
import { SaveButton } from "@/components/ui/save-button"
import { useUser } from "@clerk/nextjs"
import { WebsiteAnalyticsDashboard } from "@/components/analytics/website-analytics-dashboard"

interface Website {
  id: string
  url: string
  name: string
  saved?: boolean // Track if website is saved to database
  techStack: {
    frontend: string
    backend: string
    hosting: string
    analytics: string
    paymentMethod: string
  }
}

interface WebsiteAnalytics {
  pageViews: number
  uniqueVisitors: number
  sessions: number
  avgSessionDuration: number
  bounceRate?: number
  eventsCount: number
  topPages: Array<{ page: string; views: number }>
  trafficSources: Record<string, number>
  geographicData?: Array<{ country: string; visitors: number }>
  percentageChanges?: {
    pageViews: number | null
    uniqueVisitors: number | null
    sessions: number | null
    avgSessionDuration: number | null
    bounceRate: number | null
  }
  recentPageViews: Array<any>
  recentEvents: Array<any>
  visitors?: Array<any>
  lastUpdated: string
  hasEverBeenTracked?: boolean
}

export default function WebsitesPage() {
  const { user } = useUser()
  const [websites, setWebsites] = useState<Website[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Analytics state
  const [websiteAnalytics, setWebsiteAnalytics] = useState<Record<string, WebsiteAnalytics>>({})
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [showTrackingScriptModal, setShowTrackingScriptModal] = useState<Website | null>(null)
  const [selectedWebsiteAnalytics, setSelectedWebsiteAnalytics] = useState<Website | null>(null)
  const [copiedScript, setCopiedScript] = useState(false)
  const [timeRange, setTimeRange] = useState('30d')

  // Load websites from database on mount
  useEffect(() => {
    async function loadWebsites() {
      if (!user) return

      try {
        const response = await fetch('/api/websites')
        if (response.ok) {
          const data = await response.json()
          setHasLoadedFromDB(true)

          // Always set websites from database, even if empty
          const loadedWebsites: Website[] = data.websites ? data.websites.map((w: any) => ({
            id: w.id,
            url: w.url,
            name: w.name,
            saved: true, // Mark as saved since loaded from database
            techStack: w.tech_stack || {
              frontend: "",
              backend: "",
              hosting: "",
              analytics: "",
              paymentMethod: "",
            },
          })) : []

          setWebsites(loadedWebsites)

          // Fetch analytics after loading websites
          if (loadedWebsites.length > 0) {
            await fetchWebsiteAnalytics()
          }
        }
      } catch (error) {
        console.error('Failed to load websites:', error)
        setHasLoadedFromDB(true)
      }
    }

    loadWebsites()
  }, [user])

  // Re-fetch analytics when websites array changes
  useEffect(() => {
    if (websites.length > 0 && hasLoadedFromDB) {
      fetchWebsiteAnalytics()
    }
  }, [websites.length])

  const handleAddWebsite = () => {
    const newWebsite: Website = {
      id: crypto.randomUUID(),
      url: "",
      name: "",
      saved: false, // Mark as not saved initially
      techStack: {
        frontend: "",
        backend: "",
        hosting: "",
        analytics: "",
        paymentMethod: "",
      },
    }
    setWebsites([...websites, newWebsite])
  }

  const handleDeleteWebsite = async (id: string) => {
    if (!confirm('Are you sure you want to remove this website?')) {
      return
    }

    setDeletingId(id)

    try {
      const response = await fetch(`/api/websites?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove from local state after successful deletion
        setWebsites(websites.filter(w => w.id !== id))
        // Notify other pages that websites have been updated
        window.dispatchEvent(new CustomEvent('websitesUpdated'))
      } else {
        const error = await response.json()
        alert(`Failed to delete website: ${error.error}`)
      }
    } catch (error: any) {
      console.error('Error deleting website:', error)
      alert('Failed to delete website. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditWebsite = (id: string) => {
    setEditingId(editingId === id ? null : id)
  }

  const updateWebsite = (id: string, updates: Partial<Website>) => {
    setWebsites(websites.map(w => w.id === id ? { ...w, ...updates } : w))
  }

  const updateTechStack = (id: string, techStack: Partial<Website['techStack']>) => {
    setWebsites(websites.map(w =>
      w.id === id
        ? { ...w, techStack: { ...w.techStack, ...techStack } }
        : w
    ))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Filter out incomplete websites (must have both URL and name)
      const validWebsites = websites.filter(website =>
        website.url.trim() && website.name.trim()
      )

      if (validWebsites.length === 0) {
        throw new Error('No valid websites to save. Please fill in both URL and name for your websites.')
      }

      const response = await fetch('/api/websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          websites: validWebsites.map(website => ({
            ...website,
            tech_stack: website.techStack, // Convert to snake_case for database
          })),
          workspaceId: null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Mark all valid websites as saved
        setWebsites(currentWebsites =>
          currentWebsites.map(website => ({
            ...website,
            saved: website.url.trim() && website.name.trim() ? true : website.saved
          }))
        )
        // Notify other pages that websites have been updated
        window.dispatchEvent(new CustomEvent('websitesUpdated'))
        return // Success - SaveButton will show success state
      } else {
        let errorMessage = 'Failed to save websites'
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
        } catch (parseError) {
          // If we can't parse JSON, use the response status text
          errorMessage = `Failed to save websites (${response.status}: ${response.statusText})`
        }
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      console.error('Error saving websites:', error)
      throw error // Re-throw so SaveButton can handle it
    } finally {
      setIsSaving(false)
    }
  }

  // Analytics functions
  const generateSiteId = (websiteName: string): string => {
    return websiteName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-')          // Replace spaces with hyphens
      .replace(/-+/g, '-')           // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
      .substring(0, 50)              // Limit length
      || 'unnamed-site'               // Fallback for empty names
  }

  const fetchWebsiteAnalytics = async () => {
    if (websites.length === 0) return

    setLoadingAnalytics(true)

    try {
      // Convert timeRange to days
      const days = timeRange === '7d' ? 7 :
                   timeRange === '30d' ? 30 :
                   timeRange === '90d' ? 90 :
                   timeRange === '1y' ? 365 : 30

      const results = await Promise.allSettled(
        websites.map(async (website) => {
          const siteId = generateSiteId(website.name)

          try {
            const response = await fetch(`/api/analytics?siteId=${siteId}&days=${days}`)
            if (!response.ok) {
              console.warn(`Failed to fetch analytics for ${website.name}: ${response.status}`)
              return { siteId, data: null, error: `HTTP ${response.status}` }
            }

            const data = await response.json()
            return { siteId, data, error: null }
          } catch (error) {
            console.error(`Failed to fetch analytics for ${website.name}:`, error)
            return { siteId, data: null, error: error instanceof Error ? error.message : String(error) }
          }
        })
      )

      const analyticsMap: Record<string, WebsiteAnalytics> = {}
      const errors: string[] = []

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { siteId, data, error } = result.value
          if (data && !error) {
            analyticsMap[siteId] = data
          } else if (error) {
            errors.push(`${websites[index].name}: ${error}`)
          }
        } else {
          errors.push(`${websites[index].name}: ${result.reason.message}`)
        }
      })

      setWebsiteAnalytics(analyticsMap)

      if (errors.length > 0 && Object.keys(analyticsMap).length === 0) {
        console.error('All analytics requests failed:', errors)
      } else if (errors.length > 0) {
        console.warn('Some analytics requests failed:', errors)
      }

    } catch (error) {
      console.error('Failed to fetch website analytics:', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  // Modal Components
  const TrackingScriptModal = () => {
    if (!showTrackingScriptModal) return null
    const website = showTrackingScriptModal
    const siteId = generateSiteId(website.name)

    const trackingScript = `<!-- Website Analytics Tracking -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${typeof window !== 'undefined' ? window.location.origin : ''}/api/analytics/script?siteId=${siteId}';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`

    const copyToClipboard = () => {
      navigator.clipboard.writeText(trackingScript)
      setCopiedScript(true)
      setTimeout(() => setCopiedScript(false), 2000)
    }

    return (
      <Dialog open={!!showTrackingScriptModal} onOpenChange={() => setShowTrackingScriptModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Detailed Setup Instructions - {website.name}
            </DialogTitle>
            <DialogDescription>
              Step-by-step guide to add analytics tracking to your website
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Script Code Block */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Tracking Script</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                >
                  {copiedScript ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Script
                    </>
                  )}
                </Button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{trackingScript}</code>
              </pre>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold mb-2">💡 Installation Instructions</h4>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="font-bold">1.</span>
                  <span>Copy the tracking script above</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">2.</span>
                  <span>Add it to your website's HTML just before the closing <code className="bg-white px-1">&lt;/head&gt;</code> tag</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">3.</span>
                  <span>Deploy your changes to production</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">4.</span>
                  <span>Wait 5-10 minutes and refresh this page to see analytics data</span>
                </li>
              </ol>
            </div>

            {/* Site ID Reference */}
            <div className="text-xs text-muted-foreground">
              <p><strong>Site ID:</strong> <code className="bg-gray-100 px-1 py-0.5 rounded">{siteId}</code></p>
              <p className="mt-1">This unique ID tracks analytics specifically for {website.name}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const WebsiteAnalyticsModal = () => {
    if (!selectedWebsiteAnalytics) return null

    const website = selectedWebsiteAnalytics
    const siteId = generateSiteId(website.name)
    const analytics = websiteAnalytics[siteId]

    // Don't close modal during loading - show loading state instead
    // if (!analytics) return null

    return (
      <Dialog
        open={!!selectedWebsiteAnalytics}
        onOpenChange={() => setSelectedWebsiteAnalytics(null)}
      >
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              {website.name} - Analytics Dashboard
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <ExternalLink className="h-3 w-3" />
              <a
                href={website.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {website.url}
              </a>
            </DialogDescription>
          </DialogHeader>

          {/* Render existing analytics dashboard */}
          <WebsiteAnalyticsDashboard
            analytics={analytics || {
              pageViews: 0,
              uniqueVisitors: 0,
              sessions: 0,
              avgSessionDuration: 0,
              bounceRate: 0,
              eventsCount: 0,
              topPages: [],
              trafficSources: {},
              geographicData: [],
              percentageChanges: {},
              recentPageViews: [],
              recentEvents: [],
              visitors: [],
              lastUpdated: new Date().toISOString(),
              hasEverBeenTracked: false
            }}
            siteId={siteId}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            onRefresh={async () => {
              // Refresh just this website's analytics
              const days = timeRange === '7d' ? 7 :
                           timeRange === '30d' ? 30 :
                           timeRange === '90d' ? 90 :
                           timeRange === '1y' ? 365 : 30

              try {
                const response = await fetch(`/api/analytics?siteId=${siteId}&days=${days}`)
                if (response.ok) {
                  const data = await response.json()
                  setWebsiteAnalytics(prev => ({
                    ...prev,
                    [siteId]: data
                  }))
                }
              } catch (error) {
                console.error('Failed to refresh analytics:', error)
              }
            }}
            isRefreshing={loadingAnalytics}
            isLoading={!analytics || loadingAnalytics}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Website Portfolio</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage all your websites and their technical details
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={fetchWebsiteAnalytics}
            disabled={loadingAnalytics || websites.length === 0}
          >
            {loadingAnalytics ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <BarChart className="mr-2 h-4 w-4" />
                Refresh Analytics
              </>
            )}
          </Button>
          <Button onClick={handleAddWebsite}>
            <Plus className="mr-2 h-4 w-4" />
            Add Website
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {websites.map((website) => (
          <Card key={website.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {editingId === website.id ? (
                    <div className="space-y-2">
                      <Input
                        value={website.name}
                        onChange={(e) => updateWebsite(website.id, { name: e.target.value })}
                        className="font-semibold text-lg"
                        placeholder="Website name"
                      />
                      <Input
                        value={website.url}
                        onChange={(e) => updateWebsite(website.id, { url: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <CardTitle className={`truncate ${!website.name.trim() ? 'text-muted-foreground' : ''}`}>
                          {website.name || 'Unnamed Website'}
                        </CardTitle>
                        {!website.url.trim() || !website.name.trim() ? (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                            Incomplete
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="mt-1">
                        {website.url ? (
                          <a
                            href={website.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline truncate"
                          >
                            <span className="truncate">{website.url}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">No URL set</span>
                        )}
                      </CardDescription>
                    </>
                  )}
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditWebsite(website.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteWebsite(website.id)}
                    disabled={deletingId === website.id}
                  >
                    {deletingId === website.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingId === website.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Frontend</label>
                      <Input
                        value={website.techStack.frontend}
                        onChange={(e) => updateTechStack(website.id, { frontend: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="React, Vue, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Backend</label>
                      <Input
                        value={website.techStack.backend}
                        onChange={(e) => updateTechStack(website.id, { backend: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Node.js, Python, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Hosting</label>
                      <Input
                        value={website.techStack.hosting}
                        onChange={(e) => updateTechStack(website.id, { hosting: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Vercel, Netlify, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Analytics</label>
                      <Input
                        value={website.techStack.analytics}
                        onChange={(e) => updateTechStack(website.id, { analytics: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Google Analytics, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Payment Method</label>
                      <Input
                        value={website.techStack.paymentMethod}
                        onChange={(e) => updateTechStack(website.id, { paymentMethod: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Stripe, PayPal, etc."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={isSaving}
                      onClick={async () => {
                        // Auto-save when done editing
                        try {
                          await handleSave()
                          setEditingId(null)
                        } catch (error) {
                          console.error('Failed to save:', error)
                          // Still allow closing edit mode even if save fails
                          setEditingId(null)
                        }
                      }}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Save & Done
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Frontend:</span>
                      <span className="text-sm text-muted-foreground">
                        {website.techStack.frontend || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Backend:</span>
                      <span className="text-sm text-muted-foreground">
                        {website.techStack.backend || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Hosting:</span>
                      <span className="text-sm text-muted-foreground">
                        {website.techStack.hosting || 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium">Analytics:</span>
                      <span className="text-sm text-muted-foreground">
                        {website.techStack.analytics || 'Not set'}
                      </span>
                    </div>
                    {website.techStack.paymentMethod && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm font-medium">Payment Method:</span>
                        <span className="text-sm text-muted-foreground">
                          {website.techStack.paymentMethod}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Analytics Section */}
                  <div className="mt-4 pt-4 border-t">
                    {(() => {
                      const siteId = generateSiteId(website.name)
                      const analytics = websiteAnalytics[siteId]

                      return analytics && analytics.hasEverBeenTracked ? (
                        // Show analytics preview if data exists
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">📊 Analytics</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedWebsiteAnalytics(website)}
                            >
                              View Details →
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-2 bg-blue-50 rounded">
                              <p className="text-xs text-muted-foreground">Views</p>
                              <p className="font-bold text-blue-600">
                                {analytics.pageViews || 0}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded">
                              <p className="text-xs text-muted-foreground">Visitors</p>
                              <p className="font-bold text-green-600">
                                {analytics.uniqueVisitors || 0}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-purple-50 rounded">
                              <p className="text-xs text-muted-foreground">Bounce</p>
                              <p className="font-bold text-purple-600">
                                {analytics.bounceRate || 0}%
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        // Show tracking script section if no analytics data
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-orange-600">
                              <BarChart className="h-4 w-4 inline mr-1" />
                              Analytics Setup Required
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowTrackingScriptModal(website)}
                            >
                              View Full Instructions →
                            </Button>
                          </div>

                          {/* Auto-generated tracking script */}
                          <div className="bg-gray-50 border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-medium text-muted-foreground">
                                Copy this script to your website:
                              </label>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const siteId = generateSiteId(website.name)
                                  const script = `<!-- Website Analytics Tracking -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${typeof window !== 'undefined' ? window.location.origin : ''}/api/analytics/script?siteId=${siteId}';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`
                                  navigator.clipboard.writeText(script)
                                  setCopiedScript(true)
                                  setTimeout(() => setCopiedScript(false), 2000)
                                }}
                              >
                                {copiedScript ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </>
                                )}
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                              <code>{`<!-- Website Analytics Tracking -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${typeof window !== 'undefined' ? window.location.origin : ''}/analytics.js';
    script.setAttribute('data-site-id', '${generateSiteId(website.name)}');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`}</code>
                            </pre>
                            <div className="mt-2 text-xs text-muted-foreground">
                              Site ID: <code className="bg-white px-1 py-0.5 rounded text-xs">{generateSiteId(website.name)}</code>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-2">
                            💡 Add this script to your website's HTML just before the closing <code>&lt;/head&gt;</code> tag, then deploy to production.
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modals */}
      <TrackingScriptModal />
      <WebsiteAnalyticsModal />
    </div>
  )
}


