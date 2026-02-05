"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Calendar, DollarSign, Trash2, Edit, Check, X } from "lucide-react"
import { SaveButton } from "@/components/ui/save-button"
import { useUser } from "@clerk/nextjs"

interface Subscription {
  id: string
  name: string
  cost: number
  period: "monthly" | "annual"
  renewalDate: string
  category: string
  website?: string
}

export default function SubscriptionsPage() {
  const { user } = useUser()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hasLoadedFromDB, setHasLoadedFromDB] = useState(false)

  // Load subscriptions from database on mount
  useEffect(() => {
    async function loadSubscriptions() {
      if (!user) return

      try {
        const response = await fetch('/api/subscriptions')
        if (response.ok) {
          const data = await response.json()
          setHasLoadedFromDB(true)

          // Always set subscriptions from database, even if empty
          const loadedSubscriptions: Subscription[] = data.subscriptions ? data.subscriptions.map((s: any) => ({
            id: s.id,
            name: s.name,
            cost: parseFloat(s.cost) || 0,
            period: s.period,
            renewalDate: s.renewal_date,
            category: s.category,
            website: s.website_id || undefined,
            websiteId: s.website_id || undefined, // Also store as websiteId for consistency
          })) : []

          setSubscriptions(loadedSubscriptions)
        }
      } catch (error) {
        console.error('Failed to load subscriptions:', error)
        setHasLoadedFromDB(true)
      }
    }

    loadSubscriptions()
  }, [user])

  const handleSave = async () => {
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptions: subscriptions.map(sub => ({
            ...sub,
            renewal_date: sub.renewalDate, // Convert to snake_case
            website_id: sub.website, // Use the correct property name
          })),
          workspaceId: null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Notify other pages that subscriptions have been updated
        window.dispatchEvent(new CustomEvent('subscriptionUpdated'))
        return // Success - SaveButton will show success state
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save subscriptions')
      }
    } catch (error: any) {
      console.error('Error saving subscriptions:', error)
      throw error // Re-throw so SaveButton can handle it
    }
  }

  const handleAddSubscription = () => {
    const newSubscription: Subscription = {
      id: Date.now().toString(),
      name: "",
      cost: 0,
      period: "monthly",
      renewalDate: new Date().toISOString().split('T')[0], // Today's date
      category: "",
      website: "",
    }
    setSubscriptions([...subscriptions, newSubscription])
    setEditingId(newSubscription.id) // Start editing the new one
  }

  const handleEditSubscription = (id: string) => {
    setEditingId(editingId === id ? null : id)
  }

  const handleRemoveSubscription = async (id: string) => {
    if (!confirm('Are you sure you want to remove this subscription?')) {
      return
    }

    try {
      const response = await fetch(`/api/subscriptions?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove from local state after successful deletion
        setSubscriptions(subscriptions.filter(sub => sub.id !== id))
        // Notify other pages that subscriptions have been updated
        window.dispatchEvent(new CustomEvent('subscriptionUpdated'))
      } else {
        const error = await response.json()
        alert(`Failed to delete subscription: ${error.error}`)
      }
    } catch (error: any) {
      console.error('Error deleting subscription:', error)
      alert('Failed to delete subscription. Please try again.')
    }
  }

  const updateSubscription = (id: string, updates: Partial<Subscription>) => {
    setSubscriptions(subscriptions.map(sub => sub.id === id ? { ...sub, ...updates } : sub))
  }

  const totalMonthly = subscriptions.reduce((sum, sub) => sum + sub.cost, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Track and manage your subscriptions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SaveButton onSave={handleSave} />
          <Button onClick={handleAddSubscription}>
            <Plus className="mr-2 h-4 w-4" />
            Add Subscription
          </Button>
        </div>
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
                <div className="flex-1">
                  {editingId === subscription.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Name</label>
                          <Input
                            value={subscription.name}
                            onChange={(e) => updateSubscription(subscription.id, { name: e.target.value })}
                            placeholder="Subscription name"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Category</label>
                          <Input
                            value={subscription.category}
                            onChange={(e) => updateSubscription(subscription.id, { category: e.target.value })}
                            placeholder="e.g. Software, Hosting"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Cost</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={subscription.cost}
                            onChange={(e) => updateSubscription(subscription.id, { cost: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Period</label>
                          <Select
                            value={subscription.period}
                            onValueChange={(value: "monthly" | "annual") => updateSubscription(subscription.id, { period: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Renewal Date</label>
                          <Input
                            type="date"
                            value={subscription.renewalDate}
                            onChange={(e) => updateSubscription(subscription.id, { renewalDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            // Auto-save when done editing
                            try {
                              await handleSave()
                              setEditingId(null)
                            } catch (error) {
                              console.error('Failed to save:', error)
                              // Still allow closing edit mode even if save fails
                              setEditingId(null)
                            }
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Save & Done
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <CardTitle>{subscription.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {subscription.category} • {subscription.website || 'No website'}
                      </CardDescription>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingId !== subscription.id && (
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        ${subscription.cost.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        /{subscription.period}
                      </div>
                    </div>
                  )}
                  {editingId !== subscription.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSubscription(subscription.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSubscription(subscription.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {editingId !== subscription.id && (
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Renews on {new Date(subscription.renewalDate).toLocaleDateString()}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}