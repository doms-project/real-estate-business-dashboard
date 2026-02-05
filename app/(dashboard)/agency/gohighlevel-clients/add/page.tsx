'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface LocationFormData {
  id: string
  pitToken: string
  name: string
  address: string
}

export default function AddGHLLocationPage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<LocationFormData>({
    id: '',
    pitToken: '',
    name: '',
    address: ''
  })

  const [isFetchingDetails, setIsFetchingDetails] = useState(false)
  const [detailsFetched, setDetailsFetched] = useState(false)

  const handleInputChange = (field: keyof LocationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const fetchBusinessDetails = async () => {
    if (!formData.id || !formData.pitToken) {
      toast.error('Please enter both Location ID and PIT Token')
      return
    }

    setIsFetchingDetails(true)
    try {
      console.log('Fetching business details for location:', formData.id)

      // Call our internal API to fetch location details from GHL
      const response = await fetch(`/api/ghl/data?endpoint=locations&locationId=${formData.id}&pitToken=${formData.pitToken}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to fetch business details: ${response.status}`)
      }

      const data = await response.json()
      console.log('Fetched business data:', data)

      // Extract business information from the API response
      // API returns: { data: { location: { ... } } }
      const location = data.data?.location || data.location || data

      // Auto-populate essential form fields with fetched data
      setFormData(prev => ({
        ...prev,
        name: location.business?.name || location.name || prev.name,
        address: location.business?.address || location.address || prev.address
      }))

      setDetailsFetched(true)
      toast.success('Business details fetched successfully!')

    } catch (error) {
      console.error('Error fetching business details:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch business details')
    } finally {
      setIsFetchingDetails(false)
    }
  }


  const saveLocation = async () => {
    // Validate required fields
    if (!formData.id || !formData.pitToken) {
      toast.error('Please enter Location ID and PIT Token')
      return
    }

    if (!detailsFetched) {
      toast.error('Please fetch business details before saving')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/ghl/locations/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Location added successfully!')
        router.push('/agency/gohighlevel-clients')
      } else {
        toast.error(result.error || 'Failed to add location')
      }
    } catch (error) {
      toast.error('Failed to save location')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/agency/gohighlevel-clients')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Locations
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New GHL Client</h1>
          <p className="text-gray-600">Add a new GoHighLevel location to your dashboard</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New GHL Client</CardTitle>
          <CardDescription>
            Enter your GHL Location ID and PIT Token, then fetch business name and address automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="locationId">Location ID *</Label>
                <Input
                  id="locationId"
                  placeholder="Enter GHL Location ID"
                  value={formData.id}
                  onChange={(e) => handleInputChange('id', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pitToken">PIT Token *</Label>
                <Input
                  id="pitToken"
                  type="password"
                  placeholder="Enter PIT Token"
                  value={formData.pitToken}
                  onChange={(e) => handleInputChange('pitToken', e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={fetchBusinessDetails}
                disabled={isFetchingDetails || !formData.id || !formData.pitToken}
                className="flex-1"
              >
                {isFetchingDetails ? (
                  <span>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Details...
                  </span>
                ) : (
                  <span>
                    <Plus className="mr-2 h-4 w-4" />
                    Fetch Business Details
                  </span>
                )}
              </Button>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Business Details</h3>
              {detailsFetched ? (
                <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-800">Business Details Fetched Successfully</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-gray-700 min-w-[60px]">Name:</span>
                      <span className="text-gray-900">{formData.name}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-gray-700 min-w-[60px]">Address:</span>
                      <span className="text-gray-900">{formData.address}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  Enter Location ID and PIT Token above, then click &quot;Fetch Business Details&quot; to retrieve business information.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => router.push('/agency/gohighlevel-clients')}
            >
              Cancel
            </Button>
            <Button
              onClick={saveLocation}
              disabled={isSaving || !formData.id || !formData.pitToken || !detailsFetched}
            >
              {isSaving ? (
                <span>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Location...
                </span>
              ) : (
                <span>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Location
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
