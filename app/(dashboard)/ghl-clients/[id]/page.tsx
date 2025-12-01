"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit, TrendingUp, Eye, UserPlus, DollarSign, Calendar } from "lucide-react"
import { GoHighLevelClient, ClientMetrics } from "@/types/gohighlevel"
import { Badge } from "@/components/ui/badge"

// Mock data - replace with API call
const mockClient: GoHighLevelClient = {
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
}

const mockMetrics: ClientMetrics = {
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
}

const planLabels: Record<string, string> = {
  starter: "Starter",
  professional: "Professional",
  agency: "Agency",
  enterprise: "Enterprise",
  custom: "Custom",
}

export default function GHLClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  
  // In real app, fetch client and metrics by id
  const client = mockClient
  const metrics = mockMetrics

  const viewsChange = metrics.currentWeek.views - metrics.lastWeek.views
  const leadsChange = metrics.currentWeek.leads - metrics.lastWeek.leads
  const revenueChange = (metrics.currentWeek.revenue || 0) - (metrics.lastWeek.revenue || 0)

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-muted-foreground">{client.company || client.email}</p>
          </div>
        </div>
        <Button>
          <Edit className="mr-2 h-4 w-4" />
          Edit Client
        </Button>
      </div>

      {/* Client Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{planLabels[client.subscriptionPlan]}</div>
            <Badge className="mt-2">{client.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm">{client.email}</div>
            {client.phone && <div className="text-sm text-muted-foreground">{client.phone}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Member Since</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(client.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Metrics */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Weekly Performance</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.currentWeek.views.toLocaleString()}</div>
              <p className={`text-xs ${viewsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {viewsChange >= 0 ? '+' : ''}{viewsChange} from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leads</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.currentWeek.leads}</div>
              <p className={`text-xs ${leadsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {leadsChange >= 0 ? '+' : ''}{leadsChange} from last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.currentWeek.conversions}</div>
              <p className="text-xs text-muted-foreground">
                {((metrics.currentWeek.conversions / metrics.currentWeek.leads) * 100).toFixed(1)}% conversion rate
              </p>
            </CardContent>
          </Card>

          {metrics.currentWeek.revenue && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${metrics.currentWeek.revenue.toLocaleString()}</div>
                <p className={`text-xs ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {revenueChange >= 0 ? '+' : ''}${revenueChange} from last week
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Monthly & All-Time Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>This Month</CardTitle>
            <CardDescription>Performance metrics for current month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Views</span>
              <span className="font-semibold">{metrics.thisMonth.views.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leads</span>
              <span className="font-semibold">{metrics.thisMonth.leads}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conversions</span>
              <span className="font-semibold">{metrics.thisMonth.conversions}</span>
            </div>
            {metrics.thisMonth.revenue && (
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-semibold text-lg">${metrics.thisMonth.revenue.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All-Time</CardTitle>
            <CardDescription>Total performance since client started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Views</span>
              <span className="font-semibold">{metrics.allTime.views.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Leads</span>
              <span className="font-semibold">{metrics.allTime.leads.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Conversions</span>
              <span className="font-semibold">{metrics.allTime.conversions.toLocaleString()}</span>
            </div>
            {metrics.allTime.revenue && (
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">Total Revenue</span>
                <span className="font-semibold text-lg">${metrics.allTime.revenue.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

