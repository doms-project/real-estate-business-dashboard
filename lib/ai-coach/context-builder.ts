/**
 * Utilities for building context data for AI Coach
 * Summarizes business data to send to the AI
 */

import { GoHighLevelClient, ClientMetrics } from "@/types/gohighlevel"

export interface BusinessContext {
  userId: string
  summary: {
    clients: Array<{
      name: string
      plan: string
      status: string
      metrics: Array<{
        weekStart: string
        views: number
        leads: number
        conversions?: number
        revenue?: number
      }>
    }>
    goals?: Array<{
      label: string
      progress: number
    }>
    subscriptions?: Array<{
      name: string
      cost: number
      period: string
    }>
  }
  // Additional properties for conversation manager
  properties?: number
  totalIncome?: number
  avgRent?: number
  clients?: number
  activeClients?: number
  totalClientRevenue?: number
  avgClientRevenue?: number
  locations?: number
  totalContacts?: number
  totalOpportunities?: number
  totalConversations?: number
  avgConversionRate?: number
  websites?: number
  liveWebsites?: number
  subscriptions?: number
  subscriptionRevenue?: number
  pendingWorkRequests?: number
  maintenanceCost?: number
  clientBreakdown?: any[]
  locationBreakdown?: any[]
  allLocations?: any[]
  totalLocations?: number
  currentLocationMetrics?: any[]
  weeklyMetrics?: any[]
  revenueBreakdown?: {
    properties: number
    clients: number
    subscriptions: number
    total: number
  }
  location?: string
}

/**
 * Build context from clients and metrics
 * Returns last 4 weeks of data per client
 */
export function buildBusinessContext(
  userId: string,
  clients: GoHighLevelClient[],
  metricsMap: Record<string, ClientMetrics>,
  options?: {
    includeSubscriptions?: boolean
    includeGoals?: boolean
  }
): BusinessContext {
  const context: BusinessContext = {
    userId,
    summary: {
      clients: clients.map((client) => {
        const metrics = metricsMap[client.id]
        const clientMetrics = []

        // Add current week
        if (metrics?.currentWeek) {
          clientMetrics.push({
            weekStart: metrics.currentWeek.weekStart || "2024-12-16",
            views: metrics.currentWeek.views || 0,
            leads: metrics.currentWeek.leads || 0,
            conversions: metrics.currentWeek.conversions || 0,
            revenue: metrics.currentWeek.revenue || 0,
          })
        }

        // Add last week
        if (metrics?.lastWeek) {
          clientMetrics.push({
            weekStart: metrics.lastWeek.weekStart || "2024-12-09",
            views: metrics.lastWeek.views || 0,
            leads: metrics.lastWeek.leads || 0,
            conversions: metrics.lastWeek.conversions || 0,
            revenue: metrics.lastWeek.revenue || 0,
          })
        }

        return {
          name: client.name,
          plan: client.subscriptionPlan,
          status: client.status,
          metrics: clientMetrics.slice(0, 4), // Last 4 weeks max
        }
      }),
    },
  }

  // Add subscriptions if requested
  if (options?.includeSubscriptions) {
    // This would come from your subscriptions data
    context.summary.subscriptions = []
  }

  // Add goals if requested
  if (options?.includeGoals) {
    // This would come from your goals data
    context.summary.goals = []
  }

  return context
}

/**
 * Build context for agency-specific view
 */
export function buildAgencyContext(
  userId: string,
  agencyClients: GoHighLevelClient[],
  metricsMap: Record<string, ClientMetrics>
): BusinessContext {
  return buildBusinessContext(userId, agencyClients, metricsMap, {
    includeSubscriptions: false,
    includeGoals: false,
  })
}

/**
 * Build context for dashboard/global view
 */
export function buildDashboardContext(
  userId: string,
  allClients: GoHighLevelClient[],
  metricsMap: Record<string, ClientMetrics>
): BusinessContext {
  return buildBusinessContext(userId, allClients, metricsMap, {
    includeSubscriptions: true,
    includeGoals: true,
  })
}

