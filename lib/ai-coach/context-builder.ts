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
            weekStart: metrics.currentWeek.weekStart,
            views: metrics.currentWeek.views,
            leads: metrics.currentWeek.leads,
            conversions: metrics.currentWeek.conversions,
            revenue: metrics.currentWeek.revenue,
          })
        }

        // Add last week
        if (metrics?.lastWeek) {
          clientMetrics.push({
            weekStart: metrics.lastWeek.weekStart,
            views: metrics.lastWeek.views,
            leads: metrics.lastWeek.leads,
            conversions: metrics.lastWeek.conversions,
            revenue: metrics.lastWeek.revenue,
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

