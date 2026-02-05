export interface GoHighLevelClient {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  subscriptionPlan: SubscriptionPlan
  affiliateUserId?: string // User who referred this client
  createdAt: string
  updatedAt: string
  status: "active" | "inactive" | "cancelled"
  ghlLocationId?: string // GoHighLevel location ID
  ghlApiKey?: string // Encrypted API key
}

export type SubscriptionPlan = 
  | "starter"
  | "professional"
  | "agency"
  | "enterprise"
  | "custom"

export interface SubscriptionDetails {
  plan: SubscriptionPlan
  monthlyPrice: number
  features: string[]
  maxLocations?: number
  maxUsers?: number
}

export interface WeeklyMetrics {
  clientId: string
  weekStart: string // ISO date string
  weekEnd: string
  views: number
  leads: number
  conversions: number
  revenue?: number
}

export interface ClientMetrics {
  clientId: string
  currentWeek?: WeeklyMetrics
  lastWeek?: WeeklyMetrics
  thisMonth: {
    views: number
    leads: number
    conversions: number
    revenue?: number
  }
  allTime: {
    views: number
    leads: number
    conversions: number
    revenue?: number
  }
}

export interface AffiliateStats {
  userId: string
  totalClients: number
  activeClients: number
  totalRevenue: number
  monthlyRecurringRevenue: number
  thisMonth: {
    newClients: number
    views: number
    leads: number
    conversions: number
  }
}

