"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Property, PropertyPhoto, LinkedWebsite } from "@/types"
import { Upload, Trash2, FileText, X, Loader2, Building, Wrench, Globe, Plus } from "lucide-react"
import Image from "next/image"
import { useUser } from "@clerk/nextjs"
import { activityTracker } from "@/lib/activity-tracker"

interface PropertyDetailsModalProps {
  property: Property
  isOpen: boolean
  onClose: () => void
  onSave: (propertyId: string, updates: Partial<Property>) => void
  defaultTab?: "overview" | "rent-roll" | "maintenance" | "websites"
}

export function PropertyDetailsModal({ property, isOpen, onClose, onSave, defaultTab = "overview" }: PropertyDetailsModalProps) {
  console.log("Modal opened with defaultTab:", defaultTab)
  const { user } = useUser()
  const userId = user?.id
  const [notes, setNotes] = useState(property.notes || "")
  const [photos, setPhotos] = useState<PropertyPhoto[]>(property.photos || [])
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)
  const [isLoadingWebsites, setIsLoadingWebsites] = useState(false)

  // Form states for different tabs
  const [showAddUnitForm, setShowAddUnitForm] = useState(false)
  const [showAddRequestForm, setShowAddRequestForm] = useState(false)
  const [showAddWebsiteForm, setShowAddWebsiteForm] = useState(false)

  // Unit form data
  const [unitData, setUnitData] = useState({
    unitName: "",
    tenantName: "",
    monthlyRent: "",
    leaseStart: "",
    leaseEnd: "",
    securityDeposit: ""
  })

  // Request form data
  const [requestData, setRequestData] = useState({
    description: "",
    cost: "",
    status: "new" as "new" | "in_progress" | "completed"
  })

  // Website form data
  const [websiteData, setWebsiteData] = useState({
    websiteId: "",
    websiteName: ""
  })

  // Edit mode state
  const [editingUnit, setEditingUnit] = useState<any>(null)
  const [editingRequest, setEditingRequest] = useState<any>(null)
  const [editingWebsite, setEditingWebsite] = useState<any>(null)

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    setIsUploading(true)
    try {
      // Convert files to base64 data URLs for persistence
      const newPhotos = await Promise.all(
        Array.from(files).map(async (file) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })

          return {
            id: crypto.randomUUID(),
            url: base64, // Base64 data URL that persists
            filename: file.name,
            uploadedAt: new Date().toISOString(),
            description: ""
          }
        })
      )

      setPhotos(prev => [...prev, ...newPhotos])

      // Log photo upload activity
      if (userId && newPhotos.length > 0) {
        try {
          await activityTracker.logPhotosUploaded(userId, newPhotos.length, property.address)
        } catch (activityError) {
          console.error('Failed to log photo upload activity:', activityError)
        }
      }
    } catch (error) {
      console.error("Photo upload failed:", error)
    } finally {
      setIsUploading(false)
    }
  }

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  const handleAddUnit = async () => {
    try {
      const newUnit = {
        id: crypto.randomUUID(),
        unitName: unitData.unitName,
        tenantName: unitData.tenantName,
        monthlyRent: parseFloat(unitData.monthlyRent) || 0,
        leaseStart: unitData.leaseStart,
        leaseEnd: unitData.leaseEnd,
        securityDeposit: parseFloat(unitData.securityDeposit) || 0
      }

      const updatedRentRoll = [...(property.rentRoll || []), newUnit]

      await onSave(property.id, { rentRoll: updatedRentRoll })

      alert(`Unit "${unitData.unitName}" added successfully!`)
      setUnitData({ unitName: "", tenantName: "", monthlyRent: "", leaseStart: "", leaseEnd: "", securityDeposit: "" })
      setShowAddUnitForm(false)
    } catch (error) {
      console.error("Failed to add unit:", error)
      alert("Failed to add rental unit. Please try again.")
    }
  }

  const handleEditUnit = (unit: any) => {
    setEditingUnit(unit)
    setUnitData({
      unitName: unit.unitName || "",
      tenantName: unit.tenantName || "",
      monthlyRent: unit.monthlyRent?.toString() || "",
      leaseStart: unit.leaseStart || "",
      leaseEnd: unit.leaseEnd || "",
      securityDeposit: unit.securityDeposit?.toString() || ""
    })
    setShowAddUnitForm(true)
  }

  const handleSaveEditUnit = async () => {
    if (!editingUnit) return

    try {
      const updatedUnit = {
        id: editingUnit.id,
        unitName: unitData.unitName,
        tenantName: unitData.tenantName,
        monthlyRent: parseFloat(unitData.monthlyRent) || 0,
        leaseStart: unitData.leaseStart,
        leaseEnd: unitData.leaseEnd,
        securityDeposit: parseFloat(unitData.securityDeposit) || 0
      }

      const updatedRentRoll = property.rentRoll?.map((unit: any) =>
        unit.id === editingUnit.id ? updatedUnit : unit
      ) || []

      await onSave(property.id, { rentRoll: updatedRentRoll })

      alert(`Unit "${unitData.unitName}" updated successfully!`)
      setUnitData({ unitName: "", tenantName: "", monthlyRent: "", leaseStart: "", leaseEnd: "", securityDeposit: "" })
      setShowAddUnitForm(false)
      setEditingUnit(null)
    } catch (error) {
      console.error("Failed to update unit:", error)
      alert("Failed to update rental unit. Please try again.")
    }
  }

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("Are you sure you want to delete this rental unit?")) return

    try {
      const updatedRentRoll = property.rentRoll?.filter((unit: any) => unit.id !== unitId) || []

      await onSave(property.id, { rentRoll: updatedRentRoll })

      alert("Unit deleted successfully!")
    } catch (error) {
      console.error("Failed to delete unit:", error)
      alert("Failed to delete rental unit. Please try again.")
    }
  }

  const handleEditRequest = (request: any) => {
    setEditingRequest(request)
    setRequestData({
      description: request.description || "",
      cost: request.cost?.toString() || "",
      status: request.status || "new"
    })
    setShowAddRequestForm(true)
  }

  const handleSaveEditRequest = async () => {
    if (!editingRequest) return

    setIsLoadingRequests(true)
    try {
      const updatedRequest = {
        id: editingRequest.id,
        description: requestData.description,
        status: requestData.status,
        cost: parseFloat(requestData.cost) || 0,
        dateLogged: editingRequest.dateLogged // Preserve original date
      }

      const updatedRequests = property.maintenanceRequests?.map((request: any) =>
        request.id === editingRequest.id ? updatedRequest : request
      ) || []

      await onSave(property.id, { maintenanceRequests: updatedRequests })

      // Log activity
      if (userId) {
        try {
          await activityTracker.logMaintenanceRequestUpdated(
            userId,
            property.address,
            requestData.description,
            requestData.status,
            (property as any).workspace_id // Add workspace ID
          )
        } catch (activityError) {
          console.error('Failed to log maintenance request update activity:', activityError)
        }
      }

      alert(`Maintenance request updated successfully!`)
      setRequestData({ description: "", cost: "", status: "new" })
      setShowAddRequestForm(false)
      setEditingRequest(null)
    } catch (error) {
      console.error("Failed to update maintenance request:", error)
      alert("Failed to update maintenance request. Please try again.")
    } finally {
      setIsLoadingRequests(false)
    }
  }

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm("Are you sure you want to delete this maintenance request?")) return

    setIsLoadingRequests(true)
    try {
      // Find the request being deleted to log its description
      const requestToDelete = property.maintenanceRequests?.find((request: any) => request.id === requestId)

      const updatedRequests = property.maintenanceRequests?.filter((request: any) => request.id !== requestId) || []

      await onSave(property.id, { maintenanceRequests: updatedRequests })

      // Log activity
      if (userId && requestToDelete) {
        try {
          await activityTracker.logMaintenanceRequestDeleted(
            userId,
            property.address,
            requestToDelete.description,
            (property as any).workspace_id // Add workspace ID
          )
        } catch (activityError) {
          console.error('Failed to log maintenance request deletion activity:', activityError)
        }
      }

      alert("Maintenance request deleted successfully!")
    } catch (error) {
      console.error("Failed to delete maintenance request:", error)
      alert("Failed to delete maintenance request. Please try again.")
    } finally {
      setIsLoadingRequests(false)
    }
  }

  const handleEditWebsite = (website: any) => {
    setEditingWebsite(website)
    setWebsiteData({
      websiteId: website.id || "",
      websiteName: website.name || ""
    })
    setShowAddWebsiteForm(true)
  }

  const handleSaveEditWebsite = async () => {
    if (!editingWebsite) return

    setIsLoadingWebsites(true)
    try {
      const updatedWebsite = {
        id: websiteData.websiteId,
        name: websiteData.websiteName,
        linkedAt: editingWebsite.linkedAt // Preserve original link date
      }

      const updatedWebsites = property.linkedWebsites?.map((website: any) =>
        website.id === editingWebsite.id ? updatedWebsite : website
      ) || []

      await onSave(property.id, { linkedWebsites: updatedWebsites })

      alert(`Website updated successfully!`)
      setWebsiteData({ websiteId: "", websiteName: "" })
      setShowAddWebsiteForm(false)
      setEditingWebsite(null)
    } catch (error) {
      console.error("Failed to update website:", error)
      alert("Failed to update website. Please try again.")
    } finally {
      setIsLoadingWebsites(false)
    }
  }

  const handleDeleteWebsite = async (websiteId: string) => {
    if (!confirm("Are you sure you want to unlink this website?")) return

    setIsLoadingWebsites(true)
    try {
      const updatedWebsites = property.linkedWebsites?.filter((website: any) => website.id !== websiteId) || []

      await onSave(property.id, { linkedWebsites: updatedWebsites })

      alert("Website unlinked successfully!")
    } catch (error) {
      console.error("Failed to unlink website:", error)
      alert("Failed to unlink website. Please try again.")
    } finally {
      setIsLoadingWebsites(false)
    }
  }

  const handleAddRequest = async () => {
    setIsLoadingRequests(true)
    try {
      const newRequest = {
        id: crypto.randomUUID(),
        description: requestData.description,
        status: requestData.status,
        cost: parseFloat(requestData.cost) || 0,
        dateLogged: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      }

      const updatedRequests = [...(property.maintenanceRequests || []), newRequest]

      await onSave(property.id, { maintenanceRequests: updatedRequests })

      // Log activity
      if (userId) {
        try {
          await activityTracker.logMaintenanceRequestAdded(
            userId,
            property.address,
            requestData.description,
            parseFloat(requestData.cost) || 0,
            (property as any).workspace_id // Add workspace ID
          )
        } catch (activityError) {
          console.error('Failed to log maintenance request addition activity:', activityError)
        }
      }

      alert(`Maintenance request logged successfully!`)
      setRequestData({ description: "", cost: "", status: "new" })
      setShowAddRequestForm(false)
    } catch (error) {
      console.error("Failed to add maintenance request:", error)
      alert("Failed to log maintenance request. Please try again.")
    } finally {
      setIsLoadingRequests(false)
    }
  }

  const handleAddWebsite = async () => {
    setIsLoadingWebsites(true)
    try {
      const newWebsite = {
        id: websiteData.websiteId,
        name: websiteData.websiteName,
        linkedAt: new Date().toISOString()
      }

      const updatedWebsites = [...(property.linkedWebsites || []), newWebsite]

      await onSave(property.id, { linkedWebsites: updatedWebsites })

      alert(`Website "${websiteData.websiteName}" linked successfully!`)
      setWebsiteData({ websiteId: "", websiteName: "" })
      setShowAddWebsiteForm(false)
    } catch (error) {
      console.error("Failed to link website:", error)
      alert("Failed to link website. Please try again.")
    } finally {
      setIsLoadingWebsites(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(property.id, {
        notes,
        photos,
        maintenanceRequests: property.maintenanceRequests || [],
        linkedWebsites: property.linkedWebsites || []
      })
    } catch (error) {
      console.error("Save failed:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return "$0"
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {property.address}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(90vh-8rem)] overflow-hidden">
          <Tabs defaultValue={defaultTab} className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rent-roll">
              <Building className="h-4 w-4 mr-2" />
              Rent Roll
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <Wrench className="h-4 w-4 mr-2" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="websites">
              <Globe className="h-4 w-4 mr-2" />
              Websites
            </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-y-auto space-y-6">
          {/* Property Info Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{property.type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant="outline">{property.status.replace("_", " ")}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Monthly Rent</Label>
                  <p className="font-medium">{formatCurrency(property.monthlyGrossRent)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Est. Value</Label>
                  <p className="font-medium">{formatCurrency(property.currentEstValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="notes">Property Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this property..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Photos Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Property Photos ({photos.length})</Label>
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                  disabled={isUploading}
                />
                <Label htmlFor="photo-upload">
                  <Button variant="outline" size="sm" asChild disabled={isUploading}>
                    <span className="cursor-pointer">
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {isUploading ? "Uploading..." : "Add Photos"}
                    </span>
                  </Button>
                </Label>
              </div>
            </div>

            {/* Photo Grid */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <Image
                      src={photo.url}
                      alt={photo.filename}
                      width={200}
                      height={128}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={() => removePhoto(photo.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs text-white bg-black/50 rounded px-2 py-1 truncate">
                        {photo.filename}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {photos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No photos uploaded yet</p>
                <p className="text-sm">Click &quot;Add Photos&quot; to upload images</p>
              </div>
            )}
          </div>
            </TabsContent>

            {/* Rent Roll Tab */}
            <TabsContent value="rent-roll" className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Rental Units</h3>
                <Button size="sm" onClick={() => {
                  if (showAddUnitForm) {
                    setShowAddUnitForm(false)
                    setEditingUnit(null)
                    setUnitData({ unitName: "", tenantName: "", monthlyRent: "", leaseStart: "", leaseEnd: "", securityDeposit: "" })
                  } else {
                    setShowAddUnitForm(true)
                  }
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {showAddUnitForm ? "Cancel" : "Add Unit"}
                </Button>
              </div>

              {/* Display existing rental units */}
              {property.rentRoll && property.rentRoll.length > 0 && (
                <div className="space-y-3">
                  {property.rentRoll.map((unit: any) => (
                    <Card key={unit.id}>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Unit Name</Label>
                            <p className="text-sm">{unit.unitName || 'Not specified'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Tenant</Label>
                            <p className="text-sm">{unit.tenantName || 'Vacant'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-3">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Monthly Rent</Label>
                            <p className="text-sm">${unit.monthlyRent || 0}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Lease Start</Label>
                            <p className="text-sm">{unit.leaseStart || 'Not specified'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Lease End</Label>
                            <p className="text-sm">{unit.leaseEnd || 'Not specified'}</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <Label className="text-sm font-medium text-muted-foreground">Security Deposit</Label>
                          <p className="text-sm">${unit.securityDeposit || 0}</p>
                        </div>
                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUnit(unit)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUnit(unit.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {showAddUnitForm && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="unitName">Unit Name</Label>
                          <Input
                            id="unitName"
                            placeholder="e.g., 1A"
                            value={unitData.unitName}
                            onChange={(e) => setUnitData({...unitData, unitName: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="tenantName">Tenant Name</Label>
                          <Input
                            id="tenantName"
                            placeholder="e.g., John Doe"
                            value={unitData.tenantName}
                            onChange={(e) => setUnitData({...unitData, tenantName: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="monthlyRent">Monthly Rent</Label>
                          <Input
                            id="monthlyRent"
                            type="number"
                            placeholder="2500"
                            value={unitData.monthlyRent}
                            onChange={(e) => setUnitData({...unitData, monthlyRent: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="leaseStart">Lease Start</Label>
                          <Input
                            id="leaseStart"
                            type="date"
                            value={unitData.leaseStart}
                            onChange={(e) => setUnitData({...unitData, leaseStart: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="leaseEnd">Lease End</Label>
                          <Input
                            id="leaseEnd"
                            type="date"
                            value={unitData.leaseEnd}
                            onChange={(e) => setUnitData({...unitData, leaseEnd: e.target.value})}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="securityDeposit">Security Deposit</Label>
                        <Input
                          id="securityDeposit"
                          type="number"
                          placeholder="2500"
                          value={unitData.securityDeposit}
                          onChange={(e) => setUnitData({...unitData, securityDeposit: e.target.value})}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddUnitForm(false)
                            setEditingUnit(null)
                            setUnitData({ unitName: "", tenantName: "", monthlyRent: "", leaseStart: "", leaseEnd: "", securityDeposit: "" })
                          }}
                        >
                          Cancel
                        </Button>
                        <Button onClick={editingUnit ? handleSaveEditUnit : handleAddUnit}>
                          {editingUnit ? "Update Unit" : "Add Unit"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!property.rentRoll || property.rentRoll.length === 0) && !showAddUnitForm && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rental units added yet</p>
                  <p className="text-sm">Click &ldquo;Add Unit&rdquo; to add tenants and rental information</p>
                </div>
              )}
            </div>
            </TabsContent>

            {/* Maintenance Tab */}
            <TabsContent value="maintenance" className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Maintenance Requests</h3>
                <Button size="sm" onClick={() => {
                  if (showAddRequestForm) {
                    setShowAddRequestForm(false)
                    setEditingRequest(null)
                    setRequestData({ description: "", cost: "", status: "new" })
                  } else {
                    setShowAddRequestForm(true)
                  }
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {showAddRequestForm ? "Cancel" : "Log Request"}
                </Button>
              </div>

              {/* Display existing maintenance requests */}
              {property.maintenanceRequests && property.maintenanceRequests.length > 0 && (
                <div className="space-y-3">
                  {property.maintenanceRequests.map((request: any) => (
                    <Card key={request.id}>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                            <p className="text-sm">{request.description || 'No description'}</p>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                              <Badge variant={
                                request.status === 'completed' ? 'default' :
                                request.status === 'in_progress' ? 'secondary' : 'outline'
                              }>
                                {request.status === 'in_progress' ? 'In Progress' :
                                 request.status === 'completed' ? 'Completed' : 'New'}
                              </Badge>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">Cost</Label>
                              <p className="text-sm">${request.cost || 0}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">Date Logged</Label>
                              <p className="text-sm">{request.dateLogged || 'Not specified'}</p>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditRequest(request)}
                              disabled={isLoadingRequests}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteRequest(request.id)}
                              disabled={isLoadingRequests}
                            >
                              {isLoadingRequests ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                "Delete"
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {showAddRequestForm && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          placeholder="Describe the maintenance issue..."
                          value={requestData.description}
                          onChange={(e) => setRequestData({...requestData, description: e.target.value})}
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="cost">Estimated Cost</Label>
                          <Input
                            id="cost"
                            type="number"
                            placeholder="500"
                            value={requestData.cost}
                            onChange={(e) => setRequestData({...requestData, cost: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="status">Status</Label>
                          <select
                            id="status"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={requestData.status}
                            onChange={(e) => setRequestData({...requestData, status: e.target.value as "new" | "in_progress" | "completed"})}
                          >
                            <option value="new">New</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddRequestForm(false)
                            setEditingRequest(null)
                            setRequestData({ description: "", cost: "", status: "new" })
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={editingRequest ? handleSaveEditRequest : handleAddRequest}
                          disabled={isLoadingRequests}
                        >
                          {isLoadingRequests ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {editingRequest ? "Updating..." : "Logging..."}
                            </>
                          ) : (
                            editingRequest ? "Update Request" : "Log Request"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!property.maintenanceRequests || property.maintenanceRequests.length === 0) && !showAddRequestForm && (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No maintenance requests logged</p>
                  <p className="text-sm">Click &ldquo;Log Request&rdquo; to add repair or maintenance issues</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Websites Tab */}
          <TabsContent value="websites" className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Linked Websites</h3>
                <Button size="sm" onClick={() => {
                  if (showAddWebsiteForm) {
                    setShowAddWebsiteForm(false)
                    setEditingWebsite(null)
                    setWebsiteData({ websiteId: "", websiteName: "" })
                  } else {
                    setShowAddWebsiteForm(true)
                  }
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {showAddWebsiteForm ? "Cancel" : "Link Website"}
                </Button>
              </div>

              {/* Display existing linked websites */}
              {property.linkedWebsites && property.linkedWebsites.length > 0 && (
                <div className="space-y-3">
                  {property.linkedWebsites.map((website: any) => (
                    <Card key={website.id}>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">Website ID</Label>
                              <p className="text-sm font-mono">{website.id || 'Not specified'}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-muted-foreground">Website Name</Label>
                              <p className="text-sm">{website.name || 'Not specified'}</p>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-muted-foreground">Linked At</Label>
                            <p className="text-sm">{website.linkedAt ? new Date(website.linkedAt).toLocaleDateString() : 'Not specified'}</p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditWebsite(website)}
                              disabled={isLoadingWebsites}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteWebsite(website.id)}
                              disabled={isLoadingWebsites}
                            >
                              {isLoadingWebsites ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Unlinking...
                                </>
                              ) : (
                                "Unlink"
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {showAddWebsiteForm && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="websiteId">Website ID</Label>
                          <Input
                            id="websiteId"
                            placeholder="e.g., site_123"
                            value={websiteData.websiteId}
                            onChange={(e) => setWebsiteData({...websiteData, websiteId: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="websiteName">Website Name</Label>
                          <Input
                            id="websiteName"
                            placeholder="e.g., Downtown Realty"
                            value={websiteData.websiteName}
                            onChange={(e) => setWebsiteData({...websiteData, websiteName: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddWebsiteForm(false)
                            setEditingWebsite(null)
                            setWebsiteData({ websiteId: "", websiteName: "" })
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={editingWebsite ? handleSaveEditWebsite : handleAddWebsite}
                          disabled={isLoadingWebsites}
                        >
                          {isLoadingWebsites ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {editingWebsite ? "Updating..." : "Linking..."}
                            </>
                          ) : (
                            editingWebsite ? "Update Website" : "Link Website"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!property.linkedWebsites || property.linkedWebsites.length === 0) && !showAddWebsiteForm && (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No websites linked to this property</p>
                  <p className="text-sm">Click &ldquo;Link Website&rdquo; to connect client websites</p>
                </div>
              )}
            </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}