"use client"

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, MapPin } from 'lucide-react'

export interface GHLLocation {
  id: string
  name: string
  companyId: string
}

interface LocationSelectorProps {
  onLocationChange: (location: GHLLocation | null) => void
  selectedLocation?: GHLLocation | null
  className?: string
}

export function LocationSelector({
  onLocationChange,
  selectedLocation,
  className = ""
}: LocationSelectorProps) {
  const [locations, setLocations] = useState<GHLLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/ghl/data?endpoint=locations')

        if (!response.ok) {
          throw new Error(`Failed to fetch locations: ${response.status}`)
        }

        const data = await response.json()

        if (data.data && Array.isArray(data.data)) {
          setLocations(data.data)
        } else {
          setLocations([])
        }
      } catch (err) {
        console.error('Error fetching locations:', err)
        setError(err instanceof Error ? err.message : 'Failed to load locations')
        setLocations([])
      } finally {
        setLoading(false)
      }
    }

    fetchLocations()
  }, [])

  const handleLocationChange = (locationId: string) => {
    if (locationId === 'all') {
      onLocationChange(null)
    } else {
      const location = locations.find(loc => loc.id === locationId)
      onLocationChange(location || null)
    }
  }

  if (error) {
    return (
      <Card className={`border-destructive ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-destructive" />
            Location Selector
          </CardTitle>
          <CardDescription className="text-destructive text-xs">
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Select Location
        </CardTitle>
        <CardDescription className="text-xs">
          Choose a real estate business to view data for
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={selectedLocation?.id || 'all'}
          onValueChange={handleLocationChange}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading locations..." : "Select a location"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                All Locations ({locations.length})
              </div>
            </SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {location.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedLocation && (
          <div className="mt-3 p-2 bg-muted rounded-md">
            <p className="text-xs font-medium">{selectedLocation.name}</p>
            <p className="text-xs text-muted-foreground">ID: {selectedLocation.id}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
