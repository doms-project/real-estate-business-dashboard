"use client"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, ArrowUpDown, Edit, Upload, Download, FileText, Star, AlertCircle, Trash2, Check, X, Minus, BarChart3, TrendingUp, Lightbulb, Building, Wrench, Globe, Save } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SaveButton } from "@/components/ui/save-button"
import { PortfolioAIInsights } from "@/components/portfolio-ai-insights"
import { PropertyDetailsModal } from "@/components/property-details-modal"
import { Property } from "@/types"
import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { usePageData } from "@/components/layout/page-data-context"
import { useWorkspace } from "@/components/workspace-context"
import {
  PropertyField,
  PropertyFieldMapping,
  generateInitialMapping,
  mapCsvRowToProperty,
  validateMapping,
  REQUIRED_FIELDS,
} from "@/lib/csv-import"

// Mock data with new fields
const mockProperties: Property[] = [
    {
      id: "1",
      address: "123 Main St, San Francisco, CA",
      type: "Apartment",
    status: "rented",
    mortgageHolder: "Chase Bank",
    purchasePrice: 750000,
    currentEstValue: 850000,
    monthlyMortgagePayment: 3200,
    monthlyInsurance: 150,
    monthlyPropertyTax: 800,
    monthlyOtherCosts: 200,
    monthlyGrossRent: 4500,
    rentRoll: [
      {
        unitName: "Unit 1A",
        tenantName: "John Doe",
        monthlyRent: 2500,
        leaseStart: "2024-01-01",
        leaseEnd: "2024-12-31",
        securityDeposit: 2500,
      },
      {
        unitName: "Unit 1B",
        tenantName: "Jane Smith",
        monthlyRent: 2000,
        leaseStart: "2024-02-01",
        leaseEnd: "2025-01-31",
        securityDeposit: 2000,
      },
    ],
    workRequests: [
      {
        id: "1",
        dateLogged: "2024-11-15",
        description: "Fix leaky faucet",
        status: "completed",
        cost: 150,
      },
    ],
    ownership: "100% ownership",
    },
    {
      id: "2",
      address: "456 Oak Ave, Los Angeles, CA",
      type: "House",
    status: "rented",
    mortgageHolder: "Wells Fargo",
    purchasePrice: 1100000,
    currentEstValue: 1200000,
    monthlyMortgagePayment: 4800,
    monthlyInsurance: 250,
    monthlyPropertyTax: 1200,
    monthlyOtherCosts: 300,
    monthlyGrossRent: 6500,
    rentRoll: [
      {
        unitName: "Main House",
        tenantName: "Bob Johnson",
        monthlyRent: 6500,
        leaseStart: "2024-03-01",
        leaseEnd: "2025-02-28",
        securityDeposit: 6500,
      },
    ],
    workRequests: [],
    ownership: "50% partner",
  },
  {
    id: "3",
    address: "789 Pine Rd, San Diego, CA",
    type: "Condo",
    status: "vacant",
    mortgageHolder: "Bank of America",
    purchasePrice: 450000,
    currentEstValue: 500000,
    monthlyMortgagePayment: 2100,
    monthlyInsurance: 120,
    monthlyPropertyTax: 500,
    monthlyOtherCosts: 150,
    monthlyGrossRent: 0,
    rentRoll: [],
    workRequests: [
      {
        id: "2",
        dateLogged: "2024-11-20",
        description: "Paint interior",
        status: "in_progress",
        cost: 800,
      },
    ],
    ownership: "100% ownership",
  },
]

type SortField = "address" | "status" | "currentEstValue" | "purchasePrice" | "monthlyGrossRent" | "monthlyCashflow" | "roi"
type SortDirection = "asc" | "desc"

