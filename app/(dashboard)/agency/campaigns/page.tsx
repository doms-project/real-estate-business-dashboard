'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail, Eye, MousePointer, TrendingUp, AlertCircle, CheckCircle, Pause, Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Campaign {
  id: string
  name: string
  status: string
  locationId: string
  metrics: any
  details: any
  performance: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    unsubscribed: number
    complained: number
    openRate: string
    clickRate: string
    bounceRate: string
  }
}

interface Location {
  id: string
  name: string
  city: string
  state: string
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      setError(null)

      // First get all locations
      const locationsResponse = await fetch('/api/locations')
      const locationsData = await locationsResponse.json()

      if (!locationsData.success) {
        throw new Error('Failed to fetch locations')
      }

      setLocations(locationsData.locations)

      // Fetch campaigns for all locations
      const campaignPromises = locationsData.locations.map(async (location: Location) => {
        try {
          const response = await fetch(`/api/ghl/campaigns?locationId=${location.id}`)
          const data = await response.json()
          return data.success ? data.campaigns : []
        } catch (error) {
          console.error(`Failed to fetch campaigns for ${location.name}:`, error)
          return []
        }
      })

      const allCampaigns = await Promise.all(campaignPromises)
      const flattenedCampaigns = allCampaigns.flat()

      setCampaigns(flattenedCampaigns)
    } catch (error) {
      console.error('Failed to fetch campaigns:', error)
      setError('Failed to load campaigns')
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />
      case 'draft':
        return <AlertCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Play className="h-4 w-4 text-blue-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.push('/agency')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campaign Analytics</h1>
            <p className="text-gray-600">Loading campaign data...</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-28"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.push('/agency')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campaign Analytics</h1>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaign Analytics</h1>
          <p className="text-gray-600">
            Marketing campaign performance across all locations
          </p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.push('/agency')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button onClick={fetchCampaigns} disabled={loading}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Campaign Summary */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.filter(c => c.status.toLowerCase() === 'active').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + (c.performance?.sent || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.length > 0
                ? (campaigns.reduce((sum, c) => sum + parseFloat(c.performance?.openRate || '0'), 0) / campaigns.length).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign List */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => {
          const location = locations.find(l => l.id === campaign.locationId)

          return (
            <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{campaign.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {location ? `${location.name} (${location.city}, ${location.state})` : 'Unknown Location'}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(campaign.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(campaign.status)}
                      {campaign.status}
                    </div>
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {campaign.performance?.sent?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Sent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {campaign.performance?.openRate || 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Open Rate</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-medium text-blue-600">
                        {campaign.performance?.opened?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Opens</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-purple-600">
                        {campaign.performance?.clicked?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Clicks</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-orange-600">
                        {campaign.performance?.clickRate || 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">CTR</div>
                    </div>
                  </div>

                  {/* Campaign Details */}
                  {campaign.details && Object.keys(campaign.details).length > 0 && (
                    <div className="pt-3 border-t">
                      <div className="text-xs text-muted-foreground space-y-1">
                        {campaign.details.type && (
                          <div>Type: {campaign.details.type}</div>
                        )}
                        {campaign.details.createdAt && (
                          <div>Created: {new Date(campaign.details.createdAt).toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {campaigns.length === 0 && (
        <Card className="p-12 text-center">
          <CardContent>
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Campaigns Found</h3>
            <p className="text-muted-foreground">
              No marketing campaigns found across your locations.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
