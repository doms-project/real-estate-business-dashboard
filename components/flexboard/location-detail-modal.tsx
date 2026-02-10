"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Target,
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  ExternalLink,
  Activity,
  Zap,
  Globe
} from "lucide-react"

interface LocationDetailModalProps {
  isOpen: boolean
  onClose: () => void
  locationId: string
  healthData?: any
}

interface DetailedMetrics {
  healthScore: any
  trends: any
  forecasts: any
  alerts: any[]
  benchmarks: any
}

export function LocationDetailModal({ isOpen, onClose, locationId, healthData }: LocationDetailModalProps) {
  const [detailedData, setDetailedData] = useState<DetailedMetrics | null>(null)
  const [loading, setLoading] = useState(false)

  const loadDetailedData = useCallback(async () => {
    setLoading(true)
    try {
      // Load comprehensive data for this location with error handling
      const apiCalls = [
        { name: 'health', url: `/api/health-scoring?locationIds=${locationId}` },
        { name: 'trends', url: `/api/trends?locationId=${locationId}` },
        { name: 'forecasts', url: `/api/forecasts?locationId=${locationId}` },
        { name: 'alerts', url: `/api/alerts?locationId=${locationId}&status=active` },
        { name: 'benchmarks', url: `/api/benchmarks?locationId=${locationId}` }
      ]

      const results: Record<string, any> = {}

      // Load each API with individual error handling
      for (const api of apiCalls) {
        try {
          const response = await fetch(api.url)
          if (response.ok) {
            results[api.name] = await response.json()
          } else {
            console.warn(`Failed to load ${api.name}: ${response.status}`)
            results[api.name] = { data: null, error: `HTTP ${response.status}` }
          }
        } catch (error) {
          console.warn(`Error loading ${api.name}:`, error)
          results[api.name] = { data: null, error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }

      setDetailedData({
        healthScore: results.health.data?.[0] || healthData,
        trends: results.trends.data,
        forecasts: results.forecasts.data,
        alerts: results.alerts.data || [],
        benchmarks: results.benchmarks.data
      })

      console.log('API Results:', results) // Debug log
    } catch (error) {
      console.error('Error loading detailed data:', error)
      // Set fallback data even if loading fails
      setDetailedData({
        healthScore: healthData,
        trends: null,
        forecasts: null,
        alerts: [],
        benchmarks: null
      })
    } finally {
      setLoading(false)
    }
  }, [locationId, setDetailedData, setLoading, healthData])

  useEffect(() => {
    if (isOpen && locationId) {
      loadDetailedData()
    }
  }, [isOpen, locationId, loadDetailedData])

  if (!detailedData && !loading) return null

  const data = detailedData || { healthScore: healthData }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {locationId} - Performance Dashboard
            <Badge variant={
              data.healthScore?.health_status === 'healthy' ? 'default' :
              data.healthScore?.health_status === 'warning' ? 'secondary' : 'destructive'
            }>
              {data.healthScore?.overall_score?.toFixed(0)}% Health
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading detailed metrics...
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <OverviewTab data={data} />
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <PerformanceTab data={data} />
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <TrendsTab data={data} />
            </TabsContent>

            <TabsContent value="forecasts" className="space-y-6">
              <ForecastsTab data={data} />
            </TabsContent>

            <TabsContent value="alerts" className="space-y-6">
              <AlertsTab data={data} alerts={'alerts' in data ? data.alerts : []} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

function OverviewTab({ data }: { data: DetailedMetrics | { healthScore: any } }) {
  const health = data.healthScore
  if (!health) return <div>No data available</div>

  return (
    <div className="space-y-6">
      {/* Health Score Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Health Overview</span>
            <Badge variant={
              health.health_status === 'healthy' ? 'default' :
              health.health_status === 'warning' ? 'secondary' : 'destructive'
            }>
              {health.overall_score?.toFixed(1)}% - {health.health_status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {health.component_scores?.financial?.toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Financial</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {health.component_scores?.operational?.toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Operational</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {health.component_scores?.team?.toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Team</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {health.component_scores?.customer?.toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">Customer</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Overall Progress</span>
              <span>{health.confidence_level?.toFixed(0)}% confidence</span>
            </div>
            <Progress value={health.overall_score} className="h-3" />
          </div>

          {health.primary_issue && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Primary Issue:</strong> {health.primary_issue}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(health.current_revenue / 1000).toFixed(0)}K
            </div>
            <p className="text-xs text-muted-foreground">
              Target: ${(health.revenue_target / 1000).toFixed(0)}K
            </p>
            <Progress value={health.revenue_achievement_rate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.total_leads}</div>
            <p className="text-xs text-muted-foreground">
              {health.lead_change_percentage > 0 ? '+' : ''}{health.lead_change_percentage?.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(health.conversion_rate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {health.total_deals} conversions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.active_agents}/{health.total_agents}</div>
            <p className="text-xs text-muted-foreground">
              {health.agent_utilization_rate?.toFixed(0)}% utilization
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PerformanceTab({ data }: { data: DetailedMetrics | { healthScore: any } }) {
  const health = data.healthScore
  if (!health) return <div>No performance data available</div>

  return (
    <div className="space-y-6">
      {/* Component Scores Detail */}
      <Card>
        <CardHeader>
          <CardTitle>Component Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(health.component_scores || {}).map(([component, score]) => (
              <div key={component} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{component}</span>
                  <span>{(score as number).toFixed(1)}%</span>
                </div>
                <Progress value={score as number} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Financial Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Revenue Achievement</span>
              <span>{health.revenue_achievement_rate?.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Growth Momentum</span>
              <span>{health.revenue_growth_momentum?.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Cash Flow Predictability</span>
              <span>{health.cash_flow_predictability?.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Commission Velocity</span>
              <span>{health.commission_velocity_days} days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Efficiency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Response Time</span>
              <span>{health.response_time_performance} min</span>
            </div>
            <div className="flex justify-between">
              <span>Completion Rate</span>
              <span>{health.appointment_show_rate?.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Follow-up Rate</span>
              <span>{health.follow_up_completion_rate?.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Efficiency</span>
              <span>${health.lead_generation_efficiency?.toFixed(0)}/unit</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TrendsTab({ data }: { data: DetailedMetrics | { healthScore: any } }) {
  const trends = 'trends' in data ? data.trends : null
  if (!trends) return <div>No trend data available</div>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p>Advanced trend analysis visualization would be implemented here</p>
            <p className="text-sm text-muted-foreground mt-2">
              30-day, 90-day, and seasonal trend analysis with predictive indicators
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ForecastsTab({ data }: { data: DetailedMetrics | { healthScore: any } }) {
  const forecasts = 'forecasts' in data ? data.forecasts : null
  if (!forecasts) return <div>No forecast data available</div>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p>Predictive forecasting with scenario planning would be implemented here</p>
            <p className="text-sm text-muted-foreground mt-2">
              30/60/90 day forecasts with confidence intervals and risk assessment
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AlertsTab({ data, alerts }: { data: DetailedMetrics | { healthScore: any }, alerts: any[] }) {
  const alertsToShow = alerts || ('alerts' in data ? (data as DetailedMetrics).alerts : []) || []
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alertsToShow.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p>No active alerts</p>
              <p className="text-sm text-muted-foreground">All systems operating normally</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alertsToShow.map((alert) => (
                <Alert key={alert.id}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{alert.message}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Triggered {new Date(alert.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant={
                        alert.severity === 'critical' ? 'destructive' :
                        alert.severity === 'high' ? 'default' : 'secondary'
                      }>
                        {alert.severity}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}