import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@supabase/supabase-js'
import {
  Eye,
  Users,
  Clock,
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Download
} from 'lucide-react'

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
}

interface WebsiteAnalyticsDashboardProps {
  analytics: WebsiteAnalytics
  siteId: string
  onRefresh?: () => void
  isRefreshing?: boolean
  autoRefresh?: boolean
  onToggleAutoRefresh?: () => void
  timeRange?: string
  onTimeRangeChange?: (range: string) => void
  isLoading?: boolean
}

export function WebsiteAnalyticsDashboard({
  analytics,
  siteId,
  onRefresh,
  isRefreshing = false,
  autoRefresh = true,
  onToggleAutoRefresh,
  timeRange = '30d',
  onTimeRangeChange,
  isLoading = false
}: WebsiteAnalyticsDashboardProps) {

  // Initialize Supabase client for real-time updates
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Log when analytics data updates
  useEffect(() => {
    console.log('📊 Analytics dashboard updated:', {
      siteId,
      pageViews: analytics.pageViews,
      sessions: analytics.sessions,
      lastUpdated: analytics.lastUpdated
    });
  }, [analytics.pageViews, analytics.sessions, analytics.lastUpdated, siteId]);

  // Real-time analytics updates with debouncing
  useEffect(() => {
    if (!siteId || !onRefresh) return;

    console.log('🔄 Setting up real-time analytics for site:', siteId);

    let debounceTimer: NodeJS.Timeout;

    const debouncedRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('🔄 Refreshing analytics after debounce...');
        onRefresh();
      }, 5000); // Wait 5 seconds after last event before refreshing
    };

    const channel = supabase
      .channel(`analytics-${siteId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'page_views',
          filter: `site_id=eq.${siteId}`
        },
        (payload) => {
          console.log('📈 New page view detected');
          debouncedRefresh();
        }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'visitor_events',
          filter: `site_id=eq.${siteId}`
        },
        (payload) => {
          console.log('🎯 New event detected');
          debouncedRefresh();
        }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'website_visitors',
          filter: `site_id=eq.${siteId}`
        },
        (payload) => {
          console.log('👤 New visitor detected');
          debouncedRefresh();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time analytics subscription active for:', siteId);
        } else if (status === 'CLOSED') {
          console.log('❌ Real-time analytics subscription closed');
        }
      });

    return () => {
      console.log('🔌 Cleaning up real-time analytics subscription');
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [siteId, onRefresh]);

  // Calculate derived metrics
  const metrics = useMemo(() => {
    const pagesPerSession = analytics.sessions > 0 ?
      Math.round((analytics.pageViews / analytics.sessions) * 100) / 100 : 0

    const avgSessionDurationMinutes = Math.floor(analytics.avgSessionDuration / 60)
    const avgSessionDurationSeconds = analytics.avgSessionDuration % 60

    return {
      bounceRate: analytics.bounceRate ?? 0,
      pagesPerSession,
      avgSessionDurationMinutes,
      avgSessionDurationSeconds
    }
  }, [analytics])

  // Calculate traffic source percentages
  const trafficSources = useMemo(() => {
    const total = Object.values(analytics.trafficSources).reduce((sum, count) => sum + count, 0)
    return Object.entries(analytics.trafficSources)
      .map(([source, count]) => ({
        source,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
  }, [analytics.trafficSources])

  // Calculate device/browser breakdown from page views (more accurate)
  const deviceBreakdown = useMemo(() => {
    // Count unique sessions per device/browser
    const sessionDevices = new Map<string, string>()
    const sessionBrowsers = new Map<string, string>()

    // Use page views to get most recent device/browser per session
    analytics.recentPageViews?.forEach(pageView => {
      if (!sessionDevices.has(pageView.session_id)) {
        sessionDevices.set(pageView.session_id, pageView.device_type || 'unknown')
      }
      if (!sessionBrowsers.has(pageView.session_id)) {
        sessionBrowsers.set(pageView.session_id, pageView.browser || 'unknown')
      }
    })

    // Count sessions per device
    const devices: Record<string, number> = {}
    sessionDevices.forEach(device => {
      devices[device] = (devices[device] || 0) + 1
    })

    // Count sessions per browser
    const browsers: Record<string, number> = {}
    sessionBrowsers.forEach(browser => {
      browsers[browser] = (browsers[browser] || 0) + 1
    })

    // Fallback to visitor data if no page view data
    if (Object.keys(devices).length === 0 && analytics.visitors?.length) {
      analytics.visitors.forEach(visitor => {
        const device = visitor.device_type || 'unknown'
        devices[device] = (devices[device] || 0) + 1
      })
    }

    if (Object.keys(browsers).length === 0 && analytics.visitors?.length) {
      analytics.visitors.forEach(visitor => {
        const browser = visitor.browser || 'unknown'
        browsers[browser] = (browsers[browser] || 0) + 1
      })
    }

    return { devices, browsers }
  }, [analytics.recentPageViews, analytics.visitors])

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatPercentageChange = (change: number | null, isInverseMetric = false) => {
    if (change === null) return null

    // For inverse metrics (bounce rate), negative change is good
    // For normal metrics (page views), positive change is good
    const isImprovement = isInverseMetric ? change < 0 : change >= 0

    const colorClass = isImprovement ? 'text-green-600' : 'text-red-600'
    const icon = change >= 0 ? '↗️' : '↘️'

    return { value: change, colorClass, icon, isImprovement }
  }

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return <Smartphone className="h-4 w-4" />
      case 'tablet': return <Tablet className="h-4 w-4" />
      case 'desktop': return <Monitor className="h-4 w-4" />
      default: return <Monitor className="h-4 w-4" />
    }
  }

  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'direct': return 'bg-blue-500'
      case 'organic': return 'bg-green-500'
      case 'social': return 'bg-purple-500'
      case 'referrer': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with site info and time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold">Website Analytics</h2>
            <p className="text-sm text-muted-foreground">Site: {siteId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          {onToggleAutoRefresh && (
            <Button
              onClick={onToggleAutoRefresh}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              className="flex items-center gap-1"
            >
              <Activity className={`h-3 w-3 ${autoRefresh ? 'text-green-600' : 'text-gray-400'}`} />
              Auto {autoRefresh ? 'ON' : 'OFF'}
            </Button>
          )}

          {/* Manual refresh button */}
          {onRefresh && (
            <Button
              onClick={onRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          )}

          {/* Export CSV button */}
          <Button
            onClick={() => {
              const csvData = [
                ['Metric', 'Value'],
                ['Page Views', analytics.pageViews],
                ['Unique Visitors', analytics.uniqueVisitors],
                ['Sessions', analytics.sessions],
                ['Bounce Rate', `${analytics.bounceRate}%`],
                ['Avg Session Duration', `${Math.floor(analytics.avgSessionDuration / 60)}m ${analytics.avgSessionDuration % 60}s`],
                ['Events Count', analytics.eventsCount],
                [''],
                ['Top Pages', 'Views'],
                ...analytics.topPages.map(p => [p.page, p.views]),
                [''],
                ['Traffic Sources', 'Count'],
                ...Object.entries(analytics.trafficSources).map(([source, count]) => [source, count]),
                [''],
                ['Geographic Data', 'Visitors'],
                ...(analytics.geographicData || []).map(g => [g.country, g.visitors])
              ]

              const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `analytics-${siteId}-${new Date().toISOString().split('T')[0]}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </Button>

          <Select value={timeRange} onValueChange={(value) => onTimeRangeChange?.(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Page Views</p>
                {isLoading ? (
                  <div className="h-8 w-20 bg-gray-200 animate-pulse rounded mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{formatNumber(analytics.pageViews)}</p>
                )}
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
            <div className="flex items-center mt-2">
              {isLoading ? (
                <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />
              ) : (() => {
                const change = analytics.percentageChanges?.pageViews !== undefined ?
                  formatPercentageChange(analytics.percentageChanges.pageViews) : null
                return change ? (
                  <>
                    <span className={`text-xs mr-1 ${change.icon === '↗️' ? 'text-green-500' : 'text-red-500'}`}>
                      {change.icon}
                    </span>
                    <span className={`text-xs ${change.colorClass}`}>
                      {change.value > 0 ? '+' : ''}{change.value}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No data</span>
                )
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unique Visitors</p>
                <p className="text-2xl font-bold">{formatNumber(analytics.uniqueVisitors)}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
            <div className="flex items-center mt-2">
              {(() => {
                const change = analytics.percentageChanges?.uniqueVisitors !== undefined ?
                  formatPercentageChange(analytics.percentageChanges.uniqueVisitors) : null
                return change ? (
                  <>
                    <span className={`text-xs mr-1 ${change.icon === '↗️' ? 'text-green-500' : 'text-red-500'}`}>
                      {change.icon}
                    </span>
                    <span className={`text-xs ${change.colorClass}`}>
                      {change.value > 0 ? '+' : ''}{change.value}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No data</span>
                )
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sessions</p>
                <p className="text-2xl font-bold">{formatNumber(analytics.sessions)}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
            <div className="flex items-center mt-2">
              {(() => {
                const change = analytics.percentageChanges?.sessions !== undefined ?
                  formatPercentageChange(analytics.percentageChanges.sessions) : null
                return change ? (
                  <>
                    <span className={`text-xs mr-1 ${change.icon === '↗️' ? 'text-green-500' : 'text-red-500'}`}>
                      {change.icon}
                    </span>
                    <span className={`text-xs ${change.colorClass}`}>
                      {change.value > 0 ? '+' : ''}{change.value}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No data</span>
                )
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bounce Rate</p>
                <p className="text-2xl font-bold">{metrics.bounceRate}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
            <div className="flex items-center mt-2">
              {(() => {
                const change = analytics.percentageChanges?.bounceRate !== undefined ?
                  formatPercentageChange(analytics.percentageChanges.bounceRate, true) : null
                return change ? (
                  <>
                    <span className={`text-xs mr-1 ${change.isImprovement ? 'text-green-500' : 'text-red-500'}`}>
                      {change.icon}
                    </span>
                    <span className={`text-xs ${change.colorClass}`}>
                      {change.value > 0 ? '+' : ''}{change.value}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No data</span>
                )
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg. Session</p>
                <p className="text-2xl font-bold">
                  {metrics.avgSessionDurationMinutes}m {metrics.avgSessionDurationSeconds}s
                </p>
              </div>
              <Clock className="h-8 w-8 text-indigo-500" />
            </div>
            <div className="flex items-center mt-2">
              {(() => {
                const change = analytics.percentageChanges?.avgSessionDuration !== undefined ?
                  formatPercentageChange(analytics.percentageChanges.avgSessionDuration) : null
                return change ? (
                  <>
                    <span className={`text-xs mr-1 ${change.icon === '↗️' ? 'text-green-500' : 'text-red-500'}`}>
                      {change.icon}
                    </span>
                    <span className={`text-xs ${change.colorClass}`}>
                      {change.value > 0 ? '+' : ''}{change.value}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">No data</span>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="traffic-sources" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="traffic-sources">Traffic Sources</TabsTrigger>
          <TabsTrigger value="top-pages">Top Pages</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
          <TabsTrigger value="devices">Devices & Browsers</TabsTrigger>
          <TabsTrigger value="events">Recent Activity</TabsTrigger>
        </TabsList>

        {/* Traffic Sources Tab */}
        <TabsContent value="traffic-sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Traffic Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trafficSources.map(({ source, count, percentage }) => (
                  <div key={source} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getSourceColor(source)}`} />
                      <span className="font-medium capitalize">{source}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{count} visits</span>
                      <div className="flex items-center gap-2 min-w-20">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{percentage}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geography Tab */}
        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Geographic Distribution
              </CardTitle>
              <CardDescription>
                Visitor locations by country
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.geographicData && analytics.geographicData.length > 0 ? (
                  analytics.geographicData.map(({ country, visitors }) => (
                    <div key={country} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <MapPin className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span className="font-medium">{country}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{visitors} visitors</span>
                        <div className="flex items-center gap-2 min-w-20">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${(visitors / Math.max(...(analytics.geographicData?.map(d => d.visitors) || [1]))) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {Math.round((visitors / analytics.uniqueVisitors) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No geographic data available yet</p>
                    <p className="text-sm">Geographic data will appear as visitors access your site</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Pages Tab */}
        <TabsContent value="top-pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topPages?.slice(0, 10).map((page, index) => (
                  <div key={page.page} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-medium text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm truncate max-w-xs">{page.page}</p>
                        <p className="text-xs text-muted-foreground">{page.views} views</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{page.views}</p>
                      <p className="text-xs text-muted-foreground">views</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices & Browsers Tab */}
        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Device Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(deviceBreakdown.devices).map(([device, count]) => (
                    <div key={device} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(device)}
                        <span className="font-medium capitalize">{device}</span>
                      </div>
                      <Badge variant="secondary">{count as number}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Browsers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(deviceBreakdown.browsers).map(([browser, count]) => (
                    <div key={browser} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-gray-300" />
                        <span className="font-medium capitalize">{browser}</span>
                      </div>
                      <Badge variant="secondary">{count as number}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {analytics.recentPageViews?.slice(0, 20).map((view: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Eye className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="font-medium text-sm">{view.page_title || view.page_url}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(view.viewed_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">Page View</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer with last updated and refresh status */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Last updated: {new Date(analytics.lastUpdated).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}</span>
          {autoRefresh && (
            <div className="flex items-center gap-1 text-green-600">
              <Activity className="h-3 w-3" />
              <span>Auto-refresh ON</span>
            </div>
          )}
          {isRefreshing && (
            <div className="flex items-center gap-1 text-blue-600">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span>Refreshing...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>Data for the last {timeRange}</span>
        </div>
      </div>
    </div>
  )
}