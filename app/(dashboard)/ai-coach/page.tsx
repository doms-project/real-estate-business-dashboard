import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { AiCoachPanel } from "@/components/ai-coach/ai-coach-panel"
import { buildDashboardContext } from "@/lib/ai-coach/context-builder"
import { GoHighLevelClient, ClientMetrics } from "@/types/gohighlevel"

// Mock data - replace with real database queries
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

export default async function AiCoachPage() {
  const user = await currentUser()

  if (!user) {
    redirect("/sign-in")
  }

  // Build context from user's data
  // In production, fetch from database filtered by user.id
  const userClients = mockClients.filter((c) => c.affiliateUserId === user.id)
  const context = buildDashboardContext(user.id, userClients, mockMetrics)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Coach</h1>
        <p className="text-muted-foreground">
          Analyze your business, get reports, and stay on track
        </p>
      </div>

      <Card className="h-[calc(100vh-280px)]">
        <AiCoachPanel 
          initialContext={context}
          pageContext="ai-coach"
        />
      </Card>
    </div>
  )
}

