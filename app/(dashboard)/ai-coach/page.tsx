import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { AiCoachPanel } from "@/components/ai-coach/ai-coach-panel"
import { buildDashboardContext } from "@/lib/ai-coach/context-builder"
import { GoHighLevelClient, ClientMetrics } from "@/types/gohighlevel"
import { runSupabaseQuery } from "@/lib/database"

async function fetchUserClients(userId: string): Promise<{ clients: GoHighLevelClient[], metrics: Record<string, ClientMetrics> }> {
  try {
    // Fetch GHL clients for this user
    const clientsQuery = `
      SELECT
        id,
        name,
        email,
        phone,
        company,
        subscription_plan,
        status,
        ghl_location_id,
        created_at,
        updated_at
      FROM ghl_clients
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC
    `
    const clientsData = await runSupabaseQuery(clientsQuery, [userId])

    // Convert to GoHighLevelClient format
    const clients: GoHighLevelClient[] = clientsData.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      subscriptionPlan: row.subscription_plan,
      affiliateUserId: userId,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: row.status,
    }))

    // Fetch metrics for these clients
    const metrics: Record<string, ClientMetrics> = {}
    for (const client of clients) {
      const metricsQuery = `
        SELECT
          week_start,
          week_end,
          views,
          leads,
          conversions,
          revenue
        FROM ghl_weekly_metrics
        WHERE client_id = $1
        ORDER BY week_start DESC
        LIMIT 4
      `
      const metricsData = await runSupabaseQuery(metricsQuery, [client.id])

      if (metricsData.length > 0) {
        // Get current and last week
        const currentWeek = metricsData.find((m: any) => {
          const now = new Date()
          const weekEnd = new Date(m.week_end)
          const weekStart = new Date(m.week_start)
          return now >= weekStart && now <= weekEnd
        }) || metricsData[0]

        const lastWeek = metricsData.find((m: any) => {
          const currentStart = new Date(currentWeek.week_start)
          const weekEnd = new Date(m.week_end)
          return weekEnd < currentStart
        }) || metricsData[1]

        // Calculate monthly totals (simplified - last 4 weeks)
        const monthlyMetrics = metricsData.slice(0, 4).reduce((acc: any, m: any) => ({
          views: acc.views + (m.views || 0),
          leads: acc.leads + (m.leads || 0),
          conversions: acc.conversions + (m.conversions || 0),
          revenue: acc.revenue + (parseFloat(m.revenue) || 0)
        }), { views: 0, leads: 0, conversions: 0, revenue: 0 })

        // Calculate all-time totals
        const allTimeMetrics = metricsData.reduce((acc: any, m: any) => ({
          views: acc.views + (m.views || 0),
          leads: acc.leads + (m.leads || 0),
          conversions: acc.conversions + (m.conversions || 0),
          revenue: acc.revenue + (parseFloat(m.revenue) || 0)
        }), { views: 0, leads: 0, conversions: 0, revenue: 0 })

        metrics[client.id] = {
          clientId: client.id,
          currentWeek: currentWeek ? {
            clientId: client.id,
            weekStart: currentWeek.week_start,
            weekEnd: currentWeek.week_end,
            views: currentWeek.views || 0,
            leads: currentWeek.leads || 0,
            conversions: currentWeek.conversions || 0,
            revenue: parseFloat(currentWeek.revenue) || 0,
          } : undefined,
          lastWeek: lastWeek ? {
            clientId: client.id,
            weekStart: lastWeek.week_start,
            weekEnd: lastWeek.week_end,
            views: lastWeek.views || 0,
            leads: lastWeek.leads || 0,
            conversions: lastWeek.conversions || 0,
            revenue: parseFloat(lastWeek.revenue) || 0,
          } : undefined,
          thisMonth: monthlyMetrics,
          allTime: allTimeMetrics,
        }
      }
    }

    return { clients, metrics }
  } catch (error) {
    console.error('Error fetching user clients and metrics:', error)
    // Return empty data on error - AI coach will handle gracefully
    return { clients: [], metrics: {} }
  }
}

export default async function AiCoachPage() {
  const user = await currentUser()
  if (!user) {
    redirect("/sign-in")
  }

  // Fetch real data from database with error handling
  let context
  try {
    const { clients, metrics } = await fetchUserClients(user.id)
    context = buildDashboardContext(user.id, clients, metrics)
  } catch (error) {
    console.error('Failed to load AI coach data:', error)
    // Fallback context with no data
    context = buildDashboardContext(user.id, [], {})
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Coach</h1>
        <p className="text-muted-foreground">
          Analyze your business, get reports, and stay on track
        </p>
      </div>

      <Card className="h-[calc(100vh-240px)] min-h-[600px]">
        <AiCoachPanel 
          initialContext={context}
          pageContext="ai-coach"
        />
      </Card>
    </div>
  )
}

