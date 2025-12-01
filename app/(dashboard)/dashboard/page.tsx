"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, TrendingUp, DollarSign, Globe, CreditCard } from "lucide-react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { AiCoachSlideout } from "@/components/ai-coach/ai-coach-slideout"
import { buildDashboardContext } from "@/lib/ai-coach/context-builder"
import { GoHighLevelClient, ClientMetrics } from "@/types/gohighlevel"
import { useEffect, useState } from "react"

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
  const [context, setContext] = useState<any>(null)

  useEffect(() => {
    if (user) {
      // Filter clients for current user
      const userClients = mockClients.filter((c) => c.affiliateUserId === user.id)
      const ctx = buildDashboardContext(user.id, userClients, mockMetrics)
      setContext(ctx)
    }
  }, [user])
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your workspace
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Blop
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Websites
            </CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Spend
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,234</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Subscriptions
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">
              2 renewals this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Properties
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              3 active listings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>
              Your most used blops and pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/board" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="font-medium">Flexboard</div>
              <div className="text-sm text-muted-foreground">View your workspace board</div>
            </Link>
            <Link href="/websites" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="font-medium">Websites & Tech Stack</div>
              <div className="text-sm text-muted-foreground">Manage your websites</div>
            </Link>
            <Link href="/subscriptions" className="block p-3 rounded-lg border hover:bg-accent transition-colors">
              <div className="font-medium">Subscriptions</div>
              <div className="text-sm text-muted-foreground">Track your subscriptions</div>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest updates across your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <p className="text-sm">Added new website</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <p className="text-sm">Updated subscription</p>
                  <p className="text-xs text-muted-foreground">5 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <p className="text-sm">Created new blop</p>
                  <p className="text-xs text-muted-foreground">1 day ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Coach Slideout */}
      {context && <AiCoachSlideout context={context} />}
    </div>
  )
}