export default function PropertiesPage() {
  const { user } = useUser()
  const { setPageData } = usePageData()
  const { currentWorkspace, workspaceSwitchCount } = useWorkspace()
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("parts")

  // Modal state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [defaultModalTab, setDefaultModalTab] = useState<"overview" | "rent-roll" | "maintenance" | "websites">("overview")

  // Share properties data with ELO AI
  useEffect(() => {
    if (properties.length > 0) {
      setPageData({
        properties: properties.map(p => ({
          address: p.address,
          type: p.type,
          status: p.status,
          purchasePrice: p.purchasePrice,
          currentEstValue: p.currentEstValue,
          monthlyMortgagePayment: p.monthlyMortgagePayment,
          monthlyInsurance: p.monthlyInsurance,
          monthlyPropertyTax: p.monthlyPropertyTax,
          monthlyOtherCosts: p.monthlyOtherCosts,
          monthlyGrossRent: p.monthlyGrossRent,
          totalMortgageAmount: p.totalMortgageAmount,
          mortgageHolder: p.mortgageHolder,
          monthlyCashFlow: (p.monthlyGrossRent || 0) - (p.monthlyMortgagePayment || 0) - (p.monthlyInsurance || 0) - (p.monthlyPropertyTax || 0) - (p.monthlyOtherCosts || 0),
        })),
        totalProperties: properties.length,
        rentedCount: properties.filter(p => p.status === 'rented').length,
        vacantCount: properties.filter(p => p.status === 'vacant').length,
      })
    }
    return () => {
      setPageData(null)
    }
  }, [properties, setPageData])

  // Load properties from database on mount
  useEffect(() => {
    async function loadProperties() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        if (!currentWorkspace) {
          console.warn('No workspace selected, cannot load properties')
          setLoading(false)
          return
        }

        const response = await fetch(`/api/properties?workspaceId=${currentWorkspace.id}`)
        if (response.ok) {
          const data = await response.json()
          console.log('Loaded properties from database:', data.properties?.length || 0)
          
          // Always set properties from database
          if (data.properties && Array.isArray(data.properties)) {
            const loadedProperties: Property[] = data.properties.map((p: any) => {
              const property: any = {
                id: p.id, // Use database ID (UUID)
                address: p.address,
                type: p.type,
                status: p.status,
                mortgageHolder: p.mortgage_holder,
                totalMortgageAmount: parseFloat(p.total_mortgage_amount) || 0,
                purchasePrice: parseFloat(p.purchase_price) || 0,
                currentEstValue: parseFloat(p.current_est_value) || 0,
                monthlyMortgagePayment: parseFloat(p.monthly_mortgage_payment) || 0,
                monthlyInsurance: parseFloat(p.monthly_insurance) || 0,
                monthlyPropertyTax: parseFloat(p.monthly_property_tax) || 0,
                monthlyOtherCosts: parseFloat(p.monthly_other_costs) || 0,
                monthlyGrossRent: parseFloat(p.monthly_gross_rent) || 0,
                ownership: p.ownership,
                linkedWebsites: p.linked_websites || [],
                notes: p.notes || "",
                photos: p.photos || [],
                rentRoll: p.rent_roll || [], // Load from rent_roll column
                maintenanceRequests: p.maintenance_requests || [], // Load from maintenance_requests column
              }
              // Restore custom fields from JSONB column
              if (p.custom_fields && typeof p.custom_fields === 'object') {
                Object.keys(p.custom_fields).forEach(key => {
                  property[key] = p.custom_fields[key]
                })
              }
              return property
            })
            console.log('Loaded properties from database on mount:', loadedProperties.length)
            setProperties(loadedProperties)
          } else {
            // No properties in database, set empty array
            console.log('No properties in database, setting empty array')
            setProperties([])
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error('Failed to load properties:', errorData)
          // Don't clear properties on error - might be a temporary issue
          // Only set empty if we're sure there are no properties
          if (properties.length === 0) {
            setProperties([])
          }
        }
      } catch (error) {
        console.error('Failed to load properties:', error)
        // Don't clear properties on error - might be a temporary issue
        // Only set empty if we're sure there are no properties
        if (properties.length === 0) {
          setProperties([])
        }
      } finally {
        setLoading(false)
      }
    }

    loadProperties()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentWorkspace, workspaceSwitchCount])
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [csvData, setCsvData] = useState<string[][]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<PropertyFieldMapping>({})
  const [importError, setImportError] = useState<string>("")
  const [importSuccess, setImportSuccess] = useState<string>("")
  const [editingCell, setEditingCell] = useState<{ propertyId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [customFields, setCustomFields] = useState<Array<{ id: string; name: string; type: 'text' | 'number' }>>([])
  const [addCustomFieldDialogOpen, setAddCustomFieldDialogOpen] = useState(false)
  const [newCustomFieldName, setNewCustomFieldName] = useState("")
  const [newCustomFieldType, setNewCustomFieldType] = useState<'text' | 'number'>('text')

  // Auto-save state
  const [savingProperties, setSavingProperties] = useState<Set<string>>(new Set())
  const [savedProperties, setSavedProperties] = useState<Set<string>>(new Set())
  const [saveErrors, setSaveErrors] = useState<Map<string, string>>(new Map())

  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Auto-save individual property
  const autoSaveProperty = async (property: Property) => {
    const propertyId = property.id

    // Skip auto-save for temporary properties (newly added ones without real IDs)
    if (propertyId.startsWith('temp-')) {
      console.log('Skipping auto-save for temporary property:', propertyId)
      return
    }

    // Mark as saving
    setSavingProperties(prev => new Set(prev).add(propertyId))
    setSavedProperties(prev => {
      const newSet = new Set(prev)
      newSet.delete(propertyId)
      return newSet
    })
    setSaveErrors(prev => {
      const newMap = new Map(prev)
      newMap.delete(propertyId)
      return newMap
    })

    try {
      // Validate required fields
      if (!property.address?.trim() || !property.type?.trim() || !property.status) {
        throw new Error('Missing required fields: address, type, and status are required')
      }

      // Prepare property data for API
      const propertyData = {
        user_id: user?.id,
        workspace_id: null, // Will be set by API
        address: property.address.trim(),
        type: property.type.trim(),
        status: property.status,
        mortgage_holder: property.mortgageHolder?.trim() || null,
        total_mortgage_amount: Number(property.totalMortgageAmount) || 0,
        purchase_price: Number(property.purchasePrice) || 0,
        current_est_value: Number(property.currentEstValue) || 0,
        monthly_mortgage_payment: Number(property.monthlyMortgagePayment) || 0,
        monthly_insurance: Number(property.monthlyInsurance) || 0,
        monthly_property_tax: Number(property.monthlyPropertyTax) || 0,
        monthly_other_costs: Number(property.monthlyOtherCosts) || 0,
        monthly_gross_rent: Number(property.monthlyGrossRent) || 0,
        ownership: property.ownership?.trim() || null,
        linked_websites: Array.isArray(property.linkedWebsites) && property.linkedWebsites.length > 0 ? property.linkedWebsites : null,
      }

      // Extract custom fields
      const customFieldsData: Record<string, any> = {}
      Object.keys(property).forEach(key => {
        if (key.startsWith('custom_')) {
          customFieldsData[key] = property[key as keyof Property]
        }
      })

      const dataToSend = { ...propertyData, ...customFieldsData }

      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // Mark as saved
      setSavingProperties(prev => {
        const newSet = new Set(prev)
        newSet.delete(propertyId)
        return newSet
      })
      setSavedProperties(prev => new Set(prev).add(propertyId))

      // Clear saved status after 3 seconds
      setTimeout(() => {
        setSavedProperties(prev => {
          const newSet = new Set(prev)
          newSet.delete(propertyId)
          return newSet
        })
      }, 3000)

      console.log('✅ Auto-saved property:', property.address)

    } catch (error: any) {
      console.error('❌ Auto-save failed for property:', property.address, error)

      // Mark as error
      setSavingProperties(prev => {
        const newSet = new Set(prev)
        newSet.delete(propertyId)
        return newSet
      })
      setSaveErrors(prev => new Map(prev).set(propertyId, error.message))

      // Clear error after 5 seconds
      setTimeout(() => {
        setSaveErrors(prev => {
          const newMap = new Map(prev)
          newMap.delete(propertyId)
          return newMap
        })
      }, 5000)
    }
  }

  // Calculate monthly total costs (use manual value if set, otherwise calculate)
  const calculateMonthlyCosts = useCallback((property: Property): number => {
    if (property.monthlyTotalCosts !== undefined && property.monthlyTotalCosts !== null) {
      return property.monthlyTotalCosts
    }
    return (
      property.monthlyMortgagePayment +
      property.monthlyInsurance +
      property.monthlyPropertyTax +
      property.monthlyOtherCosts
    )
  }, [])

  // Calculate monthly cashflow (automatically recalculated when total costs change)
  const calculateMonthlyCashflow = useCallback((property: Property): number => {
    const totalCosts = calculateMonthlyCosts(property)
    return property.monthlyGrossRent - totalCosts
  }, [calculateMonthlyCosts])

  // Calculate Annual Return on Investment (ROI)
  const calculateROI = useCallback((property: Property): number => {
    const annualCashflow = calculateMonthlyCashflow(property) * 12
    if (property.purchasePrice <= 0) return 0
    return (annualCashflow / property.purchasePrice) * 100
  }, [calculateMonthlyCashflow])

  // Filter properties
  const filteredProperties = useMemo(() => {
    let filtered = properties
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }
    return filtered
  }, [properties, statusFilter])

  // Sort properties
  const sortedProperties = useMemo(() => {
    if (!sortField) return filteredProperties

    const calcCashflow = (p: Property) => {
      const totalCosts = p.monthlyTotalCosts !== undefined && p.monthlyTotalCosts !== null 
        ? p.monthlyTotalCosts 
        : (p.monthlyMortgagePayment + p.monthlyInsurance + p.monthlyPropertyTax + p.monthlyOtherCosts)
      return p.monthlyGrossRent - totalCosts
    }
    const calcROI = (p: Property) => {
      const annualCashflow = calcCashflow(p) * 12
      if (p.purchasePrice <= 0) return 0
      return (annualCashflow / p.purchasePrice) * 100
    }

    return [...filteredProperties].sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortField) {
        case "address":
          aValue = a.address
          bValue = b.address
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        case "currentEstValue":
          aValue = a.currentEstValue
          bValue = b.currentEstValue
          break
        case "purchasePrice":
          aValue = a.purchasePrice
          bValue = b.purchasePrice
          break
        case "monthlyGrossRent":
          aValue = a.monthlyGrossRent
          bValue = b.monthlyGrossRent
          break
        case "monthlyCashflow":
          aValue = calcCashflow(a)
          bValue = calcCashflow(b)
          break
        case "roi":
          aValue = calcROI(a)
          bValue = calcROI(b)
          break
        default:
          return 0
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
  }, [filteredProperties, sortField, sortDirection])

  // Portfolio totals
  const portfolioTotals = useMemo(() => {
    const totalProperties = sortedProperties.length
    const totalEstValue = sortedProperties.reduce(
      (sum, p) => sum + p.currentEstValue,
      0
    )
    const totalMonthlyCashflow = sortedProperties.reduce(
      (sum, p) => sum + calculateMonthlyCashflow(p),
      0
    )
    const avgROI = totalProperties > 0
      ? sortedProperties.reduce((sum, p) => sum + calculateROI(p), 0) / totalProperties
      : 0
    return { totalProperties, totalEstValue, totalMonthlyCashflow, avgROI }
  }, [sortedProperties, calculateMonthlyCashflow, calculateROI])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getStatusBadgeVariant = (status: Property["status"]) => {
    switch (status) {
      case "rented":
        return "default"
      case "vacant":
        return "secondary"
      case "under_maintenance":
        return "destructive"
      case "sold":
        return "outline"
      default:
        return "default"
    }
  }

  const formatCurrency = (value: number | undefined | null) => {
    const numValue = value ?? 0 // Real value if exists, 0 if not
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  // Handle delete property
  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm("Are you sure you want to delete this property? This action cannot be undone.")) {
      return
    }

    try {
      // Delete from database first
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove from local state after successful deletion
        setProperties(properties.filter((p) => p.id !== propertyId))
        console.log('Property deleted successfully')
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete property')
      }
    } catch (error: any) {
      console.error('Error deleting property:', error)
      alert(`Failed to delete property: ${error.message || 'Unknown error'}`)
    }
  }

  const openModalWithTab = (property: Property, tab: "overview" | "rent-roll" | "maintenance" | "websites") => {
    setSelectedProperty(property)
    setDefaultModalTab(tab)
    setIsModalOpen(true)
  }

  const handlePropertyUpdate = async (propertyId: string, updates: Partial<Property>) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        // Map the updated property from database format to frontend format
        const updatedProperty = data.property
        const mappedProperty: Property = {
          id: updatedProperty.id,
          address: updatedProperty.address,
          type: updatedProperty.type,
          status: updatedProperty.status,
          mortgageHolder: updatedProperty.mortgage_holder,
          totalMortgageAmount: parseFloat(updatedProperty.total_mortgage_amount) || 0,
          purchasePrice: parseFloat(updatedProperty.purchase_price) || 0,
          currentEstValue: parseFloat(updatedProperty.current_est_value) || 0,
          monthlyMortgagePayment: parseFloat(updatedProperty.monthly_mortgage_payment) || 0,
          monthlyInsurance: parseFloat(updatedProperty.monthly_insurance) || 0,
          monthlyPropertyTax: parseFloat(updatedProperty.monthly_property_tax) || 0,
          monthlyOtherCosts: parseFloat(updatedProperty.monthly_other_costs) || 0,
          monthlyGrossRent: parseFloat(updatedProperty.monthly_gross_rent) || 0,
          ownership: updatedProperty.ownership,
          linkedWebsites: Array.isArray(updatedProperty.linked_websites)
            ? updatedProperty.linked_websites.filter((item: any) =>
                typeof item === 'object' && item !== null && 'id' in item && 'name' in item && 'linkedAt' in item
              )
            : [],
          notes: updatedProperty.notes || "",
          photos: updatedProperty.photos || [],
          rentRoll: updatedProperty.rent_roll || [], // Load from rent_roll column
          maintenanceRequests: updatedProperty.maintenance_requests || [], // Load from maintenance_requests column
        }

        // Restore custom fields from JSONB column
        if (updatedProperty.custom_fields && typeof updatedProperty.custom_fields === 'object') {
          Object.keys(updatedProperty.custom_fields).forEach(key => {
            ;(mappedProperty as any)[key] = updatedProperty.custom_fields[key]
          })
        }

        // Update local state with properly mapped property
        setProperties(properties.map(p => p.id === propertyId ? mappedProperty : p))

        // Update selectedProperty if the modal is showing this property
        if (selectedProperty && selectedProperty.id === propertyId) {
          setSelectedProperty(mappedProperty)
        }

        console.log('Property updated successfully')
      } else {
        let errorMessage = 'Failed to update property'
        try {
          const errorData = await response.json()
          errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`
        } catch (e) {
          // Response body is not valid JSON or empty
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      console.error('Error updating property:', error)
      alert(`Failed to update property: ${error.message || 'Unknown error'}`)
      throw error
    }
  }

  // Handle inline editing
  const handleCellClick = (propertyId: string, field: string, currentValue: any, rawValue?: any) => {
    // Don't allow editing calculated fields (except monthlyTotalCosts which is editable)
    if (field === "monthlyCashflow" || field === "roi") {
      return
    }
    
    // Allow editing all other fields including type and mortgageHolder
    
    setEditingCell({ propertyId, field })
    // Use rawValue if provided (for formatted currency/percentage), otherwise use currentValue
    const valueToEdit = rawValue !== undefined ? rawValue : currentValue
    if (typeof valueToEdit === "number") {
      setEditValue(valueToEdit.toString())
    } else {
      setEditValue(String(valueToEdit || ""))
    }
  }

  const handleCellSave = () => {
    if (!editingCell) return

    const { propertyId, field } = editingCell
    const property = properties.find((p) => p.id === propertyId)
    if (!property) return

    const updatedProperties = properties.map((p) => {
      if (p.id === propertyId) {
        const updated = { ...p }

        // Handle different field types
        if (field === "status") {
          if (["rented", "vacant", "under_maintenance", "sold"].includes(editValue.toLowerCase())) {
            updated.status = editValue.toLowerCase() as Property["status"]
          }
        } else if (
          [
            "purchasePrice",
            "currentEstValue",
            "totalMortgageAmount",
            "monthlyMortgagePayment",
            "monthlyInsurance",
            "monthlyPropertyTax",
            "monthlyOtherCosts",
            "monthlyGrossRent",
            "monthlyTotalCosts",
          ].includes(field)
        ) {
          const numValue = parseFloat(editValue.replace(/[$,\s]/g, ""))
          if (!isNaN(numValue)) {
            ;(updated as any)[field] = numValue
            // If monthlyTotalCosts is updated, cashflow will auto-recalculate
          }
        } else if (field.startsWith("custom_")) {
          // Handle custom fields
          const customField = customFields.find(f => `custom_${f.id}` === field)
          if (customField?.type === 'number') {
            const numValue = parseFloat(editValue.replace(/[$,\s]/g, ""))
            if (!isNaN(numValue)) {
              ;(updated as any)[field] = numValue
            }
          } else {
            ;(updated as any)[field] = editValue
          }
        } else if (field === "address" || field === "type" || field === "mortgageHolder") {
          ;(updated as any)[field] = editValue
        } else if (field === "ownership") {
          const validOwnership = [
            "100% ownership",
            "50% partner",
            "25% partner",
            "75% partner",
            "33% partner",
            "67% partner",
          ].includes(editValue)
            ? editValue
            : "100% ownership"
          ;(updated as any)[field] = validOwnership
        }

        return updated
      }
      return p
    })

    setProperties(updatedProperties)
    setEditingCell(null)
    setEditValue("")

    // Auto-save the updated property (only for existing properties, not temp ones)
    const updatedProperty = updatedProperties.find((p) => p.id === propertyId)
    if (updatedProperty && !propertyId.startsWith('temp-')) {
      // Debounce auto-save to avoid too many API calls
      const timeoutKey = `${propertyId}-${field}`
      if (autoSaveTimeouts.current.has(timeoutKey)) {
        clearTimeout(autoSaveTimeouts.current.get(timeoutKey))
      }

      const timeoutId = setTimeout(() => {
        autoSaveProperty(updatedProperty)
        autoSaveTimeouts.current.delete(timeoutKey)
      }, 1000) // 1 second debounce

      autoSaveTimeouts.current.set(timeoutKey, timeoutId)
    }
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditValue("")
  }

  // Save new property (for temp properties)
  const handleSaveNewProperty = async (tempPropertyId: string) => {
    const property = properties.find(p => p.id === tempPropertyId)
    if (!property) {
      console.error('Property not found for saving:', tempPropertyId)
      return
    }

    console.log('Attempting to save property:', {
      id: property.id,
      address: property.address,
      type: property.type,
      status: property.status
    })

    // Mark as saving
    setSavingProperties(prev => new Set(prev).add(tempPropertyId))

    try {
      // Validate required fields
      if (!property.address?.trim() || !property.type?.trim() || !property.status) {
        const missing = []
        if (!property.address?.trim()) missing.push('address')
        if (!property.type?.trim()) missing.push('type')
        if (!property.status) missing.push('status')
        throw new Error(`Missing required fields: ${missing.join(', ')} are required`)
      }

      // Prepare property data for API (similar to autoSaveProperty but for POST)
      const propertyData = {
        user_id: user?.id,
        workspace_id: null, // Will be set by API
        address: property.address.trim(),
        type: property.type.trim(),
        status: property.status,
        mortgage_holder: property.mortgageHolder?.trim() || null,
        total_mortgage_amount: Number(property.totalMortgageAmount) || 0,
        purchase_price: Number(property.purchasePrice) || 0,
        current_est_value: Number(property.currentEstValue) || 0,
        monthly_mortgage_payment: Number(property.monthlyMortgagePayment) || 0,
        monthly_insurance: Number(property.monthlyInsurance) || 0,
        monthly_property_tax: Number(property.monthlyPropertyTax) || 0,
        monthly_other_costs: Number(property.monthlyOtherCosts) || 0,
        monthly_gross_rent: Number(property.monthlyGrossRent) || 0,
        ownership: property.ownership?.trim() || null,
        linked_websites: Array.isArray(property.linkedWebsites) && property.linkedWebsites.length > 0 ? property.linkedWebsites : null,
      }

      // Extract custom fields
      const customFieldsData: Record<string, any> = {}
      Object.keys(property).forEach(key => {
        if (key.startsWith('custom_')) {
          customFieldsData[key] = property[key as keyof Property]
        }
      })

      const dataToSend = { ...propertyData, ...customFieldsData }

      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: [dataToSend],
          workspaceId: currentWorkspace?.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Saved new property:', property.address)

      // Add the saved property to the existing list instead of reloading
      // This avoids potential race conditions with database consistency
      const savedProperty = result.properties?.[0] || result.property
      if (savedProperty) {
        setProperties(prevProperties => {
          // Remove the temp property and add the saved one
          const filtered = prevProperties.filter(p => p.id !== tempPropertyId)
          // Convert saved property to frontend format
          const convertedProperty: Property = {
            id: savedProperty.id,
            address: savedProperty.address,
            type: savedProperty.type,
            status: savedProperty.status,
            mortgageHolder: savedProperty.mortgage_holder,
            totalMortgageAmount: parseFloat(savedProperty.total_mortgage_amount) || 0,
            purchasePrice: parseFloat(savedProperty.purchase_price) || 0,
            currentEstValue: parseFloat(savedProperty.current_est_value) || 0,
            monthlyMortgagePayment: parseFloat(savedProperty.monthly_mortgage_payment) || 0,
            monthlyInsurance: parseFloat(savedProperty.monthly_insurance) || 0,
            monthlyPropertyTax: parseFloat(savedProperty.monthly_property_tax) || 0,
            monthlyOtherCosts: parseFloat(savedProperty.monthly_other_costs) || 0,
            monthlyGrossRent: parseFloat(savedProperty.monthly_gross_rent) || 0,
            ownership: savedProperty.ownership,
            linkedWebsites: savedProperty.linked_websites || [],
            notes: savedProperty.notes || "",
            photos: savedProperty.photos || [],
            rentRoll: savedProperty.rent_roll || [],
            maintenanceRequests: savedProperty.maintenance_requests || [],
          }
          return [...filtered, convertedProperty]
        })
        console.log('Added saved property to existing list:', savedProperty.address)
      } else {
        // Fallback: reload if we can't get the saved property
        const reloadResponse = await fetch('/api/properties')
        if (reloadResponse.ok) {
          const reloadData = await reloadResponse.json()
          setProperties(reloadData.properties || [])
          console.log('Fallback: reloaded properties after saving new one:', reloadData.properties?.length || 0)
        } else {
          console.error('Failed to reload properties after save')
        }
      }

      // Mark as saved (though we'll reload so this might not show)
      setSavingProperties(prev => {
        const newSet = new Set(prev)
        newSet.delete(tempPropertyId)
        return newSet
      })

    } catch (error: any) {
      console.error('❌ Failed to save new property:', property.address, error)

      // Mark as error
      setSavingProperties(prev => {
        const newSet = new Set(prev)
        newSet.delete(tempPropertyId)
        return newSet
      })

      // Show error
      alert(`Failed to save property: ${error.message || 'Unknown error'}`)
    }
  }

  const handleSaveProperties = async () => {
    try {
      // Send ALL properties - don't filter them out
      // The API will validate and handle invalid ones
      // This prevents accidentally deleting properties that are filtered out
      console.log('Saving properties:', properties.length, 'total properties in state')
      
      // Log any properties that might be missing required fields (for debugging)
      const invalidProperties = properties.filter((prop: Property) => {
        return !prop.address || !prop.type || !prop.status
      })
      if (invalidProperties.length > 0) {
        console.warn(`⚠️ ${invalidProperties.length} properties missing required fields and will be skipped:`, invalidProperties.map(p => ({
          id: p.id,
          address: p.address || '(empty)',
          type: p.type || '(empty)',
          status: p.status || '(empty)'
        })))
      }
      
      // Log valid properties
      const validProperties = properties.filter((prop: Property) => {
        return prop.address && prop.type && prop.status
      })
      console.log(`✅ ${validProperties.length} properties have all required fields and will be saved`)

      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: properties, // Send all properties, not just "valid" ones
          workspaceId: currentWorkspace?.id,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Properties saved successfully:', data)
        
        // Reload properties from database to ensure state is in sync
        // Add a small delay to ensure database has processed the save
        await new Promise(resolve => setTimeout(resolve, 500))
        
        try {
          const reloadResponse = await fetch('/api/properties')
          if (reloadResponse.ok) {
            const reloadData = await reloadResponse.json()
            console.log('Reloaded properties after save:', reloadData.properties?.length || 0)
            
            if (reloadData.properties && Array.isArray(reloadData.properties)) {
              const reloadedProperties: Property[] = reloadData.properties.map((p: any) => {
                const property: any = {
                  id: p.id, // Use database ID (UUID)
                  address: p.address,
                  type: p.type,
                  status: p.status,
                  mortgageHolder: p.mortgage_holder,
                  totalMortgageAmount: parseFloat(p.total_mortgage_amount) || 0,
                  purchasePrice: parseFloat(p.purchase_price) || 0,
                  currentEstValue: parseFloat(p.current_est_value) || 0,
                  monthlyMortgagePayment: parseFloat(p.monthly_mortgage_payment) || 0,
                  monthlyInsurance: parseFloat(p.monthly_insurance) || 0,
                  monthlyPropertyTax: parseFloat(p.monthly_property_tax) || 0,
                  monthlyOtherCosts: parseFloat(p.monthly_other_costs) || 0,
                  monthlyGrossRent: parseFloat(p.monthly_gross_rent) || 0,
                  ownership: p.ownership,
                  linkedWebsites: Array.isArray(p.linked_websites)
                    ? p.linked_websites.filter((item: any) =>
                        typeof item === 'object' && item !== null && 'id' in item && 'name' in item && 'linkedAt' in item
                      )
                    : [],
                  rentRoll: [],
                  workRequests: [],
                }
                // Restore custom fields from JSONB column
                if (p.custom_fields && typeof p.custom_fields === 'object') {
                  Object.keys(p.custom_fields).forEach(key => {
                    property[key] = p.custom_fields[key]
                  })
                }
                return property
              })
              console.log('Setting reloaded properties:', reloadedProperties.length)
              setProperties(reloadedProperties)
            } else {
              // If no properties returned, keep current state (don't clear)
              console.warn('No properties returned after reload, keeping current state')
              // Don't setProperties([]) - this would clear everything
            }
          } else {
            const errorData = await reloadResponse.json().catch(() => ({}))
            console.error('Failed to reload properties after save:', errorData)
            // Don't clear properties if reload fails - keep current state
          }
        } catch (reloadError) {
          console.error('Failed to reload properties after save:', reloadError)
          // Don't throw - save was successful, just reload failed
          // Keep current properties state - don't clear them
        }
        
        return // Success - SaveButton will show success state
      } else {
        const errorData = await response.json()
        console.error('Save failed:', errorData)
        throw new Error(errorData.details || errorData.error || 'Failed to save properties')
      }
    } catch (error: any) {
      console.error('Error saving properties:', error)
      throw error // Re-throw so SaveButton can handle it
    }
  }

  // Render editable cell
  const renderEditableCell = (
    propertyId: string,
    field: string,
    displayValue: any,
    rawValue: any,
    isEditable: boolean = true,
    className: string = ""
  ) => {
    const isEditing = editingCell?.propertyId === propertyId && editingCell?.field === field

    if (!isEditable) {
      // Read-only cell (calculated values)
      return <span className={className}>{displayValue}</span>
    }

    if (isEditing) {
      if (field === "status") {
        return (
          <div className="flex items-center gap-1">
            <Select
              value={editValue}
              onValueChange={setEditValue}
              onOpenChange={(open) => {
                if (!open) {
                  // When select closes, save
                  handleCellSave()
                }
              }}
            >
              <SelectTrigger className="h-8 w-32" id={`edit-${propertyId}-${field}`} name={`edit-${propertyId}-${field}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rented">Rented</SelectItem>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="under_maintenance">Under Maintenance</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCellSave}
              className="h-8 w-8 p-0"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCellCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        )
      }

      if (field === "type") {
        return (
          <div className="flex items-center gap-1">
            <Select
              value={editValue}
              onValueChange={setEditValue}
              onOpenChange={(open) => {
                if (!open) {
                  // When select closes, save
                  handleCellSave()
                }
              }}
            >
              <SelectTrigger className="h-8 w-40" id={`edit-${propertyId}-${field}`} name={`edit-${propertyId}-${field}`}>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Single Family">Single Family</SelectItem>
                <SelectItem value="Multi-Family">Multi-Family</SelectItem>
                <SelectItem value="Condo">Condo</SelectItem>
                <SelectItem value="Townhouse">Townhouse</SelectItem>
                <SelectItem value="Commercial">Commercial</SelectItem>
                <SelectItem value="Land">Land</SelectItem>
                <SelectItem value="Duplex">Duplex</SelectItem>
                <SelectItem value="Triplex">Triplex</SelectItem>
                <SelectItem value="Quadplex">Quadplex</SelectItem>
                <SelectItem value="Mixed-Use">Mixed-Use</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCellSave}
              className="h-8 w-8 p-0"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCellCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        )
      }

      return (
        <div className="flex items-center gap-1">
          <Input
            id={`edit-${propertyId}-${field}`}
            name={`edit-${propertyId}-${field}`}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCellSave()
              } else if (e.key === "Escape") {
                handleCellCancel()
              }
            }}
            className={`h-8 ${field === "mortgageHolder" || field === "address" || field.startsWith("custom_") ? "w-48" : "w-32"}`}
            autoFocus
            type={typeof rawValue === "number" || (field.startsWith("custom_") && customFields.find(f => `custom_${f.id}` === field)?.type === 'number') ? "number" : "text"}
            placeholder={field === "mortgageHolder" ? "Enter mortgage holder name" : (field.startsWith("custom_") ? "Enter value" : "")}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCellSave}
            className="h-8 w-8 p-0"
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCellCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      )
    }

    return (
      <span
        className={`cursor-pointer hover:bg-muted/50 rounded px-1 transition-colors ${className}`}
        onClick={() => handleCellClick(propertyId, field, displayValue, rawValue)}
        title="Click to edit"
      >
        {displayValue || (field === "mortgageHolder" ? "Click to add" : "")}
      </span>
    )
  }

  // Export functions
  const exportToCSV = () => {
    const headers = [
      "Address",
      "Type",
      "Status",
      "Mortgage Holder",
      "Total Mortgage Amount",
      "Monthly Mortgage Payment",
      "Monthly Insurance",
      "Monthly Property Tax",
      "Monthly Other Costs",
      "Ownership",
      "Purchase Price",
      "Current Est. Value",
      "Monthly Gross Rent",
      "Total Costs",
      "Monthly Cashflow",
      "Annual ROI",
      "Rent Roll Units",
      "Work Requests",
      "Linked Websites",
    ]

    const rows = properties.map((p) => {
      const monthlyCosts = calculateMonthlyCosts(p)
      const monthlyCashflow = calculateMonthlyCashflow(p)
      const roi = calculateROI(p)

      return [
        p.address,
        p.type,
        p.status,
        p.mortgageHolder || "",
        (p.totalMortgageAmount || 0).toString(),
        (p.monthlyMortgagePayment || 0).toString(),
        (p.monthlyInsurance || 0).toString(),
        (p.monthlyPropertyTax || 0).toString(),
        (p.monthlyOtherCosts || 0).toString(),
        p.ownership || "",
        p.purchasePrice.toString(),
        p.currentEstValue.toString(),
        (p.monthlyGrossRent || 0).toString(),
        monthlyCosts.toString(),
        monthlyCashflow.toString(),
        roi.toString(),
        (p.rentRoll?.length || 0).toString(),
        (p.maintenanceRequests?.length || 0).toString(),
        p.linkedWebsites?.map((site: any) => site.name || site).join('; ') || '',
      ]
    })

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `properties_export_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(properties, null, 2)
    const blob = new Blob([jsonContent], { type: "application/json" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `properties_export_${new Date().toISOString().split("T")[0]}.json`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadSampleCSV = () => {
    const sampleHeaders = [
      "Address",
      "Type",
      "Status",
      "Mortgage Holder",
      "Total Mortgage Amount",
      "Purchase Price",
      "Current Est. Value",
      "Monthly Mortgage Payment",
      "Monthly Insurance",
      "Monthly Property Tax",
      "Monthly Other Costs",
      "Monthly Gross Rent",
    ]
    
    const sampleData = [
      [
        "123 Sample St, City, State",
        "House",
        "rented",
        "Sample Bank",
        "400000",
        "500000",
        "550000",
        "2500",
        "150",
        "600",
        "200",
        "3500",
      ],
    ]

    const csvContent = [sampleHeaders, ...sampleData]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "sample_properties_import.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Import functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset errors
    setImportError("")
    setImportSuccess("")

    // Validate file type
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setImportError("Please upload a CSV or TXT file")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        if (!text || text.trim().length === 0) {
          setImportError("File is empty")
          return
        }
        parseCSV(text)
      } catch (error) {
        setImportError(`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    reader.onerror = () => {
      setImportError("Error reading file. Please try again.")
    }
    reader.readAsText(file)
  }

  const parseCSV = (text: string) => {
    try {
      setImportError("")
      setImportSuccess("")

      // Handle different line endings (Windows \r\n, Mac \r, Unix \n)
      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const lines = normalizedText.split("\n").filter((line) => line.trim().length > 0)
      
      if (lines.length === 0) {
        setImportError("CSV file appears to be empty")
        return
      }

      if (lines.length < 2) {
        setImportError("CSV file must have at least a header row and one data row")
        return
      }

      // Parse CSV rows with proper quote handling
      const parsed = lines.map((line) => {
        const result: string[] = []
        let current = ""
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          const nextChar = i < line.length - 1 ? line[i + 1] : null
          
          if (char === '"') {
            // Handle escaped quotes ("")
            if (nextChar === '"') {
              current += '"'
              i++ // Skip next quote
            } else {
              inQuotes = !inQuotes
            }
          } else if (char === "," && !inQuotes) {
            result.push(current.trim())
            current = ""
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      })

      // Extract headers and clean them
      const headers = parsed[0]
        .map((h) => h.replace(/^["']|["']$/g, "").trim())
        .filter((h) => h.length > 0) // Filter out empty headers

      if (headers.length === 0) {
        setImportError("No valid headers found in CSV file")
        return
      }

      // Extract data rows, padding with empty strings if needed
      const data = parsed.slice(1)
        .map((row) => {
          // Pad row to match header length
          const padded = [...row]
          while (padded.length < headers.length) {
            padded.push("")
          }
          return padded.slice(0, headers.length)
        })
        .filter((row) => row.some((cell) => cell && cell.trim().length > 0)) // Filter completely empty rows

      if (data.length === 0) {
        setImportError("No data rows found in CSV file")
        return
      }

      // Check for column count mismatches (warning only)
      const expectedColumns = headers.length
      const invalidRows = data.filter((row) => row.length !== expectedColumns)
      if (invalidRows.length > 0) {
        console.warn(`Warning: ${invalidRows.length} rows have incorrect number of columns`)
      }

      setCsvHeaders(headers)
      setCsvData(data)
      
      // Generate initial mapping using utility function
      const initialMapping = generateInitialMapping(headers)
      setFieldMapping(initialMapping)
      
      setImportDialogOpen(true)
    } catch (error) {
      setImportError(`Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error("CSV parsing error:", error)
    }
  }

  const handleImport = () => {
    try {
      setImportError("")
      setImportSuccess("")

      // Validate required fields are mapped
      const validation = validateMapping(fieldMapping)
      if (!validation.valid) {
        const missingFields = validation.missingFields
          .map((field) => {
            // Convert camelCase to readable format
            return field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
          })
          .join(", ")
        setImportError(`Your CSV is missing mappings for: ${missingFields}. Please select a column for each required field.`)
        return
      }

      // Validate CSV data structure
      if (!Array.isArray(csvData) || csvData.length === 0) {
        setImportError("No data rows found to import")
        return
      }

      if (!Array.isArray(csvHeaders) || csvHeaders.length === 0) {
        setImportError("No headers found in CSV")
        return
      }

      const importedProperties: Property[] = []
      const errors: string[] = []

      // Process each row safely
      csvData.forEach((row, index) => {
        try {
          // Use utility function to safely map row to property
          const propertyPartial = mapCsvRowToProperty(row, csvHeaders, fieldMapping)

          // Validate required fields
          if (!propertyPartial.address || propertyPartial.address.trim() === "") {
            errors.push(`Row ${index + 2}: Missing required field 'address'`)
            return
          }

          // Create complete property with ID
          const property: Property = {
            id: `imported-${Date.now()}-${index}`,
            address: propertyPartial.address || "",
            type: propertyPartial.type || "",
            status: propertyPartial.status || "vacant",
            mortgageHolder: propertyPartial.mortgageHolder,
            purchasePrice: propertyPartial.purchasePrice || 0,
            currentEstValue: propertyPartial.currentEstValue || 0,
            monthlyMortgagePayment: propertyPartial.monthlyMortgagePayment || 0,
            monthlyInsurance: propertyPartial.monthlyInsurance || 0,
            monthlyPropertyTax: propertyPartial.monthlyPropertyTax || 0,
            monthlyOtherCosts: propertyPartial.monthlyOtherCosts || 0,
            monthlyGrossRent: propertyPartial.monthlyGrossRent || 0,
            rentRoll: propertyPartial.rentRoll || [],
            maintenanceRequests: propertyPartial.maintenanceRequests || propertyPartial.workRequests || [],
            linkedWebsites: Array.isArray(propertyPartial.linkedWebsites)
              ? propertyPartial.linkedWebsites.filter((item: any) =>
                  typeof item === 'object' && item !== null && 'id' in item && 'name' in item && 'linkedAt' in item
                )
              : [],
          }

          importedProperties.push(property)
        } catch (rowError) {
          errors.push(`Row ${index + 2}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`)
        }
      })

      if (errors.length > 0 && importedProperties.length === 0) {
        setImportError(`Import failed:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ""}`)
        return
      }

      if (importedProperties.length === 0) {
        setImportError("No valid properties found to import. Please check your CSV data and field mapping.")
        return
      }

      setProperties([...properties, ...importedProperties])
      setImportSuccess(`Successfully imported ${importedProperties.length} properties!${errors.length > 0 ? ` (${errors.length} warnings)` : ""}`)
      
      // Clear form after a delay
      setTimeout(() => {
        setImportDialogOpen(false)
        setCsvData([])
        setCsvHeaders([])
        setFieldMapping({})
        setImportError("")
        setImportSuccess("")
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }, 2000)
    } catch (error) {
      setImportError(`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error("Import error:", error)
    }
  }

  // Property field options for mapping (no empty string values)
  const propertyFields: { value: PropertyField; label: string }[] = [
    { value: "address", label: "Address" },
    { value: "type", label: "Type" },
    { value: "status", label: "Status" },
    { value: "mortgageHolder", label: "Mortgage Holder" },
    { value: "totalMortgageAmount", label: "Total Mortgage Amount" },
    { value: "purchasePrice", label: "Purchase Price" },
    { value: "currentEstValue", label: "Current Est. Value" },
    { value: "monthlyMortgagePayment", label: "Monthly Mortgage Payment" },
    { value: "monthlyInsurance", label: "Monthly Insurance" },
    { value: "monthlyPropertyTax", label: "Monthly Property Tax" },
    { value: "monthlyOtherCosts", label: "Monthly Other Costs" },
    { value: "monthlyGrossRent", label: "Monthly Gross Rent" },
  ]

  // Cleanup auto-save timeouts on unmount
  useEffect(() => {
    const timeouts = autoSaveTimeouts.current
    return () => {
      timeouts.forEach(timeoutId => clearTimeout(timeoutId))
      timeouts.clear()
    }
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <div className="text-muted-foreground">Loading properties...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Property Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Portfolio overview and financial tracking
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SaveButton onSave={handleSaveProperties} />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            id="csvFileInput"
            name="csvFileInput"
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        <Button
          onClick={() => {
            // Add a new property with default values (all required fields filled)
            const newProperty: Property = {
              id: `temp-${Date.now()}`, // Temporary ID until saved
              address: '', // Empty address - user will fill it in
              type: '', // Empty type - user will fill it in
              status: 'vacant', // Valid status
              totalMortgageAmount: 0,
              purchasePrice: 0,
              currentEstValue: 0,
              monthlyMortgagePayment: 0,
              monthlyInsurance: 0,
              monthlyPropertyTax: 0,
              monthlyOtherCosts: 0,
              monthlyGrossRent: 0,
              rentRoll: [],
              maintenanceRequests: [],
            }
            setProperties([...properties, newProperty])
            // Focus on the address field of the new row after a short delay
            setTimeout(() => {
              handleCellClick(newProperty.id, "address", "", "")
            }, 100)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger 
            value="parts" 
            className="flex items-center gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
          >
            <BarChart3 className="h-4 w-4" />
            Parts
          </TabsTrigger>
          <TabsTrigger 
            value="stats" 
            className="flex items-center gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white"
          >
            <TrendingUp className="h-4 w-4" />
            Stats
          </TabsTrigger>
          <TabsTrigger 
            value="insights" 
            className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
          >
            <Lightbulb className="h-4 w-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Parts Tab - Charts and Table View */}
        <TabsContent value="parts" className="space-y-4">
          {/* Charts Section */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Cash Flow by Property</CardTitle>
                <CardDescription>Visual breakdown of cash flow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sortedProperties.slice(0, 10).map((property) => {
                    const cashflow = calculateMonthlyCashflow(property)
                    const maxCashflow = Math.max(...sortedProperties.map(p => Math.abs(calculateMonthlyCashflow(p))), 1)
                    const percentage = Math.abs(cashflow) / maxCashflow * 100
                    return (
                      <div key={property.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{property.address}</span>
                          <span className={`font-semibold ml-2 ${
                            cashflow >= 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {formatCurrency(cashflow)}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              cashflow >= 0 ? "bg-green-500" : "bg-red-500"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Expenses Breakdown</CardTitle>
                <CardDescription>Total costs by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    const totalMortgage = sortedProperties.reduce((sum, p) => sum + (p.monthlyMortgagePayment || 0), 0)
                    const totalInsurance = sortedProperties.reduce((sum, p) => sum + (p.monthlyInsurance || 0), 0)
                    const totalTax = sortedProperties.reduce((sum, p) => sum + (p.monthlyPropertyTax || 0), 0)
                    const totalOther = sortedProperties.reduce((sum, p) => sum + (p.monthlyOtherCosts || 0), 0)
                    const totalCosts = totalMortgage + totalInsurance + totalTax + totalOther
                    
                    const expenses = [
                      { label: "Mortgage Payments", value: totalMortgage, color: "bg-blue-500" },
                      { label: "Insurance", value: totalInsurance, color: "bg-green-500" },
                      { label: "Property Tax", value: totalTax, color: "bg-yellow-500" },
                      { label: "Other Costs", value: totalOther, color: "bg-orange-500" },
                    ]

                    return expenses.map((expense) => {
                      const percentage = totalCosts > 0 ? (expense.value / totalCosts) * 100 : 0
                      return (
                        <div key={expense.label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{expense.label}</span>
                            <span className="font-semibold">{formatCurrency(expense.value)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${expense.color}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Filter by status:</span>
        <select
          id="statusFilter"
          name="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm w-full sm:w-auto min-h-[44px]"
        >
          <option value="all">All</option>
          <option value="rented">Rented</option>
          <option value="vacant">Vacant</option>
          <option value="under_maintenance">Under Maintenance</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table className="min-w-[1400px]">
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("address")}
              >
                <div className="flex items-center gap-2">
                  Address
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-2">
                  Status
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>Property Type</TableHead>
              <TableHead>Mortgage Holder</TableHead>
              <TableHead className="text-right">Total Mortgage</TableHead>
              <TableHead className="text-right">Monthly Mortgage</TableHead>
              <TableHead className="text-right">Monthly Insurance</TableHead>
              <TableHead className="text-right">Monthly Property Tax</TableHead>
              <TableHead className="text-right">Monthly Other Costs</TableHead>
              <TableHead>Partners</TableHead>
              <TableHead>Rent Roll</TableHead>
              <TableHead>Work Requests</TableHead>
              <TableHead>Linked Websites</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("currentEstValue")}
              >
                <div className="flex items-center justify-end gap-2">
                  Est. Value
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("purchasePrice")}
              >
                <div className="flex items-center justify-end gap-2">
                  Purchase Price
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("monthlyGrossRent")}
              >
                <div className="flex items-center justify-end gap-2">
                  Gross Rent
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-right">Total Costs</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("monthlyCashflow")}
              >
                <div className="flex items-center justify-end gap-2">
                  Cashflow
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort("roi")}
              >
                <div className="flex items-center justify-end gap-2">
                  Annual ROI
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
              <TableHead className="w-12"></TableHead>
              {customFields.map((field) => (
                <TableHead key={field.id} className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>{field.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Remove custom field from all properties
                        const fieldKey = `custom_${field.id}`
                        setProperties(properties.map(p => {
                          const updated = { ...p }
                          delete (updated as any)[fieldKey]
                          return updated
                        }))
                        // Remove from customFields list
                        setCustomFields(customFields.filter(f => f.id !== field.id))
                      }}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete custom field column"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-12">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddCustomFieldDialogOpen(true)}
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                  title="Add custom field column"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProperties.map((property) => {
              const monthlyCosts = calculateMonthlyCosts(property)
              const monthlyCashflow = calculateMonthlyCashflow(property)
              const roi = calculateROI(property)
              
              // Check if property needs attention
              const pendingWorkRequests = property.maintenanceRequests?.filter(
                (wr) => wr.status === "new" || wr.status === "in_progress"
              ).length || 0
              const hasNegativeCashflow = monthlyCashflow < 0
              const needsAttention = hasNegativeCashflow || pendingWorkRequests > 0
              const isHealthy = !needsAttention && monthlyCashflow > 0

              return (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {needsAttention && (
                        <span title="Needs Attention">
                          <Star className="h-4 w-4 text-red-500 fill-red-500" />
                        </span>
                      )}
                      {isHealthy && (
                        <span title="All Good">
                          <Star className="h-4 w-4 text-green-500 fill-green-500" />
                        </span>
                      )}
                      {renderEditableCell(
                        property.id,
                        "address",
                        property.address,
                        property.address,
                        true,
                        "font-medium"
                      )}
                      {/* Save Status Indicators (only for existing properties) */}
                      {!property.id.startsWith('temp-') && (
                        <>
                          {savingProperties.has(property.id) && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>
                              <span className="text-xs">Saving...</span>
                            </div>
                          )}
                          {savedProperties.has(property.id) && (
                            <div className="flex items-center gap-1 text-green-600">
                              <Check className="h-3 w-3" />
                              <span className="text-xs">Saved</span>
                            </div>
                          )}
                          {saveErrors.has(property.id) && (
                            <div
                              className="flex items-center gap-1 text-red-600 cursor-help"
                              title={saveErrors.get(property.id)}
                            >
                              <X className="h-3 w-3" />
                              <span className="text-xs">Error</span>
                            </div>
                          )}
                        </>
                      )}
                      {/* New Property Indicator */}
                      {property.id.startsWith('temp-') && (
                        <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                          New
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingCell?.propertyId === property.id && editingCell?.field === "status" ? (
                      renderEditableCell(property.id, "status", property.status, property.status, true)
                    ) : (
                      <Badge
                        variant={getStatusBadgeVariant(property.status)}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleCellClick(property.id, "status", property.status, property.status)}
                      >
                        {property.status.replace("_", " ")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.propertyId === property.id && editingCell?.field === "type" ? (
                      renderEditableCell(property.id, "type", property.type || "Unknown", property.type || "", true)
                    ) : (
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:opacity-80 transition-opacity text-xs"
                        onClick={() => handleCellClick(property.id, "type", property.type || "Unknown", property.type || "")}
                      >
                        {property.type || "Unknown"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {renderEditableCell(
                      property.id,
                      "mortgageHolder",
                      property.mortgageHolder || "Click to add",
                      property.mortgageHolder || "",
                      true,
                      property.mortgageHolder ? "" : "text-muted-foreground italic"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "totalMortgageAmount",
                      formatCurrency(property.totalMortgageAmount || 0),
                      property.totalMortgageAmount || 0,
                      true
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "monthlyMortgagePayment",
                      formatCurrency(property.monthlyMortgagePayment || 0),
                      property.monthlyMortgagePayment || 0,
                      true
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "monthlyInsurance",
                      formatCurrency(property.monthlyInsurance || 0),
                      property.monthlyInsurance || 0,
                      true
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "monthlyPropertyTax",
                      formatCurrency(property.monthlyPropertyTax || 0),
                      property.monthlyPropertyTax || 0,
                      true
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "monthlyOtherCosts",
                      formatCurrency(property.monthlyOtherCosts || 0),
                      property.monthlyOtherCosts || 0,
                      true
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.propertyId === property.id && editingCell?.field === "ownership" ? (
                      <div className="flex items-center gap-1">
                        <Select
                          value={editValue || "100% ownership"}
                          onValueChange={setEditValue}
                          onOpenChange={(open) => {
                            if (!open) {
                              handleCellSave()
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 w-40" id={`edit-${property.id}-ownership`} name={`edit-${property.id}-ownership`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100% ownership">100% ownership</SelectItem>
                            <SelectItem value="50% partner">50% partner</SelectItem>
                            <SelectItem value="25% partner">25% partner</SelectItem>
                            <SelectItem value="75% partner">75% partner</SelectItem>
                            <SelectItem value="33% partner">33% partner</SelectItem>
                            <SelectItem value="67% partner">67% partner</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCellSave}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCellCancel}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-muted/50 rounded px-1 transition-colors"
                        onClick={() => handleCellClick(property.id, "ownership", property.ownership || "100% ownership", property.ownership || "100% ownership")}
                        title="Click to edit"
                      >
                        {property.ownership || "100% ownership"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {property.rentRoll && property.rentRoll.length > 0 ? (
                      <div
                        className={`flex flex-col gap-1 rounded p-1 -m-1 transition-colors ${
                          property.id.startsWith('temp-')
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer hover:bg-muted/50'
                        }`}
                        onClick={() => !property.id.startsWith('temp-') && openModalWithTab(property, "rent-roll")}
                        title={property.id.startsWith('temp-') ? "Save property first to manage units" : undefined}
                      >
                        <Badge variant="secondary" className="text-xs w-fit">
                          {property.rentRoll.length} unit{property.rentRoll.length > 1 ? 's' : ''}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Total: {formatCurrency(property.rentRoll.reduce((sum, unit) => sum + unit.monthlyRent, 0))}
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-auto p-1 text-xs ${
                          property.id.startsWith('temp-')
                            ? 'text-muted-foreground/50 cursor-not-allowed'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => !property.id.startsWith('temp-') && openModalWithTab(property, "rent-roll")}
                        disabled={property.id.startsWith('temp-')}
                        title={property.id.startsWith('temp-') ? "Save property first to manage units" : undefined}
                      >
                        <Building className="h-3 w-3 mr-1" />
                        Manage Units
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-1">
                      {property.maintenanceRequests && property.maintenanceRequests.length > 0 ? (
                        <>
                          <Badge
                            variant="outline"
                            className={`text-xs w-fit ${
                              property.id.startsWith('temp-')
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer hover:bg-muted'
                            }`}
                            onClick={() => !property.id.startsWith('temp-') && openModalWithTab(property, "maintenance")}
                            title={property.id.startsWith('temp-') ? "Save property first to manage maintenance" : undefined}
                          >
                            {property.maintenanceRequests.length} request{property.maintenanceRequests.length > 1 ? 's' : ''}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {property.maintenanceRequests.filter(wr => wr.status === 'new' || wr.status === 'in_progress').length} pending
                          </div>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-auto p-1 text-xs ${
                            property.id.startsWith('temp-')
                              ? 'text-muted-foreground/50 cursor-not-allowed'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => !property.id.startsWith('temp-') && openModalWithTab(property, "maintenance")}
                          disabled={property.id.startsWith('temp-')}
                          title={property.id.startsWith('temp-') ? "Save property first to manage maintenance" : undefined}
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          Manage Requests
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col gap-1">
                      {property.linkedWebsites && property.linkedWebsites.length > 0 ? (
                        <>
                          <Badge
                            variant="secondary"
                            className={`text-xs w-fit ${
                              property.id.startsWith('temp-')
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer hover:bg-muted'
                            }`}
                            onClick={() => !property.id.startsWith('temp-') && openModalWithTab(property, "websites")}
                            title={property.id.startsWith('temp-') ? "Save property first to manage websites" : undefined}
                          >
                            {property.linkedWebsites.length} site{property.linkedWebsites.length > 1 ? 's' : ''}
                          </Badge>
                          <div className="text-xs text-muted-foreground max-w-32 truncate">
                            {property.linkedWebsites.slice(0, 2).map((site: any) => site.name || site).join(', ')}
                            {property.linkedWebsites.length > 2 && ` +${property.linkedWebsites.length - 2} more`}
                          </div>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-auto p-1 text-xs ${
                            property.id.startsWith('temp-')
                              ? 'text-muted-foreground/50 cursor-not-allowed'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => !property.id.startsWith('temp-') && openModalWithTab(property, "websites")}
                          disabled={property.id.startsWith('temp-')}
                          title={property.id.startsWith('temp-') ? "Save property first to manage websites" : undefined}
                        >
                          <Globe className="h-3 w-3 mr-1" />
                          Manage Links
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "currentEstValue",
                      formatCurrency(property.currentEstValue),
                      property.currentEstValue ?? 0,
                      true
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "purchasePrice",
                      formatCurrency(property.purchasePrice),
                      property.purchasePrice ?? 0,
                      true
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "monthlyGrossRent",
                      formatCurrency(property.monthlyGrossRent),
                      property.monthlyGrossRent ?? 0,
                      true
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(
                      property.id,
                      "monthlyTotalCosts",
                      formatCurrency(monthlyCosts),
                      monthlyCosts ?? 0,
                      true
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      monthlyCashflow >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {renderEditableCell(
                      property.id,
                      "monthlyCashflow",
                      formatCurrency(monthlyCashflow),
                      monthlyCashflow,
                      false
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderEditableCell(property.id, "roi", formatPercentage(roi), roi, false)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {/* Save Button for New Properties */}
                      {property.id.startsWith('temp-') && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSaveNewProperty(property.id)}
                          disabled={savingProperties.has(property.id) || !property.address?.trim() || !property.type?.trim()}
                          className="h-8 px-3"
                          title={
                            savingProperties.has(property.id)
                              ? "Saving..."
                              : !property.address?.trim() || !property.type?.trim()
                              ? "Fill address and type to save"
                              : "Save new property"
                          }
                        >
                          {savingProperties.has(property.id) ? (
                            <>
                              <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-3 w-3 mr-2" />
                              Save
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openModalWithTab(property, "overview")}
                        disabled={property.id.startsWith('temp-')}
                        title={property.id.startsWith('temp-') ? "Save property first to access details" : "View property details"}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Details
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProperty(property.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  {customFields.map((field) => {
                    const fieldKey = `custom_${field.id}`
                    const fieldValue = (property as any)[fieldKey] || ""
                    return (
                      <TableCell key={field.id} className={field.type === 'number' ? "text-right" : ""}>
                        {renderEditableCell(
                          property.id,
                          fieldKey,
                          field.type === 'number' 
                            ? (fieldValue ? formatCurrency(parseFloat(String(fieldValue)) || 0) : "Click to add")
                            : (fieldValue || "Click to add"),
                          fieldValue || "",
                          true,
                          fieldValue ? "" : "text-muted-foreground italic"
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="font-bold bg-muted/50">
              <TableCell colSpan={5}>Portfolio Totals</TableCell>
              <TableCell></TableCell> {/* Property Type */}
              <TableCell></TableCell> {/* Mortgage Holder */}
              <TableCell></TableCell> {/* Total Mortgage */}
              <TableCell className="text-right">
                {formatCurrency(
                  sortedProperties.reduce((sum, p) => sum + (p.monthlyMortgagePayment || 0), 0)
                )}
              </TableCell> {/* Monthly Mortgage */}
              <TableCell className="text-right">
                {formatCurrency(
                  sortedProperties.reduce((sum, p) => sum + (p.monthlyInsurance || 0), 0)
                )}
              </TableCell> {/* Monthly Insurance */}
              <TableCell className="text-right">
                {formatCurrency(
                  sortedProperties.reduce((sum, p) => sum + (p.monthlyPropertyTax || 0), 0)
                )}
              </TableCell> {/* Monthly Property Tax */}
              <TableCell className="text-right">
                {formatCurrency(
                  sortedProperties.reduce((sum, p) => sum + (p.monthlyOtherCosts || 0), 0)
                )}
              </TableCell> {/* Monthly Other Costs */}
              <TableCell></TableCell> {/* Partners */}
              <TableCell className="text-sm">
                <div className="text-xs">
                  {sortedProperties.reduce((sum, p) => sum + (p.rentRoll?.length || 0), 0)} total units
                </div>
              </TableCell> {/* Rent Roll */}
              <TableCell className="text-sm">
                <div className="text-xs">
                  {sortedProperties.reduce((sum, p) => sum + (p.maintenanceRequests?.length || 0), 0)} total requests
                </div>
              </TableCell> {/* Work Requests */}
              <TableCell></TableCell> {/* Linked Websites */}
              <TableCell className="text-right">
                {formatCurrency(portfolioTotals.totalEstValue)}
              </TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell
                className={`text-right ${
                  portfolioTotals.totalMonthlyCashflow >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(portfolioTotals.totalMonthlyCashflow)}
              </TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              {customFields.map((field) => (
                <TableCell key={field.id}></TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
        </TabsContent>

        {/* Stats Tab - Key Metrics and Numbers */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sortedProperties.length}</div>
                <p className="text-xs text-muted-foreground">
                  {sortedProperties.filter(p => p.status === 'rented').length} rented
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(portfolioTotals.totalEstValue)}</div>
                <p className="text-xs text-muted-foreground">
                  Average: {formatCurrency(sortedProperties.length > 0 ? portfolioTotals.totalEstValue / sortedProperties.length : 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Cash Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  portfolioTotals.totalMonthlyCashflow >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {formatCurrency(portfolioTotals.totalMonthlyCashflow)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Annual: {formatCurrency(portfolioTotals.totalMonthlyCashflow * 12)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average ROI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercentage(
                    sortedProperties.length > 0
                      ? sortedProperties.reduce((sum, p) => sum + calculateROI(p), 0) / sortedProperties.length
                      : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {sortedProperties.filter(p => calculateROI(p) > 10).length} properties &gt; 10%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>Properties with highest ROI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...sortedProperties]
                    .sort((a, b) => calculateROI(b) - calculateROI(a))
                    .slice(0, 5)
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{p.address}</p>
                          <p className="text-xs text-muted-foreground">
                            Cash Flow: {formatCurrency(calculateMonthlyCashflow(p))}/mo
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-green-600">
                            {formatPercentage(calculateROI(p))}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Needs Attention</CardTitle>
                <CardDescription>Properties with negative cash flow or low ROI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...sortedProperties]
                    .filter((p) => calculateMonthlyCashflow(p) < 0 || calculateROI(p) < 5)
                    .sort((a, b) => calculateMonthlyCashflow(a) - calculateMonthlyCashflow(b))
                    .slice(0, 5)
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{p.address}</p>
                          <p className="text-xs text-muted-foreground">
                            Cash Flow: {formatCurrency(calculateMonthlyCashflow(p))}/mo
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            calculateROI(p) < 0 ? "text-red-600" : "text-yellow-600"
                          }`}>
                            {formatPercentage(calculateROI(p))}
                          </p>
                        </div>
                      </div>
                    ))}
                  {sortedProperties.filter((p) => calculateMonthlyCashflow(p) < 0 || calculateROI(p) < 5).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">All properties performing well!</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Portfolio Statistics</CardTitle>
              <CardDescription>Key metrics and outliers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Highest Cash Flow</p>
                  <p className="text-lg font-semibold">
                    {sortedProperties.length > 0
                      ? formatCurrency(Math.max(...sortedProperties.map((p) => calculateMonthlyCashflow(p))))
                      : "$0"}
                  </p>
                  {sortedProperties.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {sortedProperties.find((p) => 
                        calculateMonthlyCashflow(p) === Math.max(...sortedProperties.map((p) => calculateMonthlyCashflow(p)))
                      )?.address}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Lowest Cash Flow</p>
                  <p className="text-lg font-semibold">
                    {sortedProperties.length > 0
                      ? formatCurrency(Math.min(...sortedProperties.map((p) => calculateMonthlyCashflow(p))))
                      : "$0"}
                  </p>
                  {sortedProperties.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {sortedProperties.find((p) => 
                        calculateMonthlyCashflow(p) === Math.min(...sortedProperties.map((p) => calculateMonthlyCashflow(p)))
                      )?.address}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Average Monthly Costs</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(
                      sortedProperties.length > 0
                        ? sortedProperties.reduce((sum, p) => sum + calculateMonthlyCosts(p), 0) / sortedProperties.length
                        : 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab - AI-Powered Recommendations */}
        <TabsContent value="insights" className="space-y-4">
          {/* AI-Powered Portfolio Insights */}
          <PortfolioAIInsights
            properties={properties}
            portfolioMetrics={portfolioTotals}
          />
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Properties from CSV</DialogTitle>
            <DialogDescription>
              Map CSV columns to property fields. You can preview the first few rows below.
              <Button
                variant="link"
                className="p-0 h-auto text-primary ml-2"
                onClick={downloadSampleCSV}
              >
                Download sample CSV
              </Button>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Error Message */}
            {importError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">{importError}</p>
              </div>
            )}
            
            {/* Success Message */}
            {importSuccess && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">{importSuccess}</p>
              </div>
            )}
            {/* Field Mapping */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                <Label>Field Mapping</Label>
                <span className="text-xs text-muted-foreground">
                  {csvHeaders.length} columns detected
                  </span>
                </div>
              <div className="border rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
                {csvHeaders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No headers detected. Please check your CSV file format.
                  </p>
                ) : (
                  csvHeaders
                    .filter((h) => h && h.trim() !== "")
                    .map((header, index) => {
                      // Find which PropertyField is mapped to this header
                      const currentMapping = Object.entries(fieldMapping).find(
                        ([_, mappedHeader]) => mappedHeader === header
                      )?.[0] as PropertyField | undefined

                      return (
                        <div key={`${header}-${index}`} className="flex items-center gap-2">
                          <div className="flex-1 text-sm font-medium truncate" title={header}>
                            {header}
                          </div>
                          <div className="text-sm text-muted-foreground">→</div>
                          <Select
                            value={currentMapping || undefined}
                            onValueChange={(value) => {
                              if (value === "__unmapped") {
                                // Remove mapping - find and remove the entry
                                const newMapping = { ...fieldMapping }
                                Object.keys(newMapping).forEach((key) => {
                                  if (newMapping[key as PropertyField] === header) {
                                    delete newMapping[key as PropertyField]
                                  }
                                })
                                setFieldMapping(newMapping)
                              } else {
                                // Set mapping - remove old mapping first if exists
                                const newMapping = { ...fieldMapping }
                                Object.keys(newMapping).forEach((key) => {
                                  if (newMapping[key as PropertyField] === header) {
                                    delete newMapping[key as PropertyField]
                                  }
                                })
                                // Add new mapping
                                newMapping[value as PropertyField] = header
                                setFieldMapping(newMapping)
                              }
                            }}
                          >
                            <SelectTrigger
                              className="w-64"
                              id={`csv-mapping-${header}`}
                              name={`csv-mapping-${header}`}
                            >
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              {propertyFields.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                              <SelectItem value="__unmapped">Unmapped / Ignore</SelectItem>
                            </SelectContent>
                          </Select>
                          <input
                            type="hidden"
                            name={`csv-mapping-${header}`}
                            value={currentMapping || ""}
                          />
                        </div>
                      )
                    })
                )}
              </div>
              {(() => {
                const validation = validateMapping(fieldMapping)
                if (!validation.valid && csvHeaders.length > 0) {
                  const missingFields = validation.missingFields
                    .map((field) => {
                      return field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
                    })
                    .join(", ")
                  return (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Please map the following required fields: {missingFields}
                    </p>
                  )
                }
                return null
              })()}
            </div>

            {/* Preview */}
            {csvData.length > 0 && (
              <div className="space-y-2">
                <Label>Preview (first 3 rows)</Label>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.map((header, index) => (
                          <TableHead key={index} className="text-xs">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 3).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {csvHeaders.map((header, cellIndex) => (
                            <TableCell key={`${header}-${cellIndex}`} className="text-xs">
                              {row[cellIndex]
                                ? String(row[cellIndex])
                                    .replace(/^["']|["']$/g, "")
                                    .substring(0, 30)
                                : ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
      </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={csvData.length === 0 || !validateMapping(fieldMapping).valid}
            >
              Import {csvData.length} Properties
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Field Dialog */}
      <Dialog open={addCustomFieldDialogOpen} onOpenChange={setAddCustomFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Field Column</DialogTitle>
            <DialogDescription>
              Add a new custom field column to track additional property information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customFieldName">Field Name</Label>
              <Input
                id="customFieldName"
                value={newCustomFieldName}
                onChange={(e) => setNewCustomFieldName(e.target.value)}
                placeholder="e.g., Notes, Year Built, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customFieldType">Field Type</Label>
              <Select
                value={newCustomFieldType}
                onValueChange={(value: 'text' | 'number') => setNewCustomFieldType(value)}
              >
                <SelectTrigger id="customFieldType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddCustomFieldDialogOpen(false)
              setNewCustomFieldName("")
              setNewCustomFieldType('text')
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newCustomFieldName.trim()) {
                  const newField = {
                    id: `field_${Date.now()}`,
                    name: newCustomFieldName.trim(),
                    type: newCustomFieldType,
                  }
                  setCustomFields([...customFields, newField])
                  // Initialize custom field values for all existing properties
                  setProperties(properties.map(p => ({
                    ...p,
                    [`custom_${newField.id}`]: newField.type === 'number' ? 0 : ""
                  })))
                  setAddCustomFieldDialogOpen(false)
                  setNewCustomFieldName("")
                  setNewCustomFieldType('text')
                }
              }}
              disabled={!newCustomFieldName.trim()}
            >
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Property Details Modal */}
      {selectedProperty && (
        <PropertyDetailsModal
          property={selectedProperty}
          isOpen={isModalOpen}
          defaultTab={defaultModalTab}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedProperty(null)
            setDefaultModalTab("overview")
          }}
          onSave={handlePropertyUpdate}
        />
      )}
    </div>
  )
}
