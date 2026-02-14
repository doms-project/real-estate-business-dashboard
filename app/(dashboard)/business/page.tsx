"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, DollarSign, Users, Target, Plus, Trash2, RefreshCw, Edit, Save, X, Building2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useWorkspace } from "@/components/workspace-context"
import { subscribeToUpdates } from "@/lib/realtime-updates"

interface Campaign {
  id: string
  name: string
  status: string
  budget: string
  spent: string
  impressions: string
  clicks: string
  conversions: string
  roas: string
  business_id?: string
  user_id?: string
  ghl_campaign_id?: string
  platform?: string
  currency?: string
  ctr?: number
  cpc?: number
  cpa?: number
  start_date?: string
  end_date?: string
  target_audience?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

interface Business {
  id: string
  user_id: string
  name: string
  description?: string
  type: string
  campaigns: Campaign[]
  created_at: string
  updated_at: string
}

interface EditableCampaign extends Campaign {
  // Additional properties for editing
  isEditing?: boolean
  originalData?: Partial<EditableCampaign>
}

interface EditableBusiness extends Omit<Business, 'campaigns'> {
  campaigns: EditableCampaign[]
}

export default function BusinessPage() {
  const { user } = useUser()
  const { currentWorkspace } = useWorkspace()
  const [churchBusiness, setChurchBusiness] = useState<EditableBusiness | null>(null)
  const [realEstateBusiness, setRealEstateBusiness] = useState<EditableBusiness | null>(null)
  const [marketingBusiness, setMarketingBusiness] = useState<EditableBusiness | null>(null)
  const [marketingBusinesses, setMarketingBusinesses] = useState<EditableBusiness[]>([])
  const [kpis, setKpis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncLoading, setSyncLoading] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [savingCampaigns, setSavingCampaigns] = useState<Set<string>>(new Set())
  const [editingBusinessId, setEditingBusinessId] = useState<string | null>(null)
  const [inlineEditingField, setInlineEditingField] = useState<string | null>(null)
  const [savingStatus, setSavingStatus] = useState<{[businessId: string]: 'saving' | 'saved' | null}>({})

  // Fetch businesses, campaigns, and KPIs on mount and when workspace changes
  useEffect(() => {
    if (user && currentWorkspace?.id) {
      fetchBusinesses()
      fetchKPIs()

      // Subscribe to real-time business updates
      const unsubscribe = subscribeToUpdates('businesses', (update) => {
        console.log('🏢 Real-time business update:', update)
        if (update.type === 'business_created' || update.type === 'business_updated' || update.type === 'business_deleted') {
          // Refresh businesses when there's a change
          fetchBusinesses()
        }
      })

      return unsubscribe
    }
  }, [user, currentWorkspace?.id])

  const fetchBusinesses = async () => {
    try {
      console.log('🔄 Fetching businesses for workspace:', currentWorkspace?.id)
      setLoading(true)
      const response = await fetch(`/api/business?workspaceId=${currentWorkspace?.id}`)
      const data = await response.json()
      console.log('📊 Businesses API response:', data)

      if (data.success && data.businesses) {
        // Organize businesses by type and format campaign data
        const formatCampaigns = (campaigns: any[]): EditableCampaign[] => {
          return campaigns.map(campaign => ({
            id: campaign.id,
            business_id: campaign.business_id,
            user_id: campaign.user_id,
            ghl_campaign_id: campaign.ghl_campaign_id,
            name: campaign.name,
            status: campaign.status,
            platform: campaign.platform,
            budget: campaign.budget ? campaign.budget.toString() : '0',
            spent: campaign.spent ? campaign.spent.toString() : '0',
            currency: campaign.currency,
            impressions: campaign.impressions,
            clicks: campaign.clicks,
            conversions: campaign.conversions,
            ctr: campaign.ctr,
            cpc: campaign.cpc,
            cpa: campaign.cpa,
            roas: campaign.roas ? `${Number(campaign.roas).toFixed(1)}x` : '0x',
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            target_audience: campaign.target_audience,
            notes: campaign.notes,
            created_at: campaign.created_at,
            updated_at: campaign.updated_at,
            isEditing: false
          }))
        }

        // Organize businesses by type
        console.log('📊 Organizing businesses by type. Total businesses:', data.businesses?.length || 0)
        data.businesses?.forEach((b: any) => console.log(`  - ${b.name} (${b.id}) - type: ${b.type}, workspace: ${b.workspace_id}`))

        const churchBusinesses = data.businesses.filter((b: any) => b.type === 'church')
        const realEstateBusinesses = data.businesses.filter((b: any) => b.type === 'real_estate')
        const marketingBusinessList = data.businesses.filter((b: any) => b.type === 'marketing')

        console.log(`📊 Filtered: ${churchBusinesses.length} church, ${realEstateBusinesses.length} real estate, ${marketingBusinessList.length} marketing`)

        // Set single businesses for church and real estate (first one found)
        setChurchBusiness(churchBusinesses.length > 0 ? {
          id: churchBusinesses[0].id,
          user_id: churchBusinesses[0].user_id,
          name: churchBusinesses[0].name,
          description: churchBusinesses[0].description,
          type: churchBusinesses[0].type,
          campaigns: formatCampaigns(churchBusinesses[0].campaigns || []),
          created_at: churchBusinesses[0].created_at,
          updated_at: churchBusinesses[0].updated_at
        } : null)

        setRealEstateBusiness(realEstateBusinesses.length > 0 ? {
          id: realEstateBusinesses[0].id,
          user_id: realEstateBusinesses[0].user_id,
          name: realEstateBusinesses[0].name,
          description: realEstateBusinesses[0].description,
          type: realEstateBusinesses[0].type,
          campaigns: formatCampaigns(realEstateBusinesses[0].campaigns || []),
          created_at: realEstateBusinesses[0].created_at,
          updated_at: realEstateBusinesses[0].updated_at
        } : null)

        // Set all marketing businesses as array
        const formattedMarketingBusinesses = marketingBusinessList.map((business: any) => ({
          id: business.id,
          user_id: business.user_id,
          name: business.name,
          description: business.description,
          type: business.type,
          campaigns: formatCampaigns(business.campaigns || []),
          created_at: business.created_at,
          updated_at: business.updated_at
        }))

        console.log('🏢 Setting businesses:', {
          churchCount: churchBusinesses.length,
          realEstateCount: realEstateBusinesses.length,
          marketingCount: formattedMarketingBusinesses.length
        })

        // Preserve existing businesses that might be missing from API response
        // This prevents businesses from disappearing due to API issues or filtering
        const preserveMissingBusinesses = (existingBusinesses: EditableBusiness[], fetchedBusinesses: EditableBusiness[], type: string) => {
          const fetchedIds = new Set(fetchedBusinesses.map(b => b.id))
          const missingBusinesses = existingBusinesses.filter(b => !fetchedIds.has(b.id) && !b.id.startsWith('temp-'))

          if (missingBusinesses.length > 0) {
            console.warn(`⚠️ Preserving ${missingBusinesses.length} ${type} businesses that were not returned by API:`, missingBusinesses.map(b => b.id))
            return [...fetchedBusinesses, ...missingBusinesses]
          }

          return fetchedBusinesses
        }

        // Apply preservation logic
        let finalChurchBusiness = churchBusinesses.length > 0 ? churchBusinesses[0] : null
        if (churchBusiness && !finalChurchBusiness) {
          console.warn('⚠️ Preserving existing church business that was not returned by API:', churchBusiness.id)
          finalChurchBusiness = churchBusiness
        }

        let finalRealEstateBusiness = realEstateBusinesses.length > 0 ? realEstateBusinesses[0] : null
        if (realEstateBusiness && !finalRealEstateBusiness) {
          console.warn('⚠️ Preserving existing real estate business that was not returned by API:', realEstateBusiness.id)
          finalRealEstateBusiness = realEstateBusiness
        }

        let finalMarketingBusinesses = preserveMissingBusinesses(marketingBusinesses, formattedMarketingBusinesses, 'marketing')

        setChurchBusiness(finalChurchBusiness)
        setRealEstateBusiness(finalRealEstateBusiness)
        setMarketingBusinesses(finalMarketingBusinesses)

        // For backward compatibility, set the first marketing business as the single business
        setMarketingBusiness(finalMarketingBusinesses.length > 0 ? finalMarketingBusinesses[0] : null)

        console.log('✅ Businesses state updated')
      }
    } catch (error) {
      console.error('Failed to fetch businesses:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchKPIs = async () => {
    try {
      console.log('📊 Fetching KPIs for workspace:', currentWorkspace?.id)
      const response = await fetch(`/api/business/kpis?workspaceId=${currentWorkspace?.id || ''}`)
      const data = await response.json()
      console.log('📈 KPIs response:', data)

      if (data.success) {
        setKpis(data.kpis)
        console.log('✅ KPIs loaded:', data.kpis)
      } else {
        console.error('❌ KPIs API error:', data.error)
      }
    } catch (error) {
      console.error('❌ Failed to fetch KPIs:', error)
    }
  }

  const syncGHLCampaigns = async () => {
    try {
      setSyncLoading(true)
      const response = await fetch('/api/business/sync-ghl', {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        alert(`✅ Synced ${data.totalSynced} campaigns from GoHighLevel!`)
        fetchBusinesses() // Refresh campaign data
        fetchKPIs() // Refresh KPI data
      } else {
        alert(`❌ Sync failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      alert('❌ Failed to sync GHL campaigns')
    } finally {
      setSyncLoading(false)
    }
  }

  // CRUD Functions for inline editing
  const startEditingCampaign = (businessId: string, campaignId: string) => {
    const updateBusiness = (business: EditableBusiness | null) => {
      if (!business) return business
      return {
        ...business,
        campaigns: business.campaigns.map(campaign =>
          campaign.id === campaignId
            ? {
                ...campaign,
                isEditing: true,
                originalData: { ...campaign } as EditableCampaign
              }
            : campaign
        )
      }
    }

    setChurchBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setRealEstateBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setMarketingBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
  }

  const cancelEditingCampaign = (businessId: string, campaignId: string) => {
    const updateBusiness = (business: EditableBusiness | null) => {
      if (!business) return business
      return {
        ...business,
        campaigns: business.campaigns.map(campaign =>
          campaign.id === campaignId && campaign.originalData
            ? {
                ...(campaign.originalData as EditableCampaign),
                isEditing: false,
                originalData: undefined
              }
            : campaign
        )
      }
    }

    setChurchBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setRealEstateBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setMarketingBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setHasUnsavedChanges(false)
  }

  const updateCampaignField = (businessId: string, campaignId: string, field: keyof EditableCampaign, value: any) => {
    // Convert numeric values to strings for Campaign interface compatibility
    let processedValue = value
    if (['budget', 'spent'].includes(field) && typeof value === 'number') {
      processedValue = value.toString()
    }

    const updateBusiness = (business: EditableBusiness | null) => {
      if (!business) return business
      return {
        ...business,
        campaigns: business.campaigns.map(campaign =>
          campaign.id === campaignId
            ? { ...campaign, [field]: processedValue }
            : campaign
        )
      }
    }

    setChurchBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setRealEstateBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setMarketingBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)

    // Auto-save for existing campaigns (not temp ones)
    if (!campaignId.startsWith('temp-')) {
      autoSaveCampaign(businessId, campaignId)
    } else {
      setHasUnsavedChanges(true)
    }
  }

  const saveCampaignChanges = async (businessId: string, campaignId: string) => {
    const business = churchBusiness?.id === businessId ? churchBusiness :
                     realEstateBusiness?.id === businessId ? realEstateBusiness :
                     marketingBusiness

    if (!business) return

    const campaign = business.campaigns.find(c => c.id === campaignId)
    if (!campaign) return

    try {
      const response = await fetch(`/api/business/${businessId}/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaign.name,
          status: campaign.status,
          budget: campaign.budget,
          spent: campaign.spent,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          conversions: campaign.conversions,
          notes: campaign.notes
        })
      })

      const data = await response.json()

      if (data.success) {
        // Mark as no longer editing
        const updateBusiness = (business: EditableBusiness) => ({
          ...business,
          campaigns: business.campaigns.map(campaign =>
            campaign.id === campaignId
              ? { ...campaign, isEditing: false, originalData: undefined }
              : campaign
          )
        })

        if (churchBusiness?.id === businessId) setChurchBusiness(updateBusiness(churchBusiness))
        if (realEstateBusiness?.id === businessId) setRealEstateBusiness(updateBusiness(realEstateBusiness))
        if (marketingBusiness?.id === businessId) setMarketingBusiness(updateBusiness(marketingBusiness))

        setHasUnsavedChanges(false)
        fetchKPIs() // Refresh KPIs after changes
        setSavingCampaigns(prev => {
          const newSet = new Set(prev)
          newSet.delete(campaignId)
          return newSet
        })
      } else {
        alert(`❌ Failed to save campaign: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to save campaign:', error)
      alert('❌ Failed to save campaign')
    }
  }

  const addNewCampaign = (businessId: string) => {
    const newCampaign: EditableCampaign = {
      id: `temp-${Date.now()}`,
      name: 'New Campaign',
      status: 'draft',
      budget: '0',
      spent: '0',
      impressions: '0',
      clicks: '0',
      conversions: '0',
      roas: '0x',
      business_id: businessId,
      user_id: user?.id || '',
      platform: 'manual',
      currency: 'USD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isEditing: true
    }

    const updateBusiness = (business: EditableBusiness | null) => {
      if (!business) return business
      return {
        ...business,
        campaigns: [...business.campaigns, newCampaign]
      }
    }

    setChurchBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setRealEstateBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setMarketingBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
    setHasUnsavedChanges(true)
  }

  const saveNewCampaign = async (businessId: string, tempId: string) => {
    console.log('💾 Saving new campaign:', { businessId, tempId })

    const business = churchBusiness?.id === businessId ? churchBusiness :
                     realEstateBusiness?.id === businessId ? realEstateBusiness :
                     marketingBusiness

    console.log('🏢 Business found:', business?.name)

    if (!business) {
      console.error('❌ No business found for ID:', businessId)
      return
    }

    const campaign = business.campaigns.find(c => c.id === tempId)
    console.log('📊 Campaign to save:', campaign)

    if (!campaign) {
      console.error('❌ No campaign found with temp ID:', tempId)
      return
    }

    try {
      console.log('🚀 Making API call to create campaign...')
      const response = await fetch(`/api/business/${businessId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaign.name,
          status: campaign.status,
          platform: campaign.platform,
          budget: campaign.budget,
          spent: campaign.spent,
          impressions: campaign.impressions,
          clicks: campaign.clicks,
          conversions: campaign.conversions,
          notes: campaign.notes
        })
      })

      console.log('📡 API response status:', response.status)
      const data = await response.json()
      console.log('📡 API response data:', data)

      if (data.success) {
        console.log('✅ Campaign created successfully!')
        fetchBusinesses() // Refresh to get the real ID
        setHasUnsavedChanges(false)
      } else {
        console.error('❌ API returned error:', data.error)
        alert(`❌ Failed to create campaign: ${data.error}`)
      }
    } catch (error) {
      console.error('❌ Network error creating campaign:', error)
      alert('❌ Failed to create campaign')
    }
  }

  const deleteCampaignRow = (businessId: string, campaignId: string) => {
    if (campaignId.startsWith('temp-')) {
      // Just remove from local state for unsaved campaigns
      const updateBusiness = (business: EditableBusiness | null) => {
        if (!business) return business
        return {
          ...business,
          campaigns: business.campaigns.filter(c => c.id !== campaignId)
        }
      }

      setChurchBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
      setRealEstateBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
      setMarketingBusiness(prev => prev?.id === businessId ? updateBusiness(prev) : prev)
      setHasUnsavedChanges(false)
    } else {
      // Delete existing campaign
      const business = churchBusiness?.id === businessId ? churchBusiness :
                       realEstateBusiness?.id === businessId ? realEstateBusiness :
                       marketingBusiness
      const campaign = business?.campaigns.find(c => c.id === campaignId)
      if (campaign) {
        if (confirm(`Delete campaign "${campaign.name}"? This action cannot be undone.`)) {
          deleteCampaign(businessId, campaignId, campaign.name)
        }
      }
    }
  }

  const deleteCampaign = async (businessId: string, campaignId: string, campaignName: string) => {
    try {
      const response = await fetch(`/api/business/${businessId}/campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        fetchBusinesses()
        fetchKPIs()
        setHasUnsavedChanges(false)
      } else {
        alert(`❌ Failed to delete campaign: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error)
      alert('❌ Failed to delete campaign')
    }
  }

  // Auto-save functionality with debouncing
  const autoSaveCampaign = (businessId: string, campaignId: string) => {
    // Clear existing timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout)
    }

    // Set new timeout for auto-save (2 seconds delay)
    const timeout = setTimeout(async () => {
      setSavingCampaigns(prev => new Set(prev).add(campaignId))
      await saveCampaignChanges(businessId, campaignId)
      setSavingCampaigns(prev => {
        const newSet = new Set(prev)
        newSet.delete(campaignId)
        return newSet
      })
    }, 2000)

    setAutoSaveTimeout(timeout)
    setHasUnsavedChanges(true)
  }

