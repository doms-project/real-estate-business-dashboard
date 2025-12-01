"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, Eye, UserPlus, TrendingUp } from "lucide-react"
import { GoHighLevelClient, ClientMetrics, SubscriptionPlan } from "@/types/gohighlevel"
import { Badge } from "@/components/ui/badge"

const planColors: Record<SubscriptionPlan, string> = {
  starter: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  professional: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  agency: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  enterprise: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  custom: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
}

const planLabels: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  professional: "Professional",
  agency: "Agency",
  enterprise: "Enterprise",
  custom: "Custom",
}

interface GHLClientCardProps {
  client: GoHighLevelClient
  metrics?: ClientMetrics
  onEdit: () => void
}

export function GHLClientCard({ client, metrics, onEdit }: GHLClientCardProps) {
  const statusColor = client.status === "active" 
    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    : client.status === "inactive"
    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Link href={`/ghl-clients/${client.id}`}>
              <CardTitle className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
                {client.name}
                <Badge className={statusColor}>{client.status}</Badge>
              </CardTitle>
            </Link>
            <CardDescription className="mt-1">
              {client.company || client.email}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscription Plan */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Subscription</span>
            <Badge className={planColors[client.subscriptionPlan]}>
              {planLabels[client.subscriptionPlan]}
            </Badge>
          </div>
        </div>

        {/* Weekly Metrics */}
        {metrics && (
          <div className="space-y-3 pt-3 border-t">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              This Week
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg font-semibold">{metrics.currentWeek.views.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Views</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg font-semibold">{metrics.currentWeek.leads}</div>
                  <div className="text-xs text-muted-foreground">Leads</div>
                </div>
              </div>
            </div>
            {metrics.currentWeek.revenue && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg font-semibold">${metrics.currentWeek.revenue.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Revenue</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contact Info */}
        <div className="pt-3 border-t space-y-1">
          {client.email && (
            <div className="text-sm">
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="text-sm">
              <span className="text-muted-foreground">Phone: </span>
              <span className="font-medium">{client.phone}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

