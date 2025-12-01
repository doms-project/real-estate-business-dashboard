import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Calendar, DollarSign } from "lucide-react"

export default function SubscriptionsPage() {
  const subscriptions = [
    {
      id: "1",
      name: "Netflix",
      cost: 15.99,
      period: "monthly",
      renewalDate: "2024-02-15",
      category: "Entertainment",
      website: "example.com",
    },
    {
      id: "2",
      name: "Adobe Creative Cloud",
      cost: 52.99,
      period: "monthly",
      renewalDate: "2024-02-20",
      category: "Software",
      website: "another.com",
    },
    {
      id: "3",
      name: "Vercel Pro",
      cost: 20,
      period: "monthly",
      renewalDate: "2024-02-10",
      category: "Hosting",
      website: "example.com",
    },
  ]

  const totalMonthly = subscriptions.reduce((sum, sub) => sum + sub.cost, 0)

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Track and manage your subscriptions
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Subscription
        </Button>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spend</CardTitle>
          <CardDescription>Total cost of all active subscriptions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            {totalMonthly.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions List */}
      <div className="space-y-4">
        {subscriptions.map((subscription) => (
          <Card key={subscription.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{subscription.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {subscription.category} • {subscription.website}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    ${subscription.cost.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    /{subscription.period}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Renews on {new Date(subscription.renewalDate).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}


