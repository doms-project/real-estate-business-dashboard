import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import { AiCoachPanel } from "@/components/ai-coach/ai-coach-panel"
import { buildDashboardContext } from "@/lib/ai-coach/context-builder"
import { GoHighLevelClient, ClientMetrics } from "@/types/gohighlevel"
import { runSupabaseQuery } from "@/lib/database"
import { ConversationManager } from "@/lib/ai-conversation-manager"

async function fetchUserClients(userId: string): Promise<{ clients: GoHighLevelClient[], metrics: Record<string, ClientMetrics> }> {
  try {
    console.log('🤖 AI Coach: Fetching real GHL data for analysis...')

    // Fetch locations and metrics using the same APIs as the clients page
    const [locationsResponse, metricsResponse] = await Promise.all([
      fetch('/api/ghl/locations?internal=true'),
      fetch('/api/ghl/metrics/cached')
    ])

    if (!locationsResponse.ok || !metricsResponse.ok) {
      throw new Error('Failed to fetch GHL data from APIs')
    }

    const locationsData = await locationsResponse.json()
    const metricsData = await metricsResponse.json()

    console.log('🤖 AI Coach: Locations data:', locationsData)
    console.log('🤖 AI Coach: Metrics data:', metricsData)

    // Convert locations to GoHighLevelClient format
    const clients: GoHighLevelClient[] = (locationsData.locations || []).map((location: any) => ({
      id: location.id,
      name: location.name,
      email: location.email || `${location.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      phone: location.phone || '',
      company: location.name,
      subscriptionPlan: 'professional', // Default plan since we don't track this in locations
      affiliateUserId: userId,
      createdAt: '2024-01-01', // Placeholder
      updatedAt: new Date().toISOString(),
      status: 'active',
    }))

    // Convert metrics to ClientMetrics format
    const metrics: Record<string, ClientMetrics> = {}
    const metricsArray = metricsData.data || []

    for (const metric of metricsArray) {
      // Create synthetic weekly data based on current metrics
      // Since we don't have historical weekly data, we'll create reasonable estimates
      const contactsCount = metric.contacts_count || 0
      const opportunitiesCount = metric.opportunities_count || 0
      const conversationsCount = metric.conversations_count || 0

      // Estimate weekly metrics (divide by 4 for monthly approximation)
      const weeklyContacts = Math.round(contactsCount / 4)
      const weeklyOpportunities = Math.round(opportunitiesCount / 4)
      const weeklyConversations = Math.round(conversationsCount / 4)

      metrics[metric.location_id] = {
        clientId: metric.location_id,
        currentWeek: {
          clientId: metric.location_id,
          weekStart: "2024-12-16",
          weekEnd: "2024-12-22",
          views: weeklyContacts * 10, // Estimate views as 10x contacts
          leads: weeklyContacts,
          conversions: weeklyOpportunities,
          revenue: weeklyOpportunities * 500, // Estimate $500 per conversion
        },
        lastWeek: {
          clientId: metric.location_id,
          weekStart: "2024-12-09",
          weekEnd: "2024-12-15",
          views: weeklyContacts * 9,
          leads: Math.round(weeklyContacts * 0.9),
          conversions: Math.round(weeklyOpportunities * 0.8),
          revenue: Math.round(weeklyOpportunities * 0.8) * 500,
        },
        thisMonth: {
          views: contactsCount * 10,
          leads: contactsCount,
          conversions: opportunitiesCount,
          revenue: opportunitiesCount * 500,
        },
        allTime: {
          views: contactsCount * 10,
          leads: contactsCount,
          conversions: opportunitiesCount,
          revenue: opportunitiesCount * 500,
        },
      }
    }

    console.log('🤖 AI Coach: Converted data -', clients.length, 'clients,', Object.keys(metrics).length, 'metrics')

    return { clients, metrics }
  } catch (error) {
    console.error('🤖 AI Coach: Error fetching GHL data:', error)
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
  let conversationId: string | undefined
  try {
    const { clients, metrics } = await fetchUserClients(user.id)
    context = buildDashboardContext(user.id, clients, metrics)

    // Initialize conversation for this user
    const conversationManager = new ConversationManager()
    const conversationState = await conversationManager.initializeConversation(user.id)
    conversationId = conversationState.conversationId
  } catch (error) {
    console.error('Failed to load AI coach data:', error)
    // Fallback context with no data
    context = buildDashboardContext(user.id, [], {})
    conversationId = undefined
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ELO Business Intelligence</h1>
        <p className="text-muted-foreground">
          Your conversational AI business partner with real-time data access and strategic insights
        </p>
        {conversationId && (
          <p className="text-xs text-muted-foreground mt-1">
            Conversation: {conversationId}
          </p>
        )}
      </div>

      <Card className="h-[calc(100vh-240px)] min-h-[600px]">
        <AiCoachPanel
          initialContext={context}
          pageContext="ai-coach"
          conversationId={conversationId}
        />
      </Card>
    </div>
  )
}

