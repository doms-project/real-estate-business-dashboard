"use client"

import { useState, useEffect, useCallback } from 'react'

interface UseGHLDataOptions {
  endpoint: string
  locationId?: string
  pitToken?: string
  enabled?: boolean
  refreshInterval?: number
}

interface UseGHLDataResult<T = any> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useGHLData<T = any>({
  endpoint,
  locationId,
  pitToken,
  enabled = true,
  refreshInterval
}: UseGHLDataOptions): UseGHLDataResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      let url = `/api/ghl/data?endpoint=${endpoint}&pitToken=${pitToken || 'pit-18fcee5b-5b0c-48d1-84f6-f2f780f63ae6'}`
      if (locationId) {
        url += `&locationId=${locationId}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}: ${response.status}`)
      }

      const result = await response.json()
      setData(result.data || result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to load ${endpoint}`
      setError(errorMessage)
      console.error(`Error fetching ${endpoint}:`, err)
    } finally {
      setLoading(false)
    }
  }, [endpoint, locationId, pitToken, enabled])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Set up refresh interval if specified
  useEffect(() => {
    if (!refreshInterval || !enabled) return

    const interval = setInterval(() => {
      fetchData()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [fetchData, refreshInterval, enabled])

  return {
    data,
    loading,
    error,
    refetch
  }
}

// Specialized hooks for common endpoints
export function useLocations() {
  return useGHLData<GHLLocation[]>({ endpoint: 'locations', pitToken: 'pit-18fcee5b-5b0c-48d1-84f6-f2f780f63ae6' })
}

export function useContacts(locationId: string) {
  return useGHLData<GHLContact[]>({
    endpoint: 'contacts',
    locationId,
    pitToken: 'pit-18fcee5b-5b0c-48d1-84f6-f2f780f63ae6',
    enabled: !!locationId
  })
}

export function useOpportunities(locationId: string) {
  return useGHLData<GHLOpportunity[]>({
    endpoint: 'opportunities',
    locationId,
    pitToken: 'pit-18fcee5b-5b0c-48d1-84f6-f2f780f63ae6',
    enabled: !!locationId
  })
}

export function useConversations(locationId: string) {
  return useGHLData<GHLConversation[]>({
    endpoint: 'conversations',
    locationId,
    pitToken: 'pit-18fcee5b-5b0c-48d1-84f6-f2f780f63ae6',
    enabled: !!locationId
  })
}

// Type definitions
export interface GHLLocation {
  id: string
  name: string
  companyId: string
}

export interface GHLContact {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  createdAt?: string
  updatedAt?: string
}

export interface GHLOpportunity {
  id: string
  name: string
  status: string
  value?: number
  createdAt?: string
  updatedAt?: string
}

export interface GHLConversation {
  id: string
  contactId: string
  lastMessage?: string
  createdAt?: string
  updatedAt?: string
}