  // Add new business
  const handleAddBusiness = () => {
    // Determine which type of business to create based on what's available
    let businessType: 'church' | 'real_estate' | 'marketing' = 'marketing'

    if (!churchBusiness) {
      businessType = 'church'
    } else if (!realEstateBusiness) {
      businessType = 'real_estate'
    } else {
      businessType = 'marketing' // Default to marketing if both others exist
    }

    const newBusiness: EditableBusiness = {
      id: `temp-${Date.now()}`,
      user_id: user?.id || '',
      name: '',
      description: '',
      type: businessType,
      campaigns: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Set the business based on type
    if (businessType === 'church') {
      setChurchBusiness(newBusiness)
    } else if (businessType === 'real_estate') {
      setRealEstateBusiness(newBusiness)
    } else {
      // For marketing businesses, add to array and set as current business
      setMarketingBusinesses(prev => [...prev, newBusiness])
      setMarketingBusiness(newBusiness)
    }

    setEditingBusinessId(newBusiness.id)
  }

  // Save new business
  const saveNewBusiness = async (businessId: string) => {
    // Find the business in the appropriate location
    let business: EditableBusiness | undefined

    console.log('🔍 Finding business to save:', businessId)
    console.log('  Church business:', churchBusiness?.id)
    console.log('  Real estate business:', realEstateBusiness?.id)
    console.log('  Marketing business (single):', marketingBusiness?.id)
    console.log('  Marketing businesses array:', marketingBusinesses.map(b => b.id))

    if (churchBusiness?.id === businessId) {
      business = churchBusiness
      console.log('  Found in church business')
    } else if (realEstateBusiness?.id === businessId) {
      business = realEstateBusiness
      console.log('  Found in real estate business')
    } else if (marketingBusiness?.id === businessId) {
      business = marketingBusiness
      console.log('  Found in single marketing business')
    } else {
      business = marketingBusinesses.find(b => b.id === businessId)
      console.log('  Found in marketing businesses array:', business ? 'yes' : 'no')
    }

    if (!business || !business.name.trim()) {
      alert('Business name is required')
      return
    }

    try {
      console.log('💾 Saving business:', {
        businessId,
        name: business.name.trim(),
        type: business.type,
        workspaceId: currentWorkspace?.id,
        workspaceName: currentWorkspace?.name,
        currentWorkspace: currentWorkspace
      })

      if (!currentWorkspace?.id) {
        console.error('❌ No current workspace found!')
        alert('No workspace selected. Please select a workspace first.')
        return
      }

      const response = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: business.name.trim(),
          description: business.description?.trim(),
          type: business.type,
          workspaceId: currentWorkspace?.id
        })
      })

      console.log('📡 API Response status:', response.status)

      const data = await response.json()
      console.log('📡 API Response data:', data)

      if (data.success) {
        console.log('✅ Business created successfully:', data.business)

        // Update the business with the real database ID instead of clearing it
        const savedBusiness = data.business
        const updatedBusiness: EditableBusiness = {
          id: savedBusiness.id,
          user_id: savedBusiness.user_id,
          name: savedBusiness.name,
          description: savedBusiness.description,
          type: savedBusiness.type,
          campaigns: business.campaigns, // Keep existing campaigns
          created_at: savedBusiness.created_at,
          updated_at: savedBusiness.updated_at
        }

        if (churchBusiness?.id === businessId) {
          setChurchBusiness(updatedBusiness)
        } else if (realEstateBusiness?.id === businessId) {
          setRealEstateBusiness(updatedBusiness)
        } else {
          // For marketing businesses, update in the array and set as current
          setMarketingBusinesses(prev => prev.map(b =>
            b.id === businessId ? updatedBusiness : b
          ))
          setMarketingBusiness(updatedBusiness)
        }

        setEditingBusinessId(null)
        console.log('✅ Business save process completed - business now has real ID:', savedBusiness.id)
      } else {
        console.error('❌ API returned error:', data.error)
        alert(`Failed to create business: ${data.error}`)
      }
    } catch (error) {
      console.error('❌ Failed to create business:', error)
      alert('Failed to create business')
    }
  }

  // Cancel editing business
  const cancelEditingBusiness = (businessId: string) => {
    // Remove the temporary business if it's a temp ID
    if (businessId.startsWith('temp-')) {
      if (churchBusiness?.id === businessId) setChurchBusiness(null)
      else if (realEstateBusiness?.id === businessId) setRealEstateBusiness(null)
      else setMarketingBusinesses(prev => prev.filter(b => b.id !== businessId))
    }

    setEditingBusinessId(null)
  }

  // Delete business
  const deleteBusiness = async (businessId: string, businessName: string) => {
    if (!confirm(`Are you sure you want to delete "${businessName}"? This will also delete all associated campaigns and cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/business/${businessId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        // Clear the business from state and refresh
        if (churchBusiness?.id === businessId) setChurchBusiness(null)
        if (realEstateBusiness?.id === businessId) setRealEstateBusiness(null)
        if (marketingBusiness?.id === businessId) setMarketingBusiness(null)

        fetchBusinesses() // Refresh the business list
        fetchKPIs() // Refresh KPIs
      } else {
        alert(`Failed to delete business: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to delete business:', error)
      alert('Failed to delete business')
    }
  }

  // Update business field
  const updateBusinessField = async (businessId: string, field: keyof EditableBusiness, value: any) => {
    console.log('🔄 Updating business field:', { businessId, field, value })

    // Update local state immediately
    if (churchBusiness?.id === businessId) {
      console.log('📝 Updating church business in state')
      setChurchBusiness(prev => {
        if (!prev) {
          console.error('❌ Church business not found in state!')
          return null
        }
        const updated = { ...prev, [field]: value }
        console.log('✅ Church business updated in state:', updated)
        return updated
      })
    } else if (realEstateBusiness?.id === businessId) {
      console.log('📝 Updating real estate business in state')
      setRealEstateBusiness(prev => {
        if (!prev) {
          console.error('❌ Real estate business not found in state!')
          return null
        }
        const updated = { ...prev, [field]: value }
        console.log('✅ Real estate business updated in state:', updated)
        return updated
      })
    } else if (marketingBusiness?.id === businessId) {
      console.log('📝 Updating marketing business in state')
      setMarketingBusiness(prev => {
        if (!prev) {
          console.error('❌ Marketing business not found in state!')
          return null
        }
        const updated = { ...prev, [field]: value }
        console.log('✅ Marketing business updated in state:', updated)
        return updated
      })
    } else {
      console.log('📝 Updating marketing business in array')
      setMarketingBusinesses(prev => {
        const businessIndex = prev.findIndex(b => b.id === businessId)
        if (businessIndex === -1) {
          console.error('❌ Business not found in marketingBusinesses array!')
          return prev
        }
        const updated = prev.map(business =>
          business.id === businessId
            ? { ...business, [field]: value }
            : business
        )
        console.log('✅ Marketing business updated in array:', updated[businessIndex])
        return updated
      })
    }

    // If this is not a temporary business, save to database
    if (!businessId.startsWith('temp-')) {
      try {
        setSavingStatus(prev => ({ ...prev, [businessId]: 'saving' }))
        console.log('💾 Auto-saving business field update:', { businessId, field, value, currentWorkspace: currentWorkspace })

        // Ensure we have a workspace
        if (!currentWorkspace?.id) {
          console.error('❌ No workspace selected for business update')
          setSavingStatus(prev => ({ ...prev, [businessId]: null }))
          alert('No workspace selected. Please select a workspace first.')
          return
        }

        const requestBody = {
          id: businessId,
          [field]: value,
          workspaceId: currentWorkspace.id
        }
        console.log('📤 PUT request body:', requestBody)

        const response = await fetch('/api/business', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })

        console.log('📡 PUT response status:', response.status)
        const data = await response.json()
        console.log('📡 PUT response data:', data)

        if (!data.success) {
          console.error('❌ Failed to save business update:', data.error)
          setSavingStatus(prev => ({ ...prev, [businessId]: null }))

          // Revert the local state change on API failure
          console.log('🔄 Reverting local state change due to API failure')
          if (churchBusiness?.id === businessId) {
            // For now, just show error - in future could revert the specific field
            console.error('Church business update failed - field may show incorrect value until refresh')
          } else if (realEstateBusiness?.id === businessId) {
            console.error('Real estate business update failed - field may show incorrect value until refresh')
          } else if (marketingBusiness?.id === businessId) {
            console.error('Marketing business update failed - field may show incorrect value until refresh')
          }

          alert(`Failed to save changes: ${data.error}`)
        } else {
          console.log('✅ Business field updated successfully:', data.business)
          setSavingStatus(prev => ({ ...prev, [businessId]: 'saved' }))
          // Clear the saved status after 2 seconds
          setTimeout(() => {
            setSavingStatus(prev => ({ ...prev, [businessId]: null }))
          }, 2000)
        }
      } catch (error) {
        console.error('❌ Error saving business update:', error)
        setSavingStatus(prev => ({ ...prev, [businessId]: null }))
        alert('Failed to save changes. Please try again.')
      }
    } else {
      console.log('⏭️ Skipping auto-save for temp business:', businessId)
    }
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
      }
    }
  }, [autoSaveTimeout])

  if (loading) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading your business data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Business Hub</h1>
          <p className="text-muted-foreground">
            Overview of your business metrics and KPIs
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAddBusiness}>
            <Building2 className="mr-2 h-4 w-4" />
            Add Business
          </Button>
          <Button variant="outline" disabled>
            <TrendingUp className="mr-2 h-4 w-4" />
            Coming Soon
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Campaign Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.revenue?.formatted || '$0'}</div>
            <p className="text-xs text-muted-foreground">
              Revenue from conversions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Audience Reach
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.customers?.formatted || '0'}</div>
            <p className="text-xs text-muted-foreground">
              Total campaign impressions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cost Per Conversion
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.growth?.formatted || '$0'}</div>
            <p className="text-xs text-muted-foreground">
              Average cost to get one conversion
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Performance Goals
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.goals?.completed || 0}/{kpis?.goals?.total || 4}</div>
            <p className="text-xs text-muted-foreground">
              Key metrics achieved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Placeholder */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>Revenue vs spend analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Chart placeholder
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Campaign Analytics</CardTitle>
            <CardDescription>Conversion and engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Chart placeholder
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Management Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaign Management</h2>
          <p className="text-muted-foreground">
            Track and manage your marketing campaigns across all businesses
            {hasUnsavedChanges && (
              <span className="ml-2 text-amber-600 font-medium flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Auto-saving...
              </span>
            )}
          </p>
        </div>
        {hasUnsavedChanges && (
          <Button variant="outline" size="sm">
            <Save className="mr-2 h-4 w-4" />
            Save All Changes
          </Button>
        )}
      </div>

      {/* Church Track Table */}
      {churchBusiness && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {inlineEditingField === `name-${churchBusiness.id}` ? (
                      <Input
                        value={churchBusiness.name}
                        onChange={async (e) => {
                          console.log('📝 Editing church business name:', churchBusiness.id, e.target.value)
                          await updateBusinessField(churchBusiness.id, 'name', e.target.value)
                        }}
                        onBlur={() => setInlineEditingField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setInlineEditingField(null)
                          if (e.key === 'Escape') setInlineEditingField(null)
                        }}
                        className="text-lg font-semibold border-blue-500"
                        autoFocus
                      />
                    ) : (
                      <CardTitle
                        className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded flex items-center gap-2"
                        onDoubleClick={() => {
                        console.log('🔄 Starting inline edit for church business:', churchBusiness.id)
                        setInlineEditingField(`name-${churchBusiness.id}`)
                      }}
                      >
                        <Target className="h-5 w-5" />
                        {churchBusiness.name || 'Unnamed Business'}
                      </CardTitle>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {inlineEditingField === `description-${churchBusiness.id}` ? (
                      <Input
                        value={churchBusiness.description || ''}
                        onChange={async (e) => await updateBusinessField(churchBusiness.id, 'description', e.target.value)}
                        onBlur={() => setInlineEditingField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setInlineEditingField(null)
                          if (e.key === 'Escape') setInlineEditingField(null)
                        }}
                        placeholder="Business description (optional)"
                        className="border-blue-500"
                        autoFocus
                      />
                    ) : (
                      <CardDescription
                        className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded flex-1"
                        onDoubleClick={() => setInlineEditingField(`description-${churchBusiness.id}`)}
                      >
                        {churchBusiness.description || 'No description'}
                      </CardDescription>
                    )}

                    {inlineEditingField === `type-${churchBusiness.id}` ? (
                      <Select
                        value={churchBusiness.type}
                        onValueChange={(value) => {
                          updateBusinessField(churchBusiness.id, 'type', value);
                          setInlineEditingField(null);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="church">Church</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="real_estate">Real Estate</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <span
                      className="cursor-pointer hover:text-foreground"
                      onDoubleClick={() => setInlineEditingField(`type-${churchBusiness.id}`)}
                    >
                      {churchBusiness.type === 'real_estate' ? 'Real Estate' :
                       churchBusiness.type === 'marketing' ? 'Marketing' :
                       churchBusiness.type === 'church' ? 'Church' : churchBusiness.type}
                    </span> • {churchBusiness.campaigns.length} campaigns • Campaign performance and metrics
                  </div>

                  {churchBusiness.id.startsWith('temp-') ? (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => saveNewBusiness(churchBusiness.id)}>
                        <Save className="h-4 w-4 mr-1" />
                        Save Business
                      </Button>
                    </div>
                  ) : savingStatus[churchBusiness.id] ? (
                    <div className="flex gap-2 pt-2 text-sm text-muted-foreground">
                      {savingStatus[churchBusiness.id] === 'saving' ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : savingStatus[churchBusiness.id] === 'saved' ? (
                        <>
                          <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          Saved
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addNewCampaign(churchBusiness.id)}
                  disabled={churchBusiness.id.startsWith('temp-')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Campaign
                </Button>
                {!churchBusiness.id.startsWith('temp-') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteBusiness(churchBusiness.id, churchBusiness.name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Business
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Campaign Name</TableHead>
                    <TableHead className="w-[100px]">Platform</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Budget</TableHead>
                    <TableHead className="w-[100px]">Spent</TableHead>
                    <TableHead className="w-[100px]">Impressions</TableHead>
                    <TableHead className="w-[100px]">Clicks</TableHead>
                    <TableHead className="w-[100px]">Conversions</TableHead>
                    <TableHead className="w-[100px]">ROAS</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {churchBusiness.campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            value={campaign.name}
                            onChange={(e) => updateCampaignField(churchBusiness.id, campaign.id, 'name', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && campaign.isEditing) {
                                saveCampaignChanges(churchBusiness.id, campaign.id)
                              } else if (e.key === 'Escape') {
                                cancelEditingCampaign(churchBusiness.id, campaign.id)
                              }
                            }}
                            className={`border-0 p-0 h-auto font-medium bg-transparent focus-visible:ring-1 focus-visible:ring-offset-0 ${
                              campaign.isEditing ? 'ring-1 ring-blue-500' : ''
                            }`}
                            placeholder="Campaign name"
                          />
                          {savingCampaigns.has(campaign.id) && (
                            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                          )}
                        </div>
                        {campaign.ghl_campaign_id && (
                          <div className="text-xs text-muted-foreground mt-1">(GHL Synced)</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={campaign.platform}
                          onValueChange={(value) => updateCampaignField(churchBusiness.id, campaign.id, 'platform', value)}
                        >
                          <SelectTrigger className="w-24 h-8 border-0 bg-transparent focus:ring-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ghl">GHL</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={campaign.status}
                          onValueChange={(value) => updateCampaignField(churchBusiness.id, campaign.id, 'status', value)}
                        >
                          <SelectTrigger className={`w-24 h-8 border-0 bg-transparent focus:ring-1 ${
                            campaign.status === 'active' ? 'text-green-700' :
                            campaign.status === 'paused' ? 'text-yellow-700' :
                            campaign.status === 'completed' ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.budget || ''}
                          onChange={(e) => updateCampaignField(churchBusiness.id, campaign.id, 'budget', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && campaign.isEditing) {
                              saveCampaignChanges(churchBusiness.id, campaign.id)
                            } else if (e.key === 'Escape') {
                              cancelEditingCampaign(churchBusiness.id, campaign.id)
                            }
                          }}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.spent || ''}
                          onChange={(e) => updateCampaignField(churchBusiness.id, campaign.id, 'spent', parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.impressions}
                          onChange={(e) => updateCampaignField(churchBusiness.id, campaign.id, 'impressions', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.clicks}
                          onChange={(e) => updateCampaignField(churchBusiness.id, campaign.id, 'clicks', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.conversions}
                          onChange={(e) => updateCampaignField(churchBusiness.id, campaign.id, 'conversions', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.roas ? `${campaign.roas}x` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {campaign.id.startsWith('temp-') ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveNewCampaign(churchBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCampaignRow(churchBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4 text-gray-600" />
                              </Button>
                            </>
                          ) : campaign.isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveCampaignChanges(churchBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelEditingCampaign(churchBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4 text-gray-600" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditingCampaign(churchBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCampaignRow(churchBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real Estate Table */}
      {realEstateBusiness && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {inlineEditingField === `name-${realEstateBusiness.id}` ? (
                      <Input
                        value={realEstateBusiness.name}
                        onChange={async (e) => await updateBusinessField(realEstateBusiness.id, 'name', e.target.value)}
                        onBlur={() => setInlineEditingField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setInlineEditingField(null)
                          if (e.key === 'Escape') setInlineEditingField(null)
                        }}
                        className="text-lg font-semibold border-blue-500"
                        autoFocus
                      />
                    ) : (
                      <CardTitle
                        className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded flex items-center gap-2"
                        onDoubleClick={() => setInlineEditingField(`name-${realEstateBusiness.id}`)}
                      >
                        <Target className="h-5 w-5" />
                        {realEstateBusiness.name || 'Unnamed Business'}
                      </CardTitle>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {inlineEditingField === `description-${realEstateBusiness.id}` ? (
                      <Input
                        value={realEstateBusiness.description || ''}
                        onChange={async (e) => await updateBusinessField(realEstateBusiness.id, 'description', e.target.value)}
                        onBlur={() => setInlineEditingField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setInlineEditingField(null)
                          if (e.key === 'Escape') setInlineEditingField(null)
                        }}
                        placeholder="Business description (optional)"
                        className="border-blue-500"
                        autoFocus
                      />
                    ) : (
                      <CardDescription
                        className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded flex-1"
                        onDoubleClick={() => setInlineEditingField(`description-${realEstateBusiness.id}`)}
                      >
                        {realEstateBusiness.description || 'No description'}
                      </CardDescription>
                    )}

                    {inlineEditingField === `type-${realEstateBusiness.id}` ? (
                      <Select
                        value={realEstateBusiness.type}
                        onValueChange={(value) => {
                          updateBusinessField(realEstateBusiness.id, 'type', value);
                          setInlineEditingField(null);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="church">Church</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="real_estate">Real Estate</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <span
                      className="cursor-pointer hover:text-foreground"
                      onDoubleClick={() => setInlineEditingField(`type-${realEstateBusiness.id}`)}
                    >
                      {realEstateBusiness.type === 'real_estate' ? 'Real Estate' :
                       realEstateBusiness.type === 'marketing' ? 'Marketing' :
                       realEstateBusiness.type === 'church' ? 'Church' : realEstateBusiness.type}
                    </span> • {realEstateBusiness.campaigns.length} campaigns • Campaign performance and metrics
                  </div>

                  {realEstateBusiness.id.startsWith('temp-') ? (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => saveNewBusiness(realEstateBusiness.id)}>
                        <Save className="h-4 w-4 mr-1" />
                        Save Business
                      </Button>
                    </div>
                  ) : savingStatus[realEstateBusiness.id] ? (
                    <div className="flex gap-2 pt-2 text-sm text-muted-foreground">
                      {savingStatus[realEstateBusiness.id] === 'saving' ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : savingStatus[realEstateBusiness.id] === 'saved' ? (
                        <>
                          <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          Saved
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addNewCampaign(realEstateBusiness.id)}
                  disabled={realEstateBusiness.id.startsWith('temp-')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Campaign
                </Button>
                {!realEstateBusiness.id.startsWith('temp-') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteBusiness(realEstateBusiness.id, realEstateBusiness.name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Business
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Campaign Name</TableHead>
                    <TableHead className="w-[100px]">Platform</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Budget</TableHead>
                    <TableHead className="w-[100px]">Spent</TableHead>
                    <TableHead className="w-[100px]">Impressions</TableHead>
                    <TableHead className="w-[100px]">Clicks</TableHead>
                    <TableHead className="w-[100px]">Conversions</TableHead>
                    <TableHead className="w-[100px]">ROAS</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realEstateBusiness.campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            value={campaign.name}
                            onChange={(e) => updateCampaignField(realEstateBusiness.id, campaign.id, 'name', e.target.value)}
                            className={`border-0 p-0 h-auto font-medium bg-transparent focus-visible:ring-1 focus-visible:ring-offset-0 ${
                              campaign.isEditing ? 'ring-1 ring-blue-500' : ''
                            }`}
                            placeholder="Campaign name"
                          />
                          {savingCampaigns.has(campaign.id) && (
                            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                          )}
                        </div>
                        {campaign.ghl_campaign_id && (
                          <div className="text-xs text-muted-foreground mt-1">(GHL Synced)</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={campaign.platform}
                          onValueChange={(value) => updateCampaignField(realEstateBusiness.id, campaign.id, 'platform', value)}
                        >
                          <SelectTrigger className="w-24 h-8 border-0 bg-transparent focus:ring-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ghl">GHL</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={campaign.status}
                          onValueChange={(value) => updateCampaignField(realEstateBusiness.id, campaign.id, 'status', value)}
                        >
                          <SelectTrigger className={`w-24 h-8 border-0 bg-transparent focus:ring-1 ${
                            campaign.status === 'active' ? 'text-green-700' :
                            campaign.status === 'paused' ? 'text-yellow-700' :
                            campaign.status === 'completed' ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.budget || ''}
                          onChange={(e) => updateCampaignField(realEstateBusiness.id, campaign.id, 'budget', parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.spent || ''}
                          onChange={(e) => updateCampaignField(realEstateBusiness.id, campaign.id, 'spent', parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.impressions}
                          onChange={(e) => updateCampaignField(realEstateBusiness.id, campaign.id, 'impressions', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.clicks}
                          onChange={(e) => updateCampaignField(realEstateBusiness.id, campaign.id, 'clicks', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.conversions}
                          onChange={(e) => updateCampaignField(realEstateBusiness.id, campaign.id, 'conversions', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.roas ? `${campaign.roas}x` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {campaign.id.startsWith('temp-') ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveNewCampaign(realEstateBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCampaignRow(realEstateBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4 text-gray-600" />
                              </Button>
                            </>
                          ) : campaign.isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveCampaignChanges(realEstateBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelEditingCampaign(realEstateBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4 text-gray-600" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditingCampaign(realEstateBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCampaignRow(realEstateBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Marketing Agency Table */}
      {marketingBusiness && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {inlineEditingField === `name-${marketingBusiness.id}` ? (
                      <Input
                        value={marketingBusiness.name}
                        onChange={async (e) => await updateBusinessField(marketingBusiness.id, 'name', e.target.value)}
                        onBlur={() => setInlineEditingField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setInlineEditingField(null)
                          if (e.key === 'Escape') setInlineEditingField(null)
                        }}
                        className="text-lg font-semibold border-blue-500"
                        autoFocus
                      />
                    ) : (
                      <CardTitle
                        className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded flex items-center gap-2"
                        onDoubleClick={() => setInlineEditingField(`name-${marketingBusiness.id}`)}
                      >
                        <Target className="h-5 w-5" />
                        {marketingBusiness.name || 'Unnamed Business'}
                      </CardTitle>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {inlineEditingField === `description-${marketingBusiness.id}` ? (
                      <Input
                        value={marketingBusiness.description || ''}
                        onChange={async (e) => await updateBusinessField(marketingBusiness.id, 'description', e.target.value)}
                        onBlur={() => setInlineEditingField(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setInlineEditingField(null)
                          if (e.key === 'Escape') setInlineEditingField(null)
                        }}
                        placeholder="Business description (optional)"
                        className="border-blue-500"
                        autoFocus
                      />
                    ) : (
                      <CardDescription
                        className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded flex-1"
                        onDoubleClick={() => setInlineEditingField(`description-${marketingBusiness.id}`)}
                      >
                        {marketingBusiness.description || 'No description'}
                      </CardDescription>
                    )}

                    {inlineEditingField === `type-${marketingBusiness.id}` ? (
                      <Select
                        value={marketingBusiness.type}
                        onValueChange={(value) => {
                          updateBusinessField(marketingBusiness.id, 'type', value);
                          setInlineEditingField(null);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="church">Church</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="real_estate">Real Estate</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <span
                      className="cursor-pointer hover:text-foreground"
                      onDoubleClick={() => setInlineEditingField(`type-${marketingBusiness.id}`)}
                    >
                      {marketingBusiness.type === 'real_estate' ? 'Real Estate' :
                       marketingBusiness.type === 'marketing' ? 'Marketing' :
                       marketingBusiness.type === 'church' ? 'Church' : marketingBusiness.type}
                    </span> • {marketingBusiness.campaigns.length} campaigns • Campaign performance and metrics
                  </div>

                  {marketingBusiness.id.startsWith('temp-') ? (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => saveNewBusiness(marketingBusiness.id)}>
                        <Save className="h-4 w-4 mr-1" />
                        Save Business
                      </Button>
                    </div>
                  ) : savingStatus[marketingBusiness.id] ? (
                    <div className="flex gap-2 pt-2 text-sm text-muted-foreground">
                      {savingStatus[marketingBusiness.id] === 'saving' ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : savingStatus[marketingBusiness.id] === 'saved' ? (
                        <>
                          <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          Saved
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addNewCampaign(marketingBusiness.id)}
                  disabled={marketingBusiness.id.startsWith('temp-')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Campaign
                </Button>
                {!marketingBusiness.id.startsWith('temp-') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteBusiness(marketingBusiness.id, marketingBusiness.name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Business
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Campaign Name</TableHead>
                    <TableHead className="w-[100px]">Platform</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Budget</TableHead>
                    <TableHead className="w-[100px]">Spent</TableHead>
                    <TableHead className="w-[100px]">Impressions</TableHead>
                    <TableHead className="w-[100px]">Clicks</TableHead>
                    <TableHead className="w-[100px]">Conversions</TableHead>
                    <TableHead className="w-[100px]">ROAS</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketingBusiness.campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            value={campaign.name}
                            onChange={(e) => updateCampaignField(marketingBusiness.id, campaign.id, 'name', e.target.value)}
                            className={`border-0 p-0 h-auto font-medium bg-transparent focus-visible:ring-1 focus-visible:ring-offset-0 ${
                              campaign.isEditing ? 'ring-1 ring-blue-500' : ''
                            }`}
                            placeholder="Campaign name"
                          />
                          {savingCampaigns.has(campaign.id) && (
                            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                          )}
                        </div>
                        {campaign.ghl_campaign_id && (
                          <div className="text-xs text-muted-foreground mt-1">(GHL Synced)</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={campaign.platform}
                          onValueChange={(value) => updateCampaignField(marketingBusiness.id, campaign.id, 'platform', value)}
                        >
                          <SelectTrigger className="w-24 h-8 border-0 bg-transparent focus:ring-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ghl">GHL</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="google">Google</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={campaign.status}
                          onValueChange={(value) => updateCampaignField(marketingBusiness.id, campaign.id, 'status', value)}
                        >
                          <SelectTrigger className={`w-24 h-8 border-0 bg-transparent focus:ring-1 ${
                            campaign.status === 'active' ? 'text-green-700' :
                            campaign.status === 'paused' ? 'text-yellow-700' :
                            campaign.status === 'completed' ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.budget || ''}
                          onChange={(e) => updateCampaignField(marketingBusiness.id, campaign.id, 'budget', parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.spent || ''}
                          onChange={(e) => updateCampaignField(marketingBusiness.id, campaign.id, 'spent', parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.impressions}
                          onChange={(e) => updateCampaignField(marketingBusiness.id, campaign.id, 'impressions', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.clicks}
                          onChange={(e) => updateCampaignField(marketingBusiness.id, campaign.id, 'clicks', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={campaign.conversions}
                          onChange={(e) => updateCampaignField(marketingBusiness.id, campaign.id, 'conversions', parseInt(e.target.value) || 0)}
                          className="w-20 h-8 border-0 bg-transparent focus:ring-1 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.roas ? `${campaign.roas}x` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {campaign.id.startsWith('temp-') ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveNewCampaign(marketingBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCampaignRow(marketingBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4 text-gray-600" />
                              </Button>
                            </>
                          ) : campaign.isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveCampaignChanges(marketingBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelEditingCampaign(marketingBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <X className="h-4 w-4 text-gray-600" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditingCampaign(marketingBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteCampaignRow(marketingBusiness.id, campaign.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


